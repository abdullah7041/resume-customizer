// src/components/templates/ResumePDFDocument.tsx
// PDF-ready resume document using @react-pdf/renderer
// Premium Minimalist Design - Matches BaseATSTemplate.tsx exactly

import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font,
    Link,
} from "@react-pdf/renderer";

// Register Inter font family with all variants needed
Font.register({
    family: "Inter",
    fonts: [
        {
            src: "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.8/files/inter-latin-400-normal.woff",
            fontWeight: 400,
        },
        {
            src: "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.8/files/inter-latin-500-normal.woff",
            fontWeight: 500,
        },
        {
            src: "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.8/files/inter-latin-600-normal.woff",
            fontWeight: 600,
        },
        {
            src: "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.8/files/inter-latin-700-normal.woff",
            fontWeight: 700,
        },
    ],
});

// Register Noto Sans Arabic for Arabic text support
Font.register({
    family: "Noto Sans Arabic",
    fonts: [
        {
            src: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-arabic@5.0.8/files/noto-sans-arabic-arabic-400-normal.woff",
            fontWeight: 400,
        },
        {
            src: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-arabic@5.0.8/files/noto-sans-arabic-arabic-700-normal.woff",
            fontWeight: 700,
        },
    ],
});

// Disable hyphenation
Font.registerHyphenationCallback(word => [word]);

// Premium Minimalist Styles - Matching BaseATSTemplate.tsx
const styles = StyleSheet.create({
    page: {
        padding: "56 52",
        fontFamily: "Inter",
        fontSize: 9.5,
        lineHeight: 1.5,
        color: "#1a1a1a",
    },

    // Header
    header: {
        marginBottom: 32,
        paddingBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: "#e5e5e5",
    },
    name: {
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: -1,
        marginBottom: 6,
        color: "#0a0a0a",
    },
    headline: {
        fontSize: 11,
        fontWeight: 400,
        color: "#525252",
        marginBottom: 12,
    },
    contactRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        fontSize: 9,
        color: "#737373",
    },
    contactItem: {
        fontSize: 9,
        color: "#737373",
    },

    // Sections
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 8,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 1,
        color: "#a3a3a3",
        marginBottom: 14,
    },

    // Summary
    summary: {
        fontSize: 10,
        lineHeight: 1.65,
        color: "#404040",
    },

    // Experience entries
    entryBlock: {
        marginBottom: 18,
    },
    entryHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 2,
    },
    entryTitle: {
        fontSize: 10.5,
        fontWeight: 600,
        color: "#171717",
    },
    entryDate: {
        fontSize: 9,
        fontWeight: 500,
        color: "#737373",
    },
    entrySubtitle: {
        fontSize: 9.5,
        color: "#525252",
        marginBottom: 6,
    },

    // Bullet points
    bulletList: {
        marginTop: 4,
    },
    bulletItem: {
        flexDirection: "row",
        marginBottom: 4,
        paddingLeft: 0,
    },
    bullet: {
        width: 12,
        fontSize: 9.5,
        color: "#a3a3a3",
    },
    bulletText: {
        flex: 1,
        fontSize: 9.5,
        lineHeight: 1.55,
        color: "#404040",
    },

    // Skills
    skillCategory: {
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "flex-start",
        gap: 4,
        marginBottom: 6,
    },
    skillLabel: {
        fontSize: 9,
        fontWeight: 600,
        color: "#525252",
        width: 100,
    },
    skillKeywords: {
        flex: 1,
        fontSize: 9,
        color: "#525252",
    },

    // Links
    link: {
        color: "#737373",
        textDecoration: "none",
    },

    // Arabic
    arabicText: {
        fontFamily: "Noto Sans Arabic",
        textAlign: "right",
    },
    arabicPage: {
        padding: "56 52",
        fontFamily: "Noto Sans Arabic",
        fontSize: 9.5,
        lineHeight: 1.5,
        color: "#1a1a1a",
    },
});

// Safe text renderer
const safeText = (value: unknown, fallback = ""): string => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        return String(obj.name || obj.title || obj.institution || fallback);
    }
    return String(value);
};

// Ensure URLs have proper protocol
const safeUrl = (url: unknown): string => {
    if (!url || typeof url !== 'string') return '#';
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('mailto:')) {
        return trimmed;
    }
    if (trimmed.includes('@') && !trimmed.includes('/')) {
        return `mailto:${trimmed}`;
    }
    return `https://${trimmed}`;
};

// Helper: check if two texts are similar
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
    return matches.length / Math.min(words1.length, words2.length) > 0.6;
};

// Type definitions
interface Profile {
    network?: string;
    url?: string;
    username?: string;
}

interface Location {
    city?: string;
    region?: string;
    address?: string;
}

interface Basics {
    name?: string;
    label?: string;
    email?: string;
    phone?: string;
    url?: string;
    summary?: string;
    location?: Location;
    profiles?: Profile[];
}

interface WorkEntry {
    name?: string;
    company?: string;
    position?: string;
    title?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    summary?: string;
    highlights?: string[];
}

interface EducationEntry {
    institution?: string;
    area?: string;
    studyType?: string;
    startDate?: string;
    endDate?: string;
    score?: string;
    courses?: string[];
    highlights?: string[];
}

interface SkillGroup {
    name?: string;
    keywords?: string[];
}

interface Project {
    name?: string;
    description?: string;
    highlights?: string[];
    keywords?: string[];
    startDate?: string;
    endDate?: string;
}

interface Certificate {
    name?: string;
    issuer?: string;
    date?: string;
}

interface Language {
    language?: string;
    fluency?: string;
}

interface ResumeData {
    basics?: Basics;
    work?: WorkEntry[];
    education?: EducationEntry[];
    skills?: (SkillGroup | string)[];
    projects?: Project[];
    certificates?: Certificate[];
    languages?: Language[];
    summary?: string;
}

// Header Section
const HeaderSection = ({ basics }: { basics: Basics }) => {
    const contactItems = [
        basics?.location?.city || basics?.location?.address,
        basics?.email,
        basics?.phone,
        basics?.profiles?.find(p => p.network?.toLowerCase() === 'linkedin')?.url?.replace('https://', ''),
    ].filter(Boolean);

    return (
        <View style={styles.header}>
            <Text style={styles.name}>{safeText(basics?.name, "Your Name")}</Text>
            {basics?.label && <Text style={styles.headline}>{basics.label}</Text>}
            <View style={styles.contactRow}>
                {contactItems.map((item, i) => (
                    <Text key={i} style={styles.contactItem}>
                        {item}{i < contactItems.length - 1 && "  ·  "}
                    </Text>
                ))}
            </View>
            {basics?.url && (
                <View style={[styles.contactRow, { marginTop: 4 }]}>
                    <Link src={safeUrl(basics.url)} style={styles.link}>
                        <Text style={styles.contactItem}>Portfolio</Text>
                    </Link>
                    {basics?.profiles?.map((profile, i) => (
                        <Link key={i} src={safeUrl(profile.url)} style={styles.link}>
                            <Text style={styles.contactItem}>  ·  {profile.network || 'Link'}</Text>
                        </Link>
                    ))}
                </View>
            )}
        </View>
    );
};

// Summary Section
const SummarySection = ({ summary }: { summary?: string }) => {
    if (!summary) return null;
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>ABOUT</Text>
            <Text style={styles.summary}>{safeText(summary)}</Text>
        </View>
    );
};

// Experience Section
const ExperienceSection = ({ work }: { work?: WorkEntry[] }) => {
    if (!work || work.length === 0) return null;

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>EXPERIENCE</Text>
            {work.map((job, idx) => (
                <View key={idx} style={styles.entryBlock}>
                    <View style={styles.entryHeader}>
                        <Text style={styles.entryTitle}>{safeText(job.position || job.title)}</Text>
                        <Text style={styles.entryDate}>
                            {safeText(job.startDate)} — {safeText(job.endDate, "Present")}
                        </Text>
                    </View>
                    <Text style={styles.entrySubtitle}>
                        {safeText(job.name || job.company)}{job.location ? `, ${job.location}` : ''}
                    </Text>
                    {job.highlights && job.highlights.length > 0 && (
                        <View style={styles.bulletList}>
                            {job.highlights.map((highlight, i) => (
                                <View key={i} style={styles.bulletItem}>
                                    <Text style={styles.bullet}>•</Text>
                                    <Text style={styles.bulletText}>{safeText(highlight)}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            ))}
        </View>
    );
};

// Education Section
const EducationSection = ({ education }: { education?: EducationEntry[] }) => {
    if (!education || education.length === 0) return null;

    const formatDateRange = (startDate?: string, endDate?: string): string => {
        const start = safeText(startDate);
        const end = safeText(endDate);
        if (start && end && start === end) return start;
        if (!start && end) return `Completed: ${end}`;
        if (start && !end) return `${start} — Present`;
        if (start && end) return `${start} — ${end}`;
        return '';
    };

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>EDUCATION</Text>
            {education.map((edu, idx) => (
                <View key={idx} style={styles.entryBlock}>
                    <View style={styles.entryHeader}>
                        <Text style={styles.entryTitle}>{safeText(edu.institution)}</Text>
                        <Text style={styles.entryDate}>{formatDateRange(edu.startDate, edu.endDate)}</Text>
                    </View>
                    <Text style={styles.entrySubtitle}>
                        {safeText(edu.studyType)}{edu.area ? ` in ${edu.area}` : ''}
                    </Text>
                    {edu.score && (
                        <Text style={styles.entrySubtitle}>GPA: {safeText(edu.score)}</Text>
                    )}
                    {edu.courses && edu.courses.length > 0 && (
                        <Text style={[styles.entrySubtitle, { marginTop: 4 }]}>
                            Coursework: {edu.courses.join(' · ')}
                        </Text>
                    )}
                    {edu.highlights && edu.highlights.length > 0 && (
                        <View style={styles.bulletList}>
                            {edu.highlights.map((highlight, i) => (
                                <View key={i} style={styles.bulletItem}>
                                    <Text style={styles.bullet}>•</Text>
                                    <Text style={styles.bulletText}>{safeText(highlight)}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            ))}
        </View>
    );
};

// Skills Section
const SkillsSection = ({ skills }: { skills?: (SkillGroup | string)[] }) => {
    if (!skills || skills.length === 0) return null;

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>SKILLS</Text>
            {skills.map((skillGroup, idx) => {
                if (typeof skillGroup === 'string') {
                    return <Text key={idx} style={styles.skillKeywords}>• {skillGroup}</Text>;
                }

                const groupName = skillGroup.name || '';
                const keywords = skillGroup.keywords || [];

                if (keywords.length === 0 && !groupName) return null;
                if (groupName === 'Recommended Skills') return null;

                return (
                    <View key={idx} style={styles.skillCategory}>
                        {groupName && groupName.toLowerCase() !== 'skills' && (
                            <Text style={styles.skillLabel}>{groupName}:</Text>
                        )}
                        <Text style={styles.skillKeywords}>{keywords.join('  ·  ')}</Text>
                    </View>
                );
            })}
        </View>
    );
};

// Projects Section
const ProjectsSection = ({ projects }: { projects?: Project[] }) => {
    if (!projects || projects.length === 0) return null;

    // Action verbs indicating achievement description, not a title
    const actionVerbs = ['led', 'managed', 'developed', 'created', 'built', 'designed',
        'implemented', 'automated', 'increased', 'reduced', 'improved', 'delivered',
        'launched', 'achieved', 'drove', 'spearheaded', 'established', 'executed',
        'coordinated', 'oversaw', 'streamlined', 'pioneered', 'orchestrated'];

    const startsWithActionVerb = (text: string) => {
        const firstWord = text.trim().split(/\s+/)[0]?.toLowerCase() || '';
        return actionVerbs.includes(firstWord);
    };

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>PROJECTS</Text>
            {projects.map((project, idx) => {
                const rawName = safeText(project.name);
                const rawDesc = safeText(project.description);

                const isDescriptionActuallyAchievement = startsWithActionVerb(rawDesc);

                // Determine actual project name
                let projectName = rawName;
                let descriptionAsBullet: string | null = null;

                if (!projectName || projectName.toLowerCase() === 'project') {
                    if (rawDesc && !isDescriptionActuallyAchievement) {
                        const firstSentence = rawDesc.split('.')[0];
                        if (firstSentence.length < 60) {
                            projectName = firstSentence;
                        } else {
                            projectName = `Project ${idx + 1}`;
                        }
                    } else {
                        projectName = `Project ${idx + 1}`;
                        if (rawDesc) {
                            descriptionAsBullet = rawDesc;
                        }
                    }
                }

                const shouldShowDesc = rawDesc &&
                    !isDescriptionActuallyAchievement &&
                    rawDesc !== projectName &&
                    !rawDesc.toLowerCase().startsWith(projectName.toLowerCase().substring(0, 20));

                // Collect all bullet points
                let allHighlights: string[] = [];
                if (descriptionAsBullet) {
                    allHighlights.push(descriptionAsBullet);
                }
                if (project.highlights) {
                    allHighlights = [...allHighlights, ...project.highlights];
                }

                const highlights = allHighlights.filter(h =>
                    !areSimilar(h, shouldShowDesc ? rawDesc : '') && !areSimilar(h, projectName)
                );

                return (
                    <View key={idx} style={styles.entryBlock}>
                        <View style={styles.entryHeader}>
                            <Text style={styles.entryTitle}>{projectName}</Text>
                            {project.startDate && (
                                <Text style={styles.entryDate}>
                                    {safeText(project.startDate)}{project.endDate ? ` — ${project.endDate}` : ''}
                                </Text>
                            )}
                        </View>
                        {shouldShowDesc && (
                            <Text style={[styles.entrySubtitle, { fontStyle: 'italic' }]}>{rawDesc}</Text>
                        )}
                        {highlights.length > 0 && (
                            <View style={styles.bulletList}>
                                {highlights.map((highlight, i) => (
                                    <View key={i} style={styles.bulletItem}>
                                        <Text style={styles.bullet}>•</Text>
                                        <Text style={styles.bulletText}>{safeText(highlight)}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                        {project.keywords && project.keywords.length > 0 && (
                            <Text style={[styles.entrySubtitle, { marginTop: 4, color: '#737373' }]}>
                                Technologies: {project.keywords.join(', ')}
                            </Text>
                        )}
                    </View>
                );
            })}
        </View>
    );
};

// Certifications Section
const CertificationsSection = ({ certificates }: { certificates?: Certificate[] }) => {
    if (!certificates || certificates.length === 0) return null;

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>CERTIFICATIONS</Text>
            {certificates.map((cert, idx) => (
                <View key={idx} style={{ marginBottom: 6 }}>
                    <Text style={styles.entryTitle}>{safeText(cert.name)}</Text>
                    <Text style={styles.entrySubtitle}>
                        {safeText(cert.issuer)}{cert.date ? ` · ${cert.date}` : ''}
                    </Text>
                </View>
            ))}
        </View>
    );
};

// Languages Section
const LanguagesSection = ({ languages }: { languages?: Language[] }) => {
    if (!languages || languages.length === 0) return null;

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>LANGUAGES</Text>
            <Text style={styles.skillKeywords}>
                {languages.map((lang, i) => (
                    `${safeText(lang.language)}${lang.fluency ? ` (${lang.fluency})` : ''}${i < languages.length - 1 ? '  ·  ' : ''}`
                )).join('')}
            </Text>
        </View>
    );
};

// Main PDF Document Component
export default function ResumePDFDocument({ userData }: { userData?: ResumeData }) {
    const basics = userData?.basics || {};

    return (
        <Document>
            <Page size="LETTER" style={styles.page}>
                <HeaderSection basics={basics} />
                <SummarySection summary={basics.summary || userData?.summary} />
                <ExperienceSection work={userData?.work} />
                <ProjectsSection projects={userData?.projects} />
                <EducationSection education={userData?.education} />
                <SkillsSection skills={userData?.skills} />
                <CertificationsSection certificates={userData?.certificates} />
                <LanguagesSection languages={userData?.languages} />
            </Page>
        </Document>
    );
}
