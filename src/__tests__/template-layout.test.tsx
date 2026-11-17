import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TEMPLATES, TEMPLATE_CONFIGS } from '@/components/templates/registry';
import { getTemplateConfig } from '@/services/docx/templateStyles';
import type { ResumeSchema } from '@/types/resume';
import type { DisplayOptions } from '@/types/templates';

vi.mock('@/hooks/useSectionLabel', () => ({ useSectionLabel: () => (key: string) => key }));
const resume: ResumeSchema = {
  basics: { name: 'سارة Example', label: 'Engineer', summary: 'Verified summary', email: 'sara@example.test', phone: '+966500000001', location: { city: 'Riyadh', region: '', countryCode: 'SA' }, profiles: [] },
  work: [{ name: 'Example', position: 'A very long engineering leadership title without truncation', startDate: '2020', endDate: '2025', summary: '', highlights: ['Verified result'] }],
  education: [], projects: [], skills: [{ name: 'Tools', keywords: ['SQL', 'Python'] }],
};
const options: DisplayOptions = { fontSize: 1, baseFontSize: 11, headingSize: 13, fontFamily: 'Arial',
  sectionSpacing: 8, paragraphSpacing: 6, lineHeight: 1.4, marginTop: 0.4, marginBottom: 0.8, marginSide: 0.6,
  showPageBreaks: false, boldKeywords: false };
afterEach(cleanup);

describe('template document layout', () => {
  for (const [id, Template] of Object.entries(TEMPLATES)) {
    it(`${id} preserves bottom margin, readable titles and logical RTL lists`, () => {
      const { container } = render(<Template resume={resume} displayOptions={options} contentDirection="rtl" />);
      const root = container.firstElementChild as HTMLElement;
      expect(root.style.paddingBottom).toBe(`${options.marginBottom * 25.4}mm`);
      expect(root.style.fontSize).toBe('11pt');
      expect(root.style.overflowWrap).toBe('anywhere');
      expect(screen.getByText(resume.basics!.phone!).closest('bdi')).toHaveAttribute('dir', 'ltr');
      const title = screen.getByText(resume.work![0].position!);
      expect(title.style.overflow).not.toBe('hidden');
      for (const list of container.querySelectorAll('ul')) {
        expect(list.style.paddingInlineStart).toBe('16px');
      }
      expect(screen.getByText('summary', { selector: 'h2' })).toBeInTheDocument();
      expect(screen.getByText('skills', { selector: 'h2' })).toBeInTheDocument();
      expect(screen.getByText(/SQL/).closest('section')?.querySelector('[class*="rounded"]')).toBeNull();
      expect(getTemplateConfig(id as keyof typeof TEMPLATES).baseFontSize).toBe(22);
      expect(getTemplateConfig(id as keyof typeof TEMPLATES).skillsLayout).toBe('comma');
    });
  }
  it('keeps persisted IDs while naming the four layouts clearly', () => {
    expect(TEMPLATE_CONFIGS.map(config => [config.id, config.name, config.nameAr])).toEqual([
      ['modern-professional', 'Riyadh — Professional', 'الرياض — مهني'],
      ['technical-engineer', 'Khobar — Technical', 'الخبر — تقني'],
      ['ats-optimized', 'Qiddiya — Classic', 'القدية — كلاسيكي'],
      ['executive-professional', 'Neom — Executive', 'نيوم — تنفيذي'],
    ]);
  });
});
