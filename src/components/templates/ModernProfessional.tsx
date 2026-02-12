import type { TemplateProps } from './BaseTemplate';
import { ATSResume, A4_STYLES, safeString, scaledFontSize, safeLang } from './BaseTemplate';
import { useSectionLabel } from '../../hooks/useSectionLabel';

// Default display options if not provided
const DEFAULT_OPTIONS = {
  baseFontSize: 10.5,
  headingSize: 14,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  sectionSpacing: 12,
  paragraphSpacing: 6,
  lineHeight: 1.55,
  marginTop: 0.5,
  marginBottom: 0.5,
  marginSide: 0.6,
};

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

  const { basics, work = [], education = [], skills = [], projects = [], languages = [], certificates = [] } = resume;

  // Get profile links - prevent duplicates
  const linkedInUrl = basics.profiles?.find((p) => p.network?.toLowerCase() === 'linkedin')?.url;
  const portfolioUrl = basics.url || basics.profiles?.find((p) => p.network?.toLowerCase() === 'portfolio' || p.network?.toLowerCase() === 'website')?.url;

  // Helper for scaled fonts - use displayOptions.baseFontSize or legacy fontScale
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
    fontWeight: '800' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
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
      // Always LTR for resume content - resumes are typically English
      // Section headings translate based on UI language, but content stays LTR
      dir="ltr"
    >
      {/* Header - Large name, subtle headline */}
      <header className="mb-7 pb-5" style={{ borderBottom: '2px solid #111827' }}>
        <h1
          className="text-gray-900 mb-1"
          style={{
            fontSize: fs(24),
            fontWeight: '800',
            letterSpacing: '-0.02em',
          }}
        >
          {safeString(basics.name)}
        </h1>
        {basics.label && (
          <p
            className="text-gray-600 mb-3"
            style={{ fontSize: fs(12), fontWeight: '600' }}
          >
            {basics.label}
          </p>
        )}
        <div
          className="flex flex-wrap gap-3 text-gray-500"
          style={{ fontSize: fs(10) }}
        >
          {basics.location?.city && (
            <span>
              {basics.location.city}
              {basics.location?.region && `, ${basics.location.region}`}
            </span>
          )}
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
        <section style={sectionStyle}>
          <h2
            className="text-gray-900"
            style={{ ...headingStyle, marginBottom: `${opts.paragraphSpacing}px` }}
          >
            {getSectionLabel('about')}
          </h2>
          <p className="text-gray-700" style={{ lineHeight: String(opts.lineHeight) }}>
            {basics.summary}
          </p>
        </section>
      )}

      {/* Experience */}
      {work.length > 0 && (
        <section style={sectionStyle}>
          <h2
            className="text-gray-900"
            style={{
              ...headingStyle,
              marginBottom: `${opts.paragraphSpacing}px`,
              borderBottom: '1px solid #e5e5e5',
              paddingBottom: '8px'
            }}
          >
            {getSectionLabel('experience')}
          </h2>
          <div className="space-y-5">
            {work.map((job, i) => (
              <div key={i} style={{ breakInside: 'avoid' }}>
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="text-gray-900" style={{ fontSize: fs(12), fontWeight: '700' }}>
                    {safeString(job.position)}
                  </h3>
                  <span className="text-gray-600 font-medium" style={{ fontSize: fs(10) }}>
                    {job.startDate} — {job.endDate || 'Present'}
                  </span>
                </div>
                <p className="text-gray-600 mb-2 font-medium" style={{ fontSize: fs(11) }}>
                  {safeString(job.name)}
                  {job.location && ` | ${job.location}`}
                </p>
                {job.highlights && job.highlights.length > 0 && (
                  <ul className="ps-4 space-y-1">
                    {job.highlights.map((h, j) => (
                      <li
                        key={j}
                        className="text-gray-600 relative pl-2"
                        style={{
                          fontSize: fs(10.5),
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
        <section style={sectionStyle}>
          <h2
            className="text-gray-900"
            style={{
              ...headingStyle,
              marginBottom: `${opts.paragraphSpacing}px`,
              borderBottom: '1px solid #e5e5e5',
              paddingBottom: '8px'
            }}
          >
            {getSectionLabel('projects')}
          </h2>
          <div className="space-y-4">
            {projects.map((project, i) => (
              <div key={i} style={{ breakInside: 'avoid' }}>
                <h3 className="text-gray-900 mb-1" style={{ fontSize: fs(11.5), fontWeight: '700' }}>
                  {safeString(project.name)}
                </h3>
                {project.description && (
                  <p className="text-gray-600 mb-1" style={{ fontSize: fs(10.5) }}>{project.description}</p>
                )}
                {project.highlights && project.highlights.length > 0 && (
                  <ul className="ps-4 space-y-1">
                    {project.highlights.map((h, j) => (
                      <li
                        key={j}
                        className="text-gray-600 relative pl-2"
                        style={{
                          fontSize: fs(10.5),
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
        <section style={sectionStyle}>
          <h2
            className="text-gray-900"
            style={{ ...headingStyle, marginBottom: `${opts.paragraphSpacing}px` }}
          >
            {getSectionLabel('education')}
          </h2>
          <div className="space-y-3">
            {education.map((edu, i) => (
              <div key={i} style={{ breakInside: 'avoid' }}>
                <div className="flex justify-between items-baseline">
                  <div>
                    <h3 className="text-gray-900" style={{ fontSize: fs(11), fontWeight: '700' }}>
                      {safeString(edu.institution)}
                    </h3>
                    <p className="text-gray-600" style={{ fontSize: fs(10.5) }}>
                      {safeString(edu.studyType)}
                      {edu.area && ` in ${edu.area}`}
                    </p>
                    {edu.score && (
                      <p className="text-gray-500" style={{ fontSize: fs(10) }}>
                        GPA: {edu.score}
                      </p>
                    )}
                    {edu.courses && edu.courses.length > 0 && (
                      <p className="text-gray-500" style={{ fontSize: fs(10), marginTop: '2px' }}>
                        Relevant Coursework: {edu.courses.join(' · ')}
                      </p>
                    )}
                  </div>
                  <span className="text-gray-600 font-medium" style={{ fontSize: fs(10) }}>
                    {edu.startDate} — {edu.endDate}
                  </span>
                </div>
                {edu.highlights && edu.highlights.length > 0 && (
                  <ul className="ps-4 space-y-1 mt-1">
                    {edu.highlights.map((h, j) => (
                      <li
                        key={j}
                        className="text-gray-600 relative pl-2"
                        style={{
                          fontSize: fs(10.5),
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

      {/* Skills */}
      {skills.length > 0 && (
        <section style={sectionStyle}>
          <h2
            className="text-gray-900"
            style={{ ...headingStyle, marginBottom: `${opts.paragraphSpacing}px` }}
          >
            {getSectionLabel('skills')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {skills.map((skillItem, i) => {
              // Handle both string and object formats
              if (typeof skillItem === 'string') {
                return (
                  <span key={i} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-md font-medium" style={{ fontSize: fs(10) }}>
                    {skillItem}
                  </span>
                );
              }
              // Object format
              const keywords = skillItem.keywords || [skillItem.name];
              return keywords.map((skill: string, j: number) => (
                <span key={`${i}-${j}`} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-md font-medium" style={{ fontSize: fs(10) }}>
                  {skill}
                </span>
              ));
            })}
          </div>
        </section>
      )}

      {/* Certificates */}
      {certificates.length > 0 && (
        <section style={sectionStyle}>
          <h2
            className="text-gray-900"
            style={{ ...headingStyle, marginBottom: `${opts.paragraphSpacing}px` }}
          >
            {getSectionLabel('certifications')}
          </h2>
          <div className="space-y-2">
            {certificates.map((cert, i) => (
              <div key={i} className="flex justify-between items-baseline">
                <div>
                  <h3 className="text-gray-900" style={{ fontSize: fs(10.5), fontWeight: '600' }}>
                    {safeString(cert.name)}
                  </h3>
                  {cert.issuer && (
                    <p className="text-gray-500" style={{ fontSize: fs(10.5) }}>
                      {cert.issuer}
                    </p>
                  )}
                </div>
                {cert.date && (
                  <span className="text-gray-400" style={{ fontSize: fs(10) }}>
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
            className="text-gray-900"
            style={{ ...headingStyle, marginBottom: `${opts.paragraphSpacing}px` }}
          >
            {getSectionLabel('languages')}
          </h2>
          <div className="flex flex-wrap gap-4">
            {languages.map((lang, i) => {
              const { language, fluency } = safeLang(lang);
              return (
                <span key={i} className="text-gray-600" style={{ fontSize: fs(10.5) }}>
                  <strong className="text-gray-900">{language}</strong>{fluency ? `: ${fluency}` : ''}
                </span>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

ModernProfessional.displayName = 'Modern Professional';
