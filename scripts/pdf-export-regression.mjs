// Synthetic local regression: node --import tsx scripts/pdf-export-regression.mjs [output-directory]
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';
import core from 'puppeteer-core';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { comparePdfText } from '../src/lib/utils/pdfTextCheck.ts';

const output = resolve(process.argv[2] ?? resolve(tmpdir(), 'watheq-english-pdf-regression'));
const runFile = promisify(execFile);
const executablePath = process.env.PDF_TEST_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
await mkdir(output, { recursive: true });
const resume = {
  basics: { name: 'Noura Example', label: 'Data Analyst', email: 'noura@example.test', phone: '+966500000001',
    summary: 'Saudi analyst building reliable SQL reports and commercial dashboards.',
    location: { city: 'Riyadh', countryCode: 'SA' }, url: 'https://example.test/portfolio',
    profiles: [{ network: 'LinkedIn', url: 'https://example.test/profile' }] },
  work: [{ name: 'Example Company', position: 'Analyst', startDate: '2023-01', endDate: '2024-08',
    highlights: ['Prepared SQL reports with 25% faster review.', 'Reviewed business requirements and documented findings.'] }],
  education: [{ institution: 'Example College', area: 'Computing', studyType: 'Diploma', startDate: '2020', endDate: '2022' }],
  skills: [{ name: 'Tools', keywords: ['SQL', 'Excel', 'Power BI'] }],
  projects: [{ name: 'Reporting portfolio', description: 'Built reliable reports.', url: 'https://example.test/report' }],
  certificates: [], languages: [{ language: 'English', fluency: 'Fluent' }],
};
resume.work = Array.from({ length: 8 }, (_, index) => ({ ...resume.work[0], name: `Example Company ${index + 1}`,
  highlights: Array.from({ length: 5 }, (_, bullet) => `Report ${index + 1}.${bullet + 1}: Prepared SQL reports with 25% faster review and documented commercial findings for the team.`) }));
let renderer;
const launch = core.launch.bind(core);
core.launch = async options => { renderer = await launch({ ...options, executablePath }); return renderer; };
process.env.NETLIFY_DEV = 'true';
const { handler } = await import('../netlify/functions/generate-pdf.ts');
const fixtureHtml = `<!doctype html><html lang="en"><body><div id="root"></div><script type="module">
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import i18n from '/src/lib/i18n'; import '/src/index.css';
    import Gallery from '/src/components/sections/TemplatesSection.tsx';
    import { AuthProvider } from '/src/hooks/useAuth.tsx';
    import { CreditsProvider } from '/src/contexts/CreditsContext.tsx';
    import { analytics } from '/src/services/analytics.ts';
    import { ClarificationModal } from '/src/components/modals/ClarificationModal.tsx';
    const params = new URLSearchParams(location.search);
    const language = params.get('lang') ?? 'en';
    await i18n.changeLanguage(language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.classList.toggle('dark', params.get('theme') === 'dark');
    // A worker that never becomes ready reproduces the download's former hang.
    window.workerStarts = 0;
    window.Worker = class extends EventTarget {
      constructor() { super(); window.workerStarts++; }
      postMessage() {} terminate() {}
    };
    window.pdfFailures = [];
    analytics.trackExportFailed = (...args) => window.pdfFailures.push(args);
    import { useResumeStore } from '/src/lib/stores/resumeStore.ts';
    window.fixture = ${JSON.stringify(resume)};
    useResumeStore.setState(state => ({ originalResume: window.fixture, optimizations: [], showOptimized: false,
      isSaudiNational: false, parsedResumeText: JSON.stringify(window.fixture), contentLanguage: 'en',
      displayOptions: { ...state.displayOptions, boldKeywords: true },
      optimizationMetrics: { ...state.optimizationMetrics, jdKeywords: ['SQL', 'Power BI'] } }));
    const questions = Array.from({length: 5}, (_, n) => ({id: String(n), theme: 'SQL', rationale: 'Add verifiable details. '.repeat(12),
      question: 'Which reporting work can you verify?', type: 'multi', allowOther: false,
      options: [{value:'yes', label:'Built SQL dashboards'}, {value:'no', label:'No SQL experience', isHardStop:true}]}));
    window.keepLabel = i18n.t('clarificationModal.keepAnswering');
    createRoot(document.getElementById('root')).render(React.createElement(AuthProvider, null,
      React.createElement(CreditsProvider, null, params.get('view') === 'questions'
        ? React.createElement(ClarificationModal, {questions, round:3, isOpen:true, onSubmit:()=>{}, onSkip:()=>{}, onOptimizeNow:()=>{}})
        : React.createElement(Gallery))));
  </script></body></html>`;
const server = await createServer({ server: { host: '127.0.0.1', port: 5175, strictPort: true }, clearScreen: false,
  plugins: [{ name: 'synthetic-pdf-fixture', configureServer(vite) {
    vite.middlewares.use('/__pdf_regression', async (_req, res) => {
      const html = await vite.transformIndexHtml('/__pdf_regression', fixtureHtml);
      res.setHeader('Content-Type', 'text/html'); res.end(html);
    });
  } }],
});
await server.listen();
console.log('Synthetic PDF browser:', server.resolvedUrls.local[0] + '__pdf_regression');
const browser = await puppeteer.launch({ headless: true, executablePath });
const page = await browser.newPage();
page.on('pageerror', error => console.error('Browser error:', error.message));
page.on('requestfailed', request => { if (request.url().includes('pdf')) console.error('PDF resource failure:', request.url(), request.failure()?.errorText); });
page.on('console', message => { if (message.type() === 'error') console.error('Browser console:', message.text()); });
const results = [];
let activeId = 'modern-professional';
let responseBytes;
await page.setRequestInterception(true);
page.on('request', async request => {
  if (!request.url().includes('/.netlify/functions/generate-pdf')) return request.continue();
  try {
    await writeFile(resolve(output, `${activeId}-request.json`), request.postData());
    const response = await handler({ httpMethod: 'POST', headers: { 'x-forwarded-for': '127.0.0.1' }, body: request.postData() }, {}, () => {});
    responseBytes = Buffer.from(response.body, response.isBase64Encoded ? 'base64' : 'utf8');
    await writeFile(resolve(output, `${activeId}.pdf`), responseBytes);
    await request.respond({ status: response.statusCode, headers: response.headers, body: responseBytes });
  } catch (error) { console.error(error); await request.abort(); }
});
try {
  await page.goto(server.resolvedUrls.local[0] + '__pdf_regression', { waitUntil: 'networkidle0', timeout: 120000 });
  await page.waitForSelector('[data-resume-preview]', { timeout: 60000 });
  if (!process.env.UI_ONLY) for (const [id, label] of [['modern-professional', 'Riyadh'], ['technical-engineer', 'Khobar'], ['ats-optimized', 'Qiddiya'], ['executive-professional', 'Neom']]) {
    activeId = id;
    await page.evaluate(label => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === label)?.click(), label);
    await page.waitForFunction(label => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === label && button.className.includes('btn-metal')), {}, label);
    responseBytes = undefined;
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.includes('Download PDF'))?.click());
    await page.waitForFunction(() => document.querySelector('[role="alert"]') || [...document.querySelectorAll('[role="status"]')].some(el => el.textContent.includes('Selectable text checked')), { timeout: 60000 });
    const result = await page.evaluate(async () => {
      const { expectedPdfText } = await import('/src/lib/utils/pdfTextCheck.ts');
      return { alert: document.querySelector('[role="alert"]')?.textContent, status: [...document.querySelectorAll('[role="status"]')].map(el => el.textContent),
        failures: window.pdfFailures, workerStarts: window.workerStarts,
        expected: expectedPdfText(window.fixture, document.querySelector('[data-resume-preview]')) };
    });
    await writeFile(resolve(output, `${id}-ui.json`), JSON.stringify(result, null, 2));
    console.log(id, 'UI', JSON.stringify({ alert: result.alert, status: result.status, failures: result.failures, expectedFields: result.expected.fields.length }));
    if (responseBytes) {
      const { stdout } = await runFile(process.execPath, ['--input-type=module', '-e', `
        import fs from 'node:fs'; import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
        const pdf = await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(process.argv[1])),isEvalSupported:false}).promise;
        const text=[]; for(let n=1;n<=pdf.numPages;n++) text.push((await(await pdf.getPage(n)).getTextContent()).items.map(item=>item.str??'').join(' '));
        console.log(JSON.stringify({pages:pdf.numPages,extracted:text.join(' ')})); await pdf.destroy();
      `, resolve(output, `${id}.pdf`)], { timeout:30000, maxBuffer:2*1024*1024 });
      const extracted = JSON.parse(stdout);
      result.check = { ...comparePdfText(extracted.extracted, result.expected), ...extracted };
    }
    results.push({ id, ...result });
    await page.screenshot({ path: resolve(output, `${id}.png`), fullPage: true });
    await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(id, JSON.stringify({ alert: result.alert, state: result.check?.state, pages: result.check?.pages, missing: result.check?.missingFieldIds }));
    assert.equal(result.check?.state, 'text_checked', `${id}: PDF did not pass actual reader check`);
    assert.equal(result.workerStarts, 0, `${id}: verification depended on the stalled module worker`);
    assert.ok(result.check.pages > 1, `${id}: fixture must exercise multiple pages`);
    assert.equal(result.alert, undefined, `${id}: download UI reported an error`);
  }
  if (process.env.UI_ONLY) {
    for (const [language, theme, width] of [['en','light',1280], ['ar','dark',1280], ['en','dark',390], ['ar','light',390]]) {
      await page.setViewport({width, height:844});
      await page.goto(server.resolvedUrls.local[0] + `__pdf_regression?view=questions&lang=${language}&theme=${theme}`, {waitUntil:'networkidle0'});
      await page.waitForSelector('[role="dialog"] button[aria-pressed]');
      await page.click('button[aria-pressed]');
      const before = await page.evaluate(() => {
        const answers = [...document.querySelectorAll('button[aria-pressed]')]; answers.at(-1).focus();
        return document.querySelector('[role="dialog"]').scrollTop;
      });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.querySelector('[role="dialog"] [hidden]'));
      const visible = await page.evaluate(() => {
        const button = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === window.keepLabel);
        const rect = button.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= innerHeight;
      });
      assert.ok(visible, 'Exit choices require scrolling');
      await page.screenshot({path:resolve(output, `modal-${language}-${theme}-${width}-exit.png`)});
      await page.evaluate(() => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === window.keepLabel).click());
      await page.waitForFunction(() => !document.querySelector('[role="dialog"] [hidden]'));
      const restored = await page.evaluate(() => ({scroll:document.querySelector('[role="dialog"]').scrollTop, selected:document.querySelector('button[aria-pressed]').getAttribute('aria-pressed')}));
      assert.equal(restored.selected,'true'); assert.ok(Math.abs(restored.scroll-before)<2, 'Question scroll was not restored');
      console.log('Modal UI passed', language, theme, width);
    }
    await page.setViewport({width:1280,height:844});
    await page.goto(server.resolvedUrls.local[0], {waitUntil:'networkidle0'});
    await page.waitForSelector('iframe.sbc-seal-frame');
    for (const theme of ['dark','light']) {
      await page.evaluate(theme => document.documentElement.classList.toggle('dark',theme==='dark'), theme);
      assert.equal(await page.$eval('iframe.sbc-seal-frame',el=>getComputedStyle(el).colorScheme),'light');
      const frame = page.frames().find(frame=>frame.url().includes('EAuthSealApi/seal?'));
      await frame.waitForSelector('.sbc-badge');
      await page.screenshot({path:resolve(output,`badge-${theme}-collapsed.png`)});
      await frame.click('.sbc-badge');
      await page.waitForFunction(()=>document.querySelector('iframe.sbc-seal-frame').getBoundingClientRect().height>300);
      await page.screenshot({path:resolve(output,`badge-${theme}-expanded.png`)});
      await frame.click('.sbc-badge');
      await page.waitForFunction(()=>document.querySelector('iframe.sbc-seal-frame').getBoundingClientRect().height<50);
      console.log('Badge UI passed',theme);
    }
  }
} catch (error) {
  await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true });
  await writeFile(resolve(output, 'failure.html'), await page.content());
  throw error;
} finally { await browser.close(); await renderer?.close(); await server.close(); }
