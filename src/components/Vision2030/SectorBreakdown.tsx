/**
 * SectorBreakdown Component
 *
 * Displays detailed sector-by-sector alignment analysis.
 * Shows matched skills, scores, and reasoning for each Vision 2030 sector.
 */

import { useTranslation } from 'react-i18next';
import { TrendingUp, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Vision2030SectorBreakdown, Vision2030MatchedSkill } from '../../types/vision2030';
import { SectorIcon } from '../../lib/utils/vision2030Icons';
import { GlassCard } from '../ui/GlassCard';

interface SectorBreakdownProps {
  sectorBreakdown: Vision2030SectorBreakdown[];
  matchedSkills: Vision2030MatchedSkill[];
  isArabic: boolean;
}

const getScoreColor = (score: number) => {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
};

const getScoreBg = (score: number) => {
  if (score >= 70) return 'from-emerald-600 to-emerald-400';
  if (score >= 40) return 'from-amber-600 to-amber-400';
  return 'from-red-600 to-red-400';
};

export function SectorBreakdown({ sectorBreakdown, matchedSkills, isArabic }: SectorBreakdownProps) {
  const { t } = useTranslation();
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());

  const toggleSector = (sectorId: string) => {
    setExpandedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(sectorId)) {
        next.delete(sectorId);
      } else {
        next.add(sectorId);
      }
      return next;
    });
  };

  // Sort sectors by score (highest first)
  const sortedSectors = [...sectorBreakdown].sort((a, b) => b.score - a.score);

  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-5 h-5 text-emerald-400" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          {t('vision2030.breakdown.title', 'Detailed Sector Analysis')}
        </h3>
      </div>

      <div className="space-y-3">
        {sortedSectors.map((sector) => {
          const isExpanded = expandedSectors.has(sector.sectorId);
          const sectorSkills = matchedSkills.filter((skill) => skill.sectorId === sector.sectorId);

          return (
            <div
              key={sector.sectorId}
              className="rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden bg-gradient-to-br from-white/[0.02] to-white/[0.01] hover:border-gray-300 dark:hover:border-white/20 transition-colors"
            >
              {/* Sector Header */}
              <button
                type="button"
                onClick={() => toggleSector(sector.sectorId)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${sector.score > 0 ? 'bg-emerald-500/10' : 'bg-gray-100 dark:bg-white/5'}`}>
                    <SectorIcon
                      sectorId={sector.sectorId}
                      className={`w-5 h-5 ${sector.score > 0 ? 'text-emerald-400' : 'text-gray-300 dark:text-white/20'}`}
                    />
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-gray-800 dark:text-white/90">
                      {isArabic ? sector.sectorNameAr : sector.sectorNameEn}
                    </h4>
                    <p className="text-xs text-gray-400 dark:text-white/50">
                      {sector.matchedCount} / {sector.totalSkills} {t('vision2030.breakdown.skillsMatched', 'skills matched')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Score */}
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 dark:bg-gray-900/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full w-full origin-left rtl:origin-right bg-gradient-to-r ${getScoreBg(sector.score)} transition-transform duration-1000`}
                        style={{ transform: `scaleX(${Math.min(Math.max(sector.score, 0), 100) / 100})` }}
                      />
                    </div>
                    <span className={`text-lg font-bold min-w-[3rem] text-right ${getScoreColor(sector.score)}`}>
                      {sector.score}%
                    </span>
                  </div>

                  {/* Expand Icon */}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 dark:text-white/40" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 dark:text-white/40" />
                  )}
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 space-y-4 border-t border-gray-100 dark:border-white/5">
                  {/* Matched Skills */}
                  {sectorSkills.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 dark:text-white/80 mb-2 flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        {t('vision2030.breakdown.matchedSkills', 'Matched Skills')}
                      </h5>
                      <div className="space-y-2">
                        {sectorSkills.map((skill) => (
                          <div
                            key={`${skill.skillNameEn}-${skill.matchedKeyword}`}
                            className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10"
                          >
                            <div className="flex items-start justify-between gap-3 mb-1">
                              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                {isArabic ? skill.skillNameAr : skill.skillNameEn}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shrink-0">
                                {skill.weight}x
                              </span>
                            </div>
                            {skill.context && (
                              <p className="text-xs text-gray-400 dark:text-white/50 leading-relaxed">
                                {t('vision2030.breakdown.foundIn', 'Found in')}: "{skill.context.substring(0, 100)}..."
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Keywords */}
                  {sector.suggestedKeywords.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 dark:text-white/80 mb-2">
                        {t('vision2030.breakdown.suggestedKeywords', 'Suggested Keywords to Add')}
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {sector.suggestedKeywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="px-3 py-1 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/30 transition-colors cursor-default"
                          >
                            + {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No matches message */}
                  {sectorSkills.length === 0 && (
                    <p className="text-sm text-gray-400 dark:text-white/40 italic">
                      {t('vision2030.breakdown.noMatches', 'No matching skills found for this sector. Consider adding relevant keywords to improve your alignment.')}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
