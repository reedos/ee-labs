// The core an inductor is wound on, and the current at which it gives up.
//
// An inductance is a number until you ask what holds the flux. N turns on a
// core of cross-section A_e carry flux linkage λ = L i, so the flux density
// is
//
//     B = L i / (N A_e)        and       ΔB = (1/(N A_e)) ∫ v dt
//
// which is the whole of Group D's first lesson: the same volt-seconds at
// 60 Hz and at 100 kHz differ in flux excursion by the frequency ratio, and
// that ratio is why a line transformer is iron and a flyback transformer is
// a thimble of ferrite.
//
// Iron holds only so much. Past B_sat the incremental inductance collapses
// and the current runs away. That collapse is a curve, and CORE_SCOPE.md
// Rule 3 governs curves: what is offered here is a named MODEL of it, the
// piecewise-linear knee, with the model's name attached to every result.
// Below |i| = I_sat the inductance is L; above it, L/`hard`. Each piece is
// linear, so the simulation stays exact inside a piece and the crossing is
// an event the propagator can place to the last bit. The Machines Lab makes
// the same choice in `packages/machines/src/saturation.js`, and the two labs
// use one word for one thing.
//
// The saturation current follows from the definition of B, and it is the
// number D2 is pinned to:
//
//     I_sat = B_sat N A_e / L

import { converter, DEFAULTS } from './topologies.js'

/** A small ferrite core: 40 turns on 40 mm², saturating at 0.3 T. */
export const CORE_DEFAULTS = {
  N: 40, // turns
  Ae: 40e-6, // core cross-section, m²
  Bsat: 0.3, // saturation flux density, T
  hard: 20, // how much smaller L is past the knee
}

/** The sentence the app prints wherever a saturating core is in the circuit. */
export const SATURATION_MODEL =
  'Piecewise-linear knee: L below the saturation current, L divided by the collapse ratio above it. ' +
  'A knee is a model of iron, not a law. Each piece is exact, and the crossing is placed as an event.'

export function coreOf(spec = {}) {
  const c = { ...CORE_DEFAULTS, ...spec }
  for (const key of ['N', 'Ae', 'Bsat']) if (!(c[key] > 0)) throw new Error(`${key}: a core needs a positive ${key}`)
  if (!(c.hard >= 1)) throw new Error('hard: the saturated inductance cannot exceed the unsaturated one')
  return c
}

/** Turns times area, the product every flux figure divides by. */
export const coreArea = ({ N, Ae }) => N * Ae

/** The current at which |B| reaches B_sat: I_sat = B_sat·N·A_e/L. */
export function saturationCurrent({ L, N, Ae, Bsat }) {
  return (Bsat * N * Ae) / L
}

/** Flux density at a current, in the piecewise-linear model. */
export function fluxDensity(spec, i) {
  const { L } = spec
  const c = coreOf(spec)
  const Isat = saturationCurrent({ L, ...c })
  const s = Math.sign(i) || 1
  const a = Math.abs(i)
  if (a <= Isat) return (L * i) / coreArea(c)
  return s * (c.Bsat + (L / c.hard) * (a - Isat) / coreArea(c))
}

/** The flux excursion a volt-second budget buys: ΔB = ∫v dt/(N·A_e). */
export function fluxSwing(spec, voltSeconds) {
  return voltSeconds / coreArea(coreOf(spec))
}

/**
 * A converter whose inductor is wound on a core.
 *
 * The two extra switch states are the same circuit with the collapsed
 * inductance in it, so nothing in `converter` changes and every signal form
 * is shared: only A and f carry L. `saturatingSteadyState` walks between
 * them at |i_L| = I_sat.
 */
export function saturatingConverter(kind, params = {}) {
  const p = { ...DEFAULTS, ...CORE_DEFAULTS, ...params }
  const core = coreOf(p)
  const conv = converter(kind, p)
  const Lsat = p.L / core.hard
  const sat = converter(kind, { ...p, L: Lsat })
  return {
    ...conv,
    core,
    Lsat,
    Isat: saturationCurrent({ L: p.L, ...core }),
    Bsat: core.Bsat,
    saturating: true,
    states: {
      ...conv.states,
      'on·sat': { ...sat.states.on, name: 'on·sat' },
      'off·sat': { ...sat.states.off, name: 'off·sat' },
    },
    // Which inductance each state runs with, for the flux trace.
    inductanceOf: (name) => (String(name).endsWith('·sat') ? Lsat : p.L),
  }
}

/**
 * The flux density along a solved waveform, segment by segment.
 *
 * B is a function of the current alone in this model, so it is read off i_L
 * with the piecewise map above. The ceiling ±B_sat comes back with it, since
 * a flux plot without its ceiling says nothing.
 */
export function fluxTrace(conv, wf) {
  const spec = { L: conv.p.L, ...conv.core }
  return {
    t: wf.t,
    B: wf.sig.iL.map((i) => fluxDensity(spec, i)),
    Bsat: conv.core.Bsat,
    Isat: conv.Isat,
  }
}
