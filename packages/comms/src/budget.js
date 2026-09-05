// The link budget, four rows of it.
//
// The map gives the link budget to the System Lab, which sits above the RF Lab.
// This file computes the noise floor, the free-space path loss, one margin and
// one implementation-loss table, and nothing else. Antenna patterns, a real
// front end's cascaded noise figure over measured stages, and interference
// budgets are that lab's.

import { BOLTZMANN } from '@ee-labs/random'

/** The speed of light in a vacuum, in metres a second. */
export const LIGHT = 299792458

/** The reference temperature a noise figure is quoted at, in kelvin. */
export const T_REF = 290

/** `kT` in dBm per hertz. At 290 K this is the −173.9752 every budget starts from. */
export function ktDbm(tempK = T_REF) {
  return 10 * Math.log10(BOLTZMANN * tempK * 1000)
}

/** The noise power in a band, at a stated noise figure, in dBm. */
export function noiseFloorDbm({ tempK = T_REF, bandwidth = 1e6, noiseFigureDb = 6 }) {
  return ktDbm(tempK) + 10 * Math.log10(bandwidth) + noiseFigureDb
}

/** The wavelength of a frequency, in metres. */
export const wavelength = (frequency) => LIGHT / frequency

/**
 * Free-space path loss, `20 log10(4 pi d / lambda)`.
 * Twenty decibels a decade of distance is the whole shape of the curve.
 */
export function pathLossDb({ distance = 1000, frequency = 2.4e9 }) {
  return 20 * Math.log10((4 * Math.PI * distance) / wavelength(frequency))
}

/** The distance at which the path loss reaches a given figure. */
export function rangeFor({ lossDb, frequency = 2.4e9 }) {
  return (wavelength(frequency) * 10 ** (lossDb / 20)) / (4 * Math.PI)
}

/**
 * Friis, the cascaded noise figure of a chain of stages.
 * `F = F1 + (F2 - 1)/G1 + (F3 - 1)/(G1 G2) + …`, so the first stage sets most
 * of it and the order of two stages is not free. H1 swaps them and reads the
 * difference.
 */
export function friisNoiseFigure(stages) {
  let f = 0
  let gain = 1
  for (const s of stages) {
    f += (10 ** (s.noiseFigureDb / 10) - 1) / gain
    gain *= 10 ** (s.gainDb / 10)
  }
  return { factor: f + 1, db: 10 * Math.log10(f + 1), gainDb: 10 * Math.log10(gain) }
}

/**
 * The whole budget, from the transmitter to a margin.
 *
 * Every line is arithmetic on the knobs above it, so a reader who moves the
 * distance watches the margin move and the range with it.
 */
export function linkBudget({
  txDbm = 20,
  antennaDbi = 2,
  distance = 1000,
  frequency = 2.4e9,
  bandwidth = 1e6,
  bitRate = 2e6,
  noiseFigureDb = 6,
  tempK = T_REF,
  requiredEbN0Db = 9.5879,
}) {
  const loss = pathLossDb({ distance, frequency })
  const received = txDbm + 2 * antennaDbi - loss
  const floor = noiseFloorDbm({ tempK, bandwidth, noiseFigureDb })
  const snr = received - floor
  const ebN0 = snr + 10 * Math.log10(bandwidth / bitRate)
  const margin = ebN0 - requiredEbN0Db
  return {
    wavelength: wavelength(frequency),
    pathLoss: loss,
    received,
    noiseFloor: floor,
    kT: ktDbm(tempK),
    snr,
    ebN0,
    margin,
    // At zero margin the extra path loss the margin allows has been spent.
    range: rangeFor({ lossDb: loss + margin, frequency }),
    requiredEbN0Db,
  }
}

/**
 * What the implementation costs, as the four losses this lab has already
 * computed. Each comes from the experiment that measured it, so turning a knob
 * in that experiment moves this total.
 */
export function implementationLoss({ prefixCostDb, pilotCostDb, hardDecisionDb, timingLossDb }) {
  const rows = [
    { name: 'Cyclic prefix', db: prefixCostDb, from: 'F6' },
    { name: 'Pilot subcarriers', db: pilotCostDb, from: 'F6' },
    { name: 'Hard decision', db: hardDecisionDb, from: 'D2' },
    { name: 'Timing error', db: timingLossDb, from: 'C5' },
  ]
  return { rows, total: rows.reduce((s, r) => s + r.db, 0) }
}

/**
 * What a hard decision costs against a soft one.
 *
 * The classical figure for the binary-input additive white Gaussian channel is
 * `10 log10(4/pi)`, which is 1.0526 dB at low rate and about 2 dB at the rates
 * a coded link runs. The value used here is the one the plan states, and it is
 * a parameter of the budget rather than a measurement of this lab's chain,
 * because measuring it needs the Information Lab's decoder.
 */
export const HARD_DECISION_DB = 1.585
