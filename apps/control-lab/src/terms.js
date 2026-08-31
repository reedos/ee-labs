// Definitions, delivered where the term first does work.
//
// The pattern is Signal Lab's, copied as the review playbook instructs: a
// student meeting "phase margin" or "RHP" mid-lesson should not need a second
// tab. Each lesson declares the terms it leans on (`terms: [...]` in
// lessons.js) and the sidebar offers those definitions right under the note —
// folded, so they cost nothing to someone who already knows them.
//
// House rules for a definition: two or three sentences; the first says what
// the thing IS, the rest why it matters here; concrete numbers over
// abstraction; no term defined using an undefined term.

export const TERMS = {
  db: {
    name: 'dB (decibel)',
    def:
      'A logarithmic way to state a ratio: 20·log₁₀ of an amplitude ratio, so ×10 is +20 dB, ' +
      '×2 is +6 dB and half is −6 dB. The top bar quotes the gain margin this way — 21.0 dB ' +
      'and 11.2× are the same statement about how much more gain the loop can take.',
  },
  pole: {
    name: 'Pole',
    def:
      "A root of a transfer function's denominator — a value of s where the response blows " +
      'up. Each pole is a mode of the system, e^(pt): decaying if p is in the left half ' +
      'plane, growing if in the right. On a frequency response a real pole costs up to 90° ' +
      'of phase lag, 45° of it already spent at its corner frequency.',
  },
  zero: {
    name: 'Zero',
    def:
      "A root of a transfer function's numerator. Where a pole spends phase, a LEFT-half-plane " +
      'zero earns it — up to +90° — and derivative and lead action are useful precisely ' +
      'because they place zeros there. A RIGHT-half-plane zero (a custom plant can carry one) ' +
      'does the opposite: it subtracts phase while its magnitude looks identical, which is ' +
      'what makes such plants notoriously hard to control. Zeros also move overshoot on ' +
      'their own, which is one reason the ζ tables only apply to loops without them.',
  },
  integrator: {
    name: 'Integrator',
    def:
      "A pole at s = 0: the block's output is the running total of its input. Its gain is " +
      'infinite at DC — which is why any integrator in the loop drives the steady-state ' +
      'error to exactly zero — and its price is a flat −90° of phase at every frequency.',
  },
  phasemargin: {
    name: 'Phase margin',
    def:
      'How much extra phase lag the loop could absorb at its crossover — where its gain ' +
      'passes 1 — before reaching −180° and turning feedback into reinforcement. 60° is ' +
      'comfortable, 30° rings visibly, 0° oscillates. It is an angle to the point −1, so ' +
      'the Nyquist view shows it as a distance around the unit circle.',
  },
  gainmargin: {
    name: 'Gain margin',
    def:
      'The factor by which the loop gain can rise before the loop sits on the edge of ' +
      'oscillation, measured where the phase reaches −180°. Quoted as a ratio and in dB ' +
      '(11.2× = 21.0 dB), and it is exact: multiply Kp by it and the loop is marginal — ' +
      'a claim the harness drives the sliders to confirm.',
  },
  crossover: {
    name: 'Crossover frequency',
    def:
      'The frequency where the open-loop gain passes 1 (0 dB): below it the loop has the ' +
      'gain to enforce its will, above it it mostly listens. The phase margin is read ' +
      'there, which is why the top bar names it. The plots speak hertz; multiply by 2π ' +
      'for the rad/s a textbook uses.',
  },
  steadystate: {
    name: 'Steady-state error',
    def:
      'What is left between reference and output after the transients die, read from the ' +
      'DC gain: 1/(1 + L(0)) for a step. A loop gain of 9 leaves 10%; raising gain shrinks ' +
      'it but never to zero — exactly zero needs infinite DC gain, which is what an ' +
      'integrator is for.',
  },
  disturbance: {
    name: 'Disturbance',
    def:
      'An input the loop did not ask for, landing where real trouble lands: at the plant, ' +
      'not the reference — a load transient, supply ripple, a warm-up drift. The loop sees it only through ' +
      'the error it causes, and rejecting it is the half of feedback that following a ' +
      'setpoint cannot demonstrate.',
  },
  zeta: {
    name: 'ζ (damping ratio)',
    def:
      'How damped a second-order pair is: 0 rings forever, 1 is the boundary with no ' +
      'overshoot, and in between the overshoot is e^(−πζ/√(1−ζ²)) — 16% at ζ = 0.5. The ' +
      'rule of thumb ζ ≈ PM/100 ties it to the phase margin, under conditions the math ' +
      'panel states rather than assumes.',
  },
  overshoot: {
    name: 'Overshoot',
    def:
      'How far past its destination the step response peaks, as a fraction of the step: ' +
      'peaking at 1.49 on the way to 1.0 is 49%. For a plain second-order loop ζ sets it ' +
      'alone; zeros and third poles move it, which is why the readout only quotes a number ' +
      'where one is well defined.',
  },
  rhp: {
    name: 'Right-half-plane pole',
    def:
      'A pole with positive real part: a mode that GROWS, e^(+pt) — a positive-feedback ' +
      'stage latching toward its rail. Turning the gain down does not help — only feedback fast and ' +
      'strong enough can hold it, which inverts the usual failure mode: too LITTLE gain is ' +
      'what breaks this loop.',
  },
  nyquistplot: {
    name: 'Nyquist plot',
    def:
      'The open loop L(jω) drawn on the complex plane as the frequency sweeps, judged ' +
      'against the single point −1, where 1 + L = 0. Stability is read from how the curve ' +
      'treats that point, and both margins appear as visible distances — along the real ' +
      'axis to −1, and around the unit circle.',
  },
  rootlocus: {
    name: 'Root locus',
    def:
      'The paths the closed-loop poles trace as the loop gain sweeps. Plant and controller ' +
      'fix the roads; the gain only chooses where on them the poles currently sit. The ' +
      'moment a branch crosses into the right half plane is the moment the loop runs away — ' +
      'as a growing oscillation when a complex pair crosses, as a latch-up when a branch ' +
      'crosses on the real axis (the unstable plant under too little gain). Nothing sudden ' +
      'happens to the plant either way.',
  },
  effort: {
    name: 'Effort (controller output u)',
    def:
      'What the controller actually asks of the plant — the drive u it computes from the ' +
      "error: volts across a winding, current into a coil, a converter's duty cycle. The watch view splits it by gain: " +
      'Kp·e answers the present gap, Ki·∫e remembers every error so far, Kd·ė answers the ' +
      'slope. At steady state under an integrator, u is made entirely of memory.',
  },
  radpersec: {
    name: 'rad/s (angular frequency)',
    def:
      'Frequency counted in radians per second instead of cycles: ω = 2πf, so 1 Hz is ' +
      '6.28 rad/s. Textbook derivations are written in ω because s = jω keeps the algebra ' +
      'clean; the plots here are in hertz, and fields like the lead controller’s zero and ' +
      'pole positions are rad/s.',
  },
}

/** The definitions a lesson asked for, in the order it asked. */
export function termsFor(ids = []) {
  return ids.map((id) => ({ id, ...TERMS[id] })).filter((t) => t.name)
}
