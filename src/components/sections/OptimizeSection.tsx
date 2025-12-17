import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import {
  Sparkles,
  Copy,
  Info,
  Lock,
  ChevronDown,
  ChevronUp
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
interface OptimizationCard {
  section?: string;
  label?: string;
  before?: string;
  after?: string;
  index?: number;
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
  onOptimize?: () => Promise<void>;
  onCopy?: () => Promise<void>;
  previewUsed?: boolean;
  onUpgrade?: () => void;
  hasMatchAnalysis?: boolean;
  onClear?: () => void;
  onExport?: () => Promise<void>;
  canExport?: boolean;
}

const emptyKeywords = { add: [], remove: [], neutral: [] };

// === Preview Banner Component ===
function PreviewBanner({ onUpgrade, t }: { onUpgrade?: () => void; t: (key: string, fallback?: string) => string }) {
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
  optimizations = [],
  keywords = emptyKeywords,
  isOptimizing = false,
  onOptimize,
  onCopy,
  previewUsed = false,
  onUpgrade,
  hasMatchAnalysis = false,
  onClear,
}: OptimizeSectionProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const [viewMode, setViewMode] = useState<'split' | 'diff'>('split');
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [chipsAnimated, setChipsAnimated] = useState(false);
  const chipsShownRef = useRef(false);

  // Memoize keyword buckets
  const keywordBuckets = useMemo(() => ({
    add: keywords?.add ?? [],
    remove: keywords?.remove ?? [],
    neutral: keywords?.neutral ?? [],
  }), [keywords]);

  // Conditions
  const watermarkVisible = !isPremium && previewUsed;
  const showPreviewBanner = !isPremium && !previewUsed;

  const handleRun = () => onOptimize?.("auto");

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
                onClick={onClear}
                className="text-xs font-medium text-gray-400 hover:text-red-400 transition-colors"
              >
                {t('common.clear', 'Clear')}
              </button>
            )}
          </div>
        </div>

        {/* Preview Banner for non-premium users */}
        {showPreviewBanner && <PreviewBanner onUpgrade={onUpgrade} t={t} />}

        {/* Match Analysis Required Warning */}
        {!hasMatchAnalysis && (
          <div className="my-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                <Info className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  {t('sections.optimize.matchRequired', 'Match analysis required')}
                </p>
                <p className="text-sm text-gray-300">
                  {t('sections.optimize.matchRequiredDesc', 'Run a match analysis first to provide job context for optimization.')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Optimize Button */}
        <GlassButton
          onClick={handleRun}
          isLoading={isOptimizing}
          disabled={isOptimizing || !hasMatchAnalysis}
          className="w-full"
        >
          <Sparkles className="w-4 h-4 me-2" />
          {hasMatchAnalysis
            ? t('sections.optimize.optimizeBtn', 'Optimize Resume with AI')
            : t('sections.optimize.runMatchFirst', 'Run Match Analysis First')
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
        ) : optimizations.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {optimizations.map((card, index) => (
              <GlassCard key={`${card.section}-${index}`} variant="subtle" padding="sm">
                {/* Card Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
                      {card.section || card.label || `Section ${index + 1}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {onCopy && card.after && (
                      <button
                        onClick={() => onCopy(card.after!)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title={t('common.copy', 'Copy')}
                      >
                        <Copy className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
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

                {/* Card Content */}
                {viewMode === 'split' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-xs text-gray-500 mb-2">
                        {t('sections.optimize.original', 'Original')}
                      </p>
                      <p className={cn(
                        'text-sm text-gray-300 transition-all',
                        !expandedCards.has(index) && 'line-clamp-3'
                      )}>
                        {card.before || t('sections.optimize.noOriginal', 'No original text')}
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
                        {card.after || t('sections.optimize.noOptimized', 'No optimized text')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className={cn(
                      'text-sm text-gray-300 transition-all',
                      !expandedCards.has(index) && 'line-clamp-4'
                    )}>
                      <span className="line-through text-rose-400/70">{card.before}</span>
                      {' → '}
                      <span className="text-emerald-400">{card.after}</span>
                    </p>
                  </div>
                )}
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
