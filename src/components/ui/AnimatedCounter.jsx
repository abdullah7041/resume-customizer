import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "../../lib/cn";

/**
 * AnimatedCounter - Scroll-triggered counter with easing
 * Inspired by landing page V2 stats section
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
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [count, setCount] = useState(from);

  useEffect(() => {
    if (!isInView || !enableAnimation) {
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
  }, [isInView, from, to, duration, enableAnimation, onComplete]);

  const formattedValue = decimals > 0 
    ? count.toFixed(decimals)
    : Math.floor(count).toLocaleString();

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn("tabular-nums", className)}
    >
      {prefix}{formattedValue}{suffix}
    </motion.div>
  );
}

/**
 * AnimatedStatCard - Stat card with counter and hover effects
 */
export function AnimatedStatCard({
  icon: Icon,
  value,
  label,
  suffix = "",
  prefix = "",
  decimals = 0,
  delay = 0,
  className,
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ scale: 1.05, y: -5 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={cn(
        "group relative p-8 rounded-2xl bg-surface-glass/50 backdrop-blur-md border border-glass-border hover:border-emerald-400/50 transition-all duration-300 cursor-pointer",
        className
      )}
    >
      {/* Radial glow on hover */}
      {isHovered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 rounded-2xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10" />
        </motion.div>
      )}

      <div className="relative text-center space-y-3">
        {Icon && (
          <motion.div
            animate={isHovered ? { rotate: 360, scale: 1.1 } : { rotate: 0, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <Icon className="w-12 h-12 mx-auto text-emerald-400 mb-4" />
          </motion.div>
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 rounded-2xl pointer-events-none"
        >
          <div className="absolute inset-0 rounded-2xl shadow-xl shadow-emerald-500/20" />
        </motion.div>
      )}
    </motion.div>
  );
}

export default AnimatedCounter;
