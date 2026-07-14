import { createHmac } from 'crypto';

export const RISK_TIERS = ['low', 'medium', 'high', 'critical'];
export const REALITY_CHECK_RECOMMENDATIONS = [
  'optimize_now',
  'answer_clarifications_first',
  'add_evidence_first',
  'review_role_fit',
];
export const REALITY_CHECK_CONFIDENCE = ['low', 'medium', 'high'];
export const REALITY_CHECK_RISK_TYPES = [
  'missing_required_skill',
  'experience_gap',
  'seniority_mismatch',
  'domain_gap',
  'education_certification_gap',
  'location_work_authorization_unclear',
  'career_pattern_risk',
  'evidence_quality',
  'role_scope_mismatch',
  'language_localization_gap',
  'other',
];

const ARRAY_LIMITS = {
  riskTypes: 6,
  confirmedRisks: 4,
  unclearRisks: 4,
  strengths: 3,
  evidence: 2,
  limits: 4,
};

const MAX_TEXT = {
  summary: 420,
  title: 120,
  explanation: 280,
  mitigation: 280,
  evidence: 180,
  reason: 240,
};

const BANNED_CLAIM_PATTERN = /\b(?:will\s+(?:be\s+)?(?:reject(?:ed)?|screen(?:ed)?\s*out|fail|get\s+an\s+interview|not\s+get\s+an\s+interview)|guarantee(?:d|s)?|certain(?:ly)?\s+(?:reject|screen|fail|hire)|hire\s+probability|interview\s+probability|ats\s+pass\s+probability|pass\/fail\s+ats|fatal\s+flaw|disqualified)\b/i;

export function containsBannedRealityCheckClaim(value) {
  if (typeof value !== 'string') return false;
  return BANNED_CLAIM_PATTERN.test(value);
}

function clampText(value, maxLength) {
  if (typeof value !== 'string') return '';
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3).trim()}...` : normalized;
}

function sanitizeText(value, maxLength) {
  const text = clampText(value, maxLength);
  if (!text) return '';
  if (containsBannedRealityCheckClaim(text)) {
    return 'Watheq can identify evidence gaps, but employer decisions cannot be predicted.';
  }
  return text;
}

function clampEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function clampArray(value, limit) {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

function normalizeArabic(value) {
  return value
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

export function normalizeEvidenceText(value) {
  if (typeof value !== 'string') return '';
  return normalizeArabic(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenOverlap(snippet, source) {
  const snippetTokens = new Set(snippet.split(' ').filter(token => token.length >= 2));
  if (snippetTokens.size === 0) return 0;
  const sourceTokens = new Set(source.split(' ').filter(token => token.length >= 2));
  let matches = 0;
  for (const token of snippetTokens) {
    if (sourceTokens.has(token)) matches++;
  }
  return matches / snippetTokens.size;
}

export function verifyEvidenceSnippet(snippet, source, resumeText, jobText) {
  const normalizedSnippet = normalizeEvidenceText(snippet);
  if (normalizedSnippet.length < 8) return false;

  const normalizedResume = normalizeEvidenceText(resumeText);
  const normalizedJob = normalizeEvidenceText(jobText);
  const candidates = source === 'resume'
    ? [normalizedResume]
    : source === 'job_description'
      ? [normalizedJob]
      : [normalizedResume, normalizedJob];

  return candidates.some(candidate => {
    if (!candidate) return false;
    if (candidate.includes(normalizedSnippet)) return true;
    return tokenOverlap(normalizedSnippet, candidate) >= 0.75;
  });
}

function sanitizeEvidence(evidence, resumeText, jobText) {
  return clampArray(evidence, ARRAY_LIMITS.evidence)
    .flatMap(item => {
      const source = ['resume', 'job_description', 'both'].includes(item?.source)
        ? item.source
        : 'both';
      const snippet = sanitizeText(item?.snippet, MAX_TEXT.evidence);
      if (!snippet || !verifyEvidenceSnippet(snippet, source, resumeText, jobText)) {
        return [];
      }
      return [{ source, snippet }];
    });
}

function sanitizeRiskType(value) {
  return clampEnum(value, REALITY_CHECK_RISK_TYPES, 'other');
}

function downgradeRiskToUnclear(risk, reason) {
  return {
    type: sanitizeRiskType(risk?.type),
    topic: sanitizeText(risk?.title || risk?.requirement || 'Evidence needs review', MAX_TEXT.title),
    reason: sanitizeText(reason || 'Visible evidence was not strong enough to confirm this risk.', MAX_TEXT.reason),
    evidenceNeeded: sanitizeText(risk?.mitigation || 'Add verifiable resume evidence before treating this as confirmed.', MAX_TEXT.mitigation),
  };
}

function sanitizeConfirmedRisks(risks, resumeText, jobText) {
  const confirmedRisks = [];
  const downgraded = [];

  for (const risk of clampArray(risks, ARRAY_LIMITS.confirmedRisks)) {
    const evidence = sanitizeEvidence(risk?.evidence, resumeText, jobText);
    if (evidence.length === 0) {
      downgraded.push(downgradeRiskToUnclear(risk));
      continue;
    }

    confirmedRisks.push({
      type: sanitizeRiskType(risk?.type),
      severity: clampEnum(risk?.severity, ['medium', 'high', 'critical'], 'medium'),
      title: sanitizeText(risk?.title || risk?.requirement, MAX_TEXT.title),
      explanation: sanitizeText(risk?.explanation || risk?.whyItMatters, MAX_TEXT.explanation),
      mitigation: sanitizeText(risk?.mitigation, MAX_TEXT.mitigation),
      evidence,
    });
  }

  return { confirmedRisks, downgraded };
}

function sanitizeUnclearRisks(risks) {
  return clampArray(risks, ARRAY_LIMITS.unclearRisks).flatMap(risk => {
    const sanitized = {
      type: sanitizeRiskType(risk?.type),
      topic: sanitizeText(risk?.topic || risk?.title, MAX_TEXT.title),
      reason: sanitizeText(risk?.reason || risk?.whyUnclear, MAX_TEXT.reason),
      evidenceNeeded: sanitizeText(risk?.evidenceNeeded || risk?.suggestedQuestion, MAX_TEXT.mitigation),
    };
    return (sanitized.topic || sanitized.reason || sanitized.evidenceNeeded) ? [sanitized] : [];
  });
}

function sanitizeStrengths(strengths, resumeText, jobText) {
  return clampArray(strengths, ARRAY_LIMITS.strengths)
    .flatMap(strength => {
      const evidence = sanitizeEvidence(strength?.evidence, resumeText, jobText);
      if (evidence.length === 0) return [];
      return [{
        title: sanitizeText(strength?.title, MAX_TEXT.title),
        whyItMatters: sanitizeText(strength?.whyItMatters, MAX_TEXT.explanation),
        evidence,
      }];
    });
}

export function buildFallbackStrategicRealityCheck(reason = 'Reality Check could not be confirmed from visible evidence.') {
  return {
    riskTier: 'medium',
    recommendation: 'answer_clarifications_first',
    confidence: 'low',
    riskTypes: ['evidence_quality'],
    summary: 'Watheq could not confirm a recruiter-facing risk assessment from visible evidence, so review the match gaps before optimizing.',
    strengths: [],
    confirmedRisks: [],
    unclearRisks: [{
      type: 'evidence_quality',
      topic: 'Reality Check needs clearer evidence',
      reason,
      evidenceNeeded: 'Review missing keywords, job requirements, and any clarification questions before optimizing.',
    }],
    limits: {
      cannotDetermine: ['Employer decisions and interview outcomes'],
      assumptions: [],
    },
  };
}

export function postProcessStrategicRealityCheck(raw, { resumeText = '', jobText = '' } = {}) {
  if (!raw || typeof raw !== 'object') {
    return buildFallbackStrategicRealityCheck();
  }

  try {
    const { confirmedRisks, downgraded } = sanitizeConfirmedRisks(raw.confirmedRisks, resumeText, jobText);
    const unclearRisks = [
      ...sanitizeUnclearRisks(raw.unclearRisks),
      ...downgraded,
    ].slice(0, ARRAY_LIMITS.unclearRisks);
    const riskTypes = clampArray(raw.riskTypes, ARRAY_LIMITS.riskTypes).reduce((acc, item) => {
      const mapped = sanitizeRiskType(item);
      if (!acc.includes(mapped)) acc.push(mapped);
      return acc;
    }, []);

    return {
      riskTier: clampEnum(raw.riskTier, RISK_TIERS, 'medium'),
      recommendation: clampEnum(raw.recommendation, REALITY_CHECK_RECOMMENDATIONS, 'answer_clarifications_first'),
      confidence: clampEnum(raw.confidence, REALITY_CHECK_CONFIDENCE, 'low'),
      riskTypes: riskTypes.length > 0 ? riskTypes : ['evidence_quality'],
      summary: sanitizeText(raw.summary, MAX_TEXT.summary) || buildFallbackStrategicRealityCheck().summary,
      strengths: sanitizeStrengths(raw.strengths, resumeText, jobText),
      confirmedRisks,
      unclearRisks,
      limits: {
        cannotDetermine: clampArray(raw.limits?.cannotDetermine, ARRAY_LIMITS.limits)
          .flatMap(item => {
            const text = sanitizeText(item, MAX_TEXT.reason);
            return text ? [text] : [];
          }),
        assumptions: clampArray(raw.limits?.assumptions, ARRAY_LIMITS.limits)
          .flatMap(item => {
            const text = sanitizeText(item, MAX_TEXT.reason);
            return text ? [text] : [];
          }),
      },
    };
  } catch {
    return buildFallbackStrategicRealityCheck();
  }
}

function canonicalizeForHash(value) {
  return normalizeEvidenceText(value);
}

export function hashRealityCheckInput(value, namespace, secret = process.env.STRATEGIC_REALITY_CHECK_HASH_SECRET) {
  if (!secret) return null;
  return createHmac('sha256', secret)
    .update(`${namespace}:v1:${canonicalizeForHash(value)}`)
    .digest('hex');
}

export function buildStrategicRealityCheckSummary({
  userId,
  matchScore,
  language,
  resumeText,
  jobText,
  strategicRealityCheck,
}) {
  if (!strategicRealityCheck || typeof strategicRealityCheck !== 'object') {
    return null;
  }

  const resumeHash = hashRealityCheckInput(resumeText, 'resume');
  const jobHash = hashRealityCheckInput(jobText, 'job');

  if (!resumeHash || !jobHash) {
    return null;
  }

  return {
    user_id: userId,
    match_score: Number.isFinite(matchScore) ? Math.round(matchScore) : null,
    language: language === 'ar' ? 'ar' : 'en',
    risk_tier: strategicRealityCheck.riskTier,
    recommendation: strategicRealityCheck.recommendation,
    confidence: strategicRealityCheck.confidence,
    risk_types: strategicRealityCheck.riskTypes,
    resume_hash: resumeHash,
    job_hash: jobHash,
    summary_metadata: {
      confirmed_risk_count: strategicRealityCheck.confirmedRisks.length,
      unclear_risk_count: strategicRealityCheck.unclearRisks.length,
      strength_count: strategicRealityCheck.strengths.length,
      has_limits: strategicRealityCheck.limits.cannotDetermine.length > 0,
    },
  };
}
