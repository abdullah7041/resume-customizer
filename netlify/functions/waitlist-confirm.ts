/**
 * Waitlist Confirmation Email Function
 *
 * Sends immediate confirmation email when user joins waitlist
 *
 * Usage:
 *   POST /.netlify/functions/waitlist-confirm
 *   Body: { email: string, language: string }
 */

import { Handler } from "@netlify/functions";
import { z } from "zod";
import { sendWaitlistConfirmation } from "../lib/email-service.js";
import { redactForLog, summarizeErrorForLog } from "../lib/sentry.js";
import { withRateLimit } from "../lib/rate-limiter.js";

const WaitlistConfirmRequestSchema = z.object({
  email: z.string().email(),
  language: z.enum(["en", "ar"]).optional(),
});

const baseHandler: Handler = async (event) => {
  // Only accept POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid JSON body" }),
      };
    }

    const parsed = WaitlistConfirmRequestSchema.safeParse(parsedBody);
    if (!parsed.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid request: email is required and must be a valid email address" }),
      };
    }

    const { email, language } = parsed.data;

    // Validate environment variables
    if (!process.env.RESEND_API_KEY) {
      console.error("[waitlist-confirm] RESEND_API_KEY not configured");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Email service not configured" }),
      };
    }

    console.log(`[waitlist-confirm] Sending confirmation to ${redactForLog(email)} (language: ${language || 'en'})`);

    const result = await sendWaitlistConfirmation(email, language || 'en');

    if (result.success) {
      console.log(`[waitlist-confirm] ✅ Email sent successfully. Message ID: ${result.messageId}`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Confirmation email sent',
          messageId: result.messageId
        }),
      };
    } else {
      console.error(`[waitlist-confirm] ❌ Email service error: ${result.error}`);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'Failed to send confirmation email',
        }),
      };
    }
  } catch (error) {
    console.error("[waitlist-confirm] Unexpected error:", summarizeErrorForLog(error));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

export const handler = withRateLimit("waitlist-confirm", baseHandler);
