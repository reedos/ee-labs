import { describe, it, expect } from 'vitest'
import { activeChip, applyChip, chipMatches } from './chips.js'
import { INITIAL } from './state.js'

// One-click settings: a partial patch merged into the live state, and the
// question of whether the state already IS that setting.

const st = {
  ...INITIAL,
  sources: [
    { id: 1, type: 'sine', freq: 250, amp: 1, phase: 0, enabled: true },
    { id: 2, type: 'sine', freq: 750, amp: 0.3, phase: 0, enabled: true },
  ],
  blocks: [
    { id: 1, type: 'lowpass', bypass: false, params: { freq: 800, q: 10, gainDb: 0, order: '2' } },
  ],
}

describe('applyChip', () => {
  it('replaces a top-level field', () => {
    const next = applyChip(st, { fftSize: 8192 })
    expect(next.fftSize).toBe(8192)
    expect(next.sources).toBe(st.sources) // untouched lists are the same object
  })

  it('merges into a source by index, leaving the rest of it alone', () => {
    const next = applyChip(st, { sources: [{ freq: 6000 }] })
    expect(next.sources[0]).toEqual({ ...st.sources[0], freq: 6000 })
    expect(next.sources[1]).toBe(st.sources[1])
  })

  it('skips an index with an empty entry and reaches the second', () => {
    const next = applyChip(st, { sources: [{}, { enabled: false }] })
    expect(next.sources[0]).toEqual(st.sources[0])
    expect(next.sources[1].enabled).toBe(false)
  })

  it('merges block params one level deep', () => {
    const next = applyChip(st, { blocks: [{ params: { q: 1 } }] })
    expect(next.blocks[0].params).toEqual({ freq: 800, q: 1, gainDb: 0, order: '2' })
    expect(next.blocks[0].type).toBe('lowpass')
  })

  it('appends a list entry past the end as given', () => {
    const extra = { id: 3, type: 'sine', freq: 1250, amp: 0.2, phase: 0, enabled: true }
    const next = applyChip(st, { sources: [{}, {}, extra] })
    expect(next.sources).toHaveLength(3)
    expect(next.sources[2]).toBe(extra)
  })

  it('does not mutate the state it was given', () => {
    const before = JSON.stringify(st)
    applyChip(st, { sources: [{ freq: 1 }], blocks: [{ params: { q: 2 }, bypass: true }], fftSize: 512 })
    expect(JSON.stringify(st)).toBe(before)
  })
})

describe('chipMatches / activeChip', () => {
  const chips = [
    { label: 'Q = 1', patch: { blocks: [{ params: { q: 1 } }] } },
    { label: 'Q = 10', patch: { blocks: [{ params: { q: 10 } }] } },
    { label: '90°', patch: { sources: [{ phase: Math.PI / 2 }] } },
  ]

  it('names the chip the state already satisfies', () => {
    expect(activeChip(st, chips)).toBe('Q = 10')
    expect(activeChip(applyChip(st, chips[0].patch), chips)).toBe('Q = 1')
    expect(activeChip(applyChip(st, { blocks: [{ params: { q: 3 } }] }), chips)).toBeNull()
  })

  it('compares numbers to rounding, not to the bit', () => {
    const near = applyChip(st, { sources: [{ phase: (90 * Math.PI) / 180 }] })
    expect(chipMatches(near, chips[2].patch)).toBe(true)
  })

  it('is false when the record the patch addresses is missing', () => {
    expect(chipMatches({ ...st, blocks: [] }, chips[0].patch)).toBe(false)
  })

  it('prefers the chip actually clicked when two partial patches both still match', () => {
    // "4 bits" preset's own shape: a bits chip and a dither chip, neither
    // checking the other's field. Click "12 bits" then "dither" and the
    // state satisfies BOTH — array order used to win, leaving "12 bits" lit
    // after "dither" was the one just pressed (Reed's review).
    const bitsChips = [
      { label: '4 bits', patch: { blocks: [{ params: { bits: 4 } }] } },
      { label: '12 bits', patch: { blocks: [{ params: { bits: 12 } }] } },
      { label: 'dither', patch: { blocks: [{ params: { dither: true } }] } },
    ]
    const base = { ...st, blocks: [{ id: 1, type: 'quantize', bypass: false, params: { bits: 4, dither: false } }] }
    let s = applyChip(base, bitsChips[1].patch) // "12 bits"
    s = applyChip(s, bitsChips[2].patch) // "dither"
    // Both "12 bits" and "dither" match the resulting state.
    expect(chipMatches(s, bitsChips[1].patch)).toBe(true)
    expect(chipMatches(s, bitsChips[2].patch)).toBe(true)
    // Without a click hint, array order still wins (documented, unavoidable
    // once two partial patches genuinely both match).
    expect(activeChip(s, bitsChips)).toBe('12 bits')
    // With the click hint, the chip actually pressed reads active.
    expect(activeChip(s, bitsChips, 'dither')).toBe('dither')
    // A stale hint that no longer matches (dither switched back off after
    // being clicked) falls back to the normal search instead of lying.
    const ditherOff = applyChip(s, { blocks: [{ params: { dither: false } }] })
    expect(chipMatches(ditherOff, bitsChips[2].patch)).toBe(false)
    expect(activeChip(ditherOff, bitsChips, 'dither')).toBe('12 bits')
  })

  it('reads a typed 0.707 as pressing a chip stored as Math.SQRT1_2 (relative tolerance 1e-3)', () => {
    // The chip stores the exact irrational; a student types the four-digit
    // approximation the note prints. At 1e-9 this never lit — see the "same"
    // comment in chips.js — because 0.707 and Math.SQRT1_2 differ in the
    // fifth decimal (about 1.5e-4 relative), comfortably inside 1e-3.
    const q707 = { patch: { blocks: [{ params: { q: Math.SQRT1_2 } }] } }
    const typed = applyChip(st, { blocks: [{ params: { q: 0.707 } }] })
    expect(chipMatches(typed, q707.patch)).toBe(true)
    // A value a full percent off is well past the tolerance and must not
    // read as pressed — the relative slack is generous, not infinite.
    const farOff = applyChip(st, { blocks: [{ params: { q: 0.7 } }] })
    expect(chipMatches(farOff, q707.patch)).toBe(false)
  })
})
