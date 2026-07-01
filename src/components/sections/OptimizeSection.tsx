import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { useResumeStore, OptimizationResult } from '../../lib/stores/resumeStore';
import { analytics } from '../../services/analytics';
import { useRateLimit } from '../../hooks/useRateLimit';
import { RateLimitBanner } from '../ui/RateLimitBanner';
import {
  Sparkles,
  Copy,
  ChevronDown,
  Check,
  CheckCircle2,
  Briefcase,
  RotateCcw,
  ArrowLeftRight,
  AlertCircle,
  Info,
  TrendingUp,
  Share2,
  Wand2,
  Send,
  Lightbulb,
} from 'lucide-react';

const ShareScoreCard = lazy(() => import('../ui/ShareScoreCard'));
import { cn } from '../../lib/utils/cn';
import { analyzeVision2030Alignment } from '../../lib/utils/vision2030Analyzer';
import type { OptimizationMetrics } from '../../types/templates';
import { GapAnalysisCard, GapItem } from '../GapAnalysisCard';
import { ScoreBreakdown, ScoreBreakdownData, CategoryScoresData } from '../ScoreBreakdown';
import { HiddenMatchesCard, HiddenMatch } from '../HiddenMatchesCard';
import { MirroredKeywordsCard } from '../MirroredKeywordsCard';
import { LoadingMessages } from '../LoadingMessages';
import { ConfirmActionModal } from '../Credits/ConfirmActionModal';
import { PositionSuggestionBanner } from '../PositionSuggestionBanner';
import { useUserCredits } from '../../hooks/useUserCredits';
import { getCompatibleStorageItem } from '../../lib/utils/storage-migration';

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
    applyAllOptimizations,
    revertAllOptimizations,
    keywordSuggestions,
    optimizationMetrics,
    setOptimizationMetrics,
    resetOptimizationMetrics,
    getCachedAnalysis,
    setCachedAnalysis,
    baselineMatchScore,
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
  const [verifiedScore, setVerifiedScore] = useState<number | null>(null);
  const [positionBannerDismissed, setPositionBannerDismissed] = useState(false);
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
        if (cachedAnalysis?.score) {
          setOptimizationMetrics({
            beforeScore: cachedAnalysis.score,
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
      return {
        add: keywordSuggestions.filter(k => k.category === 'add').map(k => k.keyword),
        neutral: keywordSuggestions.filter(k => k.category === 'keep').map(k => k.keyword),
        remove: keywordSuggestions.filter(k => k.category === 'deemphasize').map(k => k.keyword),
      };
    }
    return {
      add: keywords?.add ?? [],
      remove: keywords?.remove ?? [],
      neutral: keywords?.neutral ?? [],
    };
  }, [keywords, keywordSuggestions]);

  // Calculate results summary data using API-provided metrics
  const resultsSummaryData = useMemo(() => {
    const appliedCount = optimizations.filter(o => o.applied).length;

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
    const beforeScore = baselineMatchScore ??
      optimizationMetrics.beforeScore ??
      cachedAnalysis?.score ??
      ((originalResume?.meta as Record<string, unknown> | undefined)?.match_score as number) ??
      DEFAULT_FALLBACK_SCORE;

    // Track if we're using placeholder/fallback values (Bug Fix: Make fake scores obvious)
    const isPlaceholderScore = !cachedAnalysis?.score &&
      !optimizationMetrics.beforeScore &&
      !((originalResume?.meta as Record<string, unknown> | undefined)?.match_score);
    // FIX: Use explicit null check, not truthy check, because improvement can be 0 (valid value)
    const isPlaceholderImprovement = optimizationMetrics.improvement === null || optimizationMetrics.improvement === undefined;

    // Calculate projected after score based on applied optimizations
    // This is an ESTIMATE only - use "Verify Match Score" for genuine re-analysis
    const appliedRatio = optimizations.length > 0
      ? appliedCount / optimizations.length
      : 0;

    const maxImprovement = optimizationMetrics.improvement ?? 15;
    const actualImprovement = Math.round(maxImprovement * appliedRatio);
    const afterScore = beforeScore + actualImprovement;

    // Potential score uses the estimated improvement (no artificial cap)
    const potentialAfterScore = beforeScore + (optimizationMetrics.improvement ?? maxImprovement);

    // Use verified score if available, otherwise show projected estimate
    const isScoreVerified = verifiedScore !== null || (optimizationMetrics.afterScore !== null && optimizationMetrics.afterScore !== undefined);
    const displayAfterScore = isScoreVerified
      ? (verifiedScore ?? optimizationMetrics.afterScore ?? afterScore)
      : afterScore;

    return {
      beforeScore,
      afterScore: displayAfterScore,
      potentialScore: potentialAfterScore,
      totalOptimizations: optimizations.length,
      appliedOptimizations: appliedCount,
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
      isPlaceholderImprovement,
      // Verified vs projected
      isScoreVerified,
    };
  }, [optimizations, keywordBuckets, optimizationMetrics, originalResume, resumeText, getCachedAnalysis, baselineMatchScore, verifiedScore]);

  const hasFreePreviewRun = () =>
    typeof window !== 'undefined' && window.localStorage.getItem(FREE_OPTIMIZE_STORAGE_KEY) !== 'true';

  const markFreePreviewUsed = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(FREE_OPTIMIZE_STORAGE_KEY, 'true');
    }
  };

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

      // Initialize accumulator for consolidated update
      const metricsToUpdate: Partial<OptimizationMetrics> = {};

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
        if (cachedAnalysis?.score) {
          metricsToUpdate.beforeScore = cachedAnalysis.score;
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
        if (metricsToUpdate.beforeScore && resumeText && (metricsToUpdate.hasJobDescription)) {
          const jobDesc = typeof window !== 'undefined' ? getCompatibleStorageItem(LAST_JOB_KEY) || '' : '';
          if (jobDesc) {
            useResumeStore.getState().setCachedAnalysis(resumeText, jobDesc, {
              score: metricsToUpdate.beforeScore,
              matchedKeywords: metricsToUpdate.matchedKeywords || [],
              missingKeywords: metricsToUpdate.jdKeywords?.filter((k: string) => !metricsToUpdate.matchedKeywords?.includes(k)) || []
            });
          }
        }
      }

      // Auto-verify: Run AI re-analysis on the optimized resume (non-fatal)
      const jobDescription = typeof window !== 'undefined'
        ? getCompatibleStorageItem(LAST_JOB_KEY) || ''
        : '';

      if (jobDescription.trim()) {
        try {
          setIsAutoVerifying(true);

          // Fix B3: Save each optimization's applied state before blanket apply/revert
          const storeState = useResumeStore.getState();
          const savedAppliedStates = storeState.optimizations.map(o => ({ sectionId: o.sectionId, applied: o.applied }));
          storeState.applyAllOptimizations();
          const optimizedResume = storeState.getActiveResume();
          // Restore original applied states instead of blanket revert
          savedAppliedStates.forEach(({ sectionId, applied }) => {
            if (applied) {
              storeState.applyOptimization(sectionId);
            } else {
              storeState.revertOptimization(sectionId);
            }
          });

          if (optimizedResume) {
            const { analyzeResumeWithAI } = await import('../../services/api');
            const { formatResumeToText } = await import('../../lib/utils/resumeUtils');
            // Give AI a realistic plain text string (what ATS sees) instead of structured JSON 
            // to prevent artificially inflated scores.
            const optimizedText = formatResumeToText(optimizedResume);
            const result = await analyzeResumeWithAI(optimizedText, jobDescription);

            if (result?.score) {
              const beforeScore = existingBaseline ?? metricsToUpdate.beforeScore ?? resultsSummaryData.beforeScore;
              setVerifiedScore(result.score);
              // Update metrics with genuine verified scores
              setOptimizationMetrics({
                afterScore: result.score,
                improvement: result.score - beforeScore,
              });
              // Cache the verified score under the optimized key (forceIsOptimized: true)
              setCachedAnalysis(optimizedText, jobDescription, {
                score: result.score,
                matchedKeywords: result.topHits || [],
                missingKeywords: result.missingKeywords || [],
              }, true);
            }
          }
        } catch (verifyErr) {
          // Auto-verify is non-fatal - optimization still succeeds
          console.warn('[OptimizeSection] Auto-verify failed (non-fatal):', verifyErr);
        } finally {
          setIsAutoVerifying(false);
        }
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

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      setOptimizations([]);
    }
    setPositionBannerDismissed(false);
    // Also reset all optimization metrics to clear stale data
    resetOptimizationMetrics();
    setVerifiedScore(null);
    setSessionId(null);
  };

  // Sections whose cards map to real, editable resume text (skills are
  // recommendation-only and certifications are display-only, so they cannot be refined).
  const REFINABLE_SECTIONS = ['summary', 'headline', 'experience', 'projects', 'education'];

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

  // Get applied count
  const appliedCount = optimizations.filter(o => o.applied).length;

  // Section tabs for filtering
  const tabs = [
    { id: 'all', label: t('sections.optimize.tabs.all', 'All Sections') },
    { id: 'headline', label: t('sections.optimize.tabs.headline', 'Headline') },
    { id: 'summary', label: t('sections.optimize.tabs.summary', 'Summary') },
    { id: 'experience', label: t('sections.optimize.tabs.experience', 'Experience') },
    { id: 'skills', label: t('sections.optimize.tabs.skills', 'Skills') },
    { id: 'projects', label: t('sections.optimize.tabs.projects', 'Projects') },
    { id: 'certifications', label: t('sections.optimize.tabs.certifications', 'Certifications') },
  ];

  const [activeSection, setActiveSection] = useState<'all' | 'headline' | 'summary' | 'experience' | 'skills' | 'projects' | 'certifications'>('all');

  // Filter optimizations by section
  const filteredOptimizations = activeSection === 'all'
    ? optimizations
    : optimizations.filter(o => o.sectionType === activeSection);
  const hasOptimizationResults = optimizations.length > 0;
  const hasKeywordData = keywordBuckets.add.length + keywordBuckets.neutral.length + keywordBuckets.remove.length > 0;

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
            {/* Applied Counter */}
            {optimizations.length > 0 && (
              <div className="flex items-center gap-3 bg-[color:var(--surface-control)] dark:bg-white/5 rounded-xl p-1.5 pr-3 border border-[color:var(--glass-border)] dark:border-white/5">
                <div className="px-3 py-1.5 rounded-lg bg-[color:var(--surface-control-hover)] dark:bg-black/20 border border-[color:var(--glass-border)] dark:border-white/5">
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    {appliedCount} <span className="text-gray-500">/ {optimizations.length}</span>
                  </span>
                </div>

                {appliedCount > 0 && (
                  <button
                    onClick={revertAllOptimizations}
                    className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-2"
                  >
                    {t('optimization.revert', 'Revert')}
                  </button>
                )}

                <div className="w-px h-4 bg-gray-300 dark:bg-white/10 mx-1" />

                <button
                  onClick={applyAllOptimizations}
                  disabled={appliedCount === optimizations.length}
                  className={cn(
                    "text-xs font-bold transition-colors px-2",
                    appliedCount === optimizations.length
                      ? "text-gray-500 cursor-not-allowed"
                      : "text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300"
                  )}
                >
                  {t('optimization.applyAll', 'Apply All')}
                </button>
              </div>
            )}

            {/* View Mode Toggle */}
          {hasOptimizationResults && (
          <div className="flex items-center bg-[color:var(--surface-control)] dark:bg-black/20 rounded-xl p-1 border border-[color:var(--glass-border)] dark:border-white/5">
              <button
                onClick={() => setViewMode('split')}
                aria-pressed={viewMode === 'split'}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-300',
                  viewMode === 'split'
                    ? 'bg-[color:var(--surface-glass-elevated)] dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                {t('sections.optimize.sideBySide', 'Split')}
              </button>
              <button
                onClick={() => setViewMode('diff')}
                aria-pressed={viewMode === 'diff'}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-300',
                  viewMode === 'diff'
                    ? 'bg-[color:var(--surface-glass-elevated)] dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                {t('sections.optimize.inlineDiff', 'Diff')}
              </button>
            </div>
          )}

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

        {/* Section Tabs */}
        {hasOptimizationResults && (
        <div className="flex overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 mb-6">
          <div className="flex items-center gap-2 p-1 bg-[color:var(--surface-control)] dark:bg-black/20 rounded-xl border border-[color:var(--glass-border)] dark:border-white/5">
            {tabs.map((tab) => {
              const isActive = activeSection === tab.id;
              const hasItems = tab.id === 'all'
                ? optimizations.length > 0
                : optimizations.some(o => o.sectionType === tab.id);

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id as typeof activeSection)}
                  className={cn(
                    'relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 whitespace-nowrap',
                    isActive
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-[color:var(--surface-control-hover)] dark:hover:bg-white/5',
                    !hasItems && !isActive && 'opacity-50'
                  )}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-[color:var(--surface-glass-elevated)] dark:bg-white/10 rounded-lg shadow-sm border border-[color:var(--glass-border)] dark:border-white/5" />
                  )}
                  <span className="relative z-10">
                    {tab.label}
                    {tab.id !== 'all' && hasItems && (
                      <span className="ml-2 text-xs opacity-60 bg-[color:var(--surface-control-hover)] dark:bg-white/10 px-1.5 py-0.5 rounded-full">
                        {optimizations.filter(o => o.sectionType === tab.id).length}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        )}

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
        <button
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
        {hasResume && (
          <p className="mt-3 text-xs text-center text-gray-500 dark:text-gray-400">
            {t('trust.askBeforeRewrite', 'When proof may be missing, Watheq can ask clarifying questions before rewriting.')}
            {' '}
            {t('trust.reviewBeforeExport', 'Review every suggestion before export.')}
          </p>
        )}
      </GlassCard >

      {/* Keyword Focus Section - Manual Buckets */}
      {hasKeywordData && (
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            {t('sections.optimize.keywordFocus', 'Keyword Strategy')}
          </h3>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {(['add', 'neutral', 'remove'] as const).map((bucket) => {
            const items = keywordBuckets[bucket] ?? [];
            const config = {
              add: { label: 'Add to Resume', color: 'emerald', icon: Check },
              neutral: { label: 'Keep as is', color: 'blue', icon: Info },
              remove: { label: 'Consider Removing', color: 'rose', icon: AlertCircle },
            }[bucket];

            const Icon = config.icon;

            return (
              <div key={bucket} className="space-y-3 p-4 rounded-xl bg-[color:var(--surface-control)] dark:bg-black/40 border border-[color:var(--glass-border)] dark:border-white/5 hover:border-[color:var(--glass-border-strong)] dark:hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between">
                  <p className={`text-xs font-bold uppercase tracking-wider text-${config.color}-600 dark:text-${config.color}-400 flex items-center gap-2`}>
                    <Icon className="w-3.5 h-3.5" />
                    {t(`sections.optimize.chipLabels.${bucket}`)}
                  </p>
                  <span className="text-[10px] font-medium text-gray-500 bg-[color:var(--surface-control-hover)] dark:bg-black/20 px-2 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {items.length > 0 ? (
                    items.map((token) => (
                      <span
                        key={token}
                        title={token}
                        className={cn(
                          'px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all truncate max-w-[140px]',
                          bucket === 'add' && 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20',
                          bucket === 'neutral' && 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-500/20',
                          bucket === 'remove' && 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20 line-through decoration-rose-500/50'
                        )}
                      >
                        {token}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-600 italic py-1">
                      {t('sections.optimize.noKeywords', 'No keywords identified')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard >
      )}

      {/* Score Summary — Prominent Top Card */}
      {optimizations.length > 0 && (
        <GlassCard className="mb-2">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1">
                {t('sections.optimize.currentScore', 'Current Score')}
              </span>
              <span className={`text-3xl font-bold tabular-nums ${resultsSummaryData.isPlaceholderScore ? 'text-gray-600 italic' : 'text-gray-900 dark:text-white'}`}>
                {resultsSummaryData.isPlaceholderScore ? '—' : `${resultsSummaryData.beforeScore}%`}
              </span>
            </div>

            {/* Improvement Arrow */}
            <div className="flex flex-col items-center px-4">
              {!resultsSummaryData.isPlaceholderImprovement && !resultsSummaryData.isPlaceholderScore ? (
                <>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-400">
                      +{resultsSummaryData.afterScore - resultsSummaryData.beforeScore}%
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center border border-gray-300/50 dark:border-white/10">
                  <span className="text-gray-600 text-lg">→</span>
                </div>
              )}
            </div>

            {/* After Score */}
            <div className="flex flex-col items-center flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1">
                {t('sections.optimize.optimizedScore', 'Optimized Score')}
              </span>
              <span className={`text-3xl font-bold tabular-nums ${resultsSummaryData.isPlaceholderScore || resultsSummaryData.isPlaceholderImprovement
                ? 'text-gray-600 italic'
                : 'bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent'
                }`}>
                {resultsSummaryData.isPlaceholderScore || resultsSummaryData.isPlaceholderImprovement
                  ? '—'
                  : `${resultsSummaryData.afterScore}%`}
              </span>
            </div>
          </div>

          {/* Share button — only for meaningful improvements with real scores */}
          {!resultsSummaryData.isPlaceholderScore &&
            !resultsSummaryData.isPlaceholderImprovement &&
            resultsSummaryData.afterScore - resultsSummaryData.beforeScore > 10 && (
              <div className="flex justify-center mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
                <GlassButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    analytics.track('share_card_opened', {
                      before_score: resultsSummaryData.beforeScore,
                      after_score: resultsSummaryData.afterScore,
                      improvement: resultsSummaryData.afterScore - resultsSummaryData.beforeScore,
                    });
                    setShowShareCard(true);
                  }}
                  leftIcon={<Share2 className="w-3.5 h-3.5" />}
                >
                  {t('sections.optimize.shareResult', 'Share Your Result')}
                </GlassButton>
              </div>
            )}
      </GlassCard>
      )}

      {/* Share Score Card Modal */}
      {showShareCard && (
        <Suspense fallback={null}>
          <ShareScoreCard
            beforeScore={resultsSummaryData.beforeScore}
            afterScore={resultsSummaryData.afterScore}
            onClose={() => setShowShareCard(false)}
          />
        </Suspense>
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

      {
        optimizations.length > 0 && (
          <ScoreBreakdown
            data={optimizationMetrics.scoreBreakdown as ScoreBreakdownData | null}
            categoryScores={optimizationMetrics.categoryScores as unknown as CategoryScoresData | undefined}
            beforeScore={resultsSummaryData.beforeScore}
            afterScore={resultsSummaryData.afterScore}
            isPlaceholderScore={resultsSummaryData.isPlaceholderScore}
            isPlaceholderImprovement={resultsSummaryData.isPlaceholderImprovement}
            className="mb-2"
          />
        )
      }

      {/* Position Name Suggestion Banner */}
      {optimizations.length > 0 &&
        (optimizationMetrics.positionSuggestion?.is_necessary === true ||
          optimizationMetrics.positionSuggestion?.applied === true) &&
        !positionBannerDismissed && (
          <PositionSuggestionBanner
            suggestion={optimizationMetrics.positionSuggestion!}
            onApply={handleApplyPositionSuggestion}
            onRevert={handleRevertPositionSuggestion}
            onDismiss={() => setPositionBannerDismissed(true)}
            className="mb-2"
          />
        )}

      {/* Auto-Verify Loading Indicator */}
      {isAutoVerifying && (
        <GlassCard padding="md" className="mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {t('sections.optimize.autoVerifying', 'Auto-verifying match score...')}
              </p>
              <p className="text-xs text-gray-500">
                {t('sections.optimize.autoVerifyingDesc', 'Running AI re-analysis on your optimized resume')}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Gap Analysis */}
      {
        optimizations.length > 0 && (
          optimizationMetrics.gapAnalysis &&
            Array.isArray(optimizationMetrics.gapAnalysis) &&
            optimizationMetrics.gapAnalysis.length > 0 ? (
            <GapAnalysisCard
              gaps={optimizationMetrics.gapAnalysis as GapItem[]}
              className="mb-2"
            />
          ) : (
            <GlassCard padding="md" className="mb-2">
              <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Check className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {t('sections.optimize.noGapsDetected', 'No Critical Gaps Detected')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isArabic
                      ? 'سيرتك الذاتية تتوافق جيدًا مع المتطلبات الأساسية. استمر في إضافة الكلمات المفتاحية المقترحة.'
                      : 'Your resume aligns well with core requirements. Consider adding the suggested keywords above.'}
                  </p>
                </div>
              </div>
            </GlassCard>
          )
        )
      }

      {/* Hidden Matches */}
      {
        optimizationMetrics.keywordStrategy?.hiddenMatches &&
        (optimizationMetrics.keywordStrategy.hiddenMatches as HiddenMatch[]).length > 0 && (
          <HiddenMatchesCard
            matches={optimizationMetrics.keywordStrategy.hiddenMatches as HiddenMatch[]}
            className="mb-2"
          />
        )
      }

      {/* Mirrored Keywords */}
      {
        optimizationMetrics.keywordStrategy && (
          <MirroredKeywordsCard
            mirroredPhrases={(optimizationMetrics.keywordStrategy.mirroredPhrases as string[]) || []}
            structuralChanges={(optimizationMetrics.keywordStrategy.structuralChanges as string[]) || []}
            className="mb-2"
          />
        )
      }

      {/* Optimization Cards Section */}
      <div className="relative space-y-4">

        {filteredOptimizations.length > 0 && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() => {
                const filteredIds = filteredOptimizations.map(o => o.sectionId);
                // Check if all filtered items are expanded
                const allExpanded = filteredIds.every(id => expandedCards.has(id));

                if (allExpanded) {
                  // Collapse all filtered items
                  setExpandedCards(prev => {
                    const next = new Set(prev);
                    filteredIds.forEach(id => next.delete(id));
                    return next;
                  });
                } else {
                  // Expand all filtered items
                  setExpandedCards(prev => {
                    const next = new Set(prev);
                    filteredIds.forEach(id => next.add(id));
                    return next;
                  });
                }
              }}
              className="text-[10px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 px-2 py-1 rounded-md border border-gray-300/50 dark:border-white/5"
            >
              {filteredOptimizations.every(o => expandedCards.has(o.sectionId))
                ? t('sections.optimize.collapseAll', 'Collapse All')
                : t('sections.optimize.expandAll', 'Expand All')
              }
            </button>
          </div>
        )}

        {filteredOptimizations.length > 0 ? (
          <div className="grid gap-4">
            {filteredOptimizations.map((opt, index) => (
              <GlassCard
                key={opt.sectionId}
                padding="none"
                className={cn(
                  'overflow-hidden transition-all duration-300 border',
                  opt.applied
                    ? 'border-emerald-500/30 ring-1 ring-emerald-500/20'
                    : 'border-[color:var(--glass-border)] dark:border-white/5 hover:border-[color:var(--glass-border-strong)] dark:hover:border-white/10'
                )}
              >
                {/* Card Header - Always Visible */}
                <div
                  className={cn(
                    "p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-[color:var(--surface-control-hover)] dark:hover:bg-white/5 transition-colors",
                    expandedCards.has(opt.sectionId) && "bg-[color:var(--surface-control)] dark:bg-white/5 border-b border-[color:var(--glass-border)] dark:border-white/5"
                  )}
                  onClick={() => toggleCard(opt.sectionId)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "p-2 rounded-lg border shrink-0",
                      opt.applied
                        ? "bg-emerald-500/10 border-emerald-500/20"
                        : "bg-emerald-500/10 border-emerald-500/20"
                    )}>
                      {opt.applied
                        ? <Check className="w-4 h-4 text-emerald-400" />
                        : <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-300" />
                      }
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 dark:text-white capitalize truncate">
                          {opt.sectionType === 'experience'
                            ? (function () {
                              // Calculate index specifically among experience items
                              const expIndex = filteredOptimizations
                                .filter(o => o.sectionType === 'experience')
                                .findIndex(o => o.sectionId === opt.sectionId);
                              return `${t('sections.optimize.tabs.experience', 'Experience')} ${expIndex !== -1 ? expIndex + 1 : ''}`;
                            })()
                            : t(`sections.optimize.tabs.${opt.sectionType}`, opt.sectionType)
                          }
                        </span>
                        {/* Status Badge */}
                        <span className={cn(
                          'shrink-0 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border',
                          opt.applied
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            : 'bg-[color:var(--surface-control)] dark:bg-white/5 border-[color:var(--glass-border)] dark:border-white/10 text-gray-500 dark:text-gray-400'
                        )}>
                          {opt.applied
                            ? t('sections.optimize.status.applied', 'Applied')
                            : t('sections.optimize.status.pending', 'Pending')
                          }
                        </span>

                        {/* Info icon for Skills section */}
                        {opt.sectionType === 'skills' && (
                          <span
                            className="group relative cursor-help"
                            title={isArabic
                              ? 'هذه توصيات فقط ولن تُضاف تلقائياً إلى سيرتك الذاتية'
                              : 'These are recommendations only and will not be added to your resume'
                            }
                          >
                            <Info className="w-3.5 h-3.5 text-amber-400/70 hover:text-amber-400 transition-colors" />
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                        {t('sections.optimize.clickToExpand', 'Click to review suggestions')}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCompareMode(compareMode === opt.sectionId ? null : opt.sectionId);
                      }}
                      className={cn(
                        "p-2 rounded-lg transition-colors border border-transparent",
                        compareMode === opt.sectionId
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                          : "hover:bg-[color:var(--surface-control-hover)] dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      )}
                      title={t('sections.optimize.compare', 'Compare')}
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                    </button>
                    <div className={cn(
                      "p-2 text-gray-400 transition-transform duration-300",
                      expandedCards.has(opt.sectionId) && "rotate-180"
                    )}>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {(expandedCards.has(opt.sectionId) || compareMode === opt.sectionId) && (
                  <div className="p-4 pt-0 animate-in slide-in-from-top-2 duration-200">

                    {/* Compare Mode (Full View) */}
                    {compareMode === opt.sectionId && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 mt-2">
                        <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/10">
                          <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            {t('sections.optimize.originalContent', 'Original Content')}
                          </p>
                          <div className="text-xs text-gray-600 dark:text-gray-300 font-mono leading-relaxed opacity-80 bg-[color:var(--surface-control)] dark:bg-black/20 p-3 rounded-lg whitespace-pre-wrap break-words">
                            {Array.isArray(opt.original)
                              ? opt.original.map((item, i) => <div key={i} className="mb-1 last:mb-0 pb-1 border-b border-gray-200 dark:border-white/5 last:border-0">{item}</div>)
                              : opt.original || 'No content'
                            }
                          </div>
                        </div>
                        <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                          <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {t('sections.optimize.optimizedVersion', 'Optimized Version')}
                          </p>
                          <div className="text-xs text-gray-700 dark:text-gray-200 font-mono leading-relaxed bg-[color:var(--surface-control)] dark:bg-black/20 p-3 rounded-lg shadow-inner whitespace-pre-wrap break-words">
                            {Array.isArray(opt.optimized)
                              ? opt.optimized.map((item, i) => <div key={i} className="mb-1 last:mb-0 pb-1 border-b border-gray-200 dark:border-white/5 last:border-0">{item}</div>)
                              : opt.optimized || 'No content'
                            }
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Standard Mode (Split/Diff) */}
                    {compareMode !== opt.sectionId && (
                      viewMode === 'split' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div className="space-y-2">
                            <p className="text-xs text-gray-500 uppercase tracking-wider pl-1">
                              {t('sections.optimize.original', 'Original')}
                            </p>
                            <div className="p-3 bg-[color:var(--surface-control)] dark:bg-white/5 rounded-xl border border-[color:var(--glass-border)] dark:border-white/5 text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap break-words">
                              {Array.isArray(opt.original)
                                ? opt.original.join('\n')
                                : opt.original || t('sections.optimize.noOriginal', 'No original text')
                              }
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-emerald-500/70 uppercase tracking-wider pl-1">
                              {t('sections.optimize.optimized', 'Optimized')}
                            </p>
                            <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 text-sm text-gray-700 dark:text-gray-200 leading-relaxed shadow-sm whitespace-pre-wrap break-words">
                              {Array.isArray(opt.optimized)
                                ? opt.optimized.join('\n')
                                : opt.optimized || t('sections.optimize.noOptimized', 'No optimized text')
                              }
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 p-4 bg-[color:var(--surface-control)] dark:bg-black/20 rounded-xl border border-[color:var(--glass-border)] dark:border-white/5 font-mono text-sm leading-7 break-words">
                          <span className="bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-300 px-1 rounded mx-1 line-through decoration-red-400/50">
                            {Array.isArray(opt.original) ? opt.original.join(' ') : opt.original}
                          </span>
                          <span className="text-gray-500 mx-2">→</span>
                          <span className="bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1 rounded mx-1">
                            {Array.isArray(opt.optimized) ? opt.optimized.join(' ') : opt.optimized}
                          </span>
                        </div>
                      )
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                      {opt.applied ? (
                        <GlassButton
                          variant="ghost"
                          size="sm"
                          onClick={() => revertOptimization(opt.sectionId)}
                          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                          className="flex-1 hover:bg-red-500/10 hover:text-red-400"
                        >
                          {t('sections.optimize.revertChanges', 'Revert Changes')}
                        </GlassButton>
                      ) : (
                        <GlassButton
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            analytics.trackOptimization('applied', { section_type: opt.sectionType });
                            applyOptimization(opt.sectionId);
                          }}
                          leftIcon={<Check className="w-3.5 h-3.5" />}
                          className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-0"
                        >
                          {t('sections.optimize.applySuggestion', 'Apply Suggestion')}
                        </GlassButton>
                      )}

                      {REFINABLE_SECTIONS.includes(opt.sectionType) && (
                        <button
                          onClick={() => {
                            setRefineError(null);
                            setRefineInstruction('');
                            setRefiningCardId(refiningCardId === opt.sectionId ? null : opt.sectionId);
                          }}
                          className={cn(
                            'inline-flex w-full sm:w-auto items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors border text-sm font-medium',
                            refiningCardId === opt.sectionId
                              ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
                              : 'bg-[color:var(--surface-control)] dark:bg-white/5 hover:bg-[color:var(--surface-control-hover)] dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border-[color:var(--glass-border)] dark:border-white/5'
                          )}
                          title={t('sections.optimize.refine.button', 'Refine')}
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          {t('sections.optimize.refine.button', 'Refine')}
                        </button>
                      )}

                      {onCopy && (
                        <button
                          onClick={() => onCopy(Array.isArray(opt.optimized) ? opt.optimized.join('\n') : opt.optimized)}
                          className="inline-flex w-full sm:w-auto items-center justify-center p-2 bg-[color:var(--surface-control)] dark:bg-white/5 hover:bg-[color:var(--surface-control-hover)] dark:hover:bg-white/10 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-[color:var(--glass-border)] dark:border-white/5"
                          title={t('common.copy', 'Copy Text')}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Refine input — single-bullet correction loop */}
                    {refiningCardId === opt.sectionId && (
                      <div className="mt-4 p-4 rounded-xl bg-purple-500/5 border border-purple-500/15 animate-in slide-in-from-top-2 duration-200">
                        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300 mb-2">
                          <Wand2 className="w-3.5 h-3.5" />
                          {t('sections.optimize.refine.title', 'Refine this bullet')}
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                          {t('sections.optimize.refine.hint', 'Describe the change (e.g. "more leadership focus", "the real number is 20%"). Watheq rewrites only from your resume — it will not invent facts.')}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={refineInstruction}
                            onChange={(e) => setRefineInstruction(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey && refineLoadingId !== opt.sectionId) {
                                e.preventDefault();
                                handleRefineBullet(opt);
                              }
                            }}
                            disabled={refineLoadingId === opt.sectionId}
                            placeholder={t('sections.optimize.refine.placeholder', 'e.g. emphasize measurable impact')}
                            maxLength={500}
                            className="flex-1 px-3 py-2 text-sm rounded-lg bg-[color:var(--surface-control)] dark:bg-black/20 border border-[color:var(--glass-border)] dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 disabled:opacity-60"
                          />
                          <GlassButton
                            variant="primary"
                            size="sm"
                            onClick={() => handleRefineBullet(opt)}
                            disabled={refineLoadingId === opt.sectionId || !refineInstruction.trim()}
                            leftIcon={refineLoadingId === opt.sectionId
                              ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              : <Send className="w-3.5 h-3.5" />}
                            className="shrink-0"
                          >
                            {refineLoadingId === opt.sectionId
                              ? t('sections.optimize.refine.refining', 'Refining...')
                              : t('sections.optimize.refine.submit', 'Refine')}
                          </GlassButton>
                        </div>
                        {refineError && (
                          <p className="mt-2 text-xs font-medium text-red-500 dark:text-red-400">{refineError}</p>
                        )}
                      </div>
                    )}

                    {/* Refinement reasoning — surfaced so the user can judge the edit */}
                    {(opt.rationale || opt.issue) && (
                      <div className="mt-4 space-y-2">
                        {opt.rationale && (
                          <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                            <Lightbulb className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                {t('sections.optimize.refine.rationaleLabel', 'Why this change')}
                              </p>
                              <p className="text-sm text-gray-700 dark:text-gray-200 mt-0.5">{opt.rationale}</p>
                            </div>
                          </div>
                        )}
                        {opt.issue && (
                          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                            <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                {t('sections.optimize.refine.issueLabel', 'Not applied')}
                              </p>
                              <p className="text-sm text-gray-700 dark:text-gray-200 mt-0.5">{opt.issue}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>
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
          <div className="fixed inset-x-3 bottom-4 sm:inset-x-auto sm:right-6 sm:bottom-6 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-500 pointer-events-auto">
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
