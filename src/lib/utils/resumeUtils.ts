/**
 * Resume Utilities - JSON Resume Schema Only
 *
 * This module handles merging resume data with AI optimizations.
 * All data is expected to be in JSON Resume format (https://jsonresume.org/schema).
 */

import { fuzzyTextMatch } from './textMatcher';
import type { ResumeSchema } from '@/types/resume';

/**
 * Deduplicates an array of objects by their name property.
 * Used to prevent duplicate projects/work entries.
 */
export const deduplicateByName = <T extends { name?: string }>(arr: T[]): T[] => {
    if (!Array.isArray(arr)) return [];
    const seen = new Set<string>();
    return arr.filter(item => {
        const key = item.name?.toLowerCase().trim();
        if (!key) return true; // Keep items without names
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

/**
 * Merges Original User Data with AI Optimizations.
 * Expects JSON Resume format input.
 * 
 * @param {Object} original - The original resume data object (JSON Resume format with basics, work, etc.)
 * @param {Object} aiResult - The AI optimization result object containing optimization and candidateProfile
 * @returns {Object} - A new resume object with merged data ready for templates
 */
export const mergeResumeData = (original, aiResult) => {
    // Handle null/undefined original
    if (!original) {
        console.warn('[mergeResumeData] No original data provided');
        return null;
    }

    // Handle case where original doesn't have basics - create minimal structure
    if (!original.basics) {
        console.warn('[mergeResumeData] Missing basics, using original data as-is');
        // Return original with minimal basics structure
        return {
            ...original,
            basics: original.basics || { name: '', label: '', summary: '' },
            work: original.work || [],
            education: original.education || [],
            skills: original.skills || [],
            projects: original.projects || [],
            languages: original.languages || [],
        };
    }

    // Deep clone - data is always JSON Resume format now
    const mergedData = structuredClone(original);

    // If no AI result, return the data as-is
    if (!aiResult || !aiResult.optimization) {
        return mergedData;
    }

    const { optimization, candidateProfile } = aiResult;

    // Apply AI optimizations to JSON Resume structure

    // 1. Update basics with AI suggestions
    if (mergedData.basics) {
        mergedData.basics = {
            ...mergedData.basics,
            name: candidateProfile?.name || mergedData.basics.name,
            label: optimization.suggested_headline || mergedData.basics.label,
            email: candidateProfile?.email || mergedData.basics.email,
            summary: optimization.summary_rewrite || mergedData.basics.summary
        };
    }

    // 2. Apply bullet point improvements to work highlights
    if (mergedData.work && optimization.bullet_point_improvements) {
        mergedData.work = mergedData.work.map((job, jobIndex) => {
            const jobImprovements = optimization.bullet_point_improvements.filter(imp =>
                imp.work_index === jobIndex ||
                (imp.company && job.name &&
                    (imp.company.toLowerCase().includes(job.name.toLowerCase()) ||
                        job.name.toLowerCase().includes(imp.company.toLowerCase())))
            );

            if (jobImprovements.length === 0) return job;

            let newHighlights = Array.isArray(job.highlights)
                ? [...job.highlights]
                : [];

            jobImprovements.forEach(imp => {
                if (!imp.improved) return;

                const matchIndex = newHighlights.findIndex(h => {
                    if (!imp.original) return false;
                    const result = fuzzyTextMatch(imp.original, h);
                    return result.matched;
                });

                if (matchIndex !== -1) {
                    newHighlights[matchIndex] = imp.improved;
                } else if (!newHighlights.some(h => h.includes(imp.improved))) {
                    newHighlights.unshift(`✨ ${imp.improved}`);
                }
            });

            return { ...job, highlights: newHighlights };
        });
    }

    // 3. Skills recommendations (NOT auto-injected)
    // POLICY: Skills are recommended only, not auto-injected
    // Users must manually add skills they actually possess
    // Skills recommendations are displayed in UI via optimization.skills_gap_analysis
    // No automatic injection happens here

    // 4. Apply education improvements
    if (mergedData.education && optimization.education_improvements) {
        mergedData.education = mergedData.education.map((edu, eduIndex) => {
            const improvement = optimization.education_improvements.find(imp =>
                imp.education_index === eduIndex ||
                (imp.institution && edu.institution?.toLowerCase().includes(imp.institution.toLowerCase()))
            );

            if (!improvement) return edu;

            // Merge all available improvement fields
            return {
                ...edu,
                area: improvement.improved_area || improvement.improved || edu.area,
                studyType: improvement.improved_studyType || edu.studyType,
                // Add highlights if AI provided them
                highlights: improvement.highlights || edu.highlights || [],
                // Add courses if AI provided them
                courses: improvement.courses || edu.courses || [],
                // Preserve score
                score: improvement.score || edu.score,
            };
        });
    }

    // 5. Apply project improvements
    if (mergedData.projects && optimization.projects_improvements) {
        mergedData.projects = mergedData.projects.map((project, projIndex) => {
            const improvement = optimization.projects_improvements.find(imp =>
                imp.project_index === projIndex ||
                (imp.project_name && project.name?.toLowerCase().includes(imp.project_name.toLowerCase()))
            );
            if (improvement?.improved) {
                return {
                    ...project,
                    description: improvement.improved,
                    highlights: project.highlights || []
                };
            }
            return project;
        });
    }

    return mergedData;
};

/**
 * Formats a ResumeSchema into a flat plain text string.
 * This simulates what pdf.js or an ATS would extract from a PDF,
 * allowing the Match Analysis AI to evaluate a realistic text string
 * rather than perfectly structured JSON.
 */
export const formatResumeToText = (resume: ResumeSchema | null): string => {
    if (!resume) return '';
    const parts: string[] = [];
    const add = (...values: Array<string | undefined>) => values.forEach(value => {
        if (value?.trim()) parts.push(value.trim());
    });
    const bullets = (values?: string[]) => values?.forEach(value => add(`• ${value}`));
    const dates = (start?: string, end?: string) => add([start, end].filter(Boolean).join(' - '));
    const section = (name: string, items: unknown[] | undefined) => { if (items?.length) add(`\n${name}`); };

    const basics = resume.basics;
    add(basics.name, basics.label, basics.summary, basics.email, basics.phone, basics.url);
    add([basics.location?.address, basics.location?.city, basics.location?.region,
        basics.location?.postalCode, basics.location?.countryCode].filter(Boolean).join(', '));
    basics.profiles?.forEach(profile => add([profile.network, profile.username, profile.url].filter(Boolean).join(' | ')));

    section('SKILLS', resume.skills);
    resume.skills?.forEach(skill => add([skill.name, skill.level, ...(skill.keywords ?? [])].filter(Boolean).join(', ')));
    section('EXPERIENCE', resume.work);
    resume.work?.forEach(work => {
        add([work.position, work.name].filter(Boolean).join(' at '), work.location, work.url);
        dates(work.startDate, work.endDate);
        add(work.description, work.summary);
        bullets(work.highlights);
    });
    section('EDUCATION', resume.education);
    resume.education?.forEach(education => {
        add([education.studyType, education.area].filter(Boolean).join(' in '), education.institution,
            education.url, education.score);
        dates(education.startDate, education.endDate);
        bullets(education.courses);
        bullets(education.highlights);
    });
    section('PROJECTS', resume.projects);
    resume.projects?.forEach(project => {
        add(project.name, project.description, project.entity, project.type, project.url);
        dates(project.startDate, project.endDate);
        bullets(project.roles);
        bullets(project.keywords);
        bullets(project.highlights);
    });
    section('CERTIFICATIONS', resume.certificates);
    resume.certificates?.forEach(certificate => add(certificate.name, certificate.issuer,
        certificate.date, certificate.url));
    section('AWARDS', resume.awards);
    resume.awards?.forEach(award => add(award.title, award.awarder, award.date, award.summary));
    section('PUBLICATIONS', resume.publications);
    resume.publications?.forEach(publication => add(publication.name, publication.publisher,
        publication.releaseDate, publication.url, publication.summary));
    section('LANGUAGES', resume.languages);
    resume.languages?.forEach(language => add([language.language, language.fluency].filter(Boolean).join(' - ')));
    section('VOLUNTEER', resume.volunteer);
    resume.volunteer?.forEach(volunteer => {
        add([volunteer.position, volunteer.organization].filter(Boolean).join(' at '), volunteer.url,
            volunteer.summary);
        dates(volunteer.startDate, volunteer.endDate);
        bullets(volunteer.highlights);
    });
    section('INTERESTS', resume.interests);
    resume.interests?.forEach(interest => add([interest.name, ...(interest.keywords ?? [])].filter(Boolean).join(', ')));
    section('REFERENCES', resume.references);
    resume.references?.forEach(reference => add(reference.name, reference.reference));
    return parts.join('\n');
};
