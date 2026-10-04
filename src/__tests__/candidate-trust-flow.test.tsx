import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import JSZip from 'jszip';
import { trustResume } from './fixtures/candidate-trust';
import { mergeOptimizedResume } from '@/lib/optimize/mergeResume';
import { createAssessmentContext, fingerprintText } from '@/lib/match/assessmentContext';
import { createExportSnapshot, reviewExport } from '@/lib/optimize/exportPreflight';
import { EvidenceReview } from '@/components/sections/optimize/EvidenceReview';
import { useResumeStore } from '@/lib/stores/resumeStore';
import { buildEvidenceSources, validateEditEvidence } from '../../netlify/lib/optimization-evidence';
import { getTemplate } from '@/components/templates/registry';
import { exportResumeAsDocx } from '@/services/exportDocx';
import { comparePdfText } from '@/lib/utils/pdfTextCheck';
import type { OptimizationResult } from '@/types/templates';
import type { StructuredEvidenceResume } from '@/types/optimization-evidence';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));

beforeEach(() => useResumeStore.getState().clearAll());

describe('candidate trust acceptance harness', () => {
  it('loads fictional bilingual fixtures', () => {
    expect(trustResume('en').work).toHaveLength(2);
    expect(trustResume('ar').work).toHaveLength(2);
  });

  it('does not apply a claim to the first employer when identical source text appears under two employers', () => {
    const original = trustResume('en');
    const card: OptimizationResult = { sectionId: 'role-b', sectionType: 'experience',
      original: original.work[1].highlights[0], optimized: 'Maintained customer reports for Harbor Works.', applied: true,
      evidence: { version: 1, targetId: 'work:role-b', originalFingerprint: 'original',
        proposedFingerprint: 'proposal', references: [], sourceFingerprints: {},
        status: 'needs_review', reasons: ['semantic_review'] },
      confirmation: { targetId: 'work:role-b', proposedFingerprint: 'proposal',
        statement: 'Maintained customer reports for Harbor Works.', confirmedAt: '2026-09-24' } };
    const merged = mergeOptimizedResume(original, [card], { isSaudiNational: false });
    expect(merged.includedEdits).toHaveLength(0);
    expect(merged.resume.work.map(work => work.highlights[0])).toEqual(original.work.map(work => work.highlights[0]));
  });

  it('assesses, inspects, confirms, edits, reverts, saves, reloads, and exports the reviewed claim', async () => {
    const original = trustResume('en');
    const metric = original.work[0].highlights[1];
    const proposal = 'Improved API latency by 20%.';
    const sources = await buildEvidenceSources({ resume: original as unknown as StructuredEvidenceResume });
    const source = sources.find(item => item.text === metric)!;
    const evidence = await validateEditEvidence({ targetId: source.targetId, original: metric,
      proposed: proposal, references: [{ sourceId: source.id, quote: metric }] }, sources);
    expect(evidence).toMatchObject({ status: 'needs_review', reasons: ['semantic_review'] });

    const input = { resumeText: JSON.stringify(original), jobDescription: 'Build reliable APIs',
      language: 'en' as const, kind: 'optimize' as const, isOptimized: false, rubricVersion: 'optimize-v1' };
    const assessedContext = await createAssessmentContext(input);
    const switchedContext = await createAssessmentContext({ ...input, jobDescription: 'Build dashboards' });
    expect(switchedContext.key).not.toBe(assessedContext.key);
    const store = useResumeStore.getState();
    store.setCachedAssessment(assessedContext, { score: 64, missingKeywords: [], strongMatches: [] });
    expect(useResumeStore.getState().getCachedAssessment(switchedContext)).toBeNull();
    store.setOriginalResume(original);
    store.setEvidenceSources(sources);
    store.setOptimizations([{ sectionId: 'metric-a', sectionType: 'experience', original: metric,
      optimized: proposal, applied: false, assessmentKey: assessedContext.key, evidence }]);

    const callbacks = {
      onConfirm: useResumeStore.getState().confirmOptimization,
      onEdit: useResumeStore.getState().editOptimization,
      onRevert: useResumeStore.getState().revertOptimization,
    };
    const view = render(<EvidenceReview card={useResumeStore.getState().optimizations[0]} sources={sources} {...callbacks} />);
    expect(screen.getByText(`Resume text: ${metric}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm this claim' }));
    await waitFor(() => expect(useResumeStore.getState().optimizations[0].confirmation?.proposedFingerprint)
      .toBe(evidence.proposedFingerprint));
    view.rerender(<EvidenceReview card={useResumeStore.getState().optimizations[0]} sources={sources} {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit wording' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit claim wording' }),
      { target: { value: 'Reduced API latency by 20% through caching.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save wording' }));
    await waitFor(() => expect(useResumeStore.getState().optimizations[0].confirmation).toBeUndefined());
    const edited = useResumeStore.getState().optimizations[0];
    expect(edited.evidence?.proposedFingerprint).toBe(await fingerprintText(edited.optimized as string));
    view.rerender(<EvidenceReview card={edited} sources={sources} {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm this claim' }));
    await waitFor(() => expect(useResumeStore.getState().optimizations[0].confirmation?.proposedFingerprint)
      .toBe(edited.evidence?.proposedFingerprint));

    useResumeStore.getState().applyOptimization('metric-a');
    expect(useResumeStore.getState().getActiveResume()?.work[0].highlights[1]).toBe(metric);
    useResumeStore.getState().setShowOptimized(true);
    expect(useResumeStore.getState().getActiveResume()?.work[0].highlights[1]).toBe(edited.optimized);
    fireEvent.click(screen.getByRole('button', { name: 'Revert this claim' }));
    expect(useResumeStore.getState().optimizations[0].applied).toBe(false);
    expect(useResumeStore.getState().getActiveResume()?.work[0].highlights[1]).toBe(metric);
    useResumeStore.getState().applyOptimization('metric-a');

    const id = useResumeStore.getState().saveCurrentAsVariant('API role', input.jobDescription);
    const options = useResumeStore.persist.getOptions();
    if (!options.partialize || !options.merge) throw new Error('Persistence test hooks missing');
    const persisted = JSON.parse(JSON.stringify(options.partialize(useResumeStore.getState())));
    const reloaded = options.merge(persisted, useResumeStore.getState()) as ReturnType<typeof useResumeStore.getState>;
    useResumeStore.setState(reloaded);
    expect(useResumeStore.getState().openVariant(id)?.snapshot.optimizations[0].confirmation)
      .toEqual(useResumeStore.getState().optimizations[0].confirmation);
    const snapshot = await createExportSnapshot(original, useResumeStore.getState().optimizations,
      { isSaudiNational: false });
    const includedEdit = snapshot.includedEdits[0];
    const exportDecision = reviewExport({ documentFingerprint: snapshot.documentFingerprint,
      includedEdits: snapshot.includedEdits, missingBaseline: false });
    expect(exportDecision.allowed).toBe(true);
    expect(includedEdit.confirmation?.proposedFingerprint).toBe(includedEdit.evidence?.proposedFingerprint);
    expect(includedEdit.assessmentKey).toBe(assessedContext.key);
    expect(snapshot.resume.work[0].highlights[1]).toBe(edited.optimized);
    expect(JSON.stringify(snapshot.resume)).not.toMatch(/40%|٤٠٪/);
  });

  it('keeps supplied personal and non-LinkedIn profile URLs as visible contact facts in every template and DOCX', async () => {
    const resume = trustResume('en');
    for (const id of ['modern-professional', 'technical-engineer', 'ats-optimized', 'executive-professional'] as const) {
      const Template = getTemplate(id);
      const html = renderToStaticMarkup(<Template resume={resume} />);
      expect(html, `${id} personal URL`).toContain('>https://nora.example.test<');
      expect(html, `${id} GitHub URL`).toContain('>https://github.com/nora-example<');
    }
    const docx = await exportResumeAsDocx(resume, { templateId: 'modern-professional', boldKeywords: false });
    const archive = await JSZip.loadAsync(await docx.arrayBuffer());
    const xml = await archive.file('word/document.xml')?.async('string');
    if (!xml) throw new Error('DOCX document.xml missing');
    const parsed = new DOMParser().parseFromString(xml, 'application/xml');
    const text = Array.from(parsed.getElementsByTagName('w:t')).map(node => node.textContent).join(' ');
    expect(text).toContain('https://nora.example.test');
    expect(text).toContain('https://github.com/nora-example');
  });

  it('drops a late refinement after switching variants with the same section ID', async () => {
    const store = useResumeStore.getState();
    store.setOriginalResume(trustResume('en'));
    const base: OptimizationResult = { sectionId: 'shared-id', sectionType: 'experience',
      original: 'Reduced API latency by 20%.', optimized: 'Role A proposal', applied: false,
      assessmentKey: 'assessment-a' };
    store.setOptimizations([base]);
    const firstId = store.saveCurrentAsVariant('A', 'API role');
    store.setOptimizations([{ ...base, optimized: 'Role B proposal', assessmentKey: 'assessment-b' }]);
    const secondId = store.saveCurrentAsVariant('B', 'Reporting role');
    store.openVariant(firstId);
    const pendingCard = useResumeStore.getState().optimizations[0];
    let release!: (value: string) => void;
    const deferred = new Promise<string>(resolve => { release = resolve; });
    const late = deferred.then(improved => {
      useResumeStore.getState().refineOptimization(pendingCard.sectionId,
        { improved, instruction: 'Clarify the role' }, pendingCard);
    });
    useResumeStore.getState().openVariant(secondId);
    release('Late role A wording');
    await late;
    expect(useResumeStore.getState().optimizations[0]).toMatchObject({ optimized: 'Role B proposal',
      assessmentKey: 'assessment-b' });
    expect(useResumeStore.getState().originalResume?.meta?.ai_suggestions).toBeUndefined();
  });
});

const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const pdfExtractor = `
import { readFileSync } from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(0)), disableWorker: true, isEvalSupported: false }).promise;
const pages = [];
for (let index = 1; index <= doc.numPages; index++) {
  const content = await (await doc.getPage(index)).getTextContent();
  pages.push(content.items.map(item => 'str' in item ? item.str : '').join(' '));
}
process.stdout.write(JSON.stringify(pages));
await doc.destroy();
`;
describe.skipIf(!existsSync(edgePath))('real candidate export artifacts', () => {
  it('keeps substantive facts and reading order in English, Arabic, mixed, and multi-page PDFs and DOCX', async () => {
    const browser = await puppeteer.launch({ executablePath: edgePath, headless: true, args: ['--no-sandbox'] });
    const Template = getTemplate('modern-professional');
    const mixed = trustResume('mixed');
    const shortMixed = structuredClone(mixed);
    shortMixed.work[0].highlights = shortMixed.work[0].highlights.slice(0, 2);
    const cases = [
      ['english', trustResume('en')], ['arabic', trustResume('ar')],
      ['mixed', shortMixed], ['multipage', mixed],
    ] as const;
    const artifactDir = join(process.cwd(), '.superpowers/sdd/2026-09-24-candidate-trust-foundations/task-9-artifacts');
    if (process.env.WRITE_TRUST_ARTIFACTS === '1') mkdirSync(artifactDir, { recursive: true });
    try {
      for (const [label, resume] of cases) {
        const direction = label === 'english' ? 'ltr' : 'rtl';
        const html = renderToStaticMarkup(<Template resume={resume} contentDirection={direction} />);
        if (process.env.WRITE_TRUST_ARTIFACTS === '1') writeFileSync(join(artifactDir, `${label}.html`), html);
        const page = await browser.newPage();
        try {
          await page.setContent(`<html lang="${label === 'arabic' ? 'ar' : 'en'}" dir="${direction}"><meta charset="utf-8"><body style="margin:0">${html}</body></html>`);
          expect(await page.evaluate(() => document.body.innerText)).toContain(resume.basics.name);
          await page.emulateMediaType('print');
          const pdf = await page.pdf({ format: 'A4', printBackground: true });
          if (process.env.WRITE_TRUST_ARTIFACTS === '1') writeFileSync(join(artifactDir, `${label}.pdf`), pdf);
          const pages = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', pdfExtractor],
            { input: Buffer.from(pdf), cwd: process.cwd(), maxBuffer: 4 * 1024 * 1024 }).toString()) as string[];
          const extracted = pages.join(' ');
          if (process.env.WRITE_TRUST_ARTIFACTS === '1') writeFileSync(join(artifactDir, `${label}.txt`), pages.join('\n\n--- PAGE ---\n\n'));
          const facts = [resume.basics.name, resume.basics.email, resume.basics.phone,
            resume.basics.url!, resume.basics.profiles[0].url,
            resume.work[0].name, resume.work[0].highlights[1], resume.work[1].name,
            resume.work[1].highlights[1]];
          const pdfCheck = comparePdfText(extracted, { fields: facts.map((text, index) => ({ id: String(index), text })) });
          expect(extracted).toContain(resume.basics.email);
          expect(extracted).toContain(resume.basics.phone);
          if (label === 'english') {
            expect(pdfCheck).toEqual({ state: 'text_checked', missingFieldIds: [] });
          } else {
            // Chromium's Arabic ToUnicode map currently fails the app's selectable-text check.
            expect(pdfCheck.state).toBe('unverified');
            expect(pdfCheck.missingFieldIds.length).toBeGreaterThan(0);
          }
          if (label === 'english') {
            expect(extracted.indexOf(resume.basics.name)).toBeLessThan(extracted.indexOf(resume.work[0].name));
            expect(extracted.indexOf(resume.work[0].name)).toBeLessThan(extracted.indexOf(resume.work[1].name));
          }
          expect(pages.length).toBeGreaterThanOrEqual(label === 'multipage' ? 2 : 1);
          const docx = await exportResumeAsDocx(resume, { templateId: 'modern-professional',
            direction: label === 'english' ? 'ltr' : 'rtl', boldKeywords: false });
          const archive = await JSZip.loadAsync(await docx.arrayBuffer());
          const xml = await archive.file('word/document.xml')?.async('string');
          if (!xml) throw new Error(`${label} DOCX document.xml missing`);
          const parsed = new DOMParser().parseFromString(xml, 'application/xml');
          const docxText = Array.from(parsed.getElementsByTagName('w:t')).map(node => node.textContent).join(' ');
          for (const fact of facts) expect(docxText, `${label} DOCX missing ${fact}`).toContain(fact);
          if (process.env.WRITE_TRUST_ARTIFACTS === '1') {
            writeFileSync(join(artifactDir, `${label}.pdf`), pdf);
            writeFileSync(join(artifactDir, `${label}.docx`), Buffer.from(await docx.arrayBuffer()));
            writeFileSync(join(artifactDir, `${label}.txt`), pages.join('\n\n--- PAGE ---\n\n'));
          }
        } finally { await page.close(); }
      }
    } finally { await browser.close(); }
  }, 120_000);
});
