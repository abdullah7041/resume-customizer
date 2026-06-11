// src/components/ui/GlassCircle.tsx
// Unified glass circle component for consistent icon containers with prominent glow
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils/cn';
import type { ReactNode } from 'react';

interface GlassCircleProps extends HTMLMotionProps<"div"> {
    children: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    variant?: 'default' | 'success' | 'warning' | 'info' | 'purple' | 'blue' | 'indigo' | 'gold';
    className?: string;
}

const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
};

// Enhanced color values with stronger glow and glossy gradient effect
const variantStyles = {
    default: {
        background: 'linear-gradient(145deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.05) 100%)',
        border: '1px solid rgba(255,255,255,0.3)',
        boxShadow: '0 0 30px rgba(255,255,255,0.2), 0 8px 32px rgba(0,0,0,0.12), inset 0 2px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)'
    },
    success: {
        background: 'linear-gradient(145deg, rgba(16,185,129,0.5) 0%, rgba(16,185,129,0.25) 50%, rgba(16,185,129,0.15) 100%)',
        border: '1px solid rgba(16,185,129,0.6)',
        boxShadow: '0 0 40px rgba(16,185,129,0.4), 0 0 80px rgba(16,185,129,0.2), 0 8px 32px rgba(0,0,0,0.15), inset 0 2px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)'
    },
    warning: {
        background: 'linear-gradient(145deg, rgba(245,158,11,0.5) 0%, rgba(245,158,11,0.25) 50%, rgba(245,158,11,0.15) 100%)',
        border: '1px solid rgba(245,158,11,0.6)',
        boxShadow: '0 0 40px rgba(245,158,11,0.4), 0 0 80px rgba(245,158,11,0.2), 0 8px 32px rgba(0,0,0,0.15), inset 0 2px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)'
    },
    info: {
        background: 'linear-gradient(145deg, rgba(59,130,246,0.5) 0%, rgba(59,130,246,0.25) 50%, rgba(59,130,246,0.15) 100%)',
        border: '1px solid rgba(59,130,246,0.6)',
        boxShadow: '0 0 40px rgba(59,130,246,0.4), 0 0 80px rgba(59,130,246,0.2), 0 8px 32px rgba(0,0,0,0.15), inset 0 2px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)'
    },
    purple: {
        background: 'linear-gradient(145deg, rgba(168,85,247,0.5) 0%, rgba(168,85,247,0.25) 50%, rgba(168,85,247,0.15) 100%)',
        border: '1px solid rgba(168,85,247,0.6)',
        boxShadow: '0 0 40px rgba(168,85,247,0.4), 0 0 80px rgba(168,85,247,0.2), 0 8px 32px rgba(0,0,0,0.15), inset 0 2px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)'
    },
    blue: {
        background: 'linear-gradient(145deg, rgba(59,130,246,0.5) 0%, rgba(59,130,246,0.25) 50%, rgba(59,130,246,0.15) 100%)',
        border: '1px solid rgba(59,130,246,0.6)',
        boxShadow: '0 0 40px rgba(59,130,246,0.4), 0 0 80px rgba(59,130,246,0.2), 0 8px 32px rgba(0,0,0,0.15), inset 0 2px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)'
    },
    indigo: {
        background: 'linear-gradient(145deg, rgba(99,102,241,0.5) 0%, rgba(99,102,241,0.25) 50%, rgba(99,102,241,0.15) 100%)',
        border: '1px solid rgba(99,102,241,0.6)',
        boxShadow: '0 0 40px rgba(99,102,241,0.4), 0 0 80px rgba(99,102,241,0.2), 0 8px 32px rgba(0,0,0,0.15), inset 0 2px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)'
    },
    // Soft gold — restrained accent for the Warm Saudi Premium direction (calm glow)
    gold: {
        background: 'linear-gradient(145deg, rgba(197,160,89,0.45) 0%, rgba(197,160,89,0.22) 50%, rgba(197,160,89,0.12) 100%)',
        border: '1px solid rgba(197,160,89,0.55)',
        boxShadow: '0 0 24px rgba(197,160,89,0.22), 0 8px 24px rgba(0,0,0,0.12), inset 0 2px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.08)'
    }
};

export function GlassCircle({
    children,
    size = 'md',
    variant = 'default',
    className,
    ...props
}: GlassCircleProps) {
    const styles = variantStyles[variant];

    return (
        <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className={cn(
                'flex items-center justify-center rounded-xl',
                'backdrop-blur-xl',
                sizeClasses[size],
                className
            )}
            style={{
                background: styles.background,
                border: styles.border,
                boxShadow: styles.boxShadow
            }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

export default GlassCircle;

