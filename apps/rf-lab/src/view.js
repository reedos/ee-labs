// The props each view takes, computed from the analysis.
//
// The canvases draw what they are given. Nothing below computes physics: every
// number here came out of `analyse`, which is the only thing in the app that
// calls the engine. Keeping the two apart is what lets `experiments.test.js`
// check a picture's numbers without rendering anything.

import * as R from '@ee-labs/rf'
import { isNoise, num, pct, plain, polar, rectangular } from './format.js'

/** The families the chart draws, in the mode the experiment asks for. */
const familiesFor = (mode) => R.chartFamilies({ mode }).map((c) => ({ cx: c.cx, cy: c.cy, radius: c.radius, family: c.family, value: c.value }))

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

  if (x.kind === 'wave') {
    props.points.push({ gamma: x.m.gamma, label: labelOf(x.ZL), kind: 'load' })
    props.points.push({ gamma: x.solved, label: 'solved', kind: 'match' })
  }

  if (x.kind === 'twoport') {
    props.points.push({ gamma: x.sp.s[0][0], label: 'S11', kind: 'load' })
    props.points.push({ gamma: x.sp.s[1][1], label: 'S22', kind: 'source' })
    props.paths.push({ points: x.trace.map((q) => [q['11'].re, q['11'].im]), label: 'S11 against frequency', kind: 'line' })
    props.caption = `${x.built.name}, ${num(x.sweepRange.from, 'Hz')} to ${num(x.sweepRange.to, 'Hz')}`
  }

  if (x.kind === 'match') {
    props.points.push({ gamma: x.m.gamma, label: 'match', kind: 'match' })
    props.points.push({ gamma: R.reflection(x.ZL, x.z0), label: labelOf(x.ZL), kind: 'load' })
    for (const arc of x.arcs) props.paths.push({ points: arc.points, label: arc.label, kind: 'match' })
    props.caption = `${x.chosen.elements.length} element${x.chosen.elements.length === 1 ? '' : 's'} from the load to the source, one arc each`
  }

  if (x.kind === 'qwave') {
    props.points.push({ gamma: R.reflection(x.ZL, x.z0), label: labelOf(x.ZL), kind: 'load' })
    props.points.push({ gamma: x.m.gamma, label: 'match', kind: 'match' })
    props.paths.push({ points: x.path, label: 'along the section', kind: 'line' })
    props.caption = `${num(x.qw.len, 'm')} of ${plain(x.qw.Z0, 5)} Ω line, ${plain(x.el.degrees, 5)}° at ${num(p.f, 'Hz')}`
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
    // A length of line repeats and a lumped network does not, so this is a
    // spacing or it is null. The legend says which, rather than drawing repeat
    // lines where there is nothing to repeat.
    repeat: x.repeat ?? null,
    repeats: x.repeats || null,
    // Where the response crosses the standing-wave ratio the experiment reads
    // its bandwidth to, measured on the exact response rather than read off a
    // swept point.
    // `from` and `to` are where the crossing was looked for, which is what the
    // legend names when there is no edge on one side. Saying the response never
    // crosses would claim more than the search measured.
    band: x.bw
      ? { target: p.target ?? x.bw.vswr, lower: x.bw.lower, upper: x.bw.upper, fractional: x.bw.fractional, bounded: x.bw.bounded, from: x.bw.from, to: x.bw.to }
      : null,
    marker: p.f,
    says: x.handOver && !x.handOver.ok ? x.handOver.says : null,
  }
}

/** Every closed form this experiment used, with the formula it came from. */
export function numberRowsFor(exp, p, x) {
  if (x.declined) return []
  if (x.kind === 'mismatch') return mismatchRows(x)
  if (x.kind === 'chart') return chartRows(x, p)
  if (x.kind === 'wave') return waveRows(x, p)
  if (x.kind === 'twoport') return twoPortRows(x, p)
  if (x.kind === 'match') return matchRows(x, p)
  if (x.kind === 'qwave') return qwaveRows(x, p)
  return lineRows(x, p)
}

const row = (label, value, formula) => ({ label, value, formula })

/**
 * A measured band, or the side that has no edge.
 *
 * A response can hold a ratio on one side of the design frequency and never
 * reach it on the other, and which side that is follows the topology. The
 * low-pass L network hands the load straight through below its design
 * frequency, so at a standing-wave ratio of two it has no lower edge. The
 * high-pass one does the same above it and has no upper edge. A label that
 * named the same missing side in both cases would be wrong in one of them.
 */
export function bandText(bw) {
  if (!bw) return '—'
  if (bw.bounded) return pct(bw.fractional)
  if (bw.lower === null && bw.upper === null) return 'never crosses that ratio'
  return bw.lower === null ? 'no lower edge' : 'no upper edge'
}

/** Two bands compared, when both of them have a width to compare. */
const bandRatio = (a, b) => (a.bounded && b.bounded ? plain(a.fractional / b.fractional) : 'one of the two has no band')

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

export const circlePoints = R.circlePoints
export { labelOf }

// ------------------------------------------------------ the S-parameter view

/**
 * The four entries of one S-matrix, with the ones that are the solve's own
 * noise reported as zero rather than as a measurement.
 *
 * A matched pad's S11 comes back as 3.3e-16, which is −309.5 dB. Printed as a
 * number that reads as a reflection 310 decibels down, and the note beside it
 * says S11 is zero. The scale is the largest entry of the same matrix, so a
 * two-port written in any units is treated the same way, and an entry below a
 * billionth of it has no decibels to print.
 */
/** What an entry with no decibels says, which is not the same for the two kinds. */
const nothingAt = (key) => (key === '11' || key === '22' ? 'nothing comes back' : 'nothing gets through')

function entriesOf(s, keys) {
  const scale = Math.max(...keys.map((k) => s[k].mag))
  const out = {}
  for (const k of keys) {
    const zero = isNoise(s[k].mag, scale)
    out[k] = { mag: zero ? 0 : s[k].mag, db: zero ? -Infinity : s[k].db, deg: s[k].deg, zero }
  }
  return out
}


/**
 * The four entries against frequency, in decibels, with their angles below and
 * a marker that reads all four at one frequency.
 *
 * `plane` is the calibration-plane offset in degrees, and it is in these props
 * from the first commit for the same reason `rotate` is in the chart's. The
 * Instruments Lab's network analyser group is this view's second user, and
 * moving a reference plane moves the measurement rather than the picture. It
 * turns the angle of every entry and leaves every magnitude alone, by twice the
 * offset on a reflection and once on a transmission, because a reflected wave
 * crosses the moved length twice.
 */
export function sparamPropsFor(exp, p, x, plane = 0) {
  const keys = ['11', '21', '12', '22']
  const turns = { 11: 2, 22: 2, 21: 1, 12: 1 }
  const shift = (deg, key) => wrap(deg - turns[key] * plane)
  const read = entriesOf(x.s, keys)
  // The floor the decibel axis is drawn to. A trace that goes to nothing at
  // all would take the axis with it, so the range is the deepest trace on
  // screen or 60 dB, whichever is shallower.
  const floor = Math.max(-60, Math.min(-6, ...x.trace.flatMap((q) => keys.map((k) => (Number.isFinite(q[k].db) ? q[k].db : 0)))))
  const ceiling = Math.max(0, ...x.trace.flatMap((q) => keys.map((k) => (Number.isFinite(q[k].db) ? q[k].db : 0))))
  return {
    ceiling,
    from: x.sweepRange.from,
    to: x.sweepRange.to,
    marker: p.f,
    plane,
    keys,
    floor,
    // An entry that goes below the floor is drawn along it, and a flat line at
    // the bottom of a plot reads as a measurement. `REVIEW_PLAYBOOK.md` §10 is
    // the class of defect: where the cap truncates, the readout says so. Five
    // pads of 30 dB reach −150 dB, and an entry that is exactly zero has no
    // decibels at all.
    clipped: keys.filter((k) => x.trace.some((q) => !Number.isFinite(q[k].db) || q[k].db < floor)).map((k) => `S${k}`),
    traces: keys.map((key) => ({
      key,
      label: `S${key}`,
      points: x.trace.map((q) => ({ f: q.f, db: q[key].db, deg: shift(q[key].deg, key), mag: q[key].mag })),
    })),
    at: keys.map((key) => ({ key, label: `S${key}`, mag: read[key].mag, db: read[key].db, deg: shift(x.s[key].deg, key), nothing: nothingAt(key) })),
    name: x.built.name,
  }
}

/** An angle folded back into the half-open interval from −180 to 180 degrees. */
const wrap = (d) => {
  let a = d
  while (a > 180) a -= 360
  while (a <= -180) a += 360
  return a
}

// -------------------------------------------------------- the equations pane

/**
 * The closed forms an experiment used, with its own numbers put into them.
 *
 * The Elements lab prints its MNA rows this way: the symbol, the arithmetic,
 * and the answer, so a reader can check the step rather than trust it. A block
 * that names a description the two-port does not have carries the refusal
 * instead of a row, because that sentence is the content there.
 */
export function equationBlocksFor(exp, p, x) {
  if (x.declined) return [{ title: 'Declined', rows: [], declined: true, says: x.declined.says }]
  if (x.kind === 'match') return matchEquations(x, p)
  if (x.kind === 'qwave') return qwaveEquations(x, p)
  if (x.kind === 'wave') return waveEquations(x, p)
  if (x.kind === 'twoport') return twoPortEquations(x, p)
  return chartEquations(x, p)
}

const eq = (lhs, rhs, value) => ({ lhs, rhs, value })

function matchEquations(x, p) {
  const d = x.design
  const low = Math.min(d.RS, d.R)
  const high = Math.max(d.RS, d.R)
  const blocks = []
  if (d.cancel) {
    blocks.push({
      title: 'The load reactance, cancelled',
      rows: [eq('X_cancel', `−(${plain(d.X, 5)} Ω)`, `${plain(-d.X, 5)} Ω`)],
      says: 'A series element of the opposite reactance leaves the load resistance where it is.',
    })
  }
  blocks.push({
    title: 'The transformation',
    rows: [
      eq('R_low, R_high', `${plain(low, 5)} Ω, ${plain(high, 5)} Ω`, `ratio ${plain(high / low, 5)}`),
      eq('Q', `√(${plain(high, 5)}/${plain(low, 5)} − 1)`, plain(d.Q, 5)),
      eq('X_series', `Q R_low = ${plain(d.Q, 5)} × ${plain(low, 5)} Ω`, `${plain(d.Xs, 5)} Ω`),
      eq('X_shunt', `R_high / Q = ${plain(high, 5)} / ${plain(d.Q, 5)}`, `${plain(d.Xp, 5)} Ω`),
    ],
    says: 'The series element sits in the low-resistance branch and the shunt across the high one, and the two carry opposite signs.',
  })
  const rows = x.chosen.elements.map((el) =>
    eq(
      `${el.place} ${el.kind === 'L' ? 'inductor' : 'capacitor'}`,
      el.kind === 'L' ? `X / ω = ${plain(el.X, 5)} Ω / ${plain(2 * Math.PI * p.f, 5)} rad/s` : `1 / (ω |X|) = 1 / (${plain(2 * Math.PI * p.f, 5)} × ${plain(Math.abs(el.X), 5)})`,
      num(el.value, el.kind === 'L' ? 'H' : 'F'),
    ),
  )
  blocks.push({ title: 'The components at this frequency', rows, says: 'A reactance is a component only once a frequency is named.' })
  blocks.push({
    title: 'What the network reads',
    rows: [
      eq('Z_in', '(A Z_L + B)/(C Z_L + D)', rectangular(x.at.Z)),
      eq('Γ', '(Z_in − R_S)/(Z_in + R_S)', plain(x.at.mag, 5)),
      eq('Fractional bandwidth', `to a standing-wave ratio of ${plain(p.target ?? 1.5, 5)}`, bandText(x.bw)),
    ],
    says: '',
  })
  return blocks
}

function qwaveEquations(x, p) {
  return [
    {
      title: 'The section',
      rows: [
        eq('Z_0', `√(${plain(p.RS, 5)} × ${plain(p.RL, 5)})`, `${plain(x.qw.Z0, 5)} Ω`),
        eq('v_p', `c / √${plain(p.epsr, 4)}`, num(x.qw.vp, 'm/s')),
        eq('l', `v_p / 4f = ${num(x.qw.vp, 'm/s')} / ${num(4 * p.f, 'Hz')}`, num(x.qw.len, 'm')),
        eq('βl', 'at the design frequency', `${plain(x.el.degrees, 5)}°`),
      ],
      says: 'The impedance is the geometric mean of the two resistances the section joins.',
    },
    {
      title: 'What it reads',
      rows: [
        eq('Z_in', 'Z_0 (Z_L + j Z_0 tan βl)/(Z_0 + j Z_L tan βl)', rectangular(x.at.Z)),
        eq('Γ', '(Z_in − R_S)/(Z_in + R_S)', plain(x.at.mag, 5)),
        eq('Repeats every', 'v_p / 2l', num(x.repeat, 'Hz')),
      ],
      says: '',
    },
    {
      title: 'Against the lumped network',
      rows: [
        eq('Section bandwidth', `to a standing-wave ratio of ${plain(p.target, 5)}`, bandText(x.bw)),
        eq('L network bandwidth', 'the same transformation, two reactances', bandText(x.lumpedBw)),
        eq('Ratio', 'the section over the L network', bandRatio(x.bw, x.lumpedBw)),
      ],
      says: '',
    },
  ]
}

function waveEquations(x, p) {
  const root = Math.sqrt(p.z0)
  return [
    {
      title: 'The two waves',
      rows: [
        eq('a', `(V + Z_0 I) / (2 √Z_0), with 1 V driven through ${plain(p.z0, 4)} Ω`, plain(x.waves.a, 5)),
        eq('b', '(V − Z_0 I) / (2 √Z_0)', plain(x.waves.b, 5)),
        eq('√Z_0', `√${plain(p.z0, 4)}`, plain(root, 5)),
      ],
      says: 'Each wave is a voltage divided by the square root of an impedance, so its square is a power.',
    },
    {
      title: 'S11, two ways',
      rows: [
        eq('Γ, closed form', '(Z_L − Z_0)/(Z_L + Z_0)', polar(x.m.gamma)),
        eq('S11, solved', 'drive through Z_0, then S11 = 2V − 1', polar(x.solved)),
        eq('Apart by', 'relative to the magnitude', x.agree.toExponential(2)),
      ],
      says: 'A one-port has one entry, and it is the reflection coefficient A1 defines.',
    },
  ]
}

function twoPortEquations(x, p) {
  const keys = ['11', '12', '21', '22']
  const read = entriesOf(x.s, keys)
  const blocks = [
    {
      title: `The S-matrix of ${x.built.name}`,
      rows: keys.map((k) => eq(`S${k}`, `${plain(x.s[k].re, 5)} + j${plain(x.s[k].im, 5)}`, `${plain(read[k].mag, 5)} ∠ ${read[k].deg.toFixed(2)}°`)),
      says: `Every entry is measured with the other port terminated in ${plain(p.z0, 4)} Ω.`,
    },
  ]
  for (const r of x.routes) {
    blocks.push({
      title: 'The same matrix, by another route',
      rows: [eq(r.label, 'the largest entry of the difference, relative to the scale', r.diff.toExponential(2))],
      says: '',
    })
  }
  const conv = x.conv
  blocks.push({
    title: 'The descriptions this two-port has',
    rows: [
      eq('Exists', conv.names.join(', '), `${conv.count} of 4`),
      ...(conv.z.ok ? [eq('Z', 'Z_0 (I + S)(I − S)⁻¹', `${rectangular(conv.z.M[0][0])} at port 1`)] : []),
      ...(conv.abcd.ok ? [eq('ABCD', 'the chain matrix', `A = ${plain(conv.abcd.M[0][0][0], 5)} + j${plain(conv.abcd.M[0][0][1], 5)}`)] : []),
      ...(conv.roundTrip.ok ? [eq('S to Z to ABCD to Y to S', 'relative to the matrix scale', conv.roundTrip.error.toExponential(2))] : []),
    ],
    // A description this two-port does not have is a refusal with a reason,
    // and the pane marks it as one rather than as a footnote.
    declined: conv.missing.length > 0,
    says: conv.missing.length ? conv.missing.map((m) => m.says).join(' ') : conv.roundTrip.says,
  })
  blocks.push({
    title: 'What the matrix says about the power',
    rows: [
      eq('|S11|² + |S21|²', 'the fraction that comes back or gets through', plain(x.power.sum, 12)),
      eq('Dissipated', '1 − |S11|² − |S21|²', plain(x.power.dissipated, 5)),
      eq('|S12 − S21|', 'reciprocity, relative to the scale', x.power.reciprocity.toExponential(2)),
      eq('S†S − I', 'the largest entry, which is zero for a lossless two-port', x.power.unitarity.toExponential(2)),
    ],
    says: '',
  })
  return blocks
}

function chartEquations(x, p) {
  return [
    {
      title: 'The map',
      rows: [
        eq('z', 'Z_L / Z_0', `${plain(p.r ?? 0, 5)} + j${plain(p.x ?? 0, 5)}`),
        eq('Γ', '(z − 1)/(z + 1)', `${plain((x.gamma || [0, 0])[0], 5)} + j${plain((x.gamma || [0, 0])[1], 5)}`),
      ],
      says: '',
    },
  ]
}

// ---------------------------------------------------- the numbers, groups C and D

function waveRows(x, p) {
  return [
    row('Load', labelOf(x.ZL), 'the knobs'),
    row('Reference impedance', num(p.z0, 'Ω'), 'Z_0'),
    row('Incident wave a', plain(x.waves.a), '(V + Z_0 I) / (2 √Z_0)'),
    row('Reflected wave b', plain(x.waves.b), '(V − Z_0 I) / (2 √Z_0)'),
    row('Γ from the closed form', polar(x.m.gamma), '(Z_L − Z_0)/(Z_L + Z_0)'),
    row('S11 from a solve', polar(x.solved), 'drive through Z_0, then 2V − 1'),
    row('The two apart by', x.agree.toExponential(2), 'relative to the magnitude'),
    row('Standing-wave ratio', plain(x.m.vswr), '(1 + |Γ|)/(1 − |Γ|)'),
    row('Return loss', `${plain(x.m.returnLossDb)} dB`, '−20 log |Γ|'),
  ]
}

function twoPortRows(x, p) {
  const keys = ['11', '12', '21', '22']
  const read = entriesOf(x.s, keys)
  const rows = [
    row('Two-port', x.built.name, 'the knobs'),
    row('Reference impedance', num(p.z0, 'Ω'), 'Z_0, and every entry depends on it'),
    ...keys.map((k) => row(`S${k}`, `${plain(read[k].mag)} ∠ ${read[k].deg.toFixed(2)}°`, Number.isFinite(read[k].db) ? `${plain(read[k].db)} dB` : nothingAt(k))),
    row('|S11|² + |S21|²', plain(x.power.sum, 12), 'what comes back plus what gets through'),
    // A lossless network dissipates nothing, and the solve returns that as a
    // number a few times 1e-16. Against a scale of one that is the
    // arithmetic's noise, so it prints as zero rather than as femto-something.
    row('Dissipated', plain(isNoise(x.power.dissipated, 1) ? 0 : x.power.dissipated), '1 − |S11|² − |S21|²'),
    row('Reciprocity', x.power.reciprocity.toExponential(2), '|S12 − S21|, relative to the scale'),
    row('Unitarity', x.power.unitarity.toExponential(2), 'the largest entry of S†S − I'),
    row('Largest singular value', plain(x.power.largest), 'at most one for a passive two-port'),
    row('Descriptions this object has', `${x.conv.names.join(', ')} (${x.conv.count} of 4)`, 'S, Z, Y and ABCD'),
  ]
  for (const r of x.routes) rows.push(row('Against another route', r.diff.toExponential(2), r.label))
  if (x.conv.roundTrip.ok) rows.push(row('Round trip S to Z to ABCD to Y to S', x.conv.roundTrip.error.toExponential(2), 'relative to the matrix scale'))
  return rows
}

function matchRows(x, p) {
  const d = x.design
  const rows = [
    row('Source resistance', num(p.RS, 'Ω'), 'the knob'),
    row('Load', labelOf(x.ZL), 'the knobs'),
    row('Transformation ratio', plain(Math.max(d.RS, d.R) / Math.min(d.RS, d.R)), 'the higher resistance over the lower'),
    row('Loaded Q', plain(d.Q), '√(R_high/R_low − 1)'),
    row('Series reactance', `${plain(d.Xs)} Ω`, 'Q R_low'),
    row('Shunt reactance', `${plain(d.Xp)} Ω`, 'R_high / Q'),
  ]
  if (d.cancel) {
    rows.push(row('Load reactance cancelled by', `${plain(d.cancel.X)} Ω in series`, 'the opposite of the load’s own'))
    // C5's note says the numbers pane names which of the two is on the bench,
    // so the pane names it. The load is an impedance in this analysis and its
    // reactance is the same at every frequency, while the elements beside it
    // are components whose reactances move. That difference is what the sweep
    // above draws, so it belongs in the list the sweep is read against.
    rows.push(row('The load holds this reactance', `${plain(d.X)} Ω at every frequency`, 'an impedance, not a component whose reactance moves'))
  }
  for (const el of x.chosen.elements) {
    rows.push(row(`${el.place === 'series' ? 'Series' : 'Shunt'} ${el.kind === 'L' ? 'inductor' : 'capacitor'}`, num(el.value, el.kind === 'L' ? 'H' : 'F'), `${plain(el.X)} Ω at ${num(p.f, 'Hz')}`))
  }
  rows.push(row('Impedance looking in', rectangular(x.at.Z), '(A Z_L + B)/(C Z_L + D)'))
  rows.push(row('Reflection at the source', plain(x.at.mag), '(Z_in − R_S)/(Z_in + R_S)'))
  rows.push(row('Standing-wave ratio', plain(x.at.vswr), '(1 + |Γ|)/(1 − |Γ|)'))
  rows.push(row('Arrangements that match', String(x.count), 'of the four the enumeration holds'))
  rows.push(row(`Fractional bandwidth to ${plain(p.target ?? 1.5, 5)}`, bandText(x.bw), 'measured on the exact response'))
  return rows
}

function qwaveRows(x, p) {
  return [
    row('Source resistance', num(p.RS, 'Ω'), 'the knob'),
    row('Load resistance', num(p.RL, 'Ω'), 'the knob'),
    row('Section impedance', `${plain(x.qw.Z0)} Ω`, '√(R_S R_L)'),
    row('Phase velocity', num(x.qw.vp, 'm/s'), 'c / √ε_r'),
    row('Section length', num(x.qw.len, 'm'), 'v_p / 4f'),
    row('Electrical length', `${plain(x.el.degrees, 6)}°`, 'β l'),
    row('Impedance looking in', rectangular(x.at.Z), 'Z_0 (Z_L + j Z_0 tan βl)/(Z_0 + j Z_L tan βl)'),
    row('Reflection at the source', plain(x.at.mag), '(Z_in − R_S)/(Z_in + R_S)'),
    row('Matches again at', x.repeats.map((f) => num(f, 'Hz')).join(', '), 'every odd multiple of the design frequency'),
    row('Response repeats every', num(x.repeat, 'Hz'), 'v_p / 2l'),
    row(`Fractional bandwidth to ${plain(p.target, 5)}`, bandText(x.bw), 'measured on the exact response'),
    row('The L network, same transformation', bandText(x.lumpedBw), 'two reactances instead of a section'),
    row('The section over the L network', bandRatio(x.bw, x.lumpedBw), 'the ratio of the two bandwidths'),
  ]
}
