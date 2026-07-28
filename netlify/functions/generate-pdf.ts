// netlify/functions/generate-pdf.ts
// Server-side PDF generation using Puppeteer
// Replaces client-side @react-pdf/renderer for pixel-perfect preview match

import type { Handler } from "@netlify/functions";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { withRateLimit } from "../lib/rate-limiter.js";
import { getSupabaseClient } from "../lib/supabase-client.js";
import { summarizeErrorForLog } from "../lib/sentry.js";


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
const RENDER_TIMEOUT_MS = 30_000;

async function getBrowser() {
  const now = Date.now();

  // Close browser if idle for too long (cleanup)
  if (browserInstance && (now - lastUsedTime) > BROWSER_IDLE_TIMEOUT) {
    console.log('[PDF] Closing idle browser instance');
    try {
      await browserInstance.close();
    } catch (err) {
      console.warn('[PDF] Error closing idle browser:', summarizeErrorForLog(err));
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
      console.warn('[PDF] Browser health check failed:', summarizeErrorForLog(err));
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
  'technical-engineer',
  'ats-optimized',
  'executive-professional'
] as const;

export const ALLOWED_RENDER_REQUEST_PROTOCOLS = new Set(["about:", "data:", "blob:"]);

export function isAllowedRenderRequest(requestUrl: string): boolean {
  try {
    const parsed = new URL(requestUrl);
    return ALLOWED_RENDER_REQUEST_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export interface InterceptableRequest {
  url(): string;
  continue(): unknown;
  abort(reason: string): unknown;
}

/** Allow only about:/data:/blob: subresource requests; abort all network. */
export function handleRenderRequest(request: InterceptableRequest): void {
  if (isAllowedRenderRequest(request.url())) {
    void request.continue();
    return;
  }

  void request.abort("blockedbyclient");
}

export interface SandboxablePage {
  setRequestInterception(enabled: boolean): Promise<void>;
  on(event: "request", handler: (request: InterceptableRequest) => void): unknown;
  setJavaScriptEnabled(enabled: boolean): Promise<void>;
}

/** Apply the render sandbox: intercept+abort network, disable JS. */
export async function hardenPageForRender(page: SandboxablePage): Promise<void> {
  await page.setRequestInterception(true);
  page.on("request", handleRenderRequest);
  await page.setJavaScriptEnabled(false);
}

const DEFAULT_PAGE_MARGIN_MM = 19.05; // 0.75in — matches the client fallback default.
const MARGIN_CUSTOM_PROPERTY_PATTERN = /--margin-(top|bottom):\s*([\d.]+)(in|mm|px)/g;

/**
 * Reads the `--margin-top`/`--margin-bottom` CSS custom properties that
 * TemplateRenderer sets on the `[data-resume-preview]` wrapper (serialized
 * verbatim into the incoming HTML string's `style` attribute) and converts
 * them to millimeters for the `@page` rule.
 *
 * This is done as plain string parsing rather than `page.evaluate()` because
 * the page has JavaScript execution disabled (`hardenPageForRender`, a
 * deliberate SSRF/XSS guard against attacker-controlled resume HTML) —
 * `page.evaluate()` calls fail once `setJavaScriptEnabled(false)` has run.
 */
export function extractPageMarginsMm(html: string): { topMm: number; bottomMm: number } {
  const values: { top?: number; bottom?: number } = {};
  for (const match of html.matchAll(MARGIN_CUSTOM_PROPERTY_PATTERN)) {
    const [, side, amountStr, unit] = match;
    const amount = Number.parseFloat(amountStr);
    if (!Number.isFinite(amount)) continue;
    const mm = unit === 'in' ? amount * 25.4 : unit === 'px' ? amount * (25.4 / 96) : amount;
    if (side === 'top' && values.top === undefined) values.top = mm;
    if (side === 'bottom' && values.bottom === undefined) values.bottom = mm;
  }
  return {
    topMm: values.top ?? DEFAULT_PAGE_MARGIN_MM,
    bottomMm: values.bottom ?? DEFAULT_PAGE_MARGIN_MM,
  };
}

function sanitizeFilename(value: unknown): string {
  if (typeof value !== "string") return "resume-optimized";

  const trimmed = value.trim().replace(/\.pdf$/i, "");
  const safe = trimmed
    .replace(/[\r\n"]/g, "")
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "_")
    .slice(0, 120);

  return safe || "resume-optimized";
}

const baseHandler: Handler = async (event) => {
  if (event.httpMethod === "HEAD") {
    return { statusCode: 200, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Authentication required. Please sign in." }),
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server configuration error. Please contact support." }),
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid or expired authentication token" }),
    };
  }

  let page: Page | null = null; // Declare outside try block for cleanup access

  try {
    const { html, styles, filename, templateId, direction } = JSON.parse(event.body || "{}");
    const safeFilename = sanitizeFilename(filename);
    const pageDirection = direction === "rtl" ? "rtl" : "ltr";

    if (!html) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing html" }) };
    }

    // Validate templateId to prevent header injection
    const _sanitizedTemplateId = VALID_TEMPLATE_IDS.includes(templateId)
      ? templateId
      : 'modern-professional';

    // Get browser from pool (eliminates cold start on subsequent requests)
    const browser = await getBrowser();
    page = await browser.newPage();

    // Set fixed viewport matching A4 (210mm x 297mm @ 96dpi)
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });

    await hardenPageForRender(page);

    // Read the user's margin settings from the incoming HTML string itself
    // (plain string parsing, not page.evaluate() — the page has JavaScript
    // execution disabled by hardenPageForRender above, so any evaluate() call
    // here would throw and fail the whole request).
    const { topMm, bottomMm } = extractPageMarginsMm(html);

    // Render the final HTML string with embedded styles. setContent and the
    // explicit network-idle wait share one deadline so this migration from
    // waitUntil: "networkidle2" does not double the render budget.
    const renderDeadline = Date.now() + RENDER_TIMEOUT_MS;
    await page.setContent(`
      <!DOCTYPE html>
      <html dir="${pageDirection}" class="light" data-theme="light">
        <head>
          <meta charset="UTF-8">
          <style>${styles || ''}</style>
          <style>
            html,
            body {
              color-scheme: light !important;
              background: #fff !important;
            }

            body {
              margin: 0 !important;
              color: #111827 !important;
            }

            [data-resume-preview],
            [data-pdf-theme="light"] {
              color-scheme: light !important;
              background: #fff !important;
            }

            /* Hide elements marked as non-printable (page break indicators, etc.) */
            [data-no-print] { display: none !important; }

            /* Ensure exact color rendering in print mode */
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            /* Prevent section headers from orphaning at the bottom of a page.
               Works in both screen and print rendering modes. */
            h2 { break-after: avoid; }

            /* Remove template root padding to prevent double-padding on page 1 —
               the @page rule below is the sole source of page margins. */
            [data-resume-preview] > div { padding-top: 0 !important; padding-bottom: 0 !important; }

            /* Overrides index.css's @page { margin: 0 } print reset with the
               user's configured margins. */
            @page { margin: ${topMm}mm 0 ${bottomMm}mm 0 !important; }

          </style>
        </head>
        <body>${html}</body>
      </html>
    `, { waitUntil: 'load', timeout: RENDER_TIMEOUT_MS });
    await page.waitForNetworkIdle({
      concurrency: 2,
      idleTime: 500,
      timeout: Math.max(1, renderDeadline - Date.now()),
    });

    // Use print media so screen-only components are hidden natively.
    await page.emulateMediaType('print');

    // Wait for fonts to ensure perfect rendering
    try {
      if (!browserInstance?.isConnected()) {
        throw new Error("Browser disconnected before font load.");
      }
      await page.evaluateHandle('document.fonts.ready');
      
      // Graciously wait for images to load, max 3 seconds
      await page.evaluate(async () => {
        const doc = (globalThis as any).document;
        if (!doc) return;
        const images = Array.from(doc.images) as any[];
        if (images.length === 0) return;
        await Promise.all(
          images.map((img: any) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve; // Ignore broken images
            });
          })
        );
      });
    } catch(e) {
      console.warn('Asset loading failed (fonts/images), attempting PDF anyway:', summarizeErrorForLog(e));
    }

    // Generate PDF with 60s safety timeout (Netlify fn has 90s limit)
    const PDF_TIMEOUT_MS = 60_000;
    const pdfBuffer = await Promise.race([
      page.pdf({
        format: "A4",
        printBackground: true,
        // The displayHeaderFooter property ensures no browser URL headers are printed
        // in combination with standard @page margins.
        displayHeaderFooter: false,
        // No `margin` option here — the injected `@page` rule in setContent()
        // above is the sole source of page margins. Passing both fights the
        // Puppeteer's own margin resolution.
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
        "Content-Disposition": `attachment; filename="${safeFilename}.pdf"`,
        "Cache-Control": "no-store",
      },
      body: Buffer.from(pdfBuffer).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("PDF generation error:", summarizeErrorForLog(error));

    // Cleanup: try to close page on error (browser stays alive for pooling)
    try {
      if (page) await page.close();
    } catch (cleanupErr) {
      console.warn('[PDF] Page cleanup error:', summarizeErrorForLog(cleanupErr));
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "PDF generation failed. Please try again." }),
    };
  }
};

export const handler = withRateLimit("generate-pdf", baseHandler);
