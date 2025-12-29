import type { TemplateProps } from './BaseTemplate';
import { ATSResume, A4_STYLES, safeString } from './BaseTemplate';
import { useDirection } from '../providers/DirectionProvider';

/**
 * Classic Traditional Template
 * Formal serif typography with centered header
 * Bold full-width dividers, traditional corporate feel
 * ATS-compatible single-column layout
 * Supports RTL for Arabic
 */
export function ClassicTraditional({
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

  return (
    <div
      className="bg-white text-gray-900"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        width: A4_STYLES.width,
        minHeight: A4_STYLES.minHeight,
        padding: '20mm 24mm',
        fontFamily: "'Georgia', 'Times New Roman', serif",
        fontSize: '10pt',
        lineHeight: '1.45',
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Centered Header with bold divider */}
      <header className="text-center mb-5 pb-4" style={{ borderBottom: '2px solid #1a1a1a' }}>
        <h1
          className="text-gray-900 mb-1"
          style={{
            fontSize: '22pt',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
          }}
        >
          {safeString(basics.name)}
        </h1>
        {basics.label && (
          <p className="text-gray-600 mb-2" style={{ fontSize: '11pt', fontWeight: '500' }}>
            {basics.label}
          </p>
        )}
        <p className="text-gray-500 mb-1" style={{ fontSize: '9pt' }}>
          {[basics.email, basics.phone, basics.location?.city].filter(Boolean).join('  |  ')}
        </p>
        {(linkedInUrl || portfolioUrl) && (
          <p className="text-gray-400" style={{ fontSize: '8.5pt' }}>
            {[
              linkedInUrl?.replace('https://', '').replace('www.', ''),
              portfolioUrl?.replace('https://', '').replace('www.', ''),
            ].filter(Boolean).join('  |  ')}
          </p>
        )}
      </header>

      {/* Professional Summary */}
      {basics.summary && (
        <section className="mb-4">
          <h2
            className="text-gray-900 mb-2 pb-1"
            style={{
              fontSize: '11pt',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderBottom: '1px solid #1a1a1a',
            }}
          >
            {isRTL ? 'الملخص المهني' : 'Professional Summary'}
          </h2>
          <p
            className="text-gray-700 italic text-justify"
            style={{ lineHeight: '1.55' }}
          >
            {basics.summary}
          </p>
        </section>
      )}

      {/* Professional Experience */}
      {work.length > 0 && (
        <section className="mb-4">
          <h2
            className="text-gray-900 mb-3 pb-1"
            style={{
              fontSize: '11pt',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderBottom: '1px solid #1a1a1a',
            }}
          >
            {isRTL ? 'الخبرة المهنية' : 'Professional Experience'}
          </h2>
          <div className="space-y-4">
            {work.map((job, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="text-gray-900" style={{ fontSize: '10.5pt', fontWeight: '700' }}>
                    {safeString(job.position)}
                  </h3>
                  <span className="text-gray-500 italic" style={{ fontSize: '9pt' }}>
                    {job.startDate} – {job.endDate || 'Present'}
                  </span>
                </div>
                <p className="text-gray-600 italic mb-2" style={{ fontSize: '10pt' }}>
                  {safeString(job.name)}
                </p>
                {job.highlights && job.highlights.length > 0 && (
                  <ul className="space-y-1 ps-4">
                    {job.highlights.map((h, j) => (
                      <li
                        key={j}
                        className="text-gray-700"
                        style={{
                          fontSize: '9.5pt',
                          listStyleType: 'none',
                          position: 'relative',
                          paddingInlineStart: '12px',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            insetInlineStart: '0',
                          }}
                        >
                          –
                        </span>
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
        <section className="mb-4">
          <h2
            className="text-gray-900 mb-3 pb-1"
            style={{
              fontSize: '11pt',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderBottom: '1px solid #1a1a1a',
            }}
          >
            {isRTL ? 'التعليم' : 'Education'}
          </h2>
          <div className="space-y-2">
            {education.map((edu, i) => (
              <div key={i} className="flex justify-between">
                <div>
                  <h3 className="text-gray-900" style={{ fontSize: '10.5pt', fontWeight: '700' }}>
                    {safeString(edu.studyType)}
                    {edu.area && ` in ${edu.area}`}
                  </h3>
                  <p className="text-gray-600 italic" style={{ fontSize: '10pt' }}>
                    {safeString(edu.institution)}
                  </p>
                </div>
                <span className="text-gray-500 italic" style={{ fontSize: '9pt' }}>
                  {edu.endDate || edu.startDate}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Skills & Expertise */}
      {skills.length > 0 && (
        <section className="mb-4">
          <h2
            className="text-gray-900 mb-3 pb-1"
            style={{
              fontSize: '11pt',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderBottom: '1px solid #1a1a1a',
            }}
          >
            Skills & Expertise
          </h2>
          <div className="text-gray-600" style={{ fontSize: '9.5pt', lineHeight: '1.6' }}>
            {skills.map((skillItem, i) => {
              // Handle both string and object formats
              if (typeof skillItem === 'string') {
                return (
                  <span key={i}>
                    {skillItem}
                    {i < skills.length - 1 && ', '}
                  </span>
                );
              }
              // Object format
              const keywords = skillItem.keywords || [skillItem.name];
              return keywords.map((skill: string, j: number) => (
                <span key={`${i}-${j}`}>
                  {skill}
                  {(i < skills.length - 1 || j < keywords.length - 1) && ', '}
                </span>
              ));
            })}
          </div>
        </section>
      )}

      {/* Key Projects */}
      {projects.length > 0 && (
        <section className="mb-4">
          <h2
            className="text-gray-900 mb-3 pb-1"
            style={{
              fontSize: '11pt',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderBottom: '1px solid #1a1a1a',
            }}
          >
            {isRTL ? 'المشاريع الرئيسية' : 'Key Projects'}
          </h2>
          <div className="space-y-3">
            {projects.map((project, i) => (
              <div key={i}>
                <h3 className="text-gray-900" style={{ fontSize: '10.5pt', fontWeight: '700' }}>
                  {safeString(project.name)}
                </h3>
                {project.highlights && project.highlights.length > 0 && (
                  <ul className="space-y-1 ps-4">
                    {project.highlights.map((h, j) => (
                      <li
                        key={j}
                        className="text-gray-700"
                        style={{
                          fontSize: '9.5pt',
                          listStyleType: 'none',
                          position: 'relative',
                          paddingInlineStart: '12px',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            insetInlineStart: '0',
                          }}
                        >
                          –
                        </span>
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
        <section className="mb-4">
          <h2
            className="text-gray-900 mb-3 pb-1"
            style={{
              fontSize: '11pt',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderBottom: '1px solid #1a1a1a',
            }}
          >
            {isRTL ? 'الشهادات' : 'Certifications'}
          </h2>
          <div className="space-y-2">
            {certificates.map((cert, i) => (
              <div key={i} className="flex justify-between">
                <div>
                  <h3 className="text-gray-900" style={{ fontSize: '10.5pt', fontWeight: '700' }}>
                    {safeString(cert.name)}
                  </h3>
                  {cert.issuer && (
                    <p className="text-gray-600" style={{ fontSize: '9.5pt' }}>
                      {cert.issuer}
                    </p>
                  )}
                </div>
                {cert.date && (
                  <span className="text-gray-500 italic" style={{ fontSize: '9pt' }}>
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
            className="text-gray-900 mb-2 pb-1"
            style={{
              fontSize: '11pt',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderBottom: '1px solid #1a1a1a',
            }}
          >
            {isRTL ? 'اللغات' : 'Languages'}
          </h2>
          <p className="text-gray-600" style={{ fontSize: '9.5pt' }}>
            {languages.map((lang) => `${lang.language} (${lang.fluency})`).join(', ')}
          </p>
        </section>
      )}
    </div>
  );
}

ClassicTraditional.displayName = 'Classic Traditional';
