import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Footer from '../components/Layout/Footer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const translations: Record<string, string> = {
        'footer.linksLabel': 'Legal links',
        'footer.links.privacy': 'Privacy Policy',
        'footer.links.terms': 'Terms of Service',
        'footer.links.contact': 'Contact Us',
        'footer.landingCta': 'Get started',
        'landing.hero.cta': 'View workflow',
      };
      return translations[key] ?? fallback ?? key;
    },
  }),
}));

describe('Footer compliance navigation', () => {
  it('links to the reachable privacy policy page', () => {
    render(<Footer />);

    expect(screen.getByRole('navigation', { name: /legal links/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: /contact us/i })).toHaveAttribute('href', 'mailto:support@watheqai.app');
    expect(screen.getByRole('link', { name: /^get started$/i })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: /^view workflow$/i })).not.toBeInTheDocument();
  });
});
