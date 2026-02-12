import { describe, it, expect } from 'vitest';
import {
  splitTextWithKeywords,
  getKeywordMatchCount,
  shouldApplyBolding,
} from '../lib/utils/keywordBolder';

describe('keywordBolder', () => {
  describe('splitTextWithKeywords', () => {
    it('should handle empty text', () => {
      const result = splitTextWithKeywords('', ['keyword']);
      expect(result).toEqual([{ text: '', bold: false }]);
    });

    it('should handle empty keywords array', () => {
      const text = 'Some text here';
      const result = splitTextWithKeywords(text, []);
      expect(result).toEqual([{ text, bold: false }]);
    });

    it('should handle null/undefined keywords', () => {
      const text = 'Some text here';
      const result = splitTextWithKeywords(text, null as any);
      expect(result).toEqual([{ text, bold: false }]);
    });

    it('should bold a single keyword (case-insensitive)', () => {
      const text = 'I have experience with Python programming';
      const keywords = ['python'];
      const result = splitTextWithKeywords(text, keywords);

      expect(result).toEqual([
        { text: 'I have experience with ', bold: false },
        { text: 'Python', bold: true },
        { text: ' programming', bold: false },
      ]);
    });

    it('should bold multiple keywords', () => {
      const text = 'Developed scalable microservices using Python';
      const keywords = ['Python', 'microservices', 'scalable'];
      const result = splitTextWithKeywords(text, keywords);

      expect(result).toHaveLength(6);
      expect(result.find(s => s.text === 'scalable')?.bold).toBe(true);
      expect(result.find(s => s.text === 'microservices')?.bold).toBe(true);
      expect(result.find(s => s.text === 'Python')?.bold).toBe(true);
      expect(result.find(s => s.text === 'Developed ')?.bold).toBe(false);
    });

    it('should handle keywords with different cases', () => {
      const text = 'JavaScript and javascript are the same';
      const keywords = ['JAVASCRIPT'];
      const result = splitTextWithKeywords(text, keywords);

      const boldSegments = result.filter(s => s.bold);
      expect(boldSegments).toHaveLength(2);
      expect(boldSegments[0].text).toBe('JavaScript');
      expect(boldSegments[1].text).toBe('javascript');
    });

    it('should filter out stop words', () => {
      const text = 'I have work experience';
      const keywords = ['the', 'and', 'work', 'experience', 'job'];
      const result = splitTextWithKeywords(text, keywords);

      // 'work' and 'experience' are stop words and should NOT be bolded
      const boldSegments = result.filter(s => s.bold);
      expect(boldSegments).toHaveLength(0);
    });

    it('should limit to maxKeywords parameter', () => {
      const text = 'Python Java JavaScript TypeScript Ruby Go';
      const keywords = ['Python', 'Java', 'JavaScript', 'TypeScript', 'Ruby', 'Go'];
      const result = splitTextWithKeywords(text, keywords, 3);

      // Only first 3 keywords should be used for bolding
      const boldSegments = result.filter(s => s.bold);
      expect(boldSegments.length).toBeLessThanOrEqual(3);
    });

    it('should handle multi-word keywords', () => {
      const text = 'I specialize in machine learning and data science';
      const keywords = ['machine learning', 'data science'];
      const result = splitTextWithKeywords(text, keywords);

      expect(result).toEqual([
        { text: 'I specialize in ', bold: false },
        { text: 'machine learning', bold: true },
        { text: ' and ', bold: false },
        { text: 'data science', bold: true },
      ]);
    });

    it('should handle overlapping keywords (longest first)', () => {
      const text = 'I use machine learning algorithms';
      const keywords = ['machine', 'machine learning'];
      const result = splitTextWithKeywords(text, keywords);

      // "machine learning" is longer, so it should match first
      const boldSegments = result.filter(s => s.bold);
      expect(boldSegments).toHaveLength(1);
      expect(boldSegments[0].text).toBe('machine learning');
    });

    it('should handle keywords with special regex characters', () => {
      const text = 'I know C++ and C# programming';
      const keywords = ['C++', 'C#'];
      const result = splitTextWithKeywords(text, keywords);

      const boldSegments = result.filter(s => s.bold);
      expect(boldSegments).toHaveLength(2);
      expect(boldSegments[0].text).toBe('C++');
      expect(boldSegments[1].text).toBe('C#');
    });

    it('should handle Arabic text', () => {
      const text = 'لدي خبرة في Python و JavaScript';
      const keywords = ['Python', 'JavaScript'];
      const result = splitTextWithKeywords(text, keywords);

      const boldSegments = result.filter(s => s.bold);
      expect(boldSegments).toHaveLength(2);
      expect(boldSegments[0].text).toBe('Python');
      expect(boldSegments[1].text).toBe('JavaScript');
    });

    it('should handle text with no keyword matches', () => {
      const text = 'This is some random text';
      const keywords = ['Python', 'Java'];
      const result = splitTextWithKeywords(text, keywords);

      expect(result).toEqual([{ text, bold: false }]);
    });

    it('should not create empty text segments', () => {
      const text = 'Python JavaScript Python';
      const keywords = ['Python', 'JavaScript'];
      const result = splitTextWithKeywords(text, keywords);

      // All segments should have text
      expect(result.every(s => s.text.length > 0)).toBe(true);
    });

    it('should handle repeated keywords', () => {
      const text = 'Python is great. I love Python. Python rocks.';
      const keywords = ['Python'];
      const result = splitTextWithKeywords(text, keywords);

      const boldSegments = result.filter(s => s.bold);
      expect(boldSegments).toHaveLength(3);
      expect(boldSegments.every(s => s.text === 'Python')).toBe(true);
    });
  });

  describe('getKeywordMatchCount', () => {
    it('should return 0 for empty text', () => {
      expect(getKeywordMatchCount('', ['keyword'])).toBe(0);
    });

    it('should return 0 for empty keywords', () => {
      expect(getKeywordMatchCount('Some text', [])).toBe(0);
    });

    it('should count single keyword match', () => {
      const text = 'I have experience with Python';
      const keywords = ['Python', 'Java', 'JavaScript'];
      expect(getKeywordMatchCount(text, keywords)).toBe(1);
    });

    it('should count multiple keyword matches', () => {
      const text = 'Developed scalable microservices using Python';
      const keywords = ['Python', 'microservices', 'scalable', 'Java'];
      expect(getKeywordMatchCount(text, keywords)).toBe(3);
    });

    it('should be case-insensitive', () => {
      const text = 'python PYTHON Python';
      const keywords = ['Python'];
      expect(getKeywordMatchCount(text, keywords)).toBe(1); // Unique count, not occurrence count
    });

    it('should filter stop words before counting', () => {
      const text = 'I have work experience';
      const keywords = ['work', 'experience', 'the'];
      expect(getKeywordMatchCount(text, keywords)).toBe(0);
    });

    it('should handle multi-word keywords', () => {
      const text = 'I specialize in machine learning';
      const keywords = ['machine learning', 'data science'];
      expect(getKeywordMatchCount(text, keywords)).toBe(1);
    });
  });

  describe('shouldApplyBolding', () => {
    it('should return false when keywords are undefined', () => {
      expect(shouldApplyBolding(undefined, true)).toBe(false);
    });

    it('should return false when keywords are empty', () => {
      expect(shouldApplyBolding([], true)).toBe(false);
    });

    it('should return false when flag is false', () => {
      expect(shouldApplyBolding(['Python', 'Java'], false)).toBe(false);
    });

    it('should return true when keywords exist and flag is true', () => {
      expect(shouldApplyBolding(['Python', 'Java'], true)).toBe(true);
    });

    it('should default to true when flag is omitted', () => {
      expect(shouldApplyBolding(['Python'])).toBe(true);
    });

    it('should return false when all keywords are stop words', () => {
      expect(shouldApplyBolding(['the', 'and', 'work'], true)).toBe(false);
    });

    it('should return true when at least one keyword is not a stop word', () => {
      expect(shouldApplyBolding(['the', 'Python', 'work'], true)).toBe(true);
    });
  });
});
