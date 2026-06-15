export type TruthCheckRiskType =
  | 'unsupported'
  | 'inflated'
  | 'vague'
  | 'unverifiable'
  | 'inconsistent';

export type TruthCheckSeverity = 'low' | 'medium' | 'high';

export type TruthCheckEvidenceStatus =
  | 'supported'
  | 'needs_evidence'
  | 'unclear'
  | 'contradicted';

export interface TruthCheckClaim {
  claimText: string;
  section: string;
  severity: TruthCheckSeverity;
  riskTypes: TruthCheckRiskType[];
  evidenceStatus: TruthCheckEvidenceStatus;
  visibleEvidence: string[];
  whyItMatters: string;
  userAction: string;
}

export interface ResumeTruthCheckResult {
  overallRisk: TruthCheckSeverity;
  summary: string;
  claims: TruthCheckClaim[];
  limits: {
    cannotVerify: string[];
  };
  debug?: {
    requestId?: string | null;
    model?: string | null;
    latencyMs?: number | null;
    tokens?: number | null;
    maxOutputTokens?: number | null;
  };
}
