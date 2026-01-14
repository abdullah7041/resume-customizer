import type { TemplateProps } from './BaseTemplate';
import { ATSResume, A4_STYLES, safeString } from './BaseTemplate';
import { useDirection } from '../providers/DirectionProvider';

/**
 * Modern Professional Template
 * Clean, contemporary design with generous whitespace
 * Sans-serif typography, thin dividers, subtle hierarchy
 * Supports RTL for Arabic
 */
export function ModernProfessional({
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

  // Get profile links - prevent duplicates
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
        padding: '24mm 22mm',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: '10.5pt',
        lineHeight: '1.55',
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header - Large name, subtle headline */}
      <header className="mb-7 pb-5" style={{ borderBottom: '2px solid #111827' }}>
        <h1
          className="text-gray-900 mb-1"
          style={{
            fontSize: '24pt',
            fontWeight: '800',
            letterSpacing: '-0.02em',
          }}
        >
          {safeString(basics.name)}
        </h1>
        {basics.label && (
          <p
            className="text-gray-600 mb-3"
            style={{ fontSize: '12pt', fontWeight: '600' }}
          >
            {basics.label}
          </p>
        )}
        <div
          className="flex flex-wrap gap-3 text-gray-500"
          style={{ fontSize: '10pt' }}
        >
          {basics.location?.city && <span>{basics.location.city}</span>}
          {basics.email && (
            <>
              <span className="text-gray-300">·</span>
              <span>{basics.email}</span>
            </>
          )}
          {basics.phone && (
            <>
              <span className="text-gray-300">·</span>
              <span>{basics.phone}</span>
            </>
          )}
          {linkedInUrl && (
            <>
              <span className="text-gray-300">·</span>
              <span>
                {linkedInUrl.replace('https://', '').replace('www.', '')}
              </span>
            </>
          )}
          {portfolioUrl && (
            <>
              <span className="text-gray-300">·</span>
              <span>
                {portfolioUrl.replace('https://', '').replace('www.', '')}
              </span>
            </>
          )}
        </div>
      </header>

      {/* Summary / About */}
      {basics.summary && (
        <section className="mb-6">
          <h2
            className="text-gray-900 mb-3"
            style={{
              fontSize: '14pt',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {isRTL ? 'نبذة عني' : 'About'}
          </h2>
          <p className="text-gray-700" style={{ lineHeight: '1.6' }}>
            {basics.summary}
          </p>
        </section>
      )}

      {/* Experience */}
      {work.length > 0 && (
        <section className="mb-6">
          <h2
            className="text-gray-900 mb-4"
            style={{
              fontSize: '14pt',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid #e5e5e5',
              paddingBottom: '8px'
            }}
          >
            {isRTL ? 'الخبرة العملية' : 'Experience'}
          </h2>
          <div className="space-y-5">
            {work.map((job, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="text-gray-900" style={{ fontSize: '12pt', fontWeight: '700' }}>
                    {safeString(job.position)}
                  </h3>
                  <span className="text-gray-600 font-medium" style={{ fontSize: '10pt' }}>
                    {job.startDate} — {job.endDate || 'Present'}
                  </span>
                </div>
                <p className="text-gray-600 mb-2 font-medium" style={{ fontSize: '11pt' }}>
                  {safeString(job.name)}
                  {job.location && `, ${job.location}`}
                </p>
                {job.highlights && job.highlights.length > 0 && (
                  <ul className="ps-4 space-y-1">
                    {job.highlights.map((h, j) => (
                      <li
                        key={j}
                        className="text-gray-600 relative pl-2"
                        style={{
                          fontSize: '10.5pt',
                          listStyleType: 'none',
                        }}
                      >
                        <span className="absolute left-0 top-2 w-1.5 h-1.5 bg-gray-900 rounded-full"></span>
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
        <section className="mb-6">
          <h2
            className="text-gray-900 mb-3"
            style={{
              fontSize: '14pt',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid #e5e5e5',
              paddingBottom: '8px'
            }}
          >
            {isRTL ? 'المشاريع' : 'Projects'}
          </h2>
          <div className="space-y-4">
            {projects.map((project, i) => (
              <div key={i}>
                <h3 className="text-gray-900 mb-1" style={{ fontSize: '11.5pt', fontWeight: '700' }}>
                  {safeString(project.name)}
                </h3>
                {project.highlights && project.highlights.length > 0 && (
                  <ul className="ps-4 space-y-1">
                    {project.highlights.map((h, j) => (
                      <li
                        key={j}
                        className="text-gray-600 relative pl-2"
                        style={{
                          fontSize: '10.5pt',
                          listStyleType: 'none',
                        }}
                      >
                        <span className="absolute left-0 top-2 w-1.5 h-1.5 bg-gray-900 rounded-full"></span>
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
        <section className="mb-6">
          <h2
            className="text-gray-900 mb-3"
            style={{
              fontSize: '14pt',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {isRTL ? 'التعليم' : 'Education'}
          </h2>
          <div className="space-y-3">
            {education.map((edu, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline">
                  <div>
                    <h3 className="text-gray-900" style={{ fontSize: '11pt', fontWeight: '700' }}>
                      {safeString(edu.institution)}
                    </h3>
                    <p className="text-gray-600" style={{ fontSize: '10.5pt' }}>
                      {safeString(edu.studyType)}
                      {edu.area && ` in ${edu.area}`}
                    </p>
                    {edu.score && (
                      <p className="text-gray-500" style={{ fontSize: '10pt' }}>
                        GPA: {edu.score}
                      </p>
                    )}
                    {edu.courses && edu.courses.length > 0 && (
                      <p className="text-gray-500" style={{ fontSize: '10pt', marginTop: '2px' }}>
                        Relevant Coursework: {edu.courses.join(' · ')}
                      </p>
                    )}
                  </div>
                  <span className="text-gray-600 font-medium" style={{ fontSize: '10pt' }}>
                    {edu.startDate} — {edu.endDate}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <section className="mb-6">
          <h2
            className="text-gray-900 mb-3"
            style={{
              fontSize: '14pt',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Skills
          </h2>
          <div className="flex flex-wrap gap-2">
            {skills.map((skillItem, i) => {
              // Handle both string and object formats
              if (typeof skillItem === 'string') {
                return (
                  <span key={i} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-md font-medium" style={{ fontSize: '10pt' }}>
                    {skillItem}
                  </span>
                );
              }
              // Object format
              const keywords = skillItem.keywords || [skillItem.name];
              return keywords.map((skill: string, j: number) => (
                <span key={`${i}-${j}`} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-md font-medium" style={{ fontSize: '10pt' }}>
                  {skill}
                </span>
              ));
            })}
          </div>
        </section>
      )}

      {/* Certificates */}
      {certificates.length > 0 && (
        <section className="mb-6">
          <h2
            className="text-gray-900 mb-3"
            style={{
              fontSize: '14pt',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {isRTL ? 'الشهادات' : 'Certifications'}
          </h2>
          <div className="space-y-2">
            {certificates.map((cert, i) => (
              <div key={i} className="flex justify-between items-baseline">
                <div>
                  <h3 className="text-gray-900" style={{ fontSize: '10.5pt', fontWeight: '600' }}>
                    {safeString(cert.name)}
                  </h3>
                  {cert.issuer && (
                    <p className="text-gray-500" style={{ fontSize: '10.5pt' }}>
                      {cert.issuer}
                    </p>
                  )}
                </div>
                {cert.date && (
                  <span className="text-gray-400" style={{ fontSize: '10pt' }}>
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
            className="text-gray-900 mb-3"
            style={{
              fontSize: '14pt',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {isRTL ? 'اللغات' : 'Languages'}
          </h2>
          <div className="flex flex-wrap gap-4">
            {languages.map((lang, i) => (
              <span key={i} className="text-gray-600" style={{ fontSize: '10.5pt' }}>
                <strong className="text-gray-900">{lang.language}</strong>: {lang.fluency}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

ModernProfessional.displayName = 'Modern Professional';
