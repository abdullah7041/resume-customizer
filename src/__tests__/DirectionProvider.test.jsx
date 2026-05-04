import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DirectionProvider } from '../components/providers/DirectionProvider';

const changeLanguage = vi.fn();
let language = 'en';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      get language() {
        return language;
      },
      changeLanguage,
    },
  }),
}));

vi.mock('../services/analytics', () => ({
  analytics: {
    trackLanguageChange: vi.fn(),
  },
}));

describe('DirectionProvider', () => {
  beforeEach(() => {
    language = 'en';
    changeLanguage.mockClear();
    document.documentElement.removeAttribute('dir');
    document.documentElement.removeAttribute('lang');
    document.documentElement.style.removeProperty('--font-family');
  });

  it('sets English document language and ltr direction', async () => {
    render(
      <DirectionProvider>
        <div>content</div>
      </DirectionProvider>
    );

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('dir', 'ltr');
      expect(document.documentElement).toHaveAttribute('lang', 'en');
    });
    expect(document.documentElement.style.getPropertyValue('--font-family')).toContain('Inter');
  });

  it('sets Arabic document language and rtl direction', async () => {
    language = 'ar';

    render(
      <DirectionProvider>
        <div>content</div>
      </DirectionProvider>
    );

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('dir', 'rtl');
      expect(document.documentElement).toHaveAttribute('lang', 'ar');
    });
    expect(document.documentElement.style.getPropertyValue('--font-family')).toContain('Arabic');
  });
});
