// The complex arithmetic this package uses, which is `packages/network`'s.
//
// Phasors are [re, im] pairs everywhere in the suite, and this file re-exports
// that namespace under the names the rest of `packages/grid` reads, plus the
// three functions a transmission line needs and a lumped circuit does not:
// the complex square root and the two hyperbolic functions of line.js §exact.

import { complex } from '@ee-labs/network'

export const { C, cadd, csub, cmul, cscale, cdiv, conj, cabs, carg, cexpj, polar, asComplex } = complex

/** cosh of a complex argument, from the two real identities. */
export const ccosh = (z) => [Math.cosh(z[0]) * Math.cos(z[1]), Math.sinh(z[0]) * Math.sin(z[1])]

/** sinh of a complex argument. */
export const csinh = (z) => [Math.sinh(z[0]) * Math.cos(z[1]), Math.cosh(z[0]) * Math.sin(z[1])]

/** The principal square root, by half the angle and the root of the modulus. */
export const csqrt = (z) => {
  const r = Math.hypot(z[0], z[1])
  const th = Math.atan2(z[1], z[0]) / 2
  return [Math.sqrt(r) * Math.cos(th), Math.sqrt(r) * Math.sin(th)]
}

/** Degrees from radians, for every angle a reader sees. */
export const deg = (rad) => (rad * 180) / Math.PI

/** Radians from degrees. */
export const rad = (d) => (d * Math.PI) / 180
