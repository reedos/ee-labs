// The closed forms behind every cell of Groups L, M and N's measures tables.
//
// `pins.test.js` walks each experiment's table and requires every average,
// RMS, minimum, maximum and peak-to-peak to be either predicted here or named
// with the reason it has none. The shapes are that file's: `[value,
// tolerance]` for a prediction, `{ lo, hi }` for a bound, and a sentence for a
// cell with no form.
//
// Exact relations carry an absolute tolerance of a billionth of their own
// scale. Textbook small-ripple forms carry the precision the notes claim for
// them. Anything the ring makes transcendental is bounded rather than pinned,
// with the bound derived from the closed form beside it.

import { driveParams, emiParams, ringParams, thermalBuckParams } from './groups/lmn.js'
import { driveAveraged, armatureRipple } from '@ee-labs/switched'

const STATS = ['avg', 'rms', 'min', 'max', 'pp']
const ex = (v, scale = Math.max(1, Math.abs(v))) => [v, 1e-9 * scale]
const ap = (v, rel = 1e-3, scale = Math.abs(v)) => [v, rel * scale]
const zero = (scale) => [0, 1e-9 * scale]

/** Pin all five stats of `k` to those of `j`: the same quantity, another name. */
function same(pins, k, j, sig) {
  for (const s of STATS) pins[`${k}.${s}`] = ex(sig[j][s], Math.max(1, Math.abs(sig[j].max)))
}

/** The parameters `buckParams` needs to rebuild Group N's converter. */
export function thermalPinParams(params) {
  const p = thermalBuckParams(params)
  return { ...p, sync: 1, tsw: p.tr }
}

// ---------------------------------------------------------------- the drives

const SPEED_RIPPLE =
  'the speed ripple is the torque ripple integrated over the interval, which the averaged machine has no term for; its size is pinned as a share of the speed in lmn.test.js and bounded here'

function drivePins(x, params) {
  const { sig } = x.m
  const conv = x.conv
  const mach = conv.mach
  const p = conv.p
  const bridge = conv.kind === 'hbridge'
  const a = driveAveraged(conv)
  const pins = {}
  const unpinned = {}
  const Vdc = p.Vdc
  const iHi = Math.max(sig.iL.max, 0)
  const iScale = Math.max(1e-9, Math.abs(sig.iL.max), Math.abs(sig.iL.min))

  // The terminals: the rail gated by the duty, with no device drop in these
  // experiments, so every stat is exact.
  if (bridge) {
    pins['vout.avg'] = ex((2 * p.D - 1) * Vdc, Vdc)
    pins['vout.rms'] = ex(Vdc)
    pins['vout.min'] = ex(-Vdc)
    pins['vout.max'] = ex(Vdc)
    pins['vout.pp'] = ex(2 * Vdc)
  } else {
    pins['vout.avg'] = ex(p.D * Vdc, Vdc)
    pins['vout.rms'] = ex(Math.sqrt(p.D) * Vdc)
    pins['vout.min'] = zero(Vdc)
    pins['vout.max'] = ex(Vdc)
    pins['vout.pp'] = ex(Vdc)
  }

  // The rotor's own voltage. Its average is the averaged machine's answer,
  // which is exact here; its ripple is not a quantity that model carries.
  const emf = mach.ke * a.omega
  pins['vemf.avg'] = ap(emf, 1e-6, Math.max(1e-9, Math.abs(emf)))
  pins['vemf.rms'] = { lo: Math.abs(sig.vemf.avg), hi: Math.abs(sig.vemf.avg) + sig.vemf.pp }
  pins['vemf.min'] = { lo: sig.vemf.avg - sig.vemf.pp, hi: sig.vemf.avg }
  pins['vemf.max'] = { lo: sig.vemf.avg, hi: sig.vemf.avg + sig.vemf.pp }
  unpinned['vemf.pp'] = SPEED_RIPPLE

  // The armature. Its average is the averaged machine's, its ripple the
  // written form, and the extremes the two together.
  const dI = armatureRipple(conv.kind, { Vdc, D: p.D, La: mach.La, fs: p.fs, bipolar: conv.bipolar })
  const rel = 1e-3
  pins['iL.avg'] = ap(a.ia, 1e-6, Math.max(1e-9, Math.abs(a.ia)))
  pins['iL.pp'] = ap(dI, rel)
  pins['iL.max'] = ap(a.ia + dI / 2, rel)
  pins['iL.min'] = ap(a.ia - dI / 2, rel, Math.max(Math.abs(a.ia - dI / 2), dI))
  pins['iL.rms'] = ap(Math.sqrt(a.ia * a.ia + (dI * dI) / 12), rel)

  // Across the winding: zero on average, and bracketed by the two ends it is
  // the difference of.
  pins['vL.avg'] = zero(Vdc)
  const vHi = sig.vout.max - mach.Ra * sig.iL.min - sig.vemf.min
  const vLo = sig.vout.min - mach.Ra * sig.iL.max - sig.vemf.max
  pins['vL.max'] = { lo: sig.vout.max - mach.Ra * sig.iL.max - sig.vemf.max, hi: vHi }
  pins['vL.min'] = { lo: vLo, hi: sig.vout.min - mach.Ra * sig.iL.min - sig.vemf.min }
  pins['vL.pp'] = { lo: 0, hi: vHi - vLo }
  pins['vL.rms'] = { lo: 0, hi: Math.max(Math.abs(vHi), Math.abs(vLo)) }

  // The switch carries the armature current while it is closed and nothing
  // otherwise, so its extremes are the armature's and zero, exactly.
  pins['iQ.min'] = zero(iScale)
  pins['iQ.max'] = ex(iHi, iScale)
  pins['iQ.pp'] = ex(iHi, iScale)
  // The ramp inside the interval is a straight line to the ripple's own
  // accuracy, so the interval's mean is the midpoint of the two extremes.
  const mid = (sig.iL.min + sig.iL.max) / 2
  pins['iQ.avg'] = ap(p.D * mid, 3e-3, Math.max(Math.abs(p.D * mid), 1e-9))
  pins['iQ.rms'] = ap(Math.sqrt(p.D) * sig.iL.rms, 3e-3)

  if (bridge) {
    // The rail carries the armature current one way for the positive interval
    // and the other way for the negative one, so its magnitude is the
    // armature's everywhere.
    pins['iin.rms'] = ex(sig.iL.rms, iScale)
    pins['iin.max'] = ex(iHi, iScale)
    pins['iin.min'] = ex(-iHi, iScale)
    pins['iin.pp'] = ex(2 * iHi, iScale)
    pins['iin.avg'] = ap((2 * p.D - 1) * mid, 5e-3, Math.max(Math.abs((2 * p.D - 1) * mid), 1e-9))
  } else {
    // The diode carries what the switch does not, at every instant.
    pins['iD.min'] = zero(iScale)
    pins['iD.max'] = ex(iHi, iScale)
    pins['iD.pp'] = ex(iHi, iScale)
    pins['iD.avg'] = ex(sig.iL.avg - sig.iQ.avg, iScale)
    pins['iD.rms'] = ap(Math.sqrt(1 - p.D) * sig.iL.rms, 3e-3)
    same(pins, 'iin', 'iQ', sig)
  }
  return { pins, unpinned }
}

// ---------------------------------------------------------------- the input side

const FILTER_SHAPE =
  'the line current is the pulse train through a second-order filter, so its extremes are set by the filter’s own ringing between edges and have no first-order form; its average is pinned by charge balance and its harmonics against |H| in lmn.test.js'
const CAP_SHAPE =
  'the input capacitor carries the difference of a pulse train and a filtered current, so its extremes fall wherever the two cross; the average is pinned at zero and the RMS bracketed by the two currents it is made of'

function emiPins(x, params) {
  const { sig } = x.m
  const p = emiParams(params)
  const { Vin, D, L, C, R, Cin, Rf, Rd, fs } = p
  const pins = {}
  const unpinned = {}
  const iScale = Math.max(1e-9, Math.abs(sig.iL.max))
  const vScale = Vin

  // The input capacitor sits a DC drop below the rail, across the line
  // branch's own resistance: R_f in parallel with the damping.
  const Rdc = (Rf * Rd) / (Rf + Rd)
  pins['vcin.avg'] = ap(Vin - sig.iline.avg * Rdc, 1e-6, vScale)
  // What the switch takes and the line does not supply comes out of the
  // capacitor, so its ripple is the pulse's own charge over C_in.
  const dV = (sig.iL.avg * D * (1 - D)) / (Cin * fs)
  pins['vcin.pp'] = ap(dV, 0.15)
  pins['vcin.max'] = { lo: sig.vcin.avg, hi: sig.vcin.avg + sig.vcin.pp }
  pins['vcin.min'] = { lo: sig.vcin.avg - sig.vcin.pp, hi: sig.vcin.avg }
  pins['vcin.rms'] = { lo: Math.abs(sig.vcin.avg), hi: Math.abs(sig.vcin.avg) + sig.vcin.pp }

  // The switch node: the capacitor's voltage while the high side conducts,
  // and zero while the low side does. Its average is the output's, because
  // the inductor's average voltage is zero.
  pins['vsw.avg'] = ex(sig.vout.avg, vScale)
  pins['vsw.min'] = zero(vScale)
  pins['vsw.max'] = ex(sig.vcin.max, vScale)
  pins['vsw.pp'] = ex(sig.vcin.max, vScale)
  pins['vsw.rms'] = ap(Math.sqrt(D) * sig.vcin.avg, 0.02)

  // The output: the node's average, less nothing, with the filter's own
  // triangle on it.
  pins['vout.avg'] = ap(D * sig.vcin.avg, 0.02)
  const dI = ((sig.vcin.avg - sig.vout.avg) * D) / (L * fs)
  const dVo = dI / (8 * fs * C)
  pins['vout.pp'] = ap(dVo, 0.1)
  pins['vout.max'] = ap(sig.vout.avg + dVo / 2, 0.1, Math.max(Math.abs(sig.vout.avg), dVo))
  pins['vout.min'] = ap(sig.vout.avg - dVo / 2, 0.1, Math.max(Math.abs(sig.vout.avg), dVo))
  pins['vout.rms'] = { lo: Math.abs(sig.vout.avg), hi: Math.abs(sig.vout.avg) + sig.vout.pp }

  // The inductor: the load current with the switched triangle on it.
  pins['iL.avg'] = ap(sig.vout.avg / R, 1e-6, iScale)
  pins['iL.pp'] = ap(dI, 0.02)
  pins['iL.max'] = ap(sig.iL.avg + dI / 2, 0.02, iScale)
  pins['iL.min'] = ap(sig.iL.avg - dI / 2, 0.02, iScale)
  pins['iL.rms'] = ap(Math.sqrt(sig.iL.avg ** 2 + (dI * dI) / 12), 0.02)

  // What the converter draws: the inductor's current gated by the switch.
  const mid = (sig.iL.min + sig.iL.max) / 2
  pins['iin.avg'] = ap(D * mid, 5e-3, Math.max(Math.abs(D * mid), 1e-9))
  pins['iin.min'] = zero(iScale)
  pins['iin.max'] = ex(Math.max(0, sig.iL.max), iScale)
  pins['iin.pp'] = ex(Math.max(0, sig.iL.max), iScale)
  pins['iin.rms'] = ap(Math.sqrt(D) * sig.iL.rms, 0.02)

  // What the source supplies: the same charge each period, spread by the
  // filter. Its shape is the filter's, not the converter's.
  pins['iline.avg'] = ex(sig.iin.avg, iScale)
  for (const s of ['rms', 'min', 'max', 'pp']) unpinned[`iline.${s}`] = FILTER_SHAPE

  // The difference between them is the capacitor's own current, which stores
  // nothing over a period.
  pins['icin.avg'] = zero(iScale)
  pins['icin.rms'] = { lo: 0, hi: sig.iin.rms + sig.iline.rms }
  pins['icin.max'] = { lo: 0, hi: sig.iin.max + Math.abs(sig.iline.min) }
  pins['icin.min'] = { lo: -(sig.iin.max + sig.iline.max), hi: 0 }
  unpinned['icin.pp'] = CAP_SHAPE
  return { pins, unpinned }
}

// ---------------------------------------------------------------- the switch node

const RING_SHAPE =
  'the node is a second-order circuit stepped twice a period, so everything but its average is the ring’s own transient; the frequency, the overshoot and the peak are pinned against the closed forms in lmn.test.js'

function ringPins(x, params) {
  const { sig } = x.m
  const p = ringParams(params)
  const { Vin, D, L, C, R, RL, fs } = p
  const r = x.formulas
  const pins = {}
  const unpinned = {}
  const vScale = Vin
  const iScale = Math.max(1e-9, Math.abs(sig.iL.max))

  // The parasitic inductance carries no series resistance, so its average
  // voltage is zero and the node's average is the drive's, exactly.
  pins['vsw.avg'] = ap(D * Vin, 1e-6, vScale)
  // The first peak of a step response, from the damping the loop has.
  pins['vsw.max'] = ap(Vin * (1 + r.overshoot), 0.05, vScale)
  pins['vsw.min'] = { lo: -Vin * (r.overshoot + 0.05), hi: 0.05 * Vin }
  pins['vsw.pp'] = { lo: Vin, hi: Vin * (2 + 2 * r.overshoot) }
  pins['vsw.rms'] = { lo: 0, hi: Vin * (1 + r.overshoot) }

  // The output: the node's average through a lossless inductor.
  pins['vout.avg'] = ap(sig.vsw.avg - RL * sig.iL.avg, 1e-6, vScale)
  // The node is at the rail while the high side conducts, so what drives the
  // inductor over that interval is the rail less the output.
  const dI = ((Vin - sig.vout.avg) * D) / (L * fs)
  const dVo = dI / (8 * fs * C)
  pins['vout.pp'] = ap(dVo, 0.15)
  pins['vout.max'] = ap(sig.vout.avg + dVo / 2, 0.15, Math.max(Math.abs(sig.vout.avg), dVo))
  pins['vout.min'] = ap(sig.vout.avg - dVo / 2, 0.15, Math.max(Math.abs(sig.vout.avg), dVo))
  pins['vout.rms'] = { lo: Math.abs(sig.vout.avg), hi: Math.abs(sig.vout.avg) + sig.vout.pp }

  pins['vL.avg'] = zero(vScale)
  pins['vL.max'] = { lo: 0, hi: sig.vsw.max - sig.vout.min }
  pins['vL.min'] = { lo: sig.vsw.min - sig.vout.max, hi: 0 }
  pins['vL.pp'] = { lo: 0, hi: sig.vsw.max - sig.vsw.min + sig.vout.pp }
  pins['vL.rms'] = { lo: 0, hi: sig.vsw.max - sig.vsw.min + sig.vout.pp }

  pins['iL.avg'] = ap(sig.vout.avg / R, 1e-6, iScale)
  pins['iL.pp'] = ap(dI, 0.05)
  pins['iL.max'] = ap(sig.iL.avg + dI / 2, 0.05, iScale)
  pins['iL.min'] = ap(sig.iL.avg - dI / 2, 0.05, iScale)
  pins['iL.rms'] = ap(Math.sqrt(sig.iL.avg ** 2 + (dI * dI) / 12), 0.05)

  // The rail supplies the loop while the high side conducts. Over a period
  // that is the load current times the duty, plus what the ring borrows and
  // gives back.
  pins['iin.avg'] = ap(D * sig.iL.avg, 0.1, Math.max(Math.abs(D * sig.iL.avg), 1e-9))
  for (const s of ['rms', 'min', 'max', 'pp']) unpinned[`iin.${s}`] = RING_SHAPE
  return { pins, unpinned }
}

/** Which set of forms an experiment's drawing asks for. */
export const LMN_PINS = {
  dcdrive: drivePins,
  hbridge: drivePins,
  bldc: drivePins,
  emi: emiPins,
  ringing: ringPins,
}
