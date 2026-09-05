import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative asset paths, so the same build works at the domain root, under
  // /ee-labs/random-lab/ on GitHub Pages, and opened straight from disk.
  base: './',
  plugins: [react()],
  server: { port: 1426, strictPort: false },
  // Ports 4300 to 4305 belong to the other labs. This lab's harness uses 4306.
  preview: { port: 4306, strictPort: true },
})
