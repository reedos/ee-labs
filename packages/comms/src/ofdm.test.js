import { describe, it, expect } from 'vitest'
import { rng } from '@ee-labs/random'
import {
  ofdmModulate,
  ofdmDemodulate,
  ofdmRoundTrip,
  subcarrierResponse,
  papr,
  paprCcdf,
  paprLevel,
  ofdmRate,
  subcarrierCorrelation,
} from './ofdm.js'
import { mapBits, randomBits } from './mappers.js'
import { realTaps } from './channel.js'

const symbols = (n, seed = 1) => mapBits('qam16', randomBits(4 * n, rng(seed)))

describe('the transform pair', () => {
  it('recovers every subcarrier through no channel at all, to floating point', () => {
    const s = symbols(64)
    const tx = ofdmModulate(s, { n: 64, cp: 16 })
    const got = ofdmDemodulate(tx, { n: 64, cp: 16 })
    for (let i = 0; i < s.length; i++) expect(got[i]).toBeCloseTo(s[i], 12)
  })

  it('prepends the last samples of the body, which is what makes it cyclic', () => {
    const s = symbols(16)
    const tx = ofdmModulate(s, { n: 16, cp: 4 })
    for (let i = 0; i < 4; i++) {
      expect(tx[2 * i]).toBeCloseTo(tx[2 * (4 + 16 - 4 + i)], 15)
      expect(tx[2 * i + 1]).toBeCloseTo(tx[2 * (4 + 16 - 4 + i) + 1], 15)
    }
  })

  it('refuses a symbol count that is not the transform length', () => {
    expect(() => ofdmModulate(symbols(32), { n: 64, cp: 16 })).toThrow(/expected 64/)
  })
})

describe('the cyclic prefix, and where it stops working', () => {
  const n = 16
  const cp = 4
  const s = symbols(n, 3)

  it('recovers exactly through a channel of one tap', () => {
    const r = ofdmRoundTrip({ syms: s, taps: realTaps([1]), n, cp })
    expect(r.worst).toBeLessThan(1e-13)
  })

  it('recovers exactly through a channel of four taps', () => {
    const r = ofdmRoundTrip({ syms: s, taps: realTaps([1, 0.4, -0.2, 0.1]), n, cp })
    expect(r.worst).toBeLessThan(1e-13)
  })

  it('recovers exactly through a channel of five taps, which is the prefix plus one', () => {
    const r = ofdmRoundTrip({ syms: s, taps: realTaps([1, 0.4, -0.2, 0.1, 0.3]), n, cp })
    expect(r.worst).toBeLessThan(1e-13)
  })

  it('fails measurably at six taps, which is one longer than the prefix covers', () => {
    const r = ofdmRoundTrip({ syms: s, taps: realTaps([1, 0.4, -0.2, 0.1, 0.3, 0.25]), n, cp })
    expect(r.worst).toBeGreaterThan(1e-3)
  })

  it('holds at the lab defaults, where the prefix covers seventeen taps', () => {
    const big = symbols(64, 5)
    const taps = realTaps(Array.from({ length: 17 }, (_, i) => (i === 0 ? 1 : 0.3 / (i + 1))))
    const r = ofdmRoundTrip({ syms: big, taps, n: 64, cp: 16 })
    expect(r.worst).toBeLessThan(1e-12)
  })

  it('reads the channel at each subcarrier as the transform of its taps', () => {
    const h = subcarrierResponse(realTaps([1, 0, 0, 0, 0.5]), 64)
    // Four samples of delay in a 64-point transform puts a notch every eight
    // subcarriers, at the ones where the echo arrives half a turn late.
    const mag = (k) => Math.hypot(h[2 * k], h[2 * k + 1])
    expect(mag(0)).toBeCloseTo(1.5, 12)
    expect(mag(8)).toBeCloseTo(0.5, 12)
    expect(mag(16)).toBeCloseTo(1.5, 12)
  })
})

describe('the peak-to-average power ratio', () => {
  it('is at most the number of subcarriers, which is 18.062 dB at 64', () => {
    const worst = 10 * Math.log10(64)
    expect(worst).toBeCloseTo(18.062, 3)
    for (let seed = 1; seed <= 8; seed++) {
      expect(papr(ofdmModulate(symbols(64, seed), { n: 64, cp: 16 }))).toBeLessThanOrEqual(worst)
    }
  })

  it('reaches its worst case when every subcarrier lines up', () => {
    // All ones in gives one impulse out, which is the only way to reach N.
    const ones = new Float64Array(2 * 64)
    for (let i = 0; i < 64; i++) ones[2 * i] = 1
    // The prefix is a copy of the tail, so the peak is measured on the body.
    const body = ofdmModulate(ones, { n: 64, cp: 0 })
    expect(papr(body)).toBeCloseTo(10 * Math.log10(64), 9)
  })

  it('follows its own distribution, 2.9014e-3 at 10 dB and 8.3767e-6 at 12 dB', () => {
    expect(paprCcdf(10, 64)).toBeCloseTo(2.9014e-3, 6)
    expect(paprCcdf(12, 64)).toBeCloseTo(8.3767e-6, 9)
  })

  it('names the level exceeded once in ten thousand symbols, at three sizes', () => {
    expect(paprLevel(1e-4, 64)).toBeCloseTo(11.261, 3)
    expect(paprLevel(1e-4, 256)).toBeCloseTo(11.69, 3)
    expect(paprLevel(1e-4, 1024)).toBeCloseTo(12.08, 3)
  })
})

describe('the grid, and what it costs', () => {
  const g = ofdmRate({ n: 64, cp: 16, used: 52, pilots: 4, bitsPerSymbol: 4, sampleRate: 8000 })

  it('gives the spacing, the two symbol lengths and the symbol rate', () => {
    expect(g.spacing).toBeCloseTo(125, 12)
    expect(g.usefulMs).toBeCloseTo(8, 12)
    expect(g.prefixMs).toBeCloseTo(2, 12)
    expect(g.symbolMs).toBeCloseTo(10, 12)
    expect(g.symbolRate).toBeCloseTo(100, 12)
  })

  it('occupies 6500 Hz and carries 19 200 bit a second uncoded', () => {
    expect(g.occupied).toBeCloseTo(6500, 12)
    expect(g.bitRate).toBeCloseTo(19200, 9)
  })

  it('charges 0.969 dB for the prefix and 0.348 dB for the pilots', () => {
    expect(g.prefixCostDb).toBeCloseTo(0.969, 3)
    expect(g.pilotCostDb).toBeCloseTo(0.348, 3)
    expect(g.prefixFraction).toBeCloseTo(0.2, 12)
  })

  it('halves the prefix cost when the symbol is doubled', () => {
    const longer = ofdmRate({ n: 128, cp: 16, used: 52, pilots: 4, bitsPerSymbol: 4 })
    expect(longer.prefixCostDb).toBeCloseTo(0.512, 3)
  })
})

describe('the subcarriers', () => {
  it('correlate to nothing at the spacing the transform sets', () => {
    expect(subcarrierCorrelation({ spacing: 125, usefulMs: 8 })).toBeLessThan(1e-15)
    expect(subcarrierCorrelation({ spacing: 250, usefulMs: 8 })).toBeLessThan(1e-15)
  })

  it('correlate measurably at a spacing that is not on the grid', () => {
    expect(subcarrierCorrelation({ spacing: 120, usefulMs: 8 })).toBeGreaterThan(0.01)
  })
})
