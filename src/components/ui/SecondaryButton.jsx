import { cn } from "../../lib/cn";

export default function SecondaryButton({ children, className, icon: Icon, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition-all duration-[var(--duration-snappy)] ease-[var(--transition-snappy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "border border-secondary-500/45 bg-surface-50 text-secondary-700 shadow-[0_16px_32px_-24px_rgba(15,70,45,0.45)]",
        "hover:bg-secondary-100 hover:text-secondary-800 focus-visible:ring-secondary-500 focus-visible:ring-offset-sand-50",
        "disabled:cursor-not-allowed disabled:border-secondary-500/30 disabled:bg-secondary-100/70 disabled:text-secondary-500/80 disabled:shadow-none",
        "dark:border-secondary-400/50 dark:bg-secondary-500/20 dark:text-sand-50 dark:hover:bg-secondary-500/30 dark:hover:text-sand-50 dark:focus-visible:ring-secondary-300 dark:focus-visible:ring-offset-surface-900 dark:shadow-[0_20px_50px_-32px_rgba(18,110,74,0.55)]",
        className
      )}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      <span className="tracking-wide">{children}</span>
    </button>
  );
}
