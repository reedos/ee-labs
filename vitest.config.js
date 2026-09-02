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
    // Vitest's default is five seconds, which is a bet on the machine. These
    // are numerical tests — solved steady states, fuzzed geometry, whole
    // spectra — and several of them run seconds here and several times that on
    // a two-core CI runner sharing itself between workers. That default was
    // already marginal and a deploy failed on it: a test that passes here and
    // times out there has told you nothing about the code. Thirty seconds is
    // still short enough to catch a hang, and no assertion is weakened by it.
    testTimeout: 30000,
  },
})
