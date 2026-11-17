import type { HandlerEvent } from '@netlify/functions';
import { runOptimization } from './optimize.js';
import { hasCurrentEvidenceCards } from '../lib/optimize-cards.js';
import { claimOptimizationWorker, finishOptimizationJob, readOptimizationJob, verifyOptimizationEnvelope,
  type OptimizationEnvelope, type OptimizationJob } from '../lib/optimization-jobs.js';
import { initSentry, captureError, flushSentry, summarizeErrorForLog } from '../lib/sentry.js';
import { z } from 'zod';

const EnvelopeSchema = z.object({
  jobKey: z.string().regex(/^watheq:optimize:[a-f0-9]{64}:job$/),
  operationId: z.uuid(), issuedAt: z.number().int(), body: z.string().max(200000),
  headers: z.record(z.string(), z.string()), signature: z.string().regex(/^[a-f0-9]{64}$/),
});
initSentry();

// The -background filename gives Netlify 15 minutes, independent of the HTTP dispatcher.
export default async function handler(request: Request): Promise<Response> {
  let job: OptimizationJob | null = null;
  let envelope: OptimizationEnvelope | undefined;
  let claimed = false;
  let stage = 'claim';
  try {
    if (request.method !== 'POST') return new Response(null);
    let input: unknown;
    try { input = await request.json(); } catch { return new Response(null); }
    const parsed = EnvelopeSchema.safeParse(input);
    if (!parsed.success) return new Response(null);
    envelope = parsed.data;
    job = await readOptimizationJob(envelope.jobKey);
    if (!job || !verifyOptimizationEnvelope(envelope, job)) return new Response(null);
    claimed = await claimOptimizationWorker(envelope.jobKey, job.operationId);
    if (!claimed) return new Response(null);

    const event: HandlerEvent = {
      httpMethod: 'POST', path: '/.netlify/functions/optimize-background',
      headers: { ...envelope.headers, 'x-watheq-operation-id': job.operationId }, multiValueHeaders: {}, body: envelope.body,
      isBase64Encoded: false, queryStringParameters: null, multiValueQueryStringParameters: null,
      rawUrl: request.url, rawQuery: '',
    };
    // Invoke the existing validated/billed pipeline IN PROCESS, never via its 30s HTTP endpoint.
    stage = 'pipeline';
    const response = await runOptimization(event);
    const payload = JSON.parse(response.body || '{}') as Record<string, unknown>;
    if (response.statusCode === 200 && hasCurrentEvidenceCards(payload)) {
      // Required storage: a successful paid response must remain retrievable even
      // when the pipeline's optional cache write failed.
      stage = 'persist-result';
      if (!await finishOptimizationJob(envelope.jobKey, { ...job, state: 'succeeded', result: { ...payload, operationId: job.operationId } })) {
        throw new Error('Optimization result was not retained.');
      }
    } else {
      const safe = payload.billingStateUnknown === false || [400, 401, 403, 429].includes(response.statusCode);
      const code = typeof payload.code === 'string' && /^[A-Za-z0-9][A-Za-z0-9_/-]{0,99}$/.test(payload.code) ? payload.code : 'OPTIMIZE_FAILED';
      if (response.statusCode >= 500 || response.statusCode === 200) captureError(new Error('Optimization failed'), { function: 'optimize-background', operationId: job.operationId,
        stage, status: response.statusCode, code });
      stage = 'persist-failure';
      await finishOptimizationJob(envelope.jobKey, { ...job, state: 'failed', error: {
        error: typeof payload.error === 'string' ? payload.error : 'Optimization failed.',
        status: response.statusCode >= 400 ? response.statusCode : 500,
        code,
        billingStateUnknown: !safe, retryable: safe && payload.retryable === true,
      } });
    }
  } catch (error) {
    console.error('[optimize-background] Worker failed:', summarizeErrorForLog(error));
    captureError(new Error('Optimization worker failed'), { function: 'optimize-background', operationId: job?.operationId,
      stage, status: 503, code: 'OPTIMIZE_WORKER_FAILED' });
    if (claimed && job && envelope) {
      try {
        await finishOptimizationJob(envelope.jobKey, { ...job, state: 'failed', error: {
          error: 'Optimization could not finish. Refresh your balance before retrying.',
          status: 503, code: 'OPTIMIZE_WORKER_FAILED', billingStateUnknown: true,
        } });
      } catch {
        // Keep the running claim; Netlify retries must never repeat a possible debit.
        console.error('[optimize-background] Could not persist the worker outcome; ownership retained.');
      }
    }
  }
  // Errors are recorded above. Throwing here would request automatic background retries.
  await flushSentry();
  return new Response(null);
}
