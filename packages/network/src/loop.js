// Loop gain, by breaking the loop.
//
// A designer measures a feedback amplifier's loop gain the same way every
// time: kill the input, cut the loop at one point, drive one side with a test
// signal, and read what comes back round. This file does that arithmetic on
// the small-signal netlist, at the one dependent source the experiment names.
//
//   returnRatioAt(net, source, ω)   the return ratio T at one frequency
//   returnRatio(net, source, …)     T(s) as polynomials, for `@ee-labs/systems`
//   blackman(net, source, …)        A_∞, T and the direct transmission d, and
//                                   the closed-loop gain A_∞·T/(1+T) + d
//
// Blackman's form is what replaces the two-port analysis of feedback (the
// plan's non-goal). It needs no assumption about which topology the loop is:
// series or shunt, voltage or current, the same three numbers describe it.
//
// A_∞ is computed the long way round, from the gain at two different values of
// the controlled source, rather than read off the same solve T came from. That
// is deliberate: it makes the agreement between Blackman's form and the direct
// solve a check of both rather than an identity.

import { GROUND, NetworkError, normalize } from './netlist.js'
import { solveDC } from './mna.js'
import { solveAC } from './phasor.js'
import { readOutput, readOutputAC, transferOf } from './transfer.js'
import { C, cabs, cadd, cdiv, cmul, cscale, csub } from './complex.js'

const CONTROLLED = new Set(['VCCS', 'VCVS'])

/** The element the loop is broken at, checked. */
function loopSource(norm, id) {
  const e = norm.elements.find((x) => x.id === id)
  if (!e) throw new NetworkError('value', `${id} is not an element of this circuit`)
  if (e.type === 'OPAMP')
    throw new NetworkError(
      'loop-nullor',
      `${id} is an ideal op-amp, whose gain is infinite, so its return ratio is infinite too and 1 + T carries no information. Give it a finite gain — the macro's A₀ — and the loop has a number.`,
      { element: id },
    )
  if (!CONTROLLED.has(e.type))
    throw new NetworkError('value', `${id} is a ${e.type}. A return ratio is the property of a controlled source, and this circuit's loop has to be broken at one.`)
  return e
}

/** Every independent source killed: a voltage source shorted, a current source opened. */
const killed = (elements) =>
  elements.map((e) => (e.type === 'V' ? { ...e, value: 0, wave: undefined } : e.type === 'I' ? { ...e, value: 0, wave: undefined } : e))

/**
 * The netlist with the loop cut at `e`: the controlled source replaced by an
 * independent one carrying what a unit of its own control would have made it
 * deliver, and every independent source killed.
 */
function broken(norm, e, testId) {
  const drive = e.type === 'VCCS' ? { type: 'I', id: testId, nodes: e.nodes, value: e.gain } : { type: 'V', id: testId, nodes: e.nodes, value: e.gain }
  return { elements: killed(norm.elements.filter((x) => x.id !== e.id)).concat([drive]) }
}

/**
 * The return ratio of one controlled source at one frequency, as [re, im].
 *
 * Drive the loop with a unit of the source's own controlling signal, and read
 * what returns to its control terminals. T is the negative of that, so that a
 * loop which opposes its own drive — negative feedback — has T positive and
 * 1 + T greater than one.
 */
export function returnRatioAt(net, source, omega = 0) {
  const norm = net.nodeNames ? net : normalize(net)
  const e = loopSource(norm, source)
  const testId = `${source}.test`
  const cut = broken(norm, e, testId)
  const [c, d] = e.ctrl
  if (omega === 0) {
    const sol = solveDC(cut)
    return C(-(sol.v[c] - sol.v[d]))
  }
  const sources = {}
  for (const x of cut.elements) if (x.type === 'V' || x.type === 'I') sources[x.id] = x.id === testId ? [e.gain, 0] : [0, 0]
  const ac = solveAC(cut, omega, { sources })
  return cscale(csub(ac.v[c] ?? C(0), ac.v[d] ?? C(0)), -1)
}

/**
 * T(s) as polynomials, in the form `@ee-labs/systems` takes. This is what
 * crosses to Control Lab as a plant, and its margins there are the
 * amplifier's margins here.
 */
export function returnRatio(net, source, opts = {}) {
  const norm = net.nodeNames ? net : normalize(net)
  const e = loopSource(norm, source)
  const testId = `${source}.test`
  const cut = broken(norm, e, testId)
  const tf = transferOf(cut, { input: testId, output: { across: e.ctrl }, ...opts })
  // The test source carries `gain` per unit of control, and T is the negative
  // of what returns, so both factors land on the numerator.
  return { ...tf, b: tf.b.map((v) => -e.gain * v), input: source, output: { across: e.ctrl } }
}

/**
 * Blackman's decomposition at one frequency: the closed-loop gain from
 * `input` to `output` written as A_∞·T/(1 + T) + d.
 *
 *   d     the direct transmission: the gain with the controlled source dead
 *   A_∞   the gain with the controlled source infinite, found from the gain at
 *         two finite values rather than from the same solve T came from
 *   T     the return ratio, from the broken loop
 *   direct the closed-loop gain solved straight, for the comparison
 */
export function blackman(net, source, { input, output, omega = 0 } = {}) {
  const norm = net.nodeNames ? net : normalize(net)
  const e = loopSource(norm, source)
  const at = (gain) => gainOf(norm, e, gain, { input, output, omega })
  const d = at(0)
  const h1 = at(e.gain)
  const h2 = at(100 * e.gain)
  // With u = T at the element's own gain, H(k) = d + (A∞ − d)·u/(1 + u), and
  // u scales with k. Two gains and the dead one pin both unknowns exactly.
  const r = cdiv(csub(h1, d), csub(h2, d))
  const u = cdiv(csub(C(1), cscale(r, 100)), cscale(csub(r, C(1)), 100))
  const ainf = cadd(d, cdiv(cmul(csub(h1, d), cadd(C(1), u)), u))
  const T = returnRatioAt(norm, source, omega)
  const closed = cadd(cmul(ainf, cdiv(T, cadd(C(1), T))), d)
  return { T, Ainf: ainf, d, closed, direct: h1, fromGains: u }
}

/** The gain from `input` to `output` with one controlled source set to `gain`. */
function gainOf(norm, e, gain, { input, output, omega }) {
  const elements = norm.elements.map((x) => (x.id === e.id ? { ...x, gain } : x))
  if (omega === 0) {
    const sources = {}
    for (const x of elements) if (x.type === 'V' || x.type === 'I') sources[x.id] = x.id === input ? 1 : 0
    return C(readOutput(solveDC({ elements }, { sources }), output))
  }
  const sources = {}
  for (const x of elements) if (x.type === 'V' || x.type === 'I') sources[x.id] = x.id === input ? [1, 0] : [0, 0]
  return readOutputAC(solveAC({ elements }, omega, { sources }), output)
}

/** Gain and phase margins of a loop gain given as a function of frequency in hertz. */
export function marginsOf(Tat, { lo = 1e-3, hi = 1e12 } = {}) {
  const mag = (f) => cabs(Tat(f))
  const phase = (f) => {
    const z = Tat(f)
    return (Math.atan2(z[1], z[0]) * 180) / Math.PI
  }
  const cross = (fn, target) => {
    let a = lo
    let b = hi
    if ((fn(a) - target) * (fn(b) - target) > 0) return null
    for (let k = 0; k < 300; k++) {
      const m = Math.sqrt(a * b)
      if ((fn(a) - target) * (fn(m) - target) <= 0) b = m
      else a = m
    }
    return Math.sqrt(a * b)
  }
  const fc = cross((f) => 20 * Math.log10(mag(f)), 0)
  const pm = fc == null ? null : 180 + phase(fc)
  return { crossover: fc, pm }
}
