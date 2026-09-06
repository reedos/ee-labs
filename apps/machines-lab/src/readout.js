// The meters, and the units they are read in.
//
// `fmt` from `packages/ui` puts an SI prefix on every number. That is right
// for volts, amps, ohms and seconds, and wrong for the two kinds of number
// this lab is full of.
//
// **A speed is read off a nameplate.** It is 3648 rev/min, and "3.648
// krev/min" is not a unit anyone writes. The prefix also eats the digits the
// lessons quote: the no-load speed 3819.7 rev/min printed as "3.82 krev/min",
// and a reader checking the note against the screen had nothing to check.
// Minutes, degrees, kelvins and degrees Celsius are the same case.
//
// **A ratio has no unit for a prefix to attach to.** Efficiency 0.8873 printed
// as "887.3 m" and slip 0.02767 as "27.67 m". Neither is a number, and the
// milli reads as a unit that is not there. Efficiency, slip, regulation and
// the two breakdown fractions are percentages in every textbook and in every
// lesson here, so they are shown as percentages. Power factor and the two loop
// ratios are plain numbers, because that is how they are quoted.
//
// `readout.test.js` walks every meter of every experiment and fails on either
// mistake, so a new quantity cannot reintroduce them.

import { fmt } from '@ee-labs/ui'

/** Units that never take an SI prefix. */
export const PLAIN = new Set(['rev/min', '°', '°C', 'K', 'min', 'poles'])

/**
 * Below this, a reading is the LU solve's own rounding and not a quantity.
 *
 * An unloaded frictionless machine does exactly no useful work, and A5's
 * efficiency came off the solve as 4 × 10⁻¹⁴. A balanced three-phase set has
 * exactly no zero sequence, and D5's read 2.8 × 10⁻¹⁴. Printed at four
 * figures those became "3.996e-12 %" and "2.842e-14", which say nothing and
 * read as measurements. The brief's own rule: ratios to zero say nothing.
 */
const NOISE = 1e-9

/** Significant figures without an exponent and without a prefix. */
function sig(v, digits) {
  if (Math.abs(v) < NOISE) return '0'
  const at = Number(v.toPrecision(digits))
  // toPrecision goes exponential past 1e21 and below 1e-7. Everything below
  // the noise floor is already gone, so this is the very large case only.
  return Math.abs(at) < 1e21 ? String(at) : at.toExponential(digits - 1)
}

/**
 * One reading, in the unit the quantity is measured in.
 *
 * `'%'` marks a fraction that is shown as a percentage. `''` marks a plain
 * ratio, which keeps its digits and takes no prefix.
 */
export function reading(v, unit = '', digits = 4) {
  if (!Number.isFinite(v)) return '—'
  if (unit === '%') return `${sig(v * 100, digits)} %`
  if (unit === '') return sig(v, digits)
  if (PLAIN.has(unit)) return `${sig(v, digits)} ${unit}`
  return fmt(v, unit, digits)
}

/**
 * A relative size in words, so that no exponent reaches the page.
 *
 * The integrator's own sentence printed "6.88e-9 %", and an exponent is a
 * number a reader has to decode before they can judge it. Above a hundredth
 * of a per cent a percentage still reads, and below it the honest form is the
 * one C6's own note already uses: parts in a billion.
 */
export function parts(relative) {
  const r = Math.abs(relative)
  if (!(r > 0)) return 'nothing measurable'
  if (r >= 1e-6) return `${(r * 100).toPrecision(3)} %`
  for (const [mult, name] of [
    [1e6, 'million'],
    [1e9, 'billion'],
    [1e12, 'trillion'],
    [1e15, 'quadrillion'],
  ]) {
    const n = r * mult
    if (n >= 1) return `${n.toPrecision(3)} parts in a ${name}`
  }
  return 'below one part in a quadrillion'
}

/**
 * What the run-up integration is worth, written here rather than taken from
 * the package.
 *
 * `runUp().says` carries an exponent and a semicolon, and STYLE bans both on
 * screen. The fields behind it are the same numbers, so the sentences are
 * built from those.
 */
export function runUpSays(runUp) {
  return [
    `Fourth-order Runge–Kutta, ${runUp.steps} steps.`,
    `Richardson puts the error at ${reading(runUp.error, 'rad/s', 3)}, ${parts(runUp.relative)} of the range.`,
    'The quasi-static model needs the mechanical time constant well above the stator’s.',
    `Here the ratio is ${reading(runUp.separated, '', 3)}, and the model ${runUp.guardMet ? 'holds' : 'does not hold'}.`,
  ].join(' ')
}

/**
 * The meters each model offers, in the order a reader wants them, as
 * `[label, quantity path, unit, digits]`.
 *
 * The first entry heads the topbar, so it is the quantity the group is about.
 * An experiment may name a different one in its `lead`, which is how C2 puts
 * the synchronous speed its whole lesson is about in front of a reader whose
 * only view is the rotating field.
 */
export const METERS = {
  dc: [
    ['Speed', 'mech.rpm', 'rev/min'],
    ['Armature current', 'mech.ia', 'A'],
    ['Torque', 'mech.torque', 'N·m'],
    ['Back-EMF', 'mech.emf', 'V'],
    ['Stall torque', 'line.stall', 'N·m'],
    ['No-load speed', 'line.noLoadRpm', 'rev/min'],
    ['Electrical constant', 'tau.e', 's'],
    ['Mechanical constant', 'tau.m', 's'],
    ['Efficiency', 'op.efficiency', '%'],
  ],
  transformer: [
    ['Primary voltage', 'xf.vp', 'V'],
    ['Load voltage', 'xf.vOut', 'V'],
    ['Load current', 'xf.iLoad', 'A'],
    ['Primary current', 'xf.iPrim', 'A'],
    ['Output power', 'xf.pOut', 'W'],
    ['Copper loss', 'xf.pCu', 'W'],
    ['Core loss', 'xf.pCore', 'W'],
    ['Efficiency', 'xf.efficiency', '%'],
    ['Regulation', 'xf.regulation', '%'],
  ],
  im: [
    ['Synchronous speed', 'im.rpmSync', 'rev/min'],
    ['Shaft speed', 'im.rpm', 'rev/min'],
    ['Slip', 'im.slip', '%'],
    ['Rotor frequency', 'im.rotorHz', 'Hz'],
    ['Torque', 'im.torque', 'N·m'],
    ['Stator current', 'im.I1', 'A'],
    ['Rotor current', 'im.I2', 'A'],
    ['Power factor', 'im.pf', ''],
    ['Breakdown torque', 'im.tMax', 'N·m'],
    ['Breakdown slip', 'im.sMax', '%'],
  ],
  field: [
    ['Wave amplitude', 'field.amplitude', 'A-turns'],
    ['Synchronous speed', 'field.rpmSync', 'rev/min'],
  ],
  sync: [
    ['Power angle', 'sync.delta', '°'],
    ['Power', 'sync.P', 'W'],
    ['Torque', 'sync.torque', 'N·m'],
    ['Current', 'sync.I', 'A'],
    ['Reactive power', 'sync.Q', 'var'],
    ['Power factor', 'sync.pf', ''],
    ['Pull-out power', 'sync.pullOut', 'W'],
    ['Stability margin', 'sync.margin', ''],
  ],
  pmsm: [
    ['Torque constant', 'pmsm.kT', 'N·m/A'],
    ['Torque', 'pmsm.torque', 'N·m'],
    ['Current loop constant', 'pmsm.tauElec', 's'],
    ['Speed loop constant', 'pmsm.tauMech', 's'],
    ['Loop separation', 'pmsm.separation', ''],
  ],
  dq: [
    ['d', 'dq.d', ''],
    ['q', 'dq.q', ''],
    ['Zero sequence', 'dq.zero', ''],
    ['Radius', 'dq.radius', ''],
    ['Power, three phase', 'dq.pAbc', 'W'],
    ['Power, dq frame', 'dq.pDq', 'W'],
  ],
  losses: [
    ['Output', 'loss.pOut', 'W'],
    ['Copper loss', 'loss.pCu', 'W'],
    ['Core loss', 'loss.pCore', 'W'],
    ['Friction and windage', 'loss.pFriction', 'W'],
    ['Total loss', 'loss.total', 'W'],
    ['Efficiency', 'loss.efficiency', '%'],
    ['Temperature rise', 'heat.rise', 'K'],
    ['Final temperature', 'heat.final', '°C'],
    ['Headroom', 'heat.headroom', 'K'],
  ],
  sat: [
    ['Flux linkage', 'sat.lambda', 'Wb'],
    ['Incremental inductance', 'sat.L', 'H'],
    ['Knee current', 'sat.iKnee', 'A'],
    ['Linear model would give', 'sat.linear', 'Wb'],
  ],
}
