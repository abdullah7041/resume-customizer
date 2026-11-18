import type { Handler } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { getSupabaseClient } from '../lib/supabase-client.js';
export const handler: Handler = async event => {
 const headers = { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer', 'Content-Security-Policy':"default-src 'none'; form-action 'self'; frame-ancestors 'none'" };
 const reply = (statusCode: number, body: string) => ({ statusCode,headers,body });
 if (!['GET','POST'].includes(event.httpMethod)) return reply(405,'Method not allowed');
 const token=event.queryStringParameters?.token ?? '';
 if (!/^[0-9a-f-]{36}$/i.test(token)) return reply(400,'Invalid link / رابط غير صالح');
 if (event.httpMethod==='GET') return reply(200,`<!doctype html><meta charset="utf-8"><title>Watheq alerts</title><form method="post"><p>Stop job alerts? / إيقاف تنبيهات الوظائف؟</p><button type="submit">Unsubscribe / إلغاء الاشتراك</button></form>`);
 try {
  const db=getSupabaseClient(); if (!db) throw new Error('Unavailable');
  const result=await db.from('job_alert_preferences').update({enabled:false,revision:randomUUID(),token:randomUUID()}).eq('token',token);
  if (result.error) throw result.error;
  return reply(200,'Job alerts disabled. / تم إيقاف تنبيهات الوظائف.');
 } catch { return reply(503,'Please try again / يرجى المحاولة مجددًا'); }
};
