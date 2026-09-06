import { describe, it, expect } from 'vitest'
import { fmt } from '@ee-labs/ui'
import { EXPERIMENTS, GROUPS, GROUP_INTROS, byId, defaultsOf, nextOf, prevOf, positionOf } from './experiments.js'
import { analyse } from './analysis.js'

// The path through the material (POWER_LAB_PLAN.md §11.5 and §11.2.3–4): a
// sequence with a next and a previous, an intro at each group boundary, one
// thing to try per experiment with the knob it names, and chips on the knob
// the experiment is about at the stops its lesson lives at. Every number a
// `try` promises is measured here, as the notes' numbers are in
// experiments.test.js — a promise the engine does not keep fails a test.

const at = (id, over = {}) => analyse(byId[id], { ...defaultsOf(id), ...over })
const words = (s) => s.trim().split(/\s+/).length

describe('the sequence (§11.5.2)', () => {
  it('next and previous walk EXPERIMENTS in order; the first has no previous and the last no next', () => {
    EXPERIMENTS.forEach((e, i) => {
      expect(nextOf(e.id), e.id).toBe(i + 1 < EXPERIMENTS.length ? EXPERIMENTS[i + 1].id : null)
      expect(prevOf(e.id), e.id).toBe(i > 0 ? EXPERIMENTS[i - 1].id : null)
      expect(positionOf(e.id), e.id).toEqual({ n: i + 1, of: EXPERIMENTS.length })
    })
  })
  it('a note that points at "the next experiment" or "this group" has one to point at, and "the next group" is a boundary', () => {
    for (const e of EXPERIMENTS) {
      const next = nextOf(e.id) && byId[nextOf(e.id)]
      if (/next experiment|this group/.test(e.note)) expect(next && next.group === e.group, `${e.id}: "${e.note.match(/next experiment|this group/)[0]}" with nothing after it in ${e.group}`).toBe(true)
      if (/next group/.test(e.note)) expect(next && next.group !== e.group, `${e.id}: "next group" but ${next && next.id} is in ${e.group}`).toBe(true)
      if (/previous experiment/.test(e.note)) expect(prevOf(e.id) && byId[prevOf(e.id)].group === e.group, `${e.id}: "previous experiment"`).toBeTruthy()
    }
  })
})

describe('group intros (§11.2.4, §11.5.3)', () => {
  it('every group has one, of at most 45 words, and the first experiment is in the first group', () => {
    for (const g of GROUPS) {
      expect(GROUP_INTROS[g], g).toBeTruthy()
      expect(words(GROUP_INTROS[g]), `${g}: ${words(GROUP_INTROS[g])} words`).toBeLessThanOrEqual(45)
    }
    expect(EXPERIMENTS[0].group).toBe(GROUPS[0])
  })
})

/** The ways a chip's value might be written in prose: "400 kHz", "4700 µF", "0.900", "75 %", "90°". */
function spellings(v, knob) {
  if (knob.percent) {
    const pc = v * 100
    return [`${+pc.toFixed(1)} %`, `${Math.round(pc)} %`, v.toFixed(3), v.toFixed(2)]
  }
  if (knob.unit === '°') return [`${+v.toFixed(1)}°`]
  const u = knob.unit
  return [
    fmt(v, u, 3),
    fmt(v, u, 2),
    `${+(v * 1e6).toPrecision(4)} µ${u}`,
    `${+(v * 1e3).toPrecision(4)} m${u}`,
    `${+(v * 1e-3).toPrecision(4)} k${u}`,
    `${+v.toPrecision(3)} ${u}`,
  ]
}

/** Every `try` step's text, whichever shape the experiment uses. */
const tryTexts = (e) => (Array.isArray(e.try) ? e.try.map((s) => s.say) : [e.try.text])

describe('one thing to try, and chips where the lesson lives (§11.2.3, §11.3.5, §11.5.5)', () => {
  it('every experiment has a `try` naming one of its knobs, one imperative sentence of at most 30 words (45 for a multi-step try)', () => {
    for (const e of EXPERIMENTS) {
      expect(e.try, e.id).toBeTruthy()
      if (Array.isArray(e.try)) {
        for (const [i, step] of e.try.entries()) {
          expect(e.params.some((p) => p.key === step.knob), `${e.id} step ${i}: try names ${step.knob}`).toBe(true)
          expect(step.say, `${e.id} step ${i}`).toMatch(/^(Set|Turn|Drag|Halve|Double|Replace|Switch|Push|Lower|Raise|Move)\b/)
          expect(words(step.say), `${e.id} step ${i}: ${words(step.say)} words`).toBeLessThanOrEqual(45)
          expect(Object.keys(step.set).length, `${e.id} step ${i}: names no setting`).toBeGreaterThan(0)
        }
      } else {
        expect(e.params.some((p) => p.key === e.try.knob), `${e.id}: try names ${e.try.knob}`).toBe(true)
        expect(e.try.text, e.id).toMatch(/^(Set|Turn|Drag|Halve|Double|Replace|Switch|Push|Lower|Raise|Move)\b/)
        expect(words(e.try.text), `${e.id}: ${words(e.try.text)} words`).toBeLessThanOrEqual(30)
      }
    }
  })
  it('the `about` knob has at least two chips, all in range, one of them the default, each spelled in the note or the try', () => {
    for (const e of EXPERIMENTS) {
      const knob = e.params[0]
      expect(knob.key).toBe(e.about)
      expect(e.chips && e.chips.length, `${e.id}: chips`).toBeGreaterThanOrEqual(2)
      const prose = `${e.note} ${tryTexts(e).join(' ')}`
      for (const v of e.chips) {
        expect(v, `${e.id}: chip ${v} below ${knob.min}`).toBeGreaterThanOrEqual(knob.min)
        expect(v, `${e.id}: chip ${v} above ${knob.max}`).toBeLessThanOrEqual(knob.max)
        const found = spellings(v, knob).some((s) => prose.includes(s))
        expect(found, `${e.id}: chip ${v} (${spellings(v, knob).join(' / ')}) is not in the note or the try`).toBe(true)
      }
      expect(e.chips.some((v) => Math.abs(v - knob.default) <= 1e-9 * Math.max(1, Math.abs(knob.default))), `${e.id}: the default is not a chip`).toBe(true)
    }
  })
})

describe('what each `try` promises', () => {
  const pct = (x) => x * 100
  it('A1: R_load = 1 Ω: the output falls to 1.50 V, not the 5 V it was sized for', () => {
    const x = at('a1', { R: 1 })
    expect(x.m.sig.vout.avg).toBeCloseTo(1.5, 2)
    expect(pct(x.m.eta)).toBeCloseTo(12.5, 1)
  })
  it('A2: D = 75 %: ⟨v⟩ = 9.00 V, RMS 10.4 V', () => {
    const x = at('a2', { D: 0.75 })
    expect(x.m.sig.vout.avg).toBeCloseTo(9.0, 2)
    expect(x.m.sig.vout.rms).toBeCloseTo(10.4, 1)
  })
  it('A3: C = 10 µF: 36.5 mV of ripple, the average still 5.000 V', () => {
    const x = at('a3', { C: 10e-6 })
    expect(x.m.sig.vout.pp * 1e3).toBeCloseTo(36.5, 1)
    expect(x.m.sig.vout.avg).toBeCloseTo(5.0, 3)
    expect(x.m.sig.vout.pp / at('a3').m.sig.vout.pp).toBeCloseTo(10, 0)
  })
  it('B1: L = 22 µH: 1.33 A of ripple, the same 29.2 V·µs', () => {
    const x = at('b1', { L: 22e-6 })
    expect(x.m.sig.iL.pp).toBeCloseTo(1.33, 2)
    expect(x.balance.segs[0].vs * 1e6).toBeCloseTo(29.2, 1)
    expect(x.m.sig.vout.avg).toBeCloseTo(5.0, 2)
  })
  it('B2: D = 75 %: 9.000 V, M = 0.750; D = 25 %: 3.000 V', () => {
    expect(at('b2', { D: 0.75 }).m.sig.vout.avg).toBeCloseTo(9.0, 3)
    expect(at('b2', { D: 0.75 }).m.M).toBeCloseTo(0.75, 3)
    expect(at('b2', { D: 0.25 }).m.sig.vout.avg).toBeCloseTo(3.0, 3)
  })
  it('B3: f_s = 400 kHz: 73 mA of current ripple and 0.23 mV of output ripple', () => {
    const x = at('b3', { fs: 400e3 })
    expect(x.m.sig.iL.pp * 1e3).toBeCloseTo(73, 0)
    expect(x.m.sig.vout.pp * 1e3).toBeCloseTo(0.23, 2)
  })
  it('B4’s three steps: sync on → CCM at −121 mA; sync off → DCM at 8.52 V; R = 5 Ω → CCM, 5.00 V', () => {
    const dflt = defaultsOf('b4')
    const step1 = at('b4', { sync: 1 })
    expect(step1.m.mode).toBe('CCM')
    expect(step1.m.sig.iL.min * 1e3).toBeCloseTo(-121, 0)
    expect(step1.m.sig.vout.avg).toBeCloseTo(5.0, 2)
    const step2 = at('b4', { sync: 0 })
    expect(step2.m.mode).toBe('DCM')
    expect(step2.m.sig.vout.avg).toBeCloseTo(8.52, 2)
    expect(dflt.sync).toBe(0) // step 2 is the experiment's own default
    const step3 = at('b4', { R: 5, sync: 0 })
    expect(step3.m.mode).toBe('CCM')
    expect(step3.m.sig.vout.avg).toBeCloseTo(5.0, 2)
  })
  it('B5’s three steps: 34.3 Ω at the boundary; 100 Ω → DCM, M = 0.594, 7.13 V; 10 Ω → CCM, M = 0.417', () => {
    const step1 = at('b5', { R: 34.2857142857 })
    expect(Math.abs(step1.m.sig.iL.min)).toBeLessThan(1e-6)
    expect(step1.m.M).toBeCloseTo(0.417, 3)
    const step2 = at('b5', { R: 100 })
    expect(step2.m.mode).toBe('DCM')
    expect(step2.m.M).toBeCloseTo(0.594, 3)
    expect(step2.m.sig.vout.avg).toBeCloseTo(7.13, 2)
    const step3 = at('b5', { R: 10 })
    expect(step3.m.mode).toBe('CCM')
    expect(step3.m.M).toBeCloseTo(0.417, 3)
  })
  it('B6: V_in = 48 V: the same rent on 19.7 V out, η = 98.5 %', () => {
    const x = at('b6', { Vin: 48 })
    expect(x.m.sig.vout.avg).toBeCloseTo(19.7, 1)
    expect(pct(x.m.eta)).toBeCloseTo(98.5, 1)
    expect(x.p.D * 48 - x.m.sig.vout.avg).toBeCloseTo(0.292, 2)
  })
  it('B7: ESR = 0.5 Ω: the step is 132 mV; ESR = 0 Ω: 3.63 mV, no step', () => {
    expect(at('b7', { ESR: 0.5 }).m.sig.vout.pp * 1e3).toBeCloseTo(132, 0)
    expect(at('b7', { ESR: 0 }).m.sig.vout.pp * 1e3).toBeCloseTo(3.63, 2)
  })
  it('B8: f_s = 1 MHz: a hundredth the ripple, 36.5 µV, and 240 mW in the edges', () => {
    const x = at('b8', { fs: 1e6 })
    expect(x.m.sig.vout.pp * 1e6).toBeCloseTo(36.5, 1)
    expect(at('b8').m.sig.vout.pp / x.m.sig.vout.pp).toBeCloseTo(100, 0)
    expect(x.m.loss.switching * 1e3).toBeCloseTo(240, 0)
  })
  it('C1: D = 75 %: M = 4.00, 48.0 V, 9.60 A in the inductor', () => {
    const x = at('c1', { D: 0.75 })
    expect(x.m.M).toBeCloseTo(4.0, 2)
    expect(x.m.sig.vout.avg).toBeCloseTo(48.0, 1)
    expect(x.m.sig.iL.avg).toBeCloseTo(9.6, 2)
  })
  it('C2: D = 50 %: M = 1.92 against 2.00, η = 96.1 %', () => {
    const x = at('c2', { D: 0.5 })
    expect(x.m.M).toBeCloseTo(1.92, 2)
    expect(pct(x.m.eta)).toBeCloseTo(96.1, 1)
  })
  it('C3: R = 40 Ω: continuous, M = 2.000, 24.00 V', () => {
    const x = at('c3', { R: 40 })
    expect(x.m.mode).toBe('CCM')
    expect(x.m.M).toBeCloseTo(2.0, 3)
    expect(x.m.sig.vout.avg).toBeCloseTo(24.0, 2)
  })
  it('C4: D = 75 %: M = −3.00, −36.0 V, 7.20 A in the inductor', () => {
    const x = at('c4', { D: 0.75 })
    expect(x.m.M).toBeCloseTo(-3.0, 2)
    expect(x.m.sig.vout.avg).toBeCloseTo(-36.0, 1)
    expect(x.m.sig.iL.avg).toBeCloseTo(7.2, 2)
  })
  it('C5: R = 40 Ω: continuous, 3.60 W', () => {
    const x = at('c5', { R: 40 })
    expect(x.m.mode).toBe('CCM')
    expect(x.m.Pout).toBeCloseTo(3.6, 2)
  })
  it('D1: f_s = 10 kHz: 186 mT of flux swing, ten times as far', () => {
    const x = at('d1', { fs: 10e3 })
    expect(x.formulas.dB * 1e3).toBeCloseTo(186, 0)
    expect(x.formulas.dB / at('d1').formulas.dB).toBeGreaterThan(10)
    expect(x.formulas.dB / at('d1').formulas.dB).toBeLessThan(10.5)
  })
  it('D2: R = 2 Ω: the peak falls to 2.65 A, under the knee', () => {
    const x = at('d2', { R: 2 })
    expect(x.m.sig.iL.max).toBeCloseTo(2.65, 2)
    expect(x.m.sig.iL.max).toBeLessThan(x.formulas.Isat)
    expect(x.ss.mode).toBe('CCM')
  })
  it('D3: D = 75 %: M = 1.50 and 36.0 V out', () => {
    const x = at('d3', { D: 0.75 })
    expect(x.m.M).toBeCloseTo(1.5, 2)
    expect(x.m.sig.vout.avg).toBeCloseTo(36.0, 0)
  })
  it('D4: D = 25 %: M = 0.0625 and 3.00 V out', () => {
    const x = at('d4', { D: 0.25 })
    expect(x.m.M).toBeCloseTo(0.0625, 6)
    expect(x.m.sig.vout.avg).toBeCloseTo(3.0, 4)
  })
  it('F1: V_dc = 24 V: 21.6 V of fundamental, and the same 48.3 % THD', () => {
    const x = at('f1', { Vdc: 24 })
    expect(x.m.Vsw1).toBeCloseTo(21.6, 1)
    expect(pct(x.m.thdSw)).toBeCloseTo(48.3, 1)
  })
  it('F2: m_a = 120 %: 53.0 V of fundamental, short of the 57.6 V commanded', () => {
    const x = at('f2', { ma: 1.2 })
    expect(x.m.Vsw1 * Math.SQRT2).toBeCloseTo(53.0, 1)
    expect(x.m.Vsw1 * Math.SQRT2).toBeLessThan(57.6)
  })
  it('F3: f_sw = 1.98 kHz: the attenuation is 0.736 and the THD 81 %', () => {
    const x = at('f3', { fsw: 1980 })
    expect(x.m.attenuation).toBeCloseTo(0.736, 3)
    expect(pct(x.m.thd)).toBeCloseTo(81, 0)
  })
  it('F4: f_sw = 7.74 kHz: the THD falls to 4.8 %', () => {
    const x = at('f4', { fsw: 7740 })
    expect(pct(x.m.thd)).toBeCloseTo(4.8, 1)
  })
  it('G1: f_s = 2 MHz: 469 mW in the edges, efficiency 89.1 %', () => {
    const x = at('g1', { fs: 2e6 })
    expect(x.m.loss.switching * 1e3).toBeCloseTo(469, 0)
    expect(pct(x.m.eta)).toBeCloseTo(89.1, 1)
  })
  it('G2: R_load = 1 kΩ: efficiency 53.2 %, on 25.0 mW delivered', () => {
    const x = at('g2', { R: 1000 })
    expect(pct(x.m.eta)).toBeCloseTo(53.2, 1)
    expect(x.m.Pout * 1e3).toBeCloseTo(25.0, 1)
  })
  it('G3: ESR = 200 mΩ: 196 mW of heat; at 0 Ω, none', () => {
    expect(at('g3', { ESR: 0.2 }).m.loss.esr * 1e3).toBeCloseTo(196, 0)
    expect(at('g3', { ESR: 0 }).m.loss.esr).toBe(0)
  })
  it('G4: R_on = 0 Ω: the switch’s row empties and efficiency reaches 93.1 %', () => {
    const x = at('g4', { Ron: 0 })
    expect(x.m.loss.switch).toBe(0)
    expect(pct(x.m.eta)).toBeCloseTo(93.1, 1)
  })
  it('E1’s two steps: 1000 µF (default) conducts 42.9°, holds 15.6 V; 100 µF conducts 87.8°, sags 12.4 V', () => {
    const step1 = at('e1', { C: 1000e-6 })
    expect(step1.m.angle).toBeCloseTo(42.9, 1)
    expect(step1.m.Vdc).toBeCloseTo(15.6, 1)
    const step2 = at('e1', { C: 100e-6 })
    expect(step2.m.angle).toBeCloseTo(87.8, 1)
    expect(step2.m.ripple).toBeCloseTo(12.4, 1)
  })
  it('E2: C = 4700 µF: 0.23 V of ripple, 1.34 A peaks, 31.7°; C = 100 µF: 6.9 V of ripple', () => {
    const x = at('e2', { C: 4700e-6 })
    expect(x.m.ripple).toBeCloseTo(0.23, 2)
    expect(x.m.iPeak).toBeCloseTo(1.34, 2)
    expect(x.m.angle).toBeCloseTo(31.7, 1)
    expect(at('e2', { C: 100e-6 }).m.ripple).toBeCloseTo(6.9, 1)
  })
  it('E3: R_s = 0.25 Ω: the floor drops to 28.0° and the peak rises to 1.60 A', () => {
    const x = at('e3', { Rs: 0.25 })
    expect(x.m.angle).toBeCloseTo(28.0, 1)
    expect(x.m.iPeak).toBeCloseTo(1.6, 2)
  })
  it('E4: C = 100 µF: THD 91 %, PF 0.650; C = 4700 µF: THD 157 %, PF 0.537', () => {
    const a = at('e4', { C: 100e-6 })
    expect(pct(a.m.thd)).toBeCloseTo(91, 0)
    expect(a.m.pf).toBeCloseTo(0.65, 3)
    const b = at('e4', { C: 4700e-6 })
    expect(pct(b.m.thd)).toBeCloseTo(157, 0)
    expect(b.m.pf).toBeCloseTo(0.537, 3)
  })
  it('E5: α = 45°: 90.9 % of the power, PF 0.95, THD 26 %', () => {
    const x = at('e5', { alphaDeg: 45 })
    expect(pct(x.m.share)).toBeCloseTo(90.9, 1)
    expect(x.m.pf).toBeCloseTo(0.95, 2)
    expect(pct(x.m.thd)).toBeCloseTo(26, 0)
  })
  it('E6: C = 100 µF: 3.21 V of ripple on 28.1 V DC, where the single-phase bridge at 100 µF sags 6.9 V on 13.1 V', () => {
    const x = at('e6', { C: 100e-6 })
    expect(x.m.ripple).toBeCloseTo(3.21, 2)
    expect(x.m.Vdc).toBeCloseTo(28.1, 1)
    const b = at('e2', { C: 100e-6 })
    expect(b.m.ripple).toBeCloseTo(6.9, 1)
    expect(b.m.Vdc).toBeCloseTo(13.1, 1)
  })
})
