// The physics of the sources: a photovoltaic cell, a battery, and a bus.
//
// Everything here is solved by @ee-labs/network and @ee-labs/switched as they
// stand. Nothing is fitted, sampled or stepped except where this file says so
// in the name and the comment beside it.
//
// ---------------------------------------------------------------- the cell
//
// The photovoltaic cell is Circuit Elements Lab's I1 with one element moved.
// I1 is a source, a resistor and an exponential diode, solved for its
// operating point by Newton's method. Replace the source and resistor by a
// current source of I_ph across the diode and the cell is complete: the light
// makes a current, the junction it falls on is a diode, and what the
// terminals deliver is the difference. That is the single-diode model. The
// two parasitic elements a datasheet quotes, a series resistance R_s and a
// shunt resistance R_sh, enter as two more resistors, each a labelled toggle
// so a reader can see what it costs.
//
//   i = I_ph − I_s(e^(v_j/nV_T) − 1) − v_j/R_sh,    v = v_j − i·R_s
//
// Series and parallel connection is not that formula repeated. Cells in a
// string carry ONE current and their junctions land where they must, which is
// why a shaded cell drags the whole string down and why the bypass diode
// exists. So a string is built as a netlist with a junction node per cell and
// solved whole, by the same Newton's method, at every point of every sweep.
//
// The one current is also how this file parameterises every curve. A string
// held at a terminal VOLTAGE leaves the split between its junctions to the
// solver, and over the flat part of the curve twelve nearly-open junctions in
// series make a Jacobian Newton walks away from: `newtonDC` refuses, in about
// a sixth of the range. Held at a terminal CURRENT each junction's own
// current is fixed by its own photocurrent, the linearisation is well
// conditioned, and the same solver converges in two to eight iterations
// across the whole curve. So `atI` is the primitive here, and `atV` and `atR`
// bisect it. That costs one scalar search per point and buys a curve with no
// holes in it.
//
// --------------------------------------------------------------- the battery
//
// The battery is Elements F's RC ladder with one addition: the state of
// charge is itself a capacitor. Over the band where the open-circuit voltage
// rises linearly with the state of charge, OCV = V_0 + k·z and z = q/Q, so
// the charge store is a capacitor of Q/k farads in series with a source of
// V_0. Then the whole battery is a linear circuit, `transient` solves it
// exactly, and the state of charge is the integral of the current because it
// is a capacitor's charge. The linear fit is labelled data and carries its
// band; everything downstream of it is exact.
//
// ------------------------------------------------------------------ the day
//
// The day of a microgrid is the one place where the numbers do not come from
// physics. The irradiance, temperature and load profiles are LABELLED DATA,
// twenty-four hourly figures each, chosen to make the lesson visible, and
// `DAY` says so. What the balance does with them is arithmetic on exact
// solves.

import {
  K_B,
  NetworkError,
  Q_E,
  bisect,
  energies,
  newtonDC,
  thermalVoltage,
  transient,
} from '@ee-labs/network'
import { converter, measures, steadyState } from '@ee-labs/switched'

// ------------------------------------------------------------ the cell

/** Standard test conditions: the irradiance and cell temperature a datasheet is quoted at. */
export const G_REF = 1000 // W/m²
export const T_REF = 298.15 // K, which is 25 °C
export const CELSIUS = 273.15

/** Silicon's band gap, and the saturation current's temperature exponent, as SPICE writes them. */
export const E_G = 1.12 // eV
export const XTI = 3

/**
 * The cell, with the parameters this lab quotes. I_ph and I_s are at the
 * reference conditions above. R_s and R_sh are the two parasitic elements: a
 * series resistance of zero means the element is absent rather than nearly
 * absent, and the shunt's default is a real cell's, for the reason
 * `SHUNT_DEFAULT` gives.
 */
export const CELL_DEFAULTS = {
  iph: 5, // A at G_REF
  is: 1e-10, // A at T_REF
  n: 1, // ideality factor
  Rs: 0, // Ω, series; 0 means absent
  Rsh: 1e4, // Ω, shunt; see SHUNT_DEFAULT below for why it is not infinite
  G: G_REF, // W/m²
  T: T_REF, // K
  Ns: 1, // cells in series
  Np: 1, // strings in parallel
  isBypass: 1e-6, // A, the bypass diode's saturation current: a Schottky, so it conducts first
}

/**
 * The saturation current at T, by the law SPICE uses and every device book
 * states. The exponential in 1/T is the band gap over kT, and it is what
 * moves V_oc. The power of T/T_ref is the pre-factor's own temperature
 * dependence, with XTI = 3 for a diffusion-limited junction.
 *
 *   I_s(T) = I_s(T_ref) · (T/T_ref)^(XTI/n) · exp( (E_g·q / n·k) · (1/T_ref − 1/T) )
 */
export function isAt(is, n, T) {
  return is * (T / T_REF) ** (XTI / n) * Math.exp(((E_G * Q_E) / (n * K_B)) * (1 / T_REF - 1 / T))
}

/**
 * The photocurrent at an irradiance. Every photon that arrives makes a
 * carrier pair or it does not, and the rate does not depend on what the
 * terminals are doing, so the photocurrent is proportional to the irradiance
 * exactly. The short-circuit current inherits that proportionality to within
 * what the shunt takes, which is A7's whole point.
 */
export const iphAt = (iph, G) => (G / G_REF) * iph

/** The thermal voltage at the cell's own temperature, not at 300 K. */
export const vtAt = (T) => thermalVoltage(T)

/**
 * Why the default shunt resistance is ten kilohms and not infinity.
 *
 * Two reasons, and the first is the honest one. A real cell always has a
 * shunt path, and ten kilohms is about as good as one gets. Circuit Elements
 * Lab's I5 made the same call for the same reason: its blocking diodes carry
 * a `roff` of ten megohms, because four perfect open circuits leave a node
 * with nothing attached to it.
 *
 * The second is that it is what makes a long string solvable at all. Over the
 * flat part of a twelve-cell string's curve every junction carries a few
 * microamps, its conductance is a tenth of a microsiemens, and Newton has
 * almost nothing to stand on. Ten kilohms across each junction is a hundred
 * microsiemens, a thousand times more, and the same solver then converges
 * over the whole curve in two to eight iterations.
 *
 * What it costs is measured rather than assumed, and A6 quotes it: on the
 * standard cell the open-circuit voltage falls by 0.325 µV and the maximum
 * power by 0.001157 %. The toggle drops it to 5 Ω, where the same two figures
 * become visible ones.
 */
export const SHUNT_DEFAULT = 1e4

/**
 * The tolerance every solve here asks for, and why it is not the solver's
 * own.
 *
 * `newtonDC` stops when a step is under a picovolt. Near the short circuit a
 * junction's current is a difference of two numbers of the order of amps, so
 * it carries about 10⁻¹⁵ A of rounding, and the voltage step that rounding
 * produces cannot settle to a picovolt. The solver reports that it did not
 * converge, which is true and is not useful.
 *
 * A nanovolt is asked for instead. On a cell of 0.63 V that is 1.6 parts in
 * 10⁹, and on a twelve-cell string 1.3 parts in 10¹⁰ — far below the fifth
 * figure any note here quotes. With it, every point of every curve in this
 * lab converges, and none takes more than twelve iterations.
 */
export const NEWTON = { vtol: 1e-9 }

/**
 * One cell as elements, between a bottom node and a top node. `tag` names the
 * cell so ids stay unique inside an array. With R_s absent the junction IS
 * the top node, and the netlist has one element fewer rather than a resistor
 * of nearly zero ohms.
 */
function cellElements(c, tag, bot, top, over = {}) {
  const p = { ...c, ...over }
  const j = p.Rs > 0 ? `j${tag}` : top
  const els = [
    { type: 'I', id: `Iph${tag}`, nodes: [bot, j], value: iphAt(p.iph, p.G) },
    { type: 'D', id: `D${tag}`, nodes: [j, bot], model: 'exp', is: isAt(p.is, p.n, p.T), n: p.n, vt: vtAt(p.T) },
  ]
  if (p.Rsh > 0) els.push({ type: 'R', id: `Rsh${tag}`, nodes: [j, bot], value: p.Rsh })
  if (p.Rs > 0) els.push({ type: 'R', id: `Rs${tag}`, nodes: [j, top], value: p.Rs })
  return els
}

/**
 * The array's own elements, terminal at node `t` and the bottom of every
 * string at ground.
 *
 * `cells(k, s)` may return per-cell overrides. The irradiance falling on cell
 * k of string s is how shading enters, and nothing else changes.
 * `bypass(k, s)` puts a diode across that cell, anode at the cell's bottom
 * node, so it conducts exactly when the string tries to push current
 * backwards through the cell it protects.
 */
export function arrayElements(c, { cells = null, bypass = null } = {}) {
  const { Ns = 1, Np = 1 } = c
  const els = []
  for (let s = 0; s < Np; s++) {
    for (let k = 0; k < Ns; k++) {
      const tag = `${s}_${k}`
      const bot = k === 0 ? 'gnd' : `s${s}n${k}`
      const top = k === Ns - 1 ? 't' : `s${s}n${k + 1}`
      els.push(...cellElements(c, tag, bot, top, cells ? cells(k, s) : {}))
      if (bypass && bypass(k, s))
        els.push({ type: 'D', id: `Db${tag}`, nodes: [bot, top], model: 'exp', is: c.isBypass, n: 1, vt: vtAt(c.T) })
    }
  }
  return els
}

/** The array with its terminal held at a current: `I` amps drawn out of node t. */
export const arrayNetI = (c, I, opts) => ({
  elements: [...arrayElements(c, opts), { type: 'I', id: 'It', nodes: ['t', 'gnd'], value: I }],
})

/** The array with its terminal held at a voltage. */
export const arrayNetV = (c, V, opts) => ({
  elements: [...arrayElements(c, opts), { type: 'V', id: 'Vt', nodes: ['t', 'gnd'], value: V }],
})

/** The array with a load resistance across its terminals: I1's circuit, with the light for the source. */
export const arrayNetR = (c, R, opts) => ({
  elements: [...arrayElements(c, opts), { type: 'R', id: 'RL', nodes: ['t', 'gnd'], value: R }],
})

/**
 * The array delivering a current: the terminal voltage it settles at, the
 * power, and the solved circuit behind both. This is the primitive every
 * other reading here is built from.
 */
export function atI(c, I, opts = {}) {
  const r = newtonDC(arrayNetI(c, I, opts), NEWTON)
  const v = r.sol.v.t
  return { v, i: I, p: v * I, iters: r.iters.length, sol: r.sol, drive: 'i' }
}

/**
 * The open-circuit voltage: no current, so every photocurrent goes through
 * its own junction and the junction voltages add. One solve, no search.
 */
export const openCircuit = (c, opts = {}) => atI(c, 0, opts).v

/**
 * The array with its terminal shorted. At the short circuit every junction in
 * a uniformly lit string sits at zero volts, which is where the voltage drive
 * is at its easiest, so this one point is solved that way and no search is
 * needed. It is also the current no sweep may quite reach: one part in a
 * thousand million short of it a junction still carries a nanoamp, and at it
 * exactly a junction carries nothing, which is the one place Newton's step
 * has no curve to stand on.
 */
export function shortCircuit(c, opts = {}) {
  return newtonDC(arrayNetV(c, 0, opts), NEWTON).sol.i.Vt
}

/**
 * How close a current sweep is allowed to come to the short-circuit current,
 * and why it is not closer.
 *
 * At the short circuit the shunt resistance carries everything the light
 * makes and the junction carries nothing. One part in a million short of it
 * the junction's share is a difference of two numbers near five amps, so it
 * arrives carrying about 10⁻¹⁵ A of rounding. Newton divides that by a
 * conductance to get a voltage step, and the step then cannot settle below
 * the solver's own tolerance. Push a thousand times closer and it reports
 * that it did not converge, correctly, because there is nothing left to
 * converge on. A millionth is clear of that floor, and the short circuit
 * itself is solved by holding the terminal at zero volts instead.
 */
export const BACKOFF = 1e-6
const nearShort = (isc) => isc * (1 - BACKOFF)

/**
 * The array at a terminal voltage. The terminal voltage falls as the current
 * rises, so one bisection on the current lands on it, and every point of the
 * search is an exact solve. Zero volts is the one point the current drive
 * cannot reach, and the voltage drive answers it directly.
 */
export function atV(c, V, opts = {}) {
  if (V <= 0) {
    const r = newtonDC(arrayNetV(c, V, opts), NEWTON)
    return { v: V, i: r.sol.i.Vt, p: V * r.sol.i.Vt, iters: r.iters.length, sol: r.sol, drive: 'v' }
  }
  const voc = openCircuit(c, opts)
  if (V >= voc) return atI(c, 0, opts)
  const I = bisect((i) => atI(c, i, opts).v - V, 0, nearShort(shortCircuit(c, opts)), 0)
  return atI(c, I, opts)
}

/**
 * N points of the I–V curve, from open circuit to the short circuit, each an
 * exact solve. The last point is the voltage-driven short-circuit solve, so
 * the curve ends where the axis is rather than a nanoamp short of it.
 */
export function sweepI(c, { n = 121, opts = {} } = {}) {
  const isc = shortCircuit(c, opts)
  const top = nearShort(isc)
  const pts = Array.from({ length: n - 1 }, (_, k) => atI(c, (top * k) / (n - 1), opts))
  return [...pts, atV(c, 0, opts)]
}

/**
 * The array into a load resistance: Circuit Elements Lab's I1 with the light
 * for a source. The load line i = v/R meets the curve once, and the crossing
 * is bisected on the current, so a load sweep is the same exact curve read
 * along a different family of lines.
 */
export function atR(c, R, opts = {}) {
  const isc = nearShort(shortCircuit(c, opts))
  return atI(c, bisect((i) => atI(c, i, opts).v - i * R, 0, isc, 0), opts)
}

/**
 * The maximum power point, found by a coarse scan of the current followed by
 * a golden-section refinement of the best bracket.
 *
 * A uniformly lit array has one interior maximum, and the refinement alone
 * would find it. Under partial shade the curve can have two, one for each
 * group of cells the bypass diodes leave in circuit, so the scan leads and
 * the refinement only polishes what the scan chose. That is what makes B5's
 * double hump land on the taller peak rather than the nearer one.
 */
export function maxPower(c, { scan = 96, opts = {} } = {}) {
  const isc = nearShort(shortCircuit(c, opts))
  const pts = []
  let best = { p: -Infinity, k: 0 }
  for (let k = 0; k <= scan; k++) {
    const x = atI(c, (isc * k) / scan, opts)
    pts.push(x)
    if (x.p > best.p) best = { ...x, k }
  }
  const lo = pts[Math.max(0, best.k - 1)].i
  const hi = pts[Math.min(scan, best.k + 1)].i
  return refineMax((I) => atI(c, I, opts), lo, hi)
}

/** Golden-section maximisation of p over a bracket of the current. */
function refineMax(f, a, b, iters = 120) {
  const phi = (Math.sqrt(5) - 1) / 2
  let lo = a
  let hi = b
  let c1 = hi - phi * (hi - lo)
  let c2 = lo + phi * (hi - lo)
  let f1 = f(c1)
  let f2 = f(c2)
  for (let k = 0; k < iters && hi - lo > 1e-14 * (b - a + 1); k++) {
    if (f1.p > f2.p) {
      hi = c2
      c2 = c1
      f2 = f1
      c1 = hi - phi * (hi - lo)
      f1 = f(c1)
    } else {
      lo = c1
      c1 = c2
      f1 = f2
      c2 = lo + phi * (hi - lo)
      f2 = f(c2)
    }
  }
  return f1.p > f2.p ? f1 : f2
}

/**
 * The figures a datasheet quotes: the two intercepts, the maximum power
 * point, and the fill factor that compares them.
 *
 *   FF = P_mpp / (V_oc · I_sc)
 *
 * The product V_oc·I_sc is the rectangle the curve is inscribed in, and no
 * cell reaches it: at V_oc it delivers no current, at I_sc no voltage. The
 * fill factor is how much of that rectangle the knee leaves.
 */
export function figures(c, opts = {}) {
  const isc = shortCircuit(c, opts)
  const voc = openCircuit(c, opts)
  const mpp = maxPower(c, { opts })
  return { isc, voc, vmpp: mpp.v, impp: mpp.i, pmpp: mpp.p, ff: mpp.p / (voc * isc), rmpp: mpp.v / mpp.i }
}

/**
 * The open-circuit voltage in closed form, for the case where it has one:
 * identical cells with no shunt resistance. Then no current flows anywhere at
 * open circuit, R_s carries nothing and drops nothing, and each junction
 * takes the whole photocurrent.
 *
 *   V_oc = N_s · n·V_T · ln(I_ph/I_s + 1)
 *
 * With R_sh present the shunt takes part of the photocurrent and this is no
 * longer exact, which is why A5 quotes the solved number beside it.
 */
export function vocFormula(c) {
  const ns = c.Ns || 1
  return ns * c.n * vtAt(c.T) * Math.log(iphAt(c.iph, c.G) / isAt(c.is, c.n, c.T) + 1)
}

/** Volts of V_oc per decade of photocurrent: n·V_T·ln 10, the diode's own slope. */
export const decadeOfLight = (c) => (c.Ns || 1) * c.n * vtAt(c.T) * Math.LN10

// ------------------------------------------------------------ tracking

/**
 * Perturb and observe, as a discrete stepper on the exact P–V curve.
 *
 * One step: move the terminal voltage by `step` in the direction now held,
 * solve the array there, and compare the power against the power before the
 * move. A move that gained power keeps its direction. A move that lost power
 * means the maximum is behind, so the direction reverses. That is the whole
 * algorithm, and its two known behaviours follow from it. It walks to the
 * maximum from either side, and it never stops: at the top it crosses the
 * peak back and forth for ever, one step wide.
 *
 * `state` is { v, p, dir }. `power(v)` returns the power at a terminal
 * voltage, and is an exact solve wherever this lab calls it.
 */
export function poStep(state, power, { step = 0.005, vmin = 0, vmax = Infinity } = {}) {
  const v = Math.min(vmax, Math.max(vmin, state.v + state.dir * step))
  const p = power(v)
  const dir = p < state.p ? -state.dir : state.dir
  return { v, p, dir, gained: p - state.p }
}

/** `n` steps of perturb and observe from a starting voltage, with the whole trajectory kept. */
export function poRun(power, { v0, dir = 1, step = 0.005, n = 40, vmin = 0, vmax = Infinity } = {}) {
  let s = { v: v0, p: power(v0), dir }
  const path = [s]
  for (let k = 0; k < n; k++) {
    s = poStep(s, power, { step, vmin, vmax })
    path.push(s)
  }
  return path
}

/**
 * What the tracker settles on. Once it is oscillating the trajectory repeats,
 * so the settled figure is the mean power over the last `window` steps: the
 * energy the load actually receives, not the best point the walk visited.
 */
export function settled(path, window = 12) {
  const tail = path.slice(-window)
  const mean = tail.reduce((s, x) => s + x.p, 0) / tail.length
  const vs = tail.map((x) => x.v)
  return { mean, vmin: Math.min(...vs), vmax: Math.max(...vs), swing: Math.max(...vs) - Math.min(...vs) }
}

/** The step at which the walk first reverses: how many perturbations it took to find the peak. */
export const firstReversal = (path) => path.findIndex((x, k) => k > 0 && x.dir !== path[k - 1].dir)

// ------------------------------------------------------------ the converter

/**
 * A buck converter's input resistance, ideal and in continuous conduction.
 * The ideal converter is lossless, so V_in·I_in = V_out·I_out. The output is
 * D·V_in into R, so I_out = D·V_in/R and I_in = D·I_out.
 *
 *   R_in = V_in / I_in = R / D²
 *
 * This is why a converter can track at all. The duty is a resistance knob the
 * source sees, and the tracker turns it.
 */
export const buckRin = (R, D) => R / (D * D)

/** The converter's own defaults, which are Power Lab's B-group values. */
export const BUCK_DEFAULTS = { L: 100e-6, C: 100e-6, fs: 100e3, R: 0.5 }

/**
 * Where the array sits when a buck of duty D loads it, and what the converter
 * then does.
 *
 * The array's terminal voltage falls as its current rises and the converter's
 * demand D²·v/R rises with the voltage, so the two meet exactly once, and
 * bisection on the array's own current finds it. The converter is then run
 * from that voltage through `@ee-labs/switched`, and `iinSwitched` against
 * `iinModel` is the check that closes the loop: the operating point the
 * bisection assumed is the input current the switched steady state draws.
 */
export function buckPoint(c, { D, R = BUCK_DEFAULTS.R, L = BUCK_DEFAULTS.L, C = BUCK_DEFAULTS.C, fs = BUCK_DEFAULTS.fs, opts = {} } = {}) {
  const isc = nearShort(shortCircuit(c, opts))
  const f = (i) => i - (D * D * atI(c, i, opts).v) / R
  const x = atI(c, bisect(f, 0, isc, 0), opts)
  const ss = steadyState(converter('buck', { Vin: x.v, D, L, C, R, fs }))
  const m = measures(ss)
  return { ...x, D, R, ss, m, rin: buckRin(R, D), iinModel: (D * D * x.v) / R, iinSwitched: m.sig.iin.avg }
}

/**
 * The duty that puts the array at its maximum power point: R/D² = V_mpp/I_mpp
 * gives D = √(R·I_mpp/V_mpp). Above one the buck cannot get there, and the
 * caller is told rather than handed a duty no converter can set.
 */
export function mpptDuty(c, R = BUCK_DEFAULTS.R, opts = {}) {
  const f = figures(c, opts)
  const D = Math.sqrt(R / f.rmpp)
  return { D, reachable: D > 0 && D < 1, ...f }
}

// ------------------------------------------------------------ the battery

/**
 * The open-circuit voltage against state of charge is LABELLED DATA. These
 * two numbers are a straight-line fit to a lithium-ion cell over the band
 * where it is straight, and the band is the guard. Outside it the real curve
 * turns over at both ends and this fit is wrong, so `inBand` reports the
 * crossing and every experiment states the band it stays inside.
 */
export const OCV_FIT = { v0: 3.48, k: 0.72, band: [0.1, 0.9] }

/** The fitted open-circuit voltage at a state of charge. */
export const ocv = (z, fit = OCV_FIT) => fit.v0 + fit.k * z

/** Is this state of charge inside the fit's band? */
export const inBand = (z, fit = OCV_FIT) => z >= fit.band[0] && z <= fit.band[1]

/**
 * The cell as a battery-management book draws it: a charge store, a series
 * resistance that responds instantly, and two RC pairs that respond over
 * seconds and over minutes.
 *
 * `Q` is the capacity in coulombs, so 2.00 Ah is 7200 C, and the charge store
 * is Q/k farads, which for these values is exactly 10 kF.
 */
export const BATTERY_DEFAULTS = {
  Q: 7200, // C, which is 2.00 Ah
  R0: 25e-3, // Ω
  R1: 15e-3, // Ω
  C1: 2000, // F, so τ₁ = 30 s
  R2: 10e-3, // Ω
  C2: 20000, // F, so τ₂ = 200 s
  z0: 0.5,
}

/** The charge store's capacitance: Q coulombs spread over k volts of open-circuit rise. */
export const chargeCap = (b, fit = OCV_FIT) => b.Q / fit.k

/** The resistance a settled current sees: all three in series. */
export const rDC = (b) => b.R0 + b.R1 + b.R2

/**
 * The battery as a netlist, terminal at node `t`, with whatever `drive`
 * elements the experiment attaches there.
 *
 * The state order is the netlist's own, which is Cq, C2, C1 — the order the
 * elements appear below, and the order `restingState` returns.
 */
export function batteryNet(b, drive, fit = OCV_FIT) {
  return {
    elements: [
      { type: 'V', id: 'V0', nodes: ['a', 'gnd'], value: fit.v0 },
      { type: 'C', id: 'Cq', nodes: ['b', 'a'], value: chargeCap(b, fit) },
      { type: 'R', id: 'R2', nodes: ['b', 'c'], value: b.R2 },
      { type: 'C', id: 'C2', nodes: ['b', 'c'], value: b.C2 },
      { type: 'R', id: 'R1', nodes: ['c', 'd'], value: b.R1 },
      { type: 'C', id: 'C1', nodes: ['c', 'd'], value: b.C1 },
      { type: 'R', id: 'R0', nodes: ['d', 't'], value: b.R0 },
      ...drive,
    ],
  }
}

/** The state vector of a battery resting at state of charge z: the store charged, both pairs relaxed. */
export const restingState = (b, z, fit = OCV_FIT) => [fit.k * z, 0, 0]

/** The state of charge, read off the charge store's own voltage. */
export const socOf = (vq, fit = OCV_FIT) => vq / fit.k

/**
 * A current step into or out of a resting battery, solved exactly. `i` is
 * positive for a discharge. The terminal falls by i·R₀ at the instant of the
 * step, then on down the two time constants towards OCV(z) − i·(R₀+R₁+R₂),
 * while the store itself drains and carries the whole thing with it.
 */
export function pulse(b, { i, tEnd, z0 = b.z0, x0 = null, points = 601, fit = OCV_FIT } = {}) {
  const drive = [{ type: 'I', id: 'Iload', nodes: ['t', 'gnd'], value: 0, wave: { kind: 'step', from: 0, to: i } }]
  return transient(batteryNet(b, drive, fit), { tEnd, points, x0: x0 || restingState(b, z0, fit) })
}

/**
 * One closed cycle: discharge at `i` for `t`, then charge at the same current
 * for the same time from wherever that left it. The state of charge comes
 * back to where it began, so the two energies differ by the heat and by
 * nothing else, and the ratio is the round-trip efficiency.
 *
 * Measuring it any other way overstates the loss. A discharge and a charge
 * that both start from the same state are not a cycle: the second one starts
 * lower on the open-circuit curve, and the extra energy it takes is stored,
 * not lost.
 */
export function roundTrip(b, { i, t, z0 = b.z0, points = 1801, fit = OCV_FIT } = {}) {
  const out = pulse(b, { i, tEnd: t, z0, points, fit })
  const mid = out.at(t).x
  const back = pulse(b, { i: -i, tEnd: t, x0: mid, points, fit })
  const eOut = terminalEnergy(out, i)
  const eIn = -terminalEnergy(back, -i)
  return {
    out,
    back,
    eOut,
    eIn,
    heatOut: heat(out),
    heatIn: heat(back),
    eta: eOut / eIn,
    zStart: socOf(out.at(0).x[0], fit),
    zLow: socOf(mid[0], fit),
    zEnd: socOf(back.at(t).x[0], fit),
  }
}

/**
 * Constant current, then constant voltage: the charging profile every lithium
 * cell is given, as a piecewise source.
 *
 * Phase one holds the current at I_cc and the terminal climbs. Phase two
 * begins at the instant the terminal reaches V_lim, found by bisection on the
 * exact first solve, and holds the terminal there while the current decays.
 * Two exact solves joined at an instant that is a property of the waveform
 * rather than of a sample grid. `tSwitch` is null when the limit is not
 * reached inside the window, and the caller says so.
 */
export function cccv(b, { icc, vlim, tEnd, z0 = 0.2, points = 601, fit = OCV_FIT } = {}) {
  const drive = [{ type: 'I', id: 'Iload', nodes: ['t', 'gnd'], value: 0, wave: { kind: 'step', from: 0, to: -icc } }]
  const cc = transient(batteryNet(b, drive, fit), { tEnd, points, x0: restingState(b, z0, fit) })
  const vt = (t) => cc.at(t).sol.v.t
  if (vt(tEnd) < vlim) return { cc, cv: null, tSwitch: null, xSwitch: null }
  const tSwitch = bisect((t) => vt(t) - vlim, 0, tEnd, 0)
  const xSwitch = cc.at(tSwitch).x
  const cv = transient(batteryNet(b, [{ type: 'V', id: 'Vt', nodes: ['t', 'gnd'], value: vlim }], fit), {
    tEnd: tEnd - tSwitch,
    points,
    x0: xSwitch,
  })
  return { cc, cv, tSwitch, xSwitch }
}

/** The energy the resistances turned into heat over a run, from the exact ledger. */
export function heat(tr) {
  const e = energies(tr)
  return e.points[e.points.length - 1].dissipated
}

/**
 * The energy that crossed the terminal over a run, positive out of the
 * battery. The terminal voltage is exact at every sample and the current is
 * the drive, so this is a trapezoid on an exact trace — the one place in the
 * battery group where a number is integrated numerically, and the tests
 * compare it against the ledger.
 */
export function terminalEnergy(tr, i) {
  let acc = 0
  const s = tr.samples
  for (let k = 1; k < s.length; k++) acc += ((s[k].sol.v.t + s[k - 1].sol.v.t) / 2) * i * (s[k].t - s[k - 1].t)
  return acc
}

// ------------------------------------------------------------ the day

/**
 * LABELLED DATA, all three rows. Twenty-four hourly figures for a clear day
 * in spring, a cell that heats in the sun, and a household that cooks in the
 * evening. None of it is computed from anything. It is here because a day has
 * to have a shape before a balance means anything, and this is a plausible
 * shape. Every experiment that uses it says so on screen.
 *
 * Irradiance in W/m² in the plane of the array, cell temperature in kelvin,
 * load in kilowatts.
 */
export const DAY = {
  hours: Array.from({ length: 24 }, (_, k) => k),
  irradiance: [0, 0, 0, 0, 0, 20, 110, 250, 420, 600, 760, 880, 940, 920, 830, 690, 510, 310, 130, 25, 0, 0, 0, 0],
  cellT: [288, 287, 287, 286, 286, 287, 290, 294, 299, 304, 310, 314, 317, 316, 313, 308, 302, 296, 291, 289, 289, 288, 288, 288],
  load: [0.35, 0.3, 0.3, 0.3, 0.32, 0.45, 0.8, 1.1, 0.9, 0.7, 0.6, 0.6, 0.65, 0.6, 0.6, 0.7, 1.0, 1.6, 2.1, 1.9, 1.4, 0.9, 0.55, 0.4],
}

/**
 * The bus the day is balanced on. The array is `modules` panels of
 * `cellsPerModule` cells, and the bank is a rectangle of the modelled cell:
 * `bankSeries` in series for the voltage, `bankParallel` in parallel for the
 * capacity and for the resistance, which divides.
 */
export const BUS_DEFAULTS = {
  modules: 30,
  cellsPerModule: 36,
  bankSeries: 14,
  bankParallel: 100,
  z0: 0.5,
  zMin: 0.15,
  zMax: 0.95,
}

/**
 * A day on one bus: the array delivers its maximum power point at each hour's
 * irradiance and temperature, the load takes what it takes, and the bank
 * takes up or makes up the difference until it is full or empty.
 *
 * The hourly step is explicit and labelled. Within an hour every quantity is
 * held, so an energy is a power times 3600 seconds, and the ledger closes on
 * that arithmetic exactly. The array's power at each hour is an exact solve
 * at that hour's conditions. The bank's loss is i²R at the current the
 * exchange demands, with R the series resistance of its cells.
 *
 * What the bus cannot do is in the ledger rather than hidden: `curtailed` is
 * surplus with nowhere to go, and `unserved` is load it could not meet.
 */
export function day(c, b, over = {}) {
  const o = { ...BUS_DEFAULTS, ...over }
  const profile = o.profile || DAY
  const bankQ = o.bankParallel * b.Q
  const bankV = o.bankSeries * ocv(0.5)
  const bankE = bankQ * bankV
  const bankR = (o.bankSeries * rDC(b)) / o.bankParallel
  const rows = []
  let z = o.z0
  let curtailed = 0
  let unserved = 0
  let lost = 0
  for (const h of profile.hours) {
    const G = profile.irradiance[h]
    const T = profile.cellT[h]
    const pv = G > 0 ? o.modules * o.cellsPerModule * figures({ ...c, G, T }).pmpp : 0
    const load = profile.load[h] * 1000
    const net = pv - load
    const room = (o.zMax - z) * bankE
    const store = (z - o.zMin) * bankE
    const toBank = net > 0 ? Math.min(net * 3600, room) : -Math.min(-net * 3600, store)
    const i = Math.abs(toBank) / 3600 / bankV
    const loss = i * i * bankR
    lost += loss * 3600
    z += toBank / bankE
    if (net > 0) curtailed += net * 3600 - toBank
    else unserved += -net * 3600 - -toBank
    rows.push({ h, G, T, pv, load, net, toBank, z, i, loss })
  }
  const eIn = rows.reduce((s, r) => s + r.pv, 0) * 3600
  const eLoad = rows.reduce((s, r) => s + r.load, 0) * 3600
  const stored = (z - o.z0) * bankE
  return {
    rows,
    eIn,
    eLoad,
    curtailed,
    unserved,
    lost,
    stored,
    zEnd: z,
    bankV,
    bankQ,
    bankE,
    bankR,
    // What went in equals what came out, hour by hour, with nothing rounded
    // away: array in = load served + stored + curtailed, and the load served
    // is the load asked for less what the bus could not meet.
    residual: eIn - (eLoad - unserved) - stored - curtailed,
  }
}

/** The refusal a caller gets when a string has no operating point at this current. */
export const noOperatingPoint = (id) =>
  new NetworkError(
    'no-point',
    `${id} would have to conduct backwards to carry this current, and this model has no breakdown, so there is no operating point to find. A bypass diode gives the current another way round.`,
    {},
  )
