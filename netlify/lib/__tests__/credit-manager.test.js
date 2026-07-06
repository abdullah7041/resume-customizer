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
  addCredits,
} from '../credit-manager.js';

describe('CreditManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      supabaseMock.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
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
      // Mock getUserCredits
      supabaseMock.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits_remaining: 15, credits_total: 20 },
              error: null,
            }),
          }),
        }),
      });

      // Mock update
      supabaseMock.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      // Mock transaction logging
      supabaseMock.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await addCredits('user-123', 5, 'referral_reward', {
        referrer_id: 'user-456',
      });

      expect(result).toEqual({
        success: true,
        creditsRemaining: 20,
      });
    });

    it('successfully adds credits for feedback reward', async () => {
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

    it('throws error when update fails', async () => {
      supabaseMock.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { credits_remaining: 15, credits_total: 20 },
              error: null,
            }),
          }),
        }),
      });

      supabaseMock.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: 'Update failed' },
          }),
        }),
      });

      await expect(addCredits('user-123', 5, 'referral_reward')).rejects.toThrow(
        'Failed to add credits'
      );
    });
  });
});
