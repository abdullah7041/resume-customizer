import { deriveResumeSections } from '../../services/exportPdf.js';

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
    const education = sections.education.map((line) => ({
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
 * Preserves full JSON Resume structure and applies AI improvements.
 * 
 * @param {Object} original - The original resume data object (JSON Resume format with basics, work, etc.)
 * @param {Object} aiResult - The AI optimization result object containing optimization and candidateProfile
 * @returns {Object} - A new resume object with merged data ready for templates
 */
export const mergeResumeData = (original, aiResult) => {
    if (!original) return null;

    // Check if the data is already in JSON Resume format (has 'basics')
    const isJsonResume = !!(original.basics || original.work);

    let mergedData;

    if (isJsonResume) {
        // Data is already in JSON Resume format - use it directly
        mergedData = JSON.parse(JSON.stringify(original)); // Deep clone
    } else if (original.plainText && !original.basics) {
        // Legacy format with plainText - transform to JSON Resume
        const structured = transformResumeForTemplate(original);
        if (!structured) return null;

        // Convert legacy format to JSON Resume
        mergedData = {
            basics: {
                name: structured.header?.name || "",
                label: structured.header?.title || "",
                email: structured.header?.email || "",
                phone: structured.header?.phone || "",
                summary: structured.summary || "",
                location: {
                    address: structured.header?.location || ""
                },
                profiles: structured.header?.linkedin ? [{
                    network: "LinkedIn",
                    url: structured.header.linkedin
                }] : []
            },
            work: (structured.experience || []).map(job => ({
                name: job.company,
                position: job.position,
                startDate: job.date?.split("-")[0]?.trim(),
                endDate: job.date?.split("-")[1]?.trim() || "Present",
                highlights: Array.isArray(job.description) ? job.description : [job.description].filter(Boolean)
            })),
            education: (structured.education || []).map(edu => ({
                institution: edu.institution || edu,
                area: edu.degree || "",
                studyType: "",
                startDate: edu.date || "",
                endDate: ""
            })),
            skills: (structured.skills || []).map(skill =>
                typeof skill === 'string'
                    ? { name: "Skills", keywords: [skill] }
                    : skill
            ),
            projects: structured.projects || [],
            plainText: original.plainText
        };
    } else {
        // Unknown format, return as-is
        return original;
    }

    // If no AI result, return the data as-is
    if (!aiResult || !aiResult.optimization) {
        // Still add backward compatibility fields
        return addLegacyFields(mergedData);
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
                imp.education_index === eduIndex
            );
            if (improvement?.improved) {
                return { ...edu, area: improvement.improved };
            }
            return edu;
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

    return addLegacyFields(mergedData);
};

/**
 * Adds backward compatibility fields for legacy components
 */
function addLegacyFields(data) {
    if (!data) return data;

    data.header = {
        name: data.basics?.name,
        title: data.basics?.label,
        email: data.basics?.email,
        phone: data.basics?.phone,
        location: data.basics?.location?.address || data.basics?.location?.city,
        linkedin: data.basics?.profiles?.find(p => p.network?.toLowerCase() === 'linkedin')?.url
    };
    data.summary = data.basics?.summary;
    data.experience = (data.work || []).map(job => ({
        company: job.name,
        position: job.position,
        date: `${job.startDate || ""} - ${job.endDate || ""}`.trim(),
        description: job.highlights || []
    }));

    return data;
}



