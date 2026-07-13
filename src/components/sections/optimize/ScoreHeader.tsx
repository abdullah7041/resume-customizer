import { Check, ChevronDown, Code2, GraduationCap, Loader2, RotateCcw, Users, Briefcase, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GlassButton } from '@/components/ui/GlassButton';
import { cn } from '@/lib/utils/cn';
import type { CategoryScoresData } from '@/components/ScoreBreakdown';

type CategoryKey = keyof CategoryScoresData;

interface ScoreHeaderProps {
  beforeScore: number;
  afterScore: number;
  isPlaceholderScore: boolean;
  isPlaceholderImprovement: boolean;
  isScoreVerified: boolean;
  isAutoVerifying: boolean;
  verifyAnomaly: boolean;
  verifyRetryUsed: boolean;
  appliedCount: number;
  totalCount: number;
  scoreDeltaLabel: string;
  scoreDeltaClass: string;
  scoreDelta: number;
  categoryScores?: CategoryScoresData | null;
  expanded: boolean;
  expandedCategories: Set<CategoryKey>;
  isArabic: boolean;
  isOptimizing: boolean;
  canExport?: boolean;
  onToggleExpanded: () => void;
  onToggleCategory: (category: CategoryKey) => void;
  onRetryVerify: () => void;
  onRerun: () => void;
  onContinue: () => void;
}

const categoryConfig = {
  hard_skills: { icon: Code2, color: 'text-blue-500', bar: 'bg-blue-500' },
  experience: { icon: Briefcase, color: 'text-purple-500', bar: 'bg-purple-500' },
  education: { icon: GraduationCap, color: 'text-amber-500', bar: 'bg-amber-500' },
  soft_skills: { icon: Users, color: 'text-emerald-500', bar: 'bg-emerald-500' },
} as const;

const categoryLabels: Record<CategoryKey, string> = {
  hard_skills: 'hardSkills',
  experience: 'experience',
  education: 'education',
  soft_skills: 'softSkills',
};

export function ScoreHeader({
  beforeScore,
  afterScore,
  isPlaceholderScore,
  isPlaceholderImprovement,
  isScoreVerified,
  isAutoVerifying,
  verifyAnomaly,
  verifyRetryUsed,
  appliedCount,
  totalCount,
  scoreDeltaLabel,
  scoreDeltaClass,
  scoreDelta,
  categoryScores,
  expanded,
  expandedCategories,
  isArabic,
  isOptimizing,
  canExport,
  onToggleExpanded,
  onToggleCategory,
  onRetryVerify,
  onRerun,
  onContinue,
}: ScoreHeaderProps) {
  const { t } = useTranslation();
  const progress = totalCount > 0 ? Math.round((appliedCount / totalCount) * 100) : 0;
  const ScoreDeltaIcon = scoreDelta < 0 ? TrendingDown : TrendingUp;
  const categories = categoryScores
    ? (Object.keys(categoryLabels) as CategoryKey[]).filter((key) => categoryScores[key])
    : [];

  return (
    <div className="sticky top-2 z-30 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--surface-glass-elevated)]/95 p-3 shadow-lg shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-gray-950/90">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(220px,0.9fr)_auto] lg:items-center">
        <div className="min-w-0 text-start">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('text-2xl font-bold tabular-nums', isPlaceholderScore ? 'text-gray-500 italic' : 'text-gray-900 dark:text-white')}>
              {isPlaceholderScore ? '-' : `${beforeScore}%`}
            </span>
            <span className={cn('text-gray-400', isArabic && 'rotate-180')}>-&gt;</span>
            {verifyAnomaly ? (
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-300">
                {t('sections.optimize.verifyAnomalyTitle', "Couldn't verify the new score")}
              </span>
            ) : (
              <span className={cn(
                'text-2xl font-bold tabular-nums',
                isPlaceholderScore || isPlaceholderImprovement
                  ? 'text-gray-500 italic'
                  : isScoreVerified
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent'
                    : 'text-gray-600 dark:text-gray-300'
              )}>
                {isPlaceholderScore || isPlaceholderImprovement
                  ? '-'
                  : isScoreVerified
                    ? `${afterScore}%`
                    : t('sections.optimize.scoreHeader.projectedScore', { defaultValue: 'Projected ~{{score}}%', score: afterScore })}
              </span>
            )}
            {isScoreVerified && !verifyAnomaly && (
              <span
                className="inline-flex min-h-7 items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                title={t('sections.optimize.verifiedTooltip', 'We re-scored your optimized resume against this job description')}
              >
                <Check className="h-3.5 w-3.5" />
                {t('sections.optimize.scoreHeader.verified', 'verified')}
              </span>
            )}
            {!isPlaceholderScore && !isPlaceholderImprovement && (
              <span className={cn('inline-flex min-h-7 items-center gap-1 rounded-full border px-2 text-xs font-bold', scoreDeltaClass)}>
                {scoreDelta !== 0 && <ScoreDeltaIcon className="h-3.5 w-3.5" />}
                {scoreDeltaLabel}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            {isAutoVerifying && (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('sections.optimize.verifying', 'Verifying...')}
              </span>
            )}
            {verifyAnomaly && (
              <button
                type="button"
                onClick={onRetryVerify}
                disabled={verifyRetryUsed || isAutoVerifying}
                className="min-h-8 rounded-lg border border-amber-500/30 px-3 font-semibold text-amber-700 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:text-amber-300"
              >
                {isAutoVerifying ? t('sections.optimize.verifying', 'Verifying...') : t('sections.optimize.retryVerify', 'Retry')}
              </button>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-300">
            <span>{t('sections.optimize.scoreHeader.progress', { defaultValue: '{{applied}}/{{total}} applied', applied: appliedCount, total: totalCount })}</span>
            <span>{progress}%</span>
          </div>
          <div className={cn('flex h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10', isArabic && 'justify-end')}>
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
          <GlassButton variant="ghost" size="sm" onClick={onRerun} disabled={isOptimizing} leftIcon={<RotateCcw className="h-3.5 w-3.5" />} className="w-full sm:w-auto">
            {t('sections.optimize.scoreHeader.rerun', 'Re-run')}
          </GlassButton>
          <GlassButton variant="primary" size="sm" onClick={onContinue} disabled={!canExport} className="w-full sm:w-auto">
            {t('sections.optimize.scoreHeader.continue', 'Continue')}
          </GlassButton>
          {categories.length > 0 && (
            <button
              type="button"
              onClick={onToggleExpanded}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--glass-border)] px-3 text-xs font-semibold text-gray-600 transition-colors hover:bg-[color:var(--surface-control-hover)] dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10 sm:w-auto"
            >
              {t('sections.optimize.scoreHeader.breakdown', 'Breakdown')}
              <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
            </button>
          )}
        </div>
      </div>

      {expanded && categories.length > 0 && (
        <div className="mt-4 grid gap-3 border-t border-[color:var(--glass-border)] pt-4 text-start dark:border-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((key) => {
            const item = categoryScores?.[key];
            if (!item) return null;
            const Icon = categoryConfig[key].icon;
            const percent = item.max > 0 ? Math.min(100, Math.round((item.score / item.max) * 100)) : 0;
            const isOpen = expandedCategories.has(key);

            return (
              <div key={key} className="rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] p-3 dark:border-white/10 dark:bg-white/5">
                <button type="button" onClick={() => onToggleCategory(key)} className="flex min-h-11 w-full items-center justify-between gap-3 text-start">
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className={cn('h-4 w-4 shrink-0', categoryConfig[key].color)} />
                    <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {t(`optimize.scoreBreakdown.categories.${categoryLabels[key]}`, key)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-gray-700 dark:text-gray-200">{item.score}/{item.max}</span>
                </button>
                <div className={cn('mt-2 flex h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-black/30', isArabic && 'justify-end')}>
                  <div className={cn('h-full rounded-full', categoryConfig[key].bar)} style={{ width: `${percent}%` }} />
                </div>
                {isOpen && item.reasoning && (
                  <p className="mt-3 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{item.reasoning}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
