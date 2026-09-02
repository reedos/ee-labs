// One sentence under every plot, in words a first course uses, with the
// numbers the plot is showing bound to the solver's own readings. A canvas
// says nothing to a reader who cannot parse it — a screen reader, a phone
// too narrow for the pinned values, a student who has never met a Bode plot —
// so the caption says what the picture says (student review, Phase 7).
//
// captionFor returns `parts`: a list of strings and numbers, a number being
// { print, value, unit, kind } — `print` the text the caption shows, `value`
// the raw quantity behind it, so the tests can hold every printed figure to
// the analysis it came from. App renders each number in <b>.

import { complex as cx } from '@ee-labs/network'
import { num } from './format.js'
import { turnedLabel } from './math.js'
import { WORD, familyOf } from './palette.js'

/** A number part: the text shown and the value behind it. */
const n = (value, unit, sig = 3) => ({ print: num(value, unit, sig), value, unit, kind: 'num' })
/** A percentage, one decimal. */
const pct = (frac) => ({ print: `${(100 * frac).toFixed(1)} %`, value: frac, unit: '%', kind: 'pct' })
/** An angle in degrees, one decimal, wrapped to (−180°, 180°]. */
const degOf = (a) => Math.atan2(Math.sin(a), Math.cos(a)) * (180 / Math.PI)
const deg = (a) => ({ print: `${degOf(a).toFixed(1)}°`, value: degOf(a), unit: '°', kind: 'deg' })
/** Decibels, two decimals. */
const dB = (ratio) => ({ print: `${(20 * Math.log10(ratio)).toFixed(2)} dB`, value: 20 * Math.log10(ratio), unit: 'dB', kind: 'dB' })
/** A ratio, ×1.41. */
const times = (ratio) => ({ print: `×${ratio.toPrecision(3)}`, value: ratio, unit: '×', kind: 'times' })
/** A plain figure (ζ). */
const plain = (v) => ({ print: v.toPrecision(3), value: v, unit: '', kind: 'plain' })

/** Join words and parts, dropping empty strings. */
const say = (...parts) => parts.filter((p) => p !== '' && p != null)

/** The unit a trace's quantity is read in. */
const unitOf = (q) => (q.q === 'i' ? 'A' : q.q === 'p' ? 'W' : 'V')

/** "v_C (blue)" the first time a colour word helps — every bright trace names its hue once. */
const named = (q) => `${q.label} (${WORD[familyOf(q)]})`

/** The sample of the energy bookkeeping nearest the cursor — the readout reads the same one. */
export function energyAt(energy, t) {
  const pts = energy.points
  let k = 0
  for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].t - t) < Math.abs(pts[k].t - t)) k = i
  return pts[k]
}

/** The sweep point nearest a knob value on the log axis — the dot the sweep draws. */
export function sweepAt(points, R) {
  const lx = Math.log10(R)
  let best = 0
  for (let i = 1; i < points.length; i++) if (Math.abs(Math.log10(points[i].R) - lx) < Math.abs(Math.log10(points[best].R) - lx)) best = i
  return points[best]
}

/**
 * The caption for one plot view, or null when the view has no plot or the
 * circuit has no solution. `marks` are the plot's data marks (marks.js) so the
 * experiments that draw a level or a point can say what it is in the same
 * breath; `drive` is atDrive's {H, Z} for the frequency views.
 */
export function captionFor(exp, view, x, params, marks = [], drive = null) {
  switch (view) {
    case 'scope':
      return x.tr && x.sol ? scope(exp, x, params, marks) : null
    case 'energy':
      return x.tr && x.energy ? energy(exp, x) : null
    case 'phasor':
      return x.ac && exp.out ? phasor(exp, x) : null
    case 'impedance':
      return x.freq && drive ? impedance(exp, x, params, drive) : null
    case 'bode':
      return x.freq && drive ? bode(exp, x, params, drive) : null
    case 'sweep':
      return x.sweep ? sweep(exp, x, params, marks) : null
    case 'damping':
      return x.damping ? damping(exp, x, params) : null
    default:
      return null
  }
}

function scope(exp, x, params, marks) {
  const t = n(x.cursor, 's')
  const bright = [...exp.scope.left.traces, ...(exp.scope.right ? exp.scope.right.traces : [])].filter((q) => !q.dim).slice(0, 3)
  const readings = []
  bright.forEach((q, i) => {
    const v = x.sol[q.q][q.key]
    readings.push(i === 0 ? '' : i === bright.length - 1 ? ' and ' : ', ', `${named(q)} reads `, n(v, unitOf(q)))
  })
  const head = say('At t = ', t, ' ', ...readings)
  const level = marks.find((m) => m.kind === 'level')
  const point = marks.find((m) => m.kind === 'point')
  const seg = marks.find((m) => m.kind === 'segment')
  switch (exp.id) {
    case 'f3':
      return say(...head, '; v_C is heading for E = ', n(level.value, 'V'), ' (dashed); the ring at τ = ', n(seg.value, 's'), ' is 63.2 % of the way, ', n(point.value, 'V'), ', where the starting slope (slanted) would have arrived.')
    case 'f4':
      return say(...head, '; v_B settles at the dashed line V_th = ', n(level.value, 'V'), ' and v_A began at ', n(point.value, 'V'), ', where the resistors alone put it.')
    case 'f6':
      if (!level) break
      return say(...head, '; the ring at t = 0 is the spark, ', n(point.value, 'V'), ' across the opening switch, and the dashed line is the trickle ', n(level.value, 'A'), ' the current falls to.')
    case 'g4':
      if (!point) break
      return say(...head, ', heading for E = ', n(level.value, 'V'), ' (dashed) — the ring is the first peak, ', n(point.value, 'V'), ', ', pct(point.value / level.value - 1), ' over.')
    default:
      break
  }
  if (level) return say(...head, '; the dashed line is ', level.label, ', ', n(level.value, level.unit), '.')
  return say(...head, ' — the instant the schematic’s meters are reading.')
}

function energy(exp, x) {
  const q = energyAt(x.energy, x.cursor)
  // A negative supply is energy handed back: the fields emptying into the source.
  const gave = q.supplied < 0 ? [' the sources have taken back ', n(-q.supplied, 'J')] : [' the sources have supplied ', n(q.supplied, 'J')]
  return say('By t = ', n(x.cursor, 's'), ...gave, '; ', n(q.stored, 'J'), ' is stored in the fields (gold bands) and ', n(q.dissipated, 'J'), ' has gone as heat in the resistors.')
}

function phasor(exp, x) {
  const X = x.ac[exp.out.q][exp.out.key]
  const unit = exp.out.q === 'i' ? 'A' : 'V'
  const lead = degOf(cx.carg(X) - cx.carg(x.ac.volt[exp.phasor.total]))
  const rel = Math.abs(lead) < 0.05 ? ' in step with the source' : lead > 0 ? [' ahead of the source by ', deg(cx.carg(X) - cx.carg(x.ac.volt[exp.phasor.total]))] : [' behind the source by ', deg(cx.carg(x.ac.volt[exp.phasor.total]) - cx.carg(X))]
  return say(
    'The arrows have turned θ = ',
    { print: turnedLabel(x.omega, x.cursor), value: x.omega * x.cursor, unit: 'rad', kind: 'turned' },
    '; ',
    exp.out.label,
    ' has amplitude ',
    n(cx.cabs(X), unit),
    ...(Array.isArray(rel) ? rel : [rel]),
    ', and each arrow’s height is the value its wave has now.',
  )
}

function impedance(exp, x, params, drive) {
  const Z = drive.Z
  const kind = Z[1] < -1e-9 * cx.cabs(Z) ? 'capacitive: the current leads' : Z[1] > 1e-9 * cx.cabs(Z) ? 'inductive: the current lags' : 'resonant: current and voltage in step'
  const head = say('At the drive ', n(x.omega / (2 * Math.PI), 'Hz'), ' the source sees |Z| = ', n(cx.cabs(Z), 'Ω'), ' at ', deg(cx.carg(Z)), ', ', kind)
  if (exp.id === 'h4') {
    const f0 = 1 / (2 * Math.PI * Math.sqrt(params.L1 * params.C1))
    return say(...head, '; at f₀ = ', n(f0, 'Hz'), ' the reactances cancel and |Z| falls to R = ', n(params.R1, 'Ω'), '.')
  }
  return say(...head, '.')
}

function bode(exp, x, params, drive) {
  const H = drive.H
  const ang = degOf(cx.carg(H))
  const head = say('At the drive ', n(x.omega / (2 * Math.PI), 'Hz'), ' the output is ', dB(cx.cabs(H)), ' (', times(cx.cabs(H)), ' the source) and ', Math.abs(ang) < 0.05 ? 'in step with it' : ang < 0 ? ['behind it by ', deg(-cx.carg(H))] : ['ahead of it by ', deg(cx.carg(H))])
  const flat = (s) => (Array.isArray(s) ? s : [s])
  const parts = head.flatMap(flat)
  if (exp.id === 'h6') {
    const fc = 1 / (2 * Math.PI * params.R1 * params.C1)
    return say(...parts, '; the corner f_c = ', n(fc, 'Hz'), ' is where the gain has fallen 3 dB, half the power, and beyond it the curve drops 20 dB per decade.')
  }
  return say(...parts, '.')
}

function sweep(exp, x, params, marks) {
  const R = params[exp.sweepId]
  const q = sweepAt(x.sweep.points, R)
  const y = exp.sweepY || 'p'
  const head = say('With ', exp.sweepId, ' = ', n(R, 'Ω'), ' the load ', y === 'p' ? 'gets ' : 'sees ', n(q[y], y === 'p' ? 'W' : 'V'))
  if (exp.id === 'd6') {
    const [pmax, eff] = marks
    return say(...head, ' at ', pct(q.efficiency), ' efficiency; the most it can get is ', n(pmax.value, 'W'), ' at R_L = R_s = ', n(pmax.x, 'Ω'), ', where only ', pct(eff.y), ' of the source’s power reaches it.')
  }
  if (exp.id === 'c3') {
    const [level] = marks
    return say(...head, '; unloaded, the divider would give ', n(level.value, 'V'), ' (dashed), and the load pulls it down.')
  }
  if (y === 'p') return say(...head, '; the peak of the curve is ', n(x.sweep.pMax, 'W'), ' near ', n(x.sweep.rOpt, 'Ω'), '.')
  return say(...head, '.')
}

function damping(exp, x, params) {
  const Rcrit = 2 * Math.sqrt(params.L1 / params.C1)
  const at = x.damping.at
  if (!at) return say('R = ', n(params.R1, 'Ω'), ' is outside the sweep (', n(x.damping.lo, 'Ω'), ' to ', n(x.damping.hi, 'Ω'), '); critical damping is R_crit = ', n(Rcrit, 'Ω'), '.')
  return say(
    'With R = ',
    n(at.R, 'Ω'),
    ' (ζ = ',
    plain(at.zeta),
    ') v_C overshoots by ',
    pct(at.overshoot),
    ' and settles within 2 % in ',
    n(at.settle, 's'),
    '; the dashed line is critical damping, R_crit = ',
    n(Rcrit, 'Ω'),
    ', and the quickest settling sits a little below it.',
  )
}

/** The caption as plain text, for the tests and the aria description. */
export const captionText = (parts) => (parts ? parts.map((p) => (typeof p === 'string' ? p : p.print)).join('') : '')
