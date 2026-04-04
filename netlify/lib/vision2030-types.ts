/**
 * Vision 2030 Alignment Analysis Type Definitions
 *
 * Canonical copy for Netlify functions — kept inside netlify/ so the
 * netlify/tsconfig.json rootDir boundary is never violated.
 * The identical types in src/types/vision2030.ts serve the React frontend.
 */

export interface Vision2030MatchedSkill {
  skillNameEn: string;
  skillNameAr: string;
  sectorId: string;
  sectorNameEn: string;
  sectorNameAr: string;
  matchedKeyword: string;
  weight: number;
  context: string;
}

export interface Vision2030MissingSuggestion {
  skillNameEn: string;
  skillNameAr: string;
  sectorId: string;
  sectorNameEn: string;
  sectorNameAr: string;
  relevanceScore: number;
  reason: string;
  reasonAr: string;
}

export interface Vision2030SectorBreakdown {
  sectorId: string;
  sectorNameEn: string;
  sectorNameAr: string;
  icon: string;
  score: number;
  matchedCount: number;
  totalSkills: number;
  suggestedKeywords: string[];
}

export interface Vision2030DetectedCareer {
  archetypeId: string;
  archetypeNameEn: string;
  archetypeNameAr: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface Vision2030AnalysisResponse {
  overallScore: number;
  matchedSkills: Vision2030MatchedSkill[];
  missingSuggestions: Vision2030MissingSuggestion[];
  sectorBreakdown: Vision2030SectorBreakdown[];
  topSectors: string[];
  allSectorsWithMatches: string[];
  detectedCareer: Vision2030DetectedCareer;
}

export interface Vision2030Request {
  resumeText: string;
  language?: 'en' | 'ar';
  jobDescription?: string;
}

export interface Vision2030InsufficientCreditsError {
  error: 'Insufficient credits';
  creditsRequired: number;
  creditsAvailable: number;
  creditsNeeded: number;
}
