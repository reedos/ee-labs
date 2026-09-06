import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { advancePlayback, PLAYBACK_SPEEDS } from './usePlayback.js'
import PlaybackControls from './PlaybackControls.jsx'

describe('shared transport', () => {
  it('advances by elapsed time, independent of display refresh rate', () => {
    for (const frames of [30, 60, 144]) {
      let p = 0
      for (let i = 0; i < frames; i++) p = advancePlayback(p, 1000 / frames, 12000, 1)
      expect(p).toBeCloseTo(1 / 12, 12)
    }
  })
  it('honors every speed, clamps the end, and ignores negative elapsed time', () => {
    for (const speed of PLAYBACK_SPEEDS) expect(advancePlayback(0, 1000, 12000, speed)).toBeCloseTo(speed / 12)
    expect(advancePlayback(0.9, 10000, 12000, 4)).toBe(1)
    expect(advancePlayback(0.2, -100, 12000, 1)).toBe(0.2)
  })
  it('names the buttons and scrubber in both playing states', () => {
    for (const playing of [false, true]) {
      const html = renderToStaticMarkup(<PlaybackControls playback={{ playing, speed: 1, position: 0.25 }} />)
      expect(html).toContain(`aria-label="${playing ? 'Pause' : 'Play'}"`)
      expect(html).toContain('aria-label="Rewind"')
      expect(html).toContain('aria-label="Time cursor"')
      expect(html).toContain('value="250"')
      expect(html).toContain('aria-label="Playback speed"')
    }
  })
})
