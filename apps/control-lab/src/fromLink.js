import { PLANTS, CONTROLLERS, defaultsOf } from './systems.js'

// Turning a link into a loop this app can close.
//
// Same rule as everywhere in the suite: anything that cannot be honoured is
// dropped and named. A plant that loaded as something subtly different would
// produce margins that are confidently wrong, which is worse than refusing.

function itemFrom(spec, registry, kind, warnings) {
  const def = registry[spec.type]
  if (!def) {
    warnings.push(`no ${kind} called "${spec.type}"`)
    return null
  }
  const params = defaultsOf(def)
  if (spec.params.length > def.params.length) {
    warnings.push(
      `${def.name} takes ${def.params.length} value${def.params.length === 1 ? '' : 's'}, got ${spec.params.length}`,
    )
  }
  def.params.forEach((p, i) => {
    if (i >= spec.params.length) return
    const v = spec.params[i]
    if (v < p.min || v > p.max) {
      warnings.push(`${def.name} ${p.label} ${v.toPrecision(4)} is outside ${p.min}…${p.max}; clamped`)
      params[p.key] = Math.min(p.max, Math.max(p.min, v))
    } else {
      params[p.key] = v
    }
  })
  return { id: spec.type, params }
}

/**
 * Apply a parsed link.
 *
 * Returns `{ state, warnings }`, with state null when nothing usable survived —
 * so the caller keeps its own defaults rather than loading half a loop.
 */
export function stateFromLink(patch) {
  const warnings = []
  if (!patch) return { state: null, warnings }

  const plant = patch.plant ? itemFrom(patch.plant, PLANTS, 'plant', warnings) : null
  const ctrl = patch.ctrl ? itemFrom(patch.ctrl, CONTROLLERS, 'controller', warnings) : null
  if (!plant && !ctrl) return { state: null, warnings }

  return {
    state: {
      plantId: plant ? plant.id : null,
      plantP: plant ? plant.params : null,
      ctrlId: ctrl ? ctrl.id : null,
      ctrlP: ctrl ? ctrl.params : null,
      // Provenance: where this setup was built ("from=circuit:rlc:My RLC").
      // Carried so the diagram can name the P(s) box as THE CIRCUIT it is,
      // not just the named plant it mapped onto — the identity Reed found
      // missing when his handed-over RC arrived anonymous.
      from: plant && patch.from ? patch.from : null,
    },
    warnings,
  }
}
