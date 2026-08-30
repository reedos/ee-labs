import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// One test run across the whole suite: the shared packages and every app.
//
// Running them together rather than per workspace is deliberate. The packages
// exist to be used, and a change that satisfies a package's own tests while
// breaking every consumer is the failure mode worth catching immediately.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['packages/*/src/**/*.test.{js,jsx}', 'apps/*/src/**/*.test.{js,jsx}'],
  },
})
