/**
 * RecommendationsModal Component
 *
 * Displays detailed recommendations to improve Vision 2030 alignment.
 * Shows missing skills with impact levels, keywords to add, and before/after examples.
 */

import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Lightbulb, TrendingUp, AlertCircle, Copy, Check, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Vision2030MissingSuggestion } from '../../types/vision2030';
import { GlassButton } from '../ui/GlassButton';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils/cn';

interface RecommendationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingSuggestions: Vision2030MissingSuggestion[];
  isArabic: boolean;
}

export function RecommendationsModal({
  isOpen,
  onClose,
  missingSuggestions,
  isArabic,
}: RecommendationsModalProps) {
  const { t } = useTranslation();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  // Group suggestions by impact level (based on relevanceScore)
  const highImpact = missingSuggestions.filter((s) => s.relevanceScore >= 80);
  const mediumImpact = missingSuggestions.filter((s) => s.relevanceScore >= 50 && s.relevanceScore < 80);
  const lowImpact = missingSuggestions.filter((s) => s.relevanceScore < 50);

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getImpactBadge = (score: number) => {
    if (score >= 80) {
      return {
        label: t('vision2030.recommendations.highImpact', 'High Impact'),
        className: 'bg-red-500/10 text-red-300 border-red-500/20',
      };
    }
    if (score >= 50) {
      return {
        label: t('vision2030.recommendations.mediumImpact', 'Medium Impact'),
        className: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
      };
    }
    return {
      label: t('vision2030.recommendations.lowImpact', 'Low Impact'),
      className: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    };
  };

  const renderSuggestionGroup = (
    suggestions: Vision2030MissingSuggestion[],
    title: string,
    icon: ReturnType<LucideIcon>,
    emptyMessage: string
  ) => {
    if (suggestions.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">{title}</h4>
          <span className="text-xs text-gray-400 dark:text-white/40">({suggestions.length})</span>
        </div>

        <div className="space-y-2">
          {suggestions.map((suggestion, idx) => {
            const badge = getImpactBadge(suggestion.relevanceScore);
            const globalIndex = missingSuggestions.indexOf(suggestion);
            const isCopied = copiedIndex === globalIndex;

            return (
              <div
                key={idx}
                className={cn(
                  glass.card,
                  'p-4 hover:bg-white/[0.03] transition-all'
                )}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {isArabic ? suggestion.skillNameAr : suggestion.skillNameEn}
                      </span>
                      <span className={cn('text-xs px-2 py-0.5 rounded border', badge.className)}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-white/50">
                      {t('vision2030.recommendations.sector', 'Sector')}: {isArabic ? suggestion.sectorNameAr : suggestion.sectorNameEn}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(isArabic ? suggestion.skillNameAr : suggestion.skillNameEn, globalIndex)}
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors shrink-0"
                    title={t('common.copy', 'Copy')}
                  >
                    {isCopied ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400 dark:text-white/40" />
                    )}
                  </button>
                </div>

                <p className="text-sm text-gray-600 dark:text-white/70 leading-relaxed" dir={isArabic ? 'rtl' : 'ltr'}>
                  {isArabic ? suggestion.reasonAr : suggestion.reason}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={cn(
          glass.elevated,
          'relative rounded-xl p-6 max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recommendations-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-gradient-to-b from-gray-900 to-transparent pb-4 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30">
              <Lightbulb className="w-5 h-5 text-amber-400" />
            </div>
            <h3
              id="recommendations-title"
              className="text-xl font-bold text-gray-900 dark:text-white"
            >
              {t('vision2030.recommendations.title', 'Improvement Recommendations')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {missingSuggestions.length === 0 ? (
          <div className="text-center py-12">
            <div className="p-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t('vision2030.recommendations.perfect', 'Excellent Alignment!')}
            </h4>
            <p className="text-gray-500 dark:text-white/60">
              {t('vision2030.recommendations.perfectDesc', 'Your resume already covers all major Vision 2030 sectors. Keep up the great work!')}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary */}
            <div className={cn(glass.card, 'p-4 bg-blue-500/[0.03] border-blue-500/10')}>
              <p className="text-sm text-gray-600 dark:text-white/70 leading-relaxed">
                {t('vision2030.recommendations.intro', 'These recommendations will help strengthen your alignment with Saudi Vision 2030. Focus on high-impact suggestions first.')}
              </p>
            </div>

            {/* High Impact */}
            {renderSuggestionGroup(
              highImpact,
              t('vision2030.recommendations.highPriority', 'High Priority'),
              <AlertCircle className="w-4 h-4 text-red-400" />,
              t('vision2030.recommendations.noHigh', 'No high-priority recommendations')
            )}

            {/* Medium Impact */}
            {renderSuggestionGroup(
              mediumImpact,
              t('vision2030.recommendations.mediumPriority', 'Medium Priority'),
              <TrendingUp className="w-4 h-4 text-amber-400" />,
              t('vision2030.recommendations.noMedium', 'No medium-priority recommendations')
            )}

            {/* Low Impact */}
            {renderSuggestionGroup(
              lowImpact,
              t('vision2030.recommendations.optional', 'Optional Enhancements'),
              <Lightbulb className="w-4 h-4 text-blue-400" />,
              t('vision2030.recommendations.noLow', 'No optional recommendations')
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-white/5">
          <GlassButton variant="secondary" onClick={onClose}>
            {t('common.close', 'Close')}
          </GlassButton>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
