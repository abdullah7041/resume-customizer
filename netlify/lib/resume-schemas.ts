/**
 * Zod Schemas for Resume Validation
 * Runtime validation for JSON Resume standard
 * @see https://jsonresume.org/schema
 */
import { z } from "zod";

// ============================================
// Base Schemas (reusable building blocks)
// ============================================

export const LocationSchema = z.object({
    address: z.string().optional(),
    postalCode: z.string().optional(),
    city: z.string().optional().default(""),
    countryCode: z.string().optional().default(""),
    region: z.string().optional().default(""),
});

export const ProfileSchema = z.object({
    network: z.string(),
    username: z.string(),
    url: z.string().url().optional(),
});

// ============================================
// Core Resume Section Schemas
// ============================================

export const BasicsSchema = z.object({
    name: z.string().min(1, "Name is required"),
    label: z.string().optional().default(""),
    image: z.string().url().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional().default(""),
    url: z.string().url().optional(),
    summary: z.string().optional().default(""),
    location: LocationSchema.optional(),
    profiles: z.array(ProfileSchema).optional().default([]),
});

export const WorkSchema = z.object({
    name: z.string().min(1, "Company name is required"),
    position: z.string().min(1, "Position is required"),
    url: z.string().url().optional(),
    startDate: z.string().optional().default(""),
    endDate: z.string().optional().default(""),
    summary: z.string().optional().default(""),
    highlights: z.array(z.string()).optional().default([]),
});

export const EducationSchema = z.object({
    institution: z.string().min(1, "Institution is required"),
    url: z.string().url().optional(),
    area: z.string().optional().default(""),
    studyType: z.string().optional().default(""),
    startDate: z.string().optional().default(""),
    endDate: z.string().optional().default(""),
    score: z.string().optional(),
    courses: z.array(z.string()).optional().default([]),
});

export const SkillSchema = z.object({
    name: z.string().min(1, "Skill category name is required"),
    level: z.string().optional(),
    keywords: z.array(z.string()).optional().default([]),
});

export const ProjectSchema = z.object({
    name: z.string().min(1, "Project name is required"),
    description: z.string().optional().default(""),
    highlights: z.array(z.string()).optional().default([]),
    keywords: z.array(z.string()).optional().default([]),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    url: z.string().url().optional(),
    roles: z.array(z.string()).optional(),
    entity: z.string().optional(),
    type: z.string().optional(),
});

export const CertificateSchema = z.object({
    name: z.string().min(1, "Certificate name is required"),
    date: z.string().optional().default(""),
    issuer: z.string().optional().default(""),
    url: z.string().url().optional(),
});

export const AwardSchema = z.object({
    title: z.string().min(1, "Award title is required"),
    date: z.string().optional().default(""),
    awarder: z.string().optional().default(""),
    summary: z.string().optional(),
});

export const LanguageSchema = z.object({
    language: z.string().min(1, "Language is required"),
    fluency: z.string().optional().default(""),
});

export const VolunteerSchema = z.object({
    organization: z.string().min(1, "Organization is required"),
    position: z.string().optional().default(""),
    url: z.string().url().optional(),
    startDate: z.string().optional().default(""),
    endDate: z.string().optional().default(""),
    summary: z.string().optional(),
    highlights: z.array(z.string()).optional().default([]),
});

export const ReferenceSchema = z.object({
    name: z.string().min(1, "Reference name is required"),
    reference: z.string().optional().default(""),
});

export const MetaSchema = z.object({
    canonical: z.string().url().optional(),
    version: z.string().optional(),
    lastModified: z.string().optional(),
});

// ============================================
// Gap Analysis Schemas
// ============================================

export const GapAnalysisItemSchema = z.object({
    requirement: z.string(),
    current_state: z.string(),
    gap_severity: z.enum(['critical', 'moderate', 'minor']),
    recommendation: z.string()
});

export const HiddenMatchSchema = z.object({
    resume_term: z.string(),
    jd_requirement: z.string(),
    insight: z.string()
});

export const KeywordStrategySchema = z.object({
    mirrored_phrases: z.array(z.string()).default([]),
    structural_changes: z.array(z.string()).default([]),
    hidden_matches: z.array(HiddenMatchSchema).default([])
});

export const ScoreBreakdownSchema = z.object({
    base_score: z.number(),
    skill_match_bonus: z.number(),
    keyword_coverage_bonus: z.number(),
    gap_penalties: z.number(),
    final_score: z.number(),
    score_explanation: z.string()
});

// ============================================
// Complete Resume Schema
// ============================================

export const ResumeSchema = z.object({
    $schema: z.string().optional(),
    basics: BasicsSchema.optional(),
    work: z.array(WorkSchema).optional().default([]),
    education: z.array(EducationSchema).optional().default([]),
    skills: z.array(SkillSchema).optional().default([]),
    projects: z.array(ProjectSchema).optional().default([]),
    certificates: z.array(CertificateSchema).optional().default([]),
    awards: z.array(AwardSchema).optional().default([]),
    languages: z.array(LanguageSchema).optional().default([]),
    volunteer: z.array(VolunteerSchema).optional().default([]),
    references: z.array(ReferenceSchema).optional().default([]),
    meta: MetaSchema.optional(),
});

// ============================================
// API Request Validation Schemas
// ============================================

export const ParseResumeTextRequestSchema = z.object({
    kind: z.literal("text"),
    value: z.string().optional(),
});

export const ParseResumeFileRequestSchema = z.object({
    kind: z.literal("file"),
    name: z.string().optional(),
    mime: z.string().optional(),
    data: z.string().min(1, "File data is required"),
});

export const ParseResumeRequestSchema = z.discriminatedUnion("kind", [
    ParseResumeTextRequestSchema,
    ParseResumeFileRequestSchema,
]);

// Size limits to prevent abuse (resumes typically < 10k chars, JDs < 15k chars)
const MAX_RESUME_LENGTH = 50000; // ~50KB text
const MAX_JOB_LENGTH = 30000;    // ~30KB text
const MAX_NAME_LENGTH = 200;

export const MatchRequestSchema = z.object({
    resumeText: z.string().min(1, "Resume text is required").max(MAX_RESUME_LENGTH, "Resume text too large"),
    jobText: z.string().min(1, "Job description is required").max(MAX_JOB_LENGTH, "Job description too large"),
});

export const OptimizeRequestSchema = z.object({
    resumeText: z.string().min(1, "Resume text is required").max(MAX_RESUME_LENGTH, "Resume text too large"),
    jobText: z.string().min(1, "Job text is required").max(MAX_JOB_LENGTH, "Job text too large"),
});

export const PredictQuestionsRequestSchema = z.object({
    resumeText: z.string().min(1, "Resume text is required").max(MAX_RESUME_LENGTH, "Resume text too large"),
    jobDescription: z.string().min(1, "Job description is required").max(MAX_JOB_LENGTH, "Job description too large"),
    questionType: z.enum(['behavioral', 'technical', 'mixed']).optional().default('mixed'),
});

export const CoverLetterRequestSchema = z.object({
    resumeText: z.string().min(1, "Resume text is required").max(MAX_RESUME_LENGTH, "Resume text too large"),
    jobDescription: z.string().min(1, "Job description is required").max(MAX_JOB_LENGTH, "Job description too large"),
    companyName: z.string().max(MAX_NAME_LENGTH).optional(),
    hiringManager: z.string().max(MAX_NAME_LENGTH).optional(),
});

export const Vision2030RequestSchema = z.object({
    resumeText: z.string().min(1, "Resume text is required").max(MAX_RESUME_LENGTH, "Resume text too large"),
    language: z.enum(["en", "ar"]).optional().default("en"),
    jobDescription: z.string().max(MAX_JOB_LENGTH, "Job description too large").optional(),
});

// ============================================
// Type Exports (inferred from schemas)
// ============================================

export type Resume = z.infer<typeof ResumeSchema>;
export type Basics = z.infer<typeof BasicsSchema>;
export type Work = z.infer<typeof WorkSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Project = z.infer<typeof ProjectSchema>;

export type ParseResumeRequest = z.infer<typeof ParseResumeRequestSchema>;
export type MatchRequest = z.infer<typeof MatchRequestSchema>;
export type OptimizeRequest = z.infer<typeof OptimizeRequestSchema>;

// Gap Analysis Types
export type GapAnalysisItem = z.infer<typeof GapAnalysisItemSchema>;
export type HiddenMatch = z.infer<typeof HiddenMatchSchema>;
export type KeywordStrategy = z.infer<typeof KeywordStrategySchema>;
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate and parse resume data, returning typed result or error
 */
export function validateResume(data: unknown): { success: true; data: Resume } | { success: false; error: string } {
    const result = ResumeSchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const errors = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return { success: false, error: errors };
}

/**
 * Format Zod errors into a user-friendly string
 */
export function formatZodError(error: z.ZodError): string {
    return error.issues
        .map(e => `${e.path.length > 0 ? e.path.join('.') + ': ' : ''}${e.message}`)
        .join('; ');
}

// ============================================
// Feedback System Schemas (Best Practice 2026)
// ============================================

// Session context schema for analytics
export const SessionContextSchema = z.object({
    last_feature_used: z.enum(['match', 'optimize', 'vision2030', 'interview', 'cover-letter']).nullable(),
    feature_sequence: z.array(z.enum(['match', 'optimize', 'vision2030', 'interview', 'cover-letter'])),
    session_duration_seconds: z.number(),
    total_lifetime_uses: z.number(),
    current_milestone: z.number().nullable(),
    user_segment: z.enum(['new_user', 'casual_user', 'regular_user', 'power_user']),
}).optional();

export const SubmitFeedbackRequestSchema = z.object({
    emoji_rating: z.enum(['love', 'happy', 'neutral', 'sad', 'terrible'], {
        errorMap: () => ({ message: 'Invalid emoji rating' }),
    }),
    testimonial_text: z.string().max(500, 'Testimonial must be 500 characters or less').optional()
        .transform(val => val?.trim() || undefined),
    context: z.union([
        SessionContextSchema,
        z.string().max(200).transform(val => val?.trim() || undefined), // Legacy support
    ]).optional(),
});

export type SubmitFeedbackRequest = z.infer<typeof SubmitFeedbackRequestSchema>;
