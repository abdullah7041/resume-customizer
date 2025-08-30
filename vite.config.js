import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path' // Import the 'path' module

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // ADDED: A 'resolve' configuration to create path aliases.
  // The '@' symbol will now point to the 'src' directory.
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

