import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { trustResume } from './fixtures/candidate-trust';
import { exportResumeAsDocx } from '@/services/exportDocx';
import type { TemplateId } from '@/types/templates';

const templateIds: TemplateId[] = [
  'modern-professional', 'technical-engineer', 'ats-optimized', 'executive-professional',
];

async function educationLine(templateId: TemplateId, language: 'en' | 'ar', startDate: string, endDate: string) {
  const resume = trustResume(language);
  resume.education![0].startDate = startDate;
  resume.education![0].endDate = endDate;
  const blob = await exportResumeAsDocx(resume, { templateId, boldKeywords: false });
  const xml = await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/document.xml')?.async('string');
  if (!xml) throw new Error('DOCX document.xml missing');
  const paragraphs = Array.from(new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('w:p'));
  const degree = language === 'ar' ? 'بكالوريوس' : 'Bachelor';
  const paragraph = paragraphs.find(p => Array.from(p.getElementsByTagName('w:t'))
    .some(run => run.textContent?.includes(degree)));
  if (!paragraph) throw new Error('Education degree paragraph missing');
  return Array.from(paragraph.getElementsByTagName('w:t')).map(run => run.textContent ?? '').join('');
}

describe('DOCX education date projection', () => {
  it.each(['en', 'ar'] as const)('exports the supplied Modern %s date range', async language => {
    expect(await educationLine('modern-professional', language, '2016', '2020'))
      .toContain('2016 — 2020');
  });

  it('exports the supplied Khobar date range with a portable separator', async () => {
    expect(await educationLine('technical-engineer', 'en', '2016', '2020'))
      .toContain('2016 - 2020');
  });

  it('exports both supplied Qiddiya education years', async () => {
    expect(await educationLine('ats-optimized', 'en', '2016', '2020'))
      .toContain('2016 - 2020');
  });

  it.each(templateIds.slice(3))('%s keeps the end-date-only education projection', async templateId => {
    const line = await educationLine(templateId, 'en', '2016', '2020');
    expect(line).toContain('2020');
    expect(line).not.toContain('2016');
  });

  it.each([
    ['2016', '', '2016'],
    ['', '2020', '2020'],
    ['', '', ''],
  ])('Modern renders dates %s / %s without a malformed range', async (startDate, endDate, expected) => {
    const line = await educationLine('modern-professional', 'en', startDate, endDate);
    expect(line).toBe(`Bachelor in Computer Science${expected ? `\t${expected}` : ''}`);
  });
});
