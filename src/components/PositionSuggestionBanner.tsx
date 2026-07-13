import { useTranslation } from 'react-i18next';
import { Briefcase, Check, X, Lightbulb, Undo2, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils/cn';

interface PositionChange {
  original: string;
  suggested: string;
  change_needed: boolean;
}

interface PositionSuggestion {
  original: string;
  suggested: string;
  reason: string;
  is_necessary: boolean;
  applied?: boolean;
  originalPositions?: string[];
  positionChanges?: PositionChange[];
}

interface PositionSuggestionBannerProps {
  suggestion: PositionSuggestion;
  onApply: (suggested: string) => void;
  onRevert: () => void;
  onDismiss: () => void;
  className?: string;
}

export function PositionSuggestionBanner({
  suggestion,
  onApply,
  onRevert,
  onDismiss,
  className,
}: PositionSuggestionBannerProps) {
  const { t } = useTranslation();
  const applied = suggestion.applied === true;

  // Deduplicate per-position changes for display
  const changes = suggestion.positionChanges ?? [];
  const changesToShow = changes.filter(
    (c, i, arr) => arr.findIndex(x => x.original === c.original) === i // dedupe by original
  );
  const hasGranularChanges = changesToShow.length > 0;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border transition-colors duration-300',
        applied
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-amber-500/30 bg-gradient-to-br from-amber-500/8 via-orange-500/5 to-transparent',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute -top-6 -right-6 w-32 h-32 rounded-full bg-amber-400/10 blur-2xl" />

      <div className="relative p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'p-2 rounded-xl border',
              applied ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-amber-500/15 border-amber-500/30'
            )}>
              {applied
                ? <Check className="w-4 h-4 text-emerald-400" />
                : <Lightbulb className="w-4 h-4 text-amber-400" />
              }
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                {applied
                  ? t('positionSuggestion.applied', 'Position Titles Updated')
                  : t('positionSuggestion.title', 'AI Suggests Position Title Changes')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {applied
                  ? t('positionSuggestion.appliedDesc', 'Relevant positions have been tailored to match the JD.')
                  : t('positionSuggestion.subtitle', 'Tailoring relevant positions may improve ATS recognition')}
              </p>
            </div>
          </div>

          <button
            id="position-suggestion-dismiss"
            onClick={onDismiss}
            aria-label={t('common.dismiss', 'Dismiss')}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Per-position change list (before applying) */}
        {!applied && hasGranularChanges && (
          <div className="mb-3 space-y-1.5">
            {changesToShow.map((c, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap text-xs">
                <div className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border',
                  c.change_needed
                    ? 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10'
                    : 'bg-gray-50 dark:bg-white/3 border-gray-100 dark:border-white/5 opacity-60'
                )}>
                  <Briefcase className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <span className={cn(
                    'font-medium text-gray-600 dark:text-gray-300',
                    c.change_needed && 'line-through decoration-red-400/60'
                  )}>
                    {c.original}
                  </span>
                </div>

                {c.change_needed ? (
                  <>
                    <ArrowRight className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <Briefcase className="w-3 h-3 text-amber-400 flex-shrink-0" />
                      <span className="font-semibold text-amber-700 dark:text-amber-300">{c.suggested}</span>
                    </div>
                  </>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 italic">no change</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Fallback single-arrow display when no granular changes */}
        {!applied && !hasGranularChanges && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
              <Briefcase className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300 line-through decoration-red-400/60">
                {suggestion.original}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <Briefcase className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">{suggestion.suggested}</span>
            </div>
          </div>
        )}

        {/* Applied state: show what was changed */}
        {applied && (
          <div className="mb-3 space-y-1.5">
            {changesToShow.filter(c => c.change_needed).map((c, i) => (
              <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs">
                <Briefcase className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">{c.suggested}</span>
              </div>
            ))}
            {changesToShow.filter(c => c.change_needed).length === 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs">
                <Briefcase className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">{suggestion.suggested}</span>
              </div>
            )}
          </div>
        )}

        {/* Reason */}
        {!applied && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
            💡 {suggestion.reason}
          </p>
        )}

        {/* Apply actions */}
        {!applied && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="position-suggestion-apply"
              onClick={() => onApply(suggestion.suggested)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-[background-color,box-shadow,scale] duration-200',
                'bg-amber-500 hover:bg-amber-400 text-white shadow-sm shadow-amber-500/20',
                'hover:shadow-amber-500/30 hover:shadow-md active:scale-[0.96]'
              )}
            >
              <Check className="w-3.5 h-3.5" />
              {t('positionSuggestion.apply', 'Apply Suggestions')}
            </button>
            <button
              onClick={onDismiss}
              className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              {t('positionSuggestion.keepCurrent', 'Keep Current')}
            </button>
          </div>
        )}

        {/* Revert action */}
        {applied && (
          <button
            id="position-suggestion-revert"
            onClick={onRevert}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-[background-color,scale] duration-200',
              'text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-white/20',
              'hover:bg-gray-100 dark:hover:bg-white/10 active:scale-[0.96]'
            )}
          >
            <Undo2 className="w-3.5 h-3.5" />
            {t('positionSuggestion.revert', 'Revert to Original')}
          </button>
        )}
      </div>
    </div>
  );
}
