import { VISION_2030_SECTORS, ALL_VISION_2030_SKILLS } from '../data/vision2030Skills';

export interface Vision2030Analysis {
  overallScore: number; // 0-100
  matchedSkills: MatchedSkill[];
  missingSuggestions: MissingSuggestion[];
  sectorBreakdown: SectorScore[];
  topSectors: string[];
}

export interface MatchedSkill {
  skillNameEn: string;
  skillNameAr: string;
  sectorId: string;
  sectorNameEn: string;
  sectorNameAr: string;
  matchedKeyword: string;
  weight: number;
  context: string;
}

export interface MissingSuggestion {
  skillNameEn: string;
  skillNameAr: string;
  sectorId: string;
  sectorNameEn: string;
  sectorNameAr: string;
  relevanceScore: number;
  reason: string;
  reasonAr: string;
}

export interface SectorScore {
  sectorId: string;
  sectorNameEn: string;
  sectorNameAr: string;
  icon: string;
  score: number;
  matchedCount: number;
  totalSkills: number;
}

export function analyzeVision2030Alignment(
  resumeText: string,
  language: 'en' | 'ar' = 'en'
): Vision2030Analysis {
  const normalizedText = resumeText.toLowerCase();
  const matchedSkills: MatchedSkill[] = [];
  const sectorScores: Map<string, { matches: number; totalWeight: number; maxWeight: number }> = new Map();

  // Initialize sector scores
  VISION_2030_SECTORS.forEach(sector => {
    const maxWeight = sector.skills.reduce((sum, s) => sum + s.weight, 0);
    sectorScores.set(sector.id, { matches: 0, totalWeight: 0, maxWeight });
  });

  // Track matched skill names to avoid duplicates
  const matchedSkillNames = new Set<string>();

  // Scan for skill matches
  ALL_VISION_2030_SKILLS.forEach(skill => {
    const keywords = language === 'ar' ? [...skill.keywords, ...skill.keywordsAr] : skill.keywords;

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      const index = normalizedText.indexOf(keywordLower);

      if (index !== -1 && !matchedSkillNames.has(skill.nameEn)) {
        // Extract context (surrounding text)
        const start = Math.max(0, index - 30);
        const end = Math.min(normalizedText.length, index + keyword.length + 30);
        const context = resumeText.substring(start, end).trim();

        matchedSkills.push({
          skillNameEn: skill.nameEn,
          skillNameAr: skill.nameAr,
          sectorId: skill.sectorId,
          sectorNameEn: skill.sectorNameEn,
          sectorNameAr: skill.sectorNameAr,
          matchedKeyword: keyword,
          weight: skill.weight,
          context: `...${context}...`,
        });

        matchedSkillNames.add(skill.nameEn);

        // Update sector score
        const sectorScore = sectorScores.get(skill.sectorId)!;
        sectorScore.matches++;
        sectorScore.totalWeight += skill.weight;

        break; // Only count each skill once
      }
    }
  });

  // Calculate sector breakdown
  const sectorBreakdown: SectorScore[] = VISION_2030_SECTORS.map(sector => {
    const score = sectorScores.get(sector.id)!;
    return {
      sectorId: sector.id,
      sectorNameEn: sector.nameEn,
      sectorNameAr: sector.nameAr,
      icon: sector.icon,
      score: score.maxWeight > 0 ? Math.round((score.totalWeight / score.maxWeight) * 100) : 0,
      matchedCount: score.matches,
      totalSkills: sector.skills.length,
    };
  }).sort((a, b) => b.score - a.score);

  // Calculate overall score
  const totalPossibleWeight = ALL_VISION_2030_SKILLS.reduce((sum, s) => sum + s.weight, 0);
  const totalMatchedWeight = matchedSkills.reduce((sum, s) => sum + s.weight, 0);
  const overallScore = Math.round((totalMatchedWeight / totalPossibleWeight) * 100);

  // Generate missing suggestions based on top sectors
  const topSectorIds = sectorBreakdown.slice(0, 3).map(s => s.sectorId);

  const missingSuggestions: MissingSuggestion[] = ALL_VISION_2030_SKILLS
    .filter(skill =>
      topSectorIds.includes(skill.sectorId) &&
      !matchedSkillNames.has(skill.nameEn) &&
      skill.weight >= 2 // Only suggest important skills
    )
    .slice(0, 5)
    .map(skill => ({
      skillNameEn: skill.nameEn,
      skillNameAr: skill.nameAr,
      sectorId: skill.sectorId,
      sectorNameEn: skill.sectorNameEn,
      sectorNameAr: skill.sectorNameAr,
      relevanceScore: skill.weight,
      reason: `High-demand skill in ${skill.sectorNameEn} sector`,
      reasonAr: `مهارة عالية الطلب في قطاع ${skill.sectorNameAr}`,
    }));

  return {
    overallScore,
    matchedSkills,
    missingSuggestions,
    sectorBreakdown,
    topSectors: topSectorIds,
  };
}




