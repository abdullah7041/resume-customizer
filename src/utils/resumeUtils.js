/**
 * Merges original resume data with AI optimizations.
 * 
 * @param {Object} original - The original resume data object
 * @param {Object} aiResult - The AI optimization result object containing summary_rewrite and experience_improvements
 * @returns {Object} - A new resume object with merged data
 */
export const mergeResumeData = (original, aiResult) => {
    if (!original) return null;
    if (!aiResult || !aiResult.optimization) return original;

    const merged = { ...original };
    const { optimization } = aiResult;

    // 1. Overwrite Summary (if available)
    if (optimization.summary_rewrite) {
        merged.summary = optimization.summary_rewrite;
    }

    // 2. Smart Merge Experience (Non-destructive)
    if (original.experience && Array.isArray(original.experience)) {
        merged.experience = original.experience.map((job) => {
            // Find matching improvement for this company
            // We use includes() to handle slight variations in company names
            const improvement = optimization.experience_improvements?.find(
                (imp) => imp.company?.toLowerCase().includes(job.company?.toLowerCase()) ||
                    job.company?.toLowerCase().includes(imp.company?.toLowerCase())
            );

            if (improvement && improvement.improved_bullet) {
                // Ensure description is an array
                const currentDesc = Array.isArray(job.description)
                    ? job.description
                    : (job.description ? [job.description] : []);

                return {
                    ...job,
                    // Prepend the AI bullet with a sparkle icon to highlight it
                    description: [
                        `✨ ${improvement.improved_bullet}`,
                        ...currentDesc
                    ]
                };
            }

            return job;
        });
    }

    return merged;
};
