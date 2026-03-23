// netlify/functions/generate-pdf.ts
// Server-side PDF generation using Puppeteer
// Replaces client-side @react-pdf/renderer for pixel-perfect preview match

import type { Handler } from "@netlify/functions";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { withRateLimit } from "../lib/rate-limiter";


import { existsSync } from "fs";

// Common Chrome/Edge paths for Windows
const WINDOWS_CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
  // Edge as fallback (Chromium-based)
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

// Chromium executable path varies by environment
const getChromiumPath = async (): Promise<string> => {
  if (process.env.NETLIFY) {
    return await chromium.executablePath();
  }

  // Local development - find available browser
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }

  if (process.platform === "win32") {
    for (const path of WINDOWS_CHROME_PATHS) {
      if (path && existsSync(path)) {
        console.log('[PDF] Found browser at:', path);
        return path;
      }
    }
    throw new Error('Chrome/Edge not found. Please install Chrome or Edge browser.');
  }

  return "/usr/bin/google-chrome";
};

// Check if running on Netlify (production/deploy-preview)
const isNetlify = !!process.env.NETLIFY;

// Browser connection pooling - reuse browser instance across requests
let browserInstance: Browser | null = null;
let lastUsedTime = 0;
const BROWSER_IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

async function getBrowser() {
  const now = Date.now();

  // Close browser if idle for too long (cleanup)
  if (browserInstance && (now - lastUsedTime) > BROWSER_IDLE_TIMEOUT) {
    console.log('[PDF] Closing idle browser instance');
    try {
      await browserInstance.close();
    } catch (err) {
      console.warn('[PDF] Error closing idle browser:', err);
    }
    browserInstance = null;
  }

  // Reuse existing browser or create new one
  // Health check: verify browser is connected before reuse
  if (browserInstance) {
    try {
      const isConnected = browserInstance.isConnected();
      if (!isConnected) {
        console.log('[PDF] Browser disconnected, creating new instance');
        browserInstance = null;
      }
    } catch (err) {
      console.warn('[PDF] Browser health check failed:', err);
      browserInstance = null;
    }
  }

  if (!browserInstance) {
    console.log('[PDF] Launching new browser instance');
    browserInstance = await puppeteer.launch({
      args: isNetlify ? chromium.args : ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width: 794, height: 1123 }, // A4 at 96dpi: 210mm × 96/25.4 ≈ 794px, 297mm × 96/25.4 ≈ 1123px
      executablePath: await getChromiumPath(),
      headless: true, // Always headless for PDF generation
    });
  }

  lastUsedTime = now;
  return browserInstance;
}

// Valid template IDs - must match registry
const VALID_TEMPLATE_IDS = [
  'modern-professional',
  'classic-traditional',
  'technical-engineer',
  'ats-optimized',
  'executive-professional'
] as const;

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Auth is optional for PDF generation — rate limiting via withRateLimit prevents abuse.
  // PDF is a stateless HTML→PDF render, no AI credits or user data accessed.

  let page: Page | null = null; // Declare outside try block for cleanup access

  try {
    const { html, templateId } = JSON.parse(event.body || "{}");

    if (!html) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing html" }) };
    }

    // Validate templateId to prevent header injection
    const sanitizedTemplateId = VALID_TEMPLATE_IDS.includes(templateId)
      ? templateId
      : 'modern-professional';

    // Get browser from pool (eliminates cold start on subsequent requests)
    const browser = await getBrowser();
    page = await browser.newPage();

    // Block external resource requests (fonts, images, stylesheets) to speed up rendering
    // The HTML is self-contained from the client — no external dependencies needed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      // Block only image, font, and media — stylesheets are already inlined in the HTML
      // (injected via buildInlinedHtml on the client), so blocking them is unnecessary.
      if (['image', 'font', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Disable JavaScript to prevent script execution from client-provided HTML
    await page.setJavaScriptEnabled(false);

    // Use domcontentloaded since HTML is pre-rendered from client
    // No need to wait for network resources (fonts already loaded in client)
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Emulate screen media to match browser preview (not print media)
    await page.emulateMediaType('screen');

    // Inject critical CSS for proper PDF rendering
    // Note: Tailwind utilities are no longer re-created here because the
    // client now bundles the full compiled CSS from the page's stylesheets.
    await page.addStyleTag({
      content: `
        /* Hide elements marked as non-printable (page break indicators, etc.) */
        [data-no-print] { display: none !important; }
        
        /* Page break prevention - keep individual items together, not whole sections */
        li, p, h1, h2, h3, h4 {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        /* Keep section entries together (work, education, project blocks) */
        section > div > div { break-inside: avoid !important; page-break-inside: avoid !important; }

        /* Keep headings attached to following content */
        h2 { break-after: avoid !important; page-break-after: avoid !important; }

        /* Keep header block together */
        header { break-inside: avoid !important; page-break-inside: avoid !important; }
        
        /* Ensure exact color rendering */
        * { 
          -webkit-print-color-adjust: exact !important; 
          print-color-adjust: exact !important; 
        }
      `
    });

    // Short stabilization delay for layout
    await new Promise(resolve => setTimeout(resolve, 300));

    // Generate PDF with 60s safety timeout (Netlify fn has 90s limit)
    const PDF_TIMEOUT_MS = 60_000;
    const pdfBuffer = await Promise.race([
      page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`PDF generation timed out after ${PDF_TIMEOUT_MS / 1000}s`)), PDF_TIMEOUT_MS)
      ),
    ]);

    // Close page but keep browser alive for pooling
    await page.close();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="resume-${sanitizedTemplateId}.pdf"`,
      },
      body: Buffer.from(pdfBuffer).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("PDF generation error:", error);

    // Cleanup: try to close page on error (browser stays alive for pooling)
    try {
      if (page) await page.close();
    } catch (cleanupErr) {
      console.warn('[PDF] Page cleanup error:', cleanupErr);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "PDF generation failed. Please try again." }),
    };
  }
};

export const handler = withRateLimit("generate-pdf", baseHandler);
