import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
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

  build: {
    target: "es2020",
    minify: "esbuild", // faster than terser
    sourcemap: false, // disable for production (faster builds)
    cssCodeSplit: true,

    // Remove console and debugger statements in production
    esbuildOptions: {
      drop: ['console', 'debugger'],
    },

    rollupOptions: {
      external: ["path2d"],
      output: {
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

            // Let Rollup handle the rest (dynamic imports)
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
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },

  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true
  },
});
