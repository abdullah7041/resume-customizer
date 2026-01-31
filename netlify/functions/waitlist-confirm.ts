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

    console.log(`[waitlist-confirm] Sending confirmation to ${email}`);

    const result = await sendWaitlistConfirmation(email, language || 'en');

    if (result.success) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Confirmation email sent',
          messageId: result.messageId
        }),
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: result.error || 'Failed to send confirmation email'
        }),
      };
    }
  } catch (error) {
    console.error("[waitlist-confirm] Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
