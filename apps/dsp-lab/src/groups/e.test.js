import { describe, it, expect } from 'vitest'
import {
  biquadResponse,
  designBiquad,
  isStable,
  makeFixedBiquad,
  poleGrid,
  poleRadius,
  quantizeBiquad,
  quantizer,
  roundingNoise,
  scalingNorms,
} from '@ee-labs/dsp'
import { byId } from '../experiments.js'
import { experimentState } from '../state.js'
import { POLE_BOXES, deadBandOf, fixedOf, resolvePath } from '../measure.js'
import { SECTION, STATE_LENGTHS, WORD_LENGTHS } from './e.js'

// Group E's numbers, measured on the chain the app runs.
//
// Every expectation is computed from the experiment's own parameters. The word
// length is read off the block, the step follows from it, and the pole
// positions follow from the section the block designs. Moving a default moves
// the expectation with it.

const SR = 48000
const state = (id) => experimentState(byId(id))
const at = (id, params) => {
  const s = state(id)
  return { ...s, blocks: [{ ...s.blocks[0], params: { ...s.blocks[0].params, ...params } }] }
}
const stepOf = (bits, intBits) => Math.pow(2, -(bits - 1 - intBits))

describe('E1: the word length, and the grid it makes', () => {
  it('has a step and a range that follow from the split of the bits', () => {
    const p = state('e1').blocks[0].params
    expect(p.coeffBits).toBe(12)
    expect(p.coeffInt).toBe(2)
    const delta = stepOf(p.coeffBits, p.coeffInt)
    expect(resolvePath('fix.delta', state('e1'))).toBe(delta)
    expect(delta).toBeCloseTo(1.95e-3, 5)
    // Two bits above the point hold -4 to 4, and the top of the range is one
    // step short of 4 because zero takes a code.
    expect(resolvePath('fix.bottom', state('e1'))).toBe(-Math.pow(2, p.coeffInt))
    expect(resolvePath('fix.top', state('e1'))).toBe(Math.pow(2, p.coeffInt) - delta)
  })

  it('stores every coefficient as an exact multiple of that step', () => {
    const f = fixedOf(state('e1'))
    const delta = f.qs.coeff.delta
    for (const [k, v] of Object.entries(f.q.coeffs)) {
      expect(Math.abs(v / delta - Math.round(v / delta)), k).toBeLessThan(1e-9)
    }
    // And the exact ones are not on the grid, which is what makes this a
    // different filter rather than the same one written down.
    expect(Math.abs(f.exact.a1 / delta - Math.round(f.exact.a1 / delta))).toBeGreaterThan(1e-6)
  })

  it('moves the step and not the range when bits are added below the point', () => {
    const wide = at('e1', { coeffBits: 16 })
    expect(resolvePath('fix.delta', wide)).toBe(stepOf(16, 2))
    expect(resolvePath('fix.bottom', wide)).toBe(resolvePath('fix.bottom', state('e1')))
  })
})

describe('E2: quantised coefficients move the poles', () => {
  const exact = designBiquad(SECTION, SR)

  it('starts from a section whose poles are 3.9e-3 from the unit circle', () => {
    expect(poleRadius(exact)).toBeCloseTo(0.996085, 6)
    expect(1 - poleRadius(exact)).toBeLessThan(4e-3)
  })

  it('moves the pole further at every word length removed', () => {
    const moved = WORD_LENGTHS.map((coeffBits) => resolvePath('fix.moved', at('e2', { coeffBits })))
    for (const [i, coeffBits] of WORD_LENGTHS.entries()) {
      const q = quantizeBiquad(exact, quantizer({ bits: coeffBits, intBits: 2 }))
      expect(moved[i], `${coeffBits} bits`).toBeCloseTo(Math.max(...q.moved), 12)
    }
    // Twenty, sixteen, twelve, ten and eight bits, each coarser than the last.
    for (let i = 1; i < moved.length; i++) expect(moved[i]).toBeGreaterThan(moved[i - 1])
    // The distance is about one step of the grid, at every word length. Where
    // in that step a coefficient falls is arbitrary, so the ratio scatters, and
    // it stays inside a factor of three either way over a span of 4096 in the
    // step itself. That is the claim the lesson makes, and it is why removing
    // bits moves the poles by as much as it coarsens the grid.
    for (const [i, coeffBits] of WORD_LENGTHS.entries()) {
      const delta = stepOf(coeffBits, 2)
      expect(moved[i] / delta, `${coeffBits} bits`).toBeGreaterThan(0.3)
      expect(moved[i] / delta, `${coeffBits} bits`).toBeLessThan(3)
    }
  })

  it('reaches the unit circle when one step is wider than the room', () => {
    const room = 1 - poleRadius(exact)
    for (const coeffBits of WORD_LENGTHS) {
      const q = quantizer({ bits: coeffBits, intBits: 2 })
      const s = at('e2', { coeffBits })
      const stable = resolvePath('fix.stable', s)
      expect(stable, `${coeffBits} bits`).toBe(isStable(quantizeBiquad(exact, q).coeffs))
      // A step wider than the room is what it takes to lose stability, and it
      // is not enough on its own: the implication runs one way only, because
      // where in a step the coefficient falls decides the rest.
      if (!stable) expect(q.delta, `${coeffBits} bits`).toBeGreaterThan(room)
    }
    // Exactly one of the five word lengths loses it, and it is the coarsest.
    const unstable = WORD_LENGTHS.filter((coeffBits) => !resolvePath('fix.stable', at('e2', { coeffBits })))
    expect(unstable).toEqual([8])
    expect(resolvePath('fix.radius', at('e2', { coeffBits: 8 }))).toBeGreaterThanOrEqual(1)
    // Eight bits gives a step eight times the room the poles had.
    expect(stepOf(8, 2) / room).toBeGreaterThan(7)
  })
})

describe('E3: the grid the poles can land on', () => {
  it('counts two boxes of the same area and finds one an order of magnitude denser', () => {
    const s = state('e3')
    const dense = resolvePath('fix.gridDense', s)
    const sparse = resolvePath('fix.gridSparse', s)
    const pts = poleGrid(quantizer({ bits: s.blocks[0].params.coeffBits, intBits: 2 }))
    const box = ({ re, im }) =>
      pts.filter(
        (p) => p[0] >= re && p[0] < re + POLE_BOXES.side && p[1] >= im && p[1] < im + POLE_BOXES.side,
      ).length
    expect(dense).toBe(box(POLE_BOXES.dense))
    expect(sparse).toBe(box(POLE_BOXES.sparse))
    expect(dense).toBeGreaterThan(8 * sparse)
    expect(resolvePath('fix.gridRatio', s)).toBeCloseTo(dense / sparse, 9)
  })

  it('keeps the ratio when the word length changes, because the form sets it', () => {
    const ten = resolvePath('fix.gridRatio', at('e3', { coeffBits: 10 }))
    const twelve = resolvePath('fix.gridRatio', at('e3', { coeffBits: 12 }))
    // Sixteen times as many positions in each box, and the same shape.
    expect(resolvePath('fix.gridDense', at('e3', { coeffBits: 12 }))).toBeGreaterThan(
      8 * resolvePath('fix.gridDense', at('e3', { coeffBits: 10 })),
    )
    expect(Math.abs(twelve - ten) / ten).toBeLessThan(0.3)
  })

  it('declines the grid past the word length it can draw', () => {
    expect(() => resolvePath('fix.gridDense', at('e3', { coeffBits: 16 }))).toThrow(/pole grid/)
  })
})

describe('E4: limit cycles, and the dead band', () => {
  it('sits at the same count of steps at four word lengths', () => {
    const counts = STATE_LENGTHS.map((stateBits) => resolvePath('fix.deadband', at('e4', { stateBits })))
    expect(new Set(counts).size).toBe(1)
    expect(counts[0]).toBe(81)
    for (const stateBits of STATE_LENGTHS) {
      const level = resolvePath('fix.deadbandUnits', at('e4', { stateBits }))
      const delta = resolvePath('fix.stateDelta', at('e4', { stateBits }))
      expect(delta).toBe(stepOf(stateBits, state('e4').blocks[0].params.stateInt))
      // The level is the count times the step, exactly, at every word length.
      expect(level).toBeCloseTo(counts[0] * delta, 12)
    }
  })

  it('really repeats, sample for sample over its whole period', () => {
    const s = at('e4', { stateBits: 12 })
    const band = deadBandOf(s)
    const f = fixedOf(s)
    expect(band.found).toBe(true)
    const step = makeFixedBiquad(f.exact, { coeffQ: f.qs.coeff, stateQ: f.qs.state })
    step.setState([0, 0, f.qs.state(0.4), f.qs.state(0.4)])
    const run = Array.from({ length: 4000 }, () => step(0))
    const tail = run.slice(-band.period * 8)
    for (let i = band.period; i < tail.length; i++) expect(tail[i]).toBe(tail[i - band.period])
    expect(Math.max(...tail.map(Math.abs))).toBeCloseTo(band.amplitude, 12)
  })

  it('decays to nothing with the state in float64', () => {
    const s = at('e4', { stateBits: 0 })
    const f = fixedOf(s)
    const step = makeFixedBiquad(f.exact, { coeffQ: f.qs.coeff, stateQ: null })
    step.setState([0, 0, 0.4, 0.4])
    let last = 0
    for (let i = 0; i < 40000; i++) last = step(0)
    expect(Math.abs(last)).toBeLessThan(1e-9)
    expect(resolvePath('fix.deadband', s)).toBe(0)
  })
})

describe('E5: overflow, and the two answers to it', () => {
  it('asks for more than the state holds, at the amplitude the lesson uses', () => {
    const s = state('e5')
    const norms = scalingNorms(fixedOf(s).q.coeffs, SR)
    const want = resolvePath('fix.over', s)
    const top = resolvePath('fix.top', s)
    // The L1 norm bounds what any input bounded by the amplitude can ask for,
    // and the peak of |H| is what a settled sine on the resonance asks for. The
    // section is between the two, because the ring on the way up overshoots.
    const amp = s.sources[0].amp
    expect(want).toBeLessThanOrEqual(norms.l1 * amp)
    expect(want).toBeGreaterThan(norms.peak * amp * 0.9)
    expect(want).toBeGreaterThan(top)
    expect(top).toBe(Math.pow(2, s.blocks[0].params.stateInt) - resolvePath('fix.stateDelta', s))
  })

  it('clamps to the top under one rule and folds by the range under the other', () => {
    const s = state('e5')
    const want = resolvePath('fix.over', s)
    const top = resolvePath('fix.top', s)
    const bottom = resolvePath('fix.bottom', s)
    const delta = resolvePath('fix.stateDelta', s)
    const span = top - bottom + delta
    expect(span).toBe(Math.pow(2, s.blocks[0].params.stateInt + 1))
    expect(resolvePath('fix.saturated', s)).toBe(top)
    // Wrapping subtracts whole ranges until the value is back inside, which is
    // what two-complement addition does when the top bit is discarded. Here one
    // range is enough, so the fold is exactly the span.
    const onGrid = Math.round(want / delta) * delta
    expect(resolvePath('fix.wrapped', s)).toBeCloseTo(onGrid - span, 12)
    expect(resolvePath('fix.wrapped', s)).toBeGreaterThanOrEqual(bottom)
    expect(resolvePath('fix.wrapped', s)).toBeLessThan(0)
  })

  it('costs more at the output when the fold comes back round the loop', () => {
    const sat = state('e5')
    const wrap = at('e5', { overflow: 'wrap' })
    const line = (s) => resolvePath('line.600', s)
    expect(line(sat)).toBeGreaterThan(2 * line(wrap))
    // Inside the range both rules are the same filter, to the last bit.
    const small = { ...sat, sources: [{ ...sat.sources[0], amp: 0.125 }] }
    const smallWrap = { ...wrap, sources: [{ ...wrap.sources[0], amp: 0.125 }] }
    expect(resolvePath('fix.over', small)).toBeLessThan(resolvePath('fix.top', small))
    expect(line(small)).toBeCloseTo(line(smallWrap), 12)
  })
})

describe('E6: rounding noise, and the guard on its model', () => {
  it('predicts the output from the step and the feedback part alone', () => {
    const s = state('e6')
    const f = fixedOf(s)
    const model = roundingNoise(f.q.coeffs, f.qs.state)
    const delta = resolvePath('fix.stateDelta', s)
    expect(resolvePath('fix.rmsIn', s)).toBeCloseTo(delta / Math.sqrt(12), 15)
    expect(resolvePath('fix.noiseGain', s)).toBeCloseTo(model.noiseGain, 9)
    expect(resolvePath('fix.rmsOut', s)).toBeCloseTo(model.rmsOut, 15)
    expect(resolvePath('fix.gainDb', s)).toBeCloseTo(10 * Math.log10(model.noiseGain), 12)
    // The gain is the recursion's alone: the zeros play no part in it, because
    // the error enters at the output node and never passes through them.
    const noZeros = roundingNoise({ ...f.q.coeffs, b0: 0, b1: 0, b2: 0 }, f.qs.state)
    expect(noZeros.noiseGain).toBeCloseTo(model.noiseGain, 9)
  })

  it('holds within a factor of two for a signal that moves across the grid', () => {
    const ratio = resolvePath('fix.modelRatio', state('e6'))
    expect(ratio).toBeGreaterThan(0.5)
    expect(ratio).toBeLessThan(2)
  })

  it('is wrong by more than ten for a signal that visits three codes', () => {
    const s = state('e6')
    const few = { ...s, sources: [{ ...s.sources[0], type: 'sine', freq: 375, amp: 0.0012 }] }
    const codes = new Set()
    const q = fixedOf(few).qs.state
    for (let n = 0; n < 4096; n++) {
      codes.add(Math.round(q(0.0012 * Math.sin((2 * Math.PI * 375 * n) / SR)) / q.delta))
    }
    expect(codes.size).toBe(3)
    const ratio = resolvePath('fix.modelRatio', few)
    expect(ratio).toBeLessThan(0.1)
  })

  it('scales the predicted output with the step, four times over', () => {
    const rms = STATE_LENGTHS.map((stateBits) => resolvePath('fix.rmsOut', at('e6', { stateBits })))
    for (let i = 1; i < rms.length; i++) {
      // Two more bits is a quarter of the step and a quarter of the rms.
      expect(rms[i - 1] / rms[i]).toBeCloseTo(4, 9)
    }
  })

  it('is a claim about this section, whose response is still exactly its own', () => {
    const f = fixedOf(state('e6'))
    const h = biquadResponse(f.q.coeffs, SECTION.freq, SR)
    expect(h).toBeGreaterThan(1)
    expect(Number.isFinite(h)).toBe(true)
  })
})
