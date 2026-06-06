import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearReferralSummaryCache, fetchReferralSummary } from './referrals';

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}));

describe('referral service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearReferralSummaryCache();
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'token-1', user: { id: 'user-1' } } },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          success: true,
          referralCode: 'CODE1234',
          referralUrl: 'https://watheqai.app?ref=CODE1234',
          totalReferrals: 2,
          completedReferrals: 1,
          pendingReferrals: 1,
          creditsEarned: 5,
        }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shares one summary request across concurrent referral widgets', async () => {
    const [linkSummary, statsSummary] = await Promise.all([
      fetchReferralSummary(),
      fetchReferralSummary(),
    ]);

    expect(linkSummary.referralUrl).toContain('CODE1234');
    expect(statsSummary.creditsEarned).toBe(5);
    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/.netlify/functions/referral-api?action=get-summary', {
      headers: { Authorization: 'Bearer token-1' },
    });
  });

  it('does not reuse a recent referral summary across different authenticated users', async () => {
    getSessionMock
      .mockResolvedValueOnce({
        data: { session: { access_token: 'token-1', user: { id: 'user-1' } } },
      })
      .mockResolvedValueOnce({
        data: { session: { access_token: 'token-2', user: { id: 'user-2' } } },
      });

    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          json: vi.fn().mockResolvedValue({
            success: true,
            referralCode: 'USER1',
            referralUrl: 'https://watheqai.app?ref=USER1',
            totalReferrals: 2,
            completedReferrals: 1,
            pendingReferrals: 1,
            creditsEarned: 5,
          }),
        })
        .mockResolvedValueOnce({
          json: vi.fn().mockResolvedValue({
            success: true,
            referralCode: 'USER2',
            referralUrl: 'https://watheqai.app?ref=USER2',
            totalReferrals: 4,
            completedReferrals: 3,
            pendingReferrals: 1,
            creditsEarned: 15,
          }),
        })
    );

    const firstSummary = await fetchReferralSummary();
    const secondSummary = await fetchReferralSummary();

    expect(firstSummary.referralUrl).toContain('USER1');
    expect(secondSummary.referralUrl).toContain('USER2');
    expect(secondSummary.creditsEarned).toBe(15);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith('/.netlify/functions/referral-api?action=get-summary', {
      headers: { Authorization: 'Bearer token-2' },
    });
  });
});
