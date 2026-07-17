import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { useResumeStore, OptimizationResult } from '../../lib/stores/resumeStore';
import { analytics } from '../../services/analytics';
import { requestValueMomentFeedbackPrompt } from '../Feedback/FeedbackPromptController';
import { useRateLimit } from '../../hooks/useRateLimit';
import { RateLimitBanner } from '../ui/RateLimitBanner';
import {
  Sparkles,
  CheckCircle2,
  Briefcase,
  RotateCcw,
  AlertCircle,
  Share2,
} from 'lucide-react';

const ShareScoreCard = lazy(() => import('../ui/ShareScoreCard'));
import { cn } from '../../lib/utils/cn';
import { analyzeVision2030Alignment } from '../../lib/utils/vision2030Analyzer';
import type { OptimizationMetrics } from '../../types/templates';
import type { GapItem } from '../GapAnalysisCard';
import type { CategoryScoresData } from '../ScoreBreakdown';
import type { HiddenMatch } from '../HiddenMatchesCard';
import { ScoreDiffBreakdown } from '../ScoreDiffBreakdown';
import { AtsExplainabilityPanel } from '../AtsExplainabilityPanel';
import type { AtsExplainabilitySource } from '../../types/explainability';
import { LoadingMessages } from '../LoadingMessages';
import { ConfirmActionModal } from '../Credits/ConfirmActionModal';
import { useUserCredits } from '../../hooks/useUserCredits';
import { getCompatibleStorageItem } from '../../lib/utils/storage-migration';
import { getActionability, isActionable, partitionOptimizations } from '../../lib/optimize/actionability';
import { mergeOptimizedResume } from '../../lib/optimize/mergeResume';
import { buildScorePresentation, classifyVerifiedOutcome, verificationSignature } from '../../lib/optimize/scoreModel';
import type { VerifyAnomalyState } from '../../lib/optimize/scoreModel';
import { ScoreHeader } from './optimize/ScoreHeader';
import { StrategyBlock } from './optimize/StrategyBlock';
import { JobGroupCard, QueueGroup } from './optimize/JobGroupCard';
import type { Work } from '../../types/resume';
import { JobVariantsBar } from './JobVariantsBar';
import { CharacterResultsCompanion } from '@/components/shared/CharacterResultsCompanion';

// Key for job description in localStorage (shared with MatchSection)
const LAST_JOB_KEY = 'watheq:lastJobDescription';

// Default match score when no analysis is available (represents neutral/baseline match)
const DEFAULT_FALLBACK_SCORE = 55;

// Keyword bucket labels are now in i18n: sections.optimize.chipLabels.*

// === Types ===
// Extended interface that supports both legacy format and new OptimizationResult format
interface OptimizationCard {
  // Support both API response format and store format
  section?: string;
  sectionId?: string;
  sectionType?: 'headline' | 'summary' | 'experience' | 'skills' | 'projects' | string;
  label?: string;
  before?: string;
  after?: string;
  original?: string | string[];
  optimized?: string | string[];
  // API response format from backend
  exampleBefore?: string;
  exampleAfter?: string;
  applied?: boolean;
  index?: number;
  timestamp?: string;
}

interface Keywords {
  add: string[];
  remove: string[];
  neutral: string[];
}

interface OptimizeSectionProps {
  isPremium?: boolean;
  optimizations?: OptimizationCard[];
  keywords?: Keywords;
  isOptimizing?: boolean;
  onOptimize?: (mode: any, options?: { freePreview?: boolean }) => Promise<any>;
  onCopy?: (value: any) => Promise<void>;
  previewUsed?: boolean;
  onUpgrade?: () => void;
  hasMatchAnalysis?: boolean;
  onClear?: () => void;
  onExport?: (variant: any, exportMethod?: string) => Promise<void>;
  onContinueToExport?: () => void;
  canExport?: boolean;
  // Optional: can pass resume text directly or use store
  resumeText?: string | null;
  // Pipeline integration
  activeJobApplicationId?: string | null;
  pendingAttachment?: { filePath: string; fileName: string } | null;
  onMarkApplied?: () => void;
  onAttachExport?: () => void;
  hasExportedForActiveJob?: boolean;
  isGuestMode?: boolean;
  onRequireSignIn?: () => void;
  protectedActionMessage?: string;
}

const emptyKeywords = { add: [], remove: [], neutral: [] };
const FREE_OPTIMIZE_STORAGE_KEY = 'watheq:freeOptimizeUsed';

const hasFreePreviewRun = () =>
  typeof window !== 'undefined' && window.localStorage.getItem(FREE_OPTIMIZE_STORAGE_KEY) !== 'true';

const markFreePreviewUsed = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(FREE_OPTIMIZE_STORAGE_KEY, 'true');
  }
};

// Apply position suggestion: update only matching work positions per AI's positionChanges map
const handleApplyPositionSuggestion = (suggested: string) => {
  const state = useResumeStore.getState();
  if (!state.originalResume?.work?.length) return;

  const updated = structuredClone(state.originalResume);
  const positionChanges = state.optimizationMetrics?.positionSuggestion?.positionChanges;

  // Save originals for revert before mutating
  const originalPositions = updated.work!.map((w: { position?: string }) => w.position || '');

  if (positionChanges?.length) {
    // Per-position granular update: only change entries where change_needed=true
    updated.work!.forEach((w: { position?: string }) => {
      const match = positionChanges.find(
        (c) => c.change_needed && c.original.trim().toLowerCase() === (w.position || '').trim().toLowerCase()
      );
      if (match) w.position = match.suggested;
    });
  } else {
    // Fallback: rename all (legacy behaviour for old AI responses)
    updated.work!.forEach((w: { position?: string }) => { w.position = suggested; });
  }

  state.setOriginalResume(updated);

  const currentSuggestion = state.optimizationMetrics?.positionSuggestion;
  if (currentSuggestion) {
    state.setOptimizationMetrics({
      positionSuggestion: { ...currentSuggestion, applied: true, originalPositions },
    });
  }
};

// Revert position suggestion: restore each work[].position from saved array
const handleRevertPositionSuggestion = () => {
  const state = useResumeStore.getState();
  const saved = state.optimizationMetrics?.positionSuggestion?.originalPositions;

  if (state.originalResume?.work?.length && saved?.length) {
    const updated = structuredClone(state.originalResume);
    updated.work!.forEach((w: { position?: string }, i: number) => {
      w.position = saved[i] ?? w.position;
    });
    state.setOriginalResume(updated);
  }

  // Clear applied flag — banner goes back to "apply" state
  const currentSuggestion = state.optimizationMetrics?.positionSuggestion;
  if (currentSuggestion) {
    state.setOptimizationMetrics({
      positionSuggestion: { ...currentSuggestion, applied: false, originalPositions: undefined },
    });
  }
};

const finiteScore = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
};

// Normalize optimization data to handle all API formats:
// - Backend returns: exampleBefore/exampleAfter
// - Legacy format: before/after  
// - Store format: original/optimized
const normalizeOptimization = (opt: OptimizationCard, index: number): OptimizationResult => {
  // Always include index in sectionId to prevent duplicate React keys
  // when multiple optimizations have the same section name (e.g., "Experience")
  const baseSection = opt.sectionType || opt.section || 'general';

  const originalContent = opt.original ?? opt.exampleBefore ?? opt.before ?? '';
  const optimizedContent = opt.optimized ?? opt.exampleAfter ?? opt.after ?? '';

  return {
    sectionId: opt.sectionId || `${baseSection.toLowerCase()} -${index} `,
    sectionType: baseSection.toLowerCase() as OptimizationResult['sectionType'],
    original: originalContent,
    optimized: optimizedContent,
    applied: opt.applied ?? false,
    timestamp: new Date().toISOString(),
  };
};


export function OptimizeSection({
  isPremium = false,
  optimizations: propOptimizations,
  keywords = emptyKeywords,
  isOptimizing: propIsOptimizing = false,
  onOptimize: propOnOptimize,
  onCopy,
  previewUsed = false,
  onUpgrade,
  hasMatchAnalysis: propHasMatchAnalysis = false,
  onClear,
  onExport,
  onContinueToExport,
  canExport = false,
  resumeText: propResumeText,
  activeJobApplicationId,
  pendingAttachment,
  onMarkApplied,
  onAttachExport,
  hasExportedForActiveJob = false,
}: OptimizeSectionProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const { isRateLimited, retryAfter, handleError: handleRateLimitError, clearRateLimit } = useRateLimit();

  // Get data from store
  const {
    originalResume,
    parsedResumeText,
    optimizations: storeOptimizations,
    setOptimizations,
    applyOptimization,
    revertOptimization,
    refineOptimization,
    keywordSuggestions,
    optimizationMetrics,
    setOptimizationMetrics,
    resetOptimizationMetrics,
    getCachedAnalysis,
    setCachedAnalysis,
    baselineMatchScore,
    variantRestoreNonce,
  } = useResumeStore();

  // Use props or store
  const resumeText = propResumeText || parsedResumeText;
  const hasResume = Boolean(originalResume || resumeText);

  const [viewMode, setViewMode] = useState<'split' | 'diff'>('split');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isAutoVerifying, setIsAutoVerifying] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [verifyAnomaly, setVerifyAnomaly] = useState<VerifyAnomalyState | null>(null);
  const [verifyRetryUsed, setVerifyRetryUsed] = useState(false);
  const [positionBannerDismissed, setPositionBannerDismissed] = useState(false);
  const [scoreHeaderExpanded, setScoreHeaderExpanded] = useState(false);
  const [expandedScoreCategories, setExpandedScoreCategories] = useState<Set<keyof CategoryScoresData>>(new Set());
  const [strategyExpanded, setStrategyExpanded] = useState(false);
  const [queueFilter, setQueueFilter] = useState<'all' | 'pending' | 'applied'>('all');
  // Single-bullet correction loop: which card has its refine input open, the
  // instruction text, which card is mid-request, and any per-refine error.
  const [refiningCardId, setRefiningCardId] = useState<string | null>(null);
  const [refineInstruction, setRefineInstruction] = useState('');
  const [refineLoadingId, setRefineLoadingId] = useState<string | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);
  const { credits: _credits, isLoading: creditsLoading, refetch: refetchCredits } = useUserCredits();

  // Sync prop optimizations to store when they change
  // IMPORTANT: Merge with existing store state to preserve applied flags
  useEffect(() => {
    if (propOptimizations && propOptimizations.length > 0) {
      const existingOptimizations = storeOptimizations;

      const normalized = propOptimizations.map((opt, index) => {
        const normalizedOpt = normalizeOptimization(opt, index);

        // Check if this optimization already exists in store
        const existingOpt = existingOptimizations.find(
          (e) => e.sectionId === normalizedOpt.sectionId ||
            (e.sectionType === normalizedOpt.sectionType &&
              e.original === normalizedOpt.original)
        );

        // Preserve applied state if exists
        if (existingOpt) {
          return {
            ...normalizedOpt,
            applied: existingOpt.applied,
          };
        }

        return normalizedOpt;
      });

      // Only update if there are actual differences to avoid infinite loops
      const hasChanges = normalized.some((opt, i) => {
        const existing = existingOptimizations[i];
        if (!existing) return true;
        return opt.sectionId !== existing.sectionId ||
          opt.original !== existing.original ||
          opt.optimized !== existing.optimized;
      }) || normalized.length !== existingOptimizations.length;

      if (hasChanges) {
        setOptimizations(normalized);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propOptimizations]); // setOptimizations and storeOptimizations intentionally excluded to prevent infinite loop

  // Always use store optimizations (props are synced to store via useEffect above)
  const optimizations = storeOptimizations;
  const isOptimizing = propIsOptimizing || isGenerating;

  // Generate sessionId if we have optimizations but no sessionId yet
  // This ensures feedback buttons appear for optimizations loaded from storage
  useEffect(() => {
    if (optimizations.length > 0 && !sessionId) {
      setSessionId(crypto.randomUUID());
    }
  }, [optimizations.length, sessionId]);

  // When a saved job variant is REOPENED (store bumps variantRestoreNonce), drop
  // per-run ephemeral UI state so the reopened variant shows its own snapshot —
  // not the previous run's feedback session or anomaly banner. The verified
  // potential itself lives in optimizationMetrics.verifiedPotential, which the
  // variant snapshot carries, so nothing score-related needs resetting here.
  useEffect(() => {
    setVerifyAnomaly(null);
    setSessionId(null);
    setError(null);
  }, [variantRestoreNonce]);

  // Rerun Vision 2030 analysis on mount if optimizations exist but vision2030 data is missing
  // This happens when the user refreshes the page and optimizationMetrics is restored but vision2030 was calculated client-side
  useEffect(() => {
    if (optimizations.length > 0 && !optimizationMetrics.vision2030 && (resumeText || originalResume)) {
      const textToAnalyze = resumeText || JSON.stringify(originalResume);
      if (textToAnalyze) {
        const vision2030Analysis = analyzeVision2030Alignment(textToAnalyze, isArabic ? 'ar' : 'en');

        const primarySectorData = vision2030Analysis.sectorBreakdown.find(s => s.matchedCount > 0);
        const primarySector = primarySectorData ? {
          id: primarySectorData.sectorId,
          nameEn: primarySectorData.sectorNameEn,
          nameAr: primarySectorData.sectorNameAr,
          icon: primarySectorData.icon,
        } : null;

        const secondarySectors = vision2030Analysis.sectorBreakdown
          .filter(s => s.matchedCount > 0 && s.sectorId !== primarySectorData?.sectorId)
          .slice(0, 2)
          .map(s => ({
            id: s.sectorId,
            nameEn: s.sectorNameEn,
            nameAr: s.sectorNameAr,
            icon: s.icon,
          }));

        const detectedCareer = vision2030Analysis.detectedCareer ? {
          nameEn: vision2030Analysis.detectedCareer.archetypeNameEn,
          nameAr: vision2030Analysis.detectedCareer.archetypeNameAr,
        } : null;

        setOptimizationMetrics({
          vision2030: {
            overallScore: vision2030Analysis.overallScore,
            primarySector,
            secondarySectors,
            matchedSkillsCount: vision2030Analysis.matchedSkills.length,
            topMatchedSkills: vision2030Analysis.matchedSkills.slice(0, 5).map(s => s.skillNameEn),
            detectedCareer,
          },
        });
      }
    }
  }, [optimizations.length, optimizationMetrics.vision2030, resumeText, originalResume, isArabic, setOptimizationMetrics]);

  // Restore beforeScore from cache on mount if optimizations exist but score is missing
  // This happens when page loads with persisted optimizations but beforeScore wasn't saved
  useEffect(() => {
    if (optimizations.length > 0 && !optimizationMetrics.beforeScore && resumeText) {
      const jobDescription = typeof window !== 'undefined'
        ? getCompatibleStorageItem(LAST_JOB_KEY) || ''
        : '';

      if (jobDescription) {
        // CRITICAL: Get original (non-optimized) score for beforeScore
        // Cast to any to work around Zustand type inference limitation
        const cachedAnalysis = (getCachedAnalysis as any)(resumeText, jobDescription, false);
        const cachedScore = finiteScore(cachedAnalysis?.score);
        if (cachedScore !== null) {
          setOptimizationMetrics({
            beforeScore: cachedScore,
            hasJobDescription: true,
          });
        }
      }
    }
  }, [optimizations.length, optimizationMetrics.beforeScore, resumeText, getCachedAnalysis, setOptimizationMetrics]);


  // Memoize keyword buckets - use store or props
  const keywordBuckets = useMemo(() => {
    // If store has keyword suggestions, transform them
    if (keywordSuggestions.length > 0) {
      const buckets: { add: string[]; neutral: string[]; remove: string[] } = { add: [], neutral: [], remove: [] };
      for (const k of keywordSuggestions) {
        if (k.category === 'add') buckets.add.push(k.keyword);
        else if (k.category === 'keep') buckets.neutral.push(k.keyword);
        else if (k.category === 'deemphasize') buckets.remove.push(k.keyword);
      }
      return buckets;
    }
    return {
      add: keywords?.add ?? [],
      remove: keywords?.remove ?? [],
      neutral: keywords?.neutral ?? [],
    };
  }, [keywords, keywordSuggestions]);

  // Calculate results summary data using API-provided metrics
  const resultsSummaryData = useMemo(() => {
    // Group by section
    const bySection = optimizations.reduce((acc, opt) => {
      const section = opt.sectionType || 'general';
      if (!acc[section]) {
        acc[section] = { section, count: 0, applied: 0 };
      }
      acc[section].count++;
      if (opt.applied) acc[section].applied++;
      return acc;
    }, {} as Record<string, { section: string; count: number; applied: number }>);

    // Get the job description from localStorage (same as MatchSection)
    const jobDescription = typeof window !== 'undefined'
      ? getCompatibleStorageItem(LAST_JOB_KEY) || ''
      : '';

    // Try to get the cached match analysis score first (this is the 78% from Match section)
    // CRITICAL: Always get the ORIGINAL (non-optimized) score for "before" comparison
    // Pass false to override showOptimized state and get the original cached score
    // Cast to any to work around Zustand type inference limitation
    const cachedAnalysis = resumeText && jobDescription
      ? (getCachedAnalysis as any)(resumeText, jobDescription, false)
      : null;

    // Priority: 1. Baseline score (true original), 2. Store metrics, 3. Current cache, 4. Resume meta, 5. Default fallback
    // Baseline score is the source of truth - it's stored on first analysis and never changes unless user uploads a new resume
    const beforeScore = finiteScore(baselineMatchScore) ??
      finiteScore(optimizationMetrics.beforeScore) ??
      finiteScore(cachedAnalysis?.score) ??
      finiteScore((originalResume?.meta as Record<string, unknown> | undefined)?.match_score) ??
      DEFAULT_FALLBACK_SCORE;

    // Track if we're using placeholder/fallback values (Bug Fix: Make fake scores obvious)
    const isPlaceholderScore = finiteScore(baselineMatchScore) === null &&
      finiteScore(cachedAnalysis?.score) === null &&
      finiteScore(optimizationMetrics.beforeScore) === null &&
      finiteScore((originalResume?.meta as Record<string, unknown> | undefined)?.match_score) === null;

    // One explicit score model for every consumer (ScoreHeader, ScoreDiffBreakdown,
    // companion, share card): baseline / applied-only projection / potential
    // estimate / verified all-actionable potential, with display states A-E.
    // The projection numerator and denominator count ACTIONABLE cards only.
    const presentation = buildScorePresentation({
      optimizations,
      baselineScore: isPlaceholderScore ? null : beforeScore,
      improvement: optimizationMetrics.improvement ?? null,
      verifiedPotential: optimizationMetrics.verifiedPotential,
      resumeText: resumeText ?? '',
      jobDescription,
    });

    return {
      beforeScore,
      presentation,
      optimizationsBySection: Object.values(bySection),
      keywordsAdded: keywordBuckets.add,
      keywordsFromJD: optimizationMetrics.jdKeywords,
      matchedKeywords: optimizationMetrics.matchedKeywords,
      reasoning: optimizationMetrics.reasoning,
      // Check if job description exists from API or localStorage
      hasJobDescription: optimizationMetrics.hasJobDescription || Boolean(jobDescription.trim()),
      vision2030: optimizationMetrics.vision2030,
      // Bug Fix: Expose placeholder status to UI
      isPlaceholderScore,
    };
  }, [optimizations, keywordBuckets, optimizationMetrics, originalResume, resumeText, getCachedAnalysis, baselineMatchScore]);

  const presentation = resultsSummaryData.presentation;

  // The companion represents the ACTUAL current resume: baseline when nothing is
  // applied, the applied-only projection as the user works through cards. The
  // verified all-suggestions potential is never fed as the current score.
  const companionBeforeScore = presentation.isPlaceholderScore ? null : presentation.baselineScore;
  const companionAfterScore = presentation.currentAppliedProjection ?? companionBeforeScore;

  const verifyOptimizedResume = async (jobDescription: string, beforeScore: number, options?: { freePreview?: boolean }) => {
    if (!jobDescription.trim()) return;

    try {
      setIsAutoVerifying(true);
      setVerifyAnomaly(null);

      // Pure simulation: build the hypothetical "all ACTIONABLE suggestions
      // applied" resume without touching store state — recommendation-only cards
      // (skills/certifications) never participate, and because nothing is mutated
      // there is no applied-state or showOptimized restore dance afterwards.
      const storeState = useResumeStore.getState();
      const { actionable } = partitionOptimizations(storeState.optimizations);
      if (!storeState.originalResume || actionable.length === 0) return;

      const hypothetical = storeState.optimizations.map((o) => ({ ...o, applied: isActionable(o) }));
      const { resume: optimizedResume, diagnostics } = mergeOptimizedResume(
        storeState.originalResume,
        hypothetical,
        { isSaudiNational: storeState.isSaudiNational },
      );
      const { resume: baselineResume } = mergeOptimizedResume(
        storeState.originalResume,
        [],
        { isSaudiNational: storeState.isSaudiNational },
      );

      const { analyzeResumeWithAI } = await import('../../services/api');
      const { formatResumeToText } = await import('../../lib/utils/resumeUtils');
      // Give AI a realistic plain text string (what ATS sees) instead of structured JSON
      // to prevent artificially inflated scores.
      const optimizedText = formatResumeToText(optimizedResume);
      const baselineText = formatResumeToText(baselineResume);
      const sourceTextLength = (resumeText || JSON.stringify(originalResume ?? '')).length;
      const minimumLength = Math.max(200, sourceTextLength * 0.5);

      if (optimizedText.length < minimumLength) {
        console.warn(`[OptimizeSection] verify skipped: optimized text too short (${optimizedText.length} chars)`);
        setVerifyAnomaly({ kind: 'too_short', rawScore: null, textLength: optimizedText.length });
        return;
      }

      // Material-difference guard: if applying every actionable suggestion does not
      // change the formatted text, the suggestions failed to merge — scoring the
      // identical text would fabricate a "verified no-change". That is an
      // implementation failure to surface, never a role-fit conclusion.
      const normalizeWs = (text: string) => text.replace(/\s+/g, ' ').trim();
      if (normalizeWs(optimizedText) === normalizeWs(baselineText)) {
        console.warn(`[OptimizeSection] verify skipped: optimized text identical to baseline (${diagnostics.failedCount} merge failures)`);
        setVerifyAnomaly({
          kind: 'no_text_change',
          rawScore: null,
          textLength: optimizedText.length,
          mergeFailedCount: diagnostics.failedCount,
        });
        return;
      }

      const result = await analyzeResumeWithAI(optimizedText, jobDescription, i18n.language, {
        mode: 'verify',
        ...(options?.freePreview ? { freePreview: true } : {}),
      });

      const verifiedResultScore = finiteScore(result?.score);
      if (verifiedResultScore !== null) {
        if (verifiedResultScore < beforeScore - 25) {
          console.warn(`[OptimizeSection] verify anomaly: raw score ${result?.score}, optimized text length ${optimizedText.length}`);
          setVerifyAnomaly({ kind: 'anomalous_drop', rawScore: verifiedResultScore, textLength: optimizedText.length });
          return;
        }

        // The verified score is the ALL-ACTIONABLE-SUGGESTIONS potential — a
        // target, never the current resume's score. It lives in its own field so
        // it can never overwrite the generation-time improvement estimate, and its
        // signature drops it automatically if the card set / resume / JD change.
        setOptimizationMetrics({
          verifiedPotential: {
            score: verifiedResultScore,
            baselineAtVerify: beforeScore,
            signature: verificationSignature(actionable, resumeText ?? '', jobDescription),
            verifiedAt: Date.now(),
            outcome: classifyVerifiedOutcome(verifiedResultScore, beforeScore),
          },
        });
        // Cache the verified score under the optimized key (forceIsOptimized: true)
        setCachedAnalysis(optimizedText, jobDescription, {
          score: verifiedResultScore,
          matchedKeywords: result.topHits || [],
          missingKeywords: result.missingKeywords || [],
        }, true);
      }
    } catch (verifyErr) {
      // Auto-verify is non-fatal - optimization still succeeds
      console.warn('[OptimizeSection] Auto-verify failed (non-fatal):', verifyErr);
      setVerifyAnomaly({ kind: 'error', rawScore: null, textLength: 0 });
    } finally {
      setIsAutoVerifying(false);
    }
  };

  const retryVerifyOptimizedResume = async () => {
    if (verifyRetryUsed) return;
    const jobDescription = typeof window !== 'undefined'
      ? getCompatibleStorageItem(LAST_JOB_KEY) || ''
      : '';
    setVerifyRetryUsed(true);
    await verifyOptimizedResume(jobDescription, resultsSummaryData.beforeScore);
  };

  // Explainability source for the Optimize tab — rebuilt from the ORIGINAL
  // cached match analysis (survives refresh) plus optimize-side gaps. No fetch,
  // no scoring; everything here already exists in the store.
  const optimizeExplainabilitySource: AtsExplainabilitySource = useMemo(() => {
    const jobDescription = typeof window !== 'undefined'
      ? getCompatibleStorageItem(LAST_JOB_KEY) || ''
      : '';
    const cached = resumeText && jobDescription
      ? getCachedAnalysis(resumeText, jobDescription, false)
      : null;
    return {
      matchedKeywords: cached?.matchedKeywords ?? optimizationMetrics.matchedKeywords ?? [],
      missingKeywords: cached?.missingKeywords ?? [],
      categoryScores: (cached?.categoryScores ?? optimizationMetrics.categoryScores ?? null) as AtsExplainabilitySource['categoryScores'],
      realityCheck: cached?.strategicRealityCheck ?? null,
      gapAnalysis: optimizationMetrics.gapAnalysis ?? [],
    };
  }, [resumeText, getCachedAnalysis, optimizationMetrics]);

  // Generate optimizations from API
  const handleGenerateActual = async (options?: { freePreview?: boolean }) => {
    // If parent provided handler, use that
    if (propOnOptimize) {
      const result = await propOnOptimize('auto', options);
      if (options?.freePreview) markFreePreviewUsed();
      return result;
    }

    if (!resumeText && !originalResume) {
      setError(t('sections.optimize.runMatchFirst', 'Please upload a resume first'));
      return;
    }

    const startTime = performance.now();

    // Track optimization started
    analytics.trackOptimization('started', { has_job_description: false });

    setIsGenerating(true);
    setError(null);
    setVerifyAnomaly(null);
    setVerifyRetryUsed(false);

    // Generate a session ID for feedback tracking
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);

    try {
      // Get authenticated headers (includes Authorization Bearer token)
      const { getAuthHeaders } = await import('../../lib/auth/authHeaders');
      const headers = await getAuthHeaders();

      const response = await fetch('/.netlify/functions/optimize', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          resumeText: resumeText || JSON.stringify(originalResume),
          // Get job description from localStorage (shared with MatchSection)
          jobText: typeof window !== 'undefined'
            ? getCompatibleStorageItem(LAST_JOB_KEY) || ''
            : '',
          language: i18n.language,
          ...(options?.freePreview ? { freePreview: true } : {}),
        }),
      });

      // Handle insufficient credits (403)
      if (response.status === 403) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('credits.confirm.insufficient', 'Insufficient credits'));
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('toasts.optimizationFailed', 'Optimization failed'));
      }

      const data = await response.json();

      // Transform API response to OptimizationResult format
      // API returns: { cards: [{section, issue, suggestion, exampleBefore, exampleAfter}], keywords: {add, neutral, remove} }
      const newOptimizations: OptimizationResult[] = [];

      if (data.cards && Array.isArray(data.cards)) {
        data.cards.forEach((card: { section?: string; exampleBefore?: string; exampleAfter?: string; issue?: string; suggestion?: string }, index: number) => {
          const sectionType = (card.section || 'general').toLowerCase() as 'headline' | 'summary' | 'experience' | 'skills' | 'projects';

          const originalContent = card.exampleBefore || '';
          const optimizedContent = card.exampleAfter || '';

          newOptimizations.push({
            sectionId: `${sectionType}-${index}`,
            sectionType: sectionType,
            original: originalContent,
            optimized: optimizedContent,
            applied: false,
          });
        });
      }

      // Map project_improvements from API to optimization cards
      if (data.projectImprovements && Array.isArray(data.projectImprovements)) {
        data.projectImprovements.forEach((proj: { project_name?: string; original?: string; improved?: string; issue?: string; rationale?: string }, index: number) => {
          newOptimizations.push({
            sectionId: `projects-${index}`,
            sectionType: 'projects',
            original: proj.original || '',
            optimized: proj.improved || '',
            applied: false,
          });
        });
      }

      // Map certification_recommendations as display-only cards (not applied to template)
      if (data.certificationRecommendations && Array.isArray(data.certificationRecommendations)) {
        data.certificationRecommendations.forEach((cert: { name?: string; issuer?: string; relevance?: string }, index: number) => {
          newOptimizations.push({
            sectionId: `certifications-${index}`,
            sectionType: 'certifications',
            // Show recommendation as "optimized" (right side) with empty original (left side)
            original: t('optimization.recommendation', 'Recommended Certification'),
            optimized: `${cert.name || ''} (${cert.issuer || ''}) - ${cert.relevance || ''}`,
            applied: false, // Certifications are display-only, never applied
          });
        });
      }


      // If no cards but we have API data, try legacy format
      if (newOptimizations.length === 0) {
        if (data.headline) {
          newOptimizations.push({
            sectionId: 'headline',
            sectionType: 'headline',
            original: originalResume?.basics?.label || t('sections.optimize.noOriginal', 'No headline'),
            optimized: data.headline,
            applied: false,
          });
        }

        if (data.summary) {
          newOptimizations.push({
            sectionId: 'summary',
            sectionType: 'summary',
            original: originalResume?.basics?.summary || t('sections.optimize.noOriginal', 'No summary'),
            optimized: data.summary,
            applied: false,
          });
        }
      }

      // Validate that we have meaningful optimizations
      if (newOptimizations.length === 0) {
        throw new Error(t('optimization.noSuggestions', 'No optimizations were generated. The AI may need more context.'));
      }

      // Check if any optimizations have valid content
      const hasValidContent = newOptimizations.some(opt => {
        const original = Array.isArray(opt.original) ? opt.original.join('') : opt.original;
        const optimized = Array.isArray(opt.optimized) ? opt.optimized.join('') : opt.optimized;
        return (original && original.trim().length > 0) || (optimized && optimized.trim().length > 0);
      });

      if (!hasValidContent) {
        throw new Error(t('optimization.noSuggestions', 'The AI returned empty suggestions. Please try again.'));
      }

      setOptimizations(newOptimizations);

      // Track optimization completed
      analytics.trackOptimization('completed', {
        optimization_count: newOptimizations.length,
        time_ms: performance.now() - startTime,
      });
      requestValueMomentFeedbackPrompt('optimize_success');

      // Also update keyword suggestions from API response
      if (data.keywords) {
        const suggestions: { keyword: string; category: 'add' | 'keep' | 'deemphasize' }[] = [];

        if (data.keywords.add) {
          data.keywords.add.forEach((kw: string) => suggestions.push({ keyword: kw, category: 'add' }));
        }
        if (data.keywords.neutral) {
          data.keywords.neutral.forEach((kw: string) => suggestions.push({ keyword: kw, category: 'keep' }));
        }
        if (data.keywords.remove) {
          data.keywords.remove.forEach((kw: string) => suggestions.push({ keyword: kw, category: 'deemphasize' }));
        }

        // Update store with keyword suggestions
        useResumeStore.getState().setKeywordSuggestions(suggestions);
      }

      // Initialize accumulator for consolidated update. A new generation run
      // invalidates any previous verified potential explicitly (the signature
      // check would drop it anyway once the card set changes).
      const metricsToUpdate: Partial<OptimizationMetrics> = { verifiedPotential: null };

      // Check if match analysis already provided an authoritative baseline score.
      // The optimize API independently re-calculates match_score which can differ
      // significantly from the match analysis (e.g., 77% vs 15%).
      const existingBaseline = useResumeStore.getState().baselineMatchScore;

      // Capture match scoring data for Results Summary
      if (data.matchScoring) {
        // Only use optimize API's beforeScore as FALLBACK
        if (existingBaseline === null) {
          metricsToUpdate.beforeScore = data.matchScoring.beforeScore;
        }
        // Use estimatedImprovement from backend (no fake afterScore)
        metricsToUpdate.improvement = data.matchScoring.estimatedImprovement ?? data.matchScoring.improvement ?? null;
        metricsToUpdate.afterScore = data.matchScoring.afterScore ?? null;
        metricsToUpdate.jdKeywords = data.matchScoring.jdKeywords || [];
        metricsToUpdate.matchedKeywords = data.matchScoring.matchedKeywords || [];
        metricsToUpdate.reasoning = data.matchScoring.reasoning;
        metricsToUpdate.hasJobDescription = data.debug?.hasJobDescription || false;
      } else {
        // Fallback: Use cached match analysis score if available
        const jobDesc = typeof window !== 'undefined' ? getCompatibleStorageItem(LAST_JOB_KEY) || '' : '';
        const cachedAnalysis = resumeText && jobDesc ? getCachedAnalysis(resumeText, jobDesc) : null;
        const cachedScore = finiteScore(cachedAnalysis?.score);
        if (cachedScore !== null) {
          metricsToUpdate.beforeScore = cachedScore;
          metricsToUpdate.hasJobDescription = true;
        }
        // Fix A: Set improvement to 0 so ScoreBreakdown doesn't show "—"
        // Auto-verify will replace this with the genuine value shortly
        metricsToUpdate.improvement = 0;
      }

      // Capture gap analysis from API response
      if (data.gapAnalysis && Array.isArray(data.gapAnalysis)) {
        metricsToUpdate.gapAnalysis = data.gapAnalysis;
      }

      // Capture keyword strategy from API response
      if (data.keywordStrategy) {
        metricsToUpdate.keywordStrategy = data.keywordStrategy;
      }

      // Capture score breakdown from API response
      if (data.scoreBreakdown) {
        metricsToUpdate.scoreBreakdown = data.scoreBreakdown;
      }

      // Capture category scores from API response — only as fallback
      // When a match analysis has already run, its category scores (displayed in
      // MatchSection) are authoritative. The optimize API's scores come from a
      // different AI call and can diverge significantly.
      if (data.categoryScores && existingBaseline === null) {
        metricsToUpdate.categoryScores = data.categoryScores;
      }

      // Capture position name suggestion from AI (only when is_necessary=true)
      if (data.positionSuggestion?.is_necessary === true) {
        metricsToUpdate.positionSuggestion = data.positionSuggestion;
      } else {
        // Clear any stale suggestion from a previous run
        metricsToUpdate.positionSuggestion = null;
      }

      // Run Vision 2030 analysis on resume text
      const textToAnalyze = resumeText || JSON.stringify(originalResume);
      if (textToAnalyze) {
        const vision2030Analysis = analyzeVision2030Alignment(
          textToAnalyze,
          isArabic ? 'ar' : 'en'
        );

        // Get primary sector info
        const primarySectorData = vision2030Analysis.sectorBreakdown.find(
          s => s.matchedCount > 0
        );
        const primarySector = primarySectorData ? {
          id: primarySectorData.sectorId,
          nameEn: primarySectorData.sectorNameEn,
          nameAr: primarySectorData.sectorNameAr,
          icon: primarySectorData.icon,
        } : null;

        // Get secondary sectors (next 2 with matches)
        const secondarySectors = vision2030Analysis.sectorBreakdown
          .filter(s => s.matchedCount > 0 && s.sectorId !== primarySectorData?.sectorId)
          .slice(0, 2)
          .map(s => ({
            id: s.sectorId,
            nameEn: s.sectorNameEn,
            nameAr: s.sectorNameAr,
            icon: s.icon,
          }));

        // Get detected career
        const detectedCareer = vision2030Analysis.detectedCareer ? {
          nameEn: vision2030Analysis.detectedCareer.archetypeNameEn,
          nameAr: vision2030Analysis.detectedCareer.archetypeNameAr,
        } : null;

        metricsToUpdate.vision2030 = {
          overallScore: vision2030Analysis.overallScore,
          primarySector,
          secondarySectors,
          matchedSkillsCount: vision2030Analysis.matchedSkills.length,
          topMatchedSkills: vision2030Analysis.matchedSkills.slice(0, 6).map(s => s.skillNameEn),
          detectedCareer,
        };
      }

      // Update the store with all accumulated metrics at once
      if (Object.keys(metricsToUpdate).length > 0) {
        setOptimizationMetrics(metricsToUpdate);

        // Update the cache with the new match score if available
        // This ensures subsequent renders use the fresh score instead of stale cache
        if (finiteScore(metricsToUpdate.beforeScore) !== null && resumeText && (metricsToUpdate.hasJobDescription)) {
          const jobDesc = typeof window !== 'undefined' ? getCompatibleStorageItem(LAST_JOB_KEY) || '' : '';
          if (jobDesc) {
            const matchedKeywordSet = new Set(metricsToUpdate.matchedKeywords || []);
            useResumeStore.getState().setCachedAnalysis(resumeText, jobDesc, {
              score: metricsToUpdate.beforeScore,
              matchedKeywords: metricsToUpdate.matchedKeywords || [],
              missingKeywords: metricsToUpdate.jdKeywords?.filter((k: string) => !matchedKeywordSet.has(k)) || []
            });
          }
        }
      }

      // Auto-verify: Run AI re-analysis on the optimized resume (non-fatal)
      const jobDescription = typeof window !== 'undefined'
        ? getCompatibleStorageItem(LAST_JOB_KEY) || ''
        : '';

      if (jobDescription.trim()) {
        const beforeScore = existingBaseline ?? metricsToUpdate.beforeScore ?? resultsSummaryData.beforeScore;
        await verifyOptimizedResume(jobDescription, beforeScore, options);
      }

    } catch (err) {
      console.error('Optimization error:', err);
      let errorCategory = 'unknown';
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('rate limit') || msg.includes('too many requests')) errorCategory = 'rate_limit';
      else if (msg.includes('timeout') || msg.includes('timed out')) errorCategory = 'timeout';
      else if (msg.includes('network') || msg.includes('fetch')) errorCategory = 'network';
      else if (msg.includes('insufficient') || msg.includes('credits')) errorCategory = 'validation';
      else if (msg.includes('AI') || msg.includes('model')) errorCategory = 'ai_error';
      analytics.trackOptimizationFailed(errorCategory);

      // Check if this is a rate limit error
      if (!handleRateLimitError(err)) {
        setError(err instanceof Error ? err.message : t('toasts.optimizationFailed', 'Failed to generate optimizations'));
      }
    } finally {
      setIsGenerating(false);
      // Refresh credits after consumption
      setTimeout(() => refetchCredits(), 500);
      if (options?.freePreview) markFreePreviewUsed();
    }
  };

  // Wrapper function that shows confirmation modal first
  const handleGenerate = () => {
    if (hasFreePreviewRun()) {
      void handleGenerateActual({ freePreview: true });
      return;
    }

    // Wait for credits to load before showing modal
    if (creditsLoading) {
      return;
    }
    setShowConfirmModal(true);
  };

  // Handler for confirmed optimization action
  const handleConfirmOptimize = async () => {
    setShowConfirmModal(false);
    await handleGenerateActual();
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      setOptimizations([]);
    }
    setPositionBannerDismissed(false);
    // Also reset all optimization metrics to clear stale data (this includes the
    // verified potential, which lives in optimizationMetrics.verifiedPotential).
    resetOptimizationMetrics();
    setVerifyAnomaly(null);
    setSessionId(null);
  };

  // Sections whose cards map to real, editable resume text (skills are
  // recommendation-only and certifications are display-only, so they cannot be refined).
  const REFINABLE_SECTIONS = new Set(['summary', 'headline', 'experience', 'projects', 'education']);

  const handleRefineBullet = async (opt: OptimizationResult) => {
    const instruction = refineInstruction.trim();
    if (!instruction) return;

    const resumeForGrounding = resumeText || (originalResume ? JSON.stringify(originalResume) : '');
    if (!resumeForGrounding) {
      setRefineError(t('sections.optimize.refine.noResume', 'Resume text is unavailable to ground the refinement.'));
      return;
    }

    setRefineLoadingId(opt.sectionId);
    setRefineError(null);
    try {
      const { refineBullet } = await import('../../services/api');
      const jobContext = typeof window !== 'undefined'
        ? getCompatibleStorageItem(LAST_JOB_KEY) || ''
        : '';

      const result = await refineBullet({
        original: Array.isArray(opt.original) ? opt.original.join('\n') : opt.original,
        currentImproved: Array.isArray(opt.optimized) ? opt.optimized.join('\n') : opt.optimized,
        userInstruction: instruction,
        jobContext,
        resumeText: resumeForGrounding,
        language: i18n.language,
      });

      refineOptimization(opt.sectionId, { ...result, instruction });
      analytics.track('bullet_refined', { section_type: opt.sectionType });
      setRefiningCardId(null);
      setRefineInstruction('');
    } catch (err) {
      console.error('[RefineBullet] Refine failed:', err);
      setRefineError(err instanceof Error ? err.message : t('sections.optimize.refine.failed', 'Failed to refine bullet. Please try again.'));
    } finally {
      setRefineLoadingId(null);
    }
  };

  const toggleCard = (sectionId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const toggleScoreCategory = (category: keyof CategoryScoresData) => {
    setExpandedScoreCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const queueGroups = useMemo<QueueGroup[]>(() => {
    const workEntries = (originalResume?.work ?? []) as Work[];
    const groups = new Map<string, QueueGroup & { order: number }>();
    const orderByType: Record<string, number> = {
      headline: 0,
      summary: 1,
      experience: 2,
      skills: 1000,
      certifications: 1001,
      projects: 1002,
      education: 1003,
      general: 1004,
    };
    let unmatchedExperienceIndex = 0;

    const getText = (value: string | string[] | undefined) => Array.isArray(value) ? value.join('\n') : value ?? '';
    const findWorkIndex = (opt: OptimizationResult) => {
      const originalText = getText(opt.original).toLowerCase();
      if (!originalText) return -1;

      return workEntries.findIndex((work) => {
        const fields = [
          work.position,
          work.name,
          work.summary,
          ...(work.highlights ?? []),
        ].filter(Boolean);

        return fields.some((field) => {
          const normalized = field.toLowerCase();
          return normalized.includes(originalText) || originalText.includes(normalized);
        });
      });
    };

    const workTitle = (work: Work | undefined, fallbackIndex: number) => {
      if (!work) return t('sections.optimize.queue.experienceFallback', { defaultValue: 'Experience {{number}}', number: fallbackIndex + 1 });
      const dateRange = [work.startDate, work.endDate].filter(Boolean).join(' - ');
      const parts = [work.position, work.name, dateRange].filter(Boolean);
      return parts.length > 0
        ? parts.join(' · ')
        : t('sections.optimize.queue.experienceFallback', { defaultValue: 'Experience {{number}}', number: fallbackIndex + 1 });
    };

    optimizations.forEach((opt) => {
      const sectionType = opt.sectionType || 'general';
      const kind: QueueGroup['kind'] = getActionability(sectionType) === 'recommendation' ? 'recommendation' : 'actionable';
      let groupId = `section-${sectionType}`;
      let title = t(`sections.optimize.tabs.${sectionType}`, sectionType);
      let subtitle: string | undefined;
      let order = orderByType[sectionType] ?? orderByType.general;

      if (sectionType === 'experience') {
        const matchedIndex = findWorkIndex(opt);
        const fallbackIndex = matchedIndex >= 0 ? matchedIndex : unmatchedExperienceIndex++;
        const work = matchedIndex >= 0 ? workEntries[matchedIndex] : undefined;
        groupId = `work-${fallbackIndex}`;
        title = workTitle(work, fallbackIndex);
        subtitle = t('sections.optimize.queue.workSubtitle', 'Work experience');
        order = orderByType.experience + (fallbackIndex / 100);
      }

      if (sectionType === 'skills') {
        title = t('sections.optimize.queue.recommendedSkills', 'Recommended skills');
        subtitle = t('sections.optimize.queue.skillsHonesty', 'Add only skills you genuinely have.');
      }
      if (sectionType === 'certifications') {
        title = t('sections.optimize.queue.recommendedCertifications', 'Recommended certifications');
        subtitle = t('sections.optimize.queue.certificationsHonesty', 'Advice to consider — your existing certificates are never changed.');
      }

      if (!groups.has(groupId)) {
        groups.set(groupId, {
          id: groupId,
          title,
          subtitle,
          type: sectionType as QueueGroup['type'],
          kind,
          items: [],
          order,
        });
      }

      groups.get(groupId)?.items.push(opt);
    });

    return Array.from(groups.values())
      .sort((a, b) => a.order - b.order)
      .map(({ order: _order, ...group }) => group);
  }, [optimizations, originalResume?.work, t]);

  const filteredQueueGroups = queueGroups.reduce<QueueGroup[]>((acc, group) => {
    // Pending/Applied are implementation-progress filters — recommendation-only
    // groups have no applied state, so they appear under "All" only.
    if (queueFilter !== 'all' && group.kind === 'recommendation') return acc;
    const items = group.items.filter((item) => {
      if (queueFilter === 'pending') return !item.applied;
      if (queueFilter === 'applied') return item.applied;
      return true;
    });
    if (items.length > 0) acc.push({ ...group, items });
    return acc;
  }, []);

  const visibleQueueOptimizations = filteredQueueGroups.flatMap((group) => group.items);
  const hasOptimizationResults = optimizations.length > 0;
  const hasKeywordData = keywordBuckets.add.length + keywordBuckets.neutral.length + keywordBuckets.remove.length > 0;
  const queueFilters = [
    { id: 'all', label: t('sections.optimize.queue.filters.all', 'All') },
    { id: 'pending', label: t('sections.optimize.queue.filters.pending', 'Pending') },
    { id: 'applied', label: t('sections.optimize.queue.filters.applied', 'Applied') },
  ] as const;
  const categoryScores = optimizationMetrics.categoryScores as unknown as CategoryScoresData | undefined;
  const hiddenMatches = (optimizationMetrics.keywordStrategy?.hiddenMatches as HiddenMatch[] | undefined) || [];
  const mirroredPhrases = (optimizationMetrics.keywordStrategy?.mirroredPhrases as string[] | undefined) || [];
  const structuralChanges = (optimizationMetrics.keywordStrategy?.structuralChanges as string[] | undefined) || [];

  const handleApplyOptimization = (opt: OptimizationResult) => {
    analytics.trackOptimization('applied', { section_type: opt.sectionType });
    applyOptimization(opt.sectionId);
  };

  const handleApplyQueueGroup = (ids: string[]) => {
    ids.forEach((sectionId) => applyOptimization(sectionId));
  };

  const handleToggleCompare = (sectionId: string) => {
    setCompareMode(compareMode === sectionId ? null : sectionId);
  };

  const handleStartRefine = (sectionId: string) => {
    setRefineError(null);
    setRefineInstruction('');
    setRefiningCardId(refiningCardId === sectionId ? null : sectionId);
  };

  const handleContinue = () => {
    if (onContinueToExport) {
      onContinueToExport();
      return;
    }

    if (onExport) {
      void onExport('optimized');
    }
  };

  // State D CTA: focus the user on the existing Match gaps / Strategic Reality
  // Check. Uses the established cross-section navigation event (MainContent
  // listens for watheq:navigate-tab); MatchSection reads the anchor on arrival.
  const handleReviewMatchGaps = () => {
    try {
      sessionStorage.setItem('watheq:pendingMatchAnchor', 'gaps');
    } catch { /* storage unavailable — navigation alone still helps */ }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('watheq:navigate-tab', { detail: { tab: 'match' } }));
    }
  };

  // Share card: only for genuinely communicable gains — the verified score when
  // every actionable suggestion is applied (C_ALL), else the applied-only
  // projection. Hypothetical unapplied potentials are never shared as results.
  const shareAfterScore = presentation.displayState === 'C_ALL'
    ? presentation.verifiedAllSuggestionsScore
    : presentation.currentAppliedProjection;
  const shareDelta = shareAfterScore !== null && presentation.baselineScore !== null
    ? shareAfterScore - presentation.baselineScore
    : 0;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <GlassCard className="overflow-hidden relative">
        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 mb-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="shrink-0 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-900/5">
              <Sparkles className="w-6 h-6 text-emerald-700 dark:text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                {t('sections.optimize.title', 'Optimize Resume')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('sections.optimize.subtitle', 'AI-powered suggestions to improve your resume score')}
              </p>
            </div>
          </div>
          <div className="flex w-full md:w-auto flex-wrap items-center justify-start md:justify-end gap-3">
            {optimizations.length > 0 && (
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                {t('common.clear', 'Clear')}
              </GlassButton>
            )}
          </div>
        </div >

        {/* Error Message */}
        {
          error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-6 backdrop-blur-sm">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-sm font-medium text-red-400">{error}</p>
            </div>
          )
        }

        {/* No Resume Warning */}
        {
          !hasResume && (
            <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6 backdrop-blur-sm">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-sm font-medium text-amber-400">
                {t('sections.optimize.uploadFirst', 'Please upload a resume first')}
              </p>
            </div>
          )
        }

        {/* Optimize Button */}
        {!hasOptimizationResults && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isOptimizing || !hasResume}
            className={cn(
              "w-full relative group overflow-hidden rounded-xl p-[1px] transition-all duration-300 transform active:scale-[0.99]",
              (!hasResume || isOptimizing) ? "opacity-70 cursor-not-allowed" : "hover:shadow-lg hover:shadow-purple-500/20"
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-700 opacity-100 group-hover:opacity-100 animate-gradient-xy transition-opacity" />
            <div className="relative bg-[color:var(--surface-glass-elevated)] backdrop-blur-xl rounded-xl px-6 py-4 flex items-center justify-center gap-3 transition-colors group-hover:bg-[color:var(--surface-glass-strong)] dark:bg-gray-900/90 dark:group-hover:bg-gray-900/80">
              {isOptimizing ? (
                <>
                  <div className="w-5 h-5 border-2 border-gray-400/30 border-t-gray-900 dark:border-white/30 dark:border-t-white rounded-full animate-spin" />
                  <span className="text-gray-900 dark:text-white font-semibold tracking-wide">
                    {t('sections.optimize.optimizingResume', 'Optimizing Resume...')}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-emerald-700 group-hover:text-emerald-800 dark:text-emerald-300 dark:group-hover:text-white transition-colors" />
                  <span className="text-gray-900 dark:text-white font-bold tracking-wide">
                    {hasResume
                      ? (
                        <>
                          {t('sections.optimize.optimizeBtn', 'Optimize Resume with AI')}
                          {!hasFreePreviewRun() && (
                            <span className="ml-2 text-xs opacity-75">(5 {t('common.credits', 'credits')})</span>
                          )}
                        </>
                      )
                      : t('sections.optimize.runMatchFirst', 'Upload Resume First')
                    }
                  </span>
                </>
              )}
            </div>
          </button>
        )}
        {hasResume && !hasOptimizationResults && (
          <p className="mt-3 text-xs text-center text-gray-500 dark:text-gray-400">
            {t('trust.askBeforeRewrite', 'When proof may be missing, Watheq can ask clarifying questions before rewriting.')}
            {' '}
            {t('trust.reviewBeforeExport', 'Review every suggestion before export.')}
          </p>
        )}
      </GlassCard >

      {/* Save or reopen this optimization run for a specific job. */}
      <JobVariantsBar />

      {optimizations.length > 0 && (
        <ScoreHeader
          presentation={presentation}
          isAutoVerifying={isAutoVerifying}
          verifyAnomaly={verifyAnomaly}
          verifyRetryUsed={verifyRetryUsed}
          categoryScores={categoryScores}
          expanded={scoreHeaderExpanded}
          expandedCategories={expandedScoreCategories}
          isArabic={isArabic}
          isOptimizing={isOptimizing}
          canExport={canExport}
          onToggleExpanded={() => setScoreHeaderExpanded((value) => !value)}
          onToggleCategory={toggleScoreCategory}
          onRetryVerify={retryVerifyOptimizedResume}
          onRerun={() => void handleGenerateActual()}
          onContinue={handleContinue}
          onReviewMatchGaps={handleReviewMatchGaps}
        />
      )}

      {optimizations.length > 0 && (
        <CharacterResultsCompanion
          variant="optimize"
          beforeScore={companionBeforeScore}
          afterScore={companionAfterScore}
        />
      )}

      {optimizations.length > 0 && (
        <ScoreDiffBreakdown
          presentation={presentation}
          improvement={optimizationMetrics.improvement ?? null}
          optimizations={optimizations}
        />
      )}

      {optimizations.length > 0 && shareDelta > 10 && shareAfterScore !== null && (
        <div className="flex justify-end">
          <GlassButton
            variant="secondary"
            size="sm"
            onClick={() => {
              analytics.track('share_card_opened', {
                before_score: resultsSummaryData.beforeScore,
                after_score: shareAfterScore,
                improvement: shareDelta,
              });
              setShowShareCard(true);
            }}
            leftIcon={<Share2 className="w-3.5 h-3.5" />}
          >
            {t('sections.optimize.shareResult', 'Share Your Result')}
          </GlassButton>
        </div>
      )}

      {/* Share Score Card Modal */}
      {showShareCard && shareAfterScore !== null && (
        <Suspense fallback={null}>
          <ShareScoreCard
            beforeScore={resultsSummaryData.beforeScore}
            afterScore={shareAfterScore}
            onClose={() => setShowShareCard(false)}
          />
        </Suspense>
      )}

      {optimizations.length > 0 && (
        <StrategyBlock
          expanded={strategyExpanded}
          hasKeywordData={hasKeywordData}
          keywordBuckets={keywordBuckets}
          gapAnalysis={Array.isArray(optimizationMetrics.gapAnalysis) ? optimizationMetrics.gapAnalysis as GapItem[] : null}
          hiddenMatches={hiddenMatches}
          mirroredPhrases={mirroredPhrases}
          structuralChanges={structuralChanges}
          positionSuggestion={optimizationMetrics.positionSuggestion ?? null}
          positionBannerDismissed={positionBannerDismissed}
          isArabic={isArabic}
          onToggle={() => setStrategyExpanded((value) => !value)}
          onApplyPositionSuggestion={handleApplyPositionSuggestion}
          onRevertPositionSuggestion={handleRevertPositionSuggestion}
          onDismissPositionSuggestion={() => setPositionBannerDismissed(true)}
        />
      )}

      {/* Pipeline attachment and mark-applied CTAs */}
      {activeJobApplicationId && pendingAttachment && (
        <GlassCard padding="md" className="mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Briefcase className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {t('pipeline.attachExport', 'Attach this resume to saved job?')}
              </p>
              <p className="text-xs text-gray-500">{pendingAttachment.fileName}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <GlassButton variant="secondary" size="sm" onClick={onAttachExport}>
                {t('pipeline.attachExportBtn', 'Attach Resume')}
              </GlassButton>
              <GlassButton variant="ghost" size="sm" onClick={onMarkApplied}>
                {t('pipeline.markAsApplied', 'Mark as Applied')}
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      )}

      {activeJobApplicationId && hasExportedForActiveJob && !pendingAttachment && (
        <GlassCard padding="md" className="mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {t('pipeline.markAppliedQuestion', 'Did you apply with this version?')}
              </p>
            </div>
            <GlassButton variant="secondary" size="sm" onClick={onMarkApplied}>
              {t('pipeline.markAsApplied', 'Mark as Applied')}
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {/* ATS Explainability — why this score, mapped to real resume/JD text */}
      {optimizations.length > 0 && (
        <AtsExplainabilityPanel
          source={optimizeExplainabilitySource}
          context="optimize"
          className="mb-2"
        />
      )}
      {/* Optimization Cards Section */}
      <div className="relative space-y-4">
        {visibleQueueOptimizations.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] p-1 dark:border-white/10 dark:bg-black/20">
              {queueFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setQueueFilter(filter.id)}
                  className={cn(
                    'min-h-11 rounded-lg px-4 text-sm font-medium transition-colors whitespace-nowrap',
                    queueFilter === filter.id
                      ? 'bg-[color:var(--surface-glass-elevated)] text-gray-900 shadow-sm dark:bg-white/10 dark:text-white'
                      : 'text-gray-500 hover:bg-[color:var(--surface-control-hover)] hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white'
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <div className="flex items-center rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] p-1 dark:border-white/10 dark:bg-black/20">
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  aria-pressed={viewMode === 'split'}
                  className={cn(
                    'min-h-9 rounded-lg px-3 text-xs font-medium transition-colors',
                    viewMode === 'split'
                      ? 'bg-[color:var(--surface-glass-elevated)] text-gray-900 shadow-sm dark:bg-white/10 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  {t('sections.optimize.sideBySide', 'Split')}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('diff')}
                  aria-pressed={viewMode === 'diff'}
                  className={cn(
                    'min-h-9 rounded-lg px-3 text-xs font-medium transition-colors',
                    viewMode === 'diff'
                      ? 'bg-[color:var(--surface-glass-elevated)] text-gray-900 shadow-sm dark:bg-white/10 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  {t('sections.optimize.inlineDiff', 'Diff')}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const visibleIds = visibleQueueOptimizations.map(o => o.sectionId);
                  const allExpanded = visibleIds.every(id => expandedCards.has(id));
                  setExpandedCards(prev => {
                    const next = new Set(prev);
                    visibleIds.forEach(id => {
                      if (allExpanded) {
                        next.delete(id);
                      } else {
                        next.add(id);
                      }
                    });
                    return next;
                  });
                }}
                className="min-h-11 rounded-lg border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] px-3 text-xs font-medium text-gray-500 transition-colors hover:bg-[color:var(--surface-control-hover)] hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
              >
                {visibleQueueOptimizations.every(o => expandedCards.has(o.sectionId))
                  ? t('sections.optimize.collapseAll', 'Collapse All')
                  : t('sections.optimize.expandAll', 'Expand All')
                }
              </button>
            </div>
          </div>
        )}

        {filteredQueueGroups.length > 0 ? (
          <div className="grid gap-4">
            {filteredQueueGroups.map((group) => (
              <JobGroupCard
                key={group.id}
                group={group}
                viewMode={viewMode}
                expandedCards={expandedCards}
                compareMode={compareMode}
                refiningCardId={refiningCardId}
                refineInstruction={refineInstruction}
                refineLoadingId={refineLoadingId}
                refineError={refineError}
                refinableSections={REFINABLE_SECTIONS}
                isArabic={isArabic}
                onToggleCard={toggleCard}
                onToggleCompare={handleToggleCompare}
                onApply={handleApplyOptimization}
                onRevert={revertOptimization}
                onApplyGroup={handleApplyQueueGroup}
                onCopy={onCopy}
                onStartRefine={handleStartRefine}
                onRefineInstructionChange={setRefineInstruction}
                onSubmitRefine={handleRefineBullet}
              />
            ))}
          </div>
        ) : (
          <GlassCard padding="lg" className="border-dashed border-[color:var(--glass-border-strong)] dark:border-white/10">
            <div className="text-center text-gray-500 py-8">
              <div className="w-16 h-16 rounded-full bg-[color:var(--surface-control)] dark:bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-gray-600" />
              </div>
              <h4 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                {t('sections.optimize.emptyTitle', 'Ready to Optimize?')}
              </h4>
              <p className="max-w-md mx-auto text-sm opacity-60">
                {t('sections.optimize.emptyState', 'Run an analysis to generate AI-powered optimization cards for your resume.')}
              </p>
            </div>
          </GlassCard>
        )}
      </div>

      {/* Rate Limit Banner */}
      {
        isRateLimited && (
          <RateLimitBanner
            retryAfter={retryAfter}
            onRetry={() => {
              clearRateLimit();
              handleGenerate();
            }}
            onDismiss={clearRateLimit}
          />
        )
      }

      {/* Optimization Loading Toast - Non-blocking */}
      {
        isOptimizing && createPortal(
          <div className="fixed inset-x-3 bottom-4 sm:inset-x-auto sm:right-6 sm:bottom-6 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-200 ease-out pointer-events-auto">
            <LoadingMessages type="optimize" estimatedTime={25000} className="max-w-full sm:max-w-sm" />
          </div>,
          document.body
        )
      }

      {/* Credit Confirmation Modal */}
      <ConfirmActionModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmOptimize}
        feature="optimize"
        isLoading={isOptimizing}
      />
    </div >
  );
}

export default OptimizeSection;
