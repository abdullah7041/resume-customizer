import { forwardRef } from "react";
import { cn } from "../../lib/cn";

export const Card = forwardRef(function Card(
  {
    as: Component = "section",
    className,
    children,
    tone = "glass",
    glow = false,
    contentClassName,
    ...props
  },
  ref
) {
  const toneStyles = {
    glass:
      "border border-[color:var(--glass-border)] bg-[color:var(--surface-glass)] backdrop-blur-glass",
    solid:
      "border border-[color:color-mix(in_oklab,var(--ink),transparent_80%)] bg-[color:var(--surface-strong)]",
    translucent:
      "border border-[color:var(--glass-border-strong)] bg-[color:color-mix(in_oklab,var(--surface-glass),transparent_10%)] backdrop-blur-soft",
  };

  return (
    <Component
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-card p-6 shadow-card transition-all duration-breathe ease-snappy",
        "before:absolute before:inset-0 before:rounded-[inherit] before:opacity-0 before:transition-opacity before:duration-breathe before:content-[''] before:bg-[image:var(--glass-reflection)] hover:before:opacity-80",
        "after:pointer-events-none after:absolute after:bottom-[-40%] after:left-[-20%] after:h-[140%] after:w-[160%] after:rounded-full after:bg-[image:var(--gradient-halo)] after:opacity-0 after:transition-opacity after:duration-breathe hover:after:opacity-60",
        glow ? "shadow-glass" : "",
        toneStyles[tone] ?? toneStyles.glass,
        className
      )}
      {...props}
    >
      <div className={cn("relative z-[1] space-y-4 text-ink-soft", contentClassName)}>{children}</div>
    </Component>
  );
});

export default Card;
