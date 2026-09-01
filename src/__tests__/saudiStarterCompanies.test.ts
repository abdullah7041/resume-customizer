import { describe, expect, it } from 'vitest';
import {
  partitionStarters,
  SAUDI_STARTER_COMPANIES,
  unfollowedStarters,
} from '@/lib/jobs/saudiStarterCompanies';
import { PROVIDERS } from '../../netlify/lib/ats/index';

/**
 * The registry's whole value is that every entry is real. A typo'd token does not
 * fail loudly — it becomes a company that silently never returns a role, in every
 * user's feed at once. These are the checks that can be made without the network;
 * liveness itself is verified by `scripts/ats-smoke.ts`.
 */
describe('Saudi starter registry', () => {
  it('names a real provider for every company', () => {
    for (const company of SAUDI_STARTER_COMPANIES) {
      expect(PROVIDERS[company.source], `unknown source for ${company.displayName}`).toBeDefined();
    }
  });

  it('carries a token each provider would accept', () => {
    for (const company of SAUDI_STARTER_COMPANIES) {
      const provider = PROVIDERS[company.source];
      expect(
        provider.isValidToken(company.token),
        `${company.displayName} has a token ${company.source} would reject: ${company.token}`,
      ).toBe(true);
    }
  });

  it('has no duplicate boards', () => {
    const keys = SAUDI_STARTER_COMPANIES.map((company) => `${company.source}:${company.token}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every company both an English and an Arabic name', () => {
    for (const company of SAUDI_STARTER_COMPANIES) {
      expect(company.displayName.trim().length).toBeGreaterThan(0);
      // Arabic-first product: a Latin-only "Arabic" name is a missing translation.
      expect(company.displayNameAr, `${company.displayName} has no Arabic name`).toMatch(/[؀-ۿ]/);
    }
  });

  it('keeps verified-but-empty boards rather than dropping them', () => {
    // The Careem precedent: a real account with no open roles today still costs one
    // cheap call a day and surfaces a role the moment it lands.
    expect(SAUDI_STARTER_COMPANIES.some((company) => company.rolesAtVerification === 0)).toBe(true);
  });

  it('hides the companies a user already follows', () => {
    const followed = ['salla', 'TAMARA'];
    const remaining = unfollowedStarters(followed);

    expect(remaining.map((company) => company.token)).not.toContain('salla');
    // Case must not decide whether a company is already followed.
    expect(remaining.map((company) => company.token)).not.toContain('tamara');
    expect(remaining.length).toBe(SAUDI_STARTER_COMPANIES.length - 2);
  });

  it('offers everything when nothing is followed', () => {
    expect(unfollowedStarters([]).length).toBe(SAUDI_STARTER_COMPANIES.length);
  });
});

describe('partitionStarters', () => {
  it('separates boards that held roles from boards that were empty', () => {
    const { hiring, quiet } = partitionStarters(SAUDI_STARTER_COMPANIES);

    expect(hiring.every((company) => company.rolesAtVerification > 0)).toBe(true);
    expect(quiet.every((company) => company.rolesAtVerification === 0)).toBe(true);
    expect(hiring.length + quiet.length).toBe(SAUDI_STARTER_COMPANIES.length);
  });

  it('keeps the empty boards rather than dropping them', () => {
    // They are real, readable accounts — verified 2026-08-31, HTTP 200 while two
    // control tokens 404'd. Following one is how a user hears about its first
    // role. What they must not do is share a row with the boards that are hiring.
    const { quiet } = partitionStarters(SAUDI_STARTER_COMPANIES);
    expect(quiet.length).toBeGreaterThan(0);
    expect(quiet.map((company) => company.displayName)).toContain('Jahez');
  });
});
