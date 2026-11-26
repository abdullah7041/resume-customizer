import { beforeEach, expect, it, vi } from 'vitest';
import { activatePrivateSession } from '@/lib/auth/privateSession';
const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock('@/services/supabase', () => ({ supabase: { auth: { getSession: mocks.session } } }));
import { searchJobs } from '@/services/jobSearch';
import { readJobAlerts } from '@/services/jobAlerts';

beforeEach(() => {
  activatePrivateSession('first', () => {});
  mocks.session.mockResolvedValue({ data: { session: { user: { id: 'first' }, access_token: 'test-token' } } });
  vi.stubGlobal('fetch', vi.fn());
});

for (const [name, request] of [
  ['search', () => searchJobs({ targetRoles: ['AI Engineer'], offset: 0, followedOnly: false }, new AbortController().signal)],
  ['alert status', () => readJobAlerts()],
] as const) {
  it(`rejects ${name} if the account changes while obtaining authorization`, async () => {
    mocks.session.mockImplementation(async () => {
      activatePrivateSession('second', () => {});
      return { data: { session: { user: { id: 'first' }, access_token: 'test-token' } } };
    });
    await expect(request()).rejects.toMatchObject({ code: 'auth/session-changed' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it(`discards ${name} responses from the previous account`, async () => {
    vi.mocked(fetch).mockImplementation(async () => {
      activatePrivateSession('second', () => {});
      return { ok: true, json: async () => ({}) } as Response;
    });
    await expect(request()).rejects.toMatchObject({ code: 'auth/session-changed' });
  });
}

it('restores feed history by an exact CV digest without posting any CV text to search', async () => {
  const text = 'private experience'.repeat(1200);
  const { fingerprintText } = await import('@/lib/match/assessmentContext');
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ checks: {} }) } as Response);
  await searchJobs({ targetRoles: ['Engineer'], offset: 0, followedOnly: false, activeCV: { id: 'cv', language: 'en', text } }, new AbortController().signal);
  const body = String(vi.mocked(fetch).mock.calls[0][1]?.body);
  expect(body).not.toContain('private experience');
  expect(JSON.parse(body).cv).toEqual({ id: 'cv', language: 'en', revision: await fingerprintText(text) });
});
