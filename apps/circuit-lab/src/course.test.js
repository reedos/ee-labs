import { describe, it, expect } from 'vitest'
import {
  LESSONS,
  LESSON_GROUPS,
  START_LESSON,
  applyLesson,
  applyChip,
  chipSetup,
  featuredId,
  sameSetup,
  matchingChip,
} from './lessons.js'
import { CIRCUITS, transferOf } from './circuits.js'
import { asDigitalFilter } from './toSignalLab.js'
import { toleranceCloud, spreadPct, tolsOf, fmtPct, fmtHzRange } from './tolerance.js'
import { magnitudeAt, phaseAt, dcGain, polesZeros, secondOrderMetrics, stepResponse } from '@ee-labs/systems'
import { dampingWord } from './stepReadout.js'

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
      for (const entry of l.featured || []) {
        const f = featuredId(entry)
        if (f === 'tol' || f === 'output' || f === 'handover') continue
        const key = f.startsWith('tol:') ? f.slice(4) : f
        expect(keys, `${l.name} featured ${f}`).toContain(key)
        // A lesson-scoped slider range must hold the lesson's own value and
        // every chip's — a chip that lands off its own slider is a lie twice.
        if (typeof entry === 'object') {
          expect(entry.min, `${l.name} featured ${f} min`).toBeGreaterThan(0)
          expect(entry.max, `${l.name} featured ${f} max`).toBeGreaterThan(entry.min)
          const inRange = (v, what) => {
            expect(v, `${l.name} featured ${f}: ${what} below its slider`).toBeGreaterThanOrEqual(entry.min)
            expect(v, `${l.name} featured ${f}: ${what} above its slider`).toBeLessThanOrEqual(entry.max)
          }
          inRange(stateOf(l).params[key], 'the lesson value')
          for (const c of l.chips) if (c.params && key in c.params) inRange(c.params[key], `chip ${c.label}`)
        }
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

  it('chips never compound: each is the lesson plus that chip, and lights only when the screen equals it', () => {
    // The student's walk: "R 10 kΩ" then "C 10 nF" left R at 10 kΩ, lit the
    // C chip, and the corner read 1.59 kHz against a try line promising 15.9.
    const l = byName('Where the corner comes from')
    const r10 = chipSetup(l, chipNamed(l, 'R 10 kΩ'))
    expect(r10.params).toEqual({ r: 10000, c: 100e-9 })
    const thenC = chipSetup(l, chipNamed(l, 'C 10 nF'))
    expect(thenC.params).toEqual({ r: 1000, c: 10e-9 }) // R back at the lesson's 1 kΩ
    expect(1 / (2 * Math.PI * thenC.params.r * thenC.params.c)).toBeCloseTo(15915, -1)
    expect(matchingChip(l, thenC)).toBe('C 10 nF')
    // The compounded state the old app produced lights NOTHING now.
    const compounded = { ...thenC, params: { r: 10000, c: 10e-9 } }
    expect(matchingChip(l, compounded)).toBeNull()
    // And for every lesson, every chip's setup lights exactly that chip.
    for (const lesson of LESSONS) {
      for (const c of lesson.chips) {
        expect(matchingChip(lesson, chipSetup(lesson, c)), `${lesson.name} / ${c.label}`).toBe(c.label)
      }
    }
  })

  it('a try line that says "tap X" names a chip (or the featured link) called X', () => {
    for (const l of LESSONS) {
      const names = new Set([...l.chips.map((c) => c.label), 'Open in Signal Lab →'])
      for (const m of l.try.matchAll(/\b[Tt]ap ([^—,.;]+?)(?= —|,|\.|;)/g)) {
        expect(names.has(m[1].trim()), `${l.name}: "tap ${m[1]}" names nothing on screen`).toBe(true)
      }
    }
    // The line the walk filed: it said "Tap R" beside chips reading "across R".
    expect(byName('One circuit, three filters').try).toMatch(/Tap across R/)
  })

  // Student-review item 2: the try line names the output probe ("tap across
  // R... across L"), and an empty featured list left the control it describes
  // a scroll below in the Schematic section. The chips are a one-click
  // version of the same control; the select itself must also be featured.
  it('the output probe is featured on the one lesson whose try line names it', () => {
    const l = byName('One circuit, three filters')
    expect(l.featured).toContain('output')
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

  it('tank: R 10 kΩ → 100 kΩ takes Q 31.6 → 316 and the peak reads R — 80 dBΩ, then 100', () => {
    const l = byName('The same R, the opposite effect')
    for (const [label, r] of [['R 10 kΩ', 10000], ['R 100 kΩ', 100000]]) {
      const s = after(l, label)
      const tf = tfOfState(s)
      const m = secondOrderMetrics(tf)
      expect(m.q / l.claim.tryQ[r]).toBeCloseTo(1, 2)
      expect(magnitudeAt(tf, m.f0)).toBeCloseTo(r, 3)
      // The y-axis says dBΩ; the try line says which ohms that is.
      expect(db(magnitudeAt(tf, m.f0))).toBeCloseTo(l.claim.tryDbOhm[r], 4)
      expect(l.try).toContain(`${l.claim.tryDbOhm[r]} dBΩ`)
    }
    // And the lesson opens on the pane the note is about, not on poles.
    expect(l.patch.view).toBe('step')
    expect(byName('The same filter, read backwards').patch.view).toBe('step')
  })

  it('seen in time: 200 / 447 / 632.46 Ω overshoot 35% / 4.3% / none, at ζ 0.707 and 1.000', () => {
    const l = byName('Resonance, seen in time')
    for (const [label, r] of [['200 Ω', 200], ['447 Ω', 447], ['632.46 Ω', 632.46]]) {
      const s = after(l, label)
      const tf = tfOfState(s)
      const m = secondOrderMetrics(tf)
      const { y } = stepResponse(tf, { duration: 20 / (m.zeta * m.wn), points: 4000 })
      const over = Math.max(0, Math.max(...y) - 1)
      expect(over).toBeCloseTo(l.claim.tryOvershoot[r], 2)
      if (l.claim.tryZeta[r]) expect(m.zeta).toBeCloseTo(l.claim.tryZeta[r], 2)
    }
    // The critical chip is the exact 2√(L/C): ζ prints 1.000 and the pane
    // calls it critically damped — 632 Ω read ζ = 0.999 "underdamped" beside
    // a try line saying 1.
    const crit = after(l, '632.46 Ω')
    const z = secondOrderMetrics(tfOfState(crit)).zeta
    expect(crit.params.r).toBeCloseTo(2 * Math.sqrt(crit.params.l / crit.params.c), 1)
    expect(z.toFixed(3)).toBe('1.000')
    expect(dampingWord(z)).toBe('critically damped')
    expect(dampingWord(secondOrderMetrics(tfOfState(after(l, '447 Ω'))).zeta)).toBe('underdamped')
    expect(l.try).toContain('632.46 Ω (ζ = 1.000')
  })

  it('typing the natural rounding, 632 Ω, still reads critically damped — 600 Ω genuinely does not', () => {
    // The try line's own chip is 632.46 Ω; a person reading "632.46" types
    // 632. That used to read ζ = 0.999 "underdamped" beside a pane that had
    // just called the unrounded value critical — measured here straight off
    // the circuit, not asserted.
    const l = byName('Resonance, seen in time')
    const s = stateOf(l)
    const z632 = secondOrderMetrics(tfOfState({ ...s, params: { ...s.params, r: 632 } })).zeta
    const z600 = secondOrderMetrics(tfOfState({ ...s, params: { ...s.params, r: 600 } })).zeta
    expect(dampingWord(z632)).toBe('critically damped')
    expect(dampingWord(z600)).toBe('underdamped')
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

  it('wobble: the ±1% try-line percentage is what the panel’s own formatter would print, to the digit', () => {
    // toFixed(1) rounded the measured 0.850...% up to "0.9" — a number the
    // try line does not say. fmtPct is the one formatter both the try line's
    // claim and the live panel must agree with.
    const l = byName('Real parts wobble')
    const s = after(l, '±1%')
    const { f0, q } = toleranceCloud(s.id, s.params, s.output, s.tols)
    const m = CIRCUITS[s.id].metrics(s.params)
    const f0Str = fmtPct(spreadPct(f0, m.w0 / (2 * Math.PI)))
    const qStr = fmtPct(spreadPct(q, m.q))
    expect(f0Str).toBe('0.85')
    expect(qStr).toBe('1.7')
    expect(l.try).toContain(`±${f0Str}%`)
    expect(l.try).toContain(`±${qStr}%`)
    // And the ±5% figures, unaffected since they were already ≥ 1%.
    const s5 = after(l, '±5%')
    const { f0: f05, q: q5 } = toleranceCloud(s5.id, s5.params, s5.output, s5.tols)
    expect(l.try).toContain(`±${fmtPct(spreadPct(f05, m.w0 / (2 * Math.PI)))}%`)
    expect(l.try).toContain(`±${fmtPct(spreadPct(q5, m.q))}%`)
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

  // Skeptic's note (student-review, minor): the L cloud reads small next to
  // C's, at a glance inviting "L barely matters" — Q depends on √L and on
  // 1/√C, equal exponents, so a shared ±10% moves f₀ by nearly the same
  // amount either way. The try line now quotes L's own number so the text
  // says what the numbers say even where the picture alone might not.
  it('blame: the ±10% on L alone moves f₀ almost exactly as far as C, not less', () => {
    const l = byName('Blame the right part')
    const onL = after(l, 'L ±10%')
    const m = CIRCUITS[onL.id].metrics(onL.params)
    const { f0 } = toleranceCloud(onL.id, onL.params, onL.output, onL.tols)
    const f0Pct = spreadPct(f0, m.w0 / (2 * Math.PI))
    expect(f0Pct).toBeCloseTo(l.claim.tryF0OnL, 1)
    expect(f0Pct).toBeCloseTo(l.claim.tryF0OnC, 0) // same order as C, not a fraction of it
    expect(l.try).toContain(`On L it is ±${l.claim.tryF0OnL}%`)
  })

  it('blame: the printed f₀ range never reads one endpoint coarser than the other', () => {
    // The C-only ±10% build used to print "4.81 kHz to 5.3 kHz"; its L-only
    // twin, same lesson and same formatter, printed "4.8 kHz to 5.3 kHz" —
    // eng()'s significant-figure rounding stripped a trailing zero from one
    // endpoint but not the other. fmtHzRange fixes the decimal count instead.
    const l = byName('Blame the right part')
    const decimalsOf = (t) => (t.match(/\.(\d+)/) || [, ''])[1].length
    for (const label of ['C ±10%', 'L ±10%']) {
      const s = after(l, label)
      const { f0 } = toleranceCloud(s.id, s.params, s.output, s.tols)
      expect(f0, label).toBeTruthy()
      const [loText, hiText] = fmtHzRange(f0.lo, f0.hi)
      expect(decimalsOf(loText), `${label}: "${loText}" vs "${hiText}"`).toBe(decimalsOf(hiText))
      expect(loText).toMatch(/^\d+\.\d\d kHz$/)
      expect(hiText).toMatch(/^\d+\.\d\d kHz$/)
    }
  })

  it('Sallen–Key: C1 22 nF → 100 nF takes Q 0.74 → 1.58', () => {
    const l = byName('Why active filters exist')
    for (const [label, c1] of [['C1 22 nF', 22e-9], ['C1 100 nF', 100e-9]]) {
      const s = after(l, label)
      expect(secondOrderMetrics(tfOfState(s)).q).toBeCloseTo(l.claim.tryQ[c1], 2)
    }
  })

  it('inverting: Rf = 100 kΩ gives −100 (40 dB) below a 1.59 kHz corner, 180° at DC and 135° there', () => {
    const l = byName('Gain is a ratio, and negative')
    const s = after(l, 'Rf 100 kΩ')
    const tf = tfOfState(s)
    expect(dcGain(tf)).toBeCloseTo(l.claim.tryGain[100000], 9)
    expect(db(Math.abs(dcGain(tf)))).toBeCloseTo(l.claim.tryDb, 6)
    expect(Math.abs(deg(phaseAt(tf, 0.001)))).toBeCloseTo(l.claim.tryDcPhase, 4)
    // The corner Cf puts there — and the phase AT it, which is not 180°.
    // (The first try line said "still 180°"; the pole halfway up the span
    // had it at 90° by the right edge.)
    const fc = 1 / (2 * Math.PI * s.params.rf * s.params.cf)
    expect(fc).toBeCloseTo(l.claim.tryCorner[100000], 0)
    expect(deg(phaseAt(tf, fc))).toBeCloseTo(l.claim.tryCornerPhase, 6)
    expect(db(magnitudeAt(tf, fc))).toBeCloseTo(l.claim.tryDb - 3.0103, 3)
    // "40 dB below the corner": a decade under it the gain is 40 dB to 0.01.
    expect(db(magnitudeAt(tf, fc / 10))).toBeCloseTo(l.claim.tryDb, 1)
    expect(l.try).toContain('1.59 kHz')
    expect(l.try).toContain('135°')
    expect(l.note).toContain('Cf')
    // One pole, as the topbar says — Cf stays in the circuit.
    expect(polesZeros(tf).poles).toHaveLength(1)
  })

  it('integrator: R 10 kΩ → 100 kΩ makes the ramp ten times slower, and still a ramp', () => {
    const l = byName('A pole exactly at the origin')
    // Opens on the step — a slope is a step-pane fact, and the poles view is
    // identical at both R.
    expect(l.patch.view).toBe('step')
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
