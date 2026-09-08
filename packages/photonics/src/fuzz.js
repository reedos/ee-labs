// The deterministic random settings every fuzz test in this package draws from.
//
// A fuzzer that reseeds itself is a fuzzer whose failures cannot be reproduced,
// so this one is a linear congruential generator with the seed the caller
// names. The same seed gives the same run on every machine and in every order.
//
// The three wavelength bands are the ones a fibre link is built in, and they are
// here rather than in each test because `PHOTONICS_LAB_PLAN.md` §2.11 fuzzes
// "random wavelengths in the three bands" and every file has to mean the same
// three.

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

/** The three windows a fibre link is built in, as [low, high] in metres. */
export const BANDS = [
  [800e-9, 900e-9],
  [1260e-9, 1360e-9],
  [1500e-9, 1620e-9],
]

/** A wavelength in one of the three bands, chosen evenly among them. */
export const randomWavelength = (r) => {
  const [lo, hi] = pick(r, BANDS)
  return uniform(r, lo, hi)
}

/** A fibre a lesson would load: an attenuation, a dispersion parameter and a length. */
export const randomFibre = (r) => ({
  alphaDb: logUniform(r, 0.15, 3),
  D: uniform(r, -5, 20) * 1e-6,
  length: logUniform(r, 100, 200e3),
  dLambda: logUniform(r, 1e-12, 5e-9),
})

/** A cavity a lesson would load: an index, a length and two reflectances. */
export const randomCavity = (r) => ({
  n: uniform(r, 1, 3.6),
  L: logUniform(r, 50e-6, 0.1),
  r1: uniform(r, 0.05, 0.995),
  r2: uniform(r, 0.05, 0.995),
})

/**
 * A laser a lesson would load: the six rate parameters, each inside the decade
 * a real edge emitter sits in.
 *
 * The spontaneous coupling is left at zero on purpose. At zero the steady state
 * is the pair of closed forms the plan writes, which is what invariants 4 to 7
 * measure, and a fuzzer that also moved the coupling would be measuring the
 * quadratic instead. `randomCoupledLaser` is the one that moves it.
 */
export const randomLaser = (r) => ({
  g0: logUniform(r, 1e-12, 8e-12),
  ntr: logUniform(r, 3e23, 3e24),
  gamma: uniform(r, 0.1, 0.8),
  tauC: logUniform(r, 0.5e-9, 5e-9),
  tauP: logUniform(r, 0.8e-12, 1e-11),
  V: logUniform(r, 3e-17, 3e-16),
  beta: 0,
})

/** The same laser, with a spontaneous coupling, which is what a soft turn-on needs. */
export const randomCoupledLaser = (r) => ({ ...randomLaser(r), beta: logUniform(r, 1e-6, 1e-3) })
