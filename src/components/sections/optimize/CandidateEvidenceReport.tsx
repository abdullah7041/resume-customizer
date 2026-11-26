import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { privateStorage } from '@/lib/auth/privateSession';
import { buildCandidateEvidenceReport, isEvidenceSource } from '@/lib/optimize/evidenceReport';
import { suggestRequirementRows } from '@/lib/optimize/evidenceSuggestions';
import type { CandidateEvidenceReport as Report, EvidenceReportInput, RequirementSelection } from '@/types/evidence-report';

type Props = Omit<EvidenceReportInput, 'requirements' | 'includedClarificationIds'> & {
  onRefresh?: () => void;
  refreshCost?: number;
  refreshDisabled?: boolean;
};
type Row = RequirementSelection & { id: number; reviewed: boolean };
const control = 'min-h-11 rounded-lg border border-line px-3 py-2 text-sm font-medium disabled:opacity-50';
const field = 'mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-line bg-background p-2 text-ink';

export function CandidateEvidenceReport({ onRefresh, refreshCost, refreshDisabled, ...input }: Props) {
  const { t } = useTranslation();
  const current = input.assessmentCurrent && input.run?.status === 'succeeded' && input.run.assessment?.jobSnapshot === input.jobDescription;
  const identity = JSON.stringify([input.run?.assessment?.context.key, input.run?.assessment?.requestId, input.resumeText, input.jobDescription, input.language]);
  return <details className="rounded-xl border border-line bg-surface p-4 text-ink sm:p-5">
    <summary className="min-h-11 cursor-pointer font-semibold">{t('export.evidenceReport.title')}</summary>
    {current ? <ReviewPanel key={identity} {...input} /> : <div className="space-y-3">
      <p role="note" className="text-sm">{t('export.evidenceReport.historical')}</p>
      {onRefresh && <button type="button" disabled={refreshDisabled} className={control} onClick={onRefresh}>
        {t('export.evidenceReport.refresh')} · {refreshCost === 0 ? t('export.evidenceReport.free') : t('export.evidenceReport.cost', { count: refreshCost })}
      </button>}
    </div>}
  </details>;
}

function ReviewPanel(props: Omit<EvidenceReportInput, 'requirements' | 'includedClarificationIds'>) {
  const { t } = useTranslation();
  const tr = (key: string) => t(`export.evidenceReport.${key}`);
  const allSources = Array.isArray(props.sources) ? props.sources.filter(isEvidenceSource) : [];
  const [rows, setRows] = useState<Row[]>(() => suggestRequirementRows(props.jobDescription, props.resumeText, allSources)
    .map((row, id) => ({ ...row, id, reviewed: false })));
  const nextId = useRef(rows.length);
  const [included, setIncluded] = useState<string[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [revision, setRevision] = useState<{ row: number; original: string; text: string } | null>(null);
  const [preview, setPreview] = useState<{ key: string; report: Report; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const sources = allSources.filter(source => source.kind === 'resume' || included.includes(source.id));
  const input = { ...props, requirements: rows.filter(row => row.reviewed).map(({ requirement, evidence }) => ({ requirement, evidence })), includedClarificationIds: included };
  const key = JSON.stringify([input, rows]);
  const latestKey = useRef(key);
  latestKey.current = key;
  const currentPreview = preview?.key === key ? preview : null;
  const update = (id: number, change: Partial<Row>) => setRows(previous => previous.map(row => row.id === id ? { ...row, reviewed: false, ...change } : row));

  function prepareDraft() {
    if (!revision?.text.trim()) return;
    const { original, text } = revision;
    if (original && (props.resumeText.indexOf(original) < 0 || props.resumeText.indexOf(original) !== props.resumeText.lastIndexOf(original))) {
      setMessage(tr('ambiguous')); return;
    }
    const draft = original ? props.resumeText.replace(original, () => text.trim()) : props.resumeText.trimEnd() + '\n' + text.trim();
    try {
      const pending = privateStorage.getItem('watheq:pasteDraft');
      if (pending && pending !== draft && pending !== props.resumeText) { setMessage(tr('existingDraft')); return; }
      privateStorage.setItem('watheq:pasteDraft', draft);
      if (privateStorage.getItem('watheq:pasteDraft') !== draft) { setMessage(tr('draftFailed')); return; }
      window.dispatchEvent(new CustomEvent('watheq:navigate-tab', { detail: { tab: 'resume' } }));
    } catch { setMessage(tr('draftFailed')); }
  }

  async function review() {
    setBusy(true); setMessage(''); setPreview(null);
    try {
      const report = await buildCandidateEvidenceReport(input);
      if (latestKey.current === key) {
        if (report.status === 'current') setPreview({ key, report, text: JSON.stringify(report, null, 2) + '\n' });
        else setMessage(tr('historical'));
      }
    } catch { if (latestKey.current === key) setMessage(tr('failed')); }
    finally { setBusy(false); }
  }

  function download() {
    if (!currentPreview) return;
    let url: string | undefined;
    try {
      url = URL.createObjectURL(new Blob([currentPreview.text], { type: 'application/json;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'watheq-candidate-evidence.json'; anchor.click();
      const downloadUrl = url;
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
    } catch { if (url) URL.revokeObjectURL(url); setMessage(tr('failed')); }
  }

  return <div className="space-y-4">
    <h4 className="text-lg font-semibold">{tr('question')}</h4>
    <p className="text-sm text-ink-muted">{tr('requirementsHelp')}</p>
    <details><summary className="cursor-pointer text-sm underline">{tr('jobSnapshot')}</summary>
      <blockquote aria-label={tr('jobSnapshot')} dir="auto" className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words text-sm">{props.jobDescription}</blockquote>
    </details>
    {allSources.some(source => source.kind === 'clarification') && <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{tr('privateAnswers')}</legend>
      {allSources.filter(source => source.kind === 'clarification').map(source => <label key={source.id} className="flex min-h-11 items-start gap-2 break-words text-sm">
        <input type="checkbox" checked={included.includes(source.id)} onChange={event => {
          if (event.target.checked) setIncluded(ids => [...ids, source.id]);
          else {
            setIncluded(ids => ids.filter(id => id !== source.id));
            setRows(previous => previous.map(row => row.evidence?.sourceId === source.id ? { ...row, evidence: undefined, reviewed: false } : row));
          }
        }} /><span>{tr('includeClarification')}: {source.text}</span>
      </label>)}
    </fieldset>}
    {rows.map(row => {
      const source = sources.find(item => item.id === row.evidence?.sourceId);
      const quote = row.evidence?.quote;
      const valid = !!row.requirement.trim() && props.jobDescription.includes(row.requirement) && (!row.evidence || (!!quote?.trim() && source?.text.includes(quote)));
      const offset = source?.kind === 'resume' ? props.resumeText.indexOf(source.text) : -1;
      return <article key={row.id} className="min-w-0 space-y-3 rounded-xl border border-line p-3 sm:p-4">
        <p className="text-xs font-semibold text-ink-muted">{tr(row.reviewed ? source ? 'associated' : 'gapReviewed' : 'unreviewed')}</p>
        <h5 dir="auto" className="break-words font-medium">{row.requirement || tr('requirement')}</h5>
        {source && quote ? <div className="border-s-2 border-emerald-600 ps-3">
          <p className="text-xs text-ink-muted">{tr(source.kind === 'resume' ? 'resume' : 'clarification')}{offset >= 0 && ` · ${tr('line')} ${props.resumeText.slice(0, offset).split('\n').length}`}</p>
          <blockquote dir="auto" className="mt-1 whitespace-pre-wrap break-words text-sm">{quote}</blockquote>
        </div> : <p className="text-sm text-ink-muted">{tr('gap')}</p>}
        <div className="flex flex-wrap gap-2">
          {source?.kind !== 'clarification' && <button type="button" className={control} onClick={() => {
            setRevision({ row: row.id, original: source?.text ?? '', text: source?.text ?? '' }); setMessage('');
          }}>{tr(source ? 'reviewBullet' : 'addExperience')}</button>}
          {source && !row.reviewed && <button type="button" disabled={!valid} className={control} onClick={() => update(row.id, { reviewed: true })}>{tr('confirm')}</button>}
          {(!row.reviewed || source) && <button type="button" disabled={!row.requirement.trim() || !props.jobDescription.includes(row.requirement)} className={control}
            onClick={() => { update(row.id, { evidence: undefined, reviewed: true }); setRevision(null); }}>{tr('leaveGap')}</button>}
          <button type="button" aria-expanded={editing === row.id} className="min-h-11 text-sm underline" onClick={() => setEditing(editing === row.id ? null : row.id)}>{tr('edit')}</button>
        </div>
        {editing === row.id && <fieldset className="space-y-2 text-sm">
          <legend className="sr-only">{tr('edit')}</legend>
          <label className="block">{tr('requirement')}<textarea dir="auto" className={field} value={row.requirement}
            onChange={event => update(row.id, { requirement: event.target.value })} /></label>
          <label className="block">{tr('source')}<select className={field} value={row.evidence?.sourceId ?? ''} onChange={event => {
            const item = sources.find(s => s.id === event.target.value);
            setRevision(null); update(row.id, { evidence: item ? { sourceId: item.id, targetId: item.targetId, fingerprint: item.fingerprint, quote: item.text } : undefined });
          }}><option value="">{tr('gap')}</option>{sources.map(item => <option key={item.id} value={item.id}>{item.text}</option>)}</select></label>
          {row.evidence && <label className="block">{tr('quote')}<textarea dir="auto" className={field} value={quote} onChange={event => update(row.id, { evidence: { ...row.evidence!, quote: event.target.value } })} /></label>}
          {!valid && <p>{tr('invalid')}</p>}
          <button type="button" className="min-h-11 underline" onClick={() => setRows(previous => previous.filter(item => item.id !== row.id))}>{tr('remove')}</button>
        </fieldset>}
        {revision?.row === row.id && <div className="space-y-2 rounded-lg bg-background p-3">
          <label className="block text-sm">{tr('draftLabel')}<textarea dir="auto" className={field} rows={3} value={revision.text}
            onChange={event => setRevision({ ...revision, text: event.target.value })} /></label>
          <p className="text-xs text-ink-muted">{tr('draftHelp')}</p>
          <button type="button" disabled={!revision.text.trim() || revision.text.trim() === revision.original.trim()} className={control} onClick={prepareDraft}>{tr('openDraft')}</button>
        </div>}
      </article>;
    })}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={control} onClick={() => {
        const id = nextId.current++; setRows(previous => [...previous, { id, reviewed: false, requirement: '' }]); setEditing(id);
      }}>{tr('add')}</button>
      <button type="button" disabled={busy} className={control} onClick={() => void review()}>{tr('review')}</button>
    </div>
    {preview && !currentPreview && <p role="status">{tr('changed')}</p>}
    {currentPreview && <section className="space-y-3 rounded-xl border border-line p-4" aria-label={tr('reviewedReport')}>
      <h4 className="font-semibold">{tr('reviewedReport')}</h4>
      <p className="text-sm text-ink-muted">{tr('description')}</p>
      {currentPreview.report.requirements.length ? <ul className="space-y-2 text-sm">{currentPreview.report.requirements.map((item, index) => <li key={index}>
        <p dir="auto" className="break-words font-medium">{item.requirement}</p>
        <p>{tr(item.status === 'candidate_associated' ? 'associated' : item.status === 'gap' ? 'gapReviewed' : 'invalid')}</p>
        {item.evidence && <blockquote dir="auto" className="break-words">{item.evidence.quote}</blockquote>}
      </li>)}</ul> : <p className="text-sm">{tr('noReviewed')}</p>}
      <details><summary className="min-h-11 cursor-pointer text-sm underline">{tr('fileContents')}</summary>
        <label className="block text-sm">{tr('preview')}<textarea readOnly dir="auto" className={field} value={currentPreview.text} rows={8} /></label>
      </details>
      <button type="button" className={control} onClick={download}>{tr('download')}</button>
    </section>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
