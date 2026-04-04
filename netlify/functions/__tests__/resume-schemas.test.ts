import { describe, it, expect } from 'vitest';
import {
    ResumeSchema,
    OptimizeRequestSchema,
    MatchRequestSchema as _MatchRequestSchema,
    ParseResumeRequestSchema,
    validateResume,
    formatZodError
} from '../../lib/resume-schemas.js';

describe('Resume Schemas', () => {
    describe('ResumeSchema', () => {
        it('validates minimal valid resume', () => {
            const minimal = {
                basics: { name: 'John Doe' }
            };
            const result = ResumeSchema.safeParse(minimal);
            expect(result.success).toBe(true);
        });

        it('applies default values for missing arrays', () => {
            const minimal = { basics: { name: 'John' } };
            const result = ResumeSchema.parse(minimal);

            expect(result.work).toEqual([]);
            expect(result.education).toEqual([]);
            expect(result.skills).toEqual([]);
        });

        it('rejects resume without name', () => {
            const invalid = { basics: { label: 'Developer' } };
            const result = ResumeSchema.safeParse(invalid);
            expect(result.success).toBe(false);
        });

        it('validates complete work entry', () => {
            const resume = {
                basics: { name: 'John' },
                work: [{
                    name: 'Acme Corp',
                    position: 'Engineer',
                    startDate: '2020-01',
                    highlights: ['Led team', 'Built features']
                }]
            };
            const result = ResumeSchema.safeParse(resume);
            expect(result.success).toBe(true);
        });

        it('rejects work entry without company name', () => {
            const resume = {
                basics: { name: 'John' },
                work: [{ position: 'Engineer' }]
            };
            const result = ResumeSchema.safeParse(resume);
            expect(result.success).toBe(false);
        });
    });

    describe('OptimizeRequestSchema', () => {
        it('validates valid request', () => {
            const valid = { resumeText: 'Resume content', jobText: 'Job description' };
            expect(OptimizeRequestSchema.safeParse(valid).success).toBe(true);
        });

        it('rejects empty resumeText', () => {
            const invalid = { resumeText: '', jobText: 'Job' };
            expect(OptimizeRequestSchema.safeParse(invalid).success).toBe(false);
        });

        it('rejects missing jobText', () => {
            const invalid = { resumeText: 'Resume' };
            expect(OptimizeRequestSchema.safeParse(invalid).success).toBe(false);
        });
    });

    describe('ParseResumeRequestSchema', () => {
        it('validates text kind', () => {
            const valid = { kind: 'text', value: 'Resume content' };
            expect(ParseResumeRequestSchema.safeParse(valid).success).toBe(true);
        });

        it('validates file kind with data', () => {
            const valid = { kind: 'file', data: 'base64data', name: 'resume.pdf', mime: 'application/pdf' };
            expect(ParseResumeRequestSchema.safeParse(valid).success).toBe(true);
        });

        it('rejects file kind without data', () => {
            const invalid = { kind: 'file', name: 'resume.pdf' };
            expect(ParseResumeRequestSchema.safeParse(invalid).success).toBe(false);
        });

        it('rejects invalid kind', () => {
            const invalid = { kind: 'invalid' };
            expect(ParseResumeRequestSchema.safeParse(invalid).success).toBe(false);
        });
    });

    describe('validateResume helper', () => {
        it('returns success with typed data for valid input', () => {
            const result = validateResume({ basics: { name: 'Test' } });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.basics?.name).toBe('Test');
            }
        });

        it('returns error string for invalid input', () => {
            const result = validateResume({ basics: {} });
            expect(result.success).toBe(false);
            // Zod returns 'Invalid input: expected string, received undefined' when name is missing
            if (!result.success) {
                expect((result as { success: false; error: string }).error).toContain('basics.name');
            }
        });
    });

    describe('formatZodError', () => {
        it('formats single error', () => {
            const result = OptimizeRequestSchema.safeParse({});
            if (!result.success) {
                const formatted = formatZodError(result.error);
                expect(formatted).toContain('resumeText');
            }
        });

        it('formats multiple errors with semicolons', () => {
            const result = OptimizeRequestSchema.safeParse({});
            if (!result.success) {
                const formatted = formatZodError(result.error);
                expect(formatted).toContain(';');
            }
        });
    });
});
