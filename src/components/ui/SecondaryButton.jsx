import { cn } from "../../lib/cn";

export default function SecondaryButton({ children, className, icon: Icon, ...props }) {
  return (
    <button
      className={cn(
        "relative inline-flex min-h-[44px] items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 py-2.5 text-sm font-semibold transition-all duration-[var(--duration-snappy)] ease-[var(--transition-snappy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "border border-[color:var(--panel-border)] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--panel-highlight),transparent_8%)_0%,color-mix(in_oklab,var(--panel-highlight),transparent_45%)_100%)] text-[color:color-mix(in_oklab,var(--ink-900),var(--surface-50) 12%)] shadow-[0_22px_60px_-34px_color-mix(in_oklab,var(--emerald-900),transparent_60%)] backdrop-blur-xl",
        "hover:-translate-y-0.5 hover:shadow-[0_30px_80px_-36px_color-mix(in_oklab,var(--emerald-900),transparent_46%)] hover:text-[color:color-mix(in_oklab,var(--ink-900),var(--surface-50) 6%)] focus-visible:ring-[color:color-mix(in_oklab,var(--emerald-700),transparent_25%)] focus-visible:ring-offset-[color:var(--surface-50)] dark:focus-visible:ring-offset-[color:var(--surface-900)]",
        "before:pointer-events-none before:absolute before:inset-[1px] before:translate-y-full before:rounded-[calc(var(--radius-card)_/_2.1)] before:bg-[linear-gradient(180deg,color-mix(in_oklab,var(--panel-highlight),transparent_35%)_0%,transparent_72%)] before:opacity-0 before:transition before:duration-500 before:ease-out before:content-[''] hover:before:translate-y-0 hover:before:opacity-100",
        "after:pointer-events-none after:absolute after:inset-[2px] after:rounded-[calc(var(--radius-card)_/_2.2)] after:border after:border-[color:color-mix(in_oklab,var(--panel-highlight),transparent_55%)] after:opacity-75 after:content-['']",
        "disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-[color:color-mix(in_oklab,var(--emerald-900),transparent_72%)] disabled:bg-[color-mix(in_oklab,var(--panel-bg),transparent_20%)] disabled:text-[color:color-mix(in_oklab,var(--ink-500),transparent_25%)] disabled:shadow-none disabled:before:hidden disabled:after:hidden",
        className
      )}
      {...props}
    >
      {Icon && <Icon className="relative z-10 h-4 w-4" aria-hidden="true" />}
      <span className="relative z-10 tracking-wide">{children}</span>
    </button>
  );
}
