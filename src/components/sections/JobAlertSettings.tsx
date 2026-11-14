import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { readJobAlerts, updateJobAlerts } from '@/services/jobAlerts';
export function JobAlertSettings({persistIntent}:{persistIntent:()=>Promise<void>}) {
 const {t,i18n}=useTranslation(); const id=useId();
 const [enabled,setEnabled]=useState(false); const [busy,setBusy]=useState(true); const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  void readJobAlerts().then(result=>{if(active)setEnabled(result.enabled);}).catch(()=>{if(active)setError('load');}).finally(()=>{if(active)setBusy(false);});
  return ()=>{active=false;};
 },[]);
 async function toggle(next:boolean) {
  setBusy(true); setError('');
  try {
   if(next) await persistIntent();
   const result=await updateJobAlerts(next,i18n.language); setEnabled(result.enabled);
  } catch { setError('save'); }
  finally {setBusy(false);}
 }
 return <fieldset className="rounded-lg border border-line p-4 text-ink" aria-busy={busy}>
  <label htmlFor={id} className="flex items-center gap-3"><input id={id} type="checkbox" checked={enabled} disabled={busy} onChange={event=>void toggle(event.target.checked)} aria-describedby={`${id}-hint`}/>{t('jobFeed.alerts.label','Free hourly job emails')}</label>
  <p id={`${id}-hint`} className="mt-2 text-sm text-ink-muted">{t('jobFeed.alerts.hint','Only new jobs published within 24 hours matching your saved roles and followed companies. No credits used. Unsubscribe anytime.')}</p>
  {error && <p role="alert" className="mt-2 text-sm text-ink">{error === 'load' ? t('jobFeed.alerts.loadError','Could not load alerts. Sign in or try again.') : t('jobFeed.alerts.saveError','Could not save. Verify your email, save a target role, and follow a company; then try again.')}</p>}
 </fieldset>;
}
