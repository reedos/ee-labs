import katex from 'katex'
import { agrees } from './src/MathPanel.jsx'

// Helpers for holding an explanation panel to its own standard.
//
// Every tool in the suite should run these against its own entries. They exist
// because each rule below was written after the corresponding mistake shipped:
// a formula that rendered as red literal text, a row that crossed out correct
// physics, and thirteen rows that printed one number twice and always agreed.

/** Every row of a given kind across an entry. */
export const rowsOf = (entry, kind) =>
  entry.blocks.filter((b) => b.kind === kind).flatMap((b) => b.rows)

/** Check rows whose two columns disagree. Unmeasurable rows are skipped. */
export function checkFailures(entry, label = '') {
  const out = []
  for (const r of rowsOf(entry, 'check')) {
    if (r.unchecked) continue
    const { predicted, measured, tol = 0.02, abs = 0 } = r
    if (!Number.isFinite(predicted) || !Number.isFinite(measured)) {
      out.push(`${label} / ${r.label}: non-finite (${predicted}, ${measured})`)
    } else if (!agrees({ predicted, measured, tol, abs })) {
      out.push(
        `${label} / ${r.label}: theory ${predicted.toPrecision(5)} ` +
          `vs measured ${measured.toPrecision(5)}`,
      )
    }
  }
  return out
}

/** Formulas KaTeX cannot typeset. Strict, so a silent fallback counts as failure. */
export function texFailures(entry, label = '') {
  const out = []
  for (const b of entry.blocks) {
    if (b.kind !== 'formula') continue
    try {
      katex.renderToString(b.tex, { throwOnError: true, strict: 'error' })
    } catch (e) {
      out.push(`${label}: ${b.tex} — ${e.message}`)
    }
  }
  return out
}

/** Value rows that are pretending to be comparisons. */
export function valueRowsPretendingToCheck(entry, label = '') {
  const out = []
  for (const r of rowsOf(entry, 'values')) {
    if ('predicted' in r || 'measured' in r) out.push(`${label} / ${r.label}`)
  }
  return out
}

/**
 * Check rows that do not actually read anything.
 *
 * Build the entry twice from contexts whose measurable inputs differ, and every
 * check row's measured value must move. One that does not is a tautology: it
 * restates its own prediction and can never disagree with it.
 *
 * The perturbation has to TILT across frequency as well as scale, and the tilt
 * has to differ between the two contexts — a flat scale, or an identical tilt,
 * cancels out of any row that reads a ratio and leaves it looking inert.
 */
export function inertRows(buildEntry, contextA, contextB, label = '') {
  const a = rowsOf(buildEntry(contextA), 'check')
  const b = rowsOf(buildEntry(contextB), 'check')
  const out = []
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a[i].unchecked || a[i].predicted === 0) continue
    if (a[i].measured === b[i].measured) out.push(`${label} / ${a[i].label}`)
  }
  return out
}
