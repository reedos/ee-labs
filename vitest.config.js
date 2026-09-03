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
    // are numerical tests: solved steady states, fuzzed geometry, whole
    // spectra. Several run for seconds here and several times that on a
    // two-core CI runner sharing itself between workers. A test that passes
    // here and times out there has told you nothing about the code.
    //
    // Thirty seconds held until Group I. The diode's experiments solve by
    // Newton iteration, and three tests that walk every experiment (the
    // drawing-collision sweep, the headline closed forms, the callout layout)
    // now run 20 to 22 seconds here and timed out on the runner, taking a
    // deploy with them. Ninety is sized to the slowest of them on the slower
    // machine, and is still short enough to catch a hang. No assertion is
    // weakened by it, and the one test that needs longer still says so itself.
    testTimeout: 90000,
  },
})
