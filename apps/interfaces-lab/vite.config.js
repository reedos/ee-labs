import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 1451, strictPort: false },
  preview: { host: '127.0.0.1', port: 4351, strictPort: false },
})
