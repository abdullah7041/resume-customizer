import type { PartialResumeSchema } from '@/types/resume';
import type { CandidateProfile, EvidenceSource, JobRequirements, Recommendation } from '@/lib/jobs/types';
import { normalizeText } from '@/lib/jobs/normalize';

/** Only evidence-bearing sections leave the browser; contact details and summaries do not. */
export function candidateEvidence(resume: PartialResumeSchema | null | undefined): EvidenceSource[] {
  if (!resume) return [];
  let remaining = 120000;
  return [
    ...(resume.work ?? []).map((work, i) => ({ id: `work:${i}`, text: [work.description, work.summary, ...work.highlights ?? []].filter(Boolean).join('\n') })),
    ...(resume.projects ?? []).map((project, i) => ({ id: `project:${i}`, text: [project.description, ...project.highlights ?? []].filter(Boolean).join('\n') })),
    ...(resume.certificates ?? []).map((certificate, i) => ({ id: `certificate:${i}`, text: certificate.name })),
    ...(resume.education ?? []).map((education, i) => ({ id: `education:${i}`, text: [education.area, ...education.courses ?? [], ...education.highlights ?? []].filter(Boolean).join('\n') })),
  ].filter((source) => source.text.trim()).slice(0, 60).flatMap((source) => {
    const text = source.text.slice(0, Math.min(6000, remaining));
    remaining -= text.length;
    return text ? [{ ...source, text }] : [];
  });
}

/** Exact source verification also runs server-side before anything is cached. */
export function groundProfile(profile: CandidateProfile, sources: EvidenceSource[]): CandidateProfile {
  const textById = new Map(sources.map((source) => [source.id, normalizeText(source.text)]));
  return { capabilities: profile.capabilities.filter((capability) => {
    const text = textById.get(capability.sourceId);
    return capability.evidence.trim().length >= 8 && !!text?.includes(normalizeText(capability.evidence));
  }) };
}

export { extractRequirements } from '../../../netlify/lib/job-requirements';

function phraseIn(text: string, phrase: string): boolean {
  const normalized = normalizeText(phrase).trim();
  return normalized.length >= 2 && ` ${normalizeText(text).replace(/[^\p{L}\p{N}+#.]+/gu, ' ')} `.includes(` ${normalized.replace(/[^\p{L}\p{N}+#.]+/gu, ' ')} `);
}

export function recommend(profile: CandidateProfile, requirements?: JobRequirements): Recommendation {
  if (!requirements?.available || requirements.lines.length === 0) return { kind: 'unknown', reasons: [], gaps: [] };
  const reasons = profile.capabilities.filter((capability) => requirements.lines.some((line) => [capability.skill, ...capability.aliases].some((alias) => phraseIn(line, alias))));
  const gaps = requirements.lines.filter((line) => !reasons.some((capability) => [capability.skill, ...capability.aliases].some((alias) => phraseIn(line, alias))));
  // Relevance is a discovery signal, never a qualification verdict or a Match score.
  return { kind: reasons.length >= 2 && gaps.length === 0 ? 'strong' : reasons.length > 0 ? 'adjacent' : 'unknown', reasons, gaps: gaps.slice(0, 3) };
}
