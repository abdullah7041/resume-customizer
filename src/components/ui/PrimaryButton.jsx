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
        "inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 px-5 py-2.5 text-sm font-semibold text-surface-50 shadow-card transition-transform duration-[var(--duration-snappy)] ease-[var(--transition-snappy)] hover:translate-y-[-1px] hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-sand-50 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-surface-900",
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
