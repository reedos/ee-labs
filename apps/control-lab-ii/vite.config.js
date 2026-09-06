import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative asset paths, so the same build works at the domain root, under
  // /ee-labs/control-lab-ii/ on GitHub Pages, and opened straight from disk.
  base: './',
  plugins: [react()],
  server: { port: 1425, strictPort: false },
})
