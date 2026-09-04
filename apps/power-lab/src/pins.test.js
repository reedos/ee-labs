import { describe, it, expect } from 'vitest'
import { conversionRatio, ratioWithRL, dcmRatio, K } from '@ee-labs/switched'
import { EXPERIMENTS, defaultsOf } from './experiments.js'
import { analyse, buckParams, LINREG_R_PASS } from './analysis.js'
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
  // Ohm's law through the fixed R_pass, not a knob's own value: the divider
  // has nothing else to give.
  const Io = p.Vin / (LINREG_R_PASS + p.R)
  const Vo = Io * p.R
  dc(pins, 'vsw', p.Vin)
  dc(pins, 'vout', Vo)
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

// Buck in continuous conduction, with any of the conduction losses on.
function buckCCM(x, p) {
  const { sig } = x.m
  const { Vin, D, L, C, fs, R, Ron, Vf, rd, RL, ESR } = p
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
  pins['iD.min'] = zero(Io)
  pins['iQ.min'] = zero(Io)
  pins['iD.max'] = ex(sig.iL.max)
  pins['iQ.max'] = ex(sig.iL.max)
  pins['iD.pp'] = ex(sig.iL.max)
  pins['iQ.pp'] = ex(sig.iL.max)
  same(pins, 'iin', 'iQ', sig)
  // Small-ripple forms, to 0.1 %.
  const di = ((Vo + Vf + rd * Io + RL * Io) * (1 - D)) / (L * fs) // off-interval slope × time
  const dv = di / (8 * C * fs)
  const iLrms = Math.sqrt(Io * Io + (di * di) / 12)
  pins['iL.pp'] = ap(di)
  pins['iL.max'] = ap(Io + di / 2)
  pins['iL.min'] = ap(Io - di / 2)
  pins['iL.rms'] = ap(iLrms)
  pins['iD.avg'] = ap((1 - D) * Io)
  pins['iQ.avg'] = ap(D * Io)
  pins['iD.rms'] = ap(Math.sqrt(1 - D) * iLrms)
  pins['iQ.rms'] = ap(Math.sqrt(D) * iLrms)
  // The capacitor's share of the ripple: i_C(1 + ESR/R) = i_L − v_C/R, so
  // the load takes ESR/R of it when the ESR step dominates v_C's ripple.
  const dic = di / (1 + ESR / R)
  pins['iC.rms'] = ap(dic / Math.sqrt(12))
  pins['iC.max'] = ap(dic / 2, 2e-3)
  pins['iC.min'] = ap(-dic / 2, 2e-3)
  pins['iC.pp'] = ap(dic)
  pins['vsw.rms'] = ap(Math.sqrt(D * (Vin - Ron * Io) ** 2 + (1 - D) * (Vf + rd * Io) ** 2))
  pins['vout.rms'] = ap(Math.abs(sig.vout.avg), 1e-5)
  // The inductor sees the switch node less the winding drop less the
  // output; its extremes are at the switching instants, where all three
  // move together, so the first-order form holds to the ripple.
  const vLmax = pins['vsw.max'][0] - RL * sig.iL.min - sig.vout.min
  const vLmin = pins['vsw.min'][0] - RL * sig.iL.max - sig.vout.max
  pins['vL.max'] = ap(vLmax, 1e-3)
  pins['vL.min'] = ap(vLmin, 1e-3)
  pins['vL.pp'] = ap(vLmax - vLmin, 1e-3)
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
  const Vo = Vin * (RL > 0 ? ratioWithRL(kind, D, RL / R) : conversionRatio(kind, D))
  const Io = Vo / R
  // Exact: the source sees the inductor current (boost) or the switch
  // current (buck-boost); the diode carries the load's average; energy in
  // equals energy out plus the winding's.
  const IL = Io / Dp
  const PoutMeasured = sig.vout.rms ** 2 / R
  const IinAvg = (PoutMeasured + RL * sig.iL.rms ** 2) / Vin
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
    pins['vsw.rms'] = ap(Math.sqrt(Dp) * Vo)
    pins['vL.max'] = ex(Vin - RL * sig.iL.min)
    pins['vL.rms'] = ap(Math.sqrt(D * (Vin - RL * IL) ** 2 + Dp * (Vo - Vin + RL * IL) ** 2))
    if (RL > 0) {
      unpinned['vL.min'] = 'with a winding drop v_L = Vin − R_L i_L − v_out reaches its minimum inside the off interval, with i_L falling and v_out rising, not at a switching instant'
      unpinned['vL.pp'] = unpinned['vL.min']
    } else {
      pins['vL.min'] = ex(Vin - sig.vout.max, Vin)
      pins['vL.pp'] = ex(sig.vout.max)
    }
    pins['iC.min'] = ex(-sig.vout.max / R, Io)
    pins['iC.max'] = ex(sig.iL.max - sig.vout.min / R, Io)
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
  pins['iC.rms'] = ap(Math.sqrt(Dp * iLrms ** 2 - Io * Io))
  pins['vout.avg'] = ap(inv ? -Vo : Vo)
  pins['vout.rms'] = ap(Math.abs(sig.vout.avg), 1e-5)
  pins['vout.pp'] = ap(dv)
  pins['vout.max'] = [(inv ? -Vo : Vo) + dv / 2, 0.1 * dv]
  pins['vout.min'] = [(inv ? -Vo : Vo) - dv / 2, 0.1 * dv]
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

function pwm(kind, x, params) {
  const p = buckParams(params)
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

// ---------------------------------------------------------------- The walk

function pinsFor(exp, x, params) {
  const t = topologyOf(exp)
  if (t === 'linreg') return linreg(x, params)
  if (t === 'chopper') return chopper(x, params)
  if (t === 'dimmer') return dimmer(x, params)
  if (['half', 'bridge', 'six'].includes(t)) return rect(t, x, params)
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
