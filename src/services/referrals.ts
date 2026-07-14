import { supabase } from './supabase';

export interface ReferralSummary {
  referralCode?: string;
  referralUrl?: string;
  totalReferrals?: number;
  completedReferrals?: number;
  pendingReferrals?: number;
  creditsEarned?: number;
  /** Set when the summary succeeded but the referral-link leg failed server-side. */
  linkError?: string;
  /** Set when the summary succeeded but the referral-stats leg failed server-side. */
  statsError?: string;
}

const REFERRAL_SUMMARY_CACHE_TTL_MS = 1000;

type ReferralSessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;

let pendingReferralSession: Promise<ReferralSessionResult> | null = null;
const pendingReferralSummaries = new Map<string, Promise<ReferralSummary>>();
const recentReferralSummaries = new Map<string, { fetchedAt: number; summary: ReferralSummary }>();

const getReferralSession = () => {
  if (!pendingReferralSession) {
    pendingReferralSession = supabase.auth.getSession().finally(() => {
      pendingReferralSession = null;
    });
  }

  return pendingReferralSession;
};

const getReferralSessionKey = (session: NonNullable<ReferralSessionResult['data']['session']>) =>
  session.user?.id ?? session.user?.email ?? session.access_token;

export const clearReferralSummaryCache = () => {
  pendingReferralSession = null;
  pendingReferralSummaries.clear();
  recentReferralSummaries.clear();
};

export async function fetchReferralSummary(): Promise<ReferralSummary> {
  const {
    data: { session },
  } = await getReferralSession();

  if (!session?.access_token) {
    throw new Error('Authentication required');
  }

  const sessionKey = getReferralSessionKey(session);
  const recentReferralSummary = recentReferralSummaries.get(sessionKey);
  if (
    recentReferralSummary &&
    Date.now() - recentReferralSummary.fetchedAt < REFERRAL_SUMMARY_CACHE_TTL_MS
  ) {
    return recentReferralSummary.summary;
  }

  const pendingReferralSummary = pendingReferralSummaries.get(sessionKey);
  if (pendingReferralSummary) {
    return pendingReferralSummary;
  }

  const request = (async () => {
    const response = await fetch('/.netlify/functions/referral-api?action=get-summary', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to load referral summary');
    }

    const summary: ReferralSummary = {
      referralCode: data.referralCode,
      referralUrl: data.referralUrl,
      totalReferrals: data.totalReferrals,
      completedReferrals: data.completedReferrals,
      pendingReferrals: data.pendingReferrals,
      creditsEarned: data.creditsEarned,
      ...(typeof data.linkError === 'string' ? { linkError: data.linkError } : {}),
      ...(typeof data.statsError === 'string' ? { statsError: data.statsError } : {}),
    };

    recentReferralSummaries.set(sessionKey, { fetchedAt: Date.now(), summary });
    return summary;
  })().finally(() => {
    pendingReferralSummaries.delete(sessionKey);
  });

  pendingReferralSummaries.set(sessionKey, request);
  return request;
}
