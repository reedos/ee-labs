import { CIRCUITS } from './circuits.js'
import {
  magnitudeAt,
  phaseAt,
  dcGain,
  polesZeros,
  secondOrderMetrics,
  stepResponse,
} from '@ee-labs/systems'

// The math for the circuit currently on screen.
//
// Same discipline as the rest of the suite: a two-column comparison only where
// the measured side is genuinely computed from the system rather than restating
// the formula, and anything else is a derived value with no tick.
//
// Here "measured" means evaluated from the transfer function the circuit
// produced — H(s) at a frequency, or a simulated step response — while "theory"
// is the closed form written in terms of R, L and C. Those are different paths:
// one goes through the polynomial, the other through the component algebra, and
// a swapped component or a dropped factor separates them immediately.

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })

const TAU = 2 * Math.PI

/**
 * Measured phase slope in degrees per decade: a central difference of the
 * actual response, for the check rows that quote a transition rate. The
 * predicted side comes from the closed form (−(ln 10)/2 for one pole,
 * −2Q·ln 10 for a second-order corner, in rad/decade) — different path, so a
 * wrong Q or a mis-derived denominator separates them.
 */
const phaseSlope = (tf, f) => {
  const h = 1e-4
  const up = phaseAt(tf, f * Math.pow(10, h))
  const dn = phaseAt(tf, f * Math.pow(10, -h))
  return (((up - dn) / (2 * h)) * 180) / Math.PI
}

/** Blocks shared by every circuit: what H(s) is, and where its poles are. */
function common(tf, p, id) {
  const { poles, zeros } = polesZeros(tf)
  const rows = [
    { label: 'DC gain', value: dcGain(tf) },
    { label: 'poles', value: poles.length },
    { label: 'zeros', value: zeros.length },
  ]
  for (let i = 0; i < poles.length; i++) {
    const [re, im] = poles[i]
    rows.push({
      label: `pole ${i + 1}`,
      value: re,
      unit: '1/s',
      note: im ? `± j${Math.abs(im).toPrecision(4)}` : 'real',
    })
  }
  return [
    T(
      'The order of the denominator counts the independent energy stores — every capacitor ' +
        'and inductor that can hold a state of its own. That is why an RC has one pole and an ' +
        'RLC has two, and why no arrangement of resistors alone has any.',
    ),
    V(rows),
  ]
}

const ENTRIES = {
  divider: (tf, p) => ({
    blocks: [
      T(
        'Resistors store no energy, so nothing here can depend on frequency. The response is a ' +
          'real constant at every frequency, with zero phase and no poles at all.',
      ),
      F('H(s) = \\frac{R_2}{R_1 + R_2}'),
      C([
        {
          label: 'gain',
          predicted: p.r2 / (p.r1 + p.r2),
          measured: magnitudeAt(tf, 1000),
          tol: 1e-9,
        },
        { label: 'phase at 1 kHz', predicted: 0, measured: phaseAt(tf, 1000), abs: 1e-9 },
      ]),
      T(
        'Worth loading first, because everything after it is this with a frequency-dependent ' +
          'impedance in place of one resistor.',
      ),
    ],
  }),

  rcLow: (tf, p) => {
    const fc = 1 / (TAU * p.r * p.c)
    return {
      blocks: [
        T('A resistor and a capacitor form a divider whose lower leg falls with frequency:'),
        F('Z_C = \\frac{1}{sC} \\quad\\Rightarrow\\quad H(s) = \\frac{1/sC}{R + 1/sC} = \\frac{1}{1 + sRC}'),
        T(
          'The corner is where the two impedances are equal — |Z_C| = R — and there the output ' +
            'is 1/√2 of the input, which is −3.01 dB, with exactly 45° of lag. Both fall out of ' +
            'the same fact and neither is a convention.',
        ),
        T(
          'This corner is the unit every other circuit here is priced in: a 1st-order corner ' +
            'costs 45° at the corner and 90° beyond, and a circuit of order N pays that N times.',
        ),
        T(
          'The lag also arrives at a known rate. The Bode sketch draws −45° per decade per ' +
            'order across the two decades around the corner — a straight-line approximation, ' +
            'and a useful one. The true curve is steepest exactly at the corner: −(ln 10)/2 ≈ ' +
            '−1.151 rad per decade, which is −66.0° per decade — half again steeper than the ' +
            'sketch.',
        ),
        F('f_c = \\frac{1}{2\\pi RC}'),
        C([
          {
            label: `|H| at f_c = ${fc.toPrecision(5)} Hz`,
            predicted: Math.SQRT1_2,
            measured: magnitudeAt(tf, fc),
            tol: 1e-6,
          },
          {
            label: 'phase at f_c',
            predicted: -45,
            measured: (phaseAt(tf, fc) * 180) / Math.PI,
            tol: 1e-6,
          },
          {
            label: 'phase slope at f_c, −(ln 10)/2 rad',
            predicted: (-(Math.LN10 / 2) * 180) / Math.PI,
            measured: phaseSlope(tf, fc),
            tol: 1e-4,
            unit: '°/decade',
          },
          { label: 'DC gain', predicted: 1, measured: magnitudeAt(tf, 1e-9), tol: 1e-9 },
        ]),
        V([
          { label: 'time constant τ = RC', value: p.r * p.c, unit: 's' },
          { label: 'corner frequency', value: fc, unit: 'Hz' },
          { label: 'rise time (10–90%)', value: 2.2 * p.r * p.c, unit: 's' },
        ]),
        ...common(tf, p, 'rcLow'),
      ],
    }
  },

  rcHigh: (tf, p) => {
    const fc = 1 / (TAU * p.r * p.c)
    return {
      blocks: [
        T('The same divider read across the other component:'),
        F('H(s) = \\frac{R}{R + 1/sC} = \\frac{sRC}{1 + sRC}'),
        T(
          'Same pole, plus a zero at the origin. The zero is what removes DC: at s = 0 the ' +
            'numerator vanishes, which is the algebra saying a capacitor passes no steady ' +
            'current. And since the two outputs share one current, they are complementary — ' +
            'their squared magnitudes sum to 1 at every frequency, and the phase LEADS by ' +
            'exactly +45° at the corner, the mirror of the low-pass’s lag, on its way from ' +
            '+90° at DC to 0° far above.',
        ),
        F('|H_{LP}|^2 + |H_{HP}|^2 = 1'),
        C([
          {
            label: `|H| at f_c = ${fc.toPrecision(5)} Hz`,
            predicted: Math.SQRT1_2,
            measured: magnitudeAt(tf, fc),
            tol: 1e-6,
          },
          {
            label: 'phase at f_c',
            predicted: 45,
            measured: (phaseAt(tf, fc) * 180) / Math.PI,
            tol: 1e-6,
          },
          { label: 'DC gain', predicted: 0, measured: magnitudeAt(tf, 1e-9), abs: 1e-9 },
        ]),
        ...common(tf, p, 'rcHigh'),
      ],
    }
  },

  rlLow: (tf, p) => {
    const tau = p.l / p.r
    return {
      blocks: [
        T(
          'An inductor opposes a change in current, so its impedance RISES with frequency where ' +
            'a capacitor’s falls. Put it in the series position and you get a low-pass again:',
        ),
        F('Z_L = sL \\quad\\Rightarrow\\quad H(s) = \\frac{R}{R + sL} = \\frac{1}{1 + s\\,L/R}'),
        T(
          'This is the RC low-pass with L/R in place of RC. The physics is different and the ' +
            'algebra is identical, which is the reason filters are designed as transfer ' +
            'functions first and built from whatever components suit second.',
        ),
        C([
          {
            label: `|H| at 1/(2πτ) = ${(1 / (TAU * tau)).toPrecision(5)} Hz`,
            predicted: Math.SQRT1_2,
            measured: magnitudeAt(tf, 1 / (TAU * tau)),
            tol: 1e-6,
          },
          // Same algebra, same phase: the RC's 45° of lag at the corner is
          // this circuit's too, and it is exact.
          {
            label: 'phase at the corner',
            predicted: -45,
            measured: (phaseAt(tf, 1 / (TAU * tau)) * 180) / Math.PI,
            tol: 1e-6,
          },
        ]),
        V([
          { label: 'time constant τ = L/R', value: tau, unit: 's' },
          { label: 'corner frequency', value: 1 / (TAU * tau), unit: 'Hz' },
        ]),
        ...common(tf, p, 'rlLow'),
      ],
    }
  },

  rlcSeries: (tf, p, output) => {
    const m = CIRCUITS.rlcSeries.metrics(p)
    const f0 = m.w0 / TAU
    const so = secondOrderMetrics(tf)
    const atRes = output === 'r' ? 1 : m.q
    // At ω₀ the s²LC and 1 terms of the denominator cancel exactly, leaving
    // jω₀RC alone — so the phase there is pinned regardless of R.
    const phaseAtRes = output === 'r' ? 0 : output === 'l' ? 90 : -90
    return {
      blocks: [
        T(
          'One loop, one current, three voltages. The impedances are in series so they share a ' +
            'denominator, and the numerator is whichever component you measure across:',
        ),
        F(
          'H_C = \\frac{1}{s^2LC + sRC + 1}, \\quad H_R = \\frac{sRC}{s^2LC + sRC + 1}, ' +
            '\\quad H_L = \\frac{s^2LC}{s^2LC + sRC + 1}',
        ),
        T(
          'Those three numerators add up to the denominator, so the three outputs sum to the ' +
            'input exactly — Kirchhoff’s voltage law, written as an identity in s.',
        ),
        T(
          'At resonance the inductor and capacitor impedances are equal and opposite and cancel ' +
            'completely, leaving only R. The current is then at its largest, which is why the ' +
            'voltages across L and C are Q times the input while the voltage across R is exactly ' +
            'the input.',
        ),
        T(
          'The cancellation pins the phase at resonance too, and R has no say in it: a ' +
            '1st-order corner costs 45° of lag, this circuit is 2nd order, and its 90° lands ' +
            'whole on the low-pass (−90° across C). The band-pass numerator’s own +90° cancels ' +
            'it exactly (0° across R), and the high-pass numerator’s +180° overshoots it ' +
            '(+90° across L).',
        ),
        T(
          'How FAST the phase crosses f₀ is Q’s to decide, not order’s: the Bode sketch says ' +
            '−90° per decade for any 2nd-order corner, but the true slope at f₀ is 2Q·ln 10 ' +
            'rad per decade — about 264·Q degrees — and it is the same for all three outputs, ' +
            'because their numerators only add constant phase. Sharp filters do not just peak ' +
            'harder; they snap phase faster.',
        ),
        F('\\omega_0 = \\frac{1}{\\sqrt{LC}}, \\qquad ' + m.qTex),
        C([
          {
            label: `|H| at f₀ = ${f0.toPrecision(5)} Hz`,
            predicted: atRes,
            measured: magnitudeAt(tf, f0),
            tol: 1e-4,
          },
          {
            label: 'phase at f₀',
            predicted: phaseAtRes,
            measured: (phaseAt(tf, f0) * 180) / Math.PI,
            tol: 1e-6,
            abs: 1e-6,
            unit: '°',
          },
          {
            label: 'phase slope at f₀, −2Q·ln 10 rad',
            predicted: ((-2 * m.q * Math.LN10) * 180) / Math.PI,
            measured: phaseSlope(tf, f0),
            tol: 1e-3,
            unit: '°/decade',
          },
          {
            label: 'resonant frequency',
            predicted: f0,
            measured: so ? so.f0 : NaN,
            tol: 1e-6,
            unit: 'Hz',
          },
          { label: 'Q', predicted: m.q, measured: so ? so.q : NaN, tol: 1e-6 },
        ]),
        V([
          { label: 'ζ = 1/2Q', value: so ? so.zeta : NaN, note: so && so.zeta >= 1 ? 'no overshoot' : 'rings' },
          { label: 'bandwidth ω₀/Q', value: f0 / m.q, unit: 'Hz' },
          { label: 'characteristic impedance √(L/C)', value: Math.sqrt(p.l / p.c), unit: 'Ω' },
        ]),
        T(
          'ζ = 1/2Q is the same damping ratio a control course writes for a second-order plant, ' +
            'and Q is the same Q a filter course puts on a biquad. One circuit, three vocabularies.',
        ),
        ...common(tf, p, 'rlcSeries'),
      ],
    }
  },

  rlcParallel: (tf, p) => {
    const m = CIRCUITS.rlcParallel.metrics(p)
    const f0 = m.w0 / TAU
    return {
      blocks: [
        T('In parallel the admittances add, so it is 1/Z that is simple:'),
        F(
          'Y(s) = \\frac{1}{R} + \\frac{1}{sL} + sC \\quad\\Rightarrow\\quad ' +
            'Z(s) = \\frac{sL}{s^2LC + sL/R + 1}',
        ),
        T(
          'At resonance the inductor and capacitor currents are equal and opposite and cancel, ' +
            'so all the source current flows in R and the impedance peaks at exactly R. The ' +
            'series circuit did the mirror image: there the impedance DIPPED to R. Purely ' +
            'resistive means zero phase, so the phase curve crosses exactly 0° at the peak — ' +
            'from +90° (inductive) below resonance to −90° (capacitive) above.',
        ),
        F(m.qTex),
        T(
          'Note the reciprocal: series Q is (1/R)√(L/C), parallel Q is R√(C/L). More resistance ' +
            'damps a series resonance and sharpens a parallel one, because in one case R is in ' +
            'the current path and in the other it is the leak across it.',
        ),
        C([
          {
            label: `|Z| at f₀ = ${f0.toPrecision(5)} Hz`,
            predicted: p.r,
            measured: magnitudeAt(tf, f0),
            tol: 1e-4,
            unit: 'Ω',
          },
          {
            label: 'phase at f₀',
            predicted: 0,
            measured: (phaseAt(tf, f0) * 180) / Math.PI,
            abs: 1e-6,
            unit: '°',
          },
        ]),
        V([
          { label: 'resonant frequency', value: f0, unit: 'Hz' },
          { label: 'Q', value: m.q },
          { label: 'bandwidth', value: f0 / m.q, unit: 'Hz' },
        ]),
        ...common(tf, p, 'rlcParallel'),
      ],
    }
  },

  twinT: (tf, p) => {
    const m = CIRCUITS.twinT.metrics(p)
    const f0 = m.w0 / TAU
    const so = secondOrderMetrics(tf)
    const { zeros } = polesZeros(tf)
    return {
      blocks: [
        T(
          'Two complete filters share the input and the output: R–R with 2C to ground is a ' +
            'low-frequency route, C–C with R/2 to ground a high-frequency one. At ω₀ = 1/RC ' +
            'the two arrivals are equal in size and opposite in phase, and what reaches the ' +
            'output is their sum:',
        ),
        F('H(s) = \\frac{s^2R^2C^2 + 1}{s^2R^2C^2 + 4sRC + 1}'),
        T(
          'The numerator has no s term, so its roots sit at ±j/RC — ON the imaginary axis, ' +
            'not merely near it. A zero on the axis means one frequency is removed rather ' +
            'than attenuated: the notch has no bottom. Crossing it, the phase snaps 180° in ' +
            'an instant, from −90° just below to +90° just above, which no finite stack of ' +
            'ordinary corners can do.',
        ),
        C([
          {
            label: `|H| at f₀ = ${f0.toPrecision(5)} Hz`,
            predicted: 0,
            measured: magnitudeAt(tf, f0),
            abs: 1e-9,
          },
          { label: 'zero, real part (on the axis)', predicted: 0, measured: zeros.length ? zeros[0][0] : NaN, abs: 1e-9 },
          { label: 'zero, |imag| = ω₀', predicted: m.w0, measured: zeros.length ? Math.abs(zeros[0][1]) : NaN, tol: 1e-6, unit: '1/s' },
          { label: 'DC gain', predicted: 1, measured: magnitudeAt(tf, 1e-9), tol: 1e-9 },
          {
            label: 'phase just below the notch',
            predicted: -90,
            measured: (phaseAt(tf, f0 * (1 - 1e-6)) * 180) / Math.PI,
            abs: 1e-3,
            unit: '°',
          },
          {
            label: 'phase just above the notch',
            predicted: 90,
            measured: (phaseAt(tf, f0 * (1 + 1e-6)) * 180) / Math.PI,
            abs: 1e-3,
            unit: '°',
          },
          { label: 'Q', predicted: 0.25, measured: so ? so.q : NaN, tol: 1e-6 },
        ]),
        F('\\omega_0 = \\frac{1}{RC}, \\qquad ' + m.qTex),
        T(
          'Deep but blunt: Q = 1/4 is structural, written into the matched topology, and no ' +
            'choice of R or C moves it — the checks above hold at any values you set. The ' +
            'bandwidth is therefore always 4f₀ wide. Sharpening a twin-T means feedback: ' +
            'bootstrap the shunt legs from an op-amp follower and the notch narrows, which is ' +
            'the same story as the Sallen–Key — passive parts set the frequency, an amplifier ' +
            'buys the Q.',
        ),
        T(
          'One honesty note: this model keeps the network matched — the two Rs, the two Cs ' +
            'and the shunt legs track together as one R and one C. Part tolerance therefore ' +
            'moves the notch without filling it in. A real drawer errs each of the six parts ' +
            'independently, which also lifts the notch floor off zero; a two-parameter model ' +
            'cannot show that, so the tolerance cloud here understates a real twin-T’s troubles.',
        ),
        T(
          'The plot is grid-limited at the notch for the same kind of reason: it bottoms out ' +
            'wherever the nearest frequency sample lands, because no finite sample can draw a ' +
            'dip with no bottom. The |H| at f₀ row above is the measurement that can.',
        ),
        V([
          { label: 'notch frequency', value: f0, unit: 'Hz' },
          { label: 'Q', value: 0.25, note: 'fixed by the topology' },
          { label: 'bandwidth f₀/Q', value: 4 * f0, unit: 'Hz' },
        ]),
        ...common(tf, p, 'twinT'),
      ],
    }
  },

  sallenKey: (tf, p) => {
    const m = CIRCUITS.sallenKey.metrics(p)
    const f0 = m.w0 / TAU
    const so = secondOrderMetrics(tf)
    return {
      blocks: [
        T(
          'Two RC sections cannot resonate: cascading first-order lags only ever gives real ' +
            'poles, and a real pole cannot ring. The op-amp is what changes that. It feeds the ' +
            'output back through C1 into the middle of the network, and that feedback pushes the ' +
            'pole pair off the real axis.',
        ),
        F('H(s) = \\frac{1}{s^2 R_1R_2C_1C_2 + sC_2(R_1+R_2) + 1}'),
        F('\\omega_0 = \\frac{1}{\\sqrt{R_1R_2C_1C_2}}, \\qquad ' + m.qTex),
        T(
          'Q depends only on ratios of components, never on their absolute size — and there is ' +
            'no inductor anywhere. At audio frequencies an inductor of the right value would be ' +
            'large, lossy and expensive, which is the entire reason active filters displaced ' +
            'passive ones.',
        ),
        T(
          'The phase does not care that the resonance is manufactured: a 1st-order corner ' +
            'costs 45° of lag at the corner and 90° beyond, this is 2nd order, so the lag is ' +
            'exactly 90° at f₀ — whatever Q the ratios chose — heading to 180° far above. What ' +
            'Q does set is how fast it gets there: the slope at f₀ is 2Q·ln 10 rad per decade, ' +
            'so raising C1/C2 steepens the phase fall as surely as it raises the peak.',
        ),
        C([
          { label: 'resonant frequency', predicted: f0, measured: so ? so.f0 : NaN, tol: 1e-6, unit: 'Hz' },
          { label: 'Q', predicted: m.q, measured: so ? so.q : NaN, tol: 1e-6 },
          {
            label: 'phase at f₀',
            predicted: -90,
            measured: (phaseAt(tf, f0) * 180) / Math.PI,
            tol: 1e-6,
            unit: '°',
          },
          {
            label: 'phase slope at f₀, −2Q·ln 10 rad',
            predicted: ((-2 * m.q * Math.LN10) * 180) / Math.PI,
            measured: phaseSlope(tf, f0),
            tol: 1e-3,
            unit: '°/decade',
          },
          { label: 'DC gain', predicted: 1, measured: magnitudeAt(tf, 1e-9), tol: 1e-9 },
        ]),
        V([
          { label: 'ζ = 1/2Q', value: so ? so.zeta : NaN },
          { label: 'Q for a Butterworth', value: Math.SQRT1_2, note: 'flattest passband' },
          { label: 'Q for no overshoot', value: 0.5, note: 'critically damped' },
        ]),
        T(
          'Set Q to 0.707 and this is a Butterworth section — the same one a filter tool would ' +
            'call a biquad. It still overshoots 4.3% on a step; flat in frequency and clean in ' +
            'time are different requests.',
        ),
        ...common(tf, p, 'sallenKey'),
      ],
    }
  },

  inverting: (tf, p) => {
    const fp = 1 / (TAU * p.rf * p.cf)
    return {
      blocks: [
        T(
          'Negative feedback holds the inverting input at the same voltage as the grounded one, ' +
            'so it sits at zero without being connected to it — a virtual earth. All the input ' +
            'current must then flow on through the feedback impedance:',
        ),
        F('H(s) = -\\frac{Z_f}{Z_{in}} = -\\frac{R_f}{R_{in}(1 + sR_fC_f)}'),
        T(
          'The gain is a ratio, so it depends on how well two resistors match rather than on ' +
            'any absolute value — which is exactly what an integrated process can do well. The ' +
            'minus sign is a real 180° of phase, not a bookkeeping detail — but it is 180° at ' +
            'DC only. The feedback pole then takes the 1st-order toll of 45° at its corner, ' +
            'leaving exactly 135° there and only the inversion’s last 90° far above.',
        ),
        C([
          {
            label: 'DC gain −Rf/Rin',
            predicted: -p.rf / p.rin,
            measured: dcGain(tf),
            tol: 1e-9,
          },
          {
            label: `|H| at the pole, ${fp.toPrecision(5)} Hz`,
            predicted: (p.rf / p.rin) * Math.SQRT1_2,
            measured: magnitudeAt(tf, fp),
            tol: 1e-6,
          },
          {
            label: 'phase at the pole, 180° − 45°',
            predicted: 135,
            measured: (phaseAt(tf, fp) * 180) / Math.PI,
            tol: 1e-6,
            unit: '°',
          },
        ]),
        V([
          { label: 'gain', value: -p.rf / p.rin, unit: '×' },
          { label: 'gain', value: 20 * Math.log10(p.rf / p.rin), unit: 'dB' },
          { label: 'pole frequency', value: fp, unit: 'Hz' },
        ]),
        ...common(tf, p, 'inverting'),
      ],
    }
  },

  integrator: (tf, p) => {
    const st = stepResponse(tf, { duration: 5 * p.r * p.c, points: 200 })
    return {
      blocks: [
        T('Replace the feedback resistor with a capacitor and the ratio becomes a division by s:'),
        F('H(s) = -\\frac{1/sC}{R} = -\\frac{1}{sRC}'),
        T(
          'Dividing by s in the frequency domain is integrating in time, so a step in gives a ' +
            'ramp out. The pole sits exactly at the origin — not in the left half plane but on ' +
            'the boundary — which is why the output never settles and why a real integrator ' +
            'needs a large resistor across C to stop it drifting into its own supply rail.',
        ),
        F('\\frac{1}{s} \\;\\longleftrightarrow\\; \\int_0^t (\\cdot)\\,d\\tau'),
        T(
          'The magnitude falls at the 1st-order rate — 6 dB per octave, 20 dB per decade — and ' +
            'with no corner anywhere it does so forever. The phase is just as featureless: 1/s ' +
            'is a constant −90°, the inversion adds 180°, and the sum sits at exactly +90° at ' +
            'every frequency.',
        ),
        C([
          {
            label: 'ramp slope −1/RC',
            predicted: -1 / (p.r * p.c),
            measured: (st.y[st.y.length - 1] - st.y[0]) / (st.t[st.t.length - 1] - st.t[0]),
            tol: 0.01,
            unit: '1/s',
          },
          {
            label: 'gain at 1/(2πRC)',
            predicted: 1,
            measured: magnitudeAt(tf, 1 / (TAU * p.r * p.c)),
            tol: 1e-6,
          },
          {
            label: 'phase, at any frequency',
            predicted: 90,
            measured: (phaseAt(tf, 1 / (TAU * p.r * p.c)) * 180) / Math.PI,
            tol: 1e-6,
            unit: '°',
          },
        ]),
        V([
          { label: 'unity-gain frequency', value: 1 / (TAU * p.r * p.c), unit: 'Hz' },
          { label: 'slope', value: -6.02, unit: 'dB/octave' },
          { label: 'slope', value: -20, unit: 'dB/decade' },
        ]),
        ...common(tf, p, 'integrator'),
      ],
    }
  },
}

/** The math panel for a circuit, or null if it has none. */
export function circuitMath(id, tf, params, output) {
  const fn = ENTRIES[id]
  if (!fn) return null
  try {
    return fn(tf, params, output)
  } catch {
    return null
  }
}
