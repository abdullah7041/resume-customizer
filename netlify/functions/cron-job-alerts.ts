import type { Handler } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { captureError, initSentry } from '../lib/sentry.js';
import { jobRuntime } from '../lib/job-runtime.js';

initSentry();
export const handler: Handler = async event => {
 if (process.env.JOB_ALERTS_ENABLED!=='true') return {statusCode:200,body:'Disabled'};
 const runtime=jobRuntime(event.rawUrl);
 if (!runtime.scheduled) return {statusCode:200,body:'Automatic checks are unavailable outside production'};
 const origin=runtime.origin; const secret=process.env.JOB_CRAWL_SECRET;
 if (!origin || !secret) return {statusCode:503,body:'Not configured'};
 const operationId=randomUUID();
 let status=502;
 try {
  const response = await fetch(`${origin}/.netlify/functions/job-alerts-background`, {
   method: 'POST', headers: { 'x-watheq-crawl-secret': secret }, signal: AbortSignal.timeout(10_000),
   redirect: 'error',
  });
  if (response.ok) return { statusCode: 200, body: 'Dispatched' };
  status=response.status || 502;
 } catch { /* Report only the stable failure below. */ }
 captureError(new Error('Job alert dispatch failed'), { function: 'cron-job-alerts', operationId,stage:'dispatch',status,code:'JOB_ALERT_DISPATCH_FAILED' });
 return { statusCode: 502, body: 'Dispatch failed' };
};
