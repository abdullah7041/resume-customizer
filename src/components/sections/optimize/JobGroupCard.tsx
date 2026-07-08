import { AlertCircle, ArrowLeftRight, Check, ChevronDown, Copy, Info, Lightbulb, RotateCcw, Send, Sparkles, Wand2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassButton } from '@/components/ui/GlassButton';
import { cn } from '@/lib/utils/cn';
import type { OptimizationResult } from '@/lib/stores/resumeStore';

export interface QueueGroup {
  id: string;
  title: string;
  subtitle?: string;
  type: OptimizationResult['sectionType'] | 'general';
  items: OptimizationResult[];
}

interface JobGroupCardProps {
  group: QueueGroup;
  viewMode: 'split' | 'diff';
  expandedCards: Set<string>;
  compareMode: string | null;
  refiningCardId: string | null;
  refineInstruction: string;
  refineLoadingId: string | null;
  refineError: string | null;
  refinableSections: string[];
  isArabic: boolean;
  onToggleCard: (sectionId: string) => void;
  onToggleCompare: (sectionId: string) => void;
  onApply: (opt: OptimizationResult) => void;
  onRevert: (sectionId: string) => void;
  onApplyGroup: (ids: string[]) => void;
  onCopy?: (value: string) => Promise<void>;
  onStartRefine: (sectionId: string) => void;
  onRefineInstructionChange: (value: string) => void;
  onSubmitRefine: (opt: OptimizationResult) => void;
}

const textValue = (value: string | string[] | undefined) => Array.isArray(value) ? value.join('\n') : value ?? '';

const firstWords = (value: string | string[] | undefined) => {
  const text = textValue(value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const words = text.split(' ').slice(0, 10).join(' ');
  return text.split(' ').length > 10 ? `${words}...` : words;
};

export function JobGroupCard({
  group,
  viewMode,
  expandedCards,
  compareMode,
  refiningCardId,
  refineInstruction,
  refineLoadingId,
  refineError,
  refinableSections,
  isArabic,
  onToggleCard,
  onToggleCompare,
  onApply,
  onRevert,
  onApplyGroup,
  onCopy,
  onStartRefine,
  onRefineInstructionChange,
  onSubmitRefine,
}: JobGroupCardProps) {
  const { t } = useTranslation();
  const appliedCount = group.items.filter((item) => item.applied).length;
  const pendingIds = group.items.filter((item) => !item.applied).map((item) => item.sectionId);
  const allApplied = pendingIds.length === 0;

  return (
    <div className={cn(
      'overflow-hidden rounded-2xl border bg-[color:var(--surface-glass-elevated)] dark:bg-white/[0.03]',
      allApplied ? 'border-emerald-500/30 ring-1 ring-emerald-500/15' : 'border-[color:var(--glass-border)] dark:border-white/10'
    )}>
      <div className="flex flex-col gap-3 border-b border-[color:var(--glass-border)] p-4 text-start dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-gray-900 dark:text-white">{group.title}</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {group.subtitle ?? t('sections.optimize.queue.suggestionsCount', { defaultValue: '{{count}} suggestions', count: group.items.length })}
            <span className="mx-2 text-gray-300 dark:text-gray-600">/</span>
            {t('sections.optimize.scoreHeader.progress', { defaultValue: '{{applied}}/{{total}} applied', applied: appliedCount, total: group.items.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onApplyGroup(pendingIds)}
          disabled={allApplied}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300"
        >
          <Check className="h-4 w-4" />
          {t('sections.optimize.queue.applyGroup', 'Apply all in this job')}
        </button>
      </div>

      <div className="divide-y divide-[color:var(--glass-border)] dark:divide-white/10">
        {group.items.map((opt) => {
          const expanded = expandedCards.has(opt.sectionId) || compareMode === opt.sectionId;
          const contentPreview = firstWords(opt.original) || t('sections.optimize.clickToExpand', 'Click to review suggestions');

          return (
            <div key={opt.sectionId} className={cn(opt.applied && 'bg-emerald-500/[0.03]')}>
              <button
                type="button"
                onClick={() => onToggleCard(opt.sectionId)}
                className={cn(
                  'flex min-h-16 w-full items-center justify-between gap-3 p-4 text-start transition-colors hover:bg-[color:var(--surface-control-hover)] dark:hover:bg-white/5',
                  expanded && 'bg-[color:var(--surface-control)] dark:bg-white/5'
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', opt.applied ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-[color:var(--glass-border)] bg-[color:var(--surface-control)] dark:border-white/10 dark:bg-black/20')}>
                    {opt.applied ? <Check className="h-4 w-4 text-emerald-500" /> : <Sparkles className="h-4 w-4 text-emerald-500" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{contentPreview}</span>
                      <span className={cn(
                        'rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                        opt.applied
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-[color:var(--glass-border)] bg-[color:var(--surface-control)] text-gray-500 dark:border-white/10 dark:bg-white/5'
                      )}>
                        {opt.applied ? t('sections.optimize.status.applied', 'Applied') : t('sections.optimize.status.pending', 'Pending')}
                      </span>
                      {opt.sectionType === 'skills' && (
                        <Info className="h-3.5 w-3.5 text-amber-500" aria-label={t('sections.optimize.skillsRecommendationTooltip', 'These are recommendations only and will not be added to your resume')} />
                      )}
                    </span>
                    <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                      {t(`sections.optimize.tabs.${opt.sectionType}`, opt.sectionType)}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleCompare(opt.sectionId);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        onToggleCompare(opt.sectionId);
                      }
                    }}
                    className={cn(
                      'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-transparent transition-colors',
                      compareMode === opt.sectionId
                        ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'text-gray-500 hover:bg-[color:var(--surface-control-hover)] hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white'
                    )}
                    title={t('sections.optimize.compare', 'Compare')}
                  >
                    <ArrowLeftRight className={cn('h-4 w-4', isArabic && 'rtl:rotate-180')} />
                  </span>
                  <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', expanded && 'rotate-180')} />
                </span>
              </button>

              {expanded && (
                <div className="p-4 pt-0">
                  {compareMode === opt.sectionId ? (
                    <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <DiffPanel tone="red" title={t('sections.optimize.originalContent', 'Original Content')} content={textValue(opt.original)} />
                      <DiffPanel tone="emerald" title={t('sections.optimize.optimizedVersion', 'Optimized Version')} content={textValue(opt.optimized)} />
                    </div>
                  ) : viewMode === 'split' ? (
                    <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <DiffPanel tone="red" title={t('sections.optimize.original', 'Original')} content={textValue(opt.original) || t('sections.optimize.noOriginal', 'No original text')} />
                      <DiffPanel tone="emerald" title={t('sections.optimize.optimized', 'Optimized')} content={textValue(opt.optimized) || t('sections.optimize.noOptimized', 'No optimized text')} />
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] p-4 font-mono text-sm leading-7 break-words dark:border-white/10 dark:bg-black/20">
                      <span className="mx-1 rounded bg-red-500/10 px-1 text-red-600 line-through decoration-red-400/50 dark:bg-red-500/20 dark:text-red-300">
                        {textValue(opt.original)}
                      </span>
                      <span className={cn('mx-2 text-gray-500', isArabic && 'rtl:rotate-180')}>-&gt;</span>
                      <span className="mx-1 rounded bg-emerald-500/10 px-1 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        {textValue(opt.optimized)}
                      </span>
                    </div>
                  )}

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    {opt.applied ? (
                      <GlassButton variant="ghost" size="sm" onClick={() => onRevert(opt.sectionId)} leftIcon={<RotateCcw className="h-3.5 w-3.5" />} className="flex-1 hover:bg-red-500/10 hover:text-red-400">
                        {t('sections.optimize.revertChanges', 'Revert Changes')}
                      </GlassButton>
                    ) : (
                      <GlassButton variant="primary" size="sm" onClick={() => onApply(opt)} leftIcon={<Check className="h-3.5 w-3.5" />} className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500">
                        {t('sections.optimize.applySuggestion', 'Apply Suggestion')}
                      </GlassButton>
                    )}

                    {refinableSections.includes(opt.sectionType) && (
                      <button
                        type="button"
                        onClick={() => onStartRefine(opt.sectionId)}
                        className={cn(
                          'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors sm:w-auto',
                          refiningCardId === opt.sectionId
                            ? 'border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-300'
                            : 'border-[color:var(--glass-border)] bg-[color:var(--surface-control)] text-gray-600 hover:bg-[color:var(--surface-control-hover)] hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white'
                        )}
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        {t('sections.optimize.refine.button', 'Refine')}
                      </button>
                    )}

                    {onCopy && (
                      <button
                        type="button"
                        onClick={() => void onCopy(textValue(opt.optimized))}
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] p-2 text-gray-500 transition-colors hover:bg-[color:var(--surface-control-hover)] hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white sm:w-auto"
                        title={t('common.copy', 'Copy Text')}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {refiningCardId === opt.sectionId && (
                    <div className="mt-4 rounded-xl border border-purple-500/15 bg-purple-500/5 p-4">
                      <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                        <Wand2 className="h-3.5 w-3.5" />
                        {t('sections.optimize.refine.title', 'Refine this bullet')}
                      </label>
                      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                        {t('sections.optimize.refine.hint', 'Describe the change (e.g. "more leadership focus", "the real number is 20%"). Watheq rewrites only from your resume — it will not invent facts.')}
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          value={refineInstruction}
                          onChange={(event) => onRefineInstructionChange(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey && refineLoadingId !== opt.sectionId) {
                              event.preventDefault();
                              onSubmitRefine(opt);
                            }
                          }}
                          disabled={refineLoadingId === opt.sectionId}
                          placeholder={t('sections.optimize.refine.placeholder', 'e.g. emphasize measurable impact')}
                          maxLength={500}
                          className="min-h-11 flex-1 rounded-lg border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 disabled:opacity-60 dark:border-white/10 dark:bg-black/20 dark:text-white"
                        />
                        <GlassButton
                          variant="primary"
                          size="sm"
                          onClick={() => onSubmitRefine(opt)}
                          disabled={refineLoadingId === opt.sectionId || !refineInstruction.trim()}
                          leftIcon={refineLoadingId === opt.sectionId ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Send className="h-3.5 w-3.5" />}
                        >
                          {refineLoadingId === opt.sectionId ? t('sections.optimize.refine.refining', 'Refining...') : t('sections.optimize.refine.submit', 'Refine')}
                        </GlassButton>
                      </div>
                      {refineError && <p className="mt-2 text-xs font-medium text-red-500 dark:text-red-400">{refineError}</p>}
                    </div>
                  )}

                  {(opt.rationale || opt.issue) && (
                    <div className="mt-4 space-y-2">
                      {opt.rationale && (
                        <ReasonBlock tone="emerald" icon={<Lightbulb className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />} label={t('sections.optimize.refine.rationaleLabel', 'Why this change')} text={opt.rationale} />
                      )}
                      {opt.issue && (
                        <ReasonBlock tone="amber" icon={<AlertCircle className="h-4 w-4 text-amber-500 dark:text-amber-400" />} label={t('sections.optimize.refine.issueLabel', 'Not applied')} text={opt.issue} />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DiffPanel({ tone, title, content }: { tone: 'red' | 'emerald'; title: string; content: string }) {
  return (
    <div className={cn('rounded-xl border p-4', tone === 'red' ? 'border-red-500/10 bg-red-500/5' : 'border-emerald-500/10 bg-emerald-500/5')}>
      <p className={cn('mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider', tone === 'red' ? 'text-red-500' : 'text-emerald-500')}>
        <span className={cn('h-1.5 w-1.5 rounded-full', tone === 'red' ? 'bg-red-400' : 'bg-emerald-400')} />
        {title}
      </p>
      <div className="whitespace-pre-wrap break-words rounded-lg bg-[color:var(--surface-control)] p-3 font-mono text-xs leading-relaxed text-gray-700 dark:bg-black/20 dark:text-gray-200">
        {content}
      </div>
    </div>
  );
}

function ReasonBlock({ tone, icon, label, text }: { tone: 'emerald' | 'amber'; icon: ReactNode; label: string; text: string }) {
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border p-3', tone === 'emerald' ? 'border-emerald-500/15 bg-emerald-500/5' : 'border-amber-500/15 bg-amber-500/5')}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className={cn('text-[10px] font-semibold uppercase tracking-wider', tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
          {label}
        </p>
        <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-200">{text}</p>
      </div>
    </div>
  );
}
