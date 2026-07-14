import type { TemplateProps } from './BaseTemplate';
import { ATSResume, A4_STYLES, safeString, scaledFontSize, safeLang, cleanHighlight, filterEducationHighlights } from './BaseTemplate';
import { useSectionLabel } from '../../hooks/useSectionLabel';
import { normalizeUrl, resolveProfileUrl } from '@/lib/utils/profileUrl';

// Default display options if not provided
const DEFAULT_OPTIONS = {
  baseFontSize: 10.5,
  headingSize: 13,
  nameSize: 20,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  sectionSpacing: 8,
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
  contentDirection = 'ltr',
}: TemplateProps) {
  const getSectionLabel = useSectionLabel();

  // Merge displayOptions with defaults
  const opts = { ...DEFAULT_OPTIONS, ...displayOptions };

  // ATS mode returns pure semantic HTML
  if (isAtsMode) {
    return <ATSResume resume={resume} />;
  }

  const { basics, work = [], education = [], skills = [], projects = [], languages = [], certificates = [] } = resume;

  const linkedInProfile = basics.profiles?.find((p) => p.network?.toLowerCase() === 'linkedin');
  const linkedInUrl = resolveProfileUrl(linkedInProfile);
  const linkedInLabel = (linkedInProfile?.url || linkedInProfile?.username) && !linkedInUrl ? (linkedInProfile?.url || linkedInProfile?.username) : undefined;
  const portfolioProfile = basics.profiles?.find((p) => p.network?.toLowerCase() === 'portfolio' || p.network?.toLowerCase() === 'website');
  const portfolioUrl = normalizeUrl(basics.url) || resolveProfileUrl(portfolioProfile);
  const portfolioLabel = !portfolioUrl ? (basics.url || portfolioProfile?.url || portfolioProfile?.username || undefined) : undefined;

  // Helper for scaled fonts - use displayOptions.baseFontSize or legacy fontScale
  const fs = (pt: number) => {
    if (displayOptions?.baseFontSize) {
      const scaleFactor = displayOptions.baseFontSize / 10.5;
      return scaledFontSize(pt, scaleFactor);
    }
    return scaledFontSize(pt, fontScale);
  };
  const nameFontSize = displayOptions
    ? `${opts.nameSize ?? 20}pt`
    : scaledFontSize(opts.nameSize ?? 20, fontScale);

  // Dynamic margins based on displayOptions

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
        paddingTop: `${opts.marginTop * 25.4}mm`,
        paddingBottom: `${opts.marginTop * 25.4}mm`,
        paddingLeft: `${opts.marginSide * 25.4}mm`,
        paddingRight: `${opts.marginSide * 25.4}mm`,
        fontFamily: opts.fontFamily,
        fontSize: `${opts.baseFontSize}pt`,
        lineHeight: String(opts.lineHeight),
      }}
      dir={contentDirection}
    >
      {/* Header - Large name, subtle headline */}
      <header className="mb-7 pb-5" style={{ borderBottom: '1px solid #d1d5db' }}>
        <h1
          className="text-gray-900 mb-1"
          style={{
            fontSize: nameFontSize,
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
              {basics.location?.region &&
                basics.location.region !== basics.location.city &&
                `, ${basics.location.region}`}
            </span>
          )}
          {basics.email && (
            <>
              <span className="text-gray-300">·</span>
              <a href={`mailto:${basics.email}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{basics.email}</a>
            </>
          )}
          {basics.phone && (
            <>
              <span className="text-gray-300">·</span>
              <span>{basics.phone}</span>
            </>
          )}
          {(linkedInUrl || linkedInLabel) && (
            <>
              <span className="text-gray-300 mx-2">·</span>
              {linkedInUrl ? (
                <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                  LinkedIn Account
                </a>
              ) : (
                <span>{linkedInLabel}</span>
              )}
            </>
          )}
          {(portfolioUrl || portfolioLabel) && (
            <>
              <span className="text-gray-300 mx-2">·</span>
              {portfolioUrl ? (
                <a href={portfolioUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                  Portfolio
                </a>
              ) : (
                <span>{portfolioLabel}</span>
              )}
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
          <p className="text-gray-700" style={{ lineHeight: String(opts.lineHeight), orphans: 2, widows: 2 }}>
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
              borderBottom: '0.5px solid #e5e7eb',
              paddingBottom: '8px'
            }}
          >
            {getSectionLabel('experience')}
          </h2>
          <div className="space-y-5">
          {work.map((job, jobIndex) => (
            <div key={`${job.name}-${job.position}-${job.startDate}-${job.endDate}-${jobIndex}`} style={{ breakInside: (job.highlights && job.highlights.length > 4) ? 'auto' : 'avoid' }}>
                <div style={{ breakAfter: (job.highlights && job.highlights.length > 4) ? 'avoid' : 'auto' }}>
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="text-gray-900" style={{ fontSize: fs(12), fontWeight: '700', minWidth: 0, overflow: 'hidden' }}>
                      {safeString(job.position)}
                    </h3>
                    <span className="text-gray-600 font-medium" style={{ fontSize: fs(10), flexShrink: 0, whiteSpace: 'nowrap', marginLeft: '8px' }}>
                      {job.startDate} — {job.endDate || 'Present'}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-2 font-medium" style={{ fontSize: fs(11) }}>
                    {safeString(job.name)}
                    {job.location && ` | ${job.location}`}
                  </p>
                </div>
                {job.highlights && job.highlights.length > 0 && (
                  <ul style={{ paddingLeft: '16px', margin: '2px 0 0 0', listStyleType: 'disc' }}>
                    {job.highlights.map((h, j) => (
                      <li key={j} className="text-gray-600" style={{ fontSize: fs(10.5), marginBottom: '1px', lineHeight: String(opts.lineHeight), orphans: 2, widows: 2 }}>
                        {cleanHighlight(h)}
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
              borderBottom: '0.5px solid #e5e7eb',
              paddingBottom: '8px'
            }}
          >
            {getSectionLabel('projects')}
          </h2>
          <div className="space-y-4">
          {projects.map((project, projectIndex) => (
            <div key={`${project.name}-${projectIndex}`} style={{ breakInside: (project.highlights && project.highlights.length > 4) ? 'auto' : 'avoid' }}>
                <div style={{ breakAfter: (project.highlights && project.highlights.length > 4) ? 'avoid' : 'auto' }}>
                  <h3 className="text-gray-900 mb-1" style={{ fontSize: fs(11.5), fontWeight: '700' }}>
                    {safeString(project.name)}
                  </h3>
                  {project.description && (
                    <p className="text-gray-600 mb-1" style={{ fontSize: fs(10.5), orphans: 2, widows: 2 }}>{project.description}</p>
                  )}
                </div>
                {project.highlights && project.highlights.length > 0 && (
                  <ul style={{ paddingLeft: '16px', margin: '2px 0 0 0', listStyleType: 'disc' }}>
                    {project.highlights.map((h, j) => (
                      <li key={j} className="text-gray-600" style={{ fontSize: fs(10.5), marginBottom: '1px', lineHeight: String(opts.lineHeight), orphans: 2, widows: 2 }}>
                        {cleanHighlight(h)}
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
          {education.map((edu, educationIndex) => (
            <div key={`${edu.institution}-${edu.studyType}-${educationIndex}`} style={{ breakInside: (edu.highlights && edu.highlights.length > 4) ? 'auto' : 'avoid' }}>
                <div style={{ breakAfter: (edu.highlights && edu.highlights.length > 4) ? 'avoid' : 'auto' }}>
                  <div className="flex justify-between items-baseline">
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
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
                    <span className="text-gray-600 font-medium" style={{ fontSize: fs(10), flexShrink: 0, whiteSpace: 'nowrap', marginLeft: '8px' }}>
                      {edu.startDate} — {edu.endDate}
                    </span>
                  </div>
                </div>
                {filterEducationHighlights(edu.highlights).length > 0 && (
                  <ul style={{ paddingLeft: '16px', margin: '2px 0 0 0', listStyleType: 'disc' }}>
                    {filterEducationHighlights(edu.highlights).map((h, j) => (
                      <li key={j} className="text-gray-600" style={{ fontSize: fs(10.5), marginBottom: '1px', lineHeight: String(opts.lineHeight), orphans: 2, widows: 2 }}>
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
            {skills.map((skillItem, skillIndex) => {
              // Handle both string and object formats
              if (typeof skillItem === 'string') {
                return (
                  <span key={`${skillItem}-${skillIndex}`} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-md font-medium" style={{ fontSize: fs(10) }}>
                    {skillItem}
                  </span>
                );
              }
              // Object format
              const keywords = skillItem.keywords || [skillItem.name];
              return keywords.map((skill: string, keywordIndex: number) => (
                  <span key={`${skillItem.name}-${skill}-${skillIndex}-${keywordIndex}`} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-md font-medium" style={{ fontSize: fs(10) }}>
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
            {certificates.map((cert, certificateIndex) => (
              <div key={`${cert.name}-${cert.date}-${certificateIndex}`} className="flex justify-between items-baseline">
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
            {languages.map((lang, languageIndex) => {
              const { language, fluency } = safeLang(lang);
              return (
                <span key={`${language}-${languageIndex}`} className="text-gray-600" style={{ fontSize: fs(10.5) }}>
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
