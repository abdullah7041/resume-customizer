import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const { extract, session } = vi.hoisted(() => ({ extract: vi.fn(), session: vi.fn() }));
vi.mock('../services/supabase.js', () => ({ supabase: { auth: { getSession: session } } }));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));
vi.mock('../lib/utils/circuit-breaker', () => ({ isCircuitOpen: () => false, recordFailure: vi.fn(), recordSuccess: vi.fn() }));
vi.mock('../lib/utils/resumeText', () => ({ extractPlainTextFromArrayBuffer: extract, inferMimeType: () => 'application/pdf' }));
const { parseResume } = await import('../services/api.js');
const text = 'Software engineer with experience building reliable applications for customers. '.repeat(6);
beforeEach(() => { vi.clearAllMocks(); extract.mockResolvedValue(text); session.mockResolvedValue({ data: { session: { access_token: 'test' } } }); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('reuses an existing device-local parse without sending another AI request', async () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  const saved = { data: { basics: { name: 'Candidate' } }, plainText: text };
  const findSavedResume = vi.fn().mockReturnValue(saved);
  await expect(parseResume(new File(['resume'], 'resume.pdf'), { findSavedResume })).resolves.toBe(saved);
  expect(findSavedResume).toHaveBeenCalledWith(text);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('does not return a cached parse or start a request after cancellation', async () => {
  const controller = new AbortController(); controller.abort();
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  const findSavedResume = vi.fn();
  await expect(parseResume(text, { signal: controller.signal, findSavedResume })).rejects.toMatchObject({ cancelled: true });
  expect(findSavedResume).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('extracts a file once when a transient request is retried', async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 503 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ document: { plainText: text } }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  const result = parseResume(new File(['resume'], 'resume.pdf'));
  await vi.runAllTimersAsync();
  await expect(result).resolves.toEqual({ plainText: text });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(extract).toHaveBeenCalledOnce();
});
