import { useState } from "react";
import { Clipboard, ClipboardCheck, FileText, Sparkles } from "lucide-react";
import SecondaryButton from "../ui/SecondaryButton.jsx";

export default function OptimizationCard({ card, onCopy, disabledActions = false }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!card?.exampleAfter) return;
    await onCopy?.(card.exampleAfter);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <article className="relative space-y-5 rounded-[var(--radius-card)] border border-secondary-500/12 bg-white/80 p-6 shadow-soft backdrop-blur-sm sm:backdrop-blur-xl transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg dark:border-surface-50/10 dark:bg-zinc-900/65 dark:text-surface-50 dark:hover:bg-zinc-900/70">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary-500/10 text-secondary-500">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary-500">
              {card?.section ?? "Section"}
            </p>
        <p className="text-sm text-ink-500/80 dark:text-surface-50/70">
              {card?.issue ?? "Opportunity detected"}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-secondary-500/30 bg-secondary-500/10 px-3 py-1 text-xs font-semibold text-secondary-500">
          Suggested
        </span>
      </header>

      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-accent-500">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Recommendation
        </p>
        <p className="text-sm leading-relaxed text-ink-700 dark:text-surface-50">
          {card?.suggestion}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500/60 dark:text-surface-50/60">Before</p>
          <div className="rounded-[var(--radius-card)] border border-danger-500/20 bg-danger-500/5 px-4 py-3 text-sm leading-relaxed text-ink-700 dark:border-danger-500/25 dark:bg-danger-500/10 dark:text-surface-50">
            <p>{card?.exampleBefore ?? "Original bullet pending."}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500/60 dark:text-surface-50/60">
              After
            </p>
            <SecondaryButton
              icon={copied ? ClipboardCheck : Clipboard}
              onClick={handleCopy}
              disabled={disabledActions}
              className="!px-3 !py-1 text-xs"
              title={disabledActions ? "Upgrade to copy directly." : "Copy optimized bullet"}
            >
              {copied ? "Copied" : "Copy"}
            </SecondaryButton>
          </div>
          <div className="rounded-[var(--radius-card)] border border-secondary-500/20 bg-secondary-500/10 px-4 py-3 text-sm leading-relaxed text-ink-700 dark:border-secondary-500/25 dark:bg-secondary-500/20 dark:text-surface-50">
            <p>{card?.exampleAfter ?? "Optimized bullet pending."}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
