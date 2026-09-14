import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModernProfessional } from '@/components/templates/ModernProfessional';
import { TechnicalEngineer } from '@/components/templates/TechnicalEngineer';
import { ExecutiveProfessional } from '@/components/templates/ExecutiveProfessional';
import { ATSOptimized } from '@/components/templates/ATSOptimized';
import { ResumeZodSchema } from '@/lib/validation/store-schemas';
import { ResumeSchema as ServerResumeSchema } from '../../netlify/lib/resume-schemas';
import { parseWorkBlocks } from '../../netlify/lib/parse-quality.js';
import { buildExperience, type DocxModule } from '@/services/docx/sectionBuilders';
import { getTemplateConfig } from '@/services/docx/templateStyles';
import type { ResumeSchema } from '@/types/resume';

vi.mock('@/hooks/useSectionLabel', () => ({ useSectionLabel: () => (key: string) => key }));
afterEach(cleanup);
const description = 'Arabic-first AI resume and job-matching SaaS, live in production.';
const achievement = 'Built and shipped a resume optimizer serving 200 users.';
const resume = { basics: { name: "Test", label: "", email: "", phone: "", summary: "", location: { city: "", countryCode: "", region: "" }, profiles: [] }, education: [], skills: [], work: [{ name: 'Watheq', position: 'Founder', startDate: '2024', endDate: 'Present', description, summary: '', highlights: [achievement] }] } as ResumeSchema;

describe('work descriptions remain separate from achievements', () => {
  it('preserves the description through client and server validation', () => {
    expect(ResumeZodSchema.parse(resume).work[0].description).toBe(description);
    expect(ServerResumeSchema.parse(resume).work[0].description).toBe(description);
  });
  it('recovers an unbulleted introduction without removing the first achievement', () => {
    const [work] = parseWorkBlocks(['Founder at Watheq 2024 - Present', description, `• ${achievement}`]);
    expect(work.description).toBe(description);
    expect(work.highlights).toEqual([achievement]);
  });
  it('keeps an explicit first bullet even when it reads like a description', () => {
    const [work] = parseWorkBlocks(['Founder at Watheq 2024 - Present', `• ${description}`, `• ${achievement}`]);
    expect(work.highlights).toEqual([description, achievement]);
  });
  it.each(['ltr', 'rtl'] as const)('renders the %s DOCX description as a normal paragraph before bullets', (direction) => {
    class TextRun { constructor(readonly options: Record<string, unknown>) {} }
    class Paragraph { constructor(readonly options: Record<string, unknown>) {} }
    const D = {
      TextRun, Paragraph,
      AlignmentType: { LEFT: 'left', CENTER: 'center', RIGHT: 'right' },
      HeadingLevel: { HEADING_2: 'heading-2' },
      LineRuleType: { AUTO: 'auto' },
      BorderStyle: { SINGLE: 'single', DASHED: 'dashed' },
      TabStopType: { RIGHT: 'right' },
      TabStopPosition: { MAX: 9000 },
      convertInchesToTwip: (value: number) => value * 1440,
    } as unknown as DocxModule;
    const paragraphs = buildExperience(resume.work, getTemplateConfig('modern-professional'), D, { keywords: [], boldKeywords: false, direction }) as Paragraph[];
    const texts = paragraphs.map(paragraph => ((paragraph.options.children as TextRun[] | undefined) ?? []).map(run => run.options.text).join(''));
    expect(texts.indexOf(description)).toBeGreaterThan(-1);
    expect(texts.indexOf(description)).toBeLessThan(texts.findIndex(text => text.includes(achievement)));
    expect((paragraphs[texts.indexOf(description)].options as { numbering?: unknown }).numbering).toBeUndefined();
  });
  for (const Template of [ModernProfessional, TechnicalEngineer, ExecutiveProfessional, ATSOptimized]) {
    for (const contentDirection of ['ltr', 'rtl'] as const) {
      it(`${Template.name} renders ${contentDirection} description outside the achievement list`, () => {
        const { getByText } = render(<Template resume={resume} contentDirection={contentDirection} />);
        expect(getByText(description).closest('li')).toBeNull();
        expect(getByText(achievement).closest('li')).not.toBeNull();
      });
    }
  }
});
