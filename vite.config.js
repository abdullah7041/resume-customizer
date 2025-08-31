import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path' // Import the 'path' module

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(),
     tailwindcss()],
  // ADDED: A 'resolve' configuration to create path aliases.
  // The '@' symbol will now point to the 'src' directory.
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

