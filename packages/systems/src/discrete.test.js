import { describe, it, expect } from 'vitest'
import { closeLoop, isStable, margins, polyMul, roots, series, toStateSpace } from './tf.js'
import { ssTrajectory, toTransferFunction } from './ss.js'
import {
  DiscreteError,
  SAMPLES_PER_CYCLE,
  ZOH_TF_DECLINED,
  discreteLoop,
  discretize,
  emulate,
  emulationGuard,
  isStableDiscrete,
  sOfZ,
  simulateDiscrete,
  stepDiscrete,
  stepDiscreteTF,
  zoh,
  zohDelay,
  zohGain,
  zohPhaseLag,
  zohTransferFunction,
} from './discrete.js'

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const GRID = Float64Array.from({ length: 6000 }, (_, i) => Math.pow(10, -4 + 8 * (i / 5999)))

describe('the hold, and what it is', () => {
  it('the half-sample delay is exactly that, at every frequency', () => {
    const Ts = 1e-3
    expect(zohDelay(Ts)).toBe(Ts / 2)
    for (const w of [1, 10, 100, 1000]) {
      expect(zohPhaseLag(Ts, w)).toBeCloseTo(-w * Ts * 0.5, 15)
      // Which is exactly the phase of a delay of half a sample.
      expect(zohPhaseLag(Ts, w)).toBeCloseTo(-w * zohDelay(Ts), 15)
    }
  })

  it('the hold\'s magnitude is the sinc, and it is zero at the sample rate', () => {
    const Ts = 0.01
    expect(zohGain(Ts, 0)).toBeCloseTo(Ts, 15)
    expect(Math.abs(zohGain(Ts, (2 * Math.PI) / Ts))).toBeLessThan(1e-17)
    // Half way to the sample rate the hold has lost 3.92 dB.
    const half = zohGain(Ts, Math.PI / Ts) / Ts
    expect(20 * Math.log10(half)).toBeCloseTo(-3.9224, 3)
  })

  it('the hold is DECLINED as a transfer function in s, with the reason', () => {
    let err = null
    try {
      zohTransferFunction()
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(DiscreteError)
    expect(err.code).toBe('zoh-not-rational')
    expect(err.message).toBe(ZOH_TF_DECLINED)
    expect(ZOH_TF_DECLINED).toMatch(/no finite poles or zeros/)
    expect(ZOH_TF_DECLINED).toMatch(/Pade version would be a different object/)
  })
})

describe('the sampled plant is exact', () => {
  it('INVARIANT: a first-order plant under a hold matches the closed form, and the continuous step at the sample instants', () => {
    const rand = rng(19086)
    let worstCoeff = 0
    let worstStep = 0
    for (let trial = 0; trial < 300; trial++) {
      const tau = Math.pow(10, -3 + 4 * rand())
      const K = 0.1 + 10 * rand()
      // Sample times from a tenth of the time constant to three times it, so
      // both the well-sampled and the badly-sampled ends are covered.
      const Ts = tau * (0.1 + 3 * rand())
      const Pz = discretize({ b: [K], a: [tau, 1] }, Ts)

      // Closed form: H(z) = K(1 - alpha) / (z - alpha), alpha = e^(-Ts/tau).
      const alpha = Math.exp(-Ts / tau)
      const want = { b: [0, K * (1 - alpha)], a: [1, -alpha] }
      for (let i = 0; i < 2; i++) {
        const sc = Math.max(Math.abs(want.b[i]), Math.abs(want.a[i]), 1e-300)
        worstCoeff = Math.max(
          worstCoeff,
          Math.abs(Pz.b[i] - want.b[i]) / sc,
          Math.abs(Pz.a[i] - want.a[i]) / sc,
        )
      }

      // And the sampled step equals the continuous plant's own step at kTs.
      const steps = 24
      const { y } = stepDiscreteTF(Pz, steps)
      for (let k = 0; k < steps; k++) {
        const exact = K * (1 - Math.exp((-k * Ts) / tau))
        worstStep = Math.max(worstStep, Math.abs(y[k] - exact) / K)
      }
    }
    expect(worstCoeff, 'worst coefficient error against the closed form').toBeLessThan(1e-12)
    expect(worstStep, 'worst step error at the sample instants').toBeLessThan(1e-12)
  })

  it('INVARIANT: the discrete loop\'s step equals the continuous loop\'s at the sample instants', () => {
    // The loop that matters: a computer reads y each sample, computes
    // Kp times the error, and holds that drive until the next sample. The
    // discrete model of that loop and a continuous simulation of the plant
    // driven by the same staircase must agree exactly, sample by sample.
    const rand = rng(51191)
    let worst = 0
    for (let trial = 0; trial < 120; trial++) {
      const tau = Math.pow(10, -2 + 3 * rand())
      const K = 0.2 + 4 * rand()
      const Ts = tau * (0.05 + 0.9 * rand())
      const Kp = 0.2 + 3 * rand()
      const plant = { b: [K], a: [tau, 1] }
      const loop = discreteLoop(plant, { b: [Kp], a: [1] }, Ts)
      if (!isStableDiscrete(loop.closed)) continue
      const steps = 40
      const digital = stepDiscreteTF(loop.closed, steps)

      // The same loop, run one sample at a time with the drive held between
      // samples: the definition the discrete model claims to be. The state is
      // advanced by the plant's own exact hold map, computed from the
      // continuous matrices rather than from the loop being checked.
      const ss = toStateSpace(plant)
      const dss = zoh(ss, Ts)
      let x = new Array(ss.n).fill(0)
      const held = []
      for (let k = 0; k < steps; k++) {
        const y = ss.C.reduce((s, c, i) => s + c * x[i], 0)
        held.push(y)
        const u = Kp * (1 - y)
        x = dss.A.map((row) => row.reduce((s, v, j) => s + v * x[j], 0)).map((v, i) => v + dss.B[i] * u)
      }
      for (let k = 0; k < steps; k++) worst = Math.max(worst, Math.abs(digital.y[k] - held[k]))
    }
    expect(worst, 'worst disagreement between the discrete loop and the held continuous one').toBeLessThan(1e-10)
  })

  it('the sampled second-order plant matches its own continuous response at the instants', () => {
    const tf = { b: [100], a: [1, 3, 100] }
    const Ts = 0.02
    const Pz = discretize(tf, Ts)
    const steps = 60
    const { y } = stepDiscreteTF(Pz, steps)
    const cont = ssTrajectory(toStateSpace(tf), () => 1, { duration: Ts * (steps - 1), points: steps })
    for (let k = 0; k < steps; k++) expect(y[k], `sample ${k}`).toBeCloseTo(cont.y[k], 9)
  })

  it('the state-space route and the difference equation agree', () => {
    const tf = { b: [1, 2], a: [1, 3, 2] }
    const Ts = 0.1
    const dss = zoh(toStateSpace(tf), Ts)
    const a = stepDiscrete(dss, { steps: 40 })
    const b = stepDiscreteTF(toTransferFunction(dss), 40)
    for (let k = 0; k < 40; k++) expect(a.y[k]).toBeCloseTo(b.y[k], 10)
  })

  it('a pole in z maps back to the s pole it came from', () => {
    const tau = 0.4
    const Ts = 0.05
    const Pz = discretize({ b: [1], a: [tau, 1] }, Ts)
    const [z] = roots(Pz.a)
    const s = sOfZ(z, Ts)
    expect(s[0]).toBeCloseTo(-1 / tau, 10)
    expect(s[1]).toBeCloseTo(0, 12)
  })

  it('stability in z is the unit circle, and it is the left half plane in s', () => {
    const Ts = 0.1
    expect(isStableDiscrete(discretize({ b: [1], a: [1, 1] }, Ts))).toBe(true)
    // An unstable plant discretises to a pole outside the circle.
    const up = discretize({ b: [1], a: [1, -1] }, Ts)
    expect(isStableDiscrete(up)).toBe(false)
    expect(Math.hypot(...roots(up.a)[0])).toBeCloseTo(Math.exp(Ts), 9)
  })

  it('a sample time of zero or less is declined', () => {
    expect(() => discretize({ b: [1], a: [1, 1] }, 0)).toThrow(/must be positive/)
    expect(() => emulate({ b: [1], a: [1, 1] }, -1)).toThrow(/must be positive/)
  })
})

describe('emulation is a different object, and it is labelled one', () => {
  it('each rule substitutes the operator a textbook writes', () => {
    const Ts = 0.1
    const C = { b: [1, 2], a: [1, 0] } // PI: (s + 2) / s
    const t = emulate(C, Ts, 'tustin')
    expect(t.b[0]).toBeCloseTo(1.1, 12)
    expect(t.b[1]).toBeCloseTo(-0.9, 12)
    expect(t.a).toEqual([1, -1])
    const b = emulate(C, Ts, 'backward')
    expect(b.b[0]).toBeCloseTo(1.2, 12)
    expect(b.b[1]).toBeCloseTo(-1, 12)
    const f = emulate(C, Ts, 'forward')
    expect(f.b[0]).toBeCloseTo(1, 12)
    expect(f.b[1]).toBeCloseTo(-0.8, 12)
  })

  it('every emulated object carries its label, its rule and its sample time', () => {
    for (const method of ['tustin', 'backward', 'forward']) {
      const out = emulate({ b: [1], a: [1, 1] }, 0.05, method)
      expect(out.approximate).toBe(true)
      expect(out.method).toBe(method)
      expect(out.Ts).toBe(0.05)
    }
  })

  it('an unknown rule is declined by name', () => {
    expect(() => emulate({ b: [1], a: [1, 1] }, 0.1, 'zoh')).toThrow(/tustin, backward and forward/)
  })

  it('forward Euler can turn a stable controller into an unstable difference equation', () => {
    // s = (z - 1)/T maps the left half plane onto the half plane left of z = 1,
    // which is not inside the unit circle. A fast pole crosses out.
    const fast = { b: [100], a: [1, 100] } // pole at -100
    const Ts = 0.05 // 5 time constants per sample
    const f = emulate(fast, Ts, 'forward')
    expect(isStableDiscrete(f)).toBe(false)
    // Tustin, which maps the half plane onto the disc, keeps it stable at the
    // same sample time.
    expect(isStableDiscrete(emulate(fast, Ts, 'tustin'))).toBe(true)
    expect(isStableDiscrete(emulate(fast, Ts, 'backward'))).toBe(true)
  })

  it('INVARIANT: tustin and backward keep a stable controller stable, fuzzed', () => {
    const rand = rng(9911)
    let checked = 0
    for (let trial = 0; trial < 200; trial++) {
      const p1 = -Math.pow(10, -1 + 3 * rand())
      const p2 = -Math.pow(10, -1 + 3 * rand())
      const z1 = -Math.pow(10, -1 + 3 * rand())
      const tf = { b: polyMul([1, -z1], [0.5 + rand()]), a: polyMul([1, -p1], [1, -p2]) }
      const Ts = Math.pow(10, -3 + 3 * rand())
      expect(isStable(tf)).toBe(true)
      expect(isStableDiscrete(emulate(tf, Ts, 'tustin')), `trial ${trial} tustin`).toBe(true)
      expect(isStableDiscrete(emulate(tf, Ts, 'backward')), `trial ${trial} backward`).toBe(true)
      checked++
    }
    expect(checked).toBe(200)
  })

  it('the guard holds above the threshold and states the reason below it', () => {
    const plant = { b: [1], a: [1, 1] }
    const L = series({ b: [5], a: [1] }, plant)
    const fc = margins(L, GRID).gainCrossover
    expect(fc).toBeGreaterThan(0)
    // Fast enough: the threshold is samples per cycle at crossover.
    const fast = emulationGuard(fc, 1 / (fc * 200))
    expect(fast.samplesPerCycle).toBeCloseTo(200, 6)
    expect(fast.holds).toBe(true)
    expect(fast.reason).toBeNull()
    // Right at the threshold it still holds, and just below it does not.
    expect(emulationGuard(fc, 1 / (fc * SAMPLES_PER_CYCLE)).holds).toBe(true)
    const slow = emulationGuard(fc, 1 / (fc * (SAMPLES_PER_CYCLE - 1)))
    expect(slow.holds).toBe(false)
    expect(slow.reason).toMatch(/samples per cycle at crossover/)
    expect(slow.reason).toMatch(/Design in z instead/)
    // The phase the hold costs is reported either way, and at the threshold it
    // is 360 / (2 * 20) = 9 degrees.
    expect(emulationGuard(fc, 1 / (fc * SAMPLES_PER_CYCLE)).phaseLagDeg).toBeCloseTo(9, 9)
  })

  it('a loop with no crossover gets the reason and no number', () => {
    const g = emulationGuard(null, 0.1)
    expect(g.holds).toBe(false)
    expect(g.samplesPerCycle).toBeNull()
    expect(g.reason).toMatch(/no gain crossover/)
  })

  it('the digital loop\'s step drifts from the continuous design\'s in proportion to the sample time', () => {
    // Design in s, then run in z. The comparison is over a fixed twelve
    // seconds, so a faster rate is compared over the same stretch of the
    // response rather than a shorter one.
    const plant = { b: [1], a: polyMul([1, 1], [0.2, 1]) }
    const C = { b: [2, 4], a: [1, 0] }
    const fc = margins(series(C, plant), GRID).gainCrossover
    const contSS = toStateSpace(closeLoop(series(C, plant)))
    const DURATION = 12
    const errorAt = (perCycle) => {
      const Ts = 1 / (fc * perCycle)
      const steps = Math.ceil(DURATION / Ts) + 1
      const digital = discreteLoop(plant, emulate(C, Ts, 'tustin'), Ts)
      const dz = stepDiscreteTF(digital.closed, steps)
      const cont = ssTrajectory(contSS, () => 1, { duration: Ts * (steps - 1), points: steps })
      let worst = 0
      for (let k = 0; k < steps; k++) worst = Math.max(worst, Math.abs(dz.y[k] - cont.y[k]))
      return worst
    }
    const rates = [400, 200, 100, 50, SAMPLES_PER_CYCLE, 10, 4]
    const errs = rates.map(errorAt)
    // Monotone: every halving of the rate makes the disagreement worse.
    for (let i = 1; i < errs.length; i++) expect(errs[i], `at ${rates[i]} per cycle`).toBeGreaterThan(errs[i - 1])
    // And proportional to the sample time, which is what a half-sample delay
    // predicts: halving the rate doubles the error, to within five per cent.
    for (let i = 1; i < 4; i++) {
      expect(errs[i] / errs[i - 1], `${rates[i - 1]} to ${rates[i]}`).toBeGreaterThan(1.9)
      expect(errs[i] / errs[i - 1], `${rates[i - 1]} to ${rates[i]}`).toBeLessThan(2.1)
    }
    // At the threshold the two loops still tell the same story, and at a fifth
    // of that rate they do not.
    const atGuard = errs[rates.indexOf(SAMPLES_PER_CYCLE)]
    expect(atGuard).toBeLessThan(0.15)
    expect(errs[errs.length - 1]).toBeGreaterThan(3 * atGuard)
  })
})

describe('the discrete loop', () => {
  it('is the same polynomial algebra as the continuous one', () => {
    const Ts = 0.1
    const plant = { b: [1], a: [1, 1] }
    const loop = discreteLoop(plant, { b: [3], a: [1] }, Ts)
    const Pz = discretize(plant, Ts)
    loop.open.b.forEach((v, i) => expect(v / 3).toBeCloseTo(Pz.b[i], 15))
    // T = L / (1 + L), and the error path is 1 / (1 + L).
    expect(loop.closed.a.length).toBe(loop.open.a.length)
    expect(loop.error.b).toEqual(loop.open.a)
  })

  it('raising the sample time destabilises a loop that is stable when sampled fast', () => {
    const plant = { b: [1], a: polyMul([1, 1], [0.5, 1]) }
    const C = { b: [8], a: [1] }
    expect(isStable(closeLoop(series(C, plant)))).toBe(true)
    expect(isStableDiscrete(discreteLoop(plant, { b: [8], a: [1] }, 0.01).closed)).toBe(true)
    // Sampled slowly, the same gain no longer holds: the hold's own lag has
    // eaten the margin.
    expect(isStableDiscrete(discreteLoop(plant, { b: [8], a: [1] }, 0.9).closed)).toBe(false)
  })

  it('simulateDiscrete runs an arbitrary input sequence', () => {
    const dss = zoh(toStateSpace({ b: [1], a: [1, 1] }), 0.2)
    const impulse = simulateDiscrete(dss, (k) => (k === 0 ? 1 : 0), { steps: 10 })
    const step = stepDiscrete(dss, { steps: 10 })
    // The step is the running sum of the impulse response, exactly.
    let acc = 0
    for (let k = 0; k < 10; k++) {
      acc += impulse.y[k]
      expect(step.y[k]).toBeCloseTo(acc, 10)
    }
  })
})
