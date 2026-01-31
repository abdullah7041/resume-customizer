/**
 * Submit Feedback Function
 *
 * Allows users to submit emoji ratings and optional testimonials
 * Awards +1 credit for positive feedback (max 3 lifetime)
 *
 * POST /api/submit-feedback
 * Authorization: Bearer <jwt>
 * Body: { emoji_rating, testimonial_text?, context? }
 */

import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import {
  SubmitFeedbackRequestSchema,
  type SubmitFeedbackRequest,
} from "../lib/resume-schemas";
import { withRateLimit } from "../lib/rate-limiter";
import { addFeedbackCredits } from "../lib/credit-manager";

// Initialize Supabase client with service role
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase credentials");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// Get user from JWT token
async function getUserFromToken(token: string) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return null;
    }

    return data.user;
  } catch (error) {
    console.error("[submit-feedback] Token verification failed:", error);
    return null;
  }
}

const handler: Handler = async (event) => {
  // Wrap everything in try-catch to ensure JSON responses
  try {
    // Only accept POST requests
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }
    // 1. AUTHENTICATION: Extract and verify Bearer token
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[submit-feedback] Missing or invalid authorization header");
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    const user = await getUserFromToken(token);

    if (!user) {
      console.log("[submit-feedback] Token verification failed");
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    console.log(`[submit-feedback] Feedback from user ${user.id}`);

    // 2. VALIDATION: Parse and validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Request body is required" }),
      };
    }

    let requestData: unknown;
    try {
      requestData = JSON.parse(event.body);
    } catch {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid JSON in request body" }),
      };
    }

    const validationResult = SubmitFeedbackRequestSchema.safeParse(requestData);
    if (!validationResult.success) {
      const errors = validationResult.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      console.log(`[submit-feedback] Validation failed: ${errors}`);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Validation failed", details: errors }),
      };
    }

    const feedbackData: SubmitFeedbackRequest = validationResult.data;

    // 3. SAVE FEEDBACK: Insert feedback record
    const supabase = getSupabaseClient();
    const { data: savedFeedback, error: insertError } = await supabase
      .from("feedback")
      .insert({
        user_id: user.id,
        emoji_rating: feedbackData.emoji_rating,
        testimonial_text: feedbackData.testimonial_text || null,
        context: feedbackData.context || null,
        credit_awarded: false, // Set to true if credit awarded
      })
      .select()
      .single();

    if (insertError) {
      console.error("[submit-feedback] Failed to insert feedback:", insertError);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to save feedback" }),
      };
    }

    console.log(`[submit-feedback] Feedback saved: ${savedFeedback.id}`);

    // 4. AWARD CREDIT: For ALL feedback (Best Practice 2026 - encourages honest feedback)
    let creditAwarded = false;
    let creditsRemaining = 0;
    let maxFeedbackCreditsReached = false;
    let creditError: string | undefined;

    // Award credits for all feedback submissions (positive and negative)
    // This encourages users to give honest feedback instead of just positive ratings
    {
      try {
        // First ensure user has a credits record (in case trigger didn't fire)
        const { data: existingCredits } = await supabase
          .from("user_credits")
          .select("user_id, feedback_credits_earned, credits_remaining")
          .eq("user_id", user.id)
          .single();

        if (!existingCredits) {
          // Initialize credits for this user
          console.log(`[submit-feedback] Initializing credits for user ${user.id}`);
          await supabase.from("user_credits").insert({
            user_id: user.id,
            credits_remaining: 15,
            credits_total: 15,
            feedback_credits_earned: 0,
            referral_credits_earned: 0,
            last_reset_date: new Date().toISOString(),
          });
        }

        const creditResult = await addFeedbackCredits(user.id, {
          emoji_rating: feedbackData.emoji_rating,
          feedback_id: savedFeedback.id,
        });

        if (creditResult.success) {
          creditAwarded = true;
          creditsRemaining = creditResult.creditsRemaining;
          console.log(
            `[submit-feedback] Credit awarded. Feedback credits earned: ${creditResult.feedbackCreditsEarned}/3`
          );

          // Update feedback record to mark credit as awarded
          await supabase
            .from("feedback")
            .update({ credit_awarded: true })
            .eq("id", savedFeedback.id);
        } else {
          // Credit not awarded (likely max reached)
          maxFeedbackCreditsReached =
            creditResult.error === "max_feedback_credits_reached";
          console.log(
            `[submit-feedback] Credit not awarded: ${creditResult.error}`
          );
          creditError = creditResult.error;
        }
      } catch (error) {
        // Non-blocking: feedback is saved even if credit award fails
        console.error("[submit-feedback] Credit award failed (non-blocking):", error);
        creditError = "credit_award_failed";
      }
    }

    // 5. RETURN RESPONSE
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        feedback: {
          id: savedFeedback.id,
          emoji_rating: savedFeedback.emoji_rating,
          testimonial_text: savedFeedback.testimonial_text,
          created_at: savedFeedback.created_at,
        },
        credit: {
          awarded: creditAwarded,
          creditsRemaining,
          maxFeedbackCreditsReached,
          error: creditError,
        },
      }),
    };
  } catch (error) {
    // Catch any unexpected errors and return JSON
    console.error("[submit-feedback] Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Internal server error",
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      }),
    };
  }
};

// Wrap with rate limiting (5 req/min per IP)
export const handle = withRateLimit("submit-feedback", handler);
