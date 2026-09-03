import { series, closeLoop, polyAdd, polyMul, polesZeros } from '@ee-labs/systems'
import { fmt, fmtNum } from '@ee-labs/ui'

// The things being controlled, and the things doing the controlling.
//
// A plant is whatever you are stuck with; a controller is what you get to
// choose. Keeping them in separate lists is not tidiness — it is the whole
// shape of the subject. Every question in a controls course is some version of
// "given this plant, what controller makes it behave", and the tool should make
// that pairing the obvious thing to vary.

// Ranges span circuit timescales as well as mechanical ones.
//
// They were originally set for the process-control end of the world — seconds,
// and radians per second in the tens — and a circuit handed over from Circuit
// Lab resonates at 31,000 rad/s. It arrived clamped to the top of the range and
// silently became a different plant, which is exactly the failure a handover is
// supposed to make impossible. Closing a loop around a filter at a few kHz is
// an ordinary thing to want.
const P = (key, label, value, min, max, hint, unit = '') => ({
  key,
  label,
  value,
  min,
  max,
  unit,
  scale: 'log',
  hint,
})

export const PLANT_GROUPS = ['First order', 'Second order', 'Hard to control', 'Any transfer function']

// Circuit Lab's knob ranges (circuits.js R/L/C helpers). toCircuitLab.test.js
// pins these against the catalog itself, so a change there fails here. They
// live in this file because the second-order plant's hint has to know
// whether the circuit it names can actually be built next door.
export const CIRCUIT_KNOBS = {
  r: [1, 1e6],
  l: [1e-6, 1],
  c: [1e-12, 1e-3],
}
const onKnob = (v, [lo, hi]) => Number.isFinite(v) && v >= lo && v <= hi

/**
 * The series RLC a second-order plant is, with L chosen so C and R land on
 * Circuit Lab's knobs — or null when no L in the catalog's range can. The
 * hint, the math panel and the hand-over link all read this one mapping.
 */
export function rlcFor(p) {
  if (p.k !== 1) return null
  for (const L of [0.01, 1e-3, 0.1, 1, 1e-4, 1e-5, 1e-6]) {
    const C = 1 / (p.wn * p.wn * L)
    const R = 2 * p.zeta * Math.sqrt(L / C)
    if (onKnob(R, CIRCUIT_KNOBS.r) && onKnob(L, CIRCUIT_KNOBS.l) && onKnob(C, CIRCUIT_KNOBS.c)) return { R, L, C }
  }
  return null
}

// A number as TeX, for the custom plant's live formula. Exponent form where
// plain digits would be a wall of zeros (an RLC arrives with LC ≈ 1e-10).
const texNum = (v) => {
  const a = Math.abs(v)
  if (a !== 0 && (a >= 1e4 || a < 1e-3)) {
    const [m, ex] = v.toExponential(3).split('e')
    return `${Number(m)}\\times 10^{${Number(ex)}}`
  }
  return String(Number(v.toPrecision(4)))
}
const texPoly = (c2, c1, c0) => {
  const terms = []
  if (Math.abs(c2) > 1e-30) terms.push(`${texNum(c2)}\\,s^2`)
  if (Math.abs(c1) > 1e-30) terms.push(`${texNum(c1)}\\,s`)
  if (Math.abs(c0) > 1e-30 || !terms.length) terms.push(texNum(c0))
  return terms.join(' + ').replace(/\+ -/g, '- ')
}
const trimLeading = (c) => {
  const out = [...c]
  while (out.length > 1 && Math.abs(out[0]) < 1e-30) out.shift()
  return out
}

export const PLANTS = {
  firstOrder: {
    name: 'First order lag',
    group: 'First order',
    hint:
      'An RC network, a gate charging through its driver, a decoupled rail settling after a load step. It has ' +
    'no overshoot of its own and no way to become unstable. One pole costs at most 90° of lag, 45° of it ' +
    'already spent at its corner ω = 1/τ, so however high the gain, the loop never reaches the −180° where ' +
    'feedback turns against you. The easiest thing there is to control.',
    params: [P('k', 'Gain K', 1, 0.001, 1e6), P('tau', 'Time constant τ', 1, 1e-7, 100, null, 's')],
    tf: (p) => ({ b: [p.k], a: [p.tau, 1] }),
    tex: 'P(s) = \\frac{K}{1 + \\tau s}',
    // The bridge back to Circuit Lab: the network this plant IS, with
    // component values derived from the CURRENT parameters. The math panel
    // prints the mapping and measures that the component-built network
    // matches the plant it claims to be.
    circuit: {
      text: (p) => {
        const C = p.tau / 1000
        return (
          `Circuit Lab's RC low-pass — τ is literally R·C. With R = 1 kΩ, C = ${fmt(C, 'F', 3)} ` +
          `gives this exact τ${p.k === 1 ? '' : `; the gain K is a ×${fmtNum(p.k, 3)} amplifier after it`}.`
        )
      },
      tex: 'H(s) = K\\cdot\\frac{1}{1 + sRC}',
      tf: (p) => {
        const R = 1000
        const C = p.tau / R
        return { b: [p.k], a: [R * C, 1] }
      },
    },
  },

  integrator: {
    name: 'Integrator',
    group: 'First order',
    hint:
      'A current source charging a capacitor, or a PLL\'s phase, which accumulates frequency: the input sets ' +
    'the RATE, so the output accumulates. Its pole sits at the origin, which is why proportional control ' +
    'alone already gives zero steady-state error to a step.',
    params: [P('k', 'Gain K', 1, 0.001, 1e6)],
    tf: (p) => ({ b: [p.k], a: [1, 0] }),
    tex: 'P(s) = \\frac{K}{s}',
    circuit: {
      text: (p) => {
        const C = 1e-3 / p.k
        return (
          'a transconductance driving a bare capacitor: the current gₘ·vin charges C, so ' +
          `K = gₘ/C. With gₘ = 1 mS, C = ${fmt(C, 'F', 3)} gives this exact K.`
        )
      },
      tex: 'H(s) = \\frac{g_m}{sC}',
      tf: (p) => {
        const gm = 1e-3
        const C = gm / p.k
        return { b: [gm], a: [C, 0] }
      },
    },
  },

  secondOrder: {
    name: 'Second order',
    group: 'Second order',
    // A function of the parameters: the sentence promised Circuit Lab's RLC
    // beside a plant whose ωₙ = 6.28 rad/s needs C = 2.5 F, four decades
    // past the catalog's knob — so no link was drawn under a hint that
    // named one. The hint now says which it is.
    hint: (p) =>
      (rlcFor(p)
        ? 'The series RLC from Circuit Lab, exactly — the "Open in Circuit Lab" link below builds it — '
        : 'The same shape as Circuit Lab\'s series RLC — at values outside its knobs (this ωₙ needs ' +
          `C = ${fmt(1 / (p.wn * p.wn * 1), 'F', 2)} with L = 1 H; the catalog stops at 1 mF), so no link — `) +
      'a filter tank, a crystal, any tuned stage. It has a ' +
      'resonance of its own before you touch it, and its pole pair spends 180° of phase in ' +
      'total, falling through −90° at ωₙ — the lighter the damping, the more abruptly. A ' +
      'controller can damp the resonance or make it very much worse.',
    params: [
      P('k', 'Gain K', 1, 0.001, 1e6),
      P('wn', 'Natural frequency ωₙ', 6.283, 0.01, 1e8, null, 'rad/s'),
      P('zeta', 'Damping ζ', 0.3, 0.01, 5),
    ],
    tf: (p) => ({ b: [p.k * p.wn * p.wn], a: [1, 2 * p.zeta * p.wn, p.wn * p.wn] }),
    tex: 'P(s) = \\frac{K\\omega_n^2}{s^2 + 2\\zeta\\omega_n s + \\omega_n^2}',
    circuit: {
      text: (p) => {
        // The values the hand-over link would carry, when one can be built;
        // otherwise the 10 mH pair, named as unbuildable rather than
        // promised (the sentence once put "C = 2.5 F" beside a link that
        // was not there).
        const built = rlcFor(p)
        const L = built ? built.L : 0.01
        const C = 1 / (p.wn * p.wn * L)
        const R = 2 * p.zeta * Math.sqrt(L / C)
        return (
          'Circuit Lab\'s series RLC, read across the capacitor: ωₙ = 1/√(LC) and ' +
          `ζ = (R/2)·√(C/L). With L = ${fmt(L, 'H', 3)}: C = ${fmt(C, 'F', 3)}, R = ${fmt(R, 'Ω', 3)}` +
          `${p.k === 1 ? '' : `, then a ×${fmtNum(p.k, 3)} amplifier`}` +
          (built
            ? '.'
            : ' — outside Circuit Lab\'s knobs (C ≤ 1 mF, L ≤ 1 H), so the same shape, not a circuit it can build.')
        )
      },
      tex: 'H(s) = K\\cdot\\frac{1}{LC\\,s^2 + RC\\,s + 1}',
      tf: (p) => {
        const L = 0.01
        const C = 1 / (p.wn * p.wn * L)
        const R = 2 * p.zeta * Math.sqrt(L / C)
        return { b: [p.k], a: [L * C, R * C, 1] }
      },
    },
  },

  motor: {
    name: 'Motor position',
    group: 'Second order',
    hint:
      'A DC motor under voltage drive, the EE lab\'s classic servo plant: the winding\'s lag sets the speed, ' +
    'and position is speed integrated. K/(s(1+τs)), and impossible to destabilise with proportional gain ' +
    'alone: the integrator holds a flat −90°, the lag adds at most 90° more, so the phase approaches −180° ' +
    'but never arrives.',
    params: [P('k', 'Gain K', 1, 0.001, 1e6), P('tau', 'Time constant τ', 0.5, 1e-7, 100, null, 's')],
    tf: (p) => ({ b: [p.k], a: [p.tau, 1, 0] }),
    tex: 'P(s) = \\frac{K}{s(1 + \\tau s)}',
    circuit: {
      text: (p) => {
        const C = p.tau / 1000
        const C2 = 1e-3 / p.k
        return (
          'the RC lag feeding the transconductance integrator: R·C sets τ, gₘ/C₂ sets K. ' +
          `With R = 1 kΩ, C = ${fmt(C, 'F', 3)}; gₘ = 1 mS, C₂ = ${fmt(C2, 'F', 3)}.`
        )
      },
      tex: 'H(s) = \\frac{1}{1+sRC}\\cdot\\frac{g_m}{sC_2}',
      tf: (p) => {
        const R = 1000
        const C = p.tau / R
        const gm = 1e-3
        const C2 = gm / p.k
        return { b: [gm], a: polyMul([R * C, 1], [C2, 0]) }
      },
    },
  },

  threePole: {
    name: 'Three lags',
    group: 'Hard to control',
    hint:
      'Three buffered RC stages in series. Each costs up to 90° of phase, 45° of it already at its corner, so ' +
    'together they can reach −180° while the gain is still above one, and that is the condition for the loop ' +
    'to oscillate. Turn the gain up and watch it happen.',
    params: [
      P('k', 'Gain K', 1, 0.001, 1e6),
      P('t1', 'τ₁', 1, 1e-7, 100, null, 's'),
      P('t2', 'τ₂', 0.5, 1e-7, 100, null, 's'),
      P('t3', 'τ₃', 0.25, 1e-7, 100, null, 's'),
    ],
    tf: (p) => ({
      b: [p.k],
      a: polyMul(polyMul([p.t1, 1], [p.t2, 1]), [p.t3, 1]),
    }),
    tex: 'P(s) = \\frac{K}{(1+\\tau_1 s)(1+\\tau_2 s)(1+\\tau_3 s)}',
    circuit: {
      text: (p) => {
        const C = 1e-6
        return (
          'three RC stages, each BUFFERED so the next cannot load it (unbuffered, the stages ' +
          `pull each other's poles). With C = 1 µF each: R₁ = ${fmt(p.t1 / C, 'Ω', 3)}, ` +
          `R₂ = ${fmt(p.t2 / C, 'Ω', 3)}, R₃ = ${fmt(p.t3 / C, 'Ω', 3)}` +
          `${p.k === 1 ? '' : `, and a ×${fmtNum(p.k, 3)} amplifier`}.`
        )
      },
      tex: 'H(s) = K\\prod_{i=1}^{3}\\frac{1}{1+sR_iC}',
      tf: (p) => {
        const C = 1e-6
        const stage = (t) => [(t / C) * C, 1]
        return { b: [p.k], a: polyMul(polyMul(stage(p.t1), stage(p.t2)), stage(p.t3)) }
      },
    },
  },

  unstable: {
    name: 'Unstable plant',
    group: 'Hard to control',
    hint:
      'A pole in the RIGHT half plane: an op-amp wired with positive feedback, a maglev coil, a tunnel diode ' +
    'biased in its negative-resistance region. Left alone the state runs away exponentially, and feedback is ' +
    'not an improvement here but the only reason it works at all. Too LITTLE gain is the failure mode here. ' +
    'The loop holds only while Kp·K > p, so the controllers open at Kp = 5, turn it down past 1 and the loop ' +
    'latches.',
    params: [P('k', 'Gain K', 1, 0.001, 1e6), P('p', 'Unstable pole at +p', 1, 0.01, 1e6, null, '1/s')],
    tf: (p) => ({ b: [p.k], a: [1, -p.p] }),
    tex: 'P(s) = \\frac{K}{s - p}',
    // The registry defaults (Kp = 1) put every controller EXACTLY on this
    // plant's boundary, Kp·K = p: four picker clicks, four marginal loops.
    // A plant may name the gains its controllers open with.
    ctrlDefaults: { p: { kp: 5 }, pi: { kp: 5 }, pid: { kp: 5 }, lead: { k: 5 } },
    circuitNote:
      'No passive network can be this plant: resistors, capacitors and inductors only ever ' +
      'dissipate or store, so their poles never reach the right half plane — a claim the test ' +
      'suite measures against every circuit analogue in this panel. Building a growing mode ' +
      'takes an active element pumping energy in: an op-amp wired for positive feedback — a ' +
      'latch fighting to be an amplifier.',
  },

  custom: {
    name: 'Custom H(s)',
    group: 'Any transfer function',
    hint:
      'The raw form every named plant reduces to, six coefficients, highest power first, and how a circuit ' +
    'arrives from Circuit Lab without approximation: the link hands over the exact polynomials, not a nearest ' +
    'named fit. A first-order arrival simply has b₂ = a₂ = 0.',
    // Coefficients are signed, span decades (an RLC arrives with a₂ = LC ≈
    // 1e-10), and are link-fed first, hand-typed second — so plain compact
    // fields with effectively-unclamped bounds, not log sliders.
    params: [
      { key: 'b2', label: 'b₂', value: 0, min: -1e12, max: 1e12, unit: '', scale: 'linear', step: 1e-12, compact: true },
      { key: 'b1', label: 'b₁', value: 0, min: -1e12, max: 1e12, unit: '', scale: 'linear', step: 1e-12, compact: true },
      { key: 'b0', label: 'b₀', value: 1, min: -1e12, max: 1e12, unit: '', scale: 'linear', step: 1e-12, compact: true },
      { key: 'a2', label: 'a₂', value: 0, min: -1e12, max: 1e12, unit: '', scale: 'linear', step: 1e-12, compact: true },
      { key: 'a1', label: 'a₁', value: 1, min: -1e12, max: 1e12, unit: '', scale: 'linear', step: 1e-12, compact: true },
      { key: 'a0', label: 'a₀', value: 1, min: -1e12, max: 1e12, unit: '', scale: 'linear', step: 1e-12, compact: true },
    ],
    tf: (p) => ({ b: trimLeading([p.b2, p.b1, p.b0]), a: trimLeading([p.a2, p.a1, p.a0]) }),
    tex: (p) => `P(s) = \\frac{${texPoly(p.b2, p.b1, p.b0)}}{${texPoly(p.a2, p.a1, p.a0)}}`,
  },
}

export const CONTROLLERS = {
  p: {
    name: 'Proportional',
    hint:
      'Output proportional to error, and nothing else. Simple, fast, and it cannot remove steady-state error ' +
    'unless the plant already contains an integrator, because zero error would mean zero output.',
    params: [P('kp', 'Kp', 1, 0.001, 1000)],
    tf: (c) => ({ b: [c.kp], a: [1] }),
    tex: 'C(s) = K_p',
  },

  pi: {
    name: 'PI',
    hint:
      'Adding an integrator drives steady-state error to zero: the integral keeps growing until the error is ' +
    'gone. It costs phase, a pole at the origin is a flat −90° at every frequency, not just some, so the ' +
    'margin shrinks and the loop becomes more willing to oscillate.',
    params: [P('kp', 'Kp', 1, 0.001, 1000), P('ki', 'Ki', 1, 0.001, 1000)],
    tf: (c) => ({ b: [c.kp, c.ki], a: [1, 0] }),
    tex: 'C(s) = K_p + \\frac{K_i}{s} = \\frac{K_p s + K_i}{s}',
  },

  pid: {
    name: 'PID',
    hint:
      'Derivative action is a zero, and zeros ADD phase, up to +90°, against the integrator\'s flat −90°, by ' +
    'responding to where the error is heading rather than where it is. That buys back the margin the ' +
    'integrator spent. It also amplifies noise, which is why real derivative terms are always filtered.',
    params: [
      P('kp', 'Kp', 1, 0.001, 1000),
      P('ki', 'Ki', 1, 0.001, 1000),
      P('kd', 'Kd', 0.1, 0.0001, 100),
    ],
    tf: (c) => ({ b: [c.kd, c.kp, c.ki], a: [1, 0] }),
    tex: 'C(s) = K_p + \\frac{K_i}{s} + K_d s = \\frac{K_d s^2 + K_p s + K_i}{s}',
  },

  lead: {
    name: 'Lead',
    hint:
      'A zero below a pole. It ADDS phase in the band between them, peaking at their geometric mean, put that ' +
    'peak at the crossover and it is exactly what a loop short of margin needs, and unlike a derivative term ' +
    'its high-frequency gain is bounded, so it does not amplify noise without limit. (Drag the zero past the ' +
    'pole and it is a LAG instead: the same structure now subtracts phase in the band between them.)',
    // Kc, not K: the plant's gain is K, and a lesson with both on screen had
    // "two things called K" (student review). The symbol follows the label
    // into the diagram box, the locus readout and the chips.
    params: [
      { ...P('k', 'Kc (gain)', 1, 0.001, 1000), symbol: 'Kc' },
      P('z', 'Zero at', 1, 0.001, 1e7, null, 'rad/s'),
      P('p', 'Pole at', 10, 0.001, 1e8, null, 'rad/s'),
    ],
    tf: (c) => ({ b: [c.k / c.z, c.k], a: [1 / c.p, 1] }),
    tex: 'C(s) = K_c\\,\\frac{1 + s/z}{1 + s/p}, \\qquad z < p',
  },
}

/**
 * Open loop L = C·P, the closed loop T = L/(1+L) around it, and the
 * DISTURBANCE path — the response at the output to a step shoved in at the
 * plant's input, where real disturbances arrive (a load transient, ripple
 * from the supply):
 *
 *   Gd = P / (1 + C·P) = Pb·Ca / (Pa·Ca + Pb·Cb)
 *
 * Same denominator as T — the loop has ONE set of poles however you poke it —
 * but a different numerator, and the difference is the whole story: at DC an
 * integrator in C makes Gd exactly zero, which is feedback not merely reducing
 * a disturbance but erasing it.
 */
export function buildLoop(plantId, plantParams, ctrlId, ctrlParams) {
  // Normalized so the open loop's a[0] = 1 (same rule as Circuit Lab's
  // transferOf): three microsecond lags multiply into a leading coefficient
  // around 1e-16, and raw-scaled polynomials are what let an absolute
  // epsilon anywhere downstream quietly change the loop's order. H(s) is a
  // ratio; the scale is free, so choose the one every instrument expects.
  const norm = (tf) => {
    const g = tf.a[0]
    if (!Number.isFinite(g) || g === 0 || g === 1) return tf
    return { b: tf.b.map((v) => v / g), a: tf.a.map((v) => v / g) }
  }
  const P0 = PLANTS[plantId].tf(plantParams)
  const C0 = CONTROLLERS[ctrlId].tf(ctrlParams)
  const L = norm(series(C0, P0))
  const disturbance = norm({
    b: polyMul(P0.b, C0.a),
    a: polyAdd(polyMul(P0.a, C0.a), polyMul(P0.b, C0.b)),
  })
  return { plant: P0, controller: C0, open: L, closed: closeLoop(L), disturbance }
}

/**
 * Does the step trace actually reach its destination on screen?
 *
 * The readout prints where the loop settles (the DC gain), and the plot has a
 * finite right edge — capped at 400 s for very slow loops. When the trace has
 * not entered the 2% band by its last sample, the number and the picture
 * disagree, and the honest move is to say so in the readout rather than let a
 * reader hunt the plot for a settle it never shows.
 */
export function settlesOnScreen(y, final) {
  if (!y.length || !Number.isFinite(final)) return true
  let peak = 0
  for (let i = 0; i < y.length; i++) {
    const a = Math.abs(y[i])
    if (a > peak) peak = a
  }
  const size = Math.max(Math.abs(final), peak)
  if (size < 1e-12) return true
  return Math.abs(y[y.length - 1] - final) <= 0.02 * size
}

export const defaultsOf = (defs) => {
  const out = {}
  for (const p of defs.params) out[p.key] = p.value
  return out
}

/**
 * The plant's bandwidth, as one number: the geometric mean of its nonzero
 * pole magnitudes, in rad/s. 1 for a plant with no such pole (a bare
 * integrator), which is also the scale the registry defaults were tuned at.
 */
export function plantBandwidth(plantId, plantP) {
  const tf = PLANTS[plantId].tf(plantP)
  const ws = polesZeros(tf)
    .poles.map(([re, im]) => Math.hypot(re, im))
    .filter((w) => w > 1e-9)
  if (!ws.length) return 1
  return Math.exp(ws.reduce((s, w) => s + Math.log(w), 0) / ws.length)
}

/**
 * The gains a controller opens with for THIS plant — what the picker buttons
 * and a link arrival use.
 *
 * The registry defaults were tuned for plants around 1 rad/s. Two things
 * broke on plants that are not: the unstable plant's Kp = 1 sat exactly on
 * its own boundary (Kp·K = p), and a series RLC handed over at 31 krad/s
 * with Ki = 1 gave the loop a pole at −0.5 rad/s beside a pair at 31 krad/s
 * — "Too stiff to simulate" one click after a banner said "switch to PI".
 * So: a plant may override the gains (unstable: Kp = 5), and the integral
 * and derivative gains scale with the plant's bandwidth ωc — the PI corner
 * Ki/Kp a decade below ωc, the derivative corner Kp/Kd a decade above.
 * systems.test.js measures every plant × controller stable at these, and
 * the RLC arrival affordable.
 */
export function ctrlDefaultsFor(plantId, plantP, ctrlId) {
  const ctrl = CONTROLLERS[ctrlId]
  const out = { ...defaultsOf(ctrl), ...(PLANTS[plantId].ctrlDefaults?.[ctrlId] || {}) }
  const wc = plantBandwidth(plantId, plantP)
  const clampTo = (key, v) => {
    const def = ctrl.params.find((p) => p.key === key)
    return Math.min(def.max, Math.max(def.min, v))
  }
  if (ctrlId === 'pi' || ctrlId === 'pid') out.ki = clampTo('ki', (out.kp * wc) / 10)
  if (ctrlId === 'pid') out.kd = clampTo('kd', out.kp / (10 * wc))
  return out
}
