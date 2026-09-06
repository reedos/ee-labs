// Every cell of the measures table, for the six experiments of Groups J and
// K, pinned to a closed form or excused by name.
//
// `pins.test.js` owns the walk and the helpers; this file owns the two
// families' rows. A pin is `[value, tolerance]` or `{ lo, hi }` bounds, and a
// bound is a claim as much as a closed form is: a rectifier's current is
// never negative, a switch carries no more than the inductor it feeds, an
// RMS is at least the mean it is taken about. Where neither exists the cell
// is named in `unpinned` with the reason, and the walk holds that reason to
// being a sentence.

const STATS = ['avg', 'rms', 'min', 'max', 'pp']

const NO_TANK_FORM =
  'the tank current is a piece of a sine whose amplitude the whole tank sets, and the first-harmonic form that would give it is the approximation this experiment is about'
const NO_RECT_RIPPLE =
  'the output capacitor is charged by a rectified sine and discharged by the load, so where the ripple turns depends on the tank rather than on a triangle, and no first-order form places it'
const NO_SWITCH_FORM =
  'the switch carries the primary current, which is the output inductor and the magnetising current added at the two half cycles own resistances, and the two peak at different instants'
const NO_VL_RMS =
  'the inductor sees the pulse, the freewheel drop and, at light load, nothing at all, so its RMS carries the length of a dead interval the small-ripple form does not know about'

/** The forward, the push-pull and the full bridge: one output side, three primaries. */
function forwardPins(x, params, H) {
  const { ex, ap, zero } = H
  const { sig } = x.m
  const f = x.formulas
  const p = x.p
  const { L, C, fs, R, Vf, RL, ESR } = p
  const n = f.n
  const pair = x.kind !== 'forward'
  const vp = f.pulse
  const dcm = x.ss.mode === 'DCM'
  const ron = Math.max(f.Ron1, f.Ron2)
  const pins = {}
  const unpinned = {}
  const Io = sig.vout.avg / R
  // The largest the reflected switch drop can be at any instant: the drawing
  // of the on interval carries n²R_on of inductor current and n·R_on of
  // magnetising current, and both are bounded by their own peaks.
  const drop = ron * (n * n * Math.max(Math.abs(sig.iL.max), Math.abs(sig.iL.min)) + n * Math.max(Math.abs(sig.iM.max), Math.abs(sig.iM.min)))
  const scale = Math.max(1, Math.abs(vp))

  // Kirchhoff, on the measured averages: the switch node is the output plus
  // the winding's drop plus the inductor's own average voltage, which is zero.
  pins['vsw.avg'] = ex(sig.vout.avg + RL * sig.iL.avg, scale)
  pins['vsw.max'] = { lo: vp - Vf - drop - 1e-9 * scale, hi: vp - Vf + 1e-9 * scale }
  // The freewheel path is the rectifier's drop and nothing else, so the
  // lowest the node reaches is that drop, negative.
  pins['vsw.min'] = ex(-Vf, scale)
  pins['vsw.pp'] = { lo: vp - drop - 1e-9 * scale, hi: vp + 1e-9 * scale }
  pins['vsw.rms'] = { lo: Math.abs(sig.vsw.avg), hi: Math.max(vp, Vf) + 1e-9 * scale }

  // Charge balance puts the load current at the inductor's average.
  pins['vout.avg'] = ex(R * sig.iL.avg)
  pins['vout.rms'] = { lo: Math.abs(sig.vout.avg), hi: Math.max(Math.abs(sig.vout.max), Math.abs(sig.vout.min)) + 1e-12 }
  if (dcm || ESR > 0) {
    for (const s of ['min', 'max', 'pp']) {
      unpinned[`vout.${s}`] = dcm
        ? 'the dead interval leaves the capacitor alone with the load for a stretch the triangle form does not carry, so where the ripple turns is not where that form puts it'
        : 'the capacitor series resistance puts a step on the ripple at each switching edge, and the triangle form has no step in it'
    }
  } else {
    pins['vout.pp'] = ap(f.dV, 5e-2)
    pins['vout.max'] = [sig.vout.avg + f.dV / 2, 0.25 * f.dV]
    pins['vout.min'] = [sig.vout.avg - f.dV / 2, 0.25 * f.dV]
  }

  pins['vL.avg'] = zero(scale)
  pins['vL.max'] = ap(pins['vsw.max'].hi - sig.vout.min - RL * sig.iL.min, 5e-2, scale)
  pins['vL.min'] = ap(-Vf - sig.vout.max - RL * sig.iL.max, 5e-2, scale)
  pins['vL.pp'] = ap(pins['vL.max'][0] - pins['vL.min'][0], 5e-2, scale)
  unpinned['vL.rms'] = NO_VL_RMS

  pins['iL.avg'] = ex(Io, Math.max(1, Math.abs(Io)))
  if (dcm) {
    pins['iL.min'] = zero(Math.max(1e-6, sig.iL.max))
    for (const s of ['rms', 'max', 'pp']) {
      unpinned[`iL.${s}`] = 'the inductor empties before the period ends, so its ramp is not the triangle the continuous-conduction forms describe'
    }
  } else {
    pins['iL.pp'] = ap(f.dI, 3e-2)
    pins['iL.max'] = ap(Io + f.dI / 2, 3e-2)
    pins['iL.min'] = ap(Io - f.dI / 2, 3e-2, Math.max(Math.abs(Io - f.dI / 2), f.dI))
    pins['iL.rms'] = ap(Math.sqrt(Io * Io + (f.dI * f.dI) / 12), 3e-2)
  }

  // The rectifier is one drop in the output path, so it carries the output
  // inductor's current in every interval the inductor has one.
  H.same(pins, 'iD', 'iL', sig)

  pins['iC.avg'] = zero(Math.max(1e-6, Math.abs(Io)))
  if (dcm) {
    for (const s of ['rms', 'min', 'max', 'pp']) {
      unpinned[`iC.${s}`] = 'the capacitor carries the whole load current through the dead interval and the inductor’s triangle through the rest, and the triangle form knows only the second of the two'
    }
  } else {
    const dic = f.dI / (1 + ESR / R)
    pins['iC.rms'] = ap(dic / Math.sqrt(12), 3e-2)
    pins['iC.max'] = ap(dic / 2, 5e-3, dic)
    pins['iC.min'] = ap(-dic / 2, 5e-3, dic)
    pins['iC.pp'] = ap(dic, 3e-2)
  }

  const iMpk = Math.max(Math.abs(sig.iM.max), Math.abs(sig.iM.min))
  const iScale = Math.max(1, n * Math.abs(sig.iL.max) + iMpk)
  if (pair) {
    // The rail carries whatever the conducting switch does.
    H.same(pins, 'iin', 'iQ', sig)
    pins['iQ.avg'] = ex(x.m.Pin / p.Vin, Math.max(1, Math.abs(x.m.Pin / p.Vin)))
    pins['iQ.max'] = { lo: 0, hi: n * sig.iL.max + iMpk + 1e-9 * iScale }
    pins['iQ.min'] = { lo: n * Math.min(0, sig.iL.min) - iMpk - 1e-9 * iScale, hi: 1e-9 * iScale }
    pins['iQ.pp'] = { lo: 0, hi: pins['iQ.max'].hi - pins['iQ.min'].lo }
    unpinned['iQ.rms'] = NO_SWITCH_FORM
  } else {
    // The forward's switch carries the primary current for its own interval,
    // and both parts of it peak at the instant the switch opens.
    pins['iQ.max'] = ex(n * sig.iL.max + sig.iM.max, iScale)
    pins['iQ.min'] = zero(iScale)
    pins['iQ.pp'] = ex(n * sig.iL.max + sig.iM.max, iScale)
    pins['iQ.avg'] = { lo: 0, hi: n * sig.iL.max + sig.iM.max + 1e-9 * iScale }
    unpinned['iQ.rms'] = NO_SWITCH_FORM
    // The rail supplies the switch and takes the magnetising current back
    // through the reset winding, so its own extremes are those two.
    pins['iin.avg'] = ex(x.m.Pin / p.Vin, Math.max(1, Math.abs(x.m.Pin / p.Vin)))
    pins['iin.max'] = ex(n * sig.iL.max + sig.iM.max, iScale)
    pins['iin.min'] = ex(-sig.iM.max / p.nr, iScale)
    pins['iin.pp'] = ex(n * sig.iL.max + sig.iM.max + sig.iM.max / p.nr, iScale)
    unpinned['iin.rms'] = NO_SWITCH_FORM
  }
  return { pins, unpinned }
}

/** The series tank and the LLC: one square drive, one rectifier, one filter. */
function resonantPins(x, params, H) {
  const { ex, zero } = H
  const { sig } = x.m
  const f = x.formulas
  const p = x.p
  const R = p.R
  const n = f.n
  const half = p.Vin / 2
  const pins = {}
  const unpinned = {}
  const iScale = Math.max(1e-6, Math.abs(sig.iL.max), Math.abs(sig.iL.min))

  // The half bridge holds the switch node at one rail and then the other,
  // for equal times, so it is an exact square between 0 and V_in. Its mean is
  // half the rail and its RMS the rail over √2.
  pins['vsw.avg'] = ex(half)
  pins['vsw.rms'] = ex(p.Vin / Math.SQRT2)
  pins['vsw.min'] = zero(half)
  pins['vsw.max'] = ex(p.Vin)
  pins['vsw.pp'] = ex(p.Vin)

  // Charge balance on the output capacitor: what the rectifier delivers is
  // what the load takes.
  pins['vout.avg'] = ex(R * sig.iD.avg, Math.max(1, Math.abs(sig.vout.avg)))
  pins['vout.rms'] = { lo: Math.abs(sig.vout.avg), hi: Math.max(Math.abs(sig.vout.max), Math.abs(sig.vout.min)) + 1e-12 }
  for (const s of ['min', 'max', 'pp']) unpinned[`vout.${s}`] = NO_RECT_RIPPLE

  // The tank capacitor is in series with the tank, so its charge balance is
  // the statement that the tank current has no DC in it at all.
  pins['iL.avg'] = zero(iScale)
  for (const s of ['rms', 'min', 'max', 'pp']) unpinned[`iL.${s}`] = NO_TANK_FORM

  // The rectifier passes the transformer's current one way, so it is the
  // magnitude of that current divided by the turns, and never negative.
  const iT = x.m.sig.iT
  const iTpk = Math.max(Math.abs(iT.max), Math.abs(iT.min))
  pins['iD.avg'] = ex(sig.vout.avg / R, Math.max(1e-6, Math.abs(sig.vout.avg / R)))
  pins['iD.min'] = zero(iScale)
  pins['iD.max'] = ex(iTpk / n, Math.max(1e-6, iTpk / n))
  pins['iD.pp'] = ex(iTpk / n, Math.max(1e-6, iTpk / n))
  pins['iD.rms'] = ex(iT.rms / n, Math.max(1e-6, iT.rms / n))

  // The capacitor takes what the rectifier delivers less what the load draws,
  // at every instant, so its extremes are bracketed by the rectifier's.
  const eps = 1e-9 * Math.max(1e-6, sig.iD.max)
  pins['iC.avg'] = zero(Math.max(1e-6, sig.iD.avg))
  pins['iC.max'] = { lo: sig.iD.max - sig.vout.max / R - eps, hi: sig.iD.max - sig.vout.min / R + eps }
  pins['iC.min'] = { lo: -sig.vout.max / R - eps, hi: eps }
  pins['iC.pp'] = { lo: 0, hi: sig.iD.max + sig.vout.max / R + eps }
  pins['iC.rms'] = { lo: 0, hi: Math.max(Math.abs(sig.iC.max), Math.abs(sig.iC.min)) + eps }

  // The upper switch carries the tank current for its own half period and
  // nothing for the other, and the rail sees exactly that.
  pins['iQ.avg'] = ex(x.m.Pin / p.Vin, Math.max(1e-6, Math.abs(x.m.Pin / p.Vin)))
  pins['iQ.max'] = { lo: -1e-9 * iScale, hi: Math.max(0, sig.iL.max) + 1e-9 * iScale }
  pins['iQ.min'] = { lo: Math.min(0, sig.iL.min) - 1e-9 * iScale, hi: 1e-9 * iScale }
  pins['iQ.pp'] = { lo: 0, hi: sig.iL.pp + 1e-9 * iScale }
  pins['iQ.rms'] = { lo: 0, hi: sig.iL.rms + 1e-9 * iScale }
  return { pins, unpinned }
}

/** Keyed by topology, which for these groups is the converter's own name. */
export const JK_PINNERS = {
  forward: forwardPins,
  pushpull: forwardPins,
  fullbridge: forwardPins,
  src: resonantPins,
  llc: resonantPins,
}

export { STATS }
