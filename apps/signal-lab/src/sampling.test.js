import { describe, it, expect } from 'vitest'
import { samplingState, ALIAS_RATIO, AT_NYQUIST_SHARE } from './sampling.js'
import { PRESETS } from './presets.js'

// The scope draws a caption saying "the ripple riding on this shape is
// aliasing". That is a claim about physics, made over the reader's own
// signal, so it is decided by a measurement — and the measurement is pinned
// here, because a threshold is only as good as the cases it was calibrated
// against, and both of this detector's earlier versions were wrong on cases
// nobody had listed.

const ctx = (patch, over = {}) => ({
  sources: patch.sources,
  blocks: patch.blocks || [],
  sampleRate: patch.sampleRate || 8000,
  fftSize: patch.fftSize || 2048,
  window: patch.window || 'hann',
  ...over,
})

const byName = (n) => {
  const p = PRESETS.find((x) => x.name === n)
  if (!p) throw new Error(`no preset "${n}"`)
  return p.patch
}

const of = (name, over = {}) => samplingState(ctx(byName(name), over))

const sq = (partials, over = {}) =>
  samplingState({
    sources: [{ id: 1, type: 'square', freq: 281.25, amp: 1, phase: 0, enabled: true, partials }],
    blocks: [],
    sampleRate: 8000,
    fftSize: 2048,
    window: 'hann',
    ...over,
  })

describe('what the detector says about the presets it ships with', () => {
  // Every preset whose lesson is that nothing is being lost. If the caption
  // ever appears on one of these it is contradicting the note beside it.
  const CLEAN = [
    'Single tone',
    'Beating',
    'Build a square',
    'Sources simply add',
    'Sines in, sines out',
    'Phase is invisible here',
    'Turn the rate down',
    'Coarse, not undersampled',
    'Aliasing', // loads BELOW Nyquist; the reader is invited to drag it past
    'Resolution needs time',
    'A square that fits',
    'The kernel is the filter',
    'Everything arrives together',
    'Step response and ringing',
    'Ring modulator',
    'AM: the carrier returns',
    'Low-pass a square',
  ]

  it.each(CLEAN)('says nothing is folding in "%s"', (name) => {
    const s = of(name)
    expect(s.aliased, `ratio ${s.ratio.toExponential(2)}`).toBe(false)
  })

  // Every preset whose signal genuinely runs past Nyquist and folds.
  const FOLDING = ['Square = odd harmonics', 'High-pass a square', '4 bits']

  it.each(FOLDING)('says content IS folding in "%s"', (name) => {
    const s = of(name)
    expect(s.aliased, `ratio ${s.ratio.toExponential(2)}`).toBe(true)
  })

  it('keeps real headroom on both sides of the threshold', () => {
    // A threshold wedged between two neighbours a few percent apart is a
    // coincidence, not a calibration. Measured: the loudest clean case is
    // 1.3e-3 and the quietest folding one 3.8e-2 — a factor of 29 of margin.
    const loudestClean = Math.max(...CLEAN.map((n) => of(n).ratio))
    const quietestFold = Math.min(...FOLDING.map((n) => of(n).ratio))
    expect(loudestClean).toBeLessThan(ALIAS_RATIO / 4)
    expect(quietestFold).toBeGreaterThan(ALIAS_RATIO * 1.5)
  })
})

describe('a tone exactly on Nyquist is its own case, not a fold', () => {
  it('reads at-Nyquist and NOT aliased', () => {
    const s = of('Exactly at Nyquist')
    // Nothing has come down from above: the tone is at the boundary itself.
    expect(s.aliased, `ratio ${s.ratio.toExponential(2)}`).toBe(false)
    expect(s.atNyquist).toBe(true)
    // This is the bug the split fixed. Folding the boundary bin into the
    // "above" tally scored this preset off the scale and made the scope
    // assert aliasing over the one setup in the library where none occurs.
    expect(s.atShare).toBeGreaterThan(0.9)
  })

  it('holds at every phase, including the one where the tone vanishes', () => {
    // At 0 degrees the samples land on the zero crossings and the signal
    // reads nothing at all. The classification must not depend on that.
    for (const phase of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
      const p = byName('Exactly at Nyquist')
      const s = samplingState(
        ctx(p, { sources: [{ ...p.sources[0], phase }] }),
      )
      expect(s.aliased, `phase ${phase}`).toBe(false)
    }
  })

  it('is not claimed for any other preset', () => {
    for (const p of PRESETS) {
      if (p.name === 'Exactly at Nyquist') continue
      const s = samplingState(ctx(p.patch))
      expect(s.atShare, p.name).toBeLessThan(AT_NYQUIST_SHARE / 4)
    }
  })
})

describe('it tracks the controls the reader is told to turn', () => {
  it('turns on the moment a band-limited square outgrows the rate', () => {
    // f0 = 281.25 at 8 kHz: the 15th harmonic (4219 Hz) is the first past
    // the 4 kHz Nyquist, so N = 8 is the first count that folds. This is the
    // case the old 1e-1 threshold missed — it reads 6.1e-2.
    for (const N of [1, 3, 5, 6, 7]) expect(sq(N).aliased, `N=${N}`).toBe(false)
    for (const N of [8, 9, 12, 20]) expect(sq(N).aliased, `N=${N}`).toBe(true)
    // ...and the naive square, which always folds.
    expect(sq(0).aliased).toBe(true)
  })

  it('turns off again when the rate is raised to meet the signal', () => {
    // N = 8 tops out at 4218.75 Hz, so the theorem asks for more than
    // 8437.5 Hz. Either side of that, with a bin of clearance: a harmonic
    // landing WITHIN a bin of Nyquist is genuinely ambiguous rather than
    // folded, and the detector classifies it that way on purpose.
    for (const fs of [8000, 8200, 8400]) expect(sq(8, { sampleRate: fs }).aliased, fs).toBe(true)
    for (const fs of [8500, 12000, 48000]) {
      expect(sq(8, { sampleRate: fs }).aliased, fs).toBe(false)
    }
  })

  it('turns on as a plain tone is dragged past Nyquist, and off again below', () => {
    const tone = (freq) =>
      samplingState({
        sources: [{ id: 1, type: 'sine', freq, amp: 1, phase: 0.7, enabled: true }],
        blocks: [],
        sampleRate: 8000,
        fftSize: 2048,
        window: 'hann',
      })
    for (const f of [1000, 3000, 3800, 3950]) expect(tone(f).aliased, `${f} Hz`).toBe(false)
    for (const f of [4100, 4500, 6000, 7500]) expect(tone(f).aliased, `${f} Hz`).toBe(true)
  })

  it('is not fooled by amplitude, which changes nothing about what fits', () => {
    // The ratio is scale-free by construction; a quiet aliased signal is
    // still aliased. (Absolute thresholds meeting scale-free data is the
    // failure mode this suite keeps finding.)
    const s = sq(12)
    expect(s.aliased).toBe(true)
    for (const amp of [0.01, 0.1, 1, 8]) {
      const q = samplingState({
        sources: [{ id: 1, type: 'square', freq: 281.25, amp, phase: 0, enabled: true, partials: 12 }],
        blocks: [],
        sampleRate: 8000,
        fftSize: 2048,
        window: 'hann',
      })
      expect(q.aliased, `amp ${amp}`).toBe(true)
      expect(q.ratio).toBeCloseTo(s.ratio, 6)
    }
  })
})

describe('it declines to judge what it cannot measure', () => {
  it('stays silent for noise and impulses', () => {
    for (const type of ['noise', 'impulse']) {
      const s = samplingState({
        sources: [{ id: 1, type, freq: 250, amp: 1, phase: 0, enabled: true }],
        blocks: [],
        sampleRate: 8000,
        fftSize: 2048,
        window: 'hann',
      })
      expect(s.aliased, type).toBe(false)
      expect(s.atNyquist, type).toBe(false)
    }
  })

  it('stays silent when nothing is enabled', () => {
    const s = samplingState({
      sources: [{ id: 1, type: 'square', freq: 3000, amp: 1, phase: 0, enabled: false }],
      blocks: [],
      sampleRate: 8000,
      fftSize: 2048,
      window: 'hann',
    })
    expect(s.aliased).toBe(false)
  })

  it('returns finite numbers for a silent chain rather than NaN', () => {
    const s = samplingState({
      sources: [{ id: 1, type: 'sine', freq: 250, amp: 0, phase: 0, enabled: true }],
      blocks: [],
      sampleRate: 8000,
      fftSize: 2048,
      window: 'hann',
    })
    expect(Number.isFinite(s.ratio)).toBe(true)
    expect(Number.isFinite(s.atShare)).toBe(true)
    expect(s.aliased).toBe(false)
  })
})
