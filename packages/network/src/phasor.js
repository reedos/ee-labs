// Phasor analysis — the same stamps, at s = jω.
//
// A circuit driven by sinusoids at one frequency settles, once the natural
// response has died, into sinusoids at that frequency. Writing each as a
// phasor (complex.js: X stands for Im{X e^{jωt}}) turns the differential
// equations into algebra: a capacitor is the admittance jωC, an inductor the
// impedance jωL, and modified nodal analysis proceeds exactly as at DC with
// complex entries. Nothing new is invented here; assemble() in mna.js is
// followed stamp for stamp, and the inductor keeps a branch row (V = jωL·I)
// rather than an admittance so that ω → 0 is a wire and not a division.
//
// The claim that makes this honest is checked in phasor.test.js: the transient
// engine (transient.js), which knows nothing of phasors, is run until its
// natural response has decayed and agrees with Im{X e^{jωt}} to floating point.

import { GROUND, NetworkError, normalize } from './netlist.js'
import { SingularError, solveComplex } from './linalg.js'
import { diagnose, effective, stampsOf } from './mna.js'
import { omegaOf, sourceAffine } from './waves.js'
import { C, asComplex, cabs, carg, cadd, cmul, conj, cdiv, cscale, csub, instant, polar } from './complex.js'

const needsCurrent = (eff) => eff.type === 'V' || eff.type === 'VCVS' || eff.type === 'OPAMP' || eff.type === 'L'

/**
 * A source's phasor at ω. A sine source at that frequency (to a part in 10⁹)
 * is amp∠φ; any other source is 0 there — at ω = 0, its constant part. The
 * sources at other frequencies are not lost: the response to each frequency
 * is its own solve, and the time-domain total is their sum (superposition).
 * `opts.sources` overrides with explicit phasors; `opts.anyFreq` takes every
 * sine source at its amp∠φ whatever ω is asked for — the sweep's question,
 * "what if the source were at this frequency?".
 */
export function sourcePhasor(e, omega, opts = {}) {
  if (opts.sources && e.id in opts.sources) return asComplex(opts.sources[e.id])
  const w = e.wave || { kind: 'dc', value: e.value }
  if (omega === 0) return C(sourceAffine(e, 0).u0)
  if (w.kind !== 'sine') return C(0)
  const wo = omegaOf(w)
  if (!opts.anyFreq && Math.abs(wo - omega) > 1e-9 * omega) return C(0)
  return polar(w.amp, w.phase || 0)
}

/** The effective element for an AC stamp: reactive parts keep their type; everything else as at DC. */
function effectiveAC(e, omega, opts) {
  if (omega === 0) return stampsOf(e, opts)
  if (e.type === 'C' || e.type === 'L') return [e]
  return stampsOf(e, opts)
}

/**
 * Assemble the complex system M X = R at angular frequency ω. Returns
 * `{ M, r, unknowns, currentIdx, effs, omega }`, M and r with [re, im] entries.
 */
export function assembleAC(norm, omega, opts = {}) {
  const effs = norm.elements.flatMap((e) => effectiveAC(e, omega, opts))
  const currentIdx = new Map()
  let m = norm.n
  for (const eff of effs) if (needsCurrent(eff)) currentIdx.set(eff.id, m++)
  const M = Array.from({ length: m }, () => Array.from({ length: m }, () => C(0)))
  const r = Array.from({ length: m }, () => C(0))
  const ix = (node) => norm.index.get(node)
  const add = (i, j, z) => (M[i][j] = cadd(M[i][j], z))
  const addY = (a, b, y) => {
    const ia = ix(a)
    const ib = ix(b)
    if (ia >= 0) add(ia, ia, y)
    if (ib >= 0) add(ib, ib, y)
    if (ia >= 0 && ib >= 0) {
      add(ia, ib, cscale(y, -1))
      add(ib, ia, cscale(y, -1))
    }
  }
  const inject = (node, I) => {
    const k = ix(node)
    if (k >= 0) r[k] = cadd(r[k], I)
  }
  const branch = (row, a, b) => {
    const ia = ix(a)
    const ib = ix(b)
    if (ia >= 0) {
      add(ia, row, C(1))
      add(row, ia, C(1))
    }
    if (ib >= 0) {
      add(ib, row, C(-1))
      add(row, ib, C(-1))
    }
  }

  for (const eff of effs) {
    const [a, b] = eff.nodes
    switch (eff.type) {
      case 'OPEN':
        break
      case 'R':
        if (!(eff.value > 0)) throw new NetworkError('value', `${eff.id}: a resistor needs a positive resistance`)
        addY(a, b, C(1 / eff.value))
        break
      case 'C':
        if (!(eff.value > 0)) throw new NetworkError('value', `${eff.id}: a capacitor needs a positive capacitance`)
        addY(a, b, C(0, omega * eff.value))
        break
      case 'L': {
        // V_a − V_b − jωL·I = 0: the inductor's law as a row, with I an unknown.
        if (!(eff.value > 0)) throw new NetworkError('value', `${eff.id}: an inductor needs a positive inductance`)
        const row = currentIdx.get(eff.id)
        branch(row, a, b)
        add(row, row, C(0, -omega * eff.value))
        break
      }
      case 'I': {
        const I = sourcePhasor(eff, omega, opts)
        inject(a, cscale(I, -1))
        inject(b, I)
        break
      }
      case 'V': {
        const row = currentIdx.get(eff.id)
        branch(row, a, b)
        // A wire, a closed switch or an inductor at ω = 0 arrives here as a
        // 0 V source with no wave, and reads as the phasor 0.
        r[row] = sourcePhasor(eff, omega, opts)
        break
      }
      case 'VCVS': {
        const row = currentIdx.get(eff.id)
        branch(row, a, b)
        const [c, d] = eff.ctrl
        if (ix(c) >= 0) add(row, ix(c), C(-eff.gain))
        if (ix(d) >= 0) add(row, ix(d), C(eff.gain))
        break
      }
      case 'VCCS': {
        const [c, d] = eff.ctrl
        const g = eff.gain
        const ia = ix(a)
        const ib = ix(b)
        const ic = ix(c)
        const id = ix(d)
        if (ia >= 0 && ic >= 0) add(ia, ic, C(g))
        if (ia >= 0 && id >= 0) add(ia, id, C(-g))
        if (ib >= 0 && ic >= 0) add(ib, ic, C(-g))
        if (ib >= 0 && id >= 0) add(ib, id, C(g))
        break
      }
      case 'CCCS': {
        const row = currentIdx.get(eff.over)
        if (row === undefined)
          throw new NetworkError('ctrl', `${eff.id} reads the current of ${eff.over}, which carries no current unknown`)
        const ia = ix(a)
        const ib = ix(b)
        if (ia >= 0) add(ia, row, C(eff.gain))
        if (ib >= 0) add(ib, row, C(-eff.gain))
        break
      }
      case 'OPAMP': {
        const row = currentIdx.get(eff.id)
        const out = ix(a)
        if (out >= 0) add(out, row, C(1))
        const [p, q] = eff.ctrl
        if (ix(p) >= 0) add(row, ix(p), C(1))
        if (ix(q) >= 0) add(row, ix(q), C(-1))
        break
      }
      default:
        throw new NetworkError('kind', `Cannot stamp ${eff.type}`)
    }
  }
  const unknowns = [
    ...norm.nodeNames.map((node) => ({ kind: 'v', node })),
    ...[...currentIdx.entries()].sort((x, y) => x[1] - y[1]).map(([id]) => ({ kind: 'i', id })),
  ]
  return { M, r, unknowns, currentIdx, effs, omega, opts }
}

/**
 * The structural checks, for the AC circuit: at ω > 0 every capacitor and
 * inductor conducts, so they are shown to diagnose() as resistors.
 */
function diagnoseAC(norm, omega, opts) {
  if (omega === 0) return diagnose(norm, opts)
  const asR = (e) => (e.type === 'C' || e.type === 'L' ? { ...e, type: 'R', value: 1 } : e)
  return diagnose({ ...norm, elements: norm.elements.map(asR) }, opts)
}

/**
 * The sinusoidal steady state at angular frequency ω: phasors of every node
 * voltage and every element's voltage and current, complex power per element,
 * and `at(t)` for the instantaneous readout Im{X e^{jωt}}.
 */
export function solveAC(net, omega, opts = {}) {
  if (!(omega >= 0)) throw new NetworkError('value', 'The frequency must be zero or positive')
  const norm = net.nodeNames ? net : normalize(net)
  const why = diagnoseAC(norm, omega, opts)
  if (why) throw why
  const sys = assembleAC(norm, omega, opts)
  let x
  try {
    x = solveComplex(sys.M, sys.r)
  } catch (err) {
    if (err instanceof SingularError)
      throw new NetworkError(
        'singular',
        'These equations have no unique solution at this frequency: some voltage or current is left undetermined by the circuit as drawn.',
        { pivot: err.pivot },
      )
    throw err
  }
  return readoutAC(norm, sys, x)
}

/** Turn a complex solution vector into phasors, powers and an instantaneous evaluator. */
export function readoutAC(norm, sys, x) {
  const { omega } = sys
  const v = { [GROUND]: C(0) }
  norm.nodeNames.forEach((n, k) => (v[n] = x[k]))
  const vAt = (n) => v[n]
  const i = {}
  const volt = {}
  const s = {}
  for (const eff of sys.effs) {
    const [a, b] = eff.nodes
    const vab = eff.type === 'OPAMP' ? vAt(a) : csub(vAt(a), vAt(b))
    let cur
    switch (eff.type) {
      case 'OPEN':
        cur = C(0)
        break
      case 'R':
        cur = cscale(vab, 1 / eff.value)
        break
      case 'C':
        cur = cmul(vab, C(0, omega * eff.value))
        break
      case 'I':
        cur = sourcePhasor(eff, omega, sys.opts)
        break
      case 'VCCS':
        cur = cscale(csub(vAt(eff.ctrl[0]), vAt(eff.ctrl[1])), eff.gain)
        break
      case 'CCCS':
        cur = cscale(x[sys.currentIdx.get(eff.over)], eff.gain)
        break
      default:
        cur = x[sys.currentIdx.get(eff.id)]
    }
    i[eff.id] = cur
    volt[eff.id] = vab
    // Complex power with amplitude phasors: S = ½ V I*, so P = Re S is the
    // time average of v(t)·i(t) and Q = Im S the reactive part (passive sign).
    s[eff.id] = cscale(cmul(vab, conj(cur)), 0.5)
  }
  // KCL at every node from the element laws, not from the matrix.
  const residual = {}
  let maxResidual = 0
  for (const node of norm.nodeNames) {
    let sum = C(0)
    for (const eff of sys.effs) {
      if (eff.type === 'OPAMP') {
        if (eff.nodes[0] === node) sum = cadd(sum, i[eff.id])
        continue
      }
      if (eff.nodes[0] === node) sum = cadd(sum, i[eff.id])
      if (eff.nodes[1] === node) sum = csub(sum, i[eff.id])
    }
    residual[node] = sum
    maxResidual = Math.max(maxResidual, cabs(sum))
  }
  const sTotal = Object.values(s).reduce((acc, w) => cadd(acc, w), C(0))

  /** The instantaneous readout at time t — real numbers, in the DC readout's shape. */
  const at = (t) => {
    const rv = {}
    const ri = {}
    const rvolt = {}
    const rp = {}
    for (const n in v) rv[n] = instant(v[n], omega, t)
    for (const id in i) {
      ri[id] = instant(i[id], omega, t)
      rvolt[id] = instant(volt[id], omega, t)
      rp[id] = rvolt[id] * ri[id]
    }
    return { t, v: rv, i: ri, volt: rvolt, p: rp }
  }

  return { omega, v, i, volt, s, sTotal, residual, maxResidual, x, sys, norm, at }
}

// ------------------------------------------------------------ measures

/** Magnitude and angle (radians) of a phasor, and its RMS value. */
export const phasorMeasures = (X) => ({ mag: cabs(X), ang: carg(X), rms: cabs(X) / Math.SQRT2 })

/**
 * AC power measures for one element from its voltage and current phasors:
 * P (W, average), Q (var), |S| (VA), power factor and the angle between v and i.
 */
export function acPower(V, I) {
  const S = cscale(cmul(V, conj(I)), 0.5)
  const P = S[0]
  const Q = S[1]
  const apparent = cabs(S)
  return { P, Q, S, apparent, pf: apparent > 0 ? P / apparent : 1, phi: carg(V) - carg(I) }
}

/**
 * The impedance a source sees: its voltage over the current it DELIVERS. The
 * readout's current is passive (into the + terminal), so the delivered current
 * is its negative.
 */
export function drivingPointZ(ac, sourceId) {
  return cdiv(ac.volt[sourceId], cscale(ac.i[sourceId], -1))
}

/**
 * A frequency response: `fn(ac, ω)` evaluated on a log grid from ω₁ to ω₂
 * (points inclusive), every sine source driving at each ω. Returns
 * { omega, value } arrays, value complex.
 */
export function sweepAC(net, omega1, omega2, points, fn, opts = {}) {
  opts = { anyFreq: true, ...opts }
  const norm = net.nodeNames ? net : normalize(net)
  const omega = new Float64Array(points)
  const value = []
  for (let k = 0; k < points; k++) {
    const w = omega1 * Math.pow(omega2 / omega1, k / (points - 1))
    omega[k] = w
    value.push(fn(solveAC(norm, w, opts), w))
  }
  return { omega, value }
}
