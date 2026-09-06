import { describe, it, expect } from 'vitest'
import { conversionRatio, ratioWithRL, dcmRatio, K } from '@ee-labs/switched'
import { EXPERIMENTS, defaultsOf } from './experiments.js'
import { analyse, buckParams } from './analysis.js'
import { signalsOf, topologyOf } from './components/schematics.jsx'
import { ORDER } from './components/panes.jsx'

// Every number the measures table shows — average, RMS, min, max and
// peak-to-peak of every signal, for every experiment at its defaults — is
// either pinned here against a closed form, or named in `unpinned` with the
// reason it has none. A cell that is neither fails the test, so the table
// can never again show more than the tests read.
//
// Pins are [value, absolute tolerance] or { lo, hi } bounds. Exact relations
// (KVL and KCL averages, a signal that is another signal, an extreme at a
// switching instant) are held to 1e-9 of their scale; textbook small-ripple
// forms to 0.1 %, the precision the notes claim for them; a form that only
// holds to first order in the ripple, to the ripple itself.

const STATS = ['avg', 'rms', 'min', 'max', 'pp']
const ex = (v, scale = Math.max(1, Math.abs(v))) => [v, 1e-9 * scale]
const ap = (v, rel = 1e-3, scale = Math.abs(v)) => [v, rel * scale]
const zero = (scale) => [0, 1e-9 * scale]
// The line-side extremes are read off the sampled trace, not the solution:
// two signals that are equal in the solution can differ by a grid step.
const exs = (v, scale = Math.abs(v)) => [v, 2e-5 * scale]
const RIPPLE = 'the ripple is not symmetric about the average — where the mean is crossed depends on the whole period; pp is pinned and min < avg < max is checked'

/** Pin all five stats of `k` to those of `j` (the same current in another branch). */
function same(pins, k, j, sig, sign = 1) {
  for (const s of STATS) {
    if (sign === 1) pins[`${k}.${s}`] = ex(sig[j][s], Math.max(1, Math.abs(sig[j].max)))
    else {
      // The negative of a signal swaps its extremes.
      const map = { avg: -sig[j].avg, rms: sig[j].rms, min: -sig[j].max, max: -sig[j].min, pp: sig[j].pp }
      pins[`${k}.${s}`] = ex(map[s], Math.max(1, Math.abs(sig[j].max)))
    }
  }
}

/** Pin a signal that is `factor` × another (a resistor's current from its voltage). */
function scaled(pins, k, j, factor, sig) {
  for (const s of STATS) pins[`${k}.${s}`] = ex(sig[j][s] * factor, Math.max(1, Math.abs(sig[j].max * factor)))
}

/** A DC signal: every stat is the value, pp is zero. */
function dc(pins, k, v) {
  for (const s of STATS) pins[`${k}.${s}`] = s === 'pp' ? zero(Math.abs(v)) : ex(v)
}

// ---------------------------------------------------------------- Group A

function linreg(x, p) {
  const pins = {}
  const Io = p.Vo / p.R
  dc(pins, 'vsw', p.Vin)
  dc(pins, 'vout', p.Vo)
  dc(pins, 'iL', Io)
  dc(pins, 'iQ', Io)
  dc(pins, 'iin', Io)
  return { pins, unpinned: {} }
}

function chopper(x, p) {
  const pins = {}
  const { Vin, D, R } = p
  pins['vout.avg'] = ex(D * Vin)
  pins['vout.rms'] = ex(Math.sqrt(D) * Vin)
  pins['vout.min'] = zero(Vin)
  pins['vout.max'] = ex(Vin)
  pins['vout.pp'] = ex(Vin)
  scaled(pins, 'iR', 'vout', 1 / R, x.m.sig)
  return { pins, unpinned: {} }
}

// ---------------------------------------------------------------- PWM family

// Buck in continuous conduction, with any of the conduction losses on. The
// freewheel path is the diode's (V_f and r_d) or the synchronous switch's
// (R_on and no offset), and the difference runs through every row.
function buckCCM(x, p) {
  const { sig } = x.m
  const { Vin, D, L, C, fs, R, Ron, RL, ESR } = p
  const fwR = p.sync ? Ron : p.rd
  const Vf = p.sync ? 0 : p.Vf
  const rd = fwR
  const pins = {}
  const unpinned = {}
  // KVL and KCL averages, exact with the measured branch averages: the
  // switch node is Vin − Ron·iL while on and −Vf − rd·iL while off, the
  // inductor's average voltage is zero, the capacitor's average current is.
  const vswAvg = D * Vin - Ron * sig.iQ.avg - (1 - D) * Vf - rd * sig.iD.avg
  const Vo = vswAvg - RL * sig.iL.avg
  const Io = Vo / R
  pins['vsw.avg'] = ex(vswAvg)
  pins['vsw.max'] = ex(Vin - Ron * sig.iL.min)
  pins['vsw.min'] = ex(-Vf - rd * sig.iL.max, Vin)
  pins['vsw.pp'] = ex(pins['vsw.max'][0] - pins['vsw.min'][0])
  pins['vout.avg'] = ex(Vo)
  pins['vL.avg'] = zero(Vin)
  pins['iL.avg'] = ex(Io)
  pins['iC.avg'] = zero(Io)
  // The switch current is the inductor's while the switch is on and zero for
  // the rest, so its extremes are the inductor's and zero. A synchronous
  // converter's current goes negative at light load, and then zero is the
  // top rather than the bottom.
  const lo = Math.min(0, sig.iL.min)
  const hi = Math.max(0, sig.iL.max)
  for (const k of ['iD', 'iQ']) {
    pins[`${k}.min`] = ex(lo, Math.max(1, Math.abs(hi)))
    pins[`${k}.max`] = ex(hi)
    pins[`${k}.pp`] = ex(hi - lo)
  }
  same(pins, 'iin', 'iQ', sig)
  // Small-ripple forms, to 0.1 %.
  const di = ((Vo + Vf + rd * Io + RL * Io) * (1 - D)) / (L * fs) // off-interval slope × time
  // The capacitor's own integration, on the triangle the inductor actually
  // carries: the slope form above is checked separately as iL.pp, and this
  // row is about what the capacitor does with it.
  const dv = sig.iL.pp / (8 * C * fs)
  const iLrms = Math.sqrt(Io * Io + (di * di) / 12)
  // The slope form takes the output as flat across the interval, so it is
  // right to within the share of the ripple the output itself moves by.
  const iTol = (v) => [v, Math.max(1e-3 * Math.abs(v), (di * sig.vout.pp) / Math.max(1e-12, Math.abs(sig.vout.avg)))]
  pins['iL.pp'] = iTol(di)
  pins['iL.max'] = iTol(Io + di / 2)
  pins['iL.min'] = iTol(Io - di / 2)
  pins['iL.rms'] = iTol(iLrms)
  pins['iD.avg'] = iTol((1 - D) * Io)
  pins['iQ.avg'] = iTol(D * Io)
  pins['iD.rms'] = iTol(Math.sqrt(1 - D) * iLrms)
  pins['iQ.rms'] = iTol(Math.sqrt(D) * iLrms)
  // The capacitor's share of the ripple: i_C(1 + ESR/R) = i_L − v_C/R, so
  // the load takes ESR/R of it when the ESR step dominates v_C's ripple.
  const dic = di / (1 + ESR / R)
  pins['iC.rms'] = iTol(dic / Math.sqrt(12))
  pins['iC.max'] = [dic / 2, Math.max(2e-3 * Math.abs(dic / 2), iTol(dic)[1])]
  pins['iC.min'] = [-dic / 2, Math.max(2e-3 * Math.abs(dic / 2), iTol(dic)[1])]
  pins['iC.pp'] = iTol(dic)
  pins['vsw.rms'] = ap(Math.sqrt(D * (Vin - Ron * Io) ** 2 + (1 - D) * (Vf + rd * Io) ** 2))
  pins['vout.rms'] = ap(Math.abs(sig.vout.avg), 1e-5)
  // The inductor sees the switch node less the winding drop less the
  // output; its extremes are at the switching instants, where all three
  // move together, so the first-order form holds to the ripple.
  const vLmax = pins['vsw.max'][0] - RL * sig.iL.min - sig.vout.min
  const vLmin = pins['vsw.min'][0] - RL * sig.iL.max - sig.vout.max
  // The output's extremes are not reached at the switching instants, so the
  // form is right to within the output ripple.
  const vTol = (v) => [v, Math.max(1e-3 * Math.abs(v), sig.vout.pp)]
  pins['vL.max'] = vTol(vLmax)
  pins['vL.min'] = vTol(vLmin)
  pins['vL.pp'] = vTol(vLmax - vLmin)
  pins['vL.rms'] = ap(Math.sqrt(D * (Vin - Ron * Io - Vo) ** 2 + (1 - D) * (Vo + Vf + rd * Io) ** 2), 2e-3)
  if (ESR > 0) {
    // With ESR the output ripple is a triangle (ESR·i_C) plus the
    // capacitor's parabola, peaking at different instants: not closed, but
    // the triangle inequality bounds it within the parabola's height of
    // the triangle's.
    const step = ESR * sig.iC.pp
    pins['vout.pp'] = { lo: step - 1.001 * dv, hi: step + 1.001 * dv }
    unpinned['vout.min'] = 'with ESR the ripple is a triangle plus a parabola peaking at different instants; pp is bounded, min and max are not closed'
    unpinned['vout.max'] = unpinned['vout.min']
  } else {
    pins['vout.pp'] = ap(dv)
    pins['vout.max'] = [Vo + dv / 2, 0.1 * dv]
    pins['vout.min'] = [Vo - dv / 2, 0.1 * dv]
  }
  return { pins, unpinned }
}

// The boost and the buck-boost in continuous conduction (ideal, or with a
// winding resistance).
function upCCM(kind, x, p) {
  const { sig } = x.m
  const { Vin, D, L, C, fs, R, RL } = p
  const inv = kind === 'buckboost'
  const pins = {}
  const unpinned = {}
  const Dp = 1 - D
  // The load sees the capacitor through the ESR divider, so the ideal ratio
  // is scaled by α = R/(R + ESR) exactly as the topology's own forms are.
  const alpha = R / (R + p.ESR)
  const Vo = alpha * Vin * (RL > 0 ? ratioWithRL(kind, D, RL / R) : conversionRatio(kind, D))
  const Io = Vo / R
  // Exact: the source sees the inductor current (boost) or the switch
  // current (buck-boost); the diode carries the load's average; energy in
  // equals energy out plus the winding's.
  const IL = Io / Dp
  // While the diode conducts the output node carries the whole inductor
  // current, so with an ESR it sits above its own average by ESR·(I_L − I_o).
  const voff = Vo + alpha * p.ESR * (IL - Io)
  const PoutMeasured = sig.vout.rms ** 2 / R
  // The source carries the load plus everything the winding and the ESR take.
  const IinAvg = (PoutMeasured + RL * sig.iL.rms ** 2 + p.ESR * sig.iC.rms ** 2) / Vin
  const IoMeasured = (inv ? -sig.vout.avg : sig.vout.avg) / R
  pins['vL.avg'] = zero(Vin)
  pins['iC.avg'] = zero(Io)
  pins['iD.avg'] = ex(IoMeasured)
  pins['iD.min'] = zero(Io)
  pins['iQ.min'] = zero(Io)
  pins['iD.max'] = ex(sig.iL.max)
  pins['iQ.max'] = ex(sig.iL.max)
  pins['iD.pp'] = ex(sig.iL.max)
  pins['iQ.pp'] = ex(sig.iL.max)
  pins['iin.avg'] = ex(IinAvg)
  if (inv) {
    same(pins, 'iin', 'iQ', sig)
    same(pins, 'vsw', 'vL', sig)
    pins['iL.avg'] = ap(Io / Dp)
    pins['iQ.avg'] = ex(IinAvg)
    // v_L is Vin while on and v_out (negative) while off.
    pins['vL.max'] = ex(Vin)
    pins['vL.min'] = ex(sig.vout.min, Vin)
    pins['vL.pp'] = ex(Vin - sig.vout.min)
    pins['vL.rms'] = ap(Math.sqrt(D * Vin * Vin + Dp * Vo * Vo))
    // i_C is −v_out/R while on (most negative at the largest |v_out|), and
    // i_L − |v_out|/R at turn-off, where |v_out| is smallest.
    pins['iC.min'] = ex(sig.vout.min / R, Io)
    pins['iC.max'] = ex(sig.iL.max + sig.vout.max / R, Io)
  } else {
    same(pins, 'iin', 'iL', sig)
    pins['iL.avg'] = ex(IinAvg)
    pins['iQ.avg'] = ex(IinAvg - IoMeasured)
    // The switch node is 0 while on and v_out while off; v_L = Vin − v_sw.
    // The switch node is 0 while on and v_out while off; v_L = Vin − R_L i_L
    // − v_sw, so ⟨v_sw⟩ = Vin − R_L⟨i_L⟩ and v_L peaks at turn-on.
    pins['vsw.avg'] = ex(Vin - RL * sig.iL.avg)
    pins['vsw.min'] = zero(Vin)
    pins['vsw.max'] = ex(sig.vout.max)
    pins['vsw.pp'] = ex(sig.vout.max)
    // While the diode conducts the switch node is the output node, and with
    // an ESR the output node carries the whole inductor current rather than
    // the load's.
    pins['vsw.rms'] = ap(Math.sqrt(Dp) * voff, 2e-3)
    pins['vL.max'] = ex(Vin - RL * sig.iL.min)
    pins['vL.rms'] = ap(Math.sqrt(D * (Vin - RL * IL) ** 2 + Dp * (voff - Vin + RL * IL) ** 2), 2e-3)
    if (RL > 0) {
      unpinned['vL.min'] = 'with a winding drop v_L = Vin − R_L i_L − v_out reaches its minimum inside the off interval, with i_L falling and v_out rising, not at a switching instant'
      unpinned['vL.pp'] = unpinned['vL.min']
    } else {
      pins['vL.min'] = ex(Vin - sig.vout.max, Vin)
      pins['vL.pp'] = ex(sig.vout.max)
    }
    // i_C is α(i_x − v_C/R): the diode's current is zero while the switch is
    // on, so the capacitor is at its most negative where v_C is highest, and
    // at its peak where the inductor is. With an ESR the output node is not
    // v_C, so the capacitor's own voltage is what these read.
    pins['iC.min'] = ex((-alpha * sig.vC.max) / R, Io)
    pins['iC.max'] = ex(alpha * (sig.iL.max - sig.vC.min / R), Io)
  }
  pins['iC.pp'] = ex(pins['iC.max'][0] - pins['iC.min'][0], Io)
  // Small-ripple forms, to 0.1 %.
  const di = ((Vin - RL * IL) * D) / (L * fs)
  const dv = (Io * D) / (C * fs)
  const iLrms = Math.sqrt(IL * IL + (di * di) / 12)
  pins['iL.pp'] = ap(di)
  pins['iL.max'] = ap(IL + di / 2)
  pins['iL.min'] = ap(IL - di / 2)
  pins['iL.rms'] = ap(iLrms)
  pins['iD.rms'] = ap(Math.sqrt(Dp) * iLrms)
  pins['iQ.rms'] = ap(Math.sqrt(D) * iLrms)
  pins['iC.rms'] = ap(Math.sqrt(Dp * iLrms ** 2 - Io * Io), Math.max(1e-3, 2 * (sig.vout.pp / Math.max(1e-12, Math.abs(sig.vout.avg)))))
  pins['vout.avg'] = ap(inv ? -Vo : Vo)
  pins['vout.rms'] = ap(Math.abs(sig.vout.avg), 1e-5)
  if (p.ESR > 0) {
    // With ESR the output carries a step of ESR·i_C on top of the
    // capacitor's own sag, and the two peak at different instants.
    const step = p.ESR * sig.iC.pp
    pins['vout.pp'] = { lo: step - 1.001 * dv, hi: step + 1.001 * dv }
    unpinned['vout.min'] = 'with ESR the ripple is the capacitor’s sag plus a step of ESR·i_C, and the two peak at different instants; pp is bounded, min and max are not closed'
    unpinned['vout.max'] = unpinned['vout.min']
  } else {
    pins['vout.pp'] = ap(dv)
    pins['vout.max'] = [(inv ? -Vo : Vo) + dv / 2, 0.1 * dv]
    pins['vout.min'] = [(inv ? -Vo : Vo) - dv / 2, 0.1 * dv]
  }
  return { pins, unpinned }
}

// Discontinuous conduction, all three kinds, ideal: the inductor current
// is a triangle from zero to I_pk over (D + D₂)T.
function dcm(kind, x, p) {
  const { sig } = x.m
  const { Vin, D, L, C, fs, R } = p
  const inv = kind === 'buckboost'
  const pins = {}
  const unpinned = {}
  const Vo = Vin * dcmRatio(kind, D, K(p))
  const Io = Vo / R
  const Ipk = kind === 'buck' ? ((Vin - Vo) * D) / (L * fs) : (Vin * D) / (L * fs)
  const D2 = (Ipk * L * fs) / (kind === 'boost' ? Vo - Vin : Vo)
  const IoMeasured = (inv ? -sig.vout.avg : sig.vout.avg) / R
  const T = 1 / fs
  pins['vout.avg'] = ap(inv ? -Vo : Vo)
  pins['vout.rms'] = ap(Math.abs(sig.vout.avg), 1e-5)
  // The textbook DCM ripple: the charge the diode's triangle delivers
  // above the load current, over C.
  const above = kind === 'buck' ? D + D2 : D2
  pins['vout.pp'] = ap(((Ipk - Io) ** 2 * above * T) / (2 * Ipk * C))
  unpinned['vout.min'] = RIPPLE
  unpinned['vout.max'] = RIPPLE
  pins['vL.avg'] = zero(Vin)
  pins['iC.avg'] = zero(Io)
  pins['iL.min'] = zero(Io)
  pins['iD.min'] = zero(Io)
  pins['iQ.min'] = zero(Io)
  pins['iL.max'] = ap(Ipk)
  pins['iL.pp'] = ap(Ipk)
  pins['iD.max'] = ex(sig.iL.max)
  pins['iQ.max'] = ex(sig.iL.max)
  pins['iD.pp'] = ex(sig.iL.max)
  pins['iQ.pp'] = ex(sig.iL.max)
  pins['iL.rms'] = ap(Ipk * Math.sqrt((D + D2) / 3))
  pins['iQ.avg'] = ap((D * Ipk) / 2)
  pins['iQ.rms'] = ap(Ipk * Math.sqrt(D / 3))
  pins['iD.rms'] = ap(Ipk * Math.sqrt(D2 / 3))
  if (kind === 'buck') {
    pins['iL.avg'] = ex(IoMeasured)
    pins['iD.avg'] = ap(Io - (D * Ipk) / 2)
    same(pins, 'iin', 'iQ', sig)
    // The switch node is Vin while on, 0 while the diode conducts, and
    // v_out in the dead interval; its average is v_out's exactly.
    pins['vsw.avg'] = ex(sig.vout.avg)
    pins['vsw.min'] = zero(Vin)
    pins['vsw.max'] = ex(Vin)
    pins['vsw.pp'] = ex(Vin)
    pins['vsw.rms'] = ap(Math.sqrt(D * Vin * Vin + (1 - D - D2) * Vo * Vo))
    pins['vL.max'] = [Vin - Vo, sig.vout.pp]
    pins['vL.min'] = [-Vo, sig.vout.pp]
    pins['vL.pp'] = [Vin, sig.vout.pp]
    pins['vL.rms'] = ap(Math.sqrt(D * (Vin - Vo) ** 2 + D2 * Vo * Vo))
    // i_C = i_L − v_out/R: −I_o in the dead interval, I_pk − I_o at the peak.
    pins['iC.min'] = ap(-Io)
    pins['iC.max'] = ap(Ipk - Io)
    pins['iC.pp'] = ap(Ipk)
    pins['iC.rms'] = ap(Math.sqrt(sig.iL.rms ** 2 - Io * Io))
  } else {
    pins['iL.avg'] = ap((Ipk * (D + D2)) / 2)
    pins['iD.avg'] = ex(IoMeasured)
    pins['iC.rms'] = ap(Math.sqrt(sig.iD.rms ** 2 - Io * Io))
    if (inv) {
      same(pins, 'iin', 'iQ', sig)
      same(pins, 'vsw', 'vL', sig)
      pins['vL.max'] = ex(Vin)
      pins['vL.min'] = ex(sig.vout.min, Vin)
      pins['vL.pp'] = ex(Vin - sig.vout.min)
      pins['vL.rms'] = ap(Math.sqrt(D * Vin * Vin + D2 * Vo * Vo))
      // v_out peaks where i_D falls through I_o, a little before the diode
      // blocks and the dead interval's −v_out/R begins: a first-order pin.
      pins['iC.min'] = ap(sig.vout.min / R)
      pins['iC.max'] = ex(sig.iL.max + sig.vout.max / R, Io)
    } else {
      same(pins, 'iin', 'iL', sig)
      // 0 while on, v_out while the diode conducts, Vin in the dead
      // interval (v_L = 0); the average is Vin exactly.
      pins['vsw.avg'] = ex(Vin)
      pins['vsw.min'] = zero(Vin)
      pins['vsw.max'] = ex(sig.vout.max)
      pins['vsw.pp'] = ex(sig.vout.max)
      pins['vsw.rms'] = ap(Math.sqrt((1 - D - D2) * Vin * Vin + D2 * Vo * Vo))
      pins['vL.max'] = ex(Vin)
      pins['vL.min'] = ex(Vin - sig.vout.max, Vin)
      pins['vL.pp'] = ex(sig.vout.max)
      pins['vL.rms'] = ap(Math.sqrt(D * Vin * Vin + D2 * (Vo - Vin) ** 2))
      pins['iC.min'] = ap(-sig.vout.max / R)
      pins['iC.max'] = ex(sig.iL.max - sig.vout.min / R, Io)
    }
    pins['iC.pp'] = ap(pins['iC.max'][0] - pins['iC.min'][0])
  }
  return { pins, unpinned }
}

// ---------------------------------------------------------------- Magnetics

const TWO_SLOPES =
  'past the knee the current runs on a second inductance, so the period is four straight lines rather than two; the RMS of that shape is a four-piece integral and not the triangle’s √(I² + ΔI²/12)'

/**
 * A buck whose core saturates part-way through the period.
 *
 * Everything volt-second balance decides is unchanged, because no inductance
 * appears in it: the switch node, the output and every average are the
 * buck's. What changes is the shape of the current, and the pins that carry
 * it are the geometry of the two slopes — each extreme computed from the
 * other one and the two inductances, so neither is the solver's own answer.
 */
function sat(x, p) {
  const { sig } = x.m
  const f = x.formulas
  const { Vin, D, R, Ron, RL } = p
  const T = 1 / p.fs
  const pins = {}
  const unpinned = {}
  const vswAvg = D * Vin - Ron * sig.iQ.avg - (1 - D) * p.Vf - p.rd * sig.iD.avg
  const Vo = vswAvg - RL * sig.iL.avg
  const Io = Vo / R
  pins['vsw.avg'] = ex(vswAvg)
  pins['vsw.max'] = ex(Vin - Ron * sig.iL.min)
  pins['vsw.min'] = ex(-p.Vf - p.rd * sig.iL.max, Vin)
  pins['vsw.pp'] = ex(pins['vsw.max'][0] - pins['vsw.min'][0])
  pins['vsw.rms'] = ap(Math.sqrt(D * Vin ** 2 + (1 - D) * p.Vf ** 2), 1e-3, Vin)
  pins['vout.avg'] = ex(Vo)
  pins['vL.avg'] = zero(Vin)
  pins['iL.avg'] = ex(Io)
  pins['iC.avg'] = zero(Io)
  const lo = Math.min(0, sig.iL.min)
  const hi = Math.max(0, sig.iL.max)
  for (const k of ['iD', 'iQ']) {
    pins[`${k}.min`] = ex(lo, Math.max(1, Math.abs(hi)))
    pins[`${k}.max`] = ex(hi)
    pins[`${k}.pp`] = ex(hi - lo)
    pins[`${k}.avg`] = ap((k === 'iQ' ? D : 1 - D) * Io, 5e-3, Math.abs(Io))
    unpinned[`${k}.rms`] = TWO_SLOPES
  }
  same(pins, 'iin', 'iQ', sig)
  // The peak: the current rises at (V_in − V_out)/L to the knee, then at the
  // same voltage over the collapsed inductance for what is left of the on
  // interval. The valley is the same walk the other way.
  const vOn = Vin - Vo
  const tKnee = ((f.Isat - sig.iL.min) * p.L) / vOn
  pins['iL.max'] = ap(f.Isat + (vOn * (D * T - tKnee)) / f.Lsat, 5e-3)
  const tBack = ((sig.iL.max - f.Isat) * f.Lsat) / Vo
  pins['iL.min'] = ap(f.Isat - (Vo * ((1 - D) * T - tBack)) / p.L, 5e-3, Math.abs(sig.iL.pp))
  pins['iL.pp'] = ap(sig.iL.max - pins['iL.min'][0], 5e-3, Math.abs(sig.iL.pp))
  unpinned['iL.rms'] = TWO_SLOPES
  // The inductor sees the switch node less the output, and its extremes are
  // at the switching instants.
  pins['vL.max'] = ap(pins['vsw.max'][0] - RL * sig.iL.min - sig.vout.min, 1e-3)
  pins['vL.min'] = ap(pins['vsw.min'][0] - RL * sig.iL.max - sig.vout.max, 1e-3, Vin)
  pins['vL.pp'] = ap(pins['vL.max'][0] - pins['vL.min'][0], 1e-3)
  pins['vL.rms'] = ap(Math.sqrt(D * (Vin - Vo) ** 2 + (1 - D) * Vo ** 2), 5e-3)
  // i_C is i_L less the load current, and the load current moves only by the
  // output ripple, so each extreme is bracketed by it.
  pins['iC.max'] = { lo: sig.iL.max - sig.vout.max / R, hi: sig.iL.max - sig.vout.min / R }
  pins['iC.min'] = { lo: sig.iL.min - sig.vout.max / R, hi: sig.iL.min - sig.vout.min / R }
  pins['iC.pp'] = ap(sig.iL.pp, 5e-3)
  unpinned['iC.rms'] = TWO_SLOPES
  // The output ripple is the charge the two-slope triangle leaves above the
  // load current, over C, and where it peaks depends on the whole period.
  const ripple = 'the capacitor integrates a triangle with two different slopes, so its ripple is not the single-L parabola and its extremes are not symmetric about the average'
  unpinned['vout.pp'] = ripple
  unpinned['vout.min'] = ripple
  unpinned['vout.max'] = ripple
  pins['vout.rms'] = ap(Math.abs(sig.vout.avg), 1e-5)
  return { pins, unpinned }
}

// ---------------------------------------------------------------- Isolated

/** The flyback in continuous conduction: the buck-boost's pins with n in them. */
function flybackCCM(x, params) {
  const { sig } = x.m
  const f = x.formulas
  const p = x.p
  const { Vin, D, L, C, fs, R, Ron, Vf, RL } = p
  const n = f.n
  const Dp = 1 - D
  const pins = {}
  const unpinned = {}
  const Vo = sig.vout.avg
  const Io = Vo / R
  // Charge balance: the diode carries the load's average, and ampere-turns
  // put the magnetising current through it divided by n.
  pins['vL.avg'] = zero(Vin)
  pins['iC.avg'] = zero(Io)
  pins['iD.avg'] = ex(Io)
  pins['iD.max'] = ex(sig.iL.max / n)
  pins['iD.min'] = zero(Io)
  pins['iD.pp'] = ex(sig.iL.max / n)
  pins['iQ.min'] = zero(Io)
  pins['iQ.max'] = ex(sig.iL.max)
  pins['iQ.pp'] = ex(sig.iL.max)
  same(pins, 'iin', 'iQ', sig)
  // Small-ripple forms.
  const IM = (n * Io) / Dp
  const di = ((Vin - (Ron + RL) * IM) * D) / (L * fs)
  const dv = (Io * D) / (C * fs)
  const iLrms = Math.sqrt(IM * IM + (di * di) / 12)
  pins['iL.avg'] = ap(IM, 2e-3)
  pins['iL.pp'] = ap(di, 2e-3)
  pins['iL.max'] = ap(IM + di / 2, 2e-3)
  pins['iL.min'] = ap(IM - di / 2, 2e-3, Math.max(Math.abs(IM - di / 2), di))
  pins['iL.rms'] = ap(iLrms, 2e-3)
  pins['iQ.avg'] = ap(D * IM)
  pins['iQ.rms'] = ap(Math.sqrt(D) * iLrms)
  pins['iD.rms'] = ap((Math.sqrt(Dp) * iLrms) / n)
  pins['iC.rms'] = ap(Math.sqrt(Math.max(0, sig.iD.rms ** 2 - Io * Io)))
  // The drain: the switch drop while it conducts, the rail plus the
  // reflected output while it does not.
  pins['vsw.min'] = ap(Ron * sig.iL.min, 1e-3, Vin)
  pins['vsw.max'] = ap(Vin + (sig.vout.max + Vf) / n, 5e-3)
  pins['vsw.pp'] = ap(pins['vsw.max'][0] - pins['vsw.min'][0], 5e-3)
  pins['vsw.avg'] = ap(D * Ron * IM + Dp * (Vin + (Vo + Vf) / n), 5e-3)
  pins['vsw.rms'] = ap(Math.sqrt(D * (Ron * IM) ** 2 + Dp * (Vin + (Vo + Vf) / n) ** 2), 5e-3)
  pins['vL.max'] = ap(Vin - (Ron + RL) * sig.iL.min, 5e-3)
  pins['vL.min'] = ap(-(sig.vout.max + Vf) / n, 5e-3, Vin)
  pins['vL.pp'] = ap(pins['vL.max'][0] - pins['vL.min'][0], 5e-3)
  pins['vL.rms'] = ap(Math.sqrt(D * Vin ** 2 + Dp * ((Vo + Vf) / n) ** 2), 5e-3)
  pins['vout.avg'] = ap(Vin * f.M, 5e-3)
  pins['vout.rms'] = ap(Math.abs(sig.vout.avg), 1e-5)
  pins['vout.pp'] = ap(dv, 3e-2)
  pins['vout.max'] = [Vo + dv / 2, 0.2 * dv]
  pins['vout.min'] = [Vo - dv / 2, 0.2 * dv]
  // i_C is what the diode delivers less what the load takes.
  // Read off the sampled trace, so an extreme can sit one grid step from the
  // solution's own.
  const grid = (v) => [v, 1e-4 * Math.max(Math.abs(v), Io, 1e-9)]
  pins['iC.min'] = grid(-sig.vout.max / R)
  pins['iC.max'] = grid(sig.iL.max / n - sig.vout.min / R)
  pins['iC.pp'] = grid(pins['iC.max'][0] - pins['iC.min'][0])
  return { pins, unpinned }
}

/**
 * The half-bridge: a buck whose input is the secondary pulse n·V_in/2 and
 * whose period is half a switching period, so every buck form applies with
 * those two substitutions. The rectifier carries the inductor current in
 * both intervals, so its drop appears in both.
 */
function halfBridgeCCM(x) {
  const { sig } = x.m
  const f = x.formulas
  const p = x.p
  const { L, C, fs, R, Ron, Vf, rd, RL, ESR } = p
  const D = p.D
  const n = f.n
  const vp = f.vpulse
  const pins = {}
  const unpinned = {}
  const rOn = n * n * Ron + rd
  const vswAvg = D * (vp - rOn * sig.iQ.avg / n) - Vf - (1 - D) * rd * sig.iD.avg
  const Vo = vswAvg - RL * sig.iL.avg
  const Io = Vo / R
  pins['vsw.avg'] = ap(vswAvg, 1e-3, Math.abs(vp))
  pins['vsw.max'] = ex(vp - Vf - rOn * sig.iL.min, Math.abs(vp))
  pins['vsw.min'] = ex(-Vf - rd * sig.iL.max, Math.abs(vp))
  pins['vsw.pp'] = ex(pins['vsw.max'][0] - pins['vsw.min'][0], Math.abs(vp))
  pins['vsw.rms'] = ap(Math.sqrt(D * (vp - Vf) ** 2 + (1 - D) * Vf ** 2), 5e-3, Math.abs(vp))
  pins['vout.avg'] = ap(Vo, 1e-3)
  pins['vL.avg'] = zero(Math.abs(vp))
  pins['iL.avg'] = ex(Io)
  pins['iC.avg'] = zero(Io)
  // The rectifier is one drop in the output path, so it carries the
  // inductor's current in every interval.
  same(pins, 'iD', 'iL', sig)
  // The primary carries n times the output inductor's current while a switch
  // is on; the rail sees half of that against its own voltage.
  const lo = Math.min(0, sig.iL.min)
  const hi = Math.max(0, sig.iL.max)
  pins['iQ.min'] = ex(n * lo, Math.max(1, n * hi))
  pins['iQ.max'] = ex(n * hi)
  pins['iQ.pp'] = ex(n * (hi - lo))
  pins['iQ.avg'] = ap(n * D * Io)
  scaled(pins, 'iin', 'iQ', 0.5, sig)
  const di = ((vp - Vf - Vo) * D) / (L * fs)
  const dv = di / (8 * C * fs)
  const iLrms = Math.sqrt(Io * Io + (di * di) / 12)
  pins['iL.pp'] = ap(di)
  pins['iL.max'] = ap(Io + di / 2)
  pins['iL.min'] = ap(Io - di / 2, 1e-3, Math.max(Math.abs(Io - di / 2), di))
  pins['iL.rms'] = ap(iLrms)
  pins['iQ.rms'] = ap(n * Math.sqrt(D) * iLrms)
  const dic = di / (1 + ESR / R)
  pins['iC.rms'] = ap(dic / Math.sqrt(12))
  pins['iC.max'] = ap(dic / 2, 2e-3)
  pins['iC.min'] = ap(-dic / 2, 2e-3)
  pins['iC.pp'] = ap(dic)
  pins['vL.max'] = ap(pins['vsw.max'][0] - RL * sig.iL.min - sig.vout.min, 1e-3)
  pins['vL.min'] = ap(pins['vsw.min'][0] - RL * sig.iL.max - sig.vout.max, 1e-3, Math.abs(vp))
  pins['vL.pp'] = ap(pins['vL.max'][0] - pins['vL.min'][0], 1e-3)
  pins['vL.rms'] = ap(Math.sqrt(D * (vp - Vf - Vo) ** 2 + (1 - D) * (Vo + Vf) ** 2), 5e-3)
  pins['vout.rms'] = ap(Math.abs(sig.vout.avg), 1e-5)
  pins['vout.pp'] = ap(dv, 5e-3)
  pins['vout.max'] = [Vo + dv / 2, 0.2 * dv]
  pins['vout.min'] = [Vo - dv / 2, 0.2 * dv]
  return { pins, unpinned }
}

// --------------------------------------------------------------- Inverters

const SPECTRAL =
  'the load voltage is the bridge’s switched wave through a second-order filter, so every figure but its average is a sum over every harmonic and has no closed form; the fundamental is pinned against m_a·V_dc and (4/π)·V_dc in experiments.test.js'

/**
 * The full-bridge inverter. Half-wave symmetry makes every average exactly
 * zero, and the bridge output is ±V_dc, so the switched side is pinned
 * outright. What the filter leaves is bounded rather than pinned, because a
 * filtered switching waveform's extremes are a harmonic sum.
 */
function inverterPins(x) {
  const p = x.p
  const { sig } = x.m
  const Vdc = p.Vdc
  const R = p.R
  const pins = {}
  const unpinned = {}
  const drop = 2 * p.Ron
  // The bridge output: ±V_dc, less the switches' drop, half the period each.
  pins['vsw.avg'] = zero(Vdc)
  pins['vsw.rms'] = ap(Math.sqrt(Vdc * Vdc + drop * drop * sig.iL.rms ** 2), 1e-3, Vdc)
  pins['vsw.max'] = ex(Vdc - drop * sig.iL.min, Vdc)
  pins['vsw.min'] = ex(-Vdc - drop * sig.iL.max, Vdc)
  pins['vsw.pp'] = ex(pins['vsw.max'][0] - pins['vsw.min'][0], Vdc)
  // Half-wave symmetry: every average is zero, exactly.
  pins['vout.avg'] = zero(Vdc)
  pins['vL.avg'] = zero(Vdc)
  pins['iL.avg'] = zero(Math.max(1e-6, Math.abs(sig.iL.max)))
  pins['iC.avg'] = zero(Math.max(1e-6, Math.abs(sig.iC.max)))
  // The load current is the output voltage over R, at every instant.
  scaled(pins, 'iR', 'vout', 1 / R, sig)
  // The inductor sees the bridge less the output. Both extremes are reached
  // while the bridge is at one rail, so each is bracketed by the output's own.
  pins['vL.max'] = { lo: Vdc - drop * sig.iL.max - sig.vout.max, hi: Vdc - drop * sig.iL.min - sig.vout.min }
  pins['vL.min'] = { lo: -Vdc - drop * sig.iL.max - sig.vout.max, hi: -Vdc - drop * sig.iL.min - sig.vout.min }
  pins['vL.pp'] = { lo: pins['vL.max'].lo - pins['vL.min'].hi, hi: pins['vL.max'].hi - pins['vL.min'].lo }
  pins['vL.rms'] = { lo: 0, hi: 2 * Vdc + Math.abs(sig.vout.min) + sig.vout.max }
  // The rail current is the inductor's with the bridge's sign on it, so its
  // RMS is the inductor's and its extremes are inside the inductor's swing.
  const iScale = Math.max(Math.abs(sig.iL.max), Math.abs(sig.iL.min))
  pins['iin.rms'] = ex(sig.iL.rms, iScale)
  pins['iin.avg'] = ex(x.m.Pin / Vdc, iScale)
  pins['iin.max'] = { lo: 0, hi: iScale }
  pins['iin.min'] = { lo: -iScale, hi: 0 }
  pins['iin.pp'] = { lo: 0, hi: 2 * iScale }
  for (const s of ['rms', 'min', 'max', 'pp']) {
    unpinned[`vout.${s}`] = SPECTRAL
    unpinned[`iL.${s}`] = SPECTRAL
    unpinned[`iC.${s}`] = SPECTRAL
  }
  return { pins, unpinned }
}

function pwm(kind, x, params) {
  const p = buckParams(params)
  if (x.m.mode === 'SAT') return sat(x, { ...p, D: x.conv.p.D })
  if (x.m.mode === 'DCM') return dcm(kind, x, p)
  return kind === 'buck' ? buckCCM(x, p) : upCCM(kind, x, p)
}

// ---------------------------------------------------------------- Line side

const TRANSCENDENTAL =
  'the reservoir’s charging instants are roots of a transcendental equation; the output with a capacitor has no textbook closed form, and is held by charge balance (⟨i_C⟩ = 0, ⟨i_D⟩ = ⟨i_R⟩) and the note’s I_o/(fC) rule to its stated error'

function rect(kind, x, p) {
  const { sig } = x.m
  const { Vs, Vf, R } = p
  const Vp = Math.SQRT2 * Vs
  const pins = {}
  const unpinned = {}
  // The line.
  pins['vin.avg'] = zero(Vp)
  pins['vin.rms'] = ex(Vs)
  pins['vin.min'] = exs(-Vp)
  pins['vin.max'] = exs(Vp)
  pins['vin.pp'] = exs(2 * Vp)
  // What the diodes hand the reservoir, before it.
  if (kind === 'half') same(pins, 'vrect', 'vin', sig)
  else if (kind === 'bridge') {
    pins['vrect.avg'] = ex((2 * Vp) / Math.PI)
    pins['vrect.rms'] = ex(Vs)
    pins['vrect.min'] = zero(Vp)
    pins['vrect.max'] = exs(Vp)
    pins['vrect.pp'] = exs(Vp)
  } else {
    // Six-pulse: the largest line-to-line voltage, √6·Vs peak, never
    // below cos 30° of it.
    const Vll = Math.sqrt(6) * Vs
    pins['vrect.avg'] = ex((3 * Vll) / Math.PI)
    pins['vrect.rms'] = ex(Vll * Math.sqrt(0.5 + (3 * Math.sqrt(3)) / (4 * Math.PI)))
    pins['vrect.min'] = exs(Vll * Math.cos(Math.PI / 6))
    pins['vrect.max'] = exs(Vll)
    pins['vrect.pp'] = exs(Vll * (1 - Math.cos(Math.PI / 6)))
  }
  // The output and the diode: transcendental, except the load's current is
  // the output over R, the diode's average is the load's, its floor is
  // zero and its ceiling is set by the reverse peak.
  for (const s of STATS) unpinned[`vout.${s}`] = TRANSCENDENTAL
  scaled(pins, 'iR', 'vout', 1 / R, sig)
  pins['iC.avg'] = zero(sig.iR.avg)
  pins['iD.avg'] = ex(sig.iR.avg)
  pins['iD.min'] = zero(sig.iD.max)
  pins['vD.max'] = exs(Vf, Vp)
  for (const s of ['rms', 'min', 'max', 'pp']) unpinned[`iC.${s}`] = TRANSCENDENTAL
  for (const s of ['rms', 'max', 'pp']) unpinned[`iD.${s}`] = TRANSCENDENTAL
  for (const s of ['avg', 'rms']) unpinned[`vD.${s}`] = TRANSCENDENTAL
  if (kind === 'half') {
    same(pins, 'iin', 'iD', sig)
    unpinned['vD.min'] = 'the reverse peak is √2·Vs plus the reservoir’s voltage at the negative peak, a transcendental instant; the note’s PIV ≈ 2√2·Vs bound is tested there'
    unpinned['vD.pp'] = unpinned['vD.min']
  } else {
    // The blocking diode sees the line less the conducting diode's drop.
    const Vrev = (kind === 'bridge' ? Vp : Math.sqrt(6) * Vs) - Vf
    pins['vD.min'] = exs(-Vrev)
    pins['vD.pp'] = exs(Vrev + Vf)
    pins['iin.avg'] = zero(sig.iD.max)
    pins['iin.max'] = exs(sig.iD.max)
    pins['iin.min'] = exs(-sig.iD.max)
    pins['iin.pp'] = exs(2 * sig.iD.max)
    if (kind === 'bridge') pins['iin.rms'] = ex(sig.iD.rms)
    else unpinned['iin.rms'] = 'a line carries two of the six diodes’ pulses a cycle, of transcendental width'
  }
  return { pins, unpinned }
}

function dimmer(x, p) {
  const { sig } = x.m
  const { Vs, R } = p
  const a = (p.alphaDeg * Math.PI) / 180
  const Vp = Math.SQRT2 * Vs
  const pins = {}
  pins['vin.avg'] = zero(Vp)
  pins['vin.rms'] = ex(Vs)
  pins['vin.min'] = ex(-Vp)
  pins['vin.max'] = ex(Vp)
  pins['vin.pp'] = ex(2 * Vp)
  // Phase control: the load sees the line from α to π each half cycle.
  const on = Math.sqrt(1 - a / Math.PI + Math.sin(2 * a) / (2 * Math.PI))
  const peak = a <= Math.PI / 2 ? Vp : Vp * Math.sin(a)
  pins['vout.avg'] = zero(Vp)
  pins['vout.rms'] = ex(Vs * on)
  pins['vout.max'] = ex(peak)
  pins['vout.min'] = ex(-peak)
  pins['vout.pp'] = ex(2 * peak)
  // The triac holds the line while off.
  const offPeak = a >= Math.PI / 2 ? Vp : Vp * Math.sin(a)
  pins['vD.avg'] = zero(Vp)
  pins['vD.rms'] = ex(Vs * Math.sqrt(1 - on * on))
  pins['vD.max'] = ex(offPeak)
  pins['vD.min'] = ex(-offPeak)
  pins['vD.pp'] = ex(2 * offPeak)
  scaled(pins, 'iR', 'vout', 1 / R, sig)
  same(pins, 'iin', 'iR', sig)
  return { pins, unpinned: {} }
}


// ------------------------------------------------------------- Three-phase

const SUMMED =
  'a winding current is the sum over every harmonic the bridge leaves, through an impedance that falls with order, so its RMS and its extremes have no closed form; the fundamental is pinned against (\u221a6/\u03c0)\u00b7V_dc and (\u221a3/2)\u00b7m_a\u00b7V_dc in hi.test.js'
const PWM_RMS =
  'the share of each cycle a two-level leg spends at either rail is set by the comparator, so the total RMS of the switched voltages is a sum over the modulator\u2019s own edges rather than a closed form; six-step has one and is pinned'

/**
 * The three-phase bridge into a balanced wye.
 *
 * The switched voltages are exact: a leg is ±V_dc/2, a line-to-line is one
 * of three levels, and a phase voltage is one of five, whatever the
 * modulator. Six-step also fixes how long each is held, so its RMS values are
 * closed too. What the load does with them is a harmonic sum.
 */
function threePhasePins(x, params) {
  const { sig } = x.m
  const Vdc = x.p.Vdc
  const six = x.kind === 'sixstep'
  const pins = {}
  const unpinned = {}
  // The leg: a square wave between the two rails, half the period at each.
  pins['vao.avg'] = zero(Vdc)
  pins['vao.rms'] = ex(Vdc / 2)
  pins['vao.min'] = ex(-Vdc / 2)
  pins['vao.max'] = ex(Vdc / 2)
  pins['vao.pp'] = ex(Vdc)
  // Line-to-line: 0 or ±V_dc, and half-wave symmetry makes its average zero.
  pins['vab.avg'] = zero(Vdc)
  pins['vab.min'] = ex(-Vdc)
  pins['vab.max'] = ex(Vdc)
  pins['vab.pp'] = ex(2 * Vdc)
  // Phase: the floating neutral leaves ±V_dc/3 and ±2V_dc/3, and, wherever
  // all three legs sit on one rail, zero. Six-step never visits that state,
  // so its staircase has four levels and sine PWM's has five.
  pins['van.avg'] = zero(Vdc)
  pins['van.min'] = ex((-2 * Vdc) / 3)
  pins['van.max'] = ex((2 * Vdc) / 3)
  pins['van.pp'] = ex((4 * Vdc) / 3)
  if (six) {
    // Six-step holds |v_ab| = V_dc for two thirds of the cycle and |v_an| at
    // V_dc/3 for two thirds and 2V_dc/3 for the rest.
    pins['vab.rms'] = ex(Vdc * Math.sqrt(2 / 3))
    pins['van.rms'] = ex((Math.SQRT2 * Vdc) / 3)
  } else {
    unpinned['vab.rms'] = PWM_RMS
    unpinned['van.rms'] = PWM_RMS
  }
  // The winding current: zero average by half-wave symmetry, and a harmonic
  // sum otherwise.
  pins['ia.avg'] = zero(Math.max(1e-9, sig.ia.max))
  for (const s of ['rms', 'min', 'max', 'pp']) unpinned[`ia.${s}`] = SUMMED
  // The bus current: its average is the load's own dissipation over V_dc,
  // which is the energy identity, and it is bounded by the phase current it
  // is switched from.
  pins['idc.avg'] = ex(x.m.Pout / Vdc, Math.max(1e-9, sig.ia.max))
  // At every instant the bus carries the currents of the legs tied to the
  // upper rail, and the three sum to zero, so it is one phase current or the
  // negative of another. Its extremes are inside their swing, and the slack
  // is the sampled trace's own grid.
  const top = Math.max(Math.abs(sig.ia.max), Math.abs(sig.ia.min)) * (1 + 1e-6)
  pins['idc.min'] = { lo: -top, hi: top }
  pins['idc.max'] = { lo: -top, hi: top }
  pins['idc.pp'] = { lo: 0, hi: 2 * top }
  unpinned['idc.rms'] = SUMMED
  return { pins, unpinned }
}

// ---------------------------------------------------------------- The walk

function pinsFor(exp, x, params) {
  const t = topologyOf(exp)
  if (t === 'linreg') return linreg(x, params)
  if (t === 'chopper') return chopper(x, params)
  if (t === 'dimmer') return dimmer(x, params)
  if (['half', 'bridge', 'six'].includes(t)) return rect(t, x, params)
  if (['square', 'spwm'].includes(t)) return inverterPins(x)
  if (['sixstep', 'spwm3'].includes(t)) return threePhasePins(x, params)
  if (t === 'flyback') return flybackCCM(x, params)
  if (t === 'halfbridge') return halfBridgeCCM(x)
  return pwm(t, x, params)
}

describe('every cell of the measures table is pinned to a closed form or has a reason', () => {
  it.each(EXPERIMENTS.map((e) => [e.id, e]))('%s', (_, e) => {
    const params = defaultsOf(e.id)
    const x = analyse(e, params)
    const rows = ORDER.filter((k) => x.m.sig[k] && signalsOf(e).includes(k))
    const { pins, unpinned } = pinsFor(e, x, params)
    const missing = []
    let pinned = 0
    for (const k of rows) {
      for (const s of STATS) {
        const key = `${k}.${s}`
        const pin = pins[key]
        const why = unpinned[key]
        expect(pin && why, `${e.id} ${key} is both pinned and excused`).toBeFalsy()
        if (!pin && !why) {
          missing.push(key)
          continue
        }
        if (why) {
          expect(typeof why === 'string' && why.length > 20, `${e.id} ${key} needs a reason`).toBe(true)
          if (s === 'min') expect(x.m.sig[k].min).toBeLessThan(x.m.sig[k].avg)
          if (s === 'max') expect(x.m.sig[k].max).toBeGreaterThan(x.m.sig[k].avg)
          continue
        }
        pinned++
        const v = x.m.sig[k][s]
        if (Array.isArray(pin)) {
          const [pred, tol] = pin
          expect(Math.abs(v - pred), `${e.id} ${key}: ${v} vs ${pred} ± ${tol}`).toBeLessThanOrEqual(tol)
        } else {
          expect(v, `${e.id} ${key}: ${v} below ${pin.lo}`).toBeGreaterThanOrEqual(pin.lo)
          expect(v, `${e.id} ${key}: ${v} above ${pin.hi}`).toBeLessThanOrEqual(pin.hi)
        }
      }
    }
    expect(missing, `${e.id}: shown without a pin or a reason`).toEqual([])
    // Most of the table has a closed form.
    expect(pinned).toBeGreaterThan(rows.length * STATS.length * 0.5)
  })
})
