// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#006C35",   // Saudi green
        secondary: "#C5A572", // Desert gold
        accent: "#1E293B",    // Slate
        neutral: {
          50: "#FAFAF9",
          100: "#F5F5F4",
          200: "#E7E5E4",
          300: "#D6D3D1",
          400: "#A8A29E",
          500: "#78716C",
          600: "#57534E",
          700: "#44403C",
          800: "#292524",
          900: "#1C1917",
        },
      },
      boxShadow: {
        soft: "0 2px 4px rgba(0,0,0,0.05)",
      },
      borderRadius: {
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
