/**
 * Shared DOCX section builder functions.
 * Each builder faithfully reproduces the layout from the corresponding
 * React template, including same-line position/date, correct section
 * labels, and template-specific styling.
 */
import type { DocxTemplateConfig, SectionKey } from './templateStyles';
import type { ResumeSchema } from '../../types/resume';
import { splitTextWithKeywords, shouldApplyBolding } from '../../lib/utils/keywordBolder';

// ── Types for the dynamically-imported docx module ──────
export interface DocxModule {
    Document: any;
    Packer: any;
    Paragraph: any;
    TextRun: any;
    ExternalHyperlink: any;
    AlignmentType: any;
    convertInchesToTwip: (inches: number) => number;
    LineRuleType: any;
    HeadingLevel: any;
    BorderStyle: any;
    TabStopType: any;
    TabStopPosition: any;
}

export interface BuilderOptions {
    keywords: string[];
    boldKeywords: boolean;
}

// ── Internal helpers ────────────────────────────────────

function align(a: 'LEFT' | 'CENTER', D: DocxModule) {
    return a === 'CENTER' ? D.AlignmentType.CENTER : D.AlignmentType.LEFT;
}

function ls(cfg: DocxTemplateConfig, D: DocxModule) {
    return { line: cfg.lineSpacing, lineRule: D.LineRuleType.AUTO };
}

function border(style: 'solid' | 'dashed' | 'none', size: number, color: string, D: DocxModule) {
    if (style === 'none') return undefined;
    return {
        bottom: {
            style: style === 'dashed' ? D.BorderStyle.DASHED : D.BorderStyle.SINGLE,
            size,
            color,
        },
    };
}

/** Body font shorthand */
function bf(cfg: DocxTemplateConfig) {
    return { font: cfg.fontFamily, size: cfg.baseFontSize, color: cfg.bodyColor };
}

/** Normalize a URL: pass through http*, prepend https:// for domain-like strings, null for plain text */
function normalizeUrl(url?: string): string | null {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    if (url.includes('.')) return `https://${url}`;
    return null;
}

/**
 * Convert text to TextRun[] with optional keyword bolding.
 */
function textRuns(
    text: string,
    fontCfg: Record<string, any>,
    opts: BuilderOptions,
    D: DocxModule,
) {
    const applyBolding = shouldApplyBolding(opts.keywords, opts.boldKeywords);
    if (!applyBolding) {
        return [new D.TextRun({ text, ...fontCfg })];
    }
    const segments = splitTextWithKeywords(text, opts.keywords, 15);
    return segments.map((seg: { text: string; bold: boolean }) =>
        new D.TextRun({
            text: seg.text,
            ...fontCfg,
            bold: seg.bold || (fontCfg.bold === true),
        }),
    );
}

/**
 * Create a section heading paragraph matching the template style.
 */
function sectionHeading(label: string, cfg: DocxTemplateConfig, D: DocxModule) {
    const text = cfg.headingUppercase ? label.toUpperCase() : label;
    return new D.Paragraph({
        children: [
            new D.TextRun({
                text,
                font: cfg.headingFont,
                size: cfg.headingSize,
                bold: true,
                color: cfg.accentColor,
            }),
        ],
        heading: D.HeadingLevel.HEADING_2,
        alignment: align(cfg.headingAlignment, D),
        spacing: { before: 240, after: 120, ...ls(cfg, D) },
        border: border(cfg.headingBorder, 6, cfg.headingBorderColor, D),
    });
}

/**
 * Create a bullet-point paragraph using manual bullet character + indent.
 * More reliable than docx's built-in `bullet` property which silently fails.
 */
function bulletParagraph(
    runs: any[],
    cfg: DocxTemplateConfig,
    D: DocxModule,
    spacingAfter = 30,
) {
    return new D.Paragraph({
        children: [
            new D.TextRun({
                text: `${cfg.bulletChar}  `,
                font: cfg.fontFamily,
                size: cfg.baseFontSize,
                color: cfg.bodyColor,
            }),
            ...runs,
        ],
        indent: { left: D.convertInchesToTwip(0.25), hanging: D.convertInchesToTwip(0.2) },
        spacing: { after: spacingAfter, ...ls(cfg, D) },
    });
}

/** Right-aligned tab stop at ~6.3" (within A4 with 0.6" margins) */
function rightTab(cfg: DocxTemplateConfig, D: DocxModule) {
    const pageWidth = 8.27; // A4 inches
    const rightMargin = cfg.margins[3];
    const leftMargin = cfg.margins[2];
    return {
        type: D.TabStopType.RIGHT,
        position: D.convertInchesToTwip(pageWidth - leftMargin - rightMargin),
    };
}

// ── Public section builders ─────────────────────────────

export function buildHeader(
    basics: ResumeSchema['basics'],
    cfg: DocxTemplateConfig,
    D: DocxModule,
): any[] {
    const children: any[] = [];
    const al = align(cfg.headerAlignment, D);
    const spacing = ls(cfg, D);

    // Name
    children.push(
        new D.Paragraph({
            children: [
                new D.TextRun({
                    text: basics.name || '',
                    font: cfg.headingFont,
                    size: cfg.nameSize,
                    bold: true,
                    color: cfg.accentColor,
                    allCaps: cfg.nameUppercase,
                    characterSpacing: cfg.nameLetterSpacing ? 80 : undefined,
                }),
            ],
            alignment: al,
            spacing: { after: 40, ...spacing },
        }),
    );

    // Label / Title
    if (basics.label) {
        children.push(
            new D.Paragraph({
                children: [
                    new D.TextRun({
                        text: basics.label,
                        font: cfg.fontFamily,
                        size: cfg.baseFontSize + 3,
                        bold: true,
                        color: cfg.accentColor,
                    }),
                ],
                alignment: al,
                spacing: { after: 60, ...spacing },
            }),
        );
    }

    // Contact line — build as a mix of TextRun and ExternalHyperlink
    const contactChildren: any[] = [];
    const addSep = () => {
        if (contactChildren.length > 0) {
            contactChildren.push(
                new D.TextRun({ text: '  |  ', font: cfg.fontFamily, size: cfg.baseFontSize - 1, color: cfg.contactColor })
            );
        }
    };

    if (basics.phone) {
        addSep();
        contactChildren.push(
            new D.TextRun({ text: basics.phone, font: cfg.fontFamily, size: cfg.baseFontSize - 1, color: cfg.contactColor })
        );
    }
    if (basics.email) {
        addSep();
        contactChildren.push(
            new D.ExternalHyperlink({
                children: [new D.TextRun({ text: basics.email, font: cfg.fontFamily, size: cfg.baseFontSize - 1, color: '2563EB', underline: {} })],
                link: `mailto:${basics.email}`,
            })
        );
    }
    if (basics.location?.city) {
        addSep();
        contactChildren.push(
            new D.TextRun({
                text: [basics.location.city, basics.location.region].filter(Boolean).join(', '),
                font: cfg.fontFamily, size: cfg.baseFontSize - 1, color: cfg.contactColor,
            })
        );
    }

    const resolveProfileUrl = (profile?: { url?: string; username?: string; network?: string }): string | null => {
        if (!profile) return null;
        const fromUrl = normalizeUrl(profile.url);
        if (fromUrl) return fromUrl;

        const id = profile.url || profile.username;
        if (id && !id.includes(' ') && !id.toLowerCase().includes(profile.network?.toLowerCase() || 'none')) {
            const net = profile.network?.toLowerCase();
            if (net === 'linkedin') return `https://linkedin.com/in/${id}`;
            if (net === 'github') return `https://github.com/${id}`;
        }

        const fromUsername = normalizeUrl(profile.username);
        if (fromUsername) return fromUsername;
        return null;
    };

    const linkedIn = basics.profiles?.find((p) => p.network?.toLowerCase() === 'linkedin');
    const linkedInLink = linkedIn ? resolveProfileUrl(linkedIn) : null;
    if (linkedIn) {
        addSep();
        if (linkedInLink) {
            contactChildren.push(
                new D.ExternalHyperlink({
                    children: [new D.TextRun({ text: 'LinkedIn Account', font: cfg.fontFamily, size: cfg.baseFontSize - 1, color: '2563EB', underline: {} })],
                    link: linkedInLink,
                })
            );
        } else {
            contactChildren.push(
                new D.TextRun({ text: linkedIn.url || linkedIn.username || '', font: cfg.fontFamily, size: cfg.baseFontSize - 1, color: cfg.contactColor })
            );
        }
    }

    const portfolioProfile = basics.profiles?.find(
        (p) => p.network?.toLowerCase() === 'portfolio' || p.network?.toLowerCase() === 'website',
    );
    const portfolioLink = normalizeUrl(basics.url) || resolveProfileUrl(portfolioProfile);
    if (portfolioLink || basics.url || portfolioProfile) {
        addSep();
        if (portfolioLink) {
            contactChildren.push(
                new D.ExternalHyperlink({
                    children: [new D.TextRun({ text: 'Portfolio', font: cfg.fontFamily, size: cfg.baseFontSize - 1, color: '2563EB', underline: {} })],
                    link: portfolioLink,
                })
            );
        } else {
            contactChildren.push(
                new D.TextRun({ text: basics.url || portfolioProfile?.url || portfolioProfile?.username || '', font: cfg.fontFamily, size: cfg.baseFontSize - 1, color: cfg.contactColor })
            );
        }
    }

    if (contactChildren.length > 0) {
        children.push(
            new D.Paragraph({
                children: contactChildren,
                alignment: al,
                spacing: { after: 60, ...spacing },
                border: border(cfg.headerBorder, 8, cfg.headerBorderColor, D),
            }),
        );
    }

    // Spacer after header
    children.push(
        new D.Paragraph({ spacing: { after: 120 } }),
    );

    return children;
}

export function buildSummary(
    summary: string | undefined,
    cfg: DocxTemplateConfig,
    D: DocxModule,
    opts: BuilderOptions,
): any[] {
    if (!summary) return [];
    return [
        sectionHeading(cfg.labels.summary, cfg, D),
        new D.Paragraph({
            children: textRuns(summary, {
                ...bf(cfg),
                italics: cfg.summaryItalic,
            }, opts, D),
            spacing: { after: 120, ...ls(cfg, D) },
        }),
    ];
}

export function buildExperience(
    work: ResumeSchema['work'],
    cfg: DocxTemplateConfig,
    D: DocxModule,
    opts: BuilderOptions,
): any[] {
    if (!work || work.length === 0) return [];
    const children: any[] = [sectionHeading(cfg.labels.experience, cfg, D)];
    const spacing = ls(cfg, D);
    const body = bf(cfg);
    const rt = rightTab(cfg, D);

    for (const job of work) {
        // Line 1: Position <TAB> Date (same line, like the HTML flex justify-between)
        children.push(
            new D.Paragraph({
                children: [
                    new D.TextRun({
                        text: job.position || '',
                        ...body,
                        bold: true,
                        underline: cfg.experiencePositionUnderline ? { type: 'single', color: cfg.accentColor } : undefined,
                        color: cfg.experiencePositionUnderline ? cfg.accentColor : body.color,
                    }),
                    new D.TextRun({
                        text: '\t',
                        ...body,
                    }),
                    new D.TextRun({
                        text: `${job.startDate || ''}${cfg.dateSeparator}${job.endDate || 'Present'}`,
                        ...body,
                        italics: true,
                        size: body.size - 1,
                        color: cfg.experiencePositionUnderline ? cfg.accentColor : '6B7280',
                    }),
                ],
                tabStops: [rt],
                spacing: { before: 120, after: 20, ...spacing },
            }),
        );

        // Line 2: Company | Location
        if (job.name) {
            children.push(
                new D.Paragraph({
                    children: [
                        new D.TextRun({
                            text: job.name,
                            ...body,
                            italics: cfg.experienceCompanyItalic,
                            color: cfg.experienceCompanyAccentColor ? cfg.accentColor : body.color,
                        }),
                        ...(job.location
                            ? [new D.TextRun({ text: ` | ${job.location}`, ...body, italics: true })]
                            : []),
                    ],
                    spacing: { after: 40, ...spacing },
                }),
            );
        }

        // Highlights / bullet points
        if (job.highlights) {
            for (const h of job.highlights) {
                children.push(
                    bulletParagraph(textRuns(h, body, opts, D), cfg, D),
                );
            }
        }
    }
    return children;
}

export function buildProjects(
    projects: ResumeSchema['projects'],
    cfg: DocxTemplateConfig,
    D: DocxModule,
    opts: BuilderOptions,
): any[] {
    if (!projects || projects.length === 0) return [];
    const children: any[] = [sectionHeading(cfg.labels.projects, cfg, D)];
    const spacing = ls(cfg, D);
    const body = bf(cfg);

    for (const project of projects) {
        children.push(
            new D.Paragraph({
                children: [
                    new D.TextRun({
                        text: project.name || '',
                        ...body,
                        bold: true,
                        color: cfg.accentColor,
                    }),
                ],
                spacing: { before: 100, after: 30, ...spacing },
            }),
        );
        if (project.description) {
            children.push(
                new D.Paragraph({
                    children: [new D.TextRun({ text: project.description, ...body })],
                    spacing: { after: 30, ...spacing },
                }),
            );
        }
        if (project.highlights) {
            for (const h of project.highlights) {
                children.push(
                    bulletParagraph(textRuns(h, body, opts, D), cfg, D),
                );
            }
        }
    }
    return children;
}

export function buildSkills(
    skills: ResumeSchema['skills'],
    cfg: DocxTemplateConfig,
    D: DocxModule,
): any[] {
    if (!skills || skills.length === 0) return [];

    const children: any[] = [sectionHeading(cfg.labels.skills, cfg, D)];
    const spacing = ls(cfg, D);
    const body = bf(cfg);

    if (cfg.skillsLayout === 'categorized') {
        // Executive style: "Category: keyword1, keyword2"
        for (const skillItem of skills) {
            if (typeof skillItem === 'string') {
                children.push(
                    new D.Paragraph({
                        children: [new D.TextRun({ text: skillItem, ...body })],
                        spacing: { after: 30, ...spacing },
                    }),
                );
            } else {
                const keywords = skillItem.keywords || [skillItem.name];
                children.push(
                    new D.Paragraph({
                        children: [
                            new D.TextRun({
                                text: `${skillItem.name}: `,
                                ...body,
                                bold: true,
                                color: cfg.accentColor,
                            }),
                            new D.TextRun({ text: keywords.join(', '), ...body }),
                        ],
                        spacing: { after: 30, ...spacing },
                    }),
                );
            }
        }
    } else if (cfg.skillsLayout === 'comma') {
        // ATS / Classic: all skills on one line
        const allSkills = skills.flatMap((s) =>
            typeof s === 'string' ? [s] : (s.keywords || [s.name]).filter(Boolean),
        );
        // ATS uses bullet separator, Classic uses comma
        const separator = cfg.bulletChar === '•' ? ' • ' : ', ';
        children.push(
            new D.Paragraph({
                children: [new D.TextRun({ text: allSkills.join(separator), ...body })],
                spacing: { after: 100, ...spacing },
            }),
        );
    } else {
        // Tags style (Modern / Technical): skills separated by mid-dots
        const allSkills = skills.flatMap((s) =>
            typeof s === 'string' ? [s] : (s.keywords || [s.name]).filter(Boolean),
        );
        children.push(
            new D.Paragraph({
                children: allSkills.map(
                    (skill, i) =>
                        new D.TextRun({
                            text: i < allSkills.length - 1 ? `${skill}  ·  ` : skill,
                            ...body,
                        }),
                ),
                spacing: { after: 100, ...spacing },
            }),
        );
    }

    return children;
}

export function buildEducation(
    education: ResumeSchema['education'],
    cfg: DocxTemplateConfig,
    D: DocxModule,
): any[] {
    if (!education || education.length === 0) return [];
    const children: any[] = [sectionHeading(cfg.labels.education, cfg, D)];
    const spacing = ls(cfg, D);
    const body = bf(cfg);
    const rt = rightTab(cfg, D);

    for (const edu of education) {
        const degreeText = `${edu.studyType || ''}${edu.area ? ` in ${edu.area}` : ''}`;
        const dateText = edu.endDate || edu.startDate || '';

        // Line 1: Degree <TAB> Date (same line)
        children.push(
            new D.Paragraph({
                children: [
                    new D.TextRun({ text: degreeText, ...body, bold: true }),
                    ...(dateText ? [
                        new D.TextRun({ text: '\t', ...body }),
                        new D.TextRun({ text: dateText, ...body, italics: true, size: body.size - 1, color: '6B7280' }),
                    ] : []),
                ],
                tabStops: [rt],
                spacing: { before: 80, after: 20, ...spacing },
            }),
        );

        // Line 2: Institution
        if (edu.institution) {
            children.push(
                new D.Paragraph({
                    children: [new D.TextRun({ text: edu.institution, ...body, italics: true })],
                    spacing: { after: 20, ...spacing },
                }),
            );
        }

        // GPA
        if (edu.score) {
            children.push(
                new D.Paragraph({
                    children: [
                        new D.TextRun({ text: `GPA: ${edu.score}`, ...body, size: body.size - 1, color: '6B7280' }),
                    ],
                    spacing: { after: 20, ...spacing },
                }),
            );
        }

        // Coursework
        if (edu.courses && edu.courses.length > 0) {
            children.push(
                new D.Paragraph({
                    children: [
                        new D.TextRun({
                            text: `Relevant Coursework: ${edu.courses.join(' · ')}`,
                            ...body,
                            size: body.size - 1,
                            italics: true,
                            color: '6B7280',
                        }),
                    ],
                    spacing: { after: 20, ...spacing },
                }),
            );
        }

        // Highlights
        if (edu.highlights) {
            for (const h of edu.highlights) {
                children.push(
                    bulletParagraph([new D.TextRun({ text: h, ...body })], cfg, D),
                );
            }
        }
    }
    return children;
}

export function buildCertificates(
    certificates: ResumeSchema['certificates'],
    cfg: DocxTemplateConfig,
    D: DocxModule,
): any[] {
    if (!certificates || certificates.length === 0) return [];
    const children: any[] = [sectionHeading(cfg.labels.certificates, cfg, D)];
    const spacing = ls(cfg, D);
    const body = bf(cfg);
    const rt = rightTab(cfg, D);

    for (const cert of certificates) {
        // Name + Issuer <TAB> Date (same line)
        children.push(
            new D.Paragraph({
                children: [
                    new D.TextRun({ text: cert.name || '', ...body, bold: true }),
                    ...(cert.issuer
                        ? [new D.TextRun({ text: ` | ${cert.issuer}`, ...body })]
                        : []),
                    ...(cert.date
                        ? [
                            new D.TextRun({ text: '\t', ...body }),
                            new D.TextRun({ text: cert.date, ...body, italics: true, size: body.size - 1, color: '6B7280' }),
                        ]
                        : []),
                ],
                tabStops: [rt],
                spacing: { after: 40, ...spacing },
            }),
        );
    }
    return children;
}

export function buildLanguages(
    languages: ResumeSchema['languages'],
    cfg: DocxTemplateConfig,
    D: DocxModule,
): any[] {
    if (!languages || languages.length === 0) return [];
    const children: any[] = [sectionHeading(cfg.labels.languages, cfg, D)];
    const spacing = ls(cfg, D);
    const body = bf(cfg);

    // Language (Fluency) format, separated by bullets
    const runs: any[] = [];
    languages.forEach((lang, i) => {
        if (i > 0) {
            runs.push(new D.TextRun({ text: '  •  ', ...body, color: '9CA3AF' }));
        }
        runs.push(new D.TextRun({ text: lang.language || '', ...body, bold: true }));
        if (lang.fluency) {
            runs.push(new D.TextRun({ text: `: ${lang.fluency}`, ...body }));
        }
    });

    children.push(
        new D.Paragraph({
            children: runs,
            spacing: { after: 100, ...spacing },
        }),
    );
    return children;
}

// ── Orchestrator ────────────────────────────────────────

const SECTION_BUILDERS: Record<
    SectionKey,
    (resume: ResumeSchema, cfg: DocxTemplateConfig, D: DocxModule, opts: BuilderOptions) => any[]
> = {
    summary: (r, c, D, o) => buildSummary(r.basics?.summary, c, D, o),
    experience: (r, c, D, o) => buildExperience(r.work, c, D, o),
    projects: (r, c, D, o) => buildProjects(r.projects, c, D, o),
    skills: (r, c, D) => buildSkills(r.skills, c, D),
    education: (r, c, D) => buildEducation(r.education, c, D),
    certificates: (r, c, D) => buildCertificates(r.certificates, c, D),
    languages: (r, c, D) => buildLanguages(r.languages, c, D),
};

/**
 * Build all DOCX sections in template-defined order.
 */
export function buildAllSections(
    resume: ResumeSchema,
    cfg: DocxTemplateConfig,
    D: DocxModule,
    opts: BuilderOptions,
): any[] {
    const paragraphs: any[] = [];

    // Header is always first
    paragraphs.push(...buildHeader(resume.basics, cfg, D));

    // Sections in template order
    for (const key of cfg.sectionOrder) {
        const builder = SECTION_BUILDERS[key];
        if (builder) {
            paragraphs.push(...builder(resume, cfg, D, opts));
        }
    }

    return paragraphs;
}
