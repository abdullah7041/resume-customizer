import { describe, expect, it } from 'vitest';
import type { AssessmentInput } from '@/types/assessment';
import {
  canAcceptAssessment,
  createAssessmentContext,
  fingerprintText,
  isCurrentAssessment,
} from '../assessmentContext';

const input = (resumeText: string): AssessmentInput => ({
  resumeText,
  jobDescription: 'Build APIs',
  language: 'en',
  kind: 'match',
  isOptimized: false,
  rubricVersion: 'match-v1',
});

describe('assessment context', () => {
  it('hashes the complete exact UTF-8 text with SHA-256', async () => {
    expect(await fingerprintText('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(await fingerprintText('واثق')).toBe(
      '1847ec17c384ff5f24af41dc8fca5b1149be865bf9825bcc03c3bff002a405d4',
    );
    expect(await fingerprintText('abc ')).not.toBe(await fingerprintText('abc'));
  });

  it('distinguishes same-length content with the same prefix', async () => {
    const prefix = 'x'.repeat(100);
    const a = await createAssessmentContext(input(prefix + 'A'));
    const b = await createAssessmentContext(input(prefix + 'B'));
    expect(a.resumeFingerprint).not.toBe(b.resumeFingerprint);
    expect(a.key).not.toBe(b.key);
  });

  it('changes identity when the complete job description changes', async () => {
    const a = await createAssessmentContext(input('Resume'));
    const b = await createAssessmentContext({ ...input('Resume'), jobDescription: 'Build APIz' });
    expect(a.jobFingerprint).not.toBe(b.jobFingerprint);
    expect(a.key).not.toBe(b.key);
  });

  it.each([
    ['language', { language: 'ar' as const }],
    ['rubric version', { rubricVersion: 'match-v2' }],
    ['kind', { kind: 'optimize' as const }],
    ['optimization state', { isOptimized: true }],
  ])('changes identity when %s changes', async (_label, change) => {
    const a = await createAssessmentContext(input('Resume'));
    const b = await createAssessmentContext({ ...input('Resume'), ...change });
    expect(b.key).not.toBe(a.key);
  });

  it('matches an identical context and rejects absent legacy context', async () => {
    const a = await createAssessmentContext(input('Resume'));
    const b = await createAssessmentContext(input('Resume'));
    expect(isCurrentAssessment(a, b)).toBe(true);
    expect(isCurrentAssessment(undefined, b)).toBe(false);
  });

  it('rejects an older request for identical inputs', async () => {
    const context = await createAssessmentContext(input('Resume'));
    expect(canAcceptAssessment('new', 'old', context, context)).toBe(false);
    expect(canAcceptAssessment(null, 'old', context, context)).toBe(false);
    expect(canAcceptAssessment('new', 'new', context, context)).toBe(true);
  });

  it('rejects a current request when the assessment context has changed', async () => {
    const saved = await createAssessmentContext(input('Resume A'));
    const active = await createAssessmentContext(input('Resume B'));
    expect(canAcceptAssessment('current', 'current', saved, active)).toBe(false);
  });
});
