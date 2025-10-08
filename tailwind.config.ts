import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)"],
        display: ["var(--font-display)"],
      },
      colors: {
        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-muted)",
          soft: "var(--ink-soft)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          glass: "var(--surface-glass)",
          strong: "var(--surface-strong)",
        },
        royal: {
          400: "var(--color-royal-400)",
          500: "var(--color-royal-500)",
          600: "var(--color-royal-600)",
          700: "var(--color-royal-700)",
        },
        magenta: {
          500: "var(--color-magenta-500)",
          600: "var(--color-magenta-600)",
        },
        emerald: {
          400: "var(--color-emerald-400)",
          500: "var(--color-emerald-500)",
          600: "var(--color-emerald-600)",
        },
        gold: {
          400: "var(--color-gold-400)",
          500: "var(--color-gold-500)",
          600: "var(--color-gold-600)",
        },
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        card: "var(--radius-card)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        glass: "var(--shadow-glow)",
        lift: "var(--shadow-lift)",
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
        ring: "var(--shadow-ring)",
      },
      backdropBlur: {
        soft: "var(--blur-soft)",
        glass: "var(--blur-glass)",
      },
      backgroundImage: {
        "glass-primary": "var(--gradient-primary-value)",
        "glass-muted": "var(--gradient-muted-value)",
        "glass-card": "var(--gradient-card-value)",
        "glass-emerald": "var(--gradient-emerald)",
        "glass-halo": "var(--gradient-halo)",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      transitionDuration: {
        snappy: "var(--duration-snappy)",
        breathe: "var(--duration-breathe)",
      },
      transitionTimingFunction: {
        snappy: "var(--transition-snappy)",
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "glass-fade": {
          "0%": { opacity: "0", transform: "translateY(16px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "glass-reflect": {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.8s infinite ease-out",
        "glass-in": "glass-fade var(--duration-breathe) var(--transition-snappy) forwards",
        "glass-reflect": "glass-reflect 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
