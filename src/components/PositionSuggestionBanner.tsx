import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, ArrowRight, Check, X, Lightbulb } from 'lucide-react';
import { cn } from '../lib/utils/cn';

interface PositionSuggestion {
  original: string;
  suggested: string;
  reason: string;
  is_necessary: boolean;
}

interface PositionSuggestionBannerProps {
  suggestion: PositionSuggestion;
  onApply: (suggested: string) => void;
  onDismiss: () => void;
  className?: string;
}

export function PositionSuggestionBanner({
  suggestion,
  onApply,
  onDismiss,
  className,
}: PositionSuggestionBannerProps) {
  const { t } = useTranslation();
  const [applied, setApplied] = useState(false);

  const handleApply = () => {
    setApplied(true);
    onApply(suggestion.suggested);
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border transition-all duration-300',
        applied
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-amber-500/30 bg-gradient-to-br from-amber-500/8 via-orange-500/5 to-transparent',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      {/* decorative glow */}
      <div className="pointer-events-none absolute -top-6 -right-6 w-32 h-32 rounded-full bg-amber-400/10 blur-2xl" />

      <div className="relative p-4 sm:p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'p-2 rounded-xl border',
              applied
                ? 'bg-emerald-500/15 border-emerald-500/30'
                : 'bg-amber-500/15 border-amber-500/30'
            )}>
              {applied
                ? <Check className="w-4 h-4 text-emerald-400" />
                : <Lightbulb className="w-4 h-4 text-amber-400" />
              }
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                {applied
                  ? t('positionSuggestion.applied', 'Position Title Updated')
                  : t('positionSuggestion.title', 'AI Suggests a Position Title Change')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {applied
                  ? t('positionSuggestion.appliedDesc', 'Your headline has been updated to better match the JD.')
                  : t('positionSuggestion.subtitle', 'Renaming your title may improve ATS recognition')}
              </p>
            </div>
          </div>

          {!applied && (
            <button
              id="position-suggestion-dismiss"
              onClick={onDismiss}
              aria-label={t('common.dismiss', 'Dismiss')}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Title comparison */}
        {!applied && (
          <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
              <Briefcase className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300 line-through decoration-red-400/60">
                {suggestion.original}
              </span>
            </div>

            <ArrowRight className="w-4 h-4 text-amber-400 flex-shrink-0" />

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <Briefcase className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                {suggestion.suggested}
              </span>
            </div>
          </div>
        )}

        {/* Reason */}
        {!applied && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
            💡 {suggestion.reason}
          </p>
        )}

        {/* Actions */}
        {!applied && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="position-suggestion-apply"
              onClick={handleApply}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200',
                'bg-amber-500 hover:bg-amber-400 text-white shadow-sm shadow-amber-500/20',
                'hover:shadow-amber-500/30 hover:shadow-md active:scale-[0.98]'
              )}
            >
              <Check className="w-3.5 h-3.5" />
              {t('positionSuggestion.apply', 'Apply Suggestion')}
            </button>
            <button
              onClick={onDismiss}
              className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              {t('positionSuggestion.keepCurrent', 'Keep Current')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
