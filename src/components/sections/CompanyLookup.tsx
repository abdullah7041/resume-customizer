import { useEffect, useId, useState, type FormEvent } from 'react';
import { LoaderCircle, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getPrivateSessionRevision } from '@/lib/auth/privateSession';
import { normalizeText } from '@/lib/jobs/normalize';
import type { CatalogueCompany } from '@/services/jobSearch';
import { listCoverageRequests, requestCompanyCoverage, resolveCompany, trackCompany, type CoverageRequest, type ResolutionReport } from '@/services/jobFeed';

interface Props {
  onFollowed?: () => void;
  onQueryChange?: (query: string) => void;
  directory?: CatalogueCompany[];
}

export function CompanyLookup({ onFollowed, onQueryChange, directory = [] }: Props) {
  const { i18n } = useTranslation();
  const queryId = useId();
  const text = (en: string, arabic: string) => i18n.language.startsWith('ar') ? arabic : en;
  const [query, setQuery] = useState('');
  const [report, setReport] = useState<ResolutionReport | null>(null);
  const [requests, setRequests] = useState<CoverageRequest[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [listFailed, setListFailed] = useState(false);
  const [busy, setBusy] = useState<'search' | 'follow' | 'save' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const revision = getPrivateSessionRevision();
  const current = () => revision === getPrivateSessionRevision();
  const failure = (cause: unknown) => cause instanceof Error ? cause.message : text('Request failed. Please try again.', 'تعذر الطلب. حاول مجدداً.');
  useEffect(() => {
    let active = true;
    setListFailed(false);
    void listCoverageRequests().then(result => {
      if (!active || revision !== getPrivateSessionRevision()) return;
      if (result.error) setListFailed(true);
      else setRequests(result.data?.requests ?? []);
    }).catch(() => { if (active && revision === getPrivateSessionRevision()) setListFailed(true); });
    return () => { active = false; };
  }, [refresh, revision]);

  function edit(value: string) {
    setQuery(value); onQueryChange?.(value); setReport(null); setMessage(''); setError('');
  }

  async function search(value: string, event?: FormEvent) {
    event?.preventDefault();
    if (busy || value.trim().length < 2) return;
    edit(value);
    if (directory.some(company => [company.display_name, company.token].some(name => normalizeText(name) === normalizeText(value)))) {
      setMessage(text('This employer is listed in the directory below.', 'ستجد هذه الشركة في الدليل أدناه.'));
      return;
    }
    setBusy('search');
    try {
      const result = await resolveCompany(value.trim());
      if (!current()) return;
      if (result.error || !result.data) throw new Error(result.error || text('Search unavailable.', 'البحث غير متاح.'));
      if (result.data.candidates.length > 1 && !/^https:\/\//i.test(value)) {
        setMessage(text('Several employers may use this name. Enter the company’s official careers URL to identify its board.', 'قد تستخدم عدة شركات هذا الاسم. أدخل رابط التوظيف الرسمي لتحديد المصدر الصحيح.'));
        return;
      }
      setReport(result.data);
      setMessage(result.data.candidates.length
        ? text('Choose the employer’s board to follow its jobs.', 'اختر صفحة صاحب العمل لمتابعة وظائفه.')
        : result.data.coverageUrl
          ? text('We couldn’t verify a jobs feed at this URL. If this is the employer’s official careers page, save it to request coverage.', 'تعذر التحقق من مصدر وظائف على هذا الرابط. إذا كانت هذه صفحة التوظيف الرسمية، فاحفظها لطلب التغطية.')
          : text('No supported board found. Enter the employer’s official HTTPS careers URL.', 'لم نجد مصدراً مدعوماً. أدخل رابط التوظيف الرسمي للشركة بصيغة HTTPS.'));
    } catch (cause) {
      if (current()) {
        setError(failure(cause));
        // The board probe can time out independently of saving a candidate-supplied page.
        if (/^https:\/\//i.test(value.trim())) {
          setReport({ candidates: [], unreliable: [], exhausted: false, fallback: null, coverageUrl: value.trim() });
          setMessage(text('If this is the employer’s official careers page, you can still request coverage.', 'إذا كانت هذه صفحة التوظيف الرسمية، فلا يزال بإمكانك طلب التغطية.'));
        }
      }
    }
    finally { if (current()) setBusy(null); }
  }

  async function save(url: string) {
    if (busy) return;
    setBusy('save'); setError('');
    try {
      const result = await requestCompanyCoverage(url);
      if (!current()) return;
      if (result.error || !result.data) throw new Error(result.error || text('Could not save this page.', 'تعذر حفظ الصفحة.'));
      const saved = result.data.careersUrl;
      setRequests(rows => rows.some(row => row.careers_url === saved) ? rows : [{ careers_url: saved, company: null }, ...rows]);
      setRefresh(value => value + 1); setReport(null);
      setMessage(text('Careers page saved. Coverage requested.', 'حُفظت صفحة التوظيف وأُرسل طلب التغطية.'));
    } catch (cause) { if (current()) setError(failure(cause)); }
    finally { if (current()) setBusy(null); }
  }

  async function follow(source: string, token: string, displayName: string, coverageRequestUrl?: string) {
    if (busy) return;
    setBusy('follow'); setError(''); setMessage('');
    try {
      const result = await trackCompany({ source, token, displayName: displayName.slice(0, 120), coverageRequestUrl });
      if (!current()) return;
      if (result.error || !result.data?.company?.id) throw new Error(result.error || text('Could not follow this company.', 'تعذرت متابعة الشركة.'));
      setReport(null); setRefresh(value => value + 1);
      setMessage(result.data.crawlDispatched
        ? text('Company followed. Board check requested.', 'تمت متابعة الشركة وطلب فحص مصدرها.')
        : text('Company followed. Jobs will appear after its next successful check.', 'تمت متابعة الشركة. ستظهر الوظائف بعد فحص المصدر بنجاح.'));
      onFollowed?.();
    } catch (cause) { if (current()) setError(failure(cause)); }
    finally { if (current()) setBusy(null); }
  }

  const button = 'min-h-11 rounded-lg border border-line px-3 text-sm font-semibold disabled:opacity-60';
  return <section className="space-y-3 text-ink">
    <form className="space-y-2" onSubmit={event => void search(query, event)} aria-busy={busy !== null}>
      <label htmlFor={queryId} className="text-sm font-semibold">{text('Search companies', 'ابحث عن شركة')}</label>
      <div className="flex flex-wrap gap-2">
        <input id={queryId} className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-background px-3" disabled={busy !== null} value={query} maxLength={2048}
          placeholder={text('Company name or official careers URL', 'اسم الشركة أو رابط التوظيف الرسمي')} onChange={event => edit(event.target.value)} />
        <button className={button} disabled={busy !== null || query.trim().length < 2}>
          {busy === 'search' ? <LoaderCircle aria-hidden="true" className="me-2 inline h-4 w-4 animate-spin" /> : <Search aria-hidden="true" className="me-2 inline h-4 w-4" />}
          {text('Search company', 'ابحث عن الشركة')}
        </button>
      </div>
    </form>
    <p role="status" aria-live="polite" className="text-sm">{busy === 'search' ? text('Searching career sources…', 'جارٍ البحث في مصادر التوظيف…') : message}</p>
    {report?.candidates.map(candidate => <button key={candidate.source + candidate.token} className={button} disabled={!!busy}
      onClick={() => void follow(candidate.source, candidate.token, /^https?:\/\//i.test(query) ? new URL(query).hostname : query, requests.find(row => row.careers_url === query)?.careers_url)}>
      {text('Follow jobs', 'تابع الوظائف')} · {candidate.source} · {candidate.token}
    </button>)}
    {report?.coverageUrl && !requests.some(row => row.careers_url === report.coverageUrl) && <button className={button} disabled={!!busy}
      onClick={() => void save(report.coverageUrl!)}>{text('Save company and request coverage', 'احفظ الشركة واطلب تغطيتها')}</button>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {listFailed && <button className={button} onClick={() => setRefresh(value => value + 1)}>{text('Reload saved careers pages', 'أعد تحميل صفحات التوظيف المحفوظة')}</button>}
    {requests.length > 0 && <section className="space-y-2"><h4 className="font-semibold">{text('Saved careers pages', 'صفحات التوظيف المحفوظة')}</h4>
      {requests.map(row => <div key={row.careers_url} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-3 text-sm">
        <a href={row.careers_url} className="break-all underline" target="_blank" rel="noreferrer">{row.company?.display_name ?? row.careers_url}</a>
        {row.company ? directory.some(company => company.id === row.company?.id && company.followed) ? <span>{text('Following jobs', 'تتابع الوظائف')}</span>
          : <button className={button} disabled={!!busy} onClick={() => void follow(row.company!.source, row.company!.token, row.company!.display_name, row.careers_url)}>{text('Coverage available · Follow jobs', 'التغطية متاحة · تابع الوظائف')}</button>
          : <><span>{text('Coverage requested', 'طُلبت التغطية')}</span><button className={button} disabled={!!busy} onClick={() => void search(row.careers_url)}>{text('Check coverage', 'تحقق من التغطية')}</button></>}
      </div>)}
    </section>}
  </section>;
}
