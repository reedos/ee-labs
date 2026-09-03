import { describe, it, expect } from 'vitest'
import {
  LESSONS,
  LESSON_GROUPS,
  START_LESSON,
  applyLesson,
  applyChip,
  sameSetup,
  matchingChip,
} from './lessons.js'
import { CIRCUITS, transferOf } from './circuits.js'
import { asDigitalFilter } from './toSignalLab.js'
import { toleranceCloud, spreadPct, tolsOf } from './tolerance.js'
import { magnitudeAt, phaseAt, dcGain, polesZeros, secondOrderMetrics, stepResponse } from '@ee-labs/systems'

// The course, as opposed to the claims: the lab opens on a lesson, every
// lesson has a try line with one-click chips, and every number a try line
// quotes is measured here the way lessons.test.js measures the notes — a try
// line is the sentence the student acts on first, so it is the worst place
// for a number to drift.

const db = (a) => 20 * Math.log10(a)
const deg = (r) => (r * 180) / Math.PI
const byName = (n) => {
  const l = LESSONS.find((x) => x.name === n)
  if (!l) throw new Error(`no lesson "${n}"`)
  return l
}
const stateOf = (l) => {
  const s = applyLesson(l)
  return { id: s.id, params: s.params, output: s.output, tols: s.tols }
}
const chipNamed = (l, label) => {
  const c = (l.chips || []).find((x) => x.label === label)
  if (!c) throw new Error(`${l.name}: no chip "${label}"`)
  return c
}
const after = (l, label) => applyChip(stateOf(l), chipNamed(l, label))
const tfOfState = (s) => transferOf(s.id, s.params, s.output)

describe('the course starts itself', () => {
  it('opens on a lesson that exists, in the first group, with a step view', () => {
    const l = byName(START_LESSON)
    expect(l.group).toBe(LESSON_GROUPS[0])
    expect(l.patch.view).toBe('step')
    expect(l.patch.circuit).toBe('rcLow')
  })

  it('every lesson has a try line, and its chips and featured controls name real things', () => {
    for (const l of LESSONS) {
      expect(typeof l.try, l.name).toBe('string')
      expect(l.try.length, l.name).toBeGreaterThan(30)
      expect(Array.isArray(l.chips), l.name).toBe(true)
      const keys = CIRCUITS[l.patch.circuit].params.map((q) => q.key)
      const outs = CIRCUITS[l.patch.circuit].outputs.map((o) => o.key)
      for (const c of l.chips) {
        expect(c.label, l.name).toBeTruthy()
        for (const k of Object.keys(c.params || {})) expect(keys, `${l.name} chip ${c.label}`).toContain(k)
        for (const k of Object.keys(c.tols || {})) expect(keys, `${l.name} chip ${c.label}`).toContain(k)
        if (c.output) expect(outs, `${l.name} chip ${c.label}`).toContain(c.output)
        if (c.circuit) expect(CIRCUITS[c.circuit], `${l.name} chip ${c.label}`).toBeTruthy()
        // A chip is a partial patch: applying it must still give a finite circuit.
        const s = after(l, c.label)
        expect(Number.isFinite(magnitudeAt(tfOfState(s), 100)), `${l.name} chip ${c.label}`).toBe(true)
      }
      for (const f of l.featured || []) {
        if (f === 'tol' || f === 'output' || f === 'handover') continue
        const key = f.startsWith('tol:') ? f.slice(4) : f
        expect(keys, `${l.name} featured ${f}`).toContain(key)
      }
      // The essays were cut to one claim each; keep them that way.
      expect(l.note.split(/\s+/).length, `${l.name} note length`).toBeLessThanOrEqual(80)
    }
  })

  it('the three essays the review named are now one claim each', () => {
    for (const n of ['Real parts wobble', 'A zero on the axis is silence', 'Blame the right part']) {
      expect(byName(n).note.split(/\s+/).length, n).toBeLessThanOrEqual(60)
    }
  })

  it('a chip patches on top of the current setup, and a matching setup lights its chip', () => {
    const l = byName('Q is how sharp, and R sets it')
    const s = stateOf(l)
    expect(matchingChip(l, s)).toBe('20 Ω')
    const s2 = after(l, '200 Ω')
    expect(s2.params.r).toBe(200)
    expect(s2.params.l).toBe(s.params.l) // the rest untouched
    expect(matchingChip(l, s2)).toBe('200 Ω')
    expect(sameSetup(s, s2)).toBe(false)
    expect(sameSetup(s, applyChip(s2, chipNamed(l, '20 Ω')))).toBe(true)
    // A circuit chip keeps the values when the parameter keys match (the RC pair).
    const rb = byName('The same filter, read backwards')
    const tuned = { ...stateOf(rb), params: { r: 4700, c: 22e-9 } }
    const flipped = applyChip(tuned, chipNamed(rb, 'low-pass, across C'))
    expect(flipped.id).toBe('rcLow')
    expect(flipped.params).toEqual({ r: 4700, c: 22e-9 })
    // A tolerance map chip REPLACES the grading: "C ±10%" means C alone.
    const bl = byName('Blame the right part')
    const onC = after(bl, 'C ±10%')
    expect(tolsOf(onC.id, onC.tols)).toEqual({ r: 0, l: 0, c: 0.1 })
    expect(matchingChip(bl, stateOf(bl))).toBe('R ±10%')
  })
})

describe('the numbers the try lines quote', () => {
  it('divider: R2 = 3 kΩ gives H = 3/4, −2.5 dB, phase 0°', () => {
    const l = byName('A divider has no dynamics')
    const tf = tfOfState(after(l, 'R2 3 kΩ'))
    expect(dcGain(tf)).toBeCloseTo(l.claim.tryGain, 12)
    expect(db(magnitudeAt(tf, 1000))).toBeCloseTo(l.claim.tryDb, 1)
    for (const f of [1, 1e3, 1e6]) expect(phaseAt(tf, f)).toBeCloseTo(0, 12)
  })

  it('corner: C 100 nF → 10 nF moves the corner 1.59 kHz → 15.9 kHz', () => {
    const l = byName('Where the corner comes from')
    for (const [label, c, want] of [['C 100 nF', 100e-9, 1591.5], ['C 10 nF', 10e-9, 15915]]) {
      const s = after(l, label)
      expect(s.params.c).toBe(c)
      expect(l.claim.tryCorners[c]).toBe(want)
      // The −3.01 dB point of the circuit as patched sits at the quoted corner.
      expect(db(magnitudeAt(tfOfState(s), want))).toBeCloseTo(-3.0103, 2)
    }
  })

  it('read backwards: both RC outputs read −3.01 dB at 1.59 kHz', () => {
    const l = byName('The same filter, read backwards')
    for (const label of ['low-pass, across C', 'high-pass, across R']) {
      const s = after(l, label)
      expect(db(magnitudeAt(tfOfState(s), l.claim.tryCorner))).toBeCloseTo(l.claim.tryDb, 2)
    }
  })

  it('RL: L 100 mH → 10 mH moves the corner 1.59 kHz → 15.9 kHz', () => {
    const l = byName('Different physics, same algebra')
    for (const [label, lv, want] of [['L 100 mH', 100e-3, 1591.5], ['L 10 mH', 10e-3, 15915]]) {
      const s = after(l, label)
      expect(s.params.l).toBe(lv)
      expect(l.claim.tryCorners[lv]).toBe(want)
      expect(db(magnitudeAt(tfOfState(s), want))).toBeCloseTo(-3.0103, 2)
    }
  })

  it('three filters: the output chips give band-pass and high-pass at one 5.03 kHz resonance', () => {
    const l = byName('One circuit, three filters')
    const shapes = {}
    for (const label of ['across C', 'across R', 'across L']) {
      const s = after(l, label)
      const tf = tfOfState(s)
      expect(secondOrderMetrics(tf).f0).toBeCloseTo(l.claim.tryF0, -1)
      shapes[label] = [dcGain(tf), magnitudeAt(tf, l.claim.tryF0 * 1e4)]
    }
    expect(shapes['across R'][0]).toBeCloseTo(0, 9) // band-pass: dead at DC
    expect(shapes['across R'][1]).toBeLessThan(1e-3) //   ...and at infinity
    expect(shapes['across L'][0]).toBeCloseTo(0, 9) // high-pass: dead at DC
    expect(shapes['across L'][1]).toBeCloseTo(1, 3) //   ...unity above
  })

  it('Q lesson: R 20 / 100 / 200 Ω give Q 15.8 / 3.16 / 1.58', () => {
    const l = byName('Q is how sharp, and R sets it')
    for (const [label, r] of [['20 Ω', 20], ['100 Ω', 100], ['200 Ω', 200]]) {
      const s = after(l, label)
      expect(s.params.r).toBe(r)
      const q = secondOrderMetrics(tfOfState(s)).q
      expect(q / l.claim.tryQ[r]).toBeCloseTo(1, 2)
    }
  })

  it('tank: R 10 kΩ → 100 kΩ takes Q 31.6 → 316 and the peak reads R', () => {
    const l = byName('The same R, the opposite effect')
    for (const [label, r] of [['R 10 kΩ', 10000], ['R 100 kΩ', 100000]]) {
      const s = after(l, label)
      const tf = tfOfState(s)
      const m = secondOrderMetrics(tf)
      expect(m.q / l.claim.tryQ[r]).toBeCloseTo(1, 2)
      expect(magnitudeAt(tf, m.f0)).toBeCloseTo(r, 3)
    }
  })

  it('seen in time: 200 / 447 / 632 Ω overshoot 35% / 4.3% / none, at ζ 0.707 and 1', () => {
    const l = byName('Resonance, seen in time')
    for (const [label, r] of [['200 Ω', 200], ['447 Ω', 447], ['632 Ω', 632]]) {
      const s = after(l, label)
      const tf = tfOfState(s)
      const m = secondOrderMetrics(tf)
      const { y } = stepResponse(tf, { duration: 20 / (m.zeta * m.wn), points: 4000 })
      const over = Math.max(0, Math.max(...y) - 1)
      expect(over).toBeCloseTo(l.claim.tryOvershoot[r], 2)
      if (l.claim.tryZeta[r]) expect(m.zeta).toBeCloseTo(l.claim.tryZeta[r], 2)
    }
  })

  it('twin-T: R 47 kΩ moves the notch to 339 Hz and Q stays 0.250', () => {
    const l = byName('A zero on the axis is silence')
    const s = after(l, 'R 47 kΩ')
    const tf = tfOfState(s)
    const f0 = 1 / (2 * Math.PI * s.params.r * s.params.c)
    expect(f0).toBeCloseTo(l.claim.tryNotch[47000], 0)
    expect(magnitudeAt(tf, f0)).toBeLessThan(1e-12)
    expect(secondOrderMetrics(tf).q).toBeCloseTo(0.25, 9)
  })

  it('wobble: ±1% gives f₀ ±0.85% and Q ±1.7%; ±5% gives ±4.3% and ±8.2%', () => {
    const l = byName('Real parts wobble')
    for (const [label, tol] of [['±1%', 0.01], ['±5%', 0.05]]) {
      const s = after(l, label)
      const { f0, q, cloud } = toleranceCloud(s.id, s.params, s.output, s.tols)
      const m = CIRCUITS[s.id].metrics(s.params)
      expect(spreadPct(f0, m.w0 / (2 * Math.PI))).toBeCloseTo(l.claim.trySpread[tol].f0, 1)
      expect(spreadPct(q, m.q)).toBeCloseTo(l.claim.trySpread[tol].q, 1)
      // "built 120 times": two poles per build.
      expect(cloud).toHaveLength(2 * l.claim.builds)
    }
    const exact = after(l, 'exact')
    expect(toleranceCloud(exact.id, exact.params, exact.output, exact.tols).any).toBe(false)
  })

  it('blame: the ±10% on C alone lets f₀ wander ±5.3%; on R alone ±0.0%', () => {
    const l = byName('Blame the right part')
    const onC = after(l, 'C ±10%')
    const m = CIRCUITS[onC.id].metrics(onC.params)
    const { f0 } = toleranceCloud(onC.id, onC.params, onC.output, onC.tols)
    expect(spreadPct(f0, m.w0 / (2 * Math.PI))).toBeCloseTo(l.claim.tryF0OnC, 1)
    const onR = after(l, 'R ±10%')
    const r = toleranceCloud(onR.id, onR.params, onR.output, onR.tols)
    expect(spreadPct(r.f0, m.w0 / (2 * Math.PI))).toBeCloseTo(0, 6)
  })

  it('Sallen–Key: C1 22 nF → 100 nF takes Q 0.74 → 1.58', () => {
    const l = byName('Why active filters exist')
    for (const [label, c1] of [['C1 22 nF', 22e-9], ['C1 100 nF', 100e-9]]) {
      const s = after(l, label)
      expect(secondOrderMetrics(tfOfState(s)).q).toBeCloseTo(l.claim.tryQ[c1], 2)
    }
  })

  it('inverting: Rf = 100 kΩ gives −100, 40 dB, 180°', () => {
    const l = byName('Gain is a ratio, and negative')
    const tf = tfOfState(after(l, 'Rf 100 kΩ'))
    expect(dcGain(tf)).toBeCloseTo(l.claim.tryGain[100000], 9)
    expect(db(Math.abs(dcGain(tf)))).toBeCloseTo(l.claim.tryDb, 6)
    expect(Math.abs(deg(phaseAt(tf, 0.001)))).toBeCloseTo(180, 4)
  })

  it('integrator: R 10 kΩ → 100 kΩ makes the ramp ten times slower, and still a ramp', () => {
    const l = byName('A pole exactly at the origin')
    const slope = (s) => {
      const { t, y } = stepResponse(tfOfState(s), { duration: 10 * s.params.r * s.params.c, points: 600 })
      // Six evenly spaced samples: the slope between each pair must agree —
      // a ramp, not a curve flattening out. (verify.mjs reads the same six
      // off the drawn canvas.)
      const k = (i) => Math.round(((t.length - 1) * (i + 1)) / 6)
      const slopes = []
      for (let i = 0; i < 5; i++) slopes.push((y[k(i + 1)] - y[k(i)]) / (t[k(i + 1)] - t[k(i)]))
      const mean = slopes.reduce((a, b) => a + b, 0) / slopes.length
      for (const sl of slopes) expect(Math.abs(sl / mean - 1)).toBeLessThan(0.05)
      return mean
    }
    const fast = slope(after(l, 'R 10 kΩ'))
    const slow = slope(after(l, 'R 100 kΩ'))
    expect(fast / slow).toBeCloseTo(l.claim.trySlowerBy, 6)
  })

  it('biquad: the hand-over link carries a square wave and the quoted f₀ and Q', () => {
    const l = byName('This circuit is a biquad')
    const d = asDigitalFilter(tfOfState(stateOf(l)), {})
    expect(d.link).toContain(`src=${l.claim.trySource}`)
    expect(d.f0 / 1000).toBeCloseTo(5.03, 1)
    expect(d.q).toBeCloseTo(3.16, 1)
  })
})

// "Real parts wobble" is a picture: the whole payload is a SCATTER of poles.
// The pole view auto-fits its axes to the content (1.4× the widest extent,
// square pixels — PoleZeroCanvas), so the only way the scatter can be seen is
// for the cloud to be large against the poles' own radius. This measures it
// in the plot's pixels: at a laptop pane (plot area ~260 px tall at 1366×768)
// the cloud must span at least three marker radii (3 × 7 px), or two X's
// would look like one pair and the note would be describing nothing.
describe('lesson: Real parts wobble is visible', () => {
  const PLOT_H = 260 // px: the 1366×768 lower pane's plot area (verify.mjs measures the real one)
  const MARKER_R = 7 // px: PoleZeroCanvas's pole cross half-size at k = 1

  const pxSpread = (s) => {
    const tf = transferOf(s.id, s.params, s.output)
    const { poles, zeros } = polesZeros(tf)
    const { cloud } = toleranceCloud(s.id, s.params, s.output, s.tols)
    let span = 1
    for (const [re, im] of [...poles, ...zeros, ...cloud]) {
      span = Math.max(span, Math.abs(re) * 1.4, Math.abs(im) * 1.4)
    }
    const pxPerUnit = PLOT_H / (2 * span)
    // The upper-half cloud alone: the conjugate copy is the same shape.
    const upper = cloud.filter(([, im]) => im >= 0)
    const res = upper.map(([re]) => re)
    const ims = upper.map(([, im]) => im)
    return {
      w: (Math.max(...res) - Math.min(...res)) * pxPerUnit,
      h: (Math.max(...ims) - Math.min(...ims)) * pxPerUnit,
    }
  }

  it('the ±5% cloud spans more than three marker radii on a laptop pane', () => {
    const s = stateOf(byName('Real parts wobble'))
    const { w, h } = pxSpread(s)
    expect(Math.max(w, h)).toBeGreaterThan(3 * MARKER_R)
    // And it is still a complex pair for every build — an arc, not a smear
    // along the real axis.
    const { cloud } = toleranceCloud(s.id, s.params, s.output, s.tols)
    for (const [, im] of cloud) expect(Math.abs(im)).toBeGreaterThan(0)
  })

  it('at the old defaults (R = 100 Ω) the same cloud hid inside the marker — the reason for R = 560', () => {
    const s = stateOf(byName('Real parts wobble'))
    const { w, h } = pxSpread({ ...s, params: { ...s.params, r: 100 } })
    expect(Math.max(w, h)).toBeLessThan(2 * MARKER_R)
  })

  it('the blame lesson’s R-only arc clears the bar too', () => {
    const { w, h } = pxSpread(stateOf(byName('Blame the right part')))
    expect(Math.max(w, h)).toBeGreaterThan(3 * MARKER_R)
  })
})
