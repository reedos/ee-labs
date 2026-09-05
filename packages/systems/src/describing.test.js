import { describe, it, expect } from 'vitest'
import { polyMul, toStateSpace } from './tf.js'
import {
  HARMONIC_LIMIT,
  deadzoneDescribing,
  describingLimitCycle,
  negativeRealCrossings,
  predictionError,
  saturationAmplitudeFor,
  saturationDescribing,
  saturationHarmonic,
} from './describing.js'
import { NonlinearError, RELAY_DECLINED, SMOOTH_DECLINED, pwlRegionOf, pwlValue } from './nonlinear.js'
import { pwlTrajectory, oscillationOf } from './phase.js'

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const GRID = Float64Array.from({ length: 8000 }, (_, i) => Math.pow(10, -3 + 6 * (i / 7999)))

/** The n-th Fourier sine coefficient of the saturated sine, by quadrature. */
function harmonicByQuadrature(delta, A, n, samples = 200000) {
  let acc = 0
  for (let i = 0; i < samples; i++) {
    const th = (2 * Math.PI * (i + 0.5)) / samples
    acc += pwlValue('saturation', A * Math.sin(th), delta) * Math.sin(n * th)
  }
  return (2 * acc) / samples
}

describe('the saturation, exactly', () => {
  it('the describing function is 1 below the limit and falls above it', () => {
    expect(saturationDescribing(1, 0.5)).toBe(1)
    expect(saturationDescribing(1, 1)).toBe(1)
    let prev = 1
    for (const A of [1.2, 2, 4, 10, 100]) {
      const N = saturationDescribing(1, A)
      expect(N).toBeLessThan(prev)
      prev = N
    }
    // Deep in saturation the output is a square wave, whose fundamental is
    // 4/pi times the level, so N tends to 4 delta / (pi A).
    expect(saturationDescribing(1, 1000)).toBeCloseTo(4 / (Math.PI * 1000), 8)
  })

  it('the deadzone is one minus the saturation, which is what the two shapes summing means', () => {
    for (const A of [0.5, 1.5, 3, 20]) {
      expect(deadzoneDescribing(1, A) + saturationDescribing(1, A)).toBeCloseTo(1, 14)
    }
  })

  it('every harmonic coefficient matches a numerical Fourier integral', () => {
    for (const A of [1.5, 3, 10]) {
      for (const n of [1, 3, 5, 7]) {
        expect(saturationHarmonic(1, A, n), `A = ${A}, n = ${n}`).toBeCloseTo(
          harmonicByQuadrature(1, A, n),
          8,
        )
      }
      // The saturation is odd, so the even harmonics are exactly zero rather
      // than small.
      for (const n of [2, 4, 6]) expect(saturationHarmonic(1, A, n)).toBe(0)
    }
  })

  it('the fundamental coefficient IS the describing function times the amplitude', () => {
    for (const A of [1.1, 2, 7, 50]) {
      expect(saturationHarmonic(1, A, 1)).toBeCloseTo(A * saturationDescribing(1, A), 12)
    }
  })

  it('inverting the describing function returns the amplitude it came from', () => {
    for (const A of [1.0001, 1.5, 3, 20, 400]) {
      const N = saturationDescribing(1, A)
      expect(saturationAmplitudeFor(1, N) / A).toBeCloseTo(1, 8)
    }
    // A target above 1 has no solution: the saturation can only reduce gain.
    expect(saturationAmplitudeFor(1, 1.4)).toBeNull()
  })

  it('the third harmonic never exceeds a third of the fundamental', () => {
    // The deep-saturation limit is a square wave, whose third harmonic is
    // exactly a third of its fundamental. Nothing shallower reaches that.
    let worst = 0
    for (let i = 1; i <= 400; i++) {
      const A = 1 + i * 0.5
      worst = Math.max(worst, saturationHarmonic(1, A, 3) / saturationHarmonic(1, A, 1))
    }
    expect(worst).toBeLessThan(1 / 3)
    expect(worst).toBeGreaterThan(0.32)
  })
})

describe('the limit cycle the method predicts', () => {
  // Three buffered lags, the plant Control Lab's "Turn it up until it sings"
  // uses, with a saturating actuator. Every number below is computed from
  // these knobs.
  const TAUS = [1, 0.5, 0.25]
  const plantTf = { b: [1], a: polyMul(polyMul([TAUS[0], 1], [TAUS[1], 1]), [TAUS[2], 1]) }
  const loopAt = (Kp) => ({ b: plantTf.b.map((v) => v * Kp), a: plantTf.a })

  it('the crossing frequency is the one the algebra gives', () => {
    // The denominator is t1t2t3 s^3 + (t1t2 + t2t3 + t3t1) s^2 + (t1+t2+t3) s + 1,
    // so Im L = 0 at w^2 = (t1 + t2 + t3) / (t1 t2 t3). Here that is 14.
    const [t1, t2, t3] = TAUS
    const want = Math.sqrt((t1 + t2 + t3) / (t1 * t2 * t3))
    const cross = negativeRealCrossings(loopAt(20), GRID)
    expect(cross.length).toBe(1)
    expect(cross[0].omega).toBeCloseTo(want, 8)
  })

  it('a gain-stable loop is told there is no limit cycle, with the reason', () => {
    // Below the crossing gain the locus does not reach -1, and a saturation
    // only reduces gain.
    const out = describingLimitCycle(loopAt(5), { delta: 1 }, GRID)
    expect(out.predicted).toBeNull()
    expect(out.reason).toMatch(/below 1/)
    expect(out.reason).toMatch(/can only reduce gain/)
  })

  it('a loop with no phase crossover at all is told so', () => {
    const out = describingLimitCycle({ b: [10], a: [1, 1] }, { delta: 1 }, GRID)
    expect(out.predicted).toBeNull()
    expect(out.reason).toMatch(/never reaches -180 degrees/)
  })

  it('the predicted describing function equals the loop\'s own gain margin', () => {
    // N(A) L = -1 at the crossover, so N(A) = 1/|L| there, which is the gain
    // margin. The crossing gain is |Re L| at that frequency divided by Kp, and
    // for these three lags it comes to 11.25 exactly.
    const [t1, t2, t3] = TAUS
    const w2 = (t1 + t2 + t3) / (t1 * t2 * t3)
    const Kc = Math.abs(1 - (t1 * t2 + t2 * t3 + t3 * t1) * w2)
    expect(Kc).toBeCloseTo(11.25, 12)
    for (const Kp of [15, 20, 40]) {
      const out = describingLimitCycle(loopAt(Kp), { delta: 1 }, GRID)
      expect(out.N, `Kp = ${Kp}`).toBeCloseTo(Kc / Kp, 8)
    }
  })

  it('INVARIANT: the prediction is compared with the exact simulation, and the discrepancy is the size the guard says', () => {
    const plantSS = toStateSpace(plantTf)
    const rand = rng(31337)
    const rows = []
    for (let trial = 0; trial < 16; trial++) {
      const Kp = 13 + 40 * rand()
      const delta = 0.3 + 2 * rand()
      const pred = describingLimitCycle(loopAt(Kp), { delta }, GRID)
      expect(pred.predicted, `Kp = ${Kp}`).not.toBeNull()
      // The exact walk between regions: the same loop, with no describing
      // function anywhere in it.
      const ctrl = { A: [], B: [], C: [], D: Kp }
      const sim = pwlTrajectory(
        { ctrl, plant: plantSS, kind: 'saturation', delta, reference: 0 },
        { x0: [0.01 * delta, 0, 0], duration: 60, points: 4001 },
      )
      const measured = oscillationOf(sim.t, sim.u, { tailFraction: 0.25 })
      expect(measured, `Kp = ${Kp} should reach a cycle`).not.toBeNull()
      expect(measured.settled, 'the cycle should have settled').toBeLessThan(0.01)
      rows.push({ Kp, delta, pred, err: predictionError(pred.predicted, measured) })
    }
    // The guard holds on this plant: three lags attenuate the third harmonic
    // by a factor of 27, so the ratio stays under two per cent.
    expect(rows.every((r) => r.pred.holds), 'the filter hypothesis should hold on three lags').toBe(true)

    // THE INVARIANT. The discrepancy between the prediction and the exact
    // simulation is the same size as the harmonic ratio the guard measures,
    // to within a factor of 1.5 either way. That is what makes the ratio a
    // guard rather than a decoration: it predicts the error it is guarding
    // against. It also fixes what HARMONIC_LIMIT means, since a five per cent
    // ratio is an amplitude wrong by around five per cent.
    for (const r of rows) {
      const ratio = Math.abs(r.err.amplitude) / r.pred.harmonicRatio
      expect(ratio, `Kp = ${r.Kp.toFixed(2)}, delta = ${r.delta.toFixed(3)}`).toBeGreaterThan(0.7)
      expect(ratio, `Kp = ${r.Kp.toFixed(2)}, delta = ${r.delta.toFixed(3)}`).toBeLessThan(1.5)
    }
    // The method under-predicts the amplitude every time, never over.
    expect(rows.every((r) => r.err.amplitude < 0)).toBe(true)
    // Absolute sizes, so a reader knows what the pane will print.
    expect(Math.max(...rows.map((r) => Math.abs(r.err.amplitude)))).toBeLessThan(0.03)
    expect(Math.max(...rows.map((r) => Math.abs(r.err.frequency)))).toBeLessThan(0.02)
    // And never zero. The prediction is an approximation, and a test that
    // claimed otherwise would be the wrong test.
    expect(Math.min(...rows.map((r) => Math.abs(r.err.amplitude)))).toBeGreaterThan(1e-4)
  })

  it('the amplitude scales with the saturation limit, exactly', () => {
    // N(A) depends only on A/delta, so doubling the limit doubles the
    // predicted amplitude and leaves the frequency alone.
    const a = describingLimitCycle(loopAt(20), { delta: 1 }, GRID)
    const b = describingLimitCycle(loopAt(20), { delta: 2 }, GRID)
    expect(b.amplitude / a.amplitude).toBeCloseTo(2, 9)
    expect(b.frequency).toBeCloseTo(a.frequency, 9)
  })

  it('the guard is stated with its threshold, and it fails on a loop that does not filter', () => {
    // One lag and a long dead-beat: a loop whose gain at the third harmonic is
    // NOT small. Built as a resonant pair placed at three times the crossing
    // frequency, so the third harmonic is amplified rather than attenuated.
    const w0 = 3.7416573867739413 // the three-lag crossing, rad/s
    const resonant = { b: [(3 * w0) ** 2], a: [1, 0.02 * 3 * w0, (3 * w0) ** 2] }
    const L = { b: polyMul(plantTf.b.map((v) => v * 30), resonant.b), a: polyMul(plantTf.a, resonant.a) }
    const out = describingLimitCycle(L, { delta: 1 }, GRID)
    expect(out.predicted).not.toBeNull()
    expect(out.threshold).toBe(HARMONIC_LIMIT)
    expect(out.harmonicRatio).toBeGreaterThan(HARMONIC_LIMIT)
    expect(out.holds).toBe(false)
    expect(out.reason).toMatch(/third harmonic/)
    expect(out.reason).toMatch(/per cent this method assumes/)
    expect(out.reason).toMatch(/not the sine the describing function was derived for/)
  })
})

describe('what is declined', () => {
  it('a smooth nonlinearity is declined with the reason, not integrated', () => {
    let err = null
    try {
      describingLimitCycle({ b: [1], a: [1, 1] }, { kind: 'cubic', delta: 1 }, GRID)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(NonlinearError)
    expect(err.code).toBe('smooth-declined')
    expect(err.message).toBe(SMOOTH_DECLINED)
    expect(SMOOTH_DECLINED).toMatch(/no straight segments/)
    expect(SMOOTH_DECLINED).toMatch(/declines the smooth ones/)
    expect(SMOOTH_DECLINED).toMatch(/saturation and deadzone/)
  })

  it('an ideal relay is declined for the sliding it would do', () => {
    expect(() => pwlValue('relay', 1, 1)).toThrow(NonlinearError)
    expect(() => describingLimitCycle({ b: [1], a: [1, 1] }, { kind: 'relay', delta: 1 }, GRID)).toThrow(
      /event count is not finite/,
    )
    expect(RELAY_DECLINED).toMatch(/slide along it/)
  })

  it('a limit of zero or less is declined', () => {
    expect(() => saturationDescribing(0, 1)).toThrow(/must be positive/)
    expect(() => describingLimitCycle({ b: [1], a: [1, 1] }, { delta: 0 }, GRID)).toThrow(/must be positive/)
  })

  it('the region test and the value agree at the breakpoints', () => {
    expect(pwlRegionOf(0.5, 1)).toBe(0)
    expect(pwlRegionOf(1, 1)).toBe(0)
    expect(pwlRegionOf(1.01, 1)).toBe(1)
    expect(pwlRegionOf(-1.01, 1)).toBe(-1)
    expect(pwlValue('saturation', 5, 1)).toBe(1)
    expect(pwlValue('deadzone', 5, 1)).toBe(4)
    expect(pwlValue('deadzone', 0.5, 1)).toBe(0)
  })
})
