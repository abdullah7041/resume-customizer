import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dispatchOptimizationJob, newOptimizationJob } from '../optimization-jobs.js';

beforeEach(() => {
  vi.stubEnv('URL', 'https://watheqai.app');
  vi.stubEnv('SITE_NAME', 'watheq');
  vi.stubEnv('DEPLOY_URL', '');
  vi.stubEnv('DEPLOY_PRIME_URL', '');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 202 }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('dispatches signed preview inputs to the invoking preview deployment', async () => {
  await dispatchOptimizationJob('job', newOptimizationJob('{}'), { authorization: 'Bearer private' },
    'https://deploy-preview-150--watheq.netlify.app/api/optimize-stream');
  expect(fetch).toHaveBeenCalledWith(new URL('https://deploy-preview-150--watheq.netlify.app/.netlify/functions/optimize-background'),
    expect.objectContaining({ redirect: 'error' }));
});

it('refuses to send a signed envelope to an untrusted request origin', async () => {
  await expect(dispatchOptimizationJob('job', newOptimizationJob('{}'), { authorization: 'Bearer private' },
    'https://attacker.example/api/optimize-stream')).rejects.toMatchObject({ code: 'optimize/worker-unavailable' });
  expect(fetch).not.toHaveBeenCalled();
});
