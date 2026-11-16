import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { readJobAlerts, updateJobAlerts } from '@/services/jobAlerts';
import type { JobAlertPreferences, JobAlertScope } from '@/types/jobAlerts';

export function JobAlertSettings({persistIntent}:{persistIntent:()=>Promise<void>}) {
 const {t,i18n}=useTranslation(); const id=useId();
 const [preferences,setPreferences]=useState<JobAlertPreferences|null>(null);
 const [scope,setScope]=useState<JobAlertScope>('followed');
 const [busy,setBusy]=useState(true); const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  void readJobAlerts().then(result=>{if(active){setPreferences(result);setScope(result.scope);}}).catch(()=>{if(active)setError('load');}).finally(()=>{if(active)setBusy(false);});
  return ()=>{active=false;};
 },[]);
 async function refresh() {
  setBusy(true);setError('');
  try {const result=await readJobAlerts();setPreferences(result);setScope(result.scope);} catch {setError('load');}
  finally {setBusy(false);}
 }
 async function save(enabled:boolean,nextScope=scope) {
  setBusy(true);setError('');
  try {
   if(enabled) await persistIntent();
   const result=await updateJobAlerts(enabled,i18n.language,nextScope);setPreferences(result);setScope(result.scope);
  } catch {setError('save');}
  finally {setBusy(false);}
 }
 function changeScope(next:JobAlertScope) {
  if(preferences?.enabled) void save(true,next); else setScope(next);
 }
 let status=t('jobFeed.alerts.off','Alerts are off.');
 if(busy) status=preferences ? t('jobFeed.alerts.saving','Saving or refreshing alert settings…') : t('jobFeed.alerts.loading','Loading alert settings…');
 else if(preferences?.enabled) {
  if(!preferences.serviceAvailable) status=t('jobFeed.alerts.paused','Sending is paused. Your preference is saved; emails will resume when the service is available.');
  else if(preferences.lastOutcome==='failed') status=t('jobFeed.alerts.failed','The last check failed or had incomplete source coverage. Refresh the status later.');
  else if(preferences.lastCheckedAt && Date.now()-Date.parse(preferences.lastCheckedAt)>2*3600000) status=t('jobFeed.alerts.delayed','Checks are delayed. Refresh the status later; your preference is saved.');
  else if(preferences.lastOutcome==='setup_required') status=t('jobFeed.alerts.setup','Save a target role and verify your email. Follow a company for followed-company alerts.');
  else if(preferences.lastOutcome==='empty') status=t('jobFeed.alerts.empty','Last check completed: no new qualifying jobs.');
  else status=t('jobFeed.alerts.enabled','Alerts are enabled. Waiting for the next hourly check.');
 }
 const formatDate=(value:string)=>new Date(value).toLocaleString(i18n.language);
 return <fieldset className="rounded-lg border border-line p-4 text-ink" aria-busy={busy}>
  <label htmlFor={id} className="flex items-center gap-3"><input id={id} type="checkbox" checked={preferences?.enabled ?? false} disabled={busy || !preferences} onChange={event=>void save(event.target.checked)} aria-describedby={`${id}-hint`}/>{t('jobFeed.alerts.label','Free hourly job emails')}</label>
  <p id={`${id}-hint`} className="mt-2 text-sm text-ink-muted">{t('jobFeed.alerts.hint','Only jobs with a verified publication time in the past 24 hours matching your saved search. No credits used. Unsubscribe anytime.')}</p>
  {(import.meta.env.VITE_JOB_CATALOGUE_ENABLED==='true' || preferences?.scope==='catalogue') && <fieldset disabled={busy || !preferences} className="mt-3 flex flex-wrap gap-3 text-sm">
   <legend>{t('jobFeed.alerts.scopeLabel','Send alerts from')}</legend>
   <label className="flex items-center gap-2"><input type="radio" name={`${id}-scope`} checked={scope==='followed'} onChange={()=>changeScope('followed')}/>{t('jobFeed.alerts.followed','Companies I follow')}</label>
   <label className="flex items-center gap-2"><input type="radio" name={`${id}-scope`} checked={scope==='catalogue'} onChange={()=>changeScope('catalogue')}/>{t('jobFeed.alerts.catalogue','Saudi employer catalogue')}</label>
  </fieldset>}
  <p role="status" className="mt-2 text-sm">{status}</p>
  {preferences?.lastCheckedAt && <p className="mt-1 text-xs text-ink-muted">{t('jobFeed.alerts.lastChecked','Last completed check: {{when}}',{when:formatDate(preferences.lastCheckedAt)})}</p>}
  {preferences?.lastProviderAcceptedAt && <p className="mt-1 text-xs text-ink-muted">{t('jobFeed.alerts.lastAccepted','Last email accepted by provider: {{when}}. Inbox delivery is not confirmed.',{when:formatDate(preferences.lastProviderAcceptedAt)})}</p>}
  {error && <p role="alert" className="mt-2 text-sm">{error==='load' ? t('jobFeed.alerts.loadError','Could not load alerts. Sign in or try again.') : t('jobFeed.alerts.saveError','Could not save. Verify your email and save a target role. Follow a company if using followed-company alerts, then try again.')}</p>}
  <button type="button" className="mt-2 text-sm underline" disabled={busy} onClick={()=>void refresh()}>{t('jobFeed.alerts.refresh','Refresh status')}</button>
  {preferences?.enabled && preferences.lastOutcome==='setup_required' && <button type="button" className="ms-3 mt-2 text-sm underline" disabled={busy} onClick={()=>void save(true)}>{t('jobFeed.alerts.retrySetup','Save search and retry')}</button>}
 </fieldset>;
}
