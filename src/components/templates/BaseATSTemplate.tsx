// 🎨 Premium Minimalist Template - Apple-inspired clean design
// Typography-focused, generous whitespace, subtle hierarchy

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

    const {
        fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        accentColor = "#1a1a1a",
        headerAlignment = "left",
        vision2030Score = 0,
    } = config;

    // Reserved for future theme customization
    void accentColor;
    void headerAlignment;

    // Data extraction - JSON Resume format only
    const basics = data.basics || {};
    const work = data.work || [];
    const education = data.education || [];
    const skills = data.skills || [];
    const projects = data.projects || [];
    const certificates = data.certificates || [];
    const languages = data.languages || [];

    // Require basics.name for proper rendering - show message for empty/legacy data
    if (!basics.name) {
        return <div style={{ padding: '20px', color: '#666' }}>No resume data available</div>;
    }

    // Premium Minimalist Styles
    const styles = {
        container: {
            backgroundColor: '#ffffff',
            color: '#1a1a1a',
            padding: '56px 52px',
            maxWidth: '210mm',
            margin: '0 auto',
            minHeight: '297mm',
            fontFamily,
            fontSize: '9.5pt',
            lineHeight: '1.5',
            letterSpacing: '-0.01em',
        },

        // Header - Clean and bold
        header: {
            marginBottom: '32px',
            paddingBottom: '24px',
            borderBottom: '1px solid #e5e5e5',
        },
        name: {
            fontSize: '28pt',
            fontWeight: '600' as const,
            letterSpacing: '-0.03em',
            marginBottom: '6px',
            color: '#0a0a0a',
        },
        headline: {
            fontSize: '11pt',
            fontWeight: '400' as const,
            color: '#525252',
            marginBottom: '12px',
            letterSpacing: '0.01em',
        },
        contactRow: {
            display: 'flex',
            flexWrap: 'wrap' as const,
            gap: '6px',
            fontSize: '9pt',
            color: '#737373',
        },
        contactDivider: {
            color: '#d4d4d4',
        },

        // Sections
        section: {
            marginBottom: '24px',
        },
        sectionTitle: {
            fontSize: '8pt',
            fontWeight: '600' as const,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.1em',
            color: '#a3a3a3',
            marginBottom: '14px',
        },

        // Summary
        summary: {
            fontSize: '10pt',
            lineHeight: '1.65',
            color: '#404040',
            margin: 0,
        },

        // Experience entries
        entryBlock: {
            marginBottom: '18px',
        },
        entryHeader: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '2px',
        },
        entryTitle: {
            fontSize: '10.5pt',
            fontWeight: '600' as const,
            color: '#171717',
        },
        entryDate: {
            fontSize: '9pt',
            fontWeight: '500' as const,
            color: '#737373',
        },
        entrySubtitle: {
            fontSize: '9.5pt',
            color: '#525252',
            marginBottom: '6px',
        },

        // Bullet points
        bulletList: {
            margin: '0',
            padding: '0',
            listStyleType: 'none' as const,
        },
        bulletItem: {
            position: 'relative' as const,
            paddingLeft: '12px',
            marginBottom: '4px',
            fontSize: '9.5pt',
            lineHeight: '1.55',
            color: '#404040',
        },
        bulletDot: {
            position: 'absolute' as const,
            left: '0',
            top: '8px',
            width: '3px',
            height: '3px',
            backgroundColor: '#a3a3a3',
            borderRadius: '50%',
        },

        // Skills - Compact inline
        skillsContainer: {
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '8px',
        },
        skillCategory: {
            display: 'flex',
            flexWrap: 'wrap' as const,
            alignItems: 'baseline',
            gap: '4px',
        },
        skillLabel: {
            fontSize: '9pt',
            fontWeight: '600' as const,
            color: '#525252',
            minWidth: '120px',
        },
        skillKeywords: {
            fontSize: '9pt',
            color: '#525252',
        },

        // Vision 2030 Badge
        vision2030Badge: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#006C35',
            color: '#ffffff',
            fontSize: '8pt',
            fontWeight: 'bold' as const,
            padding: '2px 8px',
            borderRadius: '10px',
            marginTop: '6px',
        },
    };

    // Helper for safe strings
    const safeStr = (str: unknown) => typeof str === 'string' ? str : '';

    // Helper: check if two texts are essentially the same content
    const areSimilar = (text1: string, text2: string): boolean => {
        if (!text1 || !text2) return false;
        const t1 = text1.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        const t2 = text2.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

        if (t1 === t2) return true;
        if (t1.includes(t2) || t2.includes(t1)) return true;

        const words1 = t1.split(/\s+/).filter(w => w.length > 3);
        const words2 = t2.split(/\s+/).filter(w => w.length > 3);
        if (words1.length === 0 || words2.length === 0) return false;

        const matches = words1.filter(w => words2.includes(w));
        const similarity = matches.length / Math.min(words1.length, words2.length);
        return similarity > 0.6;
    };

    // Contact items
    const contactItems = [
        basics.location?.city || basics.location?.address,
        basics.email,
        basics.phone,
        basics.profiles?.find((p: { network?: string }) => p.network?.toLowerCase() === 'linkedin')?.url?.replace('https://', ''),
    ].filter(Boolean);

    return (
        <div id="ats-resume-print-target" style={styles.container}>
            {/* HEADER */}
            <header style={styles.header}>
                <div style={styles.name}>{safeStr(basics.name)}</div>
                {basics.label && <div style={styles.headline}>{basics.label}</div>}
                <div style={styles.contactRow}>
                    {contactItems.map((item, i) => (
                        <span key={i}>
                            {item}
                            {i < contactItems.length - 1 && <span style={styles.contactDivider}>&nbsp;&nbsp;·&nbsp;&nbsp;</span>}
                        </span>
                    ))}
                </div>
                {/* Vision 2030 Badge */}
                {vision2030Score >= 60 && (
                    <div style={styles.vision2030Badge}>
                        <span>✓</span>
                        <span>Vision 2030 Ready</span>
                    </div>
                )}
            </header>

            {/* SUMMARY */}
            {basics.summary && (
                <section style={styles.section}>
                    <div style={styles.sectionTitle}>About</div>
                    <p style={styles.summary}>{basics.summary}</p>
                </section>
            )}

            {/* EXPERIENCE */}
            {work.length > 0 && (
                <section style={styles.section}>
                    <div style={styles.sectionTitle}>Experience</div>
                    {work.map((job: Record<string, unknown>, i: number) => (
                        <div key={i} style={styles.entryBlock}>
                            <div style={styles.entryHeader}>
                                <span style={styles.entryTitle}>{safeStr(job.position || job.title)}</span>
                                <span style={styles.entryDate}>
                                    {safeStr(job.startDate)}{job.endDate ? ` — ${safeStr(job.endDate)}` : ' — Present'}
                                </span>
                            </div>
                            <div style={styles.entrySubtitle}>
                                {safeStr(job.name || job.company)}{job.location ? `, ${safeStr(job.location)}` : ''}
                            </div>
                            {Array.isArray(job.highlights) && job.highlights.length > 0 && (
                                <ul style={styles.bulletList}>
                                    {job.highlights.map((h: string, j: number) => (
                                        <li key={j} style={styles.bulletItem}>
                                            <span style={styles.bulletDot} />
                                            {h}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </section>
            )}

            {/* PROJECTS */}
            {projects.length > 0 && (
                <section style={styles.section}>
                    <div style={styles.sectionTitle}>Projects</div>
                    {projects.map((project: Record<string, unknown>, i: number) => {
                        const rawName = safeStr(project.name);
                        const rawDesc = safeStr(project.description);

                        // Action verbs that indicate a description/achievement, not a title
                        const actionVerbs = ['led', 'managed', 'developed', 'created', 'built', 'designed',
                            'implemented', 'automated', 'increased', 'reduced', 'improved', 'delivered',
                            'launched', 'achieved', 'drove', 'spearheaded', 'established', 'executed',
                            'coordinated', 'oversaw', 'streamlined', 'pioneered', 'orchestrated'];

                        const startsWithActionVerb = (text: string) => {
                            const firstWord = text.trim().split(/\s+/)[0]?.toLowerCase() || '';
                            return actionVerbs.includes(firstWord);
                        };

                        const isDescriptionActuallyAchievement = startsWithActionVerb(rawDesc);

                        // Determine actual project name
                        let projectName = rawName;
                        let descriptionAsBullet: string | null = null;

                        if (!projectName || projectName.toLowerCase() === 'project') {
                            // Name is generic - try to find a title from description
                            if (rawDesc && !isDescriptionActuallyAchievement) {
                                // Description looks like a title (short, no action verb)
                                const firstSentence = rawDesc.split('.')[0];
                                if (firstSentence.length < 60) {
                                    projectName = firstSentence;
                                } else {
                                    projectName = `Project ${i + 1}`;
                                }
                            } else {
                                // Description is an achievement, use fallback title
                                projectName = `Project ${i + 1}`;
                                // Add the description as a bullet point
                                if (rawDesc) {
                                    descriptionAsBullet = rawDesc;
                                }
                            }
                        }

                        // Determine what to show as description subtitle (italic text below title)
                        const shouldShowDesc = rawDesc &&
                            !isDescriptionActuallyAchievement &&
                            rawDesc !== projectName &&
                            !rawDesc.toLowerCase().startsWith(projectName.toLowerCase().substring(0, 20));

                        // Collect all bullet points
                        let allHighlights: string[] = [];

                        // Add description as bullet if it's an achievement
                        if (descriptionAsBullet) {
                            allHighlights.push(descriptionAsBullet);
                        }

                        // Add regular highlights
                        if (Array.isArray(project.highlights)) {
                            allHighlights = [...allHighlights, ...project.highlights];
                        }

                        // Filter out duplicates
                        const highlights = allHighlights.filter((h: string) =>
                            !areSimilar(h, shouldShowDesc ? rawDesc : '') &&
                            !areSimilar(h, projectName)
                        );

                        return (
                            <div key={i} style={styles.entryBlock}>
                                <div style={styles.entryHeader}>
                                    <span style={styles.entryTitle}>{projectName}</span>
                                    {project.startDate && (
                                        <span style={styles.entryDate}>
                                            {safeStr(project.startDate)}{project.endDate ? ` — ${safeStr(project.endDate)}` : ''}
                                        </span>
                                    )}
                                </div>
                                {shouldShowDesc && (
                                    <div style={{ ...styles.entrySubtitle, fontStyle: 'italic' }}>{rawDesc}</div>
                                )}
                                {highlights.length > 0 && (
                                    <ul style={styles.bulletList}>
                                        {highlights.map((h: string, j: number) => (
                                            <li key={j} style={styles.bulletItem}>
                                                <span style={styles.bulletDot} />
                                                {h}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        );
                    })}
                </section>
            )}

            {/* EDUCATION */}
            {education.length > 0 && (
                <section style={styles.section}>
                    <div style={styles.sectionTitle}>Education</div>
                    {education.map((edu: Record<string, unknown>, i: number) => (
                        <div key={i} style={styles.entryBlock}>
                            <div style={styles.entryHeader}>
                                <span style={styles.entryTitle}>{safeStr(edu.institution)}</span>
                                <span style={styles.entryDate}>
                                    {safeStr(edu.startDate)}{edu.endDate ? ` — ${safeStr(edu.endDate)}` : ''}
                                </span>
                            </div>
                            <div style={styles.entrySubtitle}>
                                {safeStr(edu.studyType)}{edu.area ? ` in ${safeStr(edu.area)}` : ''}
                            </div>
                            {Array.isArray(edu.highlights) && edu.highlights.length > 0 && (
                                <ul style={styles.bulletList}>
                                    {edu.highlights.map((h: string, j: number) => (
                                        <li key={j} style={styles.bulletItem}>
                                            <span style={styles.bulletDot} />
                                            {h}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </section>
            )}

            {/* SKILLS */}
            {skills.length > 0 && (
                <section style={styles.section}>
                    <div style={styles.sectionTitle}>Skills</div>
                    <div style={styles.skillsContainer}>
                        {skills.map((skillGroup: Record<string, unknown>, i: number) => {
                            if (typeof skillGroup === 'string') {
                                return <div key={i} style={styles.skillKeywords}>{skillGroup}</div>;
                            }

                            // Skip AI recommendations
                            const groupName = safeStr(skillGroup.name);
                            if (groupName.toLowerCase() === 'recommended skills') return null;

                            if (Array.isArray(skillGroup.keywords) && skillGroup.keywords.length > 0) {
                                return (
                                    <div key={i} style={styles.skillCategory}>
                                        {groupName && groupName.toLowerCase() !== 'skills' && (
                                            <span style={styles.skillLabel}>{groupName}:</span>
                                        )}
                                        <span style={styles.skillKeywords}>{skillGroup.keywords.join('  ·  ')}</span>
                                    </div>
                                );
                            }
                            return null;
                        })}
                    </div>
                </section>
            )}

            {/* CERTIFICATIONS */}
            {certificates.length > 0 && (
                <section style={styles.section}>
                    <div style={styles.sectionTitle}>Certifications</div>
                    {certificates.map((cert: Record<string, unknown>, i: number) => (
                        <div key={i} style={{ marginBottom: '6px' }}>
                            <span style={{ fontWeight: 600, color: '#171717' }}>{safeStr(cert.name)}</span>
                            {(cert.issuer || cert.date) && (
                                <span style={{ color: '#737373' }}>
                                    {' — '}{safeStr(cert.issuer)}{cert.date ? ` (${safeStr(cert.date)})` : ''}
                                </span>
                            )}
                        </div>
                    ))}
                </section>
            )}

            {/* LANGUAGES */}
            {languages.length > 0 && (
                <section style={styles.section}>
                    <div style={styles.sectionTitle}>Languages</div>
                    <div style={styles.skillKeywords}>
                        {languages.map((lang: Record<string, unknown>, i: number) => (
                            <span key={i}>
                                {safeStr(lang.language)}{lang.fluency ? ` (${safeStr(lang.fluency)})` : ''}
                                {i < languages.length - 1 && '  ·  '}
                            </span>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default BaseATSTemplate;
