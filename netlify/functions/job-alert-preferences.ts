import type { Handler } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase-client.js';
const schema = z.object({ enabled: z.boolean(), language: z.enum(['ar', 'en']), scope: z.enum(['followed','catalogue']).default('followed') });
const selection='enabled,language,scope,last_completed_check_at,last_outcome,last_provider_accepted_at';
interface HealthRow { last_completed_check_at?:string; last_outcome?:string; last_provider_accepted_at?:string }
const health=(row:HealthRow|null,scope:string)=>({serviceAvailable:process.env.JOB_ALERTS_ENABLED==='true' && (scope!=='catalogue' || process.env.JOB_CATALOGUE_ENABLED==='true'),lastCheckedAt:row?.last_completed_check_at ?? null,lastOutcome:row?.last_outcome ?? null,lastProviderAcceptedAt:row?.last_provider_accepted_at ?? null});
const response = (status: number, code: string, message: string) => ({ statusCode: status, body: JSON.stringify({ status, code, message }) });
export const handler: Handler = async event => {
 try {
  if (!['GET','POST'].includes(event.httpMethod)) return response(405,'method','Method not allowed');
  const db = getSupabaseClient(); if (!db) return response(503,'unavailable','Service unavailable');
  const token = (event.headers.authorization ?? event.headers.Authorization ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return response(401,'auth','Sign in to manage alerts');
  if (event.httpMethod === 'GET') {
   const result = await db.from('job_alert_preferences').select(selection).eq('user_id', user.id).maybeSingle();
   if (result.error) throw result.error;
   return { statusCode: 200, body: JSON.stringify({ enabled: result.data?.enabled ?? false, language: result.data?.language ?? 'en',scope:result.data?.scope ?? 'followed',...health(result.data,result.data?.scope ?? 'followed') }) };
  }
  let body: unknown; try { body=JSON.parse(event.body ?? '{}'); } catch { return response(400,'invalid','Invalid request'); }
  const parsed = schema.safeParse(body); if (!parsed.success) return response(400,'invalid','Invalid request');
  if (parsed.data.enabled) {
   if (!user.email || !user.email_confirmed_at) return response(403,'verify_email','Verify your email before enabling alerts');
   const [profile, companies] = await Promise.all([
    db.from('user_profiles').select('search_intent').eq('email',user.email).maybeSingle(),
    parsed.data.scope==='followed' ? db.from('user_tracked_companies').select('company_id').eq('user_id',user.id).limit(1) : Promise.resolve({data:[],error:null}),
   ]);
   if (profile.error || companies.error) throw new Error('Could not check preferences');
   if (!profile.data?.search_intent?.targetRoles?.some((role: string) => role.trim()) || (parsed.data.scope==='followed' && !companies.data?.length)) return response(422,'setup','Save a target role; followed-company alerts also require a followed company');
  }
  const saved = await db.from('job_alert_preferences').upsert({ user_id:user.id, ...parsed.data, last_completed_check_at:null, last_outcome:null, token:randomUUID(), revision:randomUUID(), consent_at:parsed.data.enabled ? new Date().toISOString() : null }, { onConflict:'user_id' }).select(selection).maybeSingle();
  if (saved.error) throw saved.error;
  return { statusCode:200, body:JSON.stringify({...parsed.data,...health(saved.data,parsed.data.scope)}) };
 } catch { return response(503,'unavailable','Could not save alert preferences'); }
};
