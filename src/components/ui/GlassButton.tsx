import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils/cn';
import { Loader2 } from 'lucide-react';

interface GlassButtonProps extends Omit<HTMLMotionProps<"button">, 'ref'> {
  variant?: 'primary' | 'prominent' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const sizeMap = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
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
      <motion.button
        ref={ref}
        disabled={disabled || isLoading}
        // Hover: Lift up (-3px), add subtle diffuse glow/shadow
        whileHover={{
          y: -3,
          boxShadow: '0 8px 30px rgba(16, 185, 129, 0.2), inset 0 2px 0 rgba(255,255,255,0.2)',
          transition: { duration: 0.2, ease: "easeOut" }
        }}
        // Tap: Compress down (scale 0.96), increase inset shadow (realistic button press)
        whileTap={{
          scale: 0.96,
          y: 1, // Slight downward shift
          boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.4), inset 0 1px 2px rgba(0, 0, 0, 0.5), 0 0 0 rgba(16, 185, 129, 0)',
          transition: springTransition
        }}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors duration-300',
          'disabled:opacity-50 disabled:cursor-not-allowed',
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
      </motion.button>
    );
  }
);

GlassButton.displayName = 'GlassButton';


