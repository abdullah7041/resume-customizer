// src/types/resume.d.ts
// JSON Resume Schema - Industry Standard (https://jsonresume.org/schema)
// Single source of truth for all resume data types in the application

import type { AiSuggestionEntry } from './analysis';

/**
 * Location information for basics section
 */
export interface Location {
    address?: string;
    postalCode?: string;
    city: string;
    countryCode: string;
    region: string;
}

/**
 * Social/professional profile links
 */
export interface Profile {
    network: string;
    username: string;
    url: string;
}

/**
 * Basic personal information
 */
export interface Basics {
    name: string;
    label: string; // Job Title / Professional Headline
    image?: string;
    email: string;
    phone: string;
    url?: string; // Personal website/portfolio
    summary: string;
    location: Location;
    profiles: Profile[];
}

/**
 * Work experience entry
 */
export interface Work {
    name: string; // Company name
    position: string;
    url?: string; // Company website
    startDate: string; // ISO 8601 format (YYYY-MM-DD)
    endDate: string; // ISO 8601 format or "Present"
    summary: string;
    location?: string; // Job location (city/region)
    highlights: string[]; // Bullet points / achievements
}

/**
 * Education entry
 */
export interface Education {
    institution: string;
    url?: string;
    area: string; // Major / Field of study
    studyType: string; // Degree (e.g., "Bachelor", "Master", "PhD")
    startDate: string;
    endDate: string;
    score?: string; // GPA or grade
    courses?: string[]; // Relevant coursework
    highlights?: string[]; // Achievements / descriptions
}

/**
 * Skill category with keywords
 */
export interface Skill {
    name: string; // Category (e.g., "Frontend", "Backend", "DevOps")
    level?: string; // Proficiency (e.g., "Expert", "Intermediate")
    keywords: string[]; // Individual skills (e.g., ["React", "TypeScript", "Next.js"])
}

/**
 * Project entry
 */
export interface Project {
    name: string;
    description: string;
    highlights?: string[];
    keywords?: string[]; // Technologies used
    startDate?: string;
    endDate?: string;
    url?: string; // Project URL / demo link
    roles?: string[]; // Your roles in the project
    entity?: string; // Organization / client
    type?: string; // "application", "presentation", "publication", etc.
}

/**
 * Certificate / Certification entry
 */
export interface Certificate {
    name: string;
    date: string; // Date of issue
    issuer: string;
    url?: string; // Verification URL
}

/**
 * Award / Honor entry
 */
export interface Award {
    title: string;
    date: string;
    awarder: string;
    summary?: string;
}

/**
 * Publication entry
 */
export interface Publication {
    name: string;
    publisher: string;
    releaseDate: string;
    url?: string;
    summary?: string;
}

/**
 * Language proficiency entry
 */
export interface Language {
    language: string;
    fluency: string; // e.g., "Native", "Fluent", "Intermediate", "Basic"
}

/**
 * Volunteer experience entry
 */
export interface Volunteer {
    organization: string;
    position: string;
    url?: string;
    startDate: string;
    endDate: string;
    summary?: string;
    highlights?: string[];
}

/**
 * Personal interest / hobby
 */
export interface Interest {
    name: string;
    keywords?: string[];
}

/**
 * Professional reference
 */
export interface Reference {
    name: string;
    reference: string; // Recommendation text or contact info
}

/**
 * Parse-quality signals from the extraction pipeline.
 * Lets the UI distinguish parser loss / preview truncation from genuinely-absent
 * content so it never shows misleading "No X found" warnings.
 */
export interface ParseQuality {
    incompleteSections?: string[]; // sections present in raw text but dropped by the parser AND not recoverable
    previewTruncated?: boolean; // guest preview text was capped before parsing
    fallbackSections?: string[]; // sections/contact fields recovered via deterministic raw-text slicing
    // How the final sections were sourced. Base is direct text, client/server file
    // extraction, or OCR; "+recovery" = AI parsed but deterministic recovery
    // filled dropped sections; "+deterministic" = the AI parse failed and the whole
    // skeleton was built from raw text.
    extractionSource?: 'text' | 'client' | 'server' | 'ocr'
        | 'text+recovery' | 'client+recovery' | 'server+recovery' | 'ocr+recovery'
        | 'text+deterministic' | 'client+deterministic' | 'server+deterministic' | 'ocr+deterministic';
    ocrFallback?: boolean; // scanned/image PDF transcribed via the vision OCR fallback
    pagesProcessed?: number; // OCR pages transcribed
    aiParseFailed?: boolean; // AI parser + provider fallback failed; result is a deterministic skeleton
    aiFailureCode?: string; // normalized AI failure code (no resume text)
    confidence?: 'low'; // set to 'low' when the structured result is a deterministic fallback
}

/**
 * Schema metadata
 */
export interface Meta {
    canonical?: string; // URL to latest version
    version?: string;
    lastModified?: string; // ISO 8601 date
    parseQuality?: ParseQuality;
    ai_suggestions?: AiSuggestionEntry[]; // provenance log of AI-modified data (e.g. refined bullets)
}

/**
 * Complete JSON Resume Schema
 * @see https://jsonresume.org/schema
 */
export interface ResumeSchema {
    $schema?: string;
    basics: Basics;
    work: Work[];
    education: Education[];
    skills: Skill[];
    projects?: Project[];
    certificates?: Certificate[];
    awards?: Award[];
    publications?: Publication[];
    languages?: Language[];
    volunteer?: Volunteer[];
    interests?: Interest[];
    references?: Reference[];
    meta?: Meta;
}

/**
 * Partial resume for incremental updates / drafts
 */
export type PartialResumeSchema = Partial<ResumeSchema> & {
    basics?: Partial<Basics>;
};

/**
 * Resume data as stored/retrieved from persistence
 */
export interface StoredResume {
    id?: string;
    data: ResumeSchema;
    createdAt?: string;
    updatedAt?: string;
}




