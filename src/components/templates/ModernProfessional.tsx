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

  const { basics, work = [], education = [], skills = [], projects = [], languages = [] } = resume;

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
        fontSize: '9.5pt',
        lineHeight: '1.55',
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header - Large name, subtle headline */}
      <header className="mb-7 pb-5" style={{ borderBottom: '1px solid #e5e5e5' }}>
        <h1
          className="text-gray-900 mb-1"
          style={{
            fontSize: '26pt',
            fontWeight: '600',
            letterSpacing: '-0.02em',
          }}
        >
          {safeString(basics.name)}
        </h1>
        {basics.label && (
          <p
            className="text-gray-500 mb-3"
            style={{ fontSize: '10.5pt', fontWeight: '400' }}
          >
            {basics.label}
          </p>
        )}
        <div
          className="flex flex-wrap gap-3 text-gray-400"
          style={{ fontSize: '8.5pt' }}
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
          {basics.profiles?.find((p) => p.network?.toLowerCase() === 'linkedin')?.url && (
            <>
              <span className="text-gray-300">·</span>
              <span>
                {basics.profiles
                  .find((p) => p.network?.toLowerCase() === 'linkedin')
                  ?.url?.replace('https://', '')
                  .replace('www.', '')}
              </span>
            </>
          )}
        </div>
      </header>

      {/* Summary / About */}
      {basics.summary && (
        <section className="mb-5">
          <h2
            className="text-gray-400 mb-3"
            style={{
              fontSize: '7.5pt',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}
          >
            {isRTL ? 'نبذة عني' : 'About'}
          </h2>
          <p className="text-gray-600" style={{ lineHeight: '1.6' }}>
            {basics.summary}
          </p>
        </section>
      )}

      {/* Experience */}
      {work.length > 0 && (
        <section className="mb-5">
          <h2
            className="text-gray-400 mb-3"
            style={{
              fontSize: '7.5pt',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}
          >
            {isRTL ? 'الخبرة العملية' : 'Experience'}
          </h2>
          <div className="space-y-4">
            {work.map((job, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline">
                  <h3 className="text-gray-900" style={{ fontSize: '10pt', fontWeight: '600' }}>
                    {safeString(job.position)}
                  </h3>
                  <span className="text-gray-400" style={{ fontSize: '8.5pt' }}>
                    {job.startDate} — {job.endDate || 'Present'}
                  </span>
                </div>
                <p className="text-gray-500 mb-1" style={{ fontSize: '9pt' }}>
                  {safeString(job.name)}
                  {job.location && `, ${job.location}`}
                </p>
                {job.highlights && job.highlights.length > 0 && (
                  <ul className="mt-1 ps-4" style={{ margin: '4px 0 0 0' }}>
                    {job.highlights.map((h, j) => (
                      <li
                        key={j}
                        className="text-gray-500"
                        style={{
                          fontSize: '9pt',
                          marginBottom: '2px',
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
            className="text-gray-400 mb-3"
            style={{
              fontSize: '7.5pt',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}
          >
            {isRTL ? 'المشاريع' : 'Projects'}
          </h2>
          <div className="space-y-3">
            {projects.map((project, i) => (
              <div key={i}>
                <h3 className="text-gray-900" style={{ fontSize: '10pt', fontWeight: '600' }}>
                  {safeString(project.name)}
                </h3>
                {project.highlights && project.highlights.length > 0 && (
                  <ul className="mt-1 ps-4">
                    {project.highlights.map((h, j) => (
                      <li
                        key={j}
                        className="text-gray-500"
                        style={{
                          fontSize: '9pt',
                          marginBottom: '2px',
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
            className="text-gray-400 mb-3"
            style={{
              fontSize: '7.5pt',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}
          >
            {isRTL ? 'التعليم' : 'Education'}
          </h2>
          <div className="space-y-2">
            {education.map((edu, i) => (
              <div key={i} className="flex justify-between items-baseline">
                <div>
                  <h3 className="text-gray-900" style={{ fontSize: '10pt', fontWeight: '600' }}>
                    {safeString(edu.institution)}
                  </h3>
                  <p className="text-gray-500" style={{ fontSize: '9pt' }}>
                    {safeString(edu.studyType)}
                    {edu.area && ` in ${edu.area}`}
                  </p>
                </div>
                <span className="text-gray-400" style={{ fontSize: '8.5pt' }}>
                  {edu.startDate} — {edu.endDate}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <section className="mb-5">
          <h2
            className="text-gray-400 mb-3"
            style={{
              fontSize: '7.5pt',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}
          >
            {isRTL ? 'المهارات' : 'Skills'}
          </h2>
          <div className="space-y-1">
            {skills
              .filter((s) => s.name?.toLowerCase() !== 'recommended skills')
              .map((skillGroup, i) => (
                <div key={i} style={{ fontSize: '9pt' }}>
                  {skillGroup.name && skillGroup.name.toLowerCase() !== 'skills' && (
                    <span className="text-gray-500 font-semibold">{skillGroup.name}: </span>
                  )}
                  <span className="text-gray-500">
                    {Array.isArray(skillGroup.keywords)
                      ? skillGroup.keywords.join('  ·  ')
                      : skillGroup.name}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Languages */}
      {languages.length > 0 && (
        <section>
          <h2
            className="text-gray-400 mb-3"
            style={{
              fontSize: '7.5pt',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}
          >
            {isRTL ? 'اللغات' : 'Languages'}
          </h2>
          <div className="flex flex-wrap gap-4">
            {languages.map((lang, i) => (
              <span key={i} className="text-gray-500" style={{ fontSize: '9pt' }}>
                <strong>{lang.language}</strong>: {lang.fluency}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

ModernProfessional.displayName = 'Modern Professional';
