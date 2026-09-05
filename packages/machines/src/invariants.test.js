import { describe, it, expect } from 'vitest'
import { complex as cx, energies, solveAC, transient } from '@ee-labs/network'
import { dcNetlist, line, operating, powerAudit, timeConstants } from './dc.js'
import { idealTransformer } from './transformer.js'
import { GROUND } from '@ee-labs/network'
import { breakdown, imOf, perPhase, torqueCurve, torqueOfSlip } from './induction.js'
import { CONVENTIONS, dq0, invDq0, power } from './dq.js'
import { integrate } from './integrate.js'

// The seven invariants the plan names, fuzzed. Each one is a claim about the
// whole package rather than about one function, and each is checked over
// random machines rather than at one operating point.

const rand = (lo, hi) => lo + Math.random() * (hi - lo)
const logRand = (lo, hi) => Math.pow(10, rand(Math.log10(lo), Math.log10(hi)))
const rms = (X) => cx.cabs(X) / Math.SQRT2

/**
 * A random but physical DC machine.
 *
 * The two time constants are drawn as a ratio rather than independently. A
 * machine whose mechanical constant is a million times its electrical one is
 * not a machine anybody builds, and the propagator would be asked to hold
 * e^{−10⁶} beside e^{−1} in one matrix. The ratio here spans five to two
 * hundred, which is the range a drives course works in.
 */
const someDC = () => {
  const Ra = logRand(0.05, 20)
  const tauE = logRand(5e-4, 2e-2)
  const k = logRand(0.01, 2)
  const tauM = tauE * logRand(5, 200)
  return {
    Va: rand(6, 400),
    Ra,
    La: tauE * Ra,
    k,
    J: (tauM * k * k) / Ra,
    B: Math.random() < 0.3 ? 0 : logRand(1e-6, 1e-3),
    TL: 0,
    rs: 1,
  }
}

/** The slowest and fastest roots of a machine, as rates. */
const rates = (p) => {
  const re = timeConstants(p).roots.map((r) => Math.abs(r.re))
  return { slow: Math.min(...re), fast: Math.max(...re) }
}

describe('invariant 1: the power balance closes, segment by segment', () => {
  it('holds at every sample of a fuzzed run-up', () => {
    for (let t = 0; t < 12; t++) {
      const p = someDC()
      const op = operating(p)
      p.TL = 0.4 * op.torque
      const tr = transient(dcNetlist({ ...p, drive: { kind: 'step', from: 0, to: p.Va } }), {
        tEnd: 6 / rates(p).slow,
        points: 121,
      })
      let scale = 0
      for (const s of tr.samples) scale = Math.max(scale, Math.abs(powerAudit(s.sol, p).supplied))
      for (const s of tr.samples) {
        const a = powerAudit(s.sol, p)
        expect(Math.abs(a.gap) / (scale + 1e-30)).toBeLessThan(1e-10)
        expect(Math.abs(a.coupled) / (scale + 1e-30)).toBeLessThan(1e-10)
      }
    }
  })

  it('closes the energy ledger, on a grid that resolves the fastest transient', () => {
    // The ledger's two integrals are exact on the exact waveform between
    // samples. A grid too coarse to resolve the electrical transient is not
    // the ledger being wrong, it is the grid, so the window here is sized by
    // the fast root. dc.test.js checks the same ledger over the mechanical
    // window with a grid sized for it.
    for (let t = 0; t < 6; t++) {
      const p = someDC()
      p.TL = 0.4 * operating(p).torque
      const tEnd = 12 / rates(p).fast
      const tr = transient(dcNetlist({ ...p, drive: { kind: 'step', from: 0, to: p.Va } }), { tEnd, points: 601 })
      const e = energies(tr)
      const scale = Math.max(...e.points.map((q) => Math.abs(q.supplied)), 1e-30)
      for (const q of e.points) expect(Math.abs(q.gap) / scale).toBeLessThan(1e-9)
    }
  })
})

describe('invariant 2: the steady-state curve is the time solution settled', () => {
  it('agrees on speed and current over a fuzzed machine', () => {
    for (let t = 0; t < 15; t++) {
      const p = someDC()
      p.TL = rand(0, 0.7) * operating(p).torque
      const op = operating(p)
      if (!(op.omega > 1e-6)) continue
      const tEnd = 45 / rates(p).slow
      const tr = transient(dcNetlist({ ...p, drive: { kind: 'step', from: 0, to: p.Va } }), { tEnd, points: 81 })
      const end = tr.at(tEnd)
      // Against the machine's own scale, not against the answer: an unloaded
      // frictionless machine settles at exactly no current, and a ratio to
      // zero says nothing.
      const l = line(p)
      expect(Math.abs(end.sol.v.wm - op.omega) / l.noLoad).toBeLessThan(1e-8)
      expect(Math.abs(end.sol.i.Ra - op.ia) / (p.Va / p.Ra)).toBeLessThan(1e-8)
    }
  })
})

describe('invariant 3: the dq transform inverts and carries power', () => {
  for (const name of Object.keys(CONVENTIONS)) {
    it(`${name}: round-trips and obeys its stated power law`, () => {
      for (let k = 0; k < 300; k++) {
        const v = [rand(-1e3, 1e3), rand(-1e3, 1e3), rand(-1e3, 1e3)]
        const i = [rand(-1e2, 1e2), rand(-1e2, 1e2), rand(-1e2, 1e2)]
        const theta = rand(-50, 50)
        const back = invDq0(dq0(v, theta, name), theta, name)
        for (let j = 0; j < 3; j++) expect(back[j] / v[j]).toBeCloseTo(1, 9)
        const p = power(v, i, theta, name)
        expect(p.pDq / p.pAbc).toBeCloseTo(1, 9)
      }
    })
  }
})

describe('invariant 4: the ideal transformer is exact, and Tellegen holds across it', () => {
  const bare = (n, RL, rs) => ({
    elements: [
      { type: 'V', id: 'Vs', nodes: ['p', GROUND], value: 0, wave: { kind: 'sine', amp: 340, freq: 50 } },
      { type: 'R', id: 'Rsrc', nodes: ['p', 'q'], value: 0.5 },
      ...idealTransformer('T1', ['q', GROUND], ['s', GROUND], n, rs).elements,
      { type: 'R', id: 'RL', nodes: ['s', GROUND], value: RL },
    ],
  })

  it('holds both ratios and no power at all, over a fuzzed transformer', () => {
    for (let t = 0; t < 60; t++) {
      const n = logRand(0.1, 20)
      const RL = logRand(0.1, 1e4)
      // The sense resistance goes with the branch it senses, per port.js.
      const ac = solveAC(bare(n, RL, RL), 2 * Math.PI * 50)
      expect(Math.abs((rms(ac.v.s) * n) / rms(ac.v.q) - 1)).toBeLessThan(1e-9)
      expect(Math.abs((rms(ac.i.Rsrc) * n) / rms(ac.i.RL) - 1)).toBeLessThan(1e-9)
      const S = ['T1.Es', 'T1.sen.rs', 'T1.sen.e', 'T1.Gp'].reduce((acc, id) => cx.cadd(acc, ac.s[id]), cx.C(0))
      expect(cx.cabs(S) / cx.cabs(ac.s.RL)).toBeLessThan(1e-10)
    }
  })
})

describe('invariant 5: the sense resistance never reaches an answer', () => {
  // With one stated proviso, measured in port.test.js: R_s must not sit far
  // BELOW the branch's own resistance, or the solve loses digits to a huge
  // conductance beside small ones. Every sweep here starts at the circuit's
  // own scale and goes up, which is where a caller should choose from.
  it('gives the same transformer solution over eight decades of it', () => {
    const of = (rs) =>
      solveAC(
        {
          elements: [
            { type: 'V', id: 'Vs', nodes: ['p', GROUND], value: 0, wave: { kind: 'sine', amp: 340, freq: 50 } },
            ...idealTransformer('T1', ['p', GROUND], ['s', GROUND], 3.3, rs).elements,
            { type: 'R', id: 'RL', nodes: ['s', GROUND], value: 12 },
          ],
        },
        2 * Math.PI * 50,
      )
    const ref = of(12)
    for (const rs of [1, 12, 1e3, 1e5, 1e6]) {
      expect(Math.abs(rms(of(rs).i.RL) / rms(ref.i.RL) - 1)).toBeLessThan(1e-8)
    }
  })

  it('gives the same DC machine operating point over five decades of it', () => {
    const p = { ...someDC(), TL: 0 }
    const base = operating(p)
    const tEnd = 45 / rates(p).slow
    for (const f of [1, 10, 1e3, 1e5]) {
      const tr = transient(dcNetlist({ ...p, rs: p.Ra * f, drive: { kind: 'step', from: 0, to: p.Va } }), { tEnd, points: 41 })
      expect(Math.abs(tr.at(tEnd).sol.v.wm / base.omega - 1)).toBeLessThan(1e-8)
    }
  })
})

describe('invariant 6: the induction machine at rest and at breakdown', () => {
  it('makes exactly no torque at zero slip, over a fuzzed machine', () => {
    for (let t = 0; t < 30; t++) {
      const spec = { R1: rand(0.2, 6), X1: rand(0.4, 8), R2: rand(0.2, 6), X2: rand(0.4, 8), Xm: rand(15, 150) }
      expect(torqueOfSlip(spec, 0)).toBe(0)
      // …and approaches it from above, linearly in the slip.
      const a = torqueOfSlip(spec, 1e-9)
      const b = torqueOfSlip(spec, 2e-9)
      expect(b / a).toBeCloseTo(2, 6)
    }
  })

  it('peaks at the closed-form breakdown, and the phasor circuit agrees there', () => {
    for (let t = 0; t < 20; t++) {
      const spec = { R1: rand(0.2, 6), X1: rand(0.4, 8), R2: rand(0.2, 6), X2: rand(0.4, 8), Xm: rand(15, 150) }
      const m = imOf(spec)
      const bd = breakdown(spec)
      const curve = torqueCurve(spec, { from: Math.max(1, 2 * bd.sMax), to: 1e-4, points: 6001 })
      expect(bd.tMax / Math.max(...curve.torque)).toBeCloseTo(1, 4)
      const ac = solveAC(perPhase(spec, bd.sMax), m.omega)
      const I2 = rms(ac.i.R2s)
      expect((3 * I2 * I2 * (m.R2 / bd.sMax)) / m.omegaSync / bd.tMax).toBeCloseTo(1, 9)
    }
  })
})

describe('invariant 7: every integration reports its error and is guarded', () => {
  it('reports a Richardson error that shrinks as the fourth power of the step', () => {
    // A stable nonlinear equation: the cubic pulls the state back from
    // either side, so the trajectory exists over the whole window.
    const f = (t, y) => [Math.cos(t) - 0.3 * y[0] ** 3]
    const coarse = integrate(f, [0], 12, { steps: 200, tol: 1 })
    const fine = integrate(f, [0], 12, { steps: 400, tol: 1 })
    expect(coarse.error).toBeGreaterThan(fine.error)
    expect(Math.log2(coarse.error / fine.error)).toBeGreaterThan(3.5)
    expect(coarse.says).toMatch(/Richardson/)
  })

  it('refuses rather than returning an answer it cannot state', () => {
    const f = (t, y) => [Math.cos(t) - 0.3 * y[0] ** 3]
    expect(() => integrate(f, [0], 12, { steps: 8, tol: 1e-12 })).toThrow(/guard/)
    expect(() => integrate(f, [0], 12, { steps: 8, tol: 1e-12 })).toThrow(/steps would meet it/)
  })

  it('refuses a window and a step count it cannot work with', () => {
    const f = () => [0]
    expect(() => integrate(f, [0], 0)).toThrow(/window/)
    expect(() => integrate(f, [0], 1, { steps: 2 })).toThrow(/four steps/)
  })
})
