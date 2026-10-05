import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildCandidateEvidenceReport, isEvidenceSource } from '@/lib/optimize/evidenceReport';
import type { EvidenceReportInput, RequirementSelection } from '@/types/evidence-report';

export function CandidateEvidenceReport(props: Omit<EvidenceReportInput, 'requirements' | 'includedClarificationIds'>) {
  const { t } = useTranslation();
  const [requirements, setRequirements] = useState<RequirementSelection[]>([]);
  const [includedClarificationIds, setIncluded] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ key: string; text: string } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const allSources = Array.isArray(props.sources) ? props.sources.filter(isEvidenceSource) : [];
  const input = { ...props, requirements, includedClarificationIds };
  const key = JSON.stringify(input);
  const latestKey = useRef(key);
  latestKey.current = key;
  const currentPreview = preview?.key === key ? preview : null;
  const sources = allSources.filter(source => source.kind === 'resume' || includedClarificationIds.includes(source.id));
  const updateRequirement = (index: number, row: RequirementSelection) => setRequirements(rows => rows.map((item, position) => position === index ? row : item));

  const review = async () => {
    setBusy(true);
    setMessage('');
    setPreview(null);
    try {
      const report = await buildCandidateEvidenceReport(input);
      if (latestKey.current === key) setPreview({ key, text: JSON.stringify(report, null, 2) + '\n' });
    } catch {
      if (latestKey.current === key) setMessage(t('export.evidenceReport.failed'));
    } finally { setBusy(false); }
  };

  const download = () => {
    if (!currentPreview) return;
    let url: string | undefined;
    try {
      url = URL.createObjectURL(new Blob([currentPreview.text], { type: 'application/json;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'watheq-candidate-evidence.json';
      anchor.click();
      // Keep the native download URL alive until the browser has consumed it.
      const downloadUrl = url;
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
    } catch {
      if (url) URL.revokeObjectURL(url);
      setMessage(t('export.evidenceReport.failed'));
    }
  };

  return <details className="rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] p-4 text-gray-900 dark:text-white">
    <summary className="min-h-11 cursor-pointer font-semibold">{t('export.evidenceReport.title')}</summary>
    <p className="my-3 text-sm">{t('export.evidenceReport.description')}</p>
    {!props.assessmentCurrent && <p role="note" className="my-3 text-sm">{t('export.evidenceReport.historical')}</p>}
    {allSources.filter(source => source.kind === 'clarification').map(source => <label key={source.id} className="my-2 flex min-h-11 items-start gap-2 break-words text-sm">
      <input type="checkbox" checked={includedClarificationIds.includes(source.id)} onChange={event => setIncluded(ids => event.target.checked ? [...ids, source.id] : ids.filter(id => id !== source.id))} />
      <span>{t('export.evidenceReport.includeClarification')}: {source.text}</span>
    </label>)}
    <p className="my-3 text-sm">{t('export.evidenceReport.requirementsHelp')}</p>
    <blockquote className="my-3 max-h-48 overflow-auto whitespace-pre-wrap break-words text-sm" aria-label={t('export.evidenceReport.jobSnapshot')}>{props.jobDescription}</blockquote>
    {requirements.map((row, index) => <fieldset key={index} className="my-3 space-y-2 rounded border border-[color:var(--glass-border)] p-3">
      <legend>{t('export.evidenceReport.requirement')} {index + 1}</legend>
      <label className="block text-sm">{t('export.evidenceReport.requirement')}
        <textarea value={row.requirement} onChange={event => updateRequirement(index, { ...row, requirement: event.target.value })} className="block w-full rounded border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] p-2" />
      </label>
      <label className="block text-sm">{t('export.evidenceReport.source')}
        <select value={row.evidence?.sourceId ?? ''} onChange={event => {
          const source = sources.find(item => item.id === event.target.value);
          updateRequirement(index, { ...row, evidence: source ? { sourceId: source.id, quote: source.text, targetId: source.targetId, fingerprint: source.fingerprint } : undefined });
        }} className="block min-h-11 w-full rounded border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] p-2">
          <option value="">{t('export.evidenceReport.gap')}</option>
          {sources.map(source => <option key={source.id} value={source.id}>{source.kind === 'clarification' ? t('export.evidenceReport.clarification') : t('export.evidenceReport.resume')}: {source.text}</option>)}
        </select>
      </label>
      {row.evidence && <label className="block text-sm">{t('export.evidenceReport.quote')}
        <textarea value={row.evidence.quote} onChange={event => updateRequirement(index, { ...row, evidence: { ...row.evidence!, quote: event.target.value } })} className="block w-full rounded border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] p-2" />
      </label>}
      <button type="button" className="min-h-11 underline" onClick={() => setRequirements(rows => rows.filter((_, position) => position !== index))}>{t('export.evidenceReport.remove')}</button>
    </fieldset>)}
    <div className="my-3 flex flex-wrap gap-3">
      <button type="button" className="min-h-11 rounded border border-[color:var(--glass-border)] px-3" onClick={() => setRequirements(rows => [...rows, { requirement: '' }])}>{t('export.evidenceReport.add')}</button>
      <button type="button" disabled={busy} className="min-h-11 rounded border border-[color:var(--glass-border)] px-3 disabled:opacity-50" onClick={() => void review()}>{t('export.evidenceReport.review')}</button>
    </div>
    {preview && !currentPreview && <p role="status">{t('export.evidenceReport.changed')}</p>}
    {currentPreview && <>
      <label className="block text-sm">{t('export.evidenceReport.preview')}
        <textarea readOnly dir="auto" value={currentPreview.text} rows={14} className="my-3 block w-full rounded border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] p-3 font-mono" />
      </label>
      <button type="button" className="min-h-11 rounded border border-emerald-500/30 px-3" onClick={download}>{t('export.evidenceReport.download')}</button>
    </>}
    {message && <p role="status">{message}</p>}
  </details>;
}
