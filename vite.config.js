import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",        // <-- switch from jsdom
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true
  },
});
