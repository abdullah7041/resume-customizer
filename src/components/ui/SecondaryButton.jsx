import { cn } from "../../lib/cn";

export default function SecondaryButton({ children, className, icon: Icon, ...props }) {
  return (
    <button
      className={cn(
        "relative inline-flex min-h-[44px] items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 py-2.5 text-sm font-semibold transition-all duration-[var(--duration-snappy)] ease-[var(--transition-snappy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "border border-secondary-400/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(236,247,243,0.86)_100%)] text-secondary-700 shadow-[0_22px_60px_-32px_rgba(24,128,92,0.36)]",
        "hover:-translate-y-0.5 hover:shadow-[0_30px_76px_-34px_rgba(24,128,92,0.42)] hover:text-secondary-800 focus-visible:ring-secondary-400 focus-visible:ring-offset-sand-50",
        "before:pointer-events-none before:absolute before:inset-[1px] before:translate-y-full before:rounded-[calc(var(--radius-card)_/_2.1)] before:bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0)_72%)] before:opacity-0 before:transition before:duration-500 before:ease-out before:content-[''] hover:before:translate-y-0 hover:before:opacity-100",
        "after:pointer-events-none after:absolute after:inset-[2px] after:rounded-[calc(var(--radius-card)_/_2.2)] after:border after:border-secondary-500/15 after:opacity-75 after:content-['']",
        "disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-secondary-500/25 disabled:bg-secondary-100/70 disabled:text-secondary-500/75 disabled:shadow-none disabled:before:hidden disabled:after:hidden",
        "dark:border-secondary-400/45 dark:bg-[linear-gradient(135deg,rgba(11,50,35,0.8)_0%,rgba(5,28,18,0.92)_100%)] dark:text-surface-50 dark:hover:text-surface-50 dark:hover:shadow-[0_30px_78px_-34px_rgba(9,90,60,0.5)] dark:focus-visible:ring-secondary-300 dark:focus-visible:ring-offset-surface-900 dark:after:border-secondary-500/20",
        className
      )}
      {...props}
    >
      {Icon && <Icon className="relative z-10 h-4 w-4" aria-hidden="true" />}
      <span className="relative z-10 tracking-wide">{children}</span>
    </button>
  );
}
