import type { TemplateProps } from './BaseTemplate';
import { ATSResume, A4_STYLES, safeString } from './BaseTemplate';
import { useDirection } from '../providers/DirectionProvider';

/**
 * ATS Optimized Template
 * Single-column layout optimized for Applicant Tracking Systems
 * Keyword-rich, clear hierarchy, maximum parseability
 */
export function ATSOptimized({
    resume,
    isAtsMode = false,
    scale = 1,
}: TemplateProps) {
    const { isRTL } = useDirection();

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

    return (
        <div
            className="bg-white text-black font-sans"
            style={{
                width: A4_STYLES.width,
                minHeight: A4_STYLES.minHeight,
                padding: A4_STYLES.padding,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                direction: isRTL ? 'rtl' : 'ltr',
            }}
        >
            {/* Header - Name and Title prominently displayed */}
            <header className="text-center border-b-2 border-black pb-4 mb-6">
                <h1 className="font-bold uppercase tracking-wide text-black" style={{ fontSize: '24pt' }}>
                    {safeString(basics?.name) || 'Your Name'}
                </h1>
                {basics?.label && (
                    <p className="font-semibold text-black mt-1" style={{ fontSize: '12pt' }}>
                        {basics.label}
                    </p>
                )}
                {/* Contact Line */}
                <p className="text-black mt-2" style={{ fontSize: '10pt' }}>
                    {contactParts.join(' | ')}
                </p>
            </header>

            {/* Professional Summary */}
            {basics?.summary && (
                <section className="mb-6">
                    <h2 className="font-bold uppercase tracking-wider border-b border-gray-400 pb-1 mb-3 text-black" style={{ fontSize: '14pt' }}>
                        Professional Summary
                    </h2>
                    <p className="leading-relaxed" style={{ fontSize: '10.5pt' }}>{basics.summary}</p>
                </section>
            )}

            {/* Core Competencies - Keywords for ATS */}
            {allSkills.length > 0 && (
                <section className="mb-6">
                    <h2 className="font-bold uppercase tracking-wider border-b border-gray-400 pb-1 mb-3 text-black" style={{ fontSize: '14pt' }}>
                        Core Competencies
                    </h2>
                    <p style={{ fontSize: '10.5pt' }}>
                        {allSkills.join(' • ')}
                    </p>
                </section>
            )}

            {/* Professional Experience */}
            {work && work.length > 0 && (
                <section className="mb-6">
                    <h2 className="font-bold uppercase tracking-wider border-b border-gray-400 pb-1 mb-3 text-black" style={{ fontSize: '14pt' }}>
                        Professional Experience
                    </h2>
                    {work.map((job, index) => (
                        <div key={index} className="mb-4">
                            <div className="flex justify-between items-baseline">
                                <div>
                                    <span className="font-semibold" style={{ fontSize: '12pt' }}>{safeString(job.position)}</span>
                                    {job.name && <span className="text-black" style={{ fontSize: '11pt' }}> | {job.name}</span>}
                                </div>
                                <span className="text-black" style={{ fontSize: '10pt' }}>
                                    {job.startDate} - {job.endDate || 'Present'}
                                </span>
                            </div>
                            {job.location && (
                                <p className="text-black" style={{ fontSize: '10.5pt' }}>{job.location}</p>
                            )}
                            {job.highlights && job.highlights.length > 0 && (
                                <ul className="mt-2 space-y-1">
                                    {job.highlights.map((highlight, hIndex) => (
                                        <li key={hIndex} className="flex" style={{ fontSize: '10.5pt' }}>
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
                <section className="mb-6">
                    <h2 className="font-bold uppercase tracking-wider border-b border-gray-400 pb-1 mb-3 text-black" style={{ fontSize: '14pt' }}>
                        Key Projects
                    </h2>
                    {projects.map((project, index) => (
                        <div key={index} className="mb-3">
                            <p className="font-semibold" style={{ fontSize: '11pt' }}>{safeString(project.name)}</p>
                            {project.description && (
                                <p className="text-black" style={{ fontSize: '10.5pt' }}>{project.description}</p>
                            )}
                            {project.highlights && project.highlights.length > 0 && (
                                <ul className="mt-1 space-y-1">
                                    {project.highlights.map((highlight, hIndex) => (
                                        <li key={hIndex} className="flex" style={{ fontSize: '10.5pt' }}>
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
                <section className="mb-6">
                    <h2 className="font-bold uppercase tracking-wider border-b border-gray-400 pb-1 mb-3 text-black" style={{ fontSize: '14pt' }}>
                        Education
                    </h2>
                    {education.map((edu, index) => (
                        <div key={index} className="mb-3">
                            <div className="flex justify-between">
                                <div>
                                    <span className="font-semibold" style={{ fontSize: '10.5pt' }}>{safeString(edu.studyType)}</span>
                                    {edu.area && <span style={{ fontSize: '10.5pt' }}> in {edu.area}</span>}
                                </div>
                                <span className="text-black" style={{ fontSize: '10pt' }}>{edu.endDate}</span>
                            </div>
                            <p className="text-black" style={{ fontSize: '10.5pt' }}>{safeString(edu.institution)}</p>
                            {edu.score && <p style={{ fontSize: '10.5pt' }}>GPA: {edu.score}</p>}
                            {edu.courses && edu.courses.length > 0 && (
                                <p className="text-black" style={{ fontSize: '10.5pt', marginTop: '2px' }}>
                                    Relevant Coursework: {edu.courses.join(' · ')}
                                </p>
                            )}
                            {edu.highlights && edu.highlights.length > 0 && (
                                <ul className="mt-1 space-y-1">
                                    {edu.highlights.map((highlight, hIndex) => (
                                        <li key={hIndex} className="flex" style={{ fontSize: '10.5pt' }}>
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
                <section className="mb-6">
                    <h2 className="font-bold uppercase tracking-wider border-b border-gray-400 pb-1 mb-3 text-black" style={{ fontSize: '14pt' }}>
                        Certifications & Training
                    </h2>
                    <p style={{ fontSize: '10.5pt' }}>
                        {certificates.map(cert =>
                            typeof cert === 'string' ? cert : safeString(cert.name)
                        ).filter(Boolean).join(' • ')}
                    </p>
                </section>
            )}

            {/* Languages */}
            {languages && languages.length > 0 && (
                <section>
                    <h2 className="font-bold uppercase tracking-wider border-b border-gray-400 pb-1 mb-3 text-black" style={{ fontSize: '14pt' }}>
                        Languages
                    </h2>
                    <p style={{ fontSize: '10.5pt' }}>
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
