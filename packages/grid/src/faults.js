// Four faults, four ways to connect three networks.
//
// A sequence network is one network per set. The positive-sequence network is
// the ordinary per-phase circuit. The negative-sequence network is the same
// with the machine reactances that apply to a reversed field. The zero-
// sequence network is a different circuit, because a delta winding gives
// zero-sequence current nowhere to go and a grounded wye gives it a path
// through the neutral.
//
// A shunt fault at one bus is a connection between the three networks at that
// bus, and each connection is exact.
//
//   three-phase           the positive network alone, shorted
//   single line to ground  the three in series
//   line to line           positive and negative in parallel
//   double line to ground  negative and zero in parallel across positive
//
// A neutral grounding impedance appears in the zero-sequence network three
// times, because the neutral carries 3 I_0 through it and the network carries
// I_0. That factor of three is F3's measurement.

import { C, cabs, carg, cadd, cdiv, cmul, cscale, csub, polar } from './cx.js'
import { toPhase, toSequence } from './sequence.js'

export const FAULT_KINDS = ['3ph', 'slg', 'll', 'dlg']

export const FAULT_LABELS = {
  '3ph': 'Three phase',
  slg: 'Line to ground',
  ll: 'Line to line',
  dlg: 'Two lines to ground',
}

/** Whether a winding connection passes zero-sequence current through it. */
export const ZERO_PATH = {
  'delta-wyeg': false,
  'wyeg-wyeg': true,
  'delta-delta': false,
  'wyeg-delta': false,
}

/**
 * The three Thévenin impedances at the fault bus of a generator, transformer
 * and line in series.
 *
 * The positive and negative networks run all the way back to the generator.
 * The zero network stops at the transformer when its winding connection blocks
 * zero-sequence current, which is what makes `Z_0` a different number rather
 * than a multiple of `Z_1`.
 */
export function sequenceImpedances({ generator, transformer, line }) {
  const g = { Zn: 0, ...generator }
  const through = ZERO_PATH[transformer.connection]
  if (through === undefined) throw new Error(`unknown winding connection "${transformer.connection}"`)
  const Z1 = C(0, g.X1 + transformer.X + line.X1)
  const Z2 = C(0, g.X2 + transformer.X + line.X2)
  // A neutral impedance carries 3 I_0, so it appears three times in the
  // zero-sequence network.
  const generatorZero = C(0, g.X0 + 3 * g.Zn)
  const Z0 = through ? cadd(generatorZero, C(0, transformer.X + line.X0)) : C(0, transformer.X + line.X0)
  return { Z1, Z2, Z0, throughTransformer: through, generatorZero, connection: transformer.connection }
}

/**
 * One fault, in sequence currents, phase currents and the ground current.
 *
 * @param spec  the network, as `sequenceImpedances` takes it, plus `prefault`
 * @param kind  one of FAULT_KINDS
 * @param Zf    the fault impedance, a complex pair or a real number
 */
export function faultStudy(spec, { kind = '3ph', Zf = 0 } = {}) {
  if (!FAULT_KINDS.includes(kind)) throw new Error(`unknown fault "${kind}"`)
  const { Z1, Z2, Z0 } = sequenceImpedances(spec)
  const E = C(spec.prefault ?? 1)
  const zf = Array.isArray(Zf) ? Zf : C(Zf)
  let I0 = C(0)
  let I1 = C(0)
  let I2 = C(0)
  let connection = ''
  if (kind === '3ph') {
    I1 = cdiv(E, cadd(Z1, zf))
    connection = 'The positive network alone, shorted through the fault impedance. The negative and zero networks carry nothing.'
  } else if (kind === 'slg') {
    I1 = cdiv(E, cadd(cadd(Z1, cadd(Z2, Z0)), cscale(zf, 3)))
    I2 = I1
    I0 = I1
    connection = 'The three networks in series, with three times the fault impedance, because the whole fault current passes through it.'
  } else if (kind === 'll') {
    I1 = cdiv(E, cadd(cadd(Z1, Z2), zf))
    I2 = cscale(I1, -1)
    connection = 'Positive and negative in parallel. The zero network is untouched, so no current returns through the ground.'
  } else {
    // Z2 in parallel with (Z0 + 3Zf), across the positive network.
    const zg = cadd(Z0, cscale(zf, 3))
    const par = cdiv(cmul(Z2, zg), cadd(Z2, zg))
    I1 = cdiv(E, cadd(Z1, par))
    I2 = cscale(cmul(I1, cdiv(zg, cadd(Z2, zg))), -1)
    I0 = cscale(cmul(I1, cdiv(Z2, cadd(Z2, zg))), -1)
    connection = 'Negative and zero in parallel across positive, with the fault impedance three times over in the zero branch.'
  }
  const phase = toPhase([I0, I1, I2])
  const ground = cscale(I0, 3)
  return {
    kind,
    label: FAULT_LABELS[kind],
    connection,
    Z1,
    Z2,
    Z0,
    Zf: zf,
    seq: [I0, I1, I2],
    seqMag: [cabs(I0), cabs(I1), cabs(I2)],
    seqAng: [carg(I0), carg(I1), carg(I2)],
    phase: phase.abc,
    phaseMag: phase.mag,
    phaseAng: phase.ang,
    ground,
    groundMag: cabs(ground),
    /** The fault level at the bus, in per unit of the base power. */
    level: cabs(I1) * (spec.prefault ?? 1) * (kind === '3ph' ? 3 : 1),
  }
}

/** The four faults at one bus, on one table, which is G5. */
export function faultTable(spec, opts = {}) {
  return FAULT_KINDS.map((kind) => faultStudy(spec, { ...opts, kind }))
}

/**
 * The ratio Z_0/Z_1 at which a single line-to-ground fault overtakes a
 * three-phase fault in phase current.
 *
 * With Z_1 = Z_2 the line-to-ground current is 3E/(2Z_1 + Z_0) and the
 * three-phase current is E/Z_1, so the two are equal at Z_0 = Z_1 and the
 * ground fault is the larger below it. The root is found on the closed forms
 * rather than assumed, so an unequal Z_2 moves it and the answer follows.
 */
export function crossoverRatio(spec) {
  const at = (ratio) => {
    const s = { ...spec, line: { ...spec.line, X0: 0 }, transformer: { ...spec.transformer, connection: 'wyeg-wyeg' } }
    const z1 = sequenceImpedances(spec).Z1[1]
    const forced = {
      ...spec,
      generator: { ...spec.generator, X0: ratio * z1 },
      transformer: { ...spec.transformer, connection: 'wyeg-wyeg' },
      line: { ...spec.line, X0: 0 },
    }
    const zi = sequenceImpedances(forced)
    zi.Z0 = C(0, ratio * z1)
    const three = cabs(cdiv(C(spec.prefault ?? 1), zi.Z1))
    const slg = cabs(cscale(cdiv(C(spec.prefault ?? 1), cadd(cadd(zi.Z1, zi.Z2), zi.Z0)), 3))
    return { ratio, three, slg, difference: slg - three }
  }
  let lo = 0.05
  let hi = 5
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2
    if (at(mid).difference > 0) lo = mid
    else hi = mid
  }
  return { ratio: (lo + hi) / 2, at }
}
