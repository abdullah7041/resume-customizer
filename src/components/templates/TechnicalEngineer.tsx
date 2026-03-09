import type { TemplateProps } from './BaseTemplate';
import { ATSResume, A4_STYLES, safeString, scaledFontSize, safeLang } from './BaseTemplate';
import { useSectionLabel } from '../../hooks/useSectionLabel';

// Default display options if not provided
const DEFAULT_OPTIONS = {
    baseFontSize: 10.5,
    headingSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    sectionSpacing: 12,
    paragraphSpacing: 6,
    lineHeight: 1.5,
    marginTop: 0.5,
    marginBottom: 0.5,
    marginSide: 0.6,
};

/**
 * Technical Engineer Template
 * Optimized for tech roles with prominent skills section
 * Clean sections, monospace accents for technical credibility
 */
export function TechnicalEngineer({
    resume,
    isAtsMode = false,
    scale = 1,
    fontScale = 1,
    displayOptions,
}: TemplateProps) {
    const getSectionLabel = useSectionLabel();

    // Merge displayOptions with defaults
    const opts = { ...DEFAULT_OPTIONS, ...displayOptions };

    // ATS mode returns pure semantic HTML
    if (isAtsMode) {
        return <ATSResume resume={resume} />;
    }

    const { basics, work = [], education = [], skills = [], projects = [], certificates = [], languages = [] } = resume;

    // Get profile links
    const linkedInUrl = basics.profiles?.find((p) => p.network?.toLowerCase() === 'linkedin')?.url;
    const portfolioUrl = basics.url || basics.profiles?.find((p) => p.network?.toLowerCase() === 'portfolio' || p.network?.toLowerCase() === 'website')?.url;

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
        fontWeight: '700' as const,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        borderBottom: '1px dashed #e5e7eb',
        paddingBottom: '4px',
        marginBottom: `${opts.paragraphSpacing}px`,
        breakAfter: 'avoid' as const,
    };

    return (
        <div
            className="bg-white text-gray-900"
            style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: A4_STYLES.width,
                minHeight: A4_STYLES.minHeight,
                padding: marginPadding,
                fontFamily: opts.fontFamily,
                fontSize: `${opts.baseFontSize}pt`,
                lineHeight: String(opts.lineHeight),
            }}
            dir="ltr"
        >
            {/* Header */}
            <header className="mb-5 pb-4" style={{ borderBottom: '2px dashed #d1d5db' }}>
                <h1
                    className="text-gray-900 mb-1"
                    style={{
                        fontSize: fs(24),
                        fontWeight: '700',
                        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                    }}
                >
                    {safeString(basics.name)}
                </h1>
                {basics.label && (
                    <p
                        className="text-gray-500 mb-2"
                        style={{
                            fontSize: fs(12),
                            fontFamily: "'Inter', -apple-system, sans-serif",
                            fontWeight: '600',
                        }}
                    >
                        {basics.label}
                    </p>
                )}
                <div className="flex flex-wrap gap-4 text-gray-500" style={{ fontSize: fs(10) }}>
                    {basics.email && <a href={`mailto:${basics.email}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{basics.email}</a>}
                    {basics.phone && <span>{basics.phone}</span>}
                    {basics.location?.city && (
                        <span>
                            {basics.location.city}
                            {basics.location?.region && `, ${basics.location.region}`}
                        </span>
                    )}
                    {linkedInUrl && <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>{linkedInUrl.replace('https://', '').replace('www.', '')}</a>}
                    {portfolioUrl && <a href={portfolioUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>{portfolioUrl.replace('https://', '').replace('www.', '')}</a>}
                </div>
            </header>

            {/* SKILLS FIRST - Technical emphasis */}
            {skills.length > 0 && (
                <section
                    style={{ ...sectionStyle, padding: '1rem', borderRadius: '0.25rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
                >
                    <h2
                        className="text-gray-700"
                        style={{ ...headingStyle, borderBottom: 'none' }}
                    >
                        {getSectionLabel('technicalSkills')}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {skills.map((skillItem, i) => {
                            // Handle both string and object formats
                            if (typeof skillItem === 'string') {
                                return (
                                    <span
                                        key={i}
                                        className="px-3 py-1 text-gray-700 rounded"
                                        style={{
                                            fontSize: fs(10.5),
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #d1d5db',
                                        }}
                                    >
                                        {skillItem}
                                    </span>
                                );
                            }
                            // Object format with keywords
                            const keywords = skillItem.keywords || [skillItem.name];
                            return keywords.map((skill: string, j: number) => (
                                <span
                                    key={`${i}-${j}`}
                                    className="px-3 py-1 text-gray-700 rounded"
                                    style={{
                                        fontSize: fs(10.5),
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #d1d5db',
                                    }}
                                >
                                    {skill}
                                </span>
                            ));
                        })}
                    </div>
                </section>
            )}

            {/* Summary */}
            {basics.summary && (
                <section style={sectionStyle}>
                    <h2
                        className="text-gray-700"
                        style={headingStyle}
                    >
                        {getSectionLabel('summary')}
                    </h2>
                    <p
                        className="text-gray-600"
                        style={{
                            fontFamily: "'Inter', -apple-system, sans-serif",
                            fontSize: fs(10.5),
                        }}
                    >
                        {basics.summary}
                    </p>
                </section>
            )}

            {/* Experience */}
            {work.length > 0 && (
                <section style={sectionStyle}>
                    <h2
                        className="text-gray-700"
                        style={headingStyle}
                    >
                        {getSectionLabel('experience')}
                    </h2>
                    <div className="space-y-4">
                        {work.map((job, i) => (
                            <div key={i} style={{ breakInside: 'avoid' }}>
                                <div className="flex justify-between items-baseline mb-1">
                                    <h3
                                        className="text-gray-900"
                                        style={{
                                            fontSize: fs(12),
                                            fontWeight: '600',
                                            fontFamily: "'Inter', -apple-system, sans-serif",
                                            minWidth: 0,
                                        }}
                                    >
                                        {safeString(job.position)}
                                    </h3>
                                    <span className="text-gray-500" style={{ fontSize: fs(10), flexShrink: 0, whiteSpace: 'nowrap', marginLeft: '8px' }}>
                                        {job.startDate} → {job.endDate || 'Present'}
                                    </span>
                                </div>
                                <p className="text-gray-500 mb-2" style={{ fontSize: fs(11) }}>
                                    {safeString(job.name)}
                                    {job.location && ` | ${job.location}`}
                                </p>
                                {job.highlights && job.highlights.length > 0 && (
                                    <ul style={{ paddingLeft: '16px', margin: '2px 0 0 0', listStyleType: 'disc' }}>
                                        {job.highlights.map((h, j) => (
                                            <li key={j} className="text-gray-600" style={{ fontSize: fs(10.5), marginBottom: '1px', lineHeight: String(opts.lineHeight) }}>
                                                {h}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Projects */}
            {projects.length > 0 && (
                <section style={sectionStyle}>
                    <h2
                        className="text-gray-700"
                        style={headingStyle}
                    >
                        {getSectionLabel('projects')}
                    </h2>
                    <div className="space-y-3">
                        {projects.map((project, i) => (
                            <div key={i} style={{ breakInside: 'avoid' }}>
                                <h3
                                    className="text-gray-900"
                                    style={{
                                        fontSize: fs(11),
                                        fontWeight: '600',
                                        fontFamily: "'Inter', -apple-system, sans-serif",
                                    }}
                                >
                                    {safeString(project.name)}
                                </h3>
                                {project.description && (
                                    <p className="text-gray-600 mb-1" style={{ fontSize: fs(10.5) }}>{project.description}</p>
                                )}
                                {project.highlights && project.highlights.length > 0 && (
                                    <ul style={{ paddingLeft: '16px', margin: '2px 0 0 0', listStyleType: 'disc' }}>
                                        {project.highlights.map((h, j) => (
                                            <li key={j} className="text-gray-600" style={{ fontSize: fs(10.5), marginBottom: '1px', lineHeight: String(opts.lineHeight) }}>
                                                {h}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Education */}
            {education.length > 0 && (
                <section style={sectionStyle}>
                    <h2
                        className="text-gray-700"
                        style={headingStyle}
                    >
                        {getSectionLabel('education')}
                    </h2>
                    <div className="space-y-3">
                        {education.map((edu, i) => (
                            <div key={i} style={{ breakInside: 'avoid' }}>
                                <div className="flex justify-between items-baseline">
                                    <div>
                                        <h3
                                            className="text-gray-900"
                                            style={{
                                                fontSize: fs(10.5),
                                                fontWeight: '600',
                                                fontFamily: "'Inter', -apple-system, sans-serif",
                                            }}
                                        >
                                            {safeString(edu.institution)}
                                        </h3>
                                        <p className="text-gray-500" style={{ fontSize: fs(10.5) }}>
                                            {safeString(edu.studyType)}
                                            {edu.area && ` — ${edu.area}`}
                                        </p>
                                        {edu.score && (
                                            <p className="text-gray-500" style={{ fontSize: fs(10.5) }}>
                                                GPA: {edu.score}
                                            </p>
                                        )}
                                        {edu.courses && edu.courses.length > 0 && (
                                            <p className="text-gray-500" style={{ fontSize: fs(10.5), marginTop: '2px' }}>
                                                Relevant Coursework: {edu.courses.join(' · ')}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-gray-500" style={{ fontSize: fs(10) }}>
                                        {edu.endDate || edu.startDate}
                                    </span>
                                </div>
                                {edu.highlights && edu.highlights.length > 0 && (
                                    <ul style={{ paddingLeft: '16px', margin: '2px 0 0 0', listStyleType: 'disc' }}>
                                        {edu.highlights.map((h, j) => (
                                            <li key={j} className="text-gray-600" style={{ fontSize: fs(10.5), marginBottom: '1px', lineHeight: String(opts.lineHeight) }}>
                                                {h}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Certificates */}
            {certificates.length > 0 && (
                <section style={sectionStyle}>
                    <h2
                        className="text-gray-700"
                        style={headingStyle}
                    >
                        {getSectionLabel('certifications')}
                    </h2>
                    <div className="space-y-2">
                        {certificates.map((cert, i) => (
                            <div key={i} className="flex justify-between items-baseline">
                                <div>
                                    <h3
                                        className="text-gray-900"
                                        style={{
                                            fontSize: fs(10.5),
                                            fontWeight: '600',
                                            fontFamily: "'Inter', -apple-system, sans-serif",
                                        }}
                                    >
                                        {safeString(cert.name)}
                                    </h3>
                                    {cert.issuer && (
                                        <p className="text-gray-500" style={{ fontSize: fs(10.5) }}>
                                            {cert.issuer}
                                        </p>
                                    )}
                                </div>
                                {cert.date && (
                                    <span className="text-gray-500" style={{ fontSize: fs(10) }}>
                                        {cert.date}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Languages */}
            {languages.length > 0 && (
                <section>
                    <h2
                        className="text-gray-700"
                        style={headingStyle}
                    >
                        {getSectionLabel('languages')}
                    </h2>
                    <div className="flex flex-wrap gap-3">
                        {languages.map((lang, i) => {
                            const { language, fluency } = safeLang(lang);
                            return (
                                <span key={i} className="text-gray-600" style={{ fontSize: fs(10.5) }}>
                                    <strong>{language}</strong>{fluency ? `: ${fluency}` : ''}
                                </span>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
}

TechnicalEngineer.displayName = 'Technical Engineer';
