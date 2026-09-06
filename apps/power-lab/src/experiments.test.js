import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, GROUPS, TRACES, VIEWS, SWEEP_X, SWEEP_Y, byId, defaultsOf } from './experiments.js'
import { analyse, sweepD, sweepR, sweepLinear, sweepEta, sweepFs, sweepC, sweepAlpha, sweepChopper, sweepMa, sweepFsw, linearDivider, LINREG_R_PASS } from './analysis.js'
import { lossLedger, switchingCrossover, peakEfficiencyLoad, capacitorRms } from '@ee-labs/switched'
import { lineFundamentalPeaks } from './groups/hiAnalysis.js'
import { TERMS } from './terms.js'
import { signalsOf } from './components/schematics.jsx'
import { sweepFor } from './App.jsx'

// Every note makes a claim; every claim is measured here, from the same
// analysis the panes draw. A number in a note the engine does not reproduce
// fails a test rather than misleading a reader.

const at = (id, over = {}) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return { exp, p, x: analyse(exp, p) }
}
const pct = (a, b) => Math.abs(a - b) / Math.abs(b)

describe('every experiment', () => {
  it('has a unique id, a group from the list, a note, knobs, traces and views that exist', () => {
    const ids = new Set()
    for (const e of EXPERIMENTS) {
      expect(ids.has(e.id), e.id).toBe(false)
      ids.add(e.id)
      expect(GROUPS).toContain(e.group)
      expect(e.name.length).toBeGreaterThan(4)
      expect(e.note.length).toBeGreaterThan(120)
      expect(e.params.length).toBeGreaterThan(0)
      expect(e.views).toContain(e.view)
      for (const v of e.views) expect(VIEWS[v], `${e.id} view ${v}`).toBeTruthy()
      for (const t of e.traces) expect(TRACES[t], `${e.id} trace ${t}`).toBeTruthy()
      for (const t of e.allTraces || []) expect(TRACES[t], `${e.id} trace ${t}`).toBeTruthy()
      if (e.allTraces) for (const t of e.traces) expect(e.allTraces, `${e.id} default trace ${t}`).toContain(t)
      if (e.views.includes('sweep')) {
        expect(e.sweep, `${e.id} sweep`).toBeTruthy()
        expect(SWEEP_X[e.sweep.x], `${e.id} sweep x ${e.sweep.x}`).toBeTruthy()
        expect(SWEEP_Y[e.sweep.y], `${e.id} sweep y ${e.sweep.y}`).toBeTruthy()
        if (e.sweep.y2) expect(SWEEP_Y[e.sweep.y2], `${e.id} sweep y2 ${e.sweep.y2}`).toBeTruthy()
      }
      for (const k of e.params) {
        if (k.kind === 'toggle') {
          expect([0, 1]).toContain(k.default)
          expect(k.on && k.off, `${e.id}.${k.key} labels`).toBeTruthy()
          continue
        }
        expect(k.default, `${e.id}.${k.key}`).toBeGreaterThanOrEqual(k.min)
        expect(k.default, `${e.id}.${k.key}`).toBeLessThanOrEqual(k.max)
      }
    }
  })

  it('names only terms that are defined, and every term is used somewhere', () => {
    const used = new Set()
    for (const e of EXPERIMENTS) {
      for (const t of e.terms) {
        expect(TERMS[t], `${e.id} term ${t}`).toBeTruthy()
        used.add(t)
      }
    }
    for (const t of Object.keys(TERMS)) expect(used.has(t), `term ${t} unused`).toBe(true)
  })

  it('analyses at its defaults without a non-finite number anywhere in the measures', () => {
    for (const e of EXPERIMENTS) {
      const { x } = at(e.id)
      for (const [k, s] of Object.entries(x.m.sig)) {
        for (const q of ['avg', 'rms', 'min', 'max', 'pp']) expect(Number.isFinite(s[q]), `${e.id} ${k}.${q}`).toBe(true)
      }
      for (const q of ['Pin', 'Pout', 'eta']) expect(Number.isFinite(x.m[q]), `${e.id} ${q}`).toBe(true)
      if ('M' in x.m) expect(Number.isFinite(x.m.M), `${e.id} M`).toBe(true)
      for (const t of e.allTraces || e.traces) expect(x.wf.sig[t].length, `${e.id} trace ${t}`).toBeGreaterThan(2)
    }
  })
})

describe('A1 · the resistor divider', () => {
  it('12 → 5 V at 1 A: 5 W to the load, 7 W in the resistor, η = 41.7 %', () => {
    const { x } = at('a1')
    expect(x.m.Iout).toBeCloseTo(1, 12)
    expect(x.m.Pout).toBeCloseTo(5, 12)
    expect(x.m.Ploss).toBeCloseTo(7, 12)
    expect(x.m.eta * 100).toBeCloseTo(41.7, 1)
  })
  it('the resistor is fixed at 7 Ω: only the 5 Ω load it was sized for lands on 5 V', () => {
    expect(LINREG_R_PASS).toBeCloseTo(7, 12)
    expect(linearDivider({ Vin: 12, R: 5 }).Vo).toBeCloseTo(5, 12)
    // Strictly increasing (V_in·R_pass/(R+R_pass)² > 0 for every R > 0), so it
    // crosses 5 V exactly once — moving the load off 5 Ω always misses it.
    expect(linearDivider({ Vin: 12, R: 1 }).Vo).not.toBeCloseTo(5, 0)
    expect(linearDivider({ Vin: 12, R: 20 }).Vo).not.toBeCloseTo(5, 0)
  })
  it('efficiency is always V_out/V_in, whatever the load: no setting in the sweep does better than the ratio it lands on', () => {
    for (const R of [0.5, 5, 500]) {
      const lr = linearDivider({ Vin: 12, R })
      expect(lr.eta).toBeCloseTo(lr.Vo / 12, 12)
    }
    const points = sweepLinear({ Vin: 12 })
    for (const q of points) expect(q.eta).toBeCloseTo(q.Vout / 12, 12)
    // Rises monotonically with the load — a lighter load always gets more of
    // V_in, never less — so the curve has one crossing, not several.
    for (let i = 1; i < points.length; i++) expect(points[i].Vout, `at R=${points[i].x}`).toBeGreaterThan(points[i - 1].Vout)
  })
  it('the sweep’s marker carries the exact divider result at the cursor, not the nearest of the 61 sampled loads', () => {
    // 5 Ω is not one of logSpace(0.5, 1000, 61)'s own points, so a marker
    // that reads the nearest sample instead of the setting itself disagrees
    // with the top bar here — exactly the bug this pins (Reed, 2026-09-03:
    // the marker read "5 Ω → 4.935 V" against a top bar, note and closed
    // form that all say 5.000 V).
    const { x, p } = at('a1')
    const s = sweepFor(byId.a1, p, x)
    expect(s.points.some((q) => Math.abs(q.x - 5) < 1e-9), 'R = 5 is not one of the sweep’s own samples').toBe(false)
    expect(s.atY).toBeCloseTo(5, 12)
    expect(s.atY).toBeCloseTo((12 * 5) / (5 + 7), 12)
    expect(s.atY).toBeCloseTo(x.m.sig.vout.avg, 12)
    // Not just the default: an off-grid load elsewhere on the curve reads
    // its own exact value too, not whichever sample happens to be nearest.
    const p2 = { ...p, R: 12.3456 }
    const x2 = analyse(byId.a1, p2)
    const s2 = sweepFor(byId.a1, p2, x2)
    expect(s2.atY).toBeCloseTo(linearDivider({ Vin: 12, R: 12.3456 }).Vo, 9)
    expect(s2.atY).toBeCloseTo(x2.m.sig.vout.avg, 12)
  })
})

describe('every sweep’s marker, not only A1’s', () => {
  it('reads the exact analysed value at an off-grid setting of the knob it is about, on every experiment with a sweep', () => {
    for (const e of EXPERIMENTS) {
      if (!e.sweep) continue
      const about = e.params.find((p) => p.key === e.about)
      // A setting nowhere near a round fraction of the sweep's own grid
      // (linSpace/logSpace at 41–61 points), so a marker reading its
      // nearest sample instead of the cursor would visibly disagree here.
      const v = about.kind === 'toggle' ? about.default : about.min + (about.max - about.min) * 0.4123
      const p = { ...defaultsOf(e.id), [about.key]: v }
      const x = analyse(e, p)
      const s = sweepFor(e, p, x)
      // Every SWEEP_Y key an experiment actually sweeps has to land in
      // exactSweepY's table (App.jsx) — an unmapped key silently falls back
      // to the old nearest-sample marker, which is the bug this whole file
      // exists to keep out.
      expect(Number.isFinite(s.atY), `${e.id}: sweep.y ${e.sweep.y} has no exact marker value`).toBe(true)
      const expected = { M: x.m.M, eta: x.m.eta, Pout: x.m.Pout, Vout: x.m.sig.vout.avg, vavg: x.m.sig.vout.avg, vrms: x.m.sig.vout.rms, angle: x.m.angle, iPeak: x.m.iPeak, share: x.m.share, pf: x.m.pf, v1: x.m.Vsw1 * Math.SQRT2, thd: x.m.thd, vll1: lineFundamentalPeaks(p).plain, Mn: x.m.M, iMdc: x.m.sig?.iM?.avg }[e.sweep.y]
      expect(s.atY, `${e.id}: sweep.y ${e.sweep.y}`).toBeCloseTo(expected, 9)
    }
  })
})

describe('A2 · chop it', () => {
  it('average 5.00 V, RMS 7.75 V, 12.0 W of heating against 5.00 W for a steady 5 V, at a 2.4 A peak', () => {
    const { x, p } = at('a2')
    expect(x.m.sig.vout.avg).toBeCloseTo(5, 9)
    expect(x.m.sig.vout.rms).toBeCloseTo(7.746, 3)
    expect(x.m.Pout).toBeCloseTo(12, 9)
    expect((p.D * p.Vin) ** 2 / p.R).toBeCloseTo(5, 9)
    expect(x.m.sig.iL.max).toBeCloseTo(2.4, 9)
    expect(x.m.sig.vout.max).toBe(12)
    expect(x.m.sig.vout.min).toBe(0)
  })
  it('41.7 % of the time is 12 V: the waveform holds V_in for D·T of each period', () => {
    const { x, p } = at('a2')
    const T = 1 / p.fs
    const on = x.wf.edges.filter((e) => e.name === 'on').map((e) => e.t)
    const off = x.wf.edges.filter((e) => e.name === 'off').map((e) => e.t)
    expect(off[0] - on[0]).toBeCloseTo(p.D * T, 15)
    expect(p.D * 100).toBeCloseTo(41.7, 1)
  })
  // §11.2.2: one claim, one knob, one picture.
  it('the sweep puts ⟨v⟩ = D·V_in and V_rms = √D·V_in on one volt axis, the RMS above the mean at every D but 1', () => {
    expect(byId.a2.sweep).toEqual({ x: 'D', y: 'vavg', y2: 'vrms', shared: true })
    const pts = sweepChopper(defaultsOf('a2'))
    expect(pts.length).toBeGreaterThan(40)
    for (const q of pts) {
      expect(q.vavg).toBeCloseTo(q.x * 12, 12)
      expect(q.vrms).toBeCloseTo(Math.sqrt(q.x) * 12, 12)
      expect(q.P).toBeCloseTo((q.x * 144) / 5, 12)
      expect(q.vrms).toBeGreaterThan(q.vavg)
      expect(q.pred).toBeUndefined()
    }
    expect(pts[0].x).toBeCloseTo(0.02, 12)
    expect(pts[pts.length - 1].x).toBeCloseTo(0.98, 12)
  })
  it('has a losses view: an ideal switch loses nothing, every watt drawn heats the load', () => {
    const { x } = at('a2')
    expect(byId.a2.views).toContain('losses')
    expect(x.m.loss).toEqual({ switch: 0 })
    expect(x.m.Ploss).toBe(0)
    expect(x.m.Pin).toBeCloseTo(x.m.Pout, 12)
    expect(x.m.Pout).toBeCloseTo((x.p.D * x.p.Vin ** 2) / x.p.R, 9)
  })
  it('its measures table lists each signal once: the output and the load current, not the same node under three names', () => {
    const { x } = at('a2')
    const rows = signalsOf(byId.a2)
    expect(rows).toEqual(['vout', 'iR'])
    expect(x.m.sig.iR.avg).toBeCloseTo(x.m.sig.vout.avg / 5, 12)
    expect(x.m.sig.iR.max).toBeCloseTo(2.4, 9)
    expect(x.wf.sig.iR.length).toBe(x.wf.t.length)
    expect(byId.a2.traces).toEqual(['vout'])
    expect(byId.a2.allTraces).toEqual(['vout', 'iR'])
  })
})

describe('A3 · let the LC do the averaging', () => {
  it('the switch node swings 0 ↔ 12 V, the output is 5.000 V with 3.65 mV of ripple', () => {
    const { x } = at('a3')
    expect(x.m.sig.vsw.min).toBeCloseTo(0, 9)
    expect(x.m.sig.vsw.max).toBeCloseTo(12, 9)
    expect(x.m.sig.vout.avg).toBeCloseTo(5, 3)
    expect(x.m.sig.vout.pp * 1e3).toBeCloseTo(3.65, 2)
  })
  it('the filter corner is 1.59 kHz, 63× below the switching frequency', () => {
    const { x, p } = at('a3')
    expect(x.formulas.fo).toBeCloseTo(1591.5, 0)
    expect(p.fs / x.formulas.fo).toBeCloseTo(63, 0)
  })
  it('the load draws 5.00 W, the source supplies 5.00 W, and nothing heats up', () => {
    const { x } = at('a3')
    expect(x.m.Pout).toBeCloseTo(5, 2)
    expect(x.m.Pin).toBeCloseTo(x.m.Pout, 9)
    expect(x.m.Ploss).toBe(0)
    expect(x.m.eta).toBeCloseTo(1, 12)
  })
})

describe('B1 · volt-second balance', () => {
  it('7 V × 4.17 µs = 29.2 V·µs up and 5 V × 5.83 µs = 29.2 V·µs down, summing to zero', () => {
    const { x, p } = at('b1')
    const on = x.balance.segs.find((s) => s.name === 'on')
    const off = x.balance.segs.find((s) => s.name === 'off')
    expect(on.T * 1e6).toBeCloseTo(4.17, 2)
    expect(off.T * 1e6).toBeCloseTo(5.83, 2)
    expect(on.vs * 1e6).toBeCloseTo(29.2, 1)
    expect(off.vs * 1e6).toBeCloseTo(-29.2, 1)
    // 7 V × D·T, to the ripple: the output is not exactly 5 V while the switch is on.
    expect(pct(on.vs, (p.Vin - 5) * on.T)).toBeLessThan(1e-3)
    expect(Math.abs(x.balance.vsTotal)).toBeLessThan(1e-9 * Math.abs(on.vs))
    expect(Math.abs(x.balance.qTotal)).toBeLessThan(1e-9 * Math.max(...x.balance.segs.map((s) => Math.abs(s.q))))
    expect(x.m.sig.vL.avg).toBeCloseTo(0, 9)
  })
  it('V_out = D·V_in with no L in it: change L and the output does not move, the ripple does', () => {
    const a = at('b1', { L: 100e-6 })
    const b = at('b1', { L: 20e-6 })
    expect(a.x.m.sig.vout.avg).toBeCloseTo(5, 6)
    expect(b.x.m.sig.vout.avg).toBeCloseTo(5, 6)
    expect(b.x.m.sig.iL.pp / a.x.m.sig.iL.pp).toBeCloseTo(5, 2)
  })
})

describe('B2 · M = D', () => {
  it('at D = 0.417 the output is 5.000 V from 12 V', () => {
    const { x, p } = at('b2')
    expect(p.D).toBeCloseTo(0.417, 3)
    expect(x.m.sig.vout.avg).toBeCloseTo(5, 3)
    expect(x.m.M).toBeCloseTo(p.D, 6)
  })
  it('the sweep is a straight line through the origin at every load that stays continuous', () => {
    for (const R of [0.5, 5]) {
      const pts = sweepD({ ...defaultsOf('b2'), R })
      for (const q of pts) {
        expect(q.mode, `R=${R} D=${q.x}`).toBe('CCM')
        expect(q.M).toBeCloseTo(q.x, 6)
      }
    }
    // At 30 Ω the low-D end goes discontinuous (K_crit = 1 − D exceeds K there);
    // the continuous points still sit on the line, and only those.
    const pts = sweepD({ ...defaultsOf('b2'), R: 30 })
    const ccm = pts.filter((q) => q.mode === 'CCM')
    expect(ccm.length).toBeGreaterThan(30)
    expect(ccm.length).toBeLessThan(pts.length)
    for (const q of ccm) expect(q.M).toBeCloseTo(q.x, 6)
  })
  it('L, C, R and f_s set the ripple, not the ratio', () => {
    const base = at('b2')
    for (const over of [{ L: 50e-6 }, { C: 10e-6 }, { fs: 1e6 }, { R: 1 }]) {
      const { x } = at('b2', over)
      expect(x.m.mode).toBe('CCM')
      expect(x.m.M).toBeCloseTo(base.x.m.M, 6)
      expect(x.m.sig.iL.pp === base.x.m.sig.iL.pp && x.m.sig.vout.pp === base.x.m.sig.vout.pp).toBe(false)
    }
  })
  it('past 34 Ω the line bends away', () => {
    const pts = sweepD({ ...defaultsOf('b2'), R: 100 })
    const mid = pts.find((q) => Math.abs(q.x - 5 / 12) < 0.01)
    expect(mid.mode).toBe('DCM')
    expect(mid.M).toBeGreaterThan(mid.x + 0.1)
  })
})

describe('B3 · ripple', () => {
  it('0.292 A peak-to-peak around 1.00 A, 3.65 mV of output ripple, within 0.03 % of the formulas', () => {
    const { x } = at('b3')
    expect(x.m.sig.iL.avg).toBeCloseTo(1, 3)
    expect(x.m.sig.iL.pp).toBeCloseTo(0.292, 3)
    expect(x.m.sig.vout.pp * 1e3).toBeCloseTo(3.65, 2)
    expect(pct(x.formulas.dI, x.m.sig.iL.pp)).toBeLessThan(3e-4)
    expect(pct(x.formulas.dV, x.m.sig.vout.pp)).toBeLessThan(3e-4)
    // And not much tighter: the small-ripple approximation is an approximation.
    expect(pct(x.formulas.dI, x.m.sig.iL.pp)).toBeGreaterThan(1e-4)
  })
  it('the current rises at (V_in − V_out)/L and falls at V_out/L', () => {
    const { x, p } = at('b3')
    const seg = x.ss.segments
    const rise = (x.m.sig.iL.max - x.m.sig.iL.min) / seg[0].T
    expect(pct(rise, (p.Vin - 5) / p.L)).toBeLessThan(1e-3)
    const fall = (x.m.sig.iL.max - x.m.sig.iL.min) / seg[1].T
    expect(pct(fall, 5 / p.L)).toBeLessThan(1e-3)
  })
  it('four times the frequency: a quarter the current ripple and a sixteenth the voltage ripple', () => {
    const a = at('b3')
    const b = at('b3', { fs: 400e3 })
    expect(b.x.m.sig.iL.pp * 1e3).toBeCloseTo(72.9, 1)
    expect(b.x.m.sig.vout.pp * 1e3).toBeCloseTo(0.228, 3)
    expect(a.x.m.sig.iL.pp / b.x.m.sig.iL.pp).toBeCloseTo(4, 2)
    expect(a.x.m.sig.vout.pp / b.x.m.sig.vout.pp).toBeCloseTo(16, 1)
  })
  it('a smaller inductor: 22 µH gives 1.33 A and 16.6 mV', () => {
    const { x } = at('b3', { L: 22e-6 })
    expect(x.m.sig.iL.pp).toBeCloseTo(1.33, 2)
    expect(x.m.sig.vout.pp * 1e3).toBeCloseTo(16.6, 1)
  })
})

describe('B4 · light load: discontinuous conduction', () => {
  it('at 200 Ω the load wants 25 mA, the ripple peaks at 145 mA, and the diode blocks for 41 % of the period', () => {
    const { x } = at('b4')
    expect(x.m.mode).toBe('DCM')
    expect(x.m.Iout * 1e3).toBeCloseTo(x.m.sig.vout.avg / 200 * 1e3, 9)
    expect(x.m.sig.iL.max * 1e3).toBeCloseTo(145, 0)
    expect(x.m.sig.iL.min).toBeCloseTo(0, 9)
    expect(((x.ss.tOff - x.ss.td) / x.T) * 100).toBeCloseTo(41, 0)
  })
  it('the switch node floats to V_out while the diode blocks', () => {
    const { x } = at('b4')
    const dead = x.wf.edges.find((e) => e.name === 'dead')
    const i = x.wf.t.findIndex((t) => t > dead.t + 1e-9)
    expect(x.wf.sig.vsw[i]).toBeCloseTo(x.wf.sig.vout[i], 9)
  })
  it('the output is 8.52 V — M = 0.710, not D = 0.417 — and depends on the load', () => {
    const { x, p } = at('b4')
    expect(x.m.sig.vout.avg).toBeCloseTo(8.52, 2)
    expect(x.m.M).toBeCloseTo(0.71, 2)
    expect(p.D).toBeCloseTo(0.417, 3)
    const pts = sweepR(defaultsOf('b4'))
    const dcm = pts.filter((q) => q.mode === 'DCM')
    expect(dcm.length).toBeGreaterThan(5)
    for (let i = 1; i < dcm.length; i++) expect(dcm[i].M).toBeGreaterThan(dcm[i - 1].M)
    for (const q of pts.filter((q) => q.mode === 'CCM')) expect(q.M).toBeCloseTo(p.D, 6)
  })
  it('a synchronous switch lets the current go to −121 mA: continuous again, output 5.00 V', () => {
    const { x } = at('b4', { sync: 1 })
    expect(x.m.mode).toBe('CCM')
    expect(x.m.sig.iL.min * 1e3).toBeCloseTo(-121, 0)
    expect(x.m.sig.vout.avg).toBeCloseTo(5, 2)
  })
})

describe('B5 · the boundary', () => {
  it('R_crit = 34.3 Ω at 100 µH, 100 kHz, D = 0.417, and the knob starts there with the valley at zero', () => {
    const { x, p } = at('b5')
    expect(x.formulas.Rcrit).toBeCloseTo(34.3, 1)
    expect(p.R).toBeCloseTo(x.formulas.Rcrit, 6)
    expect(x.formulas.K).toBeCloseTo(x.formulas.Kcrit, 6)
    expect(x.formulas.Kcrit).toBeCloseTo(1 - p.D, 12)
    expect(Math.abs(x.m.sig.iL.min)).toBeLessThan(1e-6)
  })
  it('the two formulas for M agree at the boundary, and the curve is continuous with a kink', () => {
    const { x, p } = at('b5')
    expect(x.formulas.Mdcm).toBeCloseTo(x.formulas.M, 6)
    const below = at('b5', { R: x.formulas.Rcrit * 0.999 }).x.m.M
    const above = at('b5', { R: x.formulas.Rcrit * 1.001 }).x.m.M
    expect(Math.abs(above - below)).toBeLessThan(1e-3)
    expect(above).toBeGreaterThan(below)
    // A kink: the slope on the DCM side is not the (zero) slope on the CCM side.
    const further = at('b5', { R: x.formulas.Rcrit * 1.1 }).x.m.M
    expect(further - above).toBeGreaterThan(10 * (above - below))
    expect(below).toBeCloseTo(p.D, 6)
  })
  it('slower switching or a smaller inductor moves R_crit down', () => {
    const base = at('b5').x.formulas.Rcrit
    expect(at('b5', { fs: 50e3 }).x.formulas.Rcrit).toBeCloseTo(base / 2, 9)
    expect(at('b5', { L: 50e-6 }).x.formulas.Rcrit).toBeCloseTo(base / 2, 9)
    expect(at('b5', { fs: 50e3 }).x.m.mode).toBe('DCM')
  })
})

// The real-parts experiments (§11.2.1): one loss each, with the knobs it is
// not about held ideal, so every number is that loss's alone.
describe('B6 · the diode’s rent', () => {
  it('is about V_f alone: the other loss knobs are not on it, and the diode is the only loss', () => {
    const { x, p } = at('b6')
    expect(byId.b6.params.map((k) => k.key)).not.toEqual(expect.arrayContaining(['Ron', 'RL', 'ESR', 'tsw']))
    expect(p.Vf).toBe(0.5)
    expect(x.m.mode).toBe('CCM')
    const others = Object.entries(x.m.loss).filter(([k]) => k !== 'diode')
    for (const [k, v] of others) expect(v, k).toBe(0)
  })
  it('the diode conducts for 58 % of each period, so the rent is (1 − D)·V_f = 0.292 V: 4.708 V out, M = 0.392, η = 94.2 %, 275 mW', () => {
    const { x, p } = at('b6')
    expect((1 - p.D) * 100).toBeCloseTo(58, 0)
    expect(x.ss.td / x.T).toBeCloseTo(1 - p.D, 12)
    expect((1 - p.D) * p.Vf).toBeCloseTo(0.292, 3)
    expect(x.m.sig.vout.avg).toBeCloseTo(4.708, 3)
    expect(x.m.sig.vout.avg).toBeCloseTo(p.D * p.Vin - (1 - p.D) * p.Vf, 3)
    expect(x.m.M).toBeCloseTo(0.392, 3)
    expect(x.m.eta * 100).toBeCloseTo(94.2, 1)
    expect(x.m.loss.diode * 1e3).toBeCloseTo(275, 0)
    expect(x.m.loss.diode).toBeCloseTo(p.Vf * x.m.sig.iD.avg, 9)
  })
  it('the rent is fixed, so it is dear at 5 V out and cheap at 48 V in: 19.7 V out at 98.5 %', () => {
    const hi = at('b6', { Vin: 48 })
    expect(hi.x.m.sig.vout.avg).toBeCloseTo(19.7, 1)
    expect(hi.x.m.eta * 100).toBeCloseTo(98.5, 1)
    // The same 0.292 V, taken from four times the output.
    expect(hi.p.D * hi.p.Vin - hi.x.m.sig.vout.avg).toBeCloseTo(0.292, 2)
  })
  it('V_f = 1 V: 4.42 V and 88.3 %; V_f = 0 V, or a synchronous switch: 5.000 V and 100 %', () => {
    const one = at('b6', { Vf: 1 }).x.m
    expect(one.sig.vout.avg).toBeCloseTo(4.42, 2)
    expect(one.eta * 100).toBeCloseTo(88.3, 1)
    for (const over of [{ Vf: 0 }, { sync: 1 }]) {
      const m = at('b6', over).x.m
      expect(m.sig.vout.avg).toBeCloseTo(5, 3)
      expect(m.eta).toBeCloseTo(1, 9)
      expect(m.Ploss).toBeCloseTo(0, 12)
    }
  })
  it('the sweep is η against D, rising with D because the rent is a share of D·V_in: 62.5 % at D = 0.1, 99.5 % at 0.9', () => {
    expect(byId.b6.sweep).toEqual({ x: 'D', y: 'eta' })
    expect(at('b6', { D: 0.1 }).x.m.eta * 100).toBeCloseTo(62.5, 1)
    expect(at('b6', { D: 0.9 }).x.m.eta * 100).toBeCloseTo(99.5, 1)
    const pts = sweepD(defaultsOf('b6'))
    for (let i = 1; i < pts.length; i++) expect(pts[i].eta).toBeGreaterThan(pts[i - 1].eta)
    // η = V_out/(D·V_in) = 1 − (1 − D)·V_f/(D·V_in): the rent over the ideal output. The closed
    // form assumes CCM; below D ≈ 0.04 the rent exceeds the ideal output and the converter is in
    // DCM with a few percent efficiency, so the comparison is made where the form is valid.
    for (const q of pts.filter((q) => q.mode === 'CCM')) {
      expect(q.eta).toBeCloseTo(1 - ((1 - q.x) * 0.5) / (q.x * 12), 6)
    }
    expect(pts.filter((q) => q.mode === 'CCM').length).toBeGreaterThan(pts.length * 0.8)
  })
  it('the input power equals the output plus the diode loss to the last digit', () => {
    for (const over of [{}, { sync: 1 }, { R: 0.5 }, { R: 500 }, { Vin: 48 }]) {
      const { x } = at('b6', over)
      expect(Math.abs(x.m.balance)).toBeLessThan(1e-10 * x.m.Pin)
    }
  })
})

describe('B7 · the resistances', () => {
  it('is about the ESR, with R_on and R_L beside it and no diode or edges', () => {
    const { p } = at('b7')
    expect(byId.b7.about).toBe('ESR')
    expect(p).toMatchObject({ ESR: 0.05, Ron: 0.05, RL: 0.03 })
    expect(byId.b7.params.map((k) => k.key)).not.toEqual(expect.arrayContaining(['Vf', 'tsw', 'sync']))
  })
  it('each takes I²R from the 1 A load — 21, 30 and 0.3 mW — so 4.950 V out and η = 99.0 %', () => {
    const { x, p } = at('b7')
    const mW = (v) => v * 1e3
    expect(x.m.mode).toBe('CCM')
    expect(x.m.Iout).toBeCloseTo(1, 1)
    expect(mW(x.m.loss.switch)).toBeCloseTo(21, 0)
    expect(mW(x.m.loss.inductor)).toBeCloseTo(30, 0)
    expect(mW(x.m.loss.esr)).toBeCloseTo(0.3, 1)
    expect(x.m.loss.diode).toBe(0)
    expect(x.m.loss.switching).toBe(0)
    expect(x.m.sig.vout.avg).toBeCloseTo(4.95, 3)
    expect(x.m.eta * 100).toBeCloseTo(99.0, 1)
    // I²R with the RMS current in each, and the switch's for D of the time.
    expect(x.m.loss.inductor).toBeCloseTo(x.m.sig.iL.rms ** 2 * p.RL, 9)
    expect(x.m.loss.switch).toBeCloseTo(x.m.sig.iQ.rms ** 2 * p.Ron, 9)
    expect(x.m.loss.esr).toBeCloseTo(x.m.sig.iC.rms ** 2 * p.ESR, 9)
  })
  it('at 0.5 Ω and 9.1 A, I² makes it 90.8 %; the loss ratio is the current ratio squared', () => {
    const heavy = at('b7', { R: 0.5 }).x.m
    expect(heavy.Iout).toBeCloseTo(9.1, 1)
    expect(heavy.sig.vout.avg).toBeCloseTo(4.54, 2)
    expect(heavy.eta * 100).toBeCloseTo(90.8, 1)
    const a = at('b7', { R: 5 }).x.m
    const b = at('b7', { R: 2.5 }).x.m
    expect(b.loss.inductor / a.loss.inductor).toBeCloseTo((b.sig.iL.rms / a.sig.iL.rms) ** 2, 6)
  })
  it('the ESR loses nothing, but it shows: ESR·ΔI_L = 14.5 mV of step turns 3.63 mV of ripple into 14.4 mV', () => {
    const w = at('b7').x
    const wo = at('b7', { ESR: 0 }).x
    expect(w.m.loss.esr * 1e3).toBeLessThan(0.5)
    expect(wo.m.sig.vout.pp * 1e3).toBeCloseTo(3.63, 2)
    expect(w.m.sig.vout.pp * 1e3).toBeCloseTo(14.4, 1)
    expect(w.p.ESR * w.m.sig.iL.pp * 1e3).toBeCloseTo(14.5, 1)
    // The step is the ripple current through the ESR: with ten times the ESR,
    // ten times the step, and the ripple is the step.
    const big = at('b7', { ESR: 0.5 }).x
    expect(big.m.sig.vout.pp * 1e3).toBeCloseTo(132, 0)
    expect(big.m.sig.vout.pp / (big.p.ESR * big.m.sig.iL.pp)).toBeGreaterThan(0.85)
  })
  it('the input power equals the output plus every I²R to the last digit', () => {
    for (const over of [{}, { R: 0.5 }, { R: 500 }, { ESR: 0.5 }]) {
      const { x } = at('b7', over)
      expect(Math.abs(x.m.balance)).toBeLessThan(1e-10 * x.m.Pin)
    }
  })
  it('the efficiency sweep is finite everywhere and lowest at the heaviest load', () => {
    const pts = sweepEta(defaultsOf('b7'))
    for (const q of pts) expect(q.eta).toBeGreaterThan(0.5)
    expect(pts[0].eta).toBeLessThan(pts[Math.floor(pts.length / 2)].eta)
  })
})

describe('B8 · the edges', () => {
  it('is about t_sw alone, with f_s beside it: no conduction loss on the knobs', () => {
    const { x, p } = at('b8')
    expect(byId.b8.about).toBe('tsw')
    expect(p.tsw).toBe(20e-9)
    expect(byId.b8.params.map((k) => k.key)).toContain('fs')
    expect(byId.b8.params.map((k) => k.key)).not.toEqual(expect.arrayContaining(['Ron', 'Vf', 'RL', 'ESR']))
    for (const [k, v] of Object.entries(x.m.loss)) if (k !== 'switching') expect(v, k).toBe(0)
  })
  it('½·V·I·t per edge, twice a period: 20 ns edges cost 24 mW at 100 kHz, η = 99.5 %', () => {
    const { x, p } = at('b8')
    expect(x.m.loss.switching * 1e3).toBeCloseTo(24, 0)
    expect(x.m.eta * 100).toBeCloseTo(99.5, 1)
    // Two edges at 12 V, the current at each being the ripple's valley and peak
    // — which sum to twice the 1 A average.
    const edges = 0.5 * p.Vin * (x.m.sig.iL.min + x.m.sig.iL.max) * p.tsw * p.fs
    expect(x.m.loss.switching).toBeCloseTo(edges, 9)
    expect(x.m.loss.switching).toBeCloseTo(0.5 * 12 * 2 * 1 * 20e-9 * 100e3, 4)
  })
  it('the loss is ∝ f_s·t_sw: 240 mW and 95.4 % at 1 MHz, 120 mW at 100 ns, 6 mW at 5 ns', () => {
    const base = at('b8').x.m.loss.switching
    const fast = at('b8', { fs: 1e6 }).x
    expect(fast.m.loss.switching * 1e3).toBeCloseTo(240, 0)
    expect(fast.m.eta * 100).toBeCloseTo(95.4, 1)
    expect(fast.m.loss.switching / base).toBeCloseTo(10, 2)
    expect(at('b8', { tsw: 100e-9 }).x.m.loss.switching * 1e3).toBeCloseTo(120, 0)
    expect(at('b8', { tsw: 5e-9 }).x.m.loss.switching * 1e3).toBeCloseTo(6, 0)
    expect(at('b8', { tsw: 100e-9, fs: 400e3 }).x.m.loss.switching / base).toBeCloseTo(20, 2)
  })
  it('ripple wants f_s high and the edges want it low: the sweep is η against f_s, falling', () => {
    expect(byId.b8.sweep).toEqual({ x: 'fs', y: 'eta' })
    const pts = sweepFs(defaultsOf('b8'))
    expect(pts[0].x).toBeCloseTo(10e3, 6)
    expect(pts[pts.length - 1].x).toBeCloseTo(2e6, 6)
    for (let i = 1; i < pts.length; i++) expect(pts[i].eta).toBeLessThan(pts[i - 1].eta)
    // The sweep's log grid has no point at exactly 1 MHz; the curve must pass through the note's
    // 95.4 % there, so bracket it: the neighbours on either side sit either side of it.
    const below = pts.filter((q) => q.x <= 1e6).pop()
    const above = pts.find((q) => q.x >= 1e6)
    expect(below.eta * 100).toBeGreaterThan(95.4)
    expect(above.eta * 100).toBeLessThan(95.4)
    expect(at('b8', { fs: 1e6 }).x.m.eta * 100).toBeCloseTo(95.4, 1)
    const slow = at('b8', { fs: 10e3 }).x.m
    const fast = at('b8', { fs: 1e6 }).x.m
    expect(fast.sig.vout.pp).toBeLessThan(slow.sig.vout.pp / 1000)
  })
})

describe('C1 · stacking on the source', () => {
  it('M = 1/(1 − D): 24.00 V out of 12 V at D = 0.500, with 60.0 mV of ripple', () => {
    const { x, p } = at('c1')
    expect(p.D).toBe(0.5)
    expect(x.ss.mode).toBe('CCM')
    expect(x.m.M).toBeCloseTo(2, 3)
    expect(x.formulas.M).toBeCloseTo(1 / (1 - p.D), 12)
    expect(x.m.sig.vout.avg).toBeCloseTo(24, 1)
    expect(x.m.sig.vout.pp * 1e3).toBeCloseTo(60, 0)
  })
  it('nothing is created: 2.400 A in to deliver 1.200 A out, 28.80 W each way', () => {
    const { x } = at('c1')
    const m = x.m
    expect(m.sig.iin.avg).toBeCloseTo(2.4, 2)
    expect(m.Iout).toBeCloseTo(1.2, 2)
    expect(m.sig.iin.avg / m.Iout).toBeCloseTo(2, 2)
    expect(m.Pin).toBeCloseTo(28.8, 1)
    expect(m.Pout).toBeCloseTo(28.8, 1)
    expect(Math.abs(m.balance)).toBeLessThan(1e-9 * m.Pin)
    // The inductor is fed from the source and the load only from the diode.
    expect(m.sig.iD.avg).toBeCloseTo(m.Iout, 9)
  })
  it('the sweep runs away as D → 1', () => {
    const pts = sweepD(defaultsOf('c1'), 'boost')
    for (let i = 1; i < pts.length; i++) expect(pts[i].M).toBeGreaterThan(pts[i - 1].M)
    const last = pts[pts.length - 1]
    expect(last.x).toBeCloseTo(0.98, 9)
    expect(last.M).toBeGreaterThan(20)
    expect(last.ideal).toBeCloseTo(50, 6)
  })
})

describe('C2 · the peak ideal theory misses', () => {
  it('0.2 Ω of winding peaks M at ½√(R/R_L) = 5.00, at D = 0.900, where theory promised 10.0', () => {
    const { x } = at('c2', { D: 0.9 })
    expect(x.formulas.Dpeak).toBeCloseTo(0.9, 12)
    expect(x.formulas.Mpeak).toBeCloseTo(5, 12)
    expect(x.m.M).toBeCloseTo(5, 2)
    expect(1 / (1 - 0.9)).toBeCloseTo(10, 12)
    // A maximum of the converter, not only of the formula.
    expect(at('c2', { D: 0.8 }).x.m.M).toBeLessThan(x.m.M)
    expect(at('c2', { D: 0.95 }).x.m.M).toBeLessThan(x.m.M)
  })
  it('the knob starts on the peak: 60.0 V out where theory promised 120 V, 180 W in the winding to deliver 180 W', () => {
    const { x, p } = at('c2')
    expect(p.D).toBeCloseTo(0.9, 12)
    expect(x.m.sig.vout.avg).toBeCloseTo(60, 1)
    expect(p.Vin / (1 - p.D)).toBeCloseTo(120, 9)
    expect(x.m.Pout).toBeCloseTo(180, 1)
    expect(x.m.loss.inductor).toBeCloseTo(180, 1)
  })
  it('past the peak the output falls: 48.00 V at D = 0.950, with 460.8 W in the winding', () => {
    const { x } = at('c2', { D: 0.95 })
    expect(x.m.sig.vout.avg).toBeCloseTo(48, 1)
    expect(x.m.loss.inductor).toBeCloseTo(460.8, 0)
    expect(x.m.eta * 100).toBeCloseTo(20, 1)
  })
  it('η = M·(1 − D), which at the peak is exactly 50 %', () => {
    for (const D of [0.5, 0.8, 0.9, 0.95]) {
      const { x } = at('c2', { D })
      expect(Math.abs(x.m.M * (1 - D) - x.m.eta) / x.m.eta).toBeLessThan(1e-3)
    }
    const top = at('c2', { D: 0.9 }).x
    expect(top.m.eta).toBeCloseTo(0.5, 3)
    expect(top.m.loss.inductor).toBeCloseTo(top.m.Pout, 1)
  })
  it('the sweep carries both curves: the ideal one climbing past the real one that turns over', () => {
    const pts = sweepD(defaultsOf('c2'), 'boost')
    const best = pts.reduce((a, q) => (q.M > a.M ? q : a))
    expect(best.x).toBeCloseTo(0.9, 2)
    expect(best.M).toBeCloseTo(5, 2)
    expect(best.eta).toBeCloseTo(0.5, 2)
    // Beyond the peak the ideal curve keeps climbing while the real one falls.
    const past = pts.filter((q) => q.x > best.x)
    expect(past[past.length - 1].ideal).toBeGreaterThan(best.ideal * 2)
    expect(past[past.length - 1].M).toBeLessThan(best.M / 2)
    for (const q of pts) expect(q.pred).toBeCloseTo(q.M, 1)
  })
})

describe('C3 · the boost runs dry too', () => {
  it('R_crit = 160 Ω and K_crit = D(1 − D)² = 0.1250', () => {
    const { x } = at('c3', { R: 20 })
    expect(x.formulas.Rcrit).toBeCloseTo(160, 6)
    expect(x.formulas.Kcrit).toBeCloseTo(0.125, 12)
    expect(x.ss.mode).toBe('CCM')
    expect(at('c3', { R: 200 }).x.ss.mode).toBe('DCM')
  })
  it('at 400 Ω it is discontinuous: M = 2.791 against the ideal 2.000, 33.50 V, still 600 mA of ripple', () => {
    const { x } = at('c3')
    expect(x.p.R).toBe(400)
    expect(x.ss.mode).toBe('DCM')
    expect(x.m.M).toBeCloseTo(2.791, 3)
    expect(x.formulas.M).toBeCloseTo(2, 6)
    expect(x.formulas.Mdcm).toBeCloseTo(x.m.M, 3)
    expect(x.m.sig.vout.avg).toBeCloseTo(33.5, 1)
    expect(x.m.sig.iL.pp * 1e3).toBeCloseTo(600, 0)
    expect(x.m.sig.iL.min).toBeCloseTo(0, 6)
  })
  it('the boost climbs in DCM where the buck sags', () => {
    const pts = sweepR(defaultsOf('c3'), 'boost')
    for (let i = 1; i < pts.length; i++) expect(pts[i].M).toBeGreaterThanOrEqual(pts[i - 1].M - 1e-9)
    const ccm = pts.filter((q) => q.mode === 'CCM')
    const dcm = pts.filter((q) => q.mode === 'DCM')
    expect(ccm.length).toBeGreaterThan(5)
    expect(dcm.length).toBeGreaterThan(5)
    for (const q of ccm) expect(q.M).toBeCloseTo(2, 2)
    expect(dcm[dcm.length - 1].M).toBeGreaterThan(3)
    // The buck, the same sweep, goes the other way.
    const buck = sweepR(defaultsOf('b4'), 'buck')
    const buckDcm = buck.filter((q) => q.mode === 'DCM')
    expect(buckDcm[buckDcm.length - 1].M).toBeGreaterThan(buck[0].M)
    expect(buckDcm[buckDcm.length - 1].M).toBeLessThan(1)
  })
})

describe('C4 · the inverting bucket', () => {
  it('M = −D/(1 − D): −12.00 V from +12 V at D = 0.500', () => {
    const { x } = at('c4')
    expect(x.inverted).toBe(true)
    expect(x.m.M).toBeCloseTo(-1, 3)
    expect(x.formulas.M).toBeCloseTo(-1, 12)
    expect(x.m.sig.vout.avg).toBeCloseTo(-12, 1)
    expect(x.m.sig.vout.max).toBeLessThan(0)
    expect(x.p.Vin).toBe(12)
    expect(x.m.Pin).toBeCloseTo(7.2, 2)
    expect(x.m.Pout).toBeCloseTo(7.2, 2)
  })
  it('the switch node swings from +12.0 V to −12.0 V', () => {
    const { x } = at('c4')
    expect(x.m.sig.vsw.max).toBeCloseTo(12, 1)
    expect(x.m.sig.vsw.min).toBeCloseTo(-12, 1)
  })
  it('the source is disconnected for the whole off interval: i_in is flat at zero there', () => {
    const { x, p } = at('c4')
    const w = x.wf
    const zero = w.sig.iin.filter((v) => v === 0).length
    // Two periods of trace, both sides of every edge: half of it is off time.
    expect(zero / w.sig.iin.length).toBeGreaterThan(0.45)
    expect(zero / w.sig.iin.length).toBeLessThan(0.55)
    expect(x.m.sig.iin.avg).toBeCloseTo(x.m.Pin / p.Vin, 9)
    // And the inductor carries the load current the whole time, divided by D′.
    expect(x.m.sig.iL.avg).toBeCloseTo(Math.abs(x.m.Iout) / (1 - p.D), 2)
    // A buck never does this: its source current flows whenever the switch is on
    // and its output shares the inductor with the load at every instant.
    expect(at('b2').x.m.sig.iL.avg).toBeCloseTo(at('b2').x.m.Iout, 3)
  })
})

describe('C5 · all the energy through one part', () => {
  it('the inductor picks up ½L·i_pk² and hands over all of it: 600 mA gives 1.800 W', () => {
    const { x, p } = at('c5')
    expect(x.ss.mode).toBe('DCM')
    expect(x.m.sig.iL.max * 1e3).toBeCloseTo(600, 0)
    // The peak is the on interval alone: V_in·D/(L·f_s).
    expect(x.m.sig.iL.max).toBeCloseTo((p.Vin * p.D) / (p.L * p.fs), 6)
    expect(x.formulas.Ecyc).toBeCloseTo(1.8, 6)
    expect(x.m.Pout).toBeCloseTo(1.8, 6)
    expect(x.m.Pout).toBeCloseTo(0.5 * p.L * x.m.sig.iL.max ** 2 * p.fs, 9)
  })
  it('the same 1.800 W at 100, 200 and 500 Ω, while the output climbs −13.42 → −18.97 → −30.00 V', () => {
    const volts = { 100: -13.42, 200: -18.97, 500: -30.0 }
    for (const [R, v] of Object.entries(volts)) {
      const { x } = at('c5', { R: Number(R) })
      expect(x.ss.mode).toBe('DCM')
      expect(x.m.Pout).toBeCloseTo(1.8, 6)
      expect(x.m.sig.vout.avg).toBeCloseTo(v, 1)
      expect(x.m.sig.iL.max * 1e3).toBeCloseTo(600, 0)
    }
  })
  it('R_crit = 80 Ω, and below it conduction is continuous and the power is not constant', () => {
    const { x } = at('c5')
    expect(x.formulas.Rcrit).toBeCloseTo(80, 6)
    const below = at('c5', { R: 20 }).x
    expect(below.ss.mode).toBe('CCM')
    expect(below.m.Pout).toBeGreaterThan(2 * 1.8)
  })
  it('the sweep is flat in power and rising in voltage exactly where conduction is discontinuous', () => {
    const pts = sweepR(defaultsOf('c5'), 'buckboost')
    const dcm = pts.filter((q) => q.mode === 'DCM')
    expect(dcm.length).toBeGreaterThan(10)
    for (const q of dcm) expect(q.Pout).toBeCloseTo(1.8, 6)
    for (let i = 1; i < dcm.length; i++) expect(dcm[i].Vout).toBeLessThan(dcm[i - 1].Vout)
    // Continuous conduction below R_crit: the power is not flat there.
    const ccm = pts.filter((q) => q.mode === 'CCM')
    expect(ccm.length).toBeGreaterThan(5)
    expect(Math.max(...ccm.map((q) => q.Pout))).toBeGreaterThan(10)
    // Every point of it is a real inverting output.
    for (const q of pts) expect(q.Vout).toBeLessThan(0)
  })
})

describe('E1 · half-wave into a capacitor', () => {
  it('12.6 V RMS peaks at 17.8 V; conducts 42.9° of each cycle; holds 14.7 ms and sags 2.30 V', () => {
    const { x } = at('e1')
    expect(x.formulas.Vp).toBeCloseTo(17.8, 1)
    expect(x.m.pulses).toBe(1)
    expect(x.m.angle).toBeCloseTo(42.9, 1)
    expect(x.m.tHold * 1e3).toBeCloseTo(14.7, 1)
    expect(x.m.ripple).toBeCloseTo(2.3, 2)
    expect(x.m.angle / 360 + x.m.tHold / x.T).toBeCloseTo(1, 9)
  })
  it('15.6 V DC, not the 5.67 V a bare half-wave rectifier averages to', () => {
    const { x } = at('e1')
    expect(x.m.Vdc).toBeCloseTo(15.6, 1)
    expect(x.formulas.VdcNoC).toBeCloseTo(5.67, 2)
    expect(x.formulas.VdcNoC).toBeCloseTo(x.formulas.Vp / Math.PI, 12)
  })
  it('156 mA delivered as 2.03 A spikes; 500 mA RMS, 3.2× the average, 10× the heating; PIV 33.3 V', () => {
    const { x } = at('e1')
    expect(x.m.Iout * 1e3).toBeCloseTo(156, 0)
    expect(x.m.sig.iD.avg).toBeCloseTo(x.m.Iout, 9)
    expect(x.m.iPeak).toBeCloseTo(2.03, 2)
    expect(x.m.sig.iD.rms * 1e3).toBeCloseTo(500, 0)
    expect(x.m.formFactor).toBeCloseTo(3.2, 1)
    expect(x.m.formFactor ** 2).toBeGreaterThan(9.5)
    expect(x.m.formFactor ** 2).toBeLessThan(10.5)
    expect(x.m.piv).toBeCloseTo(33.3, 1)
    expect(x.m.piv / x.formulas.Vp).toBeGreaterThan(1.8)
    expect(x.m.piv / x.formulas.Vp).toBeLessThan(2)
  })
  it('the capacitor holds the peak: the output stays within the ripple of the ceiling', () => {
    const { x } = at('e1')
    expect(x.m.sig.vout.max).toBeLessThan(x.formulas.ceiling)
    expect(x.m.sig.vout.max).toBeGreaterThan(x.formulas.ceiling - 0.5)
    expect(x.m.sig.vout.pp).toBeCloseTo(x.m.ripple, 9)
  })
})

describe('E2 · the bridge', () => {
  it('two pulses: holds 6.8 ms, ripple 1.07 V against 2.30, ceiling 16.4 V, the same 15.6 V DC', () => {
    const b = at('e2').x
    const h = at('e1').x
    expect(b.m.pulses).toBe(2)
    expect(b.m.tHold * 1e3).toBeCloseTo(6.8, 1)
    expect(b.m.ripple).toBeCloseTo(1.07, 2)
    expect(h.m.ripple).toBeCloseTo(2.3, 2)
    expect(b.formulas.ceiling).toBeCloseTo(16.4, 1)
    expect(b.formulas.ceiling).toBeCloseTo(h.formulas.ceiling - 0.7, 9)
    expect(b.m.Vdc).toBeCloseTo(15.6, 1)
    expect(Math.abs(b.m.Vdc - h.m.Vdc)).toBeLessThan(0.05)
  })
  it('1.30 A peaks instead of 2.03, form factor 2.57 instead of 3.2; each diode blocks 17.1 V, not 33', () => {
    const b = at('e2').x
    expect(b.m.iPeak).toBeCloseTo(1.3, 2)
    expect(b.m.formFactor).toBeCloseTo(2.57, 2)
    expect(b.m.piv).toBeCloseTo(17.1, 1)
    expect(b.m.piv / b.formulas.Vp).toBeGreaterThan(0.9)
    expect(b.m.piv / b.formulas.Vp).toBeLessThan(1)
  })
  it('the four diodes drop 218 mW, 8 % of what comes in', () => {
    const b = at('e2').x
    expect(b.m.loss.diodes * 1e3).toBeCloseTo(218, 0)
    expect((100 * b.m.loss.diodes) / b.m.Pin).toBeCloseTo(8, 0)
    expect(Math.abs(b.m.balance)).toBeLessThan(1e-9 * b.m.Pin)
  })
})

describe('E3 · the price of a big capacitor', () => {
  it('100 µF / 1000 µF / 4700 µF: ripple 6.9, 1.07, 0.23 V; angle 67°, 33°, 32°; peak 0.60, 1.30, 1.34 A; form factor 1.84 → 2.61', () => {
    const a = at('e3', { C: 100e-6 }).x.m
    const b = at('e3', { C: 1000e-6 }).x.m
    const c = at('e3', { C: 4700e-6 }).x.m
    expect(a.ripple).toBeCloseTo(6.9, 1)
    expect(b.ripple).toBeCloseTo(1.07, 2)
    expect(c.ripple).toBeCloseTo(0.23, 2)
    expect(a.angle).toBeCloseTo(67, 0)
    expect(b.angle).toBeCloseTo(33, 0)
    expect(c.angle).toBeCloseTo(32, 0)
    expect(a.iPeak).toBeCloseTo(0.6, 2)
    expect(b.iPeak).toBeCloseTo(1.3, 2)
    expect(c.iPeak).toBeCloseTo(1.34, 2)
    expect(a.formFactor).toBeCloseTo(1.84, 2)
    expect(c.formFactor).toBeCloseTo(2.61, 2)
    expect(a.pf).toBeCloseTo(0.65, 2)
    expect(c.pf).toBeCloseTo(0.54, 2)
  })
  it('the sweep: ripple falls without limit, the angle floors near 32° where R_s sets it, and halving R_s drops the floor', () => {
    const pts = sweepC(defaultsOf('e3'), byId.e3)
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].ripple).toBeLessThan(pts[i - 1].ripple)
      expect(pts[i].angle).toBeLessThanOrEqual(pts[i - 1].angle + 1e-9)
    }
    const last = pts[pts.length - 1]
    expect(last.x).toBeCloseTo(10e-3, 9)
    expect(last.angle).toBeCloseTo(32, 0)
    expect(last.angle).toBeGreaterThan(31)
    expect(last.iPeak).toBeGreaterThan(pts[0].iPeak * 5)
    const halfRs = sweepC({ ...defaultsOf('e3'), Rs: 0.25 }, byId.e3)
    const lastHalf = halfRs[halfRs.length - 1]
    expect(lastHalf.angle).toBeLessThan(last.angle - 3)
    expect(lastHalf.iPeak).toBeGreaterThan(last.iPeak * 1.2)
    // Two capacitor sweeps of solved steady states: seconds, not milliseconds.
  }, 60000)
})

describe('E4 · what the grid sees', () => {
  it('fundamental 219 mA of 401 mA: distortion 0.545, THD 154 %; 3rd 94 %, 5th 81 %, 7th 66 % of the fundamental', () => {
    const { x } = at('e4')
    const m = x.m
    expect(m.I1 * 1e3).toBeCloseTo(219, 0)
    expect(m.Irms * 1e3).toBeCloseTo(401, 0)
    expect(m.distortion).toBeCloseTo(0.545, 3)
    expect(m.thd * 100).toBeCloseTo(154, 0)
    const rel = (k) => m.harmonics[k - 1].rms / m.I1
    expect(m.harmonics[2].k).toBe(3)
    expect(rel(3) * 100).toBeCloseTo(94, 0)
    expect(rel(5) * 100).toBeCloseTo(81.5, 0)
    expect(rel(7) * 100).toBeCloseTo(66, 0)
  })
  it('the fundamental lags only 7.6°, displacement 0.991: PF = 0.991 × 0.545 = 0.540, so 1.85× the current a sine would need', () => {
    const { x } = at('e4')
    const m = x.m
    expect((m.phi1 * 180) / Math.PI).toBeCloseTo(7.6, 1)
    expect(m.displacement).toBeCloseTo(0.991, 3)
    expect(m.pf).toBeCloseTo(0.54, 2)
    expect(m.pf).toBeCloseTo(m.displacement * m.distortion, 9)
    expect(1 / m.pf).toBeCloseTo(1.85, 2)
    expect(m.Pin).toBeCloseTo(2.73, 2)
    // Against a sine source only the fundamental carries power.
    expect(m.Pin).toBeCloseTo(x.p.Vs * m.I1 * Math.cos(m.phi1), 6)
  })
  it('odd orders only: every even harmonic is zero', () => {
    const { x } = at('e4')
    for (const h of x.m.harmonics) if (h.k % 2 === 0) expect(h.rms).toBeLessThan(1e-9 * x.m.I1)
  })
})

describe('E5 · the dimmer', () => {
  it('at 90° exactly half: 72.0 W of 144 W, and the sweep follows the closed form from 1 at 0° to 0 at 180°', () => {
    const { x } = at('e5')
    expect(x.m.share).toBeCloseTo(0.5, 12)
    expect(x.m.Pin).toBeCloseTo(72, 9)
    expect(x.m.Pfull).toBeCloseTo(144, 9)
    const pts = sweepAlpha(defaultsOf('e5'))
    expect(pts[0].x).toBe(0)
    expect(pts[pts.length - 1].x).toBe(180)
    expect(pts[0].share).toBeCloseTo(1, 9)
    expect(pts[pts.length - 1].share).toBeCloseTo(0, 9)
    for (const q of pts) expect(q.share).toBeCloseTo(q.pred, 5)
    for (let i = 1; i < pts.length; i++) expect(pts[i].share).toBeLessThanOrEqual(pts[i - 1].share + 1e-12)
  })
  it('THD 65 %, the fundamental lagging 32.5°: PF 0.707 = 0.844 × 0.838', () => {
    const { x } = at('e5')
    const m = x.m
    expect(m.thd * 100).toBeCloseTo(65, 0)
    expect((-m.phi1 * 180) / Math.PI).toBeCloseTo(32.5, 1)
    expect(m.pf).toBeCloseTo(0.707, 3)
    expect(m.displacement).toBeCloseTo(0.844, 3)
    expect(m.distortion).toBeCloseTo(0.838, 3)
    expect(m.pf).toBeCloseTo(m.displacement * m.distortion, 9)
    expect(m.pf).toBeCloseTo(Math.sqrt(m.share), 9)
  })
  it('at 135°, 9.1 % of the power at a power factor of 0.30', () => {
    const { x } = at('e5', { alphaDeg: 135 })
    expect(x.m.share * 100).toBeCloseTo(9.1, 1)
    expect(x.m.pf).toBeCloseTo(0.3, 2)
  })
  it('the waveform is the tail of every half-sine: zero before α, the source after', () => {
    const { x, p } = at('e5')
    const w = x.wf
    const T = 1 / p.f
    const alpha = Math.PI / 2
    let checked = 0
    for (let i = 0; i < w.t.length; i++) {
      const th = ((w.t[i] % (T / 2)) / (T / 2)) * Math.PI
      if (th > alpha + 1e-3 && th < Math.PI - 1e-3) {
        expect(w.sig.vout[i]).toBeCloseTo(w.sig.vin[i], 9)
        checked++
      } else if (th > 1e-3 && th < alpha - 1e-3) {
        expect(w.sig.vout[i]).toBe(0)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(100)
  })
})

describe('E6 · three phases, six pulses', () => {
  it('six pulses a cycle; charged towards √3 × 17.8 = 30.9 V less two drops; 28.8 V DC with 0.52 V of ripple', () => {
    const { x } = at('e6')
    const m = x.m
    expect(x.conv.threePhase).toBe(true)
    expect(m.pulses).toBe(6)
    expect(x.formulas.Vpk).toBeCloseTo(30.9, 1)
    expect(x.formulas.Vpk).toBeCloseTo(Math.sqrt(3) * x.formulas.Vp, 12)
    expect(x.formulas.ceiling).toBeCloseTo(x.formulas.Vpk - 1.4, 12)
    expect(m.Vdc).toBeCloseTo(28.8, 1)
    expect(m.ripple).toBeCloseTo(0.52, 2)
    // A new pair takes over six times a cycle; the scope names each one.
    const pairs = x.wf.edges.filter((e) => e.t > 0 && e.t < x.T - 1e-12 && /^[abc]{2}$/.test(e.name))
    expect(pairs.length).toBe(6)
  })
  it('nearly twice the single-phase bridge from the same secondaries; bare it would average 1.35·V_LL = 29.5 V', () => {
    const six = at('e6').x
    const bridge = at('e2').x
    expect(six.m.Vdc / bridge.m.Vdc).toBeGreaterThan(1.8)
    expect(six.m.Vdc / bridge.m.Vdc).toBeLessThan(2)
    expect(six.formulas.VdcNoC).toBeCloseTo(29.5, 1)
    expect(six.formulas.VdcNoC).toBeCloseTo(1.35 * six.formulas.Vll, 1)
    expect(six.formulas.VdcNoC - six.m.Vdc).toBeLessThan(0.7)
  })
  it('each diode blocks the peak line-to-line voltage, 30.2 V', () => {
    const { x } = at('e6')
    expect(x.m.piv).toBeCloseTo(30.2, 1)
    expect(x.m.piv / x.formulas.Vpk).toBeGreaterThan(0.95)
    expect(x.m.piv / x.formulas.Vpk).toBeLessThanOrEqual(1)
  })
  it('no 3rd harmonic at all; the 5th (91 %) and 7th (82 %) are the first that survive', () => {
    const { x } = at('e6')
    const m = x.m
    const rel = (k) => m.harmonics[k - 1].rms / m.I1
    expect(rel(2)).toBeLessThan(1e-9)
    expect(rel(3)).toBeLessThan(1e-9)
    expect(rel(9)).toBeLessThan(1e-9)
    expect(rel(5) * 100).toBeCloseTo(91, 0)
    expect(rel(7) * 100).toBeCloseTo(82, 0)
  })
})

describe('D1 · volt-seconds are flux', () => {
  it('29.2 V·µs on 40 turns of 40 mm² is 18.2 mT of swing, peaking at 165 mT', () => {
    const { x } = at('d1')
    const f = x.formulas
    expect(x.core.N).toBe(40)
    expect(x.core.Ae * 1e6).toBeCloseTo(40, 9)
    expect(f.onVs * 1e6).toBeCloseTo(29.17, 2)
    expect(f.coreArea).toBeCloseTo(40 * 40e-6, 12)
    expect(f.dB * 1e3).toBeCloseTo(18.23, 2)
    expect(f.dB).toBeCloseTo(f.onVs / f.coreArea, 15)
    expect(f.Bpk * 1e3).toBeCloseTo(165.4, 1)
    // The flux is L·i/(N·A_e) below the knee, and the knee is far above.
    expect(f.Bpk).toBeCloseTo((100e-6 * x.m.sig.iL.max) / f.coreArea, 12)
    expect(x.m.sig.iL.max).toBeLessThan(f.Isat)
    expect(x.m.sig.vout.avg).toBeCloseTo(5, 6)
  })
  it('a tenth the frequency is ten times the volt-seconds, and the flux follows', () => {
    const slow = at('d1', { fs: 10e3 }).x.formulas
    const fast = at('d1').x.formulas
    expect(slow.onVs / fast.onVs).toBeCloseTo(10.2, 1)
    expect(slow.dB * 1e3).toBeCloseTo(186.1, 1)
    // The closed form scales as 1/f_s with no remainder; the exact figure is
    // a little more, because the output moves across a longer interval.
    expect(slow.dBideal / fast.dBideal).toBeCloseTo(10, 6)
    expect(slow.dB / fast.dB).toBeGreaterThan(10)
    // Still under the ceiling: the cliff is the next experiment's.
    expect(slow.Bpk).toBeLessThan(slow.Bsat)
    expect(slow.Bpk * 1e3).toBeCloseTo(249.3, 1)
  })
})

describe('D2 · saturation, as an event', () => {
  it('saturates at B_sat·N·A_e/L = 4.80 A, which the 1 Ω load crosses', () => {
    const { x, p } = at('d2')
    const f = x.formulas
    expect(f.Isat).toBeCloseTo((x.core.Bsat * x.core.N * x.core.Ae) / p.L, 12)
    expect(f.Isat).toBeCloseTo(4.8, 6)
    expect(x.ss.mode).toBe('SAT')
    expect(x.m.sig.iL.avg).toBeCloseTo(5.0, 3)
    expect(f.iSat).toBeCloseTo(f.Isat, 6)
    expect(f.tSat * 1e6).toBeCloseTo(2.9, 1)
    expect(f.satShare * 100).toBeCloseTo(30.4, 0)
  })
  it('the inductance falls from 100 µH to 5 µH, and the ripple multiplies', () => {
    const { x, p } = at('d2')
    expect(x.formulas.Lsat * 1e6).toBeCloseTo(5, 6)
    expect(p.L / x.formulas.Lsat).toBeCloseTo(20, 9)
    expect(x.m.sig.iL.pp).toBeCloseTo(1.98, 2)
    expect(x.m.sig.iL.max).toBeCloseTo(6.58, 2)
    // The same converter with the core out of reach keeps the plain triangle.
    const linear = at('d2', { R: 2 }).x
    expect(linear.ss.mode).toBe('CCM')
    expect(linear.m.sig.iL.pp).toBeCloseTo(0.292, 3)
    expect(x.m.sig.iL.pp / linear.m.sig.iL.pp).toBeGreaterThan(6)
  })
  it('the flux reaches 306 mT and goes almost no further, and the output is still D·V_in', () => {
    const { x, p } = at('d2')
    expect(x.formulas.Bpk * 1e3).toBeCloseTo(305.6, 1)
    expect(x.formulas.Bpk).toBeGreaterThan(p.Bsat)
    // Past the knee the current buys flux twenty times more slowly.
    expect((x.formulas.Bpk - p.Bsat) / p.Bsat).toBeLessThan(0.03)
    expect(x.m.sig.vout.avg).toBeCloseTo(5, 3)
    expect(x.m.M).toBeCloseTo(p.D, 3)
  })
  it('at 2 Ω the peak is 2.65 A, under the knee', () => {
    const { x } = at('d2', { R: 2 })
    expect(x.m.sig.iL.max).toBeCloseTo(2.65, 2)
    expect(x.m.sig.iL.max).toBeLessThan(x.formulas.Isat)
    expect(x.formulas.satShare).toBe(0)
  })
})

describe('D3 · the flyback', () => {
  it('M = n·D/(1 − D): a 2:1 transformer at D = 50 % turns 24 V into 12.0 V', () => {
    const { x, p } = at('d3')
    expect(p.Np).toBe(2)
    expect(x.formulas.n).toBeCloseTo(0.5, 12)
    expect(x.formulas.M).toBeCloseTo((0.5 * 0.5) / 0.5, 12)
    expect(x.m.M).toBeCloseTo(0.5, 3)
    expect(x.m.sig.vout.avg).toBeCloseTo(11.99, 2)
    expect(x.ss.mode).toBe('CCM')
  })
  it('the secondary carries the magnetising current divided by n, and the load’s average', () => {
    const { x, p } = at('d3')
    expect(x.m.sig.iD.max).toBeCloseTo(x.m.sig.iL.max / x.formulas.n, 9)
    expect(x.m.sig.iD.avg).toBeCloseTo(x.m.Iout, 6)
    expect(x.m.sig.iL.pp).toBeCloseTo((p.Vin * p.D) / (p.L * p.fs), 3)
  })
  it('the switch blocks 48.0 V: the rail plus the output reflected back', () => {
    const { x, p } = at('d3')
    expect(x.formulas.blocking).toBeCloseTo(p.Vin + x.m.sig.vout.avg / x.formulas.n, 9)
    expect(x.formulas.blocking).toBeCloseTo(48.0, 1)
    expect(x.formulas.blocking / p.Vin).toBeCloseTo(2, 2)
    expect(x.m.sig.vsw.max).toBeCloseTo(48.0, 1)
  })
  it('D = 75 % gives M = 1.50 and 36.0 V, which is the buck-boost’s runaway with the turns on it', () => {
    const { x } = at('d3', { D: 0.75 })
    expect(x.m.M).toBeCloseTo(1.5, 2)
    expect(x.m.sig.vout.avg).toBeCloseTo(36.0, 0)
    expect(x.ss.mode).toBe('CCM')
  })
})

describe('D4 · the half-bridge', () => {
  it('M = n·D exactly: 48 V through a 4:1 transformer at D = 41.7 % is 5.000 V', () => {
    const { x, p } = at('d4')
    expect(p.Np).toBe(4)
    expect(x.formulas.n).toBeCloseTo(0.25, 12)
    expect(x.formulas.M).toBeCloseTo(0.25 * (5 / 12), 12)
    expect(x.m.M).toBeCloseTo(0.104167, 6)
    expect(x.m.sig.vout.avg).toBeCloseTo(5, 6)
    expect(x.formulas.vpulse).toBeCloseTo(6, 9)
    expect(at('d4', { D: 0.25 }).x.m.sig.vout.avg).toBeCloseTo(3, 6)
  })
  it('the filter is fed twice a switching period, so the ripple runs at 200 kHz', () => {
    const { x, p } = at('d4')
    expect(x.formulas.switching.fs).toBe(p.fs)
    expect(x.T).toBeCloseTo(1 / (2 * p.fs), 15)
    expect(x.formulas.ripplePulses).toBe(2)
    expect(x.m.sig.iL.pp * 1e3).toBeCloseTo(41.7, 1)
    expect(x.m.sig.vout.pp * 1e6).toBeCloseTo(260, 0)
    // The same filter fed once a period would carry twice the ripple.
    expect(x.formulas.dVatFs * 1e6).toBeCloseTo(521, 0)
    expect(x.formulas.dVatFs / x.m.sig.vout.pp).toBeCloseTo(2, 2)
  })
  it('each switch blocks the rail, where the flyback’s blocks twice its own', () => {
    const { x, p } = at('d4')
    expect(x.formulas.blocking).toBeCloseTo(48, 12)
    expect(x.formulas.blocking).toBeCloseTo(p.Vin, 12)
    const fly = at('d3').x
    expect(fly.formulas.blocking / fly.p.Vin).toBeCloseTo(2, 2)
  })
  it('nothing is stored in the core: the rail delivers exactly what the load takes', () => {
    const { x } = at('d4')
    expect(x.m.Pin).toBeCloseTo(x.m.Pout, 9)
    expect(x.m.Pout).toBeCloseTo(5, 6)
    expect(x.m.sig.iQ.max).toBeCloseTo(x.formulas.n * x.m.sig.iL.max, 9)
  })
})

describe('F1 · the square-wave inverter', () => {
  it('the fundamental is (4/π)·V_dc/√2 = 43.2 V and the THD is √(π²/8 − 1) = 48.3 %', () => {
    const { x, p } = at('f1')
    expect(x.conv.mf).toBe(1)
    expect(x.m.Vsw1).toBeCloseTo((4 / Math.PI) * p.Vdc * Math.SQRT1_2, 9)
    expect(x.m.Vsw1).toBeCloseTo(43.215, 3)
    expect(x.m.thdSw).toBeCloseTo(Math.sqrt(Math.PI ** 2 / 8 - 1), 9)
    expect(x.m.thdSw * 100).toBeCloseTo(48.34, 2)
    expect(x.m.sig.vsw.rms).toBeCloseTo(48, 6)
  })
  it('halving the rail halves the fundamental and leaves the distortion alone', () => {
    const { x } = at('f1', { Vdc: 24 })
    expect(x.m.Vsw1).toBeCloseTo(21.608, 3)
    expect(x.m.thdSw * 100).toBeCloseTo(48.34, 2)
  })
  it('the filter cannot help: its corner is at 1.59 kHz and the third harmonic is at 180 Hz', () => {
    const { x, p } = at('f1')
    expect(x.formulas.fo).toBeCloseTo(1591.5, 0)
    expect(x.formulas.Hthird).toBeGreaterThan(0.99)
    expect(3 * p.f1).toBe(180)
    expect(x.m.thd * 100).toBeCloseTo(48.16, 1)
  })
})

describe('F2 · sine PWM', () => {
  it('the fundamental is m_a·V_dc: 38.4 V peak at 80 % of the carrier’s height', () => {
    const { x, p } = at('f2')
    expect(x.conv.mf).toBe(63)
    expect(x.m.Vsw1 * Math.SQRT2).toBeCloseTo(p.ma * p.Vdc, 6)
    expect(x.m.Vsw1 * Math.SQRT2).toBeCloseTo(38.4, 3)
    expect(x.m.thd * 100).toBeCloseTo(21.19, 1)
  })
  it('at 40 % the fundamental halves, whatever the carrier does', () => {
    for (const fsw of [1980, 3780]) {
      const { x } = at('f2', { ma: 0.4, fsw })
      expect(x.m.Vsw1 * Math.SQRT2, `fsw ${fsw}`).toBeCloseTo(19.2, 3)
    }
  })
  it('past 100 % the fundamental falls behind the line: 120 % buys 53.0 V, not 57.6 V', () => {
    const { x, p } = at('f2', { ma: 1.2 })
    expect(x.m.Vsw1 * Math.SQRT2).toBeCloseTo(53.0, 1)
    expect(x.m.Vsw1 * Math.SQRT2).toBeLessThan(1.2 * p.Vdc)
    expect(1.2 * p.Vdc).toBeCloseTo(57.6, 9)
    expect(x.m.Vsw1 * Math.SQRT2).toBeGreaterThan(p.Vdc)
  })
})

describe('F3 · the spectrum has families', () => {
  it('nothing between the fundamental and the cluster at the 63rd harmonic', () => {
    const { x } = at('f3')
    const h = x.m.harmonics
    const first = h[0].rms
    const baseband = Math.max(...h.filter((q) => q.k > 1 && q.k <= x.conv.mf - 5).map((q) => q.rms))
    expect(baseband / first).toBeLessThan(2e-4)
    expect(x.m.carrier.k).toBe(63)
    expect((100 * x.m.carrier.rms) / first).toBeCloseTo(102, 0)
    // Half-wave symmetry: m_f is odd, so no even harmonic survives.
    for (const q of h) if (q.k % 2 === 0) expect(q.rms).toBeLessThan(1e-9 * first)
  })
  it('the filter takes the 63rd down by 0.192, which is |H| at 3.78 kHz', () => {
    const { x } = at('f3')
    expect(x.formulas.fsw).toBe(3780)
    expect(x.m.attenuation).toBeCloseTo(x.formulas.Hcarrier, 6)
    expect(x.m.attenuation).toBeCloseTo(0.1918, 4)
    expect(x.m.thd * 100).toBeCloseTo(21.19, 1)
  })
  it('a slower carrier lands nearer the corner, and the filter does less with it', () => {
    const { x } = at('f3', { fsw: 1980 })
    expect(x.conv.mf).toBe(33)
    expect(x.m.attenuation).toBeCloseTo(0.7357, 4)
    expect(x.m.attenuation).toBeCloseTo(x.formulas.Hcarrier, 6)
    expect(x.m.thd * 100).toBeCloseTo(81.3, 0)
  })
})

describe('F4 · distortion against effort', () => {
  it('the THD falls as the carrier climbs past the 1.59 kHz corner', () => {
    const thd = [900, 1980, 3780, 7740].map((fsw) => at('f4', { fsw }).x.m.thd * 100)
    expect(thd[0]).toBeCloseTo(135.5, 1)
    expect(thd[1]).toBeCloseTo(81.3, 1)
    expect(thd[2]).toBeCloseTo(21.2, 1)
    expect(thd[3]).toBeCloseTo(4.8, 1)
    for (let i = 1; i < thd.length; i++) expect(thd[i], `step ${i}`).toBeLessThan(thd[i - 1])
  })
  it('at 900 Hz the carrier is below the corner, and the filter lifts it rather than cutting it', () => {
    const { x } = at('f4', { fsw: 900 })
    expect(x.formulas.fsw).toBeLessThan(x.formulas.fo)
    expect(x.formulas.Hcarrier).toBeGreaterThan(1)
    expect(x.m.thd).toBeGreaterThan(1)
  })
  it('the sweep is the same curve, one solved fundamental period a point', () => {
    const pts = sweepFsw(defaultsOf('f4'))
    expect(pts.length).toBeGreaterThan(15)
    for (const q of pts) {
      expect(Number.isFinite(q.thd)).toBe(true)
      expect(q.mf % 2).toBe(1)
    }
    // The carrier is locked to an odd multiple, so the curve is a staircase
    // that never rises as the carrier does.
    const above = pts.filter((q) => q.mf * 60 > 2000)
    for (let i = 1; i < above.length; i++) expect(above[i].thd).toBeLessThanOrEqual(above[i - 1].thd * 1.01)
  })
})

describe('G1 · conduction against switching', () => {
  it('the two cross at R_on·I/(V·t_sw) = 488 kHz, where each costs 114 mW', () => {
    const { x, p } = at('g1')
    const led = lossLedger(x.m)
    const fstar = switchingCrossover({ Ron: p.Ron, Iout: x.m.Iout, Vblk: x.m.Vblk, tsw: p.tsw })
    expect(fstar / 1e3).toBeCloseTo(488, 0)
    expect(p.fs).toBe(488e3)
    expect(led.conduction * 1e3).toBeCloseTo(114, 0)
    expect(led.switching * 1e3).toBeCloseTo(114, 0)
    expect(Math.abs(led.switching / led.conduction - 1)).toBeLessThan(0.01)
    expect(led.eta * 100).toBeCloseTo(95.4, 1)
  })
  it('conduction does not follow the frequency and the edges do', () => {
    const slow = lossLedger(at('g1', { fs: 100e3 }).x.m)
    const fast = lossLedger(at('g1', { fs: 2e6 }).x.m)
    expect(slow.switching * 1e3).toBeCloseTo(23.4, 0)
    expect(slow.eta * 100).toBeCloseTo(97.2, 1)
    expect(fast.switching * 1e3).toBeCloseTo(469, 0)
    expect(fast.eta * 100).toBeCloseTo(89.1, 1)
    // The conduction loss is the same watt at twenty times the frequency.
    expect(Math.abs(fast.conduction / slow.conduction - 1)).toBeLessThan(0.01)
    // And the edges are charged in proportion.
    expect(fast.switching / slow.switching).toBeCloseTo(20, 0)
  })
})

describe('G2 · the efficiency curve', () => {
  it('the peak sits at √12·L·f_s/(1 − D) = 13.1 Ω, which is √3 times the boundary', () => {
    const { x, p } = at('g2')
    const Rstar = peakEfficiencyLoad(p)
    expect(Rstar).toBeCloseTo(13.06, 2)
    expect(p.R).toBeCloseTo(Rstar, 9)
    expect(Rstar / ((2 * p.L * p.fs) / (1 - p.D))).toBeCloseTo(Math.sqrt(3), 12)
    expect((2 * p.L * p.fs) / (1 - p.D)).toBeCloseTo(7.543, 3)
    expect(x.m.eta * 100).toBeCloseTo(97.7, 1)
  })
  it('there the ripple’s share of the loss equals the load’s', () => {
    const { x, p } = at('g2')
    const Rt = p.Ron + p.RL
    const load = Rt * x.m.Iout ** 2
    const ripple = Rt * (x.m.sig.iL.rms ** 2 - x.m.Iout ** 2)
    expect(ripple * 1e3).toBeCloseTo(22.0, 1)
    expect(load * 1e3).toBeCloseTo(21.5, 1)
    expect(Math.abs(ripple / load - 1)).toBeLessThan(0.03)
  })
  it('and it is a peak: heavier and lighter loads both cost efficiency', () => {
    const peak = at('g2').x.m.eta
    for (const R of [1, 3, 40, 1000]) expect(at('g2', { R }).x.m.eta, `at ${R} Ω`).toBeLessThan(peak)
    expect(at('g2', { R: 1 }).x.m.eta * 100).toBeCloseTo(86.9, 1)
    expect(at('g2', { R: 1000 }).x.m.eta * 100).toBeCloseTo(53.2, 1)
  })
})

describe('G3 · the capacitor’s hidden heater', () => {
  it('the boost’s capacitor carries 1.003 A where a buck’s would carry 0.173 A', () => {
    const { x, p } = at('g3')
    const dI = x.m.sig.iL.pp
    expect(dI).toBeCloseTo(0.6, 3)
    expect(x.m.sig.iC.rms).toBeCloseTo(1.003, 3)
    expect(x.m.sig.iC.rms).toBeCloseTo(capacitorRms('boost', { D: p.D, Iout: x.m.Iout, dI }), 2)
    const buckLike = capacitorRms('buck', { D: p.D, Iout: x.m.Iout, dI })
    expect(buckLike).toBeCloseTo(0.173, 3)
    expect(buckLike).toBeCloseTo(dI / Math.sqrt(12), 12)
    expect(x.m.sig.iC.rms / buckLike).toBeGreaterThan(5)
  })
  it('heat goes as the square, so 50 mΩ makes 50.3 mW here and 1.5 mW there', () => {
    const { x, p } = at('g3')
    const dI = x.m.sig.iL.pp
    const buckLike = capacitorRms('buck', { D: p.D, Iout: x.m.Iout, dI })
    expect(x.m.loss.esr * 1e3).toBeCloseTo(50.3, 1)
    expect(p.ESR * buckLike ** 2 * 1e3).toBeCloseTo(1.5, 1)
    expect(x.m.loss.esr / (p.ESR * buckLike ** 2)).toBeGreaterThan(30)
    expect(x.m.sig.vout.avg).toBeCloseTo(23.95, 2)
  })
  it('turning the ESR up turns it into heat and a step of ripple, and to nothing at zero', () => {
    expect(at('g3', { ESR: 0.2 }).x.m.loss.esr * 1e3).toBeCloseTo(196, 0)
    expect(at('g3', { ESR: 0 }).x.m.loss.esr).toBe(0)
    expect(at('g3', { ESR: 0 }).x.m.sig.vout.pp * 1e3).toBeCloseTo(22.7, 1)
  })
})

describe('G4 · where the watts went', () => {
  it('the five mechanisms, and a residual of zero', () => {
    const { x } = at('g4')
    const led = lossLedger(x.m)
    const mw = (k) => led.rows.find((r) => r.key === k).watts * 1e3
    expect(led.rows.map((r) => r.key)).toEqual(['switch', 'diode', 'inductor', 'esr', 'switching'])
    expect(mw('switch')).toBeCloseTo(18.3, 1)
    expect(mw('diode')).toBeCloseTo(272, 0)
    expect(mw('inductor')).toBeCloseTo(26.3, 1)
    expect(mw('esr')).toBeCloseTo(0.374, 2)
    expect(mw('switching')).toBeCloseTo(23.3, 1)
    expect(led.Pout).toBeCloseTo(4.345, 3)
    expect(led.Psource).toBeCloseTo(4.685, 3)
    expect(led.eta * 100).toBeCloseTo(92.7, 1)
    // The identity, which is the pane's whole subject.
    expect(Math.abs(led.residual)).toBeLessThan(1e-12 * led.Pin)
    expect(led.Pout + led.conduction + led.switching).toBeCloseTo(led.Psource, 12)
  })
  it('the switching row is the one that is a model rather than a waveform', () => {
    const led = lossLedger(at('g4').x.m)
    expect(led.rows.filter((r) => r.model).map((r) => r.key)).toEqual(['switching'])
    expect(led.Psource).toBeCloseTo(led.Pin + led.switching, 12)
  })
  it('turning R_on up grows one row and leaves the others where they were', () => {
    const base = lossLedger(at('g4').x.m)
    const more = lossLedger(at('g4', { Ron: 0.2 }).x.m)
    const mw = (led, k) => led.rows.find((r) => r.key === k).watts * 1e3
    expect(mw(more, 'switch')).toBeCloseTo(71.3, 1)
    expect(Math.abs(mw(more, 'diode') / mw(base, 'diode') - 1)).toBeLessThan(0.02)
    expect(Math.abs(mw(more, 'inductor') / mw(base, 'inductor') - 1)).toBeLessThan(0.03)
    expect(Math.abs(more.residual)).toBeLessThan(1e-12 * more.Pin)
    const none = lossLedger(at('g4', { Ron: 0 }).x.m)
    expect(mw(none, 'switch')).toBe(0)
    expect(none.eta * 100).toBeCloseTo(93.1, 1)
  })
})

describe('the sweeps', () => {
  // A budget in milliseconds is a claim about the machine, not about the code.
  // This was one, at 1500 ms, and it passed here and failed on a CI runner
  // three times slower. What the sweep actually has to be is cheap *relative to
  // a solve*: it is sixty-odd steady states, so it should cost sixty-odd steady
  // states and not six hundred. Calibrating against one solve says that, and
  // says it the same on any machine.
  const timeOf = (f) => {
    const t = performance.now()
    f()
    return performance.now() - t
  }
  const solveCost = () => {
    // Warm the JIT first, then take the best of three: the floor is the honest
    // figure to divide by, and a first run includes compilation.
    for (let i = 0; i < 2; i++) analyse(byId.b4, defaultsOf('b4'))
    return Math.min(...[0, 1, 2].map(() => timeOf(() => analyse(byId.b4, defaultsOf('b4')))))
  }

  it('cost what a knob turn can afford: a sweep is worth about the solves in it', () => {
    const one = solveCost()
    // 163 solve points across the three, and a sweep point is cheaper than a
    // full analyse because it builds no waveform. Measured at 65×.
    const buck = timeOf(() => {
      sweepR(defaultsOf('b4'))
      sweepD(defaultsOf('b2'))
      sweepEta(defaultsOf('b7'))
    })
    expect(buck / one, `buck sweeps cost ${(buck / one).toFixed(0)} solves`).toBeLessThan(150)

    // 86 points, on the event-driven engine, which costs more per point.
    const line = timeOf(() => {
      sweepC(defaultsOf('e3'), byId.e3)
      sweepAlpha(defaultsOf('e5'))
    })
    expect(line / one, `line sweeps cost ${(line / one).toFixed(0)} solves`).toBeLessThan(400)
  }, 60000)
})

