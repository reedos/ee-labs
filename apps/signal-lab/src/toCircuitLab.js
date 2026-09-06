import { buildCircuitLink, labUrl } from '@ee-labs/ui'

// The hand-over out of Signal Lab: a low-pass block, as the circuit it is.
//
// A series RLC read across its capacitor is
//
//   H(s) = 1 / (s²LC + sRC + 1),   ω0 = 1/√(LC),   Q = (1/R)√(L/C)
//
// the same standard second-order low-pass this block's Cutoff and Q already
// parameterise — not a different object approximated by this one, the SAME
// two numbers the block already carries (CORE_SCOPE's counter-rule: an exact
// mapping is stated without a hedge). Mirrors control-lab's toCircuitLab.js,
// which makes the same argument for a plant.
//
// EXACT ONLY: component values outside Circuit Lab's own knobs would arrive
// clamped into a different circuit, so a block whose (freq, q) needs an
// out-of-range part returns null and the hand-over draws nothing — a link
// that quietly changed the filter would be worse than no link.

// Circuit Lab's own knob ranges (apps/circuit-lab/src/circuits.js), copied
// rather than imported: this file stays inside signal-lab's own territory,
// and the three numbers are stable — R 1 Ω–1 MΩ, L 1 µH–1 H, C 1 pF–1 mF.
export const CIRCUIT_KNOBS = { r: [1, 1e6], l: [1e-6, 1], c: [1e-12, 1e-3] }
const onKnob = (v, [lo, hi]) => Number.isFinite(v) && v >= lo && v <= hi

/**
 * The series RLC a low-pass block's (freq, q) is, or null when no L in the
 * candidate list lands every part on Circuit Lab's own knobs.
 */
export function rlcFor({ freq, q } = {}) {
  const w0 = 2 * Math.PI * (freq || 0)
  if (!(w0 > 0) || !(q > 0)) return null
  for (const L of [0.01, 1e-3, 0.1, 1, 1e-4, 1e-5, 1e-6]) {
    const C = 1 / (w0 * w0 * L)
    const R = (1 / q) * Math.sqrt(L / C)
    if (onKnob(R, CIRCUIT_KNOBS.r) && onKnob(L, CIRCUIT_KNOBS.l) && onKnob(C, CIRCUIT_KNOBS.c)) {
      return { R, L, C }
    }
  }
  return null
}

/**
 * The catalog circuit a block is, with component values, or null: not a
 * low-pass, bypassed, or no L holds every part on Circuit Lab's knobs.
 * `{ id, values, output, components }` — `values` in the catalog's own
 * parameter order (R, L, C), which is what the link carries.
 */
export function circuitFor(block) {
  if (!block || block.type !== 'lowpass' || block.bypass) return null
  const built = rlcFor(block.params)
  if (!built) return null
  // Four significant figures: the same rounding control-lab's own reverse
  // hand-over uses, so R reads as a component value rather than a division's
  // trailing noise.
  const R = Number(built.R.toPrecision(4))
  return { id: 'rlcSeries', values: [R, built.L, built.C], output: 'c', components: { R, L: built.L, C: built.C } }
}

/** The link fragment Circuit Lab reads, with provenance naming this preset. */
export function circuitFragment(block, presetName) {
  const c = circuitFor(block)
  if (!c) return null
  return buildCircuitLink({
    id: c.id,
    values: c.values,
    output: c.output,
    from: { app: 'signal', id: presetName || 'signal-lab', label: presetName || 'Signal Lab' },
  })
}

/**
 * The full URL, or null: no exact circuit, or a dev port with no Circuit Lab
 * deployed beside this page (the same rule every other hand-over in the
 * suite follows — a link to a page that is not there is worse than none).
 */
export function circuitUrl(block, presetName, loc = typeof window === 'undefined' ? null : window.location) {
  const frag = circuitFragment(block, presetName)
  if (!frag) return null
  return labUrl('circuit-lab', frag, loc)
}
