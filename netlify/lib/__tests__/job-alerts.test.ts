import { describe, it, expect } from 'vitest';
import { selectAlertPostings, renderJobAlert, canRetryDelivery } from '../job-alerts.js';
const now = Date.parse('2026-11-14T12:00:00Z');
const posting = { id: 'p', companyId: 'c', companyName: '<Co>', title: 'AI Engineer', location: 'Riyadh', applyUrl: 'https://example.com/job', postedAt: '2026-11-14T10:00:00Z', firstSeenAt: '2026-11-14T11:00:00Z', publicationKind: 'published' as const, publicationPrecision: 'timestamp' as const };
describe('free job alerts', () => {
 it('uses deterministic preferences, strict freshness and dismissals', () => {
  expect(selectAlertPostings([posting], { targetRoles: ['AI Engineer'] }, new Set(), now)).toEqual([posting]);
  expect(selectAlertPostings([posting], { targetRoles: [] }, new Set(), now)).toEqual([]);
  expect(selectAlertPostings([posting], { targetRoles: ['Accountant'] }, new Set(), now)).toEqual([]);
  expect(selectAlertPostings([posting], { targetRoles: ['AI Engineer'] }, new Set(['p']), now)).toEqual([]);
  expect(selectAlertPostings([{ ...posting, publicationKind: 'unknown' }], { targetRoles: ['AI Engineer'] }, new Set(), now)).toEqual([]);
 });
 it('escapes email content and excludes unsafe application links', () => {
  const mail = renderJobAlert([posting], 'ar', 'https://watheqai.app', 'abc');
  expect(mail.html).toContain('&lt;Co&gt;'); expect(mail.html).toContain('dir="rtl"');
  expect(mail.text).toContain('https://example.com/job');
  expect(selectAlertPostings([{ ...posting, applyUrl: 'javascript:alert(1)' }], { targetRoles: ['Engineer'] }, new Set(), now)).toEqual([]);
 });
 it('never blindly retries a delivery after the provider key expires', () => {
  expect(canRetryDelivery(new Date(now - 23 * 3600000).toISOString(), now)).toBe(true);
  expect(canRetryDelivery(new Date(now - 24 * 3600000).toISOString(), now)).toBe(false);
 });
});
