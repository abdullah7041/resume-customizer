import { cn } from "../../lib/cn";

export default function SecondaryButton({ children, className, icon: Icon, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-secondary-600/80 bg-surface-50/80 px-5 py-2.5 text-sm font-semibold text-secondary-700 shadow-[0_10px_24px_-18px_rgba(11,107,58,0.45)] transition-all duration-[var(--duration-snappy)] ease-[var(--transition-snappy)] hover:bg-secondary-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-sand-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-secondary-400/60 dark:bg-surface-900/60 dark:text-secondary-200 dark:hover:bg-secondary-500/25 dark:focus-visible:ring-offset-surface-900",
        className
      )}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      <span className="tracking-wide">{children}</span>
    </button>
  );
}
