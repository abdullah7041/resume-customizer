import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
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

    rollupOptions: {
      external: ["path2d"],
      output: {
        manualChunks(id, { getModuleInfo }) {
          if (id.includes("node_modules")) {
            // ===== REACT CORE (loads immediately) =====
            if (id.includes("/react-dom/") || id.includes("/react/")) {
              return "vendor-react";
            }

            // ===== STATE MANAGEMENT =====
            if (id.includes("/zustand/")) {
              return "vendor-state";
            }

            // ===== PDF RENDERING - Keep all @react-pdf in one chunk =====
            // IMPORTANT: @react-pdf packages have circular dependencies
            // Splitting them causes "Cannot access before initialization" errors
            if (
              id.includes("@react-pdf") ||
              id.includes("fontkit") ||
              id.includes("restructure") ||
              id.includes("unicode-trie") ||
              id.includes("dfa")
            ) {
              return "vendor-pdf";
            }
            if (id.includes("pako") || id.includes("brotli") || id.includes("crypto-js")) {
              return "vendor-compression";
            }

            // ===== SUPABASE - lazy load for auth =====
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }

            // ===== ICONS - tree-shake aggressively =====
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }

            // ===== DOCUMENT GENERATION - lazy load =====
            if (id.includes("/docx/")) {
              return "vendor-docs";
            }

            // ===== PDF.js for parsing =====
            if (id.includes("pdfjs-dist")) {
              return "vendor-pdfjs";
            }

            // ===== SENTRY - split core from integrations =====
            if (id.includes("@sentry/browser") || id.includes("@sentry/core")) {
              return "vendor-sentry-core";
            }
            if (id.includes("@sentry")) {
              return "vendor-sentry";
            }

            // ===== I18N =====
            if (id.includes("i18next") || id.includes("react-i18next")) {
              return "vendor-i18n";
            }

            // ===== OTHER COMMON DEPS =====
            // Date formatting
            if (id.includes("date-fns")) {
              return "vendor-date";
            }

            // Form validation
            if (id.includes("zod")) {
              return "vendor-validation";
            }

            // Shared utilities that are dynamically imported
            const info = getModuleInfo(id);
            if (info && info.dynamicImporters && info.dynamicImporters.length > 0) {
              // Module is only used via dynamic import - keep it lazy
              return undefined; // Let Rollup decide the best chunk
            }
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
      "zustand",
      "base64-js",
      // CommonJS dependencies for @react-pdf/renderer
      "unicode-trie",
      "pako",
      "fontkit",
      "restructure",
      "brotli",
      "crypto-js",
      "png-js",
      "dfa",
      // Include react-pdf for stable dynamic imports
      "@react-pdf/renderer",
    ],
    esbuildOptions: {
      // Handle CommonJS modules for react-pdf dependencies
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
