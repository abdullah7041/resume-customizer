import { supabase } from '@/services/supabase';
import { assertPrivateSession, getPrivateSessionRevision } from '@/lib/auth/privateSession';
import type { JobAlertPreferences, JobAlertScope, JobAlertTestResult } from '@/types/jobAlerts';
async function request(enabled?:boolean, language?:string, scope:JobAlertScope='followed'):Promise<JobAlertPreferences> {
 const revision=getPrivateSessionRevision();
 const {data}=await supabase.auth.getSession();
 assertPrivateSession(revision,data.session?.user?.id ?? null);
 if (!data.session) throw new Error('Sign in to manage job alerts');
 const response=await fetch('/.netlify/functions/job-alert-preferences',{
  method:enabled===undefined?'GET':'POST',
  headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},
  body:enabled===undefined?undefined:JSON.stringify({enabled,language:language==='ar'?'ar':'en',scope}),
 });
 const result=await response.json();
 assertPrivateSession(revision,data.session.user.id);
 if (!response.ok) throw new Error(result.message ?? 'Could not save alerts');
 return result;
}
export const readJobAlerts=()=>request();
export const updateJobAlerts=(enabled:boolean,language:string,scope:JobAlertScope='followed')=>request(enabled,language,scope);

/** Explicit only: a transport failure is uncertain; retry with the same operation and timestamp. */
export async function sendJobAlertTest(operationId:string,requestedAt:string):Promise<JobAlertTestResult> {
 const revision=getPrivateSessionRevision();
 const {data}=await supabase.auth.getSession();
 assertPrivateSession(revision,data.session?.user?.id ?? null);
 if(!data.session) return {status:'failed',operationId,code:'auth_required'};
 let result:JobAlertTestResult;
 try {
  const response=await fetch('/.netlify/functions/job-alert-test',{
   method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},
   body:JSON.stringify({operationId,requestedAt}),signal:AbortSignal.timeout(25_000),
  });
  const body=await response.json() as JobAlertTestResult;
  if(body.operationId!==operationId || !['accepted','unknown','failed'].includes(body.status) || (body.status==='accepted' && (!response.ok || !body.acceptedAt || !Number.isFinite(Date.parse(body.acceptedAt))))) {
   result={status:'unknown',operationId,code:'acceptance_unknown'};
  } else result=body;
 } catch {
  result={status:'unknown',operationId,code:'acceptance_unknown'};
 }
 assertPrivateSession(revision,data.session.user.id);
 return result;
}
