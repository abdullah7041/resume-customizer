import { reportUserOutcome } from '@/lib/utils/userOutcome';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, Building2, Check, CheckCircle2, ChevronRight, ExternalLink, FileText, LoaderCircle, MapPin, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import JobFeedSection from '@/components/sections/JobFeedSection';
import { CompanyLookup } from '@/components/sections/CompanyLookup';
import { JobAlertSettings } from '@/components/sections/JobAlertSettings';
import { searchJobs, type JobSearchPage } from '@/services/jobSearch';
import { getPostingDescription, fetchServerSearchIntent, listFeedState, saveSearchIntent, setFeedState, trackCompany, verifyFeedPosting } from '@/services/jobFeed';
import { createJobApplication } from '@/services/pipeline';
import { getPrivateSessionRevision } from '@/lib/auth/privateSession';
import { useResumeLibraryStore } from '@/lib/resumeLibrary';
import { useSearchIntent, useResumeStore } from '@/lib/stores/resumeStore';
import { postingAge } from '@/lib/jobs/age';
import type { FeedPosting } from '@/lib/jobs/types';
import type { MatchResult } from '@/types/analysis';

const Applications = lazy(() => import('@/components/sections/PipelineSection').then(module => ({ default: module.PipelineSection })));
type Notice = { type: 'success' | 'info' | 'danger'; title: string };
type Props = {
  onMatchPosting?: (input: { jobDescription: string; companyName: string; jobTitle: string; match?: MatchResult }) => void;
  onToast?: (notice: Notice) => void;
};
type CheckResult = { status: 'checking' | 'ready' | 'failed'; match?: MatchResult; jobFingerprint?: string; failureCode?: string };
const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const primaryClass = `${buttonClass} bg-emerald-700 text-white hover:bg-emerald-800`;
const outlineClass = `${buttonClass} border border-emerald-700/35 bg-surface text-ink hover:bg-emerald-500/10`;

export default function JobsFirstSection(props: Props) {
  return import.meta.env.VITE_JOB_CATALOGUE_ENABLED === 'true' ? <CatalogueFeed {...props} /> : <JobFeedSection onMatchPosting={props.onMatchPosting} />;
}

function CatalogueFeed({ onMatchPosting, onToast }: Props) {
  const { i18n } = useTranslation();
  const ar = i18n.language.startsWith('ar');
  const text = useCallback((en: string, arabic: string) => ar ? arabic : en, [ar]);
  const [tab, setTab] = useState<'jobs' | 'companies' | 'applications'>('jobs');
  const intent = useSearchIntent();
  const entries = useResumeLibraryStore(state => state.entries);
  const activeId = useResumeLibraryStore(state => state.activeResumeId);
  const resume = entries.find(entry => entry.id === activeId);
  const [roles, setRoles] = useState(intent?.targetRoles.join(', ') ?? '');
  const [location, setLocation] = useState(intent?.locations?.[0] ?? '');
  const editedSearch = useRef(false);
  const searchRequested = useRef(false);
  const [query, setQuery] = useState({ roles: intent?.targetRoles ?? [], locations: intent?.locations ?? [] });
  const [followedOnly, setFollowedOnly] = useState(false);
  const [age, setAge] = useState('7');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<JobSearchPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<Notice | null>(null);
  const [checks, setChecks] = useState<Record<string, CheckResult>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyCategory, setCompanyCategory] = useState('');
  const version = JSON.stringify([query, followedOnly, age, resume?.id, resume?.fingerprint, i18n.language, offset, refresh]);
  const current = useRef(version);
  current.current = version;
  const mounted = useRef(true);
  const sessionRevision = useRef(getPrivateSessionRevision());
  const checkController = useRef<AbortController | null>(null);
  const isCurrent = (key: string) => mounted.current && current.current === key && sessionRevision.current === getPrivateSessionRevision();
  const notify = useCallback((type: Notice['type'], title: string) => {
    setFeedback(type === 'danger' || onToast ? null : { type, title });
    onToast?.({ type, title });
  }, [onToast]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; checkController.current?.abort(); };
  }, []);
  useEffect(() => { checkController.current?.abort(); setChecks({}); setBatchSize(0); setBusy(null); }, [version]);
  useEffect(() => {
    if (intent?.targetRoles.length) return;
    let active = true;
    void fetchServerSearchIntent().then(savedIntent => {
      if (!active || editedSearch.current || !savedIntent) return;
      setRoles(savedIntent.targetRoles.join(', '));
      setLocation(savedIntent.locations?.[0] ?? '');
      setQuery({ roles: savedIntent.targetRoles, locations: savedIntent.locations ?? [] });
      useResumeStore.getState().setSearchIntent({ ...savedIntent, meta: { confidence: 'high', completeness: 100, updatedAt: new Date().toISOString() } });
    }).catch(() => { /* The search form remains usable when saved preferences are unavailable. */ });
    return () => { active = false; };
  }, [intent?.targetRoles.length]);
  useEffect(() => {
    let active = true;
    void listFeedState().then(state => {
      if (active) setSaved(new Set([...state].filter(([, value]) => value === 'saved').map(([id]) => id)));
    }).catch(() => { /* Application saving still checks the existing pipeline for duplicates. */ });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    setPage(previous => previous ? { ...previous, postings: [], nextOffset: null } : null);
    void searchJobs({ targetRoles: query.roles, locations: query.locations, seniority: intent?.seniority, followedOnly, offset, ...(age ? { maxAgeDays: Number(age) } : {}) }, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setPage(result);
      if (searchRequested.current) {
        searchRequested.current = false;
        notify('success', text(`${result.postings.length} jobs shown for your search`, `نعرض ${result.postings.length} وظيفة لبحثك`));
      }
    }).catch(cause => {
      if (!controller.signal.aborted && cause?.name !== 'AbortError') {
        if (cause?.status !== 401 && cause?.status !== 403) reportUserOutcome('feed_load_failed');
        setError(cause instanceof Error ? cause.message : text('Search failed. Try again.', 'تعذر البحث. حاول مجدداً.'));
        searchRequested.current = false;
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, followedOnly, age, offset, refresh, intent?.seniority, notify, text]);

  async function checkJobs(retryFailed = false) {
    if (!resume || loading) return;
    const { id, fingerprint, plainText } = resume;
    checkController.current?.abort();
    const controller = new AbortController(); checkController.current = controller;
    const key = current.current;
    const candidates = (page?.postings ?? []).filter(posting => retryFailed ? checks[posting.id]?.status === 'failed' : !checks[posting.id]).slice(0, 10);
    let next = 0; let failures = 0; let technicalFailure = false;
    setBatchSize(candidates.length);
    setChecks(previous => ({ ...previous, ...Object.fromEntries(candidates.map(posting => [posting.id, { status: 'checking' as const }])) }));
    notify('info', text(`Checking ${candidates.length} jobs against your CV`, `نفحص ${candidates.length} وظائف مقابل سيرتك`));
    async function worker() {
      while (next < candidates.length && !controller.signal.aborted) {
        const posting = candidates[next++];
        try {
          const result = await verifyFeedPosting(posting.id, [{ id, fingerprint, text: plainText }], i18n.language, controller.signal);
          if (controller.signal.aborted || !isCurrent(key)) return;
          const match = result.results[0];
          if (!match) {
            failures++;
            if (!result.failures.some(failure => ['missing_description', 'limit_reached'].includes(failure.code))) technicalFailure = true;
          }
          setChecks(previous => ({ ...previous, [posting.id]: match ? { status: 'ready', match: match.match, jobFingerprint: result.jobFingerprint } : { status: 'failed', failureCode: result.failures[0]?.code } }));
        } catch {
          if (controller.signal.aborted || !isCurrent(key)) return;
          failures++; technicalFailure = true;
          setChecks(previous => ({ ...previous, [posting.id]: { status: 'failed', failureCode: 'request_failed' } }));
        }
      }
    }
    await Promise.all([worker(), worker()]);
    if (technicalFailure && !controller.signal.aborted && isCurrent(key)) reportUserOutcome('feed_verification_failed');
    if (!controller.signal.aborted && isCurrent(key)) notify(failures ? 'info' : 'success', text(
      `${candidates.length - failures} CV checks ready${failures ? ` · ${failures} need attention` : ''}`,
      `${candidates.length - failures} فحوص جاهزة${failures ? ` · ${failures} تحتاج متابعة` : ''}`
    ));
  }

  async function act(posting: FeedPosting, action: 'save' | 'tailor') {
    if (busy) return;
    const key = current.current; setBusy(`${action}:${posting.id}`); setError('');
    try {
      const description = await getPostingDescription(posting.id).catch(() => null);
      if (!isCurrent(key)) return;
      if (action === 'tailor' && !description?.trim()) reportUserOutcome(description === undefined ? 'job_handoff_mismatch' : 'job_handoff_missing');
      if (description == null || (action === 'tailor' && !description.trim())) throw new Error(text('The job description is unavailable. Open the employer posting or try again.', 'وصف الوظيفة غير متاح. افتح إعلان صاحب العمل أو حاول مجدداً.'));
      if (action === 'tailor') {
        const check = checks[posting.id];
        let match: MatchResult | undefined;
        if (check?.jobFingerprint && globalThis.crypto?.subtle) {
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(description.trim().slice(0, 5000)));
          if (Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') === check.jobFingerprint) match = check.match;
          else reportUserOutcome('job_handoff_mismatch');
        }
        if (!isCurrent(key)) return;
        notify('success', text('Job ready for review and tailoring', 'الوظيفة جاهزة للمراجعة والتخصيص'));
        onMatchPosting?.({ jobDescription: description, companyName: posting.companyName, jobTitle: posting.title, match });
      } else {
        const result = await createJobApplication({ company_name: posting.companyName, job_title: posting.title, job_description: description, job_url: posting.applyUrl, location: posting.location, status: 'saved' }, { duplicateStrategy: 'preserve_user_fields' });
        if (!isCurrent(key)) return;
        if (result.error) throw new Error(result.error);
        setSaved(previous => new Set(previous).add(posting.id));
        await setFeedState(posting.id, 'saved');
        if (isCurrent(key)) notify('success', text('Saved to Applications', 'تم الحفظ في طلباتي'));
      }
    } catch (cause) {
      if (isCurrent(key)) { const message = cause instanceof Error ? cause.message : text('Request failed. Try again.', 'تعذر الطلب. حاول مجدداً.'); setError(message); notify('danger', message); }
    } finally { if (isCurrent(key)) setBusy(null); }
  }

  async function follow(company: JobSearchPage['companies'][number]) {
    if (busy) return;
    const key = current.current; setBusy(`follow:${company.id}`); setError('');
    try {
      const result = await trackCompany({ source: company.source, token: company.token, displayName: company.display_name });
      if (!isCurrent(key)) return;
      if (result.error || !result.data?.company?.id) throw new Error(result.error ?? text('Could not follow this company. Try again.', 'تعذرت متابعة الشركة. حاول مجدداً.'));
      setPage(previous => previous ? { ...previous, companies: previous.companies.map(entry => entry.id === company.id ? { ...entry, followed: true } : entry) } : previous);
      notify('success', text('Company followed. You can filter jobs to companies you follow.', 'تمت متابعة الشركة. يمكنك تصفية الوظائف حسب الشركات التي تتابعها.'));
    } catch (cause) {
      if (isCurrent(key)) { const message = cause instanceof Error ? cause.message : text('Could not follow this company.', 'تعذرت متابعة الشركة.'); setError(message); notify('danger', message); }
    } finally { if (isCurrent(key)) setBusy(null); }
  }

  const checking = Object.values(checks).filter(check => check.status === 'checking').length;
  const checked = Object.values(checks).filter(check => check.status !== 'checking').length;
  const canCheck = page?.postings.some(posting => !checks[posting.id]);
  const canRetry = page?.postings.some(posting => checks[posting.id]?.status === 'failed');
  const catalogue = new Map(page?.companies.map(company => [company.id, company]));
  const companyType = (category: string) => ({ startup: text('Startup', 'ناشئة'), scaleup: text('Scaleup', 'سريعة النمو'), enterprise: text('Enterprise', 'مؤسسة كبيرة'), public_sector: text('Public sector', 'قطاع حكومي') }[category] ?? '');
  const companyNeedle = companyQuery.trim().toLocaleLowerCase();
  const companies = (page?.companies ?? []).filter(company => (!companyCategory || company.company_category === companyCategory) && `${company.display_name} ${company.sector ?? ''} ${companyType(company.company_category)} ${company.token}`.toLocaleLowerCase().includes(companyNeedle));
  const arrowClass = `h-4 w-4 shrink-0 ${ar ? 'rotate-180' : ''}`;

  return <section className="jobs-workspace space-y-4 text-ink" dir={ar ? 'rtl' : 'ltr'} aria-label={text('Jobs worth your time', 'وظائف تستحق وقتك')}>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold tracking-tight">{text('Jobs worth your time', 'وظائف تستحق وقتك')}</h2><p className="mt-1 text-sm text-ink-muted">{text('Find a role. Understand your fit. Make your next move.', 'اعثر على وظيفة، وافهم توافق سيرتك، واتخذ خطوتك التالية.')}</p></div>
      <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />{text('Verified employer sources', 'مصادر أصحاب عمل موثقة')}</span>
    </header>
    <div className={`grid min-w-0 gap-4 ${tab === 'applications' ? '' : 'xl:grid-cols-[minmax(0,1fr)_250px]'}`}>
      <div className="min-w-0 space-y-4 rounded-2xl border border-line bg-surface p-3 sm:p-4">
        <nav className="flex flex-wrap gap-1 border-b border-line pb-2" aria-label={text('Jobs navigation', 'تصفح الوظائف')}>
          {([['jobs', text('For you', 'لك')], ['companies', text('Explore companies', 'استكشف الشركات')], ['applications', text('Applications', 'طلباتي')]] as const).map(([value, label]) => <button key={value} className={`${buttonClass} ${tab === value ? 'bg-emerald-700 text-white shadow-sm' : 'text-ink hover:bg-emerald-500/10'}`} aria-pressed={tab === value} onClick={() => { setTab(value); setError(''); }}>{label}</button>)}
        </nav>
        {tab === 'applications' ? <div className="space-y-4">
          <button className={outlineClass} onClick={() => setTab('jobs')}><ArrowLeft className={arrowClass} aria-hidden="true" />{text('Back to jobs', 'العودة للوظائف')}</button>
          <Suspense fallback={<p role="status">{text('Loading applications…', 'جارٍ تحميل الطلبات…')}</p>}><Applications /></Suspense>
        </div> : tab === 'companies' ? <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{text('Discover companies', 'اكتشف الشركات')}</h3><span className="text-xs text-ink-muted">{text(`${page?.companies.length ?? 0} verified employers`, `${page?.companies.length ?? 0} صاحب عمل موثق`)}</span></div>
          <label className="flex items-center gap-2 rounded-lg border border-line bg-background px-3"><Search className="h-4 w-4 text-ink-muted" aria-hidden="true" /><input aria-label={text('Search verified companies', 'ابحث في الشركات الموثقة')} className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" value={companyQuery} placeholder={text('Search companies or sectors', 'ابحث باسم الشركة أو القطاع')} onChange={event => setCompanyQuery(event.target.value)} /></label>
          <div className="flex flex-wrap gap-2" aria-label={text('Company categories', 'فئات الشركات')}>
            {['', 'startup', 'scaleup', 'enterprise', 'public_sector'].map(category => <button key={category} className={`${buttonClass} ${companyCategory === category ? 'bg-emerald-700 text-white' : 'bg-emerald-500/10 text-ink'}`} aria-pressed={companyCategory === category} onClick={() => setCompanyCategory(category)}>{category ? companyType(category) : text('All companies', 'كل الشركات')}</button>)}
          </div>
          {error && <p role="alert" className="rounded-lg border border-red-500/30 p-3 text-sm text-destructive">{error}</p>}
          {feedback && <p role="status" className="text-sm text-ink-muted">{feedback.title}</p>}
          {loading && !page?.companies.length && <p role="status">{text('Loading verified companies…', 'جارٍ تحميل الشركات الموثقة…')}</p>}
          {!loading && !error && !companies.length && <p className="text-sm text-ink-muted">{text('No verified companies match this search. Try another name or the careers-page search below.', 'لا توجد شركات موثقة بهذا البحث. جرّب اسماً آخر أو رابط التوظيف أدناه.')}</p>}
          <div className="grid gap-3 sm:grid-cols-2">{companies.map(company => <article key={company.id} className="space-y-3 rounded-xl border border-line bg-background p-4">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-lg font-bold text-white" aria-hidden="true">{company.display_name.slice(0, 1)}</span><h3 className="font-semibold">{company.display_name}</h3></div>
            <div className="flex flex-wrap gap-1.5">{companyType(company.company_category) && <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-medium">{companyType(company.company_category)}</span>}{company.sector && <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs">{company.sector}</span>}</div>
            <p className="text-xs text-ink-muted">{company.last_status === 'ok' ? text('Board checked', 'تم فحص المصدر') : text('Board needs checking', 'المصدر بحاجة للفحص')} · {company.last_fetched_at ? new Date(company.last_fetched_at).toLocaleString(ar ? 'ar-SA' : 'en-GB') : text('Not checked yet', 'لم يُفحص بعد')}</p>
            <button className={outlineClass} disabled={company.followed || busy !== null} onClick={() => void follow(company)}>{busy === `follow:${company.id}` ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : company.followed ? <Check className="h-4 w-4" aria-hidden="true" /> : null}{company.followed ? text('Following', 'تتابعها') : busy === `follow:${company.id}` ? text('Following company…', 'جارٍ متابعة الشركة…') : text('Follow company', 'تابع الشركة')}</button>
          </article>)}</div>
          <CompanyLookup onFollowed={() => setRefresh(value => value + 1)} />
        </div> : <>
          <form className="grid items-end gap-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]" onSubmit={event => {
            event.preventDefault();
            const targetRoles = roles.split(/[,،]/).map(role => role.trim()).filter(Boolean).map(role => role.slice(0, 120)).slice(0, 10);
            const locations = location.trim() ? [location.trim()] : [];
            searchRequested.current = true; setOffset(0); setQuery({ roles: targetRoles, locations });
            const next = { targetRoles, locations, seniority: intent?.seniority, meta: { confidence: 'high' as const, completeness: 100, updatedAt: new Date().toISOString() } };
            useResumeStore.getState().setSearchIntent(next);
            if (targetRoles.length) void saveSearchIntent(next).then(result => { if (result.error && mounted.current) setError(text('Search preferences could not be saved.', 'تعذر حفظ تفضيلات البحث.')); }).catch(() => { if (mounted.current) setError(text('Search preferences could not be saved.', 'تعذر حفظ تفضيلات البحث.')); });
          }}>
            <label className="min-w-0 text-xs font-semibold text-ink-muted">{text('Target roles', 'الوظائف المستهدفة')}<span className="mt-1 flex items-center gap-2 rounded-lg border border-line bg-background px-3"><Search className="h-4 w-4 shrink-0" aria-hidden="true" /><input className="min-h-11 min-w-0 flex-1 bg-transparent text-sm font-normal text-ink outline-none" maxLength={600} value={roles} placeholder={text('Role or job title', 'المسمى الوظيفي')} onChange={event => { editedSearch.current = true; setRoles(event.target.value); }} /></span></label>
            <label className="min-w-0 text-xs font-semibold text-ink-muted">{text('Location', 'الموقع')}<span className="mt-1 flex items-center gap-2 rounded-lg border border-line bg-background px-3"><MapPin className="h-4 w-4 shrink-0" aria-hidden="true" /><input className="min-h-11 min-w-0 flex-1 bg-transparent text-sm font-normal text-ink outline-none" maxLength={100} value={location} placeholder={text('Saudi Arabia', 'السعودية')} onChange={event => { editedSearch.current = true; setLocation(event.target.value); }} /></span></label>
            <button className={`${primaryClass} min-h-11`} type="submit" disabled={loading}>{loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}{text('Find jobs', 'ابحث عن وظائف')}</button>
          </form>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <button className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-lg bg-emerald-500/12 px-3 text-start" onClick={() => window.dispatchEvent(new CustomEvent('watheq:navigate-tab', { detail: { tab: 'resume' } }))}><FileText className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /><span className="max-w-56 truncate font-medium" title={resume?.name}>{resume?.name ?? text('Upload a CV to check fit', 'ارفع سيرتك لفحص التوافق')}</span><span className="shrink-0 underline">{resume ? text('Change CV', 'تغيير السيرة') : text('Upload CV', 'رفع السيرة')}</span></button>
            <label className="inline-flex min-h-10 items-center gap-2"><input className="accent-emerald-700" type="checkbox" checked={followedOnly} onChange={event => { setOffset(0); setFollowedOnly(event.target.checked); }} />{text('Followed companies only', 'الشركات المتابَعة فقط')}</label>
            <label className="inline-flex min-h-10 items-center gap-2">{text('Published within', 'تاريخ النشر')}<select className="min-h-9 rounded-md border border-line bg-background px-2 text-ink" value={age} onChange={event => { setOffset(0); setAge(event.target.value); }}>{[['1', text('24 hours', '24 ساعة')], ['7', text('7 days', '7 أيام')], ['30', text('30 days', '30 يوماً')], ['', text('Any time', 'أي وقت')]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <JobAlertSettings compact persistIntent={async () => {
            if (!query.roles.length) throw new Error(text('Set a target role first.', 'حدد وظيفة مستهدفة أولاً.'));
            const result = await saveSearchIntent({ targetRoles: query.roles, locations: query.locations, seniority: intent?.seniority, meta: { confidence: 'high', completeness: 100, updatedAt: new Date().toISOString() } });
            if (result.error) throw new Error(result.error);
          }} />
          {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-destructive">{error}</p>}
          {feedback && <p role="status" aria-live="polite" className="text-sm text-ink-muted">{feedback.title}</p>}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-background px-3 py-2" aria-live="polite">
            <button className={outlineClass} disabled={!resume || !canCheck || checking > 0 || loading} onClick={() => void checkJobs()}>{checking ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}{text('Check my matches (up to 10)', 'افحص التوافق (حتى 10)')}</button>
            <p className="text-xs font-medium" role="status">{checking > 0 ? text(`Checking your CV · ${batchSize - checking} of ${batchSize} finished`, `فحص سيرتك · اكتمل ${batchSize - checking} من ${batchSize}`) : loading ? text('Finding relevant jobs…', 'جارٍ البحث عن وظائف مناسبة…') : text(`${checked} CV checks completed`, `${checked} فحوص مكتملة`)}</p>
            {checking > 0 && <progress className="h-2 min-w-24 flex-1 accent-emerald-700" max={batchSize} value={batchSize - checking} aria-label={text('CV check progress', 'تقدم فحص السيرة')} />}
            {canRetry && <button className={`${buttonClass} underline`} disabled={checking > 0 || loading} onClick={() => void checkJobs(true)}>{text('Retry failed checks', 'أعد محاولة الفحوص المتعثرة')}</button>}
          </div>
          {!loading && !error && !page?.postings.length && <div className="rounded-xl border border-dashed border-line p-6 text-sm text-ink-muted">{text('No jobs match these filters. Try another role or a wider date range.', 'لا توجد وظائف بهذه المرشحات. جرّب وظيفة أخرى أو مدة أوسع.')}</div>}
          <div className="space-y-2">{!loading && page?.postings.map(posting => {
            const company = catalogue.get(posting.companyId);
            const check = checks[posting.id];
            const match = check?.status === 'ready' ? check.match : undefined;
            const date = postingAge(posting);
            return <article key={posting.id} className="grid gap-3 rounded-xl border border-line bg-background p-3 transition-shadow hover:shadow-sm lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.3fr)_minmax(0,1.15fr)_148px] lg:items-center lg:gap-4 sm:p-4">
              <div className="flex min-w-0 items-center gap-2.5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-700 font-bold text-white" aria-hidden="true">{posting.companyName.slice(0, 1)}</span><span className="text-sm font-semibold leading-snug">{posting.companyName}</span></div>
              <div className="min-w-0 space-y-1.5 lg:border-s lg:border-line lg:ps-4"><h3 className="font-bold leading-snug">{posting.title}</h3><p className="flex items-start gap-1 text-xs text-ink-muted"><MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />{posting.location}</p><div className="flex flex-wrap gap-1">{company && companyType(company.company_category) && <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium">{companyType(company.company_category)}</span>}{company?.sector && <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px]">{company.sector}</span>}</div><p className="text-[11px] text-ink-muted">{date.iso ? `${date.kind === 'posted' ? text('Published', 'نُشرت') : text('First seen', 'رصدناها لأول مرة')} ${new Date(date.iso).toLocaleDateString(ar ? 'ar-SA' : 'en-GB')}` : text('Publication date unavailable', 'تاريخ النشر غير متاح')}</p></div>
              <div className="min-w-0 space-y-1.5 lg:border-s lg:border-line lg:ps-4"><p role="status" className="text-xs">{check?.status === 'checking' ? <span className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><LoaderCircle className="h-3 w-3 animate-spin" aria-hidden="true" />{text('Checking against your CV…', 'جارٍ فحص التوافق مع سيرتك…')}</span> : check?.status === 'failed' ? <span className="text-amber-700 dark:text-amber-300">{check.failureCode === 'missing_description' ? text('No complete description to check', 'لا يوجد وصف كامل للفحص') : check.failureCode === 'limit_reached' ? text('Daily check limit reached', 'بلغت حد الفحص اليومي') : text('Check failed. Retry available.', 'تعذر الفحص. يمكنك المحاولة مجدداً.')}</span> : match ? <><span className={`mb-1 inline-block rounded-full px-2 py-0.5 font-semibold ${match.score >= 75 ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200' : 'bg-amber-500/15 text-amber-900 dark:text-amber-200'}`}>{match.score >= 75 ? text('Strong alignment', 'توافق قوي') : text('Review alignment', 'راجع التوافق')}</span><span className="block font-medium">{text('CV alignment', 'توافق السيرة')} · {match.score}%</span></> : <span className="rounded-full bg-ink/5 px-2 py-1 text-ink-muted">{text('Not checked against your CV', 'لم يُفحص التوافق مع سيرتك')}</span>}</p>
                {match?.summary_bullets?.[0] && <p className="text-xs leading-relaxed"><strong>{text('Evidence: ', 'الدليل: ')}</strong>{match.summary_bullets[0]}</p>}{match?.gapAnalysis?.[0] && <p className="text-xs leading-relaxed"><strong>{text('Gap: ', 'الفجوة: ')}</strong>{match.gapAnalysis[0].requirement}</p>}
              </div>
              <div className="flex flex-wrap gap-2 lg:flex-col"><button className={primaryClass} disabled={!onMatchPosting || busy !== null} onClick={() => void act(posting, 'tailor')}>{busy === `tailor:${posting.id}` ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}{busy === `tailor:${posting.id}` ? text('Preparing…', 'جارٍ التجهيز…') : text('Review & tailor', 'راجع وخصّص')}<ChevronRight className={arrowClass} aria-hidden="true" /></button><button className={outlineClass} disabled={busy !== null || saved.has(posting.id)} onClick={() => void act(posting, 'save')}>{busy === `save:${posting.id}` ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : saved.has(posting.id) ? <Check className="h-4 w-4" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}{saved.has(posting.id) ? text('Saved', 'محفوظة') : busy === `save:${posting.id}` ? text('Saving…', 'جارٍ الحفظ…') : text('Save', 'حفظ')}</button><a className="inline-flex min-h-8 items-center justify-center gap-1 text-xs text-ink-muted underline underline-offset-2" href={posting.applyUrl} target="_blank" rel="noopener noreferrer" onClick={() => notify('info', text('Employer page opened. Confirm Applied in Applications after submitting.', 'فتحنا صفحة صاحب العمل. أكد التقديم في طلباتي بعد إرساله.'))}>{text('Apply on employer site', 'قدّم في موقع صاحب العمل')}<ExternalLink className="h-3 w-3" aria-hidden="true" /></a></div>
            </article>;
          })}</div>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3"><button disabled={offset === 0 || loading} className={outlineClass} onClick={() => setOffset(Math.max(0, offset - 20))}><ArrowLeft className={arrowClass} aria-hidden="true" />{text('Previous', 'السابق')}</button><span className="text-xs text-ink-muted">{text(`Page ${Math.floor(offset / 20) + 1}`, `الصفحة ${Math.floor(offset / 20) + 1}`)}</span><button disabled={page?.nextOffset == null || loading} className={outlineClass} onClick={() => setOffset(page?.nextOffset ?? 0)}>{text('Next', 'التالي')}<ArrowRight className={arrowClass} aria-hidden="true" /></button></div>
        </>}
      </div>
      {tab !== 'applications' && <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
        <section className="rounded-xl border border-line bg-surface p-4"><h3 className="font-bold">{text('Your next step', 'خطوتك التالية')}</h3><ol className="mt-4 space-y-4 border-s border-emerald-700/30 ps-4">{[[text('Review match', 'راجع التوافق'), text('See how the role fits your experience and skills.', 'افهم مدى توافق الوظيفة مع خبراتك ومهاراتك.')], [text('Tailor CV', 'خصّص سيرتك'), text('Update your CV for the role using supported facts.', 'حدّث سيرتك للوظيفة باستخدام الحقائق الموثقة.')], [text('Apply on employer site', 'قدّم لدى صاحب العمل'), text('Submit your application on the employer’s own website.', 'أرسل طلبك من موقع صاحب العمل نفسه.')], [text('Track here', 'تابع طلبك هنا'), text('Save your application and confirm when you have applied.', 'احفظ الطلب وأكد تقديمه عند إرساله.')]].map(([title, hint], index) => <li className="relative text-xs" key={title}><span className={`absolute -start-[21px] top-0.5 h-2.5 w-2.5 rounded-full border border-emerald-700 ${index === 0 ? 'bg-emerald-700' : 'bg-surface'}`} aria-hidden="true" /><p className="font-bold">{title}</p><p className="mt-1 leading-relaxed text-ink-muted">{hint}</p></li>)}</ol></section>
        <section className="rounded-xl border border-line bg-surface p-4"><h3 className="font-bold">{text('Discover companies', 'اكتشف الشركات')}</h3><p className="mt-1 text-xs leading-relaxed text-ink-muted">{text('Find verified employers across sectors. Following is optional.', 'اكتشف أصحاب عمل موثقين في قطاعات متعددة. المتابعة اختيارية.')}</p><div className="my-4 flex flex-wrap gap-1.5">{['startup', 'enterprise', 'public_sector'].map(category => <button key={category} className="min-h-9 rounded-lg bg-emerald-500/12 px-2.5 text-xs font-semibold hover:bg-emerald-500/20" onClick={() => { setCompanyCategory(category); setCompanyQuery(''); setTab('companies'); }}>{companyType(category)}</button>)}</div><button className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-emerald-800 underline underline-offset-4 dark:text-emerald-300" onClick={() => { setCompanyCategory(''); setTab('companies'); }}><Building2 className="h-4 w-4" aria-hidden="true" />{text('Explore verified employers', 'استكشف أصحاب العمل')}<ChevronRight className={arrowClass} aria-hidden="true" /></button></section>
      </aside>}
    </div>
  </section>;
}
