import type { EditEvidence } from '@/types/optimization-evidence';
import type { CandidateConfirmation } from '@/types/templates';

export const proposalStatement = (value: string | string[]): string =>
  typeof value === 'string' ? value : JSON.stringify(value);

export function isConfirmationCurrent(
  evidence: EditEvidence | undefined,
  confirmation: CandidateConfirmation | undefined,
  statement?: string,
): boolean {
  return !!evidence && !!confirmation
    && confirmation.targetId === evidence.targetId
    && confirmation.proposedFingerprint === evidence.proposedFingerprint
    && (statement === undefined || confirmation.statement === statement);
}
