import type { EditEvidence } from '@/types/optimization-evidence';
import type { CandidateConfirmation } from '@/types/templates';

export { proposalStatement } from '@/types/optimization-evidence';

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
