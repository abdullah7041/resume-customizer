import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { useResumeStore, OptimizationResult } from '../../lib/stores/resumeStore';
import { analytics } from '../../services/analytics';
import { useRateLimit } from '../../hooks/useRateLimit';
import { useFeedbackPrompt } from '../../lib/hooks/useFeedbackPrompt';
import { RateLimitBanner } from '../ui/RateLimitBanner';
import {
  Sparkles,
  Copy,
  ChevronDown,
  Check,
  RotateCcw,
  ArrowLeftRight,
  AlertCircle,
  Info,
} from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import { FeedbackButtons } from '../ui/FeedbackButtons';
import { analyzeVision2030Alignment } from '../../lib/utils/vision2030Analyzer';
import type { SuggestionType } from '../../services/feedback';
import type { OptimizationMetrics } from '../../types/templates';
import { GapAnalysisCard, GapItem } from '../GapAnalysisCard';
import { ScoreBreakdown, ScoreBreakdownData, CategoryScoresData } from '../ScoreBreakdown';
import { HiddenMatchesCard, HiddenMatch } from '../HiddenMatchesCard';
import { MirroredKeywordsCard } from '../MirroredKeywordsCard';
import { LoadingMessages } from '../LoadingMessages';

// Key for job description in localStorage (shared with MatchSection)
const LAST_JOB_KEY = 'airo:lastJobDescription';

// Default match score when no analysis is available (represents neutral/baseline match)
const DEFAULT_FALLBACK_SCORE = 55;

// === Keyword bucket labels ===
const CHIP_LABELS = {
  add: "Add",
  addAr: "أضف",
  neutral: "Keep",
  neutralAr: "احتفظ",
  remove: "De-emphasize",
  removeAr: "قلل التأكيد",
};

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
  onOptimize?: (mode: any) => Promise<any>;
  onCopy?: (value: any) => Promise<void>;
  previewUsed?: boolean;
  onUpgrade?: () => void;
  hasMatchAnalysis?: boolean;
  onClear?: () => void;
  onExport?: (variant: any, exportMethod?: string) => Promise<void>;
  canExport?: boolean;
  // Optional: can pass resume text directly or use store
  resumeText?: string | null;
}

const emptyKeywords = { add: [], remove: [], neutral: [] };

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
    applyAllOptimizations,
    revertAllOptimizations,
    keywordSuggestions,
    optimizationMetrics,
    setOptimizationMetrics,
    resetOptimizationMetrics,
    getCachedAnalysis,
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

  // Feedback system hook
  const { incrementFeatureUses } = useFeedbackPrompt();

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
        ? window.localStorage.getItem(LAST_JOB_KEY) || ''
        : '';

      if (jobDescription) {
        const cachedAnalysis = getCachedAnalysis(resumeText, jobDescription);
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
      ? window.localStorage.getItem(LAST_JOB_KEY) || ''
      : '';

    // Try to get the cached match analysis score first (this is the 78% from Match section)
    const cachedAnalysis = resumeText && jobDescription
      ? getCachedAnalysis(resumeText, jobDescription)
      : null;

    // Priority: 1. Store metrics (from API or cache restore), 2. Current cache, 3. Resume meta, 4. Default fallback
    // Note: optimizationMetrics.beforeScore is the source of truth - populated from API response or cache restoration
    const beforeScore = optimizationMetrics.beforeScore ??
      cachedAnalysis?.score ??
      ((originalResume?.meta as Record<string, unknown> | undefined)?.match_score as number) ??
      DEFAULT_FALLBACK_SCORE;

    // Track if we're using placeholder/fallback values (Bug Fix: Make fake scores obvious)
    const isPlaceholderScore = !cachedAnalysis?.score &&
      !optimizationMetrics.beforeScore &&
      !((originalResume?.meta as Record<string, unknown> | undefined)?.match_score);
    // FIX: Use explicit null check, not truthy check, because improvement can be 0 (valid value)
    const isPlaceholderImprovement = optimizationMetrics.improvement === null || optimizationMetrics.improvement === undefined;

    // Recalculate after score based on applied optimizations
    // API gives us the "potential" score, but we adjust based on what's actually applied
    const appliedRatio = optimizations.length > 0
      ? appliedCount / optimizations.length
      : 0;

    const maxImprovement = optimizationMetrics.improvement ?? 15;
    const actualImprovement = Math.round(maxImprovement * appliedRatio);
    const afterScore = Math.min(beforeScore + actualImprovement, 95);

    // Potential score is also adjusted to use the correct base
    const potentialAfterScore = Math.min(beforeScore + (optimizationMetrics.improvement ?? maxImprovement), 95);

    return {
      beforeScore,
      afterScore,
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
    };
  }, [optimizations, keywordBuckets, optimizationMetrics, originalResume, resumeText, getCachedAnalysis]);


  // Generate optimizations from API
  const handleGenerate = async () => {
    // If parent provided handler, use that
    if (propOnOptimize) {
      return propOnOptimize('auto');
    }

    if (!resumeText && !originalResume) {
      setError(isArabic ? 'يرجى رفع سيرة ذاتية أولاً' : 'Please upload a resume first');
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
      const response = await fetch('/.netlify/functions/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: resumeText || JSON.stringify(originalResume),
          // Get job description from localStorage (shared with MatchSection)
          jobText: typeof window !== 'undefined'
            ? window.localStorage.getItem(LAST_JOB_KEY) || ''
            : '',
        }),
      });

      if (!response.ok) {
        throw new Error('Optimization failed');
      }

      const data = await response.json();

      // DEBUG: Log ALL data received from API
      if (process.env.NODE_ENV === 'development') {
        console.log('[OptimizeSection] API response data:', {
          hasCards: !!data.cards,
          cardsCount: data.cards?.length,
          hasMatchScoring: !!data.matchScoring,
          matchScoring: data.matchScoring,
          hasGapAnalysis: !!data.gapAnalysis,
          gapAnalysisCount: data.gapAnalysis?.length,
          hasCategoryScores: !!data.categoryScores,
          categoryScores: data.categoryScores,
          // Added: Track project and certification data
          hasProjectImprovements: !!data.projectImprovements,
          projectImprovementsCount: data.projectImprovements?.length || 0,
          projectImprovements: data.projectImprovements,
          hasCertificationRecs: !!data.certificationRecommendations,
          certificationRecsCount: data.certificationRecommendations?.length || 0,
          certificationRecommendations: data.certificationRecommendations,
        });
      }


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
            original: isArabic ? 'شهادة موصى بها' : 'Recommended Certification',
            optimized: `${cert.name || ''} (${cert.issuer || ''}) - ${cert.relevance || ''}`,
            applied: false, // Certifications are display-only, never applied
          });
        });
      }

      // DEBUG: Log what optimizations were created
      if (process.env.NODE_ENV === 'development') {
        console.log('[OptimizeSection] Processed optimizations:', {
          totalCount: newOptimizations.length,
          bySection: newOptimizations.reduce((acc, opt) => {
            acc[opt.sectionType] = (acc[opt.sectionType] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          hasProjects: newOptimizations.some(o => o.sectionType === 'projects'),
          hasCertifications: newOptimizations.some(o => o.sectionType === 'certifications'),
        });
      }


      // If no cards but we have API data, try legacy format
      if (newOptimizations.length === 0) {
        if (data.headline) {
          newOptimizations.push({
            sectionId: 'headline',
            sectionType: 'headline',
            original: originalResume?.basics?.label || (isArabic ? 'لا يوجد عنوان' : 'No headline'),
            optimized: data.headline,
            applied: false,
          });
        }

        if (data.summary) {
          newOptimizations.push({
            sectionId: 'summary',
            sectionType: 'summary',
            original: originalResume?.basics?.summary || (isArabic ? 'لا يوجد ملخص' : 'No summary'),
            optimized: data.summary,
            applied: false,
          });
        }
      }

      // Validate that we have meaningful optimizations
      if (newOptimizations.length === 0) {
        throw new Error(isArabic ? 'لم يتم إنشاء تحسينات. قد يحتاج الذكاء الاصطناعي إلى مزيد من السياق.' : 'No optimizations were generated. The AI may need more context.');
      }

      // Check if any optimizations have valid content
      const hasValidContent = newOptimizations.some(opt => {
        const original = Array.isArray(opt.original) ? opt.original.join('') : opt.original;
        const optimized = Array.isArray(opt.optimized) ? opt.optimized.join('') : opt.optimized;
        return (original && original.trim().length > 0) || (optimized && optimized.trim().length > 0);
      });

      if (!hasValidContent) {
        throw new Error(isArabic ? 'حصل الذكاء الاصطناعي على اقتراحات فارغة. يرجى المحاولة مرة أخرى.' : 'The AI returned empty suggestions. Please try again.');
      }

      setOptimizations(newOptimizations);

      // Track optimization completed
      analytics.trackOptimization('completed', {
        optimization_count: newOptimizations.length,
        time_ms: performance.now() - startTime,
      });

      // Increment feature usage for feedback system
      incrementFeatureUses();

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

      // Capture match scoring data for Results Summary
      if (data.matchScoring) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[OptimizeSection] Received matchScoring from API:', {
            beforeScore: data.matchScoring.beforeScore,
            afterScore: data.matchScoring.afterScore,
            improvement: data.matchScoring.improvement,
          });
        }
        metricsToUpdate.beforeScore = data.matchScoring.beforeScore;
        metricsToUpdate.afterScore = data.matchScoring.afterScore;
        metricsToUpdate.improvement = data.matchScoring.improvement;
        metricsToUpdate.jdKeywords = data.matchScoring.jdKeywords || [];
        metricsToUpdate.matchedKeywords = data.matchScoring.matchedKeywords || [];
        metricsToUpdate.reasoning = data.matchScoring.reasoning;
        metricsToUpdate.hasJobDescription = data.debug?.hasJobDescription || false;
      } else {
        // Fallback: Use cached match analysis score if available
        const jobDesc = typeof window !== 'undefined' ? window.localStorage.getItem(LAST_JOB_KEY) || '' : '';
        const cachedAnalysis = resumeText && jobDesc ? getCachedAnalysis(resumeText, jobDesc) : null;
        if (cachedAnalysis?.score) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[OptimizeSection] No matchScoring from API, using cached score:', cachedAnalysis.score);
          }
          metricsToUpdate.beforeScore = cachedAnalysis.score;
          metricsToUpdate.hasJobDescription = true;
        }
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

      // Capture category scores from API response
      if (data.categoryScores) {
        metricsToUpdate.categoryScores = data.categoryScores;
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
        if (process.env.NODE_ENV === 'development') {
          console.log('[OptimizeSection] Dispatching consolidated metrics update:', {
            keys: Object.keys(metricsToUpdate),
            gapAnalysisCount: metricsToUpdate.gapAnalysis?.length,
            beforeScore: metricsToUpdate.beforeScore
          });
        }

        setOptimizationMetrics(metricsToUpdate);

        // Update the cache with the new match score if available
        // This ensures subsequent renders use the fresh score instead of stale cache
        if (metricsToUpdate.beforeScore && resumeText && (metricsToUpdate.hasJobDescription)) {
          const jobDesc = typeof window !== 'undefined' ? window.localStorage.getItem(LAST_JOB_KEY) || '' : '';
          if (jobDesc) {
            useResumeStore.getState().setCachedAnalysis(resumeText, jobDesc, {
              score: metricsToUpdate.beforeScore,
              matchedKeywords: metricsToUpdate.matchedKeywords || [],
              missingKeywords: metricsToUpdate.jdKeywords?.filter((k: string) => !metricsToUpdate.matchedKeywords?.includes(k)) || []
            });
          }
        }
      }

    } catch (err) {
      console.error('Optimization error:', err);
      // Check if this is a rate limit error
      if (!handleRateLimitError(err)) {
        setError(err instanceof Error ? err.message : (isArabic ? 'فشل في توليد التحسينات' : 'Failed to generate optimizations'));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      setOptimizations([]);
    }
    // Also reset all optimization metrics to clear stale data
    resetOptimizationMetrics();
    setSessionId(null);
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
    { id: 'all', label: 'All Sections', labelAr: 'جميع الأقسام' },
    { id: 'headline', label: 'Headline', labelAr: 'العنوان' },
    { id: 'summary', label: 'Summary', labelAr: 'الملخص' },
    { id: 'experience', label: 'Experience', labelAr: 'الخبرة' },
    { id: 'skills', label: 'Skills', labelAr: 'المهارات' },
    { id: 'projects', label: 'Projects', labelAr: 'المشاريع' },
    { id: 'certifications', label: 'Certifications', labelAr: 'الشهادات' },
  ];

  const [activeSection, setActiveSection] = useState<'all' | 'headline' | 'summary' | 'experience' | 'skills' | 'projects' | 'certifications'>('all');

  // Filter optimizations by section
  const filteredOptimizations = activeSection === 'all'
    ? optimizations
    : optimizations.filter(o => o.sectionType === activeSection);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <GlassCard variant="elevated" className="overflow-hidden relative">
        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 shadow-lg shadow-purple-500/5">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                {t('sections.optimize.title', 'Optimize Resume')}
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                {t('sections.optimize.subtitle', 'AI-powered suggestions to improve your resume score')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Applied Counter */}
            {optimizations.length > 0 && (
              <div className="flex items-center gap-3 bg-white/5 rounded-xl p-1.5 pr-3 border border-white/5">
                <div className="px-3 py-1.5 rounded-lg bg-black/20 border border-white/5">
                  <span className="text-sm font-medium text-emerald-400">
                    {appliedCount} <span className="text-gray-500">/ {optimizations.length}</span>
                  </span>
                </div>

                {appliedCount > 0 && (
                  <button
                    onClick={revertAllOptimizations}
                    className="text-xs font-medium text-gray-400 hover:text-white transition-colors px-2"
                  >
                    {isArabic ? 'تراجع' : 'Revert'}
                  </button>
                )}

                <div className="w-px h-4 bg-white/10 mx-1" />

                <button
                  onClick={applyAllOptimizations}
                  disabled={appliedCount === optimizations.length}
                  className={cn(
                    "text-xs font-bold transition-colors px-2",
                    appliedCount === optimizations.length
                      ? "text-gray-500 cursor-not-allowed"
                      : "text-emerald-400 hover:text-emerald-300"
                  )}
                >
                  {isArabic ? 'تطبيق الكل' : 'Apply All'}
                </button>
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center bg-black/20 rounded-xl p-1 border border-white/5">
              <button
                onClick={() => setViewMode('split')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-300',
                  viewMode === 'split'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300'
                )}
              >
                {t('sections.optimize.sideBySide', 'Split')}
              </button>
              <button
                onClick={() => setViewMode('diff')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-300',
                  viewMode === 'diff'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300'
                )}
              >
                {t('sections.optimize.inlineDiff', 'Diff')}
              </button>
            </div>

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
        </div>

        {/* Global Expand/Collapse for Cards */}
        {optimizations.length > 0 && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() => {
                if (expandedCards.size === filteredOptimizations.length) {
                  setExpandedCards(new Set());
                } else {
                  setExpandedCards(new Set(filteredOptimizations.map(o => o.sectionId)));
                }
              }}
              className="text-[10px] font-medium text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md border border-white/5"
            >
              {expandedCards.size === filteredOptimizations.length
                ? (isArabic ? 'طي الكل' : 'Collapse All')
                : (isArabic ? 'توسيع الكل' : 'Expand All')
              }
            </button>
          </div>
        )}

        {/* Section Tabs */}
        <div className="flex overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 mb-6">
          <div className="flex items-center gap-2 p-1 bg-black/20 rounded-xl border border-white/5">
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
                      ? 'text-white'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5',
                    !hasItems && !isActive && 'opacity-50'
                  )}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-white/10 rounded-lg shadow-sm border border-white/5" />
                  )}
                  <span className="relative z-10">
                    {isArabic ? tab.labelAr : tab.label}
                    {tab.id !== 'all' && hasItems && (
                      <span className="ml-2 text-xs opacity-60 bg-white/10 px-1.5 py-0.5 rounded-full">
                        {optimizations.filter(o => o.sectionType === tab.id).length}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-6 backdrop-blur-sm">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-sm font-medium text-red-400">{error}</p>
          </div>
        )}

        {/* No Resume Warning */}
        {!hasResume && (
          <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6 backdrop-blur-sm">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-sm font-medium text-amber-400">
              {isArabic ? 'يرجى رفع سيرة ذاتية أولاً' : 'Please upload a resume first'}
            </p>
          </div>
        )}

        {/* Optimize Button */}
        <button
          onClick={handleGenerate}
          disabled={isOptimizing || !hasResume}
          className={cn(
            "w-full relative group overflow-hidden rounded-xl p-[1px] transition-all duration-300 transform active:scale-[0.99]",
            (!hasResume || isOptimizing) ? "opacity-70 cursor-not-allowed" : "hover:shadow-lg hover:shadow-purple-500/20"
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 opacity-100 group-hover:opacity-100 animate-gradient-xy transition-opacity" />
          <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-xl px-6 py-4 flex items-center justify-center gap-3 transition-colors group-hover:bg-gray-900/80">
            {isOptimizing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-white font-semibold tracking-wide">
                  {isArabic ? 'جاري التحسين...' : 'Optimizing Resume...'}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-purple-300 group-hover:text-white transition-colors" />
                <span className="text-white font-bold tracking-wide">
                  {hasResume
                    ? t('sections.optimize.optimizeBtn', 'Optimize Resume with AI')
                    : t('sections.optimize.runMatchFirst', 'Upload Resume First')
                  }
                </span>
              </>
            )}
          </div>
        </button>
      </GlassCard>

      {/* Keyword Focus Section - Manual Buckets */}
      <GlassCard variant="elevated">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400">
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
              <div key={bucket} className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between">
                  <p className={`text-xs font-bold uppercase tracking-wider text-${config.color}-400 flex items-center gap-2`}>
                    <Icon className="w-3.5 h-3.5" />
                    {isArabic ? CHIP_LABELS[`${bucket} Ar` as keyof typeof CHIP_LABELS] : CHIP_LABELS[bucket]}
                  </p>
                  <span className="text-[10px] font-medium text-gray-500 bg-black/20 px-2 py-0.5 rounded-full">
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
                          bucket === 'add' && 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20',
                          bucket === 'neutral' && 'bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/20',
                          bucket === 'remove' && 'bg-rose-500/10 border-rose-500/20 text-rose-300 hover:bg-rose-500/20 line-through decoration-rose-500/50'
                        )}
                      >
                        {token}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-600 italic py-1">
                      {isArabic ? 'لا توجد عناصر' : 'No keywords identified'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Score Breakdown */}
      {optimizations.length > 0 && (
        <ScoreBreakdown
          data={optimizationMetrics.scoreBreakdown as ScoreBreakdownData | null}
          categoryScores={optimizationMetrics.categoryScores as unknown as CategoryScoresData | undefined}
          beforeScore={resultsSummaryData.beforeScore}
          afterScore={resultsSummaryData.potentialScore}
          isPlaceholderScore={resultsSummaryData.isPlaceholderScore}
          isPlaceholderImprovement={resultsSummaryData.isPlaceholderImprovement}
          className="mb-2"
        />
      )}

      {/* Gap Analysis */}
      {optimizations.length > 0 && (
        optimizationMetrics.gapAnalysis &&
          Array.isArray(optimizationMetrics.gapAnalysis) &&
          optimizationMetrics.gapAnalysis.length > 0 ? (
          <GapAnalysisCard
            gaps={optimizationMetrics.gapAnalysis as GapItem[]}
            className="mb-2"
          />
        ) : (
          <GlassCard variant="subtle" padding="md" className="mb-2">
            <div className="flex items-center gap-3 text-gray-400">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {isArabic ? 'لم يتم اكتشاف فجوات حرجة' : 'No Critical Gaps Detected'}
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
      )}

      {/* Hidden Matches */}
      {optimizationMetrics.keywordStrategy?.hiddenMatches &&
        (optimizationMetrics.keywordStrategy.hiddenMatches as HiddenMatch[]).length > 0 && (
          <HiddenMatchesCard
            matches={optimizationMetrics.keywordStrategy.hiddenMatches as HiddenMatch[]}
            className="mb-2"
          />
        )}

      {/* Mirrored Keywords */}
      {optimizationMetrics.keywordStrategy && (
        <MirroredKeywordsCard
          mirroredPhrases={(optimizationMetrics.keywordStrategy.mirroredPhrases as string[]) || []}
          structuralChanges={(optimizationMetrics.keywordStrategy.structuralChanges as string[]) || []}
          className="mb-2"
        />
      )}

      {/* Optimization Cards Section */}
      <div className="relative space-y-4">

        {filteredOptimizations.length > 0 ? (
          <div className="grid gap-4">
            {filteredOptimizations.map((opt, index) => (
              <GlassCard
                key={opt.sectionId}
                variant="elevated"
                padding="none"
                className={cn(
                  'overflow-hidden transition-all duration-300 border',
                  opt.applied
                    ? 'border-emerald-500/30 ring-1 ring-emerald-500/20'
                    : 'border-white/5 hover:border-white/10'
                )}
              >
                {/* Card Header - Always Visible */}
                <div
                  className={cn(
                    "p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors",
                    expandedCards.has(opt.sectionId) && "bg-white/5 border-b border-white/5"
                  )}
                  onClick={() => toggleCard(opt.sectionId)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg border",
                      opt.applied
                        ? "bg-emerald-500/10 border-emerald-500/20"
                        : "bg-purple-500/10 border-purple-500/20"
                    )}>
                      {opt.applied
                        ? <Check className="w-4 h-4 text-emerald-400" />
                        : <Sparkles className="w-4 h-4 text-purple-400" />
                      }
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white capitalize">
                          {opt.sectionType === 'experience'
                            ? (function () {
                              // Calculate index specifically among experience items
                              const expIndex = filteredOptimizations
                                .filter(o => o.sectionType === 'experience')
                                .findIndex(o => o.sectionId === opt.sectionId);
                              return `${isArabic ? 'الخبرة' : 'Experience'} ${expIndex !== -1 ? expIndex + 1 : ''}`;
                            })()
                            : isArabic
                              ? tabs.find(t => t.id === opt.sectionType)?.labelAr
                              : opt.sectionType
                          }
                        </span>
                        {/* Status Badge */}
                        <span className={cn(
                          'px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border',
                          opt.applied
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-white/5 border-white/10 text-gray-400'
                        )}>
                          {opt.applied
                            ? (isArabic ? 'مُطبّق' : 'Applied')
                            : (isArabic ? 'معلق' : 'Pending')
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

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCompareMode(compareMode === opt.sectionId ? null : opt.sectionId);
                      }}
                      className={cn(
                        "p-2 rounded-lg transition-colors border border-transparent",
                        compareMode === opt.sectionId
                          ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                          : "hover:bg-white/10 text-gray-400 hover:text-white"
                      )}
                      title={isArabic ? 'مقارنة' : 'Compare'}
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
                            {isArabic ? 'الأصلي' : 'Original Content'}
                          </p>
                          <div className="text-sm text-gray-300 font-mono text-xs leading-relaxed opacity-80 bg-black/20 p-3 rounded-lg">
                            {Array.isArray(opt.original)
                              ? opt.original.map((item, i) => <div key={i} className="mb-1 last:mb-0 pb-1 border-b border-white/5 last:border-0">{item}</div>)
                              : opt.original || 'No content'
                            }
                          </div>
                        </div>
                        <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                          <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {isArabic ? 'المحسّن' : 'Optimized Version'}
                          </p>
                          <div className="text-sm text-gray-200 font-mono text-xs leading-relaxed bg-black/20 p-3 rounded-lg shadow-inner">
                            {Array.isArray(opt.optimized)
                              ? opt.optimized.map((item, i) => <div key={i} className="mb-1 last:mb-0 pb-1 border-b border-white/5 last:border-0">{item}</div>)
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
                            <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-sm text-gray-400 leading-relaxed">
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
                            <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 text-sm text-gray-200 leading-relaxed shadow-sm">
                              {Array.isArray(opt.optimized)
                                ? opt.optimized.join('\n')
                                : opt.optimized || t('sections.optimize.noOptimized', 'No optimized text')
                              }
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 p-4 bg-black/20 rounded-xl border border-white/5 font-mono text-sm leading-7">
                          <span className="bg-red-500/20 text-red-300 px-1 rounded mx-1 line-through decoration-red-400/50">
                            {Array.isArray(opt.original) ? opt.original.join(' ') : opt.original}
                          </span>
                          <span className="text-gray-500 mx-2">→</span>
                          <span className="bg-emerald-500/20 text-emerald-300 px-1 rounded mx-1">
                            {Array.isArray(opt.optimized) ? opt.optimized.join(' ') : opt.optimized}
                          </span>
                        </div>
                      )
                    )}

                    {/* Feedback Buttons */}
                    {sessionId && (
                      <div className="mt-4 pt-4 border-t border-white/5 flex justify-end">
                        <FeedbackButtons
                          suggestionType={(['summary', 'experience', 'skills', 'keywords'].includes(opt.sectionType) ? opt.sectionType : 'summary') as SuggestionType}
                          sectionIndex={index}
                          sessionId={sessionId}
                        />
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 mt-4">
                      {opt.applied ? (
                        <GlassButton
                          variant="ghost"
                          size="sm"
                          onClick={() => revertOptimization(opt.sectionId)}
                          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                          className="flex-1 hover:bg-red-500/10 hover:text-red-400"
                        >
                          {isArabic ? 'التراجع' : 'Revert Changes'}
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
                          {isArabic ? 'تطبيق' : 'Apply Suggestion'}
                        </GlassButton>
                      )}

                      {onCopy && (
                        <button
                          onClick={() => onCopy(Array.isArray(opt.optimized) ? opt.optimized.join('\n') : opt.optimized)}
                          className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white border border-white/5"
                          title={t('common.copy', 'Copy Text')}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        ) : (
          <GlassCard variant="subtle" padding="lg" className="border-dashed border-white/10">
            <div className="text-center text-gray-500 py-8">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-gray-600" />
              </div>
              <h4 className="text-lg font-medium text-gray-400 mb-2">
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
      {isRateLimited && (
        <RateLimitBanner
          retryAfter={retryAfter}
          onRetry={() => {
            clearRateLimit();
            handleGenerate();
          }}
          onDismiss={clearRateLimit}
        />
      )}

      {/* Optimization Loading Toast - Non-blocking */}
      {isOptimizing && createPortal(
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-500 pointer-events-auto">
          <LoadingMessages type="optimize" estimatedTime={25000} />
        </div>,
        document.body
      )}
    </div>
  );
}

export default OptimizeSection;
