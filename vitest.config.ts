import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "pdfjs-dist/legacy/build/pdf.mjs": fileURLToPath(
        new URL("./src/test/__mocks__/pdfjs-dist.mjs", import.meta.url)
      ),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: "./src/test/setup.ts",
    include: [
      "src/**/*.{test,spec}.{js,jsx,ts,tsx}",
      "netlify/functions/__tests__/**/*.test.ts",
      "netlify/lib/__tests__/**/*.test.{js,ts}"
    ],
    css: true,
    env: {
      VITE_ASSETS_BASE_URL: "",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
    },
  },
});