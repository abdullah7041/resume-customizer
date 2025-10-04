import { cn } from "../../lib/cn";

export default function SecondaryButton({ children, className, icon: Icon, ...props }) {
  return (
    <button
      className={cn(
        "relative inline-flex min-h-[44px] items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 py-2.5 text-sm font-semibold tracking-wide text-[color:var(--ink)] transition-[transform,box-shadow] duration-300 ease-[var(--transition-snappy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "border border-[color:var(--hairline-strong)] bg-[color:var(--panel-bg)] shadow-[var(--shadow-soft)]",
        "before:pointer-events-none before:absolute before:inset-px before:rounded-[inherit] before:bg-[color:color-mix(in_oklab,var(--panel-highlight),transparent_20%)] before:opacity-0 before:transition-opacity before:duration-300",
        "hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] hover:bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_8%)] hover:before:opacity-100 focus-visible:ring-[color:color-mix(in_oklab,var(--accent),transparent_28%)] focus-visible:ring-offset-[color:var(--surface)] dark:focus-visible:ring-offset-[color:var(--surface-strong)]",
        "disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-[color:var(--hairline-muted)] disabled:bg-[color:color-mix(in_oklab,var(--panel-bg),transparent_32%)] disabled:text-[color:color-mix(in_oklab,var(--ink-muted),transparent_18%)] disabled:shadow-none",
        className
      )}
      {...props}
    >
      {Icon && <Icon className="relative z-10 h-4 w-4" aria-hidden="true" />}
      <span className="relative z-10">{children}</span>
    </button>
  );
}
