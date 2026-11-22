import type { Handler } from '@netlify/functions';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { checkCostBearingRateLimitForIdentifier } from '../lib/rate-limiter.js';
import { prepareJobAlertEmail, sendJobAlertEmail } from '../lib/email-service.js';
import { initSentry, captureError, flushSentry } from '../lib/sentry.js';
import type { JobAlertTestResult } from '../../src/types/jobAlerts.js';

initSentry();
const schema=z.object({operationId:z.string().uuid(),requestedAt:z.string().datetime()}).strict();
const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
const response=(statusCode:number,result:JobAlertTestResult)=>({statusCode,headers,body:JSON.stringify(result)});
// Immutable bilingual content keeps a retry's provider payload identical even after a language change.
const content={
 subject:'[TEST / تجربة] Watheq email check / اختبار بريد واثق',
 text:'This is a test email you requested from Watheq. It checks this email address only. It contains no job recommendations and does not confirm hourly checks or inbox delivery. No credits used.\n\nهذه رسالة تجريبية طلبتها من واثق للتحقق من هذا البريد فقط. لا تحتوي على ترشيحات وظائف ولا تؤكد تشغيل الفحص كل ساعة أو وصول الرسائل إلى صندوق الوارد. لم تُستخدم أي أرصدة.',
 html:'<div dir="ltr"><h1>TEST — Watheq email check</h1><p>This is a test email you requested from Watheq. It checks this email address only. It contains no job recommendations and does not confirm hourly checks or inbox delivery. No credits used.</p></div><div dir="rtl" lang="ar"><h1>تجربة — اختبار بريد واثق</h1><p>هذه رسالة تجريبية طلبتها من واثق للتحقق من هذا البريد فقط. لا تحتوي على ترشيحات وظائف ولا تؤكد تشغيل الفحص كل ساعة أو وصول الرسائل إلى صندوق الوارد. لم تُستخدم أي أرصدة.</p></div>',
};

export const handler:Handler=async event=>{
 let operationId:string=randomUUID();let stage='auth';
 const fail=(status:number,code:NonNullable<JobAlertTestResult['code']>)=>response(status,{status:'failed',operationId,code});
 try {
  if(event.httpMethod!=='POST') return fail(405,'method_not_allowed');
  let input:unknown;try {input=JSON.parse(event.body ?? '{}');}catch {return fail(400,'invalid_request');}
  const parsed=schema.safeParse(input);if(!parsed.success) return fail(400,'invalid_request');
  operationId=parsed.data.operationId;
  const token=(event.headers.authorization ?? event.headers.Authorization ?? '').replace(/^Bearer\s+/i,'');
  if(!token) return fail(401,'auth_required');
  const db=getSupabaseClient();if(!db) return fail(503,'service_unavailable');
  const {data:{user},error}=await db.auth.getUser(token);
  if(error || !user) return fail(401,'auth_required');
  if(!user.email || !user.email_confirmed_at) return fail(403,'verify_email');
  const age=Date.now()-Date.parse(parsed.data.requestedAt);
  if(age>3600000 || age < -60000) return fail(409,'operation_expired');
  if(process.env.JOB_ALERTS_ENABLED!=='true' || !process.env.RESEND_API_KEY) return fail(503,'service_unavailable');
  stage='quota';
  const quota=await checkCostBearingRateLimitForIdentifier('job-alert-test',user.id);
  if(!quota.allowed) {
   const unavailable=quota.response?.statusCode!==429;
   return response(unavailable?503:429,{status:'failed',operationId,code:unavailable?'quota_unavailable':'limit_reached',retryAfter:unavailable?60:3600});
  }
  stage='provider';
  const payload=prepareJobAlertEmail(user.email,'en',content);
  const key=createHash('sha256').update(JSON.stringify([user.id,operationId])).digest('hex');
  await sendJobAlertEmail(payload,`job-alert-test/${key}`);
  return response(200,{status:'accepted',operationId,acceptedAt:new Date().toISOString()});
 } catch {
  try {captureError(new Error('Job alert test failed'),{function:'job-alert-test',stage,operationId,status:503,code:`JOB_ALERT_TEST_${stage.toUpperCase()}_FAILED`});await flushSentry();}catch { /* Telemetry must not change the outcome. */ }
  return response(503,{status:stage==='provider'?'unknown':'failed',operationId,code:stage==='provider'?'acceptance_unknown':'service_unavailable'});
 }
};
