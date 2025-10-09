import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";

const variantStyles = {
  primary:
    "bg-[image:var(--gradient-primary-value)] text-white shadow-lift",
  secondary:
    "border border-[color:var(--glass-border)] bg-[color:var(--surface-glass)] text-ink shadow-soft",
  frosted:
    "border border-[color:color-mix(in_oklab,var(--glass-border-strong),transparent_24%)] bg-[linear-gradient(140deg,color-mix(in_oklab,var(--surface-glass),transparent_6%)_0%,color-mix(in_oklab,var(--surface-glass-strong),transparent_28%)_58%,rgba(32,195,155,0.28)_100%)] text-surface-50 shadow-[0_26px_62px_-28px_rgba(12,136,104,0.78)] backdrop-blur-2xl",
  ghost:
    "border border-transparent bg-transparent text-ink-muted hover:text-ink",
  outline:
    "border border-[color:var(--glass-border-strong)] bg-transparent text-emerald-500",
};

const interactiveStyles =
  "relative inline-flex min-h-[44px] items-center justify-center gap-2 overflow-hidden rounded-pill px-6 py-2.5 text-sm font-semibold tracking-wide transition-all duration-snappy ease-snappy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--button-primary-focus)] focus-visible:ring-offset-[color:var(--surface)]";

const surfaceSheen =
  "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:content-[''] before:bg-[image:var(--glass-reflection)] before:opacity-0 before:transition-opacity before:duration-snappy hover:before:opacity-90";

const rippleSheen =
  "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] after:bg-[image:var(--glass-gold-sheen)] after:opacity-0 after:transition-opacity after:duration-breathe hover:after:opacity-70";

const focusDisabled =
  "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:saturate-75";

export const Button = forwardRef(function Button(
  { as: Component = "button", variant = "primary", className, icon: Icon, loading = false, children, ...props },
  ref
) {
  const resolvedVariant = variantStyles[variant] ?? variantStyles.primary;
  const isDisabled = props.disabled || loading;

  return (
    <Component
      ref={ref}
      className={cn(
        interactiveStyles,
        surfaceSheen,
        variant === "primary" ? rippleSheen : "",
        variant === "ghost" ? "hover:bg-[color:color-mix(in_oklab,var(--surface),transparent_60%)]" : "",
        variant === "secondary" ? "backdrop-blur-glass" : "",
        variant === "outline" ? "backdrop-blur-soft" : "",
        variant === "frosted"
          ? "before:opacity-80 before:mix-blend-screen before:blur-[1px] after:bg-[radial-gradient(circle_at_top,rgba(162,255,217,0.28),transparent_70%)] after:opacity-60"
          : "",
        resolvedVariant,
        focusDisabled,
        variant === "frosted"
          ? "hover:-translate-y-[1px] hover:shadow-[0_30px_70px_-28px_rgba(18,170,132,0.82)]"
          : "hover:-translate-y-[1px] hover:shadow-glass",
        className
      )}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="h-4 w-4" aria-hidden="true" />
      )}
      <span>{children}</span>
    </Component>
  );
});

export default Button;
