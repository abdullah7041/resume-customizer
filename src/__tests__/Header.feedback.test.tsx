import { fireEvent, render, screen } from '@testing-library/react';
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
  LanguageSwitcher: () => <div>Language</div>,
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

vi.mock('../components/Settings/SettingsModal', () => ({
  SettingsModal: () => null,
}));

vi.mock('../components/Feedback/FeedbackModal', () => ({
  FeedbackModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div role="dialog">Feedback modal</div> : null),
}));

vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ['light', vi.fn()],
}));

vi.mock('../hooks/useUserCredits', () => ({
  useUserCredits: () => ({
    credits: { remaining: 10, total: 20 },
  }),
}));

describe('Header feedback action', () => {
  beforeEach(() => {
    authState.user = null;
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

  it('shows Feedback for authenticated users', () => {
    authState.user = {
      id: 'user-1',
      email: 'user@example.com',
      app_metadata: {},
      user_metadata: {},
    };

    render(<Header />);

    expect(screen.getByRole('button', { name: /feedback/i })).toBeInTheDocument();
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

    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByText('Language').length).toBeGreaterThan(0);
  });
});
