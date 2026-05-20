import { render, screen } from '@testing-library/react';
import { FileText, Sparkles, Target } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { GlassTabs } from '../components/ui/GlassTabs';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
  }),
}));

const tabs = [
  { value: 'resume', label: 'Resume', icon: FileText },
  { value: 'match', label: 'Match', icon: Target },
  { value: 'optimize', label: 'Optimize', icon: Sparkles },
  { value: 'templates', label: 'Templates', icon: FileText },
  { value: 'cover-letter', label: 'Cover Letter', icon: FileText },
  { value: 'vision2030', label: 'Vision 2030', icon: Target, isPremium: true },
];

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
};

describe('GlassTabs responsive behavior', () => {
  it.each([768, 1024])('keeps desktop workspace tabs horizontally scrollable at %ipx', (width) => {
    setViewportWidth(width);
    render(
      <GlassTabs
        tabs={tabs}
        activeValue="resume"
        onTabChange={vi.fn()}
        rightAction={<button type="button">Clear</button>}
      />
    );

    const tab = screen.getByRole('tab', { name: /cover letter/i });
    const scrollContainer = tab.parentElement;
    const nav = screen.getByRole('tablist');
    const rightAction = screen.getByRole('button', { name: /clear/i }).parentElement;

    expect(nav).toHaveClass('w-full');
    expect(scrollContainer).toHaveClass('overflow-x-auto', 'min-w-0');
    expect(tab).toHaveClass('whitespace-nowrap', 'shrink-0');
    expect(rightAction).toHaveClass('flex-shrink-0');
  });

  it('marks locked tabs disabled with a reason', () => {
    render(
      <GlassTabs
        tabs={[
          tabs[0],
          { ...tabs[1], disabledReason: 'Upload a resume first.' },
        ]}
        activeValue="resume"
        onTabChange={vi.fn()}
      />
    );

    const lockedTab = screen.getByRole('tab', { name: /match/i });
    expect(lockedTab).toBeDisabled();
    expect(lockedTab).toHaveAttribute('aria-disabled', 'true');
    expect(lockedTab).toHaveAttribute('title', 'Upload a resume first.');
    expect(lockedTab).toHaveClass('opacity-45');
  });
});
