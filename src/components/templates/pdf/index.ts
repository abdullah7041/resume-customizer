// src/components/templates/pdf/index.ts
// PDF Template Registry - maps template IDs to their PDF components

export { default as ModernProfessionalPDF } from './ModernProfessionalPDF';
export { default as ClassicTraditionalPDF } from './ClassicTraditionalPDF';
export { default as TechnicalEngineerPDF } from './TechnicalEngineerPDF';

export type PDFTemplateId = 'modern-professional' | 'classic-traditional' | 'technical-engineer';
