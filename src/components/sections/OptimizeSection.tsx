import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { useResumeStore, OptimizationResult } from '../../lib/stores/resumeStore';
import {
  Sparkles,
  Copy,
  Info,
  Lock,
  ChevronDown,
  ChevronUp,
  Check,
  RotateCcw,
  ArrowLeftRight,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils/cn';

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

// Normalize optimization data to handle both API formats (before/after) and store format (original/optimized)
const normalizeOptimization = (opt: OptimizationCard, index: number): OptimizationResult => {
  return {
    sectionId: opt.sectionId || opt.section || `opt-${index}`,
    sectionType: (opt.sectionType || opt.section || 'general') as OptimizationResult['sectionType'],
    original: opt.original ?? opt.before ?? '',
    optimized: opt.optimized ?? opt.after ?? '',
    applied: opt.applied ?? false,
    timestamp: new Date().toISOString(),
  };
};

// === Preview Banner Component ===
function PreviewBanner({ onUpgrade, t }: { onUpgrade?: () => void; t: any }) {
  return (
    <div className="p-4 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent">
      <div className="flex flex-wrap items-center gap-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
          <Lock className="h-5 w-5" />
        </span>
        <div className="space-y-1 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            {t('sections.optimize.previewMode', 'Preview mode')}
          </p>
          <p className="text-sm text-gray-300">
            {t('sections.optimize.previewDesc', 'Free preview run—results will not be saved until you upgrade.')}
          </p>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/85">
            <Info className="h-3.5 w-3.5" />
            <span>{t('sections.optimize.previewHint', 'Preview lets you test the flow. Upgrade to save/export.')}</span>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <GlassButton onClick={onUpgrade} className="w-full sm:w-auto">
          {t('sections.optimize.unlockPremium', 'Unlock premium insights')}
        </GlassButton>
      </div>
    </div>
  );
}

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

  // Get data from store
  const {
    originalResume,
    parsedResumeText,
    optimizations: storeOptimizations,
    setOptimizations,
    applyOptimization,
    revertOptimization,
    applyAllOptimizations,
    showOptimized,
    toggleShowOptimized,
    keywordSuggestions,
  } = useResumeStore();

  // Use props or store
  const resumeText = propResumeText || parsedResumeText;
  const hasResume = Boolean(originalResume || resumeText);

  const [viewMode, setViewMode] = useState<'split' | 'diff'>('split');
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [chipsAnimated, setChipsAnimated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<string | null>(null);
  const chipsShownRef = useRef(false);

  // Decide which optimizations to use (props or store)
  // Normalize prop optimizations to match the expected OptimizationResult format
  const useStoreOptimizations = !propOptimizations || propOptimizations.length === 0;
  const normalizedPropOptimizations = useMemo(() => {
    if (!propOptimizations || propOptimizations.length === 0) return [];
    return propOptimizations.map((opt, index) => normalizeOptimization(opt, index));
  }, [propOptimizations]);

  const optimizations = useStoreOptimizations ? storeOptimizations : normalizedPropOptimizations;
  const isOptimizing = propIsOptimizing || isGenerating;

  // Debug log to help diagnose optimization rendering issues
  console.log('[OptimizeSection] Using', useStoreOptimizations ? 'store' : 'props', 'optimizations, count:', optimizations.length);
  if (optimizations.length > 0) {
    console.log('[OptimizeSection] First optimization structure:', JSON.stringify(optimizations[0], null, 2));
  }

  // Check if we have match analysis (props or derived from store)
  const _hasMatchAnalysis = propHasMatchAnalysis || hasResume;

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

  // Conditions
  const watermarkVisible = !isPremium && previewUsed;
  const showPreviewBanner = !isPremium && !previewUsed;

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

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/.netlify/functions/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: resumeText || JSON.stringify(originalResume),
          jobText: '', // Job text is optional for optimization
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

          newOptimizations.push({
            sectionId: `${sectionType}-${index}`,
            sectionType: sectionType,
            original: card.exampleBefore || (isArabic ? 'لا يوجد نص أصلي' : 'No original text'),
            optimized: card.exampleAfter || (isArabic ? 'لا يوجد اقتراح' : 'No suggestion'),
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

      setOptimizations(newOptimizations);

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

    } catch (err) {
      console.error('Optimization error:', err);
      setError(err instanceof Error ? err.message : (isArabic ? 'فشل في توليد التحسينات' : 'Failed to generate optimizations'));
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

  const toggleCard = (index: number) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Animate chips when they first appear
  useEffect(() => {
    const total =
      (keywordBuckets.add?.length ?? 0) +
      (keywordBuckets.neutral?.length ?? 0) +
      (keywordBuckets.remove?.length ?? 0);
    if (total > 0 && !chipsShownRef.current) {
      chipsShownRef.current = true;
      setChipsAnimated(true);
      const timer = setTimeout(() => setChipsAnimated(false), 2200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [keywordBuckets]);

  // Get applied count
  const appliedCount = optimizations.filter(o => o.applied).length;

  // Section tabs for filtering
  const tabs = [
    { id: 'all', label: 'All Sections', labelAr: 'جميع الأقسام' },
    { id: 'headline', label: 'Headline', labelAr: 'العنوان' },
    { id: 'summary', label: 'Summary', labelAr: 'الملخص' },
    { id: 'experience', label: 'Experience', labelAr: 'الخبرة' },
    { id: 'skills', label: 'Skills', labelAr: 'المهارات' },
  ];

  const [activeSection, setActiveSection] = useState<'all' | 'headline' | 'summary' | 'experience' | 'skills'>('all');

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
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
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

        {/* Show Original/Optimized Toggle */}
        <div className="flex items-center justify-between bg-gray-800/50 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-2 h-2 rounded-full",
              showOptimized ? "bg-emerald-400" : "bg-gray-400"
            )} />
            <div>
              <p className="font-medium text-white">
                {showOptimized
                  ? (isArabic ? 'عرض المحسّن' : 'Showing Optimized')
                  : (isArabic ? 'عرض الأصلي' : 'Showing Original')
                }
              </p>
              <p className="text-sm text-gray-400">
                {showOptimized
                  ? (isArabic ? 'التغييرات المطبقة مرئية' : 'Applied changes are visible')
                  : (isArabic ? 'إصدار السيرة الذاتية الأصلي' : 'Original resume version')
                }
              </p>
            </div>
          </div>
          <button
            onClick={toggleShowOptimized}
            className={cn(
              "relative w-14 h-7 rounded-full transition-colors",
              showOptimized ? 'bg-emerald-600' : 'bg-gray-600'
            )}
          >
            <span
              className={cn(
                "absolute top-1 w-5 h-5 bg-white rounded-full transition-transform",
                showOptimized ? 'left-8' : 'left-1'
              )}
            />
          </button>
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

        {/* Preview Banner for non-premium users */}
        {showPreviewBanner && <PreviewBanner onUpgrade={onUpgrade} t={t} />}

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
                {isArabic ? CHIP_LABELS[`${bucket}Ar` as keyof typeof CHIP_LABELS] : CHIP_LABELS[bucket]}
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
                        bucket === 'remove' && 'border-rose-500/30 bg-rose-500/10 text-rose-400',
                        chipsAnimated && 'animate-pulse'
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

      {/* Optimization Cards Section */}
      <div className="relative space-y-4">
        {/* Preview Watermark */}
        {watermarkVisible && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-6xl font-black uppercase tracking-[0.4em] text-emerald-500/10">
            {t('sections.optimize.preview', 'Preview')}
          </div>
        )}

        {isOptimizing ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-xl border border-white/10 bg-white/5"
              />
            ))}
          </div>
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
                        ? `${isArabic ? 'الخبرة' : 'Experience'} ${opt.sectionId.split('-')[1] ? Number(opt.sectionId.split('-')[1]) + 1 : ''}`
                        : isArabic
                          ? tabs.find(t => t.id === opt.sectionType)?.labelAr
                          : opt.sectionType
                      }
                    </span>
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
                      onClick={() => toggleCard(index)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      {expandedCards.has(index)
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
                          !expandedCards.has(index) && 'line-clamp-3'
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
                          !expandedCards.has(index) && 'line-clamp-3'
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
                        !expandedCards.has(index) && 'line-clamp-4'
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
                      onClick={() => applyOptimization(opt.sectionId)}
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
    </div>
  );
}

export default OptimizeSection;
