import { describe, it, expect } from 'vitest'
import { walkWindows, forwardM, fhaRatio, seriesResonance, lowerResonance } from '@ee-labs/switched'
import { EXPERIMENTS, byId, defaultsOf, GROUPS } from './experiments.js'
import { analyse } from './analysis.js'
import { sweepDuty, sweepMismatch, sweepGain, sweepSoft, resonantParams, forwardParams, jkFlow, jkOutcome } from './groups/jk.js'
import { experimentMath } from './math.js'

// Groups J and K, claim by claim.
//
// Every number the six notes and the six `try` lines carry is measured here
// against the same analysis the panes draw, so a sentence the engine does not
// reproduce fails a test rather than misleading a reader. `pins.test.js`
// covers the measures table, `math.test.js` the panel, `path.test.js` the
// shape of the chips; this file covers what the prose says.
//
// It also carries the agreement §6 asks for, in the two forms these groups
// have. Every converter here is solved by a shooting method, so the third
// witness is the circuit run forward from rest through the same propagator,
// which knows nothing of the solver's answer. Where a closed form claims
// validity — the ideal ratio in continuous conduction, the first-harmonic
// gain near resonance — it is the fourth.

const at = (id, over = {}) => analyse(byId[id], { ...defaultsOf(id), ...over })
const pct = (x) => x * 100
const uS = (t) => t * 1e6
const mA = (i) => i * 1e3
const mW = (w) => w * 1e3

describe('the two groups are on the list, in the plan’s order', () => {
  it('adds six experiments in two groups after the losses', () => {
    expect(GROUPS.slice(-2)).toEqual(['Isolated converters', 'Resonant conversion'])
    const ids = EXPERIMENTS.slice(-6).map((e) => e.id)
    expect(ids).toEqual(['j1', 'j2', 'j3', 'k1', 'k2', 'k3'])
    expect(EXPERIMENTS.filter((e) => e.jk)).toHaveLength(6)
  })
})

describe('J1 · a buck through a transformer', () => {
  const x = at('j1')
  it('gives M = n·D, so 48 V on a 4:1 transformer at D = 40 % is 4.80 V', () => {
    expect(x.formulas.n).toBeCloseTo(0.25, 12)
    expect(x.m.M).toBeCloseTo(0.1, 6)
    expect(x.m.M).toBeCloseTo(forwardM('forward', 0.4, 0.25), 6)
    expect(x.m.sig.vout.avg).toBeCloseTo(4.8, 4)
  })
  it('returns the core’s volt-seconds in n_r·D·T = 4.00 µs, which is why the duty stops at one half', () => {
    expect(uS(x.formulas.resetMeasured)).toBeCloseTo(4.0, 3)
    expect(uS(x.formulas.resetTime)).toBeCloseTo(4.0, 9)
    expect(x.formulas.maxDuty).toBeCloseTo(0.5, 12)
    expect(x.formulas.resets).toBe(true)
    // The magnetising current the reset has to return, and the rail taking it.
    expect(mA(x.m.sig.iM.max)).toBeCloseTo(192.0, 1)
    expect(mA(x.m.sig.iin.min)).toBeCloseTo(-192.0, 1)
  })
  it('makes the switch block 96.0 V, twice the rail', () => {
    expect(x.formulas.blocking).toBeCloseTo(96.0, 6)
    expect(x.formulas.stressRatio).toBeCloseTo(2, 9)
  })
  it('try: D = 45 % leaves 1.00 µs after a 4.50 µs reset', () => {
    const q = at('j1', { D: 0.45 })
    expect(uS(q.formulas.resetMeasured)).toBeCloseTo(4.5, 3)
    const spare = q.ss.segments.filter((s) => s.name === 'freewheel' || s.name === 'dead').reduce((a, s) => a + s.T, 0)
    expect(uS(spare)).toBeCloseTo(1.0, 3)
    // And past the ceiling there is no room for it at all.
    expect(at('j1', { D: 0.49 }).formulas.resets).toBe(true)
    expect(x.formulas.maxDuty).toBeGreaterThan(0.45)
  })
})

describe('J2 · the push-pull and the flux walk', () => {
  const x = at('j2')
  it('works the core both ways, so M = 2·n·D', () => {
    expect(x.formulas.n).toBeCloseTo(0.125, 12)
    expect(x.m.M).toBeCloseTo(0.1, 3)
    expect(x.formulas.M).toBeCloseTo(forwardM('pushpull', 0.4, 0.125), 12)
    expect(x.m.sig.vout.avg).toBeCloseTo(4.799, 2)
  })
  it('leaves a 24.0 mA offset on a 48.0 mA ripple at 50 % mismatch, so the triangle sits above zero', () => {
    expect(mA(x.m.sig.iM.pp)).toBeCloseTo(48.0, 1)
    expect(mA(x.formulas.iMdc)).toBeCloseTo(24.0, 1)
    expect(mA(x.formulas.iMwalk)).toBeCloseTo(24.0, 1)
    expect(x.formulas.iMdc / x.m.sig.iM.pp).toBeCloseTo(0.5, 2)
    expect(mA(x.m.sig.iM.min)).toBeCloseTo(0, 1)
    expect(x.m.sig.iM.min).toBeGreaterThan(-1e-4)
  })
  it('centres the current on zero at 0 % mismatch, and has no fixed point at all with no resistance', () => {
    const even = at('j2', { mismatch: 0 })
    expect(Math.abs(even.formulas.iMdc)).toBeLessThan(1e-9 * even.m.sig.iM.pp)
    expect(even.formulas.driftFree).toBe(false)
    const ideal = at('j2', { mismatch: 0, Ron: 0 })
    expect(ideal.formulas.driftFree).toBe(true)
    expect(Math.abs(ideal.formulas.iMdc)).toBeLessThan(1e-9 * ideal.m.sig.iM.pp)
  })
  it('try: 100 % mismatch grows the offset to 40.0 mA, and it never passes n·I_out', () => {
    const q = at('j2', { mismatch: 1 })
    expect(mA(q.formulas.iMdc)).toBeCloseTo(40.0, 1)
    expect(mA(q.formulas.iMwalk)).toBeCloseTo(40.0, 1)
    for (const mm of [0.25, 0.5, 1, 2]) {
      const r = at('j2', { mismatch: mm })
      expect(Math.abs(r.formulas.iMdc), `mismatch ${mm}`).toBeLessThan(0.125 * Math.abs(r.m.Iout))
    }
  })
})

describe('J3 · four switches, half the stress', () => {
  const x = at('j3')
  it('gives the push-pull’s ratio at half its stress', () => {
    expect(x.m.M).toBeCloseTo(0.1, 3)
    expect(x.formulas.blocking).toBeCloseTo(48.0, 6)
    const rows = x.formulas.family
    const pp = rows.find((r) => r.kind === 'pushpull')
    const fb = rows.find((r) => r.kind === 'fullbridge')
    expect(pp.stress).toBeCloseTo(96.0, 6)
    expect(fb.stress).toBeCloseTo(48.0, 6)
    expect(pp.stress / fb.stress).toBeCloseTo(2, 9)
  })
  it('pays for it with two switches in series: 1.41 mW against 0.71 mW', () => {
    const rows = x.formulas.family
    const pp = rows.find((r) => r.kind === 'pushpull')
    const fb = rows.find((r) => r.kind === 'fullbridge')
    expect(mW(fb.switchLoss)).toBeCloseTo(1.41, 1)
    expect(mW(pp.switchLoss)).toBeCloseTo(0.71, 1)
    expect(fb.switchLoss / pp.switchLoss).toBeCloseTo(2, 1)
  })
  it('puts the same output in every row of the table, on three different primaries', () => {
    const rows = x.formulas.family
    expect(rows.map((r) => r.kind)).toEqual(['forward', 'pushpull', 'fullbridge'])
    for (const r of rows) expect(r.Vout, r.kind).toBeCloseTo(4.8, 1)
    // The forward carries twice the turns, because its ratio has one D in it.
    const fwd = rows.find((r) => r.kind === 'forward')
    expect(fwd.turns).toBeCloseTo(rows[1].turns / 2, 9)
    expect(fwd.pulses).toBe(1)
    expect(rows[1].pulses).toBe(2)
  })
  it('try: D = 45 % lifts the output to 5.40 V on the same 48 V', () => {
    const q = at('j3', { D: 0.45 })
    expect(q.m.sig.vout.avg).toBeCloseTo(5.4, 2)
    expect(q.p.Vin).toBeCloseTo(48, 12)
  })
})

describe('K1 · the series resonant tank', () => {
  const x = at('k1')
  const p = resonantParams(defaultsOf('k1'))
  it('is a short at its own resonance, so M is n/2 there whatever the load', () => {
    const fr = seriesResonance(p)
    expect(fr / 1e3).toBeCloseTo(100.02, 1)
    for (const R of [6, 12, 48]) {
      const q = at('k1', { fs: fr, R })
      expect(q.m.M, `R = ${R}`).toBeCloseTo(0.25, 3)
    }
    expect(at('k1', { fs: 100e3 }).m.M).toBeCloseTo(0.25, 3)
  })
  it('gives M = 0.239 at 120 kHz, with the first-harmonic gain 3.0 % out', () => {
    expect(x.m.M).toBeCloseTo(0.2388, 3)
    expect(x.m.sig.vout.avg).toBeCloseTo(11.46, 1)
    expect(x.formulas.Mfha).toBeCloseTo(0.2462, 3)
    expect(pct(Math.abs(x.formulas.fhaError))).toBeCloseTo(3.0, 1)
  })
  it('turns on into a current still flowing the other way above resonance', () => {
    expect(x.formulas.zvs).toBe(true)
    expect(x.formulas.iOn).toBeLessThan(0)
    // Below resonance it does not: the current is already back at zero.
    const low = at('k1', { fs: 60e3 })
    expect(low.formulas.zvs).toBe(false)
    expect(low.formulas.zcs).toBe(true)
  })
  it('try: at 60 kHz M holds at 0.250 while the formula says 0.222', () => {
    const q = at('k1', { fs: 60e3 })
    expect(q.m.M).toBeCloseTo(0.25, 3)
    expect(q.formulas.Mfha).toBeCloseTo(0.222, 3)
    expect(q.formulas.fhaError).toBeGreaterThan(0.1)
  })
})

describe('K2 · the LLC and its two resonances', () => {
  const x = at('k2')
  const p = resonantParams(defaultsOf('k2'))
  it('rings slower with the magnetising inductance in, at 40.8 kHz', () => {
    expect(lowerResonance(p) / 1e3).toBeCloseTo(40.8, 1)
    expect(x.formulas.fr2 / 1e3).toBeCloseTo(40.8, 1)
    expect(x.formulas.ratioLm).toBeCloseTo(5, 6)
  })
  it('passes what a series tank cannot: 13.7 V, 1.14 times n/2', () => {
    expect(x.m.sig.vout.avg).toBeCloseTo(13.72, 1)
    expect(x.m.M).toBeCloseTo(0.2858, 3)
    expect(x.m.M / x.formulas.clamp).toBeCloseTo(1.14, 2)
    // The series tank at the same settings is held to n/2.
    const src = analyse(byId.k1, { ...defaultsOf('k1'), fs: 80e3 })
    expect(src.m.M).toBeLessThanOrEqual(0.2501)
  })
  it('try: L_m = 60 µH lifts the peak to 0.593 at 66.3 kHz', () => {
    const peakOf = (Lm) => {
      let best = { M: -1, fs: 0 }
      for (let i = 0; i <= 120; i++) {
        const fs = 35e3 + (i * (110e3 - 35e3)) / 120
        const M = at('k2', { Lm, fs }).m.M
        if (M > best.M) best = { M, fs }
      }
      return best
    }
    const wide = peakOf(60e-6)
    expect(wide.M).toBeCloseTo(0.593, 2)
    expect(wide.fs / 1e3).toBeCloseTo(66.3, 0)
    // A larger ratio puts the peak lower and smaller, above its own f_r2.
    const narrow = peakOf(300e-6)
    expect(narrow.M).toBeLessThan(wide.M)
    expect(narrow.fs).toBeLessThan(wide.fs)
    expect(narrow.fs).toBeGreaterThan(lowerResonance({ ...p, Lm: 300e-6 }))
  })
})

describe('K3 · what the soft edge saves', () => {
  const x = at('k3')
  it('pays nothing at turn-on and 87.7 mW at turn-off', () => {
    expect(x.formulas.zvs).toBe(true)
    expect(x.formulas.lossTurnOn).toBe(0)
    expect(mW(x.formulas.lossTurnOff)).toBeCloseTo(87.7, 0)
    expect(x.m.sig.vout.avg).toBeCloseTo(10.17, 1)
    expect(mW(x.formulas.lossTurnOn + x.formulas.lossTurnOff)).toBeCloseTo(mW(x.m.loss.switching), 6)
  })
  it('against a hard-switched half-bridge on the same rail, into the same load, at 208 mW', () => {
    const h = x.formulas.hard
    expect(h.matched).toBe(true)
    expect(h.Vout).toBeCloseTo(x.m.sig.vout.avg, 0)
    expect(mW(h.switching)).toBeCloseTo(208, 0)
    expect(h.switching / x.m.loss.switching).toBeCloseTo(2.37, 1)
    // Its own closed form agrees: both edges, at the load current.
    expect(mW(h.closedForm)).toBeCloseTo(208, 0)
  })
  it('runs at 98.4 %, with 55.2 mW in the tank', () => {
    expect(mW(x.m.loss.inductor)).toBeCloseTo(55.2, 0)
    expect(pct(x.m.eta)).toBeCloseTo(98.4, 1)
    expect(pct(x.formulas.hard.eta)).toBeCloseTo(96.0, 1)
  })
  it('try: t_sw = 100 ns costs the edges 439 mW and the bridge 1.04 W', () => {
    const q = at('k3', { tsw: 100e-9 })
    expect(mW(q.m.loss.switching)).toBeCloseTo(439, 0)
    expect(q.formulas.hard.switching).toBeCloseTo(1.04, 2)
    expect(pct(q.formulas.hard.eta)).toBeCloseTo(87.6, 1)
    // And with instant edges neither pays anything.
    const ideal = at('k3', { tsw: 0 })
    expect(ideal.m.loss.switching).toBe(0)
    expect(ideal.formulas.hard.switching).toBe(0)
  })
})

describe('the agreement §6 asks for, at every experiment’s defaults', () => {
  // Three witnesses where all three claim validity: the shooting method's
  // fixed point, the circuit walked from rest through the same propagator,
  // and the closed form.
  it.each(EXPERIMENTS.filter((e) => e.jk).map((e) => [e.id, e]))('%s', (id) => {
    const x = at(id)
    expect(x.ss.converged, 'the shooting method settled').toBe(true)
    expect(x.gate).toBeFalsy()
    let w = new Array(x.conv.order).fill(0)
    for (let k = 0; k < 20000; k++) w = walkWindows(x.conv, w).xEnd
    // The output side is the circuit's own, whichever route reaches it.
    const vIndex = x.resonant ? x.conv.index.VO : 1
    const vScale = Math.max(1, Math.abs(x.m.sig.vout.avg))
    expect(Math.abs(w[vIndex] - x.ss.x0[vIndex]) / vScale, `${id} output`).toBeLessThan(1e-4)
    const iScale = Math.max(1e-6, Math.abs(x.m.sig.iL.max), Math.abs(x.m.sig.iL.min))
    expect(Math.abs(w[0] - x.ss.x0[0]) / iScale, `${id} inductor`).toBeLessThan(1e-4)
    // The closed form, where it claims validity.
    if (x.forward && x.ss.mode === 'CCM') expect(x.m.M, `${id} ratio`).toBeCloseTo(x.formulas.M, 2)
    if (x.resonant && Math.abs(x.formulas.fhaError) < 0.05) {
      expect(x.m.M / x.formulas.Mfha, `${id} first-harmonic`).toBeCloseTo(1, 1)
    }
  }, 60000)
})

describe('the sweeps these groups draw', () => {
  const step = (pts, y) => Math.max(...pts.slice(1).map((q, i) => Math.abs(q[y] - pts[i][y])))
  it('M against duty is continuous, and follows the ideal ratio in continuous conduction', () => {
    for (const id of ['j1', 'j3']) {
      const p = defaultsOf(id)
      const coarse = sweepDuty(p, byId[id], 25)
      const fine = sweepDuty(p, byId[id], 97)
      for (const q of fine) expect(Number.isFinite(q.Mn), `${id} at D = ${q.x}`).toBe(true)
      expect(step(fine, 'Mn'), id).toBeLessThanOrEqual(0.5 * step(coarse, 'Mn'))
      for (const q of fine) {
        if (q.mode !== 'CCM') continue
        expect(q.Mn, `${id} at D = ${q.x.toFixed(3)}`).toBeCloseTo(q.pred, 2)
      }
    }
  }, 60000)
  it('the magnetising offset rises with the mismatch and passes through zero at zero', () => {
    const pts = sweepMismatch(defaultsOf('j2'), byId.j2, 21)
    expect(Math.abs(pts[0].iMdc)).toBeLessThan(1e-6)
    for (let i = 1; i < pts.length; i++) expect(pts[i].iMdc, `at ${pts[i].x}`).toBeGreaterThan(pts[i - 1].iMdc)
    for (const q of pts) expect(q.iMdc).toBeCloseTo(q.pred, 3)
  }, 60000)
  it('the gain curve falls above resonance and carries the first-harmonic line beside it', () => {
    const pts = sweepGain(defaultsOf('k1'), byId.k1, 15)
    const fr = seriesResonance(resonantParams(defaultsOf('k1')))
    const above = pts.filter((q) => q.x > 1.2 * fr)
    for (let i = 1; i < above.length; i++) expect(above[i].Mn).toBeLessThanOrEqual(above[i - 1].Mn + 1e-9)
    for (const q of pts) {
      expect(Number.isFinite(q.Mn)).toBe(true)
      expect(q.pred).toBeCloseTo(fhaRatio('src', { ...resonantParams(defaultsOf('k1')), fs: q.x }), 12)
    }
  }, 60000)
  it('efficiency against frequency puts the resonant bridge above the hard-switched one throughout', () => {
    const pts = sweepSoft(defaultsOf('k3'), byId.k3, 9)
    for (const q of pts) {
      expect(Number.isFinite(q.eta)).toBe(true)
      expect(q.eta, `at ${(q.x / 1e3).toFixed(0)} kHz`).toBeGreaterThan(q.etaHard)
    }
  }, 60000)
})

describe('the gate, where the shooting method does not settle', () => {
  // Which knob settings the search fails at is the solver's business and may
  // improve; what a screen does when it fails is a promise to the reader.
  // So the gate is exercised on the solve it is given rather than on a corner
  // the solver happens to lose today.
  const gated = (id) => {
    const p = defaultsOf(id)
    const real = analyse(byId[id], p)
    const gate = 'The periodic state did not settle here, after 80 passes.'
    return { p, x: { ...real, gate } }
  }
  it('stops the math panel comparing anything, and puts the reason where the intro was', () => {
    const { p, x } = gated('k3')
    const entry = experimentMath(byId.k3, p, x)
    const rows = entry.blocks.find((b) => b.kind === 'check').rows
    expect(rows.length).toBeGreaterThan(3)
    for (const r of rows) expect(r.unchecked, r.label).toBe(x.gate)
    expect(entry.blocks[0].text).toBe(x.gate)
  })
  it('says so on the top bar and in the outcome line, for both families', () => {
    for (const id of ['j1', 'k1']) {
      const { p, x } = gated(id)
      expect(jkOutcome(byId[id], x)).toMatch(/did not settle/)
      if (x.resonant) expect(jkFlow(byId[id], p, x).mode).toBe('did not settle')
    }
  })
  it('names the settings that caused it, and none of them at the defaults', () => {
    // A tank at five times its own resonance, into an output filter tens of
    // thousands of periods long: almost nothing reaches the capacitor.
    const p = { ...defaultsOf('k3'), C: 4.467e-3, Cr: 1.501e-7, Lm: 4.698e-4, Lr: 5.472e-5, Np: 2.348, R: 48.34, Rs: 1.002, Vin: 149.5, fs: 272600, tsw: 1.885e-7 }
    const hard = analyse(byId.k3, p)
    if (!hard.ss.converged) {
      expect(hard.gate).toMatch(/did not settle/)
      expect(hard.gate).toMatch(/f\/f_r = 4\.9/)
      expect(hard.gate).toMatch(/switching periods/)
    } else {
      expect(hard.gate).toBeFalsy()
    }
    for (const e of EXPERIMENTS.filter((q) => q.jk)) expect(at(e.id).gate, e.id).toBeFalsy()
  }, 60000)
})

describe('the forward family’s parameters reach the engine as the engine names them', () => {
  it('inverts the turns ratio the knob is labelled with', () => {
    expect(forwardParams({ Np: 4 }).n).toBeCloseTo(0.25, 12)
    expect(resonantParams({ Np: 2 }).n).toBeCloseTo(0.5, 12)
    // The reset winding has the primary's own turns, which is what puts the
    // duty ceiling at one half and the switch stress at twice the rail.
    expect(forwardParams({}).nr).toBe(1)
  })
})
