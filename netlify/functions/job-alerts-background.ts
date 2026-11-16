import type { Handler } from '@netlify/functions';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { selectAlertPostings, renderJobAlert, canRetryDelivery } from '../lib/job-alerts.js';
import { prepareJobAlertEmail, sendJobAlertEmail } from '../lib/email-service.js';
import type { FeedPosting } from '../../src/lib/jobs/types.js';
import type { JobAlertOutcome, JobAlertScope } from '../../src/types/jobAlerts.js';
import { initSentry, captureError } from '../lib/sentry.js';
const intentSchema=z.object({ targetRoles:z.array(z.string().trim().min(1)).min(1), seniority:z.enum(['junior','mid','senior','lead','manager']).optional(), locations:z.array(z.string()).optional() });
type DB=NonNullable<ReturnType<typeof getSupabaseClient>>;
interface Preference { user_id:string; revision:string; token:string; language:'ar'|'en'; scope:JobAlertScope }
interface CheckResult { outcome:JobAlertOutcome; providerAcceptedAt?:string }
function reportFailure(stage:string, operationId:string) {
 // Deliberately omit provider exceptions, payloads, identity and tokens.
 try { initSentry();captureError(new Error('Job alert check failed'),{function:'job-alerts-background',stage,operationId,status:503,code:`JOB_ALERT_${stage.toUpperCase()}_FAILED`}); } catch { /* Monitoring must not break delivery cleanup. */ }
}
export const handler: Handler = async event => {
 if (process.env.JOB_ALERTS_ENABLED!=='true') return {statusCode:200,body:'Disabled'};
 const secret=Buffer.from(process.env.JOB_CRAWL_SECRET ?? '');
 const presented=Buffer.from(event.headers['x-watheq-crawl-secret'] ?? '');
 if (event.httpMethod!=='POST' || !secret.length || secret.length!==presented.length || !timingSafeEqual(secret,presented)) return {statusCode:401,body:'Unauthorized'};
 const operationId=randomUUID();
 try {
 const db=getSupabaseClient(); if (!db) throw new Error('Unavailable');
 const origin=new URL(process.env.SITE_URL ?? '').origin;
 if (!origin.startsWith('https://')) throw new Error('HTTPS origin required');
 const owner=operationId; const deadline=Date.now()+8*60_000;
 while (Date.now()<deadline) {
  const claimed=await db.rpc('claim_job_alert_users',{p_owner:owner,p_limit:10});
  if (claimed.error) throw claimed.error;
  if (!claimed.data?.length) break;
  for (const preference of claimed.data as Preference[]) {
   let result:CheckResult;
   try { result=await deliver(db,preference,owner,origin); }
   catch { result={outcome:'failed'}; }
   if(result.outcome==='failed') reportFailure('delivery',operationId);
   const saved=await db.from('job_alert_preferences').update({
    lease_until:null,lease_owner:null,last_completed_check_at:new Date().toISOString(),last_outcome:result.outcome,
    ...(result.providerAcceptedAt ? {last_provider_accepted_at:result.providerAcceptedAt} : {}),
   }).eq('user_id',preference.user_id).eq('lease_owner',owner).eq('revision',preference.revision);
   if (saved.error) reportFailure('health',operationId);
  }
 }
 return {statusCode:200,body:'Processed'};
 } catch { reportFailure('worker',operationId);return {statusCode:503,body:'Alert check failed'}; }
};
async function deliver(db:DB, pref:Preference, owner:string, origin:string):Promise<CheckResult> {
 if (pref.scope==='catalogue' && process.env.JOB_CATALOGUE_ENABLED!=='true') return {outcome:'failed'};
 const userResult=await db.auth.admin.getUserById(pref.user_id);
 const user=userResult.data.user;
 if (userResult.error) throw userResult.error;
 if (!user?.email_confirmed_at || !user.email) return {outcome:'setup_required'};
 const [profile,tracked,dismissed,pending]=await Promise.all([
  db.from('user_profiles').select('search_intent').eq('email',user.email).maybeSingle(),
  pref.scope==='catalogue' ? db.from('ats_companies').select('id,display_name,last_status').eq('catalog_enabled',true)
   : db.from('user_tracked_companies').select('company_id,ats_companies(display_name,last_status)').eq('user_id',pref.user_id),
  db.from('user_job_feed_state').select('posting_id').eq('user_id',pref.user_id).eq('state','dismissed'),
  db.from('job_alert_deliveries').select('*').eq('user_id',pref.user_id).eq('status','pending').order('created_at').limit(1).maybeSingle(),
 ]);
 if (profile.error || tracked.error || dismissed.error || pending.error) throw new Error('Read failed');
 const intent=intentSchema.safeParse(profile.data?.search_intent);
 if (!intent.success) return {outcome:'setup_required'};
 const names=new Map<string,string>();
 let sourceFailed=false;
 for (const row of tracked.data ?? []) {
  const embedded = 'ats_companies' in row ? row.ats_companies : row;
  const company = (Array.isArray(embedded) ? embedded[0] : embedded) as {id?:string;display_name:string;last_status:string} | undefined;
  const companyId = 'company_id' in row ? row.company_id : company?.id;
  if (company?.last_status === 'ok' && companyId) names.set(companyId, company.display_name);
  else sourceFailed = true;
 }
 if (!names.size) return {outcome:sourceFailed || pref.scope==='catalogue' ? 'failed':'setup_required'};
 const postings:FeedPosting[]=[];
 for (let offset=0;;offset+=500) {
  const result=await db.from('job_postings').select('id,company_id,title,location,apply_url,posted_at,publication_kind,publication_precision,first_seen_at').in('company_id',[...names.keys()]).is('closed_at',null).gt('posted_at',new Date(Date.now()-86400000).toISOString()).lte('posted_at',new Date().toISOString()).order('id').range(offset,offset+499);
  if (result.error) throw result.error;
  for (const row of result.data ?? []) postings.push({id:row.id,companyId:row.company_id,companyName:names.get(row.company_id) ?? '',title:row.title,location:row.location,applyUrl:row.apply_url,postedAt:row.posted_at,publicationKind:row.publication_kind,publicationPrecision:row.publication_precision,firstSeenAt:row.first_seen_at});
  if ((result.data?.length ?? 0)<500) break;
 }
 const eligible=selectAlertPostings(postings,intent.data,new Set((dismissed.data ?? []).map(row=>row.posting_id)));
 let delivery=pending.data;
 if (delivery) {
  const ids=new Set(eligible.map(p=>p.id));
  const invalid=delivery.revision!==pref.revision || delivery.payload.to!==user.email || !(delivery.posting_ids as string[]).every(id=>ids.has(id));
  if (invalid || !canRetryDelivery(delivery.attempted_at ?? delivery.created_at)) {
   const cancel = await db.rpc('cancel_job_alert', { p_id: delivery.id });
   if (cancel.error) throw cancel.error;
   return {outcome:delivery.attempted_at || sourceFailed ? 'failed':'empty'};
  }
 } else {
  // Query reservations only for currently eligible postings, avoiding default row limits.
  const reserved=new Set<string>();
  for (let i=0;i<eligible.length;i+=200) {
   const result=await db.from('job_alert_items').select('posting_id').eq('user_id',pref.user_id).in('posting_id',eligible.slice(i,i+200).map(p=>p.id));
   if (result.error) throw result.error;
   result.data?.forEach(row=>reserved.add(row.posting_id));
  }
  const fresh=eligible.filter(p=>!reserved.has(p.id));
  if (!fresh.length) return {outcome:sourceFailed?'failed':'empty'};
  const payload=prepareJobAlertEmail(user.email,pref.language,renderJobAlert(fresh,pref.language,origin,pref.token));
  const prepared=await db.rpc('prepare_job_alert',{p_user:pref.user_id,p_owner:owner,p_revision:pref.revision,p_ids:fresh.map(p=>p.id),p_payload:payload});
  if (prepared.error) throw prepared.error;
  if (!prepared.data) return {outcome:'empty'};
  const loaded=await db.from('job_alert_deliveries').select('*').eq('id',prepared.data).single();
  if (loaded.error) throw loaded.error;
  delivery=loaded.data;
 }
 // Last opt-out and ownership fence before the external request. No credit/AI path.
 const current=await db.from('job_alert_preferences').select('revision').eq('user_id',pref.user_id).eq('enabled',true).eq('lease_owner',owner).gt('lease_until',new Date().toISOString()).maybeSingle();
 if (current.error) throw current.error;
 if (current.data?.revision!==pref.revision || process.env.JOB_ALERTS_ENABLED!=='true') return {outcome:'setup_required'};
 if (!delivery.attempted_at) {
  const marked = await db.from('job_alert_deliveries').update({attempted_at:new Date().toISOString()})
    .eq('id',delivery.id).eq('status','pending').is('attempted_at',null).select('id').maybeSingle();
  if (marked.error) throw marked.error;
  if (!marked.data) return {outcome:'failed'};
 }
 const providerId=await sendJobAlertEmail(delivery.payload,`job-alert/${delivery.id}`);
 const providerAcceptedAt=new Date().toISOString();
 const saved=await db.from('job_alert_deliveries').update({status:'sent',provider_id:providerId}).eq('id',delivery.id).eq('status','pending');
 if (saved.error) return {outcome:'failed',providerAcceptedAt};
 console.log('[JobAlerts] Accepted', {deliveryId:delivery.id,count:delivery.posting_ids.length,lagMs:Date.now()-Date.parse(delivery.created_at)});
 return {outcome:sourceFailed?'failed':'accepted',providerAcceptedAt};
}
