import type { Handler } from "@netlify/functions";
import { checkBetaQuota } from "../lib/rate-limiter";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Beta-Code",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
} as const;

const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: HEADERS, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const betaCode = event.headers["x-beta-code"] || event.headers["X-Beta-Code"];

  if (!betaCode) {
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: "Beta code required" }) };
  }

  try {
    // Check all quota types in parallel
    const [upload, extract, match, optimize, predict, coverLetter] = await Promise.all([
      checkBetaQuota(betaCode, 'upload'),
      checkBetaQuota(betaCode, 'extract'),
      checkBetaQuota(betaCode, 'match'),
      checkBetaQuota(betaCode, 'optimize'),
      checkBetaQuota(betaCode, 'predict'),
      checkBetaQuota(betaCode, 'coverLetter'),
    ]);

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ upload, extract, match, optimize, predict, coverLetter }),
    };
  } catch (error) {
    console.error("[beta-quota-status] Error:", error);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: "Failed to fetch quota" }) };
  }
};

export { handler };
