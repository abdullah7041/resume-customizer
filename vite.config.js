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
            // ===== REACT-I18NEXT - MUST be with React =====
            // IMPORTANT: react-i18next uses React.createContext internally
            // If loaded before React, createContext will be undefined
            // This MUST come before the generic react check below
            if (id.includes("react-i18next")) {
              return "vendor-react";
            }

            // ===== REACT CORE (loads immediately) =====
            if (id.includes("/react-dom/") || id.includes("/react/")) {
              return "vendor-react";
            }

            // ===== I18N (core i18next without react bindings) =====
            if (id.includes("i18next")) {
              return "vendor-i18n";
            }

            // ===== STATE MANAGEMENT =====
            if (id.includes("/zustand/")) {
              return "vendor-state";
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

            // ===== SENTRY - Keep all in one chunk =====
            // IMPORTANT: @sentry packages have circular dependencies
            // Splitting them causes "Cannot access before initialization" errors
            if (id.includes("@sentry")) {
              return "vendor-sentry";
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
