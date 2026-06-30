import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSearchIntentOnSignIn } from '../flushSearchIntent';
import { useResumeStore } from '@/lib/stores/resumeStore';
import type { SearchIntent } from '@/types/onboarding';

const intent: SearchIntent = {
  targetRoles: ['Frontend Engineer'],
  meta: { confidence: 'medium', completeness: 50, updatedAt: '2026-01-01T00:00:00.000Z' },
};

const jsonResponse = (body: unknown, ok = true) => ({ ok, json: async () => body });

describe('flushSearchIntentOnSignIn', () => {
  beforeEach(() => {
    useResumeStore.setState({ searchIntent: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does nothing when there is no local intent', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await flushSearchIntentOnSignIn('token');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing without an access token', async () => {
    useResumeStore.setState({ searchIntent: intent });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await flushSearchIntentOnSignIn(undefined);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is idempotent: skips the save when the server already has an intent', async () => {
    useResumeStore.setState({ searchIntent: intent });
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ searchIntent: intent }));
    vi.stubGlobal('fetch', fetchMock);

    await flushSearchIntentOnSignIn('token');

    expect(fetchMock).toHaveBeenCalledTimes(1); // only the GET
    const getBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(getBody.action).toBe('get_search_intent');
  });

  it('saves the local intent when the server has none', async () => {
    useResumeStore.setState({ searchIntent: intent });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ searchIntent: null })) // GET
      .mockResolvedValueOnce(jsonResponse({ success: true })); // SAVE
    vi.stubGlobal('fetch', fetchMock);

    await flushSearchIntentOnSignIn('token');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const saveCall = fetchMock.mock.calls[1][1];
    const saveBody = JSON.parse(saveCall.body);
    expect(saveBody.action).toBe('save_search_intent');
    expect(saveBody.searchIntent).toEqual(intent);
    expect(saveCall.headers.Authorization).toBe('Bearer token');
  });
});
