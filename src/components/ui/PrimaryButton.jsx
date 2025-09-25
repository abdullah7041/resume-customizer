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
        "border border-primary-400/70 text-surface-50 shadow-[0_26px_70px_-28px_rgba(38,208,155,0.58)]",
        "bg-[radial-gradient(circle_at_18%_-18%,rgba(255,255,255,0.4)_0%,rgba(255,255,255,0)_46%),linear-gradient(132deg,#2fe1aa_0%,#14b07a_47%,#0a6037_100%)]",
        "hover:-translate-y-0.5 hover:shadow-[0_36px_88px_-30px_rgba(44,224,160,0.58)]",
        "focus-visible:ring-[color:var(--accent-gold)] focus-visible:ring-offset-sand-50",
        "before:pointer-events-none before:absolute before:inset-[1px] before:rounded-[calc(var(--radius-card)_/_1.8)] before:bg-[linear-gradient(120deg,transparent_0%,rgba(var(--accent-gold-rgb),0.35)_35%,rgba(var(--accent-gold-rgb),0.8)_55%,transparent_100%)] before:bg-[length:220%_100%] before:opacity-0 before:transition-opacity before:duration-[var(--duration-snappy)] before:ease-[var(--transition-snappy)] before:content-[''] hover:before:opacity-100 focus-visible:before:opacity-100 motion-safe:hover:before:animate-[accent-shimmer_1.4s_linear] motion-safe:focus-visible:before:animate-[accent-shimmer_1.4s_linear] motion-reduce:hover:before:animate-none motion-reduce:focus-visible:before:animate-none",
        "after:pointer-events-none after:absolute after:inset-[2px] after:rounded-[calc(var(--radius-card)_/_1.9)] after:border after:border-white/10 after:opacity-80 after:content-['']",
        "disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-primary-500/55 disabled:bg-[linear-gradient(132deg,#118554_0%,#118554_100%)] disabled:text-surface-50/75 disabled:shadow-none disabled:before:hidden disabled:after:hidden",
        "dark:border-primary-400/65 dark:bg-[radial-gradient(circle_at_16%_-20%,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0)_42%),linear-gradient(132deg,#35e9b8_0%,#18b578_46%,#0b6b3a_100%)] dark:hover:shadow-[0_36px_88px_-30px_rgba(47,242,182,0.46)] dark:focus-visible:ring-accent-200 dark:focus-visible:ring-offset-surface-900 dark:after:border-white/5",
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
