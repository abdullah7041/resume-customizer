/**
 * Glassmorphism Design System
 * Consistent glass effects across all components
 */

export const glass = {
  // Primary glass card (dark background) - increased opacity from /60 to /85
  card: 'bg-gray-900/85 backdrop-blur-xl border border-white/15 shadow-xl',

  // Light glass card (for contrast) - increased opacity from /10 to /20
  cardLight: 'bg-white/20 backdrop-blur-xl border border-white/25 shadow-xl',

  // Elevated glass (more prominent) - increased opacity from /80 to /90
  elevated: 'bg-gray-900/90 backdrop-blur-2xl border border-white/20 shadow-2xl',

  // Subtle glass (less prominent) - increased opacity from /40 to /70
  subtle: 'bg-gray-900/70 backdrop-blur-lg border border-white/10 shadow-lg',

  // Input fields - increased opacity from /5 to /10
  input: 'bg-white/10 backdrop-blur-sm border border-white/15 focus:border-emerald-500/50 focus:bg-white/15',

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

