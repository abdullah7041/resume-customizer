import { AlertCircle, Check, ChevronDown, Info, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HiddenMatchesCard, type HiddenMatch } from '@/components/HiddenMatchesCard';
import { MirroredKeywordsCard } from '@/components/MirroredKeywordsCard';
import { PositionSuggestionBanner } from '@/components/PositionSuggestionBanner';
import type { GapItem } from '@/components/GapAnalysisCard';
import { GlassCard } from '@/components/ui/GlassCard';
import { cn } from '@/lib/utils/cn';

interface KeywordBuckets {
  add: string[];
  neutral: string[];
  remove: string[];
}

interface PositionSuggestion {
  original: string;
  suggested: string;
  reason: string;
  is_necessary: boolean;
  applied?: boolean;
  originalPositions?: string[];
  positionChanges?: Array<{ original: string; suggested: string; change_needed: boolean }>;
}

interface StrategyBlockProps {
  expanded: boolean;
  hasKeywordData: boolean;
  keywordBuckets: KeywordBuckets;
  gapAnalysis?: GapItem[] | null;
  hiddenMatches?: HiddenMatch[];
  mirroredPhrases?: string[];
  structuralChanges?: string[];
  positionSuggestion?: PositionSuggestion | null;
  positionBannerDismissed: boolean;
  isArabic: boolean;
  onToggle: () => void;
  onApplyPositionSuggestion: (suggested: string) => void;
  onRevertPositionSuggestion: () => void;
  onDismissPositionSuggestion: () => void;
}

const bucketStyles = {
  add: {
    icon: Check,
    titleClass: 'text-emerald-700 dark:text-emerald-300',
    chipClass: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  },
  neutral: {
    icon: Info,
    titleClass: 'text-blue-700 dark:text-blue-300',
    chipClass: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-800 dark:text-blue-300',
  },
  remove: {
    icon: AlertCircle,
    titleClass: 'text-rose-700 dark:text-rose-300',
    chipClass: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 line-through decoration-rose-500/50',
  },
} as const;

export function StrategyBlock({
  expanded,
  hasKeywordData,
  keywordBuckets,
  gapAnalysis,
  hiddenMatches = [],
  mirroredPhrases = [],
  structuralChanges = [],
  positionSuggestion,
  positionBannerDismissed,
  isArabic,
  onToggle,
  onApplyPositionSuggestion,
  onRevertPositionSuggestion,
  onDismissPositionSuggestion,
}: StrategyBlockProps) {
  const { t } = useTranslation();
  const hasPositionSuggestion = Boolean(
    positionSuggestion &&
    !positionBannerDismissed &&
    (positionSuggestion.is_necessary === true || positionSuggestion.applied === true)
  );
  const hasGaps = Array.isArray(gapAnalysis) && gapAnalysis.length > 0;
  const hasHiddenMatches = hiddenMatches.length > 0;
  const hasMirrorData = mirroredPhrases.length > 0 || structuralChanges.length > 0;

  if (!hasKeywordData && !hasGaps && !hasPositionSuggestion && !hasHiddenMatches && !hasMirrorData) {
    return null;
  }

  return (
    <GlassCard padding="none" className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-14 w-full items-center justify-between gap-3 p-4 text-start transition-colors hover:bg-[color:var(--surface-control-hover)] dark:hover:bg-white/5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2">
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-gray-900 dark:text-white">
              {t('sections.optimize.strategy.title', 'Strategy')}
            </span>
            <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
              {t('sections.optimize.strategy.subtitle', 'Keywords, gaps, and title alignment')}
            </span>
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-[color:var(--glass-border)] p-4 text-start dark:border-white/10">
          {hasKeywordData && (
            <div className="grid gap-3 md:grid-cols-3">
              {(['add', 'neutral', 'remove'] as const).map((bucket) => {
                const config = bucketStyles[bucket];
                const Icon = config.icon;
                const items = keywordBuckets[bucket] ?? [];

                return (
                  <div key={bucket} className="rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] p-3 dark:border-white/10 dark:bg-white/5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className={cn('flex items-center gap-2 text-xs font-bold uppercase tracking-wider', config.titleClass)}>
                        <Icon className="h-3.5 w-3.5" />
                        {t(`sections.optimize.chipLabels.${bucket}`)}
                      </p>
                      <span className="rounded-full bg-[color:var(--surface-control-hover)] px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-black/20">
                        {items.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {items.length > 0 ? items.map((token) => (
                        <span key={token} title={token} className={cn('max-w-[150px] truncate rounded-lg border px-2.5 py-1 text-[11px] font-medium', config.chipClass)}>
                          {token}
                        </span>
                      )) : (
                        <span className="py-1 text-xs italic text-gray-500">
                          {t('sections.optimize.noKeywords', 'No keywords identified')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasPositionSuggestion && positionSuggestion && (
            <PositionSuggestionBanner
              suggestion={positionSuggestion}
              onApply={onApplyPositionSuggestion}
              onRevert={onRevertPositionSuggestion}
              onDismiss={onDismissPositionSuggestion}
            />
          )}

          {hasGaps ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                {t('sections.optimize.strategy.gapsTitle', 'Requirement gaps')}
              </h4>
              <div className="space-y-2">
                {gapAnalysis?.map((gap, index) => (
                  <div key={`${gap.severity}-${gap.requirement}-${index}`} className="rounded-lg border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] p-3 dark:border-white/10 dark:bg-black/20">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{gap.requirement}</span>
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                        {gap.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{gap.currentState}</p>
                    <p className="mt-2 text-xs leading-relaxed text-emerald-700 dark:text-emerald-300">{gap.recommendation}</p>
                    {keywordBuckets.add.some((keyword) => gap.recommendation?.toLowerCase().includes(keyword.toLowerCase()) || gap.requirement?.toLowerCase().includes(keyword.toLowerCase())) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {keywordBuckets.add
                          .filter((keyword) => gap.recommendation?.toLowerCase().includes(keyword.toLowerCase()) || gap.requirement?.toLowerCase().includes(keyword.toLowerCase()))
                          .map((keyword) => (
                            <span key={keyword} className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                              {keyword}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
                  <Check className="h-4 w-4 text-emerald-500" />
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {t('sections.optimize.noGapsDetected', 'No Critical Gaps Detected')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isArabic
                      ? 'سيرتك الذاتية متوافقة جيدًا مع المتطلبات الأساسية. راجع الكلمات المفتاحية المقترحة فقط عند الحاجة.'
                      : 'Your resume aligns well with core requirements. Review the suggested keywords only where needed.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {hasHiddenMatches && <HiddenMatchesCard matches={hiddenMatches} />}
          {hasMirrorData && <MirroredKeywordsCard mirroredPhrases={mirroredPhrases} structuralChanges={structuralChanges} />}
        </div>
      )}
    </GlassCard>
  );
}
