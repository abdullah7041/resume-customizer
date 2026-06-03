import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, MessageSquare, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { listFeedbackReports, updateFeedbackReport } from '@/services/feedback';
import type {
  FeedbackPriority,
  FeedbackReport,
  FeedbackStatus,
  FeedbackTrustToApply,
  FeedbackWillingnessToPay,
} from '@/types/feedback';

const STATUS_OPTIONS: FeedbackStatus[] = ['new', 'reviewing', 'resolved', 'closed'];
const PRIORITY_OPTIONS: FeedbackPriority[] = ['low', 'normal', 'high', 'urgent'];

function formatDate(value: string, language: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function previewMessage(message: string) {
  return message.length > 140 ? `${message.slice(0, 137)}...` : message;
}

function formatTrustAnswer(value: FeedbackTrustToApply | null, t: (key: string) => string) {
  return value ? t(`feedback.trustToApply.${value}`) : t('feedback.fields.noAnswer');
}

function formatPayAnswer(value: FeedbackWillingnessToPay | null, t: (key: string) => string) {
  return value ? t(`feedback.willingnessToPay.${value}`) : t('feedback.fields.noAnswer');
}

export function AdminFeedbackPage() {
  const { t, i18n } = useTranslation();
  const { user, loading } = useAuth();
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<FeedbackStatus>('new');
  const [priority, setPriority] = useState<FeedbackPriority>('normal');
  const [adminNotes, setAdminNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = user?.app_metadata?.role === 'admin';

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedId) ?? reports[0] ?? null,
    [reports, selectedId]
  );

  useEffect(() => {
    if (!selectedReport) return;
    setSelectedId(selectedReport.id);
    setStatus(selectedReport.status);
    setPriority(selectedReport.priority);
    setAdminNotes(selectedReport.admin_notes ?? '');
  }, [selectedReport]);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    async function loadReports() {
      setIsLoading(true);
      setError(null);
      try {
        const nextReports = await listFeedbackReports();
        if (!cancelled) setReports(nextReports);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('feedback.admin.errors.loadFailed'));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadReports();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, t]);

  const handleSave = async () => {
    if (!selectedReport) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateFeedbackReport({
        id: selectedReport.id,
        status,
        priority,
        adminNotes,
      });
      setReports((current) =>
        current.map((report) =>
          report.id === selectedReport.id
            ? {
                ...report,
                status: updated.status,
                priority: updated.priority,
                admin_notes: updated.admin_notes,
                updated_at: updated.updated_at,
              }
            : report
        )
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('feedback.admin.errors.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="app-shell flex min-h-[60vh] items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="app-shell py-16">
        <div className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <h1 className="text-lg font-bold">{t('feedback.admin.accessDeniedTitle')}</h1>
          </div>
          <p className="text-sm">{t('feedback.admin.accessDeniedBody')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell py-8 text-gray-950 dark:text-white" dir={i18n.dir()}>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            {t('feedback.admin.eyebrow')}
          </p>
          <h1 className="text-2xl font-black">{t('feedback.admin.title')}</h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-white/65">
          {t('feedback.admin.count', { count: reports.length })}
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white/90 shadow-sm dark:border-white/10 dark:bg-black/25">
          <div className="border-b border-gray-200 p-4 dark:border-white/10">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <MessageSquare className="h-4 w-4 text-emerald-600" />
              {t('feedback.admin.listTitle')}
            </h2>
          </div>

          {isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-600 dark:text-white/65">
              {t('feedback.admin.empty')}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-white/10">
              {reports.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => setSelectedId(report.id)}
                  className={`block w-full px-4 py-3 text-start transition hover:bg-emerald-50 dark:hover:bg-emerald-500/10 ${
                    selectedReport?.id === report.id ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-white/10 dark:text-white/70">
                      {t(`feedback.types.${report.type}`)}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">
                      {t(`feedback.admin.status.${report.status}`)}
                    </span>
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200">
                      {t(`feedback.rewardStatus.${report.reward_status}`)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {previewMessage(report.message)}
                  </p>
                  <div className="mt-2 grid gap-1 text-xs text-gray-500 dark:text-white/55 sm:grid-cols-3">
                    <span>{report.user_email}</span>
                    <span>{report.page_path}</span>
                    <span>{formatDate(report.created_at, i18n.language)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="rounded-xl border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-black/25">
          {selectedReport ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-bold">{t('feedback.admin.detailTitle')}</h2>
                <p className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm text-gray-800 dark:bg-white/5 dark:text-white/80">
                  {selectedReport.message}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-white/60">
                    {t('feedback.admin.fields.status')}
                  </span>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as FeedbackStatus)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-black/30"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {t(`feedback.admin.status.${option}`)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-white/60">
                    {t('feedback.admin.fields.priority')}
                  </span>
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value as FeedbackPriority)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-black/30"
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {t(`feedback.admin.priority.${option}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-white/60">
                  {t('feedback.admin.fields.adminNotes')}
                </span>
                <textarea
                  value={adminNotes}
                  onChange={(event) => setAdminNotes(event.target.value)}
                  rows={5}
                  className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-black/30"
                />
              </label>

              <dl className="grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-white/60">
                <div>
                  <dt className="font-bold">{t('feedback.admin.fields.trustToApply')}</dt>
                  <dd>{formatTrustAnswer(selectedReport.trust_to_apply, t)}</dd>
                </div>
                <div>
                  <dt className="font-bold">{t('feedback.admin.fields.willingnessToPay')}</dt>
                  <dd>{formatPayAnswer(selectedReport.willingness_to_pay, t)}</dd>
                </div>
                <div>
                  <dt className="font-bold">{t('feedback.admin.fields.user')}</dt>
                  <dd>{selectedReport.user_email}</dd>
                </div>
                <div>
                  <dt className="font-bold">{t('feedback.admin.fields.page')}</dt>
                  <dd>{selectedReport.page_path}</dd>
                </div>
                <div>
                  <dt className="font-bold">{t('feedback.admin.fields.reward')}</dt>
                  <dd>{t(`feedback.rewardStatus.${selectedReport.reward_status}`)}</dd>
                </div>
                <div>
                  <dt className="font-bold">{t('feedback.admin.fields.created')}</dt>
                  <dd>{formatDate(selectedReport.created_at, i18n.language)}</dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('feedback.admin.save')}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-white/65">{t('feedback.admin.selectPrompt')}</p>
          )}
        </aside>
      </div>
    </main>
  );
}
