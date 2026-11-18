import { useId, useState, type FormEvent } from 'react';
import { LoaderCircle, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resolveCompany, trackCompany, type ResolutionReport } from '@/services/jobFeed';

export function CompanyLookup({ onFollowed }: { onFollowed?: () => void }) {
  const { i18n } = useTranslation();
  const queryId = useId();
  const ar = i18n.language.startsWith('ar');
  const text = (en: string, arabic: string) => ar ? arabic : en;
  const [query, setQuery] = useState('');
  const [report, setReport] = useState<ResolutionReport | null>(null);
  const [busy, setBusy] = useState<'search' | 'follow' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const describe = (cause: unknown) => cause instanceof Error ? cause.message : text('Could not reach this company. Try its official careers URL.', 'تعذر الوصول للشركة. جرّب رابط التوظيف الرسمي.');

  async function search(event: FormEvent) {
    event.preventDefault();
    if (busy || query.trim().length < 2) return;
    setBusy('search'); setReport(null); setMessage(''); setError('');
    try {
      const result = await resolveCompany(query.trim());
      if (result.error) throw new Error(result.error);
      setReport(result.data);
      if (!result.data?.candidates.length) setMessage(text(
        'No supported board was verified. Try the official careers page URL, or paste a job description to tailor your CV.',
        'لم نتمكن من التحقق من مصدر مدعوم. جرّب رابط صفحة التوظيف الرسمية أو الصق وصف الوظيفة لتخصيص سيرتك.'
      ));
      else setMessage(text('Verified career sources found. Choose one to follow.', 'وجدنا مصادر توظيف موثقة. اختر مصدراً لمتابعته.'));
    } catch (cause) { setError(describe(cause)); }
    finally { setBusy(null); }
  }

  async function follow(candidate: ResolutionReport['candidates'][number]) {
    if (busy) return;
    setBusy('follow'); setError(''); setMessage('');
    try {
      const displayName = (/^https:\/\//i.test(query) ? new URL(query).hostname : query).trim().slice(0, 200);
      const result = await trackCompany({ ...candidate, displayName });
      if (result.error || !result.data?.company?.id) throw new Error(result.error ?? text('The company could not be followed. Try again.', 'تعذرت متابعة الشركة. حاول مجدداً.'));
      setReport(null);
      setMessage(result.data.crawlDispatched
        ? text('Company followed. Board check requested.', 'تمت متابعة الشركة وطلب فحص مصدرها.')
        : text('Company followed. New jobs will appear after its next successful check.', 'تمت متابعة الشركة. ستظهر الوظائف بعد فحص المصدر بنجاح.'));
      onFollowed?.();
    } catch (cause) { setError(describe(cause)); }
    finally { setBusy(null); }
  }

  return <form className="space-y-3 rounded-xl border border-line bg-surface p-4 text-ink" onSubmit={event => void search(event)} aria-busy={busy !== null}>
    <label htmlFor={queryId} className="block text-sm font-semibold">
      {text('Find another company', 'ابحث عن شركة أخرى')}
    </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <input id={queryId} className="min-w-0 flex-1 rounded-lg border border-line bg-background px-3 py-2.5 font-normal" disabled={busy !== null} value={query} maxLength={300}
          placeholder={text('Company name or official careers URL', 'اسم الشركة أو رابط التوظيف الرسمي')}
          onChange={event => { setQuery(event.target.value); setReport(null); setMessage(''); setError(''); }} />
        <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60" disabled={busy !== null || query.trim().length < 2} type="submit">
          {busy === 'search' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
          {busy === 'search' ? text('Searching…', 'جارٍ البحث…') : text('Search company', 'ابحث عن الشركة')}
        </button>
      </div>
    <p className="text-xs text-ink-muted">{text('We verify supported public career pages before following a company.', 'نتحقق من صفحات التوظيف العامة المدعومة قبل متابعة الشركة.')}</p>
    {report?.candidates.map(candidate => <button key={`${candidate.source}:${candidate.token}`} type="button" className="me-2 min-h-11 rounded-lg border border-emerald-600/40 px-4 text-sm font-semibold" disabled={busy !== null} onClick={() => void follow(candidate)}>
      {text('Follow board', 'تابع المصدر')} · {candidate.token}
    </button>)}
    <p role="status" aria-live="polite" className="text-sm">{busy === 'search' ? text('Searching verified career sources…', 'جارٍ البحث في مصادر التوظيف…') : busy === 'follow' ? text('Following company…', 'جارٍ متابعة الشركة…') : message}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}
