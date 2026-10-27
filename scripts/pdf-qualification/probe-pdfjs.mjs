import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const readers = resolve(process.env.PDF_QUALIFICATION_READERS ?? dirname(fileURLToPath(import.meta.url)));
const pdfjs = await import(pathToFileURL(resolve(readers, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href);

// Extraction only: audit.py owns the shared exact-Unicode qualification rule.
const [manifest, output] = process.argv.slice(2);
const results = [];
for (const c of JSON.parse(readFileSync(manifest, 'utf8'))) {
  const file = resolve(c.file);
  const bytes = readFileSync(file);
  const result = { id: c.id, file, sha256: createHash('sha256').update(bytes).digest('hex'), pages: [] };
  let task;
  try {
    task = pdfjs.getDocument({
      data: new Uint8Array(bytes), useSystemFonts: false, isEvalSupported: false,
      standardFontDataUrl: pathToFileURL(resolve(readers, 'node_modules/pdfjs-dist/standard_fonts') + '/').href,
    });
    const document = await task.promise;
    for (let n = 1; n <= document.numPages; n++) {
      const page = await document.getPage(n);
      const content = await page.getTextContent();
      result.pages.push({
        page: n, text: content.items.map(item => item.str ?? '').join(' '),
        items: content.items, styles: content.styles,
        annotations: await page.getAnnotations(),
      });
    }
    result.text = result.pages.map(page => page.text).join('\n');
  } catch (error) {
    result.error = String(error.stack ?? error);
  } finally {
    await task?.destroy();
  }
  results.push(result);
}
writeFileSync(output, JSON.stringify({ version: pdfjs.version, results }, null, 2));
process.exitCode = results.some(result => result.error) ? 1 : 0;
