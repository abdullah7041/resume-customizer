import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "html-transform",
      transformIndexHtml(html) {
        // Replace feature flag placeholders in HTML
        return html.replace(
          /%FEATURE_DARK_MODE%/g,
          process.env.VITE_FEATURE_DARK_MODE || "true"
        );
      },
    },
  ],
  build: {
    rollupOptions: {
      external: ["path2d"]
    }
  },
  test: {
    environment: "happy-dom",        // <-- switch from jsdom
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true
  },
});
