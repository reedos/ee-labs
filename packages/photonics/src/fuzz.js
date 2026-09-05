// The deterministic random settings every fuzz test in this package draws from.
//
// A fuzzer that reseeds itself is a fuzzer whose failures cannot be reproduced,
// so this one is a linear congruential generator with the seed the caller
// names. The same seed gives the same run on every machine and in every order,
// which is what makes a failing case worth reporting.

/** A generator seeded with `seed`, returning numbers in [0, 1). */
export function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

/** A number spread evenly between lo and hi. */
export const uniform = (r, lo, hi) => lo + (hi - lo) * r()

/** A number spread evenly in the logarithm, for a decade-spanning quantity. */
export const logUniform = (r, lo, hi) => lo * Math.pow(hi / lo, r())

/** One of `list`, chosen evenly. */
export const pick = (r, list) => list[Math.min(list.length - 1, Math.floor(r() * list.length))]

/** How far apart two numbers are, relative to the larger. */
export const relative = (a, b) => Math.abs(a - b) / Math.max(1e-300, Math.max(Math.abs(a), Math.abs(b)))

/** The three windows a fibre link uses, in metres. */
export const BANDS = [850e-9, 1310e-9, 1550e-9]

/** A wavelength inside one of the three windows, chosen at random within a band. */
export function randomWavelength(r) {
  const centre = pick(r, BANDS)
  return centre * uniform(r, 0.94, 1.06)
}

/** A random single-mode fibre: two indices close together, a core, and a length. */
export function randomFibre(r) {
  const n1 = uniform(r, 1.44, 1.5)
  return {
    n1,
    n2: n1 * uniform(r, 0.99, 0.9995),
    a: logUniform(r, 2e-6, 30e-6),
    alpha: logUniform(r, 0.15, 3),
    D: uniform(r, -8, 22),
    length: logUniform(r, 0.1, 300),
  }
}

/** A random two-mirror cavity: a length, an index and two reflectances below one. */
export function randomCavity(r) {
  return {
    n: uniform(r, 1, 3.6),
    length: logUniform(r, 50e-6, 0.1),
    R1: uniform(r, 0.05, 0.995),
    R2: uniform(r, 0.05, 0.995),
    lossInternal: pick(r, [0, 0, uniform(r, 1, 4000)]),
  }
}
