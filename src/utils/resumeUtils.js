import { deriveResumeSections } from '../services/exportPdf.js';

/**
 * Transforms raw resume data (with plainText) into template-compatible structured format.
 * This bridges the gap between parsed resume data and what templates expect.
 * 
 * @param {Object} resumeData - The raw resume data with plainText property
 * @returns {Object} - Structured data with header, summary, experience, skills, education
 */
export const transformResumeForTemplate = (resumeData) => {
    if (!resumeData?.plainText) {
        return null;
    }

    // Use the existing parser to extract sections
    const sections = deriveResumeSections(resumeData.plainText);

    // Parse contact information from first lines
    const contactLines = sections.contactLines || [];
    const name = contactLines[0] || "Your Name";

    // Try to extract email, phone, location from contact lines
    let email = "", phone = "", location = "", linkedin = "";
    for (const line of contactLines.slice(1)) {
        if (/@/.test(line) && !email) {
            email = line.match(/[\w.+-]+@[\w.-]+/)?.[0] || line;
        } else if (/\+?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}|\+?\d{10,}/.test(line) && !phone) {
            phone = line.match(/[\d+().\s-]+/)?.[0]?.trim() || line;
        } else if (/linkedin/i.test(line) && !linkedin) {
            linkedin = line;
        } else if (!location && line.length < 50) {
            location = line;
        }
    }

    // Transform experience lines into structured job objects
    // This is a heuristic approach - experience lines are typically bullet points
    const experience = sections.experience.length > 0 ? [{
        company: "Company",
        position: "Position",
        date: "",
        description: sections.experience
    }] : [];

    // Transform education lines into structured education objects
    const education = sections.education.map((line, idx) => ({
        institution: line,
        degree: "",
        date: ""
    }));

    return {
        header: {
            name,
            email,
            phone,
            location,
            linkedin,
            title: "" // Will be filled by AI optimization
        },
        summary: sections.summary.join(" "),
        experience,
        skills: sections.skills,
        education,
        projects: sections.projects
    };
};

/**
 * Merges Original User Data with AI Optimizations.
 * Non-destructive: Prepend AI suggestions, keep original data as fallback.
 * 
 * @param {Object} original - The original resume data object (can be raw plainText or structured)
 * @param {Object} aiResult - The AI optimization result object containing optimization and candidateProfile
 * @returns {Object} - A new resume object with merged data ready for templates
 */
export const mergeResumeData = (original, aiResult) => {
    if (!original) return null;

    // First, transform raw resume data to structured format if needed
    let structuredData = original;
    if (original.plainText && !original.header) {
        // This is raw resume data, need to transform it first
        structuredData = transformResumeForTemplate(original);
        if (!structuredData) return null;
    }

    // If no AI result, return the structured data as-is
    if (!aiResult || !aiResult.optimization) {
        return structuredData;
    }

    const { optimization, candidateProfile } = aiResult;

    // Helper to find best match for experience improvements
    const mergeExperience = (originalExperience = [], improvements = []) => {
        if (!improvements || improvements.length === 0) return originalExperience;

        return originalExperience.map(job => {
            // Find improvements for this specific job/company
            const jobImprovements = improvements.filter(imp =>
                (imp.company && job.company && imp.company.toLowerCase().includes(job.company.toLowerCase())) ||
                (job.company && imp.company && job.company.toLowerCase().includes(imp.company.toLowerCase()))
            );

            if (jobImprovements.length === 0) return job;

            // Clone description to avoid mutation
            let newDescription = Array.isArray(job.description)
                ? [...job.description]
                : (job.description ? [job.description] : []);

            // Apply each improvement
            jobImprovements.forEach(imp => {
                if (!imp.improved_bullet) return;

                // 1. Try to find a specific bullet to replace (Smart Match)
                // We assume the AI might eventually provide 'original_bullet' or we fuzzy match
                // For now, if we can't match exactly, we'll PREPEND (as per previous logic) 
                // BUT if we find a very similar string, we replace it.

                const normalize = str => str.toLowerCase().replace(/[^a-z0-9]/g, "");

                const matchIndex = newDescription.findIndex(descLine => {
                    // If AI provided original_bullet use that, else check for similarity
                    if (imp.original_bullet) {
                        return normalize(descLine).includes(normalize(imp.original_bullet));
                    }
                    // Fallback: If the suggestion is a rewrite, maybe it shares words?
                    // Without 'original_bullet', it's risky to replace. 
                    // Directive says: "Smart Match... replace the specific bullet point".
                    // We'll stick to PREPENDING with a clear marker if we can't match, 
                    // OR if the user interface supports it, we assume the AI result structure is robust.
                    return false;
                });

                if (matchIndex !== -1) {
                    // Replace
                    newDescription[matchIndex] = `✨ ${imp.improved_bullet}`;
                } else {
                    // Prepend if no direct match found (Fallback)
                    // Deduplicate if it's already there
                    if (!newDescription.some(d => d.includes(imp.improved_bullet))) {
                        newDescription.unshift(`✨ ${imp.improved_bullet}`);
                    }
                }
            });

            return {
                ...job,
                description: newDescription
            };
        });
    };

    return {
        ...structuredData,

        // 1. Headline: AI Suggestion > Original Title
        header: {
            ...structuredData.header,
            title: optimization.suggested_headline || structuredData.header?.title,
            name: candidateProfile?.name || structuredData.header?.name,
            email: candidateProfile?.email || structuredData.header?.email,
            phone: structuredData.header?.phone,
            location: structuredData.header?.location,
            linkedin: structuredData.header?.linkedin,
        },

        // 2. Summary: AI Rewrite > Original Summary (HARD OVERRIDE)
        summary: optimization.summary_rewrite
            ? optimization.summary_rewrite
            : structuredData.summary,

        // 3. Experience: Smart Merge
        experience: mergeExperience(structuredData.experience, optimization.experience_improvements),

        // 4. Skills: Merge Unique (Original + Missing Keywords from AI)
        skills: [
            ...new Set([
                ...(structuredData.skills || []),
                ...(optimization.skills_gap_analysis?.missing_keywords_to_add || [])
            ])
        ],

        // 5. Education: Keep Original
        education: structuredData.education || [],

        // Pass through projects if they exist
        projects: structuredData.projects || []
    };
};
