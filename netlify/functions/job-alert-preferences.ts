import type { Handler } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase-client.js';
const schema = z.object({ enabled: z.boolean(), language: z.enum(['ar', 'en']) });
const response = (status: number, code: string, message: string) => ({ statusCode: status, body: JSON.stringify({ status, code, message }) });
export const handler: Handler = async event => {
 try {
  if (!['GET','POST'].includes(event.httpMethod)) return response(405,'method','Method not allowed');
  const db = getSupabaseClient(); if (!db) return response(503,'unavailable','Service unavailable');
  const token = (event.headers.authorization ?? event.headers.Authorization ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return response(401,'auth','Sign in to manage alerts');
  if (event.httpMethod === 'GET') {
   const result = await db.from('job_alert_preferences').select('enabled,language').eq('user_id', user.id).maybeSingle();
   if (result.error) throw result.error;
   return { statusCode: 200, body: JSON.stringify({ enabled: result.data?.enabled ?? false, language: result.data?.language ?? 'en' }) };
  }
  let body: unknown; try { body=JSON.parse(event.body ?? '{}'); } catch { return response(400,'invalid','Invalid request'); }
  const parsed = schema.safeParse(body); if (!parsed.success) return response(400,'invalid','Invalid request');
  if (parsed.data.enabled) {
   if (!user.email || !user.email_confirmed_at) return response(403,'verify_email','Verify your email before enabling alerts');
   const [profile, companies] = await Promise.all([
    db.from('user_profiles').select('search_intent').eq('email',user.email).maybeSingle(),
    db.from('user_tracked_companies').select('company_id').eq('user_id',user.id).limit(1),
   ]);
   if (profile.error || companies.error) throw new Error('Could not check preferences');
   if (!profile.data?.search_intent?.targetRoles?.some((role: string) => role.trim()) || !companies.data?.length) return response(422,'setup','Save a target role and follow a company first');
  }
  const saved = await db.from('job_alert_preferences').upsert({ user_id:user.id, ...parsed.data, token:randomUUID(), revision:randomUUID(), consent_at:parsed.data.enabled ? new Date().toISOString() : null }, { onConflict:'user_id' });
  if (saved.error) throw saved.error;
  return { statusCode:200, body:JSON.stringify(parsed.data) };
 } catch { return response(503,'unavailable','Could not save alert preferences'); }
};
