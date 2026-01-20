import type { TemplateProps } from './BaseTemplate';
import { ATSResume, A4_STYLES, safeString, scaledFontSize } from './BaseTemplate';
import { useDirection } from '../providers/DirectionProvider';
import { useSectionLabel } from '../../hooks/useSectionLabel';

// Default display options if not provided
const DEFAULT_OPTIONS = {
    baseFontSize: 10.5,
    headingSize: 14,
    fontFamily: 'Arial, Helvetica, sans-serif',
    sectionSpacing: 12,
    paragraphSpacing: 6,
    lineHeight: 1.4,
    marginTop: 0.5,
    marginBottom: 0.5,
    marginSide: 0.6,
};

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
}: TemplateProps) {
    const getSectionLabel = useSectionLabel();
    const { isRTL } = useDirection();

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

    // Build contact line
    const contactParts = [
        basics?.phone,
        basics?.email,
        basics?.location?.city && basics?.location?.region
            ? `${basics.location.city}, ${basics.location.region}`
            : basics?.location?.city,
        basics?.profiles?.[0]?.url
    ].filter(Boolean);

    // Helper for scaled fonts - use displayOptions or legacy fontScale
    const fs = (pt: number) => {
        if (displayOptions?.baseFontSize) {
            const scaleFactor = displayOptions.baseFontSize / 10.5;
            return scaledFontSize(pt, scaleFactor);
        }
        return scaledFontSize(pt, fontScale);
    };

    // Dynamic margins based on displayOptions
    const marginPadding = `${opts.marginTop * 25.4}mm ${opts.marginSide * 25.4}mm`;

    // Computed styles based on displayOptions
    const sectionStyle = { marginBottom: `${opts.sectionSpacing}px` };
    const headingStyle = {
        fontSize: `${opts.headingSize}pt`,
        fontWeight: 'bold' as const,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        borderBottom: '1px solid #9ca3af',
        paddingBottom: '4px',
        marginBottom: `${opts.paragraphSpacing}px`,
    };

    return (
        <div
            className="bg-white text-black font-sans"
            style={{
                width: A4_STYLES.width,
                minHeight: A4_STYLES.minHeight,
                padding: marginPadding,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                direction: 'ltr', // Always LTR for resume content
                fontFamily: opts.fontFamily,
                fontSize: `${opts.baseFontSize}pt`,
                lineHeight: String(opts.lineHeight),
            }}
        >
            {/* Header - Name and Title prominently displayed */}
            <header className="text-center border-b-2 border-black pb-4 mb-6">
                <h1 className="font-bold uppercase tracking-wide text-black" style={{ fontSize: fs(24) }}>
                    {safeString(basics?.name) || 'Your Name'}
                </h1>
                {basics?.label && (
                    <p className="font-semibold text-black mt-1" style={{ fontSize: fs(12) }}>
                        {basics.label}
                    </p>
                )}
                {/* Contact Line */}
                <p className="text-black mt-2" style={{ fontSize: fs(10) }}>
                    {contactParts.join(' | ')}
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
                    {work.map((job, index) => (
                        <div key={index} className="mb-4">
                            <div className="flex justify-between items-baseline">
                                <div>
                                    <span className="font-semibold" style={{ fontSize: fs(12) }}>{safeString(job.position)}</span>
                                    {job.name && <span className="text-black" style={{ fontSize: fs(11) }}> | {job.name}</span>}
                                </div>
                                <span className="text-black" style={{ fontSize: fs(10) }}>
                                    {job.startDate} - {job.endDate || 'Present'}
                                </span>
                            </div>
                            {job.location && (
                                <p className="text-black" style={{ fontSize: fs(10.5) }}>{job.location}</p>
                            )}
                            {job.highlights && job.highlights.length > 0 && (
                                <ul className="mt-2 space-y-1" style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
                                    {job.highlights.map((highlight, hIndex) => (
                                        <li key={hIndex} className="flex" style={{ fontSize: fs(10.5) }}>
                                            <span className={isRTL ? 'ml-2' : 'mr-2'}>•</span>
                                            <span>{highlight}</span>
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
                    {projects.map((project, index) => (
                        <div key={index} className="mb-3">
                            <p className="font-semibold" style={{ fontSize: fs(11) }}>{safeString(project.name)}</p>
                            {project.description && (
                                <p className="text-black" style={{ fontSize: fs(10.5) }}>{project.description}</p>
                            )}
                            {project.highlights && project.highlights.length > 0 && (
                                <ul className="mt-1 space-y-1" style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
                                    {project.highlights.map((highlight, hIndex) => (
                                        <li key={hIndex} className="flex" style={{ fontSize: fs(10.5) }}>
                                            <span className={isRTL ? 'ml-2' : 'mr-2'}>•</span>
                                            <span>{highlight}</span>
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
                    {education.map((edu, index) => (
                        <div key={index} className="mb-3">
                            <div className="flex justify-between">
                                <div>
                                    <span className="font-semibold" style={{ fontSize: fs(10.5) }}>{safeString(edu.studyType)}</span>
                                    {edu.area && <span style={{ fontSize: fs(10.5) }}> in {edu.area}</span>}
                                </div>
                                <span className="text-black" style={{ fontSize: fs(10) }}>{edu.endDate}</span>
                            </div>
                            <p className="text-black" style={{ fontSize: fs(10.5) }}>{safeString(edu.institution)}</p>
                            {edu.score && <p style={{ fontSize: fs(10.5) }}>GPA: {edu.score}</p>}
                            {edu.courses && edu.courses.length > 0 && (
                                <p className="text-black" style={{ fontSize: fs(10.5), marginTop: '2px' }}>
                                    Relevant Coursework: {edu.courses.join(' · ')}
                                </p>
                            )}
                            {edu.highlights && edu.highlights.length > 0 && (
                                <ul className="mt-1 space-y-1" style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
                                    {edu.highlights.map((highlight, hIndex) => (
                                        <li key={hIndex} className="flex" style={{ fontSize: fs(10.5) }}>
                                            <span className={isRTL ? 'ml-2' : 'mr-2'}>•</span>
                                            <span>{highlight}</span>
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
                    <p style={{ fontSize: fs(10.5) }}>
                        {certificates.map(cert =>
                            typeof cert === 'string' ? cert : safeString(cert.name)
                        ).filter(Boolean).join(' • ')}
                    </p>
                </section>
            )}

            {/* Languages */}
            {languages && languages.length > 0 && (
                <section>
                    <h2 className="text-black" style={headingStyle}>
                        {getSectionLabel('languages')}
                    </h2>
                    <p style={{ fontSize: fs(10.5) }}>
                        {languages.map(lang =>
                            `${safeString(lang.language)}${lang.fluency ? ` (${lang.fluency})` : ''}`
                        ).join(' • ')}
                    </p>
                </section>
            )}
        </div>
    );
}

ATSOptimized.displayName = 'ATS Optimized';
