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
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // React core - loads immediately
            if (id.includes("/react-dom/") || id.includes("/react/") || id.includes("react-i18next")) {
              return "vendor-react";
            }
            // Zustand state management
            if (id.includes("/zustand/")) {
              return "vendor-state";
            }
            // PDF rendering - LAZY LOAD ONLY
            if (id.includes("@react-pdf")) {
              return "vendor-pdf";
            }
            // Supabase - lazy load for auth
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }
            // Icons - tree-shake aggressively
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            // Google AI - backend only, shouldn't be in frontend
            if (id.includes("@google/generative-ai")) {
              return "vendor-ai";
            }
            // Document generation
            if (id.includes("/docx/")) {
              return "vendor-docs";
            }
            // PDF.js for parsing
            if (id.includes("pdfjs-dist")) {
              return "vendor-pdfjs";
            }
            // Sentry
            if (id.includes("@sentry")) {
              return "vendor-sentry";
            }
            // i18n
            if (id.includes("i18next")) {
              return "vendor-i18n";
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
