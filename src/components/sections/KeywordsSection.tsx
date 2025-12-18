import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import {
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Target,
  Loader2,
  Key
} from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import { useKeywordAnalysis } from '../../hooks/useKeywordAnalysis';

// === Keyword Bar Component (from features/KeywordAnalyzer.tsx) ===
interface KeywordBarProps {
  keyword: string;
  count: number;
  score: number;
  maxScore: number;
  variant?: 'default' | 'matched' | 'missing' | 'emphasis';
  isLoading?: boolean;
}

const KeywordBar = ({ keyword, count, score, maxScore, variant = 'default', isLoading = false }: KeywordBarProps) => {
  const percentage = maxScore > 0 ? Math.min((count / maxScore) * 100, 100) : 0;
  const displayScore = Math.min(score, 100);

  const colors = {
    default: 'bg-gradient-to-r from-cyan-400 via-teal-500 to-emerald-500',
    matched: 'bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500',
    missing: 'bg-gradient-to-r from-rose-400 via-pink-500 to-orange-400',
    emphasis: 'bg-gradient-to-r from-violet-400 via-purple-500 to-indigo-500'
  };

  return (
    <div className="group flex items-center gap-4 py-2.5 px-3 rounded-xl transition-all duration-300 hover:bg-white/5">
      <div className="w-28 flex-shrink-0">
        <span className="text-sm font-semibold text-white truncate block">
          {keyword}
        </span>
      </div>
      <div className="flex-1 relative h-7 bg-white/10 rounded-full overflow-hidden border border-white/10">
        {isLoading && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
        )}
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-out relative',
            colors[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="w-24 text-right flex items-center justify-end gap-1.5">
        <span className="text-sm font-bold text-white bg-white/10 px-2 py-0.5 rounded-md">
          {count}×
        </span>
        <span className={cn(
          'text-xs font-semibold px-2 py-0.5 rounded-md',
          displayScore >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
            displayScore >= 40 ? 'bg-amber-500/20 text-amber-400' :
              'bg-rose-500/20 text-rose-400'
        )}>
          {displayScore}%
        </span>
      </div>
    </div>
  );
};

// === Types ===
interface KeywordItem {
  term: string;
  count?: number;
  score?: number;
  resumeCount?: number;
  jobCount?: number;
  reason?: string;
}

interface Suggestions {
  toAdd?: KeywordItem[];
  needEmphasis?: KeywordItem[];
  wellRepresented?: KeywordItem[];
  overallMatch?: number;
}

interface KeywordsSectionProps {
  resumeText?: string;
  jobDescription?: string;
}

export function KeywordsSection({ resumeText, jobDescription }: KeywordsSectionProps) {
  const { t, i18n } = useTranslation();
  const _isArabic = i18n.language === 'ar';

  const { analysis, isAnalyzing, hasData } = useKeywordAnalysis(
    resumeText || '',
    jobDescription || '',
    { enabled: Boolean(resumeText && jobDescription) }
  );

  const isEmpty = !resumeText || !jobDescription;

  // Memoized data extraction
  const topResumeKeywords = useMemo(() => analysis?.resume?.keywords || [], [analysis]);
  const topJobKeywords = useMemo(() => analysis?.job?.keywords || [], [analysis]);
  const suggestions = useMemo(() => analysis?.suggestions as Suggestions | undefined, [analysis]);
  const overallMatch = suggestions?.overallMatch ?? analysis?.tfidf?.overallMatch ?? 0;

  // Match score color
  const matchColor = overallMatch >= 70
    ? 'text-emerald-400'
    : overallMatch >= 50
      ? 'text-amber-400'
      : 'text-rose-400';

  // Empty state
  if (isEmpty) {
    return (
      <GlassCard variant="elevated">
        <div className="py-12 text-center text-gray-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <h3 className="text-lg font-semibold text-white mb-2">
            {t('sections.keywords.emptyTitle', 'No Data Available')}
          </h3>
          <p>{t('sections.keywords.emptyDesc', 'Upload your resume and add a job description to analyze keyword density.')}</p>
        </div>
      </GlassCard>
    );
  }

  // Loading state
  if (isAnalyzing && !hasData) {
    return (
      <GlassCard variant="elevated">
        <div className="py-12 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
          <p className="text-gray-400">{t('sections.keywords.analyzing', 'Analyzing keywords...')}</p>
        </div>
      </GlassCard>
    );
  }

  const maxResumeScore = topResumeKeywords.length > 0 ? Math.max(...topResumeKeywords.map(k => k.count || 0)) : 0;
  const maxJobScore = topJobKeywords.length > 0 ? Math.max(...topJobKeywords.map(k => k.count || 0)) : 0;

  return (
    <div className="space-y-6">
      {/* Keyword Analysis Overview */}
      <GlassCard variant="elevated">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {t('sections.keywords.title', 'Keyword Analysis')}
              </h3>
              <p className="text-xs text-gray-400">
                {t('sections.keywords.subtitle', 'Based on job description frequency')}
              </p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-gray-400">
              {t('sections.keywords.matchScore', 'Match Score')}
            </span>
            <span className={cn('text-3xl font-bold', matchColor)}>
              {overallMatch}%
            </span>
          </div>
        </div>

        {/* Three Column Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Critical Gaps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-400" />
                <h4 className="font-bold text-white">
                  {t('sections.keywords.criticalGaps', 'Critical Gaps')}
                </h4>
              </div>
              <span className="text-sm font-semibold bg-rose-500/20 text-rose-400 px-2.5 py-1 rounded-full">
                {suggestions?.toAdd?.length || 0}
              </span>
            </div>
            <div className="min-h-[80px] max-h-[150px] overflow-y-auto p-3">
              {suggestions?.toAdd && suggestions.toAdd.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.toAdd.map((kw, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-400 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/20 transition-all cursor-pointer"
                      title={kw.reason || t('sections.keywords.addThis', 'Add this keyword')}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                      {kw.term}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-1" />
                  <p className="text-xs text-gray-500">{t('sections.keywords.noGaps', 'No critical gaps found')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Boost Frequency */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <h4 className="font-bold text-white">
                  {t('sections.keywords.boostFrequency', 'Boost Frequency')}
                </h4>
              </div>
              <span className="text-sm font-semibold bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-full">
                {suggestions?.needEmphasis?.length || 0}
              </span>
            </div>
            <div className="min-h-[80px] max-h-[150px] overflow-y-auto p-3">
              {suggestions?.needEmphasis && suggestions.needEmphasis.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.needEmphasis.map((kw, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400 hover:bg-emerald-500/20 hover:text-emerald-400 transition-all cursor-pointer"
                      title={`${t('sections.keywords.increase', 'Increase from')} ${kw.resumeCount} ${t('sections.keywords.to', 'to')} ${kw.jobCount}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      {kw.term}
                      <span className="opacity-70 text-[10px]">{kw.resumeCount}→{kw.jobCount}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-1" />
                  <p className="text-xs text-gray-500">{t('sections.keywords.frequencyGood', 'Frequency looks good')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Your Strengths */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h4 className="font-bold text-white">
                  {t('sections.keywords.yourStrengths', 'Your Strengths')}
                </h4>
              </div>
              <span className="text-sm font-semibold bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full">
                {suggestions?.wellRepresented?.length || 0}
              </span>
            </div>
            <div className="min-h-[80px] max-h-[150px] overflow-y-auto p-3">
              {suggestions?.wellRepresented && suggestions.wellRepresented.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.wellRepresented.map((kw, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400"
                    >
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      {kw.term}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <p className="text-xs text-gray-500">{t('sections.keywords.noStrengths', 'No strong matches yet')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Keyword Details Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resume Keywords */}
        <GlassCard variant="elevated">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-semibold text-white">
              {t('sections.keywords.resumeKeywords', 'Top Resume Keywords')}
            </h3>
            <span className="ms-auto text-sm text-gray-400">
              {topResumeKeywords.length} {t('sections.keywords.keywords', 'keywords')}
            </span>
          </div>
          {topResumeKeywords.length > 0 ? (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {topResumeKeywords.map((kw: KeywordItem, idx: number) => (
                <KeywordBar
                  key={`${kw.term}-${idx}`}
                  keyword={kw.term}
                  count={kw.count || kw.resumeCount || 0}
                  score={kw.score || Math.round((((kw.count || 0) / maxResumeScore) * 100))}
                  maxScore={maxResumeScore}
                  variant="default"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">{t('sections.keywords.noResumeKeywords', 'No keywords extracted from resume.')}</p>
          )}
        </GlassCard>

        {/* Job Keywords */}
        <GlassCard variant="elevated">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">
              {t('sections.keywords.jobKeywords', 'Top Job Keywords')}
            </h3>
            <span className="ms-auto text-sm text-gray-400">
              {topJobKeywords.length} {t('sections.keywords.keywords', 'keywords')}
            </span>
          </div>
          {topJobKeywords.length > 0 ? (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {topJobKeywords.map((kw: KeywordItem, idx: number) => (
                <KeywordBar
                  key={`${kw.term}-${idx}`}
                  keyword={kw.term}
                  count={kw.count || 0}
                  score={kw.score || Math.round((((kw.count || 0) / maxJobScore) * 100))}
                  maxScore={maxJobScore}
                  variant="default"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">{t('sections.keywords.noJobKeywords', 'No keywords extracted from job description.')}</p>
          )}
        </GlassCard>
      </div>

      {/* Stats Footer */}
      {analysis && (
        <GlassCard variant="subtle" padding="sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-400">{t('sections.keywords.stats.resumeWords', 'Resume Words')}</p>
              <p className="text-2xl font-bold text-white">
                {analysis.resume?.totalWords || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">{t('sections.keywords.stats.uniqueKeywords', 'Unique Keywords')}</p>
              <p className="text-2xl font-bold text-white">
                {analysis.resume?.uniqueWords || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">{t('sections.keywords.stats.jobKeywords', 'Job Keywords')}</p>
              <p className="text-2xl font-bold text-white">
                {analysis.job?.totalWords || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">{t('sections.keywords.stats.matchRate', 'Match Rate')}</p>
              <p className={cn('text-2xl font-bold', matchColor)}>
                {analysis.tfidf?.overallMatch || 0}%
              </p>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
