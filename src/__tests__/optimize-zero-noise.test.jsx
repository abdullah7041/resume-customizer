// Failing-first regression test (Tasks 5/6): the zero-improvement repro.
// Baseline 10, improvement estimate 0, 15 cards, none applied — the UI must not
// render "10% -> Projected ~10%", a "no change" chip, "+0.0 pts per suggestion",
// or "Up to 10% if all suggestions are applied". Written as it.fails BEFORE the
// presentation rewrite; flips to it() when states A-E land.

import { render, screen } from '@testing-library/react';
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

describe('zero-improvement repro (Task 5 regression)', () => {
    it('R9: baseline 10 + zero estimate + none applied shows no misleading score lines', () => {
        const cards = [];
        for (let i = 0; i < 12; i++) {
            cards.push({
                sectionId: `experience-${i}`,
                sectionType: 'experience',
                original: `Original experience bullet number ${i} with details`,
                optimized: `Optimized experience bullet number ${i} with details`,
                applied: false,
            });
        }
        cards.push({ sectionId: 'skills-0', sectionType: 'skills', original: 'Add: TypeScript', optimized: 'TypeScript', applied: false });
        cards.push({ sectionId: 'certifications-0', sectionType: 'certifications', original: 'Recommended Certification', optimized: 'CISSP (ISC2) - a', applied: false });
        cards.push({ sectionId: 'certifications-1', sectionType: 'certifications', original: 'Recommended Certification', optimized: 'PMP (PMI) - b', applied: false });

        mockStoreState = {
            originalResume: null,
            parsedResumeText: 'Resume text used by the optimize section for context.',
            optimizations: cards,
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
                beforeScore: 10,
                afterScore: null,
                improvement: 0,
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
            baselineMatchScore: 10,
            jobVariants: [],
            activeVariantId: null,
            variantRestoreNonce: 0,
            saveCurrentAsVariant: vi.fn(() => 'variant-test'),
            updateVariant: vi.fn(),
            openVariant: vi.fn(() => null),
            renameVariant: vi.fn(),
            deleteVariant: vi.fn(),
        };

        renderWithProviders(<OptimizeSection />);

        // Never a fake before -> after comparison at 0 applied.
        expect(screen.queryByText('Projected ~10%')).toBeNull();
        // Never a meaningless "no change" delta chip in this state.
        expect(screen.queryByText('no change')).toBeNull();
        // "+0.0 pts per suggestion" line hidden (its i18n key renders raw in tests).
        expect(screen.queryByText('sections.optimize.scoreDiff.perCardShare')).toBeNull();
        // "Up to 10% if all applied" hidden when the estimate is zero.
        expect(screen.queryByText('sections.optimize.scoreDiff.potentialNote')).toBeNull();
    });
});
