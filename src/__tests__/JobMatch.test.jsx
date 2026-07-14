import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      const dictionary = {
        'sections.match.realityCheck.title': 'Strategic Reality Check',
        'sections.match.realityCheck.ariaLabel': 'Strategic Reality Check',
        'sections.match.realityCheck.tiers.critical': 'Critical risk',
        'sections.match.realityCheck.confidence': 'Confidence',
        'sections.match.realityCheck.confidenceLevels.medium': 'Medium',
        'sections.match.realityCheck.unclearLabel': 'Unclear',
        'sections.match.realityCheck.recommendations.add_evidence_first': 'Add verifiable evidence before optimizing.',
      };
      if (dictionary[key]) return dictionary[key];
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
    window.localStorage.setItem('watheq:characterGender', 'male');
    const match = {
      score: 80,
      missingKeywords: ['React', 'Node.js', 'PostgreSQL', 'Kubernetes'],
      suggestions: ['Add React experience'],
      topHits: ['Leadership', 'SQL', 'APIs', 'Docker'],
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
    expect(screen.getByText(/optimize and export this version/i)).toBeInTheDocument();
    expect(screen.queryByText(/kubernetes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/docker/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/add react experience/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /keywords/i }));
    expect(screen.getByText(/missing keywords/i)).toBeInTheDocument();
    expect(screen.getByText(/keywords found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /score breakdown/i })).toBeInTheDocument();
    expect(screen.getByTestId('character-results-companion')).toHaveAttribute('data-variant', 'match');
    expect(screen.getByTestId('character-results-companion')).toHaveAttribute('data-tier', 'celebrating');
  });

  it('renders critical Reality Check separately from unclear risks', () => {
    const match = {
      score: 45,
      missingKeywords: ['Machine learning'],
      suggestions: ['Add evidence only if accurate'],
      topHits: ['SQL'],
      coverage: 0.45,
      cosine: 0.45,
      strategicRealityCheck: {
        riskTier: 'critical',
        recommendation: 'add_evidence_first',
        confidence: 'medium',
        riskTypes: ['missing_required_skill'],
        summary: 'A critical requirement lacks visible resume evidence.',
        strengths: [],
        confirmedRisks: [{
          type: 'missing_required_skill',
          severity: 'critical',
          title: 'Machine learning evidence is missing',
          explanation: 'The job requires production machine learning.',
          mitigation: 'Add verified machine learning work only if it exists.',
          evidence: [{ source: 'job_description', snippet: 'machine learning' }],
        }],
        unclearRisks: [{
          type: 'evidence_quality',
          topic: 'Project ownership',
          reason: 'Resume wording is not specific.',
          evidenceNeeded: 'Clarify ownership and measurable outcomes.',
        }],
        limits: { cannotDetermine: ['Employer decisions'], assumptions: [] },
      },
    };

    render(
      <JobMatch
        onAnalyzeMatchAI={async () => { }}
        matchAnalysis={match}
        isAnalyzing={false}
        hasResume
      />
    );

    expect(screen.getByText(/add verifiable evidence before optimizing/i)).toBeInTheDocument();
    expect(screen.getAllByText(/machine learning evidence is missing/i)).toHaveLength(1);
    expect(screen.queryByRole('alert', { name: /strategic reality check/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /gaps & evidence/i }));
    expect(screen.getByRole('alert', { name: /strategic reality check/i })).toBeInTheDocument();
    expect(screen.getByText(/critical risk/i)).toBeInTheDocument();
    expect(screen.getAllByText(/machine learning evidence is missing/i)).toHaveLength(2);
    expect(screen.getByText(/unclear: project ownership/i)).toBeInTheDocument();
  });

  it('shows the explainability panel and treats strengths-only as detailed results', () => {
    const match = {
      score: 78,
      missingKeywords: ['GraphQL'],
      topHits: ['React'],
      matchedKeywords: ['React'],
      coverage: 0.6,
      cosine: 0.6,
      // Only strengths + assumptions — no suggestions, no gaps, no confirmed risks.
      strategicRealityCheck: {
        riskTier: 'low',
        recommendation: 'optimize_now',
        confidence: 'medium',
        riskTypes: [],
        summary: 'Strong fit.',
        strengths: [{
          title: 'Led a data team',
          whyItMatters: 'Matches the leadership requirement.',
          evidence: [{ source: 'resume', snippet: 'Managed a team of 6 analysts' }],
        }],
        confirmedRisks: [],
        unclearRisks: [],
        limits: { cannotDetermine: [], assumptions: ['Assumed English fluency'] },
      },
    };

    render(
      <JobMatch
        onAnalyzeMatchAI={async () => { }}
        matchAnalysis={match}
        isAnalyzing={false}
        hasResume
      />
    );

    // Strengths/assumptions alone keep the current full-analysis accordion available.
    const detailsBtn = screen.getByRole('button', { name: /full analysis/i });
    fireEvent.click(detailsBtn);

    // Panel present; expand it and confirm the evidence snippet renders verbatim.
    const panelToggle = screen.getByRole('button', { name: /sections\.explainability\.title/i });
    fireEvent.click(panelToggle);
    expect(screen.getByText('“Managed a team of 6 analysts”')).toBeInTheDocument();
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
    expect(screen.queryByTestId('character-results-companion')).not.toBeInTheDocument();
  });

  it('allows guest match analysis to run one free preview without credit confirmation', async () => {
    const onAnalyzeMatchAI = vi.fn().mockResolvedValue({ score: 82 });
    const onRequireSignIn = vi.fn();

    render(
      <JobMatch
        onAnalyzeMatchAI={onAnalyzeMatchAI}
        matchAnalysis={null}
        isAnalyzing={false}
        hasResume
        isGuestMode
        onRequireSignIn={onRequireSignIn}
        protectedActionMessage="Sign in to run AI analysis and save your progress."
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/paste the job description/i), {
      target: { value: 'Senior product manager role with roadmap ownership and stakeholder leadership.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /analyze match with ai/i }));

    expect(onRequireSignIn).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(onAnalyzeMatchAI).toHaveBeenCalledWith(
        'Senior product manager role with roadmap ownership and stakeholder leadership.',
        { freePreview: true },
      );
    });
    expect(screen.queryByText('Sign in to run AI analysis and save your progress.')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});




