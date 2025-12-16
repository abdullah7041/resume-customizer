import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils/cn.ts";

/**
 * AnimatedCounter - Scroll-triggered counter with easing
 * Simplified version without framer-motion
 */
export function AnimatedCounter({
  from = 0,
  to,
  duration = 2000,
  suffix = "",
  prefix = "",
  decimals = 0,
  className,
  enableAnimation = true,
  onComplete,
}) {
  const ref = useRef(null);
  const [count, setCount] = useState(from);
  const [isVisible, setIsVisible] = useState(false);

  // Simple intersection observer to trigger animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = ref.current;

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !enableAnimation) {
      setCount(to);
      return;
    }

    let startTime;
    const startValue = from;
    const endValue = to;
    const animationDuration = duration;

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);

      // Easing function: ease-out-quart (fast start, slow end)
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentCount = startValue + (endValue - startValue) * easeOutQuart;

      setCount(currentCount);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        onComplete?.();
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, from, to, duration, enableAnimation, onComplete]);

  const formattedValue = decimals > 0
    ? count.toFixed(decimals)
    : Math.floor(count).toLocaleString();

  return (
    <div
      ref={ref}
      className={cn("tabular-nums transition-opacity duration-500", isVisible ? "opacity-100" : "opacity-0", className)}
    >
      {prefix}{formattedValue}{suffix}
    </div>
  );
}

/**
 * AnimatedStatCard - Stat card with counter and hover effects
 * Simplified version using CSS transitions
 */
export function AnimatedStatCard({
  icon: Icon,
  value,
  label,
  suffix = "",
  prefix = "",
  decimals = 0,
  className,
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative p-8 rounded-2xl bg-surface-glass/50 backdrop-blur-md border border-glass-border hover:border-emerald-400/50 transition-all duration-300 cursor-pointer hover:scale-105 hover:-translate-y-1",
        className
      )}
    >
      {/* Radial glow on hover */}
      {isHovered && (
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 transition-opacity duration-300" />
        </div>
      )}

      <div className="relative text-center space-y-3">
        {Icon && (
          <div className={cn("transition-transform duration-600", isHovered && "rotate-360 scale-110")}>
            <Icon className="w-12 h-12 mx-auto text-emerald-400 mb-4" />
          </div>
        )}

        <AnimatedCounter
          to={value}
          suffix={suffix}
          prefix={prefix}
          decimals={decimals}
          className="text-5xl font-bold text-white"
        />

        <div className="text-white/70 text-lg">{label}</div>
      </div>

      {/* Glow effect on hover */}
      {isHovered && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300">
          <div className="absolute inset-0 rounded-2xl shadow-xl shadow-emerald-500/20" />
        </div>
      )}
    </div>
  );
}

export default AnimatedCounter;



