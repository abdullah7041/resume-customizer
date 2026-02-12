/**
 * Template-specific style configurations for DOCX export.
 * Each config mirrors the visual design from its corresponding
 * React template component (font, colors, section order, spacing, labels).
 */
import type { TemplateId } from '../../types/templates';

export type SkillsLayout = 'tags' | 'comma' | 'categorized';
export type HeadingBorder = 'solid' | 'dashed' | 'none';
export type HeaderAlignment = 'LEFT' | 'CENTER';

export interface DocxTemplateConfig {
  /* ── Fonts ──────────────────────────────── */
  fontFamily: string;
  headingFont: string;
  baseFontSize: number;       // half-points (22 = 11pt)
  headingSize: number;        // half-points
  nameSize: number;           // half-points

  /* ── Colors ─────────────────────────────── */
  accentColor: string;        // Hex without # (e.g. '1A5276')
  bodyColor: string;
  contactColor: string;       // Contact info color

  /* ── Header ─────────────────────────────── */
  headerAlignment: HeaderAlignment;
  headerBorder: HeadingBorder; // Border under the WHOLE header block
  headerBorderColor: string;
  nameUppercase: boolean;
  nameLetterSpacing: boolean;

  /* ── Section Headings ───────────────────── */
  headingUppercase: boolean;
  headingBorder: HeadingBorder;
  headingBorderColor: string;
  headingAlignment: HeaderAlignment;  // Section heading alignment

  /* ── Content ────────────────────────────── */
  summaryItalic: boolean;
  bulletChar: string;         // Bullet character for highlights
  dateSeparator: string;
  skillsLayout: SkillsLayout;
  lineSpacing: number;        // docx line spacing value (e.g. 360 = 1.5×)

  /* ── Section Labels (must match template) ─ */
  labels: {
    summary: string;
    experience: string;
    projects: string;
    skills: string;
    education: string;
    certificates: string;
    languages: string;
  };

  /* ── Section Order ──────────────────────── */
  sectionOrder: SectionKey[];

  /* ── Page Margins (inches) ──────────────── */
  margins: [number, number, number, number]; // [top, bottom, left, right]

  /* ── Template-specific flags ────────────── */
  experiencePositionUnderline?: boolean;
  experienceCompanyItalic?: boolean;
  experienceCompanyAccentColor?: boolean;
}

export type SectionKey =
  | 'summary'
  | 'experience'
  | 'projects'
  | 'skills'
  | 'education'
  | 'certificates'
  | 'languages';

// ── Per-template configs ────────────────────────────────

const modernProfessional: DocxTemplateConfig = {
  fontFamily: 'Inter',
  headingFont: 'Inter',
  baseFontSize: 21,       // 10.5pt
  headingSize: 28,        // 14pt
  nameSize: 48,           // 24pt
  accentColor: '111827',  // gray-900
  bodyColor: '4B5563',    // gray-600
  contactColor: '6B7280', // gray-500
  headerAlignment: 'LEFT',
  headerBorder: 'solid',
  headerBorderColor: '111827',
  nameUppercase: false,
  nameLetterSpacing: false,
  headingUppercase: true,
  headingBorder: 'solid',
  headingBorderColor: 'E5E5E5',
  headingAlignment: 'LEFT',
  summaryItalic: false,
  bulletChar: '●',
  dateSeparator: ' — ',
  skillsLayout: 'tags',
  lineSpacing: 372,
  labels: {
    summary: 'About',
    experience: 'Experience',
    projects: 'Projects',
    skills: 'Skills',
    education: 'Education',
    certificates: 'Certifications',
    languages: 'Languages',
  },
  sectionOrder: ['summary', 'experience', 'projects', 'education', 'skills', 'certificates', 'languages'],
  margins: [0.5, 0.5, 0.6, 0.6],
};

const classicTraditional: DocxTemplateConfig = {
  fontFamily: 'Georgia',
  headingFont: 'Georgia',
  baseFontSize: 21,       // 10.5pt
  headingSize: 28,        // 14pt
  nameSize: 48,           // 24pt
  accentColor: '1A1A1A',
  bodyColor: '374151',    // gray-700
  contactColor: '6B7280', // gray-500
  headerAlignment: 'CENTER',
  headerBorder: 'solid',
  headerBorderColor: '1A1A1A',
  nameUppercase: true,
  nameLetterSpacing: true,
  headingUppercase: true,
  headingBorder: 'solid',
  headingBorderColor: '1A1A1A',
  headingAlignment: 'LEFT',
  summaryItalic: true,
  bulletChar: '–',
  dateSeparator: ' – ',
  skillsLayout: 'comma',
  lineSpacing: 348,
  labels: {
    summary: 'Professional Summary',
    experience: 'Work Experience',
    projects: 'Key Projects',
    skills: 'Skills & Expertise',
    education: 'Education',
    certificates: 'Certifications',
    languages: 'Languages',
  },
  sectionOrder: ['summary', 'experience', 'education', 'skills', 'projects', 'certificates', 'languages'],
  margins: [0.5, 0.5, 0.6, 0.6],
  experienceCompanyItalic: true,
};

const technicalEngineer: DocxTemplateConfig = {
  fontFamily: 'Consolas',
  headingFont: 'Inter',
  baseFontSize: 21,       // 10.5pt
  headingSize: 28,        // 14pt
  nameSize: 48,           // 24pt
  accentColor: '374151',  // gray-700
  bodyColor: '4B5563',    // gray-600
  contactColor: '6B7280', // gray-500
  headerAlignment: 'LEFT',
  headerBorder: 'dashed',
  headerBorderColor: 'D1D5DB',
  nameUppercase: false,
  nameLetterSpacing: false,
  headingUppercase: true,
  headingBorder: 'dashed',
  headingBorderColor: 'E5E7EB',
  headingAlignment: 'LEFT',
  summaryItalic: false,
  bulletChar: '▸',
  dateSeparator: ' → ',
  skillsLayout: 'tags',
  lineSpacing: 360,
  labels: {
    summary: 'Summary',
    experience: 'Experience',
    projects: 'Key Projects',
    skills: 'Technical Skills',
    education: 'Education',
    certificates: 'Certifications',
    languages: 'Languages',
  },
  // Skills first — matches TechnicalEngineer.tsx
  sectionOrder: ['skills', 'summary', 'experience', 'projects', 'education', 'certificates', 'languages'],
  margins: [0.5, 0.5, 0.6, 0.6],
};

const atsOptimized: DocxTemplateConfig = {
  fontFamily: 'Arial',
  headingFont: 'Arial',
  baseFontSize: 21,       // 10.5pt
  headingSize: 28,        // 14pt
  nameSize: 48,           // 24pt
  accentColor: '000000',
  bodyColor: '000000',
  contactColor: '000000',
  headerAlignment: 'CENTER',
  headerBorder: 'solid',
  headerBorderColor: '000000',
  nameUppercase: true,
  nameLetterSpacing: false,
  headingUppercase: true,
  headingBorder: 'solid',
  headingBorderColor: '9CA3AF',
  headingAlignment: 'LEFT',
  summaryItalic: false,
  bulletChar: '•',
  dateSeparator: ' - ',
  skillsLayout: 'comma',
  lineSpacing: 336,
  labels: {
    summary: 'Professional Summary',
    experience: 'Work Experience',
    projects: 'Key Projects',
    skills: 'Core Competencies',
    education: 'Education',
    certificates: 'Certifications & Training',
    languages: 'Languages',
  },
  sectionOrder: ['summary', 'skills', 'experience', 'projects', 'education', 'certificates', 'languages'],
  margins: [0.5, 0.5, 0.6, 0.6],
};

const executiveProfessional: DocxTemplateConfig = {
  fontFamily: 'Calibri',
  headingFont: 'Calibri',
  baseFontSize: 20,       // 10pt
  headingSize: 24,        // 12pt
  nameSize: 48,           // 24pt
  accentColor: '1A5276',  // navy blue
  bodyColor: '333333',
  contactColor: '444444',
  headerAlignment: 'CENTER',
  headerBorder: 'none',
  headerBorderColor: '1A5276',
  nameUppercase: true,
  nameLetterSpacing: true,
  headingUppercase: true,
  headingBorder: 'solid',
  headingBorderColor: '1A5276',
  headingAlignment: 'CENTER',
  summaryItalic: false,
  bulletChar: '•',
  dateSeparator: ' — ',
  skillsLayout: 'categorized',
  lineSpacing: 348,
  labels: {
    summary: 'About',
    experience: 'Experience',
    projects: 'Projects',
    skills: 'Skills',
    education: 'Education',
    certificates: 'Certifications',
    languages: 'Languages',
  },
  sectionOrder: ['summary', 'experience', 'projects', 'skills', 'education', 'certificates', 'languages'],
  margins: [0.5, 0.4, 0.6, 0.6],
  experiencePositionUnderline: true,
  experienceCompanyItalic: true,
  experienceCompanyAccentColor: true,
};

// ── Registry ────────────────────────────────────────────

const TEMPLATE_CONFIGS: Record<TemplateId, DocxTemplateConfig> = {
  'modern-professional': modernProfessional,
  'classic-traditional': classicTraditional,
  'technical-engineer': technicalEngineer,
  'ats-optimized': atsOptimized,
  'executive-professional': executiveProfessional,
};

/**
 * Get the DOCX style config for a given template.
 * Falls back to modern-professional if unknown.
 */
export function getTemplateConfig(id?: TemplateId): DocxTemplateConfig {
  if (id && TEMPLATE_CONFIGS[id]) return TEMPLATE_CONFIGS[id];
  return TEMPLATE_CONFIGS['modern-professional'];
}
