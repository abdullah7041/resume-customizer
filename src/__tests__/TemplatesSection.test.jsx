// src/__tests__/TemplatesSection.test.jsx
// Tests for TemplatesSection component - template gallery with floating selector

import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import TemplateGallery from '../components/sections/TemplatesSection';
import { DirectionProvider } from '../components/providers/DirectionProvider';
import { exportResumeAsDocx } from '../services/exportDocx';

let mockContentLanguage = null;

// Mock dependencies
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key, fallback) => fallback || key,
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
}));

vi.mock('../lib/stores/resumeStore', () => {
    const storeState = {
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
    };
    const useResumeStore = () => storeState;
    useResumeStore.getState = () => storeState;
    return { useResumeStore };
});

vi.mock('../hooks/useResumeLanguage', () => ({
    useResumeLanguage: () => mockContentLanguage,
}));

vi.mock('../services/analytics', () => ({
    analytics: {
        trackTemplateSelected: vi.fn(),
        trackExport: vi.fn(),
        trackExportClicked: vi.fn(),
        trackExportSuccess: vi.fn(),
        trackExportFailed: vi.fn(),
    },
}));

vi.mock('file-saver', () => ({
    saveAs: vi.fn(),
}));

vi.mock('html-to-image', () => ({
    toCanvas: vi.fn(() => Promise.reject(new Error('canvas failed'))),
}));

vi.mock('jspdf', () => ({
    jsPDF: vi.fn(() => ({})),
}));

vi.mock('../services/api', () => ({
    getAuthHeaders: vi.fn(() => Promise.resolve({ 'Content-Type': 'application/json', Authorization: 'Bearer test-token' })),
}));

vi.mock('../services/exportDocx', () => ({
    exportResumeAsDocx: vi.fn(() => Promise.resolve(new Blob(['docx content'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))),
}));

// Mock TemplateRenderer to avoid heavy rendering
vi.mock('../components/templates/TemplateRenderer', () => ({
    default: ({ template, contentDirection }) => (
        <div data-testid="template-renderer" data-resume-preview data-template-id={template.id} data-direction={contentDirection}>
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

const getPreviewScale = (element) => {
    const style = element?.getAttribute('style') ?? '';
    const match = style.match(/scale\(([\d.]+)\)/);
    return match ? Number(match[1]) : null;
};

beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: createMatchMedia(),
    });
});

beforeEach(() => {
    mockContentLanguage = null;
    globalThis.fetch.mockClear();
    globalThis.fetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['pdf content'], { type: 'application/pdf' })),
    });
    exportResumeAsDocx.mockClear();
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('TemplatesSection', () => {
    const setViewportWidth = (width) => {
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: width,
        });
        window.dispatchEvent(new Event('resize'));
    };

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
                .filter(text => ['Riyadh', 'Khobar', 'Qiddiya'].includes(text || ''));

            expect(templateButtons).toContain('Riyadh');
            expect(templateButtons).toContain('Khobar');
            expect(templateButtons).toContain('Qiddiya');
        });

        it('renders template names in floating selector', () => {
            renderWithProviders(<TemplateGallery />);

            // Check for template names in the floating selector
            expect(screen.getAllByText('Riyadh').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Khobar').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Qiddiya').length).toBeGreaterThan(0);
        });

        it('renders Download PDF button', () => {
            renderWithProviders(<TemplateGallery />);

            expect(screen.getByText('Download PDF')).toBeInTheDocument();
        });

        it('renders direct DOCX download label', () => {
            renderWithProviders(<TemplateGallery />);

            expect(screen.getByText('Download DOCX')).toBeInTheDocument();
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

            // Should show at least 3 templates in the floating selector
            expect(screen.getAllByText('Riyadh').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Khobar').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Qiddiya').length).toBeGreaterThan(0);
        });

        it('calls onSelectTemplate callback when template is selected', () => {
            const onSelectMock = vi.fn();
            renderWithProviders(<TemplateGallery onSelectTemplate={onSelectMock} />);

            // Find template buttons
            const allButtons = screen.getAllByRole('button');
            // Find a button that contains Khobar text
            const classicButtons = allButtons.filter(btn =>
                btn.textContent?.includes('Khobar')
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
            expect(h3.textContent).toContain('Riyadh');
        });

        it('uses RTL preview direction for mixed Arabic/English content', () => {
            mockContentLanguage = 'mixed';

            renderWithProviders(<TemplateGallery resumeData={{
                basics: { name: 'سارة الأحمد', label: 'Product Manager' },
                work: [],
                education: [],
                skills: [],
                projects: [],
            }} />);

            expect(screen.getByTestId('template-renderer')).toHaveAttribute('data-direction', 'rtl');
        });
    });

    describe('PDF Download', () => {
        it('disables download button when no resume data', () => {
            renderWithProviders(<TemplateGallery />);

            const downloadButton = screen.getByRole('button', { name: /download pdf/i });
            expect(downloadButton).toBeDisabled();
        });

        it('sends RTL direction to server PDF generation for mixed Arabic/English content', async () => {
            mockContentLanguage = 'mixed';

            renderWithProviders(<TemplateGallery resumeData={{
                basics: { name: 'سارة الأحمد', label: 'Product Manager' },
                work: [],
                education: [],
                skills: [],
                projects: [],
            }} />);

            fireEvent.click(screen.getByRole('button', { name: /download pdf/i }));

            await waitFor(() => {
                expect(globalThis.fetch).toHaveBeenCalledWith(
                    '/.netlify/functions/generate-pdf',
                    expect.objectContaining({
                        method: 'POST',
                        body: expect.stringContaining('"direction":"rtl"'),
                    })
                );
            });
        });

        it('passes RTL direction to DOCX export for mixed Arabic/English content', async () => {
            mockContentLanguage = 'mixed';

            renderWithProviders(<TemplateGallery resumeData={{
                basics: { name: 'سارة الأحمد', label: 'Product Manager' },
                work: [],
                education: [],
                skills: [],
                projects: [],
            }} />);

            fireEvent.click(screen.getByRole('button', { name: /download docx/i }));

            await waitFor(() => {
                expect(exportResumeAsDocx).toHaveBeenCalledWith(
                    expect.objectContaining({
                        basics: expect.objectContaining({ name: 'سارة الأحمد' }),
                    }),
                    expect.objectContaining({ direction: 'rtl' })
                );
            });
        });

        it('shows a localized error when server PDF and client fallback export both fail', async () => {
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
            globalThis.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                blob: () => Promise.resolve(new Blob([], { type: 'application/pdf' })),
            });

            try {
                renderWithProviders(<TemplateGallery resumeData={{
                    basics: { name: 'Sara Ahmed', label: 'Product Manager' },
                    work: [],
                    education: [],
                    skills: [],
                    projects: [],
                }} />);

                fireEvent.click(screen.getByRole('button', { name: /download pdf/i }));

                await waitFor(() => {
                    expect(screen.getByRole('alert')).toHaveTextContent(
                        'Export failed. Please try again, or switch to the ATS-friendly template and retry.'
                    );
                });
                expect(screen.queryByText(/canvas failed/i)).not.toBeInTheDocument();
            } finally {
                consoleError.mockRestore();
            }
        });

        it('shows a localized error when DOCX export fails', async () => {
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
            exportResumeAsDocx.mockRejectedValueOnce(new Error('docx failed'));

            try {
                renderWithProviders(<TemplateGallery resumeData={{
                    basics: { name: 'Sara Ahmed', label: 'Product Manager' },
                    work: [],
                    education: [],
                    skills: [],
                    projects: [],
                }} />);

                fireEvent.click(screen.getByRole('button', { name: /download docx/i }));

                await waitFor(() => {
                    expect(screen.getByRole('alert')).toHaveTextContent(
                        'Export failed. Please try again, or switch to the ATS-friendly template and retry.'
                    );
                });
                expect(screen.queryByText(/docx failed/i)).not.toBeInTheDocument();
            } finally {
                consoleError.mockRestore();
            }
        });
    });

    describe('Floating Selector', () => {
        it('renders template selector in floating bar', () => {
            renderWithProviders(<TemplateGallery />);

            // Template selector renders pills - Riyadh should be visible
            expect(screen.getAllByText('Riyadh').length).toBeGreaterThan(0);
        });

        it('template pills are clickable', () => {
            renderWithProviders(<TemplateGallery />);

            // Find all template buttons (portaled to document.body)
            const allButtons = document.body.querySelectorAll('button');
            const templateButtons = Array.from(allButtons).filter(btn => {
                const text = btn.textContent?.trim();
                return ['Riyadh', 'Khobar', 'Qiddiya'].includes(text || '');
            });

            expect(templateButtons.length).toBeGreaterThanOrEqual(3);

            // Click on Khobar
            const techButton = templateButtons.find(btn => btn.textContent?.includes('Khobar'));
            if (techButton) {
                fireEvent.click(techButton);
                // Verify click doesn't cause errors
                expect(screen.getAllByText('Khobar').length).toBeGreaterThan(0);
            }
        });
    });

    describe('Mobile Responsive Contracts', () => {
        it.each([360, 390, 768])('keeps export controls compact and available at %ipx', (width) => {
            setViewportWidth(width);
            const { container } = renderWithProviders(<TemplateGallery />);

            const mobileActionRow = container.querySelector('.md\\:hidden.flex-wrap');
            const mobileButtons = Array.from(mobileActionRow?.querySelectorAll('button') ?? []);
            const pdfButton = mobileButtons.find((button) => button.textContent?.trim() === 'PDF file');
            const docxButton = mobileButtons.find((button) => button.textContent?.trim() === 'DOCX file');
            const editButton = mobileButtons.find((button) => button.textContent?.trim() === 'Edit');

            expect(mobileActionRow).toHaveClass('md:hidden', 'flex-wrap');
            expect(pdfButton).toHaveClass('!text-xs');
            expect(docxButton).toHaveClass('!text-xs');
            expect(editButton).toHaveClass('!text-xs');
        });

        it.each([360, 390, 768])('keeps the A4 preview scaled inside a horizontally clipped preview area at %ipx', (width) => {
            setViewportWidth(width);
            renderWithProviders(<TemplateGallery />);

            const preview = screen.getByTestId('template-renderer');
            const scaleWrapper = preview.closest('div[style*="scale"]');
            const scrollArea = scaleWrapper?.parentElement?.parentElement;
            const scale = getPreviewScale(scaleWrapper);

            expect(scaleWrapper?.getAttribute('style')).toContain('width: 210mm');
            expect(scale).toBeGreaterThanOrEqual(0.35);
            expect(scale).toBeLessThanOrEqual(0.9);
            expect(scrollArea).toHaveClass('overflow-x-hidden', 'overflow-y-auto');
        });

        it('keeps the tablet preview below desktop scale when the viewport is 768px wide', () => {
            setViewportWidth(768);
            renderWithProviders(<TemplateGallery />);

            const preview = screen.getByTestId('template-renderer');
            const scaleWrapper = preview.closest('div[style*="scale"]');

            expect(getPreviewScale(scaleWrapper)).toBeLessThan(0.9);
        });

        it('keeps formatting and zoom controls reserved for large screens', () => {
            setViewportWidth(768);
            const { container } = renderWithProviders(<TemplateGallery />);

            expect(container.querySelector('.hidden.lg\\:block.flex-shrink-0')).toBeInTheDocument();
            expect(container.querySelector('.hidden.lg\\:flex')).toBeInTheDocument();
        });

        it.each([360, 390, 768])('keeps the floating template selector within the viewport at %ipx', (width) => {
            setViewportWidth(width);
            renderWithProviders(<TemplateGallery />);

            const templateButton = screen.getAllByText('Riyadh')
                .map((node) => node.closest('button'))
                .find(Boolean);
            const selector = templateButton?.closest('div.fixed');

            expect(selector).toHaveClass('fixed', 'z-50');
            expect(selector?.getAttribute('style')).toContain('max-width: calc(100vw - 16px)');
            expect(templateButton).toHaveClass('whitespace-nowrap', 'shrink-0');
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
        expect(template?.name).toBe('Riyadh');
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
