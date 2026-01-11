import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassCircle } from '../ui/GlassCircle';
import { useResumeStore, OptimizationResult } from '../../lib/stores/resumeStore';
import { analytics } from '../../services/analytics';
import { useRateLimit } from '../../hooks/useRateLimit';
import { RateLimitBanner } from '../ui/RateLimitBanner';
import {
  Sparkles,
  Copy,
  ChevronDown,
  ChevronUp,
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
import { GapAnalysisCard, GapItem } from '../GapAnalysisCard';
import { ScoreBreakdown, ScoreBreakdownData } from '../ScoreBreakdown';
import { HiddenMatchesCard, HiddenMatch } from '../HiddenMatchesCard';
import { MirroredKeywordsCard } from '../MirroredKeywordsCard';
import { LoadingMessages } from '../LoadingMessages';

// Key for job description in localStorage (shared with MatchSection)
const LAST_JOB_KEY = 'airo:lastJobDescription';

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

    console.log('[OptimizeSection] Cache lookup:', {
      hasResumeText: !!resumeText,
      hasJobDescription: !!jobDescription,
      cachedScore: cachedAnalysis?.score,
      fallbackScore: optimizationMetrics.beforeScore
    });

    // Priority: 1. Cached match analysis score, 2. API-provided score, 3. Resume meta, 4. Default 55
    const beforeScore = cachedAnalysis?.score ??
      optimizationMetrics.beforeScore ??
      ((originalResume?.meta as Record<string, unknown> | undefined)?.match_score as number) ??
      55;

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

      // Transform API response to OptimizationResult format
      // API returns: { cards: [{section, issue, suggestion, exampleBefore, exampleAfter}], keywords: {add, neutral, remove} }
      const newOptimizations: OptimizationResult[] = [];

      if (data.cards && Array.isArray(data.cards)) {
        data.cards.forEach((card: { section?: string; exampleBefore?: string; exampleAfter?: string; issue?: string; suggestion?: string }, index: number) => {
          const sectionType = (card.section || 'general').toLowerCase() as 'headline' | 'summary' | 'experience' | 'skills' | 'projects';

          const originalContent = card.exampleBefore || '';
          const optimizedContent = card.exampleAfter || '';

          newOptimizations.push({
            sectionId: `${sectionType} -${index} `,
            sectionType: sectionType,
            original: originalContent,
            optimized: optimizedContent,
            applied: false,
          });
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

      // Capture match scoring data for Results Summary
      if (data.matchScoring) {
        setOptimizationMetrics({
          beforeScore: data.matchScoring.beforeScore,
          afterScore: data.matchScoring.afterScore,
          improvement: data.matchScoring.improvement,
          jdKeywords: data.matchScoring.jdKeywords || [],
          matchedKeywords: data.matchScoring.matchedKeywords || [],
          reasoning: data.matchScoring.reasoning,
          hasJobDescription: data.debug?.hasJobDescription || false,
        });
      }

      // Capture gap analysis from API response
      if (data.gapAnalysis && Array.isArray(data.gapAnalysis)) {
        setOptimizationMetrics({
          gapAnalysis: data.gapAnalysis,
        });
      }

      // Capture keyword strategy from API response
      if (data.keywordStrategy) {
        setOptimizationMetrics({
          keywordStrategy: data.keywordStrategy,
        });
      }

      // Capture score breakdown from API response
      if (data.scoreBreakdown) {
        setOptimizationMetrics({
          scoreBreakdown: data.scoreBreakdown,
        });
      }

      // Capture category scores from API response
      if (data.categoryScores) {
        setOptimizationMetrics({
          categoryScores: data.categoryScores,
        });
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

        setOptimizationMetrics({
          vision2030: {
            overallScore: vision2030Analysis.overallScore,
            primarySector,
            secondarySectors,
            matchedSkillsCount: vision2030Analysis.matchedSkills.length,
            topMatchedSkills: vision2030Analysis.matchedSkills.slice(0, 6).map(s => s.skillNameEn),
            detectedCareer,
          },
        });
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
    { id: 'education', label: 'Education', labelAr: 'التعليم' },
    { id: 'certifications', label: 'Certifications', labelAr: 'الشهادات' },
  ];

  const [activeSection, setActiveSection] = useState<'all' | 'headline' | 'summary' | 'experience' | 'skills' | 'projects' | 'education' | 'certifications'>('all');

  // Filter optimizations by section
  const filteredOptimizations = activeSection === 'all'
    ? optimizations
    : optimizations.filter(o => o.sectionType === activeSection);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <GlassCard variant="elevated">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <GlassCircle size="md" variant="purple">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </GlassCircle>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {t('sections.optimize.title', 'Polish Every Section')}
              </h3>
              <p className="text-sm text-gray-400">
                {t('sections.optimize.subtitle', 'Fine-tune your resume with AI recommendations')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Applied Counter */}
            {optimizations.length > 0 && (
              <>
                <span className="text-sm text-gray-400">
                  {appliedCount}/{optimizations.length} {isArabic ? 'مُطبّق' : 'Applied'}
                </span>
                {appliedCount > 0 && (
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onClick={revertAllOptimizations}
                  >
                    {isArabic ? 'التراجع عن الكل' : 'Revert All'}
                  </GlassButton>
                )}
                <GlassButton
                  variant="secondary"
                  size="sm"
                  onClick={applyAllOptimizations}
                  disabled={appliedCount === optimizations.length}
                >
                  {isArabic ? 'تطبيق الكل' : 'Apply All'}
                </GlassButton>
              </>
            )}
            {/* View Mode Toggle */}
            <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/10">
              <button
                onClick={() => setViewMode('split')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-all',
                  viewMode === 'split'
                    ? 'bg-white/10 text-emerald-400'
                    : 'text-gray-500 hover:text-gray-300'
                )}
              >
                {t('sections.optimize.sideBySide', 'Side-by-Side')}
              </button>
              <button
                onClick={() => setViewMode('diff')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-all',
                  viewMode === 'diff'
                    ? 'bg-white/10 text-emerald-400'
                    : 'text-gray-500 hover:text-gray-300'
                )}
              >
                {t('sections.optimize.inlineDiff', 'Inline Diff')}
              </button>
            </div>
            {optimizations.length > 0 && (
              <button
                onClick={handleClear}
                className="text-xs font-medium text-gray-400 hover:text-red-400 transition-colors"
              >
                {t('common.clear', 'Clear')}
              </button>
            )}
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 p-1 bg-white/5 rounded-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as typeof activeSection)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeSection === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              )}
            >
              {isArabic ? tab.labelAr : tab.label}
            </button>
          ))}
        </div>



        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* No Resume Warning */}
        {!hasResume && (
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <p className="text-sm text-amber-400">
              {isArabic ? 'يرجى رفع سيرة ذاتية أولاً' : 'Please upload a resume first'}
            </p>
          </div>
        )}

        {/* Optimize Button */}
        <GlassButton
          onClick={handleGenerate}
          isLoading={isOptimizing}
          disabled={isOptimizing || !hasResume}
          className="w-full"
        >
          <Sparkles className="w-4 h-4 me-2" />
          {hasResume
            ? t('sections.optimize.optimizeBtn', 'Optimize Resume with AI')
            : t('sections.optimize.runMatchFirst', 'Upload Resume First')
          }
        </GlassButton>
      </GlassCard>

      {/* Keyword Focus Section */}
      <GlassCard variant="elevated">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400 mb-4">
          {t('sections.optimize.keywordFocus', 'Keyword Focus')}
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {(['add', 'neutral', 'remove'] as const).map((bucket) => (
            <div key={bucket} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {isArabic ? CHIP_LABELS[`${bucket} Ar` as keyof typeof CHIP_LABELS] : CHIP_LABELS[bucket]}
              </p>
              <div className="flex flex-wrap gap-2">
                {(keywordBuckets[bucket] ?? []).length > 0 ? (
                  keywordBuckets[bucket].map((token) => (
                    <span
                      key={token}
                      className={cn(
                        'relative overflow-hidden rounded-full border px-3 py-1 text-xs font-semibold transition-all',
                        bucket === 'add' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
                        bucket === 'neutral' && 'border-blue-500/30 bg-blue-500/10 text-blue-400',
                        bucket === 'remove' && 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                      )}
                    >
                      {token}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-500">
                    {t('sections.optimize.noItems', 'No items yet')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Score Breakdown */}
      {optimizations.length > 0 && (
        <ScoreBreakdown
          data={optimizationMetrics.scoreBreakdown as ScoreBreakdownData | null}
          beforeScore={resultsSummaryData.beforeScore}
          afterScore={resultsSummaryData.potentialScore}
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

        {isOptimizing ? (
          <LoadingMessages type="optimize" estimatedTime={25000} />
        ) : filteredOptimizations.length > 0 ? (
          <div className="space-y-4">
            {filteredOptimizations.map((opt, index) => (
              <GlassCard
                key={opt.sectionId}
                variant="subtle"
                padding="sm"
                className={cn(
                  'transition-all',
                  opt.applied && 'ring-1 ring-emerald-500/30'
                )}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {opt.applied && (
                      <Check className="w-4 h-4 text-emerald-400" />
                    )}
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 capitalize">
                      {opt.sectionType === 'experience'
                        ? `${isArabic ? 'الخبرة' : 'Experience'} ${opt.sectionId.split('-')[1] ? Number(opt.sectionId.split('-')[1]) + 1 : ''} `
                        : isArabic
                          ? tabs.find(t => t.id === opt.sectionType)?.labelAr
                          : opt.sectionType
                      }
                    </span>
                    {/* Info icon for Skills section - recommendations only */}
                    {opt.sectionType === 'skills' && (
                      <span
                        className="group relative cursor-help"
                        title={isArabic
                          ? 'هذه توصيات فقط ولن تُضاف تلقائياً إلى سيرتك الذاتية'
                          : 'These are recommendations only and will not be added to your resume'
                        }
                      >
                        <Info className="w-4 h-4 text-amber-400/70 hover:text-amber-400 transition-colors" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 border border-white/10 text-xs text-gray-300 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                          {isArabic
                            ? '💡 توصيات فقط - لن تُضاف للسيرة الذاتية'
                            : '💡 Recommendations only - not added to resume'
                          }
                        </span>
                      </span>
                    )}
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs',
                      opt.applied
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-white/10 text-gray-400'
                    )}>
                      {opt.applied
                        ? (isArabic ? 'مُطبّق' : 'Applied')
                        : (isArabic ? 'معلق' : 'Pending')
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {onCopy && (
                      <button
                        onClick={() => onCopy(Array.isArray(opt.optimized) ? opt.optimized.join('\n') : opt.optimized)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title={t('common.copy', 'Copy')}
                      >
                        <Copy className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                    <button
                      onClick={() => setCompareMode(compareMode === opt.sectionId ? null : opt.sectionId)}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        compareMode === opt.sectionId
                          ? "bg-purple-500/20 text-purple-400"
                          : "hover:bg-white/10 text-gray-400"
                      )}
                      title={isArabic ? 'مقارنة' : 'Compare'}
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleCard(opt.sectionId)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      {expandedCards.has(opt.sectionId)
                        ? <ChevronUp className="w-4 h-4 text-gray-400" />
                        : <ChevronDown className="w-4 h-4 text-gray-400" />
                      }
                    </button>
                  </div>
                </div>

                {/* Compare Mode */}
                {compareMode === opt.sectionId && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-xs text-gray-500 mb-2">{isArabic ? 'الأصلي' : 'Original'}</p>
                      <p className="text-sm text-gray-300">
                        {Array.isArray(opt.original)
                          ? opt.original.map((item, i) => <span key={i} className="block">• {item}</span>)
                          : opt.original || 'No content'
                        }
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-lg">
                      <p className="text-xs text-emerald-400 mb-2">{isArabic ? 'المحسّن' : 'Optimized'}</p>
                      <p className="text-sm text-white">
                        {Array.isArray(opt.optimized)
                          ? opt.optimized.map((item, i) => <span key={i} className="block">• {item}</span>)
                          : opt.optimized || 'No content'
                        }
                      </p>
                    </div>
                  </div>
                )}

                {/* Card Content */}
                {compareMode !== opt.sectionId && (
                  viewMode === 'split' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-white/5 rounded-lg">
                        <p className="text-xs text-gray-500 mb-2">
                          {t('sections.optimize.original', 'Original')}
                        </p>
                        <p className={cn(
                          'text-sm text-gray-300 transition-all',
                          !expandedCards.has(opt.sectionId) && 'line-clamp-3'
                        )}>
                          {Array.isArray(opt.original)
                            ? opt.original.join(', ')
                            : opt.original || t('sections.optimize.noOriginal', 'No original text')
                          }
                        </p>
                      </div>
                      <div className="p-3 bg-emerald-500/10 rounded-lg">
                        <p className="text-xs text-emerald-400 mb-2">
                          {t('sections.optimize.optimized', 'Optimized')}
                        </p>
                        <p className={cn(
                          'text-sm text-white transition-all',
                          !expandedCards.has(opt.sectionId) && 'line-clamp-3'
                        )}>
                          {Array.isArray(opt.optimized)
                            ? opt.optimized.join(', ')
                            : opt.optimized || t('sections.optimize.noOptimized', 'No optimized text')
                          }
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className={cn(
                        'text-sm text-gray-300 transition-all',
                        !expandedCards.has(opt.sectionId) && 'line-clamp-4'
                      )}>
                        <span className="line-through text-rose-400/70">
                          {Array.isArray(opt.original) ? opt.original.join(', ') : opt.original}
                        </span>
                        {' → '}
                        <span className="text-emerald-400">
                          {Array.isArray(opt.optimized) ? opt.optimized.join(', ') : opt.optimized}
                        </span>
                      </p>
                    </div>
                  )
                )}

                {/* Feedback Buttons */}
                {sessionId && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <FeedbackButtons
                      suggestionType={(['summary', 'experience', 'skills', 'keywords'].includes(opt.sectionType) ? opt.sectionType : 'summary') as SuggestionType}
                      sectionIndex={index}
                      sessionId={sessionId}
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  {opt.applied ? (
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      onClick={() => revertOptimization(opt.sectionId)}
                      leftIcon={<RotateCcw className="w-3 h-3" />}
                    >
                      {isArabic ? 'التراجع' : 'Revert'}
                    </GlassButton>
                  ) : (
                    <GlassButton
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        analytics.trackOptimization('applied', { section_type: opt.sectionType });
                        applyOptimization(opt.sectionId);
                      }}
                      leftIcon={<Check className="w-3 h-3" />}
                    >
                      {isArabic ? 'تطبيق' : 'Apply'}
                    </GlassButton>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        ) : (
          <GlassCard variant="subtle" padding="lg">
            <div className="text-center text-gray-500">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t('sections.optimize.emptyState', 'Run an analysis to see AI optimization cards appear here.')}</p>
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
    </div>
  );
}

export default OptimizeSection;
