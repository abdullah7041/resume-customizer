#!/usr/bin/env node

/**
 * Mobile Screenshot Generator
 * Captures screenshots at 390, 414, and 430px widths
 */

import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const MOBILE_WIDTHS = [390, 414, 430];
const SCREENSHOT_HEIGHT = 2000; // Capture enough to see hero + content

async function captureScreenshots(url) {
  console.log("🚀 Starting mobile screenshot capture");
  console.log(`📱 URL: ${url}`);
  console.log(`📏 Widths: ${MOBILE_WIDTHS.join(", ")}px\n`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const screenshotDir = path.join(process.cwd(), "screenshots");
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  for (const width of MOBILE_WIDTHS) {
    try {
      console.log(`📸 Capturing ${width}px...`);

      const page = await browser.newPage();

      // Set mobile viewport
      await page.setViewport({
        width: width,
        height: 844,
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      });

      // Set user agent to simulate mobile
      await page.setUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
      );

      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Wait for images to load
      await page.evaluate(() => {
        return Promise.all(
          Array.from(document.images)
            .filter((img) => !img.complete)
            .map(
              (img) =>
                new Promise((resolve) => {
                  img.onload = img.onerror = resolve;
                })
            )
        );
      });

      // Additional wait for animations
      await page.waitForTimeout(1000);

      // Capture full page screenshot
      const screenshotPath = path.join(screenshotDir, `mobile-${width}px.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        clip: {
          x: 0,
          y: 0,
          width: width,
          height: SCREENSHOT_HEIGHT,
        },
      });

      console.log(`  ✅ Saved: ${screenshotPath}`);

      // Also capture with shimmer active
      const badge = await page.$(".badge-gold-shimmer");
      if (badge) {
        // Trigger shimmer
        await badge.click();
        await page.waitForTimeout(200); // Wait for animation to start

        const shimmerPath = path.join(screenshotDir, `mobile-${width}px-shimmer.png`);
        await page.screenshot({
          path: shimmerPath,
          fullPage: false,
          clip: {
            x: 0,
            y: 0,
            width: width,
            height: 900,
          },
        });

        console.log(`  ✅ Saved (shimmer): ${shimmerPath}`);
      }

      // Capture scroll behavior - no nested scroll
      await page.evaluate(() => {
        window.scrollTo(0, 500);
      });
      await page.waitForTimeout(300);

      const scrollPath = path.join(screenshotDir, `mobile-${width}px-scroll.png`);
      await page.screenshot({
        path: scrollPath,
        fullPage: false,
        clip: {
          x: 0,
          y: 0,
          width: width,
          height: 844,
        },
      });

      console.log(`  ✅ Saved (scroll): ${scrollPath}`);

      await page.close();
    } catch (error) {
      console.error(`  ❌ Failed to capture ${width}px:`, error.message);
    }
  }

  await browser.close();

  console.log("\n✅ Screenshot capture complete!");
  console.log(`📁 Screenshots saved to: ${screenshotDir}`);
}

async function main() {
  const url = process.env.TEST_URL || "http://localhost:5173";

  try {
    await captureScreenshots(url);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

main();
