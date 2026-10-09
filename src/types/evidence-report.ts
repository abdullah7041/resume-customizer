import type { AssessmentContext } from '@/types/assessment';
import type { EvidenceSource, EvidenceInputOmissions } from '@/types/optimization-evidence';
import type { OptimizeRunRecord, OptimizationResult } from '@/types/templates';

export interface RequirementSelection {
  requirement: string;
  evidence?: { sourceId: string; quote: string; targetId: string; fingerprint: string };
}

export interface EvidenceReportInput {
  resumeText: string;
  jobDescription: string;
  language: 'en' | 'ar';
  assessmentCurrent: boolean;
  run: OptimizeRunRecord | null;
  sources: EvidenceSource[];
  cards: OptimizationResult[];
  requirements: RequirementSelection[];
  includedClarificationIds: string[];
  omissions?: EvidenceInputOmissions;
}

export interface CandidateEvidenceReport {
  version: 1;
  language: 'en' | 'ar';
  status: 'current' | 'outdated' | 'legacy';
  assessment: { context: AssessmentContext; requestId: string; createdAt: string } | null;
  snapshots: { resumeText: string; jobDescription: string } | null;
  requirements: Array<{ requirement: string; status: 'candidate_associated' | 'gap' | 'invalid_selection'; evidence?: EvidenceSource & { quote: string } }>;
  editProvenance: Array<{ editIndex: number; status: 'source_matched' | 'candidate_confirmed' | 'needs_review' | 'unverified' | 'private_excluded'; proposedFingerprint?: string; references?: Array<EvidenceSource & { quote: string }>; confirmedAt?: string }>;
  omissions: EvidenceInputOmissions | null;
  limitations: string[];
}
