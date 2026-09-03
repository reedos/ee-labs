import { describe, it, expect } from 'vitest'
import { kernelMagLabel } from './ConvolutionCanvas.jsx'
import { PRESETS } from '../presets.js'
import { presetState } from '../state.js'
import { render } from '@ee-labs/dsp'
import { convKernel, chainImpulse } from '../dsp/chain.js'

// Playbook #6, "mixed scales must confess": the kernel is drawn scaled up
// next to the signal so an 8-tap moving average (peak 0.125) is visible
// beside a 0.8-amplitude square, and the label must say by how much — a
// silent magnification reads as a taller filter than it is.

describe('kernelMagLabel', () => {
  it('says nothing near 1× — nothing to confess when the scale is honest', () => {
    expect(kernelMagLabel(1)).toBe('')
    expect(kernelMagLabel(1.25)).toBe('')
    expect(kernelMagLabel(0.8)).toBe('')
  })

  it('names the factor just outside that band, to two significant figures', () => {
    expect(kernelMagLabel(1.26)).toBe(', drawn ×1.3 to be visible')
    expect(kernelMagLabel(0.79)).toBe(', drawn ×0.79 to be visible')
  })

  it('rounds to a whole number at 10× and above — a fraction is noise up there', () => {
    expect(kernelMagLabel(15.4)).toBe(', drawn ×15 to be visible')
    expect(kernelMagLabel(100)).toBe(', drawn ×100 to be visible')
  })

  it('"Convolution, watched": the real kernel (8 taps of 1/8) beside a 0.8-amplitude square draws at ×6.1', () => {
    // The exact scenario the try line's default state builds — measured
    // through the same convKernel/chainImpulse path App.jsx uses, not
    // asserted from the formula alone.
    const p = PRESETS.find((x) => x.name === 'Convolution, watched')
    const st = presetState(p)
    const x = render(st.sources, 480, st.sampleRate, 0)
    const k = convKernel(st.blocks, st.sampleRate)
    const { h } = chainImpulse(st.blocks, k.n, st.sampleRate)
    let peak = 1e-9
    for (const v of x) peak = Math.max(peak, Math.abs(v))
    let hPeak = 1e-9
    for (const v of h) hPeak = Math.max(hPeak, Math.abs(v))
    const mag = (peak * 1.1) / (hPeak * 1.15)
    expect(mag).toBeCloseTo(6.12, 1)
    expect(kernelMagLabel(mag)).toBe(', drawn ×6.1 to be visible')
  })
})
