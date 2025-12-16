import type { TemplateProps } from './BaseTemplate';
import { ATSResume, A4_STYLES, safeString, formatContactLine } from './BaseTemplate';
import { useDirection } from '../providers/DirectionProvider';

/**
 * Modern Professional Template
 * Clean, contemporary design with emerald accent colors
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
      className="bg-white text-gray-900 font-sans"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        width: A4_STYLES.width,
        minHeight: A4_STYLES.minHeight,
        padding: A4_STYLES.padding,
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <header className="border-b-2 border-emerald-600 pb-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">
          {safeString(basics.name)}
        </h1>
        {basics.label && (
          <p className="text-lg text-emerald-600 font-medium mb-3">
            {basics.label}
          </p>
        )}
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          {basics.email && <span>{basics.email}</span>}
          {basics.phone && <span>{basics.phone}</span>}
          {basics.location?.city && (
            <span>
              {[basics.location.city, basics.location.region]
                .filter(Boolean)
                .join(', ')}
            </span>
          )}
          {basics.profiles?.map((profile, i) => (
            <span key={i}>{profile.url || profile.username}</span>
          ))}
        </div>
      </header>

      {/* Summary */}
      {basics.summary && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-wide mb-2 border-b border-gray-200 pb-1">
            {isRTL ? 'الملخص المهني' : 'Professional Summary'}
          </h2>
          <p className="text-gray-700 leading-relaxed">{basics.summary}</p>
        </section>
      )}

      {/* Experience */}
      {work.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-wide mb-3 border-b border-gray-200 pb-1">
            {isRTL ? 'الخبرة العملية' : 'Work Experience'}
          </h2>
          <div className="space-y-4">
            {work.map((job, i) => (
              <div key={i} className="relative">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {safeString(job.position)}
                    </h3>
                    <p className="text-emerald-600">{safeString(job.name)}</p>
                  </div>
                  <span className="text-sm text-gray-500">
                    {job.startDate}
                    {job.endDate && ` - ${job.endDate}`}
                  </span>
                </div>
                {job.highlights && job.highlights.length > 0 && (
                  <ul className="list-disc list-inside text-gray-700 space-y-1 mt-2">
                    {job.highlights.map((highlight, j) => (
                      <li key={j} className="text-sm">
                        {highlight}
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
          <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-wide mb-3 border-b border-gray-200 pb-1">
            {isRTL ? 'المشاريع' : 'Projects'}
          </h2>
          <div className="space-y-4">
            {projects.map((project, i) => (
              <div key={i}>
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-gray-900">
                    {safeString(project.name)}
                  </h3>
                  {project.startDate && (
                    <span className="text-sm text-gray-500">
                      {project.startDate}
                      {project.endDate && ` - ${project.endDate}`}
                    </span>
                  )}
                </div>
                {project.description && (
                  <p className="text-gray-700 text-sm mb-1">
                    {project.description}
                  </p>
                )}
                {project.highlights && project.highlights.length > 0 && (
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    {project.highlights.map((h, j) => (
                      <li key={j} className="text-sm">
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
          <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-wide mb-3 border-b border-gray-200 pb-1">
            {isRTL ? 'التعليم' : 'Education'}
          </h2>
          <div className="space-y-3">
            {education.map((edu, i) => (
              <div key={i} className="flex justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {safeString(edu.studyType)} {edu.area && `in ${edu.area}`}
                  </h3>
                  <p className="text-gray-600">{safeString(edu.institution)}</p>
                </div>
                <span className="text-sm text-gray-500">{edu.endDate}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-wide mb-3 border-b border-gray-200 pb-1">
            {isRTL ? 'المهارات' : 'Skills'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {skills.flatMap((skillGroup, i) =>
              skillGroup.keywords?.map((skill, j) => (
                <span
                  key={`${i}-${j}`}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  {skill}
                </span>
              )) || (
                <span
                  key={i}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  {skillGroup.name}
                </span>
              )
            )}
          </div>
        </section>
      )}

      {/* Languages */}
      {languages.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-wide mb-3 border-b border-gray-200 pb-1">
            {isRTL ? 'اللغات' : 'Languages'}
          </h2>
          <div className="flex flex-wrap gap-4">
            {languages.map((lang, i) => (
              <span key={i} className="text-gray-700">
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
