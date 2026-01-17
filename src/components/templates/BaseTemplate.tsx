import type { FC } from 'react';
import type { ResumeSchema } from '../../types/resume';
import type { DisplayOptions } from '../../types/templates';

/**
 * Props interface for all template components
 */
export interface TemplateProps {
  resume: ResumeSchema;
  isAtsMode?: boolean;
  scale?: number;
  /** @deprecated Use displayOptions instead */
  fontScale?: number; // 0.8 to 1.2, default 1 (100%)
  displayOptions?: DisplayOptions;
}

/**
 * Template component type with display name
 */
export interface TemplateComponent extends FC<TemplateProps> {
  displayName: string;
}

/**
 * Common styles for A4 page dimensions
 * Reduced padding from 15mm to 10mm for less white space
 */
export const A4_STYLES = {
  width: '210mm',
  minHeight: '297mm',
  padding: '10mm 12mm',
} as const;

/**
 * Helper to scale font sizes based on user preference
 * @param basePt - Base font size in pt (e.g., 10.5)
 * @param fontScale - Scale factor (0.8 to 1.2, default 1)
 * @returns Scaled font size string (e.g., "10.5pt")
 */
export const scaledFontSize = (basePt: number, fontScale = 1): string =>
  `${(basePt * fontScale).toFixed(1)}pt`;

/**
 * ATS-safe inline styles (no Tailwind for print reliability)
 */
export const ATS_STYLES = {
  container: {
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '11pt',
    lineHeight: '1.4',
    color: '#000000',
    backgroundColor: '#ffffff',
    padding: '28px 34px',
    maxWidth: '210mm',
    margin: '0 auto',
    minHeight: '297mm',
  },
  name: {
    fontSize: '18pt',
    fontWeight: 'bold' as const,
    marginBottom: '4pt',
  },
  sectionHeader: {
    fontSize: '12pt',
    fontWeight: 'bold' as const,
    borderBottom: '1px solid #000',
    paddingBottom: '2pt',
    marginTop: '16pt',
    marginBottom: '8pt',
    textTransform: 'uppercase' as const,
  },
  jobTitle: {
    fontWeight: 'bold' as const,
    marginBottom: '2pt',
  },
  jobMeta: {
    fontStyle: 'italic' as const,
    marginBottom: '4pt',
  },
  bulletList: {
    marginTop: '4pt',
    paddingLeft: '20pt',
    listStyleType: 'disc' as const,
  },
  bulletItem: {
    marginBottom: '2pt',
  },
} as const;

/**
 * Helper to safely render string values
 */
export function safeString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

/**
 * Format contact info as pipe-separated string (ATS standard)
 */
export function formatContactLine(basics: ResumeSchema['basics']): string {
  const parts: string[] = [];

  if (basics.location?.city) {
    parts.push(
      [basics.location.city, basics.location.region, basics.location.countryCode]
        .filter(Boolean)
        .join(', ')
    );
  }

  if (basics.email) parts.push(basics.email);
  if (basics.phone) parts.push(basics.phone);

  const linkedin = basics.profiles?.find(
    (p) => p.network?.toLowerCase() === 'linkedin'
  );
  if (linkedin?.url) parts.push(linkedin.url);

  return parts.join(' | ');
}

/**
 * ATS-optimized resume renderer
 * Pure semantic HTML, no styling dependencies
 */
export function ATSResume({ resume }: { resume: ResumeSchema }) {
  const { basics, work = [], education = [], skills = [], projects = [] } = resume;

  return (
    <div style={ATS_STYLES.container}>
      {/* Header */}
      <h1 style={ATS_STYLES.name}>{safeString(basics.name)}</h1>
      {basics.label && <p style={{ marginBottom: '4pt' }}>{basics.label}</p>}
      <p style={{ marginBottom: '16pt' }}>{formatContactLine(basics)}</p>

      {/* Summary */}
      {basics.summary && (
        <>
          <h2 style={ATS_STYLES.sectionHeader}>PROFESSIONAL SUMMARY</h2>
          <p>{basics.summary}</p>
        </>
      )}

      {/* Experience */}
      {work.length > 0 && (
        <>
          <h2 style={ATS_STYLES.sectionHeader}>WORK EXPERIENCE</h2>
          {work.map((job, i) => (
            <div key={i} style={{ marginBottom: '12pt' }}>
              <p style={ATS_STYLES.jobTitle}>{safeString(job.position)}</p>
              <p style={ATS_STYLES.jobMeta}>
                {safeString(job.name)}
                {job.startDate && ` | ${job.startDate}`}
                {job.endDate && ` - ${job.endDate}`}
              </p>
              {job.highlights && job.highlights.length > 0 && (
                <ul style={ATS_STYLES.bulletList}>
                  {job.highlights.map((h, j) => (
                    <li key={j} style={ATS_STYLES.bulletItem}>
                      {h}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <>
          <h2 style={ATS_STYLES.sectionHeader}>PROJECTS</h2>
          {projects.map((project, i) => (
            <div key={i} style={{ marginBottom: '12pt' }}>
              <p style={ATS_STYLES.jobTitle}>{safeString(project.name)}</p>
              {project.description && <p>{project.description}</p>}
              {project.highlights && project.highlights.length > 0 && (
                <ul style={ATS_STYLES.bulletList}>
                  {project.highlights.map((h, j) => (
                    <li key={j} style={ATS_STYLES.bulletItem}>
                      {h}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </>
      )}

      {/* Education */}
      {education.length > 0 && (
        <>
          <h2 style={ATS_STYLES.sectionHeader}>EDUCATION</h2>
          {education.map((edu, i) => (
            <p key={i} style={{ marginBottom: '8pt' }}>
              <strong>
                {safeString(edu.studyType)} {edu.area && `in ${edu.area}`}
              </strong>{' '}
              | {safeString(edu.institution)}
              {edu.endDate && ` | ${edu.endDate}`}
              {edu.score && ` | GPA: ${edu.score}`}
            </p>
          ))}
        </>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <>
          <h2 style={ATS_STYLES.sectionHeader}>SKILLS</h2>
          <p>
            {skills
              .flatMap((s) => s.keywords || [s.name])
              .filter(Boolean)
              .join(', ')}
          </p>
        </>
      )}
    </div>
  );
}




