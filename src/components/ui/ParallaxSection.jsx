import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "../../lib/cn";

/**
 * ParallaxSection - Section with multi-layer parallax scrolling
 * Inspired by landing page V2 hero section
 */
export function ParallaxSection({
  children,
  className,
  enableParallax = true,
  speed = "medium", // "slow", "medium", "fast"
}) {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const speedValues = {
    slow: ['0%', '10%'],
    medium: ['0%', '15%'],
    fast: ['0%', '20%'],
  };

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    enableParallax ? speedValues[speed] || speedValues.medium : ['0%', '0%']
  );

  return (
    <motion.section
      ref={containerRef}
      style={{ y }}
      className={cn("relative", className)}
    >
      {children}
    </motion.section>
  );
}

/**
 * ParallaxContainer - Multi-layer parallax background
 */
export function ParallaxContainer({
  children,
  className,
  enableLayers = true,
}) {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const y1 = useTransform(scrollYProgress, [0, 1], ['0%', '10%']);
  const y2 = useTransform(scrollYProgress, [0, 1], ['0%', '15%']);
  const y3 = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0.5]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Background layers with different scroll speeds */}
      {enableLayers && (
        <>
          <motion.div
            style={{ y: y3, opacity }}
            className="absolute inset-0 opacity-10 pointer-events-none -z-10"
          >
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
            <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
            <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000" />
          </motion.div>
        </>
      )}

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

/**
 * FadeInWhenVisible - Fade in animation on scroll into view
 */
export function FadeInWhenVisible({
  children,
  delay = 0,
  duration = 0.6,
  y = 30,
  className,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerChildren - Stagger animation for child elements
 */
export function StaggerChildren({
  children,
  staggerDelay = 0.1,
  className,
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerItem - Individual item in stagger animation
 */
export function StaggerItem({ children, className, y = 20 }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y },
        visible: { opacity: 1, y: 0 },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default ParallaxSection;
