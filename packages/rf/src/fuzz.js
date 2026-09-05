// The random networks and terminations the invariants are fuzzed over.
//
// One generator, shared by every test file, so that a claim proved in
// convert.test.js and a claim proved in cascade.test.js are proved over the
// same population. RF_LAB_PLAN.md §7 names the hostile corners this file has to
// reach: a lossless resonance between two mismatched ports, a load on the unit
// circle, and a line a whole wavelength long.
//
// Nothing here is random at run time. The generator is a linear congruence with
// the seed passed in, so a failure names a seed a person can re-run.

import { complex as cx } from '@ee-labs/network'

const { C } = cx

/** A deterministic stream of numbers in [0, 1). */
export function rng(seed) {
  let s = (seed >>> 0) || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

/** A value drawn logarithmically between two bounds. */
export const logPick = (r, lo, hi) => lo * Math.pow(hi / lo, r())

/**
 * A ladder of series and shunt elements between two ports, as a netlist.
 *
 * `lossless` leaves the resistors out, which is the population invariant 3's
 * unitarity half is checked over. Node names are fixed: `p1` and `p2` are the
 * ports and every internal node is numbered.
 */
export function randomLadder(seed, { sections = 3, lossless = false } = {}) {
  const r = rng(seed)
  const elements = []
  let node = 'p1'
  for (let k = 0; k < sections; k++) {
    const next = k === sections - 1 ? 'p2' : `n${k}`
    // A series arm: an inductor, a capacitor, or (when loss is allowed) a
    // resistor. A shunt arm hangs off the node the arm arrives at.
    const pick = Math.floor(r() * (lossless ? 2 : 3))
    if (pick === 0) elements.push({ type: 'L', id: `Ls${k}`, nodes: [node, next], value: logPick(r, 1e-9, 1e-6) })
    else if (pick === 1) elements.push({ type: 'C', id: `Cs${k}`, nodes: [node, next], value: logPick(r, 1e-12, 1e-9) })
    else elements.push({ type: 'R', id: `Rs${k}`, nodes: [node, next], value: logPick(r, 1, 200) })
    const shunt = Math.floor(r() * (lossless ? 2 : 3))
    if (shunt === 0) elements.push({ type: 'C', id: `Cp${k}`, nodes: [next, 'gnd'], value: logPick(r, 1e-12, 1e-9) })
    else if (shunt === 1) elements.push({ type: 'L', id: `Lp${k}`, nodes: [next, 'gnd'], value: logPick(r, 1e-9, 1e-6) })
    else elements.push({ type: 'R', id: `Rp${k}`, nodes: [next, 'gnd'], value: logPick(r, 10, 5000) })
    node = next
  }
  // Every port must reach ground through something, so that a solve at any
  // frequency has a path. The last shunt arm gives port 2 one, and this gives
  // port 1 the same.
  elements.push({ type: 'R', id: 'Rleak', nodes: ['p1', 'gnd'], value: lossless ? 1e12 : logPick(r, 1e3, 1e6) })
  return { elements, ports: ['p1', 'p2'] }
}

/** A random passive two-port's scattering matrix, with the frequency it was taken at. */
export function randomFrequency(seed) {
  return logPick(rng(seed), 1e7, 1e10)
}

/** A random complex load, sometimes real, sometimes on the unit circle of reflection. */
export function randomLoad(seed, z0 = 50) {
  const r = rng(seed)
  const pick = r()
  if (pick < 0.2) return C(logPick(r, 1, 5000), 0)
  if (pick < 0.35) return C(0, logPick(r, 1, 5000) * (r() < 0.5 ? -1 : 1))
  if (pick < 0.45) return Infinity
  return C(logPick(r, 1, 5000), logPick(r, 1, 5000) * (r() < 0.5 ? -1 : 1))
}

/**
 * A pi attenuator of a stated loss in a stated reference, in closed form, so
 * the netlist a test uses is a function of the decibels and not a table.
 *
 *   K = 10^(L/20)
 *   R_shunt  = Z0 (K + 1) / (K - 1)
 *   R_series = Z0 (K^2 - 1) / (2 K)
 */
export function piPad(lossDb, z0 = 50) {
  const K = Math.pow(10, lossDb / 20)
  const shunt = (z0 * (K + 1)) / (K - 1)
  const series = (z0 * (K * K - 1)) / (2 * K)
  return {
    series,
    shunt,
    elements: [
      { type: 'R', id: 'Rp1', nodes: ['p1', 'gnd'], value: shunt },
      { type: 'R', id: 'Rs', nodes: ['p1', 'p2'], value: series },
      { type: 'R', id: 'Rp2', nodes: ['p2', 'gnd'], value: shunt },
    ],
    ports: ['p1', 'p2'],
  }
}
