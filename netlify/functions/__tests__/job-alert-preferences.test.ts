import { beforeEach, expect, it, vi } from 'vitest';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';
const mocks=vi.hoisted(()=>({getUser:vi.fn(),from:vi.fn(),writes:vi.fn()}));
vi.mock('../../lib/supabase-client.js',()=>({getSupabaseClient:()=>({auth:{getUser:mocks.getUser},from:mocks.from})}));
import {handler} from '../job-alert-preferences.js';
import {handler as unsubscribe} from '../job-alert-unsubscribe.js';
beforeEach(()=>{
 vi.clearAllMocks();mocks.getUser.mockResolvedValue({data:{user:{id:'owner',email:'owner@example.com',email_confirmed_at:'yes'}},error:null});
 mocks.from.mockImplementation((table:string)=>{
  const q={select:()=>q,eq:vi.fn(()=>q),limit:()=>q,maybeSingle:()=>q,upsert:(value:unknown)=>{mocks.writes(value);return q;},update:(value:unknown)=>{mocks.writes(value);return q;},then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:table==='user_profiles'?{search_intent:{targetRoles:['Engineer']}}:table==='user_tracked_companies'?[{company_id:'c'}]:{enabled:false,language:'en'},error:null}).then(resolve)};return q;
 });
});
const call=(method='POST',body=JSON.stringify({enabled:true,language:'en'}))=>handler({httpMethod:method,headers:{authorization:'Bearer token'},body} as unknown as HandlerEvent,{} as HandlerContext,()=>{});
it('requires a session and refuses cross-user input identity',async()=>{
 mocks.getUser.mockResolvedValueOnce({data:{user:null},error:new Error('bad')});expect((await call() as {statusCode:number}).statusCode).toBe(401);
 await call('POST',JSON.stringify({enabled:true,language:'en',user_id:'victim'}));
 expect(mocks.writes).toHaveBeenCalledWith(expect.objectContaining({user_id:'owner'}));
});
it('requires verified email before consent',async()=>{mocks.getUser.mockResolvedValueOnce({data:{user:{id:'u',email:'a@example.com'}},error:null});expect((await call() as {statusCode:number}).statusCode).toBe(403);expect(mocks.writes).not.toHaveBeenCalled();});
it('rejects malformed JSON without a server error',async()=>{expect((await call('POST','{') as {statusCode:number}).statusCode).toBe(400);});
it('unsubscribe GET never writes; POST revokes consent and token',async()=>{
 const event={httpMethod:'GET',queryStringParameters:{token:'11111111-1111-1111-1111-111111111111'}} as unknown as HandlerEvent;
 await unsubscribe(event,{} as HandlerContext,()=>{});expect(mocks.writes).not.toHaveBeenCalled();
 await unsubscribe({...event,httpMethod:'POST'},{} as HandlerContext,()=>{});expect(mocks.writes).toHaveBeenCalledWith(expect.objectContaining({enabled:false}));
});
