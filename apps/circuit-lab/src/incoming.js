// A circuit arriving by link (packages/ui circuitLink.js), checked against the
// catalog before it is allowed to become state.
//
// The link names a catalog id, its component values in the catalog's order,
// and an output key. Everything is validated here rather than trusted: an id
// the catalog does not have loads nothing; a value outside a knob's range is
// clamped AND reported, so the reader knows the circuit on screen is not quite
// the one that was sent; an output the circuit does not have falls back to its
// first, with a warning. A link that silently loads as something else is worse
// than one that refuses.

import { CIRCUITS } from './circuits.js'

/**
 * `{ state, warnings }`: state is `{ id, params, output, from }` or null.
 * `patch` is what parseCircuitLink returned (may be null).
 */
export function stateFromLink(patch) {
  const warnings = []
  if (!patch) return { state: null, warnings }
  const c = CIRCUITS[patch.id]
  if (!c) return { state: null, warnings: [`No circuit called "${patch.id}" here; nothing loaded.`] }
  const values = patch.values || []
  if (values.length !== c.params.length) {
    return {
      state: null,
      warnings: [`"${c.name}" takes ${c.params.length} value${c.params.length === 1 ? '' : 's'} (${c.params.map((p) => p.label).join(', ')}); the link carried ${values.length}. Nothing loaded.`],
    }
  }
  const params = {}
  c.params.forEach((k, i) => {
    const v = values[i]
    if (!Number.isFinite(v)) {
      params[k.key] = k.value
      warnings.push(`${k.label}: "${v}" is not a number; using the default.`)
      return
    }
    const clamped = Math.min(k.max, Math.max(k.min, v))
    if (clamped !== v) warnings.push(`${k.label} = ${v} ${k.unit} is outside this knob's ${k.min}–${k.max} ${k.unit}; clamped to ${clamped} ${k.unit}.`)
    params[k.key] = clamped
  })
  let output = patch.output
  if (output && !c.outputs.some((o) => o.key === output)) {
    warnings.push(`"${c.name}" has no output "${output}"; showing ${c.outputs[0].label}.`)
    output = undefined
  }
  return { state: { id: patch.id, params, output: output || c.outputs[0].key, from: patch.from || null }, warnings }
}
