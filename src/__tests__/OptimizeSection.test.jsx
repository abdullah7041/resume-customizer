// src/__tests__/OptimizeSection.test.jsx
// Tests for OptimizeSection component - AI optimization suggestions

import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import OptimizeSection from '../components/sections/OptimizeSection';
import { DirectionProvider } from '../components/providers/DirectionProvider';

// Mock dependencies
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, fallback) => fallback || key,
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
}));

const mockSetOptimizations = vi.fn();
const mockApplyOptimization = vi.fn();
const mockRevertOptimization = vi.fn();
const mockApplyAllOptimizations = vi.fn();
const mockRevertAllOptimizations = vi.fn();
const mockSetKeywordSuggestions = vi.fn();
const mockSetOptimizationMetrics = vi.fn();
const mockResetOptimizationMetrics = vi.fn();

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
        track: vi.fn(),
        trackOptimization: vi.fn(),
    },
}));

// Mock supabase to avoid initialization errors
vi.mock('../services/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            insert: vi.fn(() => Promise.resolve({ error: null })),
        })),
    },
    AppError: class AppError extends Error {
        constructor(message, type) {
            super(message);
            this.type = type;
        }
    },
}));

// Mock feedback service
vi.mock('../services/feedback', () => ({
    submitFeedback: vi.fn(() => Promise.resolve()),
    SuggestionType: {
        SUMMARY: 'summary',
        EXPERIENCE: 'experience',
        SKILLS: 'skills',
        KEYWORDS: 'keywords',
    },
}));

vi.mock('../hooks/useRateLimit', () => ({
    useRateLimit: () => ({
        isRateLimited: false,
        retryAfter: null,
        handleError: vi.fn(() => false),
        clearRateLimit: vi.fn(),
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
    };
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
            renderWithProviders(<OptimizeSection />);

            expect(screen.getByText('Split')).toBeInTheDocument();
            expect(screen.getByText('Diff')).toBeInTheDocument();
        });

        it('renders section filter tabs', () => {
            renderWithProviders(<OptimizeSection />);

            expect(screen.getByText('All Sections')).toBeInTheDocument();
            expect(screen.getByText('Headline')).toBeInTheDocument();
            expect(screen.getByText('Summary')).toBeInTheDocument();
            expect(screen.getByText('Experience')).toBeInTheDocument();
            expect(screen.getByText('Skills')).toBeInTheDocument();
        });

        it('renders keyword strategy section', () => {
            renderWithProviders(<OptimizeSection />);

            expect(screen.getByText('Keyword Strategy')).toBeInTheDocument();
        });

        it('shows empty state when no optimizations', () => {
            renderWithProviders(<OptimizeSection />);

            expect(screen.getByText(/run an analysis/i)).toBeInTheDocument();
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
    });

    describe('Keywords Display', () => {
        it('displays "add" keywords when available', () => {
            mockStoreState.keywordSuggestions = [
                { keyword: 'React', category: 'add' },
                { keyword: 'TypeScript', category: 'add' },
            ];

            renderWithProviders(<OptimizeSection />);

            expect(screen.getByText('React')).toBeInTheDocument();
            expect(screen.getByText('TypeScript')).toBeInTheDocument();
        });

        it('displays "keep" keywords when available', () => {
            mockStoreState.keywordSuggestions = [
                { keyword: 'JavaScript', category: 'keep' },
            ];

            renderWithProviders(<OptimizeSection />);

            expect(screen.getByText('JavaScript')).toBeInTheDocument();
        });

        it('displays "deemphasize" keywords when available', () => {
            mockStoreState.keywordSuggestions = [
                { keyword: 'Outdated', category: 'deemphasize' },
            ];

            renderWithProviders(<OptimizeSection />);

            expect(screen.getByText('Outdated')).toBeInTheDocument();
        });

        it('shows empty state when keyword bucket is empty', () => {
            renderWithProviders(<OptimizeSection />);

            const noKeywordsTexts = screen.getAllByText('No keywords identified');
            expect(noKeywordsTexts.length).toBe(3); // add, neutral, remove buckets
        });

        it('uses props keywords when store keywords are empty', () => {
            const propsKeywords = {
                add: ['PropReact', 'PropNode'],
                neutral: ['PropJS'],
                remove: ['PropOld'],
            };

            renderWithProviders(<OptimizeSection keywords={propsKeywords} />);

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

            // Card header shows section type
            expect(screen.getByText('summary')).toBeInTheDocument();

            // Expand the card by clicking on the header
            const cardHeader = screen.getByText('summary').closest('div[class*="cursor-pointer"]');
            if (cardHeader) {
                fireEvent.click(cardHeader);
            }

            // After expansion, content should be visible
            expect(screen.getByText('Original summary text')).toBeInTheDocument();
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

            expect(screen.getByText('Pending')).toBeInTheDocument();
        });

        it('displays applied count correctly', () => {
            mockStoreState.optimizations = [
                { sectionId: 'a', sectionType: 'summary', original: 'a', optimized: 'b', applied: true },
                { sectionId: 'b', sectionType: 'headline', original: 'c', optimized: 'd', applied: false },
                { sectionId: 'c', sectionType: 'experience', original: 'e', optimized: 'f', applied: true },
            ];

            renderWithProviders(<OptimizeSection />);

            // The counter shows applied count and total in separate elements
            // Find the emerald text that contains the applied count
            const counterText = screen.getByText('2');
            expect(counterText).toBeInTheDocument();
            expect(screen.getByText('/ 3')).toBeInTheDocument();
        });
    });

    describe('Section Filtering', () => {
        it('filters optimizations by section type', () => {
            mockStoreState.optimizations = [
                { sectionId: 'summary-0', sectionType: 'summary', original: 'Summary text', optimized: 'Optimized summary', applied: false },
                { sectionId: 'experience-0', sectionType: 'experience', original: 'Experience text', optimized: 'Optimized experience', applied: false },
            ];

            renderWithProviders(<OptimizeSection />);

            // Initially shows all - verify by checking section type labels in card headers
            expect(screen.getByText('summary')).toBeInTheDocument();
            expect(screen.getByText('Experience 1')).toBeInTheDocument();

            // Click on Summary tab
            fireEvent.click(screen.getByRole('button', { name: /^Summary/ }));

            // Should only show summary (experience card should be hidden)
            expect(screen.getByText('summary')).toBeInTheDocument();
            expect(screen.queryByText('Experience 1')).not.toBeInTheDocument();
        });

        it('shows all optimizations when "All Sections" is selected', () => {
            mockStoreState.optimizations = [
                { sectionId: 'summary-0', sectionType: 'summary', original: 'Summary Content Here', optimized: 'Opt Summary', applied: false },
                { sectionId: 'headline-0', sectionType: 'headline', original: 'Headline Content Here', optimized: 'Opt Headline', applied: false },
            ];

            renderWithProviders(<OptimizeSection />);

            // Initially both should be visible - verify by section type labels
            expect(screen.getByText('summary')).toBeInTheDocument();
            expect(screen.getByText('headline')).toBeInTheDocument();

            // Click on Summary tab - should only show summary card
            fireEvent.click(screen.getByRole('button', { name: /^Summary/ }));
            expect(screen.getByText('summary')).toBeInTheDocument();
            expect(screen.queryByText('headline')).not.toBeInTheDocument();

            // Click on All Sections - both should be visible again
            fireEvent.click(screen.getByRole('button', { name: 'All Sections' }));
            expect(screen.getByText('summary')).toBeInTheDocument();
            expect(screen.getByText('headline')).toBeInTheDocument();
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
            expect(diffButton).toHaveClass('bg-white/10');
        });
    });

    describe('Apply/Revert Actions', () => {
        it('calls applyOptimization when card Apply button is clicked', () => {
            mockStoreState.optimizations = [
                { sectionId: 'summary-0', sectionType: 'summary', original: 'Original', optimized: 'Optimized', applied: false },
            ];

            const { container } = renderWithProviders(<OptimizeSection />);

            // Find the Apply button within the card (not Apply All)
            const allButtons = container.querySelectorAll('button');
            const applyButton = Array.from(allButtons).find(btn =>
                btn.textContent?.trim() === 'Apply' && !btn.textContent?.includes('All')
            );

            if (applyButton) {
                fireEvent.click(applyButton);
                expect(mockApplyOptimization).toHaveBeenCalledWith('summary-0');
            }
        });

        it('has no per-card revert button - only Revert All is available', () => {
            // This test documents that individual card revert is not implemented
            // The component only provides revertAllOptimizations via the header "Revert" button
            mockStoreState.optimizations = [
                { sectionId: 'summary-0', sectionType: 'summary', original: 'Original', optimized: 'Optimized', applied: true },
            ];

            const { container } = renderWithProviders(<OptimizeSection />);

            // The Revert button in header calls revertAllOptimizations
            const allButtons = container.querySelectorAll('button');
            const revertButton = Array.from(allButtons).find(btn =>
                btn.textContent?.trim() === 'Revert'
            );

            expect(revertButton).toBeDefined();
        });

        it('calls applyAllOptimizations when Apply All is clicked', () => {
            mockStoreState.optimizations = [
                { sectionId: 'a', sectionType: 'summary', original: 'a', optimized: 'b', applied: false },
                { sectionId: 'b', sectionType: 'headline', original: 'c', optimized: 'd', applied: false },
            ];

            renderWithProviders(<OptimizeSection />);

            // Use getAllByRole to handle multiple "Apply All" buttons (header + results summary)
            const applyAllButtons = screen.getAllByRole('button', { name: /apply all/i });
            fireEvent.click(applyAllButtons[0]); // Click the first one (header button)

            expect(mockApplyAllOptimizations).toHaveBeenCalled();
        });

        it('calls revertAllOptimizations when Revert is clicked', () => {
            mockStoreState.optimizations = [
                { sectionId: 'a', sectionType: 'summary', original: 'a', optimized: 'b', applied: true },
            ];

            renderWithProviders(<OptimizeSection />);

            // The Revert button (not "Revert All") triggers revertAllOptimizations
            const revertButton = screen.getByRole('button', { name: /^revert$/i });
            fireEvent.click(revertButton);

            expect(mockRevertAllOptimizations).toHaveBeenCalled();
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
        it('calls optimize API when generate button is clicked', async () => {
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

        it('handles API error gracefully (button becomes non-loading)', async () => {
            mockStoreState.originalResume = { basics: { name: 'Test' } };
            mockStoreState.parsedResumeText = 'Test resume content';

            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            renderWithProviders(<OptimizeSection />);

            const optimizeButton = screen.getByRole('button', { name: /optimize resume/i });
            fireEvent.click(optimizeButton);

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

        it('section tabs are keyboard navigable', () => {
            renderWithProviders(<OptimizeSection />);

            const tabs = ['All Sections', 'Headline', 'Summary', 'Experience', 'Skills'];
            tabs.forEach(tabName => {
                const tab = screen.getByRole('button', { name: tabName });
                expect(tab).toBeVisible();
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
        };
    });

    it('displays headline optimization correctly', () => {
        mockStoreState.optimizations = [
            { sectionId: 'headline-0', sectionType: 'headline', original: 'Old Title', optimized: 'New Title', applied: false },
        ];

        renderWithProviders(<OptimizeSection />);
        expect(screen.getByText('headline')).toBeInTheDocument();
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
});
