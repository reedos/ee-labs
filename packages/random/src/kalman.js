// The Kalman filter, scalar, and the door to Control Lab II.
//
// The Wiener filter is the best linear estimate when the statistics are fixed
// and known and the record is long. The Kalman filter is the same estimate
// computed recursively, one sample at a time, from a state model. It belongs in
// this lab because its gain is a variance ratio and nothing else, and it belongs
// in Control Lab II because the state it estimates is the state of a plant.
//
// The scalar model, which is all this lab needs:
//
//   x[k] = a x[k-1] + v[k]     v white, variance q      the process
//   z[k] = x[k]     + n[k]     n white, variance r      the measurement
//
// Two things are worth watching, and both are here as numbers. The gain settles
// to a constant that depends on `q/r` and not on the data, so the filter's
// behaviour is decided before any measurement arrives. And the settled gain has
// a closed form, so the recursion can be checked against algebra rather than
// against itself.

/**
 * The steady-state prior variance, from the algebraic Riccati equation.
 *
 * The recursion `P- = a^2 P + q`, `K = P-/(P- + r)`, `P = (1-K) P-` has a fixed
 * point, and substituting gives `P-^2 + P-(r(1-a^2) - q) - qr = 0`. The positive
 * root is the answer:
 *
 *   P- = ( -(r(1-a^2) - q) + sqrt((r(1-a^2) - q)^2 + 4qr) ) / 2
 *
 * @returns {{ priorVariance, gain, posteriorVariance }}
 */
export function kalmanSteadyState({ a = 1, q, r }) {
  if (!(q >= 0) || !(r > 0)) throw new Error('kalmanSteadyState: need q >= 0 and r > 0')
  const b = r * (1 - a * a) - q
  const prior = (-b + Math.sqrt(b * b + 4 * q * r)) / 2
  const gain = prior / (prior + r)
  return { priorVariance: prior, gain, posteriorVariance: (1 - gain) * prior }
}

/**
 * Run the scalar filter over a measurement record.
 *
 * @param {object} o
 * @param {ArrayLike<number>} o.z   measurements
 * @param {number} o.q              process noise variance
 * @param {number} o.r              measurement noise variance
 * @param {number} [o.a=1]          state transition
 * @param {number} [o.x0=0]         initial estimate
 * @param {number} [o.p0]           initial variance. Defaults to the steady state.
 *
 * @returns {{ x, p, gain, innovation, steady, settledAt }}
 *   Every array is per sample. `settledAt` is the first index whose gain is
 *   within 1 % of the steady-state gain, which is the number a lesson quotes
 *   when it says the filter forgets where it started.
 */
export function kalmanRun({ z, q, r, a = 1, x0 = 0, p0 }) {
  const n = z.length
  const steady = kalmanSteadyState({ a, q, r })
  const x = new Float64Array(n)
  const p = new Float64Array(n)
  const gain = new Float64Array(n)
  const innovation = new Float64Array(n)
  let xh = x0
  let ph = p0 === undefined ? steady.posteriorVariance : p0
  let settledAt = -1
  for (let k = 0; k < n; k++) {
    const priorX = a * xh
    const priorP = a * a * ph + q
    const K = priorP / (priorP + r)
    innovation[k] = z[k] - priorX
    xh = priorX + K * innovation[k]
    ph = (1 - K) * priorP
    x[k] = xh
    p[k] = ph
    gain[k] = K
    if (settledAt < 0 && Math.abs(K - steady.gain) < 0.01 * steady.gain) settledAt = k
  }
  return { x, p, gain, innovation, steady, settledAt }
}

/**
 * The Wiener filter this Kalman filter equals in the steady state.
 *
 * For `a = 1` the process is a random walk, which is not stationary, so there is
 * no Wiener filter to compare against and the function declines rather than
 * returning a number that would look like an answer. For `|a| < 1` the process
 * is stationary with variance `q/(1-a^2)`, and the one-tap Wiener weight on a
 * single measurement is `var(x)/(var(x)+r)`. The Kalman gain is larger, because
 * the Kalman filter also has every earlier measurement, and the gap is the value
 * of memory. `kalman.test.js` pins the gap.
 */
export function stationaryVariance({ a, q }) {
  if (Math.abs(a) >= 1) {
    throw new Error(
      `stationaryVariance: a = ${a} makes the process non-stationary, so it has no variance`,
    )
  }
  return q / (1 - a * a)
}
