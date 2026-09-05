// The deterministic random settings every fuzz test in this package draws from.
//
// A fuzzer that reseeds itself is a fuzzer whose failures cannot be reproduced,
// so this one is a linear congruential generator with the seed the caller
// names. The same seed gives the same run on every machine and in every order,
// which is what makes a failing case worth reporting.
//
// It lives in its own module rather than in one test file because six test
// files draw from it, and a copy in each would drift.

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

/**
 * A random geometry of the given kind, with dimensions inside ranges a lesson
 * would use. The ranges are narrower than the validator allows, deliberately.
 * A fuzz test checks a formula against an integral, and an aspect ratio of a
 * million puts the integral's own error above the difference being measured.
 */
export function randomGeometry(r, kind) {
  const epsr = logUniform(r, 1, 10)
  const mur = pick(r, [1, 1, 1, logUniform(r, 1, 5000)])
  const length = logUniform(r, 0.01, 10)
  switch (kind) {
    case 'parallelPlate':
      return { kind, area: logUniform(r, 1e-6, 1e-2), gap: logUniform(r, 1e-5, 1e-2), epsr, length }
    case 'coax': {
      const a = logUniform(r, 1e-4, 5e-3)
      return { kind, a, b: a * logUniform(r, 1.5, 20), epsr, mur, length }
    }
    case 'spherical': {
      const a = logUniform(r, 1e-3, 0.5)
      return { kind, a, b: a * logUniform(r, 1.1, 30), epsr, length }
    }
    case 'twoWire': {
      const a = logUniform(r, 1e-4, 2e-3)
      return { kind, a, d: a * logUniform(r, 2.5, 200), epsr, mur, length }
    }
    case 'wireOverGround': {
      const a = logUniform(r, 1e-4, 2e-3)
      return { kind, a, h: a * logUniform(r, 1.5, 200), epsr, mur, length }
    }
    case 'bar':
      return { kind, area: logUniform(r, 1e-8, 1e-3), len: logUniform(r, 1e-3, 10), epsr, length }
    case 'solenoid':
      return { kind, area: logUniform(r, 1e-6, 1e-2), len: logUniform(r, 0.01, 1), turns: Math.round(uniform(r, 10, 2000)), mur, length }
    case 'toroid': {
      const a = logUniform(r, 5e-3, 0.1)
      return { kind, a, b: a * logUniform(r, 1.2, 4), height: logUniform(r, 2e-3, 0.05), turns: Math.round(uniform(r, 10, 1000)), mur, length }
    }
    case 'loop': {
      const a = logUniform(r, 5e-3, 0.5)
      return { kind, a, wire: a * logUniform(r, 1e-3, 0.05), mur, length }
    }
    default:
      throw new Error(`randomGeometry has no case for ${kind}`)
  }
}

/** How far apart two numbers are, relative to the larger. */
export const relative = (a, b) => Math.abs(a - b) / Math.max(1e-300, Math.max(Math.abs(a), Math.abs(b)))
