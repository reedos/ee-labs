import { defaultsOf, PLANTS, CONTROLLERS } from '../systems.js'

// Group A: the state.
//
// Every entry carries its physics (`patch`) and its three registers together,
// which is Control Lab's shape. `claim` is the list of rows experiments.test.js
// pins, and each row's `value` is computed from the analysis rather than typed
// in. A row whose `want` is a number the note also prints is the whole of the
// discipline here.

const pp = (id, over = {}) => ({ ...defaultsOf(PLANTS[id]), ...over })
const cp = (id, over = {}) => ({ ...defaultsOf(CONTROLLERS[id]), ...over })

export const GROUP_A = 'The state'

export default [
  {
    id: 'A1',
    group: GROUP_A,
    name: 'The state is the memory',
    see:
      'Two runs of the same motor with the drive held at zero. One starts at rest. The other starts with the ' +
      'rotor already turning at 1 rad/s. The position traces separate and stay separate, and nothing in the ' +
      'input accounts for the difference.',
    try: [
      {
        say: 'Set the second run to start at 2 rad/s. The gap doubles.',
        set: { compareStates: [[0, 0], [0, 2]] },
        reads: { 'ss.n': 2 },
      },
      {
        say: 'Set it to rest as well. The two traces lie on top of each other.',
        set: { compareStates: [[0, 0], [0, 0]] },
      },
    ],
    why:
      'The state is what the system carries from its past into its future. For this motor it is two numbers, ' +
      'the position and the speed, and knowing both at one instant fixes the whole future given the input. ' +
      'Elements F4 says the same thing about a first-order circuit, where the one state is the capacitor ' +
      'voltage. The formula is x(t) = e^(At)x(0) with no input at all, and the pane draws exactly that.',
    terms: ['state', 'statespace', 'statematrix', 'trajectory'],
    patch: {
      mode: 'state',
      plantId: 'motor',
      plantP: pp('motor'),
      ctrlId: 'p',
      ctrlP: cp('p'),
      view: 'state',
      design: { compareStates: [[0, 0], [0, 1]], input: 0, duration: 4 },
    },
    claim: (a) => {
      const runs = a.state_.trajectories
      const A = a.state_.ss.A
      // e^(At) x(0) at the last sample, from the closed form for this A.
      const t = runs[1].run.t[runs[1].run.t.length - 1]
      const tau = 0.5
      const wantPosition = 1 * tau * (1 - Math.exp(-t / tau))
      return [
        { name: 'the resting run stays at zero', value: Math.max(...runs[0].run.y.map(Math.abs)), want: 0, tol: 1e-12 },
        {
          name: 'the moving run coasts to tau times its speed',
          value: runs[1].run.y[runs[1].run.y.length - 1],
          want: wantPosition,
          tol: 1e-9,
        },
        { name: 'the state matrix has two states', value: A.length, want: 2, tol: 0 },
      ]
    },
  },

  {
    id: 'A2',
    group: GROUP_A,
    name: 'The state equation from a circuit',
    see:
      'The RC of Elements F4, written as one line. The capacitor voltage is the state, because a capacitor ' +
      'voltage cannot jump. The equation reads x′ = −x/τ + Ku/τ, and its one pole sits at ' +
      '−1/τ.',
    try: [
      { say: 'Set τ to 0.2 s. The pole moves to −5 rad/s and the response is five times faster.', set: { tau: 0.2 } },
      { say: 'Set τ back to 1 s.', set: { tau: 1 } },
    ],
    why:
      'A state is a quantity the circuit cannot change instantly. A capacitor voltage is one, because changing ' +
      'it needs charge and charge takes current and time. An inductor current is one for the same reason. ' +
      'Counting those quantities counts the states, and writing one derivative equation for each gives ' +
      'x′ = Ax + Bu. The roots of det(sI − A) are the poles Circuit Lab computes from the same ' +
      'circuit, which Elements G1 already writes out.',
    terms: ['state', 'statespace', 'statematrix', 'pole'],
    patch: {
      mode: 'state',
      plantId: 'firstOrder',
      plantP: pp('firstOrder'),
      ctrlId: 'p',
      ctrlP: cp('p'),
      view: 'state',
      design: {},
    },
    claim: (a) => {
      const tau = a.state.plantP.tau
      const eig = a.state_.ss.A[0][0]
      const back = a.state_.fromSs
      return [
        { name: 'the pole is at minus one over tau', value: eig, want: -1 / tau, tol: 1e-12 },
        { name: 'the state space returns the plant', value: back.b[back.b.length - 1] / back.a[back.a.length - 1], want: 1, tol: 1e-12 },
        { name: 'and its own pole', value: back.a[1], want: 1 / tau, tol: 1e-12 },
      ]
    },
  },

  {
    id: 'A3',
    group: GROUP_A,
    name: 'Two views, one object',
    see:
      'The same motor is written down twice. On the left its speed is measured in radians a second, and on ' +
      'the right in degrees a second. The state matrix changes and so does the drive matrix. The transfer function is ' +
      '2/(s² + 2s) in both.',
    try: [
      { say: 'Set τ to 0.25 s. Both bases change again, and both still give one H(s).', set: { tau: 0.25 } },
      { say: 'Set τ back to 0.5 s.', set: { tau: 0.5 } },
    ],
    why:
      'A change of coordinates x = Tz turns A into T⁻¹AT and leaves the transfer function alone. Measuring ' +
      'speed in degrees rather than radians is exactly such a change. So the state is a choice and the ' +
      'transfer function is not. That is why a plant can be handed between two tools as six coefficients, and ' +
      'why two engineers writing the same motor down can disagree about A without either being wrong. What ' +
      'they cannot disagree about is where the poles are. The controllable canonical form is a third basis, ' +
      'and for this motor it happens to come out equal to the physical one. That is a fact about this plant ' +
      'rather than a rule.',
    terms: ['state', 'statespace', 'statematrix', 'similarity', 'canonicalform', 'transferfunction', 'controllability'],
    patch: {
      mode: 'state',
      plantId: 'motor',
      plantP: pp('motor'),
      ctrlId: 'p',
      ctrlP: cp('p'),
      view: 'state',
      design: {},
    },
    claim: (a) => {
      const phys = a.state_.fromSs
      const other = a.state_.fromRotated
      const norm = (tf) => ({ b: tf.b.map((v) => v / tf.a[0]), a: tf.a.map((v) => v / tf.a[0]) })
      const rows = []
      const pb = norm(phys)
      const ob = norm(other)
      for (let i = 0; i < pb.b.length; i++) {
        rows.push({ name: `numerator ${i} agrees`, value: pb.b[i], want: ob.b[i], tol: 1e-9 })
      }
      for (let i = 0; i < pb.a.length; i++) {
        rows.push({ name: `denominator ${i} agrees`, value: pb.a[i], want: ob.a[i], tol: 1e-9 })
      }
      // And the two descriptions really are different descriptions. A test
      // that only checked the transfer functions would pass on two copies of
      // the same matrix, which is the defect A3 originally shipped with.
      const A = a.state_.ss.A
      const B = a.state_.rotated.A
      let worst = 0
      for (let i = 0; i < A.length; i++) {
        for (let j = 0; j < A.length; j++) worst = Math.max(worst, Math.abs(A[i][j] - B[i][j]))
      }
      rows.push({ name: 'the two state matrices differ', value: worst, wantAbove: 0.5 })
      rows.push({
        name: 'and so do the drive matrices',
        value: Math.abs(a.state_.ss.B[1] - a.state_.rotated.B[1]),
        wantAbove: 0.5,
      })
      return rows
    },
  },

  {
    id: 'A4',
    group: GROUP_A,
    name: 'Controllability is a rank',
    see:
      'Two identical lags driven by one input, measured as their difference. The controllability matrix has ' +
      'rank 1 of 2, and its smaller singular value is exactly zero. No input can ever make the two sections ' +
      'differ, so half the state space is out of reach.',
    try: [
      { say: 'Detune the second section by 0.1 per cent. The rank returns and the condition is 4002.', set: { detune: 0.001 } },
      { say: 'Detune by 1 per cent. The condition falls to 402.', set: { detune: 0.01 } },
      { say: 'Detune by 10 per cent. The condition falls to 42.1.', set: { detune: 0.1 } },
    ],
    why:
      'Controllability asks whether the input can reach every state, and the answer is the rank of ' +
      '[B, AB, ..., Aⁿ⁻¹B]. Full rank means every state is reachable in finite time, and it is ' +
      'the exact condition for pole placement to have a solution. The rank alone is a blunt reading. Two ' +
      'sections a tenth of a per cent apart are reachable in principle, and they need a gain four thousand ' +
      'times larger in one direction than the other. The condition number says that and the rank does not.',
    terms: ['controllability', 'rank', 'conditionnumber', 'singularvalue', 'statespace', 'statefeedback'],
    patch: {
      mode: 'state',
      plantId: 'twin',
      plantP: pp('twin'),
      ctrlId: 'p',
      ctrlP: cp('p'),
      view: 'state',
      design: { method: 'place', wn: 2, zeta: 0.7 },
    },
    claim: (a) => {
      const c = a.state_.ctrl
      return [
        { name: 'the rank is one of two', value: c.rank, want: 1, tol: 0 },
        { name: 'the smaller singular value is zero', value: c.singularValues[1], want: 0, tol: 1e-12 },
        { name: 'and the placement is declined', value: a.state_.declined?.code === 'uncontrollable' ? 1 : 0, want: 1, tol: 0 },
      ]
    },
    sweep: {
      knob: 'detune',
      at: [0.001, 0.01, 0.1],
      claim: (a) => [{ name: 'the rank returns', value: a.state_.ctrl.rank, want: 2, tol: 0 }],
    },
  },

  {
    id: 'A5',
    group: GROUP_A,
    name: 'Pole placement',
    see:
      'The motor with both states fed back, and the closed-loop pair placed at ωₙ = 4 rad/s and ' +
      'ζ = 0.7. Ackermann’s formula gives K = [8, 1.8] exactly. The step overshoots 4.60 per cent, ' +
      'which is what ζ = 0.7 gives.',
    try: [
      { say: 'Set ζ to 1. The overshoot goes to zero and the rise is slower.', set: { zeta: 1 } },
      { say: 'Set ζ to 0.4. The overshoot rises to 25.4 per cent.', set: { zeta: 0.4 } },
      { say: 'Set ωₙ to 8 rad/s at ζ = 0.7. The shape holds and the time halves.', set: { wn: 8, zeta: 0.7 } },
    ],
    why:
      'With every state measured and fed back, u = −Kx makes the closed-loop matrix A − BK. Its ' +
      'characteristic polynomial has n coefficients and K has n entries, so the poles can be put anywhere a ' +
      'real polynomial allows. That is a stronger result than the root locus, which slides poles along fixed ' +
      'branches. The price is that every state has to be measured, and A6 is what to do when they are not. ' +
      'One thing state feedback does not fix is where the output settles. The DC gain of the placed loop is ' +
      '0.125, so the reference needs a scaling of 8 before the output arrives at 1.',
    terms: ['statefeedback', 'ackermann', 'controllability', 'zeta', 'wn'],
    patch: {
      mode: 'state',
      plantId: 'motor',
      plantP: pp('motor'),
      ctrlId: 'p',
      ctrlP: cp('p'),
      view: 'state',
      design: { method: 'place', wn: 4, zeta: 0.7, duration: 3 },
    },
    claim: (a) => {
      const d = a.state.design
      const K = a.state_.place.K
      const tau = a.state.plantP.tau
      const k = a.state.plantP.k
      // A - BK for A = [[0,1],[0,-1/tau]] and B = [0, k/tau] gives
      // s^2 + (1/tau + k K2 / tau) s + k K1 / tau, matched to wn and zeta.
      const wantK1 = (d.wn * d.wn * tau) / k
      const wantK2 = (2 * d.zeta * d.wn * tau - 1) / k
      const wantOvershoot = Math.exp((-Math.PI * d.zeta) / Math.sqrt(1 - d.zeta * d.zeta))
      return [
        { name: 'the position gain', value: K[0], want: wantK1, tol: 1e-9 },
        { name: 'the speed gain', value: K[1], want: wantK2, tol: 1e-9 },
        { name: 'the achieved real part', value: a.state_.place.achieved[0][0], want: -d.zeta * d.wn, tol: 1e-6 },
        { name: 'the overshoot', value: a.state_.overshoot, want: wantOvershoot, tol: 0.01 },
        { name: 'the DC gain before scaling', value: a.state_.dcGain, want: 1 / wantK1, tol: 1e-9 },
      ]
    },
  },

  {
    id: 'A6',
    group: GROUP_A,
    name: 'The observer, and the duality',
    see:
      'The same motor with only its position measured. An observer runs a copy of the plant and corrects it ' +
      'with the measurement, and its error poles are placed four times faster than the controller’s, at ' +
      '−11.2 ± 11.43j. That gives L = [20.4, 215.2], and a wrong starting estimate is caught in ' +
      '0.357 s.',
    try: [
      { say: 'Set the observer factor to 2. L falls to [8.2, 45.2] and the catch takes twice as long.', set: { observerFactor: 2 } },
      { say: 'Set it to 8. L rises and the estimate catches in 0.179 s.', set: { observerFactor: 8 } },
      { say: 'Switch the plant to Split sections. The observer is declined, with the reason.', set: { plantId: 'split' } },
    ],
    why:
      'The observer error obeys e′ = (A − LC)e, so choosing L places the error’s poles the way ' +
      'choosing K places the loop’s. The two problems are the same problem. Placing on the transposed ' +
      'system (Aᵀ, Cᵀ) and transposing the answer gives L, which is why one routine serves both. The ' +
      'condition is observability rather than controllability, and it fails exactly when a mode leaves no ' +
      'trace in the output.',
    terms: ['observer', 'observability', 'duality', 'statefeedback', 'controllability', 'conditionnumber'],
    patch: {
      mode: 'state',
      plantId: 'motor',
      plantP: pp('motor'),
      ctrlId: 'p',
      ctrlP: cp('p'),
      view: 'state',
      design: { method: 'place', wn: 4, zeta: 0.7, observer: true, observerFactor: 4 },
    },
    claim: (a) => {
      const d = a.state.design
      const obs = a.state_.observer
      const tau = a.state.plantP.tau
      const f = d.observerFactor
      // A - LC for A = [[0,1],[0,-1/tau]], C = [1,0] gives
      // s^2 + (L1 + 1/tau) s + (L2 + L1/tau), matched to the scaled pair.
      const wn = f * d.wn
      const zeta = d.zeta
      const wantL1 = 2 * zeta * wn - 1 / tau
      const wantL2 = wn * wn - wantL1 / tau
      return [
        { name: 'the first observer gain', value: obs.L[0], want: wantL1, tol: 1e-8 },
        { name: 'the second observer gain', value: obs.L[1], want: wantL2, tol: 1e-8 },
        { name: 'the error poles land where asked', value: obs.achieved[0][0], want: -zeta * wn, tol: 1e-6 },
        { name: 'the estimate settles in four over zeta omega', value: 4 / (zeta * wn), want: 0.357, tol: 0.002 },
      ]
    },
  },

  {
    id: 'A7',
    group: GROUP_A,
    name: 'The quadratic trade',
    see:
      'The same motor, with the gain chosen by a price rather than by a pole pair. The cost charges for ' +
      'position error and for drive, and R is the price of drive. At R = 1 the gain is [1, 0.414], the poles ' +
      'are a double root at −√2, and the cost from a unit position error is √2.',
    try: [
      { say: 'Set R to 0.01. The position gain rises to 10 and the loop is ten times faster.', set: { r: 0.01 } },
      { say: 'Set R to 100. The gain falls to 0.1 and the slow pole sits at −0.1.', set: { r: 100 } },
      { say: 'Set R back to 1.', set: { r: 1 } },
    ],
    why:
      'The regulator minimises the integral of xᵀQx + Ru², which is a price on being wrong and a ' +
      'price on doing something about it. The gain that minimises it solves a Riccati equation, and for this ' +
      'motor the position gain comes out as exactly √(q/R). Two things follow. The trade is a single ' +
      'knob rather than a pole pair a designer has to guess, and the answer is always a stable loop. The ' +
      'Riccati residual is printed beside the gain, because a gain whose residual is not small is not the ' +
      'optimal gain.',
    terms: ['lqr', 'riccati', 'statefeedback', 'cost', 'quadraticform', 'residual'],
    patch: {
      mode: 'state',
      plantId: 'motor',
      plantP: pp('motor'),
      ctrlId: 'p',
      ctrlP: cp('p'),
      view: 'state',
      design: { method: 'lqr', q: 1, r: 1, duration: 6 },
    },
    claim: (a) => {
      const d = a.state.design
      const out = a.state_.lqr
      const wantK1 = Math.sqrt((d.q ?? 1) / d.r)
      return [
        { name: 'the position gain is the square root of q over R', value: out.K[0], want: wantK1, tol: 1e-9 },
        { name: 'the closed loop is stable', value: Math.max(...out.poles.map(([re]) => re)), wantBelow: 0 },
        { name: 'the poles are a double root at minus root two', value: out.poles[0][0], want: -Math.SQRT2, tol: 1e-6 },
        { name: 'the cost from a unit position error', value: out.cost([1, 0]), want: Math.SQRT2, tol: 1e-6 },
        { name: 'the Riccati residual is small', value: out.relResidual, wantBelow: 1e-12 },
      ]
    },
    sweep: {
      knob: 'r',
      at: [0.01, 0.1, 10, 100],
      claim: (a) => [
        {
          name: 'the gain law holds at every price',
          value: a.state_.lqr.K[0],
          want: Math.sqrt((a.state.design.q ?? 1) / a.state.design.r),
          tol: 1e-9,
        },
      ],
    },
  },
]
