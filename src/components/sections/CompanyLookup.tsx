import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveCompany, trackCompany, type ResolutionReport } from '@/services/jobFeed';
export function CompanyLookup() {
    const { i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const [query, setQuery] = useState('');
    const [report, setReport] = useState<ResolutionReport | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    return <form className="space-y-3 text-ink" onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setReport(null);
            setMessage('');
            try {
                const result = await resolveCompany(query);
                setReport(result.data);
                if (result.error)
                    setMessage(result.error);
            }
            finally {
                setBusy(false);
            }
        }}>
    <label className="block">
      {ar ? 'أضف شركة أو رابط صفحة التوظيف' : 'Add a company or careers page'}
    <input className="mt-2 w-full rounded-lg border border-line bg-surface p-3" disabled={busy} value={query} maxLength={300} onChange={event => {
            setQuery(event.target.value);
            setReport(null);
            setMessage('');
        }}/>
    </label>
    <button className="min-h-11 rounded-lg border border-line px-4" disabled={busy || query.trim().length < 2} type="submit">
    {ar ? 'ابحث عن المصدر' : 'Find board'}
    </button>
    {report?.candidates.map(candidate => <button key={`${candidate.source}:${candidate.token}`} type="button" className="min-h-11 rounded-lg border border-line px-4" disabled={busy} onClick={async () => {
                setBusy(true);
                try {
                    const result = await trackCompany({ ...candidate, displayName: query });
                    setMessage(result.error ?? (ar ? 'تمت متابعة الشركة. جارٍ إعداد فحص المصدر.' : 'Company followed. Board check requested.'));
                    if (!result.error)
                        setReport(null);
                }
                finally {
                    setBusy(false);
                }
            }}>
        {ar ? 'تابع المصدر' : 'Follow board'} · {candidate.source}
        </button>)}
    {report?.exhausted && <p>
        {ar ? 'لم نعثر على مصدر مدعوم. جرّب رابط صفحة التوظيف الرسمي.' : 'No supported board found. Try the official careers page URL.'}
        </p>}
    {message && <p role="status">
        {message}
        </p>}
    </form>;
}
