import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { Key, Plus, Check, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils/cn';

interface KeywordAnalysis {
  atsScore: number;
  density: number;
  categories: {
    technical: string[];
    soft: string[];
    industry: string[];
    action: string[];
  };
  suggestions: string[];
}

interface KeywordsSectionProps {
  analysis: KeywordAnalysis | null;
  onAddKeyword: (keyword: string) => void;
  addedKeywords: string[];
}

export function KeywordsSection({
  analysis,
  onAddKeyword,
  addedKeywords
}: KeywordsSectionProps) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<keyof KeywordAnalysis['categories']>('technical');

  const categories = [
    { id: 'technical', label: t('sections.keywords.categories.technical'), color: 'blue' },
    { id: 'soft', label: t('sections.keywords.categories.soft'), color: 'purple' },
    { id: 'industry', label: t('sections.keywords.categories.industry'), color: 'amber' },
    { id: 'action', label: t('sections.keywords.categories.action'), color: 'emerald' },
  ] as const;

  const getColorClasses = (color: string, filled = false) => {
    const colors: Record<string, { bg: string; text: string; filled: string }> = {
      blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', filled: 'bg-blue-500 text-white' },
      purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', filled: 'bg-purple-500 text-white' },
      amber: { bg: 'bg-amber-500/20', text: 'text-amber-400', filled: 'bg-amber-500 text-white' },
      emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', filled: 'bg-emerald-500 text-white' },
    };
    return filled ? colors[color].filled : `${colors[color].bg} ${colors[color].text}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Score Cards */}
      <GlassCard variant="elevated" className="lg:col-span-1">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
            <Key className="w-5 h-5 text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">
            {t('sections.keywords.analysis.title')}
          </h3>
        </div>

        {analysis ? (
          <div className="space-y-4">
            {/* ATS Score */}
            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">
                  {t('sections.keywords.analysis.atsScore')}
                </span>
                <span className={cn(
                  'text-2xl font-bold',
                  analysis.atsScore >= 80 ? 'text-emerald-400' :
                  analysis.atsScore >= 60 ? 'text-amber-400' : 'text-red-400'
                )}>
                  {analysis.atsScore}%
                </span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    analysis.atsScore >= 80 ? 'bg-emerald-500' :
                    analysis.atsScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
                  )}
                  style={{ width: `${analysis.atsScore}%` }}
                />
              </div>
            </div>

            {/* Keyword Density */}
            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">
                  {t('sections.keywords.analysis.density')}
                </span>
                <span className="text-lg font-semibold text-white">
                  {analysis.density}%
                </span>
              </div>
            </div>

            {/* Category Counts */}
            <div className="grid grid-cols-2 gap-2">
              {categories.map(cat => (
                <div
                  key={cat.id}
                  className={cn(
                    'p-3 rounded-lg text-center cursor-pointer transition-all',
                    activeCategory === cat.id
                      ? getColorClasses(cat.color, true)
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  )}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <p className="text-lg font-bold">
                    {analysis.categories[cat.id]?.length || 0}
                  </p>
                  <p className="text-xs">{cat.label}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-gray-500">
            <Key className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Upload a resume to analyze keywords</p>
          </div>
        )}
      </GlassCard>

      {/* Keywords Display */}
      <GlassCard variant="elevated" className="lg:col-span-2">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">
            {categories.find(c => c.id === activeCategory)?.label}
          </h3>
        </div>

        {analysis ? (
          <div className="space-y-6">
            {/* Current Keywords */}
            <div>
              <p className="text-sm text-gray-400 mb-3">Found in your resume</p>
              <div className="flex flex-wrap gap-2">
                {analysis.categories[activeCategory]?.map((keyword, i) => (
                  <span
                    key={i}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium',
                      getColorClasses(categories.find(c => c.id === activeCategory)?.color || 'blue')
                    )}
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            {/* Suggestions */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <p className="text-sm text-gray-400">
                  {t('sections.keywords.suggestions.title')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.suggestions.map((keyword, i) => {
                  const isAdded = addedKeywords.includes(keyword);
                  return (
                    <button
                      key={i}
                      onClick={() => !isAdded && onAddKeyword(keyword)}
                      disabled={isAdded}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                        isAdded
                          ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                          : 'bg-white/10 text-white hover:bg-emerald-500/20 hover:text-emerald-400'
                      )}
                    >
                      {isAdded ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      {keyword}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-gray-500">
            <p>No keywords to display</p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
