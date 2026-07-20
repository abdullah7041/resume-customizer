import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';

const directionState = vi.hoisted(() => ({
  currentLanguage: 'en',
  toggleLanguage: vi.fn(),
}));

vi.mock('../components/providers/DirectionProvider', () => ({
  useDirection: () => directionState,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    directionState.currentLanguage = 'en';
    directionState.toggleLanguage.mockClear();
  });

  it('renders an accessible 44px icon control in compact mode', () => {
    render(<LanguageSwitcher compact />);

    const button = screen.getByRole('button', { name: 'Language' });
    expect(button).toHaveClass('h-11', 'w-11', 'min-h-[44px]', 'min-w-[44px]');
    expect(screen.getByText('العربية')).toHaveClass('sr-only');

    fireEvent.click(button);
    expect(directionState.toggleLanguage).toHaveBeenCalledOnce();
  });

  it('keeps the language label visible by default', () => {
    render(<LanguageSwitcher />);

    const button = screen.getByRole('button', { name: 'Language' });
    expect(button).not.toHaveClass('w-11');
    expect(screen.getByText('العربية')).not.toHaveClass('sr-only');
  });
});
