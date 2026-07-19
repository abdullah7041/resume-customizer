import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Code2,
  GraduationCap,
  Info,
  Link2,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import { GlassButton } from '../ui/GlassButton';
import { GlassCard } from '../ui/GlassCard';
import { GlassCircle } from '../ui/GlassCircle';
import { GlassTextarea } from '../ui/GlassTextarea';
import Tooltip from '../ui/Tooltip';
import { AnimatedCounter } from '../ui/AnimatedCounter';
import { ConfirmActionModal } from '../Credits/ConfirmActionModal';
import { GapAnalysisCard, type GapItem } from '../GapAnalysisCard';
import { HiddenMatchesCard, type HiddenMatch } from '../HiddenMatchesCard';
import { MirroredKeywordsCard } from '../MirroredKeywordsCard';
import { requestValueMomentFeedbackPrompt } from '../Feedback/FeedbackPromptController';
import { importJobFromUrl } from '@/services/api';
import { useUserCredits } from '../../hooks/useUserCredits';
import { cn } from '../../lib/utils/cn';
import { getCompatibleStorageItem, removeCompatibleStorageItem, setCompatibleStorageItem } from '../../lib/utils/storage-migration';
import { CharacterResultsCompanion } from '@/components/shared/CharacterResultsCompanion';
import { FEATURE_COSTS } from '../../types/credits';
import { analytics } from '../../services/analytics';
import type { ExtractedJobMetadata } from '../../types/pipeline';
import type { StrategicRealityCheck } from '../../types/analysis';
import type { AtsExplainabilitySource } from '../../types/explainability';
import { AtsExplainabilityPanel } from '../AtsExplainabilityPanel';
import { SaveJobToPipelineCard } from './SaveJobToPipelineCard';

const LAST_JOB_KEY = 'watheq:lastJobDescription';
const FREE_MATCH_STORAGE_KEY = 'watheq:freeMatchUsed';

const resolveVariant = (score: number) => {
  if (score >= 70) {
    return {
      gradient: 'from-emerald-500/10 via-emerald-500/[0.04] to-transparent',
      glow: 'bg-emerald-500/15',
      label: 'strongMatch',
      text: 'text-emerald-700 dark:text-emerald-300',
    };
  }
  if (score >= 40) {
    return {
      gradient: 'from-amber-500/10 via-amber-500/[0.04] to-transparent',
      glow: 'bg-amber-500/12',
      label: 'goodStart',
      text: 'text-amber-700 dark:text-amber-300',
    };
  }
  return {
    gradient: 'from-rose-500/10 via-rose-500/[0.04] to-transparent',
    glow: 'bg-rose-500/12',
    label: 'needsWork',
    text: 'text-rose-700 dark:text-rose-300',
  };
};

const getRealityCheckVariant = (riskTier: StrategicRealityCheck['riskTier']) => {
  if (riskTier === 'low') {
    return {
      container: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
      badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/20',
      role: 'status' as const,
    };
  }
  if (riskTier === 'medium') {
    return {
      container: 'border-amber-500/25 bg-amber-500/10 text-amber-950 dark:text-amber-100',
      badge: 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/25',
      role: 'status' as const,
    };
  }
  if (riskTier === 'high') {
    return {
      container: 'border-rose-500/25 bg-rose-500/10 text-rose-950 dark:text-rose-100',
      badge: 'bg-rose-500/15 text-rose-800 dark:text-rose-200 border-rose-500/25',
      role: 'alert' as const,
    };
  }
  return {
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
  summary_bullets?: string[];
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
  onAnalyzeMatchAI: (jobDescription: string, options?: { freePreview?: boolean }) => Promise<MatchResult>;
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

type DetailKey = 'why' | 'gaps' | 'keywords' | 'full';

interface DetailAccordionProps {
  title: string;
  count?: number;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function DetailAccordion({ title, count, icon, open, onToggle, children }: DetailAccordionProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white/60 dark:border-white/10 dark:bg-white/[0.04]">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-start"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
          <span className="text-gray-500 dark:text-white/60">{icon}</span>
          <span>{title}</span>
          {typeof count === 'number' && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:bg-white/10 dark:text-white/60">
              {count}
            </span>
          )}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-500 transition-transform rtl:rotate-180', open && 'rotate-180 rtl:rotate-0')} />
      </button>
      {open && <div className="px-4 pb-4 text-start">{children}</div>}
    </section>
  );
}

const splitReasoningIntoBullets = (reasoning?: string) => {
  if (!reasoning) return [];
  return reasoning
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
};

const getJobWordCount = (value: string) =>
  value.trim().split(/\s+/).filter(Boolean).length;

const uniqueStrings = (items: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
};

const hasFreePreviewRun = () =>
  typeof window !== 'undefined' && window.localStorage.getItem(FREE_MATCH_STORAGE_KEY) !== 'true';

const markFreePreviewUsed = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(FREE_MATCH_STORAGE_KEY, 'true');
  }
};

const handleOptimizeClick = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('watheq:navigate-tab', { detail: { tab: 'optimize' } }));
  }
};

export function MatchSection({
  onAnalyzeMatchAI,
  matchAnalysis,
  isAnalyzing = false,
  hasResume = false,
  onToast,
  onClear,
  jobDescription = '',
  extractedMetadata,
  onJobSaved,
}: MatchSectionProps) {
  const { t, i18n } = useTranslation();
  const [jobText, setJobText] = useState(() => {
    if (typeof window === 'undefined') return '';
    return getCompatibleStorageItem(LAST_JOB_KEY) ?? '';
  });
  const [error, setError] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [scoreBreakdownOpen, setScoreBreakdownOpen] = useState(false);
  const [saveJobOpen, setSaveJobOpen] = useState(false);
  const [jobEditorOpen, setJobEditorOpen] = useState(false);
  const [openDetails, setOpenDetails] = useState<Record<DetailKey, boolean>>({
    why: false,
    gaps: false,
    keywords: false,
    full: false,
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const { isLoading: creditsLoading, refetch: refetchCredits } = useUserCredits();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (jobText.trim()) {
      setCompatibleStorageItem(LAST_JOB_KEY, jobText);
    } else {
      removeCompatibleStorageItem(LAST_JOB_KEY);
    }
  }, [jobText]);

  useEffect(() => {
    if (matchAnalysis) {
      setJobEditorOpen(false);
    }
  }, [matchAnalysis]);

  // Arriving from Optimize's "Review top match gaps" CTA: open the Gaps & evidence
  // accordion and bring it into view. The anchor is single-shot (cleared on read).
  useEffect(() => {
    if (typeof window === 'undefined' || !matchAnalysis) return;
    let anchor: string | null = null;
    try {
      anchor = sessionStorage.getItem('watheq:pendingMatchAnchor');
    } catch {
      return;
    }
    if (anchor !== 'gaps') return;
    try {
      sessionStorage.removeItem('watheq:pendingMatchAnchor');
    } catch { /* ignore */ }
    setOpenDetails((prev) => ({ ...prev, gaps: true }));
    requestAnimationFrame(() => {
      document.getElementById('match-gaps')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [matchAnalysis]);

  // Paste a job URL (LinkedIn, career pages, ATS boards) instead of the text —
  // the importer resolves it server-side (SSRF-guarded) and fills the SAME
  // editable JD textarea, so review + analysis flow exactly as with manual paste.
  const handleImportFromUrl = async () => {
    const url = jobUrl.trim();
    if (!url || isImporting) return;

    setIsImporting(true);
    setImportError(null);
    try {
      const result = await importJobFromUrl(url, i18n.language === 'ar' ? 'ar' : 'en');
      if (result?.status === 'ok' && result.jobText) {
        setJobText(result.jobText);
        setJobUrl('');
        analytics.track('job_url_import_succeeded', { source: result.source, confidence: result.confidence });
        onToast?.({
          type: 'success',
          title: t('sections.match.urlImport.import', 'Import'),
          description: t('sections.match.urlImport.success', 'Job description imported — review it before analyzing.'),
        });
      } else {
        const reason = typeof result?.failureReason === 'string' ? result.failureReason : 'unreachable';
        analytics.track('job_url_import_failed', { reason });
        setImportError(importFailureMessage(reason));
      }
    } finally {
      setIsImporting(false);
    }
  };

  const importFailureMessage = (reason: string): string => {
    switch (reason) {
      case 'invalid_url':
        return t('sections.match.urlImport.errors.invalidUrl', 'That does not look like a valid job link. Check the URL and try again.');
      case 'unsupported_url':
        return t('sections.match.urlImport.errors.unsupportedUrl', 'This link type is not supported yet. Open the job posting itself and copy its link.');
      case 'login_required':
        return t('sections.match.urlImport.errors.loginRequired', "Watheq couldn't reliably import the full description from this link. Open the company's job page or paste the description manually.");
      case 'linkedin_blocked':
        return t('sections.match.urlImport.errors.linkedinBlocked', 'LinkedIn blocked automated access to this job page. Open the job on LinkedIn and paste the description manually.');
      case 'blocked':
        return t('sections.match.urlImport.errors.blocked', 'This site blocked the import. Paste the job description manually.');
      case 'timeout':
        return t('sections.match.urlImport.errors.timeout', 'The site took too long to respond. Try again or paste the description manually.');
      case 'too_large':
      case 'not_html':
        return t('sections.match.urlImport.errors.notAJobPage', 'That link does not point to a readable job page. Paste the description manually.');
      case 'jd_not_found':
        return t('sections.match.urlImport.errors.jdNotFound', "Couldn't find a full job description on that page. Paste the description manually.");
      case 'rate_limited':
        return t('sections.match.urlImport.errors.rateLimited', 'Import limit reached for now. Paste the job description manually.');
      default:
        return t('sections.match.urlImport.errors.unreachable', "Couldn't reach that page. Check the link or paste the description manually.");
    }
  };

  const handleAnalyzeActual = async (options?: { freePreview?: boolean }) => {
    const trimmedJob = jobText.trim();
    if (!trimmedJob) {
      const message = t('sections.match.errors.noJob', 'Paste the job description before analyzing.');
      setError(message);
      onToast?.({
        type: 'warning',
        title: t('sections.match.errors.jobNeeded', 'Job description needed'),
        description: message,
      });
      return;
    }
    setError('');
    analytics.trackJobDescriptionSubmitted();
    analytics.trackMatchAnalysisStarted();
    try {
      const result = await onAnalyzeMatchAI(trimmedJob, options);
      if (options?.freePreview) markFreePreviewUsed();
      if (result && typeof result.score === 'number') {
        analytics.trackMatchAnalysisSuccess(result.score);
        requestValueMomentFeedbackPrompt('match_success');
      }
      if (result?.strategicRealityCheck) {
        analytics.trackStrategicRealityCheck({
          riskTier: result.strategicRealityCheck.riskTier,
          recommendation: result.strategicRealityCheck.recommendation,
          confidence: result.strategicRealityCheck.confidence,
          riskTypes: result.strategicRealityCheck.riskTypes,
        });
      }
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

      if (msg.includes('high load') || msg.includes('timed out') || msg.includes('wait 30 seconds')) {
        onToast?.({
          type: 'info',
          title: t('sections.match.errors.serviceOverloaded', 'AI service is busy'),
          description: t('sections.match.errors.serviceOverloadedDesc', 'The AI service is experiencing high demand. Please wait a moment and try again.'),
        });
      }
    }
  };

  const handleAnalyze = () => {
    const trimmedJob = jobText.trim();
    if (!trimmedJob) {
      const message = t('sections.match.errors.noJob', 'Paste the job description before analyzing.');
      setError(message);
      onToast?.({
        type: 'warning',
        title: t('sections.match.errors.jobNeeded', 'Job description needed'),
        description: message,
      });
      return;
    }

    if (hasFreePreviewRun()) {
      void handleAnalyzeActual({ freePreview: true });
      return;
    }

    if (creditsLoading) return;
    setShowConfirmModal(true);
  };

  const handleConfirmMatch = async () => {
    setShowConfirmModal(false);
    try {
      await handleAnalyzeActual();
    } catch (err) {
      console.error('[MatchSection] handleConfirmMatch rejected:', err);
      setError((err as Error)?.message || t('sections.match.errors.analyzeFailed', 'We could not analyze this match.'));
    }
  };

  const hasResults = Boolean(matchAnalysis);
  const rawScore = Number.isFinite(matchAnalysis?.score) ? matchAnalysis!.score : null;
  const score = rawScore != null ? Math.max(0, Math.min(100, Math.round(rawScore))) : null;
  const variant = resolveVariant(score ?? 0);
  const missing = matchAnalysis?.missingKeywords ?? [];
  const found = matchAnalysis?.topHits ?? matchAnalysis?.matchedKeywords ?? [];
  const realityCheck = matchAnalysis?.strategicRealityCheck ?? null;
  const realityVariant = realityCheck ? getRealityCheckVariant(realityCheck.riskTier) : null;
  const summaryBullets = (matchAnalysis?.summary_bullets?.length
    ? matchAnalysis.summary_bullets
    : splitReasoningIntoBullets(matchAnalysis?.reasoning)
  ).slice(0, 5);
  const gapChips = uniqueStrings([
    ...(realityCheck?.confirmedRisks.map((risk) => risk.title) ?? []),
    ...(realityCheck?.unclearRisks.map((risk) => risk.topic) ?? []),
    ...(matchAnalysis?.gapAnalysis?.map((gap) => gap.requirement) ?? []),
    ...missing,
  ]).slice(0, 3);
  const nextActionKey = realityCheck
    ? `reality.${realityCheck.recommendation}`
    : score !== null && score >= 70
      ? 'optimize'
      : score !== null && score >= 40
        ? 'closeGaps'
        : 'reviewFit';
  const nextActionFallback = realityCheck
    ? {
        optimize_now: 'Next: optimize and export this version.',
        answer_clarifications_first: 'Next: answer clarifying questions before rewriting.',
        add_evidence_first: 'Next: add verifiable evidence before optimizing.',
        review_role_fit: 'Next: review role fit before spending optimization effort.',
      }[realityCheck.recommendation]
    : score !== null && score >= 70
      ? 'Next: optimize and export this version.'
      : score !== null && score >= 40
        ? 'Next: close the top gaps before optimizing.'
        : 'Next: review role fit before spending optimization effort.';
  const nextActionText = t(
    `sections.match.results.nextAction.${nextActionKey}`,
    nextActionFallback
  );
  const jobWordCount = getJobWordCount(jobText);
  const buttonDisabled = !jobText.trim() || !hasResume || isAnalyzing;
  const disabledHint = !hasResume
    ? t('sections.match.hints.uploadFirst', 'Upload or paste your resume first.')
    : !jobText.trim()
      ? t('sections.match.hints.pasteJob', 'Paste a job description to continue.')
      : '';
  const hasDetails = Boolean(
    summaryBullets.length ||
    matchAnalysis?.gapAnalysis?.length ||
    matchAnalysis?.keywordStrategy?.hiddenMatches?.length ||
    matchAnalysis?.keywordStrategy?.mirroredPhrases?.length ||
    matchAnalysis?.keywordStrategy?.structuralChanges?.length ||
    realityCheck?.confirmedRisks.length ||
    realityCheck?.unclearRisks.length ||
    realityCheck?.strengths.length ||
    realityCheck?.limits.assumptions.length ||
    missing.length ||
    found.length ||
    matchAnalysis?.reasoning
  );

  const categoryRows = useMemo(
    () => [
      { key: 'hard_skills' as const, i18nKey: 'hardSkills', color: 'bg-blue-500', text: 'text-blue-500', icon: Code2 },
      { key: 'experience' as const, i18nKey: 'experience', color: 'bg-purple-500', text: 'text-purple-500', icon: Briefcase },
      { key: 'education' as const, i18nKey: 'education', color: 'bg-amber-500', text: 'text-amber-500', icon: GraduationCap },
      { key: 'soft_skills' as const, i18nKey: 'softSkills', color: 'bg-emerald-500', text: 'text-emerald-500', icon: Users },
    ],
    []
  );

  const toggleDetail = (key: DetailKey) => {
    setOpenDetails((current) => ({ ...current, [key]: !current[key] }));
  };

  // Source for the explainability panel — assembled entirely from the live
  // match analysis. No new fetch, no scoring.
  const explainabilitySource: AtsExplainabilitySource = {
    matchedKeywords: matchAnalysis?.matchedKeywords ?? matchAnalysis?.topHits ?? [],
    missingKeywords: matchAnalysis?.missingKeywords ?? [],
    categoryScores: (matchAnalysis?.categoryScores ?? null) as AtsExplainabilitySource['categoryScores'],
    realityCheck,
  };

  return (
    <>
      <div className="space-y-5">
        <GlassCard className="mx-auto w-full">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <GlassCircle size="md" variant="success">
                <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
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
            {jobText && !hasResults && (
              <button
                type="button"
                onClick={() => {
                  setJobText('');
                  onClear?.();
                }}
                className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-rose-500/20 hover:text-gray-900 dark:bg-white/5 dark:hover:text-white"
              >
                {t('common.clear', 'Clear')}
              </button>
            )}
          </div>

          {hasResults && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 text-sm font-medium text-gray-700 dark:text-white/75">
                  <span className="font-bold text-gray-900 dark:text-white">
                    {extractedMetadata?.jobTitle || t('sections.match.jobInput.collapsedTitle', 'Job description')}
                  </span>
                  <span className="mx-2 text-gray-400">·</span>
                  <span>{t('sections.match.jobInput.wordCount', '{{count}} words', { count: jobWordCount })}</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setJobEditorOpen((value) => !value)}
                    className="rounded-lg px-3 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-500/10 dark:text-emerald-300"
                  >
                    {jobEditorOpen ? t('sections.match.jobInput.doneEditing', 'Done') : t('sections.match.jobInput.viewEdit', 'View/edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setJobText('');
                      onClear?.();
                    }}
                    className="rounded-lg px-3 py-2 text-xs font-bold text-gray-500 transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:text-white/60 dark:hover:text-rose-300"
                  >
                    {t('common.clear', 'Clear')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {(!hasResults || jobEditorOpen) && (
            <div className="mb-3 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] p-3 dark:border-white/10 dark:bg-white/[0.04]">
              <label htmlFor="jobUrl" className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                <Link2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                {t('sections.match.urlImport.label', 'Or paste a job link (LinkedIn, career pages)')}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="jobUrl"
                  name="jobUrl"
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  dir="ltr"
                  value={jobUrl}
                  onChange={(event) => {
                    setJobUrl(event.target.value);
                    if (importError) setImportError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleImportFromUrl();
                    }
                  }}
                  disabled={isImporting}
                  placeholder={t('sections.match.urlImport.placeholder', 'https://www.linkedin.com/jobs/view/...')}
                  className="min-h-11 flex-1 rounded-lg border border-[color:var(--glass-border)] bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none disabled:opacity-60 dark:border-white/10 dark:bg-black/20 dark:text-white dark:placeholder:text-gray-500"
                />
                <GlassButton
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleImportFromUrl()}
                  disabled={!jobUrl.trim() || isImporting}
                  isLoading={isImporting}
                  leftIcon={<Link2 className="h-3.5 w-3.5" />}
                  className="sm:w-auto"
                >
                  {isImporting
                    ? t('sections.match.urlImport.importing', 'Importing...')
                    : t('sections.match.urlImport.import', 'Import')}
                </GlassButton>
              </div>
              {importError && (
                <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300" role="alert">
                  {importError}
                </p>
              )}
            </div>
          )}

          {(!hasResults || jobEditorOpen) && (
            <GlassTextarea
              id="jobDescription"
              name="jobDescription"
              value={jobText}
              onChange={(event) => setJobText(event.target.value)}
              placeholder={t('sections.match.jobInput.placeholder', 'Paste the job description here...')}
              className="mb-4 h-64 w-full font-mono text-sm leading-relaxed"
              error={error}
            />
          )}

          {!hasResume && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
              <p className="text-sm text-amber-700 dark:text-amber-300">{t('sections.match.noResume', 'Upload your resume first')}</p>
            </div>
          )}

          {(!hasResults || jobEditorOpen) && (
            <GlassButton
              onClick={handleAnalyze}
              disabled={buttonDisabled}
              isLoading={isAnalyzing}
              leftIcon={<Sparkles className="h-4 w-4" />}
              className="group relative w-full font-bold"
              variant="prominent"
            >
              {isAnalyzing ? t('sections.match.analyzing', 'Analyzing...') : (
                <>
                  {t('sections.match.analyze', 'Analyze Match with AI')}
                  {!hasFreePreviewRun() && <span className="ms-2 text-xs opacity-75">(2 {t('common.credits', 'credits')})</span>}
                </>
              )}
            </GlassButton>
          )}

          {disabledHint && <p className="mt-2 text-center text-xs text-gray-500">{disabledHint}</p>}
        </GlassCard>

        {isAnalyzing ? (
          <GlassCard>
            <div className="flex flex-col items-center justify-center space-y-4 p-12">
              <div className="relative">
                <svg className="h-20 w-20 animate-spin text-emerald-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <Sparkles className="absolute inset-0 m-auto h-8 w-8 animate-pulse text-emerald-300" />
              </div>
              <h4 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                {t('sections.match.analyzingTitle', 'Analyzing Match...')}
              </h4>
              <p className="max-w-md text-center text-sm text-gray-500 dark:text-gray-400">
                {t('sections.match.analyzingDesc', 'AI is comparing your resume against job requirements. This takes 10-20 seconds.')}
              </p>
            </div>
          </GlassCard>
        ) : hasResults && score !== null ? (
          <>
            <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white/70 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <div className={cn('absolute inset-0 bg-gradient-to-br', variant.gradient)}>
                <div className={cn('absolute inset-0 opacity-20 blur-2xl', variant.glow)} />
              </div>
              <div className="relative z-10 flex flex-col gap-4 p-4 text-gray-900 dark:text-white sm:p-5 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
                  <Tooltip content={`${score}/100 - ${t(`sections.match.variant.${variant.label}`, variant.label)}`} position="bottom">
                    <div className="grid h-20 w-20 shrink-0 cursor-help place-items-center rounded-full border border-white/50 bg-white/70 shadow-sm dark:border-white/10 dark:bg-black/15">
                      <div className="text-center">
                        <AnimatedCounter to={score} duration={1200} className="text-3xl font-black leading-none text-gray-900 dark:text-white" />
                        <span className="mt-0.5 block text-[10px] font-bold uppercase text-gray-500 dark:text-white/50">{t('sections.match.scoreLabel', 'Score')}</span>
                      </div>
                    </div>
                  </Tooltip>
                  <CharacterResultsCompanion variant="match" score={score} />
                  <div className="min-w-[12rem] flex-1 text-start">
                    <p className={cn('text-sm font-bold uppercase', variant.text)}>
                      {t(`sections.match.variant.${variant.label}`, variant.label)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-white/85">{nextActionText}</p>
                    {gapChips.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {gapChips.map((gap) => (
                          <span key={gap} className="rounded-full border border-rose-500/15 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-200">
                            {gap}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-3 text-xs text-gray-500 dark:text-white/55">
                      {t('sections.match.results.optimizedCaption', 'Optimized-score verification appears here after you run Optimize.')}
                    </p>
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-56">
                  <GlassButton type="button" variant="prominent" className="w-full justify-center font-bold" onClick={handleOptimizeClick}>
                    <Zap className="me-2 h-4 w-4" />
                    {t('sections.match.results.optimizeCta', 'Optimize resume')}
                    <span className="ms-2 text-xs opacity-80">({FEATURE_COSTS.optimize} {t('common.credits', 'credits')})</span>
                  </GlassButton>
                  <div className="flex items-center justify-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setSaveJobOpen((value) => !value)}
                      className="inline-flex min-h-8 items-center gap-1 font-semibold text-gray-500 hover:text-gray-900 dark:text-white/60 dark:hover:text-white"
                      aria-expanded={saveJobOpen}
                    >
                      {t('sections.match.results.saveJobToggle', 'Save job')}
                      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform rtl:rotate-180', saveJobOpen && 'rotate-180 rtl:rotate-0')} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setScoreBreakdownOpen((value) => !value)}
                      className="min-h-8 font-semibold text-gray-500 hover:text-gray-900 dark:text-white/60 dark:hover:text-white"
                      aria-expanded={scoreBreakdownOpen}
                    >
                      {t('sections.match.results.breakdown', 'Score breakdown')}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {scoreBreakdownOpen && (
              <GlassCard>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-white/60">
                    {t('sections.match.results.howItWorks', 'Score Breakdown')}
                  </p>
                  <button type="button" onClick={() => setScoreBreakdownOpen(false)} aria-label={t('common.close', 'Close')} className="text-gray-400 transition-colors hover:text-gray-900 dark:text-white/40 dark:hover:text-white">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
                {matchAnalysis?.categoryScores ? (
                  <div className="space-y-3">
                    {categoryRows.map((cat) => {
                      const data = matchAnalysis.categoryScores?.[cat.key];
                      if (!data) return null;
                      const CatIcon = cat.icon;
                      const percent = Math.min(100, (data.score / data.max) * 100);
                      return (
                        <div key={cat.key} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <CatIcon className={cn('h-3.5 w-3.5', cat.text)} />
                              <span className="font-medium text-gray-700 dark:text-white/80">{t(`sections.match.categoryScores.${cat.i18nKey}`)}</span>
                            </div>
                            <span className={cn('font-bold', cat.text)}>{data.score}/{data.max}</span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 ring-1 ring-gray-300/50 dark:bg-black/20 dark:ring-white/5">
                            <div className={cn('h-full w-full origin-left rtl:origin-right rounded-full transition-transform duration-700 ease-out', cat.color)} style={{ transform: `scaleX(${Math.min(Math.max(percent, 0), 100) / 100})` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-start text-sm leading-relaxed text-gray-800 dark:text-white/90">
                    <strong>{t('sections.match.results.coverage', 'Coverage')}</strong> {t('sections.match.results.coverageDesc', 'measures what percentage of key job requirements appear in your resume.')}
                  </p>
                )}
              </GlassCard>
            )}

            {saveJobOpen && jobDescription && (
              <SaveJobToPipelineCard
                jobDescription={jobDescription}
                matchScore={score}
                extractedMetadata={extractedMetadata}
                onSaved={onJobSaved}
                onToast={onToast}
              />
            )}

            {hasDetails && (
              <div className="space-y-3">
                <DetailAccordion
                  title={t('sections.match.details.whyScore', 'Why this score')}
                  count={summaryBullets.length}
                  icon={<Info className="h-4 w-4" />}
                  open={openDetails.why}
                  onToggle={() => toggleDetail('why')}
                >
                  {summaryBullets.length > 0 ? (
                    <ul className="space-y-2 text-sm leading-relaxed text-gray-700 dark:text-white/75">
                      {summaryBullets.map((bullet) => (
                        <li key={bullet} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-white/65">
                      {t('sections.match.details.noSummaryBullets', 'Open Full analysis for the complete explanation.')}
                    </p>
                  )}
                </DetailAccordion>

                <div id="match-gaps">
                <DetailAccordion
                  title={t('sections.match.details.gapsEvidence', 'Gaps & evidence')}
                  count={(realityCheck?.confirmedRisks.length ?? 0) + (realityCheck?.unclearRisks.length ?? 0) + (matchAnalysis?.gapAnalysis?.length ?? 0)}
                  icon={<ShieldAlert className="h-4 w-4" />}
                  open={openDetails.gaps}
                  onToggle={() => toggleDetail('gaps')}
                >
                  <div className="space-y-3">
                    {realityCheck && realityVariant && (
                      <section
                        aria-label={t('sections.match.realityCheck.ariaLabel', 'Strategic Reality Check')}
                        role={realityVariant.role}
                        className={cn('rounded-xl border p-4 text-start', realityVariant.container)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold">{t('sections.match.realityCheck.title', 'Strategic Reality Check')}</h4>
                          <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase', realityVariant.badge)}>
                            {t(`sections.match.realityCheck.tiers.${realityCheck.riskTier}`, realityCheck.riskTier)}
                          </span>
                          <span className="rounded-full border border-gray-300/40 bg-white/30 px-2 py-0.5 text-[11px] font-medium dark:border-white/10 dark:bg-white/10">
                            {t('sections.match.realityCheck.confidence', 'Confidence')}: {t(`sections.match.realityCheck.confidenceLevels.${realityCheck.confidence}`, realityCheck.confidence)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed">
                          {realityCheck.summary || t('sections.match.realityCheck.fallbackSummary', 'Review the evidence before optimizing this resume.')}
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {realityCheck.confirmedRisks.map((risk) => (
                            <div key={risk.title} className="rounded-lg bg-white/35 p-3 text-sm dark:bg-black/15">
                              <p className="font-semibold">{risk.title}</p>
                              <p className="mt-1 text-xs opacity-80">{risk.explanation}</p>
                              <p className="mt-2 text-xs font-semibold opacity-90">{risk.mitigation}</p>
                            </div>
                          ))}
                          {realityCheck.unclearRisks.map((risk) => (
                            <div key={risk.topic} className="rounded-lg bg-white/35 p-3 text-sm dark:bg-black/15">
                              <p className="font-semibold">
                                {t('sections.match.realityCheck.unclearLabel', 'Unclear')}: {risk.topic}
                              </p>
                              <p className="mt-1 text-xs opacity-80">{risk.reason}</p>
                              <p className="mt-2 text-xs font-semibold opacity-90">{risk.evidenceNeeded}</p>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {matchAnalysis?.gapAnalysis && matchAnalysis.gapAnalysis.length > 0 && <GapAnalysisCard gaps={matchAnalysis.gapAnalysis} />}
                    {matchAnalysis?.keywordStrategy?.hiddenMatches && matchAnalysis.keywordStrategy.hiddenMatches.length > 0 && <HiddenMatchesCard matches={matchAnalysis.keywordStrategy.hiddenMatches} />}
                    {matchAnalysis?.keywordStrategy && (matchAnalysis.keywordStrategy.mirroredPhrases?.length || matchAnalysis.keywordStrategy.structuralChanges?.length) ? (
                      <MirroredKeywordsCard
                        mirroredPhrases={matchAnalysis.keywordStrategy.mirroredPhrases || []}
                        structuralChanges={matchAnalysis.keywordStrategy.structuralChanges || []}
                      />
                    ) : null}
                  </div>
                </DetailAccordion>
                </div>

                <DetailAccordion
                  title={t('sections.match.details.keywords', 'Keywords')}
                  count={missing.length + found.length}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  open={openDetails.keywords}
                  onToggle={() => toggleDetail('keywords')}
                >
                  <div className="space-y-4">
                    {missing.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase text-rose-600 dark:text-rose-300">
                          {t('sections.match.results.missing', 'Missing Keywords')}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {missing.map((keyword) => (
                            <span key={keyword} className="rounded-lg border border-rose-500/15 bg-rose-500/5 px-3 py-1.5 text-sm text-rose-700 dark:text-rose-300">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {found.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300">
                          {t('sections.match.results.keywords', 'Keywords Found')}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {found.map((keyword) => (
                            <span key={keyword} className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-1.5 text-sm text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="me-1.5 inline h-3 w-3 opacity-70" />
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </DetailAccordion>

                <DetailAccordion
                  title={t('sections.match.details.fullAnalysis', 'Full analysis')}
                  icon={<Sparkles className="h-4 w-4" />}
                  open={openDetails.full}
                  onToggle={() => toggleDetail('full')}
                >
                  <p className="text-sm leading-relaxed text-gray-700 dark:text-white/75">
                    {matchAnalysis?.reasoning || t('sections.match.details.noFullAnalysis', 'No narrative analysis was returned for this saved result.')}
                  </p>
                  <AtsExplainabilityPanel source={explainabilitySource} context="match" className="mt-4" />
                </DetailAccordion>
              </div>
            )}
          </>
        ) : (
          <GlassCard>
            <div className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center animate-fade-in">
              <div className="group relative mb-6">
                <div className="absolute inset-0 rounded-full bg-blue-500/20 opacity-60 blur-3xl" />
                <div className="relative rounded-full border border-gray-200 bg-gray-100 p-6 transition-colors duration-200 group-hover:border-gray-300 dark:border-white/10 dark:bg-white/5 dark:group-hover:border-white/20">
                  <Target className="h-10 w-10 text-gray-400 transition-colors duration-200 group-hover:text-blue-400" />
                </div>
              </div>
              <h4 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
                {t('sections.match.emptyState.title', 'Ready to Analyze')}
              </h4>
              <p className="mx-auto max-w-xs text-sm leading-relaxed text-gray-500">
                {t('sections.match.emptyState', 'Paste a job description to see how well your resume matches the requirements.')}
              </p>
            </div>
          </GlassCard>
        )}
      </div>

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
