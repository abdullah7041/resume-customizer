import { cn } from "../../lib/cn";

/**
 * ParallaxSection - Section with simple styling (parallax removed)
 * Simplified version without framer-motion
 */
export function ParallaxSection({
  children,
  className,
}) {
  return (
    <section className={cn("relative", className)}>
      {children}
    </section>
  );
}

/**
 * ParallaxContainer - Multi-layer background container
 * Simplified version with CSS animations only
 */
export function ParallaxContainer({
  children,
  className,
  enableLayers = true,
}) {
  return (
    <div className={cn("relative", className)}>
      {/* Background layers with CSS animations */}
      {enableLayers && (
        <div className="absolute inset-0 opacity-10 pointer-events-none -z-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

/**
 * FadeInWhenVisible - Simple fade in on mount
 * Simplified version using CSS
 */
export function FadeInWhenVisible({
  children,
  className,
}) {
  return (
    <div className={cn("animate-fade-in", className)}>
      {children}
    </div>
  );
}

/**
 * StaggerChildren - Container for staggered children
 */
export function StaggerChildren({
  children,
  className,
}) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

/**
 * StaggerItem - Individual item
 */
export function StaggerItem({ children, className }) {
  return (
    <div className={cn("animate-fade-in", className)}>
      {children}
    </div>
  );
}

export default ParallaxSection;
