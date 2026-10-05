import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { reportMaterials, summarize, targets } from './summarize.mjs';

// Entirely fictional rehearsal; never stored as participant observations.
const hash = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const resumeText = 'Built reporting APIs. Also led internal documentation.';
const jobDescription = 'Build APIs. Use SQL.';
const excerpt = 'Built reporting APIs.';
const context = { resumeFingerprint: hash(resumeText), jobFingerprint: hash(jobDescription), language: 'en', kind: 'optimize', isOptimized: false, rubricVersion: 'optimize-v1' };
context.key = JSON.stringify([context.resumeFingerprint, context.jobFingerprint, context.language, context.kind, context.isOptimized, context.rubricVersion]);
// Shape follows CandidateEvidenceReport: snapshots are full inputs, evidence is an excerpt with targetId.
const report = { version: 1, status: 'current', language: 'en', assessment: { context, requestId: 'fictional-run', createdAt: '2026-10-04' }, snapshots: { resumeText, jobDescription }, requirements: [{ requirement: 'Build APIs.', status: 'candidate_associated', evidence: { id: 'resume-source', kind: 'resume', text: excerpt, fingerprint: hash(excerpt), targetId: 'resume:role', quote: excerpt } }], editProvenance: [], omissions: null, limitations: [] };
const materials = reportMaterials(report);
assert.equal(materials.snapshots.resume.sha256, context.resumeFingerprint);
assert.equal(materials.sources[0].sha256, hash(excerpt));
assert.notEqual(materials.sources[0].sha256, materials.snapshots.resume.sha256);
assert.equal(materials.sources[0].targetId, 'resume:role');
const makeCase = (index) => ({
  id: `fictional-${index}`, language: ['en', 'ar', 'mixed'][index % 3], withdrawn: false,
  context, snapshots: materials.snapshots, packet: { version: 'v1', sha256: materials.packetSha256 },
  approval: { contextKey: context.key, packetVersion: 'v1', packetSha256: materials.packetSha256, manifestSha256: materials.manifestSha256, approvedAt: '2026-10-04T06:02:00Z' },
  candidateConsent: true, deliveryFactsInspected: true, allRequirementsEnumerated: true, allSubstantiveClaimsAudited: true, scoreHidden: true,
  sources: materials.sources.map((source) => ({ ...source, approval: { sha256: source.sha256, contextKey: context.key, packetVersion: 'v1', packetSha256: materials.packetSha256, manifestSha256: materials.manifestSha256 } })),
  reviewedRows: ['row-1', 'row-2'], corrections: [],
  claims: [{ id: 'claim-1', unsupported: false, auditReason: 'Fictional source supports exact claim only; requirement association is unverified', sourceIds: ['resume-source'] }],
  requirements: ['supported', 'not_evidenced'].map((reference, i) => ({ id: `r${i}`, text: `Fictional requirement ${i}`, priority: 'essential', reference, initial: [{ annotatorId: 'A', label: reference, reason: 'Fictional source' }, { annotatorId: 'B', label: reference, reason: 'Independent fictional source check' }], sourceIds: i ? [] : ['resume-source'], adjudicationReason: 'Fictional agreement retained' })),
  allocation: ['baseline', 'packet'].map((condition, i) => ({ condition, reviewerId: `reviewer-${(index + i) % 4}`, order: i + 1 })),
  reviews: ['baseline', 'packet'].map((condition, i) => ({ condition, reviewerId: `reviewer-${(index + i) % 4}`, order: i + 1, materials: { resumeSnapshotId: materials.snapshots.resume.id, resumeSha256: materials.snapshots.resume.sha256, jobSnapshotId: materials.snapshots.job.id, jobSha256: materials.snapshots.job.sha256, ...(i ? { packetVersion: 'v1', packetSha256: materials.packetSha256, manifestSha256: materials.manifestSha256 } : {}) }, roleFamiliar: true, submittedAt: '2026-10-04T06:05:00Z', elapsedSeconds: i ? 70 : 100, pauseSeconds: 0, comprehensionProvenance: true, comprehensionAlignment: true, judgments: ['supported', 'not_evidenced'].map((label, j) => ({ requirementId: `r${j}`, label, reason: 'Fictional supplied-evidence judgment' })) })),
});
const study = { kind: 'simulation', caseSchemaVersion: 2, protocolVersion: '2026-10-04-v2', lockedAt: '2026-10-04T06:00:00Z', allocationLockedAt: '2026-10-04T06:01:00Z', targets, reviewers: Array.from({ length: 4 }, (_, i) => ({ id: `reviewer-${i}`, consent: true, languages: ['en', 'ar', 'mixed'] })), cases: Array.from({ length: 12 }, (_, i) => makeCase(i)) };
const result = summarize(study);
assert.equal(result.status, 'insufficient_or_targets_not_met');
assert.deepEqual(result.blockers, ['Simulation cannot establish participant feasibility or accuracy']);
assert.equal(result.metrics.all.conditions.packet.missedQualifications.value, 0);
assert.ok(Math.abs(result.metrics.all.timeReduction - 0.3) < 0.00001);
assert.equal(result.metrics.ar.cases, 4);
const mutate = (change) => { const copy = structuredClone(study); change(copy); return summarize(copy); };
assert.equal(mutate((s) => { s.cases[0].approval.contextKey = 'b'.repeat(64); }).status, 'invalid');
assert.equal(mutate((s) => { s.cases[0].sources[0].sha256 = 'b'.repeat(64); }).status, 'invalid');
assert.equal(mutate((s) => { s.cases[0].sources.push({ id: 'new', kind: 'clarification', targetId: 'clarification:answer', sha256: 'b'.repeat(64), included: true, approval: s.cases[0].sources[0].approval }); }).status, 'invalid');
assert.equal(mutate((s) => { s.cases[0].packet.sha256 = 'b'.repeat(64); }).status, 'invalid');
assert.equal(mutate((s) => { s.cases[0].sources[0].approval.packetSha256 = 'b'.repeat(64); }).status, 'invalid');
assert.equal(mutate((s) => { s.cases[0].reviews[0].materials.jobSha256 = 'b'.repeat(64); }).status, 'invalid');
assert.equal(mutate((s) => { s.cases[0].reviews[1].materials.packetSha256 = 'b'.repeat(64); }).status, 'invalid');
assert.equal(mutate((s) => { s.cases[0].reviews[0].order = 2; }).status, 'invalid');
assert.equal(mutate((s) => { s.cases[0].allocation[1].reviewerId = 'reviewer-3'; }).status, 'invalid');
assert.equal(mutate((s) => { s.cases[0].reviews[1].reviewerId = s.cases[0].reviews[0].reviewerId; }).status, 'invalid');
assert.equal(mutate((s) => { delete s.cases[0].reviews[0].elapsedSeconds; }).metrics, null);
assert.equal(mutate((s) => { s.kind = 'participant'; }).status, 'invalid');
assert.equal(mutate((s) => { s.cases[0].reviews[0].judgments = []; }).status, 'invalid');
assert.equal(mutate((s) => { s.cases[0].requirements[0].initial[1].label = 'partial'; }).metrics.all.initialDisagreement.numerator, 1);
assert.equal(mutate((s) => { s.cases[0].corrections = Array.from({ length: 3 }, () => ({ rowId: 'row-1', role: 'candidate', stage: 'pre_share', substantive: true })); }).metrics.all.preShareCorrections.numerator, 1);
assert.ok(mutate((s) => { s.cases[0].claims[0].unsupported = true; }).blockers.includes('all: target not met'));
assert.equal(mutate((s) => { s.cases = []; }).metrics.all.unsupportedClaims.value, null);
assert.ok(mutate((s) => { s.cases[0].withdrawn = true; }).blockers.includes('Fewer than four en cases'));
assert.equal(summarize({ ...study, cases: [null] }).status, 'invalid');
assert.equal(mutate((s) => { s.cases[0].requirements[0].initial = [null]; }).status, 'invalid');
assert.equal(mutate((s) => { s.cases[0].reviews[0].judgments = [null]; }).status, 'invalid');
assert.equal(mutate((s) => { s.cases[0].sources = [null]; }).status, 'invalid');
assert.equal(mutate((s) => { s.cases[0].sources.push({ ...s.cases[0].sources[0], id: null }); }).metrics, null);
assert.equal(mutate((s) => { const source = { ...s.cases[0].sources[0] }; delete source.id; s.cases[0].sources.push(source); }).metrics, null);
assert.equal(mutate((s) => { s.cases[0].allocation = [null]; }).status, 'invalid');
assert.equal(mutate((s) => { s.cases[0].context.resumeFingerprint = 'b'.repeat(64); }).status, 'invalid');
assert.equal(mutate((s) => { s.cases[0].allRequirementsEnumerated = false; }).status, 'invalid');
assert.ok(mutate((s) => { s.cases[1].reviews[1].judgments[0].label = 'partial'; }).blockers.includes('ar: target not met'));
const temporaryFolder = mkdtempSync(join(tmpdir(), 'watheq-pilot-test-'));
const malformedPath = join(temporaryFolder, 'malformed.json');
try {
  writeFileSync(malformedPath, '{ PRIVATE_SOURCE_SENTINEL not JSON }');
  const execution = spawnSync(process.execPath, [fileURLToPath(new URL('./summarize.mjs', import.meta.url)), malformedPath], { encoding: 'utf8' });
  assert.equal(execution.status, 1);
  assert.ok(!`${execution.stdout}${execution.stderr}`.includes('PRIVATE_SOURCE_SENTINEL'));
  assert.match(execution.stderr, /Pilot input could not be processed/);
} finally { unlinkSync(malformedPath); rmdirSync(temporaryFolder); }
process.stdout.write('Pilot calculator fictional assertions passed; no participant validation performed.\n');
