import { beforeEach, expect, it, vi } from 'vitest';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';
const mocks=vi.hoisted(()=>({getUser:vi.fn(),from:vi.fn(),writes:vi.fn()}));
let followed: {company_id:string}[];
vi.mock('../../lib/supabase-client.js',()=>({getSupabaseClient:()=>({auth:{getUser:mocks.getUser},from:mocks.from})}));
import {handler} from '../job-alert-preferences.js';
import {handler as unsubscribe} from '../job-alert-unsubscribe.js';
beforeEach(()=>{
 vi.clearAllMocks();followed=[{company_id:'c'}];vi.stubEnv('JOB_ALERTS_ENABLED','false');mocks.getUser.mockResolvedValue({data:{user:{id:'owner',email:'owner@example.com',email_confirmed_at:'yes'}},error:null});
 mocks.from.mockImplementation((table:string)=>{
  const q={select:()=>q,eq:vi.fn(()=>q),limit:()=>q,maybeSingle:()=>q,upsert:(value:unknown)=>{mocks.writes(value);return q;},update:(value:unknown)=>{mocks.writes(value);return q;},then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:table==='user_profiles'?{search_intent:{targetRoles:['Engineer']}}:table==='user_tracked_companies'?followed:{enabled:false,language:'en'},error:null}).then(resolve)};return q;
 });
});
const call=(method='POST',body=JSON.stringify({enabled:true,language:'en'}),rawUrl?:string)=>handler({httpMethod:method,headers:{authorization:'Bearer token'},body,rawUrl} as unknown as HandlerEvent,{} as HandlerContext,()=>{});
it('requires a session and refuses cross-user input identity',async()=>{
 mocks.getUser.mockResolvedValueOnce({data:{user:null},error:new Error('bad')});expect((await call() as {statusCode:number}).statusCode).toBe(401);
 await call('POST',JSON.stringify({enabled:true,language:'en',user_id:'victim'}));
 expect(mocks.writes).toHaveBeenCalledWith(expect.objectContaining({user_id:'owner'}));
});
it('requires verified email before consent',async()=>{mocks.getUser.mockResolvedValueOnce({data:{user:{id:'u',email:'a@example.com'}},error:null});expect((await call() as {statusCode:number}).statusCode).toBe(403);expect(mocks.writes).not.toHaveBeenCalled();});
it('rejects malformed JSON without a server error',async()=>{expect((await call('POST','{') as {statusCode:number}).statusCode).toBe(400);});
it('keeps existing subscriptions followed-only and reports service availability separately from consent',async()=>{
 const result=await call('GET') as {body:string};
 expect(JSON.parse(result.body)).toMatchObject({scope:'followed',enabled:false,serviceAvailable:false,lastCheckedAt:null,lastOutcome:null,lastProviderAcceptedAt:null});
 await call();expect(mocks.writes).toHaveBeenCalledWith(expect.objectContaining({scope:'followed'}));
});
it('allows explicit catalogue opt-in without following a company',async()=>{
 followed=[];
 expect((await call('POST',JSON.stringify({enabled:true,language:'en',scope:'catalogue'})) as {statusCode:number}).statusCode).toBe(200);
 expect(mocks.writes).toHaveBeenCalledWith(expect.objectContaining({scope:'catalogue',enabled:true}));
 expect((await call() as {statusCode:number}).statusCode).toBe(422);
});
it('reports preview consent separately from an automatic hourly schedule',async()=>{
 vi.stubEnv('JOB_ALERTS_ENABLED','true');vi.stubEnv('CONTEXT','deploy-preview');
 const result=await call('GET') as {body:string};
 expect(JSON.parse(result.body)).toMatchObject({serviceAvailable:false,serviceState:'manual'});
});
it('detects a preview request when build-only context variables are absent',async()=>{
 vi.stubEnv('JOB_ALERTS_ENABLED','true');vi.stubEnv('CONTEXT','');vi.stubEnv('URL','https://watheqai.app');vi.stubEnv('SITE_NAME','resume-optimizing');
 const result=await call('GET',undefined,'https://deploy-preview-150--resume-optimizing.netlify.app/.netlify/functions/job-alert-preferences') as {body:string};
 expect(JSON.parse(result.body)).toMatchObject({serviceAvailable:false,serviceState:'manual'});
});
it('requires production context and worker/email configuration before reporting scheduled service',async()=>{
 vi.stubEnv('JOB_ALERTS_ENABLED','true');vi.stubEnv('CONTEXT','production');vi.stubEnv('RESEND_API_KEY','');
 expect(JSON.parse((await call('GET') as {body:string}).body)).toMatchObject({serviceAvailable:false,serviceState:'unconfigured'});
 vi.stubEnv('RESEND_API_KEY','test');vi.stubEnv('JOB_CRAWL_SECRET','test');vi.stubEnv('SITE_URL','https://watheqai.app');vi.stubEnv('URL','https://watheqai.app');
 expect(JSON.parse((await call('GET') as {body:string}).body)).toMatchObject({serviceAvailable:true,serviceState:'scheduled'});
});
it('unsubscribe GET never writes; POST revokes consent and token',async()=>{
 const event={httpMethod:'GET',queryStringParameters:{token:'11111111-1111-1111-1111-111111111111'}} as unknown as HandlerEvent;
 await unsubscribe(event,{} as HandlerContext,()=>{});expect(mocks.writes).not.toHaveBeenCalled();
 await unsubscribe({...event,httpMethod:'POST'},{} as HandlerContext,()=>{});expect(mocks.writes).toHaveBeenCalledWith(expect.objectContaining({enabled:false}));
});
