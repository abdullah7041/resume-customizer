// src/components/templates/ResumePDFDocument.jsx
// PDF-ready resume document using @react-pdf/renderer

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
// Using jsDelivr CDN which serves raw font files compatible with @react-pdf/renderer
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

// Disable hyphenation (can cause issues)
Font.registerHyphenationCallback(word => [word]);

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: "Inter",
        fontSize: 10,
        lineHeight: 1.5,
        color: "#1f2937",
    },
    header: {
        marginBottom: 20,
        textAlign: "center",
    },
    name: {
        fontSize: 24,
        fontWeight: 700,
        color: "#111827",
        marginBottom: 4,
    },
    title: {
        fontSize: 12,
        color: "#059669",
        fontWeight: 600,
        marginBottom: 8,
    },
    contactRow: {
        flexDirection: "row",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 4,
    },
    contactItem: {
        fontSize: 9,
        color: "#4b5563",
    },
    section: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 700,
        color: "#111827",
        borderBottomWidth: 1,
        borderBottomColor: "#059669",
        paddingBottom: 4,
        marginBottom: 8,
    },
    paragraph: {
        fontSize: 10,
        color: "#374151",
        lineHeight: 1.5,
    },
    experienceItem: {
        marginBottom: 12,
    },
    experienceHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    jobTitle: {
        fontSize: 11,
        fontWeight: 600,
        color: "#111827",
    },
    company: {
        fontSize: 10,
        color: "#059669",
    },
    dateRange: {
        fontSize: 9,
        color: "#6b7280",
    },
    bulletList: {
        marginLeft: 12,
        marginTop: 4,
    },
    bulletItem: {
        flexDirection: "row",
        marginBottom: 3,
    },
    bullet: {
        width: 8,
        fontSize: 10,
        color: "#059669",
    },
    bulletText: {
        flex: 1,
        fontSize: 9,
        color: "#374151",
    },
    skillsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },
    skillTag: {
        backgroundColor: "#d1fae5",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        fontSize: 9,
        color: "#047857",
    },
    educationItem: {
        marginBottom: 10,
    },
    degree: {
        fontSize: 11,
        fontWeight: 600,
        color: "#111827",
    },
    institution: {
        fontSize: 10,
        color: "#4b5563",
    },
    link: {
        color: "#059669",
        textDecoration: "none",
    },
    // Arabic text styles
    arabicText: {
        fontFamily: "Noto Sans Arabic",
        textAlign: "right",
        direction: "rtl",
    },
    arabicPage: {
        padding: 40,
        fontFamily: "Noto Sans Arabic",
        fontSize: 10,
        lineHeight: 1.5,
        color: "#1f2937",
        direction: "rtl",
    },
});

// Safe text renderer
const safeText = (value, fallback = "") => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") {
        return value.name || value.title || value.institution || fallback;
    }
    return String(value);
};

// Header Section
const HeaderSection = ({ basics }) => (
    <View style={styles.header}>
        <Text style={styles.name}>{safeText(basics?.name, "Your Name")}</Text>
        {basics?.label && <Text style={styles.title}>{basics.label}</Text>}

        <View style={styles.contactRow}>
            {basics?.email && (
                <Link src={`mailto:${basics.email}`} style={[styles.contactItem, styles.link]}>
                    {basics.email}
                </Link>
            )}
            {basics?.phone && <Text style={styles.contactItem}>{basics.phone}</Text>}
            {basics?.location?.city && (
                <Text style={styles.contactItem}>
                    {basics.location.city}{basics.location.region ? `, ${basics.location.region}` : ""}
                </Text>
            )}
        </View>

        <View style={styles.contactRow}>
            {basics?.url && (
                <Link src={basics.url} style={[styles.contactItem, styles.link]}>
                    Portfolio
                </Link>
            )}
            {basics?.profiles?.map((profile, i) => (
                <Link key={i} src={profile.url || "#"} style={[styles.contactItem, styles.link]}>
                    {profile.network}
                </Link>
            ))}
        </View>
    </View>
);

// Summary Section
const SummarySection = ({ summary }) => {
    if (!summary) return null;
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Summary</Text>
            <Text style={styles.paragraph}>{safeText(summary)}</Text>
        </View>
    );
};

// Experience Section
const ExperienceSection = ({ work }) => {
    if (!work || work.length === 0) return null;

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
            {work.map((job, idx) => (
                <View key={idx} style={styles.experienceItem}>
                    <View style={styles.experienceHeader}>
                        <View>
                            <Text style={styles.jobTitle}>{safeText(job.position || job.title)}</Text>
                            <Text style={styles.company}>{safeText(job.name || job.company)}</Text>
                        </View>
                        <Text style={styles.dateRange}>
                            {safeText(job.startDate)} - {safeText(job.endDate, "Present")}
                        </Text>
                    </View>

                    {job.summary && (
                        <Text style={styles.paragraph}>{safeText(job.summary)}</Text>
                    )}

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
const EducationSection = ({ education }) => {
    if (!education || education.length === 0) return null;

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            {education.map((edu, idx) => (
                <View key={idx} style={styles.educationItem}>
                    <View style={styles.experienceHeader}>
                        <View>
                            <Text style={styles.degree}>
                                {safeText(edu.studyType)} in {safeText(edu.area)}
                            </Text>
                            <Text style={styles.institution}>{safeText(edu.institution)}</Text>
                        </View>
                        <Text style={styles.dateRange}>
                            {safeText(edu.startDate)} - {safeText(edu.endDate, "Present")}
                        </Text>
                    </View>
                    {edu.score && <Text style={styles.paragraph}>GPA: {edu.score}</Text>}
                </View>
            ))}
        </View>
    );
};

// Skills Section
const SkillsSection = ({ skills }) => {
    if (!skills || skills.length === 0) return null;

    // Handle both array of strings and array of objects
    const flatSkills = skills.flatMap(skill => {
        if (typeof skill === "string") return [skill];
        if (skill.keywords) return skill.keywords;
        if (skill.name) return [skill.name];
        return [];
    });

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillsGrid}>
                {flatSkills.map((skill, idx) => (
                    <Text key={idx} style={styles.skillTag}>{safeText(skill)}</Text>
                ))}
            </View>
        </View>
    );
};

// Projects Section
const ProjectsSection = ({ projects }) => {
    if (!projects || projects.length === 0) return null;

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Projects</Text>
            {projects.map((project, idx) => (
                <View key={idx} style={styles.experienceItem}>
                    <Text style={styles.jobTitle}>{safeText(project.name)}</Text>
                    {project.description && (
                        <Text style={styles.paragraph}>{safeText(project.description)}</Text>
                    )}
                    {project.highlights && project.highlights.length > 0 && (
                        <View style={styles.bulletList}>
                            {project.highlights.map((highlight, i) => (
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

// Certifications Section
const CertificationsSection = ({ certificates }) => {
    if (!certificates || certificates.length === 0) return null;

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Certifications</Text>
            {certificates.map((cert, idx) => (
                <View key={idx} style={styles.educationItem}>
                    <Text style={styles.degree}>{safeText(cert.name)}</Text>
                    <Text style={styles.institution}>
                        {safeText(cert.issuer)} • {safeText(cert.date)}
                    </Text>
                </View>
            ))}
        </View>
    );
};

// Main PDF Document Component
export default function ResumePDFDocument({ userData }) {
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
                <CertificationsSection certificates={userData?.certificates} />
            </Page>
        </Document>
    );
}




