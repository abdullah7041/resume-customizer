import { beforeEach, expect, it, vi } from 'vitest';
import type { HandlerEvent, HandlerContext } from '@netlify/functions';
const mocks=vi.hoisted(()=>({send:vi.fn(),db:{from:vi.fn(),rpc:vi.fn(),auth:{admin:{getUserById:vi.fn()}}}}));
vi.mock('../../lib/supabase-client.js',()=>({getSupabaseClient:()=>mocks.db}));
vi.mock('../../lib/email-service.js',()=>({prepareJobAlertEmail:(email:string,_lang:string,content:object)=>({to:email,...content}),sendJobAlertEmail:mocks.send}));
import {handler} from '../job-alerts-background.js';
const pref={user_id:'u',revision:'r',token:'t',language:'en'};
let pending:Record<string,unknown>|null;
let enabled:boolean;
let posts:Record<string,unknown>[];
let sentStatus:unknown;
function query(table:string){
 let updating:Record<string,unknown>|undefined;
 const q={
  select:()=>q,eq:()=>q,in:()=>q,is:()=>q,gt:()=>q,lte:()=>q,order:()=>q,range:()=>q,limit:()=>q,maybeSingle:()=>q,single:()=>q,
  update:(value:Record<string,unknown>)=>{updating=value;return q;},
  then:(resolve:(value:unknown)=>unknown)=>{
   if(updating){if(table==='job_alert_deliveries' && updating.status)sentStatus=updating.status;return Promise.resolve({data:{id:'d'},error:null}).then(resolve);}
   const data=table==='user_profiles'?{search_intent:{targetRoles:['AI Engineer']}}
    :table==='user_tracked_companies'?[{company_id:'c',ats_companies:{display_name:'Co',last_status:'ok'}}]
    :table==='user_job_feed_state'||table==='job_alert_items'?[]
    :table==='job_postings'?posts
    :table==='job_alert_deliveries'?pending ?? (mocks.db.rpc.mock.calls.some(([name])=>name==='prepare_job_alert') ? {id:'d',posting_ids:['p'],payload:{to:'a@example.com'}} : null)
    :enabled?{revision:'r'}:null;
   return Promise.resolve({data,error:null}).then(resolve);
  },
 };return q;
}
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('JOB_ALERTS_ENABLED','true');vi.stubEnv('JOB_CRAWL_SECRET','secret');vi.stubEnv('SITE_URL','https://watheqai.app');
 enabled=true;sentStatus=null;
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
