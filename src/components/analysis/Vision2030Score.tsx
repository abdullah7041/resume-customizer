import { useTranslation } from 'react-i18next';
import { useDirection } from '../providers/DirectionProvider';
import { Vision2030Analysis } from '../../lib/utils/vision2030Analyzer';
import { TrendingUp, Target, Lightbulb, ChevronRight } from 'lucide-react';
import { SectorIcon } from '../../lib/utils/vision2030Icons';

interface Vision2030ScoreProps {
  analysis: Vision2030Analysis;
}

export function Vision2030Score({ analysis }: Vision2030ScoreProps) {
  const { i18n } = useTranslation();
  const { isRTL } = useDirection();
  const isArabic = i18n.language === 'ar';

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-600 bg-emerald-100';
    if (score >= 40) return 'text-amber-600 bg-amber-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return isArabic ? 'ممتاز' : 'Excellent';
    if (score >= 40) return isArabic ? 'جيد' : 'Good';
    return isArabic ? 'يحتاج تحسين' : 'Needs Improvement';
  };

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-200">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
          <Target className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {isArabic ? 'توافق رؤية 2030' : 'Vision 2030 Alignment'}
          </h3>
          <p className="text-sm text-gray-500">
            {isArabic
              ? 'مدى توافق مهاراتك مع أولويات المملكة'
              : 'How your skills align with Saudi national priorities'}
          </p>
        </div>
      </div>

      {/* Overall Score */}
      <div className="bg-white rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-600">
            {isArabic ? 'النتيجة الإجمالية' : 'Overall Score'}
          </span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(analysis.overallScore)}`}>
            {getScoreLabel(analysis.overallScore)}
          </span>
        </div>
        <div className="flex items-end gap-4">
          <span className="text-5xl font-bold text-emerald-600">
            {analysis.overallScore}
          </span>
          <span className="text-2xl text-gray-400 mb-1">/100</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 mt-4">
          <div
            className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${analysis.overallScore}%` }}
          />
        </div>
      </div>

      {/* Sector Breakdown */}
      <div className="mb-6">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          {isArabic ? 'توزيع القطاعات' : 'Sector Breakdown'}
        </h4>
        <div className="space-y-3">
          {analysis.sectorBreakdown.slice(0, 5).map(sector => (
            <div key={sector.sectorId} className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <SectorIcon sectorId={sector.sectorId} className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="font-medium text-gray-800">
                    {isArabic ? sector.sectorNameAr : sector.sectorNameEn}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {sector.matchedCount}/{sector.totalSkills} {isArabic ? 'مهارات' : 'skills'}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${sector.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Matched Skills */}
      {analysis.matchedSkills.length > 0 && (
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-4">
            {isArabic ? 'المهارات المتوافقة' : 'Matched Vision 2030 Skills'}
          </h4>
          <div className="flex flex-wrap gap-2">
            {analysis.matchedSkills.map((skill, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm"
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
          <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            {isArabic ? 'مهارات مقترحة للإضافة' : 'Suggested Skills to Add'}
          </h4>
          <div className="space-y-2">
            {analysis.missingSuggestions.map((suggestion, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-white rounded-lg p-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <span className="font-medium text-gray-800">
                    {isArabic ? suggestion.skillNameAr : suggestion.skillNameEn}
                  </span>
                  <p className="text-xs text-gray-500">
                    {isArabic ? suggestion.reasonAr : suggestion.reason}
                  </p>
                </div>
                <ChevronRight className={`w-5 h-5 text-gray-400 ${isRTL ? 'rotate-180' : ''}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vision 2030 Badge */}
      <div className="mt-6 pt-6 border-t border-emerald-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">
            2030
          </div>
          <p className="text-xs text-gray-500">
            {isArabic
              ? 'التحليل مبني على أولويات القطاعات في رؤية المملكة 2030'
              : 'Analysis based on Saudi Vision 2030 sector priorities'}
          </p>
        </div>
      </div>
    </div>
  );
}




