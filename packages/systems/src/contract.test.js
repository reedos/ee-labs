import { describe, it, expect } from 'vitest'
import * as systems from '../index.js'
import {
  HARMONIC_LIMIT,
  SAMPLES_PER_CYCLE,
  SMOOTH_DECLINED,
  describingLimitCycle,
  emulate,
  emulationGuard,
  fitFirstOrder,
  fitSecondOrder,
  fitStep,
  lqr,
  polyMul,
  pwlRegions,
  pwlTrajectory,
  pwlValue,
  stepResponse,
  toStateSpace,
} from '../index.js'

// The brief's section 3, as a test.
//
// `apps/control-lab-ii/AGENT_BRIEF.md` writes each contract as the signature it
// is. The numerics behind them are fuzzed elsewhere — the round trip in
// ss.test.js, the hold in discrete.test.js, the discrepancy in
// describing.test.js, the residual in ident.test.js. What no other file checks
// is the PROMISE ITSELF: that the name is exported, and that a return shape
// which is supposed to carry its own guard carries it on EVERY call rather than
// on the calls a test happened to make.
//
// That distinction is what the lab's extra rule rests on. An approximation is
// never on screen without its guard beside it, and a pane can only obey that
// if the guard cannot be absent. A variant of `lqr` without `relResidual`, or
// an `emulate` that forgot `approximate` on one branch, would pass every other
// file here and quietly break the rule in the app.

/** Every name the brief promises, by the section that promises it. */
const CONTRACT = {
  '3.1 the state space': [
    'StateSpaceError', 'stateSpace', 'toTransferFunction', 'charPoly', 'eigenvalues',
    'controllability', 'observability', 'polyFromRoots', 'placePoles', 'observerGain',
    'lyapunov', 'lqr', 'ssSeries', 'ssTrajectory', 'similarity',
  ],
  '3.2 the sampled loop': [
    'SAMPLES_PER_CYCLE', 'ZOH_TF_DECLINED', 'zoh', 'discretize', 'isStableDiscrete',
    'simulateDiscrete', 'stepDiscrete', 'stepDiscreteTF', 'zohGain', 'zohPhaseLag',
    'zohDelay', 'zohTransferFunction', 'substituteS', 'emulate', 'emulationGuard',
    'discreteLoop', 'sOfZ',
  ],
  '3.3 the nonlinearity': [
    'PWL_KINDS', 'SMOOTH_DECLINED', 'RELAY_DECLINED', 'pwlValue', 'pwlRegions', 'pwlRegionOf',
  ],
  '3.4 the describing function': [
    'HARMONIC_LIMIT', 'saturationDescribing', 'deadzoneDescribing', 'saturationHarmonic',
    'saturationAmplitudeFor', 'negativeRealCrossings', 'describingLimitCycle', 'predictionError',
  ],
  '3.5 the plane': [
    'ALGEBRAIC_LOOP_DECLINED', 'loopRegions', 'pwlTrajectory', 'pwlOscillationOf',
    'phaseField', 'switchingLines', 'equilibria', 'lyapunovRate',
  ],
  '3.6 identification': [
    'ZETA_MAX', 'firstOrderStep', 'secondOrderStep', 'fitFirstOrder', 'fitSecondOrder', 'fitStep',
  ],
}

// The three lags of the plan's section 3, and the motor beside them. Both are
// the app's own defaults, so a contract broken here breaks a lesson there.
const threeLags = { b: [1], a: polyMul(polyMul([1, 1], [0.5, 1]), [0.25, 1]) }
const motor = { A: [[0, 1], [0, -2]], B: [0, 2], C: [1, 0], D: 0, n: 2 }
const GRID = Float64Array.from({ length: 4000 }, (_, i) => Math.pow(10, -3 + 6 * (i / 3999)))

describe('the brief names, and the package exports them', () => {
  for (const [section, names] of Object.entries(CONTRACT)) {
    it(section, () => {
      const missing = names.filter((n) => systems[n] === undefined)
      expect(missing, `${section} is missing ${missing.join(', ')}`).toEqual([])
    })
  }

  it('the two thresholds are the numbers the plan quotes, not whatever the code drifted to', () => {
    // Twenty samples per cycle is the sampled-filter link's own refusal
    // threshold (CORE_SCOPE Rule 2's first precedent), reused here so the
    // suite has one number rather than two.
    expect(SAMPLES_PER_CYCLE).toBe(20)
    // Five per cent of third harmonic, chosen from the measurement in
    // describing.test.js rather than from convention.
    expect(HARMONIC_LIMIT).toBe(0.05)
  })
})

describe('a shape that carries a guard carries it on every call', () => {
  it('the regulator returns its Riccati residual whatever it is asked', () => {
    // Five different weightings, including the badly scaled ones. There is no
    // branch of lqr that returns a gain without the number that says whether
    // the gain solved the equation.
    for (const [q, r] of [[1, 1], [1, 0.01], [1, 100], [1e4, 1], [1e-4, 1]]) {
      const out = lqr(motor, [[q, 0], [0, 0]], r)
      const label = `Q = ${q}, R = ${r}`
      expect(Object.prototype.hasOwnProperty.call(out, 'residual'), label).toBe(true)
      expect(Object.prototype.hasOwnProperty.call(out, 'relResidual'), label).toBe(true)
      expect(Number.isFinite(out.relResidual), label).toBe(true)
      expect(out.relResidual, label).toBeLessThan(1e-8)
      // And the rest of the promised shape, so a pane can print K beside it.
      expect(out.K.length, label).toBe(2)
      expect(out.poles.length, label).toBe(2)
      expect(typeof out.cost, label).toBe('function')
    }
  })

  it('an emulated controller is labelled an approximation, by every rule', () => {
    const pi = { b: [2, 4], a: [1, 0] }
    for (const method of ['tustin', 'backward', 'forward']) {
      for (const Ts of [1e-3, 0.05, 0.4]) {
        const out = emulate(pi, Ts, method)
        const label = `${method} at Ts = ${Ts}`
        expect(out.approximate, label).toBe(true)
        expect(out.method, label).toBe(method)
        expect(out.Ts, label).toBe(Ts)
      }
    }
  })

  it('the emulation guard states its threshold whether it holds or fails', () => {
    // Either side of twenty samples per cycle at a crossover of 1 Hz.
    for (const perCycle of [4, 19.5, 20.5, 400]) {
      const g = emulationGuard(1, 1 / perCycle)
      const label = `${perCycle} samples a cycle`
      expect(g.threshold, label).toBe(SAMPLES_PER_CYCLE)
      expect(g.samplesPerCycle, label).toBeCloseTo(perCycle, 9)
      expect(g.holds, label).toBe(perCycle >= SAMPLES_PER_CYCLE)
      expect(typeof g.phaseLagDeg, label).toBe('number')
      // The reason is content, not a placeholder, wherever the guard fails.
      if (!g.holds) expect(String(g.reason).length, label).toBeGreaterThan(20)
    }
  })

  it('the limit cycle reports its harmonic ratio whether the hypothesis holds or not', () => {
    const holding = describingLimitCycle({ b: threeLags.b.map((v) => v * 20), a: threeLags.a }, { delta: 1 }, GRID)
    // A resonance sitting on the third harmonic, which is where the filter
    // hypothesis is designed to fail.
    const w3 = 3 * Math.sqrt(14)
    const resonant = { b: [w3 * w3], a: [1, 0.02 * w3, w3 * w3] }
    const failing = describingLimitCycle(
      { b: polyMul(threeLags.b.map((v) => v * 30), resonant.b), a: polyMul(threeLags.a, resonant.a) },
      { delta: 1 },
      GRID,
    )
    for (const [label, out] of [['holds', holding], ['fails', failing]]) {
      for (const key of ['harmonicRatio', 'threshold', 'holds', 'amplitude', 'omega', 'N']) {
        expect(Object.prototype.hasOwnProperty.call(out, key), `${label}: ${key}`).toBe(true)
      }
      expect(out.threshold, label).toBe(HARMONIC_LIMIT)
      expect(Number.isFinite(out.harmonicRatio), label).toBe(true)
    }
    expect(holding.holds).toBe(true)
    expect(failing.holds).toBe(false)
    // The failing one still hands back the reason, which is what the pane
    // shows in place of an amplitude.
    expect(failing.reason).toMatch(/harmonic/)
  })

  it('every fit returns its residual, on clean data and on the wrong order alike', () => {
    const lag = stepResponse({ b: [2.5], a: [0.8, 1] }, { duration: 6, points: 400 })
    const ring = stepResponse({ b: [9], a: [1, 2.1, 9] }, { duration: 6, points: 400 })
    const fits = [
      ['first on first', fitFirstOrder(lag.t, lag.y)],
      ['second on first', fitSecondOrder(lag.t, lag.y)],
      ['first on second', fitFirstOrder(ring.t, ring.y)],
      ['second on second', fitSecondOrder(ring.t, ring.y)],
    ]
    for (const [label, fit] of fits) {
      expect(Number.isFinite(fit.residual), label).toBe(true)
      expect(Number.isFinite(fit.relResidual), label).toBe(true)
      expect(fit.residual, label).toBeGreaterThanOrEqual(0)
      expect(fit.model.length, label).toBeGreaterThan(0)
    }
    // The wrong order is the case that matters. A first-order model cannot
    // overshoot, so its residual on a ringing step is a number a reader can
    // see rather than a rounding error.
    const wrong = fits[2][1]
    expect(wrong.relResidual).toBeGreaterThan(0.1)
    // And fitStep hands both back together with the improvement between them.
    const both = fitStep(ring.t, ring.y)
    expect(both.first.relResidual).toBeGreaterThan(both.second.relResidual)
    expect(Number.isFinite(both.improvement)).toBe(true)
  })
})

describe('what the package declines, it declines by name', () => {
  it('a smooth nonlinearity is refused with the reason, at the value and in time', () => {
    // Two doors into the same refusal. Asking for the value of a smooth kind,
    // and asking for its trajectory, both land on the same text.
    expect(() => pwlValue('cubic', 0.5, 1)).toThrow(SMOOTH_DECLINED)
    expect(() => pwlRegions('tanh', 1)).toThrow(SMOOTH_DECLINED)
    expect(() =>
      pwlTrajectory(
        { ctrl: { A: [], B: [], C: [], D: 2 }, plant: toStateSpace({ b: [1], a: [1, 1] }), kind: 'tanh', delta: 1, reference: 1 },
        { x0: [0], duration: 1, points: 11 },
      ),
    ).toThrow(SMOOTH_DECLINED)
    // The reason names what is available instead, so the refusal is an answer
    // rather than a wall.
    expect(SMOOTH_DECLINED).toMatch(/saturation and deadzone/)
    expect(SMOOTH_DECLINED).toMatch(/step size/)
  })
})
