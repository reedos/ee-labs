// The circuits, and the transfer function each one has.
//
// A curated set of topologies rather than a general netlist solver. Every
// circuit an undergraduate course actually studies is here, each with H(s)
// derived by hand, which buys the whole curriculum for a fraction of the work
// that modified nodal analysis plus symbolic pole extraction would cost. The
// day a circuit is wanted that cannot be expressed this way is the day the
// general solver earns its keep.
//
// Each entry declares:
//   params    the component values, rendered as numeric fields
//   outputs   where the output is measured — one circuit often gives several
//   tf        H(s) as { b, a }, highest power of s first
//   derive    the algebra, for the math panel
//
// Values are SI throughout: ohms, henries, farads.

const R = (key, label, value, hint) => ({
  key,
  label,
  unit: 'Ω',
  value,
  min: 1,
  max: 1e6,
  scale: 'log',
  hint,
})
const L = (key, label, value, hint) => ({
  key,
  label,
  unit: 'H',
  value,
  min: 1e-6,
  max: 1,
  scale: 'log',
  hint,
})
const C = (key, label, value, hint) => ({
  key,
  label,
  unit: 'F',
  value,
  min: 1e-12,
  max: 1e-3,
  scale: 'log',
  hint,
})

export const CIRCUIT_GROUPS = ['First order', 'Second order', 'Active']

export const CIRCUITS = {
  divider: {
    name: 'Voltage divider',
    group: 'First order',
    hint:
      'Two resistors, no reactance, so nothing depends on frequency. The flat line is the ' +
      'point: this is what "no dynamics" looks like before anything else is added.',
    params: [R('r1', 'R1 (series)', 1000), R('r2', 'R2 (to ground)', 1000)],
    outputs: [{ key: 'out', label: 'across R2' }],
    tf: (p) => ({ b: [p.r2], a: [p.r1 + p.r2] }),
    derive: {
      tex: 'H(s) = \\frac{R_2}{R_1 + R_2}',
      note: 'No s anywhere, so the response is a constant at every frequency and the phase is zero.',
    },
  },

  rcLow: {
    name: 'RC low-pass',
    group: 'First order',
    hint:
      'The first filter anyone meets. The capacitor is an open circuit at DC and a short at high ' +
      'frequency, so low frequencies reach the output and high ones are shunted to ground. A ' +
      '1st-order corner costs 45° of lag at the corner and 90° beyond; this is 1st order, so the ' +
      'output lags exactly 45° at the cutoff.',
    params: [R('r', 'R', 1000), C('c', 'C', 100e-9)],
    outputs: [{ key: 'c', label: 'across C' }],
    tf: (p) => ({ b: [1], a: [p.r * p.c, 1] }),
    derive: {
      tex: 'H(s) = \\frac{1/sC}{R + 1/sC} = \\frac{1}{1 + sRC}',
      note:
        'A single pole at s = -1/RC. The corner is where the resistor and the capacitor have ' +
        'equal impedance, which is why it lands at 1/(2 pi RC).',
    },
  },

  rcHigh: {
    name: 'RC high-pass',
    group: 'First order',
    hint:
      'The same two components with the output taken across the resistor instead. Everything ' +
      'the low-pass keeps, this one discards, and vice versa. The phase LEADS here — exactly ' +
      '+45° at the corner, from +90° at DC down to 0° far above.',
    params: [R('r', 'R', 1000), C('c', 'C', 100e-9)],
    outputs: [{ key: 'r', label: 'across R' }],
    tf: (p) => ({ b: [p.r * p.c, 0], a: [p.r * p.c, 1] }),
    derive: {
      tex: 'H(s) = \\frac{R}{R + 1/sC} = \\frac{sRC}{1 + sRC}',
      note:
        'Same pole as the low-pass, plus a zero at the origin. The zero is what kills DC, and ' +
        'the two responses sum to 1 at every frequency because they share one current.',
    },
  },

  rlLow: {
    name: 'RL low-pass',
    group: 'First order',
    hint:
      'An inductor resists a change in current, so it blocks high frequencies where a capacitor ' +
      'would pass them. Different physics, identical algebra: the time constant is L/R — and ' +
      'identical phase, with the same exact 45° of lag at the corner.',
    params: [R('r', 'R', 1000), L('l', 'L', 100e-3)],
    outputs: [{ key: 'r', label: 'across R' }],
    tf: (p) => ({ b: [1], a: [p.l / p.r, 1] }),
    derive: {
      tex: 'H(s) = \\frac{R}{R + sL} = \\frac{1}{1 + s\\,L/R}',
      note:
        'Exactly the RC low-pass with RC replaced by L/R. Nothing downstream can tell the two ' +
        'apart, which is why filters are designed as transfer functions and only then built.',
    },
  },

  rlcSeries: {
    name: 'Series RLC',
    group: 'Second order',
    hint:
      'One circuit, three filters. The same current flows through all three components, so the ' +
      'voltage across each is a different filter of the same input — low-pass, band-pass and ' +
      'high-pass, sharing one resonance. At that resonance the phase is pinned whatever R is: ' +
      '−90° across C, 0° across R, +90° across L.',
    params: [R('r', 'R', 100), L('l', 'L', 10e-3), C('c', 'C', 100e-9)],
    outputs: [
      { key: 'c', label: 'across C — low-pass' },
      { key: 'r', label: 'across R — band-pass' },
      { key: 'l', label: 'across L — high-pass' },
    ],
    tf: (p, out) => {
      const den = [p.l * p.c, p.r * p.c, 1]
      if (out === 'r') return { b: [p.r * p.c, 0], a: den }
      if (out === 'l') return { b: [p.l * p.c, 0, 0], a: den }
      return { b: [1], a: den }
    },
    derive: {
      tex:
        'H_C = \\frac{1}{s^2LC + sRC + 1}, \\quad H_R = \\frac{sRC}{s^2LC + sRC + 1}, ' +
        '\\quad H_L = \\frac{s^2LC}{s^2LC + sRC + 1}',
      note:
        'One denominator, three numerators. They differ only in how many powers of s sit on ' +
        'top, and those three numerators add up to the denominator — so the three outputs sum ' +
        'to the input exactly, at every frequency.',
    },
    metrics: (p) => ({
      w0: 1 / Math.sqrt(p.l * p.c),
      q: (1 / p.r) * Math.sqrt(p.l / p.c),
      qTex: 'Q = \\frac{1}{R}\\sqrt{\\frac{L}{C}}',
    }),
  },

  rlcParallel: {
    name: 'Parallel RLC (tank)',
    group: 'Second order',
    hint:
      'The same three components in parallel, driven by a current. Its impedance PEAKS at ' +
      'resonance where the series circuit dipped, and the resistor now sets Q the other way ' +
      'round: more resistance means a sharper peak, not a blunter one. At the peak the phase ' +
      'is exactly 0° — the tank is purely resistive there.',
    params: [R('r', 'R', 10000), L('l', 'L', 10e-3), C('c', 'C', 100e-9)],
    outputs: [{ key: 'z', label: 'impedance Z(s)' }],
    tf: (p) => ({ b: [p.l, 0], a: [p.l * p.c, p.l / p.r, 1] }),
    derive: {
      tex: 'Z(s) = \\frac{1}{\\frac{1}{R} + \\frac{1}{sL} + sC} = \\frac{sL}{s^2LC + sL/R + 1}',
      note:
        'At resonance the inductor and capacitor currents cancel exactly and only the resistor ' +
        'is left, so Z = R at the peak. Raising R raises both the peak and the Q.',
    },
    metrics: (p) => ({
      w0: 1 / Math.sqrt(p.l * p.c),
      q: p.r * Math.sqrt(p.c / p.l),
      qTex: 'Q = R\\sqrt{\\frac{C}{L}}',
    }),
  },

  sallenKey: {
    name: 'Sallen–Key low-pass',
    group: 'Active',
    hint:
      'A second-order low-pass with no inductor at all. The op-amp feeds the signal back through ' +
      'C1, which manufactures the resonance an inductor would otherwise provide — and Q comes ' +
      'from component RATIOS, which is why active filters displaced passive ones. A 1st-order ' +
      'corner costs 45° at the corner and 90° beyond; this is 2nd order, so the lag is exactly ' +
      '90° at f₀, heading to 180°.',
    params: [
      R('r1', 'R1', 10000),
      R('r2', 'R2', 10000),
      C('c1', 'C1 (feedback)', 22e-9),
      C('c2', 'C2 (to ground)', 10e-9),
    ],
    outputs: [{ key: 'out', label: 'op-amp output' }],
    tf: (p) => ({ b: [1], a: [p.r1 * p.r2 * p.c1 * p.c2, p.c2 * (p.r1 + p.r2), 1] }),
    derive: {
      tex: 'H(s) = \\frac{1}{s^2 R_1R_2C_1C_2 + sC_2(R_1+R_2) + 1}',
      note:
        'Node B gives V_A = V_B(1 + sR_2C_2); substituting into the node-A current balance and ' +
        'using V_out = V_B for the unity-gain buffer gives the denominator above.',
    },
    metrics: (p) => ({
      w0: 1 / Math.sqrt(p.r1 * p.r2 * p.c1 * p.c2),
      q: Math.sqrt(p.r1 * p.r2 * p.c1 * p.c2) / (p.c2 * (p.r1 + p.r2)),
      qTex: 'Q = \\frac{\\sqrt{R_1R_2C_1C_2}}{C_2(R_1+R_2)}',
    }),
  },

  inverting: {
    name: 'Inverting amplifier',
    group: 'Active',
    hint:
      'Gain set by a ratio of resistors, and negative — the output is upside down, which reads ' +
      'as 180° of phase at DC. The feedback capacitor adds one pole, and a 1st-order corner ' +
      'costs 45°: exactly 135° remain at the corner, and only the inversion’s last 90° far above.',
    params: [R('rin', 'R input', 1000), R('rf', 'R feedback', 10000), C('cf', 'C feedback', 1e-9)],
    outputs: [{ key: 'out', label: 'op-amp output' }],
    tf: (p) => ({ b: [-p.rf], a: [p.rin * p.rf * p.cf, p.rin] }),
    derive: {
      tex: 'H(s) = -\\frac{Z_f}{Z_{in}} = -\\frac{R_f}{R_{in}\\left(1 + sR_fC_f\\right)}',
      note:
        'The inverting input is a virtual earth, so the input current V/R_in must all flow ' +
        'through the feedback impedance. Gain is -R_f/R_in at DC, rolling off past 1/(2 pi R_fC_f).',
    },
  },

  integrator: {
    name: 'Op-amp integrator',
    group: 'Active',
    hint:
      'A pole exactly at the origin: infinite gain at DC, falling at the 1st-order rate — 6 dB ' +
      'per octave, 20 dB per decade — forever, with the phase held at exactly +90° at every ' +
      'frequency. This is the one circuit here that is not stable on its own, and the pole-zero ' +
      'view shows why — the pole sits on the boundary rather than inside it.',
    params: [R('r', 'R', 10000), C('c', 'C', 10e-9)],
    outputs: [{ key: 'out', label: 'op-amp output' }],
    tf: (p) => ({ b: [-1], a: [p.r * p.c, 0] }),
    derive: {
      tex: 'H(s) = -\\frac{1/sC}{R} = -\\frac{1}{sRC}',
      note:
        'Dividing by s in the frequency domain is integrating in time. A step in gives a ramp ' +
        'out, which never settles — so the step response here grows without bound, correctly.',
    },
  },
}

/** The transfer function for a circuit, its parameters and a chosen output. */
export function transferOf(id, params, output) {
  const c = CIRCUITS[id]
  return c.tf(params, output || c.outputs[0].key)
}

/** Default parameter values for a circuit. */
export function defaultsOf(id) {
  const out = {}
  for (const p of CIRCUITS[id].params) out[p.key] = p.value
  return out
}
