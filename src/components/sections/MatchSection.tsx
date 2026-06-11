import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassCircle } from '../ui/GlassCircle';
import { GlassTextarea } from '../ui/GlassTextarea';
import {
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Info,
  Zap,
  Wrench,
  ChevronDown,

  Code2,
  Briefcase,
  GraduationCap,
  Users,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import { analytics } from '../../services/analytics';
import Tooltip from '../ui/Tooltip';
import { AnimatedCounter } from '../ui/AnimatedCounter';
import { GapAnalysisCard, GapItem } from '../GapAnalysisCard';
import { HiddenMatchesCard, HiddenMatch } from '../HiddenMatchesCard';
import { MirroredKeywordsCard } from '../MirroredKeywordsCard';
import { ConfirmActionModal } from '../Credits/ConfirmActionModal';
import { useUserCredits } from '../../hooks/useUserCredits';
import { useResumeStore } from '../../lib/stores/resumeStore';
import { getCompatibleStorageItem, removeCompatibleStorageItem, setCompatibleStorageItem } from '../../lib/utils/storage-migration';
import { SaveJobToPipelineCard } from './SaveJobToPipelineCard';
import type { ExtractedJobMetadata } from '../../types/pipeline';

// === EXTRACTED FROM features/JobMatch.tsx ===
// Semantic score states with calm, low-glow surfaces (Warm Saudi Premium):
// strong → emerald, medium → amber, weak → rose.
const resolveVariant = (score: number) => {
  if (score >= 70) {
    return {
      gradient: "from-emerald-500/10 via-emerald-500/[0.04] to-transparent",
      glow: "bg-emerald-500/15",
      strokeStart: "#10B981",
      strokeEnd: "#34D399",
      label: "strongMatch",
      icon: Target,
      text: "text-emerald-700 dark:text-emerald-300"
    };
  }
  if (score >= 40) {
    return {
      gradient: "from-amber-500/10 via-amber-500/[0.04] to-transparent",
      glow: "bg-amber-500/12",
      strokeStart: "#F59E0B",
      strokeEnd: "#FBBF24",
      label: "goodStart",
      icon: Zap,
      text: "text-amber-700 dark:text-amber-300"
    };
  }
  return {
    gradient: "from-rose-500/10 via-rose-500/[0.04] to-transparent",
    glow: "bg-rose-500/12",
    strokeStart: "#F43F5E",
    strokeEnd: "#FB7185",
    label: "needsWork",
    icon: Wrench,
    text: "text-rose-700 dark:text-rose-300"
  };
};

const LAST_JOB_KEY = "watheq:lastJobDescription";
const RING_RADIUS = 60;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface StrategicRealityCheck {
  riskTier: 'low' | 'medium' | 'high' | 'critical';
  recommendation: 'optimize_now' | 'answer_clarifications_first' | 'add_evidence_first' | 'review_role_fit';
  confidence: 'low' | 'medium' | 'high';
  riskTypes: string[];
  summary: string;
  strengths: Array<{
    title: string;
    whyItMatters?: string;
    evidence?: Array<{ source: 'resume' | 'job_description' | 'both'; snippet: string }>;
  }>;
  confirmedRisks: Array<{
    type: string;
    severity: 'medium' | 'high' | 'critical';
    title: string;
    explanation: string;
    mitigation: string;
    evidence?: Array<{ source: 'resume' | 'job_description' | 'both'; snippet: string }>;
  }>;
  unclearRisks: Array<{
    type: string;
    topic: string;
    reason: string;
    evidenceNeeded: string;
  }>;
  limits: {
    cannotDetermine: string[];
    assumptions: string[];
  };
}

const getRealityCheckVariant = (riskTier: StrategicRealityCheck['riskTier']) => {
  if (riskTier === 'low') {
    return {
      icon: ShieldCheck,
      container: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
      badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/20',
      role: 'status' as const,
    };
  }
  if (riskTier === 'medium') {
    return {
      icon: Info,
      container: 'border-amber-500/25 bg-amber-500/10 text-amber-950 dark:text-amber-100',
      badge: 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/25',
      role: 'status' as const,
    };
  }
  if (riskTier === 'high') {
    return {
      icon: ShieldAlert,
      container: 'border-rose-500/25 bg-rose-500/10 text-rose-950 dark:text-rose-100',
      badge: 'bg-rose-500/15 text-rose-800 dark:text-rose-200 border-rose-500/25',
      role: 'alert' as const,
    };
  }
  return {
    icon: AlertCircle,
    container: 'border-red-600/30 bg-red-600/10 text-red-950 dark:text-red-100',
    badge: 'bg-red-600/15 text-red-800 dark:text-red-200 border-red-600/30',
    role: 'alert' as const,
  };
};

interface MatchResult {
  score: number;
  matchedKeywords?: string[];
  missingKeywords?: string[];
  topHits?: string[];
  suggestions?: string[];
  reasoning?: string;
  categoryScores?: {
    hard_skills: { score: number; max: number; matched?: string[]; missing?: string[]; reasoning?: string };
    experience: { score: number; max: number; matched?: string[]; gaps?: string[]; reasoning?: string };
    education: { score: number; max: number; matched?: string[]; missing?: string[]; reasoning?: string };
    soft_skills: { score: number; max: number; matched?: string[]; missing?: string[]; reasoning?: string };
  } | null;
  gapAnalysis?: GapItem[];
  keywordStrategy?: {
    mirroredPhrases?: string[];
    structuralChanges?: string[];
    hiddenMatches?: HiddenMatch[];
  } | null;
  strategicRealityCheck?: StrategicRealityCheck | null;
}

interface Toast {
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description?: string;
}

interface MatchSectionProps {
  onAnalyzeMatchAI: (jobDescription: string) => Promise<MatchResult>;
  matchAnalysis: MatchResult | null;
  isAnalyzing?: boolean;
  hasResume?: boolean;
  resumeText?: string;
  onToast?: (toast: Toast) => void;
  onClear?: () => void;
  jobDescription?: string;
  extractedMetadata?: ExtractedJobMetadata | null;
  onJobSaved?: (id: string) => void;
  isGuestMode?: boolean;
  onRequireSignIn?: () => void;
  protectedActionMessage?: string;
}

export function MatchSection({
  onAnalyzeMatchAI,
  matchAnalysis,
  isAnalyzing = false,
  hasResume = false,
  resumeText = '',
  onToast,
  onClear,
  jobDescription = '',
  extractedMetadata,
  onJobSaved,
  isGuestMode = false,
  onRequireSignIn,
  protectedActionMessage,
}: MatchSectionProps) {
  const { t } = useTranslation();
  const { showOptimized } = useResumeStore();

  // === STATE FROM features/JobMatch.tsx ===
  const [jobText, setJobText] = useState(() => {
    if (typeof window === "undefined") return "";
    return getCompatibleStorageItem(LAST_JOB_KEY) ?? "";
  });
  const [error, setError] = useState("");
  const [whyOpen, setWhyOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const { credits: _credits, isLoading: creditsLoading, refetch: refetchCredits } = useUserCredits();

  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Persist job description to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (jobText && jobText.trim().length > 0) {
      setCompatibleStorageItem(LAST_JOB_KEY, jobText);
    } else {
      removeCompatibleStorageItem(LAST_JOB_KEY);
    }
  }, [jobText]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!whyOpen) return undefined;
    const handleClick = (event: MouseEvent) => {
      if (
        !popoverRef.current?.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setWhyOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [whyOpen]);

  const handleAnalyzeActual = async () => {
    const trimmedJob = jobText.trim();
    if (!trimmedJob) {
      const message = t('sections.match.errors.noJob', 'Paste the job description before analyzing.');
      setError(message);
      onToast?.({
        type: "warning",
        title: t('sections.match.errors.jobNeeded', 'Job description needed'),
        description: message,
      });
      return;
    }
    setError("");
    analytics.trackJobDescriptionSubmitted();
    analytics.trackMatchAnalysisStarted();
    try {
      const result = await onAnalyzeMatchAI(trimmedJob);
      // Track match analysis run
      if (result && typeof result.score === 'number') {
        analytics.trackMatchAnalysisSuccess(result.score);
      }
      if (result?.strategicRealityCheck) {
        analytics.trackStrategicRealityCheck({
          riskTier: result.strategicRealityCheck.riskTier,
          recommendation: result.strategicRealityCheck.recommendation,
          confidence: result.strategicRealityCheck.confidence,
          riskTypes: result.strategicRealityCheck.riskTypes,
        });
      }
      // Refresh credits after consumption
      setTimeout(() => refetchCredits(), 500);
    } catch (err) {
      const msg = (err as Error)?.message || t('sections.match.errors.analyzeFailed', 'We could not analyze this match.');
      setError(msg);

      let errorCategory = 'unknown';
      if (msg.includes('high load') || msg.includes('timed out') || msg.includes('wait 30 seconds')) errorCategory = 'timeout';
      else if (msg.includes('rate limit')) errorCategory = 'rate_limit';
      else if (msg.includes('network')) errorCategory = 'network';
      else if (msg.includes('validation')) errorCategory = 'validation';
      analytics.trackMatchAnalysisFailed(errorCategory);

      // Show info toast for degraded-service errors
      if (msg.includes('high load') || msg.includes('timed out') || msg.includes('wait 30 seconds')) {
        onToast?.({
          type: 'info',
          title: t('sections.match.errors.serviceOverloaded', 'AI service is busy'),
          description: t('sections.match.errors.serviceOverloadedDesc', 'The AI service is experiencing high demand. Please wait a moment and try again.'),
        });
      }
    }
  };

  // Wrapper function that shows confirmation modal first
  const handleAnalyze = () => {
    const trimmedJob = jobText.trim();
    if (!trimmedJob) {
      const message = t('sections.match.errors.noJob', 'Paste the job description before analyzing.');
      setError(message);
      onToast?.({
        type: "warning",
        title: t('sections.match.errors.jobNeeded', 'Job description needed'),
        description: message,
      });
      return;
    }

    if (isGuestMode) {
      const message = protectedActionMessage || t(
        'workspace.guest.protectedActionDesc',
        'Sign in to run AI analysis and save your progress.'
      );
      setError(message);
      onRequireSignIn?.();
      return;
    }

    // Wait for credits to load before showing modal
    if (creditsLoading) {
      return;
    }

    setShowConfirmModal(true);
  };

  // Handler for confirmed match analysis action
  const handleConfirmMatch = async () => {
    setShowConfirmModal(false);
    try {
      await handleAnalyzeActual();
    } catch (err) {
      console.error('[MatchSection] handleConfirmMatch rejected:', err);
      setError((err as Error)?.message || t('sections.match.errors.analyzeFailed', 'We could not analyze this match.'));
    }
  };

  // Computed values
  const hasResults = Boolean(matchAnalysis);
  const rawScore = Number.isFinite(matchAnalysis?.score) ? matchAnalysis!.score : null;
  const score = rawScore != null ? Math.max(0, Math.min(100, Math.round(rawScore))) : null;
  const variant = resolveVariant(score ?? 0);
  const progress = score == null ? 0 : Math.max(0, Math.min(100, score));
  const ringOffset = useMemo(
    () => RING_CIRCUMFERENCE - (progress / 100) * RING_CIRCUMFERENCE,
    [progress]
  );
  const missing = matchAnalysis?.missingKeywords?.slice(0, 3) ?? [];
  const hits = matchAnalysis?.topHits?.slice(0, 3) ?? [];
  const realityCheck = matchAnalysis?.strategicRealityCheck ?? null;
  const realityVariant = realityCheck ? getRealityCheckVariant(realityCheck.riskTier) : null;
  const RealityIcon = realityVariant?.icon;
  const nextActionKey = realityCheck
    ? `reality.${realityCheck.recommendation}`
    : score !== null && score >= 70
      ? 'optimize'
      : score !== null && score >= 40
        ? 'closeGaps'
        : 'reviewFit';
  const nextActionText = t(
    `sections.match.results.nextAction.${nextActionKey}`,
    score !== null && score >= 70
      ? 'Next: optimize and export this version.'
      : score !== null && score >= 40
        ? 'Next: close the top gaps before optimizing.'
        : 'Next: review role fit before spending optimization effort.'
  );
  const hasDetailedResults = Boolean(
    matchAnalysis?.suggestions?.length ||
    matchAnalysis?.gapAnalysis?.length ||
    matchAnalysis?.keywordStrategy?.hiddenMatches?.length ||
    matchAnalysis?.keywordStrategy?.mirroredPhrases?.length ||
    matchAnalysis?.keywordStrategy?.structuralChanges?.length ||
    realityCheck?.confirmedRisks?.length ||
    realityCheck?.unclearRisks?.length
  );

  const buttonDisabled = !jobText.trim() || !hasResume || isAnalyzing;
  const disabledHint = !hasResume
    ? t('sections.match.hints.uploadFirst', 'Upload or paste your resume first.')
    : !jobText.trim()
      ? t('sections.match.hints.pasteJob', 'Paste a job description to continue.')
      : "";

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <GlassCard>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <GlassCircle size="md" variant="success">
                <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </GlassCircle>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('sections.match.jobInput.title', 'Match a Role')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('sections.match.subtitle', 'Paste the job description to uncover keyword gaps')}
                </p>
              </div>
            </div>
            {jobText && (
              <button
                onClick={() => {
                  setJobText("");
                  onClear?.();
                }}
                className="text-xs font-medium text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-white/5 hover:bg-rose-500/20 px-2.5 py-1 rounded-lg transition-all"
              >
                {t('common.clear', 'Clear')}
              </button>
            )}
          </div>

          <GlassTextarea
            id="jobDescription"
            name="jobDescription"
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder={t('sections.match.jobInput.placeholder', 'Paste the job description here...')}
            className="w-full h-64 mb-4 font-mono text-sm leading-relaxed"
            error={error}
          />



          {/* No Resume Warning */}
          {!hasResume && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-400">{t('sections.match.noResume', 'Upload your resume first')}</p>
            </div>
          )}

          <GlassButton
            onClick={handleAnalyze}
            disabled={buttonDisabled}
            isLoading={isAnalyzing}
            className="w-full group relative font-bold"
            variant="prominent"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
            <Sparkles className={cn("w-4 h-4 me-2", isAnalyzing && "animate-spin")} />
            {isAnalyzing ? t('sections.match.analyzing', 'Analyzing...') : (
              <>
                {t('sections.match.analyze', 'Analyze Match with AI')}
                <span className="ml-2 text-xs opacity-75">(2 {t('common.credits', 'credits')})</span>
              </>
            )}
          </GlassButton>

          {disabledHint && (
            <p className="text-xs text-gray-500 mt-2 text-center">{disabledHint}</p>
          )}
        </GlassCard>

        {/* Results Section */}
        <GlassCard>
          <div className="flex items-center gap-3 mb-6">
            <GlassCircle size="md" variant="blue">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </GlassCircle>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('sections.match.results.title', 'Match Results')}
            </h3>
          </div>

          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
              <div className="relative">
                <svg className="animate-spin h-20 w-20 text-emerald-500" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-emerald-300 animate-pulse" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('sections.match.analyzingTitle', 'Analyzing Match...')}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">
                {t(
                  'sections.match.analyzingDesc',
                  'AI is comparing your resume against job requirements. This takes 10-20 seconds.'
                )}
              </p>
            </div>
          ) : hasResults && score !== null ? (
            <div className="flex flex-col h-full gap-5">
              {/* Score Ring Display - Fixed at top */}
              <div className="relative rounded-2xl overflow-hidden shrink-0">
                {/* Background gradient */}
                <div className={cn(
                  'absolute inset-0 bg-gradient-to-br',
                  variant.gradient
                )}>
                  <div className={cn('absolute inset-0 opacity-20 blur-2xl', variant.glow)} />
                </div>

                {/* Content */}
                <div className="relative z-10 p-6 text-gray-900 dark:text-white">
                  <div className="flex flex-col items-center gap-4">
                    {/* SVG Ring */}
                    <div 
                      className="relative shrink-0 mx-auto" 
                      style={{ width: '140px', height: '140px', minWidth: '140px', minHeight: '140px' }}
                    >
                      <div className={cn('absolute inset-0 rounded-full blur-xl opacity-20', variant.glow)} />
                      <svg
                        className="absolute inset-0 rotate-[-90deg] overflow-visible"
                        style={{ width: '100%', height: '100%' }}
                        viewBox="0 0 140 140"
                      >
                        <defs>
                          <linearGradient id="score-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={variant.strokeStart} />
                            <stop offset="100%" stopColor={variant.strokeEnd} />
                          </linearGradient>
                          <filter id="glow-shadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                            <feMerge>
                              <feMergeNode in="coloredBlur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <circle
                          cx="70"
                          cy="70"
                          r={RING_RADIUS}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="8"
                          className="text-gray-200 dark:text-white/10"
                        />
                        <circle
                          cx="70"
                          cy="70"
                          r={RING_RADIUS}
                          fill="none"
                          stroke="url(#score-gradient)"
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={RING_CIRCUMFERENCE}
                          strokeDashoffset={ringOffset}
                          className="transition-[stroke-dashoffset] duration-1000 ease-out"
                        />
                      </svg>

                      {/* Inner Score */}
                      <div 
                        className="!absolute grid place-items-center gauge-badge overflow-hidden rounded-full"
                        style={{ inset: '12px' }}
                      >
                        <div className="flex flex-col items-center justify-center text-center relative z-10 w-full h-full">
                          <Tooltip
                            content={`${score}/100 - ${t(`sections.match.variant.${variant.label}`, variant.label)}`}
                            position="bottom"
                          >
                            <div className="flex flex-col items-center justify-center cursor-help">
                              <AnimatedCounter
                                to={score}
                                duration={1500}
                                className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight leading-none"
                              />
                              <span className="text-[10px] font-bold text-gray-400 dark:text-white/50 uppercase tracking-widest mt-1 block w-full text-center">{t('sections.match.scoreLabel', 'Score')}</span>
                            </div>
                          </Tooltip>
                        </div>
                      </div>
                    </div>

                    {/* Score Label */}
                    <div className="text-center">
                      <p className={cn('text-sm font-bold uppercase tracking-[0.2em]', variant.text)}>
                        {t(`sections.match.variant.${variant.label}`, variant.label)}
                      </p>
                      <p className="mt-1 text-sm text-gray-700 dark:text-white/80">
                        {matchAnalysis?.reasoning || (
                          score >= 70
                            ? t('sections.match.results.strongMessage', 'Your profile is highly aligned with this role.')
                            : score >= 40
                              ? t('sections.match.results.moderateMessage', 'Addressing a few key gaps could boost your chances.')
                              : t('sections.match.results.weakMessage', 'Consider tailoring your experience to the job requirements.')
                        )}
                      </p>
                      <p className="mt-2 rounded-xl border border-emerald-500/15 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-800 dark:text-emerald-100">
                        {nextActionText}
                      </p>
                      <p className="mt-2 inline-flex items-center justify-center gap-1.5 text-xs text-emerald-400/90 bg-emerald-500/10 px-2.5 py-0.5 rounded-full mx-auto">
                        <Target className="h-3 w-3" />
                        {t('trust.matchAnalysis')}
                      </p>
                    </div>

                    {realityCheck && realityVariant && RealityIcon && (
                      <section
                        aria-label={t('sections.match.realityCheck.ariaLabel', 'Strategic Reality Check')}
                        role={realityVariant.role}
                        className={cn(
                          'w-full rounded-xl border p-4 text-start',
                          realityVariant.container
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <RealityIcon className="mt-0.5 h-5 w-5 shrink-0" />
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-bold">
                                {t('sections.match.realityCheck.title', 'Strategic Reality Check')}
                              </h4>
                              <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase', realityVariant.badge)}>
                                {t(`sections.match.realityCheck.tiers.${realityCheck.riskTier}`, realityCheck.riskTier)}
                              </span>
                              {detailsOpen && (
                                <span className="rounded-full border border-gray-300/40 bg-white/30 px-2 py-0.5 text-[11px] font-medium dark:border-white/10 dark:bg-white/10">
                                  {t('sections.match.realityCheck.confidence', 'Confidence')}: {t(`sections.match.realityCheck.confidenceLevels.${realityCheck.confidence}`, realityCheck.confidence)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm leading-relaxed">
                              {realityCheck.summary || t('sections.match.realityCheck.fallbackSummary', 'Review the evidence before optimizing this resume.')}
                            </p>
                            {detailsOpen && (realityCheck.confirmedRisks.length > 0 || realityCheck.unclearRisks.length > 0) && (
                              <div className="grid gap-2 text-xs sm:grid-cols-2">
                                {realityCheck.confirmedRisks.slice(0, 2).map((risk, index) => (
                                  <div key={`confirmed-${index}`} className="rounded-lg bg-white/35 p-2 dark:bg-black/15">
                                    <p className="font-semibold">{risk.title}</p>
                                    <p className="mt-1 opacity-80">{risk.mitigation}</p>
                                  </div>
                                ))}
                                {realityCheck.unclearRisks.slice(0, 2).map((risk, index) => (
                                  <div key={`unclear-${index}`} className="rounded-lg bg-white/35 p-2 dark:bg-black/15">
                                    <p className="font-semibold">
                                      {t('sections.match.realityCheck.unclearLabel', 'Unclear')}: {risk.topic}
                                    </p>
                                    <p className="mt-1 opacity-80">{risk.evidenceNeeded || risk.reason}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="text-xs font-medium opacity-85">
                              {t(`sections.match.realityCheck.recommendations.${realityCheck.recommendation}`, 'Review evidence before optimizing.')}
                            </p>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Optimized Resume Warning Banner */}
                    {showOptimized && score !== null && (
                      <div className="w-full p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <p className="text-sm text-emerald-700 dark:text-emerald-300 text-center">
                          ✅ {t('sections.match.optimizedBanner', 'Analyzing OPTIMIZED resume. If you export now and re-upload, expect score around {{score}}.', { score })}
                        </p>
                      </div>
                    )}

                    {/* Score Breakdown Button */}
                    <button
                      ref={buttonRef}
                      type="button"
                      onClick={() => setWhyOpen(!whyOpen)}
                      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gray-200 dark:border-white/20 bg-gray-200/50 dark:bg-white/10 text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white hover:bg-gray-300/50 dark:hover:bg-white/20 transition-all"
                    >
                      <Info className="h-3.5 w-3.5" />
                      {t('sections.match.results.breakdown', 'Score Breakdown')}
                    </button>
                  </div>
                </div>

                {/* Popover - Category Breakdown */}
                {whyOpen && (
                  <div
                    ref={popoverRef}
                    className="absolute left-2 right-2 bottom-2 z-50 rounded-2xl border border-gray-200 dark:border-white/20 bg-white/90 dark:bg-[#041c17]/80 p-5 backdrop-blur-2xl shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-200"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-white/60">
                        {t('sections.match.results.howItWorks', 'Score Breakdown')}
                      </p>
                      <button
                        onClick={() => setWhyOpen(false)}
                        className="text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    {matchAnalysis?.categoryScores ? (
                      <div className="space-y-3">
                        {[
                          { key: 'hard_skills', i18nKey: 'hardSkills', color: 'bg-blue-500', text: 'text-blue-400', icon: Code2 },
                          { key: 'experience', i18nKey: 'experience', color: 'bg-purple-500', text: 'text-purple-400', icon: Briefcase },
                          { key: 'education', i18nKey: 'education', color: 'bg-amber-500', text: 'text-amber-400', icon: GraduationCap },
                          { key: 'soft_skills', i18nKey: 'softSkills', color: 'bg-emerald-500', text: 'text-emerald-400', icon: Users }
                        ].map(cat => {
                          const data = matchAnalysis.categoryScores?.[cat.key as keyof typeof matchAnalysis.categoryScores];
                          if (!data) return null;
                          const CatIcon = cat.icon;
                          const percent = Math.min(100, (data.score / data.max) * 100);

                          return (
                            <div key={cat.key} className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <CatIcon className={cn("w-3.5 h-3.5", cat.text)} />
                                  <span className="text-gray-700 dark:text-white/80 font-medium">{t(`sections.match.categoryScores.${cat.i18nKey}`)}</span>
                                </div>
                                <span className={cn("font-bold", cat.text)}>{data.score}/{data.max}</span>
                              </div>
                              <div className="h-2.5 w-full bg-gray-200 dark:bg-black/20 rounded-full overflow-hidden ring-1 ring-gray-300/50 dark:ring-white/5">
                                <div
                                  className={cn("h-full rounded-full transition-all duration-700 ease-out", cat.color)}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-800 dark:text-white/90 leading-relaxed">
                        <strong>{t('sections.match.results.coverage', 'Coverage')}</strong> {t('sections.match.results.coverageDesc', 'measures what percentage of key job requirements appear in your resume.')}
                      </p>
                    )}
                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/10">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-white/50 mb-2">
                        {t('sections.match.results.calculation.title', 'How is this calculated?')}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 dark:text-white/60">
                        <div>
                          <span className="text-blue-400 font-medium block mb-0.5">{t('sections.match.categoryScores.hardSkills', 'Hard Skills')}</span>
                          {t('sections.match.categoryScores.hardSkillsDesc', 'Matching technical keywords')}
                        </div>
                        <div>
                          <span className="text-purple-400 font-medium block mb-0.5">{t('sections.match.categoryScores.experience', 'Experience')}</span>
                          {t('sections.match.categoryScores.experienceDesc', 'Job titles & years relevance')}
                        </div>
                        <div>
                          <span className="text-amber-400 font-medium block mb-0.5">{t('sections.match.categoryScores.education', 'Education')}</span>
                          {t('sections.match.categoryScores.educationDesc', 'Degree & field match')}
                        </div>
                        <div>
                          <span className="text-emerald-400 font-medium block mb-0.5">{t('sections.match.categoryScores.softSkills', 'Soft Skills')}</span>
                          {t('sections.match.categoryScores.softSkillsDesc', 'Behavioral & leadership traits')}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto glass-scrollbar space-y-5 pr-2 -mr-2 max-h-[500px]">

                {/* Missing Keywords */}
                {missing.length > 0 && (
                  <div className="space-y-3 animate-fade-in" style={{ animationDelay: '100ms' }}>
                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-rose-400/90">
                      <div className="p-1 rounded bg-rose-500/20">
                        <AlertCircle className="h-3.5 w-3.5" />
                      </div>
                      {t('sections.match.results.missing', 'Missing Keywords')} <span className="text-gray-400 dark:text-white/40">({missing.length})</span>
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {missing.map((keyword, i) => (
                        <span
                          key={i}
                          className="group px-3 py-1.5 bg-rose-500/5 text-rose-700 dark:text-rose-300/90 rounded-lg text-sm border border-rose-500/10 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all cursor-pointer hover:scale-[1.02]"
                          title={t('sections.match.results.addKeyword', 'Consider adding this keyword')}
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Matched Keywords (Top Hits) */}
                {hits.length > 0 && (
                  <div className="space-y-3 animate-fade-in" style={{ animationDelay: '200ms' }}>
                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400/90">
                      <div className="p-1 rounded bg-emerald-500/20">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                      {t('sections.match.results.keywords', 'Recognized Strengths')} <span className="text-gray-400 dark:text-white/40">({hits.length})</span>
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {hits.map((keyword, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300/90 rounded-lg text-sm border border-emerald-500/10 hover:bg-emerald-500/10 transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3 inline me-1.5 opacity-60" />
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {hasDetailedResults && (
                  <button
                    type="button"
                    onClick={() => setDetailsOpen((value) => !value)}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
                    aria-expanded={detailsOpen}
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", detailsOpen && "rotate-180")} />
                    {detailsOpen
                      ? t('sections.match.results.hideDetails', 'Hide details')
                      : t('sections.match.results.showDetails', 'Show details')}
                  </button>
                )}

                {/* Suggestions */}
                {detailsOpen && matchAnalysis?.suggestions && matchAnalysis.suggestions.length > 0 && (
                  <div className="space-y-3 animate-fade-in" style={{ animationDelay: '300ms' }}>
                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400/90">
                      <div className="p-1 rounded bg-amber-500/20">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      {t('sections.match.results.suggestions', 'Suggestions')}
                    </h4>
                    <ul className="space-y-2">
                      {matchAnalysis.suggestions.map((suggestion, i) => (
                        <li
                          key={i}
                          className="p-3 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-white/10 hover:border-gray-200 dark:hover:border-white/20 transition-all cursor-default"
                        >
                          <span className="text-amber-400 mr-2">•</span>
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Gap Analysis Section */}
                {detailsOpen && matchAnalysis?.gapAnalysis && matchAnalysis.gapAnalysis.length > 0 && (
                  <GapAnalysisCard gaps={matchAnalysis.gapAnalysis} />
                )}

                {/* Hidden Matches - Skills that match using different terminology */}
                {detailsOpen && matchAnalysis?.keywordStrategy?.hiddenMatches && matchAnalysis.keywordStrategy.hiddenMatches.length > 0 && (
                  <HiddenMatchesCard matches={matchAnalysis.keywordStrategy.hiddenMatches} />
                )}

                {/* Mirrored Keywords - JD phrases injected into optimized content */}
                {detailsOpen && matchAnalysis?.keywordStrategy && (
                  matchAnalysis.keywordStrategy.mirroredPhrases?.length || matchAnalysis.keywordStrategy.structuralChanges?.length
                ) ? (
                  <MirroredKeywordsCard
                    mirroredPhrases={matchAnalysis.keywordStrategy.mirroredPhrases || []}
                    structuralChanges={matchAnalysis.keywordStrategy.structuralChanges || []}
                  />
                ) : null}


              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 animate-fade-in">
              <div className="relative mb-6 group">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-1000 animate-pulse" />
                <div className="relative p-6 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 group-hover:border-gray-300 dark:group-hover:border-white/20 transition-all duration-500 group-hover:scale-110">
                  <Target className="w-10 h-10 text-gray-400 group-hover:text-blue-400 transition-colors duration-500" />
                </div>
              </div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {t('sections.match.emptyState.title', 'Ready to Analyze')}
              </h4>
              <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
                {t('sections.match.emptyState', 'Paste a job description to see how well your resume matches the requirements.')}
              </p>
            </div>
          )}
          {hasResults && !isAnalyzing && jobDescription && (
            <SaveJobToPipelineCard
              jobDescription={jobDescription}
              matchScore={score}
              extractedMetadata={extractedMetadata}
              onSaved={onJobSaved}
              onToast={onToast}
            />
          )}
        </GlassCard>
      </div>

      {/* Vision 2030 Info Modal */}

      {/* Credit Confirmation Modal */}
      <ConfirmActionModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmMatch}
        feature="ai_match"
        isLoading={isAnalyzing}
      />
    </>
  );
}
