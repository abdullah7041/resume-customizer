/**
 * Keyword Bolding Utility
 *
 * Splits text into segments and identifies which segments should be bolded
 * based on a list of keywords. Used for emphasizing job-relevant keywords
 * in DOCX exports for better ATS matching.
 */

/**
 * Represents a text segment with optional bold formatting
 */
export interface TextSegment {
  text: string;
  bold: boolean;
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalizes text for case-insensitive matching
 */
function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * Filters out common stop words that shouldn't be bolded
 */
function filterStopWords(keywords: string[]): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'including', 'until', 'against', 'among', 'throughout', 'despite', 'towards',
    'upon', 'concerning', 'as', 'is', 'was', 'were', 'been', 'be', 'have',
    'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
    'may', 'might', 'must', 'can', 'experience', 'work', 'job', 'role',
  ]);

  return keywords.filter(keyword => {
    const normalized = normalizeText(keyword);
    return normalized.length > 1 && !stopWords.has(normalized);
  });
}

/**
 * Splits text into segments with selective bolding for keywords
 *
 * @param text - The text to process
 * @param keywords - Array of keywords to bold (case-insensitive)
 * @param maxKeywords - Maximum number of keywords to bold (default: 15)
 * @returns Array of text segments with bold flags
 *
 * @example
 * ```typescript
 * const segments = splitTextWithKeywords(
 *   "Developed scalable microservices using Python",
 *   ["Python", "microservices", "scalable"]
 * );
 * // Returns:
 * // [
 * //   { text: "Developed ", bold: false },
 * //   { text: "scalable", bold: true },
 * //   { text: " ", bold: false },
 * //   { text: "microservices", bold: true },
 * //   { text: " using ", bold: false },
 * //   { text: "Python", bold: true }
 * // ]
 * ```
 */
export function splitTextWithKeywords(
  text: string,
  keywords: string[],
  maxKeywords: number = 15
): TextSegment[] {
  // Handle edge cases
  if (!text || text.trim().length === 0) {
    return [{ text: '', bold: false }];
  }

  if (!keywords || keywords.length === 0) {
    return [{ text, bold: false }];
  }

  // Normalize and filter keywords
  const filteredKeywords = filterStopWords(keywords);

  if (filteredKeywords.length === 0) {
    return [{ text, bold: false }];
  }

  // Take top N keywords to avoid over-bolding
  const topKeywords = filteredKeywords.slice(0, maxKeywords);

  // Sort keywords by length (longest first) to handle overlapping matches correctly
  // e.g., "machine learning" should match before "machine"
  const sortedKeywords = [...topKeywords].sort((a, b) => b.length - a.length);

  // Escape special regex characters and build pattern
  const escapedKeywords = sortedKeywords.map(k => escapeRegex(k));
  const pattern = new RegExp(`(${escapedKeywords.join('|')})`, 'gi');

  // Split text using regex while preserving delimiters (the keywords themselves)
  const parts = text.split(pattern);

  // Map each part to a TextSegment
  const segments: TextSegment[] = parts
    .filter(part => part.length > 0) // Remove empty strings
    .map(part => {
      // Check if this part is a keyword (case-insensitive)
      const isKeyword = sortedKeywords.some(
        keyword => normalizeText(part) === normalizeText(keyword)
      );

      return {
        text: part,
        bold: isKeyword,
      };
    });

  return segments;
}

/**
 * Gets the count of unique keywords that appear in the text
 *
 * @param text - The text to analyze
 * @param keywords - Array of keywords to search for
 * @returns Number of keywords found in text
 */
export function getKeywordMatchCount(text: string, keywords: string[]): number {
  if (!text || !keywords || keywords.length === 0) {
    return 0;
  }

  const normalizedText = normalizeText(text);
  const filteredKeywords = filterStopWords(keywords);

  const matchedKeywords = filteredKeywords.filter(keyword => {
    const normalized = normalizeText(keyword);
    return normalizedText.includes(normalized);
  });

  return matchedKeywords.length;
}

/**
 * Checks if keyword bolding should be applied based on available data
 *
 * @param keywords - Array of keywords
 * @param boldKeywordsFlag - User preference flag
 * @returns true if bolding should be applied
 */
export function shouldApplyBolding(
  keywords: string[] | undefined,
  boldKeywordsFlag: boolean = true
): boolean {
  return boldKeywordsFlag &&
         keywords !== undefined &&
         keywords.length > 0 &&
         filterStopWords(keywords).length > 0;
}
