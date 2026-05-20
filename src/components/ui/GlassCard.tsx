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
        y: -1,
        boxShadow: 'var(--shadow-card)',
        transition: { type: "spring", stiffness: 260, damping: 24 }
      }}
      className={cn(
        variantStyles[variant],
        paddingMap[padding],
        roundedMap[rounded],
        "transform-gpu",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}


