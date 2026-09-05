import { defaultsOf, PLANTS, CONTROLLERS } from '../systems.js'

// Group B: the sampled loop.
//
// One plant, one gain, one sample time. The plant is the first-order lag,
// chosen because its continuous loop cannot be destabilised by any gain at all.
// Everything this group shows about sampling is therefore about sampling.

const pp = (id, over = {}) => ({ ...defaultsOf(PLANTS[id]), ...over })
const cp = (id, over = {}) => ({ ...defaultsOf(CONTROLLERS[id]), ...over })

export const GROUP_B = 'The sampled loop'

// The gain that puts the closed-loop pole exactly at the origin of the
// z-plane, for the lag and sample time B5 uses. Written as the closed form
// rather than as the 9.50833 the plan quotes, because a rounded gain leaves
// the pole a little off the origin and the response a little short of
// deadbeat, which is the one thing B5 is claiming.
const DEADBEAT_ALPHA = Math.exp(-0.1 / 1)
const DEADBEAT_KP = DEADBEAT_ALPHA / (1 - DEADBEAT_ALPHA)

const lagAt = (Ts, kp, over = {}) => ({
  mode: 'sampled',
  plantId: 'firstOrder',
  plantP: pp('firstOrder'),
  ctrlId: 'p',
  ctrlP: cp('p', { kp }),
  Ts,
  emulation: 'tustin',
  duration: 4,
  view: 'sampled',
  ...over,
})

export default [
  {
    id: 'B1',
    group: GROUP_B,
    name: 'What the loop sees',
    see:
      'A lag with τ = 1 s under proportional control, read every 100 ms. The output is a smooth curve, the ' +
      'sample instants are marked on it, and the drive below is a staircase. The controller reads only the ' +
      'marks, and the plant is driven only by the staircase.',
    try: [
      { say: 'Raise the sample time to 400 ms. The staircase coarsens and the output lags it.', set: { Ts: 0.4 } },
      { say: 'Lower it to 20 ms. The staircase becomes the curve again.', set: { Ts: 0.02 } },
    ],
    why:
      'Two things happen at once and they are worth keeping apart. The sampler throws away everything between ' +
      'the marks, which is Signal Lab’s subject. The hold turns each sample into a rectangle a whole ' +
      'sample wide, which is this lab’s. The discrete model of the pair is exact. Its output equals the ' +
      'continuous plant’s at every sample instant to floating point, because both come from the same ' +
      'matrix exponential rather than from a discretisation rule.',
    terms: ['sample', 'zoh', 'discretemodel', 'staircase'],
    patch: lagAt(0.1, 3),
    claim: (a) => {
      const s = a.sampled
      const tau = a.state.plantP.tau
      const k = a.state.plantP.k
      const alpha = Math.exp(-s.Ts / tau)
      return [
        { name: 'the pole in z is e to the minus T over tau', value: s.alpha, want: alpha, tol: 1e-12 },
        { name: 'the numerator is K times one minus that', value: s.Pz.b[1], want: k * (1 - alpha), tol: 1e-12 },
        { name: 'the sampled plant matches the continuous one at every instant', value: s.plantDisagreement, wantBelow: 1e-12 },
      ]
    },
  },

  {
    id: 'B2',
    group: GROUP_B,
    name: 'The hold costs half a sample',
    see:
      'The same loop, with the hold’s own phase drawn beside the loop’s. At Ts = 100 ms the hold ' +
      'delays every frequency by 50 ms. At the loop’s crossover of 2.83 rad/s that is 8.1 degrees of ' +
      'phase, and the margin drops by exactly that much.',
    try: [
      { say: 'Raise Ts until there are 20 samples per cycle at crossover. The lag reads 9.0 degrees.', set: { perCycle: 20 } },
      { say: 'Raise it to 5 samples per cycle. The lag reads 36 degrees and the guard fails.', set: { perCycle: 5 } },
    ],
    why:
      'Holding a sample for a whole period puts its energy on average half a period late, so the hold is a ' +
      'delay of T/2. Its phase is −ωT/2 at every frequency, exactly. Its magnitude is a sinc, ' +
      'down 3.92 dB half way to the sample rate. What the hold is not is a transfer function in s. ' +
      '(1 − e^(−sT))/s has no finite poles or zeros, so this suite declines to carry it as one and ' +
      'returns its magnitude and phase as the numbers they are.',
    terms: ['zoh', 'halfsample', 'phasemargin', 'crossover'],
    patch: lagAt(0.1, 3),
    claim: (a) => {
      const s = a.sampled
      const wc = 2 * Math.PI * a.margins.gainCrossover
      return [
        { name: 'the delay is half a sample', value: s.holdDelay, want: s.Ts / 2, tol: 1e-15 },
        { name: 'the lag at crossover', value: s.holdLagDeg, want: ((wc * s.Ts) / 2) * (180 / Math.PI), tol: 1e-9 },
        { name: 'the crossover is where three over the lag is one', value: wc, want: Math.sqrt(9 - 1), tol: 1e-6 },
      ]
    },
  },

  {
    id: 'B3',
    group: GROUP_B,
    name: 'The plant, sampled exactly',
    see:
      'The z-plane, with the sampled plant’s pole on it. At τ = 1 s and Ts = 100 ms the plant becomes ' +
      '0.0951626/(z − 0.904837). Beside it the s-plane shows the pole it came from, at −1 rad/s. The map ' +
      'between them is z = e^(sT).',
    try: [
      { say: 'Raise Ts to 500 ms. The z pole moves to 0.6065, further from the rim.', set: { Ts: 0.5 } },
      { say: 'Lower it to 20 ms. The pole climbs to 0.9802, close to z = 1.', set: { Ts: 0.02 } },
    ],
    why:
      'Under a hold, a pole at s = −1/τ becomes a pole at z = e^(−T/τ), and the numerator ' +
      'follows from the same integral. The whole left half plane maps inside the unit circle, so stability in ' +
      's becomes stability in z. Sampling faster pushes every pole towards z = 1, which is why a fast-sampled ' +
      'system has poles crowded near the rim and a slow-sampled one spreads them out. Signal Lab draws the ' +
      'same circle for the same reason.',
    terms: ['zplane', 'unitcircle', 'zoh', 'pole'],
    patch: lagAt(0.1, 3, { view: 'zplane' }),
    claim: (a) => {
      const s = a.sampled
      const tau = a.state.plantP.tau
      const back = s.sOfPoles
      return [
        { name: 'the plant pole in z', value: s.plantZ.poles[0][0], want: Math.exp(-s.Ts / tau), tol: 1e-12 },
        { name: 'and the s pole it came from', value: back.length ? back[0][0] : 0, wantBelow: 0 },
        { name: 'the sampled plant is stable', value: Math.hypot(...s.plantZ.poles[0]), wantBelow: 1 },
      ]
    },
  },

  {
    id: 'B4',
    group: GROUP_B,
    name: 'Sampling breaks a loop that cannot break',
    see:
      'The loop is one pole and one gain. In continuous time it is stable at every gain there is, up to a ' +
      'million and past it. Sampled at 100 ms it goes unstable at Kp = 20.0167. The verdict badge flips while the ' +
      'continuous one beside it does not.',
    try: [
      { say: 'Set Kp to 20. The digital loop still holds, barely.', set: { kp: 20 } },
      { say: 'Set Kp to 21. The digital loop diverges and the continuous one does not.', set: { kp: 21 } },
      { say: 'Set Ts to 20 ms at Kp = 21. The digital loop is stable again.', set: { Ts: 0.02, kp: 21 } },
    ],
    why:
      'The discrete closed-loop pole sits at α − Kp(1 − α) with α = e^(−T/τ). It ' +
      'leaves the unit circle when Kp exceeds (1 + α)/(1 − α), which is coth(T/2τ). Sampling ' +
      'ten times per time constant gives 20.0167. The continuous loop has no such bound, because one pole ' +
      'can only ever spend 90 degrees of phase. The hold spends the rest, and the faster the sampling the ' +
      'more gain the loop can take.',
    terms: ['sample', 'zoh', 'stability', 'unitcircle'],
    patch: lagAt(0.1, 10, { view: 'zplane' }),
    claim: (a) => {
      const s = a.sampled
      const tau = a.state.plantP.tau
      const alpha = Math.exp(-s.Ts / tau)
      const critical = (1 + alpha) / (1 - alpha)
      return [
        { name: 'the digital bound is coth of T over two tau', value: critical, want: 1 / Math.tanh(s.Ts / (2 * tau)), tol: 1e-9 },
        { name: 'and it is 20.0167 at these settings', value: critical, want: 20.0167, tol: 1e-3 },
        { name: 'the loop at this gain is stable', value: s.stableDiscrete ? 1 : 0, want: 1, tol: 0 },
        { name: 'the continuous loop is stable too', value: s.stableContinuous ? 1 : 0, want: 1, tol: 0 },
      ]
    },
    sweep: {
      knob: 'kp',
      at: [21, 40],
      claim: (a) => [
        { name: 'past the bound the digital loop diverges', value: a.sampled.stableDiscrete ? 1 : 0, want: 0, tol: 0 },
        { name: 'while the continuous one holds', value: a.sampled.stableContinuous ? 1 : 0, want: 1, tol: 0 },
      ],
    },
  },

  {
    id: 'B5',
    group: GROUP_B,
    name: 'Deadbeat, which only a sampled loop can do',
    see:
      'Put the closed-loop pole at z = 0. That needs Kp = 9.50833, and the output reaches its final value in ' +
      'exactly one sample and stays there. No continuous loop does that. It settles 9.516 per cent short, ' +
      'because proportional control still leaves an error.',
    try: [
      { say: 'Set Kp to 5. The pole moves off zero and the output takes several samples.', set: { kp: 5 } },
      { say: 'Set Kp to 15. The pole goes negative and the output rings sample by sample.', set: { kp: 15 } },
    ],
    why:
      'A pole at the origin in z means a mode that is gone after one step, because zᵏ is zero for every ' +
      'k above zero. Continuous time has no such point. e^(st) reaches zero only as s goes to minus infinity, ' +
      'which is infinite gain. Sampling makes finite-time settling reachable with a finite gain. The price is ' +
      'that the drive at the first sample is the whole correction at once, which a real actuator may not have.',
    terms: ['deadbeat', 'zplane', 'unitcircle', 'steadystate'],
    patch: lagAt(0.1, DEADBEAT_KP, { view: 'zplane' }),
    claim: (a) => {
      const s = a.sampled
      const tau = a.state.plantP.tau
      const alpha = Math.exp(-s.Ts / tau)
      const deadbeat = alpha / (1 - alpha)
      const y = s.digital.y
      return [
        { name: 'the deadbeat gain is alpha over one minus alpha', value: deadbeat, want: 9.50833, tol: 1e-4 },
        { name: 'the first sample is still zero', value: y[0], want: 0, tol: 1e-12 },
        { name: 'the second sample is already the final value', value: y[1], want: y[y.length - 1], tol: 1e-9 },
        { name: 'and it lands short by one minus alpha', value: 1 - y[1], want: 1 - alpha, tol: 1e-4 },
      ]
    },
  },

  {
    id: 'B6',
    group: GROUP_B,
    name: 'Emulation, and where it stops',
    see:
      'A PI designed in s, substituted into z by the trapezoid rule, and run against the exactly discretised ' +
      'plant. At 400 samples per cycle the step differs from the continuous design by 0.5 per cent. At 20 it ' +
      'is 10.8 per cent, and the guard says so. At 4 it is 49 per cent.',
    try: [
      { say: 'Set 50 samples per cycle. The disagreement halves to 4.2 per cent.', set: { perCycle: 50 } },
      { say: 'Set 10. It doubles to 22.3 per cent, and the guard has already failed.', set: { perCycle: 10 } },
    ],
    why:
      'Emulation replaces s by a difference operator, which makes a different object from the controller it ' +
      'came from. The suite gives it that label. Every emulated controller carries a flag, its rule and ' +
      'its sample time. The guard is twenty samples per cycle at the loop’s crossover, the same ' +
      'threshold the sampled-filter link already refuses below. The disagreement is proportional to the ' +
      'sample time, which is what a half-sample delay predicts, so halving the rate doubles it.',
    terms: ['emulation', 'tustin', 'zoh', 'guard'],
    patch: {
      mode: 'sampled',
      plantId: 'twoLag',
      plantP: pp('twoLag', { t1: 1, t2: 0.2 }),
      ctrlId: 'pi',
      ctrlP: cp('pi', { kp: 2, ki: 4 }),
      perCycle: 20,
      emulation: 'tustin',
      duration: 12,
      view: 'sampled',
    },
    claim: (a) => {
      const s = a.sampled
      return [
        { name: 'the controller is labelled an approximation', value: s.controllerZ.approximate ? 1 : 0, want: 1, tol: 0 },
        { name: 'and carries its rule', value: s.controllerZ.method === 'tustin' ? 1 : 0, want: 1, tol: 0 },
        { name: 'the guard sits exactly on its threshold', value: s.guard.samplesPerCycle, want: s.guard.threshold, tol: 0.05 },
        { name: 'and the disagreement is about a tenth of the step', value: s.disagreement, want: 0.108, tol: 0.02 },
      ]
    },
  },

  {
    id: 'B7',
    group: GROUP_B,
    name: 'Forward Euler, and the rule that fails',
    see:
      'A fast lag with τ = 10 ms, emulated three ways at Ts = 20 ms. The trapezoid rule and the backward ' +
      'rule both give a stable difference equation. Forward Euler gives an unstable one, from a controller ' +
      'that was stable to begin with.',
    try: [
      { say: 'Set Ts to 5 ms. All three rules are stable again.', set: { Ts: 0.005 } },
      { say: 'Set Ts to 50 ms. Forward Euler is worse and the other two still hold.', set: { Ts: 0.05 } },
    ],
    why:
      'Each rule is a map from s to z, and what matters is where it sends the left half plane. The trapezoid ' +
      'rule sends it exactly onto the unit disc, so a stable controller emulates to a stable one at any rate. ' +
      'The backward rule sends it inside a smaller disc, which is stable and over-damped. Forward Euler sends ' +
      'it to the half plane left of z = 1, which reaches outside the circle. A pole at −1/τ survives ' +
      'only while Ts is below 2τ.',
    terms: ['emulation', 'tustin', 'forwardeuler', 'unitcircle'],
    patch: {
      mode: 'sampled',
      plantId: 'firstOrder',
      plantP: pp('firstOrder', { tau: 1 }),
      ctrlId: 'lag',
      ctrlP: cp('lag', { kc: 1, p: 100 }),
      Ts: 0.02,
      emulation: 'forward',
      duration: 0.5,
      view: 'zplane',
    },
    claim: (a) => {
      const s = a.sampled
      // The controller's own pole, and the bound the plan names. Forward Euler
      // maps a pole at -1/tau to 1 - Ts/tau, which leaves the unit circle at
      // Ts = 2 tau exactly.
      const tau = 1 / a.state.ctrlP.p
      return [
        { name: 'the trapezoid rule stays stable', value: s.rules.tustin.stable ? 1 : 0, want: 1, tol: 0 },
        { name: 'the backward rule stays stable', value: s.rules.backward.stable ? 1 : 0, want: 1, tol: 0 },
        { name: 'forward Euler does not', value: s.rules.forward.stable ? 1 : 0, want: 0, tol: 0 },
        { name: 'the sample time is at or past twice the time constant', value: s.Ts, want: 2 * tau, tol: 1e-12 },
        { name: 'and the forward pole has left the unit circle', value: Math.abs(s.rules.forward.poles[0][0]), wantAbove: 1 - 1e-12 },
      ]
    },
    sweep: {
      knob: 'Ts',
      at: [0.005, 0.01, 0.05],
      claim: (a) => {
        const tau = 1 / a.state.ctrlP.p
        const past = a.state.Ts >= 2 * tau
        return [
          { name: 'the trapezoid rule holds at every rate', value: a.sampled.rules.tustin.stable ? 1 : 0, want: 1, tol: 0 },
          { name: 'the backward rule holds at every rate', value: a.sampled.rules.backward.stable ? 1 : 0, want: 1, tol: 0 },
          { name: 'forward Euler holds below twice the time constant and not above', value: a.sampled.rules.forward.stable ? 1 : 0, want: past ? 0 : 1, tol: 0 },
        ]
      },
    },
  },
]
