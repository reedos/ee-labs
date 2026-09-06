import { describe, it, expect } from 'vitest'
import { spectrum } from '@ee-labs/dsp'
import {
  besselJ,
  firstZeroJ0,
  fmLines,
  carsonFraction,
  carsonBandwidth,
  amSidebandDb,
  amSidebandPower,
  meritAm,
  meritFm,
  meritDb,
  amWaveform,
  dsbWaveform,
  fmWaveform,
  envelopeDetect,
  coherentDetect,
  thd,
} from './analog.js'

describe('the Bessel series', () => {
  it('gives the published values of J_n(2)', () => {
    expect(besselJ(0, 2)).toBeCloseTo(0.2238907791, 9)
    expect(besselJ(1, 2)).toBeCloseTo(0.5767248078, 9)
    expect(besselJ(2, 2)).toBeCloseTo(0.3528340286, 9)
    expect(besselJ(3, 2)).toBeCloseTo(0.1289432495, 9)
    expect(besselJ(4, 2)).toBeCloseTo(0.033995719, 8)
  })

  it('gives the published values of J_n(1) and J_n(5)', () => {
    expect(besselJ(0, 1)).toBeCloseTo(0.7651976866, 9)
    expect(besselJ(1, 1)).toBeCloseTo(0.4400505857, 9)
    expect(besselJ(0, 5)).toBeCloseTo(-0.1775967713, 9)
    expect(besselJ(2, 5)).toBeCloseTo(0.0465651163, 9)
  })

  it('conserves the power the modulation started with', () => {
    // Sum of J_n squared over all n is one, for every index.
    for (const beta of [0.5, 2, 5]) {
      let s = besselJ(0, beta) ** 2
      for (let n = 1; n <= 40; n++) s += 2 * besselJ(n, beta) ** 2
      expect(s, `beta ${beta}`).toBeCloseTo(1, 12)
    }
  })

  it('satisfies the recurrence the functions obey', () => {
    for (const x of [1, 2, 4.5]) {
      for (let n = 1; n <= 5; n++) {
        expect(besselJ(n - 1, x) + besselJ(n + 1, x), `${n} at ${x}`).toBeCloseTo(
          ((2 * n) / x) * besselJ(n, x),
          10,
        )
      }
    }
  })

  it('is odd or even in its order, as the definition requires', () => {
    expect(besselJ(-1, 2)).toBeCloseTo(-besselJ(1, 2), 12)
    expect(besselJ(-2, 2)).toBeCloseTo(besselJ(2, 2), 12)
  })
})

describe('FM', () => {
  it('puts the carrier null at 2.404826, the first zero of J0', () => {
    expect(firstZeroJ0()).toBeCloseTo(2.404826, 6)
    expect(besselJ(0, firstZeroJ0())).toBeCloseTo(0, 12)
  })

  it('needs a deviation of 601.2 Hz on a 250 Hz message to reach that null', () => {
    expect(firstZeroJ0() * 250).toBeCloseTo(601.2, 1)
  })

  it('lists the lines an index of two produces', () => {
    const lines = fmLines({ beta: 2, order: 4 })
    expect(Array.from(lines).map((v) => Number(v.toFixed(4)))).toEqual([
      0.2239, 0.5767, 0.3528, 0.1289, 0.034,
    ])
  })

  it("holds 99.759 % of the power inside Carson's bandwidth at an index of two", () => {
    expect(carsonFraction({ beta: 2 }) * 100).toBeCloseTo(99.759, 3)
  })

  it('leaves the rest outside, so the rule is measured rather than asserted', () => {
    expect(carsonFraction({ beta: 2 })).toBeLessThan(1)
  })

  it('gives a bandwidth of 1500 Hz at a deviation of 500 on a 250 Hz message', () => {
    expect(carsonBandwidth({ deviation: 500, message: 250 })).toBe(1500)
  })

  it('draws the line amplitudes the series predicts, in the lab spectrum', () => {
    const n = 8192
    const sampleRate = 8000
    const buf = fmWaveform({ n, sampleRate, carrier: 1000, message: 250, deviation: 500 })
    const s = spectrum(buf, sampleRate, 'none')
    const bin = (f) => {
      const k = Math.round((f * n) / sampleRate)
      return s.amps[k]
    }
    const carrier = bin(1000)
    for (const k of [1, 2, 3]) {
      const want = Math.abs(besselJ(k, 2) / besselJ(0, 2))
      const got = bin(1000 + k * 250) / carrier
      expect(got, `line ${k}`).toBeCloseTo(want, 2)
    }
  })
})

describe('AM', () => {
  it('puts each sideband m over two below the carrier', () => {
    expect(amSidebandDb(0.25)).toBeCloseTo(-18.062, 3)
    expect(amSidebandDb(0.5)).toBeCloseTo(-12.041, 3)
    expect(amSidebandDb(1)).toBeCloseTo(-6.021, 3)
  })

  it('leaves most of the power in a carrier that carries no information', () => {
    expect(amSidebandPower(0.25) * 100).toBeCloseTo(3.03, 2)
    expect(amSidebandPower(0.5) * 100).toBeCloseTo(11.111, 3)
    expect(amSidebandPower(1) * 100).toBeCloseTo(33.333, 3)
  })

  it('draws the sidebands where the spectrum says, at 750 and 1250 Hz', () => {
    const n = 8192
    const sampleRate = 8000
    const buf = amWaveform({ n, sampleRate, carrier: 1000, message: 250, m: 0.5 })
    const s = spectrum(buf, sampleRate, 'none')
    const bin = (f) => s.amps[Math.round((f * n) / sampleRate)]
    const ratio = bin(750) / bin(1000)
    expect(20 * Math.log10(ratio)).toBeCloseTo(amSidebandDb(0.5), 2)
    expect(bin(1250) / bin(1000)).toBeCloseTo(ratio, 6)
  })

  it('loses the carrier line when the offset is removed, which is the ring modulator', () => {
    const n = 8192
    const sampleRate = 8000
    const s = spectrum(dsbWaveform({ n, sampleRate, carrier: 1000, message: 250 }), sampleRate, 'none')
    const bin = (f) => s.amps[Math.round((f * n) / sampleRate)]
    expect(bin(1000) / bin(750)).toBeLessThan(1e-9)
  })
})

describe('the detectors', () => {
  // A warm-up the low-pass filter forgets, then a power-of-two frame the
  // transform can take.
  const warm = 2048
  const frame = 8192
  const n = warm + frame
  const sampleRate = 8000
  const settled = (buf) => buf.subarray(warm, warm + frame)

  it('recover the message with an envelope detector while the index is under one', () => {
    const buf = amWaveform({ n, sampleRate, carrier: 1000, message: 250, m: 0.5 })
    const out = settled(envelopeDetect(buf, { sampleRate, cutoff: 500 }))
    const s = spectrum(out, sampleRate, 'hann')
    const bin = (f) => s.amps[Math.round((f * frame) / sampleRate)]
    expect(bin(250)).toBeGreaterThan(10 * bin(500))
  })

  it('add a second harmonic when the envelope folds through zero', () => {
    const under = amWaveform({ n, sampleRate, carrier: 1000, message: 250, m: 0.5 })
    const over = amWaveform({ n, sampleRate, carrier: 1000, message: 250, m: 1.5 })
    const measure = (buf) => {
      const out = settled(envelopeDetect(buf, { sampleRate, cutoff: 800 }))
      const s = spectrum(out, sampleRate, 'hann')
      return thd(s.amps, s.freqs, 250, 4)
    }
    expect(measure(over)).toBeGreaterThan(measure(under))
  })

  it('lose the coherent detector to a local phase error, by its cosine', () => {
    const buf = dsbWaveform({ n, sampleRate, carrier: 1000, message: 250 })
    const level = (deg) => {
      const out = settled(coherentDetect(buf, { sampleRate, carrier: 1000, cutoff: 500, phaseDeg: deg }))
      const s = spectrum(out, sampleRate, 'hann')
      return s.amps[Math.round((250 * frame) / sampleRate)]
    }
    expect(level(30) / level(0)).toBeCloseTo(Math.cos(Math.PI / 6), 2)
    expect(level(30) / level(0)).toBeCloseTo(0.866, 2)
  })
})

describe('the figures of merit', () => {
  it('give AM its sideband fraction and FM one and a half times the index squared', () => {
    expect(meritAm(0.5)).toBeCloseTo(0.1111, 4)
    expect(meritAm(1)).toBeCloseTo(0.3333, 4)
    expect(meritFm(2)).toBeCloseTo(6, 12)
  })

  it('reads them in decibels as the plan quotes', () => {
    expect(meritDb(meritAm(0.5))).toBeCloseTo(-9.542, 3)
    expect(meritDb(meritAm(1))).toBeCloseTo(-4.771, 3)
    expect(meritDb(meritFm(2))).toBeCloseTo(7.782, 3)
  })

  it('buys the FM figure with three times the bandwidth', () => {
    const am = 2 * 250
    const fm = carsonBandwidth({ deviation: 500, message: 250 })
    expect(fm / am).toBeCloseTo(3, 12)
  })
})
