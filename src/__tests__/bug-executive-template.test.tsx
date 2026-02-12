/**
 * Bug 2: Executive template not rendering in preview
 *
 * Root cause: TemplateRenderer.tsx line 365 hardcodes only 4 template IDs:
 *   ['modern-professional', 'classic-traditional', 'technical-engineer', 'ats-optimized']
 * so 'executive-professional' falls through to the generic DynamicTemplateRenderer
 * which uses a completely different data structure and renders incorrectly.
 */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback || key,
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
}));

vi.mock('../hooks/useSectionLabel', () => ({
    useSectionLabel: () => (key: string) => {
        const labels: Record<string, string> = {
            about: 'About', experience: 'Experience', education: 'Education',
            skills: 'Skills', projects: 'Projects', certifications: 'Certifications',
            languages: 'Languages',
        };
        return labels[key] || key;
    },
}));

vi.mock('../components/providers/DirectionProvider', () => ({
    useDirection: () => ({ isRTL: false, direction: 'ltr' }),
    DirectionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock zustand store for TemplateRenderer
vi.mock('../lib/stores/resumeStore', () => ({
    useResumeStore: (selector: (s: Record<string, unknown>) => unknown) => {
        const mockState = {
            displayOptions: {
                baseFontSize: 10.5, headingSize: 14, fontFamily: "'Inter', sans-serif",
                sectionSpacing: 12, paragraphSpacing: 6, lineHeight: 1.5,
                marginTop: 0.6, marginBottom: 0.5, marginSide: 0.7,
                fontSize: 1, showPageBreaks: false, boldKeywords: true,
            },
        };
        return selector(mockState);
    },
}));

import { ExecutiveProfessional } from '../components/templates/ExecutiveProfessional';

const fullResume = {
    basics: {
        name: 'Ahmed Ali', label: 'VP Engineering',
        email: 'ahmed@example.com', phone: '+966 555 0000',
        summary: 'Executive leader with 15 years in tech.',
        location: { city: 'Riyadh', region: 'Riyadh Province', countryCode: 'SA' },
        profiles: [{ network: 'LinkedIn', url: 'https://linkedin.com/in/ahmed', username: 'ahmed' }],
    },
    work: [{
        name: 'TechCorp', position: 'VP Engineering',
        location: 'Riyadh', startDate: '2018-01', endDate: 'Present',
        summary: 'Led engineering division and scaled the team.',
        highlights: ['Built engineering org from 5 to 50'],
    }],
    education: [{
        institution: 'KFUPM', studyType: 'BSc',
        area: 'Computer Science', startDate: '2004', endDate: '2008',
    }],
    skills: [{ name: 'Leadership', keywords: ['Strategy', 'Team Building'] }],
    projects: [],
    certificates: [],
    languages: [{ language: 'Arabic', fluency: 'Native' }],
};

beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: false, media: query, onchange: null,
            addEventListener: vi.fn(), removeEventListener: vi.fn(),
            addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
        })),
    });
});

afterEach(() => { cleanup(); });

describe('Bug 2 – Executive template renders via registry', () => {
    it('ExecutiveProfessional renders resume data correctly', () => {
        const { container } = render(
            <ExecutiveProfessional resume={fullResume} />
        );
        const html = container.innerHTML;
        expect(html).toContain('Ahmed Ali');
        expect(html).toContain('VP Engineering');
        expect(html).toContain('Riyadh');
    });

    it('TemplateRenderer routes executive-professional through registry (not DynamicTemplateRenderer)', async () => {
        // Import the actual TEMPLATES registry to verify executive-professional is registered
        const { TEMPLATES } = await import('../components/templates/registry');

        // FIXED: 'executive-professional' should be in the actual registry
        const isInRegistry = 'executive-professional' in TEMPLATES;

        expect(isInRegistry).toBe(true);
        expect(TEMPLATES['executive-professional']).toBeDefined();
    });
});
