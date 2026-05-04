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
import { sendWaitlistConfirmation } from "../lib/email-service.js";
import { redactForLog } from "../lib/sentry.js";

export const handler: Handler = async (event) => {
  // Only accept POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { email, language } = JSON.parse(event.body || '{}');

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email is required" }),
      };
    }

    // Validate environment variables
    if (!process.env.RESEND_API_KEY) {
      console.error("[waitlist-confirm] RESEND_API_KEY not configured");
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Email service not configured",
          details: "RESEND_API_KEY environment variable is missing"
        }),
      };
    }

    console.log(`[waitlist-confirm] Sending confirmation to ${redactForLog(email)} (language: ${language || 'en'})`);
    console.log(`[waitlist-confirm] Using sender: ${process.env.RESEND_SENDER_EMAIL || 'noreply@watheqai.app'}`);

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
          error: result.error || 'Failed to send confirmation email',
          hint: result.error?.includes('domain')
            ? 'Check that your domain is verified in Resend dashboard'
            : 'Check RESEND_API_KEY and RESEND_SENDER_EMAIL environment variables'
        }),
      };
    }
  } catch (error) {
    console.error("[waitlist-confirm] Unexpected error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      }),
    };
  }
};
