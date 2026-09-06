// The diode, in four models — and the op-amp's rails, which are the same idea.
//
// A diode is the first element in this suite whose law is not a straight line.
// Rather than hide that behind a solver, the lab offers the four descriptions a
// course actually uses, each an approximation of the next:
//
//   ideal   a switch: 0 V when it conducts, no current when it does not
//   drop    a switch behind a battery: V_f while conducting
//   pwl     that battery behind a resistance: v = V_f + i·r_d
//   exp     Shockley: i = I_s (e^{v/nV_T} − 1), the curve the others approximate
//
// The first three are PIECEWISE-LINEAR: inside a region — conducting, or not —
// the circuit is linear and every exact method in this package applies. The
// regions meet at boundaries (the current reaching zero, the voltage reaching
// V_f) and those are events, found by bisection on the exact solution rather
// than by stepping (pwl.js). The fourth is genuinely nonlinear and is solved
// only for DC operating points, by Newton's method, with the iterations shown
// (pwl.js again) — in time it is refused with the reason, because a timestep
// solver's error is not something this suite can tell apart from physics.
//
// An op-amp with rails is piecewise-linear in exactly the same way: it is the
// nullor of mna.js while its output is between the rails, and a voltage source
// at ±V_sat once it is against one. Same regions, same guards, same events —
// which is why the Schmitt trigger (E9) and the rectifier (I4) are one
// mechanism, not two.
//
// Sign convention, as everywhere in this package: nodes[0] is the anode, and
// current is positive flowing in at the anode — so a conducting diode has
// i > 0 and v = V_f, and a blocking one has i = 0 and v below V_f.

import { GROUND, NetworkError } from './netlist.js'
import { K_B, Q_E, T_ROOM, VT, thermalVoltage } from './physics.js'
import { BJT_REGIONS, bjtFlipTo, bjtMargins, bjtOf, bjtRegionElements, bjtRegionLabel } from './bjt.js'
import { MOSFET_SWITCH_REGIONS, mosfetFlipTo, mosfetMargins, mosfetOf, mosfetRegionElements, mosfetRegionLabel } from './mosfet.js'

export { K_B, Q_E, T_ROOM, VT, thermalVoltage }

/** What a diode is, with the defaults a small-signal silicon part would carry. */
export const DIODE_DEFAULTS = { model: 'drop', vf: 0.7, rd: 10, is: 1e-14, n: 1, vt: VT, vz: null, roff: null }

/** The models, in the order the curriculum meets them, with what each one is. */
export const DIODE_MODELS = {
  ideal: { label: 'ideal switch', about: '0 V while it conducts, no current while it does not' },
  drop: { label: 'constant drop', about: 'a switch behind a battery of V_f' },
  pwl: { label: 'V_f + r_d', about: 'that battery behind a resistance, so the curve has a slope' },
  exp: { label: 'exponential', about: 'i = I_s(e^{v/nV_T} − 1) — the curve the other three approximate' },
}

/** A diode element's parameters, defaults filled in. */
export function diodeOf(e) {
  const d = { ...DIODE_DEFAULTS, ...e }
  if (!DIODE_MODELS[d.model]) throw new NetworkError('kind', `${e.id}: unknown diode model "${d.model}"`)
  if (!(d.vt > 0)) throw new NetworkError('value', `${e.id}: the thermal voltage must be positive`)
  if (d.model !== 'ideal' && !(d.vf >= 0)) throw new NetworkError('value', `${e.id}: V_f cannot be negative`)
  if (d.model === 'pwl' && !(d.rd > 0)) throw new NetworkError('value', `${e.id}: r_d must be positive`)
  if (d.model === 'exp' && !(d.is > 0)) throw new NetworkError('value', `${e.id}: I_s must be positive`)
  if (d.model === 'ideal') d.vf = 0
  return d
}

/** The forward drop the region model uses: zero for the ideal switch. */
export const forwardDrop = (e) => diodeOf(e).vf

/** Shockley's law and its slope at v, for the exponential model. */
export function shockley(d, v) {
  const nvt = d.n * d.vt
  const ex = Math.exp(v / nvt)
  return { i: d.is * (ex - 1), g: (d.is / nvt) * ex }
}

/**
 * The current a diode of any model passes at v — the four curves I1 overlays.
 * The piecewise models are evaluated as the ideal limit of their region: the
 * constant-drop diode passes no current below V_f and any current at V_f, so
 * its "curve" is drawn as the two straight pieces it is.
 */
export function diodeCurrent(e, v) {
  const d = diodeOf(e)
  switch (d.model) {
    case 'exp':
      return shockley(d, v).i
    case 'pwl':
      return v > d.vf ? (v - d.vf) / d.rd : 0
    default:
      // ideal and drop conduct at v = V_f with the current the rest of the
      // circuit decides; as a curve, that is the vertical line at V_f.
      return v >= d.vf ? Infinity : 0
  }
}

/** The small-signal resistance of the exponential diode at a current: r_d = nV_T/I, the 60 mV/decade rule's other face. */
export function smallSignalR(e, i) {
  const d = diodeOf(e)
  return (d.n * d.vt) / (i + d.is)
}

/** Volts per decade of current on the exponential curve: nV_T ln 10 ≈ 60 mV. */
export function decadeSlope(e) {
  const d = diodeOf(e)
  return d.n * d.vt * Math.LN10
}

// ------------------------------------------------------------ regions

/**
 * Which regions a device can be in, in the order the assumed-state method
 * enumerates them. A diode is on or off; a Zener has a third, its breakdown;
 * an op-amp with rails is linear or against one of them.
 */
export function regionsOf(e) {
  if (e.type === 'D') {
    const d = diodeOf(e)
    if (d.model === 'exp') return null // not piecewise: Newton's, at DC only
    return Number.isFinite(d.vz) && d.vz > 0 ? ['on', 'off', 'zener'] : ['on', 'off']
  }
  // The three-region BJT is piecewise-linear the way the constant-drop diode
  // is: three straight pieces with guards between them. The square-law MOSFET
  // is not — it is a curve inside two of its regions, so it goes to Newton —
  // but the switch model of the same device is two pieces again.
  if (e.type === 'Q' && bjtOf(e).model === 'regions') return BJT_REGIONS
  if (e.type === 'M' && mosfetOf(e).model === 'switch') return MOSFET_SWITCH_REGIONS
  // A controlled source with a current limit is piecewise-linear in the same
  // way a diode is: it is the source it claims to be until the current it
  // would deliver reaches the limit, and a fixed current after that. That is
  // what a slew rate is — the op-amp macro's transconductance stage cannot
  // charge its compensation capacitor faster than I_max/C.
  if (e.type === 'VCCS' && Number.isFinite(e.ilimit) && e.ilimit > 0) return ['ipos', 'ineg', 'linear']
  // Rails first, and the linear region last, because of what "consistent"
  // means for an op-amp with POSITIVE feedback: all three states can satisfy
  // their own guards at once (E9), and the linear one is the unstable
  // equilibrium — a pencil on its point. A real circuit is never found there,
  // so when more than one state fits, the search should not offer it first.
  // With negative feedback nothing is lost: a rail contradicts itself unless
  // the amplifier really is against it.
  if (e.type === 'OPAMP') {
    const rails = Number.isFinite(e.vsat)
    const limit = Number.isFinite(e.imax) && e.imax > 0
    if (rails && limit) return ['high', 'low', 'ipos', 'ineg', 'linear']
    if (rails) return ['high', 'low', 'linear']
    if (limit) return ['ipos', 'ineg', 'linear']
  }
  return null
}

/** The region a device sits in when nothing else is said. */
export const restingRegion = (e) => (e.type === 'OPAMP' || e.type === 'VCCS' ? 'linear' : e.type === 'Q' ? 'active' : 'off')

/** Every element in the netlist that has regions, with them. */
export function regionDevices(norm) {
  const out = []
  for (const e of norm.elements) {
    const regions = regionsOf(e)
    if (regions) out.push({ id: e.id, type: e.type, regions, element: e })
  }
  return out
}

/** The region each device starts in when nothing else is said: a diode off, an op-amp in its linear region. */
export function defaultRegions(norm) {
  const out = {}
  for (const d of regionDevices(norm)) out[d.id] = restingRegion(d.element)
  return out
}

/**
 * The linear element a device becomes in a region — what mna.js stamps.
 * `GI` is a conductance g with a current source in parallel, the companion
 * form: i = g·v + i0. It is how the sloped model and Newton's linearisation
 * both enter the matrix without needing an internal node.
 */
export function regionEffective(e, region) {
  // A transistor is several elements at once, so these two return a list and
  // mna.js flattens it. Everything else returns the one element it becomes.
  if (e.type === 'Q') return bjtRegionElements(e, region)
  if (e.type === 'M') return mosfetRegionElements(e, region)
  if (e.type === 'D') {
    const d = diodeOf(e)
    switch (region) {
      case 'on':
        if (d.model === 'pwl') return { ...e, type: 'GI', g: 1 / d.rd, i0: -d.vf / d.rd, from: 'D' }
        return { ...e, type: 'V', value: d.vf, from: 'D' }
      case 'zener':
        return { ...e, type: 'V', value: -d.vz, from: 'D' }
      case 'off':
      default:
        return d.roff > 0 ? { ...e, type: 'R', value: d.roff, from: 'D' } : { ...e, type: 'OPEN', from: 'D' }
    }
  }
  if (e.type === 'VCCS') {
    // At the limit the source delivers ±I_max, in the direction its own
    // current flows: in at nodes[0], out at nodes[1], the package's
    // convention for every element.
    if (region === 'ipos') return { ...e, type: 'I', value: e.ilimit, from: 'VCCS' }
    if (region === 'ineg') return { ...e, type: 'I', value: -e.ilimit, from: 'VCCS' }
    return e
  }
  if (e.type === 'OPAMP') {
    if (region === 'high' || region === 'low')
      return { ...e, type: 'V', nodes: [e.nodes[0], GROUND], value: region === 'high' ? e.vsat : -e.vsat, from: 'OPAMP' }
    // Against its output current limit the op-amp is a current source: the
    // element's own current is the negative of what it delivers, so pushing
    // +I_max into the load is a branch current of −I_max.
    if (region === 'ipos') return { ...e, type: 'I', nodes: [e.nodes[0], GROUND], value: -e.imax, from: 'OPAMP' }
    if (region === 'ineg') return { ...e, type: 'I', nodes: [e.nodes[0], GROUND], value: e.imax, from: 'OPAMP' }
    return e
  }
  return e
}

/**
 * How far inside its region a device is, from a solved circuit: positive means
 * the assumption holds, negative means it is contradicted, and zero is the
 * boundary — the event. Each margin is the quantity a student would check.
 *
 * Returns a list because a region can have two walls (the linear op-amp has
 * both rails), and the one that reaches zero first is the event.
 */
export function regionMargins(e, region, sol) {
  if (e.type === 'Q') return bjtMargins(e, region, sol)
  if (e.type === 'M') return mosfetMargins(e, region, sol)
  const i = sol.i[e.id]
  const v = sol.volt[e.id]
  if (e.type === 'D') {
    const d = diodeOf(e)
    switch (region) {
      case 'on':
        // Conducting: the current has to be forward. (With r_d that is the
        // same statement as v > V_f, scaled by r_d.)
        return [{ what: 'i', margin: i, says: `i_${e.id} ≥ 0` }]
      case 'zener':
        return [{ what: 'i', margin: -i, says: `i_${e.id} ≤ 0` }]
      case 'off':
      default: {
        const walls = [{ what: 'v', margin: d.vf - v, says: `v_${e.id} ≤ ${d.model === 'ideal' ? '0' : 'V_f'}` }]
        if (Number.isFinite(d.vz) && d.vz > 0) walls.push({ what: 'vz', margin: v + d.vz, says: `v_${e.id} ≥ −V_z` })
        return walls
      }
    }
  }
  if (e.type === 'VCCS') {
    const want = e.gain * (sol.v[e.ctrl[0]] - sol.v[e.ctrl[1]])
    switch (region) {
      case 'ipos':
        return [{ what: 'ipos', margin: want - e.ilimit, says: `g·v_c ≥ +I_max` }]
      case 'ineg':
        return [{ what: 'ineg', margin: -e.ilimit - want, says: `g·v_c ≤ −I_max` }]
      case 'linear':
      default:
        return [
          { what: 'ipos', margin: e.ilimit - i, says: `i_${e.id} ≤ +I_max` },
          { what: 'ineg', margin: i + e.ilimit, says: `i_${e.id} ≥ −I_max` },
        ]
    }
  }
  if (e.type === 'OPAMP') {
    const vout = sol.v[e.nodes[0]]
    const diff = sol.v[e.ctrl[0]] - sol.v[e.ctrl[1]]
    // What the amplifier would put at its output if nothing stopped it. With
    // an infinite gain that is a sign test, and with a finite one it is a
    // voltage: A·(v₊ − v₋) against the rail.
    const finite = Number.isFinite(e.gain)
    const wants = finite ? e.gain * diff : diff
    const rails = Number.isFinite(e.vsat)
    const limit = Number.isFinite(e.imax) && e.imax > 0
    const walls = []
    switch (region) {
      case 'high':
        walls.push({ what: 'diff', margin: finite ? wants - e.vsat : diff, says: finite ? `A(v₊ − v₋) ≥ +V_sat` : `v₊ − v₋ ≥ 0` })
        break
      case 'low':
        walls.push({ what: 'diff', margin: finite ? -e.vsat - wants : -diff, says: finite ? `A(v₊ − v₋) ≤ −V_sat` : `v₊ − v₋ ≤ 0` })
        break
      case 'ipos':
        // Delivering all it can: the output it wants is still above the one
        // the limited current produced.
        walls.push({ what: 'ipos', margin: wants - vout, says: `A(v₊ − v₋) ≥ v_out` })
        break
      case 'ineg':
        walls.push({ what: 'ineg', margin: vout - wants, says: `A(v₊ − v₋) ≤ v_out` })
        break
      case 'linear':
      default:
        if (rails) {
          walls.push({ what: 'high', margin: e.vsat - vout, says: `v_out ≤ +V_sat` })
          walls.push({ what: 'low', margin: vout + e.vsat, says: `v_out ≥ −V_sat` })
        }
        break
    }
    // The output current limit binds in every region but the two it names:
    // the branch current is the negative of what the op-amp delivers.
    if (limit && region !== 'ipos' && region !== 'ineg') {
      walls.push({ what: 'ipos', margin: e.imax + i, says: `i_out ≤ +I_max` })
      walls.push({ what: 'ineg', margin: e.imax - i, says: `i_out ≥ −I_max` })
    }
    // A limited output still cannot pass a rail.
    if (rails && (region === 'ipos' || region === 'ineg')) {
      walls.push({ what: 'high', margin: e.vsat - vout, says: `v_out ≤ +V_sat` })
      walls.push({ what: 'low', margin: vout + e.vsat, says: `v_out ≥ −V_sat` })
    }
    return walls
  }
  return []
}

/** The region a violated margin sends the device to. */
export function flipTo(e, region, what) {
  if (e.type === 'Q') return bjtFlipTo(region, what)
  if (e.type === 'M') return mosfetFlipTo(region)
  if (e.type === 'D') {
    if (region === 'on') return 'off'
    if (region === 'zener') return 'off'
    return what === 'vz' ? 'zener' : 'on'
  }
  if (e.type === 'VCCS') {
    if (region === 'linear') return what === 'ipos' ? 'ipos' : 'ineg'
    return 'linear'
  }
  if (e.type === 'OPAMP') {
    if (region === 'linear') return what === 'high' ? 'high' : what === 'low' ? 'low' : what === 'ipos' ? 'ipos' : 'ineg'
    if (region === 'high' || region === 'low') return what === 'ipos' ? 'ipos' : what === 'ineg' ? 'ineg' : 'linear'
    return 'linear'
  }
  return region
}

/** How a region reads in a sentence: "D1 on", "A1 against the + rail". */
export function regionLabel(e, region) {
  if (e.type === 'Q') return bjtRegionLabel(region)
  if (e.type === 'M') return mosfetRegionLabel(region)
  if (region === 'ipos' || region === 'ineg') return `at its ${region === 'ipos' ? '+' : '−'} current limit`
  if (e.type === 'VCCS') return 'linear'
  if (e.type === 'OPAMP') return region === 'linear' ? 'in its linear region' : `against the ${region === 'high' ? '+' : '−'} rail`
  if (region === 'zener') return 'in breakdown'
  return region === 'on' ? 'conducting' : 'blocking'
}
