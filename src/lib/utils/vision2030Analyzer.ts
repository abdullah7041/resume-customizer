import { VISION_2030_SECTORS, ALL_VISION_2030_SKILLS, detectCareerArchetype } from '../data/vision2030Skills';

export interface Vision2030Analysis {
  overallScore: number; // 0-100
  matchedSkills: MatchedSkill[];
  missingSuggestions: MissingSuggestion[];
  sectorBreakdown: SectorScore[];
  topSectors: string[]; // Keep for backwards compatibility
  allSectorsWithMatches: string[]; // All sectors that have any match
  detectedCareer: DetectedCareer | null; // Detected career archetype
}

export interface DetectedCareer {
  archetypeId: string;
  archetypeNameEn: string;
  archetypeNameAr: string;
  confidence: 'high' | 'medium' | 'low';
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

/**
 * Check if a keyword exists as a whole word/phrase in the text
 * Uses word boundary matching to prevent false positives
 * For multi-word phrases, uses lenient matching to handle whitespace/hyphen variations
 */
function findKeywordMatch(text: string, keyword: string): { found: boolean; index: number } {
  const keywordLower = keyword.toLowerCase();
  const textLower = text.toLowerCase();

  // For single words, use word boundary regex
  if (!keywordLower.includes(' ')) {
    const escapedKeyword = keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[\\s,;.!?()\\[\\]{}|/\\-:])${escapedKeyword}(?:[\\s,;.!?()\\[\\]{}|/\\-:]|$)`, 'i');
    const match = regex.exec(text);
    if (match) {
      return { found: true, index: match.index };
    }
  } else {
    // For multi-word phrases, use simple includes (more lenient)
    // This catches "Power BI" even if formatted as "Power  BI" or "Power-BI"
    const normalizedKeyword = keywordLower.replace(/[\s-]+/g, ' ').trim();
    const normalizedText = textLower.replace(/[\s-]+/g, ' ');

    const index = normalizedText.indexOf(normalizedKeyword);
    if (index !== -1) {
      return { found: true, index };
    }
  }

  return { found: false, index: -1 };
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

  // Scan for skill matches with STRICT word-boundary matching
  ALL_VISION_2030_SKILLS.forEach(skill => {
    const keywords = language === 'ar' ? [...skill.keywords, ...skill.keywordsAr] : skill.keywords;

    for (const keyword of keywords) {
      // Use strict word-boundary matching to prevent false positives
      const matchResult = findKeywordMatch(normalizedText, keyword);

      if (matchResult.found && !matchedSkillNames.has(skill.nameEn)) {
        // Extract context (surrounding text)
        const start = Math.max(0, matchResult.index - 30);
        const end = Math.min(normalizedText.length, matchResult.index + keyword.length + 30);
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

  // Calculate score based on top 3 relevant sectors only (not all sectors)
  const top3Sectors = sectorBreakdown.slice(0, 3);
  const top3MaxWeight = top3Sectors.reduce((sum, s) => {
    const sector = VISION_2030_SECTORS.find(sec => sec.id === s.sectorId);
    return sum + (sector?.skills.reduce((w, skill) => w + skill.weight, 0) || 0);
  }, 0);
  const top3MatchedWeight = matchedSkills
    .filter(s => top3Sectors.some(t => t.sectorId === s.sectorId))
    .reduce((sum, s) => sum + s.weight, 0);

  // Use weighted average: 70% from sector depth, 30% from breadth bonus
  const sectorDepthScore = top3MaxWeight > 0 ? (top3MatchedWeight / top3MaxWeight) * 100 : 0;
  const breadthBonus = Math.min(30, matchedSkills.length * 3); // Up to 30% bonus for skill variety
  const overallScore = Math.min(100, Math.round(sectorDepthScore * 0.7 + breadthBonus));

  // Get all sectors with any matches (not just top 3)
  const allSectorsWithMatches = sectorBreakdown
    .filter(s => s.matchedCount > 0)
    .map(s => s.sectorId);

  // Keep top 3 for backwards compatibility
  const topSectorIds = sectorBreakdown.slice(0, 3).map(s => s.sectorId);

  // Detect career archetype from matched skills
  const matchedSkillNamesArray = Array.from(matchedSkillNames);
  const careerArchetype = detectCareerArchetype(matchedSkillNamesArray);

  // Calculate confidence level
  let detectedCareer: DetectedCareer | null = null;
  if (careerArchetype) {
    const matchedPrimaryCount = careerArchetype.primarySkills.filter(s =>
      matchedSkillNames.has(s)
    ).length;
    const confidence: 'high' | 'medium' | 'low' =
      matchedPrimaryCount >= 3 ? 'high' :
        matchedPrimaryCount >= 2 ? 'medium' : 'low';

    detectedCareer = {
      archetypeId: careerArchetype.id,
      archetypeNameEn: careerArchetype.nameEn,
      archetypeNameAr: careerArchetype.nameAr,
      confidence,
    };
  }

  // Generate career-aware suggestions
  const missingSuggestions: MissingSuggestion[] = [];

  if (careerArchetype) {
    // PRIORITY 1: Adjacent skills from detected career path (most relevant)
    const adjacentSuggestions = careerArchetype.adjacentSkills
      .filter(skillName => !matchedSkillNames.has(skillName))
      .slice(0, 3) // Take top 3 adjacent skills
      .map(skillName => {
        const skill = ALL_VISION_2030_SKILLS.find(s => s.nameEn === skillName);
        if (!skill) return null;
        return {
          skillNameEn: skill.nameEn,
          skillNameAr: skill.nameAr,
          sectorId: skill.sectorId,
          sectorNameEn: skill.sectorNameEn,
          sectorNameAr: skill.sectorNameAr,
          relevanceScore: skill.weight + 2, // Boost adjacent skills
          reason: `Complements your ${careerArchetype.nameEn} career path`,
          reasonAr: `يكمل مسارك المهني في ${careerArchetype.nameAr}`,
        };
      })
      .filter((s): s is MissingSuggestion => s !== null);

    missingSuggestions.push(...adjacentSuggestions);

    // PRIORITY 2: High-weight skills from relevant sectors (if we need more)
    if (missingSuggestions.length < 8) {
      const sectorSuggestions = ALL_VISION_2030_SKILLS
        .filter(skill =>
          careerArchetype.relevantSectors.includes(skill.sectorId) &&
          !matchedSkillNames.has(skill.nameEn) &&
          !missingSuggestions.some(s => s.skillNameEn === skill.nameEn) &&
          skill.weight >= 2
        )
        .slice(0, 8 - missingSuggestions.length)
        .map(skill => ({
          skillNameEn: skill.nameEn,
          skillNameAr: skill.nameAr,
          sectorId: skill.sectorId,
          sectorNameEn: skill.sectorNameEn,
          sectorNameAr: skill.sectorNameAr,
          relevanceScore: skill.weight,
          reason: `In-demand skill in ${skill.sectorNameEn}`,
          reasonAr: `مهارة مطلوبة في قطاع ${skill.sectorNameAr}`,
        }));

      missingSuggestions.push(...sectorSuggestions);
    }
  } else {
    // Fallback: No career detected - suggest from sectors with matches
    const relevantSectorIds = allSectorsWithMatches.length > 0
      ? allSectorsWithMatches
      : sectorBreakdown.slice(0, 3).map(s => s.sectorId);

    const fallbackSuggestions = ALL_VISION_2030_SKILLS
      .filter(skill =>
        relevantSectorIds.includes(skill.sectorId) &&
        !matchedSkillNames.has(skill.nameEn) &&
        skill.weight >= 2
      )
      .sort((a, b) => b.weight - a.weight) // Sort by importance
      .slice(0, 3)
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

    missingSuggestions.push(...fallbackSuggestions);
  }

  // Sort final suggestions by relevance score
  missingSuggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return {
    overallScore,
    matchedSkills,
    missingSuggestions,
    sectorBreakdown, // Already contains ALL sectors
    topSectors: topSectorIds, // Keep for backwards compatibility
    allSectorsWithMatches, // NEW
    detectedCareer, // NEW
  };
}




