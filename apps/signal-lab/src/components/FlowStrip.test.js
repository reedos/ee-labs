import { describe, it, expect } from 'vitest'
import { isClipped } from './FlowStrip.jsx'

// Playbook #7: the signal path is a picture, and the output sits at the end.
//
// The strip is a horizontal scroller inside a 44 px bar. Measured at 1280x900
// across all thirty-five lessons, it overflows on twenty of them — by 41 px on
// "Clipping makes harmonics" and by 193 px on "AM: the carrier returns". The
// node it cuts is always the last one, the output, and it cut it mid-word:
// "scope + FFT" read "scop" against a hard edge, which looks like a rendering
// fault rather than like more chain to the right.
//
// The fade is applied only when the content really is wider than the box, so
// the fifteen lessons whose chain fits keep their output node crisp.

describe('isClipped', () => {
  it('is false when the whole chain fits', () => {
    expect(isClipped(600, 600)).toBe(false)
    expect(isClipped(420, 600)).toBe(false)
  })

  it('is true at the overflows measured at 1280x900', () => {
    const box = 470
    for (const overflow of [41, 43, 76, 94, 161, 193]) {
      expect(isClipped(box + overflow, box)).toBe(true)
    }
  })

  it('ignores a pixel of sub-pixel rounding', () => {
    // A flex row of fractional widths reports a scrollWidth one larger than
    // its client width all the time. Fading every strip would defeat the point.
    expect(isClipped(601, 600)).toBe(false)
    expect(isClipped(602, 600)).toBe(true)
  })
})
