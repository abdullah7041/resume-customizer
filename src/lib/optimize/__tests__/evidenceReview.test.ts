import { describe, expect, it } from 'vitest';
import { isConfirmationCurrent, proposalStatement } from '../evidenceReview';
import type { EditEvidence } from '@/types/optimization-evidence';

const evidence: EditEvidence = {
  version: 1, targetId: 'work:role-a', originalFingerprint: 'original', proposedFingerprint: 'proposal',
  references: [], sourceFingerprints: {}, status: 'needs_review', reasons: ['semantic_review'],
};
const confirmation = { targetId: 'work:role-a', proposedFingerprint: 'proposal',
  confirmedAt: '2026-09-24T12:00:00Z', statement: 'Led delivery' };

describe('candidate review identity', () => {
  it('binds approval to the exact claim and target, not an identical bullet in another role', () => {
    expect(isConfirmationCurrent(evidence, confirmation, 'Led delivery')).toBe(true);
    expect(isConfirmationCurrent({ ...evidence, targetId: 'work:role-b' }, confirmation, 'Led delivery')).toBe(false);
    expect(isConfirmationCurrent(evidence, confirmation, 'Led delivery.')).toBe(false);
    expect(isConfirmationCurrent({ ...evidence, proposedFingerprint: 'refined' }, confirmation, 'Led delivery')).toBe(false);
  });

  it('serializes array claims without delimiter collisions', () => {
    expect(proposalStatement(['a,b', 'c'])).not.toBe(proposalStatement(['a', 'b,c']));
  });
});
