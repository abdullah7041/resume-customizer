import { cn } from "../../lib/cn";

export default function SecondaryButton({ children, className, icon: Icon, ...props }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition-all duration-[var(--duration-snappy)] ease-[var(--transition-snappy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "border border-secondary-500/40 bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(243,244,246,0.82)_100%)] text-secondary-700 shadow-[0_18px_42px_-28px_rgba(18,102,71,0.4)]",
        "hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(237,240,245,0.92)_100%)] hover:text-secondary-800 focus-visible:ring-secondary-500 focus-visible:ring-offset-sand-50",
        "disabled:cursor-not-allowed disabled:border-secondary-500/25 disabled:bg-secondary-100/70 disabled:text-secondary-500/75 disabled:shadow-none",
        "dark:border-secondary-400/45 dark:bg-[linear-gradient(135deg,rgba(11,50,35,0.75)_0%,rgba(6,32,21,0.9)_100%)] dark:text-sand-50 dark:hover:bg-[linear-gradient(135deg,rgba(13,56,38,0.82)_0%,rgba(7,36,24,0.95)_100%)] dark:hover:text-sand-50 dark:focus-visible:ring-secondary-300 dark:focus-visible:ring-offset-surface-900 dark:shadow-[0_22px_52px_-30px_rgba(12,88,57,0.55)]",
        className
      )}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      <span className="tracking-wide">{children}</span>
    </button>
  );
}
