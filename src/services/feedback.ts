import { supabase } from './supabase';
import type {
  FeedbackContext,
  FeedbackReport,
  SubmitFeedbackInput,
  SubmitFeedbackResponse,
  UpdateFeedbackReportInput,
} from '@/types/feedback';

const FEEDBACK_ENDPOINT = '/.netlify/functions/feedback-api';

async function getFeedbackAuthHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.warn('[FeedbackService] Failed to retrieve auth session:', {
      message: error.message,
      name: error.name,
    });
  }

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  return headers;
}

export function buildFeedbackContext(): FeedbackContext {
  if (typeof window === 'undefined') {
    return {
      pagePath: '/',
      userAgent: '',
      viewport: 'server',
    };
  }

  const width = window.innerWidth || 0;
  const height = window.innerHeight || 0;
  const pointer = window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'pointer';
  const size = width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';

  return {
    pagePath: window.location.pathname || '/',
    userAgent: window.navigator.userAgent || '',
    viewport: `${size} ${width}x${height} ${pointer}`,
  };
}

async function parseFeedbackResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as { error?: string; code?: string };

  if (!response.ok) {
    const error = new Error(data.error || 'Feedback request failed');
    Object.assign(error, {
      status: response.status,
      code: data.code,
    });
    throw error;
  }

  return data as T;
}

export async function submitFeedbackReport(
  input: SubmitFeedbackInput
): Promise<SubmitFeedbackResponse> {
  const headers = await getFeedbackAuthHeaders();
  const response = await fetch(FEEDBACK_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type: input.type,
      message: input.message,
      rating: input.rating ?? null,
      context: buildFeedbackContext(),
    }),
  });

  return parseFeedbackResponse<SubmitFeedbackResponse>(response);
}

export async function listFeedbackReports(): Promise<FeedbackReport[]> {
  const headers = await getFeedbackAuthHeaders();
  const response = await fetch(FEEDBACK_ENDPOINT, {
    method: 'GET',
    headers,
  });

  const data = await parseFeedbackResponse<{ reports: FeedbackReport[] }>(response);
  return data.reports;
}

export async function updateFeedbackReport(
  input: UpdateFeedbackReportInput
): Promise<FeedbackReport> {
  const headers = await getFeedbackAuthHeaders();
  const response = await fetch(FEEDBACK_ENDPOINT, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(input),
  });

  const data = await parseFeedbackResponse<{ report: FeedbackReport }>(response);
  return data.report;
}
