// Group H: what a wave does when the medium changes under it.
//
// Three experiments on one boundary. H1 is the reflection itself, H2 is what
// the reflected wave does to the incident one in front of the boundary, and H3
// is the same boundary met at an angle, where the two polarisations stop
// agreeing with each other.
//
// H3 is also where this lab declines something. Oblique incidence onto a
// CONDUCTING medium has a transmitted angle in the complex plane, and there is
// no geometry a lesson could draw for it, so `reflectOblique` throws with that
// reason. The conductivity knob is the one that reaches it.

import { reflectOblique } from '@ee-labs/fields'
import { Deg, Eps, Freq, Toggle } from '../knobs.js'

export const GROUP = 'H · Reflection at an interface'

/** The two media a boundary experiment has, from its knobs. */
const pairOf = (p) => [
  { epsr: p.epsr1, mur: 1, sigma: 0 },
  { epsr: p.epsr2, mur: 1, sigma: 0 },
]

/** Sea water, the conducting medium G3 measures. H3 declines it at an angle. */
const SIGMA_SEA = 4

/** The Brewster angle for a pair of media, from the engine rather than from a formula here. */
const brewsterOf = (m1, m2) => reflectOblique(0, m1, m2).brewsterDeg

export const H_GROUP = [
  {
    id: 'h1',
    group: GROUP,
    kind: 'wave',
    name: 'Normal incidence',
    terms: ['reflectioncoefficient', 'transmission', 'matching'],
    params: [
      Eps('epsr1', 'Permittivity, coming from', 1),
      Eps('epsr2', 'Permittivity, going into', 4),
      Freq('f', 'Frequency', 1e9, undefined, 1e3, 1e12),
    ],
    pair: pairOf,
    view: 'interface',
    views: ['interface', 'numbers', 'profile'],
    profile: (p, x) => interfaceProfile(p, x),
    headline: (x) => ({ value: x.refl.mag, unit: '', label: 'Reflected fraction of the field' }),
    domain: (p) => ({ width: 1, height: 1, centre: true }),
  },
  {
    id: 'h2',
    group: GROUP,
    kind: 'wave',
    name: 'The standing wave, and what its ratio measures',
    terms: ['standingwave', 'swr', 'slottedline'],
    params: [
      Eps('epsr1', 'Permittivity, coming from', 1),
      Eps('epsr2', 'Permittivity, going into', 4),
      Freq('f', 'Frequency', 1e9, undefined, 1e3, 1e12),
    ],
    pair: pairOf,
    view: 'profile',
    views: ['profile', 'interface', 'numbers'],
    profile: (p, x) => interfaceProfile(p, x),
    headline: (x) => ({ value: x.standing.swr, unit: '', label: 'Standing-wave ratio' }),
    domain: (p) => ({ width: 1, height: 1, centre: true }),
  },
  {
    id: 'h3',
    group: GROUP,
    kind: 'wave',
    name: 'Oblique incidence, Brewster, and total reflection',
    terms: ['obliqueincidence', 'brewster', 'criticalangle', 'evanescent'],
    params: [
      Deg('theta', 'Angle from the normal', 45, 'Zero is straight on', 0, 89.9),
      Eps('epsr1', 'Permittivity, coming from', 1),
      Eps('epsr2', 'Permittivity, going into', 4),
      Toggle('brewster', 'At Brewster', 0, 'Yes', 'No', 'Go to the angle where the parallel wave reflects nothing'),
      Toggle('lossy', 'Second medium conducts', 0, 'Yes', 'No', 'Sea water, which this lab declines at an angle'),
    ],
    // The Brewster angle is not a number typed into a knob. The toggle asks the
    // engine for it and goes there, which is the only way a reader reaches the
    // angle exactly enough to see the parallel reflection vanish.
    oblique: (p) => {
      const m1 = { epsr: p.epsr1, mur: 1, sigma: 0 }
      const m2 = { epsr: p.epsr2, mur: 1, sigma: p.lossy > 0.5 ? SIGMA_SEA : 0 }
      const thetaDeg = p.brewster > 0.5 ? brewsterOf(m1, { ...m2, sigma: 0 }) : p.theta
      return { thetaDeg, m1, m2, pol: 'parallel' }
    },
    view: 'interface',
    views: ['interface', 'numbers', 'profile'],
    // The two Fresnel coefficients against the angle of incidence, with the
    // Brewster angle and (where there is one) the critical angle marked. It is
    // the one picture that shows why the two polarisations are different laws
    // and not one law with a sign.
    profile: (p, x) => ({
      axis: 'x',
      cut: 0,
      from: 0,
      to: 89.9,
      scalar: { read: (t) => angleSweep(p, t).parallel, label: 'Parallel, reflected fraction', unit: '' },
      secondary: { read: (t) => angleSweep(p, t).perpendicular, label: 'Perpendicular, reflected fraction', unit: '' },
      regions: markedAngles(x),
    }),
    headline: (x) => ({ value: x.oblique.mag, unit: '', label: 'Reflected fraction, parallel' }),
    domain: (p) => ({ width: 1, height: 1, centre: true }),
  },
]

/**
 * The standing wave in front of the boundary and the transmitted wave behind
 * it, over two wavelengths of the first medium. The interface is a marked edge,
 * which is what `regions` draws.
 */
function interfaceProfile(p, x) {
  const lambda = x.refl.wave1.lambda
  const beta2 = x.refl.wave2.beta
  const alpha2 = x.refl.wave2.alpha
  const tau = x.refl.tauMag
  return {
    axis: 'x',
    cut: 0,
    from: -2 * lambda,
    to: lambda,
    scalar: {
      // In front of the boundary the incident and reflected waves add; behind
      // it there is one wave, of amplitude tau, travelling on.
      read: (z) => (z <= 0 ? x.standing.at(-z).mag : tau * Math.exp(-alpha2 * z) * Math.abs(Math.cos(beta2 * z))),
      label: 'Field magnitude',
      unit: 'V/m',
    },
    regions: [
      { from: -2 * lambda, to: 0, label: 'coming from', edge: true },
      { from: 0, to: lambda, label: 'going into' },
    ],
  }
}

/** Both Fresnel magnitudes at one angle, for the sweep H3 draws. */
function angleSweep(p, thetaDeg) {
  const m1 = { epsr: p.epsr1, mur: 1, sigma: 0 }
  const m2 = { epsr: p.epsr2, mur: 1, sigma: 0 }
  try {
    const o = reflectOblique(thetaDeg, m1, m2)
    return { parallel: o.parallel.mag, perpendicular: o.perpendicular.mag }
  } catch {
    return { parallel: NaN, perpendicular: NaN }
  }
}

/** The angles worth a line on H3's sweep: Brewster always, critical where there is one. */
function markedAngles(x) {
  const out = [{ from: 0, to: x.oblique.brewsterDeg, label: 'below Brewster', edge: true }]
  if (x.oblique.criticalDeg != null) out.push({ from: x.oblique.criticalDeg, to: 89.9, label: 'total reflection', edge: true })
  return out
}
