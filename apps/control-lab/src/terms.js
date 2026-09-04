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
  // ---- the section headers: on screen under every lesson and every picker
  // state alike, the same permanence TOPBAR_TERMS's own comment describes
  // (chrome.js's PLANT_DEF/CONTROLLER_DEF, App.jsx's #plant/#controller
  // cards) --------------------------------------------------------------
  plant: {
    name: 'Plant (P(s))',
    def:
      'The system a loop is built to control, a motor, a tank, a circuit, whatever is actually out there. Its ' +
    'input is the drive u, whatever the controller sends. Its output is the measured y, fed back to form the ' +
    'next error. The plant is given. Only the controller is chosen.',
  },
  controller: {
    name: 'Controller (C(s))',
    def:
      'The block a designer chooses, not the plant itself. Its input is the error, the reference r minus the ' +
    'measured y. Its output is the drive u, computed from that gap alone. It never sees the reference or the ' +
    'plant directly, only how far apart they are.',
  },
  error: {
    name: 'Error (e = r − y)',
    def:
      'The gap between the reference r and the measured output y. A controller acts on this difference alone, ' +
    'never on r or y separately. Driving it to zero, or as close as the loop\'s own limits allow, is the whole ' +
    'job of feedback.',
  },
  reference: {
    name: 'Reference (r)',
    def:
      'The value a loop is asked to reach or hold, the setpoint. A step lesson moves r itself. A disturbance ' +
    'lesson leaves r fixed and shoves the plant input instead. The controller compares r against the measured ' +
    'y to form the error.',
  },
  db: {
    name: 'dB (decibel)',
    def:
      'A logarithmic way to state a ratio: 20·log₁₀ of an amplitude ratio. So ×10 is +20 dB, ×2 is +6 dB and ' +
    'half is −6 dB. The top bar quotes the gain margin this way, and 21.0 dB and 11.2× say the same thing ' +
    'about how much more gain the loop can take.',
  },
  pole: {
    name: 'Pole',
    def:
      'A root of a transfer function\'s denominator, a value of s where the response blows up. Each pole is a ' +
    'mode of the system, e^(pt). Decaying if p is in the left half plane, growing if in the right. On a ' +
    'frequency response a real pole costs up to 90° of phase lag, 45° of it already spent at its corner ' +
    'frequency.',
  },
  zero: {
    name: 'Zero',
    def:
      'A root of a transfer function\'s numerator. Where a pole spends phase, a left-half-plane zero earns it, ' +
    'up to +90°, which is why derivative and lead action are useful. A right-half-plane zero, which a custom ' +
    'plant can carry, subtracts phase instead while its magnitude looks identical. Such plants are hard to ' +
    'control. Zeros also move overshoot, so the ζ tables suit loops without them.',
  },
  integrator: {
    name: 'Integrator',
    def:
      'A pole at s = 0: the block\'s output is the running total of its input. Its gain is infinite at DC, ' +
    'which is why any integrator in the loop drives the steady-state error to exactly zero. Its price is a ' +
    'flat −90° of phase at every frequency.',
  },
  phasemargin: {
    name: 'Phase margin',
    def:
      'How much extra phase lag the loop could absorb at its crossover, where its gain passes 1, before ' +
    'reaching −180° and turning feedback into reinforcement. 60° is comfortable, 30° rings visibly, 0° ' +
    'oscillates. It is an angle to the point −1, so the Nyquist view shows it as a distance around the unit ' +
    'circle.',
  },
  gainmargin: {
    name: 'Gain margin',
    def:
      'The factor between the current loop gain and the gain at the edge of oscillation, measured where the ' +
    'phase reaches −180°. Quoted as a ratio and in dB (11.2× = 21.0 dB). Above 1× is safe for most plants, ' +
    'since more gain fails them. A right-half-plane pole inverts that failure: below 1× is safe there, ' +
    'since less gain is what fails it.',
  },
  crossover: {
    name: 'Crossover frequency',
    def:
      'The frequency where the open-loop gain passes 1 (0 dB). Below it the loop has the gain to correct what ' +
    'it sees, and above it the loop mostly follows. The phase margin is read there, which is why the top bar ' +
    'names it. The plots are in hertz, so multiply by 2π for the rad/s a textbook uses.',
  },
  steadystate: {
    name: 'Steady-state error',
    def:
      'What is left between reference and output after the transients die, read from the DC gain: 1/(1 + L(0)) ' +
    'for a step. A loop gain of 9 leaves 10%. Raising gain shrinks it but never to zero, exactly zero needs ' +
    'infinite DC gain, which is what an integrator is for.',
  },
  disturbance: {
    name: 'Disturbance',
    def:
      'An input the loop did not ask for, landing at the plant rather than the reference: a load transient, ' +
    'supply ripple, a warm-up drift. The loop sees it only through the error it causes. Rejecting it is the ' +
    'half of feedback that following a setpoint cannot show.',
  },
  zeta: {
    name: 'ζ (damping ratio)',
    def:
      'How damped a second-order pair is. At 0 it rings for ever, at 1 it is the boundary with no overshoot, ' +
    'and in between the overshoot is e^(−πζ/√(1−ζ²)), or 16% at ζ = 0.5. The rule of thumb ζ ≈ PM/100 ties it ' +
    'to the phase margin, under conditions the math panel states rather than assumes.',
  },
  overshoot: {
    name: 'Overshoot',
    def:
      'How far past its destination the step response peaks, as a fraction of the step: peaking at 1.49 on the ' +
    'way to 1.0 is 49%. For a plain second-order loop ζ sets it alone. Zeros and third poles move it, which ' +
    'is why the readout only quotes a number where one is well defined.',
  },
  rhp: {
    name: 'Right-half-plane pole',
    def:
      'A pole with positive real part: a mode that GROWS, e^(+pt), a positive-feedback stage latching toward ' +
    'its rail. Turning the gain down does not help, only feedback fast and strong enough can hold it, which ' +
    'inverts the usual failure mode. Too LITTLE gain is what breaks this loop.',
  },
  nyquistplot: {
    name: 'Nyquist plot',
    def:
      'The open loop L(jω) drawn on the complex plane as the frequency sweeps, judged against the single point ' +
    '−1, where 1 + L = 0. Stability is read from how the curve treats that point. Both margins appear as ' +
    'visible distances, along the real axis to −1 and around the unit circle.',
  },
  rootlocus: {
    name: 'Root locus',
    def:
      'The paths the closed-loop poles trace as the loop gain sweeps. Plant and controller fix the roads, and ' +
    'the gain chooses where on them the poles sit. When a branch crosses into the right half plane the loop ' +
    'runs away. A complex pair gives a growing oscillation there, and a branch on the real axis gives a ' +
    'latch-up. Nothing sudden happens to the plant.',
  },
  effort: {
    name: 'Effort (controller output u)',
    def:
      'What the controller actually asks of the plant, the drive u it computes from the error: volts across a ' +
    'winding, current into a coil, a converter\'s duty cycle. The watch view splits it by gain: Kp·e answers ' +
    'the present gap, Ki·∫e remembers every error so far, Kd·ė answers the slope. At steady state under an ' +
    'integrator, u is made entirely of memory.',
  },
  // ---- the top bar: on screen under every lesson ----------------------
  mhz: {
    name: 'mHz (millihertz)',
    def:
      'A thousandth of a hertz: one cycle every thousand seconds. The crossover of a slow loop lands here, and ' +
    '159.2 mHz is 0.1592 Hz, or 1 rad/s. The top bar uses the SI prefix rather than a row of zeros, and the ' +
    'same field prints Hz or kHz when the loop is fast.',
  },
  // ---- lesson 1 -----------------------------------------------------------
  lag: {
    name: 'Lag (the plant)',
    def:
      'A system whose output follows its input late and smoothly, like a capacitor charging through a resistor: ' +
    'one pole, no overshoot, τ seconds to get most of the way. "Lag" is also the verb for phase falling ' +
    'behind. A lag plant costs up to 90° of it.',
  },
  drive: {
    name: 'Drive (u)',
    def:
      'What the controller pushes into the plant, the voltage on the motor, the current in the coil. Under ' +
    'proportional control drive = Kp × error, so a plant that needs SOME drive to hold its position must keep ' +
    'SOME error to earn it. That is the whole of the first lesson.',
  },
  proportional: {
    name: 'Proportional control',
    def:
      'The controller is a plain multiplier: drive = Kp × (asked − delivered). Twice the gap gives twice the ' +
    'push. It is fast and simple, and it can never quite arrive, because at zero gap it pushes with nothing.',
  },
  // ---- lesson 2 -----------------------------------------------------------
  integral: {
    name: 'Integral term (Ki·∫e)',
    def:
      'The controller keeps a running total of every moment of error so far and pushes with Ki times that ' +
    'total. The total only stops changing when the error is exactly zero, which is why an integral term ' +
    'erases steady error rather than shrinking it.',
  },
  // ---- lesson 3 -----------------------------------------------------------
  handoff: {
    name: 'Handoff',
    def:
      'The moment in a PI step where the drive stops being mostly Kp·e and becomes mostly Ki·∫e. As the gap ' +
    'closes the proportional part fades and the accumulated memory takes over holding the output. The watch ' +
    'view opens mid-handoff so both parts are visibly at work.',
  },
  kpe: {
    name: 'Kp·e',
    def:
      'The proportional part of the drive: the gain times the error right now. It is largest ' +
      'at the first instant, when the whole step is still error, and falls with the gap.',
  },
  kiint: {
    name: 'Ki·∫e',
    def:
      'The integral part of the drive: Ki times the shaded area between what was asked and what has been ' +
    'delivered so far. It climbs while any error remains, and holds its value once the error is gone. By the ' +
    'end it is the entire drive.',
  },
  scrub: {
    name: 'Scrub',
    def:
      'Drag the cursor along the time axis to look at one moment of the response. Every strip ' +
      'shows its value at that moment, so scrubbing is how you watch the parts hand over ' +
      'instead of reading the finished picture.',
  },
  windsdown: {
    name: 'Why the memory winds to −1',
    def:
      'Under a disturbance of +1 at the plant input, the loop can only cancel it by pushing −1 of its own. ' +
    'Nothing was asked for, so at the end Kp·e is zero and the integral term alone holds the −1. It ' +
    'accumulates exactly until the disturbance is cancelled, then stops.',
  },
  // ---- lesson 4 -----------------------------------------------------------
  l0: {
    name: 'L(0)',
    def:
      'The open-loop gain at DC: what one unit of error becomes after passing through the controller and the ' +
    'plant, once everything has settled. A proportional loop on a unit-gain lag with Kp = 9 has L(0) = 9. Its ' +
    'leftover error is 1/(1 + 9) = 10%.',
  },
  loadtransient: {
    name: 'Load transient',
    def:
      'A sudden change in what the plant is driving, a motor picking up a weight, a supply rail suddenly asked ' +
    'for more current. It lands on the plant, not on the setpoint, which is why the disturbance step enters ' +
    'at the plant input.',
  },
  supplyripple: {
    name: 'Supply ripple',
    def:
      'The small periodic wobble left on a power rail by its rectifier or converter. To a loop it is another ' +
    'disturbance at the plant input. Something the plant sees that the controller never asked for.',
  },
  windup: {
    name: 'Windup (and why this is not it)',
    def:
      'The integral term here simply climbs until the shove is cancelled, that is it working. WINDUP is the ' +
    'pathology. The total keeps growing while the drive is stuck at a limit it cannot exceed, then overshoots ' +
    'badly on the way back. This lab has no drive limit, so nothing winds up.',
  },
  offset: {
    name: 'Offset',
    def:
      'A steady difference that stays after everything has settled, here the 0.1 the shove leaves behind under ' +
    'proportional control. Shrunk by the loop gain, never removed, until an integral term is added.',
  },
  // ---- lesson 5 -----------------------------------------------------------
  margin: {
    name: 'Margin',
    def:
      'How far the loop is from the edge of oscillation, quoted two ways. One is the degrees of phase it could ' +
    'still lose at its crossover. The other is the factor by which its gain could still rise. Both are read ' +
    'from the open loop and printed in the top bar.',
  },
  minus180: {
    name: '−180° (why it matters)',
    def:
      'A signal shifted by half a cycle comes back inverted. The loop already inverts once, and that minus sign ' +
    'is what makes feedback negative. So −180° of extra lag turns subtraction into addition, and the ' +
    'correction reinforces the error instead of cancelling it.',
  },
  oscillates: {
    name: 'Oscillates',
    def:
      'The output swings back and forth instead of settling. On the edge it swings at a constant size for ever, ' +
    'and past the edge each swing is larger than the last. The frequency is the one where the loop phase ' +
    'reaches −180°.',
  },
  // ---- lesson 6 -----------------------------------------------------------
  corner: {
    name: 'Corner frequency',
    def:
      'The frequency where a pole starts to bite: 1/τ in rad/s for a lag. Below it the gain is flat and the ' +
    'phase near zero. At it the phase has already fallen 45° and the gain 3 dB. Above it the gain falls 20 dB ' +
    'per decade and the phase heads for −90°.',
  },
  boundary: {
    name: 'The boundary',
    def:
      'The gain at which the closed-loop poles sit exactly on the imaginary axis. Below it the loop settles, ' +
    'above it the loop runs away, and on it the loop oscillates at constant size for ever. The gain margin is ' +
    'the factor between the current gain and this one.',
  },
  diverges: {
    name: 'Diverges',
    def:
      'Grows without limit: each swing bigger than the last, until in a real system something ' +
      'saturates or breaks. The plot cuts the window where the output first passes 2.5× the ' +
      'step, so the growth is visible rather than a filled block.',
  },
  rings: {
    name: 'Rings',
    def:
      'Overshoots and swings a few times before settling, the way a struck bell decays. Ringing is the sign of ' +
    'a thin margin. Still stable, but the closed-loop poles are near the axis and lightly damped.',
  },
  sluggish: {
    name: 'Sluggish',
    def:
      'Slow to respond and slow to arrive, with no overshoot at all: the low-gain end of ' +
      'the range, where the controller pushes gently and the plant takes its time. Safe and ' +
      'far from the boundary, and usually too slow to be useful.',
  },
  // ---- lesson 7 -----------------------------------------------------------
  verdict: {
    name: 'Verdict (stable / on the boundary / UNSTABLE)',
    def:
      'The top bar\'s one-word judgement of the closed loop, from where its poles sit: all in the left half ' +
    'plane and it settles. Any on the imaginary axis and it oscillates at constant size. Any to the right and ' +
    'it runs away.',
  },
  // ---- lesson 8 -----------------------------------------------------------
  branch: {
    name: 'Branch',
    def:
      'One path on the root locus: the road one closed-loop pole travels as the gain sweeps ' +
      'from zero upward. Each branch starts at an open-loop pole and ends at an open-loop zero ' +
      'or runs off to infinity.',
  },
  imaginaryaxis: {
    name: 'The imaginary axis',
    def:
      'The vertical line through the origin of the s-plane, where a pole has no real part. A pole on it neither ' +
    'decays nor grows, it oscillates forever at the height it sits at, in rad/s. Crossing it is the moment ' +
    'stability is lost.',
  },
  shadedhalf: {
    name: 'The shaded half',
    def:
      'The right half of the s-plane, where a pole has a positive real part and its mode ' +
      'grows. Shaded so the eye can see a branch enter it without reading the axis.',
  },
  closedvsopen: {
    name: 'Closed-loop vs open-loop poles',
    def:
      'Open-loop poles (green) belong to C(s)·P(s) with the feedback wire cut, the plant and controller as they ' +
    'are. Closed-loop poles (pink) belong to L/(1 + L), the loop with the wire connected, and only they ' +
    'decide whether the loop settles. The gain moves the pink ones along the branches, and the green ones ' +
    'stay put.',
  },
  // ---- lesson 9 -----------------------------------------------------------
  complexplane: {
    name: 'Complex plane',
    def:
      'A number with a size and an angle drawn as a point: real part across, imaginary part ' +
      'up. The Nyquist view draws L(jω) there for every frequency, so a gain of 1 at −180° ' +
      'is simply the point −1.',
  },
  openloop: {
    name: 'Open loop',
    def:
      'The chain C(s)·P(s) with the feedback wire cut, so the output is not fed back. Its ' +
      'frequency response is what the Bode and Nyquist views plot, and everything about the ' +
      "closed loop's stability can be read from how that curve treats the point −1.",
  },
  unitcircle: {
    name: 'Unit circle',
    def:
      'The dashed circle of radius 1 on the Nyquist view: every point on it is a gain of ' +
      'exactly 1. Where the curve crosses it is the crossover, and the angle from there round ' +
      'to −1 is the phase margin, drawn as an arc.',
  },
  // ---- lesson 10 ----------------------------------------------------------
  ruleofthumb: {
    name: 'Rule of thumb',
    def:
      'An approximation good enough to design with, valid under conditions its user is ' +
      'supposed to know. ζ ≈ PM/100 is one: derived for a loop with one integrator, no ' +
      'closed-loop zeros and light damping, and the Math tab says whether those hold here.',
  },
  identity: {
    name: 'Identity',
    def:
      'A relation that is exactly true always, like S + T = 1, as opposed to a rule of thumb that is nearly ' +
    'true sometimes. The lesson\'s point is that ζ ≈ PM/100 is the second kind. Here 25° predicts 0.25 and ' +
    'the loop measures 0.22.',
  },
  // ---- lesson 11 ----------------------------------------------------------
  positivefeedback: {
    name: 'Positive feedback',
    def:
      'Feedback that adds to its own cause. An op-amp with its output returned to the non-inverting input, so ' +
    'any small offset is amplified and returned larger. It is the circuit behind a pole in the right half ' +
    'plane.',
  },
  latches: {
    name: 'Latches',
    def:
      'Runs away to one extreme and stays there, like a flip-flop snapping to one state. That ' +
      'is what an unstable plant does when a branch crosses the axis on the REAL line: no ' +
      'oscillation, just an exponential run to a limit.',
  },
  rail: {
    name: 'Rail',
    def:
      'The supply voltage an amplifier cannot exceed. A latched loop runs to a rail and sits there. This lab ' +
    'has no rails, so its runaway simply keeps growing and the axis zooms out to follow it.',
  },
  negativeerror: {
    name: 'Negative steady error',
    def:
      'Steady error is asked − delivered. The unstable plant under Kp = 5 settles at 1.25 for a step of 1, so ' +
    'its error is −25%. The output sits ABOVE the setpoint, because this plant\'s L(0) is negative and 1/(1 + ' +
    'L(0)) comes out below zero.',
  },
  runsaway: {
    name: 'Runs away',
    def:
      'Grows exponentially with no tendency to come back, e^(+pt). Left alone the unstable plant does this. ' +
    'Under too little feedback gain the closed loop still does. Only a loop gain above p holds it.',
  },
  // ---- lesson 12 ----------------------------------------------------------
  resonant: {
    name: 'Resonant plant',
    def:
      'A plant with a lightly damped pole pair, such as a series RLC, that rings on its own at ωₙ before any ' +
    'controller touches it. Its phase falls through 180° in a narrow band around ωₙ. That is where a loop ' +
    'around it runs short of margin.',
  },
  derivative: {
    name: 'Derivative action (Kd·ė)',
    def:
      'The controller pushes with Kd times the SLOPE of the error, where the error is heading, not where it is. ' +
    'As a transfer function it is a zero, and zeros add phase, up to +90°.',
  },
  filtered: {
    name: 'Filtered derivative',
    def:
      'A real derivative term always has a pole a little above its zero, Kd·s/(1 + s/N), so its gain stops ' +
    'rising at high frequency. This lab\'s Kd·s is unfiltered on purpose. That is why the step shows a jump ' +
    'at t = 0, and why the lead lesson follows.',
  },
  noise: {
    name: 'Noise',
    def:
      'The tiny fast wobble on any measured signal. A derivative multiplies a signal by its frequency, so noise ' +
    'at 10 kHz comes out ten thousand times larger than a drift at 1 Hz. That is why an unfiltered derivative ' +
    'is never used on a real loop.',
  },
  floor: {
    name: 'Floor (of a slider)',
    def:
      'The smallest value the field allows. The Kd slider\'s floor is 0.0001, close enough to zero that the ' +
    'loop behaves as plain PI, the chip named "floor" takes the derivative out without a controller change.',
  },
  wn: {
    name: 'ωₙ (natural frequency)',
    def:
      'The frequency, in rad/s, at which a second-order system would ring with no damping at all: 1/√(LC) for a ' +
    'series RLC. Divide it by 2π for hertz. The damping ratio ζ says how quickly the ringing dies.',
  },
  // ---- lesson 13 ----------------------------------------------------------
  leadnetwork: {
    name: 'Lead network',
    def:
      'A zero below a pole, Kc·(1 + s/z)/(1 + s/p) with z < p. Between them it adds phase, up to asin((p − ' +
    'z)/(p + z)) at √(z·p). Above the pole its gain flattens at Kc·p/z, so it does what a derivative does ' +
    'without amplifying noise without limit.',
  },
  geometricmean: {
    name: 'Geometric mean',
    def:
      '√(a·b): the middle of two numbers on a log scale, which is the scale frequency lives on. A lead adds ' +
    'most phase at the geometric mean of its zero and pole, 4.47 rad/s for 1 and 20. That is where the ' +
    'crossover should sit.',
  },
  ghost: {
    name: 'Ghost trace',
    def:
      'The dimmed second curve on the Bode view: the same loop with the lead taken out, ' +
      'L = Kc·P(s). The gap between the ghost and the live trace is the phase the network ' +
      'adds and the gain it costs, drawn rather than described.',
  },
  radpersec: {
    name: 'rad/s (angular frequency)',
    def:
      'Frequency counted in radians per second instead of cycles: ω = 2πf, so 1 Hz is 6.28 rad/s. Textbook ' +
    'derivations are written in ω because s = jω keeps the algebra clean. The plots here are in hertz, and ' +
    'fields like the lead controller’s zero and pole positions are rad/s.',
  },
  // ---- the Math tab, on screen wherever it is open, lesson or not ---------
  characteristicequation: {
    name: 'Characteristic equation',
    def:
      '1 + L(s) = 0, where L is the open loop C(s)·P(s). Its roots are exactly the closed-loop poles, so every ' +
    'question about stability reduces to whether one of those roots sits in the right half plane. Multiplying ' +
    'out C and P turns the equation into one polynomial set to zero.',
  },
}

/**
 * The terms the top bar, AND the open-loop pane's readout beside it, lean
 * on. Both are on screen under every lesson and every picker state alike,
 * whatever the lower view — so every lesson, and the picker itself
 * (chrome.js), carries these appended after its own list.
 *
 * db and radpersec were missing here for years: both are printed only
 * inside a formatted NUMBER — "21.0 dB" in the top bar's gain margin,
 * "= 413 mrad/s" in the open-loop readout's crossover — never as the bare
 * word a text scan of hand-written prose would catch on its own. A picker
 * click cleared the lesson (chrome.js exists for exactly that state) and
 * left "dB" and "rad/s" on screen with no definition reachable at all.
 *
 * disturbance joined this list once verify.mjs learned to read `title`
 * attributes (round four): the topbar's own "⧉ diagram" button — a sibling
 * of the phase-margin/gain-margin fields, not gated by lesson or view —
 * carries a tooltip naming the summing junction "where the disturbance gets
 * in", unconditionally. The Step/Watch pane heading also names it, but only
 * once `stepInput` is toggled to the disturbance step; the button's tooltip
 * does it on every state, the same reason db and radpersec are here.
 */
export const TOPBAR_TERMS = [
  'phasemargin',
  'gainmargin',
  'crossover',
  'steadystate',
  'mhz',
  'db',
  'radpersec',
  'disturbance',
]

/**
 * Words in a note or try line that must bring their definition with them.
 * terms.test.js scans every lesson's note and try for these and requires
 * the matching id in the lesson's `terms` — so a word cannot be used before
 * it is defined on contact.
 */
export const CUES = {
  lag: /\blags?\b/i,
  drive: /\bdrives?\b/i,
  proportional: /\bproportional\b/i,
  integral: /\bintegral\b/i,
  integrator: /\bintegrators?\b/i,
  overshoot: /\bovershoot/i,
  handoff: /\bhandoff\b/i,
  kpe: /Kp·e/,
  kiint: /Ki·∫e/,
  scrub: /\bscrub/i,
  windsdown: /winds down/i,
  l0: /L\(0\)/,
  loadtransient: /load transient/i,
  supplyripple: /supply ripple/i,
  windup: /\bwindup\b|winds up/i,
  offset: /\boffset\b/i,
  margin: /(?<!phase |gain )\bmargin\b/i,
  phasemargin: /phase margin/i,
  gainmargin: /gain margin/i,
  minus180: /−180°/,
  oscillates: /oscillat/i,
  corner: /\bcorner\b/i,
  boundary: /\bboundary\b/i,
  diverges: /\bdiverges?\b/i,
  rings: /\brings\b/i,
  sluggish: /\bsluggish\b/i,
  verdict: /\bverdict\b/i,
  branch: /\bbranch/i,
  imaginaryaxis: /\baxis\b/i,
  shadedhalf: /shaded half/i,
  closedvsopen: /closed-loop poles?|open-loop poles?/i,
  complexplane: /complex plane/i,
  openloop: /open loop/i,
  unitcircle: /unit circle/i,
  ruleofthumb: /rule of thumb/i,
  identity: /\bidentity\b/i,
  zeta: /ζ/,
  positivefeedback: /positive[- ]feedback/i,
  latches: /\blatch/i,
  rail: /\brail\b/i,
  runsaway: /runs? away/i,
  rhp: /right half plane/i,
  resonant: /\bresonan/i,
  derivative: /\bderivative\b/i,
  filtered: /\bfiltered\b|unfiltered/i,
  noise: /\bnoise\b/i,
  floor: /\bfloor\b/i,
  wn: /ωₙ/,
  leadnetwork: /lead network/i,
  geometricmean: /geometric mean/i,
  ghost: /\bghost\b/i,
  pole: /\bpoles?\b/i,
  // "Zero" is overloaded — "the error goes to zero" is arithmetic, not the
  // transfer-function concept — so the cue requires it to read as a NOUN
  // (a determiner in front, or the plural) rather than matching the bare word.
  zero: /\b(?:the|a|its|this|that) zero\b|\bzeros\b/i,
  nyquistplot: /Nyquist/,
  rootlocus: /root locus/i,
  disturbance: /\bdisturbance\b/i,
  db: /\bdB\b/,
  radpersec: /rad\/s/,
  crossover: /\bcrossover\b/i,
  steadystate: /steady[- ]state|steady error/i,
  mhz: /mHz/,
  characteristicequation: /characteristic equation/i,
}

/** The definitions a lesson asked for, in the order it asked. */
export function termsFor(ids = []) {
  return ids.map((id) => ({ id, ...TERMS[id] })).filter((t) => t.name)
}
