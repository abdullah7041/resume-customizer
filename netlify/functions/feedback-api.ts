import { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { createHash } from 'crypto';
import { withRateLimit } from '../lib/rate-limiter.js';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { redactForLog, summarizeErrorForLog } from '../lib/sentry.js';

const MIN_MESSAGE_LENGTH = 30;
const MAX_MESSAGE_LENGTH = 4000;

const FEEDBACK_TYPES = new Set([
  'bug',
  'resume_quality',
  'confusing_ux',
  'feature_request',
  'pricing_credits',
  'other',
]);

const FEEDBACK_STATUSES = new Set(['new', 'reviewing', 'resolved', 'closed']);
const FEEDBACK_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const TRUST_TO_APPLY_ANSWERS = new Set(['yes', 'somewhat', 'no']);
const WILLINGNESS_TO_PAY_ANSWERS = new Set(['yes', 'maybe', 'no']);

type FeedbackType =
  | 'bug'
  | 'resume_quality'
  | 'confusing_ux'
  | 'feature_request'
  | 'pricing_credits'
  | 'other';

type TrustToApply = 'yes' | 'somewhat' | 'no';
type WillingnessToPay = 'yes' | 'maybe' | 'no';

interface AuthenticatedUser {
  id: string;
  email: string;
  app_metadata?: Record<string, unknown>;
}

interface HttpError {
  statusCode: number;
  message: string;
  code?: string;
}

interface SubmitFeedbackBody {
  type?: unknown;
  message?: unknown;
  rating?: unknown;
  validation?: {
    trustToApply?: unknown;
    willingnessToPay?: unknown;
  };
  context?: {
    pagePath?: unknown;
    userAgent?: unknown;
    viewport?: unknown;
    contextFeature?: unknown;
  };
}

interface UpdateFeedbackBody {
  id?: unknown;
  status?: unknown;
  priority?: unknown;
  adminNotes?: unknown;
  admin_notes?: unknown;
}

function json(statusCode: number, body: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function httpError(statusCode: number, message: string, code?: string): HttpError {
  return { statusCode, message, code };
}

function isHttpError(error: unknown): error is HttpError {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'statusCode' in error &&
      typeof (error as { statusCode?: unknown }).statusCode === 'number'
  );
}

function getAuthHeader(event: HandlerEvent): string | undefined {
  return event.headers.authorization || event.headers.Authorization;
}

function parseJsonBody<T>(event: HandlerEvent): T {
  try {
    return JSON.parse(event.body || '{}') as T;
  } catch {
    throw httpError(400, 'Invalid JSON body', 'invalid_json');
  }
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw httpError(400, `${fieldName} is required`, 'validation_failed');
  }
  return value.trim();
}

function optionalString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function optionalAllowedString<T extends string>(
  value: unknown,
  allowedValues: Set<string>,
  fieldName: string
): T | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string' || !allowedValues.has(value)) {
    throw httpError(400, `Invalid ${fieldName}`, 'invalid_validation_answer');
  }

  return value as T;
}

function normalizeFeedbackMessage(message: string): string {
  return message.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function hashFeedbackMessage(message: string): string {
  return createHash('sha256').update(normalizeFeedbackMessage(message)).digest('hex');
}

function buildMessageHashInput({
  message,
  trustToApply,
  willingnessToPay,
}: {
  message: string;
  trustToApply: TrustToApply | null;
  willingnessToPay: WillingnessToPay | null;
}): string {
  return JSON.stringify({
    message,
    trust_to_apply: trustToApply ?? null,
    willingness_to_pay: willingnessToPay ?? null,
  });
}

function isAdmin(user: AuthenticatedUser): boolean {
  return user.app_metadata?.role === 'admin';
}

async function verifyUser(event: HandlerEvent): Promise<AuthenticatedUser> {
  const authHeader = getAuthHeader(event);
  if (!authHeader) {
    throw httpError(401, 'Authentication required', 'auth_required');
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw httpError(503, 'Service temporarily unavailable', 'service_unavailable');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data, error } = await supabase.auth.getUser(token);
  const user = data?.user;

  if (error || !user?.id || !user.email) {
    throw httpError(401, 'Invalid or expired authentication token', 'invalid_token');
  }

  return {
    id: user.id,
    email: user.email,
    app_metadata: user.app_metadata,
  };
}

function parseSubmitBody(event: HandlerEvent) {
  const body = parseJsonBody<SubmitFeedbackBody>(event);
  const type = requireString(body.type, 'Feedback type');
  const message = requireString(body.message, 'Feedback message');

  if (!FEEDBACK_TYPES.has(type)) {
    throw httpError(400, 'Invalid feedback type', 'invalid_feedback_type');
  }

  if (message.length < MIN_MESSAGE_LENGTH) {
    throw httpError(400, 'Feedback message must be at least 30 characters', 'message_too_short');
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw httpError(400, 'Feedback message must be 4000 characters or fewer', 'message_too_long');
  }

  let rating: number | null = null;
  if (body.rating !== undefined && body.rating !== null && body.rating !== '') {
    const numericRating = Number(body.rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      throw httpError(400, 'Rating must be between 1 and 5', 'invalid_rating');
    }
    rating = numericRating;
  }

  const trustToApply = optionalAllowedString<TrustToApply>(
    body.validation?.trustToApply,
    TRUST_TO_APPLY_ANSWERS,
    'trust_to_apply'
  );
  const willingnessToPay = optionalAllowedString<WillingnessToPay>(
    body.validation?.willingnessToPay,
    WILLINGNESS_TO_PAY_ANSWERS,
    'willingness_to_pay'
  );
  return {
    type: type as FeedbackType,
    message,
    rating,
    trustToApply,
    willingnessToPay,
    pagePath: optionalString(body.context?.pagePath, '/').slice(0, 500) || '/',
    userAgent: optionalString(body.context?.userAgent).slice(0, 1000),
    viewport: optionalString(body.context?.viewport).slice(0, 200),
    messageHash: hashFeedbackMessage(buildMessageHashInput({ message, trustToApply, willingnessToPay })),
  };
}

async function submitFeedback(event: HandlerEvent) {
  const user = await verifyUser(event);
  const payload = parseSubmitBody(event);
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw httpError(503, 'Service temporarily unavailable', 'service_unavailable');
  }

  const { data, error } = await supabase.rpc('submit_feedback_report', {
    p_user_id: user.id,
    p_user_email: user.email,
    p_type: payload.type,
    p_message: payload.message,
    p_rating: payload.rating,
    p_trust_to_apply: payload.trustToApply,
    p_willingness_to_pay: payload.willingnessToPay,
    p_page_path: payload.pagePath,
    p_user_agent: payload.userAgent,
    p_viewport: payload.viewport,
    p_message_hash: payload.messageHash,
  });

  if (error) {
    console.error('[feedback-api] Submit RPC failed:', summarizeErrorForLog(error));
    throw httpError(500, 'Failed to submit feedback', 'submit_failed');
  }

  const result = data as {
    success?: boolean;
    error?: string;
    id?: string;
    reward_status?: string;
    credits_awarded?: number;
    credits_remaining?: number;
  } | null;

  if (!result?.success) {
    const code = result?.error === 'duplicate_feedback' ? 'duplicate_feedback' : 'submit_failed';
    const statusCode = code === 'duplicate_feedback' ? 409 : 400;
    throw httpError(statusCode, 'You already submitted this feedback message.', code);
  }

  return json(200, {
    success: true,
    id: result.id,
    rewardStatus: result.reward_status,
    creditsAwarded: result.credits_awarded ?? 0,
    creditsRemaining: result.credits_remaining ?? null,
  });
}

async function requireAdmin(event: HandlerEvent): Promise<AuthenticatedUser> {
  const user = await verifyUser(event);
  if (!isAdmin(user)) {
    throw httpError(403, 'Admin access required', 'admin_required');
  }
  return user;
}

async function listFeedback(event: HandlerEvent) {
  await requireAdmin(event);
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw httpError(503, 'Service temporarily unavailable', 'service_unavailable');
  }

  const status = event.queryStringParameters?.status;
  let query = supabase
    .from('feedback_reports')
    .select('id,user_id,user_email,type,message,rating,trust_to_apply,willingness_to_pay,page_path,status,priority,reward_status,credits_awarded,admin_notes,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (status && FEEDBACK_STATUSES.has(status)) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[feedback-api] Admin list failed:', summarizeErrorForLog(error));
    throw httpError(500, 'Failed to load feedback reports', 'list_failed');
  }

  return json(200, { success: true, reports: data ?? [] });
}

function parseUpdateBody(event: HandlerEvent) {
  const body = parseJsonBody<UpdateFeedbackBody>(event);
  const id = requireString(body.id, 'Feedback report id');
  const status = body.status === undefined ? undefined : requireString(body.status, 'Status');
  const priority = body.priority === undefined ? undefined : requireString(body.priority, 'Priority');
  const adminNotesValue = body.adminNotes ?? body.admin_notes;
  const adminNotes = adminNotesValue === undefined ? undefined : optionalString(adminNotesValue);

  if (status !== undefined && !FEEDBACK_STATUSES.has(status)) {
    throw httpError(400, 'Invalid feedback status', 'invalid_status');
  }

  if (priority !== undefined && !FEEDBACK_PRIORITIES.has(priority)) {
    throw httpError(400, 'Invalid feedback priority', 'invalid_priority');
  }

  const updates: Record<string, string | null> = {};
  if (status !== undefined) updates.status = status;
  if (priority !== undefined) updates.priority = priority;
  if (adminNotes !== undefined) updates.admin_notes = adminNotes || null;

  if (Object.keys(updates).length === 0) {
    throw httpError(400, 'No valid fields to update', 'empty_update');
  }

  return { id, updates };
}

async function updateFeedback(event: HandlerEvent) {
  await requireAdmin(event);
  const { id, updates } = parseUpdateBody(event);
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw httpError(503, 'Service temporarily unavailable', 'service_unavailable');
  }

  const { data, error } = await supabase
    .from('feedback_reports')
    .update(updates)
    .eq('id', id)
    .select('id,status,priority,admin_notes,updated_at')
    .single();

  if (error) {
    console.error('[feedback-api] Admin update failed:', summarizeErrorForLog(error));
    throw httpError(500, 'Failed to update feedback report', 'update_failed');
  }

  return json(200, { success: true, report: data });
}

const baseHandler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'POST') {
      return await submitFeedback(event);
    }

    if (event.httpMethod === 'GET') {
      return await listFeedback(event);
    }

    if (event.httpMethod === 'PATCH') {
      return await updateFeedback(event);
    }

    return json(405, { error: 'Method not allowed' });
  } catch (error: unknown) {
    if (isHttpError(error)) {
      return json(error.statusCode, {
        error: error.message,
        code: error.code ?? 'request_failed',
      });
    }

    console.error('[feedback-api] Unexpected error:', summarizeErrorForLog(error));
    return json(500, {
      error: 'Feedback operation failed',
      code: 'feedback_operation_failed',
      detail: error instanceof Error ? redactForLog(error.message) : undefined,
    });
  }
};

export const handler = withRateLimit('feedback-api', baseHandler);
