import { beforeEach, expect, it, vi } from 'vitest';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';
const mocks=vi.hoisted(()=>({send:vi.fn(),capture:vi.fn(),db:{from:vi.fn(),rpc:vi.fn(),auth:{admin:{getUserById:vi.fn()}}}}));
vi.mock('../../lib/sentry.js',()=>({initSentry:vi.fn(),captureError:mocks.capture}));
vi.mock('../../lib/supabase-client.js',()=>({getSupabaseClient:()=>mocks.db}));
vi.mock('../../lib/email-service.js',()=>({prepareJobAlertEmail:(email:string,_lang:string,content:object)=>({to:email,...content}),sendJobAlertEmail:mocks.send}));
import {handler} from '../job-alerts-background.js';
const pref={user_id:'u',revision:'r',token:'t',language:'en',scope:'followed'};
let pending:Record<string,unknown>|null;
let enabled:boolean;
let posts:Record<string,unknown>[];
let sentStatus:unknown;
let health:Record<string,unknown>;
let followed:Record<string,unknown>[];
let catalogued:Record<string,unknown>[];
function query(table:string){
 let updating:Record<string,unknown>|undefined;
 const q={
  select:()=>q,eq:()=>q,in:()=>q,is:()=>q,gt:()=>q,lte:()=>q,order:()=>q,range:()=>q,limit:()=>q,maybeSingle:()=>q,single:()=>q,
  update:(value:Record<string,unknown>)=>{updating=value;return q;},
  then:(resolve:(value:unknown)=>unknown)=>{
   if(updating){if(table==='job_alert_deliveries' && updating.status)sentStatus=updating.status;if(table==='job_alert_preferences')Object.assign(health,updating);return Promise.resolve({data:{id:'d'},error:null}).then(resolve);}
   const data=table==='user_profiles'?{search_intent:{targetRoles:['AI Engineer']}}
    :table==='user_tracked_companies'?followed
    :table==='ats_companies'?catalogued
    :table==='user_job_feed_state'||table==='job_alert_items'?[]
    :table==='job_postings'?posts
    :table==='job_alert_deliveries'?pending ?? (mocks.db.rpc.mock.calls.some(([name])=>name==='prepare_job_alert') ? {id:'d',posting_ids:['p'],payload:{to:'a@example.com'}} : null)
    :enabled?{revision:'r'}:null;
   return Promise.resolve({data,error:null}).then(resolve);
  },
 };return q;
}
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('JOB_ALERTS_ENABLED','true');vi.stubEnv('JOB_CATALOGUE_ENABLED','true');vi.stubEnv('JOB_CRAWL_SECRET','secret');vi.stubEnv('SITE_URL','https://watheqai.app');
 enabled=true;sentStatus=null;health={};pref.scope='followed';followed=[{company_id:'c',ats_companies:{display_name:'Co',last_status:'ok'}}];catalogued=[{id:'c',display_name:'Co',last_status:'ok'}];
 posts=[{id:'p',company_id:'c',title:'AI Engineer',location:'Riyadh',apply_url:'https://example.com/job',posted_at:new Date(Date.now()-3600000).toISOString(),publication_kind:'published',publication_precision:'timestamp',first_seen_at:new Date().toISOString()}];
 pending={id:'d',revision:'r',created_at:new Date().toISOString(),posting_ids:['p'],payload:{to:'a@example.com',subject:'saved immutable payload'}};
 mocks.db.from.mockImplementation(query);
 mocks.db.auth.admin.getUserById.mockResolvedValue({data:{user:{email:'a@example.com',email_confirmed_at:'yes'}}});
 let claimed=false;
 mocks.db.rpc.mockImplementation(async(name:string)=>{
  if(name==='cancel_job_alert'){sentStatus=pending?.attempted_at?'uncertain':'cancelled';return {error:null};}
  return name==='claim_job_alert_users'?{data:claimed?[]:(claimed=true,[pref]),error:null}:{data:'d',error:null};
 });
 mocks.send.mockResolvedValue('provider-id');
});
const run=()=>handler({httpMethod:'POST',headers:{'x-watheq-crawl-secret':'secret'}} as unknown as HandlerEvent,{} as HandlerContext,()=>{});
it('retries the exact stored payload with a stable key and records acceptance',async()=>{await run();expect(mocks.send).toHaveBeenCalledWith(pending?.payload,'job-alert/d');expect(sentStatus).toBe('sent');});
it('does not send while globally disabled',async()=>{vi.stubEnv('JOB_ALERTS_ENABLED','false');await run();expect(mocks.send).not.toHaveBeenCalled();expect(mocks.db.rpc).not.toHaveBeenCalled();});
it('does not send without worker authentication',async()=>{vi.stubEnv('JOB_CRAWL_SECRET','different');await run();expect(mocks.send).not.toHaveBeenCalled();});
it('honors unsubscribe immediately before sending',async()=>{enabled=false;await run();expect(mocks.send).not.toHaveBeenCalled();});
it('cancels closed or dismissed jobs without changing the saved payload',async()=>{posts=[];await run();expect(mocks.send).not.toHaveBeenCalled();expect(sentStatus).toBe('cancelled');});
it('quarantines expired ambiguous deliveries',async()=>{pending!.attempted_at=new Date(Date.now()-86400001).toISOString();await run();expect(mocks.send).not.toHaveBeenCalled();expect(sentStatus).toBe('uncertain');});
it('keeps an ambiguous provider result pending for idempotent retry',async()=>{mocks.send.mockRejectedValue(new Error('network timeout'));await run();expect(sentStatus).toBeNull();});
it('prepares a first activation digest before sending',async()=>{pending=null;await run();expect(mocks.db.rpc).toHaveBeenCalledWith('prepare_job_alert',expect.objectContaining({p_ids:['p']}));expect(mocks.send).toHaveBeenCalledWith({to:'a@example.com'},'job-alert/d');});
it('checks catalogue subscriptions without any follows and records provider acceptance',async()=>{
 pref.scope='catalogue';followed=[];await run();
 expect(mocks.db.from).toHaveBeenCalledWith('ats_companies');expect(mocks.send).toHaveBeenCalledOnce();
 expect(health).toMatchObject({last_outcome:'accepted',last_completed_check_at:expect.any(String),last_provider_accepted_at:expect.any(String)});
});
it('records a completed empty check without sending',async()=>{
 posts=[];pending=null;await run();expect(mocks.send).not.toHaveBeenCalled();
 expect(health).toMatchObject({last_outcome:'empty',last_completed_check_at:expect.any(String)});
});
it('honors the catalogue rollout switch before an existing catalogue delivery',async()=>{
 pref.scope='catalogue';vi.stubEnv('JOB_CATALOGUE_ENABLED','false');await run();expect(mocks.send).not.toHaveBeenCalled();expect(health.last_outcome).toBe('failed');
});
it('records provider failure and captures a safe independent terminal event',async()=>{
 mocks.send.mockRejectedValue(new Error('a@example.com secret provider detail'));await run();
 expect(health).toMatchObject({last_outcome:'failed',last_completed_check_at:expect.any(String)});
 expect(mocks.capture).toHaveBeenCalledWith(expect.objectContaining({message:'Job alert check failed'}),{function:'job-alerts-background',stage:'delivery',status:503,code:'JOB_ALERT_DELIVERY_FAILED',operationId:expect.stringMatching(/^[a-f0-9-]{36}$/i)});
 expect(JSON.stringify(mocks.capture.mock.calls)).not.toContain('a@example.com');
});
