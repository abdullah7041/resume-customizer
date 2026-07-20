import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Header from '../components/Layout/Header';

const authState = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; app_metadata: Record<string, unknown>; user_metadata: Record<string, unknown> },
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { dir: () => 'ltr' },
  }),
}));

vi.mock('../lib/assets', () => ({
  getSkylineUrls: () => ({
    desktop: 'data:image/png;base64,AA==',
    mobile: 'data:image/png;base64,AA==',
  }),
}));

vi.mock('../components/ui/LanguageSwitcher', () => ({
  LanguageSwitcher: ({ compact = false }: { compact?: boolean }) => (
    <button type="button" aria-label="Language" data-compact={String(compact)}>
      Language
    </button>
  ),
}));

vi.mock('../components/ui/GlassButton', () => ({
  GlassButton: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('../components/Credits/CreditBalance', () => ({
  CreditBalance: ({ onClick }: { onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      Credits
    </button>
  ),
}));

vi.mock('../components/Credits/CreditUsageModal', () => ({
  CreditUsageModal: () => null,
}));

vi.mock('../components/Credits/UpgradeModal', () => ({
  UpgradeModal: () => null,
}));
vi.mock('../components/Credits/PricingWaitlistModal', () => ({
  PricingWaitlistModal: () => null,
}));

vi.mock('../components/Settings/SettingsModal', () => ({
  SettingsModal: () => null,
}));

vi.mock('../components/Feedback/FeedbackModal', () => ({
  FeedbackModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div role="dialog">Feedback modal</div> : null),
}));

const themeState = vi.hoisted(() => ({
  theme: 'light' as 'light' | 'dark',
  toggleTheme: vi.fn(),
}));

vi.mock('../hooks/useTheme', () => ({
  useTheme: () => [themeState.theme, themeState.toggleTheme],
}));

vi.mock('../hooks/useUserCredits', () => ({
  useUserCredits: () => ({
    credits: { remaining: 10, total: 20 },
  }),
}));

describe('Header feedback action', () => {
  beforeEach(() => {
    authState.user = null;
    themeState.theme = 'light';
    themeState.toggleTheme.mockClear();
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  it('does not show Feedback while signed out', () => {
    render(<Header />);

    expect(screen.queryByRole('button', { name: /feedback/i })).not.toBeInTheDocument();
  });

  it('shows Feedback for authenticated users in the account menu', async () => {
    authState.user = {
      id: 'user-1',
      email: 'user@example.com',
      app_metadata: {},
      user_metadata: {},
    };

    render(<Header />);

    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));

    expect(await screen.findByRole('menuitem', { name: /feedback/i })).toBeInTheDocument();
  });

  it('keeps theme and language controls directly available in both responsive headers', () => {
    authState.user = {
      id: 'user-1',
      email: 'user@example.com',
      app_metadata: {},
      user_metadata: {},
    };

    const { container } = render(<Header />);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    const themeButtons = screen.getAllByRole('button', { name: 'Toggle theme' });
    expect(themeButtons).toHaveLength(2);

    const languageButtons = screen.getAllByRole('button', { name: 'Language' });
    expect(languageButtons).toHaveLength(2);
    expect(languageButtons.filter((button) => button.dataset.compact === 'true')).toHaveLength(1);
    expect(languageButtons.filter((button) => button.dataset.compact === 'false')).toHaveLength(1);

    const mobilePreferences = container.querySelector('[data-mobile-header-preferences]');
    expect(mobilePreferences).toHaveClass(
      'absolute',
      'end-[calc(var(--app-shell-gutter)+152px)]',
    );

    const mobileCredits = Array.from(container.querySelectorAll('[data-tour="credits"]'))
      .find((element) => element.classList.contains('fixed'));
    expect(mobileCredits).toHaveClass(
      'fixed',
      'end-[calc(var(--app-shell-gutter)+52px)]',
    );

    fireEvent.click(themeButtons[0]);
    expect(themeState.toggleTheme).toHaveBeenCalledOnce();
  });

  it('renders the authenticated account menu outside the clipped header when opened', async () => {
    authState.user = {
      id: 'user-1',
      email: 'user@example.com',
      app_metadata: {},
      user_metadata: {},
    };

    render(<Header />);

    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));

    const menu = await screen.findByRole('menu');
    expect(menu).toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: 'Language' })).not.toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: 'Toggle theme' })).not.toBeInTheDocument();
  });

  it('mobile nav (dark mode): Feedback sits with Settings, secondary tools stay reachable', async () => {
    themeState.theme = 'dark';
    authState.user = {
      id: 'user-1',
      email: 'user@example.com',
      app_metadata: {},
      user_metadata: {},
    };

    render(<Header />);

    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));

    const nav = await screen.findByRole('dialog');

    // Feedback is no longer in the prominent Credits block, but is reachable
    // alongside Settings in the Auth section.
    const navQueries = within(nav);
    expect(navQueries.queryByRole('button', { name: 'Language' })).not.toBeInTheDocument();
    expect(navQueries.queryByRole('button', { name: 'Toggle theme' })).not.toBeInTheDocument();

    const feedbackButton = await navQueries.findByRole('button', { name: /feedback/i });
    const settingsButton = navQueries.getByRole('button', { name: /settings/i });
    expect(feedbackButton).toBeInTheDocument();
    expect(settingsButton).toBeInTheDocument();

    // Secondary tools (credits, plans, invite) remain reachable.
    expect(navQueries.getAllByText(/credits/i).length).toBeGreaterThan(0);
    expect(navQueries.getByText(/view plans/i)).toBeInTheDocument();
    expect(navQueries.getByText(/invite friends/i)).toBeInTheDocument();

    // Feedback still opens the existing modal.
    fireEvent.click(feedbackButton);
    expect(await screen.findByText('Feedback modal')).toBeInTheDocument();
  });
});
