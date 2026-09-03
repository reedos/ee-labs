import { describe, it, expect } from 'vitest'
import { render, spectrum } from '@ee-labs/dsp'
import { PRESETS } from './presets.js'
import { presetState } from './state.js'
import { renderChain } from './dsp/chain.js'
import { formatPeaks, refinePeak, spectralPeaks } from './peaks.js'

// The peak readout. Two things a student read against the notes and found
// wrong — Beating naming one of its two lines, Exactly at Nyquist reading
// 3996.1 Hz for a 4 kHz tone — plus the refinement between bins that the
// second fix made possible.

const byName = (n) => PRESETS.find((p) => p.name === n)
const specOf = (st) => {
  const r = renderChain(st.sources, st.blocks, st.fftSize, st.sampleRate)
  return spectrum(r.buf, st.sampleRate, st.window)
}
const readout = (st) => {
  const { freqs, amps } = specOf(st)
  return formatPeaks(spectralPeaks(freqs, amps, { window: st.window }))
}

describe('Exactly at Nyquist reads 4000 Hz', () => {
  it('on a fresh load, where the Hann neighbour ties the Nyquist bin', () => {
    const st = presetState(byName('Exactly at Nyquist'))
    const { amps } = specOf(st)
    // The tie the old argmax lost: bin N/2−1 (fold 2, half the window's
    // height) against bin N/2 (fold 1, all of it) — equal to 0.1%.
    const half = st.fftSize / 2
    expect(Math.abs(amps[half - 1] - amps[half])).toBeLessThan(1e-3)
    expect(amps[half - 1]).toBeGreaterThanOrEqual(amps[half]) // the old picker's choice
    expect(readout(st)).toBe('4000.0 Hz')
  })

  it('after Beating, whose 8192-point frame no longer leaks into it', () => {
    // The sequence a student runs: Beating, then the next group.
    const beating = presetState(byName('Beating'))
    expect(beating.fftSize).toBe(8192)
    const st = presetState(byName('Exactly at Nyquist'))
    expect(st.fftSize).toBe(2048)
    expect(readout(st)).toBe('4000.0 Hz')
    // And even at 8192 points the tie rule alone would read it right.
    expect(readout({ ...st, fftSize: 8192 })).toBe('4000.0 Hz')
  })
})

describe('Beating names both lines', () => {
  it('lists every line within 6 dB of the tallest, at least 3 bins apart', () => {
    const st = presetState(byName('Beating'))
    const { freqs, amps } = specOf(st)
    const peaks = spectralPeaks(freqs, amps, { window: st.window })
    expect(peaks).toHaveLength(2)
    expect(peaks[0].freq).toBeCloseTo(250, 1)
    expect(peaks[1].freq).toBeCloseTo(255, 1)
    expect(peaks[1].bin - peaks[0].bin).toBeGreaterThanOrEqual(3)
    expect(readout(st)).toBe('250.0 and 255.0 Hz')
  })

  it('formats one, two and three lines the way the sentence reads', () => {
    expect(formatPeaks([{ freq: 250 }])).toBe('250.0 Hz')
    expect(formatPeaks([{ freq: 250 }, { freq: 255 }])).toBe('250.0 and 255.0 Hz')
    expect(formatPeaks([{ freq: 750 }, { freq: 1000 }, { freq: 1250 }])).toBe('750.0, 1000.0 and 1250.0 Hz')
    expect(formatPeaks([])).toBe('—')
  })

  it('caps the list at three and ignores lines more than 6 dB down', () => {
    // A square: fundamental 0 dB, 3rd at −9.5 dB — one line, not five.
    const sq = presetState(byName('Square = odd harmonics'))
    expect(readout(sq)).toBe('250.0 Hz')
    // Noise through a resonance: many local maxima, three named at most.
    const st = presetState(byName('Resonance is Q'))
    const { freqs, amps } = specOf(st)
    expect(spectralPeaks(freqs, amps).length).toBeLessThanOrEqual(3)
  })

  it('reads a dash for numerical dust rather than a random bin', () => {
    const st = presetState(byName('Exactly at Nyquist'))
    const zero = { ...st, sources: [{ ...st.sources[0], phase: 0 }] }
    expect(readout(zero)).toBe('—')
  })
})

describe('between bins', () => {
  const tone = (f, window = 'hann', n = 2048, sr = 8000) => {
    const buf = render([{ id: 1, type: 'sine', freq: f, amp: 1, phase: 0, enabled: true }], n, sr, 0)
    const { freqs, amps } = spectrum(buf, sr, window)
    return spectralPeaks(freqs, amps, { window })[0].freq
  }

  it('the Hann estimate is exact for a pure tone anywhere between bins', () => {
    // 3.906 Hz bins: none of these sit on a centre.
    for (const f of [263, 440, 1000.7, 3300, 3333.3]) {
      expect(tone(f), `${f} Hz`).toBeCloseTo(f, 1)
    }
  })

  it('the rectangular-window estimate is close, and never worse than the bin centre', () => {
    for (const f of [263, 440, 1000.7]) {
      expect(Math.abs(tone(f, 'none') - f), `${f} Hz`).toBeLessThan(1)
    }
  })

  it('other windows fall back to a parabola that stays within a fraction of a bin', () => {
    for (const w of ['hamming', 'blackman']) {
      for (const f of [263, 440]) expect(Math.abs(tone(f, w) - f), `${w} ${f} Hz`).toBeLessThan(1)
    }
  })

  it('never refines an edge bin, and reports Nyquist or DC on a tie', () => {
    const freqs = Float64Array.from([0, 1, 2, 3, 4])
    // A tone at Nyquist: last bin tied with its neighbour.
    expect(refinePeak(freqs, Float64Array.from([0, 0, 0.1, 1.0005, 1]), 3)).toBe(4)
    // DC: first bin tied with its neighbour.
    expect(refinePeak(freqs, Float64Array.from([1, 1.0005, 0.1, 0, 0]), 1)).toBe(0)
    // No tie: an interior bin refines, an edge bin does not.
    expect(refinePeak(freqs, Float64Array.from([0.1, 1, 0.1, 0, 0]), 1)).toBeCloseTo(1, 9)
    expect(refinePeak(freqs, Float64Array.from([1, 0.2, 0, 0, 0]), 0)).toBe(0)
  })
})
