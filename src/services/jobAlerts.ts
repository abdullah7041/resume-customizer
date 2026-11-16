import { supabase } from '@/services/supabase';
import { assertPrivateSession, getPrivateSessionRevision } from '@/lib/auth/privateSession';
import type { JobAlertPreferences, JobAlertScope } from '@/types/jobAlerts';
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
