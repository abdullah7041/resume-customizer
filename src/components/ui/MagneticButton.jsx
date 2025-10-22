import { forwardRef, useRef, useState } from "react";
import { motion } from "framer-motion";
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
  "relative inline-flex min-h-[44px] items-center justify-center gap-2 overflow-hidden rounded-pill px-6 py-2.5 text-sm font-semibold tracking-wide transition-all duration-snappy ease-snappy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--button-primary-focus)] focus-visible:ring-offset-[color:var(--surface)] active:scale-[0.97] active:transition-transform active:duration-75";

const surfaceSheen =
  "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:content-[''] before:bg-[image:var(--glass-reflection)] before:opacity-0 before:transition-all before:duration-snappy hover:before:opacity-100 hover:before:bg-[image:var(--glass-reflection-hover)] active:before:opacity-100";

const rippleSheen =
  "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] after:bg-[image:var(--glass-gold-sheen)] after:opacity-0 after:transition-opacity after:duration-breathe hover:after:opacity-80 active:after:opacity-95";

const focusDisabled =
  "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:saturate-75";

/**
 * MagneticButton - Enhanced button with magnetic hover effect
 * Inspired by landing page V2 interactions
 */
export const MagneticButton = forwardRef(function MagneticButton(
  { 
    as = "button", 
    variant = "primary", 
    className, 
    icon: Icon, 
    loading = false, 
    children,
    enableMagnet = true,
    magnetStrength = 0.25,
    magnetRadius = 100,
    enableRipple = true,
    ...props 
  },
  ref
) {
  const buttonRef = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isNearby, setIsNearby] = useState(false);

  const resolvedVariant = variantStyles[variant] ?? variantStyles.primary;
  const isDisabled = props.disabled || loading;

  const handleMouseMove = (e) => {
    if (!enableMagnet || isDisabled) return;

    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const distance = Math.sqrt(x * x + y * y);

    if (distance < magnetRadius) {
      setOffset({ x: x * magnetStrength, y: y * magnetStrength });
      setIsNearby(true);
    } else {
      setOffset({ x: 0, y: 0 });
      setIsNearby(false);
    }
  };

  const handleMouseLeave = () => {
    setOffset({ x: 0, y: 0 });
    setIsNearby(false);
  };

  const Component = motion[as] || motion.button;

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="inline-flex"
    >
      <Component
        ref={(node) => {
          buttonRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        animate={{ x: offset.x, y: offset.y }}
        transition={{ type: "spring", stiffness: 150, damping: 15 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
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
            ? "hover:-translate-y-[2px] hover:shadow-[0_30px_70px_-28px_rgba(18,170,132,0.82)] hover:border-[color:var(--glass-border-hover)]"
            : "hover:-translate-y-[2px] hover:shadow-[var(--shadow-hover)] hover:border-[color:var(--glass-border-hover)]",
          className
        )}
        disabled={isDisabled}
        {...props}
      >
        {/* Ripple effect overlay */}
        {enableRipple && isNearby && variant === "primary" && (
          <motion.span
            initial={{ x: "-200%" }}
            animate={{ x: "200%" }}
            transition={{ duration: 1, ease: "easeInOut" }}
            className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-emerald-400/30 to-emerald-400/0 pointer-events-none"
          />
        )}
        
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          Icon && <Icon className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="relative z-10">{children}</span>
      </Component>
    </div>
  );
});

export default MagneticButton;
