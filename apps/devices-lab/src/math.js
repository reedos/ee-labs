// The analysis behind every pane, and the cross-section every experiment draws.
//
// One entry point: `analyse(exp, p)` evaluates the experiment's structure at
// its knob settings and returns everything a pane can draw. There is no solver
// here and no netlist anywhere in this lab. A structure is a stack of doped
// layers, and every quantity is a closed form over it, taken from
// `@ee-labs/network`'s junction.js. What is computed depends on which structure
// the experiment names:
//
//   bulk       carrier concentrations, the Fermi level and n_i at T
//   junction   the profile, its capacitance, its breakdown and its I_S
//   mos        the oxide, the three regimes, the C–V curve and the threshold
//   mosfet     the MOS capacitor above, plus the square law over it
//   bjt        the two Gummel numbers, and the Early voltage from the profile
//   cell       the solar cell's I–V and P–V pair, and its maximum power point
//   led        the emission wavelength and the forward-voltage floor
//   fab        the sequence, and the number each step sets
//
// Every number a lesson quotes is read out of this object by `readQuantity` in
// lessons.js, and experiments.test.js checks each one against the sentence that
// quotes it.

import {
  DEGENERATE,
  EG_SI,
  EPS_SI,
  E_AVALANCHE,
  E_ZENER,
  MATERIALS,
  N_C_SI,
  N_I_300,
  N_V_SI,
  NetworkError,
  bodyEffect,
  breakdown,
  builtIn,
  carriers,
  channelIntegral,
  cvCurve,
  debyeLength,
  degenerate,
  dopingFromRatio,
  drainCurrent,
  driftDiffusion,
  earlyVoltage,
  emission,
  gapFrom,
  gummel,
  implantDoping,
  implantFor,
  intrinsicAt,
  junctionCap,
  mosCap,
  niAt,
  niFrom,
  photovoltaic,
  profile,
  saturationCurrent,
  subthreshold,
  threshold,
  thermalVoltage,
  velocitySaturation,
} from '@ee-labs/network'
import { ENTRIES } from './mathEntries.js'

/** The one labelled model in this lab, named on every pane that stands on it. */
export const DEPLETION_LABEL = 'depletion approximation'

/** Bulk silicon: the neutrality solve, the Fermi level, and n_i at T. */
export function bulkOf(p) {
  const T = p.T ?? 300
  // The band gap knob governs how n_i moves with temperature, and the band
  // edges the diagram draws. It does not move n_i at 300 K, because the suite
  // pins that constant, and A2 is where the two are put beside each other.
  const eg = p.eg ?? EG_SI
  const c = carriers({ na: p.na ?? 0, nd: p.nd ?? 0, T, eg })
  const niComputed = niFrom({ nc: p.nc ?? N_C_SI, nv: p.nv ?? N_V_SI, eg, T })
  const net = Math.abs(c.net)
  return {
    ...c,
    T,
    vt: thermalVoltage(T),
    ni300: N_I_300,
    niComputed,
    niRatio: N_I_300 / niComputed,
    gapImplied: gapFrom({ ni: N_I_300, nc: p.nc ?? N_C_SI, nv: p.nv ?? N_V_SI, T }),
    // Where this sample stops being extrinsic, which is the question A3 asks.
    intrinsicT: net > 0 ? intrinsicAt({ net }) : Infinity,
    // The four band energies against the intrinsic level, in electron volts.
    ec: (p.eg ?? EG_SI) / 2,
    ev: -(p.eg ?? EG_SI) / 2,
    ei: 0,
    ef: c.efi,
    barrier: (p.eg ?? EG_SI) / 2 - c.efi,
    guard: degenerate({ n: Math.max(net, 1) }),
  }
}

/** The step junction: the profile, and everything read off it. */
export function junctionOf(p) {
  const T = p.T ?? 300
  const doping = { na: p.na, nd: p.nd, T }
  const v = p.v ?? 0
  const area = p.area ?? 1e-8
  const pr = profile(doping, v)
  const zero = profile(doping, 0)
  const s = saturationCurrent({
    ...doping,
    area,
    mup: p.mup ?? 0.045,
    mun: p.mun ?? 0.11,
    taup: p.taup ?? 1e-6,
    taun: p.taun ?? 1e-6,
  })
  const ecrit = p.ecrit ?? E_AVALANCHE
  const b = breakdown(doping, ecrit)
  const cjPerArea = EPS_SI / pr.w
  return {
    ...pr,
    v,
    T,
    area,
    vt: thermalVoltage(T),
    // The capacitance twice over: from the width, and from the square-root law
    // the Electronics Lab was given. B5 shows they are one fact.
    cj: cjPerArea,
    cj0: EPS_SI / zero.w,
    byArea: cjPerArea,
    byLaw: junctionCap({ cj0: EPS_SI / zero.w, v0: pr.v0 }, v),
    cjTotal: cjPerArea * area,
    // The peak field by both routes, which is what B2 compares.
    byCharge: pr.emax,
    byQuadrature: (2 * pr.vj) / pr.w,
    is: s.is,
    dp: s.dp,
    dn: s.dn,
    lp: s.lp,
    ln: s.ln,
    vAt1mA: thermalVoltage(T) * Math.log(1e-3 / s.is),
    decade: thermalVoltage(T) * Math.LN10,
    vbr: b.vj,
    vbrApplied: b.v,
    mechanism: b.mechanism,
    ecrit,
    zenerField: E_ZENER,
    // The two carrier tails the step charge replaces, one for each side's own
    // doping, against the width they sit inside. That ratio is the size of the
    // error the depletion approximation carries, and it is measured here
    // rather than asserted on the pane.
    debyeP: debyeLength({ n: p.na, T }),
    debyeN: debyeLength({ n: p.nd, T }),
    debye: debyeLength({ n: Math.min(p.na, p.nd), T }),
    modelError: (debyeLength({ n: p.na, T }) + debyeLength({ n: p.nd, T })) / pr.w,
    guard: degenerate({ n: Math.max(p.na, p.nd) }),
  }
}

/** The MOS capacitor, at the gate voltage the knob sets. */
export function mosOf(p) {
  const process = {
    na: p.na,
    tox: p.tox,
    gate: p.gate ?? 'n+ poly',
    qf: p.qf ?? 0,
    implant: p.implant ?? 0,
    T: p.T ?? 300,
  }
  const t = threshold(process)
  const vg = p.vg ?? 0
  const high = mosCap(process, vg)
  const low = mosCap(process, vg, { frequency: 'low' })
  const picked = (p.freq ?? 'high') === 'low' ? low : high
  return {
    ...t,
    process,
    vg,
    c: picked.c,
    cHigh: high.c,
    cLow: low.c,
    regime: high.regime,
    psi: high.psi,
    w: high.w,
    frequency: p.freq ?? 'high',
    // The factor between the two curves in inversion, which is C4's number.
    inversionFactor: t.cox / t.cmin,
    // The gate charge at a stated bias above flat band, which is C1's reading.
    gateCharge: t.cox * (p.vq ?? 1),
    // The implant that lands this process on a stated threshold, and what the
    // oxide charge already on it is worth.
    implantTo: p.vtTarget ? implantFor({ from: t.vt, to: p.vtTarget, cox: t.cox }) : 0,
    dopingRead: dopingFromRatio({ ratio: t.ratio, tox: process.tox, T: process.T }),
    body: bodyEffect(process, p.vsb ?? 0),
    curveHigh: cvCurve(process, { from: t.vfb - 2, to: t.vt + 2, points: 241 }),
    curveLow: cvCurve(process, { from: t.vfb - 2, to: t.vt + 2, points: 241, frequency: 'low' }),
    guard: degenerate({ n: p.na }),
  }
}

/** The MOSFET, over the capacitor above. */
export function fetOf(p, mos) {
  const kprime = (p.mun ?? 0.05) * mos.cox
  const kn = kprime * (p.wOverL ?? 10)
  const vt = mos.body.vt
  const dev = { kn, vt, lambda: p.lambda ?? 0 }
  const vgs = p.vgs ?? 1.2
  const vds = p.vds ?? 1
  const point = drainCurrent(dev, { vgs, vds })
  const h = 1e-6
  const gmMeasured = (drainCurrent(dev, { vgs: vgs + h, vds }).id - drainCurrent(dev, { vgs: vgs - h, vds }).id) / (2 * h)
  const swing = mos.swing
  const floor = p.floor ?? 1e-9
  const sub = subthreshold({ swing, from: Math.max(point.id, floor * 10), to: floor })
  return {
    ...point,
    kn,
    kprime,
    vt,
    vgs,
    vds,
    vsb: p.vsb ?? 0,
    shift: mos.body.shift,
    gamma: mos.gamma,
    swing,
    // The channel charge the gate holds, per unit area, at this overdrive.
    charge: point.vov > 0 ? mos.cox * point.vov : 0,
    // The same current from the integral it came from, so D2 can show the two.
    integral: channelIntegral(dev, { vgs, vds }),
    gmMeasured,
    saturation: point.vov > 0 ? 0.5 * kn * point.vov * point.vov : 0,
    boundary: point.vov,
    decades: sub.decades,
    dv: sub.dv,
    floor,
    vsat: velocitySaturation({ length: p.length ?? 1e-6 }),
    length: p.length ?? 1e-6,
    // The curve family the pane draws: I_D against V_DS at stepped V_GS.
    family: curveFamily(dev, vt, p),
  }
}

/**
 * I_D against V_DS at four overdrives, for the device-curves pane. The steps
 * are quarters of the experiment's own overdrive, so the family redraws when
 * the gate knob moves and the operating point is always one of the curves.
 */
function curveFamily(dev, vt, p) {
  const vdsMax = p.vdsMax ?? 2
  const vov = (p.vgs ?? 1.2) - vt
  const gates = [0.25, 0.5, 0.75, 1].map((f) => vt + f * Math.max(vov, 0.1))
  return gates.map((vgs) => {
    const vds = new Float64Array(121)
    const id = new Float64Array(121)
    for (let k = 0; k < 121; k++) {
      vds[k] = (vdsMax * k) / 120
      id[k] = drainCurrent(dev, { vgs, vds: vds[k] }).id
    }
    return { vgs, vds, id }
  })
}

/** The transistor: the two Gummel numbers, and the collector junction's edge. */
export function bjtOf(p) {
  const T = p.T ?? 300
  const g = gummel({ ne: p.ne, we: p.we, nb: p.nb, wb: p.wb, area: p.area, db: p.db, de: p.de, T })
  const e = earlyVoltage({ nb: p.nb, wb: p.wb, nc: p.nc, T }, p.vcb ?? 0)
  const eb = profile({ na: p.nb, nd: p.ne, T }, 0)
  return {
    ...g,
    ...e,
    T,
    vbe: g.vbeAt(p.ic ?? 1e-3),
    ic: p.ic ?? 1e-3,
    vcb: p.vcb ?? 0,
    // The emitter junction's own depletion region, which E1 draws beside the
    // collector's on the same base.
    emitterWidth: eb.w,
    emitterIntoBase: eb.xp,
    guard: degenerate({ n: p.ne }),
  }
}

/** The solar cell, and the LED that is the same junction run the other way. */
export function cellOf(p) {
  const cell = photovoltaic({
    is: p.is,
    il: p.il,
    T: p.T ?? 300,
    rs: p.rs ?? 0,
    area: p.area ?? 1e-4,
    irradiance: p.irradiance ?? 1000,
  })
  const points = 201
  const v = new Float64Array(points)
  const i = new Float64Array(points)
  const w = new Float64Array(points)
  for (let k = 0; k < points; k++) {
    v[k] = (cell.voc * k) / (points - 1)
    i[k] = cell.current(v[k])
    w[k] = cell.power(v[k])
  }
  return { ...cell, curve: { v, i, w } }
}

/** The LED: the wavelength, and the forward voltage the gap sets a floor at. */
export function ledOf(p) {
  const eg = MATERIALS[p.material] ?? p.eg ?? EG_SI
  return { ...emission({ eg }), eg, material: p.material ?? 'silicon', all: MATERIALS }
}

/**
 * The fabrication sequence, and the number each step sets.
 *
 * Five steps for a junction and seven for a MOSFET. Each carries the one
 * quantity an earlier group took as a knob, so the step slider walks from a
 * dose to the built-in potential it produces.
 */
export function fabOf(p) {
  const doping = implantDoping({ dose: p.dose, depth: p.depth })
  const mos = p.tox ? mosOf({ na: doping, tox: p.tox, implant: p.implant ?? 0, T: p.T ?? 300, vg: 0 }) : null
  const fet = mos ? fetOf({ ...p, vgs: p.vgs ?? 1.2, vds: p.vds ?? 1 }, mos) : null
  return {
    doping,
    dose: p.dose,
    depth: p.depth,
    v0: p.nd ? builtIn({ na: doping, nd: p.nd, T: p.T ?? 300 }) : 0,
    vt: mos ? mos.vt : 0,
    cox: mos ? mos.cox : 0,
    id: fet ? fet.id : 0,
    mos,
    fet,
    step: p.step ?? 0,
  }
}

/**
 * Everything the panes draw, for one experiment at one setting of its knobs.
 *
 * A setting the closed forms decline returns with `refusal` set and `sol`
 * false, and the pane prints the reason. The two refusals this lab can reach
 * are a forward bias at or past the built-in potential and a doping of zero.
 */
export function analyse(exp, params) {
  // The recipe belongs to the experiment rather than to a knob, because a
  // sequence is not something a reader sets. It travels with the parameters so
  // that everything below reads one object.
  const p = exp.recipe ? { ...params, recipe: exp.recipe } : params
  const x = { exp, p, sol: true, refusal: null }
  try {
    switch (exp.structure) {
      case 'bulk':
        x.carrier = bulkOf(p)
        break
      case 'junction':
        x.j = junctionOf(p)
        break
      case 'mos':
        x.mos = mosOf(p)
        break
      case 'mosfet':
        x.mos = mosOf(p)
        x.fet = fetOf(p, x.mos)
        break
      case 'bjt':
        x.bjt = bjtOf(p)
        break
      case 'cell':
        x.pv = cellOf(p)
        break
      case 'led':
        x.led = ledOf(p)
        x.pv = cellOf(p)
        break
      case 'fab':
        x.fab = fabOf(p)
        // The junction the sequence produces, but only where the recipe makes
        // one: the MOSFET recipe has no second doping to meet.
        if (p.nd) x.j = junctionOf({ ...p, na: x.fab.doping })
        if (x.fab.mos) {
          x.mos = x.fab.mos
          x.fet = x.fab.fet
        }
        break
      default:
        throw new Error(`${exp.id} names an unknown structure ${exp.structure}`)
    }
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err
    x.refusal = err
    x.sol = false
    return x
  }
  x.stack = stackOf(exp, p, x)
  x.guard = x.carrier?.guard ?? x.j?.guard ?? x.mos?.guard ?? x.bjt?.guard ?? null
  return x
}

/**
 * The cross-section: layers with their thicknesses to scale, their dopings and
 * their names. It is the picture that is always on screen, in the place the
 * schematic holds in every other lab.
 */
export function stackOf(exp, p, x) {
  const nm = (m) => m * 1e9
  switch (exp.structure) {
    case 'bulk': {
      const c = x.carrier
      return {
        title: 'Doped silicon',
        layers: [{ name: c.type === 'p' ? 'p-type silicon' : c.type === 'n' ? 'n-type silicon' : 'intrinsic silicon', thickness: 1000, fill: c.type, doping: Math.abs(c.net) }],
        marks: [],
      }
    }
    case 'junction': {
      const j = x.j
      return {
        title: 'The step junction',
        layers: [
          { name: 'p side', thickness: Math.max(nm(j.xp) * 2, 60), fill: 'p', doping: p.na },
          { name: 'depletion region', thickness: nm(j.w), fill: 'depleted', doping: 0 },
          { name: 'n side', thickness: Math.max(nm(j.xn) * 2, 60), fill: 'n', doping: p.nd },
        ],
        marks: [
          { at: nm(j.xp), label: 'x_p' },
          { at: nm(j.w), label: 'x_n' },
        ],
      }
    }
    case 'mos':
    case 'mosfet': {
      const m = x.mos
      return {
        title: exp.structure === 'mos' ? 'The MOS capacitor' : 'The MOSFET',
        layers: [
          { name: 'gate', thickness: 40, fill: 'metal', doping: 0 },
          { name: 'oxide', thickness: Math.max(nm(p.tox), 6), fill: 'oxide', doping: 0 },
          { name: 'depletion layer', thickness: Math.max(nm(m.w), 2), fill: 'depleted', doping: 0 },
          { name: 'p substrate', thickness: 120, fill: 'p', doping: p.na },
        ],
        marks: [{ at: nm(m.wmax), label: 'W_max' }],
      }
    }
    case 'bjt': {
      const b = x.bjt
      return {
        title: 'The transistor, as three layers',
        layers: [
          { name: 'n⁺ emitter', thickness: nm(p.we), fill: 'n', doping: p.ne },
          { name: 'p base', thickness: nm(p.wb), fill: 'p', doping: p.nb },
          { name: 'n collector', thickness: Math.max(nm(b.intoCollector) * 1.4, 200), fill: 'n', doping: p.nc },
        ],
        marks: [
          { at: nm(p.we + b.neutralBase), label: 'neutral base' },
          { at: nm(p.we + p.wb), label: 'collector junction' },
        ],
      }
    }
    case 'cell':
    case 'led':
      return {
        title: exp.structure === 'cell' ? 'The solar cell' : 'The light-emitting diode',
        layers: [
          { name: 'contact grid', thickness: 30, fill: 'metal', doping: 0 },
          { name: 'n⁺ emitter', thickness: 60, fill: 'n', doping: 1e25 },
          { name: 'depletion region', thickness: 50, fill: 'depleted', doping: 0 },
          { name: 'p base', thickness: 300, fill: 'p', doping: 1e22 },
          { name: 'back contact', thickness: 30, fill: 'metal', doping: 0 },
        ],
        marks: [],
      }
    case 'fab':
      return fabStack(p, x)
    default:
      return { title: '', layers: [], marks: [] }
  }
}

/** The fabrication sequence: the cross-section after step k of the recipe. */
export const FAB_STEPS = {
  junction: ['bare wafer', 'oxidise', 'mask and etch', 'implant', 'drive in', 'metallise'],
  mosfet: ['bare wafer', 'grow the gate oxide', 'threshold implant', 'deposit the gate', 'source and drain implants', 'metallise'],
}

function fabStack(p, x) {
  const recipe = p.recipe ?? 'junction'
  const step = Math.min(p.step ?? 0, FAB_STEPS[recipe].length - 1)
  const layers =
    recipe === 'junction'
      ? [{ name: 'n substrate', thickness: 200, fill: 'n', doping: p.nd }]
      : [{ name: 'p substrate', thickness: 200, fill: 'p', doping: x.fab.doping }]
  if (recipe === 'junction') {
    if (step >= 1) layers.unshift({ name: 'field oxide', thickness: 40, fill: 'oxide', doping: 0 })
    if (step >= 2 && step < 3) layers[0] = { name: 'oxide, opened', thickness: 40, fill: 'oxide', doping: 0 }
    if (step >= 3) {
      layers.splice(step >= 1 ? 1 : 0, 0, { name: 'implanted p layer', thickness: Math.max(p.depth * 1e9, 20), fill: 'p', doping: x.fab.doping })
    }
    if (step >= 5) layers.unshift({ name: 'aluminium contact', thickness: 30, fill: 'metal', doping: 0 })
  } else {
    if (step >= 1) layers.unshift({ name: 'gate oxide', thickness: Math.max(p.tox * 1e9, 6), fill: 'oxide', doping: 0 })
    if (step >= 2) layers.splice(step >= 1 ? 1 : 0, 0, { name: 'threshold implant', thickness: 20, fill: 'p', doping: x.fab.doping })
    if (step >= 3) layers.unshift({ name: 'polysilicon gate', thickness: 40, fill: 'metal', doping: 0 })
    if (step >= 4) layers.push({ name: 'source and drain', thickness: 60, fill: 'n', doping: 1e26 })
    if (step >= 5) layers.unshift({ name: 'aluminium contact', thickness: 30, fill: 'metal', doping: 0 })
  }
  return { title: `${recipe === 'junction' ? 'A junction' : 'A MOSFET'}, step ${step + 1} of ${FAB_STEPS[recipe].length}`, layers, marks: [], step, steps: FAB_STEPS[recipe] }
}

/** A refusal as a sentence, for the pane that has nothing to draw. */
export const refusalReason = (err) => (err ? err.message : 'No result.')

/** The transport refusal, as the pane prints it. It is content, not a gap. */
export function transportRefusal() {
  try {
    driftDiffusion()
  } catch (err) {
    return err.message
  }
  return ''
}

/** The math panel's entry for an experiment, or null where it has none. */
export function experimentMath(exp, p, x) {
  const fn = ENTRIES[exp.id]
  if (!fn) return null
  try {
    return fn(p, x)
  } catch {
    return null
  }
}

/** The intrinsic concentration across a temperature range, for the band pane. */
export function niCurve({ from = 250, to = 500, points = 121 } = {}) {
  const T = new Float64Array(points)
  const ni = new Float64Array(points)
  for (let k = 0; k < points; k++) {
    T[k] = from + ((to - from) * k) / (points - 1)
    ni[k] = niAt(T[k])
  }
  return { T, ni }
}

/** The degenerate-doping guard, above which Boltzmann statistics fail. */
export const DEGENERATE_AT = DEGENERATE
