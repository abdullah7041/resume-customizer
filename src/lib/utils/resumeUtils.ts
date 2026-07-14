/**
 * Resume Utilities - JSON Resume Schema Only
 *
 * This module handles merging resume data with AI optimizations.
 * All data is expected to be in JSON Resume format (https://jsonresume.org/schema).
 */

import { fuzzyTextMatch } from './textMatcher';

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
export const formatResumeToText = (resume: any): string => {
    if (!resume) return "";
    
    const parts: string[] = [];
    
    if (resume.basics) {
        if (resume.basics.name) parts.push(resume.basics.name);
        
        const contactInfo: string[] = [];
        if (resume.basics.email) contactInfo.push(resume.basics.email);
        if (resume.basics.phone) contactInfo.push(resume.basics.phone);
        if (resume.basics.location?.city) contactInfo.push(`${resume.basics.location.city}${resume.basics.location.region ? `, ${resume.basics.location.region}` : ''}`);
        if (resume.basics.url) contactInfo.push(resume.basics.url);
        if (contactInfo.length > 0) parts.push(contactInfo.join(" | "));
        
        if (resume.basics.label) parts.push(resume.basics.label);
        if (resume.basics.summary) parts.push(resume.basics.summary);
    }
    
    if (resume.skills && resume.skills.length > 0) {
        parts.push("\nSKILLS");
        parts.push(resume.skills.map(s => typeof s === 'string' ? s : s.name).join(", "));
    }
    
    if (resume.work && resume.work.length > 0) {
        parts.push("\nEXPERIENCE");
        resume.work.forEach(w => {
            let header = "";
            if (w.position) header += w.position;
            if (w.company) header += (header ? " at " : "") + w.company;
            if (header) parts.push(header);
            
            let dates = "";
            if (w.startDate) dates += w.startDate;
            if (w.endDate) dates += (dates ? " - " : "") + w.endDate;
            if (dates) parts.push(dates);
            
            if (w.summary) parts.push(w.summary);
            
            if (w.highlights && Array.isArray(w.highlights)) {
                w.highlights.forEach(h => parts.push(`• ${h}`));
            }
        });
    }
    
    if (resume.education && resume.education.length > 0) {
        parts.push("\nEDUCATION");
        resume.education.forEach(e => {
            let header = "";
            if (e.studyType) header += e.studyType;
            if (e.area) header += (header ? " in " : "") + e.area;
            if (header) parts.push(header);
            
            if (e.institution) parts.push(e.institution);
            
            let dates = "";
            if (e.startDate) dates += e.startDate;
            if (e.endDate) dates += (dates ? " - " : "") + e.endDate;
            if (dates) parts.push(dates);
        });
    }
    
    if (resume.projects && resume.projects.length > 0) {
        parts.push("\nPROJECTS");
        resume.projects.forEach(p => {
            if (p.name) parts.push(p.name);
            if (p.description) parts.push(p.description);
            if (p.highlights && Array.isArray(p.highlights)) {
                p.highlights.forEach(h => parts.push(`• ${h}`));
            }
        });
    }
    
    if (resume.certificates && resume.certificates.length > 0) {
        parts.push("\nCERTIFICATIONS");
        resume.certificates.forEach(c => {
            let line = "";
            if (c.name) line += c.name;
            if (c.issuer) line += (line ? " - " : "") + c.issuer;
            if (line) parts.push(line);
        });
    }
    
    return parts.join("\n");
};
