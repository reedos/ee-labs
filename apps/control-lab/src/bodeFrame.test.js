import { describe, it, expect } from 'vitest'
import { phaseFrame, labelSide, PHASE_CLEAR } from './bodeFrame.js'
import { LESSONS, applyLesson } from './lessons.js'
import { buildLoop } from './systems.js'
import { bode, polesZeros } from '@ee-labs/systems'

// The Bode pane's two pieces of geometry. Both defects below were found by
// reading a screenshot and neither was visible to any test: the drawing was
// right about the numbers and wrong about where it put them.

const AREA_Y = 40
const AREA_H = 230 // the Bode plot box at 1280x900, measured

describe('the phase overlay keeps clear of the frame', () => {
  it('a phase that is exactly a multiple of 90 does not land on the border', () => {
    // Lesson 3's loop: a lone integrator, phase flat at −90° across every
    // decade drawn. The old mapping snapped the axis to −90 and padded by
    // 3px, so the trace WAS the bottom border.
    const { plo, py } = phaseFrame(-90, 0, AREA_Y, AREA_H)
    expect(plo).toBe(-90)
    const bottom = AREA_Y + AREA_H
    expect(bottom - py(-90)).toBeGreaterThanOrEqual(PHASE_CLEAR)
  })

  it('the top edge gets the same clearance', () => {
    const { phi, py } = phaseFrame(-90, 90, AREA_Y, AREA_H)
    expect(phi).toBe(90)
    expect(py(90) - AREA_Y).toBeGreaterThanOrEqual(PHASE_CLEAR)
  })

  it('the limits still snap to 90° so the ticks stay on round numbers', () => {
    expect(phaseFrame(-265, 5, AREA_Y, AREA_H).plo).toBe(-270)
    expect(phaseFrame(-179.9, 5, AREA_Y, AREA_H).plo).toBe(-180)
    expect(phaseFrame(-45, 190, AREA_Y, AREA_H).phi).toBe(270)
  })

  it('a short pane (a phone) caps the clearance rather than crushing the scale', () => {
    const short = 60
    const { py, padPx } = phaseFrame(-90, 90, 0, short)
    expect(padPx).toBe(short / 8)
    // Still monotone and still inside the box.
    expect(py(90)).toBeGreaterThan(0)
    expect(py(-90)).toBeLessThan(short)
    expect(py(90)).toBeLessThan(py(-90))
  })

  it('the mapping is linear in degrees between its limits', () => {
    const { plo, phi, py } = phaseFrame(-180, 0, AREA_Y, AREA_H)
    const mid = (plo + phi) / 2
    expect(py(mid)).toBeCloseTo((py(plo) + py(phi)) / 2, 9)
  })
})

describe('a marker label goes on the side that has room for it', () => {
  const top = 0
  const bottom = 200

  it('picks the side with the bigger gap', () => {
    expect(labelSide([150, 160], top, bottom).side).toBe('top')
    expect(labelSide([20, 30], top, bottom).side).toBe('bottom')
  })

  it('a descending trace inside the label\'s span moves the label off it', () => {
    // The three-lag defect, in the smallest form that reproduces it. At the
    // marker's own frequency the traces sit at 60 and 150: room below (50px)
    // beats room above (60px)... it does not, and that is the point — the
    // old code compared exactly these two numbers and chose the bottom
    // because the phase trace was the lower of them. Add the samples the
    // label's own width covers, where the phase has descended to 185, and
    // the bottom gap collapses to 15px while the top keeps 60.
    const atMarkerOnly = labelSide([60, 150], top, bottom)
    expect(atMarkerOnly.topGap).toBe(60)
    expect(atMarkerOnly.botGap).toBe(50)
    expect(atMarkerOnly.side).toBe('top')

    const acrossTheSpan = labelSide([60, 150, 70, 168, 80, 185], top, bottom)
    expect(acrossTheSpan.botGap).toBe(15)
    expect(acrossTheSpan.side).toBe('top')
  })

  it('an empty sample set is a top label and the whole box of room', () => {
    const r = labelSide([], top, bottom)
    expect(r.side).toBe('top')
    expect(r.topGap).toBe(200)
  })

  it('non-finite samples are ignored rather than poisoning the gaps', () => {
    expect(labelSide([NaN, 150, Infinity], top, bottom).side).toBe('top')
  })
})

describe('the three lessons whose phase sits on a multiple of 90', () => {
  // The claim behind PHASE_CLEAR: these loops really do run their phase onto
  // a round number, so the clearance is not defending against a case that
  // cannot happen. Measured off the live loop, not asserted from the note.
  // The app's own sweep window, reproduced rather than approximated: the
  // pane draws 900 points over centre ×/÷ 300, where centre is the geometric
  // mean of the open loop's poles and zeros in Hz (App.jsx's freqs memo and
  // frame.js's SPAN). A wider grid would find a phase the reader never sees.
  const SPAN = Math.log10(300)
  const appGrid = (open) => {
    const pz = polesZeros(open)
    const ws = [...pz.poles, ...pz.zeros].map(([re, im]) => Math.hypot(re, im)).filter((w) => w > 1e-9)
    const centre = ws.length
      ? Math.exp(ws.reduce((s, w) => s + Math.log(w), 0) / ws.length) / (2 * Math.PI)
      : 1
    const lo = Math.log10(centre) - SPAN
    const hi = Math.log10(centre) + SPAN
    return Float64Array.from({ length: 900 }, (_, i) => Math.pow(10, lo + ((hi - lo) * i) / 899))
  }
  const phaseOf = (name) => {
    const s = applyLesson(LESSONS.find((l) => l.name === name))
    const { open } = buildLoop(s.plantId, s.plantP, s.ctrlId, s.ctrlP)
    const b = bode(open, appGrid(open))
    const deg = [...b.phase].map((p) => (p * 180) / Math.PI)
    return { min: Math.min(...deg), max: Math.max(...deg) }
  }

  it('the integrator lesson runs flat at −90°', () => {
    const { min, max } = phaseOf('Watch the integrator take over')
    expect(min).toBeGreaterThan(-91)
    expect(max).toBeLessThan(-45)
    // Which is exactly the axis limit the frame snaps to.
    expect(phaseFrame(min, max, AREA_Y, AREA_H).plo).toBe(-90)
  })

  it('the motor lesson runs down to the −180° limit', () => {
    const { min, max } = phaseOf('A margin thin enough to feel')
    expect(min).toBeGreaterThan(-180)
    expect(min).toBeLessThan(-179)
    const { plo, py } = phaseFrame(min, max, AREA_Y, AREA_H)
    expect(plo).toBe(-180)
    // The asymptote still has to be visibly off the frame, which is the
    // whole reason the pane can say the phase never reaches −180°.
    expect(AREA_Y + AREA_H - py(min)).toBeGreaterThan(PHASE_CLEAR - 1)
  })
})
