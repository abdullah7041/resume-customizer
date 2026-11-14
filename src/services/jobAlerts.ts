import { supabase } from '@/services/supabase';
export interface JobAlertPreferences { enabled:boolean; language:'ar'|'en' }
async function request(enabled?:boolean, language?:string):Promise<JobAlertPreferences> {
 const {data}=await supabase.auth.getSession();
 if (!data.session) throw new Error('Sign in to manage job alerts');
 const response=await fetch('/.netlify/functions/job-alert-preferences',{
  method:enabled===undefined?'GET':'POST',
  headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},
  body:enabled===undefined?undefined:JSON.stringify({enabled,language:language==='ar'?'ar':'en'}),
 });
 const result=await response.json();
 if (!response.ok) throw new Error(result.message ?? 'Could not save alerts');
 return result;
}
export const readJobAlerts=()=>request();
export const updateJobAlerts=(enabled:boolean,language:string)=>request(enabled,language);
