import { describe, it, expect } from 'vitest'
import { eng, engEcho, fmt, parseEng } from './units.js'

describe('fmt', () => {
  it('picks the prefix that leaves one to three digits before the point', () => {
    expect(fmt(1.792e12, 'Hz')).toBe('1.792 THz')
    expect(fmt(4.464e-12, 's')).toBe('4.464 ps')
    expect(fmt(1000, 'Ω', 3)).toBe('1 kΩ')
    expect(fmt(0.0055, 'A', 3)).toBe('5.5 mA')
    expect(fmt(-12.5, 'V', 3)).toBe('-12.5 V')
    expect(fmt(0, 'V')).toBe('0 V')
    expect(fmt(NaN, 'V')).toBe('— V')
  })

  it('rounds before choosing the prefix, so a hair under a boundary is not shown in the smaller unit', () => {
    // A solver hands back 0.99999999 for what is 1 V; "1000 mV" is the same
    // number printed to look like a different one.
    expect(fmt(0.99999999, 'V', 3)).toBe('1 V')
    expect(fmt(999.9999, 'Ω', 3)).toBe('1 kΩ')
    expect(fmt(-0.99999999, 'A', 3)).toBe('-1 A')
    // But a value that genuinely prints below the boundary keeps the smaller unit.
    expect(fmt(0.9994, 'V', 3)).toBe('999 mV')
    expect(fmt(999.4, 'Ω', 3)).toBe('999 Ω')
  })

  it('reports the multiplier a field must use to read back what it shows', () => {
    expect(eng(2.24e11)).toEqual({ num: '224', prefix: 'G', mult: 1e9 })
    expect(eng(0.99999999, 3).mult).toBe(1)
  })
})

describe('parseEng', () => {
  it('round-trips what fmt prints', () => {
    for (const v of [1.792e12, 4.464e-12, 1000, 0.0055, -12.5, 0.99999999]) {
      const shown = fmt(v, 'V', 4)
      const back = parseEng(shown, 'V')
      expect(back.hadPrefix).toBe(!/\d V$/.test(shown))
      expect(back.value / Number(v.toPrecision(4))).toBeCloseTo(1, 12)
    }
  })

  it('accepts u for micro and refuses nonsense', () => {
    expect(parseEng('4.7u')).toEqual({ value: expect.closeTo(4.7e-6, 15), ratio: null, hadPrefix: true })
    expect(parseEng('abc')).toBeNull()
    expect(parseEng('')).toBeNull()
  })
})

describe('engEcho', () => {
  // Reed's reproduction: a proportional gain field sitting at 0.99 displays
  // "990" with a milli prefix. Typing a bare "1.0001" — meaning a gain of
  // about one — is read in that displayed prefix and commits 1.0001 MILLI,
  // 0.0010001, a thousand times too small, with nothing on screen saying so
  // before Enter. This is the case the echo exists to surface.
  it('warns a bare number typed under a displayed milli prefix', () => {
    const echo = engEcho('1.0001', 0.99, '')
    expect(echo.full).toBeCloseTo(0.0010001, 12)
    expect(echo.text).toBe('1.0001 m becomes 0.0010001')
  })

  it('warns a bare number typed under a displayed kilo prefix', () => {
    // 2200 Hz shows as "2.2" next to "kHz". Typing a bare "3" is read as 3 kHz.
    const echo = engEcho('3', 2200, 'Hz')
    expect(echo.full).toBe(3000)
    expect(echo.text).toBe('3 kHz becomes 3000 Hz')
  })

  it('warns a bare number typed under a displayed giga prefix', () => {
    // 2.24e11 Bd shows as "224" next to "GBd". Typing a bare "112" is read
    // as 112 GBd — the case the rule exists for in the first place, and
    // still worth confirming out loud rather than only when it goes wrong.
    const echo = engEcho('112', 2.24e11, 'Bd')
    expect(echo.full).toBe(1.12e11)
    expect(echo.text).toBe('112 GBd becomes 112000000000 Bd')
  })

  it('says nothing for an explicitly typed prefix, either direction', () => {
    // Typed prefix overrides the displayed one — parseEng already read it
    // unambiguously, so there's nothing left to warn about.
    expect(engEcho('5m', 0.99, '')).toBeNull() // milli typed under a milli display
    expect(engEcho('5G', 0.99, '')).toBeNull() // giga typed under a milli display
    expect(engEcho('1.0001M', 0.99, '')).toBeNull() // mega typed under a milli display
  })

  it('says nothing for a ratio entry', () => {
    expect(engEcho('*2', 0.99, '')).toBeNull()
    expect(engEcho('/2', 2200, 'Hz')).toBeNull()
  })

  it('says nothing when the field has no active prefix to misread a bare number through', () => {
    // eng(5).mult is 1 — a bare "6" typed here means exactly 6, no rescale.
    expect(eng(5).mult).toBe(1)
    expect(engEcho('6', 5, '')).toBeNull()
  })

  it('says nothing for unparseable text', () => {
    expect(engEcho('abc', 0.99, '')).toBeNull()
    expect(engEcho('', 0.99, '')).toBeNull()
  })

  // The interrupt this task also had to answer: does re-committing a field
  // that hasn't been touched rescale it again? NumField's engMode input,
  // once committed, renders ONLY the bare mantissa (eng(value).num) — the
  // prefix lives in a separate, non-editable span next to it — so blurring
  // an untouched field re-parses that bare mantissa through the exact same
  // "no explicit prefix -> multiply by the displayed prefix" rule. This
  // proves that round trip lands back on the same value instead of
  // compounding: the mantissa was built by dividing by the prefix's
  // multiplier, so parsing it bare and multiplying back by that same
  // multiplier must return the original value, every time, no matter how
  // many times a plain blur re-runs it.
  it('re-parsing a field\'s own rendered mantissa is idempotent, not a repeated rescale', () => {
    for (const value of [0.99, 5, 2200, 2.24e11, 4.464e-12]) {
      const parts = eng(value)
      const shown = parts.num // exactly what NumField's engMode input renders
      const r = parseEng(shown, '')
      expect(r.hadPrefix).toBe(false) // the bare-mantissa path this is testing
      const committed = r.value * parts.mult
      // Compare at the same 4-sig-fig precision NumField's log-scale snap()
      // already applies on commit, so this is the value a second, unedited
      // blur would actually leave behind.
      expect(Number(committed.toPrecision(4))).toBeCloseTo(Number(value.toPrecision(4)), 6)
      // And running it a SECOND time (simulating a second blur on the
      // now-committed value) must be just as stationary.
      const parts2 = eng(committed)
      const r2 = parseEng(parts2.num, '')
      const committedAgain = r2.value * parts2.mult
      expect(Number(committedAgain.toPrecision(4))).toBe(Number(committed.toPrecision(4)))
    }
  })
})
