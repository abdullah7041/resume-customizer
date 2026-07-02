import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  // Persistent cache for faster subsequent starts
  cacheDir: 'node_modules/.vite',

  plugins: [
    react(),
    tailwindcss(),
    // Bundle analyzer - run with `npm run build:analyze`
    process.env.ANALYZE && visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Let Vite shift to the next available port (e.g. 5174) if 5173 is in use so multiple instances can run
  server: {
    port: 5173,
    strictPort: false,
    // Pre-transform the app entry + heavy first-paint modules on server start
    // so the initial page load doesn't pay a request waterfall (Vite 8).
    warmup: {
      clientFiles: ["./src/main.tsx", "./src/App.tsx"],
    },
  },

  build: {
    target: "es2020",
    minify: true, // Vite 8 (Rolldown) default minifier
    sourcemap: false, // disable for production (faster builds)
    cssCodeSplit: true,

    // Vite 8 uses Rolldown internally — rollupOptions is aliased to rolldownOptions
    rollupOptions: {
      external: ["path2d"],
      output: {
        // NOTE: manualChunks function form is deprecated in Vite 8 (Rolldown)
        // but still works via compatibility layer. Migrate to codeSplitting when ready.
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // ===== REACT-I18NEXT - MUST be with React =====
            // IMPORTANT: react-i18next uses React.createContext internally
            // If loaded before React, createContext will be undefined
            if (id.includes("react-i18next")) {
              return "vendor-core";
            }

            // ===== CORE DEPENDENCIES (always loaded) =====
            if (
              id.includes("/react-dom/") ||
              id.includes("/react/") ||
              id.includes("/zustand/") ||
              id.includes("/zod/") ||
              id.includes("i18next")
            ) {
              return "vendor-core";
            }

            // ===== PDF PARSING (dynamically imported) =====
            // Used in src/lib/utils/resumeText.ts for client-side PDF text extraction
            if (id.includes("pdfjs-dist")) {
              return "vendor-pdfjs";
            }

            // ===== UI UTILITIES (lazy loaded) =====
            if (
              id.includes("lucide-react") ||
              id.includes("mixpanel-browser") ||
              id.includes("file-saver")
            ) {
              return "vendor-ui";
            }

            // ===== SUPABASE (lazy loaded for auth) =====
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }

            // ===== SENTRY (lazy loaded for monitoring) =====
            // IMPORTANT: Keep all @sentry packages together (circular dependencies)
            if (id.includes("@sentry")) {
              return "vendor-sentry";
            }

            // ===== JOYRIDE (lazy loaded for onboarding tour) =====
            if (id.includes("react-joyride") || id.includes("react-floater")) {
              return "vendor-joyride";
            }

            // ===== JSPDF (lazy loaded for PDF export in bulk analysis) =====
            if (id.includes("jspdf")) {
              return "vendor-jspdf";
            }

            // Let Rolldown handle the rest (dynamic imports)
            return undefined;
          }
        },
      },
    },

    // Increase warning threshold but still warn
    chunkSizeWarningLimit: 600,
  },

  // Optimize dev server
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "zustand",
      "base64-js",
      "@sentry/react",           // Heavy, benefits from pre-bundling
      "lucide-react",            // Tree-shakeable but still large
      "i18next",                 // i18n core
      "react-i18next",           // React bindings
      "mixpanel-browser",        // Analytics SDK
      "@supabase/supabase-js",   // Auth SDK (3.2MB minified)
      "zod",                     // Validation (1.8MB minified)
      "clsx",                    // Utility (frequently used)
      "tailwind-merge",          // CSS merging (frequently used)
    ],
    // Exclude Node.js-only dependencies that cause issues in dev
    exclude: [
      "iconv-lite",              // Causes ENOENT crash in Netlify CLI
      "puppeteer-core",          // Server-only
      "@sparticuz/chromium",     // Server-only (Lambda)
    ],
    // Vite 8 / Rolldown: `define` lives under `transform`, not at the top level.
    // The old `rolldownOptions.define` was rejected ("Invalid key: define") and
    // silently dropped — this applies the global polyfill correctly.
    rolldownOptions: {
      transform: {
        define: {
          global: "globalThis",
        },
      },
    },
    // Release optimized deps as soon as the static-import crawl + explicit
    // `include` list is bundled, instead of holding until full crawl end.
    // Cuts cold-start time so the dev server binds + serves faster (Vite 8).
    holdUntilCrawlEnd: false,
  },
});
