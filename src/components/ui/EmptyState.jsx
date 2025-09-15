import { cn } from "../../lib/cn";

export default function EmptyState({ icon: Icon, title, description, actions, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-6 rounded-[var(--radius-card)] border border-secondary-500/10 bg-surface-50/90 px-8 py-16 text-center shadow-soft backdrop-blur-xl dark:border-white/5 dark:bg-surface-900/70",
        className
      )}
    >
      {Icon && (
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-secondary-500/10 text-secondary-500">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
      )}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-ink-700 dark:text-sand-50">{title}</h2>
        {description && (
          <p className="max-w-md text-sm leading-relaxed text-ink-500/80 dark:text-sand-50/70">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center justify-center gap-3">{actions}</div>}
    </div>
  );
}
