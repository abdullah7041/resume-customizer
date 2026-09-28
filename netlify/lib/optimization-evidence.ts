import { createHash } from 'node:crypto';
import type {
  CandidateClarificationSource,
  EditEvidence,
  EvidenceCandidate,
  EvidenceSource,
  StructuredEvidenceResume,
} from '../../src/types/optimization-evidence.js';

export function fingerprintEvidenceText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function addSource(sources: EvidenceSource[], targetId: string, path: string, text: unknown): void {
  if (typeof text !== 'string' || !text.trim()) return;
  sources.push({
    id: fingerprintEvidenceText(JSON.stringify([targetId, path, text])),
    kind: 'resume', text, targetId,
    fingerprint: fingerprintEvidenceText(text),
  });
}

function addNestedSources(sources: EvidenceSource[], targetId: string, path: string, value: unknown): void {
  if (typeof value === 'string' || typeof value === 'number') {
    addSource(sources, targetId, path, String(value));
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => addNestedSources(sources, targetId, `${path}.${index}`, item));
  } else if (value && typeof value === 'object') {
    for (const [field, item] of Object.entries(value)) {
      addNestedSources(sources, targetId, `${path}.${field}`, item);
    }
  }
}

function addStructuredEntries(sources: EvidenceSource[], kind: string, entries: unknown[]): void {
  for (const entry of entries) {
    // Content identity survives array reordering. Identical entries deliberately
    // share an identity and remain ambiguous to the validator.
    const targetId = `${kind}:${fingerprintEvidenceText(JSON.stringify(entry))}`;
    addNestedSources(sources, targetId, kind, entry);
  }
}

export async function buildEvidenceSources(input: {
  resume: StructuredEvidenceResume;
  clarifications?: CandidateClarificationSource[];
}): Promise<EvidenceSource[]> {
  const sources: EvidenceSource[] = [];
  for (const [field, value] of Object.entries(input.resume.basics ?? {})) {
    addNestedSources(sources, `basics:${field}`, `basics.${field}`, value);
  }
  for (const [section, value] of Object.entries(input.resume)) {
    // Resume metadata may include earlier AI suggestions, not candidate facts.
    if (section === 'basics' || section === 'meta') continue;
    if (Array.isArray(value)) addStructuredEntries(sources, section, value);
    else addNestedSources(sources, section, section, value);
  }
  for (const item of input.clarifications ?? []) {
    if (!item.id || !item.targetId || !item.text.trim() || !item.createdAt) continue;
    sources.push({
      id: item.id, kind: 'clarification', targetId: item.targetId,
      text: item.text, createdAt: item.createdAt,
      fingerprint: fingerprintEvidenceText(item.text),
    });
  }
  return sources;
}

/** Rendered text has no role identity; changed edits remain subject to semantic review. */
export function buildRequestEvidenceSources(resumeText: string, userClarifications = ''): EvidenceSource[] {
  const sources: EvidenceSource[] = [];
  let sourceBlockLength = 2; // JSON array brackets; keep the prompt source block bounded.
  const add = (text: string, kind: EvidenceSource['kind']) => {
    const value = text;
    if (!value.trim()) return;
    const targetId = `${kind}:${fingerprintEvidenceText(value)}`;
    const source = { id: fingerprintEvidenceText(JSON.stringify([kind, value])), kind, text: value,
      targetId, fingerprint: fingerprintEvidenceText(value) };
    const entryLength = JSON.stringify({ id: source.id, targetId, kind, text: value }).length + (sources.length ? 1 : 0);
    if (sourceBlockLength + entryLength > 15000) return;
    sourceBlockLength += entryLength;
    sources.push(source);
  };
  for (const line of resumeText.slice(0, 15000).split(/\r?\n/)) add(line, 'resume');
  for (const block of userClarifications.split(/\r?\n\s*\r?\n/)) {
    const answer = block.match(/(?:^|\n)A:\s*([^\n]+)/)?.[1];
    if (answer) add(answer, 'clarification');
  }
  return sources;
}

function normalizeDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, digit => {
    const point = digit.codePointAt(0) ?? 0;
    return String(point >= 0x6f0 ? point - 0x6f0 : point - 0x660);
  });
}

function numbers(text: string): string[] {
  const normalized = normalizeDigits(text).replace(/٫/g, '.').replace(/٬/g, ',');
  return normalized.match(/\d+(?:[.,]\d+)*(?:\s?[%٪])?/g)?.map(value => value.replace(/\s+/g, '').replace(/٪/g, '%')) ?? [];
}

export async function validateEditEvidence(candidate: EvidenceCandidate, sources: EvidenceSource[]): Promise<EditEvidence> {
  const reasons: EditEvidence['reasons'] = [];
  const sourceFingerprints: Record<string, string> = {};
  const citedText: string[] = [];
  let ambiguous = false;

  const normalizedOriginal = candidate.original.replace(/\s+/g, ' ').trim();
  const originalSources = normalizedOriginal ? sources.filter(source =>
    source.kind === 'resume'
    && source.targetId === candidate.targetId
    && source.fingerprint === fingerprintEvidenceText(source.text)
    && source.text.replace(/\s+/g, ' ').includes(normalizedOriginal)
  ) : [];

  // A cited fact cannot establish which role's original text is being edited.
  if (originalSources.length !== 1) reasons.push('wrong_target');

  if (!candidate.references.length) reasons.push('missing_source');
  for (const reference of candidate.references) {
    const matches = sources.filter(source => source.id === reference.sourceId);
    if (matches.length === 0 || !reference.quote || matches.some(source => source.fingerprint !== fingerprintEvidenceText(source.text) || !source.text.includes(reference.quote))) {
      if (!reasons.includes('missing_source')) reasons.push('missing_source');
      continue;
    }
    if (matches.some(source => source.targetId !== candidate.targetId)) {
      if (!reasons.includes('wrong_target')) reasons.push('wrong_target');
      continue;
    }
    if (matches.length > 1) ambiguous = true;
    sourceFingerprints[reference.sourceId] = matches[0].fingerprint;
    citedText.push(reference.quote);
  }

  if (reasons.length === 0) {
    const supportedNumbers = new Set(numbers([...(originalSources.length ? [candidate.original] : []), ...citedText].join(' ')));
    if (numbers(candidate.proposed).some(number => !supportedNumbers.has(number))) reasons.push('new_number');
    if (ambiguous || originalSources.length !== 1 || normalizedOriginal !== candidate.proposed.replace(/\s+/g, ' ').trim()) reasons.push('semantic_review');
  }

  const rejected = reasons.includes('missing_source') || reasons.includes('wrong_target');
  return {
    version: 1,
    targetId: candidate.targetId,
    originalFingerprint: fingerprintEvidenceText(candidate.original),
    proposedFingerprint: fingerprintEvidenceText(candidate.proposed),
    references: candidate.references.map(reference => ({ ...reference })),
    sourceFingerprints,
    status: rejected ? 'rejected' : reasons.length ? 'needs_review' : 'source_matched',
    reasons,
  };
}
