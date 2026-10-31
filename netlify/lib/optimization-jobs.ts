import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { getRedis } from './redis-cache.js';

// Covers the 15-minute worker lifetime and Netlify's delayed invocation retries.
// ponytail: ownership is bounded to this window; cross-day replay needs durable billing operation IDs.
const CLAIM_TTL = 20 * 60;
const RESULT_TTL = 600;
export type OptimizationJob = {
  operationId: string;
  secret: string;
  issuedAt: number;
  inputHash: string;
  body: string;
  state: 'queued' | 'running' | 'succeeded' | 'failed';
  result?: Record<string, unknown>;
  error?: { error: string; status: number; billingStateUnknown: boolean; retryable?: boolean };
};
export type OptimizationEnvelope = {
  jobKey: string;
  operationId: string;
  issuedAt: number;
  body: string;
  headers: Record<string, string>;
  signature: string;
};
function redis() {
  const client = getRedis();
  if (!client) throw Object.assign(new Error('Optimization storage is unavailable.'), { status: 503, code: 'optimize/storage-unavailable' });
  return client;
}
export function newOptimizationJob(body: string): OptimizationJob {
  return { operationId: randomUUID(), secret: randomBytes(32).toString('hex'), issuedAt: Date.now(),
    inputHash: createHash('sha256').update(body).digest('hex'), body, state: 'queued' };
}
export async function readOptimizationJob(key: string): Promise<OptimizationJob | null> {
  return redis().get<OptimizationJob>(key);
}
export async function claimOptimizationJob(key: string, job: OptimizationJob): Promise<boolean> {
  return await redis().eval(`
    local raw = redis.call('GET', KEYS[1])
    if raw then
      local old = cjson.decode(raw)
      if old.state == 'queued' or old.state == 'running' or
        (old.state == 'failed' and old.error.billingStateUnknown) then return 0 end
    end
    redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
    return 1`, [key], [JSON.stringify(job), CLAIM_TTL]) === 1;
}
function envelopeSignature(envelope: Omit<OptimizationEnvelope, 'signature'>, secret: string): string {
  return createHmac('sha256', secret).update('watheq:optimization-job:v1\n' + JSON.stringify(envelope)).digest('hex');
}
export function optimizationEnvelope(jobKey: string, job: OptimizationJob, body: string, headers: Record<string, string>): OptimizationEnvelope {
  const envelope = { jobKey, operationId: job.operationId, issuedAt: job.issuedAt, body, headers };
  return { ...envelope, signature: envelopeSignature(envelope, job.secret) };
}
export function optimizationJobPayload(key: string, job: OptimizationJob, headers: Record<string, string>): string {
  const payload = JSON.stringify(optimizationEnvelope(key, job, job.body, headers));
  if (Buffer.byteLength(payload, 'utf8') > 200_000) throw Object.assign(
    new Error('This resume and job description are too large for optimization. Shorten the input and try again.'),
    { status: 413, code: 'optimize/input-too-large' });
  return payload;
}
export function verifyOptimizationEnvelope(envelope: OptimizationEnvelope, job: OptimizationJob): boolean {
  if (envelope.operationId !== job.operationId || envelope.issuedAt !== job.issuedAt ||
    Date.now() - job.issuedAt > CLAIM_TTL * 1000 ||
    createHash('sha256').update(envelope.body).digest('hex') !== job.inputHash ||
    !/^[a-f0-9]{64}$/.test(envelope.signature)) return false;
  const { signature, ...unsigned } = envelope;
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(envelopeSignature(unsigned, job.secret), 'hex'));
}
export async function claimOptimizationWorker(key: string, operationId: string): Promise<boolean> {
  return await redis().eval(`
    local raw = redis.call('GET', KEYS[1])
    if not raw then return 0 end
    local job = cjson.decode(raw)
    if job.operationId ~= ARGV[1] or job.state ~= 'queued' then return 0 end
    job.state = 'running'
    redis.call('SET', KEYS[1], cjson.encode(job), 'EX', ARGV[2])
    return 1`, [key], [operationId, CLAIM_TTL]) === 1;
}
export async function finishOptimizationJob(key: string, job: OptimizationJob): Promise<boolean> {
  return await redis().eval(`
    local raw = redis.call('GET', KEYS[1])
    if not raw then return 0 end
    local old = cjson.decode(raw)
    if old.operationId ~= ARGV[1] or old.state ~= 'running' then return 0 end
    redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
    return 1`, [key], [job.operationId, JSON.stringify(job), job.state === 'succeeded' ? RESULT_TTL : CLAIM_TTL]) === 1;
}
export async function dispatchOptimizationJob(key: string, job: OptimizationJob, headers: Record<string, string>): Promise<void> {
  const siteUrl = process.env.DEPLOY_URL || process.env.URL;
  if (!siteUrl || new URL(siteUrl).protocol !== 'https:') throw Object.assign(new Error('Optimization worker URL is unavailable.'), { status: 503, code: 'optimize/worker-unavailable' });
  const payload = optimizationJobPayload(key, job, headers);
  try {
    const response = await fetch(new URL('/.netlify/functions/optimize-background', siteUrl), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload,
      signal: AbortSignal.timeout(5000),
    });
    if (response.status !== 202) console.warn('[optimize-job] Worker acknowledgement was not received.', { status: response.status });
  } catch {
    // Acceptance is ambiguous. Keep ownership; a retry uses this SAME operation.
    console.warn('[optimize-job] Worker acknowledgement was interrupted; retaining the job claim.');
  }
}
