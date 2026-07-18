// Failing-first regression tests (Task 6): auto-verification integrity.
// R1 — verify must not overwrite the generation-time improvement estimate.
// R2 — verify must not mutate store applied state (no applyAllOptimizations).
// R3 — identical optimized text + actionable edits = implementation failure, never
//      a genuine verification.
// Written as it.fails BEFORE the verify rewrite; each flips to it() when fixed.

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import OptimizeSection from '../components/sections/OptimizeSection';
import { DirectionProvider } from '../components/providers/DirectionProvider';

const mockAnalyzeResumeWithAI = vi.hoisted(() => vi.fn());
const mockGetAuthHeaders = vi.hoisted(() => vi.fn(() => Promise.resolve({ Authorization: 'Bearer test-token' })));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, options) => {
            if (typeof options === 'string') return options || key;
            if (options?.defaultValue) {
                return Object.entries(options).reduce((text, [name, value]) => (
                    name === 'defaultValue' ? text : text.replaceAll(`{{${name}}}`, String(value))
                ), options.defaultValue);
            }
            return key;
        },
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
}));

const mockSetOptimizations = vi.fn();
const mockApplyOptimization = vi.fn();
const mockRevertOptimization = vi.fn();
const mockApplyAllOptimizations = vi.fn();
const mockSetOptimizationMetrics = vi.fn();
const mockSetCachedAnalysis = vi.fn();

let mockStoreState = {};

const buildStoreState = () => ({
    originalResume: null,
    parsedResumeText: null,
    optimizations: [],
    keywordSuggestions: [],
    showOptimized: false,
    isSaudiNational: false,
    setOptimizations: mockSetOptimizations,
    applyOptimization: mockApplyOptimization,
    revertOptimization: mockRevertOptimization,
    refineOptimization: vi.fn(),
    applyAllOptimizations: mockApplyAllOptimizations,
    revertAllOptimizations: vi.fn(),
    setKeywordSuggestions: vi.fn(),
    optimizationMetrics: {
        beforeScore: null,
        afterScore: null,
        improvement: null,
        jdKeywords: [],
        matchedKeywords: [],
        reasoning: null,
        hasJobDescription: false,
        vision2030: null,
    },
    setOptimizationMetrics: mockSetOptimizationMetrics,
    resetOptimizationMetrics: vi.fn(),
    getCachedAnalysis: vi.fn(() => null),
    setCachedAnalysis: mockSetCachedAnalysis,
    getActiveResume: vi.fn(() => null),
    baselineMatchScore: null,
    jobVariants: [],
    activeVariantId: null,
    variantRestoreNonce: 0,
    saveCurrentAsVariant: vi.fn(() => 'variant-test'),
    updateVariant: vi.fn(),
    openVariant: vi.fn(() => null),
    renameVariant: vi.fn(),
    deleteVariant: vi.fn(),
});

vi.mock('../lib/stores/resumeStore', () => {
    const mockFn = (selector) => (typeof selector === 'function' ? selector(mockStoreState) : mockStoreState);
    mockFn.getState = () => mockStoreState;
    return { useResumeStore: mockFn };
});

vi.mock('../services/analytics', () => ({
    analytics: {
        track: vi.fn(),
        trackOptimization: vi.fn(),
        trackOptimizationFailed: vi.fn(),
        trackScoreDiffExpanded: vi.fn(),
        trackExplainabilityPanelOpened: vi.fn(),
    },
}));

vi.mock('../services/api', () => ({
    refineBullet: vi.fn(),
    analyzeResumeWithAI: mockAnalyzeResumeWithAI,
}));

vi.mock('../lib/auth/authHeaders', () => ({
    getAuthHeaders: mockGetAuthHeaders,
}));

vi.mock('../hooks/useRateLimit', () => ({
    useRateLimit: () => ({ isRateLimited: false, retryAfter: null, handleError: vi.fn(() => false), clearRateLimit: vi.fn() }),
}));

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

vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'test-user-123', email: 'test@example.com' },
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        session: { access_token: 'test-token' },
    }),
}));

global.fetch = vi.fn();

const renderWithProviders = (ui) => render(<DirectionProvider>{ui}</DirectionProvider>);

const originalResumeFixture = () => ({
    basics: {
        name: 'Test User',
        label: 'Backend Engineer',
        email: 't@example.com',
        phone: '',
        summary: 'Backend engineer with five years of production API experience across payments and logistics platforms.',
        location: { city: 'Riyadh', countryCode: 'SA', region: '' },
        profiles: [],
    },
    work: [{
        name: 'Acme',
        position: 'Engineer',
        startDate: '2020',
        endDate: '2024',
        summary: '',
        highlights: [
            'Improved backend APIs with measurable latency reductions and production reliability gains.',
            'Built React dashboards for hiring managers with accessible workflows and analytics.',
        ],
    }],
    education: [],
    skills: [{ name: 'Technical', level: '', keywords: ['React', 'TypeScript', 'Node.js'] }],
    projects: [],
});

const optimizeApiResponse = (cards) => ({
    ok: true,
    json: () => Promise.resolve({
        cards,
        matchScoring: {
            beforeScore: 45,
            estimatedImprovement: 12,
            jdKeywords: ['React'],
            matchedKeywords: [],
            reasoning: 'Initial projected score',
        },
        debug: { hasJobDescription: true },
    }),
});

beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query) => ({
            matches: query.includes('min-width: 768px'),
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }),
    });
    Object.defineProperty(window, 'crypto', {
        value: { randomUUID: () => 'test-session-id-' + Math.random() },
    });
});

beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = buildStoreState();
    mockSetOptimizations.mockImplementation((optimizations) => {
        mockStoreState.optimizations = optimizations;
    });
    mockSetOptimizationMetrics.mockImplementation((metrics) => {
        mockStoreState.optimizationMetrics = { ...mockStoreState.optimizationMetrics, ...metrics };
    });

    Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: {
            getItem: vi.fn((key) => (key === 'watheq:lastJobDescription' ? 'Backend engineer role' : null)),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
        },
    });
});

describe('auto-verification integrity (Task 6 regressions)', () => {
    const setupChangedResumeScenario = () => {
        mockStoreState.originalResume = originalResumeFixture();
        mockStoreState.parsedResumeText =
            'Original resume text with enough detailed work history and skills evidence for verification to run. '.repeat(3);
        mockStoreState.baselineMatchScore = 45;
        // The optimized view genuinely differs from the original resume.
        mockStoreState.getActiveResume = vi.fn(() => {
            const optimized = originalResumeFixture();
            optimized.basics.summary =
                'Rewritten backend engineering summary aligned to the job description with quantified payment platform impact.';
            return optimized;
        });
        global.fetch.mockResolvedValue(optimizeApiResponse([{
            section: 'Summary',
            exampleBefore: 'Backend engineer with five years of production API experience across payments and logistics platforms.',
            exampleAfter: 'Rewritten backend engineering summary aligned to the job description with quantified payment platform impact.',
        }]));
    };

    const runOptimizeAndWaitForVerify = async () => {
        renderWithProviders(<OptimizeSection />);
        fireEvent.click(screen.getByRole('button', { name: /optimize/i }));
        await waitFor(() => {
            expect(mockAnalyzeResumeWithAI).toHaveBeenCalled();
        });
        await waitFor(() => {
            expect(screen.queryByText('Verifying...')).toBeNull();
        });
    };

    it('R1: a verified no-change score must not overwrite the improvement estimate', async () => {
        setupChangedResumeScenario();
        // Genuine re-analysis returns the same score as the baseline.
        mockAnalyzeResumeWithAI.mockResolvedValue({ score: 45, topHits: ['React'], missingKeywords: [] });

        await runOptimizeAndWaitForVerify();

        // The generation estimate (12) must survive verification; the verified
        // no-change result belongs in verifiedPotential, not in improvement.
        expect(mockStoreState.optimizationMetrics.improvement).toBe(12);
        // afterScore is a frozen legacy field — verification must not write it.
        expect(mockStoreState.optimizationMetrics.afterScore).toBeNull();
    });

    it('R2: verification must not mutate store applied state', async () => {
        setupChangedResumeScenario();
        mockAnalyzeResumeWithAI.mockResolvedValue({ score: 52, topHits: ['React'], missingKeywords: [] });

        await runOptimizeAndWaitForVerify();

        // Pure simulation: no temporary apply-all, no per-card restore churn,
        // and therefore no showOptimized side effect to restore.
        expect(mockApplyAllOptimizations).not.toHaveBeenCalled();
    });

    it('R3: identical optimized text is an implementation failure, not a verified no-change', async () => {
        mockStoreState.originalResume = originalResumeFixture();
        mockStoreState.parsedResumeText =
            'Original resume text with enough detailed work history and skills evidence for verification to run. '.repeat(3);
        mockStoreState.baselineMatchScore = 45;
        // The "optimized" resume is byte-identical to the original — the card's
        // original text matches nothing, so nothing merges.
        mockStoreState.getActiveResume = vi.fn(() => originalResumeFixture());
        global.fetch.mockResolvedValue(optimizeApiResponse([{
            section: 'Experience',
            exampleBefore: 'A bullet that appears nowhere in this resume document at all',
            exampleAfter: 'A rewritten bullet that cannot land anywhere',
        }]));
        mockAnalyzeResumeWithAI.mockResolvedValue({ score: 45, topHits: [], missingKeywords: [] });

        renderWithProviders(<OptimizeSection />);
        fireEvent.click(screen.getByRole('button', { name: /optimize/i }));
        await waitFor(() => {
            expect(mockSetOptimizations).toHaveBeenCalled();
        });
        await waitFor(() => {
            expect(screen.queryByText('Verifying...')).toBeNull();
        });

        // Scoring identical text would produce a fake "verified no-change" —
        // the guard must refuse to call the AI at all.
        expect(mockAnalyzeResumeWithAI).not.toHaveBeenCalled();
        expect(mockStoreState.optimizationMetrics.verifiedPotential ?? null).toBeNull();
    });
});
