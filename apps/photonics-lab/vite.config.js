import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative asset paths, so the same build works at the domain root, under
  // /ee-labs/photonics-lab/ on GitHub Pages, and opened from disk.
  base: './',
  plugins: [react()],
  server: { port: 1428, strictPort: false },
  // 4176 to 4180 and 4306 to 4322 belong to the other labs. This lab previews
  // on 4181, and scripts/verify.mjs drives that port.
  preview: { port: 4181, strictPort: true },
})
