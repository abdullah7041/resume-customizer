import type { Handler } from '@netlify/functions';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import signals from '../../src/types/autofix-signals.json';

const alert = z.object({
  action: z.literal('triggered'),
  data: z.object({ event: z.object({
    issue_id: z.coerce.string().regex(/^\d{1,20}$/),
    project: z.coerce.string(),
    tags: z.array(z.tuple([z.string(), z.string()])).default([]),
    environment: z.string().nullish(), release: z.string().nullish(),
    metadata: z.object({ type: z.string().optional() }).nullish(),
    exception: z.object({ values: z.array(z.object({
      stacktrace: z.object({ frames: z.array(z.object({
        filename: z.string().nullish(), lineno: z.number().int().positive().nullish(),
      })) }).nullish(),
    })) }).nullish(),
  }) }),
});

const clientFeatures = new Set(['parseResume', 'analyzeResumeWithAI', 'optimizeResume', 'refineBullet',
  'analyzeVision2030', 'analyzeResumeTruthCheck', 'optimize', 'pdf-extract', 'render']);
const errorTypes = new Set(['TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'AbortError', 'TimeoutError']);

export function incidentInputs(body: unknown, project: string) {
  const parsed = alert.safeParse(body);
  if (!parsed.success) return null;
  const event = parsed.data.data.event;
  const tags = Object.fromEntries(event.tags);
  if (event.project !== project || (event.environment ?? tags.environment) !== 'production') return null;
  const origin = tags['watheq.origin'];
  const fn = tags['watheq.function'];
  const outcome = tags['watheq.outcome'];
  const feature = tags.api_function ?? tags.feature ?? tags.area ?? tags.stage;
  let signal: string;
  if (origin === 'browser') {
    signal = signals.outcomes.includes(outcome) ? outcome : clientFeatures.has(feature) ? feature : 'browser_error';
  } else if (origin === 'user-function' && signals.functions.includes(fn)) {
    signal = fn;
  } else return null;
  const release = event.release ?? tags.release ?? '';
  const type = event.metadata?.type ?? '';
  let location = 'none';
  for (const entry of [...(event.exception?.values ?? [])].reverse()) {
    for (const frame of [...(entry.stacktrace?.frames ?? [])].reverse()) {
      const path = frame.filename?.replace(/\\/g, '/').match(/(?:^|\/)((?:src|netlify\/(?:lib|functions))\/[\w./-]+\.[jt]sx?)$/)?.[1];
      if (path && !path.includes('..') && frame.lineno && frame.lineno <= 999999) {
        // The runner resolves this digest against files actually tracked in the affected release.
        location = createHash('sha256').update(path).digest('hex') + ':' + frame.lineno;
        break;
      }
    }
    if (location !== 'none') break;
  }
  return { issue: event.issue_id, signal, release: /^[0-9a-f]{40}$/.test(release) ? release : 'unknown',
    kind: errorTypes.has(type) ? type : 'Error', location };
}

export const handler: Handler = async event => {
  const reply = (statusCode: number) => ({ statusCode, body: '' });
  if (event.httpMethod !== 'POST') return reply(405);
  const { AUTOFIX_SENTRY_SECRET: secret, AUTOFIX_SENTRY_PROJECT: project,
    AUTOFIX_DISPATCH_TOKEN: token, AUTOFIX_REPOSITORY: repo } = process.env;
  if (!secret || !project || !token || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return reply(503);
  if ((event.body?.length ?? 0) > 4_000_000) return reply(413);
  const bytes = Buffer.from(event.body ?? '', event.isBase64Encoded ? 'base64' : 'utf8');
  const signature = event.headers['sentry-hook-signature'] ?? '';
  if (!/^[a-f0-9]{64}$/i.test(signature) ||
    !timingSafeEqual(createHmac('sha256', secret).update(bytes).digest(), Buffer.from(signature, 'hex'))) return reply(401);
  if (event.headers['sentry-hook-resource'] !== 'event_alert') return reply(204);
  let payload: unknown;
  try { payload = JSON.parse(bytes.toString('utf8')); } catch { return reply(400); }
  const inputs = incidentInputs(payload, project);
  if (!inputs) return reply(204);
  try {
    const response = await fetch('https://api.github.com/repos/' + repo + '/actions/workflows/autofix.yml/dispatches', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json' }, body: JSON.stringify({ ref: 'main', inputs }),
      signal: AbortSignal.timeout(5000),
    });
    return reply(response.ok ? 202 : 503);
  } catch { return reply(503); }
};
