// Two converters with a transformer in them, as switched linear circuits.
//
// A turns ratio is a scaling, so an isolated converter is still piecewise
// linear and still has two state variables. Both circuits below are built in
// the shape `converter()` returns, so `steadyState`, `measures` and
// `waveforms` take them unchanged.
//
// The turns ratio is written n = N_s/N_p throughout, secondary over primary.
// Volts scale by n from primary to secondary, amps by 1/n the other way.
//
// ------------------------------------------------------------- the flyback
//
// A buck-boost whose inductor grew a second winding. The magnetising current
// i_M is carried on the primary side, so the state is [i_M, v_C] and the two
// intervals are the buck-boost's:
//
//   on   the switch puts V_in across the primary and i_M rises; the diode is
//        reverse biased and the capacitor alone feeds the load
//   off   the switch opens, the winding reverses, the secondary diode
//        conducts, and the secondary delivers i_M/n into the output
//
// Reflected to the primary, the off interval puts (v_out + V_f)/n across the
// winding, so volt-second balance is V_in·D = (V_out + V_f)(1−D)/n and the
// ideal ratio is M = n·D/(1−D). The switch blocks V_in + V_out/n, which is
// the price of the isolation and the row D4 compares against.
//
// -------------------------------------------------------- the half-bridge
//
// Two switches across a capacitor divider drive the primary with ±V_in/2,
// and the rectified secondary feeds an output inductor. One switching period
// holds four intervals: Q1 on, freewheel, Q2 on, freewheel. The output side
// cannot tell the two halves apart — it sees the same pulse of n·V_in/2
// followed by the same freewheel — so the state at the half-period equals
// the state at the start, and the whole converter is solved over a half
// period with a duty of 2D. That is not an approximation: it is the
// symmetry, and it is why the output ripple runs at 2f_s. The waveform is
// drawn over two of these half periods and the second one is labelled with
// Q2, so the reader sees the full switching period the switches live in.
//
// V1 holds the divider midpoint stiff at V_in/2 and carries no magnetising
// current, so this transformer stores nothing by construction. The duty
// asymmetry the plan's D4 mentions needs the midpoint as a third state, and
// is not modelled here.

import { DEFAULTS, SIGNALS, evalSignal } from './topologies.js'
import { eye, matVec, solve } from './linalg.js'
import { sample, stateAt, illinois, quadrature, integral as segmentIntegral } from './segment.js'
import { measures, average } from './steady.js'

export const ISOLATED_KINDS = ['flyback', 'halfbridge']

export const ISOLATED_DEFAULTS = {
  ...DEFAULTS,
  n: 0.5, // turns ratio N_s/N_p
}

const lin = (c1, c2, d = 0) => ({ c: [c1, c2], d })

/** M = n·D/(1−D) for the flyback, M = n·D for the half-bridge. */
export function isolatedM(kind, D, n) {
  return kind === 'flyback' ? (n * D) / (1 - D) : n * D
}

export function flyback(params = {}) {
  const p = { ...ISOLATED_DEFAULTS, ...params }
  const { Vin, L, C, R, n, Ron, Vf, rd, RL, ESR } = p
  const alpha = R / (R + ESR)
  const T = 1 / p.fs
  const zero = lin(0, 0)
  const iM = lin(1, 0)
  // The secondary current reaches the output node as i_M/n, so the output
  // forms are the standard ones with that current in them.
  const outFed = { vout: lin((alpha * ESR) / n, alpha), iC: lin(alpha / n, -alpha / R) }
  const outAlone = { vout: lin(0, alpha), iC: lin(0, -alpha / R) }

  // On: V_in across the primary, less the switch and winding drops.
  const rOn = Ron + RL
  const on = {
    name: 'on',
    A: [
      [-rOn / L, 0],
      [0, -alpha / (R * C)],
    ],
    f: [Vin / L, 0],
    signals: {
      ...outAlone,
      // The drain sits at the switch drop while it conducts.
      vsw: lin(Ron, 0),
      vL: lin(-rOn, 0, Vin),
      iQ: iM,
      iD: zero,
      iin: iM,
    },
  }
  // Off: the secondary conducts. Referred to the primary, the winding sees
  // (v_out + V_f)/n and the diode's slope resistance appears as rd/n².
  const rOff = RL + rd / (n * n) + (alpha * ESR) / (n * n)
  const off = {
    name: 'off',
    A: [
      [-rOff / L, -alpha / (n * L)],
      [alpha / (n * C), -alpha / (R * C)],
    ],
    f: [-Vf / (n * L), 0],
    signals: {
      ...outFed,
      // The drain carries V_in plus the reflected output.
      vsw: lin(rOff, alpha / n, Vin + Vf / n),
      vL: lin(-rOff, -alpha / n, -Vf / n),
      iQ: zero,
      iD: lin(1 / n, 0),
      iin: zero,
    },
  }
  const dead = {
    name: 'dead',
    A: [
      [0, 0],
      [0, -alpha / (R * C)],
    ],
    f: [0, 0],
    signals: { ...outAlone, vsw: lin(0, 0, Vin), vL: zero, iQ: zero, iD: zero, iin: zero },
  }
  for (const s of [on, off, dead]) {
    s.signals.iL = iM
    s.signals.vC = lin(0, 1)
  }
  return {
    kind: 'flyback',
    p,
    T,
    alpha,
    n,
    states: { on, off, dead },
    hasDead: true,
    inverted: false,
    isolated: true,
    // The switch holds the rail plus the output reflected back through the
    // turns ratio.
    blocking: (voutAvg) => Vin + (voutAvg + Vf) / n,
    idealM: (D = p.D) => isolatedM('flyback', D, n),
  }
}

export function halfBridge(params = {}) {
  const p = { ...ISOLATED_DEFAULTS, ...params }
  const { Vin, L, C, R, n, Ron, Vf, rd, RL, ESR } = p
  const alpha = R / (R + ESR)
  // Solved over a half switching period at twice the duty: the output side
  // repeats every half period, and D is each switch's share of the whole.
  const Tsw = 1 / p.fs
  const T = Tsw / 2
  const Deff = Math.min(0.999999, 2 * p.D)
  const zero = lin(0, 0)
  const iL = lin(1, 0)
  const outFed = { vout: lin(alpha * ESR, alpha), iC: lin(alpha, -alpha / R) }

  // The secondary pulse: n·V_in/2, less the reflected switch drop (the
  // primary carries n·i_L), the rectifier drop and the winding.
  const rOn = n * n * Ron + rd + RL + alpha * ESR
  const on = {
    name: 'Q1 on',
    A: [
      [-rOn / L, -alpha / L],
      [alpha / C, -alpha / (R * C)],
    ],
    f: [((n * Vin) / 2 - Vf) / L, 0],
    signals: {
      ...outFed,
      vsw: lin(-(n * n * Ron + rd), 0, (n * Vin) / 2 - Vf),
      vL: lin(-rOn, -alpha, (n * Vin) / 2 - Vf),
      iQ: lin(n, 0),
      iD: iL,
      // The current the rail supplies, as the equivalent DC draw: the
      // primary carries n·i_L against V_in/2, which is (n/2)·i_L against V_in.
      iin: lin(n / 2, 0),
    },
  }
  // Freewheel: both rectifier legs carry the inductor current and the
  // secondary is shorted, so the filter sees the rectifier drop alone.
  const rFree = rd + RL + alpha * ESR
  const off = {
    name: 'freewheel',
    A: [
      [-rFree / L, -alpha / L],
      [alpha / C, -alpha / (R * C)],
    ],
    f: [-Vf / L, 0],
    signals: {
      ...outFed,
      vsw: lin(-rd, 0, -Vf),
      vL: lin(-rFree, -alpha, -Vf),
      iQ: zero,
      iD: iL,
      iin: zero,
    },
  }
  const dead = {
    name: 'dead',
    A: [
      [0, 0],
      [0, -alpha / (R * C)],
    ],
    f: [0, 0],
    signals: { vout: lin(0, alpha), iC: lin(0, -alpha / R), vsw: lin(0, alpha), vL: zero, iQ: zero, iD: zero, iin: zero },
  }
  for (const s of [on, off, dead]) {
    s.signals.iL = iL
    s.signals.vC = lin(0, 1)
  }
  // What the secondary pulse has left after the rectifier's own drop. At or
  // below zero the rectifier can never conduct, the model's assumption that
  // the output inductor is always fed through it fails, and the caller is
  // told rather than shown a converter with a negative output.
  const headroom = (n * Vin) / 2 - Vf
  return {
    kind: 'halfbridge',
    headroom,
    deliverable: headroom > 0,
    // The solver reads D and fs off p, so they carry the half-period values;
    // `switching` keeps the numbers the reader set.
    p: { ...p, D: Deff, fs: 2 * p.fs },
    switching: { D: p.D, fs: p.fs, T: Tsw, n },
    T,
    alpha,
    n,
    states: { on, off, dead },
    hasDead: true,
    inverted: false,
    isolated: true,
    // Each switch stands off the whole rail while the other conducts.
    blocking: () => Vin,
    idealM: (D = p.D) => isolatedM('halfbridge', D, n),
  }
}

export function isolated(kind, params = {}) {
  if (kind === 'flyback') return flyback(params)
  if (kind === 'halfbridge') return halfBridge(params)
  throw new Error(`unknown isolated converter "${kind}"`)
}

// ------------------------------------------------- the forward family
//
// Three more converters with a transformer in them, and the half-bridge's
// siblings: the forward, the push-pull and the full bridge. All three pass
// energy through the core rather than storing it, all three feed a buck's
// output filter through a rectifier, and all three are still piecewise
// linear. What separates them shows up in three measurable places: the
// ratio, the voltage each switch stands off, and what happens to the
// magnetising current.
//
// So the state grows by one. x = [i_L, v_C, i_M], with i_M the magnetising
// current carried on the primary side. It is not a passenger. The forward's
// reset interval is the interval in which i_M returns to zero, and the
// push-pull's flux walk is i_M finding a DC offset the two half-cycles no
// longer cancel.
//
// ------------------------------------------------------------ the forward
//
// A buck through a transformer. The switch puts V_in across the primary for
// D·T, the secondary delivers n·V_in to the filter, and volt-second balance
// on the output inductor gives M = n·D. The magnetising current has its own
// volt-second balance to keep, and nothing on the secondary side can help
// it, because the rectifier blocks the moment the winding reverses. So a
// third winding of n_r times the primary's turns returns i_M to the source,
// at V_in/n_r across the primary, which takes n_r·D·T. The period has to
// hold both intervals, so D < 1/(1 + n_r), and at the usual n_r = 1 that is
// a duty ceiling of one half. The switch stands off V_in + V_in/n_r while
// the reset winding conducts, which at n_r = 1 is twice the rail.
//
// The reset winding's diode is modelled ideal. Its drop would shorten the
// reset interval and dissipate V_f·i_M/n_r, both small beside the output
// rectifier's, and leaving it out keeps the reset interval at exactly
// n_r·D·T and keeps every joule the source supplies accounted for.
//
// -------------------------------------------- the push-pull and the bridge
//
// Two switches (four for the bridge) swing the primary both ways, so the
// core's loop is used in both directions and the rectified secondary is fed
// twice per period: M = 2·n·D with D each switch's own share, at most one
// half. The output ripple runs at 2·f_s, as the half-bridge's does.
//
// What separates them is the voltage a switch blocks. A push-pull switch
// sits across half the primary while the other half is driven, and the
// transformer puts that half's voltage on top of the rail, so it stands off
// 2·V_in. A full-bridge switch stands off the rail and no more, which is why
// the same devices carry twice the input voltage there.
//
// Then the flux walk. Give the two switches different on-resistances and the
// two half-cycles no longer put equal volt-seconds on the magnetising
// inductance. The imbalance is a DC voltage on i_M, so i_M walks, until the
// resistances themselves stop it, because the walk changes the current each
// switch carries. Volt-second balance over the period gives the offset it
// settles at,
//
//     ⟨i_M⟩ = n·I_out·(R_on2 − R_on1)/(R_on1 + R_on2)
//
// which is bounded by n·I_out however bad the mismatch, and undefined when
// both resistances are zero. That case is not a hole in the arithmetic. An
// ideal push-pull has no fixed point for i_M at all, because every offset is
// periodic and which one it sits at is its history. The solver says so by
// pinning i_M(0) = 0 and declaring `driftFree`.

export const FORWARD_KINDS = ['forward', 'pushpull', 'fullbridge']

export const FORWARD_DEFAULTS = {
  ...ISOLATED_DEFAULTS,
  // Magnetising inductance, referred to the primary.
  Lm: 1e-3,
  // Reset winding turns over the primary's (the forward's alone).
  nr: 1,
  // How much larger the second switch's resistance is than the first's, as
  // a fraction of it. The push-pull's flux walk is what this is for.
  mismatch: 0,
}

const lin3 = (c1, c2, c3, d = 0) => ({ c: [c1, c2, c3], d })

/**
 * A projection that pins the named components of x at zero on entering a
 * state. A blocked diode's current is zero exactly, not to within the last
 * bit of the search that found the instant, and the rule that chooses the
 * topology reads that current. Left at 1e-18 it would choose the conducting
 * state again and the walk would chatter. The projection is linear, so the
 * period map is still affine and the same solve finds its fixed point.
 */
const pinZero = (n, ...idx) => {
  const P = eye(n)
  for (const i of idx) P[i][i] = 0
  return P
}

/** M = n·D for the forward, 2·n·D for the push-pull and the full bridge. */
export function forwardM(kind, D, n) {
  return kind === 'forward' ? n * D : 2 * n * D
}

/** The duty above which a forward converter's core cannot reset in time. */
export const resetCeiling = (nr = 1) => 1 / (1 + nr)

/**
 * The DC offset the magnetising current settles at when the two half-cycles
 * are driven through different resistances. It is zero at R_on1 = R_on2 = 0,
 * where every offset is periodic and none is preferred.
 */
export function fluxWalk({ n, Iout, Ron1, Ron2 }) {
  const s = Ron1 + Ron2
  return s > 0 ? (n * Iout * (Ron2 - Ron1)) / s : 0
}

/**
 * The two state variables every pane reads by name, added to each state, and
 * the state's own name written on it. `measures` walks the whole signal list,
 * so a state missing one of them is a crash rather than a blank column.
 */
function nameStates(states) {
  for (const [name, s] of Object.entries(states)) {
    s.name = name
    s.signals.iL = lin3(1, 0, 0)
    s.signals.vC = lin3(0, 1, 0)
  }
  return states
}

/**
 * The output side every converter in this family shares: a buck filter fed
 * through a rectifier. `pulse` is the voltage the filter's input node holds
 * while the primary is driven, as a form in x, and the rest is the buck's.
 */
function filterStates({ L, C, R, alpha, ESR, RL, rd, Vf }) {
  const out = { vout: lin3(alpha * ESR, alpha, 0), iC: lin3(alpha, -alpha / R, 0) }
  const alone = { vout: lin3(0, alpha, 0), iC: lin3(0, -alpha / R, 0) }
  const rFree = rd + RL + alpha * ESR
  const free = {
    A: [
      [-rFree / L, -alpha / L, 0],
      [alpha / C, -alpha / (R * C), 0],
      [0, 0, 0],
    ],
    f: [-Vf / L, 0, 0],
    signals: {
      ...out,
      vsw: lin3(-rd, 0, 0, -Vf),
      vL: lin3(-rFree, -alpha, 0, -Vf),
      iQ: lin3(0, 0, 0),
      iD: lin3(1, 0, 0),
      iin: lin3(0, 0, 0),
      iM: lin3(0, 0, 1),
    },
  }
  const dead = {
    A: [
      [0, 0, 0],
      [0, -alpha / (R * C), 0],
      [0, 0, 0],
    ],
    f: [0, 0, 0],
    signals: {
      ...alone,
      vsw: lin3(0, alpha, 0),
      vL: lin3(0, 0, 0),
      iQ: lin3(0, 0, 0),
      iD: lin3(0, 0, 0),
      iin: lin3(0, 0, 0),
      iM: lin3(0, 0, 1),
    },
  }
  return { free, dead, out, alone, rFree }
}

/**
 * A driven interval: the primary carries n·i_L + s·i_M through `ron`, the
 * secondary hands n·(V_in − ron·i_p) to the filter, and i_M rises (s = +1)
 * or falls (s = −1) with it. One function serves the forward's on interval
 * and both of the push-pull's, because they differ only in s and ron.
 */
function drivenState(name, s, ron, { Vin, L, C, R, n, Lm, alpha, ESR, RL, rd, Vf }, out) {
  const rOn = n * n * ron + rd + RL + alpha * ESR
  // The filter's input node: n·V_in − V_f, less the reflected switch drop.
  const vsw = lin3(-(n * n * ron + rd), 0, -s * n * ron, n * Vin - Vf)
  return {
    name,
    A: [
      [-rOn / L, -alpha / L, (-s * n * ron) / L],
      [alpha / C, -alpha / (R * C), 0],
      [(-s * n * ron) / Lm, 0, -ron / Lm],
    ],
    f: [(n * Vin - Vf) / L, 0, (s * Vin) / Lm],
    signals: {
      ...out,
      vsw,
      vL: lin3(vsw.c[0] - RL - alpha * ESR, -alpha, vsw.c[2], vsw.d),
      // The current the conducting switch and the rail both carry.
      iQ: lin3(n, 0, s),
      iD: lin3(1, 0, 0),
      iin: lin3(n, 0, s),
      iM: lin3(0, 0, 1),
    },
  }
}

/**
 * The forward converter: on, reset, freewheel, and the two dry variants of
 * the last two that a light load produces.
 */
export function forward(params = {}) {
  const p = { ...FORWARD_DEFAULTS, ...params }
  const { Vin, L, C, R, n, Lm, nr, Ron, Vf, rd, RL, ESR } = p
  const alpha = R / (R + ESR)
  const T = 1 / p.fs
  const geom = { Vin, L, C, R, n, Lm, alpha, ESR, RL, rd, Vf }
  const { free, dead, out } = filterStates({ L, C, R, alpha, ESR, RL, rd, Vf })
  const on = drivenState('on', 1, Ron, geom, out)
  // Reset: the third winding returns i_M to the source at V_in/n_r across
  // the primary, and the output inductor freewheels. The rail takes current
  // back, so i_in is negative here.
  const reset = {
    ...free,
    name: 'reset',
    f: [free.f[0], 0, -Vin / (nr * Lm)],
    signals: { ...free.signals, iin: lin3(0, 0, -1 / nr) },
  }
  const resetDry = {
    ...dead,
    name: 'reset dry',
    f: [0, 0, -Vin / (nr * Lm)],
    signals: { ...dead.signals, iin: lin3(0, 0, -1 / nr) },
    project: pinZero(3, 0),
  }
  const freewheel = { ...free, name: 'freewheel', project: pinZero(3, 2) }
  const idle = { ...dead, name: 'dead', project: pinZero(3, 0, 2) }
  const states = { on, reset, 'reset dry': resetDry, freewheel, dead: idle }
  nameStates(states)
  // Which interval the off window is in: the core is still resetting while
  // i_M is above zero, and the filter freewheels while i_L is.
  const pick = (x) => (x[2] > 0 ? (x[0] > 0 ? 'reset' : 'reset dry') : x[0] > 0 ? 'freewheel' : 'dead')
  const guard = (x, name) => {
    const m = name.startsWith('reset') ? x[2] : Infinity
    const l = name === 'reset' || name === 'freewheel' ? x[0] : Infinity
    return Math.min(m, l)
  }
  const tOn = p.D * T
  return {
    kind: 'forward',
    p,
    T,
    tOn,
    alpha,
    n,
    order: 3,
    states,
    signals: [...SIGNALS, 'iM'],
    hasDead: true,
    inverted: false,
    isolated: true,
    windows: [
      { T: tOn, pick: () => 'on', guard: () => Infinity },
      { T: T - tOn, pick, guard },
    ],
    // The reset takes n_r·D·T, and the period has to hold it as well as the
    // on interval. Past the ceiling the core carries flux into the next
    // period and there is no periodic state to find.
    maxDuty: resetCeiling(nr),
    resets: p.D < resetCeiling(nr),
    resetTime: nr * p.D * T,
    switching: { D: p.D, fs: p.fs, T, n },
    stress: Vin * (1 + 1 / nr),
    blocking: () => Vin * (1 + 1 / nr),
    idealM: (D = p.D) => forwardM('forward', D, n),
  }
}

/**
 * The push-pull and the full bridge, which are one circuit on the output
 * side and differ on the primary by how many switches are in series and what
 * the idle one stands off.
 */
export function pushPullFamily(kind, params = {}) {
  const p = { ...FORWARD_DEFAULTS, ...params }
  const { Vin, L, C, R, n, Lm, Ron, Vf, rd, RL, ESR, mismatch } = p
  const alpha = R / (R + ESR)
  const T = 1 / p.fs
  // A full bridge puts two switches in series with the primary each half
  // cycle; a push-pull, one. The mismatch is the second half's excess.
  const perHalf = kind === 'fullbridge' ? 2 : 1
  const Ron1 = perHalf * Ron
  const Ron2 = perHalf * Ron * (1 + mismatch)
  const geom = { Vin, L, C, R, n, Lm, alpha, ESR, RL, rd, Vf }
  const { free, dead, out } = filterStates({ L, C, R, alpha, ESR, RL, rd, Vf })
  const q1 = drivenState('Q1 on', 1, Ron1, geom, out)
  const q2 = drivenState('Q2 on', -1, Ron2, geom, out)
  const freewheel = { ...free, name: 'freewheel' }
  const idle = { ...dead, name: 'dead', project: pinZero(3, 0) }
  const states = { 'Q1 on': q1, 'Q2 on': q2, freewheel, dead: idle }
  nameStates(states)
  const pick = (x) => (x[0] > 0 ? 'freewheel' : 'dead')
  const guard = (x, name) => (name === 'freewheel' ? x[0] : Infinity)
  const tOn = p.D * T
  const half = T / 2
  const gap = half - tOn
  return {
    kind,
    p,
    T,
    tOn,
    alpha,
    n,
    order: 3,
    states,
    signals: [...SIGNALS, 'iM'],
    hasDead: true,
    inverted: false,
    isolated: true,
    windows: [
      { T: tOn, pick: () => 'Q1 on', guard: () => Infinity },
      { T: gap, pick, guard },
      { T: tOn, pick: () => 'Q2 on', guard: () => Infinity },
      { T: gap, pick, guard },
    ],
    // With no resistance in either half the magnetising current has no
    // preferred offset: the period map leaves it wherever it started, and
    // the solver pins it at zero rather than dividing by nothing.
    driftFree: Ron1 + Ron2 === 0,
    pinned: Ron1 + Ron2 === 0 ? [2] : [],
    Ron1,
    Ron2,
    maxDuty: 0.5,
    resets: p.D < 0.5,
    switching: { D: p.D, fs: p.fs, T, n },
    stress: kind === 'fullbridge' ? Vin : 2 * Vin,
    blocking: () => (kind === 'fullbridge' ? Vin : 2 * Vin),
    idealM: (D = p.D) => forwardM(kind, D, n),
  }
}

export const pushPull = (params = {}) => pushPullFamily('pushpull', params)
export const fullBridge = (params = {}) => pushPullFamily('fullbridge', params)

/** The three by name, beside `isolated`'s two. */
export function forwardFamily(kind, params = {}) {
  if (kind === 'forward') return forward(params)
  if (kind === 'pushpull' || kind === 'fullbridge') return pushPullFamily(kind, params)
  throw new Error(`unknown forward converter "${kind}"`)
}

// --------------------------------------------- the clock with events in it
//
// `steady.js` solves the converter whose pattern the clock fixes entirely,
// and `events.js` the circuit whose topology its own state chooses. A
// forward converter is both at once. The clock says when the switch is on,
// and inside the interval that follows, the state says whether the core is
// still resetting and whether the output inductor still carries current.
//
// So the period is a list of windows the clock cuts, and inside each window
// the walk is `events.js`'s: propagate until `pick` names a different
// topology, find that instant on the exact solution, switch, continue. A
// window whose `pick` is constant costs one segment and no search, which is
// what the driven intervals are.
//
// Periodicity is then a fixed point of the period map. With the durations
// held at what the walk found, one period is affine — the projections that
// pin a blocked current at exactly zero are linear, so they multiply into
// the same product — and x(0) is the solution of (I − Φ)x = d, as in CCM.
// Re-walking moves the durations, and the two converge together. The whole
// map is rebuilt each pass, so the iteration is a shooting method whose
// Jacobian is the circuit's own.

/**
 * A scale for each state component, from the waveform the walk just drew.
 *
 * Read at the segment boundaries alone it would be wrong for exactly the
 * waveform this solver exists for: a resonant tank's current is zero at every
 * boundary and a sine in between, so the boundaries would say the current is
 * nothing. Each segment is sampled across as well.
 */
function scalesOf(segs, n) {
  const sc = new Array(n).fill(0)
  for (const s of segs) {
    for (const x of s.T > 0 ? sample(s, 4) : [s.x0]) {
      for (let i = 0; i < n; i++) sc[i] = Math.max(sc[i], Math.abs(x[i]))
    }
  }
  const big = Math.max(1e-30, ...sc)
  for (let i = 0; i < n; i++) sc[i] = Math.max(sc[i], 1e-9 * big)
  return sc
}

/** The largest component of a residual, each against its own scale. */
const residual = (r, sc) => Math.max(...r.map((v, i) => Math.abs(v) / sc[i]))

/** One window of the clock, walked with its own topology rule. */
function walkWindow(conv, win, x0, base, { scan = 96, tol = 1e-13, maxSegments = 24 } = {}) {
  const segs = []
  let t = 0
  let x = x0
  let name = win.pick(x)
  while (t < win.T) {
    const state = conv.states[name]
    if (state.project) x = matVec(state.project, x)
    const remain = win.T - t
    const seg = { name, state, A: state.A, f: state.f, x0: x, T: remain, t0: base + t, P: state.project || null }
    const m = Math.max(8, Math.ceil((scan * remain) / win.T))
    const pts = sample(seg, m)
    const dt = remain / m
    let k = 1
    while (k <= m && win.pick(pts[k]) === name) k++
    if (k > m) {
      segs.push(seg)
      x = pts[m]
      t = win.T
      break
    }
    const lo = (k - 1) * dt
    const hi = k * dt
    const margin = (tau) => win.guard(stateAt(seg, tau), name)
    const rlo = margin(lo)
    const rhi = margin(hi)
    // The guard is a signed margin, so the instant is a root wherever it
    // brackets one. Where it does not — a scan point sitting on the event
    // itself — `pick`, which named this segment, is bisected instead.
    let root = null
    if (rlo > 0 && rhi < 0) root = illinois(margin, lo, hi, tol * win.T, { rlo, rhi })
    if (root === null) {
      let a = lo
      let b = hi
      while (b - a > tol * win.T) {
        const mid = (a + b) / 2
        if (win.pick(stateAt(seg, mid)) === name) a = mid
        else b = mid
      }
      root = b
    }
    seg.T = root
    segs.push(seg)
    x = stateAt(seg, root)
    t += root
    // Which topology holds after the event. The scan point past it is the
    // default, and a model that knows what its own event means says so
    // through `next`: the current that just reached zero is zero, not the
    // small negative number an extrapolation through the stopped device
    // gives, and below resonance the two answers name different states.
    name = (win.next && win.next(x, name)) || win.pick(pts[k])
    if (segs.length > maxSegments) throw new Error(`more than ${maxSegments} topology changes in one window: the model chatters`)
  }
  return { segs, x }
}

/** One period, window by window. */
export function walkWindows(conv, x0, opts) {
  const segs = []
  let x = x0
  let base = 0
  for (const win of conv.windows) {
    if (win.T > 0) {
      const r = walkWindow(conv, win, x, base, opts)
      segs.push(...r.segs)
      x = r.x
    }
    base += win.T
  }
  return { segs, xEnd: x }
}

/**
 * The periodic steady state of a clocked converter with state events in it.
 *
 * `pinned` names the state components a converter has no fixed point for —
 * the ideal push-pull's magnetising current — and they are held at zero
 * rather than solved for, because the map leaves them wherever they started.
 */
export function windowedSteadyState(conv, { iters = 80, tol = 1e-13, ...opts } = {}) {
  const n = conv.order
  const pinned = conv.pinned || []
  const shoot = (pinValues, start) => {
    // The residual whose root is the periodic state: what one period does to
    // x, less x. A pinned component's residual is its distance from the value
    // it is held at, because the period map leaves it alone and would make
    // the Jacobian singular in that direction.
    const evalAt = (x) => {
      const w = walkWindows(conv, x, opts)
      const r = w.xEnd.map((v, i) => v - x[i])
      for (const i of pinned) r[i] = pinValues[i] - x[i]
      return { w, r }
    }
    let x0 = [...start]
    for (const i of pinned) x0[i] = pinValues[i]
    let cur = evalAt(x0)
    let converged = false
    let passes = 0
    let stalls = 0
    for (let k = 1; k <= iters; k++) {
      passes = k
      const sc = scalesOf(cur.w.segs, n)
      const err = residual(cur.r, sc)
      if (err < tol) {
        converged = true
        break
      }
      // The affine map with the durations frozen is the Jacobian for
      // everything except the events, and for a tank with no resistance in
      // it the events are the whole of the damping — an undamped LC's frozen
      // map is a rotation, and (I − Φ) has nothing to solve with. So the
      // Jacobian is taken by difference on the walk itself, which carries
      // the event motion with it.
      const J = Array.from({ length: n }, () => new Array(n).fill(0))
      const b = cur.r.map((v) => -v)
      for (let j = 0; j < n; j++) {
        const h = 1e-7 * sc[j]
        const y = [...x0]
        y[j] += h
        const rj = evalAt(y).r
        for (let i = 0; i < n; i++) J[i][j] = (rj[i] - cur.r[i]) / h
      }
      // A component the period map cannot see at all — a tank current the
      // blocked rectifier pins at zero for the whole period — leaves an empty
      // column, and there is nothing to solve for it. Its own answer is zero,
      // so that is what the step is told to give it.
      const big = Math.max(1e-30, ...J.flat().map(Math.abs))
      for (let j = 0; j < n; j++) {
        let col = 0
        for (let i = 0; i < n; i++) col = Math.max(col, Math.abs(J[i][j]))
        if (col > 1e-12 * big) continue
        for (let i = 0; i < n; i++) J[j][i] = 0
        J[j][j] = 1
        b[j] = -x0[j]
      }
      let step
      try {
        step = solve(J, b)
      } catch {
        break
      }
      // A trust region on the step, in each component's own units: a Newton
      // step twenty times the waveform's own size is the linear model being
      // believed a long way outside where it holds.
      const reach = Math.max(...step.map((v, i) => Math.abs(v) / sc[i]))
      if (reach > 20) for (let i = 0; i < n; i++) step[i] *= 20 / reach
      // The whole step first, halved while it makes the residual worse. The
      // best of the tries is kept even when none improves, because the
      // shortest of them is still the closest to the linear model.
      let lam = 1
      let taken = null
      let bestErr = Infinity
      for (let t = 0; t < 7; t++) {
        const y = x0.map((v, i) => v + lam * step[i])
        const trial = evalAt(y)
        const e2 = residual(trial.r, scalesOf(trial.w.segs, n))
        if (e2 < bestErr) {
          bestErr = e2
          taken = { x: y, cur: trial }
        }
        if (e2 < err) break
        lam /= 2
      }
      if (bestErr >= err) stalls++
      if (stalls > 6) break
      x0 = taken.x
      cur = taken.cur
    }
    return { x0, walk: cur.w, converged, passes }
  }
  const pinValues = new Array(n).fill(0)
  // Two starting points, tried in order: what the converter says it expects,
  // and rest. A guess that puts the output above what the circuit can reach
  // leaves every device blocking, and from there the period map cannot see
  // the tank at all — so rest, where everything conducts, is the fallback.
  const starts = [conv.guess ? conv.guess() : new Array(n).fill(0)]
  if (conv.guess) starts.push(new Array(n).fill(0))
  let run = shoot(pinValues, starts[0])
  for (let s = 1; s < starts.length && !run.converged; s++) run = shoot(pinValues, starts[s])
  if (!run.converged) {
    // Newton can circle a point without settling on it when a segment
    // appears and disappears under the perturbation the Jacobian is taken
    // with. Running the circuit forward has no such trouble — it is the
    // converter itself, and it is unconditionally stable — so a few hundred
    // periods of it give Newton a point to finish from.
    let x = run.x0
    for (let k = 0; k < 2500; k++) x = walkWindows(conv, x, opts).xEnd
    const again = shoot(pinValues, x)
    if (again.converged) run = again
  }
  if (pinned.length) {
    // A pinned component is one the period map leaves where it started, and
    // it is decoupled from the rest (that is why the map leaves it). So the
    // whole waveform shifts rigidly with the pin, and the offset that puts
    // its period mean at zero — the core with no DC flux in it, which is the
    // state a symmetric converter is built for — is one correction, exactly.
    const T = conv.T
    for (const i of pinned) {
      let acc = 0
      for (const seg of run.walk.segs) if (seg.T > 0) acc += segmentIntegral(seg)[i]
      pinValues[i] -= acc / T
    }
    run = shoot(pinValues, run.x0)
  }
  const walk = run.walk
  const { converged, passes } = run
  // A segment of no duration is an artefact of a state entered exactly on
  // its own boundary, and it carries the state across unchanged. Dropping it
  // keeps the scrub's list of intervals to the ones a reader can scrub to.
  const segments = walk.segs.filter((s) => s.T > 1e-12 * conv.T)
  const live = segments
  const dry = live.find((s) => s.name === 'dead' || s.name === 'reset dry' || s.name.endsWith('idle'))
  return {
    mode: dry ? 'DCM' : 'CCM',
    conv,
    T: conv.T,
    tOn: conv.tOn,
    tOff: conv.T - conv.tOn,
    // The instant the output inductor's current reaches zero, which in
    // continuous conduction never arrives and is the interval's own end.
    td: dry ? dry.t0 - conv.tOn : conv.T - conv.tOn,
    x0: segments.length ? segments[0].x0 : x0,
    segments,
    converged,
    passes,
    walkEnd: walk.xEnd,
  }
}

/** Average, RMS and extremes of one signal on a solved waveform. */
function statOf(ss, name, dense = 256) {
  const live = ss.segments.filter((s) => s.T > 0)
  let min = Infinity
  let max = -Infinity
  let ms = 0
  for (const seg of live) {
    for (const x of sample(seg, dense)) {
      const y = evalSignal(seg.state, name, x)
      if (y < min) min = y
      if (y > max) max = y
    }
    ms += quadrature(seg, (x) => evalSignal(seg.state, name, x) ** 2)
  }
  return { avg: average(ss, name), rms: Math.sqrt(Math.max(0, ms / ss.T)), min, max, pp: max - min }
}

/**
 * `measures` with the forward family's two corrections: the magnetising
 * current is measured (it is a state here, not a passenger), and the switch
 * conduction loss is charged at each half's own resistance, so a mismatched
 * push-pull's books still close.
 */
export function forwardMeasures(ss) {
  const m = measures(ss)
  const conv = ss.conv
  m.sig.iM = statOf(ss, 'iM')
  m.iMdc = m.sig.iM.avg
  if (conv.kind !== 'forward') {
    let acc = 0
    for (const seg of ss.segments) {
      if (seg.T <= 0) continue
      const ron = seg.name === 'Q1 on' ? conv.Ron1 : seg.name === 'Q2 on' ? conv.Ron2 : 0
      if (!ron) continue
      acc += ron * quadrature(seg, (x) => evalSignal(seg.state, 'iQ', x) ** 2)
    }
    m.loss.switch = acc / ss.T
    m.Pcond = m.loss.switch + m.loss.diode + m.loss.inductor + m.loss.esr
    m.Ploss = m.Pcond + m.loss.switching
    m.balance = m.Pin - m.Pout - m.Pcond
    m.eta = m.Pout / (m.Pin + m.loss.switching)
    m.fluxWalk = fluxWalk({ n: conv.n, Iout: m.Iout, Ron1: conv.Ron1, Ron2: conv.Ron2 })
  }
  return m
}
