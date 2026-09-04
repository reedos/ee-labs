import { describe, it, expect } from 'vitest'
import { PRESETS, PRESET_GROUPS } from './presets.js'
import { presetState } from './state.js'
import { applyChip, chipMatches } from './chips.js'
import { formatPeaks, spectralPeaks } from './peaks.js'
import { chainGroupDelay, chainImpulse, chainPolesZeros, chainResponse, kernelCentre, renderChain } from './dsp/chain.js'
import { BLOCK_TYPES } from './dsp/blocks.js'
import { render, rms, sincInterp, spectrum } from '@ee-labs/dsp'
import { GLOBAL_FIELDS, SOURCE_FIELDS } from './components/fields.jsx'
import { gibbsOf } from './math.js'

// The try lines, chips and featured knobs.
//
// A `try` is one imperative under the note: the knob to touch and what
// should happen. Like the note it makes claims — "drops 24 dB", "60 samples",
// "250 and 750 Hz" — and like the note's, each claim is rendered here and
// measured rather than restated from its own formula. The chips are the one-
// click way of doing what the try says, so every measurement below goes
// through the chip's patch: if the chip and the sentence ever disagree, this
// is where it shows.

const byName = (n) => {
  const p = PRESETS.find((x) => x.name === n)
  if (!p) throw new Error(`no preset "${n}"`)
  return p
}
const chipOf = (p, label) => {
  const c = (p.chips || []).find((x) => x.label === label)
  if (!c) throw new Error(`${p.name}: no chip "${label}"`)
  return c
}

/** The state after loading a preset and clicking a chip (or none). */
const loaded = (name, chipLabel = null) => {
  const p = byName(name)
  const s = presetState(p)
  return chipLabel ? applyChip(s, chipOf(p, chipLabel).patch) : s
}

/** Render a state exactly as the app would, and read its spectrum. */
function runS(st) {
  const r = renderChain(st.sources, st.blocks, st.fftSize, st.sampleRate)
  const s = spectrum(r.buf, st.sampleRate, st.window)
  const at = (f) => {
    let bi = 0
    for (let i = 1; i < s.freqs.length; i++) {
      if (Math.abs(s.freqs[i] - f) < Math.abs(s.freqs[bi] - f)) bi = i
    }
    let m = 0
    for (let i = Math.max(0, bi - 2); i <= Math.min(s.amps.length - 1, bi + 2); i++) {
      if (s.amps[i] > m) m = s.amps[i]
    }
    return m
  }
  const peaks = spectralPeaks(s.freqs, s.amps, { window: st.window })
  return { ...s, at, peaks, readout: formatPeaks(peaks), buf: r.buf }
}

const db = (x) => 20 * Math.log10(x)
const words = (s) => s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length
const H = (st, f) => chainResponse(st.blocks, Float64Array.of(f), st.sampleRate).mag[0]

describe('every preset', () => {
  it('has a try line of at most sixteen words', () => {
    for (const p of PRESETS) {
      expect(typeof p.try, p.name).toBe('string')
      expect(words(p.try), `${p.name}: "${p.try}"`).toBeLessThanOrEqual(16)
      expect(words(p.try), p.name).toBeGreaterThan(3)
    }
  })

  it('is listed in sidebar order, so "n of 35" is the position the student sees', () => {
    const groupOrder = PRESET_GROUPS.flatMap((g) => PRESETS.filter((p) => p.group === g).map((p) => p.name))
    expect(PRESETS.map((p) => p.name)).toEqual(groupOrder)
    expect(PRESETS).toHaveLength(35)
  })

  it('has chips whose patches apply, render, and read back as the active chip', () => {
    for (const p of PRESETS) {
      for (const c of p.chips || []) {
        expect(c.label, p.name).toBeTruthy()
        const st = applyChip(presetState(p), c.patch)
        expect(chipMatches(st, c.patch), `${p.name}: chip "${c.label}" not active after applying`).toBe(true)
        const r = renderChain(st.sources, st.blocks, 512, st.sampleRate)
        for (let i = 0; i < r.buf.length; i++) {
          if (!Number.isFinite(r.buf[i])) throw new Error(`${p.name}/${c.label}: non-finite at ${i}`)
        }
      }
      // Labels are the chips' identity in the UI; a duplicate would be two
      // buttons for one setting.
      const labels = (p.chips || []).map((c) => c.label)
      expect(new Set(labels).size, p.name).toBe(labels.length)
    }
  })

  it('features only knobs that the loaded preset actually has', () => {
    for (const p of PRESETS) {
      for (const f of p.featured || []) {
        if (f.source != null) {
          const src = p.patch.sources.find((s) => s.id === f.source)
          expect(src, `${p.name}: featured source ${f.source}`).toBeTruthy()
          expect(Object.keys(SOURCE_FIELDS), `${p.name}: field ${f.field}`).toContain(f.field)
          if (f.field === 'topHarmonic') expect(src.type).toBe('square')
          if (f.field === 'freq' || f.field === 'phase') expect(src.type).not.toBe('noise')
        } else if (f.block != null) {
          const b = (p.patch.blocks || []).find((x) => x.id === f.block)
          expect(b, `${p.name}: featured block ${f.block}`).toBeTruthy()
          // bypass is the block's own on/off switch, not one of its type's
          // params — nothing to look up in the schema.
          if (f.field === 'bypass') continue
          const def = BLOCK_TYPES[b.type]
          const param = def.params.find((x) => x.key === f.field)
          expect(param, `${p.name}: ${b.type} has no param ${f.field}`).toBeTruthy()
          // And it is not hidden by the preset's own settings (Q at 4th order).
          if (param.when) expect(param.when(b.params), `${p.name}: ${f.field} hidden`).toBe(true)
        } else {
          // A chain-global setting — FFT size, sample rate, the window, the
          // overlay — named with neither a source nor a block.
          expect(Object.keys(GLOBAL_FIELDS), `${p.name}: field ${f.field}`).toContain(f.field)
        }
      }
    }
  })

  it('features the knobs the review measured off-screen', () => {
    const want = {
      'Single tone': { source: 1, field: 'amp' },
      'Corners make harmonics': { source: 1, field: 'type' },
      'Sources simply add': { source: 2, field: 'enabled' },
      'Exactly at Nyquist': { source: 1, field: 'phase' },
      'Resonance is Q': { block: 1, field: 'q' },
      'Coarse, not undersampled': { source: 1, field: 'freq' },
      Aliasing: { source: 1, field: 'freq' },
      Beating: { field: 'fftSize' },
      'Turn the rate down': { field: 'sampleRate' },
      'Resolution needs time': { field: 'fftSize' },
      'Spectral leakage': { field: 'window' },
      'Phase is invisible here': { field: 'overlay' },
      'Two filters are steeper': { block: 2, field: 'bypass' },
      'Two tones, one nonlinearity': { block: 1, field: 'bypass' },
    }
    for (const [name, f] of Object.entries(want)) {
      expect(byName(name).featured, name).toContainEqual(f)
    }
    // The two the try line names no control for at all: a compound chip
    // action (Build a square) and a canvas transport (Convolution, watched,
    // which gets `playHint` instead — see the describe block below).
    expect(byName('Build a square').featured || []).toEqual([])
  })

  it('features a knob whenever the try line names one by its label', () => {
    // The labels a try can name: source fields, block params, the block's
    // own bypass switch, and the chain-global settings.
    const labelsOf = (p) => {
      const out = []
      for (const f of p.featured || []) {
        if (f.source != null) out.push(SOURCE_FIELDS[f.field])
        else if (f.block != null) {
          if (f.field === 'bypass') {
            out.push('Bypass')
            continue
          }
          const b = p.patch.blocks.find((x) => x.id === f.block)
          out.push(BLOCK_TYPES[b.type].params.find((x) => x.key === f.field).label)
        } else out.push(GLOBAL_FIELDS[f.field])
      }
      return out
    }
    // "Window" and "Overlay" are deliberately not here: a block can carry its
    // own `window` param (the FIR design taper, "Set Window to hamming") that
    // means something different from the chain-global analysis window this
    // preset's own try line names — the two share an English word without
    // sharing a field. Spectral leakage's and Phase is invisible here's
    // featured entries are pinned instead, above, by name.
    const knobWords = [
      'Frequency', 'Phase', 'Highest harmonic', 'Cutoff', 'Q ', 'Taps N', 'Threshold', 'DC offset',
      'Carrier', 'Bits', 'Type', 'Amplitude', 'Bypass', 'FFT', 'Rate',
    ]
    for (const p of PRESETS) {
      const named = knobWords.filter((k) => new RegExp(`\\b${k.trim()}\\b`).test(p.try))
      for (const k of named) {
        const ok = labelsOf(p).some((l) => l.startsWith(k.trim()))
        expect(ok, `${p.name}: try names "${k.trim()}" but does not feature it`).toBe(true)
      }
    }
  })
})

describe('the lecturing notes are one claim', () => {
  it('keeps the five the review named at or under 55 words', () => {
    for (const name of [
      'Convolution, watched',
      'A square that fits',
      'Resonance is Q',
      'Exactly at Nyquist',
      'Coarse, not undersampled',
    ]) {
      expect(words(byName(name).note), name).toBeLessThanOrEqual(55)
    }
  })

  // A period followed by whitespace-or-end, which a decimal point never is
  // (its digit follows immediately, with no space) — so "0.541" and "8.95%."
  // both stay one token and only real sentence boundaries are counted.
  const sentenceCount = (s) => (s.match(/[.!?]+(?=\s|$)/g) || []).length

  // The words try lines legitimately open with — "Set", "Drag", "Click"…
  // (the header's own words: "one imperative under the note"). A NOTE
  // sentence opening the same way has strayed into the try line's job.
  const IMPERATIVES = [
    'Set', 'Drag', 'Switch', 'Click', 'Bypass', 'Add', 'Turn', 'Open', 'Try',
    'Compare', 'Feed', 'Watch', 'Move', 'Untick', 'Tick', 'Enable', 'Disable',
    'Raise', 'Lower', 'Increase', 'Decrease', 'Slide', 'Push', 'Pull', 'Mute',
    'Unmute', 'Adjust', 'Change', 'Type', 'Enter', 'Toggle',
  ]
  const opensImperative = (sentence) => {
    const first = sentence.trim().split(/\s+/)[0] || ''
    return IMPERATIVES.includes(first)
  }

  it('every one of the 35 notes is one claim: ≤55 words, ≤3 sentences, no imperatives', () => {
    const failures = []
    for (const p of PRESETS) {
      const w = words(p.note)
      if (w > 55) failures.push(`${p.name}: ${w} words (limit 55)`)
      const sc = sentenceCount(p.note)
      if (sc > 3) failures.push(`${p.name}: ${sc} sentences (limit 3)`)
      const bad = p.note
        .split(/(?<=[.!?])\s+/)
        .filter(opensImperative)
      if (bad.length) failures.push(`${p.name}: imperative sentence "${bad[0]}" — that belongs to the try line`)
    }
    expect(failures.join('\n')).toBe('')
  })
})

// ------------------------------------------------------- Signals and Fourier

describe('try: Single tone', () => {
  it('is a real micro-experiment now, and still points at the next by name', () => {
    const { peaks } = runS(loaded('Single tone'))
    expect(peaks).toHaveLength(1)
    expect(peaks[0].freq).toBeCloseTo(250, 1)
    const i = PRESETS.findIndex((p) => p.name === 'Single tone')
    expect(PRESETS[i + 1].name).toBe('Square = odd harmonics')
    // A real verb, not pure navigation (the review's own complaint) — the
    // pointer to Square survives as a trailing clause.
    expect(byName('Single tone').try).toMatch(/Amplitude/)
    expect(byName('Single tone').try).toMatch(/Next: Square/)
  })

  it('dragging Amplitude to 0.5 drops the line 6.02 dB from the default 1', () => {
    const full = runS(loaded('Single tone'))
    const half = runS(loaded('Single tone', '0.5'))
    expect(db(half.at(250) / full.at(250))).toBeCloseTo(-6.02, 1)
    expect(byName('Single tone').featured).toContainEqual({ source: 1, field: 'amp' })
  })
})

describe('try: Square = odd harmonics', () => {
  it('3 then 9: more odd lines, nothing between them', () => {
    const three = runS(loaded('Square = odd harmonics', '3'))
    const nine = runS(loaded('Square = odd harmonics', '9'))
    const lines = (s) => [1, 3, 5, 7, 9, 11].filter((k) => s.at(250 * k) > 0.05).length
    expect(lines(three)).toBe(2)
    expect(lines(nine)).toBe(5)
    for (const s of [three, nine]) for (const k of [2, 4, 6]) expect(s.at(250 * k)).toBeLessThan(1e-4)
    // "ideal" is the unbounded series again.
    expect(loaded('Square = odd harmonics', 'ideal').sources[0].topHarmonic).toBe(0)
  })
})

describe('try: Corners make harmonics', () => {
  it('square chip: the 3rd rises from 1/9 to 1/3', () => {
    const tri = runS(loaded('Corners make harmonics', 'triangle'))
    const sq = runS(loaded('Corners make harmonics', 'square'))
    expect(tri.at(250) / tri.at(750)).toBeCloseTo(9, 0)
    expect(sq.at(250) / sq.at(750)).toBeCloseTo(3, 0)
  })

  it('the note’s own "8.8 measured here": the default triangle reads 8.77, not the idealized 9', () => {
    const st = runS(loaded('Corners make harmonics'))
    const ratio = st.at(250) / st.at(750)
    expect(ratio).toBeCloseTo(8.77, 1)
    // Genuinely short of the continuous-series limit, at 32 samples per
    // period — the sampled triangle's own correction, not rounding noise.
    expect(9 - ratio).toBeGreaterThan(0.1)
  })
})

describe('try: Build a square', () => {
  it('adding the 7th and 9th steepens the edges and keeps the overshoot above 9%', () => {
    const three = loaded('Build a square')
    const five = loaded('Build a square', 'add 7th and 9th')
    expect(five.sources).toHaveLength(5)
    expect(five.sources[3].freq).toBe(1750)
    expect(five.sources[4].freq).toBe(2250)
    const shape = (st) => {
      const b = render(st.sources, 4096, st.sampleRate, 0)
      let slope = 0
      let peak = 0
      for (let i = 1; i < b.length; i++) slope = Math.max(slope, Math.abs(b[i] - b[i - 1]))
      for (const v of b) peak = Math.max(peak, v)
      // The series 1, 1/3, 1/5… without the 4/π converges to a square of
      // height π/4; the overshoot is measured against that.
      return { slope, overshoot: peak / (Math.PI / 4) - 1 }
    }
    const a = shape(three)
    const b = shape(five)
    expect(b.slope).toBeGreaterThan(a.slope * 1.3)
    expect(a.overshoot).toBeGreaterThan(0.09)
    expect(b.overshoot).toBeGreaterThan(0.09)
    // Narrower, not taller: the five-term overshoot is no larger.
    expect(b.overshoot).toBeLessThanOrEqual(a.overshoot)
  })

  it("the math panel's own Gibbs measurement: 9.42% at 3 terms, 9.12% at 5, both above the 8.95% limit", () => {
    // gibbsOf is the function "The math for this experiment" actually calls
    // (see math.js's 'Build a square' entry) — measured here on the same two
    // states the try line's chip produces, so the panel's numbers are pinned
    // rather than only the shape of the waveform.
    const st = loaded('Build a square')
    const three = gibbsOf(st.sources, st.sampleRate)
    const five = gibbsOf(loaded('Build a square', 'add 7th and 9th').sources, st.sampleRate)
    expect(three.overshootPct).toBeCloseTo(9.42, 1)
    expect(five.overshootPct).toBeCloseTo(9.12, 1)
    // Converging toward the limit from above, never below it.
    expect(three.overshootPct).toBeGreaterThan(8.95)
    expect(five.overshootPct).toBeGreaterThan(8.95)
    expect(five.overshootPct).toBeLessThan(three.overshootPct)
  })
})

describe('try: Sources simply add', () => {
  it('unticking source 2 leaves the 300 Hz line where it was', () => {
    const both = runS(loaded('Sources simply add'))
    const solo = runS(loaded('Sources simply add', 'source 2 off'))
    expect(solo.at(300)).toBeCloseTo(both.at(300), 4)
    expect(solo.at(1800)).toBeLessThan(1e-6)
    expect(both.readout).toBe('300.0 and 1800.0 Hz')
  })
})

describe('try: Sines in, sines out', () => {
  it('180° inverts the filtered wave exactly and leaves the line alone', () => {
    const a = loaded('Sines in, sines out')
    const b = loaded('Sines in, sines out', '180°')
    const ya = renderChain(a.sources, a.blocks, 2048, a.sampleRate).buf
    const yb = renderChain(b.sources, b.blocks, 2048, b.sampleRate).buf
    let worst = 0
    for (let i = 0; i < ya.length; i++) worst = Math.max(worst, Math.abs(ya[i] + yb[i]))
    expect(worst).toBeLessThan(1e-9)
    expect(runS(b).at(700)).toBeCloseTo(runS(a).at(700), 9)
  })
})

describe('try: Beating', () => {
  it('names both lines at 8192 and one merged peak at 2048', () => {
    expect(runS(loaded('Beating')).readout).toBe('250.0 and 255.0 Hz')
    const merged = runS(loaded('Beating', 'FFT 2048'))
    expect(merged.peaks).toHaveLength(1)
    expect(runS(loaded('Beating', 'FFT 8192')).peaks).toHaveLength(2)
  })
})

// ------------------------------------------------------------------ Sampling

describe('try: Coarse, not undersampled', () => {
  it('3900 Hz is 2.05 samples per cycle and still reconstructs to the sine', () => {
    const st = loaded('Coarse, not undersampled', '3900 Hz')
    expect((st.sampleRate / st.sources[0].freq).toFixed(2)).toBe('2.05')
    const buf = render(st.sources, 4096, st.sampleRate, 0)
    let worst = 0
    for (const t of [1000.37, 2048.5, 3000.11]) {
      const truth = Math.sin((2 * Math.PI * 3900 * t) / st.sampleRate)
      worst = Math.max(worst, Math.abs(sincInterp(buf, t, 256) - truth))
    }
    expect(worst).toBeLessThan(0.02)
    expect(runS(st).readout).toBe('3900.0 Hz')
  })
})

describe('try: Aliasing', () => {
  it('6000 reads 2000; 4600 reads 3400, the same as the start', () => {
    expect(runS(loaded('Aliasing', '3400 Hz')).readout).toBe('3400.0 Hz')
    expect(runS(loaded('Aliasing', '4600 Hz')).readout).toBe('3400.0 Hz')
    expect(runS(loaded('Aliasing', '6000 Hz')).readout).toBe('2000.0 Hz')
  })

  it('every chip’s span is exactly 40 samples, so RMS reads 0.7071 throughout', () => {
    // 17 cycles of 3400 Hz, 23 of 4600, 30 of 6000 — all 40 samples at 8 kHz,
    // chosen so the visible-span RMS never averages a partial cycle.
    for (const [label, cycles] of [
      ['3400 Hz', 17],
      ['4600 Hz', 23],
      ['6000 Hz', 30],
    ]) {
      const st = loaded('Aliasing', label)
      expect(st.spanCycles, label).toBe(cycles)
      const n = (st.spanCycles / st.sources[0].freq) * st.sampleRate
      expect(n, label).toBeCloseTo(40, 9)
      const buf = render(st.sources, Math.round(n), st.sampleRate, 0)
      expect(rms(buf), label).toBeCloseTo(Math.SQRT1_2, 4)
    }
  })
})

describe('try: Turn the rate down', () => {
  it('4 kHz folds 3125 to 875', () => {
    const s = runS(loaded('Turn the rate down', '4 kHz'))
    expect(s.at(875)).toBeCloseTo(1 / 5, 1)
    expect(s.at(625)).toBeCloseTo(1, 1)
  })
})

describe('try: Exactly at Nyquist', () => {
  it('0° vanishes, 45° reads 0.707, 90° reads 4000.0 Hz at full amplitude', () => {
    expect(runS(loaded('Exactly at Nyquist', '0°')).at(4000)).toBeLessThan(1e-9)
    expect(runS(loaded('Exactly at Nyquist', '45°')).at(4000)).toBeCloseTo(Math.SQRT1_2, 2)
    const full = runS(loaded('Exactly at Nyquist', '90°'))
    expect(full.at(4000)).toBeCloseTo(1, 2)
    expect(full.readout).toBe('4000.0 Hz')
  })
})

describe('try: A square that fits', () => {
  it('15 folds the 15th from 4219 to 3781 Hz, between the lines', () => {
    const st = loaded('A square that fits', '15')
    const f0 = st.sources[0].freq
    expect(Math.round(15 * f0)).toBe(4219)
    expect(Math.round(st.sampleRate - 15 * f0)).toBe(3781)
    const s = runS({ ...st, window: 'none' })
    expect(s.at(3781.25)).toBeCloseTo(4 / (15 * Math.PI), 3)
    expect(Number.isInteger(3781.25 / f0)).toBe(false)
    expect(byName('A square that fits').try).toContain('4219')
    expect(byName('A square that fits').try).toContain('3781')
  })
})

describe('try: Resolution needs time', () => {
  it('512 is one peak; 2048 splits it into 250 and 265 Hz', () => {
    expect(runS(loaded('Resolution needs time', 'FFT 512')).peaks).toHaveLength(1)
    const two = runS(loaded('Resolution needs time', 'FFT 2048'))
    expect(two.peaks).toHaveLength(2)
    expect(two.peaks[0].freq).toBeCloseTo(250, 0)
    expect(two.peaks[1].freq).toBeCloseTo(265, 0)
  })

  it('the note’s "a low one, 0.25": the merged peak reads 0.253, not the sources summed', () => {
    const merged = runS(loaded('Resolution needs time', 'FFT 512'))
    expect(merged.peaks).toHaveLength(1)
    expect(merged.peaks[0].amp).toBeCloseTo(0.25, 1)
  })
})

describe('try: Spectral leakage', () => {
  it('the smear at 1 kHz is −56 dB with no window and below −140 dB with hann', () => {
    const none = runS(loaded('Spectral leakage', 'none'))
    const hann = runS(loaded('Spectral leakage', 'hann'))
    expect(db(none.at(1000))).toBeGreaterThan(-58)
    expect(db(none.at(1000))).toBeLessThan(-55)
    expect(db(hann.at(1000))).toBeLessThan(-140)
  })
})

// ------------------------------------------------------------------- Filters

describe('try: Low-pass a square', () => {
  it('at 300 Hz the 3rd harmonic is 24 dB below the fundamental', () => {
    const s = runS(loaded('Low-pass a square', '300 Hz'))
    expect(db(s.at(750) / s.at(250))).toBeCloseTo(-24, 0)
  })
})

describe('try: High-pass a square', () => {
  it('at 2 kHz the plateaus are flat at zero next to the edge spikes', () => {
    const st = loaded('High-pass a square', '2 kHz')
    const y = renderChain(st.sources, st.blocks, 1024, st.sampleRate).buf
    const half = Math.round(st.sampleRate / (2 * st.sources[0].freq))
    let plateau = 0
    let edge = 0
    for (let e = 4 * half; e + half < 1024; e += half) {
      edge = Math.max(edge, Math.abs(y[e]), Math.abs(y[e + 1]))
      plateau = Math.max(plateau, Math.abs(y[e + Math.round(half / 2)]))
    }
    expect(edge).toBeGreaterThan(0.8)
    expect(plateau / edge).toBeLessThan(0.01)
  })
})

describe('try: Resonance is Q', () => {
  it('Q = 1 is level with the passband; Q = 20 stands 26 dB', () => {
    const one = loaded('Resonance is Q', '1')
    expect(H(one, 800)).toBeCloseTo(1, 6)
    expect(Math.abs(H(one, 800) - H(one, 100))).toBeLessThan(0.01)
    const twenty = loaded('Resonance is Q', '20')
    expect(db(H(twenty, 800))).toBeCloseTo(26.02, 1)
    expect(db(H(loaded('Resonance is Q', '10'), 800))).toBeCloseTo(20, 1)
    expect(db(H(loaded('Resonance is Q', '0.707'), 800))).toBeCloseTo(-3.01, 1)
  })
})

describe('try: Phase is invisible here', () => {
  it('holds components near 380 Hz up by 25.7764 samples', () => {
    const st = loaded('Phase is invisible here', 'delay overlay')
    expect(st.overlay).toBe('delay')
    // Same 200-point scan the math panel itself runs (see math.js), so this
    // is the SAME number the try line quotes, not a second one from a
    // differently-spaced grid that happens to land close by. That mismatch —
    // "26 samples near 400 Hz" in prose against "25.7764 samples at 380 Hz"
    // on the panel — was the defect.
    const freqs = Float64Array.from({ length: 200 }, (_, i) => ((i + 1) * st.sampleRate) / 2 / 200)
    const { delay } = chainGroupDelay(st.blocks, freqs, st.sampleRate)
    let mx = 0
    let at = 0
    for (let i = 0; i < freqs.length; i++) if (delay[i] > mx) [mx, at] = [delay[i], freqs[i]]
    expect(at).toBe(380)
    expect(mx).toBeCloseTo(25.7764, 3)
    expect(delay[99]).toBeLessThan(1) // 2 kHz: barely held at all
  })
})

describe('try: Two filters are steeper', () => {
  it('one section is −39 dB at 3200 Hz, both are −78: exactly half', () => {
    const one = loaded('Two filters are steeper', 'one section')
    const both = loaded('Two filters are steeper', 'both sections')
    expect(one.blocks[1].bypass).toBe(true)
    expect(db(H(one, 3200))).toBeCloseTo(-39.06, 1)
    expect(db(H(both, 3200))).toBeCloseTo(-78.12, 1)
    expect(db(H(both, 3200)) / db(H(one, 3200))).toBeCloseTo(2, 6)
  })
})

describe('try: Order is a choice', () => {
  it('0.707 twice sags the corner from −3 dB to −6 dB', () => {
    expect(db(H(loaded('Order is a choice', 'Butterworth 0.541 / 1.307'), 800))).toBeCloseTo(-3.01, 1)
    expect(db(H(loaded('Order is a choice', '0.707 twice'), 800))).toBeCloseTo(-6.02, 1)
  })
})

describe('try: Impulse response', () => {
  it('Q = 1 rings out within one cycle and the peak drops 12 dB from Q = 4', () => {
    const ring = (st) => {
      const { h } = chainImpulse(st.blocks, 400, st.sampleRate)
      let pk = 0
      for (const v of h) pk = Math.max(pk, Math.abs(v))
      let last = 0
      for (let i = 0; i < h.length; i++) if (Math.abs(h[i]) > 0.05 * pk) last = i
      return last / (st.sampleRate / st.blocks[0].params.freq) // in cycles of the cutoff
    }
    expect(ring(loaded('Impulse response', '1'))).toBeLessThanOrEqual(1)
    expect(ring(loaded('Impulse response', '4'))).toBeGreaterThan(3)
    const drop = db(H(loaded('Impulse response', '4'), 800)) - db(H(loaded('Impulse response', '1'), 800))
    expect(drop).toBeCloseTo(12.04, 1)
  })
})

describe('try: Step response and ringing', () => {
  const overshoot = (st) => {
    const r = renderChain(st.sources, st.blocks, 2048, st.sampleRate, { warmup: 0 })
    let top = 0
    for (const v of r.buf) top = Math.max(top, v)
    return top - 1
  }
  it('vanishes at 0.5, still 4.4% at 0.707', () => {
    expect(overshoot(loaded('Step response and ringing', '0.5'))).toBeLessThanOrEqual(1e-9)
    expect(overshoot(loaded('Step response and ringing', '0.707')) * 100).toBeCloseTo(4.4, 0)
    expect(overshoot(loaded('Step response and ringing', '5'))).toBeGreaterThan(0.5)
  })
})

// --------------------------------------------------------- FIR and the z-plane

describe('try: A moving average is a filter', () => {
  it('16 taps put nulls every 500 Hz where 8 had none there', () => {
    const sixteen = loaded('A moving average is a filter', '16')
    for (const f of [500, 1000, 1500, 2000]) expect(H(sixteen, f), `${f} Hz`).toBeLessThan(1e-9)
    expect(H(loaded('A moving average is a filter', '8'), 500)).toBeGreaterThan(0.5)
  })
})

describe('try: Everything arrives together', () => {
  it('121 taps delay by exactly 60 samples, flat', () => {
    const st = loaded('Everything arrives together', '121')
    // A fine grid: the delay is the phase's slope, and the phase of a 60-
    // sample delay turns 2π every 133 Hz, so coarse steps cannot unwrap it.
    const freqs = Float64Array.from({ length: 513 }, (_, i) => (i * st.sampleRate) / 2 / 512)
    const { delay } = chainGroupDelay(st.blocks, freqs, st.sampleRate)
    // Bins where |H| is numerically zero have no phase to differentiate;
    // everywhere else the line is flat at exactly (N−1)/2.
    let seen = 0
    for (const d of delay) {
      if (!Number.isFinite(d)) continue
      expect(d).toBeCloseTo(60, 6)
      seen++
    }
    expect(seen).toBeGreaterThan(100)
  })
})

describe('try: The kernel is the filter', () => {
  it('loads with the group-delay overlay on — the note points at "the overlay reports", not "none"', () => {
    expect(loaded('The kernel is the filter').overlay).toBe('delay')
  })

  it('61 taps move the symmetry centre and the delay to 30', () => {
    const st = loaded('The kernel is the filter', '61')
    const { h } = chainImpulse(st.blocks, 256, st.sampleRate)
    expect(kernelCentre(h)).toBe(30)
    const freqs = Float64Array.from({ length: 513 }, (_, i) => (i * st.sampleRate) / 2 / 512)
    const { delay } = chainGroupDelay(st.blocks, freqs, st.sampleRate)
    const finite = Array.from(delay).filter(Number.isFinite)
    expect(finite.length).toBeGreaterThan(100)
    // The delay is a numerical derivative of the phase; it lands on 30 to a
    // few millionths, and that is the claim ("30"), not the sixth decimal.
    for (const d of finite) expect(d).toBeCloseTo(30, 3)
  })
})

describe('try: Cut it off abruptly and it rings', () => {
  it('loads on the linear scale — the 8% ripple is 0.7 dB, invisible on the dB axis', () => {
    expect(loaded('Cut it off abruptly and it rings').scale).toBe('linear')
  })

  const overshoot = (st) => {
    const freqs = Float64Array.from({ length: 400 }, (_, i) => (i * st.blocks[0].params.freq) / 400)
    const { mag } = chainResponse(st.blocks, freqs, st.sampleRate)
    let top = 0
    for (const v of mag) top = Math.max(top, v)
    return top - 1
  }
  it('201 taps narrow the ripple without shortening it; hamming removes it', () => {
    const a = overshoot(loaded('Cut it off abruptly and it rings', '101 taps'))
    const b = overshoot(loaded('Cut it off abruptly and it rings', '201 taps'))
    expect(a).toBeGreaterThan(0.05)
    expect(Math.abs(a - b)).toBeLessThan(0.02)
    expect(overshoot(loaded('Cut it off abruptly and it rings', 'hamming'))).toBeLessThan(0.01)
  })
})

describe('try: Zeros on the circle', () => {
  it('shows the kernel beside the z-plane: 12 equal taps of 1/12', () => {
    const st = loaded('Zeros on the circle')
    expect(st.timeView).toBe('impulse')
    expect(st.freqView).toBe('zplane')
    const { h, exact } = chainImpulse(st.blocks, 64, st.sampleRate)
    expect(exact).toBe(true)
    for (let i = 0; i < 12; i++) expect(h[i]).toBeCloseTo(1 / 12, 12)
    for (let i = 12; i < 64; i++) expect(h[i]).toBe(0)
  })

  it('6 taps: five zeros 60° apart; a low-pass adds two poles', () => {
    const st = loaded('Zeros on the circle', '6')
    const { zeros, poles } = chainPolesZeros(st.blocks, st.sampleRate)
    expect(zeros).toHaveLength(5)
    expect(poles).toHaveLength(0)
    for (const [re, im] of zeros) {
      const deg = (Math.atan2(im, re) * 180) / Math.PI
      expect(Math.abs(deg / 60 - Math.round(deg / 60))).toBeLessThan(1e-9)
    }
    // "Add a low-pass" is the try line's own remedy — go through the chip,
    // the same one click a student has, rather than splicing a block by hand.
    const withLp = applyChip(st, chipOf(byName('Zeros on the circle'), 'add a low-pass').patch)
    expect(chainPolesZeros(withLp.blocks, withLp.sampleRate).poles).toHaveLength(2)
  })
})

describe('try: Comb', () => {
  it('the note’s own numbers: τ = 4 ms is D = 32 samples, notches every 250 Hz', () => {
    const ff = loaded('Comb', 'feedforward').blocks[0].params
    expect(ff.delayMs).toBe(4)
    const D = Math.round((ff.delayMs / 1000) * 8000)
    expect(D).toBe(32)
    const spacing = 8000 / D
    expect(spacing).toBe(250)
  })

  it('feedback turns the notches into peaks midway between', () => {
    const ff = loaded('Comb', 'feedforward').blocks[0].params
    const fb = loaded('Comb', 'feedback').blocks[0].params
    const D = Math.round((ff.delayMs / 1000) * 8000)
    const spacing = 8000 / D
    expect(BLOCK_TYPES.comb.response(ff, spacing / 2, 8000)).toBeCloseTo(1 - ff.g, 6)
    expect(BLOCK_TYPES.comb.response(fb, spacing, 8000)).toBeCloseTo(1 / (1 - fb.g), 6)
    expect(BLOCK_TYPES.comb.response(fb, spacing / 2, 8000)).toBeLessThan(1)
  })
})

describe('try: Convolution, watched', () => {
  it('inside a flat top the output sits at exactly the amplitude, 0.8', () => {
    const st = loaded('Convolution, watched')
    expect(st.sources[0].amp).toBe(0.8)
    expect(byName('Convolution, watched').try).toContain('0.8')
    const x = render(st.sources, 480, st.sampleRate, 0)
    const y = renderChain(st.sources, st.blocks, 480, st.sampleRate, { warmup: 0 }).buf
    const N = st.blocks[0].params.taps
    const half = st.sampleRate / st.sources[0].freq / 2
    for (let n = N - 1; n < half; n++) expect(y[n]).toBeCloseTo(0.8, 12)
    expect(x.length).toBe(480)
    // The chips change the ramp width, N−1.
    expect(loaded('Convolution, watched', '4 taps').blocks[0].params.taps).toBe(4)
  })

  it('"press play" names a canvas transport, so it carries playHint instead of a featured field', () => {
    expect(byName('Convolution, watched').playHint).toBe(true)
    expect(byName('Convolution, watched').featured || []).toEqual([])
  })
})

// ---------------------------------------------------------------- Nonlinearity

describe('try: Clipping makes harmonics', () => {
  it('a threshold of 1 never bites: every harmonic vanishes', () => {
    const clean = runS(loaded('Clipping makes harmonics', '1'))
    for (const k of [3, 5, 7]) expect(clean.at(250 * k)).toBeLessThan(1e-6)
    expect(runS(loaded('Clipping makes harmonics', '0.3')).at(750)).toBeGreaterThan(0.05)
  })
})

describe('try: DC breaks the symmetry', () => {
  it('offset 0 removes the even harmonics', () => {
    const s = runS(loaded('DC breaks the symmetry', '0'))
    for (const k of [2, 4]) expect(s.at(250 * k)).toBeLessThan(s.at(250) / 100)
    const w = runS(loaded('DC breaks the symmetry', '0.3'))
    for (const k of [2, 4]) expect(w.at(250 * k)).toBeGreaterThan(w.at(250) / 100)
  })
})

describe('try: Two tones, one nonlinearity', () => {
  it('bypassing the clipper removes 100, 550, 900 and 1050 Hz', () => {
    const off = runS(loaded('Two tones, one nonlinearity', 'clipper bypassed'))
    for (const f of [100, 550, 900, 1050]) expect(off.at(f), `${f} Hz`).toBeLessThan(1e-4)
    const on = runS(loaded('Two tones, one nonlinearity', 'clipper on'))
    for (const f of [100, 550, 900, 1050]) expect(on.at(f), `${f} Hz`).toBeGreaterThan(0.01)
    expect(on.readout).toBe('250.0 and 400.0 Hz')
  })
})

describe('try: Ring modulator', () => {
  it('a 500 Hz carrier moves the lines to 250 and 750 Hz', () => {
    expect(runS(loaded('Ring modulator', '500 Hz')).readout).toBe('250.0 and 750.0 Hz')
    expect(runS(loaded('Ring modulator', '1000 Hz')).readout).toBe('750.0 and 1250.0 Hz')
  })
})

describe('try: AM: the carrier returns', () => {
  it('offset 0 removes the 1000 Hz carrier and keeps 750 and 1250', () => {
    expect(runS(loaded('AM: the carrier returns', '0.5')).readout).toBe('750.0, 1000.0 and 1250.0 Hz')
    expect(runS(loaded('AM: the carrier returns', '0')).readout).toBe('750.0 and 1250.0 Hz')
  })
})

describe('try: 4 bits', () => {
  const measure = (st) => {
    const wet = runS(st)
    const clean = runS({ ...st, blocks: [] })
    const binHz = st.sampleRate / st.fftSize
    let spur = 0
    let off = 0
    for (let i = 4; i < wet.amps.length - 2; i++) {
      const f = wet.freqs[i]
      if (Math.abs(f - 250) < 3 * binHz) continue
      const err = Math.abs(wet.amps[i] - clean.amps[i])
      const onHarmonic = Math.abs(f / 250 - Math.round(f / 250)) < (2 * binHz) / 250
      if (onHarmonic) spur = Math.max(spur, err)
      else off = Math.max(off, err)
    }
    return { spur, off }
  }
  it('12 bits sinks the spurs but keeps them discrete; dither makes a floor', () => {
    const four = measure(loaded('4 bits', '4 bits'))
    const twelve = measure(loaded('4 bits', '12 bits'))
    expect(twelve.spur).toBeLessThan(four.spur / 10)
    expect(twelve.spur).toBeGreaterThan(100 * twelve.off)
    const dithered = measure(applyChip(loaded('4 bits', '12 bits'), chipOf(byName('4 bits'), 'dither').patch))
    expect(dithered.spur).toBeLessThan(3 * dithered.off)
  })
})
