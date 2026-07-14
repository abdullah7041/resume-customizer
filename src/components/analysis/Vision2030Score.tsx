import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Vision2030Analysis } from '../../lib/utils/vision2030Analyzer';
import { TrendingUp, Target, Lightbulb, ChevronRight } from 'lucide-react';
import { SectorIcon } from '../../lib/utils/vision2030Icons';
import { Vision2030CalculationModal } from '../ui/Vision2030CalculationModal';

interface Vision2030ScoreProps {
  analysis: Vision2030Analysis;
}

function getScoreColor(score: number) {
  if (score >= 70) return 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/15';
  if (score >= 40) return 'text-amber-700 dark:text-amber-300 bg-amber-500/15';
  return 'text-red-700 dark:text-red-300 bg-red-500/15';
}

export function Vision2030Score({ analysis }: Vision2030ScoreProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const [showCalculationHelp, setShowCalculationHelp] = useState(false);

  const getScoreLabel = (score: number) => {
    if (score >= 70) return t('vision2030.excellent', 'Excellent');
    if (score >= 40) return t('vision2030.good', 'Good');
    return t('vision2030.needsImprovement', 'Needs Improvement');
  };

  return (
    <div className="bg-panel rounded-2xl p-6 border border-line">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
          <Target className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-ink">
            {t('vision2030.scoreCard.title', 'Vision 2030 Alignment')}
          </h3>
          <p className="text-sm text-ink-muted">
            {t('vision2030.scoreCard.subtitle', 'How your skills align with Saudi national priorities')}
          </p>
        </div>
      </div>

      {/* Overall Score */}
      <div className="bg-surface rounded-xl p-6 mb-6 border border-line">
        <div className="flex items-center justify-between mb-4">
          <span className="text-ink-muted flex items-center gap-2">
            {t('vision2030.scoreCard.overallScore', 'Overall Score')}
            <button
              type="button"
              onClick={() => setShowCalculationHelp(true)}
              className="inline-flex items-center justify-center w-5 h-5 ml-2 text-xs font-bold text-ink-accent bg-ink-accent/10 rounded-full hover:bg-ink-accent/20 transition-colors ring-1 ring-ink-accent/30"
              title={t('vision2030.scoreCard.calculationTitle', 'How is this score calculated?')}
              aria-label={t('vision2030.scoreCard.calculationAria', 'Show calculation details')}
            >
              ?
            </button>
          </span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(analysis.overallScore)}`}>
            {getScoreLabel(analysis.overallScore)}
          </span>
        </div>
        <div className="flex items-end gap-4">
          <span className="text-5xl font-bold text-ink-accent">
            {analysis.overallScore}
          </span>
          <span className="text-2xl text-ink-soft mb-1">/100</span>
        </div>
        <div className="w-full bg-ink/10 rounded-full h-3 mt-4">
          <div
            className="w-full origin-left rtl:origin-right bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full transition-transform duration-500"
            style={{ transform: `scaleX(${Math.min(Math.max(analysis.overallScore, 0), 100) / 100})` }}
          />
        </div>
      </div>

      {/* Sector Breakdown */}
      <div className="mb-6">
        <h4 className="font-medium text-ink mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          {t('vision2030.sectorBreakdown', 'Sector Breakdown')}
        </h4>
        <div className="space-y-3">
          {analysis.sectorBreakdown.slice(0, 5).map(sector => (
            <div key={sector.sectorId} className="bg-surface rounded-lg p-4 border border-line">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-ink-accent/10 flex items-center justify-center">
                    <SectorIcon sectorId={sector.sectorId} className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="font-medium text-ink">
                    {isArabic ? sector.sectorNameAr : sector.sectorNameEn}
                  </span>
                </div>
                <span className="text-sm text-ink-muted">
                  {sector.matchedCount}/{sector.totalSkills} {t('vision2030.skills', 'skills')}
                </span>
              </div>
              <div className="w-full bg-ink/10 rounded-full h-2">
                <div
                  className="w-full origin-left rtl:origin-right bg-emerald-500 h-2 rounded-full transition-transform duration-500"
                  style={{ transform: `scaleX(${Math.min(Math.max(sector.score, 0), 100) / 100})` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Matched Skills */}
      {analysis.matchedSkills.length > 0 && (
        <div className="mb-6">
          <h4 className="font-medium text-ink mb-4">
            {t('vision2030.matchedSkills', 'Matched Vision 2030 Skills')}
          </h4>
          <div className="flex flex-wrap gap-2">
            {analysis.matchedSkills.map((skill, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-ink-accent/10 text-ink-accent rounded-full text-sm"
              >
                {isArabic ? skill.skillNameAr : skill.skillNameEn}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {analysis.missingSuggestions.length > 0 && (
        <div>
          <h4 className="font-medium text-ink mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            {t('vision2030.suggestions', 'Suggested Skills to Add')}
          </h4>
          <div className="space-y-2">
            {analysis.missingSuggestions.map((suggestion, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-surface rounded-lg p-3 border border-line hover:bg-ink/5 transition-colors"
              >
                <div>
                  <span className="font-medium text-ink">
                    {isArabic ? suggestion.skillNameAr : suggestion.skillNameEn}
                  </span>
                  <p className="text-xs text-ink-muted">
                    {isArabic ? suggestion.reasonAr : suggestion.reason}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-ink-soft rtl:rotate-180" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vision 2030 Badge */}
      <div className="mt-6 pt-6 border-t border-line">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">
            2030
          </div>
          <p className="text-xs text-ink-muted">
            {t('vision2030.analysisNote', 'Analysis based on Saudi Vision 2030 sector priorities')}
          </p>
        </div>
      </div>

      {/* Calculation explanation modal */}
      <Vision2030CalculationModal
        isOpen={showCalculationHelp}
        onClose={() => setShowCalculationHelp(false)}
        isArabic={isArabic}
      />
    </div>
  );
}
