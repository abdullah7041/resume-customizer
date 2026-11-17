import { beforeEach, expect, it, vi } from 'vitest';
import type { HandlerEvent, HandlerResponse } from '@netlify/functions';
const mocks=vi.hoisted(()=>({getUser:vi.fn(),quota:vi.fn(),prepare:vi.fn(),send:vi.fn(),capture:vi.fn(),flush:vi.fn()}));
vi.mock('../../lib/supabase-client.js',()=>({getSupabaseClient:()=>({auth:{getUser:mocks.getUser}})}));
vi.mock('../../lib/rate-limiter.js',()=>({checkCostBearingRateLimitForIdentifier:mocks.quota}));
vi.mock('../../lib/email-service.js',()=>({prepareJobAlertEmail:mocks.prepare,sendJobAlertEmail:mocks.send}));
vi.mock('../../lib/sentry.js',()=>({initSentry:vi.fn(),captureError:mocks.capture,flushSentry:mocks.flush}));
import {handler} from '../job-alert-test.js';
const operationId='11111111-1111-4111-8111-111111111111';
let requestedAt:string;
const invoke=async(body:unknown={operationId,requestedAt},headers={authorization:'Bearer token'},httpMethod='POST')=>await handler({httpMethod,headers,body:typeof body==='string'?body:JSON.stringify(body)} as unknown as HandlerEvent,{} as never,()=>{}) as HandlerResponse;
beforeEach(()=>{
 vi.clearAllMocks();requestedAt=new Date().toISOString();vi.stubEnv('JOB_ALERTS_ENABLED','true');vi.stubEnv('RESEND_API_KEY','test');
 mocks.getUser.mockResolvedValue({data:{user:{id:'owner',email:'owner@example.com',email_confirmed_at:'yes'}},error:null});mocks.quota.mockResolvedValue({allowed:true});
 mocks.prepare.mockImplementation((to:string,_language:string,content:object)=>({to,...content}));mocks.send.mockResolvedValue('provider');mocks.flush.mockResolvedValue(undefined);
});
it('sends a clearly labelled bilingual test only to the authenticated verified address',async()=>{
 const result=await invoke();const body=JSON.parse(result.body ?? '{}');
 expect(result.statusCode).toBe(200);expect(body).toMatchObject({status:'accepted',operationId,acceptedAt:expect.any(String)});
 expect(mocks.quota).toHaveBeenCalledWith('job-alert-test','owner');
 expect(mocks.prepare).toHaveBeenCalledWith('owner@example.com','en',expect.objectContaining({subject:expect.stringMatching(/TEST.*تجربة/),text:expect.stringMatching(/test.*تجريبية/s)}));
 expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({to:'owner@example.com'}),expect.stringMatching(/^job-alert-test\/[a-f0-9]{64}$/));
});
it('reuses exactly the same provider payload/key when an uncertain operation is retried',async()=>{
 mocks.send.mockRejectedValueOnce(new Error('timeout owner@example.com token'));
 const first=await invoke();expect(first.statusCode).toBe(503);expect(JSON.parse(first.body ?? '{}')).toMatchObject({status:'unknown',operationId,code:'acceptance_unknown'});
 await invoke();expect(mocks.send.mock.calls[0]).toEqual(mocks.send.mock.calls[1]);
 expect(mocks.capture).toHaveBeenCalledWith(expect.objectContaining({message:'Job alert test failed'}),expect.objectContaining({function:'job-alert-test',stage:'provider',operationId,code:'JOB_ALERT_TEST_PROVIDER_FAILED'}));
 expect(JSON.stringify(mocks.capture.mock.calls)).not.toMatch(/owner@example.com|token/);expect(mocks.flush).toHaveBeenCalledOnce();
});
it('keeps different users and operations in separate provider keys',async()=>{
 await invoke();await invoke({operationId:'22222222-2222-4222-8222-222222222222',requestedAt});
 mocks.getUser.mockResolvedValue({data:{user:{id:'other',email:'other@example.com',email_confirmed_at:'yes'}},error:null});await invoke();
 expect(new Set(mocks.send.mock.calls.map(call=>call[1])).size).toBe(3);
});
it('refuses expired or future-dated retry operations without sending',async()=>{
 for(const timestamp of [new Date(Date.now()-3600001).toISOString(),new Date(Date.now()+120000).toISOString()]) {
  const result=await invoke({operationId,requestedAt:timestamp});expect(result.statusCode).toBe(409);expect(JSON.parse(result.body ?? '{}')).toMatchObject({status:'failed',code:'operation_expired'});
 }
 expect(mocks.send).not.toHaveBeenCalled();
});
it.each([{operationId,to:'victim@example.com'},{operationId,user_id:'victim'},{operationId:'not-a-uuid'},'{'])('rejects invalid or cross-user payload %j',async body=>{
 expect((await invoke(typeof body==='string'?body:{...body,requestedAt})).statusCode).toBe(400);expect(mocks.send).not.toHaveBeenCalled();
});
it('requires POST and authentication',async()=>{
 expect((await invoke({},undefined,'GET')).statusCode).toBe(405);
 expect((await invoke({operationId,requestedAt},{} as {authorization:string})).statusCode).toBe(401);
 mocks.getUser.mockResolvedValue({data:{user:null},error:new Error('bad')});expect((await invoke()).statusCode).toBe(401);expect(mocks.send).not.toHaveBeenCalled();
});
it('requires verified email without consuming quota',async()=>{
 mocks.getUser.mockResolvedValue({data:{user:{id:'owner',email:'owner@example.com'}},error:null});const result=await invoke();expect(result.statusCode).toBe(403);expect(JSON.parse(result.body ?? '{}')).toMatchObject({operationId,status:'failed',code:'verify_email'});expect(mocks.quota).not.toHaveBeenCalled();expect(mocks.send).not.toHaveBeenCalled();
});
it.each(['JOB_ALERTS_ENABLED','RESEND_API_KEY'])('refuses disabled/missing configuration %s',async key=>{
 vi.stubEnv(key,'');expect((await invoke()).statusCode).toBe(503);expect(mocks.send).not.toHaveBeenCalled();
});
it.each([429,503])('does not send when per-user quota returns %s',async statusCode=>{
 mocks.quota.mockResolvedValue({allowed:false,response:{statusCode,headers:{'Retry-After':'3600'}}});const result=await invoke();
 expect(result.statusCode).toBe(statusCode);expect(JSON.parse(result.body ?? '{}')).toMatchObject({status:'failed',code:statusCode===429?'limit_reached':'quota_unavailable'});expect(mocks.send).not.toHaveBeenCalled();
});
