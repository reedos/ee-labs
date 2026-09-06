// What each view is handed: the schematic's netlist and layout, and the rows
// the numbers pane prints.
//
// Everything here is a function of the analysis. No view computes a quantity of
// its own, so a pane and a lesson cannot disagree about a number.

import { db, dbm, deg, nm, num, pct, plain, span } from './format.js'

// --------------------------------------------------------------- the schematic

/**
 * The photodiode circuit as `Schematic.jsx` draws it.
 *
 * Four elements and three nodes, which is exactly what `photodiodeNet` gives
 * the solver. The layout is the suite's grid idiom: elements are centred on a
 * point and span forty units, so a vertical element at y = 85 runs from 65
 * to 105.
 *
 * The photodiode symbol this suite does not have yet is the reason the junction
 * and its photocurrent are drawn as two elements inside one dashed outline. The
 * outline says the two are one device, and NEEDS.md asks the director for the
 * symbol.
 */
export function schematicFor(x) {
  if (x.j) return junctionSchematic(x)
  if (!x.pd) return null
  const elements = x.pd.elements.map((e) =>
    e.id === 'RL' ? { ...e, label: 'R_L' } : e.id === 'Iph' ? { ...e, label: 'I_ph' } : e,
  )
  const layout = {
    w: 350,
    h: 170,
    // The crop is the viewBox, so anything outside it is not drawn at all. It
    // used to be the wires' own box, which cut the meter above R_L in half and
    // took the last letters off both node labels. Measured against the rendered
    // content and given room for a longer reading than the defaults produce.
    crop: [-6, -3, 396, 150],
    items: [
      { box: [196, 52, 326, 120] },
      { wire: [50, 40, 120, 40] },
      { wire: [160, 40, 300, 40] },
      { wire: [50, 40, 50, 65] },
      { wire: [50, 105, 50, 130] },
      { wire: [220, 40, 220, 65] },
      { wire: [220, 105, 220, 130] },
      { wire: [300, 40, 300, 65] },
      { wire: [300, 105, 300, 130] },
      { wire: [50, 130, 300, 130] },
      { el: 'Vb', x: 50, y: 85, dir: 'v' },
      { el: 'RL', x: 140, y: 40, dir: 'h' },
      { el: 'Iph', x: 220, y: 85, dir: 'v' },
      { el: 'D1', x: 300, y: 85, dir: 'v', flip: true },
      { gnd: [175, 130] },
      { node: 'vb', x: 50, y: 40, side: 'l' },
      { node: 'c', x: 300, y: 40, side: 'r' },
      { text: 'photodiode', x: 261, y: 132, className: 'sch-dim' },
    ],
  }
  const meters = { v: x.pd.sol.v, i: x.pd.sol.i, p: {} }
  return { elements, layout, meters }
}

/**
 * The forward-biased junction Group C loads, as `Schematic.jsx` draws it.
 *
 * Three elements and two nodes, which is what `driveNet` gives the solver. No
 * dashed outline here: an LED and a laser are one element each, and the pane's
 * caption is where the two are told apart, because nothing in the circuit tells
 * them apart. `NEEDS.md` §6 asks the director for the two symbols that would.
 */
function junctionSchematic(x) {
  const elements = x.j.elements.map((e) => (e.id === 'Rs' ? { ...e, label: 'R_s' } : e))
  const layout = {
    w: 320,
    h: 170,
    // As above: measured against what the drawing actually covers, not against
    // where the wires run.
    crop: [-16, -3, 356, 153],
    items: [
      { wire: [50, 40, 120, 40] },
      { wire: [160, 40, 260, 40] },
      { wire: [50, 40, 50, 65] },
      { wire: [50, 105, 50, 130] },
      { wire: [260, 40, 260, 65] },
      { wire: [260, 105, 260, 130] },
      { wire: [50, 130, 260, 130] },
      { el: 'Vd', x: 50, y: 85, dir: 'v' },
      { el: 'Rs', x: 140, y: 40, dir: 'h' },
      { el: 'D1', x: 260, y: 85, dir: 'v' },
      { gnd: [155, 130] },
      { node: 'vd', x: 50, y: 40, side: 'l' },
      { node: 'a', x: 260, y: 40, side: 'r' },
      { text: 'LED or laser', x: 258, y: 148, className: 'sch-dim' },
    ],
  }
  return { elements, layout, meters: { v: x.j.sol.v, i: x.j.sol.i, p: {} } }
}

// ------------------------------------------------------------- the numbers pane

const row = (label, value, formula) => ({ label, value, formula })

/**
 * Every closed form the experiment used, with the formula it came from.
 *
 * A reader who wants to check the app against a textbook reads this pane. The
 * formula column is the check, and the value column is what the engine returned
 * at the settings on screen.
 */
export function numbersFor(exp, x, p) {
  if (x.declined) return []
  switch (x.kind) {
    case 'detector':
      return detectorRows(x, p)
    case 'fibre':
      return fibreRows(x, p)
    case 'link':
      return linkRows(x, p)
    case 'cavity':
      return cavityRows(x, p)
    case 'channels':
      return channelRows(x, p)
    case 'junction':
      return junctionRows(x, p)
    case 'led':
      return ledRows(x, p)
    case 'laser':
      return laserRows(x, p)
    case 'rate':
      return rateRows(x, p)
    default:
      return []
  }
}

function detectorRows(x, p) {
  const out = [
    row('Wavelength', nm(p.lambda ?? 1550e-9), 'the knob'),
    row('Photon energy', `${num(x.photon.eV, 'eV')}`, 'E = hc/λ, and hc/q = 1.23984 eV µm'),
    row('Optical frequency', num(x.photon.frequency, 'Hz'), 'ν = c/λ'),
  ]
  if (x.photon.flux !== null) out.push(row('Photon flux', `${num(x.photon.flux, '')} per second`, 'Φ = P/E'))
  if (p.eta !== undefined) {
    out.push(row('Responsivity', num(x.R, 'A/W'), 'R = η q λ / hc'))
    if (Number.isFinite(x.cutoff)) out.push(row('Cut-off wavelength', nm(x.cutoff), 'λ_c = hc/E_g'))
  }
  if (x.pd) {
    out.push(row('Photocurrent', num(x.pd.iph, 'A'), 'I_ph = R P'))
    out.push(row('Dark current', num(x.pd.dark, 'A'), 'the junction’s reverse saturation current'))
    out.push(row('Load current', num(x.pd.current, 'A'), 'solved, read across R_L'))
    out.push(row('Reverse bias left', num(x.pd.reverse, 'V'), 'V(c), from the same solve'))
    if (Number.isFinite(x.level)) out.push(row('Light equals dark at', num(x.level, 'W'), 'P = I_dark / R'))
  }
  if (x.speed) {
    out.push(row('Detector area', num(x.speed.area, 'm²'), 'A = π d² / 4'))
    out.push(row('Capacitance at zero bias', num(x.speed.cj0, 'F'), 'C_j0 = ε A / w₀'))
    out.push(row('Junction capacitance', num(x.speed.cj, 'F'), 'C_j = C_j0 / (1 − v/V_0)^m, from @ee-labs/network'))
    out.push(row('Corner frequency', num(x.speed.corner, 'Hz'), 'f = 1 / (2π R C_j)'))
    out.push(row('Collected power', num(x.speed.collected, 'W'), 'P = A × irradiance'))
    out.push(row('Area bandwidth product', `${plain(x.speed.areaBandwidth)} m²/s`, 'A f, which does not depend on A'))
  }
  return out
}

function fibreRows(x, p) {
  const out = []
  if (x.att) {
    out.push(row('Span', span(p.length), 'the knob'))
    out.push(row('Loss', db(x.att.db), 'loss = α L, with α in dB/km'))
    out.push(row('Power ratio', num(x.att.ratio, ''), 'P(L)/P(0) = 10^(−αL/10)'))
    out.push(row('Power in', dbm(x.att.inDbm), '10 log₁₀(P / 1 mW)'))
    out.push(row('Power out', dbm(x.att.outDbm), 'the level in, less the loss'))
  }
  if (x.disp) {
    out.push(row('Pulse spread', num(x.disp.spread, 's'), 'Δτ = D L Δλ'))
    out.push(row('Group-velocity dispersion', `${plain(x.disp.beta2ps)} ps²/km`, 'β₂ = −D λ² / (2π c)'))
  }
  if (x.limit) {
    out.push(row('Criterion', plain(x.limit.criterion), x.limit.text))
    out.push(row('Rate the spread allows', num(x.limit.rate, 'bit/s'), 'B = criterion / Δτ'))
    out.push(row('Bandwidth-distance product', num(x.limit.product, 'bit/s'), 'B L, in bit/s metres'))
  }
  if (x.geo) {
    out.push(row('Numerical aperture', plain(x.geo.na), 'NA = √(n₁² − n₂²)'))
    out.push(row('Acceptance angle', deg(x.geo.angle), 'θ = arcsin NA'))
    out.push(row('Index difference', pct(x.geo.delta), 'Δ = (n₁² − n₂²) / 2n₁²'))
    out.push(row('Normalised frequency', plain(x.geo.v), 'V = 2π a NA / λ'))
    out.push(row('Single-mode core diameter', num(x.geo.single, 'm'), 'the diameter at which V = 2.405'))
    out.push(row('Modes carried', `${x.geo.modes}${x.geo.estimate ? ' (estimate)' : ''}`, x.geo.estimate ? 'about V²/2, a large-V asymptote' : 'one, exactly, below V = 2.405'))
  }
  return out
}

function linkRows(x, p) {
  const out = [row('Transmitter', dbm(p.txDbm), 'the knob')]
  for (const it of x.budget.items) out.push(row(it.name, db(it.db), it.db === 0 ? 'not modelled, and set to zero rather than left out' : 'a line item'))
  out.push(row('Total loss', db(x.budget.total), 'the sum of the line items'))
  out.push(row('Power at the receiver', dbm(x.budget.received), 'the transmitter, less the total'))
  out.push(row('Sensitivity', dbm(p.sensitivityDbm), 'the knob'))
  out.push(row('Margin', db(x.budget.margin), 'received, less the sensitivity'))
  out.push(row('Loss-limited reach', span(x.reach.length), 'what is left of the budget, divided by α'))
  out.push(row('Dispersion-limited reach', span(x.reach.dispersion), 'L = criterion / (B D Δλ)'))
  out.push(row('Which limit binds', x.reach.binds, 'the shorter of the two reaches'))
  // A budget the fixed items have already spent has no reach, and the reason is
  // the content rather than the zero. CORE_SCOPE.md Rule 2.
  if (x.refusal) out.push(row('Loss-limited reach, declined', 'declined', x.refusal))
  return out
}

function cavityRows(x, p) {
  return [
    row('Facet reflectance of this index', plain(x.facet), 'R = ((n − 1)/(n + 1))²'),
    row('Free spectral range', num(x.fsr, 'Hz'), 'Δν = c / (2 n L)'),
    row('The same in wavelength', nm(x.fsrWavelength), 'Δλ = λ² / (2 n L)'),
    row('Round-trip time', num(x.roundTripTime, 's'), '2 n L / c'),
    row('Finesse', plain(x.finesse), 'F = π √R / (1 − R)'),
    row('Linewidth', num(x.linewidth, 'Hz'), 'Δν / F'),
    row('Peak to valley contrast', db(x.contrast.db), '1 + 4R/(1 − R)²'),
    row('Mirror loss', `${plain(x.mirrorLoss / 100)} per cm`, 'α_m = (1/2L) ln(1/R)'),
    row('Transfer function in s', 'declined', x.refusal),
  ]
}

function channelRows(x, p) {
  return [
    row('Channel spacing', num(p.spacing, 'Hz'), 'the knob'),
    row('Channel width in wavelength', nm(x.grid.width), 'Δλ = λ² Δν / c'),
    row('Band', `${nm(p.from)} to ${nm(p.to)}`, 'the two knobs'),
    row('Band width in frequency', num(x.band.width, 'Hz'), 'c/λ_short − c/λ_long'),
    row('Channels the band holds', String(x.band.channels), 'the band width divided by the spacing, rounded down'),
    row('Source width', nm(p.dLambda), 'the knob'),
    row('Source width over channel width', plain(x.widthRatio), 'a source wider than one lands in its neighbour'),
  ]
}

// ------------------------------------------------------------ Groups C and D

/** C1. One solved junction, and the two things a device can do with its current. */
function junctionRows(x, p) {
  return [
    row('Supply', num(p.drive, 'V'), 'the knob'),
    row('Series resistor', num(p.series, 'Ω'), 'the knob'),
    row('Junction current', num(x.j.current, 'A'), 'solved, read across R_s'),
    row('Forward voltage', num(x.j.forward, 'V'), 'V(a), from the same solve'),
    row('Volts the resistor took', num(x.j.across, 'V'), 'the supply, less the forward voltage'),
    row('Newton iterations', String(x.j.iters), 'the same walk every other diode in the suite takes'),
    row('Volts one photon costs', num(x.volts, 'V'), 'hν/q, the photon energy read as a voltage'),
    row('As an LED', num(x.led.power, 'W'), 'P = η_int (hν/q) I'),
    row('As a laser', num(x.laser.power, 'W'), 'η_d (hν/q)(I − I_th), above threshold'),
    row('Threshold current', num(x.ith, 'A'), 'from the rate equations, not from here'),
    row('Wall-plug efficiency as an LED', pct(x.wall.led), 'light out over volts times amps in'),
    row('Wall-plug efficiency as a laser', pct(x.wall.laser), 'the same ratio, for the same current'),
  ]
}

/** C2 and C3. The LED's slope, and the one pole its carrier lifetime gives. */
function ledRows(x, p) {
  const out = [
    row('Drive current', num(p.current, 'A'), 'the knob'),
    row('Forward voltage', num(x.forward, 'V'), 'Shockley read backwards at this current'),
    row('Volts one photon costs', num(x.volts, 'V'), 'hν/q, the photon energy read as a voltage'),
    row('Slope', plain(x.led.slope) + ' mW/mA', 'η_int hν/q. A slope in W/A is the same number in mW/mA'),
    row('Optical power', num(x.led.power, 'W'), 'P = η_int (hν/q) I'),
    row('The model', 'linear in current', x.led.model),
  ]
  if (x.band) {
    out.push(row('Carrier lifetime', num(x.band.tauC, 's'), 'the knob'))
    out.push(row('Modulation bandwidth', num(x.band.f3db, 'Hz'), 'f = 1 / (2π τ_c)'))
    out.push(row('Roll-off, per decade', db(x.band.perDecade), 'one pole falls 20 dB a decade, measured here'))
    out.push(row('Roll-off, per octave', db(x.band.perOctave), 'the same pole, 6.0206 dB an octave'))
    out.push(row('Phase at the corner', deg(x.band.phaseAtCorner), 'one pole lags 45 degrees at its own corner, exactly'))
    out.push(row('Phase a decade above', deg(x.band.phaseDecadeUp), 'the same pole, on its way to 90 degrees'))
    out.push(row('The model', 'one pole', x.band.model))
  }
  return out
}

/** C4 and C5. The threshold, both slopes, and the cavity behind the lifetime. */
function laserRows(x, p) {
  const out = [
    row('Drive current', num(p.current, 'A'), 'the knob'),
    row('Photon lifetime', num(x.tauP, 's'), x.cavity ? 'from the cavity, τ_p = n / (c α_m)' : 'the knob'),
    row('Threshold density', num(x.nth, 'm⁻³'), 'N_th = N_tr + 1 / (Γ g₀ τ_p)'),
    row('Threshold current', num(x.ith, 'A'), 'I_th = q V N_th / τ_c'),
    row('Slope above threshold', plain(x.laser.slope) + ' mW/mA', 'η_d hν/q, in the unit a datasheet quotes'),
    row('Slope below threshold', plain(x.laser.spontaneousSlope) + ' mW/mA', 'η_sp hν/q, the spontaneous path'),
    row('Ratio of the two slopes', plain(x.laser.slopeRatio), 'how much steeper the device gets at threshold'),
    row('Optical power', num(x.laser.power, 'W'), 'the two paths added'),
    row('Above threshold', x.laser.above ? 'yes' : 'no', 'whether the drive current has passed I_th'),
    // The model the two slopes are, named where its numbers are printed. The
    // LED's rows do the same, and CORE_SCOPE.md asks for nothing less on a
    // number that is exact only for a stated model.
    row('The model', 'two fixed efficiencies', x.laser.model),
  ]
  if (x.cavity) {
    out.push(row('Mirror loss', plain(x.cavity.mirrorPerCm) + ' per cm', 'α_m = (1/2L) ln(1/R)'))
    out.push(row('Free spectral range', num(x.cavity.fsr, 'Hz'), 'the same cavity F1 draws, Δν = c / (2 n L)'))
    out.push(row('Finesse', plain(x.cavity.finesse), 'F = π √R / (1 − R)'))
  }
  return out
}

/** D1 to D4. The terms, the steady state, the linearisation, and the guard. */
function rateRows(x, p) {
  const out = [
    row('Drive current', num(p.current, 'A'), 'the knob'),
    row('Threshold current', num(x.ith, 'A'), 'I_th = q V N_th / τ_c'),
    row('Carrier density', num(x.n, 'm⁻³'), 'the root of the steady state, exactly'),
    row('Photon density', num(x.s, 'm⁻³'), 'S = Γ τ_p (I − I_th) / (qV) at zero coupling'),
    row('Threshold density', num(x.nth, 'm⁻³'), 'N_th = N_tr + 1 / (Γ g₀ τ_p)'),
  ]
  for (const t of x.carriers) out.push(row('Carriers: ' + t.name.toLowerCase(), rate(t.value), t.formula))
  out.push(row('Carriers: the sum', zeroed(x.carrierSum, x.carrierFloor), 'zero, to the largest term’s own last bits'))
  for (const t of x.photons) out.push(row('Photons: ' + t.name.toLowerCase(), rate(t.value), t.formula))
  out.push(row('Photons: the sum', zeroed(x.photonSum, x.photonFloor), 'zero, to the largest term’s own last bits'))
  if (x.sm) {
    out.push(row('Relaxation frequency', num(x.sm.fr, 'Hz'), 'ω_r² is the Jacobian’s determinant, exactly'))
    out.push(row('The textbook form', num(x.sm.frText, 'Hz'), '√((I/I_th − 1)/(τ_p τ_c)), which drops N_tr'))
    out.push(row('Exact over textbook', plain(x.textFactor), '√(Γ g₀ N_th τ_p), the term the textbook form drops'))
    out.push(row('Damping', plain(x.sm.gamma / 1e9) + ' per ns', 'γ = 1/τ_c + g₀ S'))
    out.push(row('Damping ratio', plain(x.sm.zeta), 'ζ = γ / (2 ω_r)'))
    out.push(row('Peak height', db(x.sm.peakDb), '1 / (2ζ√(1 − ζ²))'))
    out.push(row('Peak at', num(x.sm.peakHz, 'Hz'), 'ω_r √(1 − 2ζ²), which is below ω_r'))
    out.push(row('Modulation bandwidth', num(x.sm.f3db, 'Hz'), 'where |H| is 3 dB down'))
    out.push(row('Phase at the relaxation frequency', deg(x.phaseAtFr), 'a second order lags 90 degrees at ω_r, whatever ζ is'))
    out.push(row('Phase at the peak', deg(x.phaseAtPeak), 'the same H(s), read where |H| is largest'))
    out.push(row('Phase at the bandwidth', deg(x.phaseAt3db), 'the same H(s), read where |H| is 3 dB down'))
  }
  if (x.guard) {
    const g = x.guard
    out.push(row('Modulation depth', pct(g.depth), 'the knob'))
    out.push(row('Overshoot the linear answer predicts', num(g.predicted, 'm⁻³'), 'the rise, times one plus the damping ratio’s overshoot'))
    out.push(row('Overshoot the integrated pair reaches', num(g.measured, 'm⁻³'), 'the first maximum of a Runge-Kutta run'))
    out.push(row('Error', pct(g.error), 'the difference, over the steady rise'))
    for (const d of GUARD_DEPTHS) {
      out.push(row('Error at ' + plain(100 * d) + ' per cent depth', pct(x.at({ depth: d }).guard.error), 'measured, one integration each'))
    }
    out.push(row('Drawn without a flag up to', pct(g.warn), 'the largest round depth whose measured error is under a tenth'))
    out.push(row('Not drawn past', pct(g.decline), 'where the measured error has passed a quarter'))
    out.push(row('The large-signal solution in time', 'declined', x.declineText))
  }
  return out
}

/** The five depths the plan names, which D4 measures the linearisation's error at. */
export const GUARD_DEPTHS = [0.01, 0.05, 0.1, 0.3, 0.6]

/**
 * The step pane's own resolution arithmetic, which `REVIEW_PLAYBOOK.md` §5 asks
 * for behind every visual claim.
 *
 * The pane's whole message is the gap between the peak the pair reaches and the
 * peak the linearisation predicted, so how large that gap is against the range
 * the two curves are drawn over decides whether the picture carries it. The
 * pane draws from this, and `panes.test.jsx` measures it, so the number in the
 * comment cannot drift from the number on screen.
 */
export function stepResolution(x) {
  const step = x.step
  const lo = Math.min(step.start, ...step.trace)
  const hi = Math.max(step.measured, x.guard.predicted)
  const span = Math.max(hi - lo, Number.MIN_VALUE)
  return { lo, hi, span, gap: Math.abs(step.measured - x.guard.predicted), fraction: Math.abs(step.measured - x.guard.predicted) / span }
}

/** A rate of density, per cubic metre a second, which is what every term of the pair is. */
const rate = (v) => plain(v) + ' m⁻³ s⁻¹'

/**
 * A sum that is zero to the arithmetic's own floor, printed as zero.
 *
 * The equations pane already does this, and a numbers pane that printed the
 * residual beside a formula reading "zero" would be showing one quantity two
 * ways on two panes. The floor is the largest term in that equation times the
 * machine epsilon, so it is the reading's own scale and not a chosen number.
 */
const zeroed = (v, floor) => (Math.abs(v) <= floor ? '0' : rate(v))
