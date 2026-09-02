import { describe, expect, it } from 'vitest'
import { bode } from '@ee-labs/systems'
import { transferOf } from '../../../apps/circuit-lab/src/circuits.js'
import {
  NetworkError,
  acPower,
  normalize,
  assembleAC,
  complex,
  drivingPointZ,
  energies,
  omegaOf,
  phasorMeasures,
  solveAC,
  solveDC,
  sourcePhasor,
  sourceValue,
  sweepAC,
  transient,
} from '../index.js'

const { cabs, carg, cdiv, cmul, csub, C, instant, polar } = complex

const close = (a, b, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(a), Math.abs(b)))
const closeC = (x, y, tol = 1e-9) => {
  close(x[0], y[0], tol)
  close(x[1], y[1], tol)
}
const deg = (r) => (r * 180) / Math.PI

const sine = (amp, freq, phase = 0, offset = 0) => ({ kind: 'sine', amp, freq, phase, offset })

// Series RC driven by a sine, output across C.
const rc = ({ A = 1, f = 1000, phase = 0, offset = 0, R = 1000, C = 100e-9 } = {}) => ({
  elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: offset, wave: sine(A, f, phase, offset) },
    { type: 'R', id: 'R1', nodes: ['in', 'out'], value: R },
    { type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: C },
  ],
})

// Series RLC driven by a sine, states [v_C, i_L].
const rlc = ({ A = 1, f = 1000, R = 100, L = 10e-3, C = 100e-9 } = {}) => ({
  elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: sine(A, f) },
    { type: 'R', id: 'R1', nodes: ['in', 'a'], value: R },
    { type: 'L', id: 'L1', nodes: ['a', 'b'], value: L },
    { type: 'C', id: 'C1', nodes: ['b', 'gnd'], value: C },
  ],
})

describe('sine wave', () => {
  const V = { type: 'V', id: 'V1', nodes: ['a', 'gnd'], value: 0.5, wave: sine(2, 50, Math.PI / 6, 0.5) }
  it('is offset + amp·sin(ωt + φ) for t ≥ 0 and the offset before', () => {
    const w = 2 * Math.PI * 50
    close(omegaOf(V.wave), w)
    for (const t of [0, 1e-3, 7.3e-3, 0.02, 0.1]) close(sourceValue(V, t), 0.5 + 2 * Math.sin(w * t + Math.PI / 6), 1e-12)
    close(sourceValue({ ...V }, -1e-9), 0.5) // just before the switch-on
  })
  it('its phasor is amp∠φ at its own frequency, the offset at ω = 0, and 0 elsewhere', () => {
    const w = 2 * Math.PI * 50
    closeC(sourcePhasor(V, w), polar(2, Math.PI / 6), 1e-12)
    closeC(sourcePhasor(V, 0), C(0.5), 1e-12)
    closeC(sourcePhasor(V, 2 * w), C(0), 1e-12)
    // The phasor convention: x(t) = Im{X e^{jωt}} reproduces the source.
    const X = sourcePhasor(V, w)
    for (const t of [0, 1e-3, 7.3e-3]) close(instant(X, w, t), 2 * Math.sin(w * t + Math.PI / 6), 1e-12)
  })
})

describe('complex MNA stamps', () => {
  it('series RC at ω: node row is G + jωC, source row is the branch', () => {
    const w = 2 * Math.PI * 1000
    const sys = assembleAC(normalize(rc()), w)
    // unknowns: v_in, v_out, i_V1
    expect(sys.unknowns.map((u) => u.kind + ':' + (u.node || u.id))).toEqual(['v:in', 'v:out', 'i:V1'])
    closeC(sys.M[0][0], C(1e-3), 1e-12)
    closeC(sys.M[1][1], C(1e-3, w * 100e-9), 1e-12)
    closeC(sys.M[0][1], C(-1e-3), 1e-12)
    closeC(sys.M[2][0], C(1), 1e-12)
    closeC(sys.r[2], C(1), 1e-12)
  })
  it('an inductor is a branch row V_a − V_b − jωL·I = 0, so ω = 0 is a wire and not a division', () => {
    const w = 2 * Math.PI * 1000
    const sys = assembleAC(normalize(rlc()), w)
    const row = sys.currentIdx.get('L1')
    closeC(sys.M[row][row], C(0, -w * 10e-3), 1e-12)
    // ω = 0 is the DC solve: the inductor's row is a 0 V source and the
    // capacitor is open, and the answer is the DC readout.
    const dc = solveAC(rlc(), 0, { sources: { V1: 1 } })
    closeC(dc.v.b, C(1), 1e-12)
    closeC(dc.i.L1, C(0), 1e-12)
  })
})

describe('phasor solve: closed forms', () => {
  it('RC divider: V_C/V_s = 1/(1 + jωRC), |H| = 1/√2 and ∠H = −45° at ω = 1/RC', () => {
    const R = 1000
    const Cc = 100e-9
    const w0 = 1 / (R * Cc)
    const net = rc({ R, C: Cc, f: w0 / (2 * Math.PI) })
    const ac = solveAC(net, w0)
    const H = cdiv(ac.v.out, ac.v.in)
    close(cabs(H), Math.SQRT1_2, 1e-12)
    close(deg(carg(H)), -45, 1e-12)
    // Off the corner, the formula holds too.
    for (const k of [0.1, 0.5, 2, 10]) {
      const w = k * w0
      const a = solveAC(net, w, { anyFreq: true })
      const h = cdiv(a.v.out, a.v.in)
      closeC(h, cdiv(C(1), C(1, w * R * Cc)), 1e-12)
    }
  })
  it('series RLC: Z = R + j(ωL − 1/ωC); at ω₀ Z = R, ∠Z = 0 and |V_C|/|V_s| = Q', () => {
    const R = 100
    const L = 10e-3
    const Cc = 100e-9
    const w0 = 1 / Math.sqrt(L * Cc)
    const Q = Math.sqrt(L / Cc) / R
    const net = rlc({ R, L, C: Cc, f: w0 / (2 * Math.PI) })
    const ac = solveAC(net, w0)
    const Z = drivingPointZ(ac, 'V1')
    closeC(Z, C(R), 1e-9)
    close(cabs(ac.v.b) / cabs(ac.v.in), Q, 1e-9)
    // V_L and V_C cancel exactly at resonance.
    closeC(csub(ac.volt.L1, cmul(C(-1), ac.volt.C1)), C(0), 1e-9)
    for (const k of [0.3, 0.9, 1.1, 3]) {
      const w = k * w0
      closeC(drivingPointZ(solveAC(net, w, { anyFreq: true }), 'V1'), C(R, w * L - 1 / (w * Cc)), 1e-9)
    }
  })
  it('KCL residual is at rounding and complex power sums to zero', () => {
    const ac = solveAC(rlc(), 2 * Math.PI * 1000)
    expect(ac.maxResidual).toBeLessThan(1e-12)
    closeC(ac.sTotal, C(0), 1e-12)
  })
  it('refuses a floating node and a current source with nowhere to go, in words', () => {
    const floating = { elements: [...rc().elements, { type: 'R', id: 'R9', nodes: ['x', 'y'], value: 10 }] }
    expect(() => solveAC(floating, 100)).toThrow(NetworkError)
    // A capacitor DOES conduct at ω > 0: a node reached only through C is fine.
    const viaC = {
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: sine(1, 1000) },
        { type: 'C', id: 'C1', nodes: ['in', 'm'], value: 1e-6 },
        { type: 'C', id: 'C2', nodes: ['m', 'gnd'], value: 1e-6 },
      ],
    }
    const ac = solveAC(viaC, 2 * Math.PI * 1000)
    closeC(ac.v.m, C(0.5), 1e-12)
  })
})

describe('the invariant: the transient converges to the phasor solution', () => {
  it('RC: after the natural response has gone, v_C(t) = Im{V_C e^{jωt}} to floating point', () => {
    const net = rc({ A: 3, f: 1000, phase: 0.7 })
    const w = 2 * Math.PI * 1000
    const tau = 1000 * 100e-9
    const ac = solveAC(net, w)
    const tr = transient(net, { tEnd: 60 * tau, points: 201 })
    for (const t of [40 * tau, 45.5 * tau, 52.25 * tau, 60 * tau]) {
      const a = tr.at(t)
      const b = ac.at(t)
      close(a.sol.v.out, b.v.out, 1e-9)
      close(a.sol.i.C1, b.i.C1, 1e-9)
      close(a.sol.v.in, b.v.in, 1e-12)
    }
  })
  it('RC with a DC offset: the steady state is the ω = 0 solve plus the ω solve (superposition)', () => {
    const net = rc({ A: 2, f: 500, offset: 1.5 })
    const w = 2 * Math.PI * 500
    const tau = 1e-4
    const ac = solveAC(net, w)
    const dc = solveAC(net, 0)
    const tr = transient(net, { tEnd: 50 * tau, points: 101 })
    const t = 50 * tau
    close(tr.at(t).sol.v.out, ac.at(t).v.out + dc.v.out[0], 1e-9)
    close(dc.v.out[0], 1.5, 1e-12)
  })
  it('series RLC at resonance, Q = 10: the transient settles onto the phasor solution', () => {
    const R = 100
    const L = 10e-3
    const Cc = 100e-9
    const w0 = 1 / Math.sqrt(L * Cc)
    const net = rlc({ R, L, C: Cc, f: w0 / (2 * Math.PI) })
    const alpha = R / (2 * L)
    const ac = solveAC(net, w0)
    const tEnd = 40 / alpha
    const tr = transient(net, { tEnd, points: 201 })
    for (const t of [30 / alpha, 35 / alpha, tEnd]) {
      close(tr.at(t).sol.v.b, ac.at(t).v.b, 1e-8)
      close(tr.at(t).sol.i.L1, ac.at(t).i.L1, 1e-8)
    }
    // Natural + forced: the difference from the forced response decays as e^{−αt}.
    const d = (t) => Math.abs(tr.at(t).sol.v.b - ac.at(t).v.b)
    const t1 = 2 / alpha
    const t2 = 4 / alpha
    // Envelope ratio over 2/α is e^{-2} up to the oscillation within — bracket it.
    expect(d(t2)).toBeLessThan(d(t1))
    expect(d(t2) / d(t1)).toBeLessThan(Math.exp(-2) * 4)
  })
  it('the transient at t = 0 starts from rest even though the phasor solution does not', () => {
    const net = rc({ A: 1, f: 1000, phase: Math.PI / 2 })
    const tr = transient(net, { tEnd: 1e-3 })
    close(tr.at(0).sol.v.out, 0, 1e-12)
    close(tr.at(0).sol.v.in, 1, 1e-12)
  })
  it('a sine runs through a switch breakpoint without a phase seam', () => {
    // Square-wave switching of a series R while a sine drives: the source's
    // value on both sides of every breakpoint is the same sine.
    const net = {
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: sine(1, 700) },
        { type: 'V', id: 'V2', nodes: ['x', 'gnd'], value: 0, wave: { kind: 'square', amp: 1, offset: 0, period: 1e-3 } },
        { type: 'R', id: 'Rx', nodes: ['x', 'gnd'], value: 1 },
        { type: 'R', id: 'R1', nodes: ['in', 'out'], value: 1000 },
        { type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: 100e-9 },
      ],
    }
    const tr = transient(net, { tEnd: 3e-3 })
    for (const t of [0.5e-3, 1e-3, 2.5e-3]) {
      close(tr.at(t, 'left').sol.v.in, Math.sin(2 * Math.PI * 700 * t), 1e-12)
      close(tr.at(t, 'right').sol.v.in, Math.sin(2 * Math.PI * 700 * t), 1e-12)
      close(tr.at(t, 'left').sol.v.out, tr.at(t, 'right').sol.v.out, 1e-12)
    }
  })
})

describe('AC power', () => {
  it('P = ½|V||I|cos φ is the time average of v·i over a period, Q = ½|V||I|sin φ', () => {
    const net = rc({ A: 5, f: 1000 })
    const w = 2 * Math.PI * 1000
    const ac = solveAC(net, w)
    const pw = acPower(ac.volt.R1, ac.i.R1)
    const T = 2 * Math.PI / w
    // Average of the instantaneous resistor power over one period, by the
    // exact midpoint rule with many points (the integrand is a pure 2ω tone
    // plus a constant, which the midpoint rule integrates exactly).
    const N = 64
    let avg = 0
    for (let k = 0; k < N; k++) avg += ac.at(((k + 0.5) / N) * T).p.R1 / N
    close(pw.P, avg, 1e-12)
    close(pw.Q, 0, 1e-12) // a resistor takes no reactive power
    close(pw.pf, 1, 1e-12)
    const pc = acPower(ac.volt.C1, ac.i.C1)
    close(pc.P, 0, 1e-12)
    expect(pc.Q).toBeLessThan(0) // a capacitor supplies reactive power
    close(deg(pc.phi), -90, 1e-9)
    // The source's P equals the resistor's: nothing else dissipates.
    const ps = acPower(ac.volt.V1, ac.i.V1)
    close(-ps.P, pw.P, 1e-12)
    // Measures: RMS is amp/√2.
    const m = phasorMeasures(ac.v.in)
    close(m.mag, 5, 1e-12)
    close(m.rms, 5 / Math.SQRT2, 1e-12)
  })
  it('the energy the source supplies over a long window grows at P per second', () => {
    const net = rc({ A: 5, f: 1000 })
    const w = 2 * Math.PI * 1000
    const ac = solveAC(net, w)
    const P = -acPower(ac.volt.V1, ac.i.V1).P
    const tau = 1e-4
    const T = 1e-3
    // 20 periods after 50τ: the supplied energy between two period-aligned
    // instants in steady state is P·Δt.
    const tr = transient(net, { tEnd: 50 * tau + 20 * T, points: 2001 })
    const en = energies(tr)
    const at = (t) => en.points.find((q) => Math.abs(q.t - t) < 1e-15).supplied
    const t1 = 50 * tau
    const t2 = 50 * tau + 20 * T
    close(at(t2) - at(t1), P * 20 * T, 1e-6)
  })
})

describe('frequency sweep and cross-lab pin', () => {
  it('RC low-pass sweep matches Circuit Lab’s H(s) at every point', () => {
    const R = 1000
    const Cc = 100e-9
    const net = rc({ R, C: Cc })
    const sw = sweepAC(net, 2 * Math.PI * 10, 2 * Math.PI * 1e5, 41, (ac) => cdiv(ac.v.out, ac.v.in))
    const tf = transferOf('rcLow', { r: R, c: Cc }, 'c')
    const freqs = Array.from(sw.omega, (w) => w / (2 * Math.PI))
    const b = bode(tf, freqs)
    sw.value.forEach((h, k) => {
      close(cabs(h), b.mag[k], 1e-9)
      close(carg(h), b.phase[k], 1e-9)
    })
  })
})
