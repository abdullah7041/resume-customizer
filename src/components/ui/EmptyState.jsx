import { cn } from "../../lib/cn";

export default function EmptyState({ icon: Icon, title, description, actions, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-6 rounded-[var(--radius-card)] border border-secondary-500/10 bg-white/80 px-8 py-16 text-center shadow-soft backdrop-blur-sm sm:backdrop-blur-xl dark:border-surface-50/10 dark:bg-zinc-900/60",
        className
      )}
    >
      {Icon && (
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-secondary-500/10 text-secondary-500">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
      )}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-ink-700 dark:text-surface-50">{title}</h2>
        {description && (
          <p className="max-w-md text-sm leading-relaxed text-ink-500/80 dark:text-surface-50/70">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center justify-center gap-3">{actions}</div>}
    </div>
  );
}
