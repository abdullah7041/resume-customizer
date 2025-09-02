import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'   // if not already installed: npm i -D @vitejs/plugin-react
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
