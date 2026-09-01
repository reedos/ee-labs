import { describe, it, expect } from 'vitest'
import { reportSummary } from './report.js'
import { PRESETS } from './presets.js'

describe('the report summary', () => {
  it('never yields undefined, NaN or [object Object] for any preset', () => {
    for (const p of PRESETS) {
      const s = reportSummary({
        presetName: p.name,
        sources: p.patch.sources,
        blocks: p.patch.blocks || [],
        sampleRate: p.patch.sampleRate || 8000,
        fftSize: p.patch.fftSize || 2048,
        window: p.patch.window || 'hann',
      })
      for (const [k, v] of Object.entries(s)) {
        expect(String(v), `${p.name} → ${k}`).not.toMatch(/undefined|NaN|\[object Object\]/)
        expect(String(v).trim(), `${p.name} → ${k}`).not.toBe('')
      }
    }
  })

  it('names the band limit, which is otherwise invisible in a source line', () => {
    // "square at 281Hz" describes two different signals depending on where the
    // series stops, and that difference is the whole point of the control.
    const state = {
      sources: [{ type: 'square', freq: 281.25, amp: 1, enabled: true, topHarmonic: 9 }],
      blocks: [], sampleRate: 8000, fftSize: 2048, window: 'hann',
    }
    expect(reportSummary(state).Sources).toMatch(/up to harmonic 9/)
    // ...and the ideal square says nothing extra, because there is no limit.
    const ideal = { ...state, sources: [{ ...state.sources[0], topHarmonic: 0 }] }
    expect(reportSummary(ideal).Sources).not.toMatch(/harmonic/)
  })

  it('lists only the sources that are actually on', () => {
    const s = reportSummary({
      sources: [
        { type: 'sine', freq: 100, amp: 1, enabled: true },
        { type: 'noise', freq: 0, amp: 1, enabled: false },
      ],
      blocks: [], sampleRate: 8000, fftSize: 2048, window: 'hann',
    })
    expect(s.Sources).toContain('sine')
    expect(s.Sources).not.toContain('noise')
  })

  it('says so plainly when there is nothing to hear or nothing in the way', () => {
    const s = reportSummary({
      sources: [{ type: 'sine', freq: 100, amp: 1, enabled: false }],
      blocks: [], sampleRate: 8000, fftSize: 2048, window: 'hann',
    })
    expect(s.Sources).toBe('none enabled')
    expect(s.Chain).toBe('empty')
  })

  it('marks a bypassed block, which looks identical in the plots', () => {
    const s = reportSummary({
      sources: [{ type: 'sine', freq: 100, amp: 1, enabled: true }],
      blocks: [{ type: 'lowpass', bypass: true }, { type: 'gain', bypass: false }],
      sampleRate: 8000, fftSize: 2048, window: 'hann',
    })
    expect(s.Chain).toBe('lowpass (bypassed) → gain')
  })
})
