// Matching networks, synthesised in closed form rather than searched for.
//
// CORE_SCOPE class: ADMITTED, EXACT. An L network between two resistances is
// two equations in two unknowns, and the two equations have a closed solution.
// Nothing here optimises, and nothing here iterates towards an answer. The one
// place a root is found numerically is `bandwidthOf`, which reports where an
// exactly computed response crosses a stated standing-wave ratio, and that is a
// measurement of an exact function rather than an approximation of one.
//
// The synthesis. For a source resistance R_S and a load resistance R_L with
// R_L above R_S, the network that matches them has
//
//   Q = sqrt(R_high/R_low - 1)
//   X_series   = Q R_low          in the low-impedance branch
//   X_parallel = R_high / Q       across the high-impedance branch
//
// with the two reactances of opposite sign. The shunt element always sits
// across the higher of the two resistances, because a shunt element can only
// lower the resistance seen through it. That is why the enumeration below has
// four entries and two of them are refused for any one pair: two orientations,
// each with two sign choices, and one orientation matches while the other
// states why it cannot.
//
// The loaded Q is the same Q the synthesis used, which is the trade this module
// makes visible. A larger transformation ratio needs a larger Q, and a larger Q
// makes the match narrower. `bandwidthOf` measures that rather than asserting
// it.

import { complex as cx } from '@ee-labs/network'
import { RfError, positive, require_ } from './const.js'
import { chainAbcd, elementAbcd } from './cascade.js'
import { mismatch, reflection, toComplex } from './sparam.js'
import { inputImpedance, phaseVelocity, quarterWaveZ0, uniformLine } from './line.js'

const { cabs, cadd, cdiv, cmul } = cx

/** The reactance of a lumped inductor or capacitor at one frequency. */
export function reactanceOf(kind, value, f) {
  positive(f, 'f')
  const w = 2 * Math.PI * f
  if (kind === 'L') return w * value
  if (kind === 'C') return -1 / (w * value)
  if (kind === 'wire') return 0
  throw new RfError(`No reactance for element kind ${kind}. This module builds inductors and capacitors, and nothing else.`, { field: 'kind' })
}

/**
 * The component a reactance asks for at one frequency.
 *
 * A positive reactance is an inductor and a negative one is a capacitor, in a
 * series branch and in a shunt branch alike. A shunt element of reactance X has
 * an admittance of -j/X, so a negative X is a positive susceptance, which is
 * what a capacitor across a node has.
 */
export function elementFor(X, f) {
  positive(f, 'f')
  const w = 2 * Math.PI * f
  if (X === 0) return { kind: 'wire', value: 0, X: 0 }
  if (X > 0) return { kind: 'L', value: X / w, X }
  return { kind: 'C', value: 1 / (w * -X), X }
}

/** The Q an L network needs to transform one resistance into a larger one. */
export function matchQ(Rlow, Rhigh) {
  positive(Rlow, 'R_low')
  positive(Rhigh, 'R_high')
  require_(
    Rhigh >= Rlow,
    `An L network transforms upwards from the low resistance, and ${Rhigh} ohms is below ${Rlow} ohms. Swap the two, or read the orientation the enumeration offers instead.`,
    { field: 'R' },
  )
  return Math.sqrt(Rhigh / Rlow - 1)
}

/** The fractional bandwidth a single resonance of this loaded Q would have. */
export const loadedQBandwidth = (Q) => (Q === 0 ? Infinity : 1 / Q)

// --------------------------------------------------------------- the network

/** The chain matrix of one element of a network, at any frequency. */
export function elementAbcdOf(el, f) {
  if (el.kind === 'wire') return elementAbcd('R', 0, f)
  const kind = el.place === 'shunt' ? `${el.kind}p` : el.kind
  return elementAbcd(kind, el.value, f)
}

/** The chain matrix of a whole network, source first, at any frequency. */
export const networkAbcd = (elements, f) => chainAbcd(elements.map((el) => elementAbcdOf(el, f)))

/** The impedance a chain matrix presents when it is loaded: (A Z_L + B)/(C Z_L + D). */
export function inputZ(abcd, ZL) {
  if (ZL === Infinity) return cdiv(abcd[0][0], abcd[1][0])
  const zl = toComplex(ZL)
  const num = cadd(cmul(abcd[0][0], zl), abcd[0][1])
  const den = cadd(cmul(abcd[1][0], zl), abcd[1][1])
  require_(cabs(den) > 1e-300, 'This network presents an open circuit to its source at this frequency, so no finite impedance describes it.', { field: 'zin', kind: 'singular' })
  return cdiv(num, den)
}

/**
 * Two adjacent elements in the same branch are one element.
 *
 * The load's own reactance is cancelled by a series element, and when the
 * network's own series element sits beside it the two are one reactance. That
 * is the absorption the closed form asks for, and doing it here means the chart
 * draws one arc where there is one move.
 */
function fold(elements, f) {
  const out = []
  for (const el of elements) {
    const last = out[out.length - 1]
    if (last && last.place === el.place) {
      const X = last.X + el.X
      out[out.length - 1] = { place: el.place, absorbed: true, ...elementFor(X, f) }
    } else out.push(el)
  }
  return out.filter((el) => el.kind !== 'wire')
}

const seriesEl = (X, f) => ({ place: 'series', ...elementFor(X, f) })
const shuntEl = (X, f) => ({ place: 'shunt', ...elementFor(X, f) })

// ------------------------------------------------------------ the four cases

/**
 * Every L network the enumeration holds, with the two that match this pair
 * marked and the two that cannot given the reason.
 *
 * `ZL` may be a real number or a complex pair. Its reactance is cancelled by a
 * series element at the load, and the resistive residue is the case the closed
 * form solves. The elements of each solution are listed from the source to the
 * load, which is the order the schematic draws them and the reverse of the
 * order the chart walks.
 */
export function lSolutions({ RS = 50, ZL = 100, f = 1e9 } = {}) {
  positive(RS, 'R_S')
  positive(f, 'f')
  const [R, X] = Array.isArray(ZL) ? [ZL[0], ZL[1]] : [ZL, 0]
  require_(
    Number.isFinite(R) && R > 0,
    `A load of ${R} ohms has no resistance to transform. An L network of two reactances moves power between two resistances, and a purely reactive load accepts none, so no lossless pair of elements matches it.`,
    { field: 'ZL', kind: 'reactive' },
  )
  const cancel = X === 0 ? null : seriesEl(-X, f)

  // The two resistances are already equal, so the network is a wire. That is a
  // match rather than a failure, and it is said rather than divided by.
  if (Math.abs(R - RS) <= 1e-12 * RS) {
    return {
      RS,
      R,
      X,
      f,
      direct: true,
      cancel,
      Q: 0,
      Xs: 0,
      Xp: Infinity,
      up: false,
      solutions: [
        {
          id: 'direct',
          orientation: 'none',
          sign: 1,
          ok: true,
          says: `The load already presents ${RS} ohms of resistance, so no transformation is needed and one series reactance is the whole network.`,
          Q: 0,
          elements: fold(cancel ? [cancel] : [], f),
        },
      ],
    }
  }

  const up = R > RS
  const Rlow = up ? RS : R
  const Rhigh = up ? R : RS
  const Q = matchQ(Rlow, Rhigh)
  const Xs = Q * Rlow
  const Xp = Rhigh / Q

  const solutions = []
  for (const orientation of ['shunt-at-load', 'shunt-at-source']) {
    // The shunt element sits across the higher resistance. `shunt-at-load`
    // therefore matches a load above the source, and `shunt-at-source` a load
    // below it.
    const works = orientation === 'shunt-at-load' ? up : !up
    for (const sign of [1, -1]) {
      const id = `${orientation === 'shunt-at-load' ? 'load' : 'source'}-${sign > 0 ? 'lowpass' : 'highpass'}`
      if (!works) {
        solutions.push({
          id,
          orientation,
          sign,
          ok: false,
          Q,
          elements: [],
          says:
            orientation === 'shunt-at-source'
              ? `A shunt element across the source lowers the resistance seen there, so this orientation matches a source above the load. The source is ${RS} ohms and the load's resistance is ${R} ohms.`
              : `A shunt element across the load lowers the resistance seen through it, so this orientation matches a load above the source. The load's resistance is ${R} ohms and the source is ${RS} ohms.`,
        })
        continue
      }
      // The series element is in the low branch and the shunt across the high
      // one, and the two carry opposite signs.
      const parts =
        orientation === 'shunt-at-load'
          ? [seriesEl(sign * Xs, f), shuntEl(-sign * Xp, f), ...(cancel ? [cancel] : [])]
          : [shuntEl(-sign * Xp, f), seriesEl(sign * Xs, f), ...(cancel ? [cancel] : [])]
      solutions.push({
        id,
        orientation,
        sign,
        ok: true,
        Q,
        elements: fold(parts, f),
        says: sign > 0 ? 'A series inductor and a shunt capacitor, which is also a low-pass filter.' : 'A series capacitor and a shunt inductor, which is also a high-pass filter.',
      })
    }
  }
  return { RS, R, X, f, direct: false, cancel, Q, Xs, Xp, up, solutions }
}

/**
 * The L network this lab shows for one pair, with everything a panel prints.
 *
 * `pick` names which of the enumeration's entries is on screen. The default is
 * the low-pass one, because a matching network that also rejects the harmonics
 * of what drives it is the one a radio uses.
 */
export function lMatch({ RS = 50, ZL = 100, f = 1e9, pick = 'lowpass' } = {}) {
  const all = lSolutions({ RS, ZL, f })
  const ok = all.solutions.filter((s) => s.ok)
  require_(ok.length > 0, 'No L network of two reactances matches this pair of impedances.', { field: 'ZL' })
  const chosen = ok.find((s) => s.id.endsWith(pick)) || ok[0]
  return { ...all, chosen, ok, at: matchAt(chosen, ZL, RS, f) }
}

/**
 * What a network reads at one frequency: the impedance looking in from the
 * source, and the reflection it sends back against the source resistance.
 *
 * The elements are components with fixed values, so their reactances move with
 * frequency and the match holds at one frequency only. That is the whole of
 * what the bandwidth measurement below measures.
 *
 * The load is an impedance rather than a component, so its own reactance is the
 * same at every frequency here. A capacitor's would not be, and the panel says
 * which is on the bench.
 */
export function matchAt(sol, ZL, RS, f) {
  const abcd = networkAbcd(sol.elements, f)
  const Z = inputZ(abcd, ZL)
  const m = mismatch(Z, RS)
  return { f, abcd, Z, gamma: m.gamma, mag: m.mag, vswr: m.vswr, returnLossDb: m.returnLossDb }
}

/** The reflection a network sends back at one frequency, as a bare magnitude. */
export const matchMag = (sol, ZL, RS, f) => cabs(reflection(inputZ(networkAbcd(sol.elements, f), ZL), RS))

/** The standing-wave ratio against frequency, at exact points and nothing between them. */
export function sweepMatch(sol, ZL, RS, { from, to, points = 161, log = false } = {}) {
  require_(points >= 2, `A sweep needs at least two frequencies, and this one asks for ${points}.`, { field: 'points' })
  const out = []
  for (let k = 0; k < points; k++) {
    const t = k / (points - 1)
    const f = log ? from * Math.pow(to / from, t) : from + (to - from) * t
    const Z = inputZ(networkAbcd(sol.elements, f), ZL)
    const g = reflection(Z, RS)
    const mag = cabs(g)
    out.push({ f, Z, gamma: g, mag, vswr: mag >= 1 ? Infinity : (1 + mag) / (1 - mag) })
  }
  return out
}

/**
 * Where an exactly computed response crosses a stated standing-wave ratio,
 * either side of the design frequency.
 *
 * The crossing is found by bisection on the exact function rather than by
 * reading a swept point, so the answer does not depend on how many points the
 * sweep drew. `span` is how far out the search looks, as a ratio of the design
 * frequency, and a response that never crosses inside it is reported as
 * unbounded rather than clamped to the edge.
 */
export function bandwidthOf(read, f0, { vswr = 2, span = 40, steps = 400 } = {}) {
  positive(f0, 'f0')
  require_(vswr > 1, `A bandwidth is measured to a standing-wave ratio above one, and this one asks for ${vswr}.`, { field: 'vswr' })
  const target = (vswr - 1) / (vswr + 1)
  const over = (f) => read(f) - target
  require_(over(f0) < 0, `This network does not reach a standing-wave ratio of ${vswr} at its design frequency, so it has no bandwidth to that ratio.`, { field: 'vswr' })

  /** Walk out until the response crosses, then bisect between the last two. */
  const edge = (dir) => {
    let lo = f0
    let hi = null
    for (let k = 1; k <= steps; k++) {
      const f = f0 * Math.pow(span, (dir * k) / steps)
      if (!(f > 0)) return null
      if (over(f) > 0) {
        hi = f
        break
      }
      lo = f
    }
    if (hi === null) return null
    for (let k = 0; k < 90; k++) {
      const mid = Math.sqrt(lo * hi)
      if (over(mid) > 0) hi = mid
      else lo = mid
    }
    return Math.sqrt(lo * hi)
  }

  const lower = edge(-1)
  const upper = edge(1)
  if (lower === null || upper === null) return { vswr, f0, lower, upper, width: Infinity, fractional: Infinity, bounded: false }
  return { vswr, f0, lower, upper, width: upper - lower, fractional: (upper - lower) / f0, bounded: true }
}

/** The bandwidth of one L network, measured on its own exact response. */
export const matchBandwidth = (sol, ZL, RS, f0, opts) => bandwidthOf((f) => matchMag(sol, ZL, RS, f), f0, opts)

// --------------------------------------------------------- the quarter wave

/**
 * The quarter-wave transformer: one line whose characteristic impedance is the
 * geometric mean of the two resistances it joins.
 *
 * Exact at the design frequency and at every odd multiple of it, because the
 * line is an odd number of quarter waves long at each of those. At an even
 * multiple it is a whole number of half waves and presents the load unchanged,
 * which is the worst it does.
 */
export function quarterWaveMatch({ RS = 50, RL = 100, f0 = 1e9, epsr = 2.1, alpha = 0 } = {}) {
  positive(f0, 'f0')
  const Z0 = quarterWaveZ0(RS, RL)
  const vp = phaseVelocity(epsr)
  const len = vp / (4 * f0)
  const line = uniformLine({ Z0, epsr, len, alpha })
  const at = (f) => {
    const Z = inputImpedance(line, RL, f).Z
    const m = mismatch(Z, RS)
    return { f, Z, gamma: m.gamma, mag: m.mag, vswr: m.vswr, returnLossDb: m.returnLossDb }
  }
  return { RS, RL, f0, Z0, epsr, len, vp, line, at, read: (f) => at(f).mag }
}

/** The frequencies a quarter-wave transformer matches at: every odd multiple of its design frequency. */
export function quarterWaveRepeats(f0, upTo) {
  const out = []
  for (let n = 1; n * f0 <= upTo; n += 2) out.push(n * f0)
  return out
}

/** The standing-wave ratio of a quarter-wave transformer against frequency. */
export function sweepQuarterWave(qw, { from, to, points = 161 } = {}) {
  require_(points >= 2, `A sweep needs at least two frequencies, and this one asks for ${points}.`, { field: 'points' })
  const out = []
  for (let k = 0; k < points; k++) {
    const f = from + ((to - from) * k) / (points - 1)
    const r = qw.at(f)
    out.push({ f, Z: r.Z, gamma: r.gamma, mag: r.mag, vswr: r.vswr })
  }
  return out
}

// ------------------------------------------------------------- the two arcs

/**
 * The path a matching network traces on the chart, one arc per element, from
 * the load towards the source.
 *
 * A series element adds reactance and leaves resistance alone, so its arc runs
 * along a circle of constant resistance. A shunt element adds susceptance and
 * leaves conductance alone, so its arc runs along a circle of constant
 * conductance. Each arc is drawn by ramping the element from nothing to its own
 * value, which is why the ramp is in susceptance for a shunt element and in
 * reactance for a series one: a shunt element of no susceptance is absent, and
 * a shunt element of no reactance is a short.
 */
export function matchPath(sol, ZL, RS, { steps = 32 } = {}) {
  positive(RS, 'R_S')
  const arcs = []
  let Z = ZL === Infinity ? Infinity : toComplex(ZL)
  for (const el of [...sol.elements].reverse()) {
    const points = []
    const start = Z
    for (let k = 0; k <= steps; k++) {
      const t = k / steps
      let here
      if (el.place === 'series') {
        here = cadd(Z, [0, el.X * t])
      } else {
        const B = -1 / el.X
        const Y = cdiv([1, 0], Z)
        here = cdiv([1, 0], cadd(Y, [0, B * t]))
      }
      const g = reflection(here, RS)
      points.push([g[0], g[1]])
      if (k === steps) Z = here
    }
    arcs.push({
      place: el.place,
      kind: el.place === 'series' ? 'series' : 'shunt',
      label: `${el.place} ${el.kind === 'L' ? 'inductor' : 'capacitor'}`,
      points,
      from: start,
      to: Z,
    })
  }
  return arcs
}

/**
 * The path a quarter-wave transformer traces on the chart, from the load at one
 * end of the section to the source at the other.
 *
 * Each point is an exact solve of a shorter length of the same line, so the
 * path is the impedance at that place on the section and not an interpolation
 * between the two ends. At the design frequency it ends at the centre. At any
 * other frequency it ends wherever the section leaves it, which is the whole of
 * what the bandwidth measures.
 */
export function transformerPath(qw, f, { steps = 48 } = {}) {
  positive(f, 'f')
  const out = []
  for (let k = 0; k <= steps; k++) {
    const len = (qw.len * k) / steps
    const Z = k === 0 ? qw.RL : inputImpedance(uniformLine({ Z0: qw.Z0, epsr: qw.epsr, len }), qw.RL, f).Z
    const g = reflection(Z, qw.RS)
    out.push([g[0], g[1]])
  }
  return out
}

/**
 * The netlist of a matching network with its load, for a solve that shares
 * nothing with the chain matrix above.
 *
 * Invariant 4 checks the synthesis through `solveAC` with this, so the claim
 * that a synthesised match is matched is made by the circuit solver and not by
 * the arithmetic that designed the network.
 */
export function matchNetlist(sol, ZL, f) {
  const [R, X] = Array.isArray(ZL) ? [ZL[0], ZL[1]] : [ZL, 0]
  const elements = []
  let node = 'p1'
  sol.elements.forEach((el, i) => {
    if (el.place === 'series') {
      const next = `n${i}`
      elements.push({ type: el.kind, id: `E${i}`, nodes: [node, next], value: el.value })
      node = next
    } else {
      elements.push({ type: el.kind, id: `E${i}`, nodes: [node, 'gnd'], value: el.value })
    }
  })
  // The load: a resistance, and its reactance as the component that has that
  // reactance at this frequency. The reactance in the analysis is fixed and a
  // component's is not, so this netlist is the load at ONE frequency.
  if (X === 0) {
    elements.push({ type: 'R', id: 'RL', nodes: [node, 'gnd'], value: R })
  } else {
    const part = elementFor(X, f)
    elements.push({ type: 'R', id: 'RL', nodes: [node, 'nl'], value: R })
    elements.push({ type: part.kind, id: 'XL', nodes: ['nl', 'gnd'], value: part.value })
  }
  return { elements }
}

export { RfError }
