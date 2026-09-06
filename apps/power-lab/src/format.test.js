import { describe, it, expect } from 'vitest'
import { nz, fmtz, statScale, axisFmt, scopeRange, niceBounds, tickStep, logTickStep, ticksIn } from './format.js'
import { EXPERIMENTS, byId, defaultsOf } from './experiments.js'
import { analyse } from './analysis.js'

describe('near-zero values', () => {
  it('read as zero when they are the arithmetic’s residue, and survive when they are not', () => {
    expect(nz(6.8e-16, 12)).toBe(0)
    expect(nz(-2.1e-14, 5)).toBe(0)
    expect(fmtz(6.8e-16, 'V', 4, 12)).toBe('0 V')
    // A real millivolt on a five volt signal is not dust.
    expect(nz(3.65e-3, 5)).toBe(3.65e-3)
    // Nor is a microamp in a circuit that only carries microamps.
    expect(nz(1e-6, 4e-6)).toBe(1e-6)
    // The threshold is where floating point runs out, not where a number stops
    // being interesting: a microamp beside four amps is small but real, and
    // only a part in 1e12 is residue.
    expect(nz(1e-6, 4)).toBe(1e-6)
    expect(nz(1e-12, 4)).toBe(0)
  })

  it('is judged against the signal’s own size, not a fixed floor', () => {
    const tiny = { avg: 1e-9, rms: 2e-9, min: 0, max: 4e-9, pp: 4e-9 }
    expect(statScale(tiny)).toBe(4e-9)
    expect(nz(1e-9, statScale(tiny))).toBe(1e-9)
  })
})

describe('axis ticks', () => {
  const ticksOf = (lo, hi, unit, n = 5) => {
    const f = axisFmt(lo, hi, unit)
    return Array.from({ length: n + 1 }, (_, i) => f(lo + ((hi - lo) * i) / n))
  }

  it('are all different from each other, however narrow the axis', () => {
    // The buck's output: 3.65 mV of ripple on 5 V. At three significant
    // figures every one of these read "5 V".
    const t = ticksOf(4.9978, 5.0022, 'V')
    expect(new Set(t).size, t.join(' ')).toBe(t.length)
    expect(t[0]).toMatch(/4\.99/)
    expect(t[t.length - 1]).toMatch(/5\.00/)
  })

  it('do not spend digits on an axis that does not need them', () => {
    expect(ticksOf(0, 12, 'V')).toEqual(['0 V', '2.4 V', '4.8 V', '7.2 V', '9.6 V', '12 V'])
  })

  it('keep working across the units the lab spans', () => {
    for (const [lo, hi, unit] of [
      [0, 20e-6, 's'],
      [-0.2, 0.2, 'A'],
      [0.8541, 1.1459, 'A'],
      [23.9, 24.1, 'V'],
      [0, 1.2e-3, 'A'],
    ]) {
      const t = ticksOf(lo, hi, unit)
      expect(new Set(t).size, `${lo}…${hi} ${unit}: ${t.join(' ')}`).toBe(t.length)
    }
  })

  it('gives every experiment’s scope axes distinct labels at its own defaults', () => {
    for (const e of EXPERIMENTS) {
      const x = analyse(e, defaultsOf(e.id))
      for (const key of e.traces) {
        const s = x.m.sig[key]
        if (!s || s.pp === 0) continue
        const pad = s.pp * 0.08
        const t = ticksOf(s.min - pad, s.max + pad, key.startsWith('i') ? 'A' : 'V')
        expect(new Set(t).size, `${e.id} ${key}: ${t.join(' ')}`).toBe(t.length)
      }
    }
  })
})

describe('the scope axis', () => {
  const at = (id, over = {}) => analyse(byId[id], { ...defaultsOf(id), ...over })

  it('holds still while a knob moves, so the curve is what changes', () => {
    // B3 is the ripple experiment: the whole point of its capacitor knob is to
    // watch the ripple shrink. If the axis shrinks with it the curve is redrawn
    // identically and the knob looks broken.
    const base = at('b3')
    const frame = scopeRange(base.wf, base.wf, ['vout'])
    for (const C of [200e-6, 470e-6, 1e-3, 4.7e-3]) {
      const now = at('b3', { C })
      expect(scopeRange(now.wf, base.wf, ['vout']), `C = ${C}`).toEqual(frame)
      // ...and the trace really is smaller inside that unchanged frame.
      expect(now.m.sig.vout.pp).toBeLessThan(base.m.sig.vout.pp)
    }
  })

  it('gives way, once, when the signal outgrows it', () => {
    const base = at('b3')
    const frame = scopeRange(base.wf, base.wf, ['vout'])
    const big = at('b3', { C: 1e-6 })
    const grown = scopeRange(big.wf, base.wf, ['vout'])
    expect(big.m.sig.vout.pp).toBeGreaterThan(base.m.sig.vout.pp)
    expect(grown[0]).toBeLessThanOrEqual(frame[0])
    expect(grown[1]).toBeGreaterThanOrEqual(frame[1])
    // The trace fits inside the frame it was given.
    expect(grown[0]).toBeLessThanOrEqual(big.m.sig.vout.min)
    expect(grown[1]).toBeGreaterThanOrEqual(big.m.sig.vout.max)
  })

  it('always contains the trace it is drawn for', () => {
    for (const e of EXPERIMENTS) {
      const x = analyse(e, defaultsOf(e.id))
      for (const key of e.traces) {
        if (!x.m.sig[key]) continue
        const [lo, hi] = scopeRange(x.wf, x.wf, [key])
        expect(lo, `${e.id} ${key} low`).toBeLessThanOrEqual(x.m.sig[key].min)
        expect(hi, `${e.id} ${key} high`).toBeGreaterThanOrEqual(x.m.sig[key].max)
      }
    }
  })

  it('leaves a small ripple looking small: it fills well under half the frame', () => {
    const x = at('b3')
    const [lo, hi] = scopeRange(x.wf, x.wf, ['vout'])
    expect(x.m.sig.vout.pp / (hi - lo)).toBeLessThan(0.45)
    // A trace with a genuinely large swing still uses the frame.
    const [aLo, aHi] = scopeRange(x.wf, x.wf, ['iL'])
    expect(x.m.sig.iL.pp / (aHi - aLo)).toBeGreaterThan(0.5)
  })

  it('snaps its bounds to round numbers', () => {
    expect(niceBounds(4.9925, 5.0075)).toEqual([4.99, 5.01])
    expect(niceBounds(-0.19, 0.19)).toEqual([-0.2, 0.2])
  })
})
describe('the tick step', () => {
  // The frame's own rule takes the step from how much room the plot has, and
  // rounds it up to 1, 2 or 5 times a power of ten. On a short frame that step
  // can be as wide as the range, and the axis ends with one label on it. These
  // are the four real ranges the lab drew that way.
  const cases = [
    [-0.4, 0.4, 132, "D1's flux, +/-400 mT"],
    [4.63, 4.69, 132, "G4's output, 60 mV of window"],
    [33.485, 33.505, 132, "C3's output, 20 mV of window"],
    [-60, 60, 132, "F4's bridge, +/-60 V"],
  ]
  it('puts at least three ticks inside every range the lab draws, however short the frame', () => {
    for (const [lo, hi, room, what] of cases) {
      const step = tickStep(lo, hi, room, 1)
      expect(ticksIn(lo, hi, step), `${what}: step ${step}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('leaves a roomy frame the step it already had', () => {
    // 0 to 12 V over 400 px: the frame's own rule gives 2 V, and so does this.
    expect(tickStep(0, 12, 400, 1)).toBe(2)
    expect(ticksIn(0, 12, 2)).toBe(7)
  })

  it('keeps the step a round number rather than an even division', () => {
    for (const [lo, hi, room] of cases) {
      const step = tickStep(lo, hi, room, 1)
      const mag = Math.pow(10, Math.floor(Math.log10(step)))
      expect([1, 2, 5], `${lo}..${hi} step ${step}`).toContain(Math.round(step / mag))
    }
  })

  it('halves a decade when a log axis holds only one whole one', () => {
    // F4's carrier: 300 Hz to 8 kHz is 1.43 decades and contains one integer,
    // so a decade step labelled the axis "1 kHz" and nothing else.
    const [lo, hi] = [Math.log10(300), Math.log10(8e3)]
    expect(ticksIn(lo, hi, 1)).toBe(1)
    expect(logTickStep(lo, hi)).toBe(0.5)
    expect(ticksIn(lo, hi, 0.5)).toBeGreaterThanOrEqual(3)
    // A wider log axis keeps whole decades: A1's load runs 0.5 Ohm to 1 kOhm.
    expect(logTickStep(Math.log10(0.5), Math.log10(1e3))).toBe(1)
  })
})
