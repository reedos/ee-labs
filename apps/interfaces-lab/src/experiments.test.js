import { describe, expect, it } from 'vitest'
import { transient } from '@ee-labs/network'
import { GROUP_D, inverterMargins, pointOf } from '../../electronics-lab/src/groups/d.js'
import { analyse, DEFAULTS, noiseMargins, thresholdsOf } from './pin.js'
import { EXPERIMENTS, GROUPS, KNOBS, MODELS, defaultsOf, pinLayout } from './experiments.js'
import { LESSONS, number, readQuantity } from './lessons.js'
import { TERMS } from './terms.js'
import { loadSweep } from './components/LoadCanvas.jsx'
import { mathEntry } from './math.js'
import { texFailures } from '@ee-labs/explain/testing'

const close = (actual, expected, scale = Math.abs(expected)) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.max(1e-22, scale * 2e-8))

// Reference values come from component laws, independently of the adapter's state matrices.
function reference(p) {
  const resistance = p.drive === 'open-drain' ? p.rpu : p.ron
  const vil = p.vdd * 3 / 8 + p.vt / 4
  const vih = p.vdd - vil
  const tr = Math.log(0.9 / 0.1) * resistance * p.cload
  const target = p.drive === 'open-drain' ? p.vdd / (1 + p.rpu / p.ron) : 0
  const rfall = p.drive === 'open-drain' ? p.ron * p.rpu / (p.ron + p.rpu) : p.ron
  const low = p.loadCurrent * p.ron
  const high = p.vdd - low
  const margin = Math.min(vil - low, high - vih)
  const bounce = p.inductance * (p.pins * p.vdd / p.ron) / p.edgeTime
  return {
    'rise.segments.0.tau': resistance * p.cload,
    'rise.tr': tr,
    'rise.tpLH': resistance * p.cload * Math.log(p.vdd / vil),
    'fall.segments.0.target': target,
    'fall.tf': rfall * p.cload * Math.log((0.9 * p.vdd - target) / (0.1 * p.vdd - target)),
    'thresholds.vil': vil, 'thresholds.vih': vih, 'thresholds.vm': p.vdd / 2,
    'budget.slack': p.riseBudget - tr,
    'budget.maxCap': p.riseBudget / (Math.log(9) * resistance),
    'margins.vol': low, 'margins.voh': high,
    'margins.nml': vil - low, 'margins.nmh': high - vih,
    'margins.currentStep': p.vdd / p.ron,
    'margins.bounce': bounce, 'margins.slack': margin - bounce,
    'margins.maxPins': Math.floor(margin / (p.inductance * p.vdd / p.ron / p.edgeTime)),
  }
}

describe('A1-A5 lesson pins', () => {
  it('sequential Try walks preserve earlier settings and keep every reading pinned', () => {
    for (const exp of EXPERIMENTS) {
      let p = { ...defaultsOf(exp.id), cload: 120e-12, ron: 40, vdd: 4 }
      for (const step of LESSONS[exp.id].try) {
        p = { ...p, ...step.set }
        const x = analyse(p)
        for (const [path, value] of Object.entries(reference(p))) close(readQuantity(x, path), value)
      }
      if (exp.id === 'a5') {
        expect(p.edgeTime).toBe(LESSONS.a5.try[0].set.edgeTime)
        expect(p.pins).toBe(LESSONS.a5.try[1].set.pins)
        expect(p.ron).toBe(40)
      }
    }
  })

  for (const exp of EXPERIMENTS) {
    it(`${exp.id}: every default and Try reading matches independent laws`, () => {
      for (const patch of [{}, ...LESSONS[exp.id].try.map((step) => step.set), { ron: 30, cload: 120e-12, vdd: 4, vt: 0.6 }]) {
        const p = { ...defaultsOf(exp.id), ...patch }
        const x = analyse(p)
        const expected = reference(p)
        for (const [path, value] of Object.entries(expected)) close(readQuantity(x, path), value)
        const see = LESSONS[exp.id].see(x, p)
        const formats = {
          a1: [['rise.segments.0.tau', 'ns', 1e-9], ['rise.tr', 'ns', 1e-9]],
          a2: [['thresholds.vil', 'V'], ['thresholds.vih', 'V'], ['rise.tpLH', 'ns', 1e-9]],
          a3: [['rise.tpLH', 'ns', 1e-9], ['fall.segments.0.target', 'V']],
          a4: [['rise.tr', 'ns', 1e-9], ['budget.slack', 'ns', 1e-9], ['budget.maxCap', 'pF', 1e-12]],
          a5: [['margins.nml', 'V'], ['margins.nmh', 'V'], ['margins.bounce', 'V'], ['margins.slack', 'V']],
        }
        for (const [path, unit, factor] of formats[exp.id]) expect(see).toContain(number(expected[path], unit, factor))
        if (exp.id === 'a3') expect(see).toContain((p.rpu / p.ron).toPrecision(4))
        if (exp.id === 'a4') expect(see).toContain(number(p.riseBudget, 'ns', 1e-9))
      }
    })
  }

  it('A1: RC divides the remaining voltage by e and ln(9) replaces rounded 2.2', () => {
    const p = defaultsOf('a1')
    const x = analyse(p)
    close(p.vdd - x.rise.wave(p.ron * p.cload), p.vdd / Math.E)
    close(x.rise.tr, p.ron * p.cload * (Math.log(10) - Math.log(10 / 9)))
    expect(x.rise.tr).toBeLessThan(2.2 * p.ron * p.cload)
    close(x.fall.tf, x.rise.tr)
  })

  it('A2: both supplies and several thresholds match the Electronics D6 circuit slopes', () => {
    const exp = GROUP_D.find((e) => e.id === 'd6')
    expect(exp).toBeDefined()
    for (const vdd of [3.3, 5]) for (const vt of [0.5, 0.7, 0.9]) {
      const { vil, vih } = thresholdsOf({ vdd, vt })
      const out = (vin) => {
        const net = exp.net({ vin, vt, kn: 20e-3 })
        net.elements = net.elements.map((e) => e.id === 'VDD' ? { ...e, value: vdd } : e)
        return pointOf(net).sol.v.out
      }
      for (const v of [vil, vih]) {
        const h = 1e-4
        expect((out(v + h) - out(v - h)) / (2 * h)).toBeCloseTo(-1, 5)
      }
      close(out(0), vdd)
      close(out(vdd), 0, vdd)
      if (vdd === 5) {
        const shared = inverterMargins({ vt, kn: 20e-3 })
        expect(shared.vil).toBeCloseTo(vil, 5)
        expect(shared.vih).toBeCloseTo(vih, 5)
      }
    }
  })

  it('A3: crossing ratio holds from discharged capacitors at four pull-ups', () => {
    for (const rpu of [500, 1000, 10000, 100000]) {
      const p = { ...DEFAULTS, rpu }
      const pp = analyse(p)
      const od = analyse({ ...p, drive: 'open-drain' })
      close(od.rise.tpLH / pp.rise.tpLH, rpu / p.ron)
      expect(od.fall.tf).toBeLessThan(od.rise.tr)
      expect(od.fall.segments[0].tau).toBeLessThan(p.ron * p.cload)
    }
  })

  it('A4: three resistance slopes, plotted samples and both sides of the rise budget', () => {
    for (const ron of [10, 25, 100]) {
      const p = { ...DEFAULTS, ron }
      const samples = loadSweep(p)
      expect(samples).toHaveLength(26)
      for (const s of samples) close(s.rise / s.c, Math.log(9) * ron)
      const first = samples[0]
      const last = samples.at(-1)
      close((last.rise - first.rise) / (last.c - first.c), Math.log(9) * ron)
      const cap = p.riseBudget / (Math.log(9) * ron)
      expect(analyse({ ...p, cload: cap * (1 - 1e-6) }).budget.slack).toBeGreaterThan(0)
      expect(analyse({ ...p, cload: cap * (1 + 1e-6) }).budget.slack).toBeLessThan(0)
      close(analyse({ ...p, cload: cap }).budget.slack, 0, p.riseBudget)
    }
  })

  it('A5: four ramp times satisfy the network inductor law and bound the pin count', () => {
    for (const edgeTime of [2e-9, 5e-9, 10e-9, 20e-9]) {
      const p = { ...DEFAULTS, edgeTime }
      const m = noiseMargins(p)
      const ramp = transient({ elements: [
        { id: 'Lreturn', type: 'L', nodes: ['local', 'gnd'], value: p.inductance },
        { id: 'Vbounce', type: 'V', nodes: ['local', 'gnd'], value: m.bounce },
      ] }, { tEnd: edgeTime, x0: [0], points: 2 })
      close(ramp.at(edgeTime).sol.i.Lreturn, p.pins * p.vdd / p.ron)
      expect(m.maxPins * m.perPin).toBeLessThanOrEqual(m.margin)
      expect((m.maxPins + 1) * m.perPin).toBeGreaterThan(m.margin)
    }
    const fast = noiseMargins(DEFAULTS)
    const slow = noiseMargins({ ...DEFAULTS, edgeTime: DEFAULTS.edgeTime * 10 })
    close(fast.bounce / slow.bounce, 10)
    expect(fast.slack).toBeLessThan(0)
    expect(slow.slack).toBeGreaterThan(0)
    expect(noiseMargins({ ...DEFAULTS, pins: fast.maxPins }).slack).toBeGreaterThanOrEqual(0)
    expect(noiseMargins({ ...DEFAULTS, pins: fast.maxPins + 1 }).slack).toBeLessThan(0)
  })
})

describe('lesson and navigation structure', () => {
  it('contains exactly Group A and resolves every term and prerequisite', () => {
    expect(EXPERIMENTS.map((e) => e.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5'])
    expect(GROUPS).toHaveLength(1)
    for (const e of EXPERIMENTS) {
      expect(MODELS.some((m) => m.id === e.model)).toBe(true)
      for (const key of e.knobs) expect(KNOBS[key]).toBeDefined()
      for (const key of e.terms) expect(TERMS[key]?.def.length).toBeGreaterThan(30)
      for (const ref of e.refs) expect(GROUP_D.some((d) => d.id === ref)).toBe(true)
      expect(LESSONS[e.id].why).not.toMatch(/\b[B-G][1-9]\b/)
    }
    expect(new Set(EXPERIMENTS.flatMap((e) => e.terms))).toEqual(new Set(Object.keys(TERMS)))
  })

  it('draws every circuit element, and every math formula renders', () => {
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      const x = analyse(p)
      const drawn = pinLayout(p.drive).items.filter((i) => i.el).map((i) => i.el).sort()
      expect(drawn).toEqual(x.rise.segments[0].net.elements.map((el) => el.id).sort())
      expect(texFailures(mathEntry(e.id, p, x))).toEqual([])
    }
  })
})
