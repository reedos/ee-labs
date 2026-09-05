// Current in a conductor: the point-contact field, the four-point probe, and
// the sheet resistance a thin film is measured by.
//
// The four-point probe is the reason this file is separate from closed.js. Its
// two closed forms are for two different objects that look the same on a bench,
// a semi-infinite block and a thin sheet, and the number they give differ by a
// factor of about 4.5 for the same reading. Choosing between them is the
// lesson, so both are here with the condition that selects one.

import { nonNegative, positive, require_ } from './const.js'

/**
 * The potential a distance r from a point contact injecting current I into a
 * semi-infinite block of resistivity rho:
 *
 *   V(r) = rho I / (2 pi r)
 *
 * The current spreads into a hemisphere, so the area at radius r is 2 pi r
 * squared and the field is rho I / (2 pi r^2). Integrating that from r to
 * infinity gives the potential above. Exact for a point contact on a flat
 * surface of a block much larger than the probe spacing.
 */
export const pointContactPotential = (rho, I, r) => (rho * I) / (2 * Math.PI * positive(r, 'r'))

/**
 * The spreading resistance of one contact of radius a on a semi-infinite block:
 * R = rho / (4 a). Finite, because a contact of finite size does not have an
 * infinite current density. It is why a probe's own contact resistance does not
 * spoil a four-point measurement, which draws no current through the sensing
 * pair.
 */
export const spreadingResistance = (rho, a) => rho / (4 * positive(a, 'a'))

/**
 * The four-point probe: four equally spaced collinear contacts, current forced
 * through the outer pair and voltage measured across the inner pair.
 *
 * Two geometries, two closed forms.
 *
 *   semi-infinite block   rho = 2 pi s (V / I)
 *   thin sheet            rho_sheet = (pi / ln 2) (V / I) = 4.532 (V / I)
 *
 * The block form comes from superposing the two point contacts' potentials at
 * the two sensing points. The sheet form comes from the same superposition with
 * the current spreading into a cylinder of thickness t rather than a
 * hemisphere, and its coefficient pi / ln 2 does not depend on the spacing at
 * all, which is the surprise of the measurement.
 *
 * `thickness` decides which one is quoted. A film thinner than about half the
 * probe spacing is a sheet, and one thicker than about four times it is a
 * block. In between neither form holds without a correction factor, and the
 * function says so rather than picking one.
 */
export function fourPointProbe({ spacing, voltage, current, thickness }) {
  const s = positive(spacing, 'spacing')
  const I = positive(Math.abs(current), 'current')
  const V = voltage
  require_(Number.isFinite(V), `voltage must be a finite number, and it is ${V}.`, { field: 'voltage' })
  const ratio = V / I
  const bulk = 2 * Math.PI * s * ratio
  const sheetResistance = (Math.PI / Math.LN2) * ratio
  const out = {
    ratio,
    bulkResistivity: bulk,
    sheetResistance,
    sheetCoefficient: Math.PI / Math.LN2,
    bulkFormula: 'rho = 2 pi s V / I',
    sheetFormula: 'R_sheet = (pi / ln 2) V / I',
  }
  if (thickness === undefined) {
    out.regime = 'unknown'
    out.says = 'Without the sample thickness neither form can be chosen. A block gives one answer and a thin film another, and they differ by more than a factor of four.'
    return out
  }
  const t = positive(thickness, 'thickness')
  const tOverS = t / s
  out.thickness = t
  out.tOverS = tOverS
  out.resistivityFromSheet = sheetResistance * t
  if (tOverS >= 4) {
    out.regime = 'block'
    out.resistivity = bulk
    out.says = `The sample is ${tOverS.toPrecision(3)} probe spacings thick, so the current spreads into a hemisphere and the block form applies. The resistivity is ${bulk.toPrecision(4)} ohm-metres.`
  } else if (tOverS <= 0.5) {
    out.regime = 'sheet'
    out.resistivity = sheetResistance * t
    out.says = `The sample is ${tOverS.toPrecision(3)} probe spacings thick, so the current spreads in the plane of the film and the sheet form applies. The sheet resistance is ${sheetResistance.toPrecision(4)} ohms per square, and the resistivity ${(sheetResistance * t).toPrecision(4)} ohm-metres.`
  } else {
    out.regime = 'between'
    out.resistivity = null
    out.says = `The sample is ${tOverS.toPrecision(3)} probe spacings thick, between the half-spacing that makes a sheet and the four spacings that make a block. Neither closed form holds here without a thickness correction factor, so this package quotes neither.`
  }
  out.guard = {
    quantity: 'sample thickness over probe spacing',
    value: tOverS,
    threshold: out.regime === 'sheet' ? 0.5 : 4,
    ok: out.regime !== 'between',
    says: out.says,
  }
  return out
}

/** Sheet resistance from a resistivity and a thickness: R = rho / t, ohms per square. */
export const sheetResistanceOf = (rho, thickness) => rho / positive(thickness, 'thickness')

/**
 * The number of squares between two ends of a uniform strip: length over width.
 * The resistance is that count times the sheet resistance, and the count is why
 * a sheet resistance is quoted "per square" and is not per anything else.
 */
export function squaresOf(length, width) {
  return positive(length, 'length') / positive(width, 'width')
}

/**
 * The resistance of a uniform bar carrying current end to end:
 * R = rho l / A. Exact for a current spread evenly over the cross-section,
 * which holds at zero frequency and fails once the skin depth is small.
 */
export function barResistance({ rho, length, area }) {
  return (positive(rho, 'rho') * positive(length, 'length')) / positive(area, 'area')
}

/**
 * The current density in a bar, amperes per square metre, and the field driving
 * it. J = sigma E is Ohm's law at a point, and the bar's I = V/R is what it
 * integrates to. Both are returned so a lesson can put the point form and the
 * circuit form beside each other.
 */
export function currentDensity({ rho, length, area, voltage }) {
  const R = barResistance({ rho, length, area })
  const I = voltage / R
  return {
    R,
    I,
    J: I / area,
    E: voltage / length,
    sigma: 1 / rho,
    check: { jFromE: (1 / rho) * (voltage / length), jFromI: I / area },
    drift: null,
  }
}

/** Power dissipated per cubic metre: p = J . E = sigma E squared. */
export const powerDensity = (sigma, E) => nonNegative(sigma, 'sigma') * E * E
