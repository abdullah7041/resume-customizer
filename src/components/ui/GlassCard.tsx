import { ReactNode } from 'react';
import { m, HTMLMotionProps } from 'framer-motion';
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

const variantStyles = {
  default: glass.card,
  light: glass.cardLight,
  elevated: glass.elevated,
  subtle: glass.subtle,
};

export function GlassCard({
  children,
  variant = 'default',
  className,
  padding = 'md',
  rounded = '2xl',
  ...props
}: GlassCardProps) {
  return (
    <m.div
      whileHover={{
        y: -1,
        transition: { type: "spring", stiffness: 260, damping: 24 }
      }}
      className={cn(
        variantStyles[variant],
        paddingMap[padding],
        roundedMap[rounded],
        className
      )}
      {...props}
    >
      {children}
    </m.div>
  );
}


