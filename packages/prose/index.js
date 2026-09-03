// The house prose style, measured.
//
// STYLE.md is the reference; this package is the enforcement. Apps import
// `@ee-labs/prose/testing` in their own prose.test.js, and `npm run lint:prose`
// runs the same rules over the markdown at the repo root and in each app.

export { styleReport, violations, words, sentences, BUDGETS } from './src/style.js'
export { BANNED } from './src/banned.js'
