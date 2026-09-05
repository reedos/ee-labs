// Definitions, delivered where the term first does work.
//
// Signal Lab's pattern, copied as the review playbook instructs. Each
// experiment declares the terms it leans on and the sidebar offers those
// definitions right under the note, folded, so they cost nothing to a reader
// who already knows them.
//
// House rules for a definition. Two or three sentences. The first says what
// the thing IS, the rest why it matters here. Concrete numbers over
// abstraction, and no term defined using an undefined term.

export const TERMS = {
  // ---------------------------------------------------------- the state
  state: {
    name: 'State',
    def:
      'What a system carries from its past into its future. Knowing the state at one instant and the input from ' +
      'then on fixes the whole future. The motor of Group A has two, its position and its speed, and a ' +
      'first-order lag has one.',
  },
  statespace: {
    name: 'State space',
    def:
      'A system written as ẋ = Ax + Bu with y = Cx + Du, one first-order equation for each state. It says the same ' +
      'thing about the system as a transfer function does. What it adds is a name for each internal quantity, ' +
      'which is what lets a controller feed one back.',
  },
  statematrix: {
    name: 'State matrix A',
    def:
      'The square matrix that says how each state feeds every other one. Its eigenvalues are the system poles, ' +
      'because det(sI − A) is the characteristic polynomial. The motor with τ = 0.5 s has A = [[0, 1], [0, −2]], ' +
      'whose eigenvalues are 0 and −2 rad/s.',
  },
  trajectory: {
    name: 'Trajectory',
    def:
      'The path the state takes through time. With no input it is exactly x(t) = e^(At)x(0), so the whole future ' +
      'is one matrix exponential away. Drawn against time it is a step response, and drawn as one state against ' +
      'another it is a curve in the phase plane.',
  },
  transferfunction: {
    name: 'Transfer function',
    def:
      'The ratio of output to input in s, written as one polynomial over another. It is what the whole suite ' +
      'trades in. Two state spaces in different coordinates give the same transfer function, which is why a ' +
      'plant can be handed between tools as a list of coefficients.',
  },
  similarity: {
    name: 'Similarity transform',
    def:
      'A change of coordinates x = Tz, which turns A into T⁻¹AT and leaves the transfer function alone. It is the ' +
      'formal statement that the state is a choice. Two engineers writing the same motor down can disagree about ' +
      'A without either being wrong.',
  },
  canonicalform: {
    name: 'Canonical form',
    def:
      'A state space built straight from the transfer function coefficients, with no physical meaning attached ' +
      'to its states. The controllable canonical form is the one this suite builds by default. It is convenient ' +
      'for algebra and useless for reasoning about what a state means.',
  },
  pole: {
    name: 'Pole',
    def:
      'A root of the denominator, and a mode of the system, e^(pt). A pole in the left half plane decays and one ' +
      'in the right half plane grows. In a sampled system the same test is the unit circle rather than the ' +
      'imaginary axis.',
  },

  // ------------------------------------------------- reaching and seeing
  controllability: {
    name: 'Controllability',
    def:
      'Whether the input can drive the state anywhere at all. The test is the rank of [B, AB, …, Aⁿ⁻¹B], and full ' +
      'rank is the exact condition for pole placement to have a solution. Two identical sections driven together ' +
      'fail it, because no input can ever make them differ.',
  },
  observability: {
    name: 'Observability',
    def:
      'Whether the output carries enough information to work out the state. The test is the rank of the stack of ' +
      'C, CA and so on. A mode that leaves no trace in the output fails it, and no observer can estimate a state ' +
      'that leaves no trace.',
  },
  rank: {
    name: 'Rank',
    def:
      'How many independent directions a matrix reaches. A 2 by 2 controllability matrix of rank 1 reaches a ' +
      'line rather than a plane, so half the state space is out of reach. Rank is measured here from the ' +
      'singular values against a relative tolerance, never from an exact pivot.',
  },
  singularvalue: {
    name: 'Singular value',
    def:
      'The gain of a matrix along one of its own principal directions. The largest and smallest say how much the ' +
      'matrix stretches and squashes. A controllability matrix losing rank does not lose a pivot, it loses a ' +
      'decade of its smallest singular value.',
  },
  conditionnumber: {
    name: 'Condition number',
    def:
      'The largest singular value over the smallest, and a measure of how nearly a matrix is singular. Two ' +
      'sections detuned by a tenth of a per cent give 4002. That says the gain needed in one direction is four ' +
      'thousand times the gain needed in the other.',
  },

  // ----------------------------------------------------------- designing
  statefeedback: {
    name: 'State feedback',
    def:
      'The drive u = −Kx, computed from every state rather than from the output alone. Its closed-loop matrix is ' +
      'A − BK, and choosing K places the poles anywhere a real polynomial allows. The price is that every state ' +
      'has to be known, which is what an observer supplies.',
  },
  ackermann: {
    name: "Ackermann's formula",
    def:
      'The closed-form solution for the feedback gain that places the closed-loop poles where a designer asks. ' +
      'It evaluates the desired characteristic polynomial at A and multiplies by the inverse of the ' +
      'controllability matrix. It needs full rank, and it is badly conditioned exactly where that rank is nearly lost.',
  },
  observer: {
    name: 'Observer',
    def:
      'A running copy of the plant, corrected by the measurement it did not predict. Its error obeys ' +
      "e′ = (A − LC)e, so choosing L places the error poles the way choosing K places the loop's. Placing them " +
      'four times faster than the controller catches a wrong estimate before it matters.',
  },
  duality: {
    name: 'Duality',
    def:
      'Reaching a state and seeing one are the same problem written twice. Controllability of (A, B) is ' +
      'observability of (Aᵀ, Cᵀ), so one routine places both gains. The Kalman filter is the regulator run on ' +
      'the transposed system, which is what F2 measures.',
  },
  lqr: {
    name: 'Linear quadratic regulator',
    def:
      'The state feedback that minimises the integral of xᵀQx + Ru², a price on being wrong plus a price on ' +
      'doing something about it. The trade is one knob rather than a pole pair a designer has to guess. The ' +
      'answer is always a stable loop.',
  },
  riccati: {
    name: 'Riccati equation',
    def:
      'The quadratic matrix equation whose solution P gives the optimal gain, K = R⁻¹BᵀP. It is solved here by ' +
      'iteration, so the answer carries a residual. A gain whose residual is not small is not the optimal gain, ' +
      'and the app prints it beside K.',
  },
  cost: {
    name: 'Cost',
    def:
      'The number the regulator minimises, and its value from a starting state x₀ is x₀ᵀPx₀. On the motor with ' +
      'unit weights, a unit position error costs √2. Comparing two designs by their cost is comparing them on ' +
      'the terms the design was actually asked for.',
  },
  quadraticform: {
    name: 'Quadratic form',
    def:
      'An expression xᵀPx, which is a bowl around the origin when P has only positive eigenvalues. Every cost ' +
      'and every Lyapunov function in this lab is one. Its level sets are ellipses, which is how the phase plane ' +
      'draws them.',
  },
  lyapunov: {
    name: 'Lyapunov function',
    def:
      'A positive quantity that only ever falls along the trajectories of a system, which is enough to prove ' +
      'that the state approaches the origin. For a linear system V = xᵀPx with AᵀP + PA = −I always works. It ' +
      'is an argument about one region, not about the whole plane.',
  },

  // ------------------------------------------------------ sampled things
  sample: {
    name: 'Sample',
    def:
      'One reading of the output, taken at an instant. A computer in the feedback path sees only these and ' +
      'nothing between them. The interval between two of them is the sample time Ts, and everything the loop ' +
      'gains or loses by being digital scales with it.',
  },
  zoh: {
    name: 'Zero-order hold',
    def:
      'What a digital controller does between samples, which is to keep its last answer constant. The plant ' +
      'therefore sees a staircase rather than a curve. The discrete model of a plant under a hold is exact at ' +
      'every sample instant, because it is one matrix exponential rather than a discretisation rule.',
  },
  staircase: {
    name: 'Staircase',
    def:
      'The shape of the drive under a hold, flat for a whole sample and then jumping. It is the actual input the ' +
      'plant receives. Reading the output between samples shows the plant responding to the step it was given, ' +
      'not to the smooth signal a continuous design imagined.',
  },
  discretemodel: {
    name: 'Discrete model',
    def:
      'The plant plus its sampler and hold, written as a rational function of z. It is exact at the sample ' +
      'instants and says nothing at all about what happens between them. Its coefficients for a first-order lag ' +
      'are K(1 − α)/(z − α) with α = e^(−T/τ).',
  },
  zplane: {
    name: 'z-plane',
    def:
      'Where the poles of a sampled system live. A pole at s maps to z = e^(sT), so the left half plane maps ' +
      'inside the unit circle and the imaginary axis maps onto it. Signal Lab draws the same picture for its ' +
      'sampled filters.',
  },
  unitcircle: {
    name: 'Unit circle',
    def:
      'The stability boundary in z, standing where the imaginary axis stands in s. Every pole strictly inside ' +
      'means the response decays. A pole at radius 1.001 grows by a tenth of a per cent every sample, which is ' +
      'slow and is still unstable.',
  },
  halfsample: {
    name: 'Half-sample delay',
    def:
      'What a hold costs the loop, on average, at every frequency. Its phase is exactly −ωT/2 radians, so at ' +
      'twenty samples per cycle it is 9.0 degrees and at five it is 36. The hold has no transfer function in s, ' +
      'and this number is exact anyway.',
  },
  emulation: {
    name: 'Emulation',
    def:
      'Designing a controller in s and then substituting an approximation of the derivative to get a difference ' +
      'equation. It is an approximation, labelled one on every call, and it is the ordinary way digital ' +
      'controllers are built. Its guard is the number of samples per cycle at crossover.',
  },
  tustin: {
    name: 'Tustin rule',
    def:
      'The trapezoid substitution s = (2/T)(z − 1)/(z + 1), which maps the whole left half plane inside the unit ' +
      'circle. So a stable controller always emulates to a stable difference equation. Signal Lab uses the same ' +
      'transform to turn analogue prototypes into digital filters.',
  },
  forwardeuler: {
    name: 'Forward Euler rule',
    def:
      'The substitution s = (z − 1)/T, which maps the left half plane onto a disc of radius 1 centred at 1. Most ' +
      'of that disc is outside the unit circle. A controller with τ = 10 ms emulates to an unstable difference ' +
      'equation at any sample time of 20 ms or more.',
  },
  deadbeat: {
    name: 'Deadbeat',
    def:
      'A sampled design whose closed-loop pole sits at the origin of the z-plane, so the response arrives in a ' +
      'finite number of samples and stops. A first-order lag under proportional control does it in one sample, ' +
      'at Kp = α/(1 − α). Only a sampled loop can do this.',
  },

  // ---------------------------------------------------- the plane and the limit
  phaseplane: {
    name: 'Phase plane',
    def:
      'One state plotted against the other, with time running along the curve rather than across the page. A ' +
      'whole family of responses becomes a family of curves. It works for two states and no more, which is why ' +
      'the plane declines a loop with three.',
  },
  saturation: {
    name: 'Saturation',
    def:
      'An actuator that runs out of travel. Its slope is 1 up to the limit δ and flat beyond it, so it is three ' +
      'straight segments. That is what lets a trajectory through it be computed exactly rather than integrated ' +
      'with a step size.',
  },
  deadzone: {
    name: 'Deadzone',
    def:
      'An actuator that does nothing until it is asked hard enough. Static friction, a valve that has to crack ' +
      'open, the first step of a quantiser. The same three straight segments as a saturation, in the other ' +
      'arrangement.',
  },
  region: {
    name: 'Region',
    def:
      'One of the three straight pieces a saturation is made of, below the limit, inside it, and above. Inside ' +
      'each one the loop is linear and its trajectory has a closed form. The only thing left to compute is when ' +
      'the state leaves.',
  },
  switchingline: {
    name: 'Switching line',
    def:
      'The straight line in the plane where the drive reaches its limit and the loop changes which region it is ' +
      'in. For the PI loop of Group C the two lines are 4x₁ − 2x₂ = ±δ. Every event in a trajectory lands on ' +
      'one of them.',
  },
  equilibrium: {
    name: 'Equilibrium',
    def:
      'A state at which the loop would stay if it arrived there, so every derivative is zero. A saturated region ' +
      'can have one that lies outside its own region, which means the loop can never actually rest there. C5 is ' +
      'the case where no region has a real one.',
  },
  restingpoint: {
    name: 'Resting point',
    def:
      'The equilibrium the loop actually settles at. For the PI loop tracking a reference of 1 it is (0.25, 1), ' +
      'where the integrator holds exactly the drive the plant needs and the output sits on the reference.',
  },
  windup: {
    name: 'Windup',
    def:
      'What an integrator does while the actuator is saturated. The error stays large because the drive cannot ' +
      'grow, so the integrator keeps accumulating a command nothing can deliver. Unwinding it is what makes the ' +
      'overshoot after a saturated approach worse than the linear one.',
  },
  describingfunction: {
    name: 'Describing function',
    def:
      'The gain a nonlinearity would have for a pure sine of a given amplitude, N(A), taken as if it were a ' +
      'linear gain. For a saturation it is 1 below the limit and falls above it. It is an approximation, and ' +
      'Group D is built to show how far off it is.',
  },
  limitcycle: {
    name: 'Limit cycle',
    def:
      'A steady oscillation a nonlinear loop settles into, neither growing nor dying. A saturating actuator ' +
      'produces one where a linear loop of the same gain would diverge. The effective gain falls as the ' +
      'amplitude rises, until it is exactly enough to sustain the swing.',
  },
  filterhypothesis: {
    name: 'Filter hypothesis',
    def:
      'The assumption the describing function rests on, that the linear part attenuates the harmonics the ' +
      'nonlinearity creates so only the fundamental returns to it. Where the loop has a resonance at the third ' +
      'harmonic, the assumption fails and the prediction is not usable.',
  },
  harmonic: {
    name: 'Harmonic',
    def:
      'A component at a whole multiple of the fundamental frequency. Clipping a sine creates odd harmonics, and ' +
      'the third is the largest of them. Signal Lab measures the same harmonics on a clipped waveform without a ' +
      'loop around it.',
  },
  harmonicratio: {
    name: 'Harmonic ratio',
    def:
      'The third harmonic arriving back at the nonlinearity divided by the fundamental arriving there, which is ' +
      'the number the describing function threw away. It is measured on the loop it is given, and the threshold ' +
      'is five per cent. It predicts the error it guards against.',
  },

  // --------------------------------------------------------- identifying
  identification: {
    name: 'Identification',
    def:
      'Working out a model from measurements rather than from a diagram. A step goes into the plant, a trace ' +
      'comes out, and a model shape is fitted to it. What makes it honest is that the fit reports how far it ' +
      'still is from the data.',
  },
  fit: {
    name: 'Fit',
    def:
      'A model whose parameters were chosen to pass as near the data as that shape can. Here it is two stages, ' +
      'a linear estimate from integrals and then a direct search on the response. So the number reported is the ' +
      'smallest residual that shape can reach.',
  },
  residual: {
    name: 'Residual',
    def:
      'How far the fitted model still is from the data, as a root mean square. Quoted relative to the gain it ' +
      'becomes a percentage a reader can judge. A residual that lands on the noise means the model has explained ' +
      'everything there was to explain.',
  },
  noise: {
    name: 'Noise',
    def:
      'The part of a measurement no model can predict. Adding one per cent of noise to a clean step leaves a fit ' +
      'with about one per cent of residual, which is what a good fit under noise looks like. Chasing the ' +
      'residual below the noise means fitting the noise.',
  },
  order: {
    name: 'Order',
    def:
      'How many poles a model has, which sets what shapes it can make. A first-order model has no way to ' +
      'overshoot, so fitting one to a ringing step leaves a residual a reader can see. The residual is what says ' +
      'which order the data supports.',
  },
  kalman: {
    name: 'Kalman filter',
    def:
      'An observer whose gain comes from how much the model and the measurement are each worth rather than from ' +
      'a chosen pole pair. The two weights enter only as a ratio. Its steady-state gain solves the same equation ' +
      'as the regulator, on the transposed system.',
  },

  // ------------------------------------------------------- shared chrome
  stability: {
    name: 'Stability',
    def:
      'Whether the response decays or grows. In s the test is every pole strictly in the left half plane, and in ' +
      'z it is every pole strictly inside the unit circle. The verdict in the top bar is measured against the ' +
      "system's own scale rather than a fixed epsilon.",
  },
  phasemargin: {
    name: 'Phase margin',
    def:
      'How much extra phase lag the loop could absorb at its crossover, where the gain passes 1, before ' +
      'reaching −180 degrees. Sixty degrees is comfortable and thirty rings visibly. A hold spends it at ' +
      '−ωT/2, which is what makes sampling cost margin.',
  },
  crossover: {
    name: 'Crossover frequency',
    def:
      'Where the open-loop gain passes 1, which sets how fast the closed loop is and where its phase margin is ' +
      'read. In a sampled loop it is also where the samples per cycle are counted. That is the frequency the ' +
      'emulation has to describe correctly.',
  },
  integrator: {
    name: 'Integrator',
    def:
      'A pole at s = 0, whose output is the running total of its input. Its gain is infinite at DC, which is why ' +
      'any integrator in the loop drives the steady-state error to zero. Its price is a flat −90 degrees of ' +
      'phase at every frequency.',
  },
  steadystate: {
    name: 'Steady-state error',
    def:
      'What is left between the reference and the output once everything has settled. Proportional control ' +
      'leaves some, and an integrator removes it. State feedback does not fix it either, because the DC gain of ' +
      'the placed loop is whatever the placement made it.',
  },
  overshoot: {
    name: 'Overshoot',
    def:
      'How far past its destination a response goes, as a fraction of the step. For a clean second-order pair it ' +
      'is exp(−πζ/√(1 − ζ²)), so ζ = 0.7 gives 4.60 per cent. A saturating actuator breaks that formula, which ' +
      'is Group C.',
  },
  zeta: {
    name: 'Damping ratio ζ',
    def:
      'How far a pole pair sits from the imaginary axis, measured as the cosine of its angle from the negative ' +
      'real axis. One is critical damping with no overshoot at all, 0.7 gives 4.60 per cent, and 0.4 gives 25.4. ' +
      'Below one the response rings.',
  },
  wn: {
    name: 'Natural frequency ωₙ',
    def:
      'The distance of a pole pair from the origin, in radians a second, which sets how fast the response is ' +
      'without changing its shape. Doubling it halves every time in the response and leaves the overshoot ' +
      'exactly where it was.',
  },
  guard: {
    name: 'Guard',
    def:
      'The applicability check every approximation in this suite carries, with a concrete threshold and a stated ' +
      'behaviour when it is crossed. This lab has three, the samples per cycle at crossover, the harmonic ratio, ' +
      "and a fit's residual. A guard is part of the feature, not a warning bolted on.",
  },
}

/**
 * Cue words, and the term each one owes the reader.
 *
 * A cue found in an experiment's own prose has to bring its definition with
 * it. `terms.test.js` is the automated half of the rule, and it is the reason a
 * reader never meets "windup" or "deadbeat" mid-note with no way to look it up
 * right there.
 */
export const CUES = {
  ackermann: /Ackermann/i,
  canonicalform: /canonical form/i,
  conditionnumber: /condition number|the condition is/i,
  controllability: /controllab/i,
  deadbeat: /deadbeat/i,
  deadzone: /deadzone/i,
  describingfunction: /describing function/i,
  duality: /\bdual\b|duality/i,
  emulation: /emulat/i,
  equilibrium: /equilibri/i,
  filterhypothesis: /filter hypothesis/i,
  forwardeuler: /forward Euler/i,
  harmonicratio: /harmonic ratio/i,
  identification: /identif/i,
  kalman: /Kalman/i,
  limitcycle: /limit cycle/i,
  lqr: /\bLQR\b|regulator/i,
  lyapunov: /Lyapunov/i,
  observability: /observab/i,
  observer: /\bobserver\b/i,
  phaseplane: /phase plane/i,
  quadraticform: /quadratic/i,
  rank: /\brank\b/i,
  residual: /residual/i,
  riccati: /Riccati/i,
  saturation: /saturat/i,
  similarity: /similarity transform|change of coordinates/i,
  singularvalue: /singular value/i,
  staircase: /staircase/i,
  statefeedback: /state feedback|fed back/i,
  statespace: /state space/i,
  switchingline: /switching line/i,
  trajectory: /trajector/i,
  tustin: /Tustin|trapezoid rule/i,
  unitcircle: /unit circle/i,
  windup: /\bwind(?:s|ing|up)?\b/i,
  zoh: /zero-order hold|\bthe hold\b/i,
  zplane: /z-plane/i,
}

/**
 * The definitions the top bar owes, wherever a reader is.
 *
 * The verdict, the margin and the guard are on screen in every experiment, so
 * their words are offered from the top bar's own fold rather than from each
 * experiment's list. Control Lab required every lesson to repeat them, which
 * put three ids into fifty term arrays that no note had asked for.
 */
export const TOPBAR_TERMS = ['stability', 'phasemargin', 'guard']

/** The definitions an experiment asked for, in the order it asked. */
export function termsFor(ids = []) {
  return ids.map((id) => ({ id, ...TERMS[id] })).filter((t) => t.name)
}
