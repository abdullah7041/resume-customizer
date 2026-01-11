import { describe, it, expect } from 'vitest';
import { fuzzyTextMatch, isTextMatch, MatchOptions } from '../textMatcher';

describe('textMatcher', () => {
  describe('fuzzyTextMatch', () => {
    describe('exact matches', () => {
      it('returns confidence 1.0 for identical strings', () => {
        const result = fuzzyTextMatch('Hello World', 'Hello World');
        expect(result.matched).toBe(true);
        expect(result.confidence).toBe(1.0);
        expect(result.matchType).toBe('exact');
      });

      it('handles case-insensitive matching', () => {
        const result = fuzzyTextMatch('HELLO WORLD', 'hello world');
        expect(result.matched).toBe(true);
        expect(result.confidence).toBe(1.0);
        expect(result.matchType).toBe('exact');
      });

      it('ignores leading/trailing whitespace', () => {
        const result = fuzzyTextMatch('  Hello World  ', 'Hello World');
        expect(result.matched).toBe(true);
        expect(result.confidence).toBe(1.0);
        expect(result.matchType).toBe('exact');
      });
    });

    describe('prefix matches', () => {
      it('returns confidence 0.9 for prefix match', () => {
        const result = fuzzyTextMatch(
          'Developed scalable API',
          'Developed scalable API endpoints for user management'
        );
        expect(result.matched).toBe(true);
        expect(result.confidence).toBe(0.9);
        expect(result.matchType).toBe('prefix');
      });

      it('matches when haystack contains needle prefix', () => {
        const result = fuzzyTextMatch(
          'Led team of 5 engineers to deliver high-impact features',
          'Led team of 5 engineers'
        );
        expect(result.matched).toBe(true);
        expect(result.matchType).toBe('prefix');
      });

      it('uses configurable prefix length', () => {
        const options: MatchOptions = { prefixLength: 10 };
        const result = fuzzyTextMatch(
          'Short text for testing',
          'Short text with different ending',
          options
        );
        expect(result.matched).toBe(true);
        expect(result.matchType).toBe('prefix');
      });

      it('handles truncation at 40 characters by default', () => {
        const longText = 'This is a very long text that will be truncated at exactly forty characters and more';
        const truncated = longText.substring(0, 40);
        const result = fuzzyTextMatch(longText, truncated);
        expect(result.matched).toBe(true);
        expect(result.matchType).toBe('prefix');
      });
    });

    describe('word overlap matches', () => {
      it('returns confidence based on overlap ratio for 60% match', () => {
        const result = fuzzyTextMatch(
          'Implemented automated testing framework',
          'Created comprehensive automated testing suite'
        );
        expect(result.matched).toBe(true);
        expect(result.matchType).toBe('word-overlap');
        expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      });

      it('does not match when overlap is below threshold', () => {
        const result = fuzzyTextMatch(
          'Backend development with Python',
          'Frontend design using React'
        );
        expect(result.matched).toBe(false);
        expect(result.matchType).toBe('none');
        expect(result.confidence).toBe(0);
      });

      it('uses configurable minimum word overlap', () => {
        const options: MatchOptions = { minWordOverlap: 0.3 };
        const result = fuzzyTextMatch(
          'Software development Python',
          'Software testing Python framework',
          options
        );
        // "software" and "python" match (2 out of 3 = 67% >= 30%)
        expect(result.matched).toBe(true);
        expect(result.matchType).toBe('word-overlap');
        expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      });

      it('ignores short words (3 chars or less)', () => {
        const result = fuzzyTextMatch(
          'Led a team to fix the bug in API',
          'Managed large group solving server issues'
        );
        // 'led', 'fix', 'bug', 'api' vs 'managed', 'large', 'group', 'solving', 'server', 'issues'
        // Should not match despite common short words like 'the', 'in', 'to', 'a'
        expect(result.matched).toBe(false);
      });

      it('uses configurable minimum word length', () => {
        const options: MatchOptions = { minWordLength: 4, minWordOverlap: 0.3 };
        const result = fuzzyTextMatch(
          'Developed testing framework',
          'Created testing platform',
          options
        );
        // With minWordLength: 4, only words > 4 chars are considered
        // "testing" matches (1 out of 3 = 33% >= 30%)
        expect(result.matched).toBe(true);
        expect(result.matchType).toBe('word-overlap');
      });

      it('matches when significant words overlap', () => {
        const result = fuzzyTextMatch(
          'Implemented automated testing framework using Python',
          'Developed automated testing platform with Python integration'
        );
        // "automated", "testing", "python" all match (3 out of 5 = 60% >= 50%)
        expect(result.matched).toBe(true);
        expect(result.matchType).toBe('word-overlap');
      });
    });

    describe('edge cases', () => {
      it('returns no match for empty needle', () => {
        const result = fuzzyTextMatch('', 'Some text');
        expect(result.matched).toBe(false);
        expect(result.confidence).toBe(0);
        expect(result.matchType).toBe('none');
      });

      it('returns no match for empty haystack', () => {
        const result = fuzzyTextMatch('Some text', '');
        expect(result.matched).toBe(false);
        expect(result.confidence).toBe(0);
        expect(result.matchType).toBe('none');
      });

      it('returns no match when both are empty', () => {
        const result = fuzzyTextMatch('', '');
        expect(result.matched).toBe(false);
        expect(result.confidence).toBe(0);
        expect(result.matchType).toBe('none');
      });

      it('handles whitespace-only strings', () => {
        const result = fuzzyTextMatch('   ', 'Some text');
        expect(result.matched).toBe(false);
        expect(result.matchType).toBe('none');
      });

      it('handles strings with only short words', () => {
        const result = fuzzyTextMatch('a b c d e', 'f g h i j');
        expect(result.matched).toBe(false);
        expect(result.matchType).toBe('none');
      });

      it('handles single word matches', () => {
        const result = fuzzyTextMatch('Development', 'Development');
        expect(result.matched).toBe(true);
        expect(result.confidence).toBe(1.0);
        expect(result.matchType).toBe('exact');
      });
    });

    describe('Arabic text handling', () => {
      it('handles Arabic text exact matches', () => {
        const result = fuzzyTextMatch('تطوير البرمجيات', 'تطوير البرمجيات');
        expect(result.matched).toBe(true);
        expect(result.confidence).toBe(1.0);
        expect(result.matchType).toBe('exact');
      });

      it('handles Arabic text prefix matches', () => {
        const result = fuzzyTextMatch(
          'تطوير تطبيقات الويب',
          'تطوير تطبيقات الويب باستخدام React'
        );
        expect(result.matched).toBe(true);
        expect(result.matchType).toBe('prefix');
      });

      it('handles Arabic text word overlap', () => {
        const result = fuzzyTextMatch(
          'قيادة فريق من المطورين',
          'إدارة فريق المطورين الموهوبين'
        );
        expect(result.matched).toBe(true);
        expect(result.matchType).toBe('word-overlap');
      });

      it('handles mixed Arabic and English text', () => {
        const result = fuzzyTextMatch(
          'تطوير تطبيقات Python',
          'تطوير تطبيقات React'
        );
        // "تطوير" and "تطبيقات" both match (2 out of 2 = 100% >= 50%)
        expect(result.matched).toBe(true);
      });
    });

    describe('real-world resume scenarios', () => {
      it('matches original and optimized bullet points', () => {
        const original = 'Led team of 5 developers';
        const optimized = 'Led cross-functional team of 5 developers to deliver scalable solutions';
        const result = fuzzyTextMatch(original, optimized);
        expect(result.matched).toBe(true);
      });

      it('matches when wording is slightly different', () => {
        const original = 'Implemented new payment system';
        const optimized = 'Developed and implemented innovative payment processing system';
        const result = fuzzyTextMatch(original, optimized);
        expect(result.matched).toBe(true);
      });

      it('matches summary truncations', () => {
        const original = 'Experienced software engineer with expertise in full-stack development and cloud architecture';
        const truncated = 'Experienced software engineer with expertise in full-stack development';
        const result = fuzzyTextMatch(original, truncated);
        expect(result.matched).toBe(true);
      });

      it('does not match completely different content', () => {
        const result = fuzzyTextMatch(
          'Developed mobile applications',
          'Managed marketing campaigns'
        );
        expect(result.matched).toBe(false);
      });
    });
  });

  describe('isTextMatch', () => {
    it('returns true when texts match', () => {
      expect(isTextMatch('Hello World', 'Hello World')).toBe(true);
    });

    it('returns false when texts do not match', () => {
      expect(isTextMatch('Hello', 'Goodbye')).toBe(false);
    });

    it('accepts options parameter', () => {
      const options: MatchOptions = { minWordOverlap: 0.3 };
      expect(isTextMatch('Some text here', 'Some other content', options)).toBe(true);
    });

    it('works with prefix matches', () => {
      expect(isTextMatch('Led team', 'Led team of 5 engineers')).toBe(true);
    });

    it('works with word overlap', () => {
      // "automated" and "testing" match (2 out of 3 = 67% >= 50%)
      expect(isTextMatch('Implemented automated testing', 'Developed automated testing framework')).toBe(true);
    });
  });
});
