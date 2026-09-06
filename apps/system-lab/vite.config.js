import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative asset paths, so the same build works at the domain root, under
  // /ee-labs/system-lab/ on GitHub Pages, and opened from disk.
  base: './',
  plugins: [react()],
  server: { port: 1429, strictPort: false },
  preview: { port: 4182, strictPort: true },
})
