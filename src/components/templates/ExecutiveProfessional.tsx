import type { CSSProperties } from 'react';
import type { TemplateProps } from './BaseTemplate';
import { ATSResume, A4_STYLES, safeString, scaledFontSize, safeLang, cleanHighlight, filterEducationHighlights } from './BaseTemplate';
import { useSectionLabel } from '../../hooks/useSectionLabel';
import { normalizeUrl, resolveProfileUrl } from '@/lib/utils/profileUrl';

// Default display options if not provided
const DEFAULT_OPTIONS = {
  baseFontSize: 10,
  headingSize: 12,
  nameSize: 20,
  fontFamily: "'Calibri', 'Arial', sans-serif",
  sectionSpacing: 8,
  paragraphSpacing: 4,
  lineHeight: 1.45,
  marginTop: 0.5,
  marginBottom: 0.4,
  marginSide: 0.6,
};

// Navy blue accent color matching resume design
const ACCENT_COLOR = '#1a5276';

/**
 * Executive Professional Template
 * Matches resume design:
 * - Centered bold name in dark color, subtitle in accent blue
 * - Contact line with clickable links separated by pipes
 * - Navy blue uppercase section headings with underline
 * - Work entries: underlined position, italic company/location below, date right-aligned
 * - Skills: bold category labels with inline keywords
 * - Education as "Qualifications" with bullet format
 * - Certifications with year and italic sub-details
 * - Languages inline with bullet separators
 */
export function ExecutiveProfessional({
  resume,
  isAtsMode = false,
  scale = 1,
  fontScale = 1,
  displayOptions,
  contentDirection = 'ltr',
}: TemplateProps) {
  const getSectionLabel = useSectionLabel();

  const opts = { ...DEFAULT_OPTIONS, ...displayOptions };

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

  const fs = (pt: number) => {
    if (displayOptions?.baseFontSize) {
      const scaleFactor = displayOptions.baseFontSize / 10;
      return scaledFontSize(pt, scaleFactor);
    }
    return scaledFontSize(pt, fontScale);
  };
  const nameFontSize = displayOptions
    ? `${opts.nameSize ?? 20}pt`
    : scaledFontSize(opts.nameSize ?? 20, fontScale);
  const headingFontSize = displayOptions
    ? `${opts.headingSize}pt`
    : scaledFontSize(opts.headingSize, fontScale);

  const sectionStyle = { marginBottom: `${opts.sectionSpacing}px` };
  const headingStyle: CSSProperties = {
    fontSize: headingFontSize,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: ACCENT_COLOR,
    textAlign: 'center',
    borderBottom: `1px solid ${ACCENT_COLOR}`,
    paddingBottom: '3px',
    marginBottom: `${opts.paragraphSpacing + 2}px`,
    pageBreakAfter: 'avoid',
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
      {/* Header - Centered, bold name, subtitle, contact links */}
      <header style={{ textAlign: 'center', marginBottom: `${opts.sectionSpacing + 2}px`, pageBreakInside: 'avoid' }}>
        <h1
          style={{
            fontSize: nameFontSize,
            fontWeight: '800',
            letterSpacing: '0.05em',
            color: '#1a5276',
            textTransform: 'uppercase',
            marginBottom: '2px',
          }}
        >
          {safeString(basics.name)}
        </h1>
        {basics.label && (
          <p
            style={{
              fontSize: fs(11),
              fontWeight: '600',
              color: ACCENT_COLOR,
              marginBottom: '6px',
            }}
          >
            {basics.label}
          </p>
        )}
        {/* Contact line — phone | email | location | LinkedIn | Portfolio */}
        <p style={{ fontSize: fs(9), color: '#444', letterSpacing: '0.01em' }}>
          {basics.phone && <span>{basics.phone}</span>}
          {basics.email && (
            <>
              {basics.phone && <span style={{ color: '#999', margin: '0 6px' }}>|</span>}
              <a href={`mailto:${basics.email}`} style={{ color: ACCENT_COLOR, textDecoration: 'none' }}>{basics.email}</a>
            </>
          )}
          {basics.location?.city && (
            <>
              <span style={{ color: '#999', margin: '0 6px' }}>|</span>
              <span>{[basics.location.city, basics.location.region !== basics.location.city ? basics.location.region : undefined].filter(Boolean).join(', ')}</span>
            </>
          )}
          {(linkedInUrl || linkedInLabel) && (
            <>
              <span style={{ color: '#999', margin: '0 6px' }}>|</span>
              {linkedInUrl ? (
                <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT_COLOR, textDecoration: 'underline' }}>LinkedIn Account</a>
              ) : (
                <span>{linkedInLabel}</span>
              )}
            </>
          )}
          {(portfolioUrl || portfolioLabel) && (
            <>
              <span style={{ color: '#999', margin: '0 6px' }}>|</span>
              {portfolioUrl ? (
                <a href={portfolioUrl} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT_COLOR, textDecoration: 'underline' }}>Portfolio</a>
              ) : (
                <span>{portfolioLabel}</span>
              )}
            </>
          )}
        </p>
      </header>

      {/* Summary */}
      {basics.summary && (
        <section style={sectionStyle}>
          <h2 style={headingStyle}>
            {getSectionLabel('about')}
          </h2>
          <p style={{ lineHeight: String(opts.lineHeight), color: '#333', fontSize: fs(10), textAlign: 'justify', orphans: 2, widows: 2 }}>
            {basics.summary}
          </p>
        </section>
      )}

      {/* Career Summary / Experience */}
      {work.length > 0 && (
        <section style={sectionStyle}>
          <h2 style={headingStyle}>
            {getSectionLabel('experience')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: `${opts.paragraphSpacing + 4}px` }}>
            {work.map((job, jobIndex) => (
              <div key={`${job.name}-${job.position}-${job.startDate}-${job.endDate}-${jobIndex}`} style={{ pageBreakInside: (job.highlights && job.highlights.length > 4) ? 'auto' : 'avoid', breakInside: (job.highlights && job.highlights.length > 4) ? 'auto' : 'avoid' }}>
                <div style={{ pageBreakAfter: (job.highlights && job.highlights.length > 4) ? 'avoid' : 'auto', breakAfter: (job.highlights && job.highlights.length > 4) ? 'avoid' : 'auto' }}>
                  {/* Position + Date on same row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1px' }}>
                    <h3 style={{ fontSize: fs(10.5), fontWeight: '700', textDecoration: 'underline', color: ACCENT_COLOR, minWidth: 0, overflow: 'hidden' }}>
                      {safeString(job.position)}
                    </h3>
                    <span style={{ fontSize: fs(10), color: '#1a5276', textDecoration: 'underline', fontStyle: 'italic', whiteSpace: 'nowrap', marginLeft: '12px', flexShrink: 0 }}>
                      {job.startDate} — {job.endDate || 'Current'}
                    </span>
                  </div>
                  {/* Company + Location in italic */}
                  <p style={{ fontSize: fs(10), color: ACCENT_COLOR, fontStyle: 'italic', marginBottom: '3px' }}>
                    {safeString(job.name)}
                    {job.location && ` | ${job.location}`}
                  </p>
                </div>
                {/* Bullet points */}
                {job.highlights && job.highlights.length > 0 && (
                  <ul style={{ paddingLeft: '16px', margin: '2px 0 0 0', listStyleType: 'disc' }}>
                    {job.highlights.map((h, j) => (
                      <li key={j} style={{ fontSize: fs(10), color: '#333', marginBottom: '1px', lineHeight: String(opts.lineHeight), orphans: 2, widows: 2 }}>
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
          <h2 style={headingStyle}>
            {getSectionLabel('projects')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: `${opts.paragraphSpacing + 2}px` }}>
            {projects.map((project, projectIndex) => (
              <div key={`${project.name}-${projectIndex}`} style={{ pageBreakInside: (project.highlights && project.highlights.length > 4) ? 'auto' : 'avoid', breakInside: (project.highlights && project.highlights.length > 4) ? 'auto' : 'avoid' }}>
                <div style={{ pageBreakAfter: (project.highlights && project.highlights.length > 4) ? 'avoid' : 'auto', breakAfter: (project.highlights && project.highlights.length > 4) ? 'avoid' : 'auto' }}>
                  <h3 style={{ fontSize: fs(10.5), fontWeight: '700', color: '#1a5276', marginBottom: '2px' }}>
                    {safeString(project.name)}
                  </h3>
                  {project.description && (
                    <p style={{ fontSize: fs(10), color: '#444', marginBottom: '2px', orphans: 2, widows: 2 }}>{project.description}</p>
                  )}
                </div>
                {project.highlights && project.highlights.length > 0 && (
                  <ul style={{ paddingLeft: '16px', margin: '2px 0 0 0', listStyleType: 'disc' }}>
                    {project.highlights.map((h, j) => (
                      <li key={j} style={{ fontSize: fs(10), color: '#333', marginBottom: '1px', orphans: 2, widows: 2 }}>
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

      {/* Skills - Bold category label + inline keywords */}
      {skills.length > 0 && (
        <section style={sectionStyle}>
          <h2 style={headingStyle}>
            {getSectionLabel('skills')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {skills.map((skillItem, skillIndex) => {
              if (typeof skillItem === 'string') {
                return (
                  <p key={`${skillItem}-${skillIndex}`} style={{ fontSize: fs(10), color: '#333' }}>{skillItem}</p>
                );
              }
              const keywords = skillItem.keywords || [skillItem.name];
              return (
                <p key={`${skillItem.name}-${skillIndex}`} style={{ fontSize: fs(10), color: '#333', lineHeight: String(opts.lineHeight) }}>
                  <strong style={{ color: ACCENT_COLOR }}>{skillItem.name}:</strong>{' '}
                  {keywords.join(', ')}
                </p>
              );
            })}
          </div>
        </section>
      )}

      {/* Qualifications (Education) - entries as divs to avoid double-bullet */}
      {education.length > 0 && (
        <section style={sectionStyle}>
          <h2 style={headingStyle}>
            {getSectionLabel('education')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {education.map((edu, educationIndex) => (
              <div
                key={`${edu.institution}-${edu.studyType}-${educationIndex}`}
                style={{
                  fontSize: fs(10),
                  color: '#333',
                  pageBreakInside: filterEducationHighlights(edu.highlights).length > 4 ? 'auto' : 'avoid',
                  breakInside: filterEducationHighlights(edu.highlights).length > 4 ? 'auto' : 'avoid',
                }}
              >
                <strong>{safeString(edu.studyType)}{edu.area && ` in ${edu.area}`}</strong>
                {edu.institution && (
                  <span style={{ color: '#555' }}> | {edu.institution}</span>
                )}
                {(edu.startDate || edu.endDate) && (
                  <span style={{ color: '#777' }}> ({edu.endDate || edu.startDate})</span>
                )}
                {edu.score && (
                  <span style={{ color: '#555', display: 'block', paddingLeft: '4px', fontSize: fs(9.5) }}>GPA: {edu.score}</span>
                )}
                {filterEducationHighlights(edu.highlights).length > 0 && (
                  <ul style={{ paddingLeft: '16px', margin: '2px 0 0 0', listStyleType: 'disc' }}>
                    {filterEducationHighlights(edu.highlights).map((h, j) => (
                      <li key={j} style={{ fontSize: fs(9.5), color: '#444' }}>
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

      {/* Certifications & Courses - Name (year) with italic sub-details */}
      {certificates.length > 0 && (
        <section style={sectionStyle}>
          <h2 style={headingStyle}>
            {getSectionLabel('certifications')}
          </h2>
          <ul style={{ paddingLeft: '16px', margin: 0, listStyleType: 'disc' }}>
            {certificates.map((cert, certificateIndex) => (
              <li key={`${cert.name}-${cert.date}-${certificateIndex}`} style={{ fontSize: fs(10), color: '#333', marginBottom: '3px' }}>
                <strong>{safeString(cert.name)}</strong>
                {cert.date && <span style={{ color: '#555' }}> ({cert.date})</span>}
                {cert.issuer && (
                  <span style={{ display: 'block', fontSize: fs(9.5), fontStyle: 'italic', color: '#666', paddingLeft: '4px' }}>
                    {cert.issuer}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Languages - Inline with bullet separators */}
      {languages.length > 0 && (
        <section>
          <h2 style={headingStyle}>
            {getSectionLabel('languages')}
          </h2>
          <p style={{ fontSize: fs(10), color: '#333' }}>
            {languages.map((lang, i) => {
              const { language, fluency } = safeLang(lang);
              return (
                <span key={`${language}-${i}`}>
                  {i > 0 && <span style={{ color: '#999', margin: '0 8px' }}>&bull;</span>}
                  <strong style={{ color: '#1a1a1a' }}>{language}</strong>
                  {fluency && `: ${fluency}`}
                </span>
              );
            })}
          </p>
        </section>
      )}
    </div>
  );
}

ExecutiveProfessional.displayName = 'Executive Professional';
