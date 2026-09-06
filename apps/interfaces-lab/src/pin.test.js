import { describe, expect, it } from 'vitest'
import { DEFAULTS, noiseMargins, pinDrive, pinNet, riseBudgetOf, thresholdsOf } from './pin.js'

const close = (actual, expected, scale = Math.abs(expected)) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.max(1e-22, scale * 2e-9))
let seed = 5138
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32)

describe('network-backed pin invariants', () => {
  for (const drive of ['push-pull', 'open-drain']) {
    it(`${drive}: waveform, crossings, KCL and power across the parameter space`, () => {
      for (let trial = 0; trial < 32; trial++) {
        const p = { ...DEFAULTS, drive, ron: 5 + 95 * random(), rpu: 500 * 200 ** random(),
          cload: 10e-12 * 100 ** random(), vdd: 1.8 + 3.2 * random(), vt: 0.2 + 0.6 * random() }
        for (const value of [0, 1]) {
          const r = value ? (drive === 'push-pull' ? p.ron : p.rpu)
            : drive === 'push-pull' ? p.ron : 1 / (1 / p.ron + 1 / p.rpu)
          const target = value ? p.vdd : drive === 'push-pull' ? 0 : p.vdd * p.ron / (p.ron + p.rpu)
          const initial = value ? 0 : p.vdd
          const tau = r * p.cload
          const run = pinDrive(p, [{ t: 0, value }], { initial, tEnd: 8 * tau })
          for (let i = 0; i < 20; i++) {
            const t = tau * i / 3
            const v = target + (initial - target) * Math.exp(-t / tau)
            close(run.wave(t), v, p.vdd)
            const sol = run.at(t).sol
            const supplied = drive === 'push-pull' ? sol.i.SH : sol.i.Rpu
            close(supplied - sol.i.SL - sol.i.Cload, 0, p.vdd / p.ron)
            close(Object.values(sol.p).reduce((a, b) => a + b, 0), 0, p.vdd ** 2 / p.ron)
            close(sol.i.Cload, (target - v) / r, p.vdd / p.ron)
          }
          expect(run.crossings.length).toBeGreaterThanOrEqual(4)
          for (const c of run.crossings) {
            const v = c.level === 'v10' ? p.vdd / 10 : c.level === 'v90' ? p.vdd * 0.9 : run.thresholds[c.level]
            const expected = tau * Math.log((initial - target) / (v - target))
            close(c.t, expected)
            close(run.wave(c.t), v, p.vdd)
          }
        }
      }
    })

    it(`${drive}: ten edge streams preserve state and recover each sufficiently separated edge`, () => {
      for (let trial = 0; trial < 10; trial++) {
        const p = { ...DEFAULTS, drive, rpu: 500 * 200 ** random(), cload: 10e-12 * 100 ** random() }
        const spacing = 12 * Math.max(p.ron, drive === 'open-drain' ? p.rpu : 0) * p.cload
        const edges = Array.from({ length: 6 }, (_, i) => ({ t: i * spacing, value: 1 - i % 2 }))
        const run = pinDrive(p, edges, { tEnd: edges.length * spacing })
        const read = run.crossings.filter((c) => c.level === (c.dir === 1 ? 'vih' : 'vil'))
        expect(read).toHaveLength(edges.length)
        read.forEach((c, i) => {
          expect(c.edge).toBe(i)
          expect(c.dir).toBe(edges[i].value ? 1 : -1)
          expect(c.t).toBeGreaterThan(edges[i].t)
          const s = run.segments[i]
          const expected = s.start + s.tau * Math.log((s.initial - s.target) / (run.thresholds[c.level] - s.target))
          close(c.t, expected)
          if (i) close(s.initial, run.segments[i - 1].run.at(s.start).x[0], p.vdd)
        })
      }
    })
  }

  it('short pulses do not invent receiver edges or combine intervals from different edges', () => {
    const tau = DEFAULTS.ron * DEFAULTS.cload
    const run = pinDrive(DEFAULTS, [{ t: 0, value: 1 }, { t: tau / 20, value: 0 },
      { t: tau / 10, value: 1 }, { t: tau * 0.15, value: 0 }], { tEnd: 8 * tau })
    expect(run.crossings.filter((c) => ['vil', 'vih', 'vm'].includes(c.level))).toHaveLength(0)
    expect(run.tpLH).toBeNull()
    expect(run.tr).toBeNull()
    expect(run.tf).toBeNull()
    expect(riseBudgetOf(run, DEFAULTS.riseBudget)).toEqual({
      slack: null, pass: null, reason: 'The waveform does not cross both rise levels.',
    })
  })

  it('open-drain DC low and incomplete falling transitions retain their physical meaning', () => {
    const p = { ...DEFAULTS, drive: 'open-drain', rpu: 5, ron: 100 }
    const run = pinDrive(p, [{ t: 0, value: 0 }], { tEnd: 10 * p.ron * p.cload, initial: p.vdd })
    close(run.wave(run.tEnd), p.vdd * p.ron / (p.ron + p.rpu), p.vdd)
    expect(run.tpHL).toBeNull()
    expect(run.tf).toBeNull()
  })

  it('initially low open drain releases from the divider voltage, not from zero', () => {
    const p = { ...DEFAULTS, drive: 'open-drain' }
    const initial = p.vdd * p.ron / (p.ron + p.rpu)
    const run = pinDrive(p, [{ t: 0, value: 1 }], { tEnd: 8 * p.rpu * p.cload, initial })
    close(run.tpLH, p.rpu * p.cload * Math.log((p.vdd - initial) / (p.vdd - run.thresholds.vih)))
    expect(run.tpLH).toBeLessThan(p.rpu * p.cload * Math.log(p.vdd / (p.vdd - run.thresholds.vih)))
  })

  it('a repeated drive command carries state without generating an extra crossing', () => {
    const tau = DEFAULTS.ron * DEFAULTS.cload
    const run = pinDrive(DEFAULTS, [{ t: 0, value: 1 }, { t: tau / 2, value: 1 }], { tEnd: 8 * tau })
    expect(run.crossings.filter((c) => c.level === 'vih')).toHaveLength(1)
    close(run.wave(2 * tau), DEFAULTS.vdd * (1 - Math.exp(-2)))
  })

  it('both push-pull switches are never closed together', () => {
    for (const value of [0, 1]) {
      const switches = pinNet(DEFAULTS, value).elements.filter((e) => e.type === 'SW')
      expect(switches.filter((e) => e.closed)).toHaveLength(1)
      expect(switches.every((e) => e.ron === DEFAULTS.ron)).toBe(true)
    }
  })
})

describe('boundary refusals', () => {
  it('an absent, invalid or zero interval never becomes a budget pass', () => {
    for (const tr of [null, undefined, NaN, Infinity, 0, -1]) {
      const budget = riseBudgetOf({ tr }, DEFAULTS.riseBudget)
      expect(budget.pass).toBeNull()
      expect(budget.slack).toBeNull()
      expect(budget.reason).toMatch(/does not cross/)
    }
    for (const limit of [0, -1, NaN, Infinity]) expect(() => riseBudgetOf({ tr: 1e-9 }, limit)).toThrow(/finite and positive/)
    expect(riseBudgetOf({ tr: DEFAULTS.riseBudget }, DEFAULTS.riseBudget).pass).toBe(true)
    expect(riseBudgetOf({ tr: DEFAULTS.riseBudget * 1.001 }, DEFAULTS.riseBudget).pass).toBe(false)
  })
  it('rejects invalid pin values and the degenerate threshold domain', () => {
    for (const key of ['ron', 'rpu', 'cload', 'vdd']) for (const value of [0, -1, Infinity, NaN])
      expect(() => pinDrive({ ...DEFAULTS, [key]: value }, [{ t: 0, value: 1 }], { tEnd: 1e-6 })).toThrow(/finite and positive/)
    expect(() => thresholdsOf({ vdd: 1.4, vt: 0.7 })).toThrow(/greater than twice/)
    expect(() => thresholdsOf({ vdd: 3.3, vt: -0.1 })).toThrow(/nonnegative/)
    expect(() => pinDrive({ ...DEFAULTS, drive: 'floating' }, [{ t: 0, value: 1 }], { tEnd: 1e-6 })).toThrow(/Select/)
  })

  it('rejects malformed edge streams, initial states and windows', () => {
    for (const edges of [[], [{ t: 1, value: 1 }], [{ t: 0, value: 2 }],
      [{ t: 0, value: 1 }, { t: 0, value: 0 }], [{ t: 0, value: 1 }, { t: NaN, value: 0 }]])
      expect(() => pinDrive(DEFAULTS, edges, { tEnd: 1 })).toThrow(RangeError)
    for (const tEnd of [0, -1, Infinity, NaN])
      expect(() => pinDrive(DEFAULTS, [{ t: 0, value: 1 }], { tEnd })).toThrow(/time window/)
    for (const initial of [-1, 4, NaN])
      expect(() => pinDrive(DEFAULTS, [{ t: 0, value: 1 }], { tEnd: 1e-8, initial })).toThrow(/Initial voltage/)
    const run = pinDrive(DEFAULTS, [{ t: 0, value: 1 }], { tEnd: 1e-8 })
    for (const t of [-1, 1, NaN]) expect(() => run.wave(t)).toThrow(/cursor/)
  })

  it('checks the load limit, integer pins and the zero-inductance boundary', () => {
    expect(() => noiseMargins({ ...DEFAULTS, loadCurrent: 1 })).toThrow(/rail-limited/)
    for (const pins of [0, 1.5, 33]) expect(() => noiseMargins({ ...DEFAULTS, pins })).toThrow(/one to 32/)
    expect(() => noiseMargins({ ...DEFAULTS, edgeTime: 0 })).toThrow(/positive edge time/)
    const m = noiseMargins({ ...DEFAULTS, inductance: 0 })
    expect(m.bounce).toBe(0)
    expect(m.maxPins).toBe(Infinity)
    expect(noiseMargins({ ...DEFAULTS, loadCurrent: DEFAULTS.vdd / DEFAULTS.ron }).maxPins).toBe(0)
  })
})
