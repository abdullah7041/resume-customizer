// tailwind.config.ts
import type { Config } from "tailwindcss"

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#00843D",   // Saudi green
        secondary: "#C19A6B", // gold
        neutral: "#F5F7FA",   // light background
      },
    },
  },
  plugins: [],
} satisfies Config
