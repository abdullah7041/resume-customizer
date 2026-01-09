// netlify/functions/generate-pdf.ts
// Server-side PDF generation using Puppeteer
// Replaces client-side @react-pdf/renderer for pixel-perfect preview match

import type { Handler } from "@netlify/functions";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

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
      defaultViewport: { width: 816, height: 1056 }, // Letter size at 96dpi
      executablePath: await getChromiumPath(),
      headless: true, // Always headless for PDF generation
    });
  }

  lastUsedTime = now;
  return browserInstance;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let page: Page | null = null; // Declare outside try block for cleanup access

  try {
    const { html, templateId } = JSON.parse(event.body || "{}");

    if (!html) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing html" }) };
    }

    // Get browser from pool (eliminates cold start on subsequent requests)
    const browser = await getBrowser();
    page = await browser.newPage();

    // Use domcontentloaded since HTML is pre-rendered from client
    // No need to wait for network resources (fonts already loaded in client)
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Short stabilization delay for layout (using setTimeout - waitForTimeout is deprecated)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
    });

    // Close page but keep browser alive for pooling
    await page.close();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="resume-${templateId}.pdf"`,
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
      body: JSON.stringify({ error: "PDF generation failed", details: String(error) }),
    };
  }
};
