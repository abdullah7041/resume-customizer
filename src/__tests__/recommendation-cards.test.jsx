// Failing-first regression tests (Task 6): Skills/Certification cards are
// recommendation-only — no Apply controls, no Pending state, and they never count
// in applied progress. Written as it.fails BEFORE the fix; flips to it() when the
// recommendation rendering + actionable counters land.

import { render, screen, fireEvent } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import OptimizeSection from '../components/sections/OptimizeSection';
import { DirectionProvider } from '../components/providers/DirectionProvider';

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

let mockStoreState = {};

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
    analyzeResumeWithAI: vi.fn(),
}));

vi.mock('../lib/auth/authHeaders', () => ({
    getAuthHeaders: vi.fn(() => Promise.resolve({ Authorization: 'Bearer test-token' })),
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

const card = (over) => ({
    sectionId: 'experience-0',
    sectionType: 'experience',
    original: 'Original bullet content for the experience entry',
    optimized: 'Optimized bullet content for the experience entry',
    applied: false,
    ...over,
});

const buildStoreState = () => ({
    originalResume: null,
    parsedResumeText: 'Resume text used by the optimize section for context.',
    optimizations: [],
    keywordSuggestions: [],
    showOptimized: false,
    isSaudiNational: false,
    setOptimizations: vi.fn(),
    applyOptimization: vi.fn(),
    revertOptimization: vi.fn(),
    refineOptimization: vi.fn(),
    applyAllOptimizations: vi.fn(),
    revertAllOptimizations: vi.fn(),
    setKeywordSuggestions: vi.fn(),
    optimizationMetrics: {
        beforeScore: null,
        afterScore: null,
        improvement: 10,
        jdKeywords: [],
        matchedKeywords: [],
        reasoning: null,
        hasJobDescription: true,
        vision2030: null,
    },
    setOptimizationMetrics: vi.fn(),
    resetOptimizationMetrics: vi.fn(),
    getCachedAnalysis: vi.fn(() => null),
    setCachedAnalysis: vi.fn(),
    getActiveResume: vi.fn(() => null),
    baselineMatchScore: 40,
    jobVariants: [],
    activeVariantId: null,
    variantRestoreNonce: 0,
    saveCurrentAsVariant: vi.fn(() => 'variant-test'),
    updateVariant: vi.fn(),
    openVariant: vi.fn(() => null),
    renameVariant: vi.fn(),
    deleteVariant: vi.fn(),
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

describe('recommendation-only cards (Task 6 regressions)', () => {
    it.fails('R4: skills/certification cards render no Apply controls and no Pending state', () => {
        mockStoreState.optimizations = [
            card({}),
            card({ sectionId: 'skills-0', sectionType: 'skills', original: 'Add: TypeScript and Kubernetes', optimized: 'TypeScript, Kubernetes' }),
            card({ sectionId: 'certifications-0', sectionType: 'certifications', original: 'Recommended Certification', optimized: 'CISSP (ISC2) - relevant for the role' }),
        ];

        renderWithProviders(<OptimizeSection />);

        // Only the actionable group may offer a group Apply button.
        expect(screen.getAllByText('Apply all in this job')).toHaveLength(1);

        // Pending chips (spans, not the queue filter button) exist only on actionable cards.
        const pendingChips = screen.getAllByText('Pending').filter((el) => el.tagName === 'SPAN');
        expect(pendingChips).toHaveLength(1);

        // Expanding the skills card must not reveal an Apply button.
        fireEvent.click(screen.getByRole('button', { name: /add: typescript and kubernetes/i }));
        expect(screen.queryByText('Apply Suggestion')).toBeNull();
    });

    it.fails('R6: applied progress counts actionable cards only, recommendations listed separately', () => {
        mockStoreState.optimizations = [
            card({ sectionId: 'experience-0', applied: true }),
            card({ sectionId: 'experience-1', original: 'Second original bullet content', optimized: 'Second optimized bullet', applied: true }),
            card({ sectionId: 'summary-0', sectionType: 'summary', original: 'Old summary', optimized: 'New summary' }),
            card({ sectionId: 'skills-0', sectionType: 'skills', original: 'Add: TypeScript', optimized: 'TypeScript' }),
            card({ sectionId: 'certifications-0', sectionType: 'certifications', original: 'Recommended Certification', optimized: 'CISSP (ISC2) - relevant' }),
        ];

        renderWithProviders(<OptimizeSection />);

        // Never "2/5 applied" — recommendations are not part of implementation progress.
        expect(screen.queryByText('2/5 applied')).toBeNull();
        expect(screen.getByText('2/3 resume changes applied')).toBeInTheDocument();
        expect(screen.getByText('2 recommendations')).toBeInTheDocument();
    });
});
