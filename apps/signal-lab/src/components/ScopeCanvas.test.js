import { describe, it, expect } from 'vitest'
import {
  captionLines,
  wrapLines,
  CAPTION_RECONSTRUCTION,
  CAPTION_ALIASED,
  CAPTION_AT_NYQUIST,
} from './ScopeCanvas.jsx'
import { samplingState } from '../sampling.js'
import { PRESETS } from './../presets.js'

// The scope's captions are claims, and each is true under its own conditions.
// The reconstruction line is about the PICTURE — dots on screen with a curve
// through them — so it belongs to the zoom level. The alias and at-Nyquist
// lines are about the SIGNAL and the RATE, and a reader who zooms out has not
// changed either one.
//
// They were all gated on the dots being drawn, which silenced the alias
// warning on the very preset it was written for. That is what these pin.

const NONE = { aliased: false, atNyquist: false }

describe('which captions the scope owes the reader', () => {
  it('says nothing when there is nothing to say', () => {
    expect(captionLines({ reconstructed: false, sampling: NONE })).toEqual([])
  })

  it('explains the drawing only when it is actually drawing that way', () => {
    expect(captionLines({ reconstructed: true, sampling: NONE })).toEqual([CAPTION_RECONSTRUCTION])
    expect(captionLines({ reconstructed: false, sampling: NONE })).not.toContain(
      CAPTION_RECONSTRUCTION,
    )
  })

  it('warns about aliasing at a zoom level too dense to draw dots', () => {
    // THE REGRESSION. Aliasing is a property of the signal and the rate; it
    // does not stop being true because the samples got too close together to
    // mark individually.
    const lines = captionLines({ reconstructed: false, sampling: { aliased: true } })
    expect(lines).toContain(CAPTION_ALIASED)
    expect(lines).not.toContain(CAPTION_RECONSTRUCTION)
  })

  it('warns about the Nyquist boundary at that same zoom level', () => {
    const lines = captionLines({ reconstructed: false, sampling: { atNyquist: true } })
    expect(lines).toContain(CAPTION_AT_NYQUIST)
  })

  it('keeps the drawing line first when both apply', () => {
    // The reader needs to know what they are looking at before being told
    // what is wrong with it.
    const lines = captionLines({
      reconstructed: true,
      sampling: { aliased: true, atNyquist: true },
    })
    expect(lines).toEqual([CAPTION_RECONSTRUCTION, CAPTION_ALIASED, CAPTION_AT_NYQUIST])
  })

  it('survives a missing sampling report rather than throwing', () => {
    // ScopeCanvas has a default, but a caller that passes undefined explicitly
    // would blow past it, and a crash in the draw loop takes the whole view.
    expect(captionLines({ reconstructed: true, sampling: undefined })).toEqual([
      CAPTION_RECONSTRUCTION,
    ])
  })
})

describe('the presets that should carry a warning do carry one', () => {
  const at = (name) => {
    const p = PRESETS.find((x) => x.name === name)
    if (!p) throw new Error(`no preset "${name}"`)
    const s = samplingState({
      sources: p.patch.sources,
      blocks: p.patch.blocks || [],
      sampleRate: p.patch.sampleRate || 8000,
      fftSize: p.patch.fftSize || 2048,
      window: p.patch.window || 'hann',
    })
    // At whatever zoom hides the individual samples — which is where this
    // preset actually sits since its rate went to 16 kHz.
    return captionLines({ reconstructed: false, sampling: s })
  }

  it('warns on "High-pass a square", the case that went silent', () => {
    expect(at('High-pass a square')).toContain(CAPTION_ALIASED)
  })

  it('warns on the other two presets that genuinely fold', () => {
    expect(at('Square = odd harmonics')).toContain(CAPTION_ALIASED)
    expect(at('4 bits')).toContain(CAPTION_ALIASED)
  })

  it('stays quiet on the presets whose lesson is that nothing is lost', () => {
    for (const name of ['Single tone', 'Coarse, not undersampled', 'Turn the rate down', 'A square that fits']) {
      expect(at(name), name).toEqual([])
    }
  })

  it('does not call the Nyquist preset aliased, at any zoom', () => {
    const lines = at('Exactly at Nyquist')
    expect(lines).toContain(CAPTION_AT_NYQUIST)
    expect(lines).not.toContain(CAPTION_ALIASED)
  })
})

describe('fitting the caption to the pane it is given', () => {
  // A stand-in for the canvas measurer: six pixels a character is close
  // enough to the real proportional font to exercise the wrap, and it makes
  // the arithmetic checkable by hand.
  const ctx = { measureText: (t) => ({ width: t.length * 6 }) }

  it('leaves a line that fits alone', () => {
    expect(wrapLines(ctx, ['one two three'], 1000)).toEqual(['one two three'])
  })

  it('folds a line that does not, on word boundaries', () => {
    // 48px holds 8 characters, so "aaa bbb" (7) fits and adding " ccc" (11)
    // does not.
    expect(wrapLines(ctx, ['aaa bbb ccc ddd'], 48)).toEqual(['aaa bbb', 'ccc ddd'])
    // 24px holds 4, so every word stands alone.
    const out = wrapLines(ctx, ['aaa bbb ccc ddd'], 24)
    expect(out).toEqual(['aaa', 'bbb', 'ccc', 'ddd'])
    for (const l of out) expect(l).not.toMatch(/^ | $/)
  })

  it('keeps every word, in order', () => {
    const words = CAPTION_ALIASED.split(' ')
    expect(wrapLines(ctx, [CAPTION_ALIASED], 300).join(' ').split(' ')).toEqual(words)
  })

  it('wraps each caption independently, so they never run together', () => {
    const out = wrapLines(ctx, [CAPTION_RECONSTRUCTION, CAPTION_ALIASED], 400)
    // The second caption must start its own line rather than continuing the
    // tail of the first — the band's height is counted in these lines.
    expect(out.some((l) => l.startsWith('the ripple riding'))).toBe(true)
  })

  it('emits a single over-long word rather than dropping or breaking it', () => {
    expect(wrapLines(ctx, ['short enormouslylongword'], 30)).toEqual([
      'short',
      'enormouslylongword',
    ])
  })

  it('says nothing when given nothing', () => {
    expect(wrapLines(ctx, [], 500)).toEqual([])
  })

  it('produces more lines as the pane narrows, never fewer', () => {
    const all = [CAPTION_RECONSTRUCTION, CAPTION_ALIASED, CAPTION_AT_NYQUIST]
    const counts = [1600, 1200, 800, 500, 300].map((w) => wrapLines(ctx, all, w).length)
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i], `width step ${i}`).toBeGreaterThanOrEqual(counts[i - 1])
    }
  })
})
