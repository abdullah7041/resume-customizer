import type {
  ResumeTruthCheckResult,
  TruthCheckClaim,
  TruthCheckEvidenceStatus,
} from '@/types/truth-check';

export type TruthCheckGroupKey =
  | 'experience'
  | 'projects'
  | 'skills'
  | 'certificates'
  | 'dates'
  | 'other';

export interface TruthCheckSummaryCounts {
  claimsToReview: number;
  needsEvidence: number;
  needsVerification: number;
  sectionsScanned: number;
}

export interface TruthCheckGroup {
  key: TruthCheckGroupKey;
  claims: TruthCheckClaim[];
}

export interface TruthCheckView {
  counts: TruthCheckSummaryCounts;
  priorities: TruthCheckClaim[];
  groups: TruthCheckGroup[];
  isEmpty: boolean;
}

const GROUP_ORDER: TruthCheckGroupKey[] = [
  'experience',
  'projects',
  'skills',
  'certificates',
  'dates',
  'other',
];

const SEVERITY_RANK: Record<TruthCheckClaim['severity'], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const EVIDENCE_WEIGHT: Record<TruthCheckEvidenceStatus, number> = {
  contradicted: 3,
  needs_evidence: 2,
  unclear: 1,
  supported: 0,
};

const SECTION_KEYWORDS: Array<{ key: TruthCheckGroupKey; pattern: RegExp }> = [
  { key: 'experience', pattern: /(experience|work|exper|عمل|خبر)/i },
  { key: 'projects', pattern: /(project|مشروع)/i },
  { key: 'skills', pattern: /(skill|مهار)/i },
  { key: 'certificates', pattern: /(cert|licen|شهاد)/i },
];

const DATE_PATTERN = /(date|timeline|year|month|duration|period|تاريخ|سنة|شهر|مدة|تسلسل)/i;

/**
 * Map of evidenceStatus -> i18n key suffix under sections.truthCheck.evidenceStatus.
 */
export function evidenceStatusLabelKey(status: TruthCheckEvidenceStatus): string {
  switch (status) {
    case 'needs_evidence':
      return 'needs_evidence';
    case 'unclear':
      return 'unclear';
    case 'contradicted':
      return 'contradicted';
    case 'supported':
    default:
      return 'supported';
  }
}

function isReviewable(claim: TruthCheckClaim): boolean {
  return claim.evidenceStatus !== 'supported';
}

function needsVerification(claim: TruthCheckClaim): boolean {
  return (
    claim.evidenceStatus === 'contradicted' ||
    claim.riskTypes.includes('unverifiable') ||
    claim.riskTypes.includes('inconsistent')
  );
}

function resolveGroupKey(claim: TruthCheckClaim): TruthCheckGroupKey {
  // Date/timeline-related or inconsistent/unverifiable claims always go to 'dates',
  // even if their section looks like 'experience'.
  if (
    DATE_PATTERN.test(claim.section) ||
    DATE_PATTERN.test(claim.claimText) ||
    claim.riskTypes.includes('inconsistent') ||
    claim.riskTypes.includes('unverifiable')
  ) {
    return 'dates';
  }

  for (const { key, pattern } of SECTION_KEYWORDS) {
    if (pattern.test(claim.section)) {
      return key;
    }
  }

  return 'other';
}

function priorityComparator(a: TruthCheckClaim, b: TruthCheckClaim): number {
  const severityDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
  if (severityDiff !== 0) return severityDiff;

  const evidenceDiff = EVIDENCE_WEIGHT[b.evidenceStatus] - EVIDENCE_WEIGHT[a.evidenceStatus];
  if (evidenceDiff !== 0) return evidenceDiff;

  return 0;
}

/**
 * Pure mapper that derives the summary-first / top-priorities / grouped-details
 * view model from a Resume Truth Check result. All numbers are derived from
 * `claims` — never invented.
 */
export function buildTruthCheckView(result: ResumeTruthCheckResult): TruthCheckView {
  const claims = result.claims ?? [];
  const reviewableClaims = claims.filter(isReviewable);

  const sectionsScanned = new Set(claims.map((claim) => claim.section)).size;

  const counts: TruthCheckSummaryCounts = {
    claimsToReview: reviewableClaims.length,
    needsEvidence: reviewableClaims.filter((claim) => claim.evidenceStatus === 'needs_evidence').length,
    needsVerification: reviewableClaims.filter(needsVerification).length,
    sectionsScanned,
  };

  const priorities = [...reviewableClaims].sort(priorityComparator).slice(0, 3);

  const groupMap = new Map<TruthCheckGroupKey, TruthCheckClaim[]>();
  for (const claim of reviewableClaims) {
    const key = resolveGroupKey(claim);
    const existing = groupMap.get(key);
    if (existing) {
      existing.push(claim);
    } else {
      groupMap.set(key, [claim]);
    }
  }

  const groups: TruthCheckGroup[] = GROUP_ORDER.filter((key) => groupMap.has(key)).map((key) => ({
    key,
    claims: groupMap.get(key) ?? [],
  }));

  return {
    counts,
    priorities,
    groups,
    isEmpty: reviewableClaims.length === 0,
  };
}
