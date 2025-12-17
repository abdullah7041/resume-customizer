/**
 * Glassmorphism Design System
 * Consistent glass effects across all components
 */

export const glass = {
  // Primary glass card (dark background)
  card: 'bg-gray-900/60 backdrop-blur-xl border border-white/10 shadow-xl',

  // Light glass card (for contrast)
  cardLight: 'bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl',

  // Elevated glass (more prominent)
  elevated: 'bg-gray-900/80 backdrop-blur-2xl border border-white/15 shadow-2xl',

  // Subtle glass (less prominent)
  subtle: 'bg-gray-900/40 backdrop-blur-lg border border-white/5 shadow-lg',

  // Input fields
  input: 'bg-white/5 backdrop-blur-sm border border-white/10 focus:border-emerald-500/50 focus:bg-white/10',

  // Buttons
  button: {
    primary: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/25',
    secondary: 'bg-white/10 hover:bg-white/20 text-white border border-white/10',
    ghost: 'hover:bg-white/10 text-gray-300 hover:text-white',
  },

  // Tabs
  tab: {
    active: 'bg-emerald-600/20 text-emerald-400 border-emerald-500',
    inactive: 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border-transparent',
  },

  // Badge/Tag
  badge: {
    success: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    error: 'bg-red-500/20 text-red-400 border border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    neutral: 'bg-white/10 text-gray-300 border border-white/10',
  },
};

// Combine glass classes with custom classes
export function glassCard(variant: 'default' | 'light' | 'elevated' | 'subtle' = 'default', className?: string) {
  const variants = {
    default: glass.card,
    light: glass.cardLight,
    elevated: glass.elevated,
    subtle: glass.subtle,
  };
  return `${variants[variant]} ${className || ''}`.trim();
}

