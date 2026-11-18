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
  it.each(templateIds)('%s preserves Arabic and mixed source text in DOCX bytes', async templateId => {
    for (const language of ['ar', 'mixed'] as const) {
      const resume = trustResume(language);
      resume.basics!.summary = 'السَّلَامُ عَلَيْكُمْ [SQL] ٢٥';
      const blob = await exportResumeAsDocx(resume, { templateId, direction: 'rtl' });
      const archive = await JSZip.loadAsync(await blob.arrayBuffer());
      const xml = await archive.file('word/document.xml')!.async('string');
      const document = new DOMParser().parseFromString(xml, 'application/xml');
      const text = Array.from(document.getElementsByTagName('w:t')).map(run => run.textContent ?? '').join('');
      for (const source of [resume.basics!.name, resume.basics!.summary, resume.work![0].name, '2016', '2020']) {
        expect(text).toContain(source);
      }
      const relationships = await archive.file('word/_rels/document.xml.rels')!.async('string');
      expect(relationships).toContain('https://nora.example.test');
    }
  });

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

  it.each(templateIds.slice(3))('%s retains both supplied education dates', async templateId => {
    const line = await educationLine(templateId, 'en', '2016', '2020');
    expect(line).toContain('2020');
    expect(line).toContain('2016');
  });

  it.each([
    ['2016', '', '2016'],
    ['', '2020', '2020'],
    ['', '', ''],
  ])('Modern renders dates %s / %s without a malformed range', async (startDate, endDate, expected) => {
    const line = await educationLine('modern-professional', 'en', startDate, endDate);
    expect(line).toBe(`Bachelor — Computer Science${expected ? `\t${expected}` : ''}`);
  });
});

describe('DOCX Arabic typography', () => {
  it.each(templateIds)('%s aligns RTL body text at the logical start edge', async templateId => {
    const resume = trustResume('ar');
    const blob = await exportResumeAsDocx(resume, { templateId, direction: 'rtl' });
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await archive.file('word/document.xml')!.async('string');
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    const company = Array.from(document.getElementsByTagName('w:p')).find(p => p.textContent === resume.work![0].name)!;
    expect(company.getElementsByTagName('w:jc')[0].getAttribute('w:val')).toBe('start');
  });

  it('keeps Arabic employer text upright while retaining Neom Latin italics', async () => {
    for (const language of ['ar', 'en'] as const) {
      const resume = trustResume(language);
      const blob = await exportResumeAsDocx(resume, { templateId: 'executive-professional', direction: language === 'ar' ? 'rtl' : 'ltr' });
      const archive = await JSZip.loadAsync(await blob.arrayBuffer());
      const xml = await archive.file('word/document.xml')!.async('string');
      const document = new DOMParser().parseFromString(xml, 'application/xml');
      const company = Array.from(document.getElementsByTagName('w:p')).find(p => p.textContent === resume.work![0].name)!;
      const italics = Array.from(company.getElementsByTagName('w:i'));
      expect(italics).toHaveLength(1);
      expect(italics[0].getAttribute('w:val')).toBe(language === 'ar' ? 'false' : null);
    }
  });

  it.each(templateIds)('%s preserves Latin word order inside RTL paragraphs', async templateId => {
    const resume = trustResume('ar');
    resume.basics.name = 'نورة Example';
    resume.basics.label = 'Senior Data Analyst';
    resume.basics.summary = 'أعددت تقرير [SQL].';
    const blob = await exportResumeAsDocx(resume, { templateId, direction: 'rtl' });
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await archive.file('word/document.xml')!.async('string');
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    const runs = Array.from(document.getElementsByTagName('w:r'));
    for (const text of ['نورة Example', 'Senior Data Analyst', 'أعددت تقرير [SQL].']) {
      const run = runs.find(r => r.textContent === text)!;
      expect(run).toBeDefined();
      expect(run.getElementsByTagName('w:rtl')).toHaveLength(0);
    }
    const arabic = runs.find(r => r.textContent === 'جامعة المثال')!;
    expect(arabic.getElementsByTagName('w:rtl')).toHaveLength(1);
  });

  it.each(templateIds)('%s uses an Arabic-capable font for RTL exports', async templateId => {
    const blob = await exportResumeAsDocx(trustResume('ar'), { templateId, direction: 'rtl' });
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await archive.file('word/document.xml')!.async('string');
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    for (const fonts of Array.from(document.getElementsByTagName('w:rFonts'))) {
      expect(['Arial', 'Calibri']).toContain(fonts.getAttribute('w:cs'));
    }
  });

  it('keeps the Neom Arabic name free of Latin tracking and capitalization', async () => {
    const resume = trustResume('ar');
    resume.basics!.name = 'نورة Example';
    const blob = await exportResumeAsDocx(resume, { templateId: 'executive-professional', direction: 'rtl' });
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await archive.file('word/document.xml')!.async('string');
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    const name = document.getElementsByTagName('w:p')[0];
    expect(name.textContent).toBe('نورة Example');
    for (const caps of Array.from(name.getElementsByTagName('w:caps'))) {
      expect(caps.getAttribute('w:val')).toBe('false');
    }
    expect(name.getElementsByTagName('w:rPr')[0].getElementsByTagName('w:spacing')).toHaveLength(0);
  });

  it.each(templateIds)('%s indents Arabic bullets from the right margin', async templateId => {
    const resume = trustResume('ar');
    const blob = await exportResumeAsDocx(resume, { templateId, direction: 'rtl' });
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await archive.file('word/document.xml')!.async('string');
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    const bullet = Array.from(document.getElementsByTagName('w:p')).find(p => p.textContent?.includes('أعددت تقارير العملاء.'))!;
    expect(['•', '●']).toContain(bullet.textContent?.trimStart()[0]);
    const indent = bullet.getElementsByTagName('w:ind')[0];
    expect(indent.getAttribute('w:right')).toBe('360');
    expect(indent.hasAttribute('w:left')).toBe(false);
  });
});
