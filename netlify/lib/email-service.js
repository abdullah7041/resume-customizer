/**
 * Email Service using Resend
 * Handles sending templated emails with retry logic and error handling
 *
 * Supported email types:
 * - creditsRefreshed: Sent when monthly credits are reset
 * - monthlyUsageSummary: Sent with monthly statistics
 */

import { Resend } from 'resend';
import { emailTemplates } from './email-templates.js';
import { RateLimiter } from './rate-limiter.js';
import { redactForLog } from './sentry.js';

/**
 * How long any single Resend call may keep a caller waiting.
 *
 * The SDK exposes no AbortSignal and its transport is a bare fetch, so this
 * bounds the WAIT, not the request — the socket is left to the runtime. That is
 * still the difference between a function that reports a failure and one Netlify
 * kills at the wall clock with nothing written down.
 */
const EMAIL_REQUEST_TIMEOUT_MS = 15_000;

/**
 * The client, built on first use rather than at import.
 *
 * `new Resend(undefined)` throws, and at module scope that throw happened while
 * the module was being evaluated — taking down every function that imports this
 * file before a line of handler code ran, and making the RESEND_API_KEY guards
 * below unreachable. Built lazily, a missing key is a failed send with a reason
 * instead of a dead function.
 */
let resendClient = null;

function getResend() {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  resendClient = new Resend(apiKey);
  return resendClient;
}

/** Runs one Resend call under the deadline, or explains why it could not run. */
async function callResend(operation) {
  const resend = getResend();
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  let timer;
  try {
    return await Promise.race([
      operation(resend),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Resend request timed out after ${EMAIL_REQUEST_TIMEOUT_MS}ms`)),
          EMAIL_REQUEST_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    // Otherwise a 15s handle keeps the event loop alive after a fast success.
    clearTimeout(timer);
  }
}

const sendEmailViaResend = (payload) => callResend((resend) => resend.emails.send(payload));
const sendBatchViaResend = (payloads, options) => callResend((resend) => resend.batch.send(payloads, options));

// Configuration
// IMPORTANT: To send emails to real users, you must verify your domain at https://resend.com/domains
// Using hello@ instead of noreply@ for better deliverability and trust signals (2026 best practice)
// See: https://resend.com/docs/dashboard/domains/dmarc
const SENDER_EMAIL = process.env.RESEND_SENDER_EMAIL || 'hello@watheqai.app';
const SENDER_NAME_EN = process.env.RESEND_SENDER_NAME || 'Watheq';
const SENDER_NAME_AR = 'واثق';
const RESEND_BATCH_SIZE = 100;
const resendBatchRateLimiter = new RateLimiter({
  maxConcurrent: 1,
  minDelayBetweenRequestsMs: 200,
  maxRequestsPerMinute: 300,
});

/**
 * Get sender name based on language
 * @param {string} language - 'en' or 'ar'
 * @returns {string} Sender name
 */
function getSenderName(language) {
  return language === 'ar' ? SENDER_NAME_AR : SENDER_NAME_EN;
}
const REPLY_TO_EMAIL = 'support@watheqai.app';

/**
 * Get common email headers to improve deliverability
 * These headers help prevent emails from being marked as spam
 */
function getEmailHeaders(category = 'transactional') {
  return {
    'X-Entity-Ref-ID': `watheq-${Date.now()}`,
    'X-Mailer': 'Watheq Resume Optimizer',
    'X-Priority': '3', // Normal priority (1=high, 3=normal, 5=low)
    'X-MSMail-Priority': 'Normal',
    'Importance': 'Normal',
    'List-Unsubscribe': `<mailto:${REPLY_TO_EMAIL}?subject=Unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'Precedence': 'bulk',
    'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN, AutoReply',
  };
}

function summarizeEmailError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactForLog(error.message)
    };
  }

  return redactForLog(error);
}

function prepareCreditsRefreshedEmail({ email, userName, credits, language = 'en' }) {
  if (!email || !isValidEmail(email)) {
    return { error: 'Invalid email address' };
  }
  if (!userName) {
    return { error: 'Missing userName' };
  }
  if (!credits || credits <= 0) {
    return { error: 'Invalid credits amount' };
  }

  const lang = language === 'ar' ? 'ar' : 'en';
  const template = emailTemplates.creditsRefreshed[lang];
  if (!template) {
    return { error: `Template not found for language: ${lang}` };
  }

  return {
    email,
    lang,
    payload: {
      from: `${getSenderName(lang)} <${SENDER_EMAIL}>`,
      to: email,
      subject: template.subject,
      html: template.html(userName, credits),
      text: template.text(userName, credits),
      replyTo: REPLY_TO_EMAIL,
    },
  };
}

function prepareMonthlyUsageSummaryEmail({ email, userName, stats, language = 'en' }) {
  if (!email || !isValidEmail(email)) {
    return { error: 'Invalid email address' };
  }
  if (!userName) {
    return { error: 'Missing userName' };
  }
  if (!stats || typeof stats !== 'object') {
    return { error: 'Invalid stats object' };
  }

  const lang = language === 'ar' ? 'ar' : 'en';
  const template = emailTemplates.monthlyUsageSummary[lang];
  if (!template) {
    return { error: `Template not found for language: ${lang}` };
  }
  const normalizedStats = {
    totalUsed: stats.totalUsed || 0,
    remaining: stats.remaining || 0,
    totalActions: stats.totalActions || 0,
    usagePercentage: stats.usagePercentage || 0,
    nextResetDate: stats.nextResetDate || 'next month',
    breakdown: stats.breakdown || {},
  };

  return {
    email,
    lang,
    normalizedStats,
    payload: {
      from: `${getSenderName(lang)} <${SENDER_EMAIL}>`,
      to: email,
      subject: template.subject,
      html: template.html(userName, normalizedStats),
      text: template.text(userName, normalizedStats),
      replyTo: REPLY_TO_EMAIL,
    },
  };
}

async function sendPreparedEmailBatches(preparedEmails) {
  const result = {
    successCount: 0,
    failureCount: 0,
    errors: [],
  };

  for (let start = 0; start < preparedEmails.length; start += RESEND_BATCH_SIZE) {
    const batch = preparedEmails.slice(start, start + RESEND_BATCH_SIZE);

    try {
      const response = await resendBatchRateLimiter.execute(() =>
        sendBatchViaResend(
          batch.map(({ payload }) => payload),
          { batchValidation: 'permissive' },
        )
      );

      if (response.error) {
        for (const item of batch) {
          result.errors.push({ email: item.email, error: response.error.message });
        }
        result.failureCount += batch.length;
        continue;
      }

      const validationErrors = new Map(
        (response.data?.errors || []).map((error) => [error.index, error.message])
      );

      batch.forEach((item, index) => {
        const validationError = validationErrors.get(index);
        if (validationError) {
          result.failureCount += 1;
          result.errors.push({ email: item.email, error: validationError });
        } else {
          result.successCount += 1;
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown batch email error';
      for (const item of batch) {
        result.errors.push({ email: item.email, error: message });
      }
      result.failureCount += batch.length;
    }
  }

  return result;
}

/**
 * Send credits refreshed email
 * Called when user's monthly credit allowance is reset
 *
 * @param {string} userEmail - User's email address
 * @param {string} userName - User's display name
 * @param {number} credits - New credit amount (usually 20)
 * @param {string} language - Email language: 'en' or 'ar' (default: 'en')
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendCreditsRefreshedEmail(userEmail, userName, credits, language = 'en') {
  try {
    const prepared = prepareCreditsRefreshedEmail({
      email: userEmail,
      userName,
      credits,
      language,
    });
    if (prepared.error) {
      console.error('[email-service] Invalid credits email:', redactForLog(prepared.error));
      return { success: false, error: prepared.error };
    }

    console.log('[email-service] Sending credits refreshed email', {
      email: redactForLog(userEmail),
      credits,
      language: prepared.lang
    });

    // Send email via Resend
    const response = await sendEmailViaResend(prepared.payload);

    if (response.error) {
      console.error('[email-service] Resend API error:', summarizeEmailError(response.error));
      return { success: false, error: response.error.message };
    }

    console.log('[email-service] Credits email sent successfully', { messageId: response.data.id });
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error('[email-service] Failed to send credits email:', summarizeEmailError(error));
    return { success: false, error: error.message };
  }
}

/**
 * Queue credit-reset notifications through Resend's provider-side batch API.
 * Each API request carries at most 100 independent emails.
 */
export async function sendCreditsRefreshedEmailBatch(recipients = []) {
  const preparedEmails = [];
  const invalidErrors = [];

  for (const recipient of recipients) {
    const prepared = prepareCreditsRefreshedEmail(recipient || {});
    if (prepared.error) {
      invalidErrors.push({ email: recipient?.email || '', error: prepared.error });
      continue;
    }
    preparedEmails.push(prepared);
  }

  const result = await sendPreparedEmailBatches(preparedEmails);
  return {
    successCount: result.successCount,
    failureCount: result.failureCount + invalidErrors.length,
    errors: [...invalidErrors, ...result.errors],
  };
}

/**
 * Send monthly usage summary email
 * Called at the end of each month to summarize credit usage
 *
 * @param {string} userEmail - User's email address
 * @param {string} userName - User's display name
 * @param {Object} stats - Usage statistics object:
 *   {
 *     totalUsed: number,           // Total credits used this month
 *     remaining: number,           // Credits remaining
 *     totalActions: number,        // Total number of actions performed
 *     usagePercentage: number,     // Percentage of credits used (0-1)
 *     nextResetDate: string,       // Date when credits reset (e.g., "Feb 15, 2026")
 *     breakdown: {                 // Feature-by-feature breakdown
 *       'Feature Name': { count: number, credits: number },
 *       ...
 *     }
 *   }
 * @param {string} language - Email language: 'en' or 'ar' (default: 'en')
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendMonthlyUsageSummary(userEmail, userName, stats, language = 'en') {
  try {
    const prepared = prepareMonthlyUsageSummaryEmail({
      email: userEmail,
      userName,
      stats,
      language,
    });
    if (prepared.error) {
      console.error('[email-service] Invalid monthly summary email:', redactForLog(prepared.error));
      return { success: false, error: prepared.error };
    }

    console.log('[email-service] Sending monthly summary email', {
      email: redactForLog(userEmail),
      stats: prepared.normalizedStats,
      language: prepared.lang
    });

    // Send email via Resend
    const response = await sendEmailViaResend(prepared.payload);

    if (response.error) {
      console.error('[email-service] Resend API error:', summarizeEmailError(response.error));
      return { success: false, error: response.error.message };
    }

    console.log('[email-service] Monthly summary email sent successfully', { messageId: response.data.id });
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error('[email-service] Failed to send monthly summary:', summarizeEmailError(error));
    return { success: false, error: error.message };
  }
}

/**
 * Queue personalized monthly summaries through Resend's provider-side batch API.
 */
export async function sendMonthlyUsageSummaryBatch(recipients = []) {
  const preparedEmails = [];
  const invalidErrors = [];

  for (const recipient of recipients) {
    const prepared = prepareMonthlyUsageSummaryEmail(recipient || {});
    if (prepared.error) {
      invalidErrors.push({ email: recipient?.email || '', error: prepared.error });
      continue;
    }
    preparedEmails.push(prepared);
  }

  const result = await sendPreparedEmailBatches(preparedEmails);
  return {
    successCount: result.successCount,
    failureCount: result.failureCount + invalidErrors.length,
    errors: [...invalidErrors, ...result.errors],
  };
}

/**
 * Validate email address format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Test email delivery (development only)
 * Sends a test email to verify Resend is working
 *
 * @param {string} testEmail - Test email address
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendTestEmail(testEmail) {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const response = await sendEmailViaResend({
      from: `${SENDER_NAME_EN} <${SENDER_EMAIL}>`,
      to: testEmail,
      subject: 'Test Email - Watheq',
      html: '<h1>Test Email</h1><p>If you received this, Resend is working correctly!</p>',
      text: 'Test Email\n\nIf you received this, Resend is working correctly!'
    });

    if (response.error) {
      return { success: false, error: response.error.message };
    }

    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error('[email-service] Test email failed:', summarizeEmailError(error));
    return { success: false, error: error.message };
  }
}

/**
 * Send waitlist notification email
 * Called when Pro plan launches to notify waitlist users
 *
 * @param {string} userEmail - User's email address
 * @param {string} language - Email language: 'en' or 'ar' (default: 'en')
 * @param {string} planType - Plan type (e.g., 'pro', 'enterprise')
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendWaitlistNotification(userEmail, language = 'en', planType = 'pro') {
  try {
    // Validate inputs
    if (!userEmail || !isValidEmail(userEmail)) {
      console.error('[email-service] Invalid email address:', redactForLog(userEmail));
      return { success: false, error: 'Invalid email address' };
    }

    // Get template for language
    const lang = language === 'ar' ? 'ar' : 'en';
    const template = emailTemplates.waitlistNotification[lang];

    if (!template) {
      throw new Error(`Template not found for language: ${lang}`);
    }

    console.log('[email-service] Sending waitlist notification email', {
      email: redactForLog(userEmail),
      planType,
      language: lang
    });

    // Send email via Resend
    const response = await sendEmailViaResend({
      from: `${getSenderName(lang)} <${SENDER_EMAIL}>`,
      to: userEmail,
      subject: template.subject,
      html: template.html(planType),
      text: template.text(planType),
      replyTo: 'support@watheqai.app'
    });

    if (response.error) {
      console.error('[email-service] Resend API error:', summarizeEmailError(response.error));
      return { success: false, error: response.error.message };
    }

    console.log('[email-service] Waitlist notification sent successfully', { messageId: response.data.id });
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error('[email-service] Failed to send waitlist notification:', summarizeEmailError(error));
    return { success: false, error: error.message };
  }
}

/**
 * Send waitlist confirmation email
 * Called immediately when user joins the waitlist
 *
 * @param {string} userEmail - User's email address
 * @param {string} language - Email language: 'en' or 'ar' (default: 'en')
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendWaitlistConfirmation(userEmail, language = 'en') {
  try {
    // Validate inputs
    if (!userEmail || !isValidEmail(userEmail)) {
      console.error('[email-service] Invalid email address:', redactForLog(userEmail));
      return { success: false, error: 'Invalid email address' };
    }

    // Get template for language
    const lang = language === 'ar' ? 'ar' : 'en';
    const template = emailTemplates.waitlistConfirmation[lang];

    if (!template) {
      throw new Error(`Template not found for language: ${lang}`);
    }

    console.log('[email-service] Sending waitlist confirmation email', {
      email: redactForLog(userEmail),
      language: lang
    });

    // Send email via Resend with enhanced deliverability settings
    const response = await sendEmailViaResend({
      from: `${getSenderName(lang)} <${SENDER_EMAIL}>`,
      to: userEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      replyTo: REPLY_TO_EMAIL,
      headers: getEmailHeaders('waitlist'),
      tags: [
        { name: 'category', value: 'waitlist' },
        { name: 'type', value: 'confirmation' },
        { name: 'language', value: lang }
      ]
    });

    if (response.error) {
      console.error('[email-service] Resend API error:', summarizeEmailError(response.error));
      return { success: false, error: response.error.message };
    }

    console.log('[email-service] Waitlist confirmation sent successfully', { messageId: response.data.id });
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error('[email-service] Failed to send waitlist confirmation:', summarizeEmailError(error));
    return { success: false, error: error.message };
  }
}

/**
 * Send referral reward email to referrer
 * Called when a referred user completes their first paid action
 *
 * @param {string} userEmail - Referrer's email address
 * @param {string} userName - Referrer's display name
 * @param {string} refereeName - Referee's display name (optional)
 * @param {string} language - Email language: 'en' or 'ar' (default: 'en')
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendReferralRewardReferrer(userEmail, userName, refereeName, language = 'en') {
  try {
    // Validate inputs
    if (!userEmail || !isValidEmail(userEmail)) {
      console.error('[email-service] Invalid email address:', redactForLog(userEmail));
      return { success: false, error: 'Invalid email address' };
    }

    if (!userName) {
      console.error('[email-service] Missing userName');
      return { success: false, error: 'Missing userName' };
    }

    // Get template for language
    const lang = language === 'ar' ? 'ar' : 'en';
    const template = emailTemplates.referralRewardReferrer[lang];

    if (!template) {
      throw new Error(`Template not found for language: ${lang}`);
    }

    console.log('[email-service] Sending referral reward email to referrer', {
      email: redactForLog(userEmail),
      language: lang
    });

    // Send email via Resend
    const response = await sendEmailViaResend({
      from: `${getSenderName(lang)} <${SENDER_EMAIL}>`,
      to: userEmail,
      subject: template.subject,
      html: template.html(userName, refereeName),
      text: template.text(userName, refereeName),
      replyTo: REPLY_TO_EMAIL,
      headers: getEmailHeaders(),
      tags: [
        { name: 'category', value: 'referral' },
        { name: 'type', value: 'referrer_reward' },
        { name: 'language', value: lang }
      ]
    });

    if (response.error) {
      console.error('[email-service] Resend API error:', summarizeEmailError(response.error));
      return { success: false, error: response.error.message };
    }

    console.log('[email-service] Referral reward email sent successfully', { messageId: response.data.id });
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error('[email-service] Failed to send referral reward email:', summarizeEmailError(error));
    return { success: false, error: error.message };
  }
}

/**
 * Send referral reward email to referee
 * Called when a referred user completes their first paid action
 *
 * @param {string} userEmail - Referee's email address
 * @param {string} userName - Referee's display name
 * @param {string} referrerName - Referrer's display name (optional)
 * @param {string} language - Email language: 'en' or 'ar' (default: 'en')
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendReferralRewardReferee(userEmail, userName, referrerName, language = 'en') {
  try {
    // Validate inputs
    if (!userEmail || !isValidEmail(userEmail)) {
      console.error('[email-service] Invalid email address:', redactForLog(userEmail));
      return { success: false, error: 'Invalid email address' };
    }

    if (!userName) {
      console.error('[email-service] Missing userName');
      return { success: false, error: 'Missing userName' };
    }

    // Get template for language
    const lang = language === 'ar' ? 'ar' : 'en';
    const template = emailTemplates.referralRewardReferee[lang];

    if (!template) {
      throw new Error(`Template not found for language: ${lang}`);
    }

    console.log('[email-service] Sending referral reward email to referee', {
      email: redactForLog(userEmail),
      language: lang
    });

    // Send email via Resend
    const response = await sendEmailViaResend({
      from: `${getSenderName(lang)} <${SENDER_EMAIL}>`,
      to: userEmail,
      subject: template.subject,
      html: template.html(userName, referrerName),
      text: template.text(userName, referrerName),
      replyTo: REPLY_TO_EMAIL,
      headers: getEmailHeaders(),
      tags: [
        { name: 'category', value: 'referral' },
        { name: 'type', value: 'referee_reward' },
        { name: 'language', value: lang }
      ]
    });

    if (response.error) {
      console.error('[email-service] Resend API error:', summarizeEmailError(response.error));
      return { success: false, error: response.error.message };
    }

    console.log('[email-service] Referral reward email sent successfully', { messageId: response.data.id });
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error('[email-service] Failed to send referral reward email:', summarizeEmailError(error));
    return { success: false, error: error.message };
  }
}
