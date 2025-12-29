/**
 * Resume Utilities - JSON Resume Schema Only
 * 
 * This module handles merging resume data with AI optimizations.
 * All data is expected to be in JSON Resume format (https://jsonresume.org/schema).
 */

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
    const mergedData = JSON.parse(JSON.stringify(original));

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

                const matchIndex = newHighlights.findIndex(h =>
                    imp.original && h.toLowerCase().includes(imp.original.toLowerCase().substring(0, 30))
                );

                if (matchIndex !== -1) {
                    newHighlights[matchIndex] = imp.improved;
                } else if (!newHighlights.some(h => h.includes(imp.improved))) {
                    newHighlights.unshift(`✨ ${imp.improved}`);
                }
            });

            return { ...job, highlights: newHighlights };
        });
    }

    // 3. Add missing keywords to skills
    if (optimization.skills_gap_analysis?.missing_keywords_to_add) {
        const missingKeywords = optimization.skills_gap_analysis.missing_keywords_to_add;
        if (missingKeywords.length > 0) {
            if (!mergedData.skills) mergedData.skills = [];

            const existingKeywords = mergedData.skills.flatMap(s => s.keywords || []);
            const newKeywords = missingKeywords.filter(k =>
                !existingKeywords.some(ek => ek.toLowerCase() === k.toLowerCase())
            );

            if (newKeywords.length > 0) {
                const targetCategory = mergedData.skills.find(s => s.name === "Recommended Skills") ||
                    mergedData.skills[0];
                if (targetCategory) {
                    targetCategory.keywords = [...(targetCategory.keywords || []), ...newKeywords];
                } else {
                    mergedData.skills.push({ name: "Recommended Skills", keywords: newKeywords });
                }
            }
        }
    }

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
