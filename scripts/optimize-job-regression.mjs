// Run with node --import tsx scripts/optimize-job-regression.mjs.
// Uses one disposable Redis key; never invokes an AI provider or charges credits.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getRedis, buildCacheKey } from '../netlify/lib/redis-cache.ts';
import { beginOptimizationDebit, claimOptimizationJob, claimOptimizationWorker, finishOptimizationJob,
  newOptimizationJob, optimizationEnvelope, readOptimizationJob, verifyOptimizationEnvelope } from '../netlify/lib/optimization-jobs.ts';

const redis = getRedis();
assert.ok(redis, 'Configure the existing Redis credentials before running this integration check.');
const key = `${buildCacheKey('optimize', { regression: randomUUID() })}:job`;
const body = JSON.stringify({ resumeText: 'Synthetic regression', jobText: 'Synthetic job' });
try {
  const attempts = Array.from({ length: 5 }, () => newOptimizationJob(body));
  const claims = await Promise.all(attempts.map(job => claimOptimizationJob(key, job)));
  assert.equal(claims.filter(Boolean).length, 1, 'Concurrent dispatchers must produce one owner');
  const job = attempts[claims.findIndex(Boolean)];
  const envelope = optimizationEnvelope(key, job, body, { authorization: 'Bearer synthetic-token' });
  assert.equal(verifyOptimizationEnvelope(envelope, job), true);
  assert.equal(verifyOptimizationEnvelope({ ...envelope, body: '{}' }, job), false);
  const workers = await Promise.all([claimOptimizationWorker(key, job.operationId), claimOptimizationWorker(key, job.operationId)]);
  assert.equal(workers.filter(Boolean).length, 1, 'Duplicate deliveries must not generate twice');
  assert.equal(await beginOptimizationDebit(key, randomUUID()), false);
  assert.equal(await beginOptimizationDebit(key, job.operationId), true);
  assert.equal(await beginOptimizationDebit(key, job.operationId), false);
  assert.equal(await finishOptimizationJob(key, { ...job, operationId: randomUUID(), state: 'succeeded' }), false);
  assert.equal(await finishOptimizationJob(key, { ...job, state: 'succeeded', result: { checked: true } }), true);
  assert.deepEqual((await readOptimizationJob(key)).result, { checked: true });

  assert.equal(await redis.exists(key + ':debit'), 0, 'Definite delivery releases the charge hold');
  assert.equal(await claimOptimizationJob(key, newOptimizationJob(body)), false, 'A racing dispatcher must reuse a retained success');
  await redis.del(key); // simulate expiry of the synthetic result
  const unknown = newOptimizationJob(body);
  assert.equal(await claimOptimizationJob(key, unknown), true);
  assert.equal(await claimOptimizationWorker(key, unknown.operationId), true);
  assert.equal(await beginOptimizationDebit(key, unknown.operationId), true);
  await finishOptimizationJob(key, { ...unknown, state: 'failed', error: { error: 'Unknown debit', status: 503, billingStateUnknown: true } });
  assert.equal(await claimOptimizationJob(key, newOptimizationJob(body)), false, 'Uncertain billing must block redispatch');
  assert.equal(await finishOptimizationJob(key, { ...job, state: 'succeeded' }), false, 'A late prior worker cannot overwrite the outcome');
  await redis.del(key); // expire only the synthetic job, preserving the reconciliation marker
  const hold = await readOptimizationJob(key);
  assert.equal(hold?.operationId, unknown.operationId);
  assert.equal(hold?.error?.billingStateUnknown, true);
  assert.equal(await redis.ttl(key + ':debit'), -1);
  assert.equal(await claimOptimizationJob(key, newOptimizationJob(body)), false, 'An expired job must not allow a second uncertain debit');
  console.log('Optimization job regression passed: atomic ownership, signed inputs, fencing, durable result and billing-unknown protection.');
} finally {
  await redis.del(key, key + ':debit');
}
