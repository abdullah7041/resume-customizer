import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));

vi.mock('@/services/supabase', () => ({
  supabase: { auth: { getSession: getSessionMock } },
}));

vi.mock('@/services/api', () => ({ importJobFromUrl: vi.fn() }));

import { verifyFeedPosting } from './jobFeed';

const resumes = Array.from({ length: 5 }, (_, index) => ({
  id: `resume-${index + 1}`,
  fingerprint: `claimed-${index + 1}`,
  text: `Resume ${index + 1}`,
}));

describe('verifyFeedPosting', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'token' } } });
  });

  it('sends one pair per request and never runs more than two requests at once', async () => {
    let active = 0;
    let peak = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active -= 1;
      const request = JSON.parse(String(init?.body)) as { resumes: typeof resumes };
      const resume = request.resumes[0];
      return new Response(JSON.stringify({
        results: [{ resumeId: resume.id, resumeFingerprint: `server-${resume.id}`, cached: false, match: { score: 75 } }],
        failures: [],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const result = await verifyFeedPosting('posting-1', resumes, 'en');

    expect(peak).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    for (const call of fetchMock.mock.calls) {
      const body = JSON.parse(String(call[1]?.body)) as { resumes: unknown[] };
      expect(body.resumes).toHaveLength(1);
    }
    expect(result.results).toHaveLength(5);
    expect(result.failures).toEqual([]);
  });

  it('keeps traversing pairs so cached matches can surface after a quota failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const request = JSON.parse(String(init?.body)) as { resumes: typeof resumes };
      const resume = request.resumes[0];
      const payload = resume.id === 'resume-1'
        ? { results: [], failures: [{ resumeId: resume.id, code: 'limit_reached', error: 'Daily limit reached' }] }
        : { results: [{ resumeId: resume.id, resumeFingerprint: `server-${resume.id}`, cached: true, match: { score: 82 } }], failures: [] };
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const result = await verifyFeedPosting('posting-1', resumes.slice(0, 3), 'en');

    expect(result.results.map(item => item.resumeId)).toEqual(expect.arrayContaining(['resume-2', 'resume-3']));
    expect(result.failures).toEqual([
      { resumeId: 'resume-1', code: 'limit_reached', error: 'Daily limit reached' },
    ]);
    expect(result.error).toBeNull();
  });
});
