// src/components/templates/pdf/shared.ts
// Shared utilities, fonts, and types for PDF templates

import { Font } from "@react-pdf/renderer";

// ============================================
// Font Registration (Only register once)
// ============================================

let fontsRegistered = false;

export function registerPDFFonts(): void {
    if (fontsRegistered) return;

    // Register Inter font family
    Font.register({
        family: "Inter",
        fonts: [
            {
                src: "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.8/files/inter-latin-400-normal.woff",
                fontWeight: 400,
            },
            {
                src: "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.8/files/inter-latin-500-normal.woff",
                fontWeight: 500,
            },
            {
                src: "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.8/files/inter-latin-600-normal.woff",
                fontWeight: 600,
            },
            {
                src: "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.8/files/inter-latin-700-normal.woff",
                fontWeight: 700,
            },
        ],
    });

    // Register Noto Sans Arabic for Arabic text support
    Font.register({
        family: "Noto Sans Arabic",
        fonts: [
            {
                src: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-arabic@5.0.8/files/noto-sans-arabic-arabic-400-normal.woff",
                fontWeight: 400,
            },
            {
                src: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-arabic@5.0.8/files/noto-sans-arabic-arabic-700-normal.woff",
                fontWeight: 700,
            },
        ],
    });

    // Disable hyphenation
    Font.registerHyphenationCallback(word => [word]);

    fontsRegistered = true;
}

// ============================================
// Helper Functions
// ============================================

/** Safe text renderer - converts unknown values to strings */
export const safeText = (value: unknown, fallback = ""): string => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        return String(obj.name || obj.title || obj.institution || fallback);
    }
    return String(value);
};

/** Ensure URLs have proper protocol */
export const safeUrl = (url: unknown): string => {
    if (!url || typeof url !== 'string') return '#';
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('mailto:')) {
        return trimmed;
    }
    if (trimmed.includes('@') && !trimmed.includes('/')) {
        return `mailto:${trimmed}`;
    }
    return `https://${trimmed}`;
};

/** Check if two texts are similar (for deduplication) */
export const areSimilar = (text1: string, text2: string): boolean => {
    if (!text1 || !text2) return false;
    const t1 = text1.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const t2 = text2.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (t1 === t2) return true;
    if (t1.includes(t2) || t2.includes(t1)) return true;
    const words1 = t1.split(/\s+/).filter(w => w.length > 3);
    const words2 = t2.split(/\s+/).filter(w => w.length > 3);
    if (words1.length === 0 || words2.length === 0) return false;
    const matches = words1.filter(w => words2.includes(w));
    return matches.length / Math.min(words1.length, words2.length) > 0.6;
};

// ============================================
// PDF SPACING CONSTANTS (Industry Standard)
// ============================================
// Based on professional resume builder research
// Margins: 0.5"-1" = 36-72pt
// Section spacing: 12-18pt
// Entry spacing: 10-14pt

export const PDF_SPACING = {
    page: {
        paddingVertical: 40,    // ~0.55" top/bottom
        paddingHorizontal: 48,  // ~0.67" left/right
    },
    header: {
        marginBottom: 20,       // Space after header
        paddingBottom: 16,      // Padding above border
    },
    section: {
        marginBottom: 16,       // Between sections
        titleMarginBottom: 10,  // After section title
    },
    entry: {
        marginBottom: 12,       // Between entries (jobs, schools)
    },
    bullet: {
        marginBottom: 3,        // Between bullet points
    },
} as const;

// ============================================
// Type Definitions
// ============================================

export interface Profile {
    network?: string;
    url?: string;
    username?: string;
}

export interface Location {
    city?: string;
    region?: string;
    address?: string;
}

export interface Basics {
    name?: string;
    label?: string;
    email?: string;
    phone?: string;
    url?: string;
    summary?: string;
    location?: Location;
    profiles?: Profile[];
}

export interface WorkEntry {
    name?: string;
    company?: string;
    position?: string;
    title?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    summary?: string;
    highlights?: string[];
}

export interface EducationEntry {
    institution?: string;
    area?: string;
    studyType?: string;
    startDate?: string;
    endDate?: string;
    score?: string;
    courses?: string[];
    highlights?: string[];
}

export interface SkillGroup {
    name?: string;
    keywords?: string[];
}

export interface Project {
    name?: string;
    description?: string;
    highlights?: string[];
    keywords?: string[];
    startDate?: string;
    endDate?: string;
}

export interface Certificate {
    name?: string;
    issuer?: string;
    date?: string;
}

export interface Language {
    language?: string;
    fluency?: string;
}

export interface ResumeData {
    basics?: Basics;
    work?: WorkEntry[];
    education?: EducationEntry[];
    skills?: (SkillGroup | string)[];
    projects?: Project[];
    certificates?: Certificate[];
    languages?: Language[];
    summary?: string;
}

// Common prop interface for all PDF templates
export interface PDFTemplateProps {
    userData?: ResumeData;
}
