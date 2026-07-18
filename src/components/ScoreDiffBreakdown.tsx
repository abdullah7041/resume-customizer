import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronDown, Check, Minus, AlertTriangle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { analytics } from '@/services/analytics';
import { partitionOptimizations } from '@/lib/optimize/actionability';
import type { ScorePresentation } from '@/lib/optimize/scoreModel';
import type { OptimizationResult } from '@/types/templates';

interface ScoreDiffBreakdownProps {
  presentation: ScorePresentation;
  /** The generation-time estimate (never the verified delta). */
  improvement: number | null;
  optimizations: OptimizationResult[];
  className?: string;
}

const EM_DASH = '—';
const SNIPPET_MAX = 60;

function firstLine(original: string | string[]): string {
  const text = Array.isArray(original) ? original.join(' ') : original;
  const trimmed = (text || '').trim();
  return trimmed.length > SNIPPET_MAX ? `${trimmed.slice(0, SNIPPET_MAX)}…` : trimmed;
}

export function ScoreDiffBreakdown({
  presentation,
  improvement,
  optimizations,
  className = '',
}: ScoreDiffBreakdownProps) {
  const { t } = useTranslation();
  const [showCards, setShowCards] = useState(false);

  const { actionable, recommendations } = partitionOptimizations(optimizations);
  const {
    baselineScore,
    verifiedAllSuggestionsScore,
    displayState,
    arrowTarget,
    arrowIsVerified,
    isPlaceholderScore,
    estimateIsZero,
    counts,
  } = presentation;

  const estimateMeaningful = improvement !== null && improvement >= 1;

  // Display-only equal share over ACTIONABLE cards. The projection is linear in the
  // applied count, so this is the honest per-card contribution — hidden entirely
  // when the estimate is missing, zero, or rounds to +0.0.
  const perCardShare = counts.actionableTotal > 0 && estimateMeaningful
    ? improvement! / counts.actionableTotal
    : null;
  const showPerCardShare = perCardShare !== null && perCardShare >= 0.05;

  // "Up to X%" only when a meaningful estimate predicts an actual gain.
  const potentialScore = presentation.allSuggestionsPotentialEstimate;
  const showPotentialNote = !isPlaceholderScore &&
    potentialScore !== null &&
    baselineScore !== null &&
    potentialScore > baselineScore;

  const handleToggle = () => {
    const next = !showCards;
    setShowCards(next);
    if (next) {
      analytics.trackScoreDiffExpanded({
        appliedCount: counts.actionableApplied,
        totalCount: counts.actionableTotal,
        isVerified: arrowIsVerified,
        improvementEstimate: improvement,
      });
    }
  };

  const beforeDisplay = isPlaceholderScore ? EM_DASH : `${baselineScore}%`;
  const afterDisplay = arrowTarget !== null ? `${arrowTarget}%` : EM_DASH;

  return (
    <div className={cn('mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-4', className)}>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <h4 className="text-sm font-semibold text-white">
          {t('sections.optimize.scoreDiff.title')}
        </h4>
        <span
          className={cn(
            'text-[11px] px-1.5 py-0.5 rounded border',
            arrowIsVerified
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/20'
          )}
        >
          {arrowIsVerified
            ? t('sections.optimize.scoreDiff.verifiedBadge')
            : t('sections.optimize.scoreDiff.estimateBadge')}
        </span>
      </div>

      <div className="flex items-center gap-3 text-lg font-semibold text-white">
        <span>{beforeDisplay}</span>
        <ArrowRight className="w-4 h-4 text-gray-400" />
        <span className={arrowIsVerified ? 'text-emerald-300' : 'text-amber-300'}>
          {afterDisplay}
        </span>
      </div>

      <p className="text-xs text-gray-400 mt-1">
        {t('sections.optimize.scoreDiff.appliedOf', { applied: counts.actionableApplied, total: counts.actionableTotal })}
      </p>

      {recommendations.length > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          {t('sections.optimize.scoreDiff.recommendationsAside', { total: recommendations.length })}
        </p>
      )}

      {showPerCardShare && (
        <p className="text-xs text-gray-500 mt-1">
          {t('sections.optimize.scoreDiff.perCardShare', {
            points: perCardShare!.toFixed(1),
          })}
        </p>
      )}

      {showPotentialNote && (
        <p className="text-xs text-gray-500 mt-1">
          {t('sections.optimize.scoreDiff.potentialNote', { score: potentialScore })}
        </p>
      )}

      {estimateIsZero && displayState === 'current' && (
        <p className="text-xs text-gray-500 mt-1">
          {t('sections.optimize.scoreDiff.noGainPredicted')}
        </p>
      )}

      {/* Verified potential row (target, not current) when not everything is applied. */}
      {displayState === 'verified_potential' && verifiedAllSuggestionsScore !== null && (
        <p className="text-xs font-semibold text-emerald-300 mt-1">
          {t('sections.optimize.verifiedPotentialLine', { score: verifiedAllSuggestionsScore })}
        </p>
      )}

      <p className="text-xs text-gray-500 mt-2">
        {arrowIsVerified
          ? t('sections.optimize.scoreDiff.verifiedNote')
          : t('sections.optimize.scoreDiff.estimateNote')}
      </p>

      {counts.actionableTotal > 0 && counts.actionableApplied === 0 && (
        <p className="text-xs text-gray-400 mt-2">
          {t('sections.optimize.scoreDiff.noneApplied')}
        </p>
      )}

      {optimizations.length > 0 && (
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
              {actionable.map((o) => {
                const counted = o.applied && o.mergeStatus !== 'failed';
                return (
                  <div
                    key={o.sectionId}
                    className="flex items-start gap-2 text-sm rounded-md bg-white/[0.03] p-2"
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex-shrink-0',
                        counted ? 'text-emerald-400' : o.mergeStatus === 'failed' ? 'text-amber-400' : 'text-gray-500'
                      )}
                    >
                      {counted
                        ? <Check className="w-4 h-4" />
                        : o.mergeStatus === 'failed'
                          ? <AlertTriangle className="w-4 h-4" />
                          : <Minus className="w-4 h-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-200">
                          {t(`sections.optimize.tabs.${o.sectionType}`, o.sectionType)}
                        </span>
                        <span
                          className={cn(
                            'text-[11px]',
                            counted ? 'text-emerald-300/80' : o.mergeStatus === 'failed' ? 'text-amber-300/80' : 'text-gray-500'
                          )}
                        >
                          {counted
                            ? t('sections.optimize.scoreDiff.counted')
                            : o.mergeStatus === 'failed'
                              ? t('sections.optimize.scoreDiff.mergeFailed')
                              : t('sections.optimize.scoreDiff.notCounted')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {firstLine(o.original)}
                      </p>
                    </div>
                  </div>
                );
              })}

              {recommendations.length > 0 && (
                <>
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 mt-3">
                    <Lightbulb className="w-3.5 h-3.5" />
                    {t('sections.optimize.scoreDiff.recommendationsHeading')}
                  </p>
                  {recommendations.map((o) => (
                    <div
                      key={o.sectionId}
                      className="flex items-start gap-2 text-sm rounded-md bg-white/[0.03] p-2"
                    >
                      <span className="mt-0.5 flex-shrink-0 text-gray-500">
                        <Minus className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-gray-200">
                            {t(`sections.optimize.tabs.${o.sectionType}`, o.sectionType)}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {t('sections.optimize.scoreDiff.recommendationLabel')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {firstLine(o.optimized)}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
