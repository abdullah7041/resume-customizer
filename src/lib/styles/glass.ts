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
  subtle: 'neu-card shadow-soft',

  // Input fields
  input: 'bg-[color:var(--surface-control)] dark:bg-white/5 border border-[color:var(--glass-border)] dark:border-white/10 focus:border-[color:var(--focus-ring)] focus:bg-[color:var(--surface-glass-strong)] dark:focus:bg-black/50',

  // Buttons
  button: {
    primary: 'btn-metal',
    prominent: 'btn-metal shadow-md shadow-emerald-900/10',
    secondary: 'btn-spring bg-[color:var(--surface-control)] dark:bg-gray-900/80 hover:bg-[color:var(--surface-control-hover)] dark:hover:bg-black/70 border border-[color:var(--glass-border)] dark:border-white/10 text-gray-900 dark:text-white shadow-sm',
    ghost: 'btn-spring hover:bg-black/5 dark:hover:bg-white/8 text-gray-700 dark:text-gray-200 hover:text-gray-950 dark:hover:text-white disabled:border disabled:border-gray-300/60 disabled:bg-gray-100/70 disabled:text-gray-500 disabled:dark:border-white/10 disabled:dark:bg-white/5 disabled:dark:text-gray-400',
    danger: 'btn-danger-glass',
  },

  // Tabs
  tab: {
    active: 'tab-embossed active',
    inactive: 'tab-embossed',
  },

  // Badge/Tag
  badge: {
    success: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30',
    error: 'bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30',
    info: 'bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-teal-500/30',
    neutral: 'bg-gray-200/50 dark:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-300/50 dark:border-white/10',
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

