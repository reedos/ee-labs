// Group G: Maxwell's set closed, and the wave that falls out of it.
//
// The first half of this lab is four laws that never mention each other's
// quantities. G1 is the term that ties them together, and G2 to G4 are what a
// tied set predicts: a wave that carries its own field, at a speed and an
// impedance the medium alone decides.
//
// Nothing in this group is approximate. A plane wave in a uniform medium is a
// closed form in complex arithmetic, lossy or not, so no experiment here
// carries a guard and no note hedges.

import { capacitance, epsOf } from '@ee-labs/fields'
import { Area, Deg, Eps, Freq, Len, Mu, Ratio, Sigma } from '../knobs.js'

export const GROUP = 'G · Maxwell and the plane wave'

/**
 * The wave in space at one instant, over two wavelengths, with E on the left
 * axis and H on the right. In a lossy medium the two are no longer in step and
 * both fall as they go, which is the whole difference between G2 and G3 drawn
 * rather than stated. The first wavelength is marked, so the reader can see the
 * scale the medium set.
 */
export function waveProfile(x) {
  const w = x.wave
  const etaPhase = (w.etaDeg * Math.PI) / 180
  return {
    axis: 'x',
    cut: 0,
    from: 0,
    to: 2 * w.lambda,
    scalar: { read: (z) => Math.exp(-w.alpha * z) * Math.cos(w.beta * z), label: 'Electric field', unit: 'V/m' },
    secondary: {
      read: (z) => (Math.exp(-w.alpha * z) / w.etaMag) * Math.cos(w.beta * z - etaPhase),
      label: 'Magnetic field',
      unit: 'A/m',
    },
    regions: [{ from: 0, to: w.lambda, label: 'one wavelength', edge: true }],
  }
}

export const G_GROUP = [
  {
    id: 'g1',
    group: GROUP,
    kind: 'wave',
    name: 'The displacement current closes the set',
    terms: ['displacement', 'maxwell', 'chargeconservation'],
    params: [
      Area('area', 'Plate area', 1e-4),
      Len('gap', 'Plate spacing', 1e-3),
      Eps('epsr', 'Dielectric', 1),
      Ratio('rate', 'Volts a second', 1e6, 'How fast the plates are charging', 1e3, 1e9),
    ],
    // Both sides of the same equality, each from the engine's own quantities.
    // Through the wire the current is C dV/dt. Through the gap it is the
    // displacement current density eps dE/dt times the area, and E is V over
    // the gap, so it comes to eps A / gap times dV/dt. The two agree because
    // eps A / gap is what `capacitance` returns for this geometry.
    displacement: (p) => {
      const geometry = { kind: 'parallelPlate', area: p.area, gap: p.gap, epsr: p.epsr }
      const C = capacitance(geometry)
      const eps = epsOf(geometry)
      const conduction = C.value * p.rate
      const density = (eps * p.rate) / p.gap
      const through = density * p.area
      return { C: C.value, eps, epsr: p.epsr, conduction, density, through, difference: Math.abs(conduction - through), rate: p.rate }
    },
    view: 'numbers',
    views: ['numbers', 'profile'],
    profile: (p, x) => ({
      axis: 'x',
      cut: 0,
      from: -p.gap,
      to: 2 * p.gap,
      scalar: {
        read: (z) => (z >= 0 && z <= p.gap ? x.displacement.through : x.displacement.conduction),
        label: 'Current through a surface here',
        unit: 'A',
      },
      regions: [
        { from: -p.gap, to: 0, label: 'wire' },
        { from: 0, to: p.gap, label: 'gap', edge: true },
        { from: p.gap, to: 2 * p.gap, label: 'wire' },
      ],
    }),
    headline: (x) => ({ value: x.displacement.conduction, unit: 'A', label: 'Current through the wire' }),
    domain: (p) => ({ width: 3 * p.gap, height: 2 * Math.sqrt(p.area), centre: true }),
  },
  {
    id: 'g2',
    group: GROUP,
    kind: 'wave',
    name: 'The plane wave in free space',
    terms: ['planewave', 'intrinsicimpedance', 'wavelength', 'phasevelocity'],
    params: [
      Freq('f', 'Frequency', 1e9, undefined, 1e3, 1e12),
      Eps('epsr', 'Relative permittivity', 1),
      Mu('mur', 'Relative permeability', 1),
    ],
    medium: (p) => ({ epsr: p.epsr, mur: p.mur, sigma: 0 }),
    view: 'wave',
    views: ['wave', 'numbers', 'profile'],
    profile: (p, x) => waveProfile(x),
    headline: (x) => ({ value: x.wave.etaMag, unit: 'Ω', label: 'Intrinsic impedance' }),
    domain: (p) => ({ width: 1, height: 1, centre: true }),
  },
  {
    id: 'g3',
    group: GROUP,
    kind: 'wave',
    name: 'A lossy medium, and the loss tangent',
    terms: ['losstangent', 'attenuation', 'penetration', 'goodconductor'],
    params: [
      Freq('f', 'Frequency', 1e6, undefined, 1e2, 1e12),
      Eps('epsr', 'Relative permittivity', 81, 'Sea water at radio frequencies'),
      Sigma('sigma', 'Conductivity', 4, 'Sea water, four siemens a metre'),
      Mu('mur', 'Relative permeability', 1),
    ],
    medium: (p) => ({ epsr: p.epsr, mur: p.mur, sigma: p.sigma }),
    view: 'wave',
    views: ['wave', 'numbers', 'profile'],
    profile: (p, x) => waveProfile(x),
    headline: (x) => ({ value: x.wave.lossTangent, unit: '', label: 'Loss tangent' }),
    domain: (p) => ({ width: 1, height: 1, centre: true }),
  },
  {
    id: 'g4',
    group: GROUP,
    kind: 'wave',
    name: 'Polarisation is the phase between two components',
    terms: ['polarisation', 'axialratio', 'circularpolarisation'],
    params: [
      Ratio('ax', 'Amplitude across', 1, 'The x component, in volts per metre', 0, 10),
      Ratio('ay', 'Amplitude up', 1, 'The y component, in volts per metre', 0, 10),
      Deg('phase', 'Phase between them', 90, 'How far the up part lags the one across', 0, 360),
      Freq('f', 'Frequency', 1e9, undefined, 1e3, 1e12),
    ],
    polarisation: (p) => ({ ax: p.ax, ay: p.ay, phaseDeg: p.phase }),
    medium: () => ({ epsr: 1, mur: 1, sigma: 0 }),
    view: 'wave',
    views: ['wave', 'numbers'],
    headline: (x) => ({ value: x.pol.axialRatio, unit: '', label: 'Axial ratio' }),
    domain: () => ({ width: 1, height: 1, centre: true }),
  },
]
