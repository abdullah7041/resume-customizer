import { describe, expect, it } from 'vitest';
import { detectResumeDirection, directionFromLanguage } from './resumeDirection';

describe('resumeDirection', () => {
  it('maps mixed Arabic/English language to RTL', () => {
    expect(directionFromLanguage('mixed')).toBe('rtl');
  });

  it('detects mixed Saudi bilingual resume content as RTL', () => {
    expect(detectResumeDirection({
      basics: {
        name: 'سارة الأحمد',
        label: 'Product Manager',
        summary: 'قادت مبادرات التحول الرقمي using Jira and SQL.',
      },
      work: [
        {
          name: 'NEOM',
          position: 'Digital Transformation Lead',
          highlights: ['رفعت كفاءة العمليات بنسبة 22% باستخدام Power BI'],
        },
      ],
    })).toBe('rtl');
  });

  it('keeps English-only resume content LTR', () => {
    expect(detectResumeDirection({
      basics: {
        name: 'Sarah Ahmed',
        summary: 'Product manager leading digital transformation programs.',
      },
    })).toBe('ltr');
  });
});
