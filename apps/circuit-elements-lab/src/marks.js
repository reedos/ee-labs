// What the plots point at, as data. Each entry takes the knobs and the
// analysis and returns the marks its plot draws and its caption lists:
//
//   { kind: 'level',   axis, y, label, value, unit }             a horizontal line
//   { kind: 'point',   axis, x, y, label, value, unit }          a dot on the plot
//   { kind: 'segment', axis, x0, y0, x1, y1, label, value, unit } a straight construction line
//   { kind: 'time',    x, label }                                a vertical line (the scope's instants)
//   { kind: 'curve',   xs, ys, label, value, unit }              an overlay curve, ys already 0..1 of the frame
//
// `x` is the plot's own abscissa: time for the scope, frequency for the
// frequency plots, load resistance for the sweep. `axis` names the scale the
// y belongs to ('left' or 'right'). `value` and `unit` are what the caption
// prints after the label — the number the mark stands for, so the caption
// and the drawing cannot disagree. Every number here is a closed form of the
// knobs, and the tests hold each one against the engine's own reading.
//
// A curve is the exception to "y belongs to a scale": its ys are a fraction of
// the frame's height, so its height cannot be read off either axis beside it.
// Its label says that in the words the suite uses for a magnified exhibit,
// "drawn to fit", and `value` carries the one number worth reading off it, the
// peak. marks.test.jsx holds every curve's label to the phrase.

import { complex as cx } from '@ee-labs/network'

const ONE_TAU = 1 - Math.exp(-1)

/** α, ω₀, ζ and ω_d of a series RLC from its knobs. */
function rlc(p) {
  const alpha = p.R1 / (2 * p.L1)
  const w0 = 1 / Math.sqrt(p.L1 * p.C1)
  const zeta = alpha / w0
  return { alpha, w0, zeta, wd: zeta < 1 ? Math.sqrt(w0 * w0 - alpha * alpha) : 0 }
}

export const MARKS = {
  // The time constant's three readings off one curve: where v_C is heading,
  // how far it has got at τ, and the tangent at the start that reaches E at τ.
  f3(p) {
    const tau = p.R1 * p.C1
    const vTau = p.v0 + (p.E - p.v0) * ONE_TAU
    return [
      { kind: 'level', axis: 'left', y: p.E, label: 'heading for E', value: p.E, unit: 'V' },
      { kind: 'point', axis: 'left', x: tau, y: vTau, label: '63.2 % of the way at τ', value: vTau, unit: 'V' },
      { kind: 'segment', axis: 'left', x0: 0, y0: p.v0, x1: tau, y1: p.E, label: 'the starting slope reaches E at τ', value: tau, unit: 's' },
    ]
  },

  // The Thévenin voltage is where v_B settles; v_A starts wherever the
  // resistors alone put it, before the capacitor has any say.
  f4(p) {
    const vth = (p.E * p.R2) / (p.R1 + p.R2)
    const vA0 = p.E / p.R1 / (1 / p.R1 + 1 / p.R2 + 1 / p.R3)
    return [
      { kind: 'level', axis: 'left', y: vth, label: 'V_th: where v_B settles', value: vth, unit: 'V' },
      { kind: 'point', axis: 'left', x: 0, y: vA0, label: 'v_A starts at', value: vA0, unit: 'V' },
    ]
  },

  // The spark: the switch takes the whole inductor current at the first instant.
  f6(p) {
    if (p.ideal) return []
    const I0 = p.E / p.R1
    const Iinf = p.E / (p.R1 + p.Roff)
    return [
      { kind: 'point', axis: 'right', x: 0, y: I0 * p.Roff, label: 'the spark: v_switch(0⁺) = I₀·R_off', value: I0 * p.Roff, unit: 'V' },
      { kind: 'level', axis: 'left', y: Iinf, label: 'the trickle E/(R + R_off)', value: Iinf, unit: 'A' },
    ]
  },

  // Ringing: the first peak, as a percentage of the step above E.
  g4(p) {
    const q = rlc(p)
    if (!(q.zeta < 1)) return [{ kind: 'level', axis: 'left', y: p.E, label: 'heading for E', value: p.E, unit: 'V' }]
    const over = Math.exp((-Math.PI * q.zeta) / Math.sqrt(1 - q.zeta * q.zeta))
    const tp = Math.PI / q.wd
    return [
      { kind: 'level', axis: 'left', y: p.E, label: 'heading for E', value: p.E, unit: 'V' },
      { kind: 'point', axis: 'left', x: tp, y: p.E * (1 + over), label: `first peak: ${(100 * over).toFixed(1)} % over E`, value: p.E * (1 + over), unit: 'V' },
    ]
  },

  // The unloaded divider: what v_A would be with nothing across it.
  c3(p) {
    const v = (p.E * p.R2) / (p.R1 + p.R2)
    return [{ kind: 'level', axis: 'left', y: v, label: 'unloaded: E·R₂/(R₁ + R₂)', value: v, unit: 'V' }]
  },

  // Maximum power at the match, and only half the source's power gets there.
  d6(p) {
    const pmax = (p.E * p.E) / (4 * p.Rs)
    return [
      { kind: 'point', axis: 'left', x: p.Rs, y: pmax, label: 'the most the load can get, at R_L = R_s', value: pmax, unit: 'W' },
      { kind: 'point', axis: 'right', x: p.Rs, y: 0.5, label: 'efficiency at the match', value: 50, unit: '%' },
    ]
  },

  // Resonance: |Z| falls to R at f₀ while the capacitor's voltage climbs to Q
  // times the source's — the curve of |V_C|/|V_s|, drawn over the impedance.
  h4(p, x) {
    const w0 = 1 / Math.sqrt(p.L1 * p.C1)
    const f0 = w0 / (2 * Math.PI)
    const Q = Math.sqrt(p.L1 / p.C1) / p.R1
    const out = [
      { kind: 'point', axis: 'left', x: f0, y: p.R1, label: 'at f₀ the reactances cancel: |Z| = R', value: p.R1, unit: 'Ω' },
    ]
    if (x.freq) {
      const mags = x.freq.H.map((h) => cx.cabs(h))
      const top = Math.max(...mags)
      out.push({
        kind: 'curve',
        xs: x.freq.f,
        ys: Float64Array.from(mags, (m) => (0.9 * m) / top),
        label: '|V_C|/|V_s|, drawn to fit, peaking at Q at f₀',
        value: Q,
        unit: '×',
      })
    }
    return out
  },

  // The corner: −3 dB at f_c, then 20 dB lost per decade along the asymptote.
  h6(p, x) {
    const fc = 1 / (2 * Math.PI * p.R1 * p.C1)
    const db3 = 20 * Math.log10(Math.SQRT1_2)
    const fEnd = x.freq ? x.freq.f[x.freq.f.length - 1] : 100 * fc
    return [
      { kind: 'level', axis: 'left', y: db3, label: '−3 dB: half the power', value: db3, unit: 'dB' },
      { kind: 'point', axis: 'left', x: fc, y: db3, label: 'the corner f_c = 1/(2πRC)', value: fc, unit: 'Hz' },
      { kind: 'segment', axis: 'left', x0: fc, y0: 0, x1: fEnd, y1: -20 * Math.log10(fEnd / fc), label: '−20 dB per decade', value: -20, unit: 'dB/decade' },
    ]
  },
  // The regulated level, and the load below which there is nothing left for
  // the Zener to carry.
  i8(p) {
    const knee = (p.Vz * p.RS) / (p.E - p.Vz)
    return [
      { kind: 'level', axis: 'left', y: p.Vz, label: 'held at V_z', value: p.Vz, unit: 'V' },
      { kind: 'point', axis: 'left', x: knee, y: p.Vz, label: 'below this load it gives up', value: knee, unit: 'Ω' },
    ]
  },
}

/** Which plot each experiment's marks belong on. */
export const PLOT_OF = { f3: 'scope', f4: 'scope', f6: 'scope', g4: 'scope', c3: 'sweep', d6: 'sweep', i8: 'sweep', h4: 'freq', h6: 'freq' }

/** The marks for one experiment at these knobs, for the plot named (or any plot), or none. */
export function marksFor(exp, p, x, plot = null) {
  const f = MARKS[exp.id]
  if (!f || (plot && PLOT_OF[exp.id] !== plot)) return []
  return f(p, x)
}

/** The scope's instants from the math entry, in the same shape as the data marks. */
export function timeMarks(list) {
  return (list || []).map((m) => ({ kind: 'time', x: m.t, label: m.label, value: m.t, unit: 's' }))

}
