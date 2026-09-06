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
  if (!x.pd) return null
  const elements = x.pd.elements.map((e) =>
    e.id === 'RL' ? { ...e, label: 'R_L' } : e.id === 'Iph' ? { ...e, label: 'I_ph' } : e,
  )
  const layout = {
    w: 350,
    h: 170,
    crop: [16, 14, 336, 154],
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
