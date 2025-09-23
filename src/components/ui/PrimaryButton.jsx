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
        "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition-all duration-[var(--duration-snappy)] ease-[var(--transition-snappy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "border border-primary-500/80 text-surface-50 shadow-[0_26px_68px_-30px_rgba(24,190,126,0.6)]",
        "bg-[linear-gradient(130deg,#29e3a3_0%,#10b075_45%,#0b6b3a_100%)] hover:-translate-y-0.5 hover:bg-[linear-gradient(130deg,#34f0b0_0%,#13bd7f_45%,#0c7a45_100%)] hover:shadow-[0_32px_78px_-28px_rgba(41,226,164,0.55)]",
        "focus-visible:ring-accent-200 focus-visible:ring-offset-sand-50",
        "disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-primary-500/55 disabled:bg-[linear-gradient(130deg,#118554_0%,#118554_100%)] disabled:text-surface-50/75 disabled:shadow-none",
        "dark:border-primary-400/70 dark:bg-[linear-gradient(130deg,#2beab0_0%,#11a76a_44%,#0b6b3a_100%)] dark:hover:bg-[linear-gradient(130deg,#37f7bf_0%,#16b878_44%,#0c7a45_100%)] dark:hover:shadow-[0_32px_78px_-28px_rgba(41,232,172,0.48)] dark:focus-visible:ring-accent-200 dark:focus-visible:ring-offset-surface-900",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="h-4 w-4" aria-hidden="true" />
      )}
      <span className="tracking-wide">{children}</span>
    </button>
  );
}
