// src/components/templates/pdf/ClassicTraditionalPDF.tsx
// Classic Traditional PDF Template - Formal typography with centered header
// Bold dividers, traditional corporate feel, ATS-compatible

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
    type Language,
    type Certificate,
} from "./shared";

// Register fonts
registerPDFFonts();

// Classic Traditional Styles - Serif-inspired feel with bold dividers
const styles = StyleSheet.create({
    page: {
        padding: `${PDF_SPACING.page.paddingVertical} ${PDF_SPACING.page.paddingHorizontal}`,
        fontFamily: "Inter",
        fontSize: 9.5,
        lineHeight: 1.45,
        color: "#1a1a1a",
    },

    // Header - Centered with prominent name
    header: {
        marginBottom: PDF_SPACING.header.marginBottom,
        paddingBottom: PDF_SPACING.header.paddingBottom,
        borderBottomWidth: 2,
        borderBottomColor: "#1a1a1a",
        textAlign: "center",
    },
    name: {
        fontSize: 22,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 3,
        marginBottom: 6,
        color: "#1a1a1a",
    },
    headline: {
        fontSize: 11,
        fontWeight: 500,
        color: "#525252",
        marginBottom: 8,
    },
    contactRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
        fontSize: 9,
        color: "#525252",
    },
    contactItem: {
        fontSize: 9,
        color: "#525252",
    },

    // Sections
    section: {
        marginBottom: PDF_SPACING.section.marginBottom,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 1.5,
        color: "#1a1a1a",
        marginBottom: PDF_SPACING.section.titleMarginBottom,
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: "#1a1a1a",
    },

    // Summary
    summary: {
        fontSize: 10,
        lineHeight: 1.55,
        color: "#525252",
        textAlign: "justify",
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
        fontWeight: 700,
        color: "#1a1a1a",
    },
    entryDate: {
        fontSize: 9,
        fontWeight: 400,
        color: "#737373",
    },
    entrySubtitle: {
        fontSize: 10,
        fontWeight: 400,
        color: "#525252",
        marginBottom: 4,
    },

    // Bullet points - Dash style
    bulletList: {
        marginTop: 4,
    },
    bulletItem: {
        flexDirection: "row",
        marginBottom: PDF_SPACING.bullet.marginBottom,
        paddingLeft: 4,
    },
    bullet: {
        width: 14,
        fontSize: 9.5,
        color: "#404040",
        marginRight: 4,
    },
    bulletText: {
        flex: 1,
        fontSize: 9.5,
        lineHeight: 1.5,
        color: "#404040",
    },

    // Skills - comma-separated
    skillKeywords: {
        flex: 1,
        fontSize: 9,
        color: "#525252",
        lineHeight: 1.7,
        textAlign: "left",
    },
});

// Header Section
const HeaderSection = ({ basics }: { basics: Basics }) => {
    const contactItems = [
        basics?.email,
        basics?.phone,
        basics?.location?.city,
    ].filter(Boolean);

    // Get profile links
    const linkedInUrl = basics?.profiles?.find((p) => p.network?.toLowerCase() === 'linkedin')?.url;
    const portfolioUrl = basics?.url || basics?.profiles?.find((p) => p.network?.toLowerCase() === 'portfolio' || p.network?.toLowerCase() === 'website')?.url;

    const profileLinks = [
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
                        {item}{i < contactItems.length - 1 && "  |  "}
                    </Text>
                ))}
            </View>
            {profileLinks.length > 0 && (
                <View style={[styles.contactRow, { marginTop: 4 }]}>
                    {profileLinks.map((link, i) => (
                        <Text key={i} style={[styles.contactItem, { fontSize: 8.5, color: '#737373' }]}>
                            {link}{i < profileLinks.length - 1 && "  |  "}
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
            <Text style={styles.sectionTitle}>Professional Summary</Text>
            <Text style={styles.summary}>{safeText(summary)}</Text>
        </View>
    );
};

// Experience Section
const ExperienceSection = ({ work }: { work?: WorkEntry[] }) => {
    if (!work || work.length === 0) return null;

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Experience</Text>
            {work.map((job, idx) => (
                <View key={idx} style={styles.entryBlock} wrap={false}>
                    <View style={styles.entryHeader}>
                        <Text style={styles.entryTitle}>{safeText(job.position || job.title)}</Text>
                        <Text style={styles.entryDate}>
                            {safeText(job.startDate)} – {safeText(job.endDate, "Present")}
                        </Text>
                    </View>
                    <Text style={styles.entrySubtitle}>
                        {safeText(job.name || job.company)}
                    </Text>
                    {job.highlights && job.highlights.length > 0 && (
                        <View style={styles.bulletList}>
                            {job.highlights.map((highlight, i) => (
                                <View key={i} style={styles.bulletItem}>
                                    <Text style={styles.bullet}>–</Text>
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

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            {education.map((edu, idx) => (
                <View key={idx} style={styles.entryBlock} wrap={false}>
                    <View style={styles.entryHeader}>
                        <Text style={styles.entryTitle}>
                            {safeText(edu.studyType)}{edu.area ? ` in ${edu.area}` : ''}
                        </Text>
                        <Text style={styles.entryDate}>
                            {edu.endDate || edu.startDate}
                        </Text>
                    </View>
                    <Text style={styles.entrySubtitle}>{safeText(edu.institution)}</Text>
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
            <Text style={styles.sectionTitle}>Skills & Expertise</Text>
            <Text style={styles.skillKeywords}>
                {allSkills.join(', ')}
            </Text>
        </View>
    );
};

// Projects Section
const ProjectsSection = ({ projects }: { projects?: Project[] }) => {
    if (!projects || projects.length === 0) return null;

    return (
        <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Key Projects</Text>
            {projects.map((project, idx) => {
                const projectName = safeText(project.name) || `Project ${idx + 1}`;
                const description = safeText(project.description);

                // Filter highlights that are too similar to description or name
                const filteredHighlights = (project.highlights || []).filter(h =>
                    !areSimilar(h, description) && !areSimilar(h, projectName)
                );

                return (
                    <View key={idx} style={[styles.entryBlock, { marginBottom: 10 }]} wrap={false}>
                        <Text style={styles.entryTitle}>{projectName}</Text>
                        {description && !areSimilar(description, projectName) && (
                            <Text style={styles.entrySubtitle}>{description}</Text>
                        )}
                        {filteredHighlights.length > 0 && (
                            <View style={styles.bulletList}>
                                {filteredHighlights.map((highlight, i) => (
                                    <View key={i} style={styles.bulletItem}>
                                        <Text style={styles.bullet}>–</Text>
                                        <Text style={styles.bulletText}>{safeText(highlight)}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                );
            })}
        </View>
    );
};

// Certificates Section
const CertificatesSection = ({ certificates }: { certificates?: Certificate[] }) => {
    if (!certificates || certificates.length === 0) return null;

    return (
        <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Certifications</Text>
            {certificates.map((cert, idx) => (
                <View key={idx} style={[styles.entryBlock, { marginBottom: 8 }]} wrap={false}>
                    <View style={styles.entryHeader}>
                        <Text style={styles.entryTitle}>{safeText(cert.name)}</Text>
                        {cert.date && <Text style={styles.entryDate}>{cert.date}</Text>}
                    </View>
                    {cert.issuer && (
                        <Text style={styles.entrySubtitle}>{cert.issuer}</Text>
                    )}
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
            <Text style={styles.sectionTitle}>Languages</Text>
            <Text style={styles.skillKeywords}>
                {languages.map(lang =>
                    `${safeText(lang.language)} (${safeText(lang.fluency)})`
                ).join(', ')}
            </Text>
        </View>
    );
};

// Main PDF Document Component
export default function ClassicTraditionalPDF({ userData }: PDFTemplateProps) {
    const basics = userData?.basics || {};

    return (
        <Document>
            <Page size="LETTER" style={styles.page}>
                <HeaderSection basics={basics} />
                <SummarySection summary={basics.summary || userData?.summary} />
                <ExperienceSection work={userData?.work} />
                <EducationSection education={userData?.education} />
                <SkillsSection skills={userData?.skills} />
                <ProjectsSection projects={userData?.projects} />
                <CertificatesSection certificates={userData?.certificates} />
                <LanguagesSection languages={userData?.languages} />
            </Page>
        </Document>
    );
}

