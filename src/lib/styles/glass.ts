/**
 * Glassmorphism Design System
 * Consistent glass effects across all components
 * Using neutral transparent backgrounds for clean glass look
 */

export const glass = {
  // Primary glass card - neutral transparent background
  card: 'neu-card',

  // Light glass card (for contrast)
  cardLight: 'neu-card',

  // Elevated glass (more prominent)
  elevated: 'neu-card shadow-2xl',

  // Subtle glass (less prominent)
  subtle: 'neu-card opacity-95',

  // Input fields
  input: 'bg-white/5 backdrop-blur-sm border border-white/10 focus:border-emerald-500/50 focus:bg-white/10',

  // Buttons
  button: {
    primary: 'btn-metal',
    prominent: 'btn-metal shadow-lg shadow-emerald-500/20',
    secondary: 'btn-spring bg-gray-900/80 hover:bg-black border border-white/10 text-white shadow-md backdrop-blur-md',
    ghost: 'btn-spring hover:bg-white/5 text-gray-300 hover:text-white',
  },

  // Tabs
  tab: {
    active: 'tab-embossed active',
    inactive: 'tab-embossed',
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

