// src/components/templates/pdf/ModernProfessionalPDF.tsx
// Modern Professional PDF Template - Premium minimalist design
// Clean single-column layout with generous whitespace

import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
} from "@react-pdf/renderer";

import {
    registerPDFFonts,
    safeText,
    areSimilar,
    PDF_SPACING,
    type PDFTemplateProps,
    type Basics,
    type WorkEntry,
    type EducationEntry,
    type SkillGroup,
    type Project,
    type Certificate,
    type Language,
} from "./shared";

// Register fonts
registerPDFFonts();

// Premium Minimalist Styles
const styles = StyleSheet.create({
    page: {
        padding: `${PDF_SPACING.page.paddingVertical} ${PDF_SPACING.page.paddingHorizontal}`,
        fontFamily: "Inter",
        fontSize: 9.5,
        lineHeight: 1.5,
        color: "#1a1a1a",
    },

    // Header
    header: {
        marginBottom: PDF_SPACING.header.marginBottom,
        paddingBottom: PDF_SPACING.header.paddingBottom,
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
        marginBottom: PDF_SPACING.section.marginBottom,
    },
    sectionTitle: {
        fontSize: 8,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 1,
        color: "#a3a3a3",
        marginBottom: PDF_SPACING.section.titleMarginBottom,
    },

    // Summary
    summary: {
        fontSize: 10,
        lineHeight: 1.65,
        color: "#404040",
    },

    // Experience entries
    entryBlock: {
        marginBottom: PDF_SPACING.entry.marginBottom,
    },
    entryHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 2,
        width: "100%",
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
        marginBottom: PDF_SPACING.bullet.marginBottom,
        paddingLeft: 8,
    },
    bullet: {
        width: 14,
        fontSize: 9.5,
        color: "#a3a3a3",
        marginRight: 2,
    },
    bulletText: {
        flex: 1,
        fontSize: 9.5,
        lineHeight: 1.55,
        color: "#404040",
        textAlign: "left",
    },

    // Skills
    skillKeywords: {
        flex: 1,
        fontSize: 9,
        color: "#525252",
        lineHeight: 1.7,
        textAlign: "left",
    },

    // Links
    link: {
        color: "#737373",
        textDecoration: "none",
    },
});

// Header Section
const HeaderSection = ({ basics }: { basics: Basics }) => {
    // Get profile links - prevent duplicates
    const linkedInUrl = basics?.profiles?.find(p => p.network?.toLowerCase() === 'linkedin')?.url;
    const portfolioUrl = basics?.url || basics?.profiles?.find(p => p.network?.toLowerCase() === 'portfolio' || p.network?.toLowerCase() === 'website')?.url;

    const contactItems = [
        basics?.location?.city || basics?.location?.address,
        basics?.email,
        basics?.phone,
    ].filter(Boolean);

    const linkItems = [
        linkedInUrl?.replace('https://', '').replace('www.', ''),
        portfolioUrl?.replace('https://', '').replace('www.', ''),
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
            {linkItems.length > 0 && (
                <View style={[styles.contactRow, { marginTop: 4 }]}>
                    {linkItems.map((link, i) => (
                        <Text key={i} style={[styles.contactItem, { fontSize: 8.5, color: '#737373' }]}>
                            {link}{i < linkItems.length - 1 && "  ·  "}
                        </Text>
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
        <View style={styles.section} wrap={false}>
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
                <View key={idx} style={styles.entryBlock} wrap={false}>
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
                <View key={idx} style={styles.entryBlock} wrap={false}>
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

    // Flatten all skills into a single array of strings
    const allSkills: string[] = [];
    skills.forEach(skillItem => {
        if (typeof skillItem === 'string') {
            allSkills.push(skillItem);
        } else if (skillItem.keywords && skillItem.keywords.length > 0) {
            allSkills.push(...skillItem.keywords);
        } else if (skillItem.name) {
            allSkills.push(skillItem.name);
        }
    });

    if (allSkills.length === 0) return null;

    return (
        <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>SKILLS</Text>
            <Text style={[styles.skillKeywords, { lineHeight: 1.6 }]}>
                {allSkills.join('  •  ')}
            </Text>
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
                    <View key={idx} style={styles.entryBlock} wrap={false}>
                        <View style={styles.entryHeader}>
                            <Text style={styles.entryTitle}>{projectName}</Text>
                            {project.startDate && (
                                <Text style={styles.entryDate}>
                                    {safeText(project.startDate)}{project.endDate ? ` — ${project.endDate}` : ''}
                                </Text>
                            )}
                        </View>
                        {shouldShowDesc && (
                            <Text style={[styles.entrySubtitle, { color: '#525252' }]}>{rawDesc}</Text>
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
        <View style={styles.section} wrap={false}>
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
        <View style={styles.section} wrap={false}>
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
export default function ModernProfessionalPDF({ userData }: PDFTemplateProps) {
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
