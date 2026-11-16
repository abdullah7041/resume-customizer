import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import JobFeedSection from '@/components/sections/JobFeedSection';
import { CompanyLookup } from '@/components/sections/CompanyLookup';
import { JobAlertSettings } from '@/components/sections/JobAlertSettings';
import { searchJobs, type JobSearchPage } from '@/services/jobSearch';
import { getPostingDescription, fetchServerSearchIntent, listFeedState, saveSearchIntent, setFeedState, trackCompany, verifyFeedPosting } from '@/services/jobFeed';
import { createJobApplication } from '@/services/pipeline';
import { useResumeLibraryStore } from '@/lib/resumeLibrary';
import { useSearchIntent, useResumeStore } from '@/lib/stores/resumeStore';
import type { FeedPosting } from '@/lib/jobs/types';
import { postingAge } from '@/lib/jobs/age';
import type { MatchResult } from '@/types/analysis';
type Props = {
    onMatchPosting?: (input: {
        jobDescription: string;
        companyName: string;
        jobTitle: string;
        match?: MatchResult;
    }) => void;
};
type Check = {
    status: 'checking' | 'ready' | 'failed';
    match?: MatchResult;
    jobFingerprint?: string;
    failureCode?: string;
};
export default function JobsFirstSection(props: Props) {
    return import.meta.env.VITE_JOB_CATALOGUE_ENABLED === 'true'
        ? <CatalogueFeed {...props}/>
        : <JobFeedSection {...props}/>;
}
function CatalogueFeed(props: Props) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const [tab, setTab] = useState<'jobs' | 'companies'>('jobs');
    const intent = useSearchIntent();
    const entries = useResumeLibraryStore(s => s.entries);
    const activeId = useResumeLibraryStore(s => s.activeResumeId);
    const resume = entries.find(e => e.id === activeId);
    const [roles, setRoles] = useState(intent?.targetRoles.join(', ') ?? '');
    const [location, setLocation] = useState(intent?.locations?.[0] ?? '');
    const editedSearch = useRef(false);
    const [query, setQuery] = useState({ roles: intent?.targetRoles ?? [], locations: intent?.locations ?? [] });
    useEffect(() => {
        if (intent?.targetRoles.length)
            return;
        let active = true;
        void fetchServerSearchIntent().then(saved => {
            if (!active || editedSearch.current || !saved)
                return;
            setRoles(saved.targetRoles.join(', '));
            setLocation(saved.locations?.[0] ?? '');
            setQuery({ roles: saved.targetRoles, locations: saved.locations ?? [] });
            useResumeStore.getState().setSearchIntent({ ...saved, meta: { confidence: 'high', completeness: 100, updatedAt: new Date().toISOString() } });
        });
        return () => { active = false; };
    }, [intent?.targetRoles.length]);
    const [followedOnly, setFollowedOnly] = useState(false);
    const [age, setAge] = useState('1');
    const [offset, setOffset] = useState(0);
    const [page, setPage] = useState<JobSearchPage | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [checks, setChecks] = useState<Record<string, Check>>({});
    const [saved, setSaved] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState<string | null>(null);
    const [batchSize, setBatchSize] = useState(0);
    const [refresh, setRefresh] = useState(0);
    const version = JSON.stringify([query, followedOnly, age, resume?.id, resume?.fingerprint, i18n.language, offset, refresh]);
    const current = useRef(version);
    current.current = version;
    const checkController = useRef<AbortController | null>(null);
    useEffect(() => () => checkController.current?.abort(), []);
    useEffect(() => { checkController.current?.abort(); setChecks({}); setBatchSize(0); setBusy(null); }, [version]);
    useEffect(() => {
        let active = true;
        void listFeedState().then(state => {
            if (active)
                setSaved(new Set([...state].filter(([, value]) => value === 'saved').map(([id]) => id)));
        });
        return () => { active = false; };
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError('');
        setPage(previous => previous ? { ...previous, postings: [], nextOffset: null } : null);
        void searchJobs({ targetRoles: query.roles, locations: query.locations, seniority: intent?.seniority, followedOnly, offset, ...(age ? { maxAgeDays: Number(age) } : {}) }, controller.signal).then(result => {
            if (!controller.signal.aborted)
                setPage(result);
        }).catch(e => {
            if (!controller.signal.aborted)
                setError(e instanceof Error ? e.message : 'Search failed');
        }).finally(() => {
            if (!controller.signal.aborted)
                setLoading(false);
        });
        return () => controller.abort();
    }, [query, followedOnly, age, offset, refresh, intent?.seniority]);
    const text = (en: string, arabic: string) => ar ? arabic : en;
    async function checkJobs(retryFailed = false) {
        if (!resume || loading)
            return;
        const { id, fingerprint, plainText } = resume;
        checkController.current?.abort();
        const controller = new AbortController();
        checkController.current = controller;
        const key = current.current;
        const candidates = (page?.postings ?? []).filter(p => retryFailed ? checks[p.id]?.status === 'failed' : !checks[p.id]).slice(0, 10);
        let next = 0;
        setBatchSize(candidates.length);
        setChecks(previous => ({ ...previous, ...Object.fromEntries(candidates.map(posting => [posting.id, { status: 'checking' as const }])) }));
        async function worker() {
            while (next < candidates.length && !controller.signal.aborted) {
                const posting = candidates[next++];
                try {
                    const result = await verifyFeedPosting(posting.id, [{ id, fingerprint, text: plainText }], i18n.language, controller.signal);
                    if (controller.signal.aborted || current.current !== key)
                        return;
                    setChecks(s => ({ ...s, [posting.id]: result.results[0] ? { status: 'ready', match: result.results[0].match, jobFingerprint: result.jobFingerprint } : { status: 'failed', failureCode: result.failures[0]?.code } }));
                } catch {
                    if (controller.signal.aborted || current.current !== key)
                        return;
                    setChecks(s => ({ ...s, [posting.id]: { status: 'failed', failureCode: 'request_failed' } }));
                }
            }
        }
        await Promise.all([worker(), worker()]);
    }
    async function act(posting: FeedPosting, action: 'save' | 'tailor') {
        const key = current.current;
        setBusy(posting.id);
        setError('');
        try {
            const description = await getPostingDescription(posting.id);
            if (current.current !== key)
                return;
            if (description === null || (action === 'tailor' && !description))
                throw new Error(text('The job description is unavailable. Open the employer posting or try again.', 'وصف الوظيفة غير متاح. افتح إعلان صاحب العمل أو حاول مجدداً.'));
            if (action === 'tailor') {
                const check = checks[posting.id];
                let match: MatchResult | undefined;
                if (check?.jobFingerprint && globalThis.crypto?.subtle) {
                    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(description.trim().slice(0, 5000)));
                    const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
                    if (fingerprint === check.jobFingerprint)
                        match = check.match;
                }
                if (current.current === key)
                    props.onMatchPosting?.({ jobDescription: description, companyName: posting.companyName, jobTitle: posting.title, match });
            }
            else {
                const result = await createJobApplication({ company_name: posting.companyName, job_title: posting.title, job_description: description, job_url: posting.applyUrl, location: posting.location, status: 'saved' }, { duplicateStrategy: 'preserve_user_fields' });
                if (result.error)
                    throw new Error(result.error);
                setSaved(s => new Set(s).add(posting.id));
                await setFeedState(posting.id, 'saved');
            }
        }
        catch (e) {
            if (current.current === key)
                setError(e instanceof Error ? e.message : 'Request failed');
        }
        finally {
            if (current.current === key)
                setBusy(null);
        }
    }
    const checking = Object.values(checks).filter(c => c.status === 'checking').length;
    const checked = Object.values(checks).filter(c => c.status !== 'checking').length;
    const catalogue = new Map(page?.companies.map(company => [company.id, company]));
    const canCheck = page?.postings.some(posting => !checks[posting.id]);
    const canRetry = page?.postings.some(posting => checks[posting.id]?.status === 'failed');
    const companyType = (category: string) => ({ startup: text('Startup', 'ناشئة'), scaleup: text('Scaleup', 'سريعة النمو'), enterprise: text('Enterprise', 'مؤسسة كبيرة'), public_sector: text('Public sector', 'قطاع حكومي') }[category] ?? text('Unclassified', 'غير مصنفة'));
    async function follow(company: JobSearchPage['companies'][number]) {
        setBusy(company.id);
        setError('');
        try {
            const result = await trackCompany({ source: company.source, token: company.token, displayName: company.display_name });
            if (result.error)
                setError(result.error);
            else
                setRefresh(value => value + 1);
        }
        finally {
            setBusy(null);
        }
    }
    return <section className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
  <nav className="flex flex-wrap gap-2" aria-label={text('Jobs navigation', 'تصفح الوظائف')}>
   <button className="min-h-11 rounded-lg px-4 text-ink bg-surface aria-pressed:bg-primary aria-pressed:text-primary-foreground" aria-pressed={tab === 'jobs'} onClick={() => setTab('jobs')}>
    {text('For you', 'لك')}
    </button>
   <button className="min-h-11 rounded-lg px-4 text-ink bg-surface aria-pressed:bg-primary aria-pressed:text-primary-foreground" aria-pressed={tab === 'companies'} onClick={() => setTab('companies')}>
    {text('Explore companies', 'استكشف الشركات')}
    </button>
   <button className="min-h-11 rounded-lg px-4 text-ink bg-surface aria-pressed:bg-primary aria-pressed:text-primary-foreground" onClick={() => window.dispatchEvent(new CustomEvent('watheq:navigate-tab', { detail: { tab: 'pipeline' } }))}>
    {text('Applications', 'طلباتي')}
    </button>
  </nav>
  {tab === 'companies' ? <>
        <div className="grid gap-3 sm:grid-cols-2">
            {page?.companies.map(company => <article className="rounded-xl border border-line bg-surface p-4 text-ink" key={company.id}>
            <h3>
            {company.display_name}
            </h3>
            <p>
            {companyType(company.company_category)} {company.sector ? `· ${company.sector}` : ''}
            </p>
            <p className="text-sm">
            {company.last_status === 'ok' ? text('Board checked', 'تم فحص المصدر') : text('Board needs checking', 'المصدر بحاجة للفحص')} · {company.last_fetched_at ? new Date(company.last_fetched_at).toLocaleString(ar ? 'ar-SA' : 'en-GB') : text('Not checked yet', 'لم يُفحص بعد')}
            </p>
            <button className="min-h-11 underline" disabled={company.followed || busy === company.id} onClick={() => void follow(company)}>
            {company.followed ? text('Following', 'تتابعها') : text('Follow company', 'تابع الشركة')}
            </button>
            </article>)}
        </div>
            {error && <p role="alert" className="text-destructive">
            {error}
            </p>}
        <CompanyLookup />
        </> : <>
   <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
                event.preventDefault();
                const targetRoles = roles.split(/[,،]/).map(role => role.trim()).filter(Boolean).map(role => role.slice(0, 120)).slice(0, 10);
                const locations = location.trim() ? [location.trim()] : [];
                setOffset(0);
                setQuery({ roles: targetRoles, locations });
                const next = { targetRoles, locations, seniority: intent?.seniority, meta: { confidence: 'high' as const, completeness: 100, updatedAt: new Date().toISOString() } };
                useResumeStore.getState().setSearchIntent(next);
                if (targetRoles.length)
                    void saveSearchIntent(next).then(result => {
                        if (result.error)
                            setError(text('Search preferences could not be saved.', 'تعذر حفظ تفضيلات البحث.'));
                    });
            }}>
    <label className="flex-1 text-ink">
        {text('Target roles', 'الوظائف المستهدفة')}
        <input className="block w-full rounded-lg border border-line bg-surface p-3" maxLength={600} value={roles} onChange={e => { editedSearch.current = true; setRoles(e.target.value); }}/>
        </label>
    <label className="text-ink">
        {text('Location', 'الموقع')}
        <input className="block rounded-lg border border-line bg-surface p-3" maxLength={100} value={location} placeholder={text('Saudi Arabia', 'السعودية')} onChange={e => { editedSearch.current = true; setLocation(e.target.value); }}/>
        </label>
    <button className="min-h-11 rounded-lg bg-emerald-700 px-5 text-white" type="submit">
        {text('Find jobs', 'ابحث عن وظائف')}
        </button>
   </form>
   <div className="flex flex-wrap items-center gap-4 text-ink">
        <span>
        {resume?.name ?? text('Upload a CV to check fit', 'ارفع سيرتك لفحص التوافق')}
        <button className="min-h-11 underline" type="button" onClick={() => window.dispatchEvent(new CustomEvent('watheq:navigate-tab', { detail: { tab: 'resume' } }))}>
        {resume ? text('Change CV', 'تغيير السيرة') : text('Upload CV', 'رفع السيرة')}
        </button>
        </span>
        <label>
        <input type="checkbox" checked={followedOnly} onChange={e => { setOffset(0); setFollowedOnly(e.target.checked); }}/> {text('Followed companies only', 'الشركات المتابَعة فقط')}
        </label>
        <label>
        {text('Published within', 'تاريخ النشر')}
        <select className="bg-surface" value={age} onChange={e => { setOffset(0); setAge(e.target.value); }}>
        <option value="1">
        {text('24 hours', '24 ساعة')}
        </option>
        <option value="7">
        {text('7 days', '7 أيام')}
        </option>
        <option value="30">
        {text('30 days', '30 يوماً')}
        </option>
        <option value="">
        {text('Any time', 'أي وقت')}
        </option>
        </select>
        </label>
        </div>
   <JobAlertSettings persistIntent={async () => {
                if (!query.roles.length)
                    throw new Error('Set a target role');
                const result = await saveSearchIntent({ targetRoles: query.roles, locations: query.locations, seniority: intent?.seniority, meta: { confidence: 'high', completeness: 100, updatedAt: new Date().toISOString() } });
                if (result.error)
                    throw new Error(result.error);
            }}/>
   {error && <p role="alert" className="text-destructive">
            {error}
            </p>}
        <div className="flex flex-wrap items-center gap-3 text-ink" role="status" aria-live="polite">
        <button className="min-h-11 rounded-lg border border-line px-4" disabled={!resume || !canCheck || checking > 0 || loading} onClick={() => void checkJobs()}>
        {text('Check my matches (up to 10)', 'افحص التوافق (حتى 10)')}
        </button>
            {canRetry && <button className="min-h-11 underline" disabled={checking > 0 || loading} onClick={() => void checkJobs(true)}>
            {text('Retry failed checks', 'أعد محاولة الفحوص المتعثرة')}
            </button>}{checking > 0 ? text(`Checking your CV · ${batchSize - checking} of ${batchSize} finished`, `فحص سيرتك · اكتمل ${batchSize - checking} من ${batchSize}`) : loading ? text('Finding relevant jobs…', 'جارٍ البحث عن وظائف مناسبة…') : text(`${checked} CV checks completed`, `${checked} فحوص مكتملة`)}
        </div>
   {!loading && !page?.postings.length && <p className="text-ink">
            {text('No jobs match these filters. Try another role or a wider date range.', 'لا توجد وظائف بهذه المرشحات. جرّب وظيفة أخرى أو مدة أوسع.')}
            </p>}
   {!loading && page?.postings.map(posting => {
                const company = catalogue.get(posting.companyId);
                const state = checks[posting.id];
                const date = postingAge(posting);
                return <article key={posting.id} className="space-y-3 rounded-xl border border-line bg-surface p-5 text-ink">
                <h3 className="text-lg font-semibold">
                {posting.title}
                </h3>
                <p>
                {posting.companyName} · {posting.location}{company && <> · {companyType(company.company_category)}{company.sector && ` · ${company.sector}`}
                    </>}
                </p>
                <p className="text-sm">
                {date.iso ? `${date.kind === 'posted' ? text('Published', 'نُشرت') : text('First seen', 'رصدناها لأول مرة')} ${new Date(date.iso).toLocaleDateString(ar ? 'ar-SA' : 'en-GB')}` : text('Publication date unavailable', 'تاريخ النشر غير متاح')}
                </p>
                <p role="status">
                {checks[posting.id]?.status === 'checking' ? text('Checking against your CV…', 'جارٍ فحص التوافق مع سيرتك…') : state?.status === 'failed' ? (state.failureCode === 'missing_description' ? text('No complete description to check', 'لا يوجد وصف كامل للفحص') : state.failureCode === 'limit_reached' ? text('Daily check limit reached', 'بلغت حد الفحص اليومي') : text('Check failed. Retry available.', 'تعذر الفحص. يمكنك المحاولة مجدداً.')) : state?.match ? `${text('CV alignment', 'توافق السيرة')} · ${state.match.score}%` : text('Not checked against your CV', 'لم يُفحص التوافق مع سيرتك')}
                </p>
                    {state?.match?.summary_bullets?.[0] && <p className="text-sm">
                    {state.match.summary_bullets[0]}
                    </p>}{state?.match?.gapAnalysis?.[0] && <p className="text-sm">
                    {text('Gap', 'فجوة')} · {state.match.gapAnalysis[0].requirement}
                    </p>}
                <div className="flex flex-wrap gap-3">
                <button className="min-h-11 rounded-lg bg-emerald-700 px-4 text-white" disabled={!props.onMatchPosting || busy !== null} onClick={() => void act(posting, 'tailor')}>
                {text('Review & tailor', 'راجع وخصّص')}
                </button>
                <button className="min-h-11 px-3" disabled={busy !== null || saved.has(posting.id)} onClick={() => void act(posting, 'save')}>
                {saved.has(posting.id) ? t('jobFeed.actions.saved', 'Saved to pipeline') : text('Save', 'حفظ')}
                </button>
                <a className="inline-flex min-h-11 items-center underline" href={posting.applyUrl} target="_blank" rel="noopener noreferrer">
                {text('Apply on employer site', 'قدّم في موقع صاحب العمل')}
                </a>
                </div>
                </article>;
            })}
        <div className="flex gap-4">
        <button disabled={offset === 0 || loading} className="min-h-11 text-ink" onClick={() => setOffset(Math.max(0, offset - 20))}>
        {text('Previous', 'السابق')}
        </button>
        <button disabled={page?.nextOffset == null || loading} className="min-h-11 text-ink" onClick={() => setOffset(page?.nextOffset ?? 0)}>
        {text('Next', 'التالي')}
        </button>
        </div>
  </>}
    </section>;
}
