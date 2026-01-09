import type { TemplateProps } from './BaseTemplate';
import { ATSResume, A4_STYLES, safeString } from './BaseTemplate';
import { useDirection } from '../providers/DirectionProvider';

/**
 * Technical Engineer Template
 * Skills-first layout with monospace-inspired typography
 * Emphasizes technical competencies, clean data presentation
 * Supports RTL for Arabic
 */
export function TechnicalEngineer({
    resume,
    isAtsMode = false,
    scale = 1,
}: TemplateProps) {
    const { isRTL } = useDirection();

    // ATS mode returns pure semantic HTML
    if (isAtsMode) {
        return <ATSResume resume={resume} />;
    }

    const { basics, work = [], education = [], skills = [], projects = [], languages = [], certificates = [] } = resume;

    // Get profile links
    const linkedInUrl = basics.profiles?.find((p) => p.network?.toLowerCase() === 'linkedin')?.url;
    const portfolioUrl = basics.url || basics.profiles?.find((p) => p.network?.toLowerCase() === 'portfolio' || p.network?.toLowerCase() === 'website')?.url;

    // Debug: Log skills data to understand structure
    console.log('[TechnicalEngineer] Skills count:', skills.length);
    console.log('[TechnicalEngineer] Skills sample:', skills[0]);

    return (
        <div
            className="bg-white text-gray-900"
            style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: A4_STYLES.width,
                minHeight: A4_STYLES.minHeight,
                padding: '18mm 20mm',
                fontFamily: "'SF Mono', 'Fira Code', 'Consolas', 'Monaco', monospace",
                fontSize: '10.5pt',
                lineHeight: '1.5',
            }}
            dir={isRTL ? 'rtl' : 'ltr'}
        >
            {/* Header */}
            <header className="mb-5 pb-4" style={{ borderBottom: '2px dashed #d1d5db' }}>
                <h1
                    className="text-gray-900 mb-1"
                    style={{
                        fontSize: '24pt',
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
                            fontSize: '12pt',
                            fontFamily: "'Inter', -apple-system, sans-serif",
                            fontWeight: '600',
                        }}
                    >
                        {basics.label}
                    </p>
                )}
                <div className="flex flex-wrap gap-4 text-gray-500" style={{ fontSize: '10pt' }}>
                    {basics.email && <span>{basics.email}</span>}
                    {basics.phone && <span>{basics.phone}</span>}
                    {basics.location?.city && <span>{basics.location.city}</span>}
                    {linkedInUrl && <span>{linkedInUrl.replace('https://', '').replace('www.', '')}</span>}
                    {portfolioUrl && <span>{portfolioUrl.replace('https://', '').replace('www.', '')}</span>}
                </div>
            </header>

            {/* SKILLS FIRST - Technical emphasis */}
            {skills.length > 0 && (
                <section
                    className="mb-5 p-4 rounded"
                    style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
                >
                    <h2
                        className="text-gray-700 mb-3 pb-1"
                        style={{
                            fontSize: '14pt',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: 'none',
                        }}
                    >
                        Technical Skills
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
                                            fontSize: '10.5pt',
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
                                        fontSize: '10.5pt',
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
                <section className="mb-5">
                    <h2
                        className="text-gray-700 mb-2 pb-1"
                        style={{
                            fontSize: '14pt',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: '1px dashed #e5e7eb',
                        }}
                    >
                        {isRTL ? 'الملخص' : 'Summary'}
                    </h2>
                    <p
                        className="text-gray-600"
                        style={{
                            fontFamily: "'Inter', -apple-system, sans-serif",
                            fontSize: '10.5pt',
                        }}
                    >
                        {basics.summary}
                    </p>
                </section>
            )}

            {/* Experience */}
            {work.length > 0 && (
                <section className="mb-5">
                    <h2
                        className="text-gray-700 mb-3 pb-1"
                        style={{
                            fontSize: '14pt',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: '1px dashed #e5e7eb',
                        }}
                    >
                        {isRTL ? 'الخبرة' : 'Experience'}
                    </h2>
                    <div className="space-y-4">
                        {work.map((job, i) => (
                            <div key={i}>
                                <div className="flex justify-between items-baseline mb-1">
                                    <h3
                                        className="text-gray-900"
                                        style={{
                                            fontSize: '12pt',
                                            fontWeight: '600',
                                            fontFamily: "'Inter', -apple-system, sans-serif",
                                        }}
                                    >
                                        {safeString(job.position)}
                                    </h3>
                                    <span className="text-gray-500" style={{ fontSize: '10pt' }}>
                                        {job.startDate} → {job.endDate || 'Present'}
                                    </span>
                                </div>
                                <p className="text-gray-500 mb-2" style={{ fontSize: '11pt' }}>
                                    {safeString(job.name)}
                                </p>
                                {job.highlights && job.highlights.length > 0 && (
                                    <ul className="space-y-1 ps-4">
                                        {job.highlights.map((h, j) => (
                                            <li
                                                key={j}
                                                className="text-gray-600 relative"
                                                style={{
                                                    fontSize: '10.5pt',
                                                    listStyleType: 'disc',
                                                }}
                                            >
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
                <section className="mb-5">
                    <h2
                        className="text-gray-700 mb-3 pb-1"
                        style={{
                            fontSize: '14pt',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: '1px dashed #e5e7eb',
                        }}
                    >
                        {isRTL ? 'المشاريع' : 'Projects'}
                    </h2>
                    <div className="space-y-3">
                        {projects.map((project, i) => (
                            <div key={i}>
                                <h3
                                    className="text-gray-900"
                                    style={{
                                        fontSize: '11pt',
                                        fontWeight: '600',
                                        fontFamily: "'Inter', -apple-system, sans-serif",
                                    }}
                                >
                                    {safeString(project.name)}
                                </h3>
                                {project.description && (
                                    <p className="text-gray-600 mb-1" style={{ fontSize: '10.5pt' }}>{project.description}</p>
                                )}
                                {project.highlights && project.highlights.length > 0 && (
                                    <ul className="space-y-1 ps-4">
                                        {project.highlights.map((h, j) => (
                                            <li
                                                key={j}
                                                className="text-gray-600"
                                                style={{
                                                    fontSize: '10.5pt',
                                                    listStyleType: 'disc',
                                                }}
                                            >
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
                <section className="mb-5">
                    <h2
                        className="text-gray-700 mb-3 pb-1"
                        style={{
                            fontSize: '14pt',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: '1px dashed #e5e7eb',
                        }}
                    >
                        {isRTL ? 'التعليم' : 'Education'}
                    </h2>
                    <div className="space-y-3">
                        {education.map((edu, i) => (
                            <div key={i}>
                                <div className="flex justify-between items-baseline">
                                    <div>
                                        <h3
                                            className="text-gray-900"
                                            style={{
                                                fontSize: '10.5pt',
                                                fontWeight: '600',
                                                fontFamily: "'Inter', -apple-system, sans-serif",
                                            }}
                                        >
                                            {safeString(edu.institution)}
                                        </h3>
                                        <p className="text-gray-500" style={{ fontSize: '10.5pt' }}>
                                            {safeString(edu.studyType)}
                                            {edu.area && ` — ${edu.area}`}
                                        </p>
                                        {edu.score && (
                                            <p className="text-gray-500" style={{ fontSize: '10.5pt' }}>
                                                GPA: {edu.score}
                                            </p>
                                        )}
                                        {edu.courses && edu.courses.length > 0 && (
                                            <p className="text-gray-500" style={{ fontSize: '10.5pt', marginTop: '2px' }}>
                                                Relevant Coursework: {edu.courses.join(' · ')}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-gray-500" style={{ fontSize: '10pt' }}>
                                        {edu.endDate || edu.startDate}
                                    </span>
                                </div>
                                {edu.highlights && edu.highlights.length > 0 && (
                                    <ul className="space-y-1 ps-4 mt-1">
                                        {edu.highlights.map((h, j) => (
                                            <li
                                                key={j}
                                                className="text-gray-600"
                                                style={{
                                                    fontSize: '10.5pt',
                                                    listStyleType: 'disc',
                                                }}
                                            >
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
                <section className="mb-5">
                    <h2
                        className="text-gray-700 mb-3 pb-1"
                        style={{
                            fontSize: '14pt',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: '1px dashed #e5e7eb',
                        }}
                    >
                        {isRTL ? 'الشهادات' : 'Certifications'}
                    </h2>
                    <div className="space-y-2">
                        {certificates.map((cert, i) => (
                            <div key={i} className="flex justify-between items-baseline">
                                <div>
                                    <h3
                                        className="text-gray-900"
                                        style={{
                                            fontSize: '10.5pt',
                                            fontWeight: '600',
                                            fontFamily: "'Inter', -apple-system, sans-serif",
                                        }}
                                    >
                                        {safeString(cert.name)}
                                    </h3>
                                    {cert.issuer && (
                                        <p className="text-gray-500" style={{ fontSize: '10.5pt' }}>
                                            {cert.issuer}
                                        </p>
                                    )}
                                </div>
                                {cert.date && (
                                    <span className="text-gray-500" style={{ fontSize: '10pt' }}>
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
                        className="text-gray-700 mb-2 pb-1"
                        style={{
                            fontSize: '14pt',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: '1px dashed #e5e7eb',
                        }}
                    >
                        {isRTL ? 'اللغات' : 'Languages'}
                    </h2>
                    <div className="flex flex-wrap gap-3">
                        {languages.map((lang, i) => (
                            <span key={i} className="text-gray-600" style={{ fontSize: '10.5pt' }}>
                                <strong>{lang.language}</strong>: {lang.fluency}
                            </span>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

TechnicalEngineer.displayName = 'Technical Engineer';
