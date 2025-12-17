import { forwardRef } from "react";
import { cn } from "../../lib/utils/cn";

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  className?: string;
  children?: React.ReactNode;
  tone?: "glass" | "solid" | "translucent";
  glow?: boolean;
  contentClassName?: string;
}

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
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
        "relative overflow-hidden rounded-card p-6 shadow-card transition-all duration-500 ease-out",
        "before:absolute before:inset-0 before:rounded-[inherit] before:opacity-0 before:transition-all before:duration-500 before:content-[''] before:bg-[image:var(--glass-reflection)] hover:before:opacity-100 hover:before:bg-[image:var(--glass-reflection-hover)]",
        "after:pointer-events-none after:absolute after:-inset-1/2 after:rounded-[40%] after:bg-[image:var(--gradient-halo)] after:opacity-0 after:blur-3xl after:transition-opacity after:duration-700 hover:after:opacity-40",
        "hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.15)] hover:border-emerald-500/30 hover:bg-[color:var(--surface-glass-strong)]",
        "active:scale-[0.99] active:transition-transform active:duration-200",
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




