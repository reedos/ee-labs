import { describe, expect, it } from 'vitest'
import { EXPERIMENTS } from './experiments.js'
import { analyse, defaultsOf } from './analysis.js'
import { readQuantity } from './quantities.js'
import { METERS, reading } from './readout.js'

// Every meter, in the unit its quantity is measured in.
//
// The lab shipped reading a 3648 rev/min shaft as "3.648 krev/min" and an
// efficiency of 0.8873 as "887.3 m". Both came from putting an SI prefix on a
// quantity that does not take one, and neither could be matched against the
// note beside it. These are the checks that would have caught them.

/** Every meter of every experiment, at its defaults. */
const shown = []
for (const e of EXPERIMENTS) {
  const x = analyse(e, defaultsOf(e))
  for (const [label, path, unit, digits] of METERS[x.kind] || []) {
    let v
    try {
      v = readQuantity(x, path)
    } catch {
      continue
    }
    shown.push({ id: e.id, label, path, unit, text: reading(v, unit, digits), value: v })
  }
}

describe('the meters', () => {
  it('measures every experiment', () => {
    // Playbook §11: a sweep over an empty set passes everything below it.
    expect(shown.length).toBeGreaterThan(200)
    expect(new Set(shown.map((r) => r.id)).size).toBe(EXPERIMENTS.length)
  })

  it('never puts an SI prefix on a speed', () => {
    const bad = shown.filter((r) => /[kMGmµn]rev\/min/.test(r.text))
    expect(bad.map((r) => `${r.id} ${r.label}: ${r.text}`)).toEqual([])
  })

  it('keeps a speed to the digits its lesson quotes', () => {
    // 3819.7 rev/min came out as "3.82 krev/min", which cannot be checked
    // against a note that says 3819.7.
    const noLoad = shown.find((r) => r.id === 'a4' && r.label === 'No-load speed')
    expect(noLoad.text).toBe('3820 rev/min')
    expect(reading(noLoad.value, 'rev/min', 5)).toBe('3819.7 rev/min')
    const shaft = shown.find((r) => r.id === 'a4' && r.label === 'Speed')
    expect(shaft.text).toBe(`${Number(shaft.value.toPrecision(4))} rev/min`)
  })

  it('never leaves a bare SI prefix standing in for a unit', () => {
    // "887.3 m" is not a number and the milli is not a unit.
    const bad = shown.filter((r) => /\s[kMGmµn]$/.test(r.text))
    expect(bad.map((r) => `${r.id} ${r.label}: ${r.text}`)).toEqual([])
  })

  it('shows every fraction as a percentage', () => {
    for (const r of shown.filter((q) => q.unit === '%')) {
      expect(r.text.endsWith(' %'), `${r.id} ${r.label}: ${r.text}`).toBe(true)
      // The text is the value at four significant figures, so the check is
      // relative. An absolute one is a different claim about every scale.
      // Below the noise floor the text is "0 %" by design: A5's unloaded
      // frictionless machine does exactly no work, and 4 × 10⁻¹⁴ is the LU
      // solve rather than an efficiency.
      const back = Number.parseFloat(r.text) / 100
      if (Math.abs(r.value) < 1e-9) expect(back, `${r.id} ${r.label}`).toBe(0)
      else expect(Math.abs(back - r.value) / Math.abs(r.value), `${r.id} ${r.label}: ${r.text}`).toBeLessThan(1e-3)
    }
    const eff = shown.find((r) => r.id === 'a2' && r.label === 'Efficiency')
    expect(eff.text).toMatch(/^\d+(\.\d+)? %$/)
    const slip = shown.find((r) => r.id === 'c6' && r.label === 'Slip')
    expect(slip.text).toMatch(/^2\.7\d+ %$/)
  })

  it('shows a power factor as the plain number it is quoted as', () => {
    const pf = shown.find((r) => r.id === 'c6' && r.label === 'Power factor')
    expect(pf.text).toMatch(/^0\.80\d+$/)
  })

  it('writes no exponent a reader has to decode', () => {
    const bad = shown.filter((r) => /e[+-]?\d/.test(r.text))
    expect(bad.map((r) => `${r.id} ${r.label}: ${r.text}`)).toEqual([])
  })

  it('reading() itself refuses a prefix on the plain units', () => {
    expect(reading(3648.4, 'rev/min')).toBe('3648 rev/min')
    expect(reading(3648.4, 'rev/min', 5)).toBe('3648.4 rev/min')
    expect(reading(0.8873, '%')).toBe('88.73 %')
    expect(reading(0.02767, '%')).toBe('2.767 %')
    expect(reading(0.8011, '')).toBe('0.8011')
    expect(reading(-0.05, '')).toBe('-0.05')
    expect(reading(20, '°')).toBe('20 °')
    // A unit that does take a prefix still gets one.
    expect(reading(0.0025, 's')).toBe('2.5 ms')
    expect(reading(Number.NaN, 'V')).toBe('—')
  })
})

describe('the topbar headline', () => {
  it('leads with the quantity the lesson is about where one is named', () => {
    const c2 = EXPERIMENTS.find((e) => e.id === 'c2')
    expect(c2.lead).toBe('Synchronous speed')
    const x = analyse(c2, defaultsOf(c2))
    const row = METERS[x.kind].find(([label]) => label === c2.lead)
    expect(row, 'the lead names a meter the model offers').toBeTruthy()
    expect(reading(readQuantity(x, row[1]), row[2])).toBe('1500 rev/min')
  })

  it('every named lead is a meter its own model carries', () => {
    for (const e of EXPERIMENTS.filter((q) => q.lead)) {
      const x = analyse(e, defaultsOf(e))
      expect(
        (METERS[x.kind] || []).some(([label]) => label === e.lead),
        `${e.id} leads with "${e.lead}", which ${x.kind} does not meter`,
      ).toBe(true)
    }
  })
})
