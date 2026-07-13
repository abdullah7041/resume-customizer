import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronDown, Check, Minus } from 'lucide-react';
import { cn } from '../lib/utils/cn';
import { analytics } from '../services/analytics';
import type { OptimizationResult } from '../types/templates';

interface ScoreDiffBreakdownProps {
  beforeScore: number;
  /** From resultsSummaryData — may be the verified score. */
  afterScore: number;
  potentialScore: number;
  improvement: number | null;
  isScoreVerified: boolean;
  isPlaceholderScore: boolean;
  isPlaceholderImprovement: boolean;
  optimizations: OptimizationResult[];
  className?: string;
}

const EM_DASH = '—';
const DEFAULT_IMPROVEMENT = 15;
const SNIPPET_MAX = 60;

function firstLine(original: string | string[]): string {
  const text = Array.isArray(original) ? original.join(' ') : original;
  const trimmed = (text || '').trim();
  return trimmed.length > SNIPPET_MAX ? `${trimmed.slice(0, SNIPPET_MAX)}…` : trimmed;
}

export function ScoreDiffBreakdown({
  beforeScore,
  afterScore,
  potentialScore,
  improvement,
  isScoreVerified,
  isPlaceholderScore,
  isPlaceholderImprovement,
  optimizations,
  className = '',
}: ScoreDiffBreakdownProps) {
  const { t } = useTranslation();
  const [showCards, setShowCards] = useState(false);

  const total = optimizations.length;
  const applied = optimizations.filter((o) => o.applied).length;

  // Display-only equal share. The underlying projection formula is linear in
  // appliedCount, so this is the honest per-card contribution — never a
  // per-card AI-asserted number. Hidden when improvement is a placeholder.
  const perCardShare =
    total > 0 && !isPlaceholderImprovement
      ? ((improvement ?? DEFAULT_IMPROVEMENT) / total)
      : null;

  const handleToggle = () => {
    const next = !showCards;
    setShowCards(next);
    if (next) {
      analytics.trackScoreDiffExpanded({
        appliedCount: applied,
        totalCount: total,
        isVerified: isScoreVerified,
        improvementEstimate: improvement,
      });
    }
  };

  const beforeDisplay = isPlaceholderScore ? EM_DASH : `${beforeScore}%`;
  const afterDisplay =
    isPlaceholderScore && !isScoreVerified ? EM_DASH : `${afterScore}%`;

  return (
    <div className={cn('mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-4', className)}>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <h4 className="text-sm font-semibold text-white">
          {t('sections.optimize.scoreDiff.title')}
        </h4>
        <span
          className={cn(
            'text-[11px] px-1.5 py-0.5 rounded border',
            isScoreVerified
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/20'
          )}
        >
          {isScoreVerified
            ? t('sections.optimize.scoreDiff.verifiedBadge')
            : t('sections.optimize.scoreDiff.estimateBadge')}
        </span>
      </div>

      <div className="flex items-center gap-3 text-lg font-semibold text-white">
        <span>{beforeDisplay}</span>
        <ArrowRight className="w-4 h-4 text-gray-400" />
        <span className={isScoreVerified ? 'text-emerald-300' : 'text-amber-300'}>
          {afterDisplay}
        </span>
      </div>

      <p className="text-xs text-gray-400 mt-1">
        {t('sections.optimize.scoreDiff.appliedOf', { applied, total })}
      </p>

      {perCardShare !== null && (
        <p className="text-xs text-gray-500 mt-1">
          {t('sections.optimize.scoreDiff.perCardShare', {
            points: perCardShare.toFixed(1),
          })}
        </p>
      )}

      {!isPlaceholderScore && (
        <p className="text-xs text-gray-500 mt-1">
          {t('sections.optimize.scoreDiff.potentialNote', { score: potentialScore })}
        </p>
      )}

      <p className="text-xs text-gray-500 mt-2">
        {isScoreVerified
          ? t('sections.optimize.scoreDiff.verifiedNote')
          : t('sections.optimize.scoreDiff.estimateNote')}
      </p>

      {total > 0 && applied === 0 && (
        <p className="text-xs text-gray-400 mt-2">
          {t('sections.optimize.scoreDiff.noneApplied')}
        </p>
      )}

      {total > 0 && (
        <>
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={showCards}
            className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-200"
          >
            {showCards
              ? t('sections.optimize.scoreDiff.hideCards')
              : t('sections.optimize.scoreDiff.showCards')}
            <ChevronDown className={cn('w-4 h-4 transition-transform', showCards && 'rotate-180')} />
          </button>

          {showCards && (
            <div className="mt-3 space-y-2">
              {optimizations.map((o) => (
                <div
                  key={o.sectionId}
                  className="flex items-start gap-2 text-sm rounded-md bg-white/[0.03] p-2"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex-shrink-0',
                      o.applied ? 'text-emerald-400' : 'text-gray-500'
                    )}
                  >
                    {o.applied ? <Check className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-200">
                        {t(`sections.optimize.tabs.${o.sectionType}`, o.sectionType)}
                      </span>
                      <span
                        className={cn(
                          'text-[11px]',
                          o.applied ? 'text-emerald-300/80' : 'text-gray-500'
                        )}
                      >
                        {o.applied
                          ? t('sections.optimize.scoreDiff.counted')
                          : t('sections.optimize.scoreDiff.notCounted')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {firstLine(o.original)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
