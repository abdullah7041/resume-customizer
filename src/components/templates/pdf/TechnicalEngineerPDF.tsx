// src/components/templates/pdf/TechnicalEngineerPDF.tsx
// Technical Engineer PDF Template - Skills-first layout with technical emphasis
// Monospace-inspired styling, compact bullets, prominent skills section

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

// Technical Engineer Styles - Skills-first, compact, tech-focused
const styles = StyleSheet.create({
    page: {
        padding: `${PDF_SPACING.page.paddingVertical} ${PDF_SPACING.page.paddingHorizontal}`,
        fontFamily: "Inter",
        fontSize: 9,
        lineHeight: 1.5,
        color: "#1a1a1a",
    },

    // Header
    header: {
        marginBottom: PDF_SPACING.header.marginBottom,
        paddingBottom: PDF_SPACING.header.paddingBottom,
        borderBottomWidth: 2,
        borderBottomStyle: "dashed",
        borderBottomColor: "#d1d5db",
    },
    name: {
        fontSize: 20,
        fontWeight: 700,
        marginBottom: 4,
        color: "#1a1a1a",
    },
    headline: {
        fontSize: 10,
        fontWeight: 400,
        color: "#6b7280",
        marginBottom: 8,
    },
    contactRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        fontSize: 8.5,
        color: "#6b7280",
    },
    contactItem: {
        fontSize: 8.5,
        color: "#6b7280",
    },

    // Skills Section - Prominent box
    skillsBox: {
        marginBottom: PDF_SPACING.section.marginBottom,
        padding: 12,
        backgroundColor: "#f9fafb",
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 4,
    },
    skillsTitle: {
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 1,
        color: "#374151",
        marginBottom: 8,
    },
    skillsContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },
    skillTag: {
        fontSize: 9,
        color: "#374151",
        paddingVertical: 3,
        paddingHorizontal: 8,
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#d1d5db",
        borderRadius: 2,
    },

    // Sections
    section: {
        marginBottom: PDF_SPACING.section.marginBottom,
    },
    sectionTitle: {
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 1,
        color: "#374151",
        marginBottom: PDF_SPACING.section.titleMarginBottom,
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomStyle: "dashed",
        borderBottomColor: "#e5e7eb",
    },

    // Summary
    summary: {
        fontSize: 9,
        lineHeight: 1.55,
        color: "#4b5563",
    },

    // Experience entries
    entryBlock: {
        marginBottom: PDF_SPACING.entry.marginBottom,
    },
    entryHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 2,
    },
    entryTitle: {
        fontSize: 10,
        fontWeight: 600,
        color: "#1f2937",
    },
    entryDate: {
        fontSize: 8.5,
        color: "#6b7280",
    },
    entrySubtitle: {
        fontSize: 9,
        color: "#6b7280",
        marginBottom: 4,
    },

    // Bullet points - compact disc style
    bulletList: {
        marginTop: 3,
        paddingLeft: 12,
    },
    bulletItem: {
        flexDirection: "row",
        marginBottom: PDF_SPACING.bullet.marginBottom,
    },
    bullet: {
        width: 8,
        fontSize: 8.5,
        color: "#9ca3af",
    },
    bulletText: {
        flex: 1,
        fontSize: 8.5,
        lineHeight: 1.45,
        color: "#4b5563",
    },

    // Languages - inline with bold labels
    languageRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
    },
    languageItem: {
        fontSize: 9,
        color: "#4b5563",
    },
    languageLabel: {
        fontWeight: 600,
    },
});

// Header Section
const HeaderSection = ({ basics }: { basics: Basics }) => {
    const contactItems = [
        basics?.email,
        basics?.phone,
        basics?.location?.city,
        ...(basics?.profiles?.map(p =>
            p.url?.replace('https://', '').replace('www.', '') || p.username
        ) || []),
    ].filter(Boolean);

    return (
        <View style={styles.header}>
            <Text style={styles.name}>{safeText(basics?.name, "Your Name")}</Text>
            {basics?.label && <Text style={styles.headline}>{basics.label}</Text>}
            <View style={styles.contactRow}>
                {contactItems.map((item, i) => (
                    <Text key={i} style={styles.contactItem}>{item}</Text>
                ))}
            </View>
        </View>
    );
};

// Skills Section - Prominent placement FIRST
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
        <View style={styles.skillsBox}>
            <Text style={styles.skillsTitle}>Technical Skills</Text>
            <View style={styles.skillsContainer}>
                {allSkills.map((skill, i) => (
                    <Text key={i} style={styles.skillTag}>{skill}</Text>
                ))}
            </View>
        </View>
    );
};

// Summary Section
const SummarySection = ({ summary }: { summary?: string }) => {
    if (!summary) return null;
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.summary}>{safeText(summary)}</Text>
        </View>
    );
};

// Experience Section
const ExperienceSection = ({ work }: { work?: WorkEntry[] }) => {
    if (!work || work.length === 0) return null;

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
            {work.map((job, idx) => (
                <View key={idx} style={styles.entryBlock}>
                    <View style={styles.entryHeader}>
                        <Text style={styles.entryTitle}>{safeText(job.position || job.title)}</Text>
                        <Text style={styles.entryDate}>
                            {safeText(job.startDate)} → {safeText(job.endDate, "Present")}
                        </Text>
                    </View>
                    <Text style={styles.entrySubtitle}>
                        {safeText(job.name || job.company)}
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

// Projects Section - Tech-focused with description
const ProjectsSection = ({ projects }: { projects?: Project[] }) => {
    if (!projects || projects.length === 0) return null;

    return (
        <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Projects</Text>
            {projects.map((project, idx) => {
                const projectName = safeText(project.name) || `Project ${idx + 1}`;
                const description = safeText(project.description);

                // Filter highlights similar to description or name
                const filteredHighlights = (project.highlights || []).filter(h =>
                    !areSimilar(h, description) && !areSimilar(h, projectName)
                );

                return (
                    <View key={idx} style={[styles.entryBlock, { marginBottom: 10 }]} wrap={false}>
                        <Text style={styles.entryTitle}>{projectName}</Text>
                        {description && !areSimilar(description, projectName) && (
                            <Text style={[styles.entrySubtitle, { marginBottom: 2 }]}>
                                {description}
                            </Text>
                        )}
                        {filteredHighlights.length > 0 && (
                            <View style={styles.bulletList}>
                                {filteredHighlights.map((highlight, i) => (
                                    <View key={i} style={styles.bulletItem}>
                                        <Text style={styles.bullet}>•</Text>
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

// Education Section
const EducationSection = ({ education }: { education?: EducationEntry[] }) => {
    if (!education || education.length === 0) return null;

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            {education.map((edu, idx) => (
                <View key={idx} style={styles.entryBlock}>
                    <View style={styles.entryHeader}>
                        <Text style={styles.entryTitle}>{safeText(edu.institution)}</Text>
                        <Text style={styles.entryDate}>
                            {edu.endDate || edu.startDate}
                        </Text>
                    </View>
                    <Text style={styles.entrySubtitle}>
                        {safeText(edu.studyType)}{edu.area ? ` — ${edu.area}` : ''}
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
            <Text style={styles.sectionTitle}>Languages</Text>
            <View style={styles.languageRow}>
                {languages.map((lang, i) => (
                    <Text key={i} style={styles.languageItem}>
                        <Text style={styles.languageLabel}>{safeText(lang.language)}</Text>: {safeText(lang.fluency)}
                    </Text>
                ))}
            </View>
        </View>
    );
};

// Certificates Section
const CertificatesSection = ({ certificates }: { certificates?: Certificate[] }) => {
    if (!certificates || certificates.length === 0) return null;

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Certifications</Text>
            {certificates.map((cert, idx) => (
                <View key={idx} style={styles.entryBlock}>
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

// Main PDF Document Component
export default function TechnicalEngineerPDF({ userData }: PDFTemplateProps) {
    const basics = userData?.basics || {};

    return (
        <Document>
            <Page size="LETTER" style={styles.page}>
                <HeaderSection basics={basics} />
                {/* Skills FIRST - Technical emphasis */}
                <SkillsSection skills={userData?.skills} />
                <SummarySection summary={basics.summary || userData?.summary} />
                <ExperienceSection work={userData?.work} />
                <ProjectsSection projects={userData?.projects} />
                <EducationSection education={userData?.education} />
                <CertificatesSection certificates={userData?.certificates} />
                <LanguagesSection languages={userData?.languages} />
            </Page>
        </Document>
    );
}
