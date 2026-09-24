import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FileText, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ResumeLibraryEntry } from '@/lib/resumeLibrary';

interface ResumeSelectorProps {
  entries: ResumeLibraryEntry[];
  activeResumeId: string | null;
  onActivate: (id: string) => void;
}

export function ResumeSelector({ entries, activeResumeId, onActivate }: ResumeSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const active = entries.find(entry => entry.id === activeResumeId);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => { document.removeEventListener('keydown', onKeyDown); document.removeEventListener('pointerdown', onPointerDown); };
  }, [open]);

  if (!active) return null;
  const duplicateCounts = new Map<string, number>();
  entries.forEach(entry => duplicateCounts.set(entry.name, (duplicateCounts.get(entry.name) ?? 0) + 1));

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button ref={triggerRef} type="button" aria-expanded={open} aria-haspopup="dialog"
        aria-label={t('upload.library.select', 'Select resume') + ': ' + active.name}
        onClick={() => setOpen(value => !value)}
        className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-start text-ink shadow-sm transition-[background-color,scale] hover:bg-ink/5 active:scale-[0.96] sm:max-w-72">
        <FileText className="h-4 w-4 shrink-0 text-ink-accent" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={active.name}>{active.name}</span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
      {open && (
        <div role="dialog" aria-label={t('upload.library.select', 'Select resume')}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl border border-line bg-surface-strong p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:end-0 sm:top-full sm:mt-2 sm:w-96 sm:rounded-2xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">{t('upload.library.title', 'Your resumes')}</h2>
            <button ref={closeRef} type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} aria-label={t('common.close', 'Close')}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted hover:bg-ink/10"><X className="h-5 w-5" /></button>
          </div>
          <div className="space-y-2">
            {entries.map(entry => (
              <button key={entry.id} type="button" aria-current={entry.id === activeResumeId ? 'true' : undefined}
                aria-label={`${entry.name}, ${entry.parsedResume.basics?.name || t('upload.library.unknownCandidate', 'Candidate')}${duplicateCounts.get(entry.name)! > 1 ? `, ${entry.id.slice(-6)}` : ''}`}
                onClick={() => { onActivate(entry.id); setOpen(false); triggerRef.current?.focus(); }}
                className={`min-h-11 w-full rounded-xl border p-3 text-start transition-[background-color,scale] active:scale-[0.96] ${entry.id === activeResumeId ? 'border-emerald-500 bg-emerald-500/10' : 'border-line hover:bg-ink/5'}`}>
                <span className="block break-words text-base font-semibold text-ink sm:text-sm">{entry.name}</span>
                <span className="mt-1 block text-sm text-ink-muted">{entry.parsedResume.basics?.name || t('upload.library.unknownCandidate', 'Candidate')}</span>
                <span className="mt-1 block text-xs text-ink-soft tabular-nums">
                  {t('upload.library.updated', 'Updated')} {new Date(entry.updatedAt).toLocaleDateString()}
                  {duplicateCounts.get(entry.name)! > 1 ? ` · ${entry.id.slice(-6)}` : ''}
                  {entry.id === activeResumeId ? ` · ${t('upload.library.active', 'Active')}` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
