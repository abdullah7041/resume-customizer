import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';

const headerProps = vi.hoisted(() => ({
  calls: [] as Array<{ showDecorativeSkyline?: boolean; showMarketingNav?: boolean }>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const translations: Record<string, string> = {
        'privacy.title': 'Privacy Policy',
        'privacy.lastUpdated': 'Last Updated',
        'privacy.sections.intro.title': 'Introduction',
        'privacy.sections.intro.content': 'Intro content',
        'privacy.sections.controller.title': 'Data Controller',
        'privacy.sections.controller.name': 'Watheq',
        'privacy.sections.controller.address': 'Riyadh',
        'privacy.sections.controller.email': 'privacy@watheqai.app',
        'privacy.sections.dataCollected.title': 'Data We Collect',
        'privacy.sections.dataCollected.personal.title': 'Personal Data',
        'privacy.sections.dataCollected.personal.items.name': 'Full name',
        'privacy.sections.dataCollected.personal.items.email': 'Email address',
        'privacy.sections.dataCollected.personal.items.phone': 'Phone number',
        'privacy.sections.dataCollected.personal.items.resume': 'Resume content',
        'privacy.sections.dataCollected.technical.title': 'Technical Data',
        'privacy.sections.dataCollected.technical.items.ip': 'IP address',
        'privacy.sections.dataCollected.technical.items.browser': 'Browser',
        'privacy.sections.dataCollected.technical.items.device': 'Device',
        'privacy.sections.purpose.title': 'Purpose of Processing',
        'privacy.sections.purpose.items.service': 'Service',
        'privacy.sections.purpose.items.improvement': 'Improvement',
        'privacy.sections.purpose.items.communication': 'Communication',
        'privacy.sections.purpose.items.legal': 'Legal',
        'privacy.sections.legalBasis.title': 'Legal Basis',
        'privacy.sections.legalBasis.content': 'Legal basis content',
        'privacy.sections.rights.title': 'Your Rights',
        'privacy.sections.rights.access.title': 'Access',
        'privacy.sections.rights.access.description': 'Access description',
        'privacy.sections.rights.rectification.title': 'Rectification',
        'privacy.sections.rights.rectification.description': 'Rectification description',
        'privacy.sections.rights.deletion.title': 'Deletion',
        'privacy.sections.rights.deletion.description': 'Deletion description',
        'privacy.sections.rights.portability.title': 'Portability',
        'privacy.sections.rights.portability.description': 'Portability description',
        'privacy.sections.rights.withdraw.title': 'Withdraw',
        'privacy.sections.rights.withdraw.description': 'Withdraw description',
        'privacy.sections.rights.complaint.title': 'Complaint',
        'privacy.sections.rights.complaint.description': 'Complaint description',
        'privacy.sections.retention.title': 'Data Retention',
        'privacy.sections.retention.content': 'Retention content',
        'privacy.sections.crossBorder.title': 'Cross-Border Data Transfers',
        'privacy.sections.crossBorder.content': 'Cross-border content',
        'privacy.sections.contact.title': 'Contact Us',
        'privacy.sections.contact.content': 'Contact content',
        'privacy.sections.contact.button': 'Contact Privacy Team',
        'privacy.sdaiaReference': 'SDAIA reference',
        'footer.linksLabel': 'Legal links',
        'footer.links.privacy': 'Privacy Policy',
        'footer.links.contact': 'Contact Us',
      };
      return translations[key] ?? fallback ?? key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('../components/Layout/Header', () => ({
  default: (props: { showDecorativeSkyline?: boolean; showMarketingNav?: boolean }) => {
    headerProps.calls.push(props);
    return <header>Header</header>;
  },
}));

// App calls useAuth() at the top; without a provider it throws. Mirror the mock the
// other App-rendering tests use (App.onboarding, MainContent).
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false, signInWithGoogle: vi.fn() }),
}));

vi.mock('../components/Layout/MainContent', () => ({
  default: () => <main>Workspace</main>,
}));

vi.mock('../components/onboarding/OnboardingChat', () => ({
  default: ({ onComplete }: { onComplete?: () => void }) => (
    <button type="button" onClick={onComplete}>
      Complete onboarding
    </button>
  ),
}));

vi.mock('../pages/AdminFeedbackPage', () => ({
  AdminFeedbackPage: () => <main>Admin feedback dashboard</main>,
}));

vi.mock('../components/compliance/ConsentBanner', () => ({
  ConsentBanner: () => <div>Consent Banner</div>,
}));

vi.mock('../components/ui/EnvironmentBadge', () => ({
  default: () => null,
}));

vi.mock('../components/ui/OfflineIndicator', () => ({
  default: () => null,
}));

vi.mock('../components/ui/UserProgressNav', () => ({
  UserProgressNav: () => null,
}));

vi.mock('../components/Credits/UpgradeModal', () => ({
  UpgradeModal: () => null,
}));
vi.mock('../components/Credits/PricingWaitlistModal', () => ({
  PricingWaitlistModal: () => null,
}));

vi.mock('../components/providers/DirectionProvider', () => ({
  DirectionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../hooks/useUserCredits', () => ({
  useUserCredits: () => ({
    credits: { remaining: 10 },
    showUpgrade: false,
    setShowUpgrade: vi.fn(),
    upgradeDismissedKey: null,
  }),
}));

vi.mock('../hooks/useOnboardingTour', () => ({
  useOnboardingTour: () => ({
    run: false,
    steps: [],
    stepIndex: 0,
    handleEvent: vi.fn(),
    startTour: vi.fn(),
    resetTour: vi.fn(),
  }),
}));

vi.mock('../lib/utils/storage-migration', () => ({
  migrateStorageKeys: vi.fn(),
}));

const setPath = (path: string) => {
  window.history.pushState({}, '', path);
};

describe('App compliance navigation', () => {
  beforeEach(() => {
    setPath('/');
    headerProps.calls.length = 0;
    window.localStorage.clear();
    // Returning user: skip the first-run onboarding gate so the workspace renders.
    window.localStorage.setItem('watheq:onboarded', 'true');
    window.localStorage.setItem('watheq:guestMode', 'true');
  });

  it('renders workspace for the default app path', () => {
    window.localStorage.setItem('watheq:guestMode', 'true');
    render(<App />);

    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy');
    expect(headerProps.calls.at(-1)?.showMarketingNav).toBe(true);
  });

  it('renders the privacy policy at /privacy', async () => {
    setPath('/privacy');
    render(<App />);

    expect(await screen.findByRole('heading', { name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument();
    expect(headerProps.calls.at(-1)?.showDecorativeSkyline).toBe(false);
    expect(headerProps.calls.at(-1)?.showMarketingNav).toBe(false);
  });

  it('renders the terms of service at /terms', async () => {
    setPath('/terms');
    render(<App />);

    expect(await screen.findByRole('heading', { name: /terms of service/i })).toBeInTheDocument();
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument();
    expect(headerProps.calls.at(-1)?.showDecorativeSkyline).toBe(false);
  });

  it('renders the admin feedback dashboard at /admin/feedback', async () => {
    setPath('/admin/feedback');
    render(<App />);

    expect(await screen.findByText('Admin feedback dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument();
    expect(headerProps.calls.at(-1)?.showDecorativeSkyline).toBe(false);
  });

  it('keeps the normal app shell visible after signed-out onboarding enters guest mode', async () => {
    window.localStorage.removeItem('watheq:onboarded');

    render(<App />);

    expect(headerProps.calls.at(-1)?.showMarketingNav).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /complete onboarding/i }));

    expect(await screen.findByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Header')).toBeInTheDocument();
  });
});
