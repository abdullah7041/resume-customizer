import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Supabase client
const { supabaseMock } = vi.hoisted(() => {
  const fromMock = vi.fn();
  const rpcMock = vi.fn();

  return {
    supabaseMock: {
      from: fromMock,
      rpc: rpcMock,
    },
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => supabaseMock),
}));

// Set mock environment variables
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  FEATURE_COSTS,
  FREE_TIER_CREDITS,
  SUSPICIOUS_IP_CREDITS,
  getUserCredits,
  checkCredits,
  consumeCredits,
  isEmailVerified,
  addCredits,
} from '../credit-manager.js';

describe('CreditManager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('FEATURE_COSTS', () => {
    it('defines correct pricing for all features', () => {
      expect(FEATURE_COSTS).toEqual({
        parse_resume: 0,
        ai_match: 2,
        vision2030: 2,
        optimize: 5,
        interview_prep: 3,
        cover_letter: 4,
        export_template: 0,
      });
    });
  });

  describe('FREE_TIER_CREDITS drift guard', () => {
    it('grants 20 on the free tier and 5 to suspicious IPs', () => {
      expect(FREE_TIER_CREDITS).toBe(20);
      expect(SUSPICIOUS_IP_CREDITS).toBe(5);
    });

    it('cron-reset-credits uses the shared constant, not a hardcoded amount', () => {
      // Regression guard: signup grant (20) and monthly reset drifted apart once
      // (cron hardcoded 15). The cron must import FREE_TIER_CREDITS.
      const testDir = dirname(fileURLToPath(import.meta.url));
      const cronSource = readFileSync(
        join(testDir, '..', '..', 'functions', 'cron-reset-credits.ts'),
        'utf8'
      );
      expect(cronSource).toContain('FREE_TIER_CREDITS');
      expect(cronSource).toMatch(/const newCredits = FREE_TIER_CREDITS;/);
      expect(cronSource).not.toMatch(/const newCredits = \d+;/);
    });

    it('uses provider-side email batches instead of throttling each user workflow', () => {
      const testDir = dirname(fileURLToPath(import.meta.url));
      const resetSource = readFileSync(
        join(testDir, '..', '..', 'functions', 'cron-reset-credits.ts'),
        'utf8'
      );
      const summarySource = readFileSync(
        join(testDir, '..', '..', 'functions', 'cron-monthly-summary.ts'),
        'utf8'
      );

      expect(resetSource).toContain('sendCreditsRefreshedEmailBatch');
      expect(summarySource).toContain('sendMonthlyUsageSummaryBatch');
      expect(resetSource).not.toContain('RateLimiter');
      expect(summarySource).not.toContain('RateLimiter');
    });
  });

  describe('getUserCredits', () => {
    it('returns user credits when found', async () => {
      const mockCredits = {
        credits_remaining: 15,
        credits_total: 20,
        feedback_credits_earned: 0,
        referral_credits_earned: 0,
        last_reset_date: '2026-01-25T00:00:00Z',
      };

      supabaseMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockCredits, error: null }),
          }),
        }),
      });

      const result = await getUserCredits('user-123');

      expect(supabaseMock.from).toHaveBeenCalledWith('user_credits');
      expect(result).toEqual(mockCredits);
    });

    it('initializes credits for new user', async () => {
      const mockNewCredits = {
        user_id: 'user-456',
        credits_remaining: 15,
        credits_total: 20,
        feedback_credits_earned: 0,
        referral_credits_earned: 0,
        last_reset_date: expect.any(String),
      };

      // First call returns "not found" error (PGRST116)
      supabaseMock.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' },
            }),
          }),
        }),
      });

      // Second call (insert) succeeds
      supabaseMock.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockNewCredits, error: null }),
          }),
        }),
      });

      const result = await getUserCredits('user-456');

      expect(result).toMatchObject({
        credits_remaining: 15,
        credits_total: 20,
      });
    });

    it('throws error on database failure', async () => {
      supabaseMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST000', message: 'Database error' },
            }),
          }),
        }),
      });

      await expect(getUserCredits('user-123')).rejects.toThrow('Failed to retrieve user credits');
    });

    it('applies the full initial grant for a verified pending row', async () => {
      const pendingCredits = {
        credits_remaining: 0,
        credits_total: 0,
        signup_metadata: { pending_initial_grant: true },
      };

      supabaseMock.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: pendingCredits, error: null }),
          }),
        }),
      });
      supabaseMock.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          contains: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 0, error: null }),
          }),
        }),
      });
      supabaseMock.rpc.mockResolvedValueOnce({
        data: [{ granted: true, credits_remaining: FREE_TIER_CREDITS }],
        error: null,
      });

      const result = await getUserCredits('verified@example.com', {
        emailVerified: true,
        ipAddress: '198.51.100.8',
      });

      expect(supabaseMock.rpc).toHaveBeenCalledWith('grant_initial_credits', {
        p_email: 'verified@example.com',
        p_amount: FREE_TIER_CREDITS,
        p_ip_address: '198.51.100.8',
      });
      expect(result).toMatchObject({
        credits_remaining: FREE_TIER_CREDITS,
        credits_total: FREE_TIER_CREDITS,
      });
    });

    it('applies the reduced initial grant for a suspicious IP', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const pendingCredits = {
        credits_remaining: 0,
        credits_total: 0,
        signup_metadata: { pending_initial_grant: true },
      };

      supabaseMock.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: pendingCredits, error: null }),
          }),
        }),
      });
      supabaseMock.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          contains: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 10, error: null }),
          }),
        }),
      });
      supabaseMock.rpc.mockResolvedValueOnce({
        data: [{ granted: true, credits_remaining: SUSPICIOUS_IP_CREDITS }],
        error: null,
      });

      await getUserCredits('suspicious@example.com', {
        emailVerified: true,
        ipAddress: '203.0.113.10',
      });

      expect(supabaseMock.rpc).toHaveBeenCalledWith('grant_initial_credits', {
        p_email: 'suspicious@example.com',
        p_amount: SUSPICIOUS_IP_CREDITS,
        p_ip_address: '203.0.113.10',
      });
      expect(warnSpy).toHaveBeenCalledWith('[CreditManager] Suspicious IP has 10 accounts (suspicious)');
    });

    it('leaves an unverified pending row at zero without a grant RPC', async () => {
      const pendingCredits = {
        credits_remaining: 0,
        credits_total: 0,
        signup_metadata: { pending_initial_grant: true },
      };
      supabaseMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: pendingCredits, error: null }),
          }),
        }),
      });

      const result = await getUserCredits('unverified@example.com', { emailVerified: false });

      expect(result).toEqual(pendingCredits);
      expect(supabaseMock.rpc).not.toHaveBeenCalled();
    });

    it('leaves a pending row at zero when verified-email evidence is omitted', async () => {
      const pendingCredits = {
        credits_remaining: 0,
        credits_total: 0,
        signup_metadata: { pending_initial_grant: true },
      };
      supabaseMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: pendingCredits, error: null }),
          }),
        }),
      });

      const result = await getUserCredits('missing-evidence@example.com');

      expect(result).toEqual(pendingCredits);
      expect(supabaseMock.rpc).not.toHaveBeenCalled();
    });

    it('does not grant credits for a legacy row without a pending marker', async () => {
      const legacyCredits = { credits_remaining: 20, credits_total: 20, signup_metadata: {} };
      supabaseMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: legacyCredits, error: null }),
          }),
        }),
      });

      const result = await getUserCredits('legacy@example.com');

      expect(result).toEqual(legacyCredits);
      expect(supabaseMock.rpc).not.toHaveBeenCalled();
    });

    it('returns a pending row unchanged when the initial grant RPC is unavailable', async () => {
      const pendingCredits = {
        credits_remaining: 0,
        credits_total: 0,
        signup_metadata: { pending_initial_grant: true },
      };
      supabaseMock.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: pendingCredits, error: null }),
          }),
        }),
      });
      supabaseMock.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          contains: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 0, error: null }),
          }),
        }),
      });
      supabaseMock.rpc.mockResolvedValueOnce({
        data: null,
        error: { code: '42883', message: 'function grant_initial_credits does not exist' },
      });

      const result = await getUserCredits('compat@example.com', { emailVerified: true });

      expect(result).toEqual(pendingCredits);
    });

    it('re-fetches and returns the winning row when an initial grant was already applied', async () => {
      const pendingCredits = {
        credits_remaining: 0,
        credits_total: 0,
        signup_metadata: { pending_initial_grant: true },
      };
      const winnerCredits = {
        credits_remaining: 20,
        credits_total: 20,
        signup_metadata: { pending_initial_grant: false },
      };
      let creditReadCount = 0;
      supabaseMock.from.mockReturnValue({
        select: vi.fn((_, selectOptions) => {
          if (selectOptions?.head) {
            return {
              contains: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({ count: 0, error: null }),
              }),
            };
          }

          creditReadCount += 1;
          return {
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: creditReadCount === 1 ? pendingCredits : winnerCredits,
                error: null,
              }),
            }),
          };
        }),
      });
      supabaseMock.rpc.mockResolvedValueOnce({
        data: [{ granted: false, credits_remaining: 20 }],
        error: null,
      });

      await expect(getUserCredits('raced@example.com', { emailVerified: true })).resolves.toEqual(winnerCredits);
    });

    it('uses structured errors when the initial grant RPC fails', async () => {
      const pendingCredits = {
        credits_remaining: 0,
        credits_total: 0,
        signup_metadata: { pending_initial_grant: true },
      };
      supabaseMock.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: pendingCredits, error: null }),
          }),
        }),
      });
      supabaseMock.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          contains: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 0, error: null }),
          }),
        }),
      });
      supabaseMock.rpc.mockResolvedValueOnce({
        data: null,
        error: { code: '42501', message: 'Permission denied' },
      });

      await expect(getUserCredits('failed-grant@example.com', { emailVerified: true })).rejects.toMatchObject({
        status: 500,
        code: 'INITIAL_GRANT_FAILED',
        message: 'Failed to apply initial credit grant',
      });
    });
  });

  describe('checkCredits', () => {
    it('returns true when user has sufficient credits', async () => {
      supabaseMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits_remaining: 10, credits_total: 20 },
              error: null,
            }),
          }),
        }),
      });

      const result = await checkCredits('user-123', 'optimize');

      expect(result).toEqual({
        hasCredits: true,
        required: 5,
        available: 10,
      });
    });

    it('returns false when user has insufficient credits', async () => {
      supabaseMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits_remaining: 3, credits_total: 20 },
              error: null,
            }),
          }),
        }),
      });

      const result = await checkCredits('user-123', 'optimize');

      expect(result).toEqual({
        hasCredits: false,
        required: 5,
        available: 3,
      });
    });

    it('always returns true for free features', async () => {
      const result = await checkCredits('user-123', 'parse_resume');

      expect(result).toEqual({
        hasCredits: true,
        required: 0,
        available: 0,
      });

      // Should not call database for free features
      expect(supabaseMock.from).not.toHaveBeenCalled();
    });

    it('throws error for unknown feature', async () => {
      await expect(checkCredits('user-123', 'unknown_feature')).rejects.toThrow(
        'Unknown feature: unknown_feature'
      );
    });
  });

  describe('consumeCredits', () => {
    it('detects confirmed Supabase auth users', () => {
      expect(isEmailVerified({ email_confirmed_at: '2026-01-01T00:00:00Z' })).toBe(true);
      expect(isEmailVerified({})).toBe(false);
      expect(isEmailVerified({ email_confirmed_at: null })).toBe(false);
      expect(isEmailVerified(undefined)).toBe(false);
    });

    it('successfully consumes credits using RPC', async () => {
      // Mock checkCredits (via getUserCredits)
      supabaseMock.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits_remaining: 10, credits_total: 20 },
              error: null,
            }),
          }),
        }),
      });

      // Mock RPC call
      supabaseMock.rpc.mockResolvedValueOnce({
        data: 5, // New balance after consuming 5 credits
        error: null,
      });

      // Mock transaction logging
      supabaseMock.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await consumeCredits('user-123', 'optimize');

      expect(supabaseMock.rpc).toHaveBeenCalledWith('consume_user_credits', {
        p_email: 'user-123',
        p_amount: 5,
      });

      expect(result).toEqual({
        success: true,
        creditsRemaining: 5,
      });
    });

    it('falls back to direct update when RPC does not exist', async () => {
      // Mock checkCredits
      supabaseMock.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits_remaining: 10, credits_total: 20 },
              error: null,
            }),
          }),
        }),
      });

      // Mock RPC failure (function not found)
      supabaseMock.rpc.mockResolvedValueOnce({
        data: null,
        error: { code: '42883', message: 'Function not found' },
      });

      // Mock direct update
      const selectMock = vi.fn().mockResolvedValue({
        data: [{ credits_remaining: 5 }],
        error: null,
      });
      supabaseMock.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: selectMock,
            }),
          }),
        }),
      });

      // Mock transaction logging
      supabaseMock.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await consumeCredits('user-123', 'optimize');

      expect(result).toEqual({
        success: true,
        creditsRemaining: 5,
      });
    });

    it('does not report success when the RPC fallback loses the optimistic lock', async () => {
      supabaseMock.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits_remaining: 10, credits_total: 20 },
              error: null,
            }),
          }),
        }),
      });

      supabaseMock.rpc.mockResolvedValueOnce({
        data: null,
        error: { code: '42883', message: 'Function not found' },
      });

      supabaseMock.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const result = await consumeCredits('user-123', 'optimize');

      expect(result).toEqual({
        success: false,
        creditsRemaining: 10,
      });
      expect(supabaseMock.from).not.toHaveBeenCalledWith('credit_transactions');
    });


    it('returns failure when insufficient credits', async () => {
      supabaseMock.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits_remaining: 3, credits_total: 20 },
              error: null,
            }),
          }),
        }),
      });

      const result = await consumeCredits('user-123', 'optimize');

      expect(result).toEqual({
        success: false,
        creditsRemaining: 3,
      });

      // Should not call RPC or update
      expect(supabaseMock.rpc).not.toHaveBeenCalled();
    });

    it('skips consumption for free features', async () => {
      const result = await consumeCredits('user-123', 'parse_resume');

      expect(result).toEqual({
        success: true,
        creditsRemaining: 0,
      });

      // Should not call database
      expect(supabaseMock.from).not.toHaveBeenCalled();
      expect(supabaseMock.rpc).not.toHaveBeenCalled();
    });

    it('allows custom credit amounts', async () => {
      supabaseMock.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits_remaining: 10, credits_total: 20 },
              error: null,
            }),
          }),
        }),
      });

      supabaseMock.rpc.mockResolvedValueOnce({
        data: 7, // 10 - 3 = 7
        error: null,
      });

      supabaseMock.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await consumeCredits('user-123', 'optimize', 3);

      expect(supabaseMock.rpc).toHaveBeenCalledWith('consume_user_credits', {
        p_email: 'user-123',
        p_amount: 3,
      });

      expect(result).toEqual({
        success: true,
        creditsRemaining: 7,
      });
    });

    it('logs transactions even if logging fails', async () => {
      supabaseMock.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits_remaining: 10, credits_total: 20 },
              error: null,
            }),
          }),
        }),
      });

      supabaseMock.rpc.mockResolvedValueOnce({
        data: 5,
        error: null,
      });

      // Transaction logging fails
      supabaseMock.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({
          error: { message: 'Transaction log failed' },
        }),
      });

      // Should still succeed
      const result = await consumeCredits('user-123', 'optimize');

      expect(result).toEqual({
        success: true,
        creditsRemaining: 5,
      });
    });
  });

  describe('getSupabaseClient server config', () => {
    it('fails closed when SUPABASE_URL is missing', async () => {
      // Save original values
      const originalSupabaseUrl = process.env.SUPABASE_URL;

      delete process.env.SUPABASE_URL;
      process.env.VITE_SUPABASE_URL = 'https://fallback.supabase.co';

      // Re-import to get a fresh module that reads env vars
      // We need to clear the module cache first
      vi.resetModules();

      // Re-mock supabase
      vi.doMock('@supabase/supabase-js', () => ({
        createClient: vi.fn(() => supabaseMock),
      }));

      const { checkCredits: freshCheckCredits } = await import('../credit-manager.js');

      await expect(freshCheckCredits('user-123', 'ai_match')).rejects.toThrow(
        '[CreditManager] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
      );
      expect(supabaseMock.from).not.toHaveBeenCalled();

      // Restore original values
      process.env.SUPABASE_URL = originalSupabaseUrl;
      delete process.env.VITE_SUPABASE_URL;
    });
  });

  describe('addCredits', () => {
    it('successfully adds credits for referral reward', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({
        data: { remaining: 20 },
        error: null,
      });

      const result = await addCredits('user-123', 5, 'referral_reward', {
        referrer_id: 'user-456',
      });

      expect(result).toEqual({
        success: true,
        creditsRemaining: 20,
      });
      expect(supabaseMock.rpc).toHaveBeenCalledWith('add_credits', {
        p_email: 'user-123',
        p_amount: 5,
        p_description: 'referral_reward',
        p_transaction_type: 'referral_reward',
      });
      expect(supabaseMock.from).not.toHaveBeenCalledWith('credit_transactions');
    });

    it('uses metadata description when adding credits through the RPC', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({
        data: { remaining: 11 },
        error: null,
      });

      const result = await addCredits('user-123', 1, 'feedback_reward', {
        description: 'Thank you for your report',
      });

      expect(result).toEqual({ success: true, creditsRemaining: 11 });
      expect(supabaseMock.rpc).toHaveBeenCalledWith('add_credits', {
        p_email: 'user-123',
        p_amount: 1,
        p_description: 'Thank you for your report',
        p_transaction_type: 'feedback_reward',
      });
    });

    it('falls back to read-modify-write only when the add credits RPC is unavailable', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({
        data: null,
        error: { code: '42883', message: 'function add_credits does not exist' },
      });
      supabaseMock.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits_remaining: 10, credits_total: 20 },
              error: null,
            }),
          }),
        }),
      });

      supabaseMock.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      supabaseMock.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await addCredits('user-123', 1, 'feedback_reward');

      expect(result).toEqual({
        success: true,
        creditsRemaining: 11,
      });
    });

    it('throws a structured error when the add credits RPC fails for a reason other than being unavailable', async () => {
      supabaseMock.rpc.mockResolvedValueOnce({
        data: null,
        error: { code: '23514', message: 'Credit amount must be positive' },
      });

      await expect(addCredits('user-123', 5, 'referral_reward')).rejects.toMatchObject({
        status: 500,
        code: 'ADD_CREDITS_RPC_FAILED',
        message: 'Failed to add credits',
      });
    });
  });
});
