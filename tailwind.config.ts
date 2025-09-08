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
      },
    },
  },
  plugins: [],
} satisfies Config;
