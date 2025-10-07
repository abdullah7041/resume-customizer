#!/usr/bin/env node

/**
 * Mobile Lighthouse Performance Validator
 * Ensures mobile performance meets thresholds:
 * - Mobile Performance ≥85
 * - Accessibility ≥95
 * - CLS ≤0.05
 */

import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import fs from "fs";
import path from "path";

const THRESHOLDS = {
  mobile: 85,
  accessibility: 95,
  cls: 0.05,
};

const MOBILE_WIDTHS = [390, 414, 430];

async function runLighthouse(url, formFactor, width) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
  });

  const options = {
    logLevel: "info",
    output: "json",
    onlyCategories: ["performance", "accessibility"],
    port: chrome.port,
    formFactor: formFactor,
    screenEmulation: {
      mobile: formFactor === "mobile",
      width: width,
      height: 844,
      deviceScaleFactor: formFactor === "mobile" ? 3 : 1,
      disabled: false,
    },
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
    },
  };

  try {
    const runnerResult = await lighthouse(url, options);
    await chrome.kill();
    return runnerResult;
  } catch (error) {
    await chrome.kill();
    throw error;
  }
}

function extractMetrics(lhr) {
  const performance = lhr.categories.performance.score * 100;
  const accessibility = lhr.categories.accessibility.score * 100;
  const cls = lhr.audits["cumulative-layout-shift"].numericValue;
  const fcp = lhr.audits["first-contentful-paint"].numericValue;
  const lcp = lhr.audits["largest-contentful-paint"].numericValue;
  const tbt = lhr.audits["total-blocking-time"].numericValue;
  const si = lhr.audits["speed-index"].numericValue;

  return {
    performance,
    accessibility,
    cls,
    fcp,
    lcp,
    tbt,
    si,
  };
}

function checkThresholds(metrics, width) {
  const results = [];
  let passed = true;

  console.log(`\n📱 Testing at width: ${width}px`);
  console.log("━".repeat(60));

  // Check Mobile Performance
  const perfStatus = metrics.performance >= THRESHOLDS.mobile ? "✅" : "❌";
  console.log(
    `${perfStatus} Performance: ${metrics.performance.toFixed(1)} (threshold: ${THRESHOLDS.mobile})`
  );
  if (metrics.performance < THRESHOLDS.mobile) {
    results.push(`Performance score ${metrics.performance.toFixed(1)} is below ${THRESHOLDS.mobile}`);
    passed = false;
  }

  // Check Accessibility
  const a11yStatus = metrics.accessibility >= THRESHOLDS.accessibility ? "✅" : "❌";
  console.log(
    `${a11yStatus} Accessibility: ${metrics.accessibility.toFixed(1)} (threshold: ${THRESHOLDS.accessibility})`
  );
  if (metrics.accessibility < THRESHOLDS.accessibility) {
    results.push(
      `Accessibility score ${metrics.accessibility.toFixed(1)} is below ${THRESHOLDS.accessibility}`
    );
    passed = false;
  }

  // Check CLS
  const clsStatus = metrics.cls <= THRESHOLDS.cls ? "✅" : "❌";
  console.log(`${clsStatus} CLS: ${metrics.cls.toFixed(4)} (threshold: ≤${THRESHOLDS.cls})`);
  if (metrics.cls > THRESHOLDS.cls) {
    results.push(`CLS ${metrics.cls.toFixed(4)} exceeds ${THRESHOLDS.cls}`);
    passed = false;
  }

  console.log("\n📊 Core Web Vitals:");
  console.log(`   FCP: ${(metrics.fcp / 1000).toFixed(2)}s`);
  console.log(`   LCP: ${(metrics.lcp / 1000).toFixed(2)}s`);
  console.log(`   TBT: ${metrics.tbt.toFixed(0)}ms`);
  console.log(`   SI:  ${(metrics.si / 1000).toFixed(2)}s`);

  return { passed, results };
}

async function main() {
  const url = process.env.TEST_URL || "http://localhost:5173";
  console.log(`🚀 Starting Lighthouse Mobile Performance Validation`);
  console.log(`🎯 URL: ${url}`);
  console.log(`📏 Testing widths: ${MOBILE_WIDTHS.join(", ")}px`);
  console.log(`\n⚙️  Thresholds:`);
  console.log(`   Mobile Performance: ≥${THRESHOLDS.mobile}`);
  console.log(`   Accessibility: ≥${THRESHOLDS.accessibility}`);
  console.log(`   CLS: ≤${THRESHOLDS.cls}`);

  const allResults = [];
  let allPassed = true;

  for (const width of MOBILE_WIDTHS) {
    try {
      const result = await runLighthouse(url, "mobile", width);
      const metrics = extractMetrics(result.lhr);
      const { passed, results } = checkThresholds(metrics, width);

      allResults.push({
        width,
        metrics,
        passed,
        issues: results,
      });

      if (!passed) {
        allPassed = false;
      }

      // Save detailed report
      const reportDir = path.join(process.cwd(), "lighthouse-reports");
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      const reportPath = path.join(reportDir, `mobile-${width}px.json`);
      fs.writeFileSync(reportPath, JSON.stringify(result.lhr, null, 2));
      console.log(`\n💾 Detailed report saved: ${reportPath}`);
    } catch (error) {
      console.error(`\n❌ Failed to run Lighthouse for ${width}px:`, error.message);
      allPassed = false;
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 SUMMARY");
  console.log("=".repeat(60));

  for (const result of allResults) {
    const status = result.passed ? "✅ PASSED" : "❌ FAILED";
    console.log(`\n${result.width}px: ${status}`);
    if (!result.passed) {
      result.issues.forEach((issue) => console.log(`  • ${issue}`));
    }
  }

  console.log("\n" + "=".repeat(60));

  if (allPassed) {
    console.log("✅ All mobile performance tests PASSED!");
    process.exit(0);
  } else {
    console.log("❌ Some mobile performance tests FAILED!");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
