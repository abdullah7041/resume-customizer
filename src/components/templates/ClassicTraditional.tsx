import type { TemplateProps } from './BaseTemplate';
import { ATSResume, A4_STYLES, safeString, scaledFontSize, safeLang } from './BaseTemplate';
import { useSectionLabel } from '../../hooks/useSectionLabel';

// Default display options if not provided
const DEFAULT_OPTIONS = {
  baseFontSize: 10.5,
  headingSize: 14,
  fontFamily: "'Georgia', 'Times New Roman', serif",
  sectionSpacing: 12,
  paragraphSpacing: 6,
  lineHeight: 1.45,
  marginTop: 0.5,
  marginBottom: 0.5,
  marginSide: 0.6,
};

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

  // Get profile links
  const normalizeUrl = (url?: string): string | null => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    if (url.includes('.')) return `https://${url}`;
    return null;
  };
  const resolveProfileUrl = (profile?: { url?: string; username?: string; network?: string }): string | null => {
    if (!profile) return null;
    const fromUrl = normalizeUrl(profile.url);
    if (fromUrl) return fromUrl;

    const id = profile.url || profile.username;
    if (id && !id.includes(' ') && !id.toLowerCase().includes(profile.network?.toLowerCase() || 'none')) {
      const net = profile.network?.toLowerCase();
      if (net === 'linkedin') return `https://linkedin.com/in/${id}`;
      if (net === 'github') return `https://github.com/${id}`;
    }

    const fromUsername = normalizeUrl(profile.username);
    if (fromUsername) return fromUsername;
    return null;
  };
  const linkedInProfile = basics.profiles?.find((p) => p.network?.toLowerCase() === 'linkedin');
  const linkedInUrl = resolveProfileUrl(linkedInProfile);
  const linkedInLabel = (linkedInProfile?.url || linkedInProfile?.username) && !linkedInUrl ? (linkedInProfile?.url || linkedInProfile?.username) : undefined;
  const portfolioProfile = basics.profiles?.find((p) => p.network?.toLowerCase() === 'portfolio' || p.network?.toLowerCase() === 'website');
  const portfolioUrl = normalizeUrl(basics.url) || resolveProfileUrl(portfolioProfile);
  const portfolioLabel = !portfolioUrl ? (basics.url || portfolioProfile?.url || portfolioProfile?.username || undefined) : undefined;

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
    letterSpacing: '0.08em',
    borderBottom: '1px solid #1a1a1a',
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
      {/* Centered Header with bold divider */}
      <header className="text-center mb-5 pb-4" style={{ borderBottom: '2px solid #1a1a1a' }}>
        <h1
          className="text-gray-900 mb-1"
          style={{
            fontSize: fs(24),
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
          }}
        >
          {safeString(basics.name)}
        </h1>
        {basics.label && (
          <p className="text-gray-600 mb-2" style={{ fontSize: fs(12), fontWeight: '600' }}>
            {basics.label}
          </p>
        )}
        <p className="text-gray-500 mb-1" style={{ fontSize: fs(10) }}>
          {basics.phone && <span>{basics.phone}</span>}
          {basics.email && (
            <>
              {basics.phone && <span>  |  </span>}
              <a href={`mailto:${basics.email}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{basics.email}</a>
            </>
          )}
          {basics.location?.city && (
            <>
              {(basics.phone || basics.email) && <span>  |  </span>}
              <span>
                {basics.location.city}
                {basics.location?.region && `, ${basics.location.region}`}
              </span>
            </>
          )}
        </p>
        {(linkedInUrl || linkedInLabel || portfolioUrl || portfolioLabel) && (
          <p style={{ fontSize: fs(10) }}>
            {(linkedInUrl || linkedInLabel) && (
              linkedInUrl ? (
                <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                  LinkedIn Account
                </a>
              ) : (
                <span>{linkedInLabel}</span>
              )
            )}
            {(linkedInUrl || linkedInLabel) && (portfolioUrl || portfolioLabel) && <span className="text-gray-400 mx-2">|</span>}
            {(portfolioUrl || portfolioLabel) && (
              portfolioUrl ? (
                <a href={portfolioUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                  Portfolio
                </a>
              ) : (
                <span>{portfolioLabel}</span>
              )
            )}
          </p>
        )}
      </header>

      {/* Professional Summary */}
      {basics.summary && (
        <section className="mb-4">
          <h2
            className="text-gray-900 mb-2 pb-1"
            style={{
              fontSize: fs(14),
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderBottom: '1px solid #1a1a1a',
            }}
          >
            {getSectionLabel('summary')}
          </h2>
          <p
            className="text-gray-700 italic text-justify"
            style={{ fontSize: fs(10.5), lineHeight: '1.55' }}
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
              fontSize: fs(14),
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderBottom: '1px solid #1a1a1a',
            }}
          >
            {getSectionLabel('workExperience')}
          </h2>
          <div className="space-y-4">
            {work.map((job, i) => (
              <div key={i} style={{ breakInside: 'avoid' }}>
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="text-gray-900" style={{ fontSize: fs(12), fontWeight: '700', minWidth: 0 }}>
                    {safeString(job.position)}
                  </h3>
                  <span className="text-gray-500 italic" style={{ fontSize: fs(10), flexShrink: 0, whiteSpace: 'nowrap', marginLeft: '8px' }}>
                    {job.startDate} – {job.endDate || 'Present'}
                  </span>
                </div>
                <p className="text-gray-600 italic mb-2" style={{ fontSize: fs(11) }}>
                  {safeString(job.name)}
                  {job.location && ` | ${job.location}`}
                </p>
                {job.highlights && job.highlights.length > 0 && (
                  <ul style={{ paddingLeft: '16px', margin: '2px 0 0 0', listStyleType: 'disc' }}>
                    {job.highlights.map((h, j) => (
                      <li key={j} className="text-gray-700" style={{ fontSize: fs(10.5), marginBottom: '1px', lineHeight: String(opts.lineHeight) }}>
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
            style={headingStyle}
          >
            {getSectionLabel('education')}
          </h2>
          <div className="space-y-3">
            {education.map((edu, i) => (
              <div key={i} style={{ breakInside: 'avoid' }}>
                <div className="flex justify-between">
                  <div>
                    <h3 className="text-gray-900" style={{ fontSize: fs(10.5), fontWeight: '700' }}>
                      {safeString(edu.studyType)}
                      {edu.area && ` in ${edu.area}`}
                    </h3>
                    <p className="text-gray-600 italic" style={{ fontSize: fs(10.5) }}>
                      {safeString(edu.institution)}
                    </p>
                    {edu.score && (
                      <p className="text-gray-600" style={{ fontSize: fs(10.5) }}>
                        GPA: {edu.score}
                      </p>
                    )}
                    {edu.courses && edu.courses.length > 0 && (
                      <p className="text-gray-600 italic" style={{ fontSize: fs(10.5), marginTop: '2px' }}>
                        Relevant Coursework: {edu.courses.join(' · ')}
                      </p>
                    )}
                  </div>
                  <span className="text-gray-500 italic" style={{ fontSize: fs(10) }}>
                    {edu.endDate || edu.startDate}
                  </span>
                </div>
                {edu.highlights && edu.highlights.length > 0 && (
                  <ul style={{ paddingLeft: '16px', margin: '2px 0 0 0', listStyleType: 'disc' }}>
                    {edu.highlights.map((h, j) => (
                      <li key={j} className="text-gray-700" style={{ fontSize: fs(10.5), marginBottom: '1px', lineHeight: String(opts.lineHeight) }}>
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

      {/* Skills & Expertise */}
      {skills.length > 0 && (
        <section style={sectionStyle}>
          <h2
            className="text-gray-900"
            style={headingStyle}
          >
            {getSectionLabel('skillsExpertise')}
          </h2>
          <div className="text-gray-600" style={{ fontSize: fs(10.5), lineHeight: '1.6' }}>
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
        <section style={sectionStyle}>
          <h2
            className="text-gray-900"
            style={headingStyle}
          >
            {getSectionLabel('keyProjects')}
          </h2>
          <div className="space-y-3">
            {projects.map((project, i) => (
              <div key={i} style={{ breakInside: 'avoid' }}>
                <h3 className="text-gray-900" style={{ fontSize: fs(11), fontWeight: '700' }}>
                  {safeString(project.name)}
                </h3>
                {project.description && (
                  <p className="text-gray-600 mb-1" style={{ fontSize: fs(10.5) }}>{project.description}</p>
                )}
                {project.highlights && project.highlights.length > 0 && (
                  <ul style={{ paddingLeft: '16px', margin: '2px 0 0 0', listStyleType: 'disc' }}>
                    {project.highlights.map((h, j) => (
                      <li key={j} className="text-gray-700" style={{ fontSize: fs(10.5), marginBottom: '1px', lineHeight: String(opts.lineHeight) }}>
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
            className="text-gray-900"
            style={headingStyle}
          >
            {getSectionLabel('certifications')}
          </h2>
          <div className="space-y-2">
            {certificates.map((cert, i) => (
              <div key={i} className="flex justify-between">
                <div>
                  <h3 className="text-gray-900" style={{ fontSize: fs(10.5), fontWeight: '700' }}>
                    {safeString(cert.name)}
                  </h3>
                  {cert.issuer && (
                    <p className="text-gray-600" style={{ fontSize: fs(10.5) }}>
                      {cert.issuer}
                    </p>
                  )}
                </div>
                {cert.date && (
                  <span className="text-gray-500 italic" style={{ fontSize: fs(10) }}>
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
            style={headingStyle}
          >
            {getSectionLabel('languages')}
          </h2>
          <p className="text-gray-600" style={{ fontSize: fs(10.5) }}>
            {languages.map((lang) => { const { language, fluency } = safeLang(lang); return fluency ? `${language} (${fluency})` : language; }).join(', ')}
          </p>
        </section>
      )}
    </div>
  );
}

ClassicTraditional.displayName = 'Classic Traditional';
