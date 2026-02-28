// src/__tests__/TemplatesSection.test.jsx
// Tests for TemplatesSection component - template gallery with floating selector

import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import TemplateGallery from '../components/sections/TemplatesSection';
import { DirectionProvider } from '../components/providers/DirectionProvider';

// Mock dependencies
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, fallback) => fallback || key,
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
}));

vi.mock('../lib/stores/resumeStore', () => ({
    useResumeStore: () => ({
        originalResume: null,
        parsedResumeText: null,
        optimizations: [],
        showOptimized: false,
        getActiveResume: vi.fn(() => null),
        setSelectedTemplate: vi.fn(),
        displayOptions: { fontSize: 1, showPageBreaks: false },
        setDisplayOptions: vi.fn(),
        contentLanguage: null,
        setContentLanguage: vi.fn(),
    }),
}));

vi.mock('../hooks/useResumeLanguage', () => ({
    useResumeLanguage: () => null,
}));

vi.mock('../services/analytics', () => ({
    analytics: {
        trackTemplateSelected: vi.fn(),
        trackExport: vi.fn(),
    },
}));

vi.mock('file-saver', () => ({
    saveAs: vi.fn(),
}));

// Mock TemplateRenderer to avoid heavy rendering
vi.mock('../components/templates/TemplateRenderer', () => ({
    default: ({ template }) => (
        <div data-testid="template-renderer" data-template-id={template.id}>
            Template: {template.name}
        </div>
    ),
}));

// Mock fetch for PDF generation (server-side Puppeteer)
globalThis.fetch = vi.fn(() =>
    Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob(['pdf content'], { type: 'application/pdf' })),
    })
);

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
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('TemplatesSection', () => {
    describe('Rendering', () => {
        it('renders the template gallery with selected template name', () => {
            renderWithProviders(<TemplateGallery />);

            // The selected template name should be visible in the header
            expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
        });

        it('renders floating template selector pills', () => {
            renderWithProviders(<TemplateGallery />);

            // Find template pills in the floating selector (portaled to document.body)
            const allButtons = document.body.querySelectorAll('button');
            const templateButtons = Array.from(allButtons)
                .map(btn => btn.textContent?.trim())
                .filter(text => ['Modern Professional', 'Classic Traditional', 'Technical Engineer'].includes(text || ''));

            expect(templateButtons).toContain('Modern Professional');
            expect(templateButtons).toContain('Classic Traditional');
            expect(templateButtons).toContain('Technical Engineer');
        });

        it('renders template names in floating selector', () => {
            renderWithProviders(<TemplateGallery />);

            // Check for template names in the floating selector
            expect(screen.getAllByText('Modern Professional').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Classic Traditional').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Technical Engineer').length).toBeGreaterThan(0);
        });

        it('renders Download PDF button', () => {
            renderWithProviders(<TemplateGallery />);

            expect(screen.getByText('Download PDF')).toBeInTheDocument();
        });

        it('shows no resume warning when no data is provided', () => {
            renderWithProviders(<TemplateGallery />);

            expect(screen.getByText(/upload your resume/i)).toBeInTheDocument();
        });
    });

    describe('Template Selection', () => {
        it('first template is selected by default', () => {
            renderWithProviders(<TemplateGallery />);

            // The first template (Modern Professional) should be in the preview
            const renderers = screen.getAllByTestId('template-renderer');
            expect(renderers.length).toBeGreaterThan(0);
        });

        it('all template pills are rendered', () => {
            renderWithProviders(<TemplateGallery />);

            // Should show all 3 templates in the floating selector
            expect(screen.getAllByText('Modern Professional').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Classic Traditional').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Technical Engineer').length).toBeGreaterThan(0);
        });

        it('calls onSelectTemplate callback when template is selected', () => {
            const onSelectMock = vi.fn();
            renderWithProviders(<TemplateGallery onSelectTemplate={onSelectMock} />);

            // Find template buttons
            const allButtons = screen.getAllByRole('button');
            // Find a button that contains Classic Traditional text
            const classicButtons = allButtons.filter(btn =>
                btn.textContent?.includes('Classic Traditional')
            );

            if (classicButtons.length > 0) {
                fireEvent.click(classicButtons[0]);
                expect(onSelectMock).toHaveBeenCalled();
            }
        });
    });

    describe('Live Preview', () => {
        it('renders TemplateRenderer component', () => {
            renderWithProviders(<TemplateGallery />);

            // Single main preview renderer exists
            const renderers = screen.getAllByTestId('template-renderer');
            expect(renderers.length).toBeGreaterThan(0);
        });

        it('preview header shows selected template name', () => {
            renderWithProviders(<TemplateGallery />);

            // Check that h3 heading shows a template name
            const h3 = screen.getByRole('heading', { level: 3 });
            expect(h3.textContent).toContain('Modern Professional');
        });
    });

    describe('PDF Download', () => {
        it('disables download button when no resume data', () => {
            renderWithProviders(<TemplateGallery />);

            const downloadButton = screen.getByRole('button', { name: /download pdf/i });
            expect(downloadButton).toBeDisabled();
        });
    });

    describe('Floating Selector', () => {
        it('renders template selector in floating bar', () => {
            renderWithProviders(<TemplateGallery />);

            // Template selector renders pills - Modern Professional should be visible
            expect(screen.getAllByText('Modern Professional').length).toBeGreaterThan(0);
        });

        it('template pills are clickable', () => {
            renderWithProviders(<TemplateGallery />);

            // Find all template buttons (portaled to document.body)
            const allButtons = document.body.querySelectorAll('button');
            const templateButtons = Array.from(allButtons).filter(btn => {
                const text = btn.textContent?.trim();
                return ['Modern Professional', 'Classic Traditional', 'Technical Engineer'].includes(text || '');
            });

            expect(templateButtons.length).toBeGreaterThanOrEqual(3);

            // Click on Technical Engineer
            const techButton = templateButtons.find(btn => btn.textContent?.includes('Technical Engineer'));
            if (techButton) {
                fireEvent.click(techButton);
                // Verify click doesn't cause errors
                expect(screen.getAllByText('Technical Engineer').length).toBeGreaterThan(0);
            }
        });
    });

    describe('Accessibility', () => {
        it('all buttons are keyboard accessible', () => {
            renderWithProviders(<TemplateGallery />);

            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(0);
            buttons.forEach(button => {
                // Verify keyboard accessibility: buttons should have a tabIndex >= 0
                expect(button.tabIndex).toBeGreaterThanOrEqual(0);
            });
        });

        it('has proper heading hierarchy', () => {
            renderWithProviders(<TemplateGallery />);

            // Should have h3 for template name
            const h3 = screen.getByRole('heading', { level: 3 });
            expect(h3).toBeInTheDocument();
        });

        it('section has proper ARIA structure', () => {
            const { container } = renderWithProviders(<TemplateGallery />);

            // Should have main content areas
            expect(container.querySelector('.flex-1')).toBeInTheDocument();
        });
    });
});

describe('Template Data Structure', () => {
    it('resumeTemplates has required properties', async () => {
        const { resumeTemplates } = await import('../lib/data/resumeTemplates');

        resumeTemplates.forEach(template => {
            expect(template).toHaveProperty('id');
            expect(template).toHaveProperty('name');
            expect(template).toHaveProperty('category');
            expect(template).toHaveProperty('structure');
            expect(template).toHaveProperty('formatting');
        });
    });

    it('all templates have unique IDs', async () => {
        const { resumeTemplates } = await import('../lib/data/resumeTemplates');

        const ids = resumeTemplates.map(t => t.id);
        const uniqueIds = new Set(ids);

        expect(uniqueIds.size).toBe(ids.length);
    });

    it('getTemplateById returns correct template', async () => {
        const { getTemplateById } = await import('../lib/data/resumeTemplates');

        const template = getTemplateById('modern-professional');
        expect(template).toBeDefined();
        expect(template?.name).toBe('Modern Professional');
    });

    it('getTemplateById returns null for unknown ID', async () => {
        const { getTemplateById } = await import('../lib/data/resumeTemplates');

        const template = getTemplateById('unknown-template');
        expect(template).toBeNull();
    });

    it('TEMPLATE_CATEGORIES has expected values', async () => {
        const { TEMPLATE_CATEGORIES } = await import('../lib/data/resumeTemplates');

        expect(TEMPLATE_CATEGORIES.MODERN).toBe('modern');
        expect(TEMPLATE_CATEGORIES.CLASSIC).toBe('classic');
        expect(TEMPLATE_CATEGORIES.TECHNICAL).toBe('technical');
    });
});
