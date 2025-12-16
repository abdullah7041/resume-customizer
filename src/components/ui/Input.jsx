import { forwardRef, useEffect, useId, useImperativeHandle, useRef } from "react";
import { cn } from "../../lib/utils/cn.ts";

const slugify = (value) =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "field";

export const Input = forwardRef(function Input(
  {
    label,
    description,
    helperText,
    error,
    multiline = false,
    autoSize = multiline,
    className,
    inputClassName,
    id,
    name,
    value,
    defaultValue,
    ...props
  },
  forwardedRef
) {
  const restProps = props;
  const internalRef = useRef(null);
  useImperativeHandle(forwardedRef, () => internalRef.current);
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const labelSlug = typeof label === "string" ? slugify(label) : "field";
  const fallbackId = `input-${labelSlug}-${reactId}`;
  const fieldId = id ?? fallbackId;
  const fieldName = name ?? fieldId;

  const Component = multiline ? "textarea" : "input";

  useEffect(() => {
    if (!multiline || !autoSize) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const element = internalRef.current;
    if (!element) {
      return;
    }

    element.style.height = "auto";
    const computed = window.getComputedStyle(element);
    const minHeight = Number.parseFloat(computed.minHeight ?? "0") || 0;
    const nextHeight = Math.max(element.scrollHeight, minHeight);
    element.style.height = `${nextHeight}px`;
  }, [autoSize, multiline, value, defaultValue]);

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
          ref={internalRef}
          id={fieldId}
          name={fieldName}
          className={cn(
            "peer block w-full rounded-lg border border-[color:var(--glass-border)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_6%)] bg-clip-padding px-4 py-3 text-sm text-ink shadow-soft transition-all duration-snappy ease-snappy placeholder:text-ink-soft/70 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color:var(--button-primary-focus)] focus:ring-offset-2 focus:ring-offset-[color:var(--surface)]",
            multiline
              ? "min-h-[160px] resize-none overflow-hidden leading-relaxed"
              : "h-12",
            "hover:border-[color:var(--glass-border-strong)] hover:shadow-lift backdrop-blur-soft",
            error && "border-[color:var(--color-danger-500)] focus:ring-[color:var(--color-danger-500)]",
            inputClassName
          )}
          aria-invalid={Boolean(error) || undefined}
          value={value}
          defaultValue={defaultValue}
          {...restProps}
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



