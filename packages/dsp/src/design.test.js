import { describe, it, expect } from 'vitest'
import {
  WINDOW_SPECS,
  analogPrototype,
  designFirSpec,
  designIir,
  designIirSpec,
  designRemezSpec,
  iirOrderFor,
  lowpassSpec,
  measureFir,
  passbandRefDb,
  remez,
  remezOrder,
  specMargin,
  specMarginRef,
  stopbandDepth,
  windowTaps,
  windowTransition,
  windowedSinc,
} from './design.js'
import { designFir, firResponse, isSymmetric, TAPS_MAX } from './fir.js'
import { biquadResponse, isStable, poleRadius, makeBiquad } from './biquad.js'

const SR = 48000
const cascade = (secs, f, sr) => secs.reduce((m, c) => m * biquadResponse(c, f, sr), 1)

describe('the window table is an estimate, and the tests say by how much', () => {
  it('the transition width falls as 1/N and the stopband depth does not move', () => {
    const fc = 6000
    for (const w of ['none', 'hann', 'hamming', 'blackman']) {
      const depths = []
      for (const N of [41, 81, 161]) {
        const h = designFir({ mode: 'lowpass', taps: N, freq: fc, window: w }, SR)
        const est = windowTransition(w, N, SR)
        const m = measureFir(h, SR, { passDb: 1, stopDb: WINDOW_SPECS[w].stopbandDb })
        // The estimate is the right size. It is not an identity, and the loosest
        // of the four (Blackman) is within 40 %.
        expect(m.transition, `${w} N=${N}`).toBeGreaterThan(est * 0.6)
        expect(m.transition, `${w} N=${N}`).toBeLessThan(est * 1.2)
        depths.push(stopbandDepth(h, fc + est / 2, SR))
      }
      // Quadrupling the length changes the attenuation by less than 3 dB, while
      // the transition width falls by a factor of four.
      expect(Math.abs(depths[2] - depths[0]), w).toBeLessThan(3)
      expect(depths[0], w).toBeGreaterThan(WINDOW_SPECS[w].stopbandDb - 5)
    }
  })

  it('windowTaps and windowTransition are inverses', () => {
    for (const w of Object.keys(WINDOW_SPECS)) {
      for (const width of [500, 1200, 3000]) {
        const n = windowTaps(w, width, SR)
        expect(n % 2).toBe(1)
        expect(windowTransition(w, n, SR)).toBeLessThanOrEqual(width * 1.001)
      }
    }
  })
})

describe('the long-form windowed sinc is the same design without the block limit', () => {
  it('agrees with designFir to the last bit at every length the block allows', () => {
    for (const window of ['none', 'hann', 'hamming', 'blackman']) {
      for (const taps of [11, 41, 101, TAPS_MAX]) {
        for (const mode of ['lowpass', 'highpass']) {
          const a = designFir({ mode, taps, freq: 5000, window }, SR)
          const b = windowedSinc({ mode, taps, freq: 5000, window }, SR)
          expect(b.length, `${window} ${taps}`).toBe(a.length)
          for (let k = 0; k < a.length; k++) expect(b[k], `${window} ${taps} k=${k}`).toBe(a[k])
        }
      }
    }
  })

  it('goes past that limit, which is what a specification search needs', () => {
    const h = windowedSinc({ mode: 'lowpass', taps: 401, freq: 5000 }, SR)
    expect(h.length).toBe(401)
    expect(designFir({ mode: 'lowpass', taps: 401, freq: 5000 }, SR).length).toBe(TAPS_MAX)
  })
})

describe('a specification is a list of bands and a margin against each', () => {
  it('reports the margin at the band that binds, in decibels', () => {
    const bands = lowpassSpec({ fpass: 4000, fstop: 6000, ripplePassDb: 1, stopDb: 40 }, SR)
    // A response that is exactly flat at 1 and exactly 0.001 above 5 kHz. The
    // passband's binding side is the upper bound, which it sits exactly on, so
    // its margin is zero and the specification is met.
    const r = specMargin(bands, (f) => (f < 5000 ? 1 : 0.001))
    expect(r.bands[0].marginDb).toBeCloseTo(0, 9)
    expect(r.bands[1].marginDb).toBeCloseTo(20, 6) // -60 dB against a -40 dB limit
    expect(r.met).toBe(true)
    expect(r.worst.id).toBe('pass')

    // Drop the passband by half a decibel and the margin becomes that gap.
    const under = specMargin(bands, (f) => (f < 5000 ? Math.pow(10, -0.5 / 20) : 0.001))
    expect(under.bands[0].marginDb).toBeCloseTo(0.5, 6)
  })

  it('reports a miss as a negative margin at the frequency where it happens', () => {
    const bands = lowpassSpec({ fpass: 4000, fstop: 6000, ripplePassDb: 1, stopDb: 60 }, SR)
    const r = specMargin(bands, (f) => (f < 5000 ? 1 : 0.01))
    expect(r.met).toBe(false)
    expect(r.bands[1].marginDb).toBeCloseTo(-20, 6)
    expect(r.bands[1].atHz).toBeGreaterThanOrEqual(6000)
  })

  it('measures the passband bound from the passband peak, not from unity', () => {
    const bands = lowpassSpec({ fpass: 4000, fstop: 6000, ripplePassDb: 1, stopDb: 40 }, SR)
    // A filter with 2x gain and a flat passband meets a ripple specification.
    const flat2 = (f) => (f < 5000 ? 2 : 0.001)
    expect(passbandRefDb(bands, flat2)).toBeCloseTo(6.0206, 3)
    expect(specMarginRef(bands, flat2).met).toBe(true)
    expect(specMargin(bands, flat2).met).toBe(false)
  })
})

describe('the window method against a written specification', () => {
  const spec = { fpass: 4000, fstop: 6000, ripplePassDb: 1, stopDb: 60 }

  it('meets it, and says how many taps that took', () => {
    const d = designFirSpec({ ...spec, window: 'blackman' }, SR)
    expect(d.met).toBe(true)
    expect(d.margin.worstDb).toBeGreaterThanOrEqual(0)
    expect(isSymmetric(d.h)).toBe(true)
    expect(d.taps % 2).toBe(1)
    // The estimate is what the length started from, and the search says whether
    // it had to grow.
    expect(d.taps).toBe(d.estimateTaps + 2 * d.grew)
  })

  it('declines with a reason when the window cannot reach the depth at any length', () => {
    const d = designFirSpec({ ...spec, window: 'hamming' }, SR)
    expect(d.reachable).toBe(false)
    expect(d.met).toBe(false)
    expect(d.reason).toMatch(/Hamming/)
    expect(d.reason).toMatch(/60 dB/)
  })

  it('a window that can reach the depth does, at every specification tried', () => {
    for (const fstop of [5000, 6000, 8000]) {
      for (const stopDb of [30, 40, 50]) {
        const w = stopDb <= 40 ? 'hann' : 'blackman'
        const d = designFirSpec({ fpass: 4000, fstop, ripplePassDb: 1, stopDb, window: w }, SR)
        expect(d.met, `${w} fstop=${fstop} stop=${stopDb}`).toBe(true)
      }
    }
  })
})

describe('Parks-McClellan gives equal ripple, and fewer taps for the same specification', () => {
  const bands = [
    { from: 0, to: 4000, gain: 1, weight: 1 },
    { from: 6000, to: SR / 2, gain: 0, weight: 10 },
  ]

  it('converges, and every stopband lobe reaches the same height', () => {
    const r = remez({ bands, taps: 51 }, SR)
    expect(r.converged).toBe(true)
    expect(isSymmetric(r.h, 1e-9)).toBe(true)

    const peaks = []
    let prev = 0
    let cur = 0
    for (let i = 0; i <= 4000; i++) {
      const f = 6000 + ((SR / 2 - 6000) * i) / 4000
      const m = firResponse(r.h, f, SR)
      if (i > 1 && cur > prev && cur > m) peaks.push(cur)
      prev = cur
      cur = m
    }
    expect(peaks.length).toBeGreaterThan(8)
    const hi = Math.max(...peaks)
    const lo = Math.min(...peaks)
    // Equal ripple, to within a hundredth of a decibel across every lobe.
    expect(20 * Math.log10(hi / lo)).toBeLessThan(0.05)
    // ...and the height is the delta the exchange solved for, divided by the
    // stopband weight.
    expect(hi).toBeCloseTo(r.delta / 10, 4)
  })

  it('the peak error falls as taps are added', () => {
    let last = Infinity
    for (const taps of [31, 51, 71, 91]) {
      const r = remez({ bands, taps }, SR)
      expect(r.delta, `taps=${taps}`).toBeLessThan(last)
      last = r.delta
    }
  })

  it('meets the specification in fewer taps than any window does', () => {
    const spec = { fpass: 4000, fstop: 6000, ripplePassDb: 1, stopDb: 60 }
    const pm = designRemezSpec(spec, SR)
    const win = designFirSpec({ ...spec, window: 'blackman' }, SR)
    expect(pm.met).toBe(true)
    expect(win.met).toBe(true)
    expect(pm.taps).toBeLessThan(win.taps)
    // Kaiser's formula is the starting estimate, and the search reports what it
    // had to add.
    expect(pm.taps).toBe(pm.estimateTaps + 2 * pm.grew)
    expect(remezOrder(spec, SR).taps).toBe(pm.estimateTaps)
  })

  it('meets every specification it is given, or reports the miss', () => {
    for (const fstop of [5000, 6000, 9000]) {
      for (const stopDb of [40, 60, 80]) {
        const d = designRemezSpec({ fpass: 4000, fstop, ripplePassDb: 1, stopDb }, SR)
        expect(d.met, `fstop=${fstop} stop=${stopDb}`).toBe(true)
        for (const band of d.margin.bands) {
          expect(band.marginDb, `${band.id} fstop=${fstop} stop=${stopDb}`).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })
})

describe('the analog prototypes and their bilinear images', () => {
  it('a Butterworth prototype sits on the unit circle, in the left half plane', () => {
    for (const order of [1, 2, 3, 4, 5, 8]) {
      const p = analogPrototype({ type: 'butterworth', order })
      expect(p.poles).toHaveLength(order)
      for (const [re, im] of p.poles) {
        expect(Math.hypot(re, im)).toBeCloseTo(1, 12)
        expect(re).toBeLessThan(0)
      }
    }
  })

  it('a Chebyshev prototype sits on an ellipse, and its DC gain is the ripple floor', () => {
    const rippleDb = 1
    const eps = Math.sqrt(Math.pow(10, rippleDb / 10) - 1)
    for (const order of [2, 3, 4, 5]) {
      const p = analogPrototype({ type: 'chebyshev1', order, rippleDb })
      const v0 = Math.asinh(1 / eps) / order
      for (const [re, im] of p.poles) {
        const a = Math.sinh(v0)
        const b = Math.cosh(v0)
        expect((re * re) / (a * a) + (im * im) / (b * b)).toBeCloseTo(1, 10)
        expect(re).toBeLessThan(0)
      }
      expect(p.dcGain).toBeCloseTo(order % 2 === 0 ? 1 / Math.sqrt(1 + eps * eps) : 1, 12)
    }
  })

  it('every bilinear pole is inside the unit circle, so the design is stable', () => {
    for (const type of ['butterworth', 'chebyshev1']) {
      for (const order of [2, 4, 6, 9]) {
        for (const freq of [100, 1000, 8000, 20000]) {
          const secs = designIir({ type, mode: 'lowpass', order, freq }, SR)
          for (const s of secs) {
            expect(isStable(s), `${type} ${order} ${freq}`).toBe(true)
            expect(poleRadius(s)).toBeLessThan(1)
          }
        }
      }
    }
  })

  it('a Butterworth is 3.0103 dB down at its corner at every order, and flat at DC', () => {
    for (const order of [1, 2, 4, 6, 8]) {
      for (const fc of [200, 1000, 5000]) {
        const secs = designIir({ type: 'butterworth', mode: 'lowpass', order, freq: fc }, SR)
        const at = (f) => 20 * Math.log10(cascade(secs, f, SR))
        expect(at(fc), `order=${order} fc=${fc}`).toBeCloseTo(-3.0103, 3)
        expect(at(0), `order=${order} fc=${fc}`).toBeCloseTo(0, 8)
        // The bilinear transform maps frequency by the tangent, so the digital
        // response at f is the analog prototype's at tan(pi f/fs)/tan(pi fc/fs).
        // That identity is what "prewarped" means, and it holds at every point.
        for (const f of [fc / 4, fc / 2, fc, 2 * fc, 4 * fc]) {
          if (f >= SR / 2) continue
          const ratio = Math.tan((Math.PI * f) / SR) / Math.tan((Math.PI * fc) / SR)
          const want = -10 * Math.log10(1 + Math.pow(ratio, 2 * order))
          expect(at(f), `order=${order} fc=${fc} f=${f}`).toBeCloseTo(want, 6)
        }
      }
    }
  })

  it('a Butterworth falls at 6 dB per octave per order well above the corner', () => {
    for (const order of [2, 4, 6]) {
      const secs = designIir({ type: 'butterworth', mode: 'lowpass', order, freq: 500 }, SR)
      const at = (f) => 20 * Math.log10(cascade(secs, f, SR))
      // Six decibels an octave per order is the asymptote, and the digital
      // filter approaches it from below because the tangent warping steepens
      // the fall as Nyquist comes closer.
      const slope = at(4000) - at(2000)
      expect(slope, `order=${order}`).toBeLessThan(-6 * order + 0.6)
      expect(slope, `order=${order}`).toBeGreaterThan(-6 * order - 1.5)
    }
  })

  it('a Chebyshev ripples between 0 dB and its stated ripple, and no further', () => {
    for (const rippleDb of [0.1, 0.5, 1, 3]) {
      for (const order of [3, 4, 5, 6]) {
        const secs = designIir({ type: 'chebyshev1', mode: 'lowpass', order, freq: 2000, rippleDb }, SR)
        let hi = -Infinity
        let lo = Infinity
        for (let i = 0; i <= 800; i++) {
          const v = 20 * Math.log10(cascade(secs, (i * 2000) / 800, SR))
          hi = Math.max(hi, v)
          lo = Math.min(lo, v)
        }
        expect(hi, `${rippleDb} dB order ${order}`).toBeCloseTo(0, 4)
        expect(lo, `${rippleDb} dB order ${order}`).toBeCloseTo(-rippleDb, 3)
      }
    }
  })

  it('a high-pass is the same design with the prototype inverted', () => {
    for (const order of [2, 4, 5]) {
      const secs = designIir({ type: 'butterworth', mode: 'highpass', order, freq: 3000 }, SR)
      const at = (f) => 20 * Math.log10(cascade(secs, f, SR))
      expect(at(3000), `order=${order}`).toBeCloseTo(-3.0103, 3)
      expect(at(SR / 2 - 1)).toBeCloseTo(0, 6)
      expect(cascade(secs, 0, SR)).toBeLessThan(1e-12)
    }
  })

  it('runs as a real cascade and settles to the response it claims', () => {
    const secs = designIir({ type: 'chebyshev1', mode: 'lowpass', order: 4, freq: 1000 }, SR)
    const steps = secs.map(makeBiquad)
    const f = 400
    const n = 20000
    let peak = 0
    for (let i = 0; i < n; i++) {
      let v = Math.sin((2 * Math.PI * f * i) / SR)
      for (const s of steps) v = s(v)
      if (i > n - 2000) peak = Math.max(peak, Math.abs(v))
    }
    // 120 samples a cycle, so the largest sample can sit up to
    // 1 - cos(pi/120) = 3.4e-4 below the true peak.
    expect(peak).toBeCloseTo(cascade(secs, f, SR), 3)
  })
})

describe('one specification, three routes, three costs', () => {
  const spec = { fpass: 4000, fstop: 6000, ripplePassDb: 1, stopDb: 60 }

  it('the IIR meets it in far fewer coefficients than either FIR', () => {
    const win = designFirSpec({ ...spec, window: 'blackman' }, SR)
    const pm = designRemezSpec(spec, SR)
    const btw = designIirSpec({ ...spec, type: 'butterworth' }, SR, cascade)
    const cby = designIirSpec({ ...spec, type: 'chebyshev1' }, SR, cascade)

    for (const d of [win, pm, btw, cby]) expect(d.met).toBe(true)
    expect(pm.taps).toBeLessThan(win.taps)
    expect(cby.coefficients).toBeLessThan(btw.coefficients)
    expect(btw.coefficients).toBeLessThan(pm.taps)
    // Each order estimate is the order the search started from.
    expect(btw.order).toBe(btw.estimateOrder + btw.grew)
    expect(cby.order).toBe(cby.estimateOrder + cby.grew)
    expect(iirOrderFor({ ...spec, type: 'chebyshev1' }, SR).order).toBe(cby.estimateOrder)
  })

  it('the IIR meets every specification it is given', () => {
    for (const type of ['butterworth', 'chebyshev1']) {
      for (const fstop of [5000, 6000, 9000]) {
        for (const stopDb of [40, 60, 80]) {
          const d = designIirSpec({ fpass: 4000, fstop, ripplePassDb: 1, stopDb, type }, SR, cascade)
          expect(d.met, `${type} fstop=${fstop} stop=${stopDb}`).toBe(true)
          for (const s of d.sections) expect(isStable(s)).toBe(true)
        }
      }
    }
  })
})
