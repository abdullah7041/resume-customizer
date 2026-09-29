import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fingerprintText } from '@/lib/match/assessmentContext';
import { isConfirmationCurrent, proposalStatement } from '@/lib/optimize/evidenceReview';
import type { OptimizationResult } from '@/types/templates';
import type { EvidenceSource } from '@/types/optimization-evidence';

export function EvidenceReview({ card, sources, onConfirm, onEdit, onRevert }: {
  card: OptimizationResult;
  sources: EvidenceSource[];
  onConfirm: (id: string, confirmation: NonNullable<OptimizationResult['confirmation']>) => boolean;
  onEdit: (id: string, value: string | string[], fingerprint: string) => boolean;
  onRevert: (id: string) => void;
}) {
  const { t } = useTranslation();
  const statement = proposalStatement(card.optimized);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(statement);
  const [message, setMessage] = useState('');
  const current = isConfirmationCurrent(card.evidence, card.confirmation, statement);

  const confirm = async () => {
    if (!card.evidence || await fingerprintText(statement) !== card.evidence.proposedFingerprint) {
      setMessage(t('optimization.reviewChanged', 'This claim changed. Edit or regenerate it before confirming.'));
      return;
    }
    const saved = onConfirm(card.sectionId, { targetId: card.evidence.targetId,
      proposedFingerprint: card.evidence.proposedFingerprint, statement, confirmedAt: new Date().toISOString() });
    setMessage(saved ? t('optimization.reviewSaved', 'Your statement was saved.')
      : t('optimization.reviewSaveFailed', 'Review could not be saved. Check browser storage and try again.'));
  };

  const saveEdit = async () => {
    let value: string | string[] = draft;
    if (Array.isArray(card.optimized)) {
      try {
        const parsed: unknown = JSON.parse(draft);
        if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) throw new Error('Invalid array');
        value = parsed;
      } catch {
        setMessage(t('optimization.reviewArrayInvalid', 'Enter a JSON array of text items.'));
        return;
      }
    }
    if (!proposalStatement(value).trim()) return;
    if (!onEdit(card.sectionId, value, await fingerprintText(proposalStatement(value)))) {
      setMessage(t('optimization.reviewSaveFailed', 'Review could not be saved. Check browser storage and try again.'));
      return;
    }
    setEditing(false);
    setMessage(t('optimization.reviewEdited', 'Wording updated. Review the claim again.'));
  };

  return <section className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-gray-700 dark:text-gray-200" aria-label={t('optimization.reviewTitle', 'Review proposed claim')}>
    <p className="font-semibold">{t('optimization.reviewTitle', 'Review proposed claim')}</p>
    {card.evidence?.status === 'needs_review' && <p className="mt-1">{t('optimization.evidenceNeedsReview', 'Needs your review — source text does not verify every detail.')}</p>}
    <p className="mt-2 whitespace-pre-wrap break-words">{statement}</p>
    {card.evidence?.references.map((reference, index) => {
      const source = sources.find((item) => item.id === reference.sourceId);
      return source && <p key={`${reference.sourceId}-${index}`} className="mt-2 whitespace-pre-wrap break-words">
        {source.kind === 'clarification' ? t('optimization.clarificationSource', 'Your answer') : t('optimization.resumeSource', 'Resume text')}: {reference.quote}
      </p>;
    })}
    {(!card.evidence || card.evidence.status === 'legacy') && <p className="mt-2">{t('optimization.reviewLegacy', 'Saved source is unavailable. Check this statement yourself.')}</p>}
    {current && <p className="mt-2 font-medium text-emerald-700 dark:text-emerald-300">{t('optimization.reviewConfirmed', 'Confirmed by you as your statement')}</p>}
    {editing && <textarea aria-label={t('optimization.reviewWording', 'Edit claim wording')} value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} className="mt-3 w-full rounded border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] p-2 text-gray-900 dark:text-white" />}
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={() => void (editing ? saveEdit() : confirm())} className="min-h-11 rounded border border-emerald-500/30 px-3 font-medium text-emerald-700 dark:text-emerald-300">
        {editing ? t('optimization.reviewSaveWording', 'Save wording') : t('optimization.reviewConfirm', 'Confirm this claim')}
      </button>
      <button type="button" onClick={() => { setDraft(statement); setEditing(!editing); setMessage(''); }} className="min-h-11 rounded border border-[color:var(--glass-border)] px-3">
        {editing ? t('common.cancel', 'Cancel') : t('optimization.reviewEdit', 'Edit wording')}
      </button>
      <button type="button" onClick={() => onRevert(card.sectionId)} className="min-h-11 rounded border border-[color:var(--glass-border)] px-3">
        {t('optimization.reviewRevert', 'Revert this claim')}
      </button>
    </div>
    {message && <p role="status" className="mt-2">{message}</p>}
  </section>;
}
