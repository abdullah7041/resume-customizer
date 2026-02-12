import type { ResumeSchema } from '../types/resume';
import type { TemplateId } from '../types/templates';
import { getTemplateConfig } from './docx/templateStyles';
import { buildAllSections } from './docx/sectionBuilders';
import type { DocxModule } from './docx/sectionBuilders';

/**
 * Options for DOCX export with keyword bolding and template selection
 */
export interface DocxExportOptions {
  keywords?: string[];      // Keywords to bold (from job description)
  boldKeywords?: boolean;   // Enable/disable keyword bolding (default: true)
  templateId?: TemplateId;  // Template to match styling (default: modern-professional)
}

/**
 * Export resume data as a DOCX file with template-aware styling.
 *
 * Uses dynamic import of `docx` library (already in package.json).
 * The generated document mirrors the selected template's fonts,
 * section order, colors, and spacing.
 *
 * @param resume - Resume data to export
 * @param options - Export options (keyword bolding, template selection)
 */
export async function exportResumeAsDocx(
  resume: ResumeSchema,
  options: DocxExportOptions = {}
): Promise<Blob> {
  const { keywords = [], boldKeywords = true, templateId } = options;

  // Dynamic import of docx library
  const D: DocxModule = await import('docx');

  // Get template-specific style config
  const cfg = getTemplateConfig(templateId);

  // Build all sections in template-defined order
  const children = buildAllSections(
    resume,
    cfg,
    D,
    { keywords, boldKeywords },
  );

  // Create the document with template margins
  const doc = new D.Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: D.convertInchesToTwip(cfg.margins[0]),
              bottom: D.convertInchesToTwip(cfg.margins[1]),
              left: D.convertInchesToTwip(cfg.margins[2]),
              right: D.convertInchesToTwip(cfg.margins[3]),
            },
          },
        },
        children,
      },
    ],
  });

  return D.Packer.toBlob(doc);
}
