// The props each view takes, computed from the analysis.
//
// The canvases draw what they are given. Nothing below computes physics: every
// number here came out of `analyse`, which is the only thing in the app that
// calls the engine. Keeping the two apart is what lets `experiments.test.js`
// check a picture's numbers without rendering anything.

import { chartFamilies, circlePoints } from '@ee-labs/rf'
import { num, plain } from './format.js'

/** The families the chart draws, in the mode the experiment asks for. */
const familiesFor = (mode) => chartFamilies({ mode }).map((c) => ({ cx: c.cx, cy: c.cy, radius: c.radius, family: c.family, value: c.value }))

/**
 * What `SmithCanvas` is handed for one experiment.
 *
 * `mode` is 'both' only where a lesson needs the two families at once, because
 * an overlaid chart on a phone is twice the ink for a reader who is meeting the
 * picture for the first time.
 */
export function chartPropsFor(exp, p, x) {
  const mode = exp.chartMode || (x.shunt ? 'both' : 'impedance')
  const props = { mode, z0: x.z0 ?? p.z0line ?? 50, grid: familiesFor(mode), points: [], paths: [], circles: [] }

  if (x.kind === 'mismatch') {
    props.points.push({ gamma: x.place.gamma, label: labelOf(x.ZL), kind: 'load' })
    if (x.shunt) {
      props.points.push({ gamma: x.shunt.gamma, label: `b = ${plain(p.b, 3)}`, kind: 'match' })
      props.circles.push({ ...x.gCircle, label: `g = ${plain(x.y[0], 3)}`, kind: 'conductance' })
      props.paths.push({ points: shuntPath(x, p), label: 'shunt susceptance', kind: 'match' })
    }
    if (x.landmarks) {
      for (const l of x.landmarks) props.points.push({ gamma: l.gamma, label: l.name, kind: 'plain' })
    }
  }

  if (x.kind === 'chart') {
    props.points.push({ gamma: x.gamma, label: `z = ${plain(p.r, 3)} + j${plain(p.x, 3)}`, kind: 'load' })
    props.circles.push({ ...x.circles.r, label: `r = ${plain(p.r, 3)}`, kind: 'family' })
    props.circles.push({ ...x.circles.x, label: `x = ${plain(p.x, 3)}`, kind: 'family' })
  }

  if (x.kind === 'line') {
    props.points.push({ gamma: x.place.gamma, label: 'load', kind: 'load' })
    props.points.push({ gamma: x.placeIn.gamma, label: 'input', kind: 'source' })
    props.paths.push({ points: x.locus, label: 'towards the generator', kind: 'line' })
    props.circles.push({ ...x.vswrCircle, label: `VSWR ${plain(x.load.vswr, 4)}`, kind: 'vswr' })
    props.caption = `${num(p.len, 'm')} of line, ${plain(x.el.degrees, 5)}° at ${num(p.f, 'Hz')}`
  }

  return props
}

/** The arc a shunt susceptance sweeps out, from nothing added to what is set. */
function shuntPath(x, p) {
  const out = []
  const steps = 48
  for (let k = 0; k <= steps; k++) {
    const b = (p.b * k) / steps
    const y = [x.y[0], x.y[1] + b]
    const d = (y[0] + 1) * (y[0] + 1) + y[1] * y[1]
    // Gamma on the IMPEDANCE chart, which is minus the admittance chart's.
    out.push([-((y[0] * y[0] - 1 + y[1] * y[1]) / d), -((2 * y[1]) / d)])
  }
  return out
}

/** A human name for a load, for the marker beside it. */
function labelOf(ZL) {
  if (ZL === Infinity) return 'open'
  const [re, im] = Array.isArray(ZL) ? ZL : [ZL, 0]
  if (re === 0 && im === 0) return 'short'
  if (im === 0) return num(re, 'Ω')
  return `${num(re, '')} ${im < 0 ? '−' : '+'} j${num(Math.abs(im), '')} Ω`
}

// ------------------------------------------------------------------ the line

/**
 * The line drawn against the wavelength at the frequency in use.
 *
 * The physical length is fixed and the wavelength moves, so a quarter-wave
 * section looks like one and stops looking like one when the frequency moves.
 * That is the whole reason this view exists rather than a schematic box.
 */
export function linePropsFor(exp, p, x) {
  const wave = x.wave
  const top = Math.max(...wave.samples.map((s) => s.v), 1e-12)
  return {
    length: p.len,
    lambda: x.el.lambda,
    degrees: x.el.degrees,
    ticks: markers(p.len, x.el.lambda),
    // The standing wave, normalised to its own largest value so the shape is
    // legible whatever the drive. The ratio is printed, not inferred by eye.
    samples: wave.samples.map((s) => ({ d: s.d, v: s.v / top, g: s.g })),
    swr: x.load.vswr,
    dMin: wave.dMin,
    dMax: wave.dMax,
    quarter: wave.quarter,
    load: labelOf(x.ZL),
    zin: x.zin.Z,
  }
}

/** Quarter-wavelength marks along the line, as fractions of its length. */
function markers(length, lambda) {
  const out = []
  const step = lambda / 4
  // A long line at a short wavelength would draw thousands of marks, which is
  // a grey band rather than a scale. Past forty the step grows to keep them
  // countable, and the label says which step is drawn.
  const every = Math.max(1, Math.ceil(length / step / 40))
  for (let k = 0; k * step * every <= length + 1e-12; k++) {
    const d = k * step * every
    out.push({ d, at: d / length, wavelengths: (d / lambda).toFixed(2), major: (k * every) % 4 === 0 })
  }
  return { marks: out, every, step: step * every }
}

// ----------------------------------------------------------------- the sweep

/** The sweep plot's series, its axes and the message that sits under it. */
export function sweepPropsFor(exp, p, x) {
  return {
    from: x.sweepRange.from,
    to: x.sweepRange.to,
    points: x.sweep.map((q) => ({ f: q.f, mag: q.mag, vswr: q.vswr, re: q.Z === Infinity ? NaN : q.Z[0], im: q.Z === Infinity ? NaN : q.Z[1] })),
    repeat: x.repeat,
    marker: p.f,
    says: x.handOver && !x.handOver.ok ? x.handOver.says : null,
  }
}

/** Every closed form this experiment used, with the formula it came from. */
export function numberRowsFor(exp, p, x) {
  if (x.declined) return []
  if (x.kind === 'mismatch') return mismatchRows(x)
  if (x.kind === 'chart') return chartRows(x, p)
  return lineRows(x, p)
}

const row = (label, value, formula) => ({ label, value, formula })

function mismatchRows(x) {
  const m = x.m
  const rows = [
    row('Load', labelOf(x.ZL), 'the knobs'),
    row('Reference impedance', num(x.z0, 'Ω'), 'Z_0'),
    row('Normalised impedance', `${plain(x.place.z[0])} + j${plain(x.place.z[1])}`, 'z = Z_L / Z_0'),
    row('Reflection coefficient', `${plain(m.gamma[0])} + j${plain(m.gamma[1])}`, '(Z_L − Z_0)/(Z_L + Z_0)'),
    row('Magnitude and angle', `${plain(m.mag)} ∠ ${m.deg.toFixed(2)}°`, '|Γ| ∠ arg Γ'),
    row('Standing-wave ratio', plain(m.vswr), '(1 + |Γ|)/(1 − |Γ|)'),
    row('Return loss', `${plain(m.returnLossDb)} dB`, '−20 log |Γ|'),
    row('Mismatch loss', `${plain(m.mismatchLossDb)} dB`, '−10 log (1 − |Γ|²)'),
    row('Power accepted', `${plain(100 * m.powerAccepted)} %`, '1 − |Γ|²'),
  ]
  if (x.y !== Infinity) rows.push(row('Normalised admittance', `${plain(x.y[0])} + j${plain(x.y[1])}`, 'y = 1/z'))
  if (x.shunt) {
    rows.push(row('After the shunt', `${plain(x.shunt.gamma[0])} + j${plain(x.shunt.gamma[1])}`, 'y + jb, then Γ = −Γ_y'))
    rows.push(row('Off its own circle by', x.offCircle.toExponential(2), 'relative to the radius'))
  }
  return rows
}

function chartRows(x, p) {
  return [
    row('Normalised impedance', `${plain(p.r)} + j${plain(p.x)}`, 'the knobs'),
    row('Reflection coefficient', `${plain(x.gamma[0])} + j${plain(x.gamma[1])}`, '(z − 1)/(z + 1)'),
    row('Constant-resistance circle', `centre ${plain(x.circles.r.cx)}, radius ${plain(x.circles.r.radius)}`, 'r/(1 + r), 1/(1 + r)'),
    row('Constant-reactance arc', `centre (${plain(x.circles.x.cx)}, ${plain(x.circles.x.cy)}), radius ${plain(x.circles.x.radius)}`, '(1, 1/x), |1/x|'),
    row('Constant-conductance circle', `centre ${plain(x.circles.g.cx)}, radius ${plain(x.circles.g.radius)}`, 'the same circle, turned half a turn'),
    row('The point is off the r circle by', x.onCircle.r.toExponential(2), 'relative to the radius'),
    row('The point is off the x arc by', x.onCircle.x.toExponential(2), 'relative to the radius'),
  ]
}

function lineRows(x, p) {
  const rows = [
    row('Frequency', num(p.f, 'Hz'), 'the knob'),
    row('Phase velocity', num(x.el.vp, 'm/s'), 'c / √ε_r'),
    row('Wavelength', num(x.el.lambda, 'm'), 'v_p / f'),
    row('Length', num(p.len, 'm'), 'the knob'),
    row('Electrical length', `${plain(x.el.degrees, 6)}°`, 'β l'),
    row('One-way delay', num(x.delay, 's'), 'l / v_p'),
    row('Load', labelOf(x.ZL), 'the knobs'),
    row('Reflection at the load', `${plain(x.load.mag)} ∠ ${x.load.deg.toFixed(2)}°`, '(Z_L − Z_0)/(Z_L + Z_0)'),
    row('Impedance looking in', `${plain(x.zin.Z[0])} + j${plain(x.zin.Z[1])} Ω`, 'Z_0 (Z_L + Z_0 tanh γl)/(Z_0 + Z_L tanh γl)'),
    row('Reflection at the source', `${plain(x.source.mag)} ∠ ${x.source.deg.toFixed(2)}°`, 'the same formula, at the input'),
    row('Standing-wave ratio', plain(x.load.vswr), '(1 + |Γ|)/(1 − |Γ|)'),
    row('Turn on the chart', `${plain(x.turn.deg, 6)}°`, '2 β l'),
    row('Response repeats every', num(x.repeat, 'Hz'), 'v_p / 2l'),
  ]
  if (p.alpha > 0) {
    rows.push(row('Attenuation', `${plain(x.loss.alphaDb)} dB/m`, 'α × 8.686'))
    rows.push(row('One-way loss', `${plain(x.loss.oneWay)} dB`, 'α l × 8.686'))
    rows.push(row('Round-trip loss', `${plain(x.loss.roundTrip)} dB`, '2 α l × 8.686'))
  }
  return rows
}

export { circlePoints, labelOf }
