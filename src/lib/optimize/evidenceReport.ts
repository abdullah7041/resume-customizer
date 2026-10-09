import { createAssessmentContext, fingerprintText } from '@/lib/match/assessmentContext';
import { isConfirmationCurrent, proposalStatement } from '@/lib/optimize/evidenceReview';
import type { CandidateEvidenceReport, EvidenceReportInput } from '@/types/evidence-report';
import type { AssessmentContext } from '@/types/assessment';
import type { EvidenceSource } from '@/types/optimization-evidence';

const canonicalContext = (context: AssessmentContext): AssessmentContext => ({
  key: context.key,
  resumeFingerprint: context.resumeFingerprint,
  jobFingerprint: context.jobFingerprint,
  language: context.language,
  kind: context.kind,
  isOptimized: context.isOptimized,
  rubricVersion: context.rubricVersion,
});

const isAssessmentContext = (value: unknown): value is AssessmentContext => {
  if (!value || typeof value !== 'object') return false;
  const context = value as Partial<AssessmentContext>;
  return typeof context.key === 'string' && typeof context.resumeFingerprint === 'string'
    && typeof context.jobFingerprint === 'string' && (context.language === 'en' || context.language === 'ar')
    && (context.kind === 'match' || context.kind === 'optimize') && typeof context.isOptimized === 'boolean'
    && typeof context.rubricVersion === 'string';
};

const canonicalSource = (source: EvidenceSource): EvidenceSource => ({
  id: source.id,
  kind: source.kind,
  text: source.text,
  fingerprint: source.fingerprint,
  targetId: source.targetId,
  ...(typeof source.createdAt === 'string' && source.createdAt.trim() ? { createdAt: source.createdAt } : {}),
});

export const isEvidenceSource = (value: unknown): value is EvidenceSource => {
  if (!value || typeof value !== 'object') return false;
  const source = value as Partial<EvidenceSource>;
  return typeof source.id === 'string' && !!source.id && (source.kind === 'resume' || source.kind === 'clarification')
    && typeof source.text === 'string' && typeof source.fingerprint === 'string' && typeof source.targetId === 'string';
};

const canonicalOmissions = (value: EvidenceReportInput['omissions']) => value
  && Number.isFinite(value.resumeCharacters) && value.resumeCharacters >= 0
  && Number.isFinite(value.clarificationCharacters) && value.clarificationCharacters >= 0
  ? { resumeCharacters: value.resumeCharacters, clarificationCharacters: value.clarificationCharacters }
  : null;

/** Local candidate associations preserve quotations; they do not verify qualifications. */
export async function buildCandidateEvidenceReport(input: EvidenceReportInput): Promise<CandidateEvidenceReport> {
  // Capture before hashing: live store changes must never enter a reviewed snapshot.
  const data = structuredClone(input);
  const active = await createAssessmentContext({ resumeText: data.resumeText, jobDescription: data.jobDescription,
    language: data.language, kind: 'optimize', isOptimized: false, rubricVersion: 'optimize-v1' });
  const saved = data.run?.assessment;
  const savedValid = isAssessmentContext(saved?.context) && typeof saved?.requestId === 'string'
    && !!saved.requestId.trim() && typeof saved.createdAt === 'string' && !!saved.createdAt.trim();
  const savedContext = savedValid ? saved.context : null;
  const status = !savedValid || !savedContext ? 'legacy' : data.assessmentCurrent && data.run?.status === 'succeeded'
    && Object.entries(active).every(([field, value]) => savedContext[field as keyof typeof active] === value)
    && saved.jobSnapshot === data.jobDescription ? 'current' : 'outdated';
  const report: CandidateEvidenceReport = {
    version: 1, language: data.language, status,
    assessment: saved && savedContext ? { context: canonicalContext(savedContext), requestId: saved.requestId, createdAt: saved.createdAt } : null,
    snapshots: status === 'current' ? { resumeText: data.resumeText, jobDescription: data.jobDescription } : null,
    requirements: [], editProvenance: [], omissions: status === 'current' ? canonicalOmissions(data.omissions) : null,
    limitations: data.language === 'ar' ? [
      'الروابط اختارها المرشح ولا تثبت استيفاء المتطلبات. غياب الدليل لا يثبت غياب المؤهل.',
      'القائمة تختارها أنت وقد لا تشمل جميع متطلبات الوظيفة. يمكن تكرار المتطلب لإرفاق أكثر من مصدر.',
      'مطابقة المصدر لا تتحقق من المعنى أو صحة المؤهلات. التأكيد هو إفادة المرشح فقط.',
      'الدرجات تقديرات توافق وليست توصية توظيف أو احتمالات. لا يتضمن التقرير درجات أو سرد النموذج.',
      'نصوص الاقتراحات والتأكيدات مستبعدة. الإيضاحات مستبعدة إلا للمصادر التي تختارها. التقرير منفصل عن سيرة التقديم.',
    ] : [
      'Associations are candidate-selected and do not establish requirement support. Missing evidence does not establish a missing qualification.',
      'You select this list; it may omit job requirements. Repeat a requirement to associate another source.',
      'Source matching does not verify meaning or credentials. Confirmation is a candidate statement only.',
      'Scores are alignment estimates, not hiring recommendations or probabilities. Scores and model narrative are omitted.',
      'Proposal and confirmation wording is omitted. Clarifications are excluded unless their sources are selected. This report is separate from the application resume.',
    ],
  };
  if (status !== 'current') return report;

  // The live evidence slice can outlive or diverge from the assessment. Only
  // sources captured with this run may acquire an association in its report.
  const runData = data.run?.data;
  const capturedSources = runData && typeof runData === 'object' && 'evidenceSources' in runData
    && Array.isArray(runData.evidenceSources) ? runData.evidenceSources : [];
  const rawSources = Array.isArray(data.sources) ? data.sources : [];
  const sources = rawSources.filter(isEvidenceSource);
  const validSources = new Map<string, EvidenceSource>();
  // ponytail: quadratic duplicate checks are fine for this tiny candidate-curated list; pre-count IDs if it grows.
  for (const source of sources) {
    if (!source || (source.kind !== 'resume' && source.kind !== 'clarification')
      || typeof source.id !== 'string' || !source.id || typeof source.text !== 'string'
      || typeof source.targetId !== 'string' || typeof source.fingerprint !== 'string'
      || rawSources.filter(item => item && typeof item === 'object' && 'id' in item && item.id === source.id).length !== 1
      || capturedSources.filter(item => item && typeof item === 'object' && 'id' in item && item.id === source.id).length !== 1
      || !capturedSources.some(item => item && typeof item === 'object'
        && 'id' in item && item.id === source.id && 'kind' in item && item.kind === source.kind
        && 'text' in item && item.text === source.text && 'targetId' in item && item.targetId === source.targetId
        && 'fingerprint' in item && item.fingerprint === source.fingerprint)
      || !source.text.trim() || !source.targetId
      || source.fingerprint !== await fingerprintText(source.text)) continue;
    if (source.kind === 'resume' && !data.resumeText.includes(source.text)) continue;
    if (source.kind === 'clarification' && !data.includedClarificationIds.includes(source.id)) continue;
    validSources.set(source.id, source);
  }
  for (const selection of data.requirements) {
    const reference = selection.evidence;
    const source = reference && validSources.get(reference.sourceId);
    const requirementValid = !!selection.requirement.trim() && data.jobDescription.includes(selection.requirement);
    const evidenceValid = source && reference && typeof reference.quote === 'string'
      && !!reference.quote.trim() && source.text.includes(reference.quote)
      && reference.targetId === source.targetId && reference.fingerprint === source.fingerprint;
    report.requirements.push({ requirement: requirementValid ? selection.requirement : '',
      status: !requirementValid || (reference && !evidenceValid) ? 'invalid_selection' : evidenceValid ? 'candidate_associated' : 'gap',
      ...(requirementValid && evidenceValid ? { evidence: { ...canonicalSource(source), quote: reference.quote } } : {}) });
  }
  for (const [editIndex, card] of data.cards.entries()) {
    const evidence = card.evidence;
    // Private statement text may be present in a proposal, confirmation or rationale.
    if (evidence?.references.some(reference => sources.some(source => source.id === reference.sourceId
      && source.kind === 'clarification' && !data.includedClarificationIds.includes(source.id)))) {
      report.editProvenance.push({ editIndex, status: 'private_excluded' });
      continue;
    }
    const references = evidence?.references.map(reference => {
      const source = validSources.get(reference.sourceId);
      return source && typeof reference.quote === 'string' && reference.quote.trim() && source.text.includes(reference.quote)
        && evidence.sourceFingerprints[source.id] === source.fingerprint
        && (source.targetId === evidence.targetId || (source.kind === 'clarification' && source.targetId.startsWith('clarification:')))
        ? { ...canonicalSource(source), quote: reference.quote } : null;
    }) ?? [];
    const original = proposalStatement(card.original);
    const statement = proposalStatement(card.optimized);
    const originalSources = sources.filter(source => validSources.has(source.id) && source.kind === 'resume'
      && source.text.replace(/\s+/g, ' ').includes(original.replace(/\s+/g, ' ').trim()));
    const valid = card.assessmentKey === active.key && evidence?.version === 1
      && !['rejected', 'legacy'].includes(evidence.status) && !!original.trim()
      && evidence.originalFingerprint === await fingerprintText(original)
      && evidence.proposedFingerprint === await fingerprintText(statement)
      && originalSources.length === 1 && originalSources[0].targetId === evidence.targetId
      && references.length > 0 && references.every(reference => reference !== null)
      && new Set(evidence.references.map(reference => reference.sourceId)).size === evidence.references.length;
    const confirmed = valid && isConfirmationCurrent(evidence, card.confirmation, statement) && !!card.confirmation?.confirmedAt;
    report.editProvenance.push(valid ? {
      editIndex, status: confirmed ? 'candidate_confirmed' : evidence.status === 'source_matched' ? 'source_matched' : 'needs_review',
      proposedFingerprint: evidence.proposedFingerprint, references: references.filter(reference => reference !== null),
      ...(confirmed ? { confirmedAt: card.confirmation?.confirmedAt } : {}),
    } : { editIndex, status: 'unverified' });
  }
  return report;
}
