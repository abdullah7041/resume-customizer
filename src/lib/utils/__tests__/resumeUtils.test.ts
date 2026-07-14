import { describe, it, expect } from 'vitest';
import { mergeResumeData, deduplicateByName } from '../resumeUtils';

describe('resumeUtils', () => {
    describe('deduplicateByName', () => {
        it('removes exact duplicates', () => {
            const input = [
                { name: 'Project A' },
                { name: 'Project A' },
                { name: 'Project B' }
            ];
            expect(deduplicateByName(input)).toHaveLength(2);
        });

        it('handles case-insensitive duplicates', () => {
            const input = [
                { name: 'Project A' },
                { name: 'PROJECT A' },
                { name: 'project a' }
            ];
            expect(deduplicateByName(input)).toHaveLength(1);
        });

        it('keeps items without names', () => {
            const input = [
                { name: 'Named' },
                { description: 'No name' },
                { description: 'Also no name' }
            ];
            expect(deduplicateByName(input)).toHaveLength(3);
        });

        it('handles empty array', () => {
            expect(deduplicateByName([])).toEqual([]);
        });

        it('handles non-array input', () => {
            expect(deduplicateByName(null as any)).toEqual([]);
            expect(deduplicateByName(undefined as any)).toEqual([]);
        });
    });

    describe('mergeResumeData', () => {
        const baseResume = {
            basics: {
                name: 'John Doe',
                label: 'Developer',
                email: 'john@example.com',
                summary: 'Original summary'
            },
            work: [{
                name: 'Acme Corp',
                position: 'Engineer',
                highlights: ['Did work', 'Built things']
            }],
            education: [{
                institution: 'MIT',
                area: 'Computer Science'
            }],
            skills: [{ name: 'Technical', keywords: ['Python', 'JavaScript'] }],
            projects: []
        };

        it('returns null for null input', () => {
            expect(mergeResumeData(null, {})).toBeNull();
        });

        it('returns original data when no AI result', () => {
            const result = mergeResumeData(baseResume, null);
            expect(result.basics.name).toBe('John Doe');
        });

        it('returns original when optimization is empty', () => {
            const result = mergeResumeData(baseResume, { optimization: {} });
            expect(result.basics.summary).toBe('Original summary');
        });

        describe('headline optimization', () => {
            it('applies suggested_headline', () => {
                const aiResult = {
                    optimization: {
                        suggested_headline: 'Senior Software Engineer'
                    }
                };
                const result = mergeResumeData(baseResume, aiResult);
                expect(result.basics.label).toBe('Senior Software Engineer');
            });

            it('preserves original headline when no suggestion', () => {
                const aiResult = { optimization: {} };
                const result = mergeResumeData(baseResume, aiResult);
                expect(result.basics.label).toBe('Developer');
            });
        });

        describe('summary optimization', () => {
            it('applies summary_rewrite', () => {
                const aiResult = {
                    optimization: {
                        summary_rewrite: 'Optimized professional summary with impact'
                    }
                };
                const result = mergeResumeData(baseResume, aiResult);
                expect(result.basics.summary).toBe('Optimized professional summary with impact');
            });
        });

        describe('bullet point improvements', () => {
            it('replaces matching bullets by content match', () => {
                const aiResult = {
                    optimization: {
                        bullet_point_improvements: [{
                            original: 'Did work',
                            improved: 'Led cross-functional team to deliver 5 projects',
                            company: 'Acme'
                        }]
                    }
                };
                const result = mergeResumeData(baseResume, aiResult);
                expect(result.work[0].highlights).toContain('Led cross-functional team to deliver 5 projects');
            });

            it('adds new bullets when no match found', () => {
                const aiResult = {
                    optimization: {
                        bullet_point_improvements: [{
                            improved: 'New achievement not in original',
                            company: 'Acme'
                        }]
                    }
                };
                const result = mergeResumeData(baseResume, aiResult);
                expect(result.work[0].highlights.some(h => h.includes('New achievement'))).toBe(true);
            });

            it('matches improvements by work_index', () => {
                const aiResult = {
                    optimization: {
                        bullet_point_improvements: [{
                            work_index: 0,
                            improved: 'Index-matched improvement'
                        }]
                    }
                };
                const result = mergeResumeData(baseResume, aiResult);
                expect(result.work[0].highlights.some(h => h.includes('Index-matched'))).toBe(true);
            });
        });

        describe('skills gap analysis', () => {
            it('does NOT auto-inject missing keywords (recommend only policy)', () => {
                const aiResult = {
                    optimization: {
                        skills_gap_analysis: {
                            missing_keywords_to_add: ['React', 'TypeScript', 'AWS']
                        }
                    }
                };
                const result = mergeResumeData(baseResume, aiResult);
                const allKeywords = result.skills.flatMap(s => s.keywords);
                // Skills should NOT be auto-added - users must add them manually
                expect(allKeywords).not.toContain('React');
                expect(allKeywords).not.toContain('TypeScript');
                expect(allKeywords).not.toContain('AWS');
            });

            it('does NOT create Recommended Skills category', () => {
                const emptySkillsResume = { ...baseResume, skills: [] };
                const aiResult = {
                    optimization: {
                        skills_gap_analysis: {
                            missing_keywords_to_add: ['NewSkill']
                        }
                    }
                };
                const result = mergeResumeData(emptySkillsResume, aiResult);
                // Should not auto-create skills categories
                expect(result.skills.find(s => s.name === 'Recommended Skills')).toBeUndefined();
            });
        });

        describe('education improvements', () => {
            it('applies education improvements by institution match', () => {
                const aiResult = {
                    optimization: {
                        education_improvements: [{
                            institution: 'MIT',
                            improved_area: 'Computer Science with AI Specialization'
                        }]
                    }
                };
                const result = mergeResumeData(baseResume, aiResult);
                expect(result.education[0].area).toBe('Computer Science with AI Specialization');
            });

            it('applies improvements by education_index', () => {
                const aiResult = {
                    optimization: {
                        education_improvements: [{
                            education_index: 0,
                            improved: 'Improved education description'
                        }]
                    }
                };
                const result = mergeResumeData(baseResume, aiResult);
                expect(result.education[0].area).toBe('Improved education description');
            });
        });

        describe('project improvements', () => {
            const resumeWithProjects = {
                ...baseResume,
                projects: [{ name: 'Portfolio App', description: 'Built a portfolio' }]
            };

            it('applies project improvements by name match', () => {
                const aiResult = {
                    optimization: {
                        projects_improvements: [{
                            project_name: 'Portfolio',
                            improved: 'Built a full-stack portfolio using React and Node.js'
                        }]
                    }
                };
                const result = mergeResumeData(resumeWithProjects, aiResult);
                expect(result.projects[0].description).toContain('full-stack');
            });
        });

        describe('data immutability', () => {
            it('does not mutate original data', () => {
                const original = structuredClone(baseResume);
                const aiResult = {
                    optimization: { suggested_headline: 'New Title' }
                };
                mergeResumeData(baseResume, aiResult);
                expect(baseResume.basics.label).toBe(original.basics.label);
            });
        });
    });
});
