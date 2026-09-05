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
//
// ------------------------------------------------- the half-bridge's siblings
//
// Three more converters put a transformer between the switch and the filter,
// and all three hand the output inductor the same shape: a pulse of amplitude
// n·V_in for part of the cycle, a freewheel through the rectifier for the
// rest. So all three are the half-bridge's output side with one number
// changed, and `pulseConverter` below builds every one of them, the
// half-bridge included. What separates them is on the primary:
//
//   forward     one switch, one winding, and a reset winding that takes the
//               magnetising volt-seconds back. The pulse runs once a period,
//               so M = n·D, and the reset needs D < N_p/(N_p + N_r). The
//               switch stands off V_in(1 + N_p/N_r), twice the rail at
//               N_r = N_p.
//   push-pull   two switches into a centre-tapped primary, one per half
//               period, so the pulse runs twice and M = 2·n·D. Each switch
//               stands off 2·V_in, because the other half of the primary
//               reflects the rail onto it.
//   full bridge four switches swinging the whole primary, the same M = 2·n·D
//               at a switch stress of V_in. Two switches conduct at once, so
//               the primary carries twice the on-resistance.
//
// The magnetising current is a branch of its own in all three, and it is
// where they differ from an ideal transformer. The forward's is drawn: it
// ramps up on V_in, comes back down on V_in·N_p/N_r, and reaches zero before
// the period ends or the core keeps what is left. The push-pull's is the
// hazard: two halves that are not identical leave a volt-second remainder
// every cycle, and the magnetising current walks until the same asymmetry
// that moved it balances it. `fluxWalk` solves that as the three-state
// circuit it is, with the magnetising current beside the output.

import { DEFAULTS } from './topologies.js'
import { steadyState, measures } from './steady.js'
import { chainPlan, clockedSteadyState } from './clocked.js'

export const ISOLATED_KINDS = ['flyback', 'halfbridge', 'forward', 'pushpull', 'fullbridge']

export const ISOLATED_DEFAULTS = {
  ...DEFAULTS,
  n: 0.5, // turns ratio N_s/N_p
  nr: 1, // reset winding, N_r/N_p (the forward)
  Lm: 2e-3, // magnetising inductance, referred to the primary
  Ron2: null, // the second switch's on-resistance, where it differs (push-pull)
}

const lin = (c1, c2, d = 0) => ({ c: [c1, c2], d })

/**
 * The conversion ratio each isolated converter's volt-second balance gives.
 *
 * The flyback stores and releases, so its duty appears twice. The other four
 * pass a pulse straight to an output inductor, and the ratio is the turns
 * ratio times the share of the period that pulse is present: once a period
 * for the forward and the half-bridge, twice for the two that swing the
 * primary both ways.
 */
export const ISOLATED_PULSES = { flyback: 0, halfbridge: 1, forward: 1, pushpull: 2, fullbridge: 2 }

export function isolatedM(kind, D, n) {
  if (kind === 'flyback') return (n * D) / (1 - D)
  return (ISOLATED_PULSES[kind] || 1) * n * D
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

/**
 * The output side every pulse-fed isolated converter shares.
 *
 * A pulse of `vpulse` volts reaches the output inductor for `Deff` of each
 * solved period, and the rectifier freewheels for the rest. The primary's
 * on-resistance reaches the output side multiplied by the square of the turns
 * ratio and by however many switches carry the current, which is the one line
 * that separates the full bridge from the push-pull.
 *
 * `spec` names what differs between the four:
 *   vpulse   the secondary pulse's amplitude, before the rectifier's drop
 *   Deff     the duty of that pulse within the solved period
 *   T        the solved period, half a switching period for a converter that
 *            swings the primary both ways
 *   switches how many switches the primary current runs through
 *   iinScale the rail current per amp of output inductor current, so V_in
 *            times its average is the power the source delivers
 *   onName   what the conduction scrub calls the pulse interval
 */
function pulseConverter(kind, p, spec) {
  const { Vin, L, C, R, n, Ron, Vf, rd, RL, ESR } = p
  const alpha = R / (R + ESR)
  const { vpulse, Deff, T, switches, iinScale, onName, blocking } = spec
  const zero = lin(0, 0)
  const iL = lin(1, 0)
  const outFed = { vout: lin(alpha * ESR, alpha), iC: lin(alpha, -alpha / R) }

  // The secondary pulse, less the reflected switch drop (the primary carries
  // n·i_L through `switches` of them), the rectifier drop and the winding.
  const rOn = switches * n * n * Ron + rd + RL + alpha * ESR
  const on = {
    name: onName,
    A: [
      [-rOn / L, -alpha / L],
      [alpha / C, -alpha / (R * C)],
    ],
    f: [(vpulse - Vf) / L, 0],
    signals: {
      ...outFed,
      vsw: lin(-(switches * n * n * Ron + rd), 0, vpulse - Vf),
      vL: lin(-rOn, -alpha, vpulse - Vf),
      iQ: lin(n, 0),
      iD: iL,
      // The current the rail supplies, as the equivalent DC draw.
      iin: lin(iinScale, 0),
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
  const headroom = vpulse - Vf
  return {
    kind,
    headroom,
    deliverable: headroom > 0,
    // The solver reads D, fs and R_on off p, so they carry the solved
    // period's values: the duty within it, its rate, and the resistance the
    // primary current runs through in total (two switches for a full
    // bridge). `switching` keeps the numbers the reader set.
    p: { ...p, D: Deff, fs: 1 / T, Ron: switches * Ron },
    switching: { D: p.D, fs: p.fs, T: 1 / p.fs, n, Ron, switches },
    T,
    alpha,
    n,
    vpulse,
    switches,
    states: { on, off, dead },
    hasDead: true,
    inverted: false,
    isolated: true,
    blocking,
    idealM: (D = p.D) => isolatedM(kind, D, n),
  }
}

export function halfBridge(params = {}) {
  const p = { ...ISOLATED_DEFAULTS, ...params }
  // Solved over a half switching period at twice the duty: the output side
  // repeats every half period, and D is each switch's share of the whole.
  return pulseConverter('halfbridge', p, {
    vpulse: (p.n * p.Vin) / 2,
    Deff: Math.min(0.999999, 2 * p.D),
    T: 1 / (2 * p.fs),
    switches: 1,
    // The primary carries n·i_L against V_in/2, which is (n/2)·i_L against V_in.
    iinScale: p.n / 2,
    onName: 'Q1 on',
    // Each switch stands off the whole rail while the other conducts.
    blocking: () => p.Vin,
  })
}

/**
 * The forward converter: a buck through a transformer.
 *
 * One switch puts V_in across the primary for D of each period and the
 * secondary hands n·V_in to the output inductor, so the output side is a buck
 * fed from n·V_in and M = n·D. The pulse runs once a period, which is what
 * separates it from the push-pull below.
 *
 * The magnetising current is what the transformer keeps, and the reset
 * winding is how it gives it back. `forwardReset` measures that branch.
 */
export function forward(params = {}) {
  const p = { ...ISOLATED_DEFAULTS, ...params }
  const nr = p.nr > 0 ? p.nr : 1
  const conv = pulseConverter('forward', p, {
    vpulse: p.n * p.Vin,
    Deff: p.D,
    T: 1 / p.fs,
    switches: 1,
    // The primary carries n·i_L against the whole rail.
    iinScale: p.n,
    onName: 'on',
    // The reset winding reflects V_in·N_p/N_r onto the switch, on top of the rail.
    blocking: () => p.Vin * (1 + 1 / nr),
  })
  conv.nr = nr
  // The reset winding stands at V_in·N_p/N_r, so it takes N_r/N_p as long as
  // the on interval did, and the two together have to fit inside the period.
  conv.Dmax = 1 / (1 + nr)
  conv.resetDuty = p.D * nr
  conv.resets = p.D * (1 + nr) <= 1
  return conv
}

/**
 * The push-pull: two switches into a centre-tapped primary, one per half
 * period. The output side sees the same pulse twice a period, so it is solved
 * over a half period at a duty of 2·D and M = 2·n·D. Each switch stands off
 * twice the rail, because the half of the primary it is not driving reflects
 * V_in back onto it.
 */
export function pushPull(params = {}) {
  const p = { ...ISOLATED_DEFAULTS, ...params }
  const conv = pulseConverter('pushpull', p, {
    vpulse: p.n * p.Vin,
    Deff: Math.min(0.999999, 2 * p.D),
    T: 1 / (2 * p.fs),
    switches: 1,
    iinScale: p.n,
    onName: 'Q1 on',
    blocking: () => 2 * p.Vin,
  })
  conv.Dmax = 0.5
  return conv
}

/**
 * The full bridge: four switches swinging the whole primary. The same
 * M = 2·n·D as the push-pull at a switch stress of V_in rather than 2·V_in,
 * bought with two more switches and two of them in the current's path.
 */
export function fullBridge(params = {}) {
  const p = { ...ISOLATED_DEFAULTS, ...params }
  const conv = pulseConverter('fullbridge', p, {
    vpulse: p.n * p.Vin,
    Deff: Math.min(0.999999, 2 * p.D),
    T: 1 / (2 * p.fs),
    // A diagonal pair conducts, so the primary current runs through two.
    switches: 2,
    iinScale: p.n,
    onName: 'Q1 on',
    blocking: () => p.Vin,
  })
  conv.Dmax = 0.5
  return conv
}

/**
 * What the family costs, per converter: how many switches it needs, what each
 * one stands off as a multiple of the rail, how many of them the current runs
 * through, and how much of the rail the primary swings.
 *
 * `swing` is the primary's peak-to-peak excursion over V_in, which is the
 * number the transformer is sized against. The forward drives the core one
 * way only, the half-bridge halves the voltage it drives it with, and the
 * two full-swing converters use the rail twice over.
 */
export const ISOLATED_FAMILY = {
  forward: { switches: 1, inPath: 1, stress: 2, swing: 1, quadrants: 1, rectifiers: 2 },
  halfbridge: { switches: 2, inPath: 1, stress: 1, swing: 1, quadrants: 2, rectifiers: 2 },
  pushpull: { switches: 2, inPath: 1, stress: 2, swing: 2, quadrants: 2, rectifiers: 2 },
  fullbridge: { switches: 4, inPath: 2, stress: 1, swing: 2, quadrants: 2, rectifiers: 2 },
}

/** The family row for a kind, in the volts and amps this rail and turns ratio put on it. */
export function isolatedStress(kind, { Vin, n, D }) {
  const f = ISOLATED_FAMILY[kind]
  if (!f) throw new Error(`no family row for "${kind}"`)
  return {
    ...f,
    blocking: f.stress * Vin,
    swingVolts: f.swing * Vin,
    pulse: n * Vin * (kind === 'halfbridge' ? 0.5 : 1),
    M: isolatedM(kind, D, n),
    // The volt-amps the switches stand off in total, per volt the rail
    // carries: the figure the three are compared on.
    switchVA: f.switches * f.stress,
  }
}

/**
 * The forward's magnetising branch, measured on the converter that was solved.
 *
 * The branch is a single inductance across the primary, so it is a one-state
 * circuit driven by the primary voltage: +v_on while the switch conducts,
 * −v_on·N_p/N_r while the reset winding conducts, and nothing once the
 * current has reached zero. Its own volt-second balance is what fixes the
 * reset interval at D·T·N_p/N_r, and its peak is what the core has to hold.
 *
 * The drive is the primary voltage's exact average over each interval, so the
 * volt-seconds, the reset interval and the peak are exact. What it does not
 * carry is the ripple the switch's own resistance puts on that voltage within
 * the interval. `wobble` is how large that is against the rail, and it is
 * zero whenever R_on is.
 */
export function forwardReset(conv, { IL = 0 } = {}) {
  const p = conv.p
  const { Vin, Ron, n, Lm, D } = p
  const nr = conv.nr
  const T = conv.T
  const tOn = D * T
  // The primary voltage while the switch conducts: the rail, less the drop
  // the reflected load current makes across the switch.
  const vOn = Vin - Ron * n * IL
  const vReset = -vOn / nr
  const tReset = Math.min(T - tOn, (tOn * vOn) / -vReset)
  const ipk = (vOn * tOn) / Lm
  const tIdle = Math.max(0, T - tOn - tReset)
  // A triangle that rises for tOn, falls for tReset and sits at zero for the
  // rest: its average and its RMS are exact, because the ramps are straight.
  const avg = (ipk * (tOn + tReset)) / (2 * T)
  const rms = Math.sqrt((ipk * ipk * (tOn + tReset)) / (3 * T))
  return {
    vOn,
    vReset,
    tOn,
    tReset,
    tIdle,
    ipk,
    avg,
    rms,
    // ∫v dt each way: equal and opposite, which is the branch's own balance.
    vsOn: vOn * tOn,
    vsReset: vReset * tReset,
    resets: conv.resets,
    Dmax: conv.Dmax,
    blocking: Vin * (1 + 1 / nr),
    wobble: (Ron * n * IL) / Math.max(1e-30, Vin),
    /** The current at an instant inside the period, on the branch's own ramp. */
    at: (t) => {
      const tau = ((t % T) + T) % T
      if (tau <= tOn) return (vOn * tau) / Lm
      if (tau <= tOn + tReset) return ipk + (vReset * (tau - tOn)) / Lm
      return 0
    },
  }
}

/**
 * The push-pull with two on-resistances that are not the same, solved as the
 * three-state circuit it is: [i_L, v_C, i_M], over a whole switching period.
 *
 * The magnetising current is referred to the primary and counted in the first
 * half's sense. Half A puts V_in − R_A(n·i_L + i_M) across the primary and
 * half B puts −(V_in − R_B(n·i_L − i_M)), so their volt-seconds cancel only
 * when
 *
 *     (R_B − R_A)·n·I_out = (R_A + R_B)·i_M
 *
 * and until they do, the magnetising current walks. So it is a fixed point
 * rather than a runaway, and the resistance that started the walk is what
 * ends it. With both resistances zero there is nothing to end it, and
 * `settles` says so rather than the solve dividing by zero.
 */
export function fluxWalk(params = {}, { periods = 400 } = {}) {
  const p = { ...ISOLATED_DEFAULTS, ...params }
  const { Vin, L, C, R, n, Vf, rd, RL, ESR, Lm, D } = p
  const Ron = p.Ron
  const Ron2 = p.Ron2 === null || p.Ron2 === undefined ? Ron : p.Ron2
  const alpha = R / (R + ESR)
  const T = 1 / p.fs
  const rFixed = rd + RL + alpha * ESR
  // One half's on interval with its own switch resistance. `s` is +1 for the
  // half the magnetising current is counted in and −1 for the other.
  const onHalf = (Rk, s) => ({
    name: s > 0 ? 'Q1 on' : 'Q2 on',
    A: [
      [-(n * n * Rk + rFixed) / L, -alpha / L, (-s * n * Rk) / L],
      [alpha / C, -alpha / (R * C), 0],
      [(-s * n * Rk) / Lm, 0, -Rk / Lm],
    ],
    f: [(n * Vin - Vf) / L, 0, (s * Vin) / Lm],
  })
  // Neither switch on: the primary is open, so the magnetising current is
  // held where it is and the output inductor freewheels.
  const free = {
    name: 'freewheel',
    A: [
      [-rFixed / L, -alpha / L, 0],
      [alpha / C, -alpha / (R * C), 0],
      [0, 0, 0],
    ],
    f: [-Vf / L, 0, 0],
  }
  const tOn = D * T
  const tFree = T / 2 - tOn
  const planFor = (RA, RB) => [
    { state: onHalf(RA, 1), T: tOn },
    { state: free, T: tFree },
    { state: onHalf(RB, -1), T: tOn },
    { state: free, T: tFree },
  ]
  const plan = planFor(Ron, Ron2)
  const mean = (Ron + Ron2) / 2
  const balanced = Ron + Ron2 <= 0
  // Where the walk starts: the periodic orbit of the converter whose halves
  // do match, which is the same circuit with the mean resistance in both. Its
  // magnetising current already swings about zero, so what the mismatched
  // plan does to it over one period is the remainder and nothing else. An
  // empty core is the wrong place to start from: i_M ramps up and back down
  // within every period, so a walk begun at zero is half a ripple off centre
  // and reads that offset as drift.
  const sym = steadyState(pushPull({ ...p, Ron: mean }))
  const msym = measures(sym)
  const base = balanced
    ? // With no resistance anywhere there is no orbit to solve for, so the
      // ramp is centred by hand: it rises V_in·t_on/L_m over the first half.
      [sym.x0[0], sym.x0[1], -(Vin * tOn) / (2 * Lm)]
    : clockedSteadyState(planFor(mean, mean), 3).x0
  const first = chainPlan(plan, base).xEnd
  const perCycle = first[2] - base[2]
  const trace = [{ k: 0, iM: 0 }]
  let x = base
  for (let k = 1; k <= periods; k++) {
    x = chainPlan(plan, x).xEnd
    trace.push({ k, iM: x[2] - base[2] })
  }
  // The fixed point from the period map itself, and the algebra's answer to
  // hold it against.
  const fixed = balanced ? null : clockedSteadyState(plan, 3)
  const Iout = msym.Iout
  return {
    plan,
    T,
    tOn,
    perCycle,
    trace,
    base,
    balanced,
    settles: !balanced,
    Ron,
    Ron2,
    offsetSolved: fixed ? fixed.x0[2] - base[2] : Infinity,
    offsetForm: balanced ? Infinity : ((Ron2 - Ron) * n * Iout) / (Ron + Ron2),
    driftForm: (tOn * (Ron2 - Ron) * n * Iout) / Lm,
    // What the output side does while the flux walks: the balanced solve's
    // ratio, for the claim that the mismatch moves the one and not the other.
    Mbalanced: msym.M,
    Iout,
    // How many periods the magnetising current takes to reach the reflected
    // load current, where the transformer carries as much of its own current
    // as the load's.
    cyclesToParity: Math.abs(perCycle) > 0 ? (n * Iout) / Math.abs(perCycle) : Infinity,
  }
}

const BUILDERS = { flyback, halfbridge: halfBridge, forward, pushpull: pushPull, fullbridge: fullBridge }

export function isolated(kind, params = {}) {
  const build = BUILDERS[kind]
  if (!build) throw new Error(`unknown isolated converter "${kind}"`)
  return build(params)
}
