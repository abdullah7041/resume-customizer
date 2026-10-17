import { createElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureTextPdfBlocks, captureStyledPdfSnapshot, cloneVisiblePdfPreview } from '@/lib/utils/textPdfSnapshot';
import { ModernProfessional } from '@/components/templates/ModernProfessional';
import { ATSOptimized } from '@/components/templates/ATSOptimized';
import { TechnicalEngineer } from '@/components/templates/TechnicalEngineer';
import { ExecutiveProfessional } from '@/components/templates/ExecutiveProfessional';
import type { ResumeSchema } from '@/types/resume';

vi.mock('@/hooks/useSectionLabel', () => ({ useSectionLabel: () => (key: string) => key }));
afterEach(cleanup);
const resume = { basics: { name: 'Noura Example', label: 'Analyst', email: 'noura@example.com', phone: '+966500000001', summary: 'Saudi analyst. SQL 25%', location: { city: 'Riyadh', countryCode: 'SA' }, profiles: [] }, work: [{ name: 'Example Co', position: 'Analyst', startDate: '2023', endDate: '2024', highlights: ['Prepared reports.', 'Reviewed SQL.'] }], education: [{ institution: 'College', area: 'IT', studyType: 'Diploma', startDate: '2020', endDate: '2022' }], skills: [{ name: 'Tools', keywords: ['SQL', 'Excel'] }], projects: [], certificates: [], languages: [] } as ResumeSchema;
const compact = (value: string) => value.replace(/\s/g, '');

describe('captureTextPdfBlocks', () => {
  it('captures immutable styled Arabic content, headings and safe links while omitting private data', () => {
    const preview = document.createElement('div');
    preview.style.direction = 'rtl';
    preview.innerHTML = '<h1 style="font-size:24px;color:rgb(18,52,86);font-weight:700;text-align:center">نورا مثال</h1><p style="font-size:16px;line-height:24px">لا تغيّر الحقائق. <a href="https://example.com/profile">Portfolio</a></p><p data-private>Secret</p>';
    document.body.append(preview);
    const snapshot = captureStyledPdfSnapshot(preview);
    expect(snapshot.blocks.flatMap(block => block.runs.map(run => run.text)).join('')).toBe('نورا مثاللا تغيّر الحقائق. Portfolio');
    expect(snapshot.styles).toHaveLength(snapshot.blocks.length);
    expect(snapshot.styles[0]).toMatchObject({ fontSize: 18, color: '#123456', bold: true, align: 'center', direction: 'rtl' });
    expect(snapshot.blocks[1].runs[1].href).toBe('https://example.com/profile');
    preview.querySelector('h1')!.textContent = 'Later edit';
    expect(snapshot.blocks[0].runs[0].text).toBe('نورا مثال');
    preview.remove();
  });
  it('preserves point sizes, unitless line-height and explicit zero spacing', () => {
    const preview = document.createElement('div');
    preview.innerHTML = '<h1 style="font-size:20pt;line-height:1.6;margin-bottom:0">Title</h1>';
    document.body.append(preview);
    expect(captureStyledPdfSnapshot(preview).styles[0]).toMatchObject({ fontSize: 20, lineHeight: 32, spacingAfter: 0 });
    preview.remove();
  });
  it('preserves chip gaps, inline emphasis and enclosing section spacing separately from source characters', () => {
    const preview = document.createElement('div');
    preview.innerHTML = '<section style="margin-bottom:16px"><p><strong>Engineering:</strong> TypeScript SQL</p><div style="display:flex;column-gap:8px"><span>TypeScript</span><span>SQL</span></div></section>';
    document.body.append(preview);
    const snapshot = captureStyledPdfSnapshot(preview);
    expect(snapshot.blocks[1].runs[0].text).toBe('TypeScriptSQL');
    expect(snapshot.styles[0].bold).toBe(false);
    expect(snapshot.styles[0].emphasis[0]).toMatchObject({ start: 0, end: 12, bold: true });
    expect(snapshot.styles[1].spacedBoundaries).toEqual([10]);
    expect(snapshot.styles[1].spacingAfter).toBeGreaterThanOrEqual(12);
    preview.remove();
  });
  it.each([{ name: 'Modern', Template: ModernProfessional }, { name: 'ATS', Template: ATSOptimized }, { name: 'Technical', Template: TechnicalEngineer }, { name: 'Executive', Template: ExecutiveProfessional }])('preserves every displayed scalar and link from $name', ({ Template }) => {
    const { container } = render(createElement(Template, { resume }));
    const preview = container.firstElementChild as HTMLElement;
    const before = preview.outerHTML;
    const blocks = captureTextPdfBlocks(preview);
    expect(compact(blocks.flatMap(b => b.runs.map(r => r.text)).join(''))).toBe(compact(preview.textContent ?? ''));
    expect(blocks[0]).toEqual({ kind: 'title', runs: [{ text: 'Noura Example' }] });
    expect(blocks.some(b => b.kind === 'heading')).toBe(true);
    expect(blocks.filter(b => b.kind === 'bullet').map(b => b.runs.map(r => r.text).join(''))).toContain('Prepared reports.');
    expect(blocks.flatMap(b => b.runs).filter(r => r.href).map(r => r.href)).toEqual(Array.from(preview.querySelectorAll('a')).map(a => a.href));
    expect(preview.outerHTML).toBe(before);
  });

  it('keeps nested inline spans together, source boundaries and safe link targets', () => {
    const preview = document.createElement('div');
    preview.innerHTML = '<h1>Noura</h1><h2>Experience</h2><div><span>Analyst <b>SQL</b></span><span> 2024</span></div><ul><li>Built <span>internal <b>reports</b></span> <a href="https://example.com/a">portfolio</a>.</li></ul><p><a href="javascript:alert(1)">visible unsafe label</a></p>';
    document.body.append(preview);
    expect(captureTextPdfBlocks(preview)).toEqual([
      { kind: 'title', runs: [{ text: 'Noura' }] }, { kind: 'heading', runs: [{ text: 'Experience' }] },
      { kind: 'body', runs: [{ text: 'Analyst SQL 2024' }] },
      { kind: 'bullet', runs: [{ text: 'Built internal reports ' }, { text: 'portfolio', href: 'https://example.com/a' }, { text: '.' }] },
      { kind: 'body', runs: [{ text: 'visible unsafe label' }] },
    ]);
    preview.remove();
  });

  it('decides hidden/no-print/private visibility on the live tree without adding invisible facts', () => {
    const preview = document.createElement('div');
    preview.innerHTML = '<p>Shown <span>fact</span></p><p hidden>hidden</p><p aria-hidden="true">aria</p><p data-no-print>print</p><p data-private>private</p><p style="display:none">css hidden</p><div style="visibility:hidden"><p>hidden ancestor</p></div><p style="opacity:0">transparent</p><svg><title>icon</title></svg>';
    document.body.append(preview);
    const blocks = captureTextPdfBlocks(preview);
    preview.querySelector('p')!.textContent = 'Later edit';
    expect(blocks).toEqual([{ kind: 'body', runs: [{ text: 'Shown fact' }] }]);
    preview.remove();
  });
  it.each(['root', 'ancestor'])('excludes a hidden %s from both the collector and detached verification snapshot', target => {
    const host = document.createElement('div');
    const preview = document.createElement('div');
    preview.innerHTML = '<p>Invisible private fact</p>';
    host.append(preview); document.body.append(host);
    (target === 'root' ? preview : host).style.display = 'none';
    expect(captureTextPdfBlocks(preview)).toEqual([]);
    expect(cloneVisiblePdfPreview(preview).textContent).toBe('');
    host.remove();
  });
  it('cleans CSS-hidden content before detaching the verification snapshot', () => {
    const preview = document.createElement('div');
    preview.innerHTML = '<p>Shown</p><p style="display:none">Private</p><p data-no-print>Overlay</p>';
    document.body.append(preview);
    const snapshot = cloneVisiblePdfPreview(preview);
    expect(snapshot.isConnected).toBe(false);
    expect(snapshot.textContent).toBe('Shown');
    expect(preview.textContent).toBe('ShownPrivateOverlay');
    preview.remove();
  });
});
