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

const resend = new Resend(process.env.RESEND_API_KEY);

// Configuration
// IMPORTANT: To send emails to real users, you must verify your domain at https://resend.com/domains
// Using hello@ instead of noreply@ for better deliverability and trust signals (2026 best practice)
// See: https://resend.com/docs/dashboard/domains/dmarc
const SENDER_EMAIL = process.env.RESEND_SENDER_EMAIL || 'hello@watheqai.app';
const SENDER_NAME_EN = process.env.RESEND_SENDER_NAME || 'Watheq';
const SENDER_NAME_AR = 'واثق';

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
    // Validate inputs
    if (!userEmail || !isValidEmail(userEmail)) {
      console.error('[email-service] Invalid email address:', userEmail);
      return { success: false, error: 'Invalid email address' };
    }

    if (!userName) {
      console.error('[email-service] Missing userName');
      return { success: false, error: 'Missing userName' };
    }

    if (!credits || credits <= 0) {
      console.error('[email-service] Invalid credits amount:', credits);
      return { success: false, error: 'Invalid credits amount' };
    }

    // Get template for language
    const lang = language === 'ar' ? 'ar' : 'en';
    const template = emailTemplates.creditsRefreshed[lang];

    if (!template) {
      throw new Error(`Template not found for language: ${lang}`);
    }

    console.log('[email-service] Sending credits refreshed email', {
      email: userEmail,
      name: userName,
      credits,
      language: lang
    });

    // Send email via Resend
    const response = await resend.emails.send({
      from: `${getSenderName(lang)} <${SENDER_EMAIL}>`,
      to: userEmail,
      subject: template.subject,
      html: template.html(userName, credits),
      text: template.text(userName, credits),
      replyTo: 'support@watheqai.app'
    });

    if (response.error) {
      console.error('[email-service] Resend API error:', response.error);
      return { success: false, error: response.error.message };
    }

    console.log('[email-service] Credits email sent successfully', { messageId: response.data.id });
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error('[email-service] Failed to send credits email:', error);
    return { success: false, error: error.message };
  }
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
    // Validate inputs
    if (!userEmail || !isValidEmail(userEmail)) {
      console.error('[email-service] Invalid email address:', userEmail);
      return { success: false, error: 'Invalid email address' };
    }

    if (!userName) {
      console.error('[email-service] Missing userName');
      return { success: false, error: 'Missing userName' };
    }

    if (!stats || typeof stats !== 'object') {
      console.error('[email-service] Invalid stats object:', stats);
      return { success: false, error: 'Invalid stats object' };
    }

    // Validate stats structure
    const defaultStats = {
      totalUsed: stats.totalUsed || 0,
      remaining: stats.remaining || 0,
      totalActions: stats.totalActions || 0,
      usagePercentage: stats.usagePercentage || 0,
      nextResetDate: stats.nextResetDate || 'next month',
      breakdown: stats.breakdown || {}
    };

    // Get template for language
    const lang = language === 'ar' ? 'ar' : 'en';
    const template = emailTemplates.monthlyUsageSummary[lang];

    if (!template) {
      throw new Error(`Template not found for language: ${lang}`);
    }

    console.log('[email-service] Sending monthly summary email', {
      email: userEmail,
      name: userName,
      stats: defaultStats,
      language: lang
    });

    // Send email via Resend
    const response = await resend.emails.send({
      from: `${getSenderName(lang)} <${SENDER_EMAIL}>`,
      to: userEmail,
      subject: template.subject,
      html: template.html(userName, defaultStats),
      text: template.text(userName, defaultStats),
      replyTo: 'support@watheqai.app'
    });

    if (response.error) {
      console.error('[email-service] Resend API error:', response.error);
      return { success: false, error: response.error.message };
    }

    console.log('[email-service] Monthly summary email sent successfully', { messageId: response.data.id });
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error('[email-service] Failed to send monthly summary:', error);
    return { success: false, error: error.message };
  }
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
    const response = await resend.emails.send({
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
    console.error('[email-service] Test email failed:', error);
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
      console.error('[email-service] Invalid email address:', userEmail);
      return { success: false, error: 'Invalid email address' };
    }

    // Get template for language
    const lang = language === 'ar' ? 'ar' : 'en';
    const template = emailTemplates.waitlistNotification[lang];

    if (!template) {
      throw new Error(`Template not found for language: ${lang}`);
    }

    console.log('[email-service] Sending waitlist notification email', {
      email: userEmail,
      planType,
      language: lang
    });

    // Send email via Resend
    const response = await resend.emails.send({
      from: `${getSenderName(lang)} <${SENDER_EMAIL}>`,
      to: userEmail,
      subject: template.subject,
      html: template.html(planType),
      text: template.text(planType),
      replyTo: 'support@watheqai.app'
    });

    if (response.error) {
      console.error('[email-service] Resend API error:', response.error);
      return { success: false, error: response.error.message };
    }

    console.log('[email-service] Waitlist notification sent successfully', { messageId: response.data.id });
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error('[email-service] Failed to send waitlist notification:', error);
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
      console.error('[email-service] Invalid email address:', userEmail);
      return { success: false, error: 'Invalid email address' };
    }

    // Get template for language
    const lang = language === 'ar' ? 'ar' : 'en';
    const template = emailTemplates.waitlistConfirmation[lang];

    if (!template) {
      throw new Error(`Template not found for language: ${lang}`);
    }

    console.log('[email-service] Sending waitlist confirmation email', {
      email: userEmail,
      language: lang
    });

    // Send email via Resend with enhanced deliverability settings
    const response = await resend.emails.send({
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
      console.error('[email-service] Resend API error:', response.error);
      return { success: false, error: response.error.message };
    }

    console.log('[email-service] Waitlist confirmation sent successfully', { messageId: response.data.id });
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error('[email-service] Failed to send waitlist confirmation:', error);
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
      console.error('[email-service] Invalid email address:', userEmail);
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
      email: userEmail,
      name: userName,
      refereeName,
      language: lang
    });

    // Send email via Resend
    const response = await resend.emails.send({
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
      console.error('[email-service] Resend API error:', response.error);
      return { success: false, error: response.error.message };
    }

    console.log('[email-service] Referral reward email sent successfully', { messageId: response.data.id });
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error('[email-service] Failed to send referral reward email:', error);
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
      console.error('[email-service] Invalid email address:', userEmail);
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
      email: userEmail,
      name: userName,
      referrerName,
      language: lang
    });

    // Send email via Resend
    const response = await resend.emails.send({
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
      console.error('[email-service] Resend API error:', response.error);
      return { success: false, error: response.error.message };
    }

    console.log('[email-service] Referral reward email sent successfully', { messageId: response.data.id });
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error('[email-service] Failed to send referral reward email:', error);
    return { success: false, error: error.message };
  }
}
