// tailwind.config.ts
import type { Config } from "tailwindcss"

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1D4ED8",   // custom blue
        secondary: "#9333EA", // custom purple
      },
    },
  },
  plugins: [],
} satisfies Config
