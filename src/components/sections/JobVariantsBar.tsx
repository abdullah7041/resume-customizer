import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, Plus, Check, Trash2, Save, X } from 'lucide-react';
import { useResumeStore } from '../../lib/stores/resumeStore';
import { getCompatibleStorageItem, setCompatibleStorageItem } from '../../lib/utils/storage-migration';
import { cn } from '../../lib/utils/cn';
import { analytics } from '../../services/analytics';

// Shared with MatchSection / OptimizeSection — the current job description lives here.
const LAST_JOB_KEY = 'watheq:lastJobDescription';

const readJobDescription = (): string =>
  typeof window !== 'undefined' ? getCompatibleStorageItem(LAST_JOB_KEY) || '' : '';

/**
 * Phase 1 job-specific resume builder UI (docs/adr/ADR-job-specific-resume-builder.md).
 * Saves the current match+optimize run as a named, local-only variant and lets the user
 * reopen a previous one. Snapshot/restore lives in the store; opening a variant also
 * writes its job description back to localStorage so the rest of the flow stays in sync.
 */
export function JobVariantsBar() {
  const { t } = useTranslation();
  const jobVariants = useResumeStore((s) => s.jobVariants);
  const activeVariantId = useResumeStore((s) => s.activeVariantId);
  const optimizations = useResumeStore((s) => s.optimizations);
  const saveCurrentAsVariant = useResumeStore((s) => s.saveCurrentAsVariant);
  const updateVariant = useResumeStore((s) => s.updateVariant);
  const openVariant = useResumeStore((s) => s.openVariant);
  const deleteVariant = useResumeStore((s) => s.deleteVariant);

  const [isNaming, setIsNaming] = useState(false);
  const [label, setLabel] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const hasRunToSave = optimizations.length > 0;
  const hasVariants = jobVariants.length > 0;

  // Nothing worth showing until the user has a run to save or a saved variant.
  if (!hasRunToSave && !hasVariants) return null;

  const commitSave = () => {
    const jd = readJobDescription();
    saveCurrentAsVariant(label, jd);
    analytics.trackVariantSaved();
    setLabel('');
    setIsNaming(false);
  };

  // Deliberate user click on a variant chip — NOT store hydration or a
  // mount-time restore of activeVariantId (that never calls this handler),
  // so this can't inflate the ADR's reopen-rate gate with passive restores.
  const handleOpen = (id: string) => {
    const variant = openVariant(id);
    if (variant && typeof window !== 'undefined') {
      // Keep the shared job description in sync with the reopened variant.
      setCompatibleStorageItem(LAST_JOB_KEY, variant.jobDescription);
    }
    if (variant) {
      analytics.trackVariantOpened();
    }
  };

  const handleUpdateActive = () => {
    if (!activeVariantId) return;
    updateVariant(activeVariantId, readJobDescription());
    setJustSaved(true);
    const host = typeof window !== 'undefined' ? window : globalThis;
    host.setTimeout(() => setJustSaved(false), 2000);
  };

  return (
    <div className="rounded-xl border border-[color:var(--glass-border)] dark:border-white/5 bg-[color:var(--surface-control)] dark:bg-black/20 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <h4 className="text-sm font-bold text-gray-900 dark:text-white break-words">
            {t('sections.optimize.variants.title', 'Job Variants')}
          </h4>
          <span className="min-w-0 text-xs text-gray-500 dark:text-gray-400">
            {t('sections.optimize.variants.subtitle', "Saves this job's suggestions, applied changes, and scores so you can switch between jobs.")}
          </span>
        </div>

        {hasRunToSave && !isNaming && (
          <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
            {activeVariantId && (
              <button
                type="button"
                onClick={handleUpdateActive}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                {justSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                {justSaved ? t('sections.optimize.variants.saved', 'Saved') : t('sections.optimize.variants.saveChanges', 'Save changes')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsNaming(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('sections.optimize.variants.saveNew', 'Save as variant')}
            </button>
          </div>
        )}
      </div>

      {isNaming && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitSave();
              if (e.key === 'Escape') { setIsNaming(false); setLabel(''); }
            }}
            placeholder={t('sections.optimize.variants.namePlaceholder', 'e.g. Senior PM @ Aramco')}
            className="flex-1 min-w-0 rounded-lg border border-[color:var(--glass-border)] dark:border-white/10 bg-[color:var(--surface-glass-elevated)] dark:bg-black/30 px-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <button
            type="button"
            onClick={commitSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            {t('common.save', 'Save')}
          </button>
          <button
            type="button"
            onClick={() => { setIsNaming(false); setLabel(''); }}
            className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
            aria-label={t('common.cancel', 'Cancel')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {hasVariants && (
        <div className="flex max-w-full flex-wrap gap-2">
          {jobVariants.map((variant) => {
            const isActive = variant.id === activeVariantId;
            return (
              <div
                key={variant.id}
                className={cn(
                  'group inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                  isActive
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-[color:var(--glass-border)] dark:border-white/10 bg-[color:var(--surface-glass-elevated)] dark:bg-black/20 text-gray-700 dark:text-gray-200 hover:border-emerald-500/30'
                )}
              >
                <button
                  type="button"
                  onClick={() => handleOpen(variant.id)}
                  className="inline-flex min-w-0 max-w-full items-center gap-1.5 font-medium"
                  title={variant.label}
                >
                  {isActive && <Check className="w-3 h-3 shrink-0" />}
                  <span className="min-w-0 max-w-[16rem] truncate">{variant.label}</span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteVariant(variant.id)}
                  className="p-0.5 text-gray-400 hover:text-red-500 transition-colors opacity-60 group-hover:opacity-100"
                  aria-label={t('common.delete', 'Delete')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
