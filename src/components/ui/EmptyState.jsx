import { cn } from "../../lib/cn";

export default function EmptyState({ icon: Icon, title, description, actions, className }) {
  return (
    <div
      className={cn(
    "flex flex-col items-center justify-center gap-6 rounded-[var(--radius-card)] border border-[color:var(--hairline-strong)] bg-[color:var(--panel-bg)] px-8 py-16 text-center shadow-[var(--shadow-soft)] backdrop-blur-sm",
        className
      )}
    >
      {Icon && (
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-[color:var(--hairline-soft)] bg-[color:color-mix(in_oklab,var(--secondary),transparent_90%)] text-[color:var(--secondary)] shadow-[var(--shadow-soft)]">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
      )}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-[color:var(--ink)]">{title}</h2>
        {description && (
          <p className="max-w-md text-sm leading-relaxed text-[color:var(--ink-muted)]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center justify-center gap-3">{actions}</div>}
    </div>
  );
}
