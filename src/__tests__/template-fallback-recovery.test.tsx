import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TemplateRenderer from '../components/templates/TemplateRenderer';
import { cleanHighlight } from '../components/templates/BaseTemplate';

const storeState = {
  displayOptions: {
    baseFontSize: 10.5,
    headingSize: 14,
    nameSize: 20,
    fontFamily: 'Arial',
    sectionSpacing: 12,
    paragraphSpacing: 6,
    lineHeight: 1.4,
    marginTop: 0.5,
    marginBottom: 0.5,
    marginSide: 0.6,
    showPageBreaks: false,
  },
  contentLanguage: 'en',
};

vi.mock('../lib/stores/resumeStore', () => ({
  useResumeStore: vi.fn((selector) => (typeof selector === 'function' ? selector(storeState) : storeState)),
}));

describe('template rendering of deterministic fallback entries', () => {
  it('removes list markers without changing a meaningful leading minus sign', () => {
    expect(cleanHighlight('  • Recovered achievement')).toBe('Recovered achievement');
    expect(cleanHighlight('- Reduced defects by 5%')).toBe('Reduced defects by 5%');
    expect(cleanHighlight('-5% defect rate variance')).toBe('-5% defect rate variance');
  });

  it('renders a recovered education entry (empty institution, raw highlights) as a list', () => {
    const { container } = render(
      <TemplateRenderer
        template={{ id: 'modern-professional', structure: {} }}
        contentDirection="ltr"
        userData={{
          basics: {
            name: 'Abdullah Bin Ahmed',
            label: 'IT Analyst',
            email: 'abdullah@example.com',
            summary: 'Saudi Enterprise IT Analyst bridging digital transformation across teams.',
          },
          work: [],
          // Conservative fallback shape produced by recoverSectionsFromRawText:
          // no fabricated institution/dates, raw lines carried as highlights.
          education: [
            {
              institution: '',
              area: '',
              studyType: '',
              startDate: '',
              endDate: '',
              highlights: ['BSc Computer Science', 'King Fahd University of Petroleum and Minerals 2018'],
            },
          ],
          certificates: [
            { name: 'AWS Certified Solutions Architect', issuer: '', date: '' },
          ],
          skills: [],
          projects: [],
        }}
      />
    );

    // The recovered raw lines must be visible in the rendered template.
    expect(container.innerHTML).toContain('BSc Computer Science');
    expect(container.innerHTML).toContain('King Fahd University of Petroleum and Minerals 2018');
    // The recovered certificate name must render too.
    expect(container.innerHTML).toContain('AWS Certified Solutions Architect');
  });

  it.each(['ats-optimized', 'executive-professional'])(
    'lets a long recovered education entry paginate in %s',
    (templateId) => {
      const highlights = Array.from({ length: 6 }, (_, index) => `Recovered education line ${index + 1}`);
      const { getByText } = render(
        <TemplateRenderer
          template={{ id: templateId, structure: {} }}
          contentDirection="ltr"
          userData={{
            basics: { name: 'Abdullah Bin Ahmed', email: 'abdullah@example.com' },
            work: [],
            education: [{ institution: '', area: '', studyType: '', startDate: '', endDate: '', highlights }],
            certificates: [],
            skills: [],
            projects: [],
          }}
        />
      );

      const educationEntry = getByText(highlights[0]).closest('ul')?.parentElement;
      expect(educationEntry).not.toBeNull();
      expect(educationEntry?.style.breakInside || educationEntry?.style.pageBreakInside).toBe('auto');
    }
  );

  it.each(['modern-professional', 'executive-professional', 'technical-engineer', 'ats-optimized'])(
    'exports explicit compact name and heading sizes without rescaling in %s',
    (templateId) => {
      Object.assign(storeState.displayOptions, {
        baseFontSize: 10,
        nameSize: 18,
        headingSize: 12.5,
      });

      const { container } = render(
        <TemplateRenderer
          template={{ id: templateId, structure: {} }}
          contentDirection="ltr"
          userData={{
            basics: { name: 'Abdullah Bin Ahmed', summary: 'Professional summary' },
            work: [],
            education: [],
            certificates: [],
            skills: [],
            projects: [],
          }}
        />
      );

      expect(Number.parseFloat(container.querySelector('h1')?.style.fontSize || '')).toBe(18);
      expect(Number.parseFloat(container.querySelector('h2')?.style.fontSize || '')).toBe(12.5);
    }
  );
});
