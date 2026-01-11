/**
 * Fuzzy Text Matching Utility
 *
 * Provides unified text matching logic for resume optimization merging.
 * Supports exact matching, prefix matching, and word overlap detection.
 *
 * @module textMatcher
 */

export interface MatchResult {
  /** Whether the texts match according to configured thresholds */
  matched: boolean;
  /** Confidence score from 0 to 1 (1 = exact match) */
  confidence: number;
  /** Type of match detected */
  matchType: 'exact' | 'prefix' | 'word-overlap' | 'none';
}

export interface MatchOptions {
  /** Number of characters to use for prefix matching (default: 40) */
  prefixLength?: number;
  /** Minimum word overlap ratio required for a match (default: 0.5 = 50%) */
  minWordOverlap?: number;
  /** Minimum word length to consider in overlap calculation (default: 3) */
  minWordLength?: number;
}

const DEFAULT_OPTIONS: Required<MatchOptions> = {
  prefixLength: 40,
  minWordOverlap: 0.5,
  minWordLength: 3,
};

/**
 * Performs fuzzy text matching between two strings.
 *
 * Matching algorithm:
 * 1. Exact match - Both strings are identical (confidence: 1.0)
 * 2. Prefix match - First N characters match (confidence: 0.9)
 * 3. Word overlap - At least X% of words match (confidence: overlap ratio)
 *
 * @param needle - The text to search for (e.g., original resume text)
 * @param haystack - The text to search in (e.g., current resume content)
 * @param options - Optional matching configuration
 * @returns Match result with confidence score and match type
 *
 * @example
 * ```typescript
 * const result = fuzzyTextMatch(
 *   "Developed scalable API",
 *   "Developed scalable API endpoints for user management"
 * );
 * console.log(result.matched); // true
 * console.log(result.confidence); // 0.9
 * console.log(result.matchType); // 'prefix'
 * ```
 */
export function fuzzyTextMatch(
  needle: string,
  haystack: string,
  options?: MatchOptions
): MatchResult {
  // Handle empty inputs
  if (!needle || !haystack) {
    return { matched: false, confidence: 0, matchType: 'none' };
  }

  // Merge options with defaults
  const opts: Required<MatchOptions> = { ...DEFAULT_OPTIONS, ...options };

  // Normalize both strings: lowercase and trim whitespace
  const n = needle.toLowerCase().trim();
  const h = haystack.toLowerCase().trim();

  // Handle empty strings after trimming
  if (!n || !h) {
    return { matched: false, confidence: 0, matchType: 'none' };
  }

  // 1. Exact match check
  if (n === h) {
    return { matched: true, confidence: 1.0, matchType: 'exact' };
  }

  // 2. Prefix match check (handles truncation)
  const nPrefix = n.substring(0, opts.prefixLength);
  const hPrefix = h.substring(0, opts.prefixLength);

  if (h.includes(nPrefix) || n.includes(hPrefix)) {
    return { matched: true, confidence: 0.9, matchType: 'prefix' };
  }

  // 3. Word overlap match
  // Filter words by minimum length to avoid matching common short words
  const nWords = n.split(/\s+/).filter(w => w.length > opts.minWordLength);
  const hWords = h.split(/\s+/).filter(w => w.length > opts.minWordLength);

  // If either has no significant words, no match
  if (nWords.length === 0 || hWords.length === 0) {
    return { matched: false, confidence: 0, matchType: 'none' };
  }

  // Count how many needle words appear in haystack words
  const matchedWords = nWords.filter(nWord =>
    hWords.some(hWord => hWord.includes(nWord) || nWord.includes(hWord))
  );

  // Calculate overlap ratio using the smaller word count as denominator
  const overlapRatio = matchedWords.length / Math.min(nWords.length, hWords.length);

  // Check if overlap meets threshold
  if (overlapRatio >= opts.minWordOverlap) {
    return {
      matched: true,
      confidence: Number(overlapRatio.toFixed(2)),
      matchType: 'word-overlap',
    };
  }

  // No match found
  return { matched: false, confidence: 0, matchType: 'none' };
}

/**
 * Simple wrapper that returns only the boolean match result.
 * Use when you don't need confidence scores or match types.
 *
 * @param needle - The text to search for
 * @param haystack - The text to search in
 * @param options - Optional matching configuration
 * @returns True if texts match, false otherwise
 *
 * @example
 * ```typescript
 * if (isTextMatch("Led team", "Led team of 5 engineers")) {
 *   console.log("Match found!");
 * }
 * ```
 */
export function isTextMatch(
  needle: string,
  haystack: string,
  options?: MatchOptions
): boolean {
  return fuzzyTextMatch(needle, haystack, options).matched;
}
