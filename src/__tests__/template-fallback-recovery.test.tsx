import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TemplateRenderer from '../components/templates/TemplateRenderer';

const storeState = {
  displayOptions: {
    baseFontSize: 10.5,
    headingSize: 14,
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
});
