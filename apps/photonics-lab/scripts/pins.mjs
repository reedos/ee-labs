// Every number this lab's brief and its lessons quote, computed from the engine.
//
//   node apps/photonics-lab/scripts/pins.mjs
//
// `PROGRAM.md` §3 requires that every quoted number is computed by a script
// before it is written. This is that script for the Photonics Lab. It prints
// one labelled line per figure, in the order the groups use them, so a figure
// in `AGENT_BRIEF.md` can be found here and re-run.
//
// Nothing below is typed in except the settings, and the settings are the
// defaults the experiments carry. Groups A, E and F are this sitting's. Groups
// B, C and D need `receiver.js` and `rate.js`, and their sections are absent
// rather than stubbed, so a number for them cannot be quoted before it can be
// computed.

import * as P from '@ee-labs/photonics'
import { newtonDC } from '@ee-labs/network'

const line = (label, value, unit = '') => console.log(`${label.padEnd(52)} ${value}${unit ? ' ' + unit : ''}`)
const sig = (x, n = 5) => (Number.isFinite(x) ? Number(x).toPrecision(n) : String(x))
const head = (t) => console.log(`\n--- ${t} ---`)

const BANDS = { 850: 850e-9, 1310: 1310e-9, 1550: 1550e-9 }

// ------------------------------------------------------- Group A: the photon

head('A1: a photon carries h c over lambda')
line('h c / q, the constant everything is written from', sig(P.EV_UM, 6), 'eV um')
for (const [nm, lambda] of Object.entries(BANDS)) {
  line(`  photon energy at ${nm} nm`, sig(P.photonEnergyEv(lambda)), 'eV')
}
line('optical frequency at 1550 nm', sig(P.opticalFrequency(BANDS[1550]) / 1e12), 'THz')
line('photons a second in 1 mW at 1550 nm', P.photonFlux({ power: 1e-3, lambda: BANDS[1550] }).toExponential(4), '1/s')
line('  the same at 850 nm', P.photonFlux({ power: 1e-3, lambda: BANDS[850] }).toExponential(4), '1/s')

// ------------------------------------------------ A2: the photodiode as a circuit

head('A2: the photodiode is a circuit element')
const PD = { eta: 0.8, lambda: BANDS[1550], power: 1e-6, dark: 1e-9, bias: 5, load: 10000 }
for (const bias of [1, 2, 5, 10]) {
  const { sol } = newtonDC(P.photodiodeNet({ ...PD, bias }))
  line(`  current at ${bias} V of reverse bias`, sig(Math.abs(sol.i.RL) * 1e6), 'uA')
}
{
  const { sol } = newtonDC(P.photodiodeNet(PD))
  line('  the detector node at 5 V bias', sig(sol.v.k), 'V')
  line('  the closed form for the same detector', sig(P.photocurrent(PD) * 1e6), 'uA')
  line('  what the junction takes back', sig(Math.abs(sol.i.D1) * 1e15), 'fA')
}

// -------------------------------------------------------- A3: responsivity

head('A3: responsivity, and where it stops')
for (const [nm, lambda] of Object.entries(BANDS)) {
  line(`  responsivity at ${nm} nm, eta 0.8`, sig(P.responsivity({ eta: 0.8, lambda })), 'A/W')
}
line('the ideal responsivity at 1550 nm', sig(P.idealResponsivity(BANDS[1550])), 'A/W')
line("silicon's cut-off, from a 1.12 eV bandgap", sig(P.cutoffWavelength(1.12) * 1e9), 'nm')
line('  germanium, from 0.66 eV', sig(P.cutoffWavelength(0.66) * 1e9), 'nm')
line('  InGaAs, from 0.75 eV', sig(P.cutoffWavelength(0.75) * 1e9), 'nm')

// --------------------------------------------------------- A4: dark current

head('A4: dark current, and the diode underneath')
for (const power of [1e-6, 1e-7, 1e-8, 1e-9]) {
  const total = P.photocurrent({ eta: 0.8, lambda: BANDS[1550], power, dark: 1e-9 })
  line(`  total current at ${sig(power * 1e9, 3)} nW`, sig(total * 1e9), 'nA')
}
line('the power at which the two are equal', sig(P.darkCrossover({ eta: 0.8, lambda: BANDS[1550], dark: 1e-9 }) * 1e9), 'nW')

// ---------------------------------------------------------- A5: speed and area

head('A5: speed costs area')
const C_PER_AREA = 5e-4
for (const area of [1e-8, 1e-7, 1e-6]) {
  const c = P.detectorCapacitance({ area, cPerArea: C_PER_AREA })
  line(`  ${sig(area * 1e6, 3)} mm2 of detector is`, sig(c * 1e12), 'pF')
  line('    its corner into 1 kohm', sig(P.detectorCorner({ load: 1000, capacitance: c }) / 1e6), 'MHz')
  line('    the power it collects at 1 W/m2', sig(P.collectedPower({ irradiance: 1, area }) * 1e6), 'uW')
}
{
  const area = 1e-7
  const c = P.detectorCapacitance({ area, cPerArea: C_PER_AREA })
  const product = P.collectedPower({ irradiance: 1, area }) * P.detectorCorner({ load: 1000, capacitance: c })
  line('the power-bandwidth product, which area does not move', sig(product), 'W Hz')
}

// -------------------------------------------------------- Group E: the fibre

head('E1: attenuation, and the three windows')
const ALPHA = { 850: 2, 1310: 0.35, 1550: 0.2 }
for (const [nm, alpha] of Object.entries(ALPHA)) {
  const db = P.lossDb({ alpha, length: 80 })
  line(`  ${nm} nm at ${alpha} dB/km over 80 km`, sig(db), 'dB')
  line('    the fraction that survives', P.powerRatio(db).toExponential(4))
}
for (const length of [10, 40, 80]) {
  line(`  1550 nm over ${length} km`, sig(P.lossDb({ alpha: 0.2, length })), 'dB')
}
line('1 mW at 1550 nm arriving over 80 km', sig(P.throughFibre({ alpha: 0.2, length: 80, power: 1e-3 }).out * 1e6), 'uW')

head('E2: dispersion spreads a pulse')
for (const dLambda of [1e-9, 0.5e-9, 0.1e-9]) {
  for (const length of [40, 80]) {
    line(
      `  D = 17, ${sig(dLambda * 1e9, 2)} nm source over ${length} km`,
      sig(P.pulseSpread({ D: 17, length, dLambda }) * 1e12),
      'ps',
    )
  }
}
line('beta2 at 1550 nm for D = 17', sig(P.beta2FromD({ D: 17, lambda: BANDS[1550] })), 'ps2/km')
line('  the same at 1310 nm', sig(P.beta2FromD({ D: 17, lambda: BANDS[1310] })), 'ps2/km')
line('  at D = -2, in the normal band', sig(P.beta2FromD({ D: -2, lambda: BANDS[1550] })), 'ps2/km')
line('  D read back off beta2', sig(P.dFromBeta2({ beta2: P.beta2FromD({ D: 17, lambda: BANDS[1550] }), lambda: BANDS[1550] })), 'ps/(nm km)')

head('E3: the bandwidth-distance product')
line('the criterion in use', String(P.CRITERION))
for (const [dLambda, length] of [
  [1e-9, 80],
  [0.1e-9, 80],
  [1e-9, 10],
  [0.1e-9, 10],
]) {
  const spread = P.pulseSpread({ D: 17, length, dLambda })
  line(
    `  ${sig(dLambda * 1e9, 2)} nm over ${length} km`,
    sig(P.bandwidthLimit({ spread }).rate / 1e9),
    'Gbit/s',
  )
}
line('the product per nanometre of source', sig(P.bandwidthDistance({ D: 17, dLambda: 1e-9 }).product / 1e9), 'Gbit/s km')
line('  under a criterion of 0.5 instead', sig(P.bandwidthDistance({ D: 17, dLambda: 1e-9, criterion: 0.5 }).product / 1e9), 'Gbit/s km')

head('E4: the core, the cladding, and one mode')
const GEO = { n1: 1.4675, n2: 1.4622 }
line('numerical aperture', sig(P.numericalAperture(GEO)))
line('acceptance half-angle', sig(P.acceptanceAngle(GEO)), 'degrees')
line('index contrast', sig(P.indexContrast(GEO) * 100), 'per cent')
line('single-mode core diameter at 1550 nm', sig(P.singleModeCore({ ...GEO, lambda: BANDS[1550] }).diameter * 1e6), 'um')
line('  the same at 1310 nm', sig(P.singleModeCore({ ...GEO, lambda: BANDS[1310] }).diameter * 1e6), 'um')
{
  const V = P.vNumber({ ...GEO, a: 25e-6, lambda: BANDS[850] })
  line('V of a 50 um core at 850 nm', sig(V))
  line('  modes it carries, about', sig(P.modeCount(V).modes, 4))
  line('  the guard on that estimate', P.modeCount(V).ok ? 'holds' : 'loosened')
}
{
  const V = P.vNumber({ ...GEO, a: 4.5e-6, lambda: BANDS[1550] })
  line('V of a 9 um core at 1550 nm', sig(V))
  line('  the guard on the mode estimate there', P.modeCount(V).ok ? 'holds' : 'loosened')
}

head('E5: the link budget, and which limit binds')
const LOSSES = { fibre: P.lossDb({ alpha: 0.2, length: 80 }), connectors: 1, splices: 0.4, dispersion: 1 }
const BUDGET = P.linkBudget({ pinDbm: -3, sensitivityDbm: -28, losses: LOSSES })
for (const item of BUDGET.items) line(`  ${item.name}`, sig(item.db, 4), 'dB')
line('total loss', sig(BUDGET.loss), 'dB')
line('power at the receiver', sig(BUDGET.outDbm), 'dBm')
line('margin over the sensitivity', sig(BUDGET.margin), 'dB')
line('  the same in watts at the transmitter', sig(P.wattsOf(-3) * 1e6), 'uW')
line('  and at the receiver', sig(P.wattsOf(BUDGET.outDbm) * 1e9), 'nW')
const REACH = P.lossLimitedReach({ pinDbm: -3, sensitivityDbm: -28, fixedDb: 2.4, reserveDb: 3, alpha: 0.2 })
line('loss-limited reach, 3 dB reserved', sig(REACH), 'km')
line('dispersion-limited reach at 10 Gbit/s, 1 nm', sig(P.dispersionLimitedReach({ rate: 10e9, D: 17, dLambda: 1e-9 })), 'km')
line('  at 10 Gbit/s with a 0.1 nm source', sig(P.dispersionLimitedReach({ rate: 10e9, D: 17, dLambda: 0.1e-9 })), 'km')
line('  which one binds at 10 Gbit/s', P.bindingLimit({ loss: REACH, dispersion: P.dispersionLimitedReach({ rate: 10e9, D: 17, dLambda: 1e-9 }) }).binds)

// ------------------------------------------------------- Group F: the cavity

head('F1: the Fabry-Perot cavity')
const CAV = { n: 3.5, length: 300e-6 }
const R_FACET = P.facetReflectance({ n: CAV.n })
line('facet reflectance from an index of 3.5', sig(R_FACET))
line('free spectral range', sig(P.freeSpectralRange(CAV) / 1e9), 'GHz')
line('  the same in wavelength at 1550 nm', sig(P.fsrWavelength({ ...CAV, lambda: BANDS[1550] }) * 1e9), 'nm')
for (const R1 of [R_FACET, 0.3, 0.9, 0.99]) {
  const spec = { ...CAV, R1 }
  line(`  finesse at R = ${sig(R1, 5)}`, sig(P.finesse(spec)))
  line('    linewidth', sig(P.linewidth(spec) / 1e9), 'GHz')
  line('    peak to valley contrast', sig(P.contrast(spec).db), 'dB')
  line('    half-power width, exactly', sig(P.halfPowerWidth(spec) / 1e9), 'GHz')
  line('    the guard on the quoted linewidth', `${P.linewidthGuard(spec).ok ? 'holds' : 'loosened'}, ${sig(100 * P.linewidthGuard(spec).error, 3)} per cent out`)
}
line('mirror loss at a bare facet', sig(P.mirrorLoss({ R1: R_FACET, length: CAV.length }) / 100), 'per cm')
line('photon lifetime behind it', sig(P.photonLifetime({ ...CAV, R1: R_FACET }) * 1e12), 'ps')
line('  the same with a 0.9 facet', sig(P.photonLifetime({ ...CAV, R1: 0.9 }) * 1e12), 'ps')
line('the systems hand-over', P.rationalAvailable().ok ? 'admitted' : 'declined')

head('F2: many colours down one fibre')
for (const spacing of [50e9, 100e9, 200e9]) {
  line(`  a ${spacing / 1e9} GHz grid at 1550 nm`, sig(P.gridWavelength({ lambda: BANDS[1550], spacing }) * 1e9), 'nm')
}
const C_BAND = P.bandChannels({ lambdaLow: 1530e-9, lambdaHigh: 1565e-9, spacing: 100e9 })
line('the C band, 1530 nm to 1565 nm', sig(C_BAND.width / 1e12), 'THz')
line('  channels on a 100 GHz grid', String(C_BAND.channels))
line('  channels on a 50 GHz grid', String(P.bandChannels({ lambdaLow: 1530e-9, lambdaHigh: 1565e-9, spacing: 50e9 }).channels))
line('a source narrow enough for that grid', sig(P.gridWavelength({ lambda: BANDS[1550], spacing: 100e9 }) * 1e9), 'nm')
line('  the spread such a source makes over 80 km', sig(P.pulseSpread({ D: 17, length: 80, dLambda: P.gridWavelength({ lambda: BANDS[1550], spacing: 100e9 }) }) * 1e12), 'ps')

console.log('')
