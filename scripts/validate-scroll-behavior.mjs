#!/usr/bin/env node

/**
 * Single Document Scroll Validator
 * Ensures no nested overflow-y scroll containers
 */

import puppeteer from "puppeteer";

const MOBILE_WIDTHS = [390, 414, 430];

async function validateScrollBehavior(url, width) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.setViewport({
    width: width,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
  });

  await page.goto(url, { waitUntil: "networkidle2" });

  // Check for nested scrollable containers
  const scrollAnalysis = await page.evaluate(() => {
    const results = {
      bodyOverflow: null,
      htmlOverflow: null,
      nestedScrollContainers: [],
      documentScrollable: false,
    };

    // Check html and body
    const html = document.documentElement;
    const body = document.body;

    const htmlStyle = window.getComputedStyle(html);
    const bodyStyle = window.getComputedStyle(body);

    results.htmlOverflow = {
      overflowX: htmlStyle.overflowX,
      overflowY: htmlStyle.overflowY,
      overflow: htmlStyle.overflow,
    };

    results.bodyOverflow = {
      overflowX: bodyStyle.overflowX,
      overflowY: bodyStyle.overflowY,
      overflow: bodyStyle.overflow,
      height: bodyStyle.height,
    };

    // Check if document is scrollable
    results.documentScrollable = document.documentElement.scrollHeight > window.innerHeight;

    // Find all elements with overflow scroll/auto
    const allElements = document.querySelectorAll("*");
    for (const el of allElements) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;

      if (overflowY === "scroll" || overflowY === "auto") {
        // Ignore if it's html or body (allowed)
        if (el !== html && el !== body) {
          results.nestedScrollContainers.push({
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            overflowY: overflowY,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
          });
        }
      }
    }

    return results;
  });

  await browser.close();

  return scrollAnalysis;
}

async function main() {
  const url = process.env.TEST_URL || "http://localhost:5173";
  console.log("🔍 Validating Single Document Scroll");
  console.log(`📱 URL: ${url}\n`);

  let allPassed = true;

  for (const width of MOBILE_WIDTHS) {
    console.log(`\n📏 Testing at ${width}px`);
    console.log("━".repeat(60));

    try {
      const analysis = await validateScrollBehavior(url, width);

      // Check HTML overflow
      console.log("\n📄 HTML Element:");
      console.log(`   overflow-y: ${analysis.htmlOverflow.overflowY}`);
      if (analysis.htmlOverflow.overflowY === "hidden") {
        console.log("   ❌ FAIL: HTML should not have overflow-y: hidden");
        allPassed = false;
      } else {
        console.log("   ✅ PASS");
      }

      // Check BODY overflow
      console.log("\n🎨 BODY Element:");
      console.log(`   overflow-y: ${analysis.bodyOverflow.overflowY}`);
      console.log(`   height: ${analysis.bodyOverflow.height}`);
      if (analysis.bodyOverflow.overflowY === "scroll") {
        console.log("   ❌ FAIL: BODY should not have overflow-y: scroll");
        allPassed = false;
      } else {
        console.log("   ✅ PASS");
      }

      // Check nested scroll containers
      console.log("\n🔍 Nested Scroll Containers:");
      if (analysis.nestedScrollContainers.length === 0) {
        console.log("   ✅ PASS: No nested scroll containers found");
      } else {
        console.log(`   ❌ FAIL: Found ${analysis.nestedScrollContainers.length} nested scroll containers`);
        analysis.nestedScrollContainers.forEach((container, index) => {
          console.log(`\n   Container ${index + 1}:`);
          console.log(`     Tag: ${container.tagName}`);
          console.log(`     Class: ${container.className || "(none)"}`);
          console.log(`     ID: ${container.id || "(none)"}`);
          console.log(`     overflow-y: ${container.overflowY}`);
          console.log(`     Scrollable: ${container.scrollHeight > container.clientHeight}`);
        });
        allPassed = false;
      }

      // Check document scrollability
      console.log("\n📜 Document Scroll:");
      if (analysis.documentScrollable) {
        console.log("   ✅ PASS: Document is scrollable (single scroll context)");
      } else {
        console.log("   ⚠️  WARN: Document may not be tall enough to scroll");
      }
    } catch (error) {
      console.error(`\n❌ Error testing ${width}px:`, error.message);
      allPassed = false;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📋 SUMMARY");
  console.log("=".repeat(60));

  if (allPassed) {
    console.log("✅ All scroll validation tests PASSED!");
    console.log("   • No nested scroll containers");
    console.log("   • Single document scroll context");
    console.log("   • HTML/BODY configured correctly");
    process.exit(0);
  } else {
    console.log("❌ Some scroll validation tests FAILED!");
    console.log("   Review the issues above and fix nested scroll containers");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
