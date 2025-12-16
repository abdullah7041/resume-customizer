import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      external: ["path2d"],
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // React core
            if (id.includes("/react-dom/") || id.includes("/react/")) {
              return "vendor-react";
            }
            // PDF rendering (@react-pdf/renderer)
            if (id.includes("@react-pdf")) {
              return "vendor-react-pdf";
            }
            // Document generation
            if (id.includes("/docx/")) {
              return "vendor-docs";
            }
            // Icons
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            // Supabase
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }
          }
        },
      },
    },
  },
  test: {
    environment: "happy-dom",        // <-- switch from jsdom
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true
  },
});
