import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";

export default function PrimaryButton({
  children,
  className,
  loading = false,
  disabled,
  icon: Icon,
  ...props
}) {
  return (
    <button
      className={cn(
        "relative inline-flex min-h-[44px] items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 py-2.5 text-sm font-semibold transition-all duration-[var(--duration-snappy)] ease-[var(--transition-snappy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "border border-[color:color-mix(in_oklab,var(--emerald-900),transparent_45%)] text-[color:var(--surface-50)] shadow-[0_28px_80px_-46px_color-mix(in_oklab,var(--emerald-900),transparent_55%)]",
        "bg-[radial-gradient(circle_at_18%_-18%,color-mix(in_oklab,var(--surface-50),transparent_45%)_0%,transparent_52%),var(--gradient-primary)]",
        "hover:-translate-y-0.5 hover:shadow-[0_40px_96px_-46px_color-mix(in_oklab,var(--emerald-900),transparent_42%)]",
        "focus-visible:ring-[color:var(--accent-gold)] focus-visible:ring-offset-[color:var(--surface-50)] dark:focus-visible:ring-offset-[color:var(--surface-900)]",
        "before:pointer-events-none before:absolute before:inset-[1px] before:rounded-[calc(var(--radius-card)_/_1.8)] before:bg-[linear-gradient(120deg,transparent_0%,color-mix(in_oklab,var(--accent-gold),transparent_55%)_35%,var(--accent-gold)_55%,transparent_100%)] before:bg-[length:220%_100%] before:opacity-0 before:transition-opacity before:duration-[var(--duration-snappy)] before:ease-[var(--transition-snappy)] before:content-[''] hover:before:opacity-100 focus-visible:before:opacity-100 motion-safe:hover:before:animate-[accent-shimmer_1.4s_linear] motion-safe:focus-visible:before:animate-[accent-shimmer_1.4s_linear] motion-reduce:hover:before:animate-none motion-reduce:focus-visible:before:animate-none",
        "after:pointer-events-none after:absolute after:inset-[2px] after:rounded-[calc(var(--radius-card)_/_1.9)] after:border after:border-[color:color-mix(in_oklab,var(--panel-highlight),transparent_35%)] after:opacity-80 after:content-['']",
        "disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-[color:color-mix(in_oklab,var(--emerald-900),transparent_55%)] disabled:bg-[color-mix(in_oklab,var(--emerald-900),transparent_35%)] disabled:text-[color:color-mix(in_oklab,var(--surface-50),transparent_30%)] disabled:shadow-none disabled:before:hidden disabled:after:hidden",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="relative z-10 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="relative z-10 h-4 w-4" aria-hidden="true" />
      )}
      <span className="relative z-10 tracking-wide">{children}</span>
    </button>
  );
}
