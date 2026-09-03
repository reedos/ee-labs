// What an app's prose.test.js uses.
//
//   import { expectPlain } from '@ee-labs/prose/testing'
//   expectPlain(lesson.see, 'see', `${id} see`)
//
// A failure prints every violation of that field's budget, each with the rule
// that caught it and the replacement STYLE.md gives, so the message says what to
// write rather than only what not to.

import { expect } from 'vitest'
import { BUDGETS, violations } from './src/style.js'

/** Allowed exceptions, keyed by the exact string. Each needs a reason (S: allowlist). */
let allow = {}

/**
 * Load the app's prose.allow.json. Call once at the top of a prose.test.js:
 *   useAllowList(await import('./prose.allow.json', { with: { type: 'json' } }))
 * An entry whose reason is empty is rejected, so the allow list cannot become a
 * silent bypass.
 */
export function useAllowList(json) {
  const entries = json?.default ?? json ?? {}
  for (const [text, reason] of Object.entries(entries)) {
    if (!reason || !String(reason).trim())
      throw new Error(`prose.allow.json: "${text.slice(0, 40)}…" has no reason`)
  }
  allow = entries
  return entries
}

/**
 * Assert one string against a named budget from STYLE.md.
 * `kind` is a key of BUDGETS; `label` names the field in the failure message.
 */
export function expectPlain(text, kind, label = kind) {
  const budget = BUDGETS[kind]
  if (!budget) throw new Error(`unknown prose budget: ${kind}`)
  const found = allow[String(text ?? '').trim()] ? [] : violations(text, budget, label)
  expect(found, found.join('\n')).toEqual([])
}

/** The same, for a list of strings. */
export function expectAllPlain(items, kind, labelOf = (_, i) => `${kind}[${i}]`) {
  const found = []
  items.forEach((text, i) => {
    if (allow[String(text ?? '').trim()]) return
    found.push(...violations(text, BUDGETS[kind], labelOf(text, i)))
  })
  expect(found, found.join('\n')).toEqual([])
}
