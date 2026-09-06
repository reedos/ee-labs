// Coding gain, measured rather than quoted.
//
// Every gain in Group F is a distance between two curves. The uncoded curve is
// the Communications Lab's closed form, and the coded one is computed here from
// the code's own parameters, so a gain is read off the two rather than taken
// from a table.
//
// Two things in this module are bounds rather than values, and both say so.
// The union bound on a convolutional code's error rate adds one term per error
// event, and the events overlap, so it lies above the true rate. A gain read
// from an upper bound on the error rate is a LOWER bound on the gain. Every
// function that returns one carries `bound: true` and the direction with it
// (CORE_SCOPE.md Rule 3).

import { qFunction } from '@ee-labs/random'
import { CodesError, binomial } from './gf2.js'

/** The uncoded antipodal curve, `Q(√(2 γ_b))`. The Communications Lab's `berClosed('bpsk')` is the same function. */
export const uncodedBer = (ebN0Db) => qFunction(Math.sqrt(2 * 10 ** (ebN0Db / 10)))

/**
 * The channel bit error rate a coded link runs at.
 *
 * The code spends `R` of each message bit's energy on the message, so the
 * energy per transmitted bit is `R E_b` and the channel sees `R γ_b`. That
 * shift is the price of the code, and it is why a code can be worse than no
 * code at a low enough ratio.
 */
export const channelBer = (rate, ebN0Db) => qFunction(Math.sqrt(2 * rate * 10 ** (ebN0Db / 10)))

/**
 * The bit error rate after hard-decision decoding of a block code.
 *
 * A decoder that corrects `t` errors fails when more than `t` of the `n` bits
 * arrive wrong. A failure does not leave the block alone. The decoder finds a
 * syndrome, believes it, and adds an error pattern of weight up to `t` of its
 * own, so a block that arrived with `i` errors leaves with as many as `i + t`.
 * That is the weighting here, and it is the one a bounded-distance decoder
 * earns rather than the optimistic `i/n`.
 *
 * The weight is capped at one, because a block cannot be more than wholly
 * wrong. At the rates this lab draws the cap changes no printed digit, and it
 * keeps the arithmetic honest where `i + t` passes `n`.
 *
 * @returns {{ ber, p, rate, bound: false }} `p` is the channel rate the code ran at.
 */
export function hardBlockBer({ n, k, t }, ebN0Db) {
  const rate = k / n
  const p = channelBer(rate, ebN0Db)
  let acc = 0
  for (let i = t + 1; i <= n; i++) acc += Math.min(1, (i + t) / n) * binomial(n, i) * p ** i * (1 - p) ** (n - i)
  return { ber: acc, p, rate, bound: false }
}

/**
 * The union bound on a convolutional code's bit error rate with soft decisions.
 *
 * `Σ_d B_d Q(√(2 R d γ_b))`, with `B_d` the total input weight of the error
 * events of output weight `d`. Every term counts an event that may overlap
 * another, so the sum lies above the true rate.
 *
 * @returns {{ ber, rate, bound: true, direction }}
 */
export function softConvBound({ rate, spectrum, dFree }, ebN0Db, { maxWeight = null } = {}) {
  const gamma = 10 ** (ebN0Db / 10)
  let acc = 0
  const top = maxWeight ?? spectrum.b.length - 1
  for (let d = dFree; d <= top; d++) {
    const bd = spectrum.b[d] || 0
    if (!bd) continue
    acc += bd * qFunction(Math.sqrt(2 * rate * d * gamma))
  }
  return { ber: Math.min(0.5, acc), rate, bound: true, direction: 'the true rate is at or below this' }
}

/**
 * The same bound with hard decisions.
 *
 * The channel is a binary symmetric one at crossover `p`, and a pair of paths
 * `d` apart is chosen wrongly when more than `d/2` of those `d` places flipped.
 * An even `d` splits the tie, which is the half term.
 */
export function hardConvBound({ rate, spectrum, dFree }, ebN0Db, { maxWeight = null } = {}) {
  const p = channelBer(rate, ebN0Db)
  let acc = 0
  const top = maxWeight ?? spectrum.b.length - 1
  for (let d = dFree; d <= top; d++) {
    const bd = spectrum.b[d] || 0
    if (!bd) continue
    acc += bd * pairwiseHard(d, p)
  }
  return { ber: Math.min(0.5, acc), p, rate, bound: true, direction: 'the true rate is at or below this' }
}

/** The probability a hard-decision decoder prefers a path `d` places away. */
export function pairwiseHard(d, p) {
  let acc = 0
  for (let i = Math.floor(d / 2) + 1; i <= d; i++) acc += binomial(d, i) * p ** i * (1 - p) ** (d - i)
  if (d % 2 === 0) acc += 0.5 * binomial(d, d / 2) * p ** (d / 2) * (1 - p) ** (d / 2)
  return acc
}

/**
 * The energy per bit at which a curve reaches a stated error rate, by bisection.
 *
 * Every curve here falls with the ratio, so the search is exact to the
 * tolerance it is given. A curve that never reaches the target inside the
 * window is refused by name rather than returned as an end of it.
 */
export function ebN0AtBer(berOf, target, { lo = -4, hi = 40, tol = 1e-9 } = {}) {
  if (!(target > 0 && target < 0.5)) throw new CodesError('gain-target', `a target error rate is between 0 and 0.5, not ${target}`)
  if (berOf(hi) > target) throw new CodesError('gain-range', `this curve does not reach ${target} by ${hi} dB`)
  if (berOf(lo) < target) throw new CodesError('gain-range', `this curve is already below ${target} at ${lo} dB`)
  let a = lo
  let b = hi
  while (b - a > tol) {
    const m = 0.5 * (a + b)
    if (berOf(m) > target) a = m
    else b = m
  }
  return 0.5 * (a + b)
}

/**
 * The real coding gain: the horizontal distance between two curves at a stated
 * error rate, in decibels.
 *
 * This is what a link designer spends. The asymptotic gain is what the same two
 * curves approach as the error rate goes to zero, and the two are different
 * numbers.
 *
 * @returns {{ gain, coded, uncoded, target, bound }}
 */
export function realGain({ coded, uncoded, target = 1e-5, bound = false }) {
  const one = ebN0AtBer(uncoded, target)
  const two = ebN0AtBer(coded, target)
  return { gain: one - two, uncoded: one, coded: two, target, bound, direction: bound ? 'the gain is at or above this' : null }
}

/** The asymptotic gain of hard-decision decoding: `10 log₁₀(R(t + 1))`. */
export const asymptoticHard = (rate, t) => 10 * Math.log10(rate * (t + 1))

/** The asymptotic gain of soft-decision decoding: `10 log₁₀(R d)`. */
export const asymptoticSoft = (rate, d) => 10 * Math.log10(rate * d)

/**
 * Where a coded curve crosses the uncoded one.
 *
 * Below it the code is worse than no code, because the energy it spends on the
 * parity costs more than the errors it corrects gain. The crossing is found by
 * bisection on the difference, and both rates there are returned with it.
 *
 * @returns {{ ebN0Db, ber, uncodedBer, found: true }}
 */
export function crossover({ coded, uncoded, lo = 0, hi = 12, tol = 1e-9 }) {
  const diff = (db) => coded(db) - uncoded(db)
  if (diff(lo) <= 0) throw new CodesError('gain-crossover', `the coded curve is already the better of the two at ${lo} dB`)
  if (diff(hi) >= 0) throw new CodesError('gain-crossover', `the coded curve has not crossed by ${hi} dB`)
  let a = lo
  let b = hi
  while (b - a > tol) {
    const m = 0.5 * (a + b)
    if (diff(m) > 0) a = m
    else b = m
  }
  const at = 0.5 * (a + b)
  return { ebN0Db: at, ber: coded(at), uncodedBer: uncoded(at), found: true }
}

/**
 * Two curves and the distance between them, as the pane draws it.
 *
 * @returns {{ points, target, gain, crossover }} one entry per grid point, each
 *   carrying both rates, so the view reads one object.
 */
export function gainCurve({ coded, uncoded, from = 0, to = 12, step = 0.25, target = 1e-5 }) {
  const points = []
  for (let db = from; db <= to + 1e-9; db += step) points.push({ ebN0Db: db, coded: coded(db), uncoded: uncoded(db) })
  return { points, target, from, to }
}
