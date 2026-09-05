import { describe, it, expect } from 'vitest'
import {
  BOLTZMANN, ELEMENTARY_CHARGE, T_ROOM,
  thermalDensity, shotDensity, noiseBandwidthFirstOrder, capacitorNoise,
  whiteNoise, firstOrderMagnitude, firstOrderLowpass,
} from './noise.js'
import { averagedPeriodogram, whitePsd, integratePsd } from './psd.js'

// The numbers here are the Electronics Lab's Group O numbers. The two labs
// share this module so that they cannot disagree, and these are the values that
// plan quotes.

describe('the constants', () => {
  it('are the exact SI definitions, not rounded ones', () => {
    expect(BOLTZMANN).toBe(1.380649e-23)
    expect(ELEMENTARY_CHARGE).toBe(1.602176634e-19)
    expect(T_ROOM).toBe(300)
  })
})

describe('the noise densities', () => {
  it('a 1 kilohm resistor at 300 K is 4.07 nV per root hertz', () => {
    expect(thermalDensity(1000)).toBeCloseTo(4.0703547757e-9, 18)
    // And it rises as the square root of the resistance.
    expect(thermalDensity(4000) / thermalDensity(1000)).toBeCloseTo(2, 12)
  })

  it('a milliamp of shot noise is 17.9 pA per root hertz', () => {
    expect(shotDensity(1e-3)).toBeCloseTo(1.7900707439e-11, 20)
    expect(shotDensity(10e-6)).toBeCloseTo(1.7900707439e-12, 21)
  })

  it('and the sign of the current does not change the density', () => {
    expect(shotDensity(-1e-3)).toBe(shotDensity(1e-3))
  })
})

describe('the noise bandwidth of a first-order stage', () => {
  it('is pi over two times the corner, which is 57 % wider than the corner', () => {
    expect(noiseBandwidthFirstOrder(1000)).toBeCloseTo((Math.PI / 2) * 1000, 12)
    expect(noiseBandwidthFirstOrder(1) / 1).toBeCloseTo(1.5707963268, 9)
  })

  it('and it is the integral of the magnitude squared, which is where it comes from', () => {
    // Not a restatement: this integrates |H|^2 over frequency numerically and
    // compares against the closed form.
    const fc = 1000
    const n = 4000000
    const top = 4000 * fc
    const h = top / n
    let acc = 0
    for (let i = 0; i <= n; i++) {
      const f = i * h
      const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2
      acc += w * firstOrderMagnitude(f, fc) ** 2
    }
    const integral = (acc * h) / 3
    // The integral to infinity is (pi/2) fc. Stopping at 4000 fc leaves the
    // tail, which is fc * atan(1/4000) = fc/4000 to leading order.
    const tail = fc * Math.atan(fc / top)
    expect(integral + tail).toBeCloseTo(noiseBandwidthFirstOrder(fc), 3)
  })
})

describe('the kT over C result', () => {
  it('is 2.04 microvolts rms on a nanofarad at 300 K', () => {
    const n = capacitorNoise({ R: 1000, C: 1e-9 })
    expect(n.rms).toBeCloseTo(2.0351773878e-6, 15)
    expect(n.rms * 1e6).toBeCloseTo(2.035, 3)
  })

  it('does not depend on the resistance, over six decades of it', () => {
    const values = [10, 100, 1e3, 1e4, 1e5, 1e6, 1e7].map((R) => capacitorNoise({ R, C: 1e-9 }))
    for (const v of values) expect(v.rms).toBeCloseTo(values[0].rms, 18)
    // Because the density rises as sqrt(R) and the bandwidth falls as 1/R.
    expect(values[6].density / values[0].density).toBeCloseTo(Math.sqrt(1e6), 6)
    expect(values[6].enb / values[0].enb).toBeCloseTo(1e-6, 12)
  })

  it('reaches the same number through the bandwidth as through the closed form', () => {
    // Two routes: sqrt(kT/C), and the density times the root of the noise
    // bandwidth. They are equal identically, and this measures that they are.
    for (const R of [50, 1e3, 47e3, 1e6]) {
      for (const C of [1e-12, 1e-9, 1e-6]) {
        const n = capacitorNoise({ R, C })
        expect(n.viaBandwidth / n.ktc).toBeCloseTo(1, 12)
      }
    }
  })

  it('falls as the square root of the capacitance', () => {
    const small = capacitorNoise({ R: 1e3, C: 1e-12 })
    const big = capacitorNoise({ R: 1e3, C: 1e-9 })
    expect(small.rms / big.rms).toBeCloseTo(Math.sqrt(1000), 9)
    // A picofarad holds 64.4 microvolts, which is why a sampled circuit's
    // capacitor cannot be made arbitrarily small.
    expect(small.rms).toBeCloseTo(6.4358e-5, 8)
  })

  it('rises with temperature as the square root', () => {
    const cold = capacitorNoise({ R: 1e3, C: 1e-9, T: 75 })
    const hot = capacitorNoise({ R: 1e3, C: 1e-9, T: 300 })
    expect(hot.rms / cold.rms).toBeCloseTo(2, 12)
  })
})

describe('the seeded white generator', () => {
  it('states its density and its rms as two views of one number', () => {
    const a = whiteNoise({ n: 16, sampleRate: 48000, rms: 1e-3, seed: 1 })
    expect(a.density).toBeCloseTo(6.4549722437e-6, 15)
    const b = whiteNoise({ n: 16, sampleRate: 48000, density: a.density, seed: 1 })
    expect(b.rms).toBeCloseTo(1e-3, 12)
    // The same seed gives the same samples whichever way it was asked for.
    expect(Array.from(a.x)).toEqual(Array.from(b.x))
  })

  it('reads back the density it was given, through the averaged periodogram', () => {
    // The Electronics Lab's O1 in one line: 1 mV rms at 48 kHz reads a flat
    // 6.45 microvolts per root hertz, and the integral returns the 1 mV.
    const fs = 48000
    const { x, density, rms } = whiteNoise({ n: 512 * 400, sampleRate: fs, rms: 1e-3, seed: 100 })
    const ap = averagedPeriodogram(x, fs, { segment: 512, window: 'hann' })
    let acc = 0
    let count = 0
    for (let k = ap.interior[0]; k <= ap.interior[1]; k++) {
      acc += ap.psd[k]
      count++
    }
    expect(Math.sqrt(acc / count) / density).toBeCloseTo(1, 2)
    expect(Math.sqrt(ap.integral) / rms).toBeCloseTo(1, 2)
    expect(Math.abs(Math.sqrt(ap.integral) / rms - 1)).toBeLessThan(0.01)
  })

  it('refuses to guess when neither the density nor the rms is given', () => {
    expect(() => whiteNoise({ n: 8, sampleRate: 1000 })).toThrow(/either a density or an rms/)
  })
})

describe('the first-order low-pass', () => {
  it('is one at DC, 0.707 at the corner, and refuses a corner past Nyquist', () => {
    const lp = firstOrderLowpass(1000, 48000)
    expect(lp.magnitude(0)).toBeCloseTo(1, 12)
    expect(lp.magnitude(1000)).toBeCloseTo(Math.SQRT1_2, 12)
    expect(() => firstOrderLowpass(30000, 48000)).toThrow(/must lie in/)
    expect(() => firstOrderLowpass(0, 48000)).toThrow(/must lie in/)
  })

  it('states its own noise bandwidth in closed form, and it is not the analogue one', () => {
    const lp = firstOrderLowpass(2000, 48000)
    expect(lp.noiseGain).toBeCloseTo(lp.K / (lp.K + 1), 15)
    expect(lp.enb).toBeCloseTo(24000 * lp.noiseGain, 12)
    expect(lp.analogueEnb).toBeCloseTo((Math.PI / 2) * 2000, 12)
    // At a twenty-fourth of the sample rate the digital filter passes 11 % less
    // noise than the analogue single pole, because it has a null at Nyquist.
    expect(lp.enbRatio).toBeCloseTo(0.8887, 3)
  })

  it('and the two agree as the corner falls away from Nyquist, which is the guard', () => {
    const fs = 48000
    let previous = 0
    for (const fc of [4000, 1000, 240, 48, 4.8]) {
      const lp = firstOrderLowpass(fc, fs)
      expect(lp.enbRatio).toBeGreaterThan(previous)
      expect(lp.enbRatio).toBeLessThanOrEqual(1)
      previous = lp.enbRatio
    }
    // Within 1 % once the corner is below about a three-hundredth of the rate.
    expect(firstOrderLowpass(fs / 320, fs).enbRatio).toBeGreaterThan(0.99)
    expect(firstOrderLowpass(fs / 20, fs).enbRatio).toBeLessThan(0.99)
  })

  it('passes the variance its noise gain says it passes', () => {
    const fs = 48000
    const lp = firstOrderLowpass(3000, fs)
    const { x } = whiteNoise({ n: 1 << 19, sampleRate: fs, rms: 1, seed: 55 })
    const y = lp.run(x)
    let s = 0
    for (let i = 1000; i < y.length; i++) s += y[i] * y[i]
    // The samples of a filtered record are correlated, so the effective count
    // is the record divided by about twice the filter's time constant in
    // samples. That leaves a relative standard error near 0.5 %, and the bound
    // is four of those rather than a number chosen to pass.
    const tau = fs / (2 * Math.PI * 3000)
    const effective = (y.length - 1000) / (2 * tau)
    const se = Math.sqrt(2 / effective)
    expect(Math.abs((s / (y.length - 1000)) / lp.noiseGain - 1)).toBeLessThan(4 * se)
  })

  it('and its output density is the input density shaped by the magnitude squared', () => {
    const fs = 48000
    const lp = firstOrderLowpass(4000, fs)
    const { x } = whiteNoise({ n: 1024 * 400, sampleRate: fs, rms: 1, seed: 56 })
    const ap = averagedPeriodogram(lp.run(x), fs, { segment: 1024, window: 'hann' })
    const sIn = whitePsd(1, fs)
    const predicted = new Float64Array(ap.freqs.length)
    for (let k = 0; k < predicted.length; k++) predicted[k] = lp.magnitude(ap.freqs[k]) ** 2 * sIn
    // The measured integral is an average over the bins, each with relative
    // standard error sqrt(2/dof), so the integral's own error is that divided
    // by the root of the bin count.
    const se = Math.sqrt(2 / ap.dof / ap.psd.length)
    const ratio = ap.integral / integratePsd({ freqs: ap.freqs, psd: predicted })
    expect(Math.abs(ratio - 1)).toBeLessThan(Math.max(0.02, 5 * se))
  })
})
