import { FileText, X, Check } from "lucide-react";
import PrimaryButton from "../ui/PrimaryButton.jsx";
import SecondaryButton from "../ui/SecondaryButton.jsx";

const prettyLabel = (value) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export default function OptimizationCard({ optimization, onAccept, onReject, index }) {
  return (
    <article className="space-y-4 rounded-[var(--radius-card)] border border-secondary-500/12 bg-surface-50/80 p-6 shadow-soft backdrop-blur-xl dark:border-surface-50/10 dark:bg-surface-900/70">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary-500/10 text-secondary-500">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary-500">
              {prettyLabel(optimization.section ?? "section")}
            </p>
            <p className="text-sm text-ink-500/80 dark:text-sand-50/70">
              {optimization.explanation}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-secondary-500/30 bg-secondary-500/10 px-3 py-1 text-xs font-semibold text-secondary-500">
          Suggested
        </span>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500/60 dark:text-sand-50/60">Original</p>
          <div className="rounded-[var(--radius-card)] border border-danger-500/20 bg-danger-500/5 px-4 py-3 text-sm leading-relaxed text-ink-700 dark:border-danger-500/25 dark:bg-danger-500/10 dark:text-sand-50">
            <pre className="whitespace-pre-wrap font-sans">
              {typeof optimization.original === "string"
                ? optimization.original
                : JSON.stringify(optimization.original, null, 2)}
            </pre>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500/60 dark:text-sand-50/60">Optimized</p>
          <div className="rounded-[var(--radius-card)] border border-secondary-500/20 bg-secondary-500/10 px-4 py-3 text-sm leading-relaxed text-ink-700 dark:border-secondary-500/25 dark:bg-secondary-500/20 dark:text-sand-50">
            <pre className="whitespace-pre-wrap font-sans">
              {typeof optimization.optimized === "string"
                ? optimization.optimized
                : JSON.stringify(optimization.optimized, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-3">
        <SecondaryButton icon={X} onClick={() => onReject?.(index)}>
          Dismiss
        </SecondaryButton>
        <PrimaryButton icon={Check} onClick={() => onAccept?.(index)}>
          Apply
        </PrimaryButton>
      </footer>
    </article>
  );
}
