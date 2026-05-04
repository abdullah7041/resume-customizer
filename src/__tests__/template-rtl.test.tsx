import { render, screen } from '@testing-library/react';
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
  contentLanguage: 'ar',
};

vi.mock('../lib/stores/resumeStore', () => ({
  useResumeStore: vi.fn((selector) => (typeof selector === 'function' ? selector(storeState) : storeState)),
}));

describe('template RTL rendering', () => {
  it('renders Arabic resume previews with rtl direction on the wrapper and template root', () => {
    render(
      <TemplateRenderer
        template={{ id: 'modern-professional', structure: {} }}
        contentDirection="rtl"
        userData={{
          basics: {
            name: 'سارة الأحمد',
            label: 'مديرة مشاريع',
            email: 'sara@example.com',
            summary: 'قادت مبادرات رقمية لرفع كفاءة العمليات.',
          },
          work: [],
          education: [],
          skills: [],
          projects: [],
        }}
      />
    );

    const preview = document.querySelector('[data-resume-preview]');
    expect(preview).toHaveAttribute('dir', 'rtl');
    expect(preview).toHaveStyle({ direction: 'rtl', textAlign: 'right' });
    expect(screen.getByText('سارة الأحمد').closest('[dir="rtl"]')).toBeInTheDocument();
  });
});
