import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { Target, TrendingUp, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils/cn';

interface MatchResult {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
}

interface MatchSectionProps {
  onAnalyze: (jobDescription: string) => Promise<MatchResult>;
  hasResume: boolean;
}

export function MatchSection({ onAnalyze, hasResume }: MatchSectionProps) {
  const { t } = useTranslation();
  const [jobDescription, setJobDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);

  const handleAnalyze = async () => {
    if (!jobDescription.trim() || !hasResume) return;

    setIsAnalyzing(true);
    try {
      const analysis = await onAnalyze(jobDescription);
      setResult(analysis);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/20 border-emerald-500/30';
    if (score >= 60) return 'bg-amber-500/20 border-amber-500/30';
    return 'bg-red-500/20 border-red-500/30';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Section */}
      <GlassCard variant="elevated">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <Target className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {t('sections.match.jobInput.title')}
            </h3>
            <p className="text-sm text-gray-400">
              {t('sections.match.subtitle')}
            </p>
          </div>
        </div>

        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder={t('sections.match.jobInput.placeholder')}
          className={cn(
            'w-full h-64 p-4 rounded-xl resize-none mb-4',
            'bg-white/5 border border-white/10',
            'text-white placeholder-gray-500',
            'focus:outline-none focus:border-emerald-500/50 focus:bg-white/10',
            'transition-all'
          )}
        />

        {!hasResume && (
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-400">{t('sections.match.noResume')}</p>
          </div>
        )}

        <GlassButton
          onClick={handleAnalyze}
          disabled={!jobDescription.trim() || !hasResume || isAnalyzing}
          isLoading={isAnalyzing}
          className="w-full"
        >
          {t('sections.match.analyze')}
        </GlassButton>
      </GlassCard>

      {/* Results Section */}
      <GlassCard variant="elevated">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">
            {t('sections.match.results.title')}
          </h3>
        </div>

        {result ? (
          <div className="space-y-6">
            {/* Score */}
            <div className={cn(
              'p-6 rounded-xl border text-center',
              getScoreBg(result.score)
            )}>
              <p className="text-sm text-gray-400 mb-2">{t('sections.match.results.score')}</p>
              <p className={cn('text-5xl font-bold', getScoreColor(result.score))}>
                {result.score}%
              </p>
            </div>

            {/* Matched Keywords */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <p className="text-sm font-medium text-gray-300">
                  {t('sections.match.results.keywords')} ({result.matchedKeywords.length})
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.matchedKeywords.map((keyword, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            {/* Missing Keywords */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="w-4 h-4 text-red-400" />
                <p className="text-sm font-medium text-gray-300">
                  {t('sections.match.results.missing')} ({result.missingKeywords.length})
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.missingKeywords.map((keyword, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t('sections.match.subtitle')}</p>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
