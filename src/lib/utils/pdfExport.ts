import type { ResumeSchema } from '../../types/resume';
import type { PdfExportOptions } from '../../types/templates';

/**
 * Generate ATS-friendly PDF using browser print
 * Uses semantic HTML for maximum ATS parser compatibility
 */
export async function exportToPdf(
  resume: ResumeSchema,
  options: PdfExportOptions
): Promise<void> {
  const { format, templateHtml, fileName } = options;

  // For ATS format, generate clean semantic HTML
  const html = format === 'ats'
    ? generateAtsHtml(resume)
    : templateHtml || generateAtsHtml(resume);

  const documentTitle = fileName || `${resume.basics.name || 'Resume'} - Resume`;

  // Create print-ready document
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups for PDF export.');
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${documentTitle}</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #000;
            margin: 0;
            padding: 0;
          }
          h1 {
            font-size: 18pt;
            margin: 0 0 4pt 0;
          }
          h2 {
            font-size: 12pt;
            border-bottom: 1pt solid #000;
            padding-bottom: 2pt;
            margin: 16pt 0 8pt 0;
            text-transform: uppercase;
          }
          h3 {
            font-size: 11pt;
            margin: 0 0 2pt 0;
          }
          p {
            margin: 0 0 4pt 0;
          }
          ul {
            margin: 4pt 0 0 0;
            padding-left: 20pt;
          }
          li {
            margin-bottom: 2pt;
          }
          .header-info {
            margin-bottom: 8pt;
          }
          .job-header {
            display: flex;
            justify-content: space-between;
          }
          .job-company {
            font-style: italic;
            margin-bottom: 4pt;
          }
          .job-dates {
            font-size: 10pt;
            color: #444;
          }
          .skills {
            margin-top: 4pt;
          }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `);

  printWindow.document.close();

  // Wait for content to load, then trigger print
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

/**
 * Generate clean, ATS-optimized HTML
 * Following industry best practices:
 * - Simple, semantic HTML
 * - No tables for layout
 * - No images or graphics
 * - Standard section headers
 * - Consistent formatting
 */
function generateAtsHtml(resume: ResumeSchema): string {
  const { basics, work = [], education = [], skills = [], projects = [], languages = [] } = resume;

  // Contact info as pipe-separated string (ATS standard)
  const contactInfo = [
    basics.email,
    basics.phone,
    basics.location?.city && [basics.location.city, basics.location.region].filter(Boolean).join(', '),
    basics.profiles?.find(p => p.network?.toLowerCase() === 'linkedin')?.url,
  ].filter(Boolean).join(' | ');

  // Work experience HTML
  const experienceHtml = work.map((job) => `
    <div style="margin-bottom: 12pt;">
      <div class="job-header">
        <h3>${escapeHtml(job.position)}</h3>
        <span class="job-dates">${job.startDate || ''}${job.endDate ? ` - ${job.endDate}` : ''}</span>
      </div>
      <p class="job-company">${escapeHtml(job.name)}${job.url ? ` (${job.url})` : ''}</p>
      ${job.highlights && job.highlights.length > 0 ? `
        <ul>
          ${job.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `).join('');

  // Projects HTML
  const projectsHtml = projects.length > 0 ? `
    <h2>PROJECTS</h2>
    ${projects.map((project) => `
      <div style="margin-bottom: 12pt;">
        <h3>${escapeHtml(project.name)}</h3>
        ${project.description ? `<p>${escapeHtml(project.description)}</p>` : ''}
        ${project.highlights && project.highlights.length > 0 ? `
          <ul>
            ${project.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `).join('')}
  ` : '';

  // Education HTML
  const educationHtml = education.map((edu) => `
    <p>
      <strong>${escapeHtml(edu.studyType || '')}${edu.area ? ` in ${escapeHtml(edu.area)}` : ''}</strong>
      | ${escapeHtml(edu.institution)}
      | ${edu.endDate || ''}
      ${edu.score ? ` | GPA: ${edu.score}` : ''}
    </p>
  `).join('');

  // Skills as comma-separated string
  const skillsHtml = skills
    .flatMap((s) => s.keywords || [s.name])
    .filter(Boolean)
    .join(', ');

  // Languages HTML
  const languagesHtml = languages.length > 0
    ? languages.map((l) => `${l.language} (${l.fluency})`).join(', ')
    : '';

  return `
    <h1>${escapeHtml(basics.name)}</h1>
    ${basics.label ? `<p><strong>${escapeHtml(basics.label)}</strong></p>` : ''}
    <p class="header-info">${escapeHtml(contactInfo)}</p>

    ${basics.summary ? `
      <h2>PROFESSIONAL SUMMARY</h2>
      <p>${escapeHtml(basics.summary)}</p>
    ` : ''}

    ${work.length > 0 ? `
      <h2>WORK EXPERIENCE</h2>
      ${experienceHtml}
    ` : ''}

    ${projectsHtml}

    ${education.length > 0 ? `
      <h2>EDUCATION</h2>
      ${educationHtml}
    ` : ''}

    ${skillsHtml ? `
      <h2>SKILLS</h2>
      <p class="skills">${escapeHtml(skillsHtml)}</p>
    ` : ''}

    ${languagesHtml ? `
      <h2>LANGUAGES</h2>
      <p>${escapeHtml(languagesHtml)}</p>
    ` : ''}
  `;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Export resume preview element as PDF
 * Uses the rendered template HTML for styled export
 */
export async function exportStyledPdf(
  resume: ResumeSchema,
  previewElement: HTMLElement | null
): Promise<void> {
  if (!previewElement) {
    return exportToPdf(resume, { format: 'ats' });
  }

  return exportToPdf(resume, {
    format: 'styled',
    templateHtml: previewElement.innerHTML,
    fileName: `${resume.basics.name || 'Resume'} - Resume`,
  });
}
