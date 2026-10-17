import { describe, expect, it } from 'vitest';
import { createAssessmentContext, fingerprintText } from '@/lib/match/assessmentContext';
import { buildCandidateEvidenceReport } from '@/lib/optimize/evidenceReport';
import type { EvidenceReportInput } from '@/types/evidence-report';

export async function reportFixture(): Promise<EvidenceReportInput> {
  const text = 'Built reporting APIs.';
  const privateText = 'Private candidate answer: delivered confidential programme.';
  const context = await createAssessmentContext({ resumeText: text, jobDescription: 'Build APIs. Use SQL.', language: 'en', kind: 'optimize', isOptimized: false, rubricVersion: 'optimize-v1' });
  const fingerprint = await fingerprintText(text);
  const sources: EvidenceReportInput['sources'] = [
    { id: 'resume-source', kind: 'resume', text, targetId: 'resume:role', fingerprint },
    { id: 'private-source', kind: 'clarification', text: privateText, targetId: 'clarification:answer', fingerprint: await fingerprintText(privateText) },
  ];
  return {
    resumeText: text, jobDescription: 'Build APIs. Use SQL.', language: 'en', assessmentCurrent: true,
    run: { status: 'succeeded', startedAt: '2026-10-04', finishedAt: '2026-10-04', phase: null, error: null,
      cards: [], data: { privateText, evidenceSources: structuredClone(sources) }, keywords: { add: [], remove: [], neutral: [] },
      assessment: { context, jobSnapshot: 'Build APIs. Use SQL.', requestId: 'fictional-run', createdAt: '2026-10-04', result: { privateText, score: 99, reasoning: privateText } } },
    sources,
    cards: [{ sectionId: 'edit', assessmentKey: context.key, sectionType: 'experience', original: text, optimized: text, applied: false,
      evidence: { version: 1, targetId: 'resume:role', originalFingerprint: fingerprint, proposedFingerprint: fingerprint,
        references: [{ sourceId: 'resume-source', quote: text }], sourceFingerprints: { 'resume-source': fingerprint }, status: 'source_matched', reasons: [] } }],
    requirements: [{ requirement: 'Build APIs.', evidence: { sourceId: 'resume-source', quote: text, targetId: 'resume:role', fingerprint } }, { requirement: 'Use SQL.' }],
    includedClarificationIds: [], omissions: { resumeCharacters: 7, clarificationCharacters: 2 },
  };
}

describe('candidate evidence report', () => {
  it('preserves exact context, snapshots, quotes, gaps and omissions without claiming support', async () => {
    const input = await reportFixture();
    const report = await buildCandidateEvidenceReport(input);
    expect(report.status).toBe('current');
    expect(report.assessment?.context).toEqual(input.run?.assessment?.context);
    expect(report.snapshots).toEqual({ resumeText: input.resumeText, jobDescription: input.jobDescription });
    expect(report.requirements.map(row => row.status)).toEqual(['candidate_associated', 'gap']);
    expect(report.requirements[0].evidence?.quote).toBe(input.sources[0].text);
    expect(report.omissions).toEqual(input.omissions);
    expect(report.editProvenance[0].status).toBe('source_matched');
    expect(report.editProvenance[0]).not.toHaveProperty('statement');
    expect(report).not.toHaveProperty('score');
    expect(JSON.stringify(report)).not.toContain('Private candidate answer');
  });

  it('serializes only canonical context and source fields', async () => {
    const input = await reportFixture();
    Object.assign(input.run!.assessment!.context, { privateContextNote: 'context secret' });
    Object.assign(input.sources[0], { privateSourceNote: 'source secret', createdAt: 42 });
    Object.assign((input.run!.data as { evidenceSources: EvidenceReportInput['sources'] }).evidenceSources[0], {
      privateSourceNote: 'source secret', createdAt: 42,
    });
    Object.assign(input.omissions!, { privateOmissionNote: 'omission secret' });

    const report = await buildCandidateEvidenceReport(input);
    const serialized = JSON.stringify(report);

    expect(serialized).not.toContain('context secret');
    expect(serialized).not.toContain('source secret');
    expect(serialized).not.toContain('omission secret');
    expect(report.requirements[0].evidence).not.toHaveProperty('createdAt');
    expect(report.editProvenance[0].references?.[0]).not.toHaveProperty('createdAt');
  });

  it.each(['resume', 'job', 'language', 'rubric', 'jobSnapshot', 'contextFingerprint', 'currentFlag', 'runStatus'])('marks %s changes outdated without borrowing current facts', async change => {
    const input = await reportFixture();
    if (change === 'resume') input.resumeText += ' Changed';
    if (change === 'job') input.jobDescription += ' Changed';
    if (change === 'language') input.language = 'ar';
    if (change === 'rubric') input.run!.assessment!.context.rubricVersion = 'old';
    if (change === 'jobSnapshot') input.run!.assessment!.jobSnapshot = 'Other job';
    if (change === 'contextFingerprint') input.run!.assessment!.context.resumeFingerprint = 'forged';
    if (change === 'currentFlag') input.assessmentCurrent = false;
    if (change === 'runStatus') input.run!.status = 'failed';
    const report = await buildCandidateEvidenceReport(input);
    expect(report.status).toBe('outdated');
    expect(report.snapshots).toBeNull();
    expect(report.requirements).toEqual([]);
    expect(report.editProvenance).toEqual([]);
  });

  it('keeps legacy context absent without manufacturing provenance', async () => {
    const input = await reportFixture();
    delete input.run!.assessment;
    expect(await buildCandidateEvidenceReport(input)).toMatchObject({ status: 'legacy', assessment: null, snapshots: null, requirements: [] });
  });

  it('treats a malformed legacy context as unavailable without exposing current snapshots', async () => {
    const input = await reportFixture();
    input.run!.assessment!.context = { key: 'legacy-only' } as typeof input.run.assessment.context;

    expect(await buildCandidateEvidenceReport(input)).toMatchObject({
      status: 'legacy', assessment: null, snapshots: null, requirements: [], editProvenance: [],
    });
  });

  it.each(['requestId', 'createdAt'])('treats malformed %s metadata as unavailable', async field => {
    const input = await reportFixture();
    Object.assign(input.run!.assessment!, { [field]: 42 });
    expect(await buildCandidateEvidenceReport(input)).toMatchObject({
      status: 'legacy', assessment: null, snapshots: null, requirements: [], editProvenance: [],
    });
  });

  it('omits invalid omission counts', async () => {
    const input = await reportFixture();
    input.omissions = { resumeCharacters: -1, clarificationCharacters: Number.NaN };
    expect((await buildCandidateEvidenceReport(input)).omissions).toBeNull();
  });

  it.each(['missing', 'quote', 'target', 'fingerprint', 'forgedSource', 'duplicate', 'requirement', 'runSourceChanged', 'runSourceMissing'])('rejects %s requirement evidence', async change => {
    const input = await reportFixture();
    const reference = input.requirements[0].evidence!;
    if (change === 'missing') reference.sourceId = 'absent';
    if (change === 'quote') reference.quote = 'Built Kubernetes clusters';
    if (change === 'target') reference.targetId = 'other-role';
    if (change === 'fingerprint') reference.fingerprint = 'changed';
    if (change === 'forgedSource') { input.sources[0].text = 'Invented qualification'; input.sources[0].fingerprint = await fingerprintText(input.sources[0].text); }
    if (change === 'duplicate') input.sources.push(input.sources[0]);
    if (change === 'requirement') input.requirements[0].requirement = 'Hire this candidate';
    if (change === 'runSourceChanged') (input.run!.data as { evidenceSources: EvidenceReportInput['sources'] }).evidenceSources[0].targetId = 'forged-target';
    if (change === 'runSourceMissing') (input.run!.data as { evidenceSources: EvidenceReportInput['sources'] }).evidenceSources = [];
    const report = await buildCandidateEvidenceReport(input);
    expect(report.requirements[0].status).toBe('invalid_selection');
    expect(report.requirements[0].evidence).toBeUndefined();
  });

  it('rejects a valid source when a malformed duplicate ID is present', async () => {
    const input = await reportFixture();
    input.sources.push({ id: 'resume-source' } as unknown as EvidenceReportInput['sources'][number]);

    const report = await buildCandidateEvidenceReport(input);

    expect(report.requirements[0].status).toBe('invalid_selection');
    expect(report.requirements[0].evidence).toBeUndefined();
    expect(report.editProvenance[0]).toEqual({ editIndex: 0, status: 'unverified' });
  });

  it('excludes private answers and derived wording until source opt-in; never copies proposal prose', async () => {
    const input = await reportFixture();
    const source = input.sources[1];
    const card = input.cards[0];
    card.sectionId = `PRIVATE ${source.text}`;
    card.optimized = source.text;
    card.evidence!.proposedFingerprint = source.fingerprint;
    card.evidence!.status = 'needs_review';
    card.evidence!.references.push({ sourceId: source.id, quote: source.text });
    card.evidence!.sourceFingerprints[source.id] = source.fingerprint;
    card.confirmation = { targetId: card.evidence!.targetId, proposedFingerprint: source.fingerprint, statement: source.text, confirmedAt: '2026-10-04' };
    input.requirements.push({ requirement: 'Build APIs.', evidence: { sourceId: source.id, targetId: source.targetId, fingerprint: source.fingerprint, quote: source.text } });
    const hidden = await buildCandidateEvidenceReport(input);
    expect(JSON.stringify(hidden)).not.toContain(source.text);
    expect(hidden.editProvenance[0]).toEqual({ editIndex: 0, status: 'private_excluded' });
    input.includedClarificationIds = [source.id];
    const included = await buildCandidateEvidenceReport(input);
    expect(included.requirements[2]).toMatchObject({ status: 'candidate_associated', evidence: { kind: 'clarification', text: source.text } });
    expect(included.editProvenance[0].status).toBe('candidate_confirmed');
    expect(included.editProvenance[0]).not.toHaveProperty('sectionId');
    expect(included.editProvenance[0]).not.toHaveProperty('statement');
    card.confirmation.statement = 'changed';
    expect((await buildCandidateEvidenceReport(input)).editProvenance[0].status).toBe('needs_review');
  });

  it.each(['quote', 'target', 'original', 'proposal', 'sourceFingerprint', 'context', 'missingReference', 'duplicateReference'])('does not trust %s edit provenance', async change => {
    const input = await reportFixture();
    const card = input.cards[0];
    if (change === 'quote') card.evidence!.references[0].quote = 'Made up';
    if (change === 'target') card.evidence!.targetId = 'other-role';
    if (change === 'original') card.original = 'Changed';
    if (change === 'proposal') card.optimized = 'Private unsourced text';
    if (change === 'sourceFingerprint') card.evidence!.sourceFingerprints['resume-source'] = 'forged';
    if (change === 'context') card.assessmentKey = 'old';
    if (change === 'missingReference') card.evidence!.references = [];
    if (change === 'duplicateReference') card.evidence!.references.push(card.evidence!.references[0]);
    const report = await buildCandidateEvidenceReport(input);
    expect(report.editProvenance[0]).toEqual({ editIndex: 0, status: 'unverified' });
    expect(JSON.stringify(report)).not.toContain('Private unsourced text');
  });

  it.each([null, [null], [{ id: 'partial' }]])('treats malformed hydrated sources as unavailable', async sources => {
    const input = await reportFixture();
    input.sources = sources as unknown as EvidenceReportInput['sources'];
    const report = await buildCandidateEvidenceReport(input);
    expect(report.requirements[0].status).toBe('invalid_selection');
    expect(report.editProvenance[0]).toEqual({ editIndex: 0, status: 'unverified' });
  });

  it('captures inputs before asynchronous hashing and preserves bilingual bytes', async () => {
    const input = await reportFixture();
    input.resumeText = 'طورت واجهات API بنسبة ٢٠٪.';
    input.language = 'ar';
    input.run!.assessment!.context = await createAssessmentContext({ resumeText: input.resumeText, jobDescription: input.jobDescription, language: 'ar', kind: 'optimize', isOptimized: false, rubricVersion: 'optimize-v1' });
    const promise = buildCandidateEvidenceReport(input);
    input.resumeText = 'Changed during hashing';
    const report = await promise;
    expect(report.snapshots?.resumeText).toBe('طورت واجهات API بنسبة ٢٠٪.');
    expect(report.limitations[0]).toContain('المرشح');
  });
});
