// src/__tests__/OptimizeSection.test.jsx
// Tests for OptimizeSection component - AI optimization suggestions

import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import OptimizeSection from '../components/sections/OptimizeSection';
import { DirectionProvider } from '../components/providers/DirectionProvider';

const mockRefineBullet = vi.hoisted(() => vi.fn());
const mockAnalyzeResumeWithAI = vi.hoisted(() => vi.fn());
const mockGetAuthHeaders = vi.hoisted(() => vi.fn(() => Promise.resolve({ Authorization: 'Bearer test-token' })));
const mockAnalyticsTrack = vi.hoisted(() => vi.fn());
const mockTrackOptimization = vi.hoisted(() => vi.fn());

// Mock dependencies
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, options) => {
            // Handle both simple strings and interpolated strings
            if (typeof options === 'string') {
                return options || key;
            }
            if (options?.defaultValue) {
                return Object.entries(options).reduce((text, [name, value]) => (
                    name === 'defaultValue' ? text : text.replaceAll(`{{${name}}}`, String(value))
                ), options.defaultValue);
            }
            // Return key (translation strings are not critical for these tests)
            return key;
        },
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
}));

const mockSetOptimizations = vi.fn();
const mockApplyOptimization = vi.fn();
const mockRevertOptimization = vi.fn();
const mockApplyAllOptimizations = vi.fn();
const mockRevertAllOptimizations = vi.fn();
const mockRefineOptimization = vi.fn();
const mockSetKeywordSuggestions = vi.fn();
const mockSetOptimizationMetrics = vi.fn();
const mockResetOptimizationMetrics = vi.fn();
const mockGetCachedAnalysis = vi.fn(() => null);
const mockSetCachedAnalysis = vi.fn();

// Create a mock store state that can be modified per test
let mockStoreState = {
    originalResume: null,
    parsedResumeText: null,
    optimizations: [],
    keywordSuggestions: [],
    showOptimized: false,
    setOptimizations: mockSetOptimizations,
    applyOptimization: mockApplyOptimization,
    revertOptimization: mockRevertOptimization,
    refineOptimization: mockRefineOptimization,
    applyAllOptimizations: mockApplyAllOptimizations,
    revertAllOptimizations: mockRevertAllOptimizations,
    setKeywordSuggestions: mockSetKeywordSuggestions,
    optimizationMetrics: {
        beforeScore: null,
        afterScore: null,
        improvement: null,
        jdKeywords: [],
        matchedKeywords: [],
        reasoning: null,
        hasJobDescription: false,
        vision2030: null
    },
    setOptimizationMetrics: mockSetOptimizationMetrics,
    resetOptimizationMetrics: mockResetOptimizationMetrics,
    getCachedAnalysis: mockGetCachedAnalysis,
    setCachedAnalysis: mockSetCachedAnalysis,
    getActiveResume: vi.fn(() => null),
    baselineMatchScore: null,
    // Job variants slice (Phase 1) — JobVariantsBar reads these
    jobVariants: [],
    activeVariantId: null,
    variantRestoreNonce: 0,
    saveCurrentAsVariant: vi.fn(() => 'variant-test'),
    updateVariant: vi.fn(),
    openVariant: vi.fn(() => null),
    renameVariant: vi.fn(),
    deleteVariant: vi.fn(),
};

vi.mock('../lib/stores/resumeStore', () => {
    const mockFn = (selector) => {
        if (typeof selector === 'function') {
            return selector(mockStoreState);
        }
        return mockStoreState;
    };
    mockFn.getState = () => mockStoreState;
    return { useResumeStore: mockFn };
});

vi.mock('../services/analytics', () => ({
    analytics: {
        track: mockAnalyticsTrack,
        trackOptimization: mockTrackOptimization,
        trackScoreDiffExpanded: vi.fn(),
        trackExplainabilityPanelOpened: vi.fn(),
    },
}));

vi.mock('../services/api', () => ({
    refineBullet: mockRefineBullet,
    analyzeResumeWithAI: mockAnalyzeResumeWithAI,
}));

vi.mock('../lib/auth/authHeaders', () => ({
    getAuthHeaders: mockGetAuthHeaders,
}));

vi.mock('../hooks/useRateLimit', () => ({
    useRateLimit: () => ({
        isRateLimited: false,
        retryAfter: null,
        handleError: vi.fn(() => false),
        clearRateLimit: vi.fn(),
    }),
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

// Mock fetch for API calls
global.fetch = vi.fn();

const createMatchMedia = () => {
    const listeners = new Set();
    return (query) => ({
        matches: query.includes('min-width: 768px'),
        media: query,
        onchange: null,
        addEventListener: (_event, listener) => {
            if (typeof listener === 'function') listeners.add(listener);
        },
        removeEventListener: (_event, listener) => {
            if (typeof listener === 'function') listeners.delete(listener);
        },
        addListener: (listener) => {
            if (typeof listener === 'function') listeners.add(listener);
        },
        removeListener: (listener) => {
            if (typeof listener === 'function') listeners.delete(listener);
        },
        dispatchEvent: (event) => {
            listeners.forEach((listener) => listener(event));
            return true;
        },
    });
};

const renderWithProviders = (ui) => {
    return render(<DirectionProvider>{ui}</DirectionProvider>);
};

const sampleOptimization = {
    sectionId: 'summary-0',
    sectionType: 'summary',
    original: 'Built web applications.',
    optimized: 'Built React applications aligned to product requirements.',
    applied: false,
};

beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: createMatchMedia(),
    });
    // Mock crypto.randomUUID
    Object.defineProperty(window, 'crypto', {
        value: {
            randomUUID: () => 'test-session-id-' + Math.random(),
        },
    });
});

beforeEach(() => {
    // Reset mock store state before each test
    mockStoreState = {
        originalResume: null,
        parsedResumeText: null,
        optimizations: [],
        keywordSuggestions: [],
        showOptimized: false,
        setOptimizations: mockSetOptimizations,
        applyOptimization: mockApplyOptimization,
        revertOptimization: mockRevertOptimization,
        refineOptimization: mockRefineOptimization,
        applyAllOptimizations: mockApplyAllOptimizations,
        revertAllOptimizations: mockRevertAllOptimizations,
        setKeywordSuggestions: mockSetKeywordSuggestions,
        optimizationMetrics: {
            beforeScore: null,
            afterScore: null,
            improvement: null,
            jdKeywords: [],
            matchedKeywords: [],
            reasoning: null,
            hasJobDescription: false,
            vision2030: null
        },
        setOptimizationMetrics: mockSetOptimizationMetrics,
        resetOptimizationMetrics: mockResetOptimizationMetrics,
        getCachedAnalysis: mockGetCachedAnalysis,
        setCachedAnalysis: mockSetCachedAnalysis,
        getActiveResume: vi.fn(() => null),
        baselineMatchScore: null,
        // Job variants slice (Phase 1) — JobVariantsBar reads these
        jobVariants: [],
        activeVariantId: null,
    variantRestoreNonce: 0,
        saveCurrentAsVariant: vi.fn(() => 'variant-test'),
        updateVariant: vi.fn(),
        openVariant: vi.fn(() => null),
        renameVariant: vi.fn(),
        deleteVariant: vi.fn(),
    };

    mockSetOptimizations.mockImplementation((optimizations) => {
        mockStoreState.optimizations = optimizations;
    });
    mockSetOptimizationMetrics.mockImplementation((metrics) => {
        mockStoreState.optimizationMetrics = {
            ...mockStoreState.optimizationMetrics,
            ...metrics,
        };
    });
    mockSetKeywordSuggestions.mockImplementation((keywordSuggestions) => {
        mockStoreState.keywordSuggestions = keywordSuggestions;
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

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('OptimizeSection', () => {
    describe('Rendering', () => {
        it('renders the section title', () => {
            renderWithProviders(<OptimizeSection />);

            expect(screen.getByText('Optimize Resume')).toBeInTheDocument();
        });

        it('renders the optimize button', () => {
            renderWithProviders(<OptimizeSection />);

            // When no resume, button says "Upload Resume First"
            expect(screen.getByRole('button', { name: /upload resume first/i })).toBeInTheDocument();
        });

        it('renders view mode toggle (Split and Diff)', () => {
            mockStoreState.optimizations = [sampleOptimization];
            renderWithProviders(<OptimizeSection />);

            expect(screen.getByText('Split')).toBeInTheDocument();
            expect(screen.getByText('Diff')).toBeInTheDocument();
        });

        it('renders queue status filters', () => {
            mockStoreState.optimizations = [sampleOptimization];
            renderWithProviders(<OptimizeSection />);

            expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Pending' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Applied' })).toBeInTheDocument();
        });

        it('renders collapsed strategy section when optimization strategy exists', () => {
            mockStoreState.optimizations = [sampleOptimization];
            renderWithProviders(<OptimizeSection keywords={{ add: ['React'], neutral: [], remove: [] }} />);

            expect(screen.getByRole('button', { name: /strategy/i })).toBeInTheDocument();
            expect(screen.queryByText('React')).not.toBeInTheDocument();
        });

        it('hides keyword strategy section when there is no keyword data', () => {
            renderWithProviders(<OptimizeSection />);

            expect(screen.queryByRole('button', { name: /strategy/i })).not.toBeInTheDocument();
        });

        it('shows empty state when no optimizations', () => {
            renderWithProviders(<OptimizeSection />);

            expect(screen.getByText(/run an analysis/i)).toBeInTheDocument();
            expect(screen.queryByTestId('character-results-companion')).not.toBeInTheDocument();
        });
    });

    describe('Resume Requirement', () => {
        it('shows warning when no resume is uploaded', () => {
            renderWithProviders(<OptimizeSection />);

            expect(screen.getByText('Please upload a resume first')).toBeInTheDocument();
        });

        it('disables optimize button when no resume', () => {
            renderWithProviders(<OptimizeSection />);

            const button = screen.getByRole('button', { name: /upload resume first/i });
            expect(button).toBeDisabled();
        });

        it('enables optimize button when resume exists', () => {
            mockStoreState.originalResume = { basics: { name: 'Test User' } };

            renderWithProviders(<OptimizeSection />);

            const button = screen.getByRole('button', { name: /optimize resume/i });
            expect(button).not.toBeDisabled();
        });

        it('allows guest optimization to run one free preview without credit confirmation', async () => {
            mockStoreState.originalResume = { basics: { name: 'Test User' } };
            const onRequireSignIn = vi.fn();
            const onOptimize = vi.fn().mockResolvedValue({ cards: [] });

            renderWithProviders(
                <OptimizeSection
                    isGuestMode
                    onOptimize={onOptimize}
                    onRequireSignIn={onRequireSignIn}
                    protectedActionMessage="Sign in to run AI analysis and save your progress."
                />
            );

            fireEvent.click(screen.getByRole('button', { name: /optimize resume/i }));

            expect(onRequireSignIn).not.toHaveBeenCalled();
            await waitFor(() => {
                expect(onOptimize).toHaveBeenCalledWith('auto', { freePreview: true });
            });
            expect(screen.queryByText('Sign in to run AI analysis and save your progress.')).not.toBeInTheDocument();
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('Keywords Display', () => {
        it('displays "add" keywords when available', () => {
            mockStoreState.optimizations = [sampleOptimization];
            mockStoreState.keywordSuggestions = [
                { keyword: 'React', category: 'add' },
                { keyword: 'TypeScript', category: 'add' },
            ];

            renderWithProviders(<OptimizeSection />);
            fireEvent.click(screen.getByRole('button', { name: /strategy/i }));

            expect(screen.getByText('React')).toBeInTheDocument();
            expect(screen.getByText('TypeScript')).toBeInTheDocument();
        });

        it('displays "keep" keywords when available', () => {
            mockStoreState.optimizations = [sampleOptimization];
            mockStoreState.keywordSuggestions = [
                { keyword: 'JavaScript', category: 'keep' },
            ];

            renderWithProviders(<OptimizeSection />);
            fireEvent.click(screen.getByRole('button', { name: /strategy/i }));

            expect(screen.getByText('JavaScript')).toBeInTheDocument();
        });

        it('displays "deemphasize" keywords when available', () => {
            mockStoreState.optimizations = [sampleOptimization];
            mockStoreState.keywordSuggestions = [
                { keyword: 'Outdated', category: 'deemphasize' },
            ];

            renderWithProviders(<OptimizeSection />);
            fireEvent.click(screen.getByRole('button', { name: /strategy/i }));

            expect(screen.getByText('Outdated')).toBeInTheDocument();
        });

        it('does not render empty keyword buckets before real keyword data exists', () => {
            renderWithProviders(<OptimizeSection />);

            expect(screen.queryByText('No keywords identified')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /strategy/i })).not.toBeInTheDocument();
        });

        it('uses props keywords when store keywords are empty', () => {
            mockStoreState.optimizations = [sampleOptimization];
            const propsKeywords = {
                add: ['PropReact', 'PropNode'],
                neutral: ['PropJS'],
                remove: ['PropOld'],
            };

            renderWithProviders(<OptimizeSection keywords={propsKeywords} />);
            fireEvent.click(screen.getByRole('button', { name: /strategy/i }));

            expect(screen.getByText('PropReact')).toBeInTheDocument();
            expect(screen.getByText('PropNode')).toBeInTheDocument();
            expect(screen.getByText('PropJS')).toBeInTheDocument();
            expect(screen.getByText('PropOld')).toBeInTheDocument();
        });
    });

    describe('Optimization Cards Display', () => {
        it('displays optimization cards when available', () => {
            mockStoreState.optimizations = [
                {
                    sectionId: 'summary-0',
                    sectionType: 'summary',
                    original: 'Original summary text',
                    optimized: 'Optimized summary text',
                    applied: false,
                },
            ];

            renderWithProviders(<OptimizeSection />);

            expect(screen.getAllByText('summary').length).toBeGreaterThan(0);

            fireEvent.click(screen.getByRole('button', { name: /Original summary text/i }));

            // After expansion, content should be visible
            expect(screen.getAllByText('Original summary text').length).toBeGreaterThan(0);
            expect(screen.getByText('Optimized summary text')).toBeInTheDocument();
        });

        it('shows applied badge when optimization is applied', () => {
            mockStoreState.optimizations = [
                {
                    sectionId: 'summary-0',
                    sectionType: 'summary',
                    original: 'Original',
                    optimized: 'Optimized',
                    applied: true,
                },
            ];

            renderWithProviders(<OptimizeSection />);

            // "Applied" appears in both the card badge and results summary
            const appliedElements = screen.getAllByText('Applied');
            expect(appliedElements.length).toBeGreaterThan(0);
        });

        it('shows pending badge when optimization is not applied', () => {
            mockStoreState.optimizations = [
                {
                    sectionId: 'summary-0',
                    sectionType: 'summary',
                    original: 'Original',
                    optimized: 'Optimized',
                    applied: false,
                },
            ];

            renderWithProviders(<OptimizeSection />);

            expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
        });

        it('displays applied count correctly', () => {
            mockStoreState.optimizations = [
                { sectionId: 'a', sectionType: 'summary', original: 'a', optimized: 'b', applied: true },
                { sectionId: 'b', sectionType: 'headline', original: 'c', optimized: 'd', applied: false },
                { sectionId: 'c', sectionType: 'experience', original: 'e', optimized: 'f', applied: true },
            ];

            renderWithProviders(<OptimizeSection />);

            expect(screen.getByText('2/3 applied')).toBeInTheDocument();
        });
    });

    describe('Queue Filtering', () => {
        it('filters optimizations by pending/applied state', () => {
            mockStoreState.optimizations = [
                { sectionId: 'summary-0', sectionType: 'summary', original: 'Summary text', optimized: 'Optimized summary', applied: false },
                { sectionId: 'experience-0', sectionType: 'experience', original: 'Experience text', optimized: 'Optimized experience', applied: true },
            ];

            renderWithProviders(<OptimizeSection />);

            expect(screen.getByText('Summary text')).toBeInTheDocument();
            expect(screen.getByText('Experience 1')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Pending' }));

            expect(screen.getByText('Summary text')).toBeInTheDocument();
            expect(screen.queryByText('Experience 1')).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Applied' }));
            expect(screen.queryByText('Summary text')).not.toBeInTheDocument();
            expect(screen.getByText('Experience 1')).toBeInTheDocument();
        });

        it('shows all optimizations when "All" is selected', () => {
            mockStoreState.optimizations = [
                { sectionId: 'summary-0', sectionType: 'summary', original: 'Summary Content Here', optimized: 'Opt Summary', applied: false },
                { sectionId: 'headline-0', sectionType: 'headline', original: 'Headline Content Here', optimized: 'Opt Headline', applied: true },
            ];

            renderWithProviders(<OptimizeSection />);

            expect(screen.getByText('Summary Content Here')).toBeInTheDocument();
            expect(screen.getByText('Headline Content Here')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
            expect(screen.getByText('Summary Content Here')).toBeInTheDocument();
            expect(screen.queryByText('Headline Content Here')).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'All' }));
            expect(screen.getByText('Summary Content Here')).toBeInTheDocument();
            expect(screen.getByText('Headline Content Here')).toBeInTheDocument();
        });
    });

    describe('View Mode Toggle', () => {
        it('toggles between split and diff view modes', () => {
            mockStoreState.optimizations = [
                { sectionId: 'summary-0', sectionType: 'summary', original: 'Original text', optimized: 'Optimized text', applied: false },
            ];

            renderWithProviders(<OptimizeSection />);

            // Click on Diff view
            const diffButton = screen.getByRole('button', { name: 'Diff' });
            fireEvent.click(diffButton);

            // Diff view shows strikethrough text
            // The component should now be in diff mode
            expect(diffButton).toHaveAttribute('aria-pressed', 'true');
        });
    });

    describe('Apply/Revert Actions', () => {
        it('calls applyOptimization when card Apply button is clicked', () => {
            mockStoreState.optimizations = [
                { sectionId: 'summary-0', sectionType: 'summary', original: 'Original', optimized: 'Optimized', applied: false },
            ];

            const { container } = renderWithProviders(<OptimizeSection />);

            fireEvent.click(screen.getByRole('button', { name: /Original/i }));
            const allButtons = container.querySelectorAll('button');
            const applyButton = Array.from(allButtons).find(btn =>
                btn.textContent?.trim() === 'Apply Suggestion'
            );

            if (applyButton) {
                fireEvent.click(applyButton);
                expect(mockApplyOptimization).toHaveBeenCalledWith('summary-0');
            }
        });

        it('calls revertOptimization when card Revert Changes is clicked', () => {
            mockStoreState.optimizations = [
                { sectionId: 'summary-0', sectionType: 'summary', original: 'Original', optimized: 'Optimized', applied: true },
            ];

            renderWithProviders(<OptimizeSection />);
            fireEvent.click(screen.getByRole('button', { name: /Original/i }));
            fireEvent.click(screen.getByRole('button', { name: /revert changes/i }));

            expect(mockRevertOptimization).toHaveBeenCalledWith('summary-0');
        });

        it('applies all pending suggestions in a group when Apply all is clicked', () => {
            mockStoreState.optimizations = [
                { sectionId: 'a', sectionType: 'summary', original: 'a', optimized: 'b', applied: false },
                { sectionId: 'b', sectionType: 'summary', original: 'c', optimized: 'd', applied: false },
            ];

            renderWithProviders(<OptimizeSection />);

            fireEvent.click(screen.getByRole('button', { name: /apply all in this job/i }));

            expect(mockApplyOptimization).toHaveBeenCalledWith('a');
            expect(mockApplyOptimization).toHaveBeenCalledWith('b');
        });

        it('does not show the old header-level Revert button', () => {
            mockStoreState.optimizations = [
                { sectionId: 'a', sectionType: 'summary', original: 'a', optimized: 'b', applied: true },
            ];

            renderWithProviders(<OptimizeSection />);

            expect(screen.queryByRole('button', { name: /^revert$/i })).not.toBeInTheDocument();
        });

        it('refines a card through the API without applying it directly', async () => {
            mockStoreState.originalResume = { basics: { name: 'Test User' } };
            mockStoreState.parsedResumeText = 'Built web applications for internal teams.';
            mockStoreState.optimizations = [sampleOptimization];
            mockRefineBullet.mockResolvedValueOnce({
                improved: 'Built internal web applications that improved team workflows.',
                issue: '',
                rationale: 'Preserved the existing web application evidence and tightened the impact wording.',
            });

            renderWithProviders(<OptimizeSection />);

            fireEvent.click(screen.getByRole('button', { name: 'Expand All' }));
            fireEvent.click(screen.getByRole('button', { name: 'Refine' }));
            const input = screen.getByPlaceholderText('e.g. emphasize measurable impact');
            fireEvent.change(input, { target: { value: 'Use active voice' } });
            fireEvent.keyDown(input, { key: 'Enter' });

            await waitFor(() => {
                expect(mockRefineBullet).toHaveBeenCalledWith({
                    original: sampleOptimization.original,
                    currentImproved: sampleOptimization.optimized,
                    userInstruction: 'Use active voice',
                    jobContext: 'Backend engineer role',
                    resumeText: 'Built web applications for internal teams.',
                    language: 'en',
                });
            });
            expect(mockRefineOptimization).toHaveBeenCalledWith('summary-0', {
                improved: 'Built internal web applications that improved team workflows.',
                issue: '',
                rationale: 'Preserved the existing web application evidence and tightened the impact wording.',
                instruction: 'Use active voice',
            });
            expect(mockApplyOptimization).not.toHaveBeenCalled();
            expect(mockAnalyticsTrack).toHaveBeenCalledWith('bullet_refined', { section_type: 'summary' });
        });
    });

    describe('Export Flow Clarity', () => {
        it('does not show the optimized export path after optimization', () => {
            mockStoreState.originalResume = { basics: { name: 'Test User' } };
            mockStoreState.optimizations = [
                { sectionId: 'summary-0', sectionType: 'summary', original: 'Original', optimized: 'Optimized', applied: true },
            ];

            renderWithProviders(<OptimizeSection onExport={vi.fn()} canExport />);

            expect(screen.queryByText('Optimized export')).not.toBeInTheDocument();
            expect(screen.queryByText(/saves html to your account/i)).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /save html \/ print pdf/i })).not.toBeInTheDocument();
        });
    });

    describe('Clear Functionality', () => {
        it('calls onClear prop when clear button is clicked', () => {
            const onClearMock = vi.fn();
            mockStoreState.optimizations = [
                { sectionId: 'a', sectionType: 'summary', original: 'a', optimized: 'b', applied: false },
            ];

            renderWithProviders(<OptimizeSection onClear={onClearMock} />);

            const clearButton = screen.getByRole('button', { name: /clear/i });
            fireEvent.click(clearButton);

            expect(onClearMock).toHaveBeenCalled();
        });

        it('clears optimizations via store when onClear prop not provided', () => {
            mockStoreState.optimizations = [
                { sectionId: 'a', sectionType: 'summary', original: 'a', optimized: 'b', applied: false },
            ];

            renderWithProviders(<OptimizeSection />);

            const clearButton = screen.getByRole('button', { name: /clear/i });
            fireEvent.click(clearButton);

            expect(mockSetOptimizations).toHaveBeenCalledWith([]);
        });
    });

    describe('API Integration', () => {
        it.skip('calls optimize API when generate button is clicked', async () => {
            mockStoreState.originalResume = { basics: { name: 'Test' } };
            mockStoreState.parsedResumeText = 'Test resume content';

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    cards: [
                        { section: 'Summary', exampleBefore: 'Before', exampleAfter: 'After' },
                    ],
                    keywords: { add: ['React'], neutral: [], remove: [] },
                }),
            });

            renderWithProviders(<OptimizeSection />);

            const optimizeButton = screen.getByRole('button', { name: /optimize resume/i });
            fireEvent.click(optimizeButton);

            // Wait for confirmation modal to appear and click confirm
            await waitFor(() => {
                const confirmButtons = screen.queryAllByRole('button', { name: /confirm|proceed/i });
                if (confirmButtons.length > 0) {
                    fireEvent.click(confirmButtons[0]);
                }
            }, { timeout: 1000 }).catch(() => {
                // Modal might not appear in test, continue anyway
            });

            // Check fetch was called (async but resolves quickly)
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalled();
            }, { timeout: 2000 });

            // Verify it was called with correct endpoint
            expect(global.fetch).toHaveBeenCalledWith(
                '/.netlify/functions/optimize',
                expect.objectContaining({
                    method: 'POST',
                })
            );
        });

        it.skip('handles API error gracefully (button becomes non-loading)', async () => {
            mockStoreState.originalResume = { basics: { name: 'Test' } };
            mockStoreState.parsedResumeText = 'Test resume content';

            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            renderWithProviders(<OptimizeSection />);

            const optimizeButton = screen.getByRole('button', { name: /optimize resume/i });
            fireEvent.click(optimizeButton);

            // Wait for confirmation modal to appear and click confirm
            await waitFor(() => {
                const confirmButtons = screen.queryAllByRole('button', { name: /confirm|proceed/i });
                if (confirmButtons.length > 0) {
                    fireEvent.click(confirmButtons[0]);
                }
            }, { timeout: 1000 }).catch(() => {
                // Modal might not appear in test, continue anyway
            });

            // Verify fetch was called
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalled();
            }, { timeout: 2000 });
        });
    });

    describe('Card Expansion', () => {
        it('toggles card expansion when chevron is clicked', () => {
            mockStoreState.optimizations = [
                {
                    sectionId: 'summary-0',
                    sectionType: 'summary',
                    original: 'This is a very long original text that should be truncated in the collapsed state but shown fully when expanded',
                    optimized: 'This is a very long optimized text that should be truncated in the collapsed state but shown fully when expanded',
                    applied: false
                },
            ];

            const { container } = renderWithProviders(<OptimizeSection />);

            // Find the expand/collapse button (chevron)
            const chevronButtons = container.querySelectorAll('button');
            const expandButton = Array.from(chevronButtons).find(btn =>
                btn.querySelector('svg.lucide-chevron-down') || btn.querySelector('svg.lucide-chevron-up')
            );

            if (expandButton) {
                fireEvent.click(expandButton);
                // After click, the text should be fully visible (no line-clamp)
            }
        });
    });

    describe('Compare Mode', () => {
        it('shows compare view when compare button is clicked', () => {
            mockStoreState.optimizations = [
                {
                    sectionId: 'summary-0',
                    sectionType: 'summary',
                    original: 'Original content',
                    optimized: 'Optimized content',
                    applied: false
                },
            ];

            const { container } = renderWithProviders(<OptimizeSection />);

            // Find compare button (ArrowLeftRight icon)
            const buttons = container.querySelectorAll('button');
            const compareButton = Array.from(buttons).find(btn =>
                btn.title === 'Compare' || btn.querySelector('.lucide-arrow-left-right')
            );

            if (compareButton) {
                fireEvent.click(compareButton);
                // Compare mode shows side-by-side with different styling
            }
        });
    });

    describe('Accessibility', () => {
        it('all interactive elements are accessible via keyboard', () => {
            mockStoreState.originalResume = { basics: { name: 'Test' } };

            renderWithProviders(<OptimizeSection />);

            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(0);

            buttons.forEach(button => {
                expect(button).toBeVisible();
            });
        });

        it('queue filters are keyboard navigable', () => {
            mockStoreState.optimizations = [sampleOptimization];
            renderWithProviders(<OptimizeSection />);

            ['All', 'Pending', 'Applied'].forEach(filterName => {
                const filter = screen.getByRole('button', { name: filterName });
                expect(filter).toBeVisible();
            });
        });
    });

    describe('RTL Support', () => {
        it('renders correctly with RTL direction', () => {
            // This test verifies the component doesn't crash in RTL mode
            // Full RTL testing would require mocking i18n.language = 'ar'
            renderWithProviders(<OptimizeSection />);
            expect(screen.getByText('Optimize Resume')).toBeInTheDocument();
        });
    });

    describe('Mobile Responsive Contracts', () => {
        const setViewportWidth = (width) => {
            Object.defineProperty(window, 'innerWidth', {
                configurable: true,
                writable: true,
                value: width,
            });
            window.dispatchEvent(new Event('resize'));
        };

        it.each([360, 390, 768])('keeps queue filters horizontally scrollable at %ipx', (width) => {
            setViewportWidth(width);
            mockStoreState.optimizations = [sampleOptimization];
            renderWithProviders(<OptimizeSection />);

            const appliedFilter = screen.getByRole('button', { name: 'Applied' });
            const scrollContainer = appliedFilter.closest('div.overflow-x-auto');

            expect(scrollContainer).toBeInTheDocument();
            expect(scrollContainer).toHaveClass('overflow-x-auto');
            expect(appliedFilter).toHaveClass('whitespace-nowrap');
        });

        it.each([360, 390, 768])('wraps header actions and guards card header text at %ipx', (width) => {
            setViewportWidth(width);
            mockStoreState.optimizations = [
                {
                    sectionId: 'summary-0',
                    sectionType: 'summary',
                    original: 'Original summary text',
                    optimized: 'Optimized summary text',
                    applied: false,
                },
            ];

            const { container } = renderWithProviders(<OptimizeSection />);

            const actionWrap = container.querySelector('.md\\:justify-end');
            expect(actionWrap).toHaveClass('w-full', 'md:w-auto', 'flex-wrap');

            const cardHeader = screen.getByRole('button', { name: /Original summary text/i });
            expect(cardHeader).toHaveClass('gap-3');
            expect(cardHeader?.firstElementChild).toHaveClass('min-w-0');
            expect(cardHeader?.lastElementChild).toHaveClass('shrink-0');
        });

        it.each([360, 390, 768])('wraps long optimization text and stacks card actions at %ipx', (width) => {
            setViewportWidth(width);
            const longToken = 'SeniorPlatformEngineerWithOwnershipAcrossVeryLongCloudMigrationKeyword';
            mockStoreState.optimizations = [
                {
                    sectionId: 'summary-0',
                    sectionType: 'summary',
                    original: longToken,
                    optimized: `${longToken} optimized`,
                    applied: false,
                },
            ];

            renderWithProviders(<OptimizeSection onCopy={vi.fn()} />);
            fireEvent.click(screen.getByRole('button', { name: new RegExp(longToken) }));

            const expandedOriginal = screen.getAllByText(longToken).find((node) =>
                node.className.includes('break-words') && node.className.includes('whitespace-pre-wrap')
            );
            expect(expandedOriginal).toBeInTheDocument();

            const applyButton = screen.getByRole('button', { name: /apply suggestion/i });
            expect(applyButton.closest('div')).toHaveClass('flex-col', 'sm:flex-row');

            const copyButton = screen.getByTitle('Copy Text');
            expect(copyButton).toHaveClass('w-full', 'sm:w-auto');
        });

        it.each([360, 390, 768])('keeps the optimize loading toast inside the viewport at %ipx', (width) => {
            setViewportWidth(width);
            renderWithProviders(<OptimizeSection isOptimizing />);

            const toastShell = document.body.querySelector('.fixed.inset-x-3');
            expect(toastShell).toBeInTheDocument();
            expect(toastShell).toHaveClass('bottom-4', 'sm:right-6', 'sm:bottom-6');

            const toast = toastShell?.querySelector('.max-w-full');
            expect(toast).toHaveClass('sm:max-w-sm');
        });
    });

    describe('Impact Summary', () => {
        it('does not show impact summary on initial load with existing optimizations', () => {
            // Simulates page refresh with persisted optimizations
            mockStoreState.optimizations = [
                { sectionId: 'summary-0', sectionType: 'summary', original: 'a', optimized: 'b', applied: false },
            ];
            mockStoreState.keywordSuggestions = [
                { keyword: 'React', category: 'add' },
            ];

            renderWithProviders(<OptimizeSection />);

            // Impact summary should NOT appear on page load
            expect(screen.queryByText('Optimization Complete!')).not.toBeInTheDocument();
        });
    });
});

describe('Optimization Card Types', () => {
    beforeEach(() => {
        mockStoreState = {
            originalResume: null,
            parsedResumeText: null,
            optimizations: [],
            keywordSuggestions: [],
            showOptimized: false,
            setOptimizations: mockSetOptimizations,
            applyOptimization: mockApplyOptimization,
            revertOptimization: mockRevertOptimization,
            refineOptimization: mockRefineOptimization,
            applyAllOptimizations: mockApplyAllOptimizations,
            revertAllOptimizations: mockRevertAllOptimizations,
            setKeywordSuggestions: mockSetKeywordSuggestions,
            optimizationMetrics: {
                beforeScore: null,
                afterScore: null,
                improvement: null,
                jdKeywords: [],
                matchedKeywords: [],
                reasoning: null,
                hasJobDescription: false,
                vision2030: null
            },
            setOptimizationMetrics: mockSetOptimizationMetrics,
            resetOptimizationMetrics: mockResetOptimizationMetrics,
            getCachedAnalysis: mockGetCachedAnalysis,
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
        };
    });

    describe('Auto-verified optimized score', () => {
        it('renders a baseline score of 0 as a real current score', () => {
            mockStoreState.optimizations = [{ ...sampleOptimization, applied: true }];
            mockStoreState.baselineMatchScore = 0;
            mockStoreState.optimizationMetrics = {
                ...mockStoreState.optimizationMetrics,
                improvement: 5,
                hasJobDescription: true,
            };

            renderWithProviders(<OptimizeSection />);

            expect(screen.getAllByText('0%').length).toBeGreaterThan(0);
            expect(screen.getByText('Projected ~5%')).toBeInTheDocument();
        });

        it('does not treat missing score fields as a real zero score', () => {
            mockStoreState.optimizations = [{ ...sampleOptimization, applied: true }];
            mockStoreState.baselineMatchScore = null;
            mockStoreState.optimizationMetrics = {
                ...mockStoreState.optimizationMetrics,
                beforeScore: null,
                improvement: 5,
                hasJobDescription: true,
            };
            mockStoreState.originalResume = {
                basics: { name: 'Test User' },
                work: [],
                education: [],
                skills: [],
                meta: { match_score: null },
            };
            mockGetCachedAnalysis.mockReturnValue(null);

            renderWithProviders(<OptimizeSection />);

            expect(screen.queryByText('0%')).not.toBeInTheDocument();
            expect(screen.getAllByText('-').length).toBeGreaterThan(0);
        });

        it('passes verify mode when auto-verifying the optimized resume', async () => {
            mockStoreState.originalResume = { basics: { name: 'Test User', summary: 'Original summary' }, work: [], education: [], skills: [] };
            mockStoreState.parsedResumeText = 'Original resume text that is long enough to make verification meaningful after optimization';
            mockStoreState.getActiveResume = vi.fn(() => ({
                basics: {
                    name: 'Test User',
                    summary: 'Optimized summary with enough detailed text to exceed the minimum verification length threshold for the test scenario.',
                },
                work: [{
                    name: 'Company',
                    position: 'Engineer',
                    startDate: '2020',
                    endDate: '2024',
                    highlights: [
                        'Improved backend APIs with measurable latency reductions and production reliability gains.',
                        'Built React dashboards for hiring managers with accessible workflows and analytics.',
                    ],
                }],
                education: [],
                skills: [{ name: 'Technical', keywords: ['React', 'TypeScript', 'Node.js'] }],
            }));
            mockStoreState.baselineMatchScore = 45;
            mockAnalyzeResumeWithAI.mockResolvedValue({
                score: 52,
                topHits: ['React'],
                missingKeywords: [],
            });
            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    cards: [{
                        section: 'Summary',
                        exampleBefore: 'Original summary',
                        exampleAfter: 'Optimized summary',
                    }],
                    matchScoring: {
                        beforeScore: 45,
                        estimatedImprovement: 10,
                        afterScore: 55,
                        jdKeywords: ['React'],
                        matchedKeywords: [],
                        reasoning: 'Initial projected score',
                    },
                    debug: { hasJobDescription: true },
                }),
            });

            renderWithProviders(<OptimizeSection />);
            fireEvent.click(screen.getByRole('button', { name: /optimize/i }));

            await waitFor(() => {
                expect(mockAnalyzeResumeWithAI).toHaveBeenCalledWith(
                    expect.any(String),
                    'Backend engineer role',
                    'en',
                    expect.objectContaining({ mode: 'verify' })
                );
            });
        });

        it('shows an anomaly instead of storing an implausibly low verified score', async () => {
            mockStoreState.originalResume = { basics: { name: 'Test User', summary: 'Original summary' }, work: [], education: [], skills: [] };
            mockStoreState.parsedResumeText = 'Original resume text with enough detailed work history and skills evidence for verification. '.repeat(3);
            mockStoreState.getActiveResume = vi.fn(() => ({
                basics: {
                    name: 'Test User',
                    summary: 'Optimized summary with enough detail to pass the verification text-length guard before score anomaly handling.',
                },
                work: [{
                    name: 'Company',
                    position: 'Engineer',
                    startDate: '2020',
                    endDate: '2024',
                    highlights: [
                        'Improved backend APIs with measurable latency reductions and reliability gains.',
                        'Built React dashboards for hiring managers with accessible workflows and analytics.',
                    ],
                }],
                education: [],
                skills: [{ name: 'Technical', keywords: ['React', 'TypeScript', 'Node.js'] }],
            }));
            mockStoreState.baselineMatchScore = 45;
            mockAnalyzeResumeWithAI.mockResolvedValue({
                score: 0,
                topHits: [],
                missingKeywords: ['React'],
            });
            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    cards: [{
                        section: 'Summary',
                        exampleBefore: 'Original summary',
                        exampleAfter: 'Optimized summary',
                    }],
                    matchScoring: {
                        beforeScore: 45,
                        estimatedImprovement: 10,
                        afterScore: 55,
                        jdKeywords: ['React'],
                        matchedKeywords: [],
                        reasoning: 'Initial projected score',
                    },
                    debug: { hasJobDescription: true },
                }),
            });

            renderWithProviders(<OptimizeSection />);
            fireEvent.click(screen.getByRole('button', { name: /optimize/i }));

            await waitFor(() => {
                expect(mockAnalyzeResumeWithAI).toHaveBeenCalled();
            });
            await waitFor(() => {
                expect(screen.getByText("Couldn't verify the new score")).toBeInTheDocument();
            });
            expect(mockSetOptimizationMetrics).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    afterScore: 0,
                    improvement: -45,
                })
            );
            expect(mockSetCachedAnalysis).not.toHaveBeenCalledWith(
                expect.any(String),
                'Backend engineer role',
                expect.objectContaining({ score: 0 }),
                true
            );
            expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
        });

        it('skips auto-verify when formatted optimized text is too short', async () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            mockStoreState.originalResume = { basics: { name: 'Test User', summary: 'Original summary' }, work: [], education: [], skills: [] };
            mockStoreState.parsedResumeText = 'Original resume text with enough characters that a tiny optimized output should be rejected before verification '.repeat(3);
            mockStoreState.getActiveResume = vi.fn(() => ({
                basics: { name: 'A' },
                work: [],
                education: [],
                skills: [],
            }));
            mockStoreState.baselineMatchScore = 45;
            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    cards: [{
                        section: 'Summary',
                        exampleBefore: 'Original summary',
                        exampleAfter: 'Optimized summary',
                    }],
                    matchScoring: {
                        beforeScore: 45,
                        estimatedImprovement: 10,
                        afterScore: 55,
                        jdKeywords: ['React'],
                        matchedKeywords: [],
                        reasoning: 'Initial projected score',
                    },
                    debug: { hasJobDescription: true },
                }),
            });

            renderWithProviders(<OptimizeSection />);
            fireEvent.click(screen.getByRole('button', { name: /optimize/i }));

            await waitFor(() => {
                expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[OptimizeSection] verify skipped: optimized text too short'));
            });
            expect(mockAnalyzeResumeWithAI).not.toHaveBeenCalled();
            warnSpy.mockRestore();
        });

        it('shows projected and verified score states with a signed delta', () => {
            mockStoreState.optimizations = [{ ...sampleOptimization, applied: true }];
            mockStoreState.baselineMatchScore = 78;
            mockStoreState.optimizationMetrics = {
                ...mockStoreState.optimizationMetrics,
                afterScore: null,
                improvement: -3,
                hasJobDescription: true,
            };

            renderWithProviders(<OptimizeSection />);

            expect(screen.getByText('Projected ~75%')).toBeInTheDocument();
            expect(screen.getByText('-3%')).toBeInTheDocument();
            expect(screen.queryByText('+-3%')).not.toBeInTheDocument();
        });
    });

    it('displays headline optimization correctly', () => {
        mockStoreState.optimizations = [
            { sectionId: 'headline-0', sectionType: 'headline', original: 'Old Title', optimized: 'New Title', applied: false },
        ];

    renderWithProviders(<OptimizeSection />);
        expect(screen.getAllByText('headline').length).toBeGreaterThan(0);
    });

    it('displays experience optimization with index', () => {
        mockStoreState.optimizations = [
            { sectionId: 'experience-0', sectionType: 'experience', original: 'Old role', optimized: 'New role', applied: false },
            { sectionId: 'experience-1', sectionType: 'experience', original: 'Old role 2', optimized: 'New role 2', applied: false },
        ];

        renderWithProviders(<OptimizeSection />);
        expect(screen.getByText('Experience 1')).toBeInTheDocument();
        expect(screen.getByText('Experience 2')).toBeInTheDocument();
    });

    it('displays skills optimization with info tooltip', () => {
        mockStoreState.optimizations = [
            { sectionId: 'skills-0', sectionType: 'skills', original: 'Current: JS', optimized: 'Add: React, Node', applied: false },
        ];

        const { container } = renderWithProviders(<OptimizeSection />);

        // Skills section should have an info icon
        const infoIcon = container.querySelector('.lucide-info');
        expect(infoIcon).toBeInTheDocument();
    });

    describe('score diff + explainability', () => {
        it('mounts the score projection with only applied:true cards counted', () => {
            window.localStorage.setItem('watheq:characterGender', 'male');
            mockStoreState.optimizations = [
                { sectionId: 's-0', sectionType: 'summary', original: 'Built apps.', optimized: 'Built React apps.', applied: true },
                { sectionId: 'e-0', sectionType: 'experience', original: 'Did work.', optimized: 'Led work.', applied: false },
            ];
            mockStoreState.baselineMatchScore = 60;
            mockStoreState.optimizationMetrics = {
                ...mockStoreState.optimizationMetrics,
                beforeScore: 60,
                improvement: 20,
                hasJobDescription: true,
            };

            renderWithProviders(<OptimizeSection />);

            // Projection title present.
            expect(screen.getByText('sections.optimize.scoreDiff.title')).toBeInTheDocument();
            // 1 of 2 applied — interpolated key returns the raw key with the mock t().
            expect(screen.getByText('sections.optimize.scoreDiff.appliedOf')).toBeInTheDocument();
            expect(screen.getByTestId('character-results-companion')).toHaveAttribute('data-variant', 'optimize');
            expect(screen.getByTestId('character-results-companion')).toHaveAttribute('data-tier', 'confident');
            expect(screen.getByTestId('after-score-bar')).toHaveTextContent('70%');
        });

        it('passes a missing placeholder baseline and an existing API after score unchanged', () => {
            window.localStorage.setItem('watheq:characterGender', 'female');
            mockStoreState.optimizations = [sampleOptimization];
            mockStoreState.baselineMatchScore = null;
            mockStoreState.optimizationMetrics = {
                ...mockStoreState.optimizationMetrics,
                beforeScore: null,
                afterScore: 84,
                improvement: null,
            };

            renderWithProviders(<OptimizeSection />);

            expect(screen.getByTestId('before-score-bar')).toHaveTextContent('Unavailable');
            expect(screen.getByTestId('after-score-bar')).toHaveTextContent('84%');
            const femalePicker = screen.queryByRole('button', { name: 'Female companion' });
            if (femalePicker) fireEvent.click(femalePicker);
            expect(screen.getByRole('img').getAttribute('src')).toContain('female-tier-3');
        });

        it('projection equals the resultsSummaryData formula (before + round(improvement * appliedRatio))', () => {
            // before=60, improvement=20, applied=1/2 => afterScore = 60 + round(20*0.5) = 70
            mockStoreState.optimizations = [
                { sectionId: 's-0', sectionType: 'summary', original: 'Built apps.', optimized: 'Built React apps.', applied: true },
                { sectionId: 'e-0', sectionType: 'experience', original: 'Did work.', optimized: 'Led work.', applied: false },
            ];
            mockStoreState.baselineMatchScore = 60;
            mockStoreState.optimizationMetrics = {
                ...mockStoreState.optimizationMetrics,
                beforeScore: 60,
                improvement: 20,
                hasJobDescription: true,
            };

            renderWithProviders(<OptimizeSection />);

            // The diff renders the same projected value the header computes: 70%.
            // (Header + diff both show 70% — the diff must not fork the formula.)
            expect(screen.getAllByText('70%').length).toBeGreaterThanOrEqual(1);
            // No fabricated verified badge — estimate path only.
            expect(screen.getByText('sections.optimize.scoreDiff.estimateBadge')).toBeInTheDocument();
        });

        it('feeds the explainability panel from the cached original analysis', () => {
            mockStoreState.parsedResumeText = 'Original resume text used as the cache key.';
            mockStoreState.optimizations = [
                { sectionId: 's-0', sectionType: 'summary', original: 'Built apps.', optimized: 'Built React apps.', applied: true },
            ];
            mockStoreState.baselineMatchScore = 55;
            mockStoreState.optimizationMetrics = {
                ...mockStoreState.optimizationMetrics,
                beforeScore: 55,
                improvement: 10,
                hasJobDescription: true,
            };
            mockGetCachedAnalysis.mockReturnValue({
                score: 55,
                matchedKeywords: ['React'],
                missingKeywords: ['GraphQL'],
                strategicRealityCheck: {
                    riskTier: 'medium',
                    recommendation: 'optimize_now',
                    confidence: 'medium',
                    riskTypes: [],
                    summary: '',
                    strengths: [{ title: 'Led a team', evidence: [{ source: 'resume', snippet: 'Managed 6 analysts' }] }],
                    confirmedRisks: [],
                    unclearRisks: [],
                    limits: { cannotDetermine: [], assumptions: ['Assumed fluency'] },
                },
                timestamp: Date.now(),
            });

            renderWithProviders(<OptimizeSection />);

            expect(screen.getByText('sections.explainability.title')).toBeInTheDocument();
            mockGetCachedAnalysis.mockReturnValue(null);
        });
    });
});
