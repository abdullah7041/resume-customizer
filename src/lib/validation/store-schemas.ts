/**
 * Zod Schemas for Client-Side Store Validation
 * Runtime validation at store boundaries to catch type mismatches early
 * Mirrors the server-side patterns in netlify/lib/resume-schemas.ts
 */
import { z } from 'zod';

// ============================================
// Resume Schema (JSON Resume standard)
// ============================================

export const LocationSchema = z.object({
    address: z.string().nullable().optional().transform(val => val ?? ''),
    postalCode: z.string().nullable().optional().transform(val => val ?? ''),
    city: z.string().nullable().optional().transform(val => val ?? '').default(''),
    countryCode: z.string().nullable().optional().transform(val => val ?? '').default(''),
    region: z.string().nullable().optional().transform(val => val ?? '').default(''),
});

export const ProfileSchema = z.object({
    network: z.string().nullable().transform(val => val ?? ''),
    username: z.string().nullable().transform(val => val ?? ''),
    url: z.string().nullable().optional().transform(val => val ?? ''),
});

export const BasicsSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    label: z.string().nullable().optional().transform(val => val ?? '').default(''),
    image: z.string().nullable().optional().transform(val => val ?? ''),
    email: z.string().nullable().optional().transform(val => val ?? '').default(''),
    phone: z.string().nullable().optional().transform(val => val ?? '').default(''),
    url: z.string().nullable().optional().transform(val => val ?? ''),
    summary: z.string().nullable().optional().transform(val => val ?? '').default(''),
    location: LocationSchema.optional(),
    profiles: z.array(ProfileSchema).optional().default([]),
});

export const WorkSchema = z.object({
    name: z.string().nullable().transform(val => val ?? ''),
    position: z.string().nullable().transform(val => val ?? ''),
    url: z.string().nullable().optional().transform(val => val ?? ''),
    startDate: z.string().nullable().optional().transform(val => val ?? ''),
    endDate: z.string().nullable().optional().transform(val => val ?? ''),
    summary: z.string().nullable().optional().transform(val => val ?? ''),
    location: z.string().nullable().optional().transform(val => val ?? ''),
    highlights: z.array(z.string()).nullable().optional().transform(val => val ?? []),
});

export const EducationSchema = z.object({
    institution: z.string().nullable().transform(val => val ?? ''),
    url: z.string().nullable().optional().transform(val => val ?? ''),
    area: z.string().nullable().optional().transform(val => val ?? ''),
    studyType: z.string().nullable().optional().transform(val => val ?? ''),
    startDate: z.string().nullable().optional().transform(val => val ?? ''),
    endDate: z.string().nullable().optional().transform(val => val ?? ''),
    score: z.string().nullable().optional().transform(val => val ?? ''),
    courses: z.array(z.string()).nullable().optional().transform(val => val ?? []),
    highlights: z.array(z.string()).nullable().optional().transform(val => val ?? []),
});

export const SkillSchema = z.object({
    name: z.string(),
    level: z.string().optional(),
    keywords: z.array(z.string()).optional().default([]),
});

/**
 * Skills can be either:
 * 1. Array of objects (JSON Resume standard): [{ name: "Frontend", keywords: ["React", "Vue"] }]
 * 2. Array of strings (legacy/flattened format): ["React", "Vue", "JavaScript"]
 * 
 * The Gemini client flattens skills for legacy compatibility in gemini-client.js:
 * `parsed.skills = (parsed.skills || []).flatMap(s => s.keywords || []);`
 */
export const SkillsArraySchema = z.union([
    z.array(SkillSchema),
    z.array(z.string()),
]).optional().default([]);

export const ProjectSchema = z.object({
    name: z.string().nullable().transform(val => val ?? ''),
    description: z.string().nullable().optional().transform(val => val ?? ''),
    highlights: z.array(z.string()).nullable().optional().transform(val => val ?? []),
    keywords: z.array(z.string()).nullable().optional().transform(val => val ?? []),
    url: z.string().nullable().optional().transform(val => val ?? ''),
});

export const CertificateSchema = z.object({
    name: z.string().nullable().transform(val => val ?? ''),
    date: z.string().nullable().optional().transform(val => val ?? ''),
    issuer: z.string().nullable().optional().transform(val => val ?? ''),
    url: z.string().nullable().optional().transform(val => val ?? ''),
});

export const LanguageSchema = z.object({
    language: z.string(),
    fluency: z.string().optional().default(''),
});

export const MetaSchema = z.object({
    version: z.string().optional(),
    lastModified: z.string().optional(),
    raw_text: z.string().optional(),
}).passthrough(); // Allow additional properties

/**
 * Complete Resume Schema (JSON Resume standard)
 */
export const ResumeZodSchema = z.object({
    $schema: z.string().optional(),
    basics: BasicsSchema.optional(),
    work: z.array(WorkSchema).optional().default([]),
    education: z.array(EducationSchema).optional().default([]),
    skills: SkillsArraySchema, // Accepts both object array and string array
    projects: z.array(ProjectSchema).optional().default([]),
    certificates: z.array(CertificateSchema).optional().default([]),
    languages: z.array(LanguageSchema).optional().default([]),
    meta: MetaSchema.optional(),
}).passthrough(); // Allow additional properties like 'plainText', 'sections', etc.

// ============================================
// Store-Specific Schemas
// ============================================

/**
 * Parsed text must be a non-empty string
 * Prevents [object Object] and other invalid values
 */
export const ParsedTextSchema = z.string().min(1, 'Parsed text cannot be empty').refine(
    (val) => !val.includes('[object Object]'),
    { message: 'Parsed text contains [object Object] - indicates serialization error' }
);

/**
 * Optimization result schema
 */
export const OptimizationResultSchema = z.object({
    sectionId: z.string(),
    sectionType: z.enum(['summary', 'experience', 'skills', 'projects', 'headline', 'education', 'certifications']),
    original: z.union([z.string(), z.array(z.string())]),
    optimized: z.union([z.string(), z.array(z.string())]),
    applied: z.boolean(),
    timestamp: z.string().optional(),
});

/**
 * Keyword suggestion schema
 */
export const KeywordSuggestionSchema = z.object({
    keyword: z.string(),
    category: z.enum(['add', 'keep', 'deemphasize']),
});

/**
 * Cached analysis schema
 */
export const CachedAnalysisSchema = z.object({
    score: z.number().min(0).max(100),
    coverage: z.number().min(0).max(1),
    similarity: z.number().min(0).max(1),
    missingKeywords: z.array(z.string()),
    strongMatches: z.array(z.string()),
    recommendations: z.array(z.string()),
    overallAssessment: z.string(),
    timestamp: z.number(),
});

// ============================================
// Type Exports (inferred from schemas)
// ============================================

export type Resume = z.infer<typeof ResumeZodSchema>;
export type Basics = z.infer<typeof BasicsSchema>;
export type Work = z.infer<typeof WorkSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type OptimizationResultValidated = z.infer<typeof OptimizationResultSchema>;
export type KeywordSuggestionValidated = z.infer<typeof KeywordSuggestionSchema>;
export type CachedAnalysisValidated = z.infer<typeof CachedAnalysisSchema>;

// ============================================
// Validation Utilities
// ============================================

/**
 * Validation result type
 */
export interface ValidationResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    issues?: z.ZodIssue[];
}

/**
 * Validate resume data at store boundary
 */
export function validateResume(data: unknown): ValidationResult<Resume> {
    const result = ResumeZodSchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const errorMessage = formatZodError(result.error);
    console.warn('[StoreValidation] Resume validation failed:', errorMessage);
    return { success: false, error: errorMessage, issues: result.error.issues };
}

/**
 * Validate parsed text at store boundary
 * Returns the validated string or null if invalid
 */
export function validateParsedText(data: unknown): ValidationResult<string> {
    // First, extract string from common object shapes
    let textToValidate: unknown = data;

    if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        if (typeof obj.plainText === 'string') {
            textToValidate = obj.plainText;
        } else if (typeof obj.text === 'string') {
            textToValidate = obj.text;
        } else if (typeof obj.data === 'string') {
            textToValidate = obj.data;
        }
    }

    const result = ParsedTextSchema.safeParse(textToValidate);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const errorMessage = formatZodError(result.error);
    return { success: false, error: errorMessage, issues: result.error.issues };
}

/**
 * Validate optimization result
 */
export function validateOptimization(data: unknown): ValidationResult<OptimizationResultValidated> {
    const result = OptimizationResultSchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const errorMessage = formatZodError(result.error);
    console.warn('[StoreValidation] Optimization validation failed:', errorMessage);
    return { success: false, error: errorMessage, issues: result.error.issues };
}

/**
 * Validate cached analysis
 */
export function validateCachedAnalysis(data: unknown): ValidationResult<CachedAnalysisValidated> {
    const result = CachedAnalysisSchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const errorMessage = formatZodError(result.error);
    console.warn('[StoreValidation] CachedAnalysis validation failed:', errorMessage);
    return { success: false, error: errorMessage, issues: result.error.issues };
}

/**
 * Format Zod errors into a user-friendly string
 */
export function formatZodError(error: z.ZodError): string {
    return error.issues
        .map((issue) => {
            const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
            return `${path}${issue.message}`;
        })
        .join('; ');
}

/**
 * Safe coerce to string - extracts string from various object shapes
 * Returns null if unable to extract valid string
 */
export function safeCoerceToString(value: unknown): string | null {
    if (typeof value === 'string') {
        return value.length > 0 ? value : null;
    }

    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        // Try common text properties
        for (const key of ['plainText', 'text', 'data', 'content', 'raw_text']) {
            if (typeof obj[key] === 'string' && obj[key].length > 0) {
                return obj[key] as string;
            }
        }
        // Don't coerce objects to "[object Object]"
        return null;
    }

    // For primitives like number/boolean
    const str = String(value);
    return str.length > 0 && str !== 'null' && str !== 'undefined' ? str : null;
}
