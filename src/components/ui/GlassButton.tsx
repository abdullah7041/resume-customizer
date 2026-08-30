import React, { forwardRef } from 'react';
import { m, HTMLMotionProps } from 'framer-motion';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils/cn';
import { Loader2 } from 'lucide-react';

interface GlassButtonProps extends Omit<HTMLMotionProps<"button">, 'ref'> {
  variant?: 'primary' | 'prominent' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const sizeMap = {
  sm: 'min-h-10 px-3 py-1.5 text-sm',
  md: 'min-h-11 px-4 py-2 text-sm',
  lg: 'min-h-12 px-6 py-3 text-base',
};

// Premium spring physics matching skeuomorphic demo exactly
const springTransition = {
  type: "spring" as const,
  stiffness: 280,
  damping: 22,
  mass: 0.8
};

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({
    children,
    variant = 'primary',
    size = 'md',
    isLoading,
    leftIcon,
    rightIcon,
    className,
    disabled,
    ...props
  }, ref) => {
    return (
      <m.button
        ref={ref}
        disabled={disabled || isLoading}
        // Hover: Lift up (-3px), add subtle diffuse glow/shadow
        whileHover={{
          y: disabled || isLoading ? 0 : -1,
          boxShadow: disabled || isLoading ? 'none' : '0 10px 22px -16px rgba(16, 185, 129, 0.28), inset 0 1px 0 rgba(255,255,255,0.18)',
          transition: { duration: 0.2, ease: "easeOut" }
        }}
        // Tap: Compress down (scale 0.96), increase inset shadow (realistic button press)
        whileTap={{
          scale: 0.96,
          y: 1, // Slight downward shift
          boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.1), inset 0 1px 2px rgba(0, 0, 0, 0.2), 0 0 0 rgba(16, 185, 129, 0)',
          transition: springTransition
        }}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors duration-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
          'disabled:cursor-not-allowed disabled:opacity-75',
          glass.button[variant],
          sizeMap[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : leftIcon}
        {children as React.ReactNode}
        {!isLoading && rightIcon}
      </m.button>
    );
  }
);

GlassButton.displayName = 'GlassButton';


