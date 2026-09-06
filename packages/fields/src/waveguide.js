// The rectangular waveguide and the rectangular cavity.
//
// A hollow metal pipe carries no TEM wave, because a TEM wave needs two
// conductors. What it carries instead is a set of modes, each with a frequency
// below which it does not propagate at all. Every number here is a closed form
// of the guide's two dimensions and the material inside it, and all of them are
// exact for a guide with perfectly conducting walls.
//
// The one place a wall's finite conductivity enters is the cavity's quality
// factor, and there it enters through an integral of the mode's own field over
// the six walls, done in closed form in `cavityQ`. That calculation assumes the
// field inside is the perfect-wall field, which is the standard perturbation
// argument, so it carries its guard: the ratio of the skin depth to the
// cavity's smallest dimension.

import { C0, EPS0, MU0, positive, require_ } from './const.js'
import { skinDepth } from './induction.js'

/**
 * A rectangular guide of internal width `a` and height `b`, filled with a
 * medium. By convention a is the wider dimension, and the function says so
 * rather than silently swapping them, because which is which decides the
 * dominant mode's polarisation.
 */
export function describeGuide(spec) {
  const a = positive(spec.a, 'a')
  const b = positive(spec.b, 'b')
  const epsr = positive(spec.epsr ?? 1, 'epsr')
  const mur = positive(spec.mur ?? 1, 'mur')
  require_(
    a >= b,
    `By convention a is the guide's wider dimension. Here a is ${a} m and b is ${b} m, so the two are the wrong way round and every mode name below would be misleading.`,
    { field: 'a' },
  )
  const v = C0 / Math.sqrt(epsr * mur)
  return { a, b, epsr, mur, v, eta: 376.730313412 * Math.sqrt(mur / epsr) }
}

/**
 * The cutoff frequency of the TE or TM mode (m, n):
 *
 *   f_c = (v / 2) sqrt((m/a)^2 + (n/b)^2)
 *
 * with v the speed of light in the filling. TE10 has the lowest cutoff of any
 * mode in a guide with a wider than b, which is why it is the dominant mode and
 * why a standard guide is about twice as wide as it is tall.
 */
export function cutoff(guide, m, n) {
  const g = describeGuide(guide)
  require_(Number.isInteger(m) && Number.isInteger(n) && m >= 0 && n >= 0, `Mode indices are whole numbers at or above zero, and they are (${m}, ${n}).`, { field: 'm' })
  require_(m + n > 0, 'The mode (0, 0) does not exist. A hollow pipe has no TEM mode, because a TEM wave needs two conductors.', { field: 'm' })
  return (g.v / 2) * Math.hypot(m / g.a, n / g.b)
}

/**
 * Every TE and TM mode with a cutoff below `upTo`, in order of cutoff.
 *
 * TM modes need both indices at least one, because a TM mode with a zero index
 * has no field. TE modes need only one of them. The list is what the app's
 * mode chart draws, and it is what shows that a guide has a band, between the
 * first and second cutoffs, where exactly one mode propagates.
 */
export function modes(guide, upTo, { maxIndex = 6 } = {}) {
  const g = describeGuide(guide)
  const out = []
  for (let m = 0; m <= maxIndex; m++) {
    for (let n = 0; n <= maxIndex; n++) {
      if (m + n === 0) continue
      const fc = cutoff(g, m, n)
      if (fc > upTo) continue
      out.push({ family: 'TE', m, n, fc, name: `TE${m}${n}` })
      if (m > 0 && n > 0) out.push({ family: 'TM', m, n, fc, name: `TM${m}${n}` })
    }
  }
  out.sort((x, y) => x.fc - y.fc || x.family.localeCompare(y.family))
  return out
}

/**
 * The single-mode band: from the dominant mode's cutoff to the next mode's.
 * A guide is used inside this band, and the ratio of its two ends is what a
 * guide's catalogue entry quotes.
 */
export function singleModeBand(guide) {
  const g = describeGuide(guide)
  const list = modes(g, 10 * cutoff(g, 1, 0))
  const first = list[0]
  const second = list.find((x) => x.fc > first.fc * (1 + 1e-12))
  return { from: first.fc, to: second ? second.fc : Infinity, dominant: first.name, next: second ? second.name : null, ratio: second ? second.fc / first.fc : Infinity }
}

/**
 * A mode at a frequency: propagating or evanescent, and everything that follows.
 *
 * Above cutoff:
 *
 *   beta      = (2 pi f / v) sqrt(1 - (fc/f)^2)
 *   lambda_g  = 2 pi / beta                      always longer than in free space
 *   vp        = omega / beta                     always faster than v
 *   vg        = v^2 / vp                         always slower than v
 *   eta_TE    = eta / sqrt(1 - (fc/f)^2)
 *   eta_TM    = eta sqrt(1 - (fc/f)^2)
 *
 * The phase velocity above the speed of light is not a signal travelling that
 * fast. The product of the phase and group velocities is exactly v squared, and
 * the group velocity is what carries energy. `check` returns that product so a
 * lesson can measure the claim rather than assert it.
 *
 * Below cutoff the mode does not propagate. beta is zero, the field decays with
 * distance at alpha nepers per metre, and no real power travels. The function
 * reports that as `propagating: false` with the decay, rather than returning an
 * imaginary wavelength without comment.
 */
export function modeAt(guide, f, { m = 1, n = 0, family = 'TE' } = {}) {
  const g = describeGuide(guide)
  positive(f, 'f')
  const fc = cutoff(g, m, n)
  const ratio = fc / f
  const omega = 2 * Math.PI * f
  const k = omega / g.v
  if (f <= fc) {
    const alpha = ((2 * Math.PI * fc) / g.v) * Math.sqrt(1 - (f / fc) ** 2)
    return {
      name: `${family}${m}${n}`,
      fc,
      f,
      propagating: false,
      alpha,
      dbPerMetre: alpha * 8.685889638065035,
      decayLength: alpha === 0 ? Infinity : 1 / alpha,
      says: `At ${(f / 1e9).toPrecision(4)} GHz the ${family}${m}${n} mode is below its ${(fc / 1e9).toPrecision(4)} GHz cutoff. The field decays at ${(alpha * 8.685889638065035).toPrecision(3)} dB per metre and carries no power along the guide.`,
    }
  }
  const factor = Math.sqrt(1 - ratio * ratio)
  const beta = k * factor
  const vp = omega / beta
  const vg = g.v * g.v / vp
  return {
    name: `${family}${m}${n}`,
    fc,
    f,
    propagating: true,
    beta,
    k,
    factor,
    lambdaGuide: (2 * Math.PI) / beta,
    lambdaFree: g.v / f,
    vp,
    vg,
    eta: family === 'TE' ? g.eta / factor : g.eta * factor,
    check: { vpvg: vp * vg, v2: g.v * g.v },
    says: `At ${(f / 1e9).toPrecision(4)} GHz the ${family}${m}${n} mode propagates, ${(f / fc).toPrecision(3)} times its cutoff. The guide wavelength is ${(((2 * Math.PI) / beta) * 1000).toPrecision(4)} mm against ${((g.v / f) * 1000).toPrecision(4)} mm in free space.`,
  }
}

/**
 * The TE10 field pattern across the guide, for the field map.
 *
 *   E_y = E0 sin(pi x / a)
 *
 * and nothing else transverse. The field is zero at both side walls and largest
 * in the middle, which is where a probe goes and where the guide breaks down.
 */
export function te10Field(guide, x, { E0 = 1 } = {}) {
  const g = describeGuide(guide)
  return { ex: 0, ey: E0 * Math.sin((Math.PI * x) / g.a), mag: Math.abs(E0 * Math.sin((Math.PI * x) / g.a)) }
}

/**
 * A rectangular cavity: a length `d` of guide shorted at both ends.
 *
 *   f_mnp = (v / 2) sqrt((m/a)^2 + (n/b)^2 + (p/d)^2)
 *
 * Exact. The dominant resonance of a cavity longer than it is tall is TE101,
 * and `resonances` lists the rest in order so a lesson can show how close the
 * neighbours sit.
 */
export function cavityResonance(spec, { m = 1, n = 0, p = 1 } = {}) {
  const g = describeGuide(spec)
  const d = positive(spec.d, 'd')
  require_(m + n + p >= 2, `A cavity mode needs at least two non-zero indices, and it has (${m}, ${n}, ${p}).`, { field: 'm' })
  return (g.v / 2) * Math.sqrt((m / g.a) ** 2 + (n / g.b) ** 2 + (p / d) ** 2)
}

/** Every cavity resonance up to `upTo`, in order. */
export function resonances(spec, upTo, { maxIndex = 3 } = {}) {
  const out = []
  for (let m = 0; m <= maxIndex; m++) {
    for (let n = 0; n <= maxIndex; n++) {
      for (let p = 0; p <= maxIndex; p++) {
        if (m + n + p < 2) continue
        if ([m, n, p].filter((x) => x === 0).length > 1) continue
        const f = cavityResonance(spec, { m, n, p })
        if (f <= upTo) out.push({ m, n, p, f, name: `TE${m}${n}${p}` })
      }
    }
  }
  out.sort((x, y) => x.f - y.f)
  return out
}

/**
 * The unloaded quality factor of the TE101 mode, from the energy it stores and
 * the power its walls dissipate.
 *
 * The TE101 field in a box a by b by d is
 *
 *   E_y = E0 sin(pi x / a) sin(pi z / d)
 *   H_x = (E0 / (j omega mu)) (pi / d) sin(pi x / a) cos(pi z / d)
 *   H_z = -(E0 / (j omega mu)) (pi / a) cos(pi x / a) sin(pi z / d)
 *
 * The stored energy is eps E0^2 a b d / 8, because at resonance the electric
 * and magnetic stores are equal and the electric one integrates in closed form.
 * The wall loss is (Rs / 2) times the integral of the tangential H squared over
 * the six walls, and every one of those integrals is a product of sine-squared
 * averages, so it too is closed form:
 *
 *   P = (Rs / 2) A^2 [ (pi/a)^2 b d + (pi/d)^2 a b + (a d / 2) pi^2 (1/a^2 + 1/d^2) ]
 *
 * with A = E0 / (omega mu). Q is omega W / P, and E0 cancels.
 *
 * The guard, under Rule 3. The calculation puts the perfect-wall field into a
 * lossy wall, which is the standard perturbation argument, and it holds while
 * the skin depth is small against the cavity. The threshold is a skin depth of
 * one thousandth of the smallest dimension.
 */
export function cavityQ(spec, { sigma, mode = 'TE101' } = {}) {
  require_(mode === 'TE101', `cavityQ computes the TE101 mode, and it was asked for ${mode}.`, { field: 'mode' })
  const g = describeGuide(spec)
  const d = positive(spec.d, 'd')
  positive(sigma, 'sigma')
  const f = cavityResonance(spec, { m: 1, n: 0, p: 1 })
  const omega = 2 * Math.PI * f
  const eps = EPS0 * g.epsr
  const mu = MU0 * g.mur
  const delta = skinDepth(f, { mur: 1, sigma })
  const Rs = 1 / (sigma * delta)
  const a = g.a
  const b = g.b
  // With E0 = 1: A = 1 / (omega mu).
  const A2 = 1 / (omega * mu) ** 2
  const W = (eps * a * b * d) / 8
  const P =
    (Rs / 2) *
    A2 *
    ((Math.PI / a) ** 2 * b * d + (Math.PI / d) ** 2 * a * b + ((a * d) / 2) * Math.PI ** 2 * (1 / a ** 2 + 1 / d ** 2))
  const Q = (omega * W) / P
  const smallest = Math.min(a, b, d)
  const ratio = delta / smallest
  return {
    f,
    Q,
    Rs,
    delta,
    storedEnergy: W,
    wallLoss: P,
    bandwidth: f / Q,
    guard: {
      quantity: 'skin depth over the smallest cavity dimension',
      value: ratio,
      threshold: 1e-3,
      ok: ratio <= 1e-3,
      says:
        ratio <= 1e-3
          ? `The skin depth is ${(delta * 1e9).toPrecision(3)} nm against a smallest dimension of ${(smallest * 1000).toPrecision(3)} mm, so the walls barely disturb the field and the perturbation holds.`
          : `The skin depth is ${(delta * 1e6).toPrecision(3)} micrometres against a smallest dimension of ${(smallest * 1000).toPrecision(3)} mm. That is past the one-in-a-thousand threshold, the field inside is no longer the perfect-wall field, and this Q is optimistic.`,
    },
  }
}
