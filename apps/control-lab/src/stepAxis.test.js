import { describe, expect, it } from 'vitest'
import { ladderUp, stickyDuration, stickyRange, STEP_X_TITLE } from './stepAxis.js'
import { LESSONS, applyLesson } from './lessons.js'
import { buildLoop } from './systems.js'
import { polesZeros } from '@ee-labs/systems'
import { fmt } from '@ee-labs/ui'

// The behaviour Reed asked for by name, for the step plot: tuning gain or
// tau moves the CURVE across a held frame. The first implementation failed
// its own browser probe - containment-growth tracked the peak pixel-for-
// pixel - so the frames are band-quantized: bit-identical inside a band,
// one discrete jump at its edge.

describe('ladderUp', () => {
  it('snaps up within the decade and scales across decades', () => {
    expect(ladderUp(0.63)).toBe(0.8)
    expect(ladderUp(1.01)).toBe(1.5)
    expect(ladderUp(7)).toBe(8)
    expect(ladderUp(1234)).toBe(1500)
    expect(ladderUp(0.0007)).toBeCloseTo(0.0008, 12)
  })
})

describe('stickyDuration', () => {
  it('is bit-identical across a wide tuning inside one band', () => {
    const d1 = stickyDuration(NaN, 12) // adopt: ladder(12) = 15
    expect(d1).toBe(15)
    // Anything needing between prev/6 and prev holds the frame exactly.
    expect(stickyDuration(d1, 3)).toBe(15)
    expect(stickyDuration(d1, 14)).toBe(15)
    // Just past the left-sixth threshold it reframes, quantized.
    expect(stickyDuration(d1, 2.3)).toBe(3)
  })

  it('grows when the settle would leave the frame, to the next band', () => {
    expect(stickyDuration(15, 30)).toBe(30)
    expect(stickyDuration(15, 22)).toBe(30)
  })

  it('reframes down only past the left-sixth threshold', () => {
    expect(stickyDuration(15, 3)).toBe(15)
    expect(stickyDuration(15, 2)).toBe(2)
  })

  it('snaps on system change; nonsense natural keeps the frame', () => {
    expect(stickyDuration(15, 5, true)).toBe(6)
    expect(stickyDuration(15, NaN)).toBe(15)
  })
})

describe('stickyRange', () => {
  const nat = (lo, hi) => ({ lo, hi })

  it('the Kp sweep that broke v1: 0.5 and 0.9 settle in DIFFERENT places of one frame', () => {
    const f1 = stickyRange(null, nat(-0.067, 0.63)) // Kp = 1
    expect(f1.hi).toBe(0.8)
    expect(f1.lo).toBeCloseTo(-0.08, 12)
    const f2 = stickyRange(f1, nat(-0.02, 1.01)) // Kp = 9: crosses the band once
    expect(f2).toEqual({ lo: 0, hi: 1.5 })
    // ...and further tuning inside that band holds it bit-identical.
    expect(stickyRange(f2, nat(-0.01, 1.1))).toBe(f2)
    expect(stickyRange(f2, nat(0.01, 0.7))).toBe(f2)
    // A dip genuinely below the frame's floor is a clip: reframe, don't hide.
    expect(stickyRange(f2, nat(-0.05, 0.7)).lo).toBeLessThan(0)
  })

  it('zero stays zero: a one-sided trace gets a one-sided frame', () => {
    expect(stickyRange(null, nat(-0.01, 0.9))).toEqual({ lo: 0, hi: 1 })
  })

  it('snaps in when the trace shrinks to a sliver of the band', () => {
    const big = stickyRange(null, nat(-3.5, 3.5))
    expect(stickyRange(big, nat(-0.1, 0.4)).hi).toBeLessThan(1)
  })

  it('snaps on a system change', () => {
    expect(stickyRange({ lo: -4, hi: 4 }, nat(0, 1.1), true)).toEqual({ lo: 0, hi: 1.5 })
  })
})

describe('the x-axis title names the quantity and leaves the unit to the ticks', () => {
  // Read off a screenshot: "Time (seconds)" over ticks reading "100 ms" …
  // "800 ms". The title cannot name one unit, because the course's own
  // windows span three of them, and the ticks say which at every window.
  it('carries no unit of its own', () => {
    expect(STEP_X_TITLE).toBe('Time')
    expect(STEP_X_TITLE).not.toMatch(/[()]/)
    expect(STEP_X_TITLE).not.toMatch(/\bsec|\bms\b|\(s\)/i)
  })

  it('and one axis really does print two units at once', () => {
    // Each lesson's own plot window, and the ticks drawn across it, through
    // the same formatter the axis uses. The window is always some number of
    // seconds; the TICKS inside it are not, which is the whole point — the
    // shortest lesson's axis reads "200 ms" beside "1 s" on one line.
    const unitOf = (v) => (fmt(v, 's', 3).match(/[a-zµ]+$/) || ['?'])[0]
    const perLesson = LESSONS.map((l) => {
      const s = applyLesson(l)
      const { closed } = buildLoop(s.plantId, s.plantP, s.ctrlId, s.ctrlP)
      const re = polesZeros(closed).poles.map(([r]) => Math.abs(r)).filter((r) => r > 1e-9)
      const duration = stickyDuration(null, Math.min(12 / (re.length ? Math.min(...re) : 1), 400))
      const ticks = Array.from({ length: 8 }, (_, i) => (duration * (i + 1)) / 8)
      return { name: l.name, duration, units: new Set(ticks.map(unitOf)) }
    })
    const mixed = perLesson.filter((p) => p.units.size > 1)
    // A count of zero here would mean the axis could safely name its unit
    // and this assertion was defending nothing (playbook 11), so the count
    // is what is asserted, not merely "some".
    expect(
      mixed.length,
      perLesson.map((p) => `${p.name} @${p.duration}s: ${[...p.units].join('+')}`).join('\n'),
    ).toBeGreaterThan(0)
    for (const p of mixed) expect(p.units.has('ms'), p.name).toBe(true)
  })
})
