import { render, screen } from '@testing-library/react';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { MatchSection as JobMatch } from '../components/sections/MatchSection';

// Mock supabase
vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    channel: vi.fn(() => ({
      on: vi.fn(() => ({ subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) })),
    })),
  },
  AppError: class AppError extends Error {
    constructor(message, code) {
      super(message);
      this.code = code;
    }
  },
}));

// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signInWithGoogle: vi.fn(),
  }),
}));

// Mock useUserCredits hook
vi.mock('../hooks/useUserCredits', () => ({
  useUserCredits: () => ({
    credits: { remaining: 100, total: 100, feedbackCreditsEarned: 0, referralCreditsEarned: 0, resetDate: new Date().toISOString() },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    showUpgrade: false,
    setShowUpgrade: vi.fn(),
    upgradeDismissedKey: null,
  }),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => {
      // Handle both simple strings and interpolated strings
      if (typeof options === 'string') {
        return options || key;
      }
      // Return key (translation strings are not critical for these tests)
      return key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

describe('JobMatch', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders analysis results with Saudi styling', () => {
    const match = {
      score: 80,
      missingKeywords: ['React'],
      suggestions: ['Add React experience'],
      topHits: ['Leadership'],
      coverage: 0.52,
      cosine: 0.71,
    };
    render(
      <JobMatch
        onAnalyzeMatchAI={async () => { }}
        matchAnalysis={match}
        isAnalyzing={false}
        hasResume
      />
    );

    expect(screen.getByRole('heading', { name: /match a role/i })).toBeInTheDocument();
    expect(screen.getByText(/missing keywords/i)).toBeInTheDocument();
    expect(screen.getByText(/recognized strengths/i)).toBeInTheDocument();
    expect(screen.getByText(/add react experience/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /score breakdown/i })).toBeInTheDocument();
  });

  it('prefills saved job description text', () => {
    window.localStorage.setItem('airo:lastJobDescription', 'Saved JD');

    render(
      <JobMatch
        onAnalyzeMatchAI={async () => { }}
        matchAnalysis={null}
        isAnalyzing={false}
        hasResume={false}
      />
    );

    expect(
      screen.getByPlaceholderText(/paste the job description/i)
    ).toHaveValue('Saved JD');
    expect(screen.getByText(/matches the requirements/i)).toBeInTheDocument();
  });
});




