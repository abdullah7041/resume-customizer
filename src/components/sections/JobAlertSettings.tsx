import { useEffect, useId, useRef, useState } from 'react';
import { Bell, ChevronRight, LoaderCircle, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { readJobAlerts, sendJobAlertTest, updateJobAlerts } from '@/services/jobAlerts';
import type { JobAlertPreferences, JobAlertScope, JobAlertTestResult } from '@/types/jobAlerts';

export function JobAlertSettings({persistIntent,compact=false}:{persistIntent:()=>Promise<void>;compact?:boolean}) {
 const {t,i18n}=useTranslation(); const id=useId();
 const [preferences,setPreferences]=useState<JobAlertPreferences|null>(null);
 const [scope,setScope]=useState<JobAlertScope>('followed');
 const [busy,setBusy]=useState(true); const [error,setError]=useState('');
 const [testBusy,setTestBusy]=useState(false);
 const [testResult,setTestResult]=useState<JobAlertTestResult|null>(null);
 const testRequest=useRef<{operationId:string;requestedAt:string}|null>(null);
 const testInFlight=useRef(false);
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
 async function sendTestEmail() {
  if(testInFlight.current) return;
  testInFlight.current=true;setTestBusy(true);
  if(!testRequest.current || testResult?.status!=='unknown') testRequest.current={operationId:crypto.randomUUID(),requestedAt:new Date().toISOString()};
  const request=testRequest.current;
  setTestResult(null);
  try { setTestResult(await sendJobAlertTest(request.operationId,request.requestedAt)); }
  catch { setTestResult({status:'unknown',operationId:request.operationId,code:'acceptance_unknown'}); }
  finally {testInFlight.current=false;setTestBusy(false);}
 }
 let status=t('jobFeed.alerts.off','Alerts are off.');
 if(busy) status=preferences ? t('jobFeed.alerts.saving','Saving or refreshing alert settings…') : t('jobFeed.alerts.loading','Loading alert settings…');
 else if(preferences?.enabled) {
  if(preferences.serviceState==='manual') status=t('jobFeed.alerts.manual','Your preference is saved. This preview does not run hourly checks. Saving does not send a test email.');
  else if(preferences.serviceState==='unconfigured') status=t('jobFeed.alerts.unconfigured','Your preference is saved. Email checks are unavailable until the service is configured.');
  else if(!preferences.serviceAvailable) status=t('jobFeed.alerts.paused','Sending is paused. Your preference is saved. Saving does not send a test email.');
  else if(preferences.lastOutcome==='failed') status=t('jobFeed.alerts.failed','The last check failed or had incomplete source coverage. Refresh the status later.');
  else if(preferences.lastCheckedAt && Date.now()-Date.parse(preferences.lastCheckedAt)>2*3600000) status=t('jobFeed.alerts.delayed','Checks are delayed. Refresh the status later; your preference is saved.');
  else if(preferences.lastOutcome==='setup_required') status=t('jobFeed.alerts.setup','Save a target role and verify your email. Follow a company for followed-company alerts.');
  else if(preferences.lastOutcome==='empty') status=t('jobFeed.alerts.empty','Last check completed: no new qualifying jobs.');
  else if(preferences.lastOutcome==='accepted') status=t('jobFeed.alerts.accepted','Last check completed: email accepted by the provider. Inbox delivery is not confirmed.');
  else status=t('jobFeed.alerts.enabled','Your preference is saved. Hourly checks are configured; no completed check is recorded yet. Saving does not send a test email.');
 }
 const formatDate=(value:string)=>new Date(value).toLocaleString(i18n.language);
 const text=(en:string,ar:string)=>i18n.language.startsWith('ar')?ar:en;
 const settings=<fieldset className={compact?'border-t border-line p-4 text-ink':'rounded-lg border border-line p-4 text-ink'} aria-busy={busy}>
  <label htmlFor={id} className="flex min-h-11 items-center gap-3"><input id={id} className="size-5 accent-current focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50" type="checkbox" checked={preferences?.enabled ?? false} disabled={busy || !preferences} onChange={event=>void save(event.target.checked)} aria-describedby={`${id}-hint ${id}-status`}/>{t('jobFeed.alerts.label','Free hourly job emails')}</label>
  <p id={`${id}-hint`} className="mt-2 text-sm text-ink-muted">{t('jobFeed.alerts.hint','Only jobs with a verified publication time in the past 24 hours matching your saved search. No credits used. Unsubscribe anytime.')}</p>
  {(import.meta.env.VITE_JOB_CATALOGUE_ENABLED==='true' || preferences?.scope==='catalogue') && <fieldset disabled={busy || !preferences} className="mt-3 flex flex-wrap gap-3 text-sm">
   <legend>{t('jobFeed.alerts.scopeLabel','Send alerts from')}</legend>
   <label className="flex items-center gap-2"><input type="radio" name={`${id}-scope`} checked={scope==='followed'} onChange={()=>changeScope('followed')}/>{t('jobFeed.alerts.followed','Companies I follow')}</label>
   <label className="flex items-center gap-2"><input type="radio" name={`${id}-scope`} checked={scope==='catalogue'} onChange={()=>changeScope('catalogue')}/>{t('jobFeed.alerts.catalogue','Saudi employer catalogue')}</label>
  </fieldset>}
  <p id={`${id}-status`} role="status" className="mt-2 text-sm">{status}</p>
  {preferences?.lastCheckedAt && <p className="mt-1 text-xs text-ink-muted">{t('jobFeed.alerts.lastChecked','Last completed check: {{when}}',{when:formatDate(preferences.lastCheckedAt)})}</p>}
  {preferences?.lastProviderAcceptedAt && <p className="mt-1 text-xs text-ink-muted">{t('jobFeed.alerts.lastAccepted','Last email accepted by provider: {{when}}. Inbox delivery is not confirmed.',{when:formatDate(preferences.lastProviderAcceptedAt)})}</p>}
  {error && <p role="alert" className="mt-2 text-sm">{error==='load' ? t('jobFeed.alerts.loadError','Could not load alerts. Sign in or try again.') : t('jobFeed.alerts.saveError','Could not save. Verify your email and save a target role. Follow a company if using followed-company alerts, then try again.')}</p>}
  <button type="button" className="mt-2 text-sm underline" disabled={busy} onClick={()=>void refresh()}>{t('jobFeed.alerts.refresh','Refresh status')}</button>
  {preferences?.enabled && preferences.lastOutcome==='setup_required' && <button type="button" className="ms-3 mt-2 text-sm underline" disabled={busy} onClick={()=>void save(true)}>{t('jobFeed.alerts.retrySetup','Save search and retry')}</button>}
  <div className="mt-4 border-t border-line pt-3">
   <p className="text-xs text-ink-muted">{text('Verify email setup with an explicit test. This does not start hourly checks or change your subscription.','تحقق من إعداد البريد برسالة تجريبية. لا يبدأ هذا الفحص الدوري ولا يغيّر اشتراكك.')}</p>
   <button type="button" className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-700/30 bg-surface px-3 text-sm font-semibold disabled:opacity-50" disabled={busy || testBusy || !(preferences?.serviceAvailable || preferences?.serviceState==='manual')} onClick={()=>void sendTestEmail()}>
    {testBusy?<LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true"/>:<Mail className="h-4 w-4" aria-hidden="true"/>}
    {testBusy?text('Sending test…','جارٍ إرسال التجربة…'):testResult?.status==='unknown'?text('Retry test email','أعد محاولة رسالة التجربة'):text('Send test email','أرسل رسالة تجريبية')}
   </button>
   {testResult?.status==='accepted' && <p role="status" className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">{text('Test email accepted by the provider. Check your inbox and spam folder; inbox delivery is not confirmed.','قَبِل مزود البريد الرسالة التجريبية. تحقق من الوارد والبريد غير المرغوب؛ وصولها لصندوقك غير مؤكد.')}</p>}
   {testResult?.status==='unknown' && <p role="status" className="mt-2 text-sm">{text('Acceptance could not be confirmed. Check your inbox before retrying; Retry uses the same test request.','تعذر تأكيد قبول الرسالة. تحقق من بريدك قبل إعادة المحاولة؛ نعيد استخدام الطلب التجريبي نفسه.')}</p>}
   {testResult?.status==='failed' && <p role="alert" className="mt-2 text-sm text-destructive">{testResult.code==='verify_email'?text('Verify your account email before sending a test.','أكد بريد حسابك قبل إرسال التجربة.'):testResult.code==='limit_reached'?text('Test limit reached. Try again in an hour.','بلغت حد التجارب. حاول بعد ساعة.'):testResult.code==='auth_required'?text('Sign in to send a test email.','سجّل دخولك لإرسال الرسالة التجريبية.'):testResult.code==='operation_expired'?text('This test request expired. Send a new test when ready.','انتهت صلاحية طلب التجربة. أرسل تجربة جديدة عند الاستعداد.'):text('Test email is unavailable. Check service configuration or try again later.','الرسالة التجريبية غير متاحة. تحقق من إعدادات الخدمة أو حاول لاحقاً.')}</p>}
   {testResult && <p className="mt-1 break-all text-xs text-ink-muted">{text('Test reference: ','مرجع التجربة: ')}<code dir="ltr">{testResult.operationId}</code></p>}
  </div>
 </fieldset>;
 if(!compact) return settings;
 const label=busy ? text('Loading alert settings…','جارٍ تحميل إعدادات التنبيهات…') : preferences?.enabled
  ? preferences.serviceAvailable ? text('Job alerts are on','تنبيهات الوظائف مفعلة') : text('Alert preference saved','تفضيل التنبيه محفوظ')
  : text('Job alerts are off','تنبيهات الوظائف متوقفة');
 const detail=error ? text('Settings need attention','الإعدادات تحتاج مراجعة')
  : preferences?.serviceState==='manual' ? text('Preview · manual checks only','معاينة · الفحص اليدوي فقط')
  : preferences?.enabled && !preferences.serviceAvailable ? text('Sending paused','الإرسال متوقف مؤقتاً')
  : preferences?.lastOutcome==='empty' ? text('Checked · no new matches','تم الفحص · لا توجد نتائج جديدة')
  : preferences?.lastOutcome==='accepted' ? text('Email accepted by provider','قَبِل المزود رسالة البريد')
  : preferences?.lastOutcome==='failed' ? text('Last check failed','تعذر الفحص الأخير')
  : preferences?.enabled ? text('Awaiting first completed check','بانتظار أول فحص مكتمل') : text('Free · no credits used','مجانية · دون استخدام الرصيد');
 return <details className="group overflow-hidden rounded-lg border border-emerald-700/15 bg-emerald-500/10 text-ink">
  <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm focus-visible:outline-2 [&::-webkit-details-marker]:hidden">
   <span className="inline-flex items-center gap-2 font-semibold"><Bell className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true"/>{label}</span>
   <span className="order-last basis-full text-xs text-ink-muted sm:order-none sm:min-w-0 sm:flex-1 sm:basis-0" title={status}>{detail}</span>
   <span className="ms-auto inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">{text('Manage alerts','إدارة التنبيهات')}<ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90 rtl:rotate-180" aria-hidden="true"/></span>
  </summary>
  {settings}
 </details>;
}
