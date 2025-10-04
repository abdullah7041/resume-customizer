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
        "relative inline-flex min-h-[44px] items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 py-2.5 text-sm font-semibold tracking-wide text-white transition-[transform,box-shadow] duration-300 ease-[var(--transition-snappy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "border border-transparent bg-[var(--button-primary-gradient)] shadow-[var(--button-primary-shadow)]",
        "hover:-translate-y-0.5 hover:shadow-[var(--button-primary-shadow-strong)]",
        "focus-visible:ring-[color:var(--button-primary-focus)] focus-visible:ring-offset-[color:var(--surface)] dark:focus-visible:ring-offset-[color:var(--surface-strong)]",
        "disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[color-mix(in_oklab,var(--surface),transparent_16%)] disabled:text-[color:color-mix(in_oklab,var(--ink),transparent_54%)] disabled:shadow-none",
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
      <span className="relative z-10">{children}</span>
    </button>
  );
}
