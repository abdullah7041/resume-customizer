import { beforeEach, expect, it, vi } from 'vitest';
import type { HandlerContext, HandlerEvent } from '@netlify/functions';
const mocks=vi.hoisted(()=>({fetch:vi.fn(),capture:vi.fn()}));
vi.mock('../../lib/sentry.js',()=>({initSentry:vi.fn(),captureError:mocks.capture}));
import { handler } from '../cron-job-alerts.js';
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('fetch',mocks.fetch);vi.stubEnv('CONTEXT','production');vi.stubEnv('DEPLOY_URL','');vi.stubEnv('DEPLOY_PRIME_URL','');vi.stubEnv('JOB_ALERTS_ENABLED','true');vi.stubEnv('URL','https://watheqai.app');vi.stubEnv('JOB_CRAWL_SECRET','secret');mocks.fetch.mockResolvedValue({ok:true});});
const run=(rawUrl?:string)=>handler({rawUrl} as HandlerEvent,{} as HandlerContext,()=>{});
it('reports dispatch rejection independently of application logs',async()=>{
 mocks.fetch.mockResolvedValue({ok:false});expect(await run()).toMatchObject({statusCode:502});
 expect(mocks.capture).toHaveBeenCalledWith(expect.objectContaining({message:'Job alert dispatch failed'}),{function:'cron-job-alerts',stage:'dispatch',status:502,code:'JOB_ALERT_DISPATCH_FAILED',operationId:expect.stringMatching(/^[a-f0-9-]{36}$/i)});
});
it('captures safe terminal failure without leaking request or provider detail',async()=>{
 mocks.fetch.mockRejectedValue(new Error('secret a@example.com'));expect(await run()).toMatchObject({statusCode:502});
 expect(mocks.capture).toHaveBeenCalledOnce();expect(JSON.stringify(mocks.capture.mock.calls)).not.toContain('secret');
});
it('keeps global pause as a successful no-op',async()=>{vi.stubEnv('JOB_ALERTS_ENABLED','false');expect(await run()).toMatchObject({statusCode:200});expect(mocks.fetch).not.toHaveBeenCalled();expect(mocks.capture).not.toHaveBeenCalled();});
it('does not dispatch a broad email worker from a deploy preview',async()=>{
 vi.stubEnv('CONTEXT','deploy-preview');
 expect(await run()).toMatchObject({statusCode:200,body:'Automatic checks are unavailable outside production'});
 expect(mocks.fetch).not.toHaveBeenCalled();
});
it('detects preview requests without build-only environment variables',async()=>{
 vi.stubEnv('CONTEXT','');vi.stubEnv('SITE_NAME','resume-optimizing');
 await run('https://deploy-preview-150--resume-optimizing.netlify.app/.netlify/functions/cron-job-alerts');
 expect(mocks.fetch).not.toHaveBeenCalled();
});
