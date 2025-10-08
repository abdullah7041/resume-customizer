import { forwardRef } from "react";
import { cn } from "../../lib/cn";

export const Input = forwardRef(function Input(
  {
    label,
    description,
    helperText,
    error,
    multiline = false,
    className,
    inputClassName,
    ...props
  },
  ref
) {
  const Component = multiline ? "textarea" : "input";

  return (
    <label className={cn("group/input block space-y-2", className)}>
      {label && (
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-500/90">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500/60 shadow-glass" aria-hidden="true" />
          {label}
        </span>
      )}
      {description && (
        <p className="text-sm text-ink-soft/80">{description}</p>
      )}
      <div className="relative">
        <Component
          ref={ref}
          className={cn(
            "peer block w-full rounded-lg border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_6%)] bg-clip-padding px-4 py-3 text-sm text-ink shadow-soft transition-all duration-snappy ease-snappy placeholder:text-ink-soft/70 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color:var(--button-primary-focus)] focus:ring-offset-2 focus:ring-offset-[color:var(--surface)]",
            multiline ? "min-h-[160px] resize-y" : "h-12",
            "hover:border-[color:var(--glass-border-strong)] hover:shadow-lift backdrop-blur-soft",
            error && "border-[color:var(--color-danger-500)] focus:ring-[color:var(--color-danger-500)]",
            inputClassName
          )}
          aria-invalid={Boolean(error) || undefined}
          {...props}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-gold-400/40 to-transparent opacity-0 transition-opacity duration-snappy ease-snappy peer-focus:opacity-60"
        />
      </div>
      {helperText && !error && (
        <p className="text-xs font-medium text-emerald-500/80">{helperText}</p>
      )}
      {typeof error === "string" && error && (
        <p className="text-xs font-semibold text-[color:var(--color-danger-500)]">{error}</p>
      )}
    </label>
  );
});

export default Input;
