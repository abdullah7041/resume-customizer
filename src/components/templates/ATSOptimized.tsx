import type { TemplateProps } from './BaseTemplate';
import { ATSResume, A4_STYLES, safeString, scaledFontSize, safeLang, cleanHighlight, filterEducationHighlights } from './BaseTemplate';
import { useSectionLabel } from '../../hooks/useSectionLabel';
import { normalizeUrl, resolveProfileUrl } from '@/lib/utils/profileUrl';

// Default display options if not provided
const DEFAULT_OPTIONS = {
    baseFontSize: 10.5,
    headingSize: 13,
    nameSize: 20,
    fontFamily: 'Arial, Helvetica, sans-serif',
    sectionSpacing: 8,
    paragraphSpacing: 6,
    lineHeight: 1.4,
    marginTop: 0.5,
    marginBottom: 0.5,
    marginSide: 0.6,
};

// Separator element for contact line
const Sep = () => <span> | </span>;

/**
 * ATS Optimized Template
 * Single-column layout optimized for Applicant Tracking Systems
 * Keyword-rich, clear hierarchy, maximum parseability
 */
export function ATSOptimized({
    resume,
    isAtsMode = false,
    scale = 1,
    fontScale = 1,
    displayOptions,
    contentDirection = 'ltr',
}: TemplateProps) {
    const getSectionLabel = useSectionLabel();

    // Merge displayOptions with defaults
    const opts = { ...DEFAULT_OPTIONS, ...displayOptions };

    // If ATS mode is enabled, use the pure ATS renderer
    if (isAtsMode) {
        return <ATSResume resume={resume} />;
    }

    const { basics, work = [], education = [], skills = [], projects = [], certificates = [], languages = [] } = resume;

    // Flatten skills for display
    const allSkills = skills?.flatMap(s =>
        typeof s === 'string' ? [s] : (s.keywords || [s.name]).filter(Boolean)
    ) || [];

    // Get profile links
    const linkedInProfile = basics?.profiles?.find((p) => p.network?.toLowerCase() === 'linkedin');
    const linkedInUrl = resolveProfileUrl(linkedInProfile);
    const linkedInLabel = (linkedInProfile?.url || linkedInProfile?.username) && !linkedInUrl ? (linkedInProfile?.url || linkedInProfile?.username) : undefined;
    const portfolioProfile = basics?.profiles?.find((p) => p.network?.toLowerCase() === 'portfolio' || p.network?.toLowerCase() === 'website');
    const portfolioUrl = normalizeUrl(basics?.url) || resolveProfileUrl(portfolioProfile);
    const portfolioLabel = !portfolioUrl ? (basics?.url || portfolioProfile?.url || portfolioProfile?.username || undefined) : undefined;

    // Helper for scaled fonts - use displayOptions or legacy fontScale
    const fs = (pt: number) => {
        if (displayOptions?.baseFontSize) {
            const scaleFactor = displayOptions.baseFontSize / 10.5;
            return scaledFontSize(pt, scaleFactor);
        }
        return scaledFontSize(pt, fontScale);
    };
    const nameFontSize = displayOptions
        ? `${opts.nameSize ?? 20}pt`
        : scaledFontSize(opts.nameSize ?? 20, fontScale);

    // Dynamic margins based on displayOptions
    const marginPadding = `${opts.marginTop * 25.4}mm ${opts.marginSide * 25.4}mm`;

    // Computed styles based on displayOptions
    const sectionStyle = { marginBottom: `${opts.sectionSpacing}px` };
    const headingStyle = {
        fontSize: `${opts.headingSize}pt`,
        fontWeight: 'bold' as const,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        borderBottom: '0.5px solid #d1d5db',
        paddingBottom: '4px',
        marginBottom: `${opts.paragraphSpacing}px`,
        breakAfter: 'avoid' as const,
    };

    return (
        <div
            className="bg-white text-black font-sans"
            style={{
                backgroundColor: '#ffffff',
                color: '#111827',
                colorScheme: 'light',
                width: A4_STYLES.width,
                minHeight: A4_STYLES.minHeight,
                padding: marginPadding,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                direction: contentDirection,
                fontFamily: opts.fontFamily,
                fontSize: `${opts.baseFontSize}pt`,
                lineHeight: String(opts.lineHeight),
            }}
        >
            {/* Header - Name and Title prominently displayed */}
            <header className="text-center border-b-2 border-black pb-4 mb-6">
                <h1 className="font-bold uppercase tracking-wide text-black" style={{ fontSize: nameFontSize }}>
                    {safeString(basics?.name) || 'Your Name'}
                </h1>
                {basics?.label && (
                    <p className="font-semibold text-black mt-1" style={{ fontSize: fs(12) }}>
                        {basics.label}
                    </p>
                )}
                {/* Contact Line */}
                <p className="text-black mt-2" style={{ fontSize: fs(10) }}>
                    {basics?.phone && <span>{basics.phone}</span>}
                    {basics?.email && (
                        <>
                            {basics?.phone && <Sep />}
                            <a href={`mailto:${basics.email}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{basics.email}</a>
                        </>
                    )}
                    {basics?.location?.city && (
                        <>
                            {(basics?.phone || basics?.email) && <Sep />}
                            <span>
                                {basics.location.city}
                                {basics.location?.region &&
                                    basics.location.region !== basics.location.city &&
                                    `, ${basics.location.region}`}
                            </span>
                        </>
                    )}
                    {(linkedInUrl || linkedInLabel) && (
                        <>
                            <Sep />
                            {linkedInUrl ? (
                                <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                                    LinkedIn Account
                                </a>
                            ) : (
                                <span>{linkedInLabel}</span>
                            )}
                        </>
                    )}
                    {(portfolioUrl || portfolioLabel) && (
                        <>
                            <Sep />
                            {portfolioUrl ? (
                                <a href={portfolioUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                                    Portfolio
                                </a>
                            ) : (
                                <span>{portfolioLabel}</span>
                            )}
                        </>
                    )}
                </p>
            </header>

            {/* Professional Summary */}
            {basics?.summary && (
                <section style={sectionStyle}>
                    <h2 className="text-black" style={headingStyle}>
                        {getSectionLabel('summary')}
                    </h2>
                    <p className="leading-relaxed" style={{ fontSize: fs(10.5) }}>{basics.summary}</p>
                </section>
            )}

            {/* Core Competencies - Keywords for ATS */}
            {allSkills.length > 0 && (
                <section style={sectionStyle}>
                    <h2 className="text-black" style={headingStyle}>
                        {getSectionLabel('coreCompetencies')}
                    </h2>
                    <p style={{ fontSize: fs(10.5) }}>
                        {allSkills.join(' • ')}
                    </p>
                </section>
            )}

            {/* Professional Experience */}
            {work && work.length > 0 && (
                <section style={sectionStyle}>
                    <h2 className="text-black" style={headingStyle}>
                        {getSectionLabel('workExperience')}
                    </h2>
                    {work.map((job, jobIndex) => (
                        <div key={`${job.name}-${job.position}-${job.startDate}-${job.endDate}-${jobIndex}`} className="mb-4" style={{ breakInside: 'avoid' }}>
                            <div className="flex justify-between items-baseline">
                                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                    <span className="font-semibold" style={{ fontSize: fs(12) }}>{safeString(job.position)}</span>
                                    {job.name && <span className="text-black" style={{ fontSize: fs(11) }}> | {job.name}</span>}
                                </div>
                                <span className="text-black" style={{ fontSize: fs(10), flexShrink: 0, whiteSpace: 'nowrap', marginLeft: '8px' }}>
                                    {job.startDate} - {job.endDate || 'Present'}
                                </span>
                            </div>
                            {job.location && (
                                <p className="text-black" style={{ fontSize: fs(10.5) }}>{job.location}</p>
                            )}
                            {job.highlights && job.highlights.length > 0 && (
                                <ul style={{ paddingLeft: '16px', margin: '2px 0 0 0', listStyleType: 'disc' }}>
                                    {job.highlights.map((highlight, hIndex) => (
                                        <li key={hIndex} style={{ fontSize: fs(10.5), marginBottom: '1px' }}>
                                            {cleanHighlight(highlight)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </section>
            )}

            {/* Key Projects */}
            {projects && projects.length > 0 && (
                <section style={sectionStyle}>
                    <h2 className="text-black" style={headingStyle}>
                        {getSectionLabel('keyProjects')}
                    </h2>
                    {projects.map((project, projectIndex) => (
                        <div key={`${project.name}-${projectIndex}`} className="mb-3" style={{ breakInside: 'avoid' }}>
                            <p className="font-semibold" style={{ fontSize: fs(11) }}>{safeString(project.name)}</p>
                            {project.description && (
                                <p className="text-black" style={{ fontSize: fs(10.5) }}>{project.description}</p>
                            )}
                            {project.highlights && project.highlights.length > 0 && (
                                <ul style={{ paddingLeft: '16px', margin: '2px 0 0 0', listStyleType: 'disc' }}>
                                    {project.highlights.map((highlight, hIndex) => (
                                        <li key={hIndex} style={{ fontSize: fs(10.5), marginBottom: '1px' }}>
                                            {cleanHighlight(highlight)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </section>
            )}

            {/* Education */}
            {education && education.length > 0 && (
                <section style={sectionStyle}>
                    <h2 className="text-black" style={headingStyle}>
                        {getSectionLabel('education')}
                    </h2>
                    {education.map((edu, educationIndex) => (
                        <div
                            key={`${edu.institution}-${edu.studyType}-${educationIndex}`}
                            className="mb-3"
                            style={{ breakInside: filterEducationHighlights(edu.highlights).length > 4 ? 'auto' : 'avoid' }}
                        >
                            <div className="flex justify-between">
                                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                    <span className="font-semibold" style={{ fontSize: fs(10.5) }}>{safeString(edu.studyType)}</span>
                                    {edu.area && <span style={{ fontSize: fs(10.5) }}> in {edu.area}</span>}
                                </div>
                                <span className="text-black" style={{ fontSize: fs(10), flexShrink: 0, whiteSpace: 'nowrap', marginLeft: '8px' }}>{edu.endDate}</span>
                            </div>
                            <p className="text-black" style={{ fontSize: fs(10.5) }}>{safeString(edu.institution)}</p>
                            {edu.score && <p style={{ fontSize: fs(10.5) }}>GPA: {edu.score}</p>}
                            {edu.courses && edu.courses.length > 0 && (
                                <p className="text-black" style={{ fontSize: fs(10.5), marginTop: '2px' }}>
                                    Relevant Coursework: {edu.courses.join(' · ')}
                                </p>
                            )}
                            {filterEducationHighlights(edu.highlights).length > 0 && (
                                <ul style={{ paddingLeft: '16px', margin: '2px 0 0 0', listStyleType: 'disc' }}>
                                    {filterEducationHighlights(edu.highlights).map((h, hIndex) => (
                                        <li key={hIndex} style={{ fontSize: fs(10.5), marginBottom: '1px' }}>
                                            {h}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </section>
            )}

            {/* Certifications */}
            {certificates && certificates.length > 0 && (
                <section style={sectionStyle}>
                    <h2 className="text-black" style={headingStyle}>
                        {getSectionLabel('certificationsTraining')}
                    </h2>
                    <div className="space-y-2">
                    {certificates.map((cert, certificateIndex) => (
                        <div key={`${typeof cert === 'string' ? cert : `${cert.name}-${cert.date}`}-${certificateIndex}`} className="flex justify-between items-baseline">
                                <div>
                                    <span className="font-semibold" style={{ fontSize: fs(10.5) }}>
                                        {typeof cert === 'string' ? cert : safeString(cert.name)}
                                    </span>
                                    {typeof cert !== 'string' && cert.issuer && (
                                        <span className="text-black" style={{ fontSize: fs(10.5) }}> | {cert.issuer}</span>
                                    )}
                                </div>
                                {typeof cert !== 'string' && cert.date && (
                                    <span className="text-black" style={{ fontSize: fs(10) }}>{cert.date}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Languages */}
            {languages && languages.length > 0 && (
                <section>
                    <h2 className="text-black" style={headingStyle}>
                        {getSectionLabel('languages')}
                    </h2>
                    <p style={{ fontSize: fs(10.5) }}>
                        {languages.map(lang => {
                            const { language, fluency } = safeLang(lang);
                            return `${language}${fluency ? ` (${fluency})` : ''}`;
                        }).join(' • ')}
                    </p>
                </section>
            )}
        </div>
    );
}

ATSOptimized.displayName = 'ATS Optimized';
