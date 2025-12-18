// 🛡️ Base ATS Engine - The core logic for all exportable templates
// Uses strict JSON Resume schema + props for styling.

interface BaseATSTemplateConfig {
    fontFamily?: string;
    accentColor?: string;
    headerAlignment?: 'left' | 'center';
    vision2030Score?: number;
}

interface BaseATSTemplateProps {
    data: Record<string, any> | null;
    config?: BaseATSTemplateConfig;
}

export const BaseATSTemplate = ({ data, config = {} }: BaseATSTemplateProps) => {
    if (!data) return null;

    // Config Defaults
    const {
        fontFamily = "Arial, Helvetica, sans-serif",
        accentColor = "#000000",
        headerAlignment = "center",
        vision2030Score = 0,
        // hideIcons option reserved for future use
    } = config;

    // Data Extraction - Support both JSON Resume (basics) and legacy (header) formats
    // Legacy format has: header.name, header.email, etc., summary as string
    // JSON Resume has: basics.name, basics.email, etc., basics.summary
    const basics = data.basics || {};
    const legacyHeader = data.header || {};

    // Merge basics with legacy header for backwards compatibility
    const mergedBasics = {
        name: basics.name || legacyHeader.name || '',
        label: basics.label || legacyHeader.title || '',
        email: basics.email || legacyHeader.email || '',
        phone: basics.phone || legacyHeader.phone || '',
        location: basics.location || (legacyHeader.location ? { address: legacyHeader.location } : {}),
        summary: basics.summary || data.summary || '',
        profiles: basics.profiles || (legacyHeader.linkedin ? [{ network: 'LinkedIn', url: legacyHeader.linkedin }] : [])
    };

    const work = data.work || data.experience || [];
    const education = data.education || [];
    const skills = data.skills || [];
    const projects = data.projects || [];

    const styles = {
        container: {
            backgroundColor: '#ffffff',
            color: '#000000',
            padding: '40px 50px',
            maxWidth: '210mm',
            margin: '0 auto',
            minHeight: '297mm',
            fontFamily: fontFamily,
            fontSize: '10.5pt',
            lineHeight: '1.4',
        },
        header: {
            textAlign: headerAlignment,
            marginBottom: '20px',
            borderBottom: headerAlignment === 'left' ? `2px solid ${accentColor}` : 'none',
            paddingBottom: headerAlignment === 'left' ? '10px' : '0',
        },
        name: {
            fontSize: '24pt',
            fontWeight: 'bold' as const,
            textTransform: 'uppercase' as const,
            marginBottom: '8px',
            letterSpacing: '0.5px',
            color: accentColor !== '#000000' ? accentColor : '#000000',
        },
        title: {
            fontSize: '11pt',
            fontWeight: 'bold' as const,
            marginBottom: '6px',
            color: '#000000',
        },
        contact: {
            fontSize: '10pt',
            color: '#000000',
            display: 'flex' as const,
            flexWrap: 'wrap' as const,
            justifyContent: headerAlignment === 'left' ? 'flex-start' : 'center',
            gap: '8px 16px',
        },
        section: {
            marginTop: '18px',
            marginBottom: '10px',
        },
        sectionHeader: {
            fontSize: '12pt',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            borderBottom: `1px solid ${accentColor}`,
            paddingBottom: '2px',
            marginBottom: '12px',
            letterSpacing: '0.5px',
            color: accentColor,
        },
        jobBlock: {
            marginBottom: '12px',
        },
        jobHeader: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '2px',
        },
        bullets: {
            marginTop: '4px',
            paddingLeft: '18px',
            listStyleType: 'disc',
        },
        bulletItem: {
            marginBottom: '3px',
        },
        vision2030Badge: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#006C35',
            color: '#ffffff',
            fontSize: '8pt',
            fontWeight: 'bold',
            padding: '2px 8px',
            borderRadius: '10px',
            marginTop: '6px',
        },
    };

    // Helper for safe strings
    const safeStr = (str) => typeof str === 'string' ? str : '';

    // Header Processing - use mergedBasics for backwards compatibility
    const contactParts = [
        mergedBasics.location?.address || mergedBasics.location?.city || "",
        mergedBasics.email,
        mergedBasics.phone,
        mergedBasics.profiles?.find(p => p.network?.toLowerCase() === 'linkedin')?.url,
        mergedBasics.profiles?.find(p => p.network?.toLowerCase() === 'github')?.url
    ].filter(Boolean);

    return (
        <div id="ats-resume-print-target" style={styles.container}>
            <header style={styles.header}>
                <div style={styles.name}>{safeStr(mergedBasics.name)}</div>
                {mergedBasics.label && <div style={styles.title}>{mergedBasics.label}</div>}
                <div style={styles.contact}>
                    {contactParts.map((part, i) => (
                        <span key={i}>
                            {part}
                            {i < contactParts.length - 1 && (headerAlignment === 'center' ? " | " : " • ")}
                        </span>
                    ))}
                </div>
                {/* Vision 2030 Badge - shown when score >= 60 */}
                {vision2030Score >= 60 && (
                    <div style={styles.vision2030Badge}>
                        <span>✓</span>
                        <span>Vision 2030 Ready</span>
                    </div>
                )}
            </header>

            {/* SUMMARY */}
            {mergedBasics.summary && (
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>PROFESSIONAL SUMMARY</div>
                    <p>{mergedBasics.summary}</p>
                </div>
            )}

            {/* SKILLS - Moved up for Modern/Tech layouts usually, but keeping standard ATS flow? 
          Actually ATS usually likes Skills near top or bottom. We'll stick to Standard Flow: 
          Summary -> Experience -> Projects -> Education -> Skills 
          OR Summary -> Skills -> Experience... 
          Let's stick to the Classic flow (Summary -> Experience -> Education -> Skills) for consistency unless configured?
          For reliability, I'll stick to the proven ATSClassic order.
      */}

            {/* EXPERIENCE */}
            {work.length > 0 && (
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>WORK EXPERIENCE</div>
                    {work.map((job, i) => (
                        <div key={i} style={styles.jobBlock}>
                            <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '11pt' }}>
                                {safeStr(job.position || job.title)}
                            </div>
                            <div style={styles.jobHeader}>
                                <span style={{ fontSize: '10.5pt', fontStyle: 'italic' }}>
                                    {safeStr(job.name || job.company)}{job.location ? `, ${job.location}` : ''}
                                </span>
                                <span style={{ fontWeight: 'bold', fontSize: '10.5pt' }}>
                                    {job.startDate || job.date?.split('-')[0]}
                                    {(job.endDate || job.date?.split('-')[1]) ? ` - ${job.endDate || job.date?.split('-')[1]}` : ''}
                                </span>
                            </div>
                            {(job.highlights || (Array.isArray(job.description) ? job.description : [])).length > 0 && (
                                <ul style={styles.bullets}>
                                    {(job.highlights || job.description).map((highlight, j) => (
                                        <li key={j} style={styles.bulletItem}>{highlight}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* PROJECTS (Added for Technical/Modern relevance) */}
            {projects.length > 0 && (
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>projects</div>
                    {projects.map((project, i) => (
                        <div key={i} style={styles.jobBlock}>
                            <div style={styles.jobHeader}>
                                <span style={{ fontWeight: 'bold' }}>{safeStr(project.name)}</span>
                                {(project.startDate || project.date) && (
                                    <span style={{ fontWeight: 'bold' }}>
                                        {project.startDate || project.date}
                                        {project.endDate ? ` - ${project.endDate}` : ''}
                                    </span>
                                )}
                            </div>
                            {project.description && <p style={{ marginBottom: '4px' }}>{project.description}</p>}
                            {project.highlights && (
                                <ul style={styles.bullets}>
                                    {project.highlights.map((h, j) => (
                                        <li key={j} style={styles.bulletItem}>{h}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* EDUCATION */}
            {education.length > 0 && (
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>EDUCATION</div>
                    {education.map((edu, i) => {
                        // Support both JSON Resume (institution, studyType, area) and legacy (school, degree) formats
                        const institutionName = safeStr(edu.institution || edu.school);
                        const degreeType = edu.degree || edu.studyType || '';
                        const fieldOfStudy = edu.area || '';

                        return (
                            <div key={i} style={styles.jobBlock}>
                                <div style={{ fontWeight: 'bold' }}>{institutionName}</div>
                                <div style={styles.jobHeader}>
                                    <span>{degreeType} {fieldOfStudy ? `in ${fieldOfStudy}` : ''}</span>
                                    <span style={{ fontWeight: 'bold' }}>
                                        {edu.startDate || edu.year} {edu.endDate ? `- ${edu.endDate}` : ''}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* SKILLS */}
            {skills.length > 0 && (
                <div style={styles.section}>
                    <div style={styles.sectionHeader}>SKILLS</div>
                    <ul style={styles.bullets}>
                        {skills.map((skillGroup, i) => {
                            // Handle string skills (flat array)
                            if (typeof skillGroup === 'string') {
                                return <li key={i} style={styles.bulletItem}>{skillGroup}</li>;
                            }
                            // Handle skill objects with keywords
                            if (skillGroup.keywords && Array.isArray(skillGroup.keywords)) {
                                // If category is generic "Skills" or empty, just show keywords inline
                                const categoryName = skillGroup.name?.toLowerCase();
                                if (!categoryName || categoryName === 'skills' || categoryName === 'recommended skills') {
                                    // Render each keyword as separate bullet or inline
                                    return skillGroup.keywords.map((kw, j) => (
                                        <li key={`${i}-${j}`} style={styles.bulletItem}>{kw}</li>
                                    ));
                                }
                                // Otherwise show category: keywords
                                return (
                                    <li key={i} style={styles.bulletItem}>
                                        <strong>{skillGroup.name}: </strong>
                                        {skillGroup.keywords.join(", ")}
                                    </li>
                                );
                            }
                            // Fallback for other formats
                            return <li key={i} style={styles.bulletItem}>{skillGroup.name || JSON.stringify(skillGroup)}</li>;
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};




