import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';
import { useResumeStore } from '../lib/stores/resumeStore';

vi.mock('../components/onboarding/OnboardingChat', async () => {
  const { useResumeStore } = await import('../lib/stores/resumeStore');
  return {
    default: ({ onComplete }: { onComplete?: () => void }) => (
      <main>
        <div>Onboarding</div>
        <button
          type="button"
          onClick={() => {
            useResumeStore.getState().patchProfile({
              basics: {
                name: 'Sara Al-Otaibi',
                label: '',
                email: '',
                phone: '',
                summary: '',
                location: { city: '', countryCode: '', region: '' },
                profiles: [],
              },
            });
          }}
        >
          Answer name
        </button>
        <button type="button" onClick={() => onComplete?.()}>
          Complete onboarding
        </button>
      </main>
    ),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../components/Layout/Header', () => ({
  default: () => <header>Header</header>,
}));

// Render a workspace with interactive controls that carry the same `data-tour`
// attributes the (now-removed) onboarding tour used to target — including the
// "features" target that was historically MISSING, which used to leave the
// Joyride overlay stuck with no spotlight, dimming + blocking the whole page.
vi.mock('../components/Layout/MainContent', () => ({
  default: () => (
    <main>
      <div data-tour="credits">Credits: 10</div>
      <button data-tour="upload-header" type="button">Upload Resume</button>
      <button type="button">Export PDF</button>
      <button type="button">Select Template</button>
      <button type="button">Open Menu</button>
    </main>
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

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
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

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
};

describe('App onboarding overlay — react-joyride removed', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    setPath('/');
    // These assert the workspace (joyride-removal); skip the first-run gate.
    window.localStorage.setItem('watheq:onboarded', 'true');
  });

  afterEach(() => {
    setViewportWidth(originalInnerWidth);
  });

  it('does not mount any react-joyride overlay on signed-in mobile render', () => {
    setViewportWidth(375); // mobile viewport
    const { container } = render(<App />);

    // No Joyride overlay container, spotlight, or tooltip should exist anywhere.
    expect(container.querySelector('.react-joyride__overlay')).toBeNull();
    expect(container.querySelector('.react-joyride__spotlight')).toBeNull();
    expect(container.querySelector('.react-joyride__tooltip')).toBeNull();
    expect(container.querySelector('[data-test-id="overlay"]')).toBeNull();
    expect(container.querySelector('[data-test-id^="joyride"]')).toBeNull();

    // No element should carry the Joyride z-index used for the blocking overlay.
    const highZIndexElements = Array.from(container.querySelectorAll<HTMLElement>('*')).filter(
      (el) => el.style?.zIndex === '10000',
    );
    expect(highZIndexElements).toHaveLength(0);
  });

  it('renders no blocking overlay when a tour target (data-tour="features") is missing', () => {
    setViewportWidth(375);
    render(<App />);

    // The "features" target referenced by the old tour does not exist in this
    // mocked workspace. With Joyride removed, this must not produce any
    // blocking overlay, and the UI must remain interactive.
    expect(document.querySelector('[data-tour="features"]')).toBeNull();
    expect(document.querySelector('.react-joyride__overlay')).toBeNull();

    const uploadButton = screen.getByRole('button', { name: /upload resume/i });
    expect(uploadButton).toBeInTheDocument();
    expect(uploadButton).toBeEnabled();
  });

  it('shows the landing page (not onboarding) on a signed-out visitor\'s first paint', () => {
    window.localStorage.removeItem('watheq:onboarded');
    // No landingSeen yet: the visitor has not clicked "Get started", so the first-run
    // onboarding gate must NOT preempt the landing/workspace.
    window.localStorage.removeItem('watheq:landingSeen');
    useResumeStore.setState({ originalResume: null, parsedResumeText: null, searchIntent: null });

    render(<App />);

    expect(screen.queryByText('Onboarding')).toBeNull();
    expect(screen.getByRole('button', { name: /upload resume/i })).toBeInTheDocument();
  });

  it('shows the first-run onboarding gate once a signed-out visitor has entered (Get started)', () => {
    window.localStorage.removeItem('watheq:onboarded');
    // Simulate the visitor clicking "Get started" on the landing page.
    window.localStorage.setItem('watheq:landingSeen', 'true');
    useResumeStore.setState({ originalResume: null, parsedResumeText: null, searchIntent: null });

    render(<App />);

    expect(screen.getByText('Onboarding')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upload resume/i })).toBeNull();
  });

  it('does not leave first-run onboarding after only the starter name answer', async () => {
    window.localStorage.removeItem('watheq:onboarded');
    window.localStorage.setItem('watheq:landingSeen', 'true');
    useResumeStore.setState({ originalResume: null, parsedResumeText: null, searchIntent: null });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /answer name/i }));

    expect(screen.getByText('Onboarding')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upload resume/i })).toBeNull();
  });

  it('marks signed-out first-run completion as guest preview', async () => {
    window.localStorage.removeItem('watheq:onboarded');
    window.localStorage.removeItem('watheq:guestMode');
    window.localStorage.setItem('watheq:landingSeen', 'true');
    useResumeStore.setState({ originalResume: null, parsedResumeText: null, searchIntent: null });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /complete onboarding/i }));

    expect(window.localStorage.getItem('watheq:onboarded')).toBe('true');
    expect(window.localStorage.getItem('watheq:guestMode')).toBe('true');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /upload resume/i })).toBeInTheDocument();
    });
  });

  it('keeps workflow controls present and clickable after sign-in', () => {
    setViewportWidth(1024);
    render(<App />);

    const uploadButton = screen.getByRole('button', { name: /upload resume/i });
    const exportButton = screen.getByRole('button', { name: /export pdf/i });
    const templateButton = screen.getByRole('button', { name: /select template/i });
    const menuButton = screen.getByRole('button', { name: /open menu/i });

    for (const button of [uploadButton, exportButton, templateButton, menuButton]) {
      expect(button).toBeInTheDocument();
      expect(button).toBeEnabled();
      // pointer-events should not be disabled by an overlay.
      expect(getComputedStyle(button).pointerEvents).not.toBe('none');
    }

    expect(screen.getByText('Credits: 10')).toBeInTheDocument();
  });
});
