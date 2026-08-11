import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "pdfjs-dist/legacy/build/pdf.mjs": fileURLToPath(
        new URL("./src/test/__mocks__/pdfjs-dist.mjs", import.meta.url)
      ),
    },
  },
  test: {
    // Root-level options shared by every project. NOTE: `environment`,
    // `setupFiles`, `include` and `css` deliberately do NOT live here — the
    // DOM setup file touches `window` and must never run in the node project.
    globals: true,
    testTimeout: 10000,
    env: {
      // Frontend Supabase credentials for client-side tests
      VITE_SUPABASE_URL: "https://test.supabase.co",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
      VITE_ASSETS_BASE_URL: "",
      // Backend Supabase credentials for Netlify function tests
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      OPENROUTER_API_KEY: "test-openrouter-key",
      UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "test-token",
    },
    projects: [
      {
        extends: true,
        test: {
          name: "dom",
          environment: "happy-dom",
          setupFiles: "./src/test/setup.ts",
          css: true,
          include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "netlify/functions/__tests__/**/*.test.ts",
            "netlify/lib/__tests__/**/*.test.{js,ts}",
            "eval/__tests__/**/*.test.js",
            "scripts/lib/model-eval/__tests__/**/*.test.js",
          ],
        },
      },
    ],
  },
});
