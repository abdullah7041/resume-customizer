import { describe, expect, it } from 'vitest';
import { createExportSnapshot, reviewExport } from '../exportPreflight';
import { fingerprintText } from '@/lib/match/assessmentContext';
import type { OptimizationResult } from '@/types/templates';
import type { ResumeSchema } from '@/types/resume';

const resume = (): ResumeSchema => ({
  basics: { name: 'Sara', label: '', email: '', phone: '', summary: 'Original summary',
    location: { city: '', countryCode: '', region: '' }, profiles: [] },
  work: [],
  education: [],
  skills: [],
});
const card = (over: Partial<OptimizationResult> = {}): OptimizationResult => ({
  sectionId: 'summary-1', sectionType: 'summary', original: 'Original summary',
  optimized: 'Led a team', applied: true,
  evidence: { version: 1, targetId: 'basics:summary', originalFingerprint: 'old',
    proposedFingerprint: 'new', references: [], sourceFingerprints: {},
    status: 'needs_review', reasons: ['semantic_review'] },
  ...over,
});

describe('export review', () => {
  it('allows an untouched original and supported merged edits', () => {
    expect(reviewExport({ documentFingerprint: 'd', includedEdits: [], missingBaseline: false }))
      .toEqual({ allowed: true, documentFingerprint: 'd' });
    expect(reviewExport({ documentFingerprint: 'd', includedEdits: [card({
      evidence: { ...card().evidence!, status: 'source_matched', reasons: [] },
    })], missingBaseline: false })).toEqual({ allowed: true, documentFingerprint: 'd' });
  });

  it('blocks an unresolved included claim and accepts only its current exact confirmation', () => {
    const unresolved = card();
    expect(reviewExport({ documentFingerprint: 'd', includedEdits: [unresolved], missingBaseline: false }))
      .toEqual({ allowed: false, documentFingerprint: 'd', sectionIds: ['summary-1'], reason: 'review_required' });
    const confirmed = card({ confirmation: { targetId: 'basics:summary', proposedFingerprint: 'new',
      statement: 'Led a team', confirmedAt: '2026-09-24' } });
    expect(reviewExport({ documentFingerprint: 'd', includedEdits: [confirmed], missingBaseline: false }).allowed).toBe(true);
    expect(reviewExport({ documentFingerprint: 'd', includedEdits: [card({
      ...confirmed, optimized: 'Led two teams',
    })], missingBaseline: false }).allowed).toBe(false);
  });

  it('compares array claims with their exact serialized statement', () => {
    const edit = card({ optimized: ['a,b', 'c'], confirmation: { targetId: 'basics:summary',
      proposedFingerprint: 'new', statement: '["a","b,c"]', confirmedAt: '2026-09-24' } });
    expect(reviewExport({ documentFingerprint: 'd', includedEdits: [edit], missingBaseline: false }).allowed).toBe(false);
  });

  it('requires document-level review for a missing baseline and binds it to the current fingerprint', () => {
    const input = { documentFingerprint: 'current', includedEdits: [], missingBaseline: true };
    expect(reviewExport(input)).toEqual({ allowed: false, documentFingerprint: 'current', sectionIds: [], reason: 'legacy_review' });
    const confirmation = { documentFingerprint: 'current', confirmedAt: '2026-09-24' };
    expect(reviewExport({ ...input, legacyDocumentConfirmation: confirmation }).allowed).toBe(true);
    expect(reviewExport({ ...input, documentFingerprint: 'changed', legacyDocumentConfirmation: confirmation }).allowed).toBe(false);
  });
});

describe('export snapshot', () => {
  it('fingerprints the exact composed document and retains its content during later edits', async () => {
    const original = resume();
    const edit = card();
    const pending = createExportSnapshot(original, [edit], { isSaudiNational: false });
    original.basics!.summary = 'Changed while export was pending';
    edit.optimized = 'Changed card';
    const snapshot = await pending;
    expect(snapshot.resume.basics!.summary).toBe('Led a team');
    expect(snapshot.includedEdits[0].optimized).toBe('Led a team');
    expect(snapshot.documentFingerprint).toBe(await fingerprintText(JSON.stringify(snapshot.resume)));
    expect(snapshot.documentFingerprint).not.toBe(await fingerprintText(JSON.stringify(original)));
  });

  it('ignores failed, unapplied, and recommendation cards in the reviewed snapshot', async () => {
    const snapshot = await createExportSnapshot(resume(), [
      card({ sectionId: 'failed', sectionType: 'experience', original: 'absent' }),
      card({ sectionId: 'unapplied', applied: false }),
      card({ sectionId: 'recommendation', sectionType: 'skills' }),
    ], { isSaudiNational: false });
    expect(snapshot.includedEdits).toEqual([]);
    expect(reviewExport({ documentFingerprint: snapshot.documentFingerprint,
      includedEdits: snapshot.includedEdits, missingBaseline: false }).allowed).toBe(true);
  });
});
