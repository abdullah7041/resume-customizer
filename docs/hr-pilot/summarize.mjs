import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const targets = Object.freeze({ cases: 12, reviewers: 4, casesPerLanguage: 4, essentialMissRate: 0.05, correctionRate: 0.15, disagreementRate: 0.20, timeReduction: 0.20 });
const labels = ['supported', 'partial', 'not_evidenced', 'ambiguous'];
const languages = ['en', 'ar', 'mixed'];
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const unique = (values) => new Set(values).size === values.length;
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
};
const rate = (numerator, denominator) => ({ numerator, denominator, value: denominator ? numerator / denominator : null });
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const isHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const manifestHash = (sources) => sha256(JSON.stringify(sources.map(({ id, kind, targetId, sha256: fingerprint, included }) => [id, kind, targetId, fingerprint, included]).sort((a, b) => a[0].localeCompare(b[0]))));

/** Convert the current CandidateEvidenceReport contract without conflating excerpts with full inputs. */
export function reportMaterials(report) {
  const context = report?.assessment?.context;
  const snapshots = report?.snapshots;
  if (report?.version !== 1 || report.status !== 'current' || !context || !snapshots || typeof snapshots.resumeText !== 'string' || typeof snapshots.jobDescription !== 'string') throw new Error('Current report snapshots and context required');
  const resume = { id: 'resume-input', sha256: sha256(snapshots.resumeText) };
  const job = { id: 'job-input', sha256: sha256(snapshots.jobDescription) };
  if (resume.sha256 !== context.resumeFingerprint || job.sha256 !== context.jobFingerprint) throw new Error('Report snapshots differ from assessment context');
  const evidence = [...(report.requirements ?? []).flatMap((row) => row.evidence ? [row.evidence] : []), ...(report.editProvenance ?? []).flatMap((row) => row.references ?? [])];
  const sources = [];
  for (const source of evidence) {
    if (!nonempty(source.id) || !['resume', 'clarification'].includes(source.kind) || !nonempty(source.targetId) || typeof source.text !== 'string' || sha256(source.text) !== source.fingerprint) throw new Error('Invalid report evidence excerpt');
    const record = { id: source.id, kind: source.kind, targetId: source.targetId, sha256: source.fingerprint, included: true };
    const existing = sources.find((item) => item.id === source.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(record)) throw new Error('Conflicting report evidence source');
    if (!existing) sources.push(record);
  }
  return { snapshots: { resume, job }, sources, packetSha256: sha256(JSON.stringify(report)), manifestSha256: manifestHash(sources) };
}

/** Local supplied-evidence feasibility calculation; never a credential/hiring assessment. */
export function summarize(study) {
  const errors = [];
  const require = (valid, message) => { if (!valid) errors.push(message); };
  require(study && typeof study === 'object', 'Study must be an object');
  if (!study || typeof study !== 'object') return { status: 'invalid', errors, metrics: null };
  require(['simulation', 'participant'].includes(study.kind), 'kind must be simulation or participant');
  require(study.caseSchemaVersion === 2, 'Case schema version 2 required');
  require(nonempty(study.protocolVersion) && nonempty(study.lockedAt), 'Protocol version and preregistration time required');
  require(Number.isFinite(Date.parse(study.lockedAt)), 'Invalid preregistration time');
  require(study.targets && Object.keys(study.targets).length === Object.keys(targets).length && Object.entries(targets).every(([key, value]) => study.targets[key] === value), 'Targets must match preregistered protocol');
  require(Number.isFinite(Date.parse(study.allocationLockedAt)) && Date.parse(study.allocationLockedAt) >= Date.parse(study.lockedAt), 'Allocation must be locked after protocol and before reviews');
  const cases = Array.isArray(study.cases) ? study.cases : [];
  const reviewers = Array.isArray(study.reviewers) ? study.reviewers : [];
  require(Array.isArray(study.cases) && Array.isArray(study.reviewers), 'cases and reviewers arrays required');
  if (![...cases, ...reviewers].every((item) => item && typeof item === 'object' && !Array.isArray(item))) return { status: 'invalid', errors: ['Cases/reviewers must contain objects'], metrics: null };
  require(unique(cases.map((c) => c.id)), 'Duplicate case IDs');
  require(unique(reviewers.map((r) => r.id)), 'Duplicate reviewer IDs');
  for (const reviewer of reviewers) {
    require(nonempty(reviewer.id) && reviewer.consent === true, 'Reviewer ID/consent required');
    require(Array.isArray(reviewer.languages) && reviewer.languages.every((l) => languages.includes(l)), 'Invalid reviewer languages');
  }
  if (errors.length) return { status: 'invalid', kind: study.kind, errors, metrics: null };
  if (study.kind === 'participant') {
    require(study.collectionAuthorized === true, 'Participant collection lacks explicit authorization record');
    require(nonempty(study.authorizationReference) && nonempty(study.privateStorage) && nonempty(study.deletionDue), 'Authorization, private storage and deletion date required');
    const date = typeof study.deletionDue === 'string' ? study.deletionDue.slice(0, 10) : '';
    require(/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(study.deletionDue)) && new Date(date).toISOString().slice(0, 10) === date, 'Valid participant deletion date required');
  }
  for (const c of cases) {
    const at = `Case ${c.id}`;
    require(nonempty(c.id) && languages.includes(c.language), `${at}: ID/language required`);
    require(typeof c.withdrawn === 'boolean', `${at}: withdrawn must be explicit`);
    if (c.withdrawn === true) continue;
    if (['sources', 'corrections', 'claims', 'requirements', 'allocation', 'reviews'].some((key) => !Array.isArray(c[key]) || !c[key].every((item) => item && typeof item === 'object' && !Array.isArray(item)))) { errors.push(`${at}: record arrays must contain objects`); continue; }
    if (c.requirements.some((r) => !Array.isArray(r.initial) || !r.initial.every((a) => a && typeof a === 'object')) || c.reviews.some((r) => !Array.isArray(r.judgments) || !r.judgments.every((j) => j && typeof j === 'object'))) { errors.push(`${at}: annotation/judgment arrays must contain objects`); continue; }
    const context = c.context;
    const contextValid = context && /^[a-f0-9]{64}$/.test(context.resumeFingerprint ?? '') && /^[a-f0-9]{64}$/.test(context.jobFingerprint ?? '') && ['en', 'ar'].includes(context.language) && ['match', 'optimize'].includes(context.kind) && typeof context.isOptimized === 'boolean' && nonempty(context.rubricVersion) && context.key === JSON.stringify([context.resumeFingerprint, context.jobFingerprint, context.language, context.kind, context.isOptimized, context.rubricVersion]);
    require(contextValid, `${at}: exact existing AssessmentContext required`);
    const packet = c.packet;
    const approval = c.approval;
    const snapshots = c.snapshots;
    const sources = Array.isArray(c.sources) ? c.sources : [];
    const manifest = sources.every((s) => s && typeof s === 'object' && nonempty(s.id)) ? manifestHash(sources) : null;
    require(nonempty(packet?.version) && isHash(packet?.sha256) && contextValid && approval?.contextKey === context.key && approval?.packetVersion === packet?.version && approval?.packetSha256 === packet?.sha256 && approval?.manifestSha256 === manifest, `${at}: candidate approval must match exact context, packet content and source manifest`);
    require(nonempty(snapshots?.resume?.id) && nonempty(snapshots?.job?.id) && snapshots.resume.id !== snapshots.job.id && contextValid && snapshots.resume.sha256 === context.resumeFingerprint && snapshots.job.sha256 === context.jobFingerprint, `${at}: full input snapshots must match assessment fingerprints`);
    require(c.candidateConsent === true && c.deliveryFactsInspected === true && c.scoreHidden === true && c.allRequirementsEnumerated === true && c.allSubstantiveClaimsAudited === true, `${at}: consent, delivery inspection, complete requirements/claims and hidden score required`);
    require(nonempty(approval?.approvedAt) && Date.parse(approval?.approvedAt) >= Date.parse(study.lockedAt), `${at}: candidate approval must follow preregistration`);
    require(sources.length > 0 && unique(sources.map((s) => s.id)), `${at}: unique report excerpts required`);
    for (const s of sources) require(nonempty(s.id) && ['resume', 'clarification'].includes(s.kind) && nonempty(s.targetId) && isHash(s.sha256) && typeof s.included === 'boolean' && (!s.included || (s.approval?.sha256 === s.sha256 && s.approval?.contextKey === context?.key && s.approval?.packetVersion === packet?.version && s.approval?.packetSha256 === packet?.sha256 && s.approval?.manifestSha256 === manifest)), `${at}: invalid or unapproved report excerpt ${s.id}`);
    const rows = Array.isArray(c.reviewedRows) ? c.reviewedRows : [];
    require(rows.length > 0 && unique(rows) && rows.every(nonempty), `${at}: unique reviewed worksheet rows required`);
    const corrections = Array.isArray(c.corrections) ? c.corrections : [];
    require(Array.isArray(c.corrections), `${at}: corrections array required (empty only if measured none)`);
    for (const correction of corrections) require(rows.includes(correction.rowId) && ['candidate', 'facilitator', 'recruiter'].includes(correction.role) && ['pre_share', 'reviewer_review'].includes(correction.stage) && typeof correction.substantive === 'boolean', `${at}: invalid correction event`);
    const claims = Array.isArray(c.claims) ? c.claims : [];
    require(claims.length > 0 && unique(claims.map((a) => a.id)), `${at}: substantive claim audit required`);
    for (const claim of claims) require(nonempty(claim.id) && typeof claim.unsupported === 'boolean' && nonempty(claim.auditReason) && Array.isArray(claim.sourceIds) && claim.sourceIds.length > 0 && claim.sourceIds.every((id) => sources.some((s) => s.id === id && s.included)), `${at}: claim ${claim.id} lacks supplied-evidence audit or included provenance`);
    const requirements = Array.isArray(c.requirements) ? c.requirements : [];
    require(requirements.length > 0 && unique(requirements.map((r) => r.id)), `${at}: unique explicit requirements required`);
    for (const r of requirements) {
      require(nonempty(r.id) && nonempty(r.text) && ['essential', 'desirable', 'unspecified'].includes(r.priority) && labels.includes(r.reference), `${at}: invalid requirement/reference`);
      require(Array.isArray(r.initial) && r.initial.length === 2 && unique(r.initial.map((a) => a.annotatorId)) && r.initial.every((a) => nonempty(a.annotatorId) && labels.includes(a.label) && nonempty(a.reason)), `${at}: two independent initial annotations required`);
      require(nonempty(r.adjudicationReason) && Array.isArray(r.sourceIds) && r.sourceIds.every((id) => sources.some((s) => s.id === id && s.included)) && (r.reference !== 'supported' || r.sourceIds.length > 0), `${at}: adjudication and supplied reference provenance required`);
    }
    const reviews = Array.isArray(c.reviews) ? c.reviews : [];
    require(reviews.length === 2 && unique(reviews.map((r) => r.condition)) && unique(reviews.map((r) => r.reviewerId)), `${at}: different baseline/packet reviewers required`);
    const allocation = Array.isArray(c.allocation) ? c.allocation : [];
    require(allocation.length === 2 && unique(allocation.map((a) => a.condition)) && unique(allocation.map((a) => a.order)) && allocation.every((a) => ['baseline', 'packet'].includes(a.condition) && [1, 2].includes(a.order) && nonempty(a.reviewerId)), `${at}: locked condition/order allocation required`);
    for (const review of reviews) {
      const reviewer = reviewers.find((r) => r.id === review.reviewerId);
      require(['baseline', 'packet'].includes(review.condition) && reviewer?.languages?.includes(c.language) && review.roleFamiliar === true, `${at}: incompatible reviewer or condition`);
      const material = review.materials;
      if (!material || typeof material !== 'object' || Array.isArray(material)) { errors.push(`${at}: review materials must be an object`); continue; }
      require(allocation.some((a) => a.condition === review.condition && a.reviewerId === review.reviewerId && a.order === review.order), `${at}: review differs from locked allocation`);
      require(material?.resumeSnapshotId === snapshots?.resume?.id && material?.resumeSha256 === snapshots?.resume?.sha256 && material?.jobSnapshotId === snapshots?.job?.id && material?.jobSha256 === snapshots?.job?.sha256 && (review.condition === 'packet' ? material.packetVersion === packet?.version && material.packetSha256 === packet?.sha256 && material.manifestSha256 === manifest : !('packetVersion' in (material ?? {})) && !('packetSha256' in (material ?? {})) && !('manifestSha256' in (material ?? {}))), `${at}: review materials differ from approved input/packet`);
      require(nonempty(review.submittedAt) && Date.parse(review.submittedAt) > Date.parse(approval?.approvedAt) && Date.parse(review.submittedAt) > Date.parse(study.allocationLockedAt), `${at}: review submission must follow approval and locked allocation`);
      require(Number.isFinite(review.elapsedSeconds) && review.elapsedSeconds > 0 && Number.isFinite(review.pauseSeconds) && review.pauseSeconds >= 0 && review.pauseSeconds < review.elapsedSeconds, `${at}: invalid/missing timing`);
      require(typeof review.comprehensionProvenance === 'boolean' && typeof review.comprehensionAlignment === 'boolean', `${at}: comprehension must be recorded`);
      require(Array.isArray(review.judgments) && review.judgments.length === requirements.length && unique(review.judgments.map((j) => j.requirementId)) && review.judgments.every((j) => requirements.some((r) => r.id === j.requirementId) && labels.includes(j.label) && nonempty(j.reason)), `${at}: complete requirement judgments required`);
    }
  }
  if (errors.length) return { status: 'invalid', kind: study.kind, errors, metrics: null };
  const active = cases.filter((c) => !c.withdrawn);
  const metrics = {};
  for (const language of ['all', ...languages]) {
    const group = active.filter((c) => language === 'all' || c.language === language);
    const requirements = group.flatMap((c) => c.requirements);
    const claims = group.flatMap((c) => c.claims);
    const corrected = group.reduce((n, c) => n + new Set(c.corrections.filter((e) => e.stage === 'pre_share' && e.substantive).map((e) => e.rowId)).size, 0);
    const conditionMetrics = {};
    for (const condition of ['baseline', 'packet']) {
      let misses = 0; let supported = 0; let essentialMisses = 0; let essentials = 0; let falseSupported = 0; let unsupportedReference = 0;
      for (const c of group) {
        const review = c.reviews.find((r) => r.condition === condition);
        for (const reference of c.requirements) {
          const judgment = review.judgments.find((j) => j.requirementId === reference.id);
          if (reference.reference === 'supported') {
            supported++; if (judgment.label !== 'supported') misses++;
            if (reference.priority === 'essential') { essentials++; if (judgment.label !== 'supported') essentialMisses++; }
          } else { unsupportedReference++; if (judgment.label === 'supported') falseSupported++; }
        }
      }
      conditionMetrics[condition] = { missedQualifications: rate(misses, supported), essentialMisses: rate(essentialMisses, essentials), incorrectSupported: rate(falseSupported, unsupportedReference), medianActiveSeconds: median(group.map((c) => { const r = c.reviews.find((a) => a.condition === condition); return r.elapsedSeconds - r.pauseSeconds; })) };
    }
    const baseline = conditionMetrics.baseline; const packet = conditionMetrics.packet;
    const timeReduction = baseline.medianActiveSeconds === null ? null : 1 - packet.medianActiveSeconds / baseline.medianActiveSeconds;
    const correctionStages = {};
    for (const stage of ['pre_share', 'reviewer_review']) for (const role of ['candidate', 'facilitator', 'recruiter']) correctionStages[`${stage}_${role}`] = rate(group.reduce((n, c) => n + new Set(c.corrections.filter((e) => e.stage === stage && e.role === role && e.substantive).map((e) => e.rowId)).size, 0), group.reduce((n, c) => n + c.reviewedRows.length, 0));
    metrics[language] = { cases: group.length, unsupportedClaims: rate(claims.filter((a) => a.unsupported).length, claims.length), initialDisagreement: rate(requirements.filter((r) => r.initial[0].label !== r.initial[1].label).length, requirements.length), preShareCorrections: rate(corrected, group.reduce((n, c) => n + c.reviewedRows.length, 0)), correctionStages, conditions: conditionMetrics, timeReduction, pairedTimeDifferences: group.map((c) => { const b = c.reviews.find((r) => r.condition === 'baseline'); const p = c.reviews.find((r) => r.condition === 'packet'); return { caseId: c.id, packetMinusBaselineSeconds: p.elapsedSeconds - p.pauseSeconds - (b.elapsedSeconds - b.pauseSeconds) }; }) };
  }
  const blockers = [];
  if (active.length < targets.cases) blockers.push('Fewer than 12 complete participant cases');
  if (reviewers.length < targets.reviewers || reviewers.some((r) => !active.some((c) => c.reviews.some((a) => a.reviewerId === r.id)))) blockers.push('Four active consenting reviewers required');
  for (const language of languages) if (metrics[language].cases < targets.casesPerLanguage) blockers.push(`Fewer than four ${language} cases`);
  for (const [language, m] of Object.entries(metrics)) {
    if (m.unsupportedClaims.value === null || m.conditions.packet.missedQualifications.value === null || m.conditions.packet.incorrectSupported.value === null || m.conditions.packet.essentialMisses.value === null) blockers.push(`${language}: unavailable denominator`);
    if (m.unsupportedClaims.numerator > 0 || m.preShareCorrections.value > targets.correctionRate || m.initialDisagreement.value > targets.disagreementRate || m.conditions.packet.essentialMisses.value > targets.essentialMissRate || m.conditions.packet.missedQualifications.value > m.conditions.baseline.missedQualifications.value || m.conditions.packet.incorrectSupported.value > m.conditions.baseline.incorrectSupported.value || (m.timeReduction !== null && m.timeReduction < targets.timeReduction)) blockers.push(`${language}: target not met`);
  }
  if (active.some((c) => c.reviews.some((r) => !r.comprehensionProvenance || !r.comprehensionAlignment))) blockers.push('Reviewer comprehension target not met');
  if (study.kind === 'simulation') blockers.unshift('Simulation cannot establish participant feasibility or accuracy');
  return { status: blockers.length ? 'insufficient_or_targets_not_met' : 'exploratory_targets_met', kind: study.kind, errors: [], blockers, excludedWithdrawals: cases.length - active.length, metrics, limitation: 'Supplied-evidence reference only; small sample and different reviewers limit causal interpretation. No credential verification, hiring reliability or deployment authorization.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node docs/hr-pilot/summarize.mjs PRIVATE_STUDY.json');
    const result = summarize(JSON.parse(readFileSync(process.argv[2], 'utf8')));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status === 'invalid') process.exitCode = 1;
  } catch { process.stderr.write('Pilot input could not be processed; check file path and JSON schema.\n'); process.exitCode = 1; }
}
