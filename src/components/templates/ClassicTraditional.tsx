import type { TemplateProps } from './BaseTemplate';
import { ATSResume, A4_STYLES, safeString } from './BaseTemplate';
import { useDirection } from '../providers/DirectionProvider';

/**
 * Classic Traditional Template
 * Timeless two-column layout with elegant serif typography
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

  const { basics, work = [], education = [], skills = [], projects = [], languages = [] } = resume;

  return (
    <div
      className="bg-white text-gray-900 font-serif"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        width: A4_STYLES.width,
        minHeight: A4_STYLES.minHeight,
        padding: '25mm 20mm',
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Centered Header */}
      <header className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-widest mb-2">
          {safeString(basics.name)}
        </h1>
        <div className="w-16 h-0.5 bg-gray-400 mx-auto mb-3" />
        {basics.label && (
          <p className="text-gray-600 italic mb-2">{basics.label}</p>
        )}
        <p className="text-sm text-gray-500">
          {[basics.email, basics.phone, basics.location?.city]
            .filter(Boolean)
            .join(' • ')}
        </p>
      </header>

      {/* Two-column layout */}
      <div className="grid grid-cols-3 gap-8">
        {/* Sidebar */}
        <div className="col-span-1 space-y-6">
          {/* Skills */}
          {skills.length > 0 && (
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 border-b border-gray-300 pb-1 mb-3">
                {isRTL ? 'الخبرات' : 'Expertise'}
              </h2>
              <ul className="space-y-1 text-sm text-gray-700">
                {skills
                  .flatMap((s) => s.keywords || [s.name])
                  .slice(0, 10)
                  .map((skill, i) => (
                    <li key={i}>• {skill}</li>
                  ))}
              </ul>
            </section>
          )}

          {/* Education */}
          {education.length > 0 && (
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 border-b border-gray-300 pb-1 mb-3">
                {isRTL ? 'التعليم' : 'Education'}
              </h2>
              {education.map((edu, i) => (
                <div key={i} className="mb-3 text-sm">
                  <p className="font-semibold text-gray-900">
                    {safeString(edu.studyType)}
                    {edu.area && ` in ${edu.area}`}
                  </p>
                  <p className="text-gray-600">{safeString(edu.institution)}</p>
                  <p className="text-gray-500 text-xs">{edu.endDate}</p>
                </div>
              ))}
            </section>
          )}

          {/* Languages */}
          {languages.length > 0 && (
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 border-b border-gray-300 pb-1 mb-3">
                {isRTL ? 'اللغات' : 'Languages'}
              </h2>
              <ul className="space-y-1 text-sm text-gray-700">
                {languages.map((lang, i) => (
                  <li key={i}>
                    {lang.language} — {lang.fluency}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Main Content */}
        <div className="col-span-2">
          {/* Summary */}
          {basics.summary && (
            <section className="mb-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 border-b border-gray-300 pb-1 mb-3">
                {isRTL ? 'الملف الشخصي' : 'Professional Profile'}
              </h2>
              <p className="text-gray-700 leading-relaxed text-sm">
                {basics.summary}
              </p>
            </section>
          )}

          {/* Experience */}
          {work.length > 0 && (
            <section className="mb-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 border-b border-gray-300 pb-1 mb-3">
                {isRTL ? 'الخبرة المهنية' : 'Professional Experience'}
              </h2>
              <div className="space-y-5">
                {work.map((job, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-semibold text-gray-900">
                        {safeString(job.position)}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {job.startDate}
                        {job.endDate && ` – ${job.endDate}`}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 italic mb-2">
                      {safeString(job.name)}
                    </p>
                    {job.highlights && job.highlights.length > 0 && (
                      <ul className="text-sm text-gray-700 space-y-1">
                        {job.highlights.map((item, j) => (
                          <li
                            key={j}
                            className="ps-4 relative before:content-['–'] before:absolute before:start-0"
                          >
                            {item}
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
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 border-b border-gray-300 pb-1 mb-3">
                {isRTL ? 'المشاريع' : 'Projects'}
              </h2>
              <div className="space-y-4">
                {projects.map((project, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-semibold text-gray-900">
                        {safeString(project.name)}
                      </h3>
                      {project.startDate && (
                        <span className="text-xs text-gray-500">
                          {project.startDate}
                          {project.endDate && ` – ${project.endDate}`}
                        </span>
                      )}
                    </div>
                    {project.description && (
                      <p className="text-sm text-gray-600 mb-1">
                        {project.description}
                      </p>
                    )}
                    {project.highlights && project.highlights.length > 0 && (
                      <ul className="text-sm text-gray-700 space-y-1">
                        {project.highlights.map((h, j) => (
                          <li
                            key={j}
                            className="ps-4 relative before:content-['–'] before:absolute before:start-0"
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
        </div>
      </div>
    </div>
  );
}

ClassicTraditional.displayName = 'Classic Traditional';



