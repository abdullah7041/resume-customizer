import { beforeEach, expect, it, vi } from 'vitest';
import { activatePrivateSession } from './privateSession';
import { getAuthHeaders as componentHeaders } from './authHeaders';
import { getAuthHeaders as apiHeaders } from '@/services/api';
import { optimizeResumeStream } from '@/services/api';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/services/supabase', () => ({ supabase: { auth: { getSession } } }));
beforeEach(() => { localStorage.clear(); activatePrivateSession('a', () => {}); });

it.each([componentHeaders, apiHeaders])('rejects credentials resolved for another account before sending private input', async headers => {
  let finish!: (value: object) => void;
  getSession.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = headers();
  activatePrivateSession('b', () => {});
  finish({ data: { session: { user: { id: 'b' }, access_token: 'b-token' } } });
  await expect(pending).rejects.toMatchObject({ cancelled: true, code: 'auth/session-changed' });
});

it('keeps the originating owner fence while polling a pending optimization', async () => {
  vi.useFakeTimers();
  getSession.mockReset().mockResolvedValueOnce({ data: { session: { user: { id: 'a' }, access_token: 'a-token' } } })
    .mockResolvedValue({ data: { session: { user: { id: 'b' }, access_token: 'b-token' } } });
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 202 }));
  vi.stubGlobal('fetch', fetchMock);
  try {
    const pending = optimizeResumeStream({ resumeText: 'Private A source', jobDesc: 'Private A job', mode: undefined, preview: false, workHistory: [], userClarifications: '', userHardStops: [] }).catch(error => error);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    activatePrivateSession('b', () => {});
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(await pending).toMatchObject({ cancelled: true, code: 'auth/session-changed' });
  } finally { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); }
});
