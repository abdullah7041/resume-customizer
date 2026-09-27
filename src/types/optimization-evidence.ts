export interface EvidenceSource {
  id: string;
  kind: 'resume' | 'clarification';
  text: string;
  fingerprint: string;
  targetId: string;
  createdAt?: string;
}

export interface EvidenceReference {
  sourceId: string;
  quote: string;
}

export interface EditEvidence {
  version: 1;
  targetId: string;
  originalFingerprint: string;
  proposedFingerprint: string;
  references: EvidenceReference[];
  sourceFingerprints: Record<string, string>;
  status: 'source_matched' | 'needs_review' | 'rejected' | 'legacy';
  reasons: Array<'missing_source' | 'wrong_target' | 'new_number' | 'semantic_review' | 'legacy'>;
}

export interface EvidenceCandidate {
  targetId: string;
  original: string;
  proposed: string;
  references: EvidenceReference[];
}

export interface StructuredEvidenceResume {
  basics?: Record<string, unknown>;
  work?: Array<Record<string, unknown>>;
  projects?: Array<Record<string, unknown>>;
}

export interface CandidateClarificationSource {
  id: string;
  targetId: string;
  text: string;
  createdAt: string;
}
