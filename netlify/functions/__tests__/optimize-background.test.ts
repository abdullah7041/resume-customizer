import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ run: vi.fn(), read: vi.fn(), claim: vi.fn(), finish: vi.fn() }));
vi.mock('../optimize.js', () => ({ runOptimization: mocks.run }));
vi.mock('../../lib/optimization-jobs.js', async importOriginal => ({
  ...await importOriginal<typeof import('../../lib/optimization-jobs.js')>(),
  readOptimizationJob: mocks.read, claimOptimizationWorker: mocks.claim, finishOptimizationJob: mocks.finish,
}));
vi.mock('../../lib/sentry.js', () => ({ summarizeErrorForLog: () => ({ error: 'redacted' }) }));
import { newOptimizationJob, optimizationEnvelope, type OptimizationJob } from '../../lib/optimization-jobs.js';
import handler from '../optimize-background.js';

const body = JSON.stringify({ resumeText: 'Original resume', jobText: 'Target job' });
const key = `watheq:optimize:${'a'.repeat(64)}:job`;
const result = { evidenceVersion: 2,
  evidenceSources: [{ id: 'source', targetId: 'target', kind: 'resume', text: 'Before', fingerprint: 'fingerprint' }],
  cards: [{ section: 'Experience', exampleBefore: 'Before', exampleAfter: 'After',
    evidence: { version: 1, status: 'needs_review', references: [{ sourceId: 'source', quote: 'Before' }] } }],
};
let job: OptimizationJob;
function request(payload = optimizationEnvelope(key, job, body, { authorization: 'Bearer test-token' })) {
  return new Request('https://watheqai.app/.netlify/functions/optimize-background', {
    method: 'POST', body: JSON.stringify(payload),
  });
}
describe('background optimization ownership and delivery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    job = newOptimizationJob(body);
    mocks.read.mockReturnValue(job);
    mocks.claim.mockResolvedValue(true);
    mocks.finish.mockResolvedValue(true);
    mocks.run.mockResolvedValue({ statusCode: 200, body: JSON.stringify(result) });
  });
  afterEach(() => vi.useRealTimers());

  it('retains the real result after generation takes longer than the HTTP cutoff', async () => {
    vi.useFakeTimers();
    mocks.run.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ statusCode: 200, body: JSON.stringify(result) }), 40000)));
    const pending = handler(request());
    await vi.advanceTimersByTimeAsync(40000);
    await pending;
    expect(mocks.run).toHaveBeenCalledTimes(1);
    expect(mocks.finish).toHaveBeenCalledWith(key, expect.objectContaining({ state: 'succeeded', result }));
  });
  it('rejects tampered input or bearer credentials before claiming or generating', async () => {
    const envelope = optimizationEnvelope(key, job, body, { authorization: 'Bearer test-token' });
    envelope.headers.authorization = 'Bearer another-user';
    await handler(request(envelope));
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it('does not repeat generation for a duplicate worker invocation', async () => {
    mocks.claim.mockResolvedValueOnce(true).mockResolvedValue(false);
    const envelope = optimizationEnvelope(key, job, body, { authorization: 'Bearer test-token' });
    await handler(request(envelope));
    await handler(request(envelope));
    expect(mocks.run).toHaveBeenCalledTimes(1);
  });
  it('keeps billing unknown if a paid result cannot be persisted', async () => {
    mocks.finish.mockRejectedValueOnce(new Error('Redis unavailable')).mockResolvedValue(true);
    await handler(request());
    expect(mocks.finish).toHaveBeenLastCalledWith(key, expect.objectContaining({ state: 'failed', error: expect.objectContaining({ billingStateUnknown: true }) }));
    expect(mocks.run).toHaveBeenCalledTimes(1);
  });
  it('preserves an explicitly known-safe pre-charge failure', async () => {
    mocks.run.mockResolvedValue({ statusCode: 504, body: JSON.stringify({ error: 'Provider timed out', retryable: true, billingStateUnknown: false }) });
    await handler(request());
    expect(mocks.finish).toHaveBeenCalledWith(key, expect.objectContaining({ state: 'failed', error: expect.objectContaining({ billingStateUnknown: false }) }));
  });
});
