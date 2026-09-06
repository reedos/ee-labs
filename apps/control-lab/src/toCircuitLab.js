import { buildCircuitLink, labUrl } from '@ee-labs/ui'
import { PLANTS, CIRCUIT_KNOBS, rlcFor } from './systems.js'

// The hand-over in reverse: this plant, as the circuit it is.
//
// Circuit Lab can hand a circuit here as a plant; nothing said the motor you
// were tuning was also an RLC you could go and ring. Two named plants ARE
// catalog circuits exactly — the second-order plant is a series RLC read
// across the capacitor (ωₙ = 1/√(LC), ζ = (R/2)√(C/L)), the first-order lag
// an RC low-pass (τ = RC) — so those can be sent back as the same transfer
// function to the last bit. EXACT ONLY: a plant gain K ≠ 1 is an amplifier
// no passive network holds, and component values outside Circuit Lab's knobs
// would be clamped on arrival into a different circuit. Either case returns
// null and the line is not drawn, which is better than a link that lies.

// Circuit Lab's knob ranges live in systems.js now (the second-order hint
// reads them); re-exported so nothing that imported them from here breaks.
export { CIRCUIT_KNOBS }
const inRange = (v, [lo, hi]) => Number.isFinite(v) && v >= lo && v <= hi

/**
 * The catalog circuit this plant is, with component values, or null.
 * `{ id, values, output, components, sentence }` — `values` in the catalog's
 * own parameter order, which is what the link carries.
 */
export function circuitFor(plantId, plantP) {
  if (!plantP) return null
  if (plantId === 'secondOrder') {
    const built = rlcFor(plantP)
    if (!built) return null
    // R rounded to four significant figures: the incoming link carries six,
    // and the R computed back from its rounded ζ came out as
    // 100.00014798400001 Ω — noise dressed as precision. Four figures is a
    // component value; toCircuitLab.test.js measures the rebuilt circuit
    // against the plant to 1e-4, and to nine decimals where R is short.
    const R = Number(built.R.toPrecision(4))
    return {
      id: 'rlcSeries',
      values: [R, built.L, built.C],
      output: 'c',
      components: { R, L: built.L, C: built.C },
      sentence: 'a series RLC read across its capacitor',
    }
  }
  if (plantId === 'firstOrder') {
    if (plantP.k !== 1) return null
    // τ = RC, one equation: R = 1 kΩ first, then whatever keeps C on its knob.
    for (const R of [1000, 1e4, 1e5, 1e6, 100, 10, 1]) {
      const C = plantP.tau / R
      if (!inRange(R, CIRCUIT_KNOBS.r) || !inRange(C, CIRCUIT_KNOBS.c)) continue
      return {
        id: 'rcLow',
        values: [R, C],
        output: 'c',
        components: { R, C },
        sentence: 'an RC low-pass',
      }
    }
    return null
  }
  // threePole, motor and integrator each carry a `.circuit` block in
  // systems.js — the SAME component maths the math panel renders and
  // verifies against the plant (PLANTS[id].circuit.tf, PLANTS[id].circuit.text)
  // — but none of the three is a SHAPE Circuit Lab's catalog holds, at any
  // component values:
  //   - threePole is three real poles. The catalog's deepest entries (the
  //     series RLC, the twin-T, Sallen-Key) are all second order.
  //   - motor is a pole at the origin PLUS a second, finite pole. The
  //     catalog's only entry with a pole at the origin, its op-amp
  //     integrator, has no second pole to be the lag.
  //   - integrator is K/s with K > 0, never inverting. The catalog's only
  //     pole-at-the-origin entry is that same op-amp integrator, and it IS
  //     inverting, H(s) = -1/(sRC) — 180° apart from this plant at every
  //     frequency, and the plant's gain has no negative range to meet it.
  // All three refuse for their SHAPE, not a component value out of range —
  // CORE_SCOPE Rule 2: a mapping that is not exact declines, with a reason,
  // rather than shipping the nearest fit. toCircuitLab.test.js checks each
  // of these holds across a spread of parameter values, not only the
  // defaults, so the refusal is pinned as structural.
  if (plantId === 'threePole' || plantId === 'motor' || plantId === 'integrator') return null
  return null
}

/** The link fragment Circuit Lab reads, with provenance naming this plant. */
export function circuitFragment(plantId, plantP) {
  const c = circuitFor(plantId, plantP)
  if (!c) return null
  return buildCircuitLink({
    id: c.id,
    values: c.values,
    output: c.output,
    from: { app: 'control', id: plantId, label: PLANTS[plantId].name },
  })
}

/**
 * The full URL, or null where there is nothing to link to: no exact circuit,
 * or a dev port with no Circuit Lab beside it (the LabNav rule — a link to a
 * page that is not there is worse than none).
 */
export function circuitUrl(plantId, plantP, loc = typeof window === 'undefined' ? null : window.location) {
  const frag = circuitFragment(plantId, plantP)
  if (!frag) return null
  return labUrl('circuit-lab', frag, loc)
}
