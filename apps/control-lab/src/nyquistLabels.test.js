import { describe, it, expect } from 'vitest'
import { nyquistLabelX, LABEL_GAP } from './nyquistLabels.js'
import { LESSONS, applyLesson } from './lessons.js'
import { buildLoop } from './systems.js'
import { margins } from '@ee-labs/systems'

const GRID = Float64Array.from({ length: 6000 }, (_, i) => Math.pow(10, -4 + 8 * (i / 5999)))

describe('the Nyquist margin labels end left of the −1 marker', () => {
  const areaLeft = 100
  const markerX = 700

  it('a label ends LABEL_GAP short of the marker', () => {
    expect(nyquistLabelX(markerX, 90, areaLeft)).toBe(markerX - LABEL_GAP)
  })

  it('every point of the label is left of the marker, so the phase ray cannot cross it', () => {
    for (const w of [40, 90, 140, 220]) {
      const right = nyquistLabelX(markerX, w, areaLeft)
      expect(right, `width ${w}`).toBeLessThan(markerX)
      expect(right - w, `width ${w} left edge`).toBeGreaterThanOrEqual(areaLeft)
    }
  })

  it('a label too wide for the room slides back inside the plot rather than off it', () => {
    // 640px of text into a 600px box: it cannot both end left of the marker
    // and start inside the frame, and staying on screen wins.
    const right = nyquistLabelX(markerX, 640, areaLeft)
    expect(right - 640).toBeGreaterThanOrEqual(areaLeft)
  })

  it('the chrome scale carries the gap with it', () => {
    expect(nyquistLabelX(markerX, 90, areaLeft, 2)).toBe(markerX - 2 * LABEL_GAP)
  })
})

describe('the two lessons that open on this plot really do crowd the marker', () => {
  // The claim behind the move: at these lessons' own gains the phase-margin
  // ray reaches into the region the labels used to occupy. Measured off the
  // live loop, so the geometry rule is not defending a case that cannot
  // arise.
  const pmOf = (name) => {
    const s = applyLesson(LESSONS.find((l) => l.name === name))
    const { open } = buildLoop(s.plantId, s.plantP, s.ctrlId, s.ctrlP)
    return margins(open, GRID).phaseMargin
  }

  it('the Nyquist lesson leaves a ray well inside the unit circle\'s left half', () => {
    const pm = pmOf('Everything is about one point')
    expect(pm).toBeGreaterThan(20)
    expect(pm).toBeLessThan(90)
    // The ray's far end, at radius 1 and angle 180° − PM: its x is −cos(PM),
    // which is between −1 and 0 — the wedge the labels now avoid entirely.
    const rayX = -Math.cos((pm * Math.PI) / 180)
    expect(rayX).toBeGreaterThan(-1)
    expect(rayX).toBeLessThan(0)
  })

  it('so does the thin-margin lesson', () => {
    const pm = pmOf('A margin thin enough to feel')
    const rayX = -Math.cos((pm * Math.PI) / 180)
    expect(rayX).toBeGreaterThan(-1)
    expect(rayX).toBeLessThan(0)
  })
})
