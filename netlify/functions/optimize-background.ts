import type { HandlerEvent } from '@netlify/functions';
import { runOptimization } from './optimize.js';
import { hasCurrentEvidenceCards } from '../lib/optimize-cards.js';
import { claimOptimizationWorker, finishOptimizationJob, readOptimizationJob, verifyOptimizationEnvelope,
  type OptimizationEnvelope, type OptimizationJob } from '../lib/optimization-jobs.js';
import { summarizeErrorForLog } from '../lib/sentry.js';
import { z } from 'zod';

const EnvelopeSchema = z.object({
  jobKey: z.string().regex(/^watheq:optimize:[a-f0-9]{64}:job$/),
  operationId: z.uuid(), issuedAt: z.number().int(), body: z.string().max(200000),
  headers: z.record(z.string(), z.string()), signature: z.string().regex(/^[a-f0-9]{64}$/),
});

// The -background filename gives Netlify 15 minutes, independent of the HTTP dispatcher.
export default async function handler(request: Request): Promise<Response> {
  let job: OptimizationJob | null = null;
  let envelope: OptimizationEnvelope | undefined;
  let claimed = false;
  try {
    if (request.method !== 'POST') return new Response(null);
    const parsed = EnvelopeSchema.safeParse(await request.json());
    if (!parsed.success) return new Response(null);
    envelope = parsed.data;
    job = await readOptimizationJob(envelope.jobKey);
    if (!job || !verifyOptimizationEnvelope(envelope, job)) return new Response(null);
    claimed = await claimOptimizationWorker(envelope.jobKey, job.operationId);
    if (!claimed) return new Response(null);

    const event: HandlerEvent = {
      httpMethod: 'POST', path: '/.netlify/functions/optimize-background',
      headers: envelope.headers, multiValueHeaders: {}, body: envelope.body,
      isBase64Encoded: false, queryStringParameters: null, multiValueQueryStringParameters: null,
      rawUrl: request.url, rawQuery: '',
    };
    // Invoke the existing validated/billed pipeline IN PROCESS, never via its 30s HTTP endpoint.
    const response = await runOptimization(event);
    const payload = JSON.parse(response.body || '{}') as Record<string, unknown>;
    if (response.statusCode === 200 && hasCurrentEvidenceCards(payload)) {
      // Required storage: a successful paid response must remain retrievable even
      // when the pipeline's optional cache write failed.
      await finishOptimizationJob(envelope.jobKey, { ...job, state: 'succeeded', result: payload });
    } else {
      const safe = payload.billingStateUnknown === false || [400, 401, 403, 429].includes(response.statusCode);
      await finishOptimizationJob(envelope.jobKey, { ...job, state: 'failed', error: {
        error: typeof payload.error === 'string' ? payload.error : 'Optimization failed.',
        status: response.statusCode >= 400 ? response.statusCode : 500,
        billingStateUnknown: !safe, retryable: safe && payload.retryable === true,
      } });
    }
  } catch (error) {
    console.error('[optimize-background] Worker failed:', summarizeErrorForLog(error));
    if (claimed && job && envelope) {
      try {
        await finishOptimizationJob(envelope.jobKey, { ...job, state: 'failed', error: {
          error: 'Optimization could not finish. Refresh your balance before retrying.',
          status: 503, billingStateUnknown: true,
        } });
      } catch {
        // Keep the running claim; Netlify retries must never repeat a possible debit.
        console.error('[optimize-background] Could not persist the worker outcome; ownership retained.');
      }
    }
  }
  // Errors are recorded above. Throwing here would request automatic background retries.
  return new Response(null);
}
