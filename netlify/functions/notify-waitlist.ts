/**
 * Notify Waitlist Function
 *
 * Manual trigger endpoint to send Pro plan launch notifications to waitlist users.
 *
 * Usage:
 *   GET /.netlify/functions/notify-waitlist?secret=<ADMIN_SECRET>&plan_type=pro
 *   GET /.netlify/functions/notify-waitlist?secret=<ADMIN_SECRET>&dry_run=true
 */

import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { sendWaitlistNotification } from "../lib/email-service.js";

// Admin secret for manual triggers (set in Netlify env vars)
const ADMIN_SECRET = process.env.ADMIN_SECRET || "change-me-in-production";

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase credentials");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export const handler: Handler = async (event) => {
  // Only accept GET requests (manual trigger)
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Verify admin secret
  const secret = event.queryStringParameters?.secret;
  if (secret !== ADMIN_SECRET) {
    console.warn("[notify-waitlist] Unauthorized access attempt");
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  const planType = event.queryStringParameters?.plan_type || "pro";
  const dryRun = event.queryStringParameters?.dry_run === "true";

  try {
    const supabase = getSupabaseClient();

    // Fetch all waitlist users who haven't been notified yet
    const { data: waitlistUsers, error } = await supabase
      .from("waitlist")
      .select("id, email, language, plan_type")
      .eq("plan_type", planType)
      .is("notified_at", null)
      .order("subscribed_at", { ascending: true });

    if (error) {
      console.error("[notify-waitlist] Failed to fetch waitlist:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to fetch waitlist" }),
      };
    }

    if (!waitlistUsers || waitlistUsers.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: "No users to notify",
          count: 0,
        }),
      };
    }

    console.log(`[notify-waitlist] Notifying ${waitlistUsers.length} users (dry_run: ${dryRun})`);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Send emails (with rate limiting to avoid Resend throttling)
    for (const user of waitlistUsers) {
      if (dryRun) {
        console.log(`[notify-waitlist] [DRY RUN] Would notify: ${user.email}`);
        results.success++;
        continue;
      }

      try {
        const emailResult = await sendWaitlistNotification(
          user.email,
          user.language || "en",
          planType
        );

        if (emailResult.success) {
          // Mark as notified in database
          await supabase
            .from("waitlist")
            .update({ notified_at: new Date().toISOString() })
            .eq("id", user.id);

          results.success++;
          console.log(`[notify-waitlist] Sent to ${user.email}`);
        } else {
          results.failed++;
          results.errors.push(`${user.email}: ${emailResult.error}`);
          console.error(`[notify-waitlist] Failed to send to ${user.email}:`, emailResult.error);
        }

        // Rate limiting: wait 100ms between emails (600 emails/min max)
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (err) {
        results.failed++;
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        results.errors.push(`${user.email}: ${errorMsg}`);
        console.error(`[notify-waitlist] Error sending to ${user.email}:`, err);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        plan_type: planType,
        dry_run: dryRun,
        total: waitlistUsers.length,
        sent: results.success,
        failed: results.failed,
        errors: results.errors.slice(0, 10), // Limit error list to first 10
      }),
    };
  } catch (error) {
    console.error("[notify-waitlist] Unexpected error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
