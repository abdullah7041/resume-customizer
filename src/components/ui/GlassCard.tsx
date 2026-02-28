import { ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils/cn';

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  variant?: 'default' | 'light' | 'elevated' | 'subtle';
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  rounded?: 'lg' | 'xl' | '2xl' | '3xl';
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const roundedMap = {
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  '3xl': 'rounded-3xl',
};

export function GlassCard({
  children,
  variant = 'default',
  className,
  padding = 'md',
  rounded = '2xl',
  ...props
}: GlassCardProps) {
  const variantStyles = {
    default: glass.card,
    light: glass.cardLight,
    elevated: glass.elevated,
    subtle: glass.subtle,
  };

  return (
    <motion.div
      whileHover={{
        y: -3,
        rotateX: 1.5,
        rotateY: -1.5,
        boxShadow: '0 24px 60px -20px var(--shadow-card), 0 16px 40px -24px rgba(9, 96, 84, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
        transition: { type: "spring", stiffness: 300, damping: 20 }
      }}
      className={cn(
        variantStyles[variant],
        paddingMap[padding],
        roundedMap[rounded],
        "transform-gpu will-change-transform perspective-1000",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}


