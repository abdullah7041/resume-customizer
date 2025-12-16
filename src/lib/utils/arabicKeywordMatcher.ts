import { normalizeArabic } from './arabicTextUtils';

export interface KeywordMatch {
  keyword: string;
  found: boolean;
  context?: string;
  variations: string[];
}

/**
 * Common Arabic keyword variations for job matching
 */
const ARABIC_KEYWORD_VARIATIONS: Record<string, string[]> = {
  // Programming
  'برمجة': ['برمجة', 'مبرمج', 'تطوير برمجيات', 'كود', 'كودينج'],
  'تطوير': ['تطوير', 'مطور', 'تطوير برمجيات', 'تطوير تطبيقات'],

  // Management
  'إدارة': ['إدارة', 'مدير', 'قيادة', 'إشراف'],
  'مشاريع': ['مشاريع', 'مشروع', 'إدارة مشاريع', 'تخطيط'],

  // Skills
  'تواصل': ['تواصل', 'اتصال', 'مهارات تواصل', 'التواصل الفعال'],
  'تحليل': ['تحليل', 'محلل', 'تحليل بيانات', 'تحليلات'],

  // Technical
  'قواعد بيانات': ['قواعد بيانات', 'بيانات', 'داتابيس', 'SQL'],
  'شبكات': ['شبكات', 'شبكة', 'نتوورك', 'network'],

  // Soft skills
  'العمل الجماعي': ['العمل الجماعي', 'فريق', 'عمل جماعي', 'تعاون'],
  'حل المشكلات': ['حل المشكلات', 'حل مشاكل', 'تحليل مشاكل'],
};

/**
 * Match keywords in resume against job description
 */
export function matchArabicKeywords(
  resumeText: string,
  jobDescription: string
): {
  matched: KeywordMatch[];
  missing: KeywordMatch[];
  score: number;
} {
  const normalizedResume = normalizeArabic(resumeText.toLowerCase());
  const normalizedJob = normalizeArabic(jobDescription.toLowerCase());

  // Extract keywords from job description
  const jobKeywords = extractKeywords(normalizedJob);

  const matched: KeywordMatch[] = [];
  const missing: KeywordMatch[] = [];

  for (const keyword of jobKeywords) {
    const variations = getKeywordVariations(keyword);
    const foundVariation = variations.find(v =>
      normalizedResume.includes(normalizeArabic(v.toLowerCase()))
    );

    if (foundVariation) {
      // Find context
      const index = normalizedResume.indexOf(normalizeArabic(foundVariation.toLowerCase()));
      const start = Math.max(0, index - 30);
      const end = Math.min(normalizedResume.length, index + foundVariation.length + 30);

      matched.push({
        keyword,
        found: true,
        context: resumeText.substring(start, end).trim(),
        variations,
      });
    } else {
      missing.push({
        keyword,
        found: false,
        variations,
      });
    }
  }

  const score = matched.length / (matched.length + missing.length) * 100;

  return { matched, missing, score: Math.round(score) };
}

/**
 * Extract meaningful keywords from text
 */
function extractKeywords(text: string): string[] {
  const words = text.split(/[\s،,.\-:()]/);
  const keywords: string[] = [];

  // Filter out common Arabic stop words
  const stopWords = new Set([
    'و', 'في', 'من', 'على', 'إلى', 'أن', 'عن', 'مع', 'هذا', 'هذه',
    'التي', 'الذي', 'أو', 'ذلك', 'كان', 'لم', 'لا', 'ما', 'هو', 'هي',
    'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'with',
  ]);

  for (const word of words) {
    const trimmed = word.trim();
    if (
      trimmed.length > 2 &&
      !stopWords.has(trimmed) &&
      !/^\d+$/.test(trimmed)
    ) {
      keywords.push(trimmed);
    }
  }

  return [...new Set(keywords)];
}

/**
 * Get variations of a keyword including synonyms
 */
function getKeywordVariations(keyword: string): string[] {
  const normalized = normalizeArabic(keyword);

  // Check predefined variations
  for (const [base, variations] of Object.entries(ARABIC_KEYWORD_VARIATIONS)) {
    if (normalizeArabic(base) === normalized ||
        variations.some(v => normalizeArabic(v) === normalized)) {
      return variations;
    }
  }

  // Return keyword as-is if no variations found
  return [keyword];
}
