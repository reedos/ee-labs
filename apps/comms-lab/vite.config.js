import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative asset paths, so the same build works at the domain root, under
  // /ee-labs/comms-lab/ on GitHub Pages, and opened straight from disk.
  base: './',
  plugins: [react()],
  server: { port: 1427, strictPort: false },
  // Ports 4300 to 4306 belong to the other labs. This lab's preview is 4307.
  preview: { port: 4307, strictPort: true },
})
