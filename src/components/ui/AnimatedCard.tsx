import { forwardRef, useState, ElementType, ReactNode, HTMLAttributes, MouseEvent } from "react";
import { cn } from "../../lib/utils/cn";

interface AnimatedCardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  className?: string;
  children?: ReactNode;
  tone?: "glass" | "solid" | "translucent";
  glow?: boolean;
  contentClassName?: string;
  enableTilt?: boolean;
  tiltIntensity?: number;
}

const toneStyles = {
  glass:
    "border border-gray-200/50 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-xl",
  solid:
    "border border-gray-200/50 dark:border-white/15 bg-white/60 dark:bg-black/60 backdrop-blur-xl shadow-xl",
  translucent:
    "border border-gray-200/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-lg shadow-lg",
};

/**
 * AnimatedCard - Enhanced Card with 3D tilt and hover effects
 * Simplified version without framer-motion
 */
export const AnimatedCard = forwardRef<HTMLElement, AnimatedCardProps>(function AnimatedCard(
  {
    as = "section",
    className,
    children,
    tone = "glass",
    glow = false,
    contentClassName,
    enableTilt = true,
    tiltIntensity = 20,
    ...props
  },
  ref
) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!enableTilt || !isHovered) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    setRotateY((x - centerX) / tiltIntensity);
    setRotateX((centerY - y) / tiltIntensity);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
  };

  const Component = as;

  return (
    <div
      style={{ perspective: enableTilt ? "1000px" : "none" }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Component
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-card p-6 shadow-card transition-[box-shadow,border-color,scale,translate] duration-300 ease-out",
          "before:absolute before:inset-0 before:rounded-[inherit] before:opacity-0 before:transition-opacity before:duration-300 before:content-[''] before:bg-[image:var(--glass-reflection)] hover:before:opacity-90 hover:before:bg-[image:var(--glass-reflection-hover)] active:before:opacity-100",
          "hover:shadow-[var(--shadow-hover)] hover:border-[color:var(--glass-border-hover)] hover:scale-[1.02] hover:-translate-y-0.5",
          glow ? "shadow-glass" : "",
          toneStyles[tone] ?? toneStyles.glass,
          className
        )}
        style={{
          transformStyle: enableTilt ? "preserve-3d" : "flat",
          transform: enableTilt ? `rotateX(${rotateX}deg) rotateY(${rotateY}deg)` : "none",
          transition: "transform 0.1s ease-out",
        }}
        {...props}
      >
        {/* Animated gradient border glow on hover */}
        {isHovered && (
          <div className="absolute inset-0 rounded-card pointer-events-none opacity-0 animate-fade-in">
            <div className="absolute inset-0 rounded-card bg-gradient-to-r from-emerald-400/20 via-teal-400/20 to-emerald-300/20 blur-xl" />
          </div>
        )}

        <div
          className={cn("relative z-[1] space-y-4 text-ink-soft", contentClassName)}
          style={{ transform: enableTilt ? "translateZ(20px)" : "none" }}
        >
          {children}
        </div>
      </Component>
    </div>
  );
});

export default AnimatedCard;




