// The bounce diagram: a lossless line with resistive ends, in time, exactly.
//
// This is a small self-contained event loop, and it is deliberately small. The
// suite's `@ee-labs/events` package is being built for the Logic Lab and will
// carry discrete events with exact delays for five labs. It is not available
// yet, so the loop below is written here, with the same principle: a delay is
// exact, so every waveform an event loop produces is exact. NEEDS.md records
// that this should later run on `@ee-labs/events`, and the shapes below are
// chosen to make that a rewrite of thirty lines rather than of the module.
//
// Why it is exact. A step launched into a lossless line arrives at the far end
// one delay later, unchanged. It reflects into a step of Gamma_L times the
// amplitude, which arrives back at the source one delay after that, and
// reflects again by Gamma_s. Every wave on the line at any moment is one of
// this finite family, and the voltage at a point is the sum of the ones that
// have reached it. Nothing is integrated and nothing is stepped. The only
// approximation available would be stopping the sum early, so the loop reports
// the amplitude of the wave it stopped at.
//
// The one physical case with no steady state is a line whose two reflection
// coefficients multiply to exactly +1 or -1, a lossless line between two
// lossless ends. It rings for ever, the sum does not converge, and
// `bounceDiagram` says so instead of quoting a final value that does not exist.

import { FieldsError, nonNegative, positive, require_ } from './const.js'
import { describeLine } from './line.js'

/**
 * The reflection coefficient of a resistive termination against Z0.
 * `Infinity` is an open circuit and gives +1. Zero is a short and gives -1.
 */
export function resistiveGamma(R, Z0) {
  positive(Z0, 'Z0')
  if (R === Infinity) return 1
  nonNegative(R, 'R')
  return (R - Z0) / (R + Z0)
}

/**
 * The bounce diagram of a step of `Vs` volts through a source resistance `Rs`
 * into a lossless line of `Z0` and one-way delay `T`, terminated in `RL`.
 *
 * ```js
 * bounceDiagram({ Vs: 5, Rs: 25, Z0: 50, RL: 150, len: 2, vp: 2e8 })
 * ```
 *
 * The line may be given as `len` and `vp`, or the delay `T` directly, or as a
 * full line description under `line`. Returns:
 *
 *   gammaS, gammaL   the two reflection coefficients
 *   first            the amplitude of the wave the source launches
 *   waves            every wave, in the order it was launched
 *   steady           the value the sum converges to, and the DC divider it equals
 *   at(x, t)         the voltage and current at position x and time t
 *   atEnd(t)         the load voltage against time, the trace a scope shows
 *   rings            true when the two ends cannot absorb and there is no steady state
 *
 * `at` is exact. It sums the waves that have arrived, and no wave is partially
 * arrived, because a step has no rise time. At the exact instant of an arrival
 * the wave counts as arrived, so the trace is right-continuous, which is what a
 * scope with infinite bandwidth would draw.
 */
export function bounceDiagram(spec) {
  require_(spec && typeof spec === 'object', 'A bounce diagram needs a description object.', { field: 'spec' })
  const Z0 = positive(spec.Z0 ?? (spec.line ? describeLine(spec.line).Z0 : undefined), 'Z0')
  const T = delayOf(spec, Z0)
  const Vs = spec.Vs ?? 1
  require_(Number.isFinite(Vs), `Vs must be a finite number of volts, and it is ${Vs}.`, { field: 'Vs' })
  const Rs = spec.Rs === Infinity ? Infinity : nonNegative(spec.Rs ?? 0, 'Rs')
  require_(Rs !== Infinity, 'A source with infinite resistance launches nothing. Give Rs a finite value.', { field: 'Rs' })
  const RL = spec.RL === Infinity ? Infinity : nonNegative(spec.RL ?? Infinity, 'RL')
  // The line's length in metres, so that `at` and `snapshot` speak the same
  // coordinate. A line given by its delay alone is one unit long.
  const len = positive(spec.len ?? 1, 'len')
  const gammaS = resistiveGamma(Rs, Z0)
  const gammaL = resistiveGamma(RL, Z0)
  const tol = positive(spec.tol ?? 1e-12, 'tol')
  const maxWaves = Math.round(positive(spec.maxWaves ?? 400, 'maxWaves'))

  // The source is a step Vs behind Rs looking into Z0, which is a divider.
  const first = (Vs * Z0) / (Z0 + Rs)
  const product = gammaS * gammaL
  const rings = Math.abs(Math.abs(product) - 1) < 1e-12 && first !== 0

  // The event loop. One event is a wave leaving one end. It is scheduled to
  // arrive at the other end one delay later, where it reflects and becomes the
  // next event. Nothing else happens between events, which is why the loop can
  // step from one to the next and skip everything in between.
  const waves = []
  let amp = first
  let t = 0
  let dir = 1
  let n = 0
  while (n < maxWaves) {
    waves.push({
      index: n,
      amp,
      dir,
      launchedAt: t,
      from: dir > 0 ? 'source' : 'load',
      arrivesAt: t + T,
      xStart: dir > 0 ? 0 : 1,
    })
    n++
    t += T
    amp *= dir > 0 ? gammaL : gammaS
    dir = -dir
    if (Math.abs(amp) <= tol * Math.abs(first) && !rings) break
    if (amp === 0) break
  }
  const truncatedAt = Math.abs(amp)

  // The steady state, when there is one: the sum of the geometric series, which
  // is the direct-current divider the line disappears from.
  let steady = null
  if (!rings) {
    const sum = (first * (1 + gammaL)) / (1 - product)
    steady = {
      v: sum,
      divider: RL === Infinity ? Vs : (Vs * RL) / (Rs + RL),
      i: RL === Infinity ? 0 : sum / RL,
    }
  }

  /** The voltage and current at position x (0 at the source, `len` at the load) at time t. */
  const at = (x, time) => {
    const frac = x / len
    require_(frac >= -1e-12 && frac <= 1 + 1e-12, `x must lie on the line, between 0 and ${len} m. It is ${x}.`, { field: 'x' })
    let v = 0
    let i = 0
    for (const w of waves) {
      // The distance this wave has to cover to reach the point, as a fraction
      // of the line, and the time at which it gets there.
      const travel = w.dir > 0 ? frac : 1 - frac
      const arrival = w.launchedAt + travel * T
      // The tolerance is a part in a million million OF THE DELAY, not an
      // absolute number of seconds. A line whose delay is nanoseconds and one
      // whose delay is milliseconds must both count an arrival the same way,
      // and a fixed tolerance would swallow the sliver a trace samples with.
      if (time + 1e-12 * T >= arrival) {
        v += w.amp
        i += (w.amp / Z0) * w.dir
      }
    }
    return { v, i }
  }

  return {
    Z0,
    T,
    len,
    Rs,
    RL,
    Vs,
    gammaS,
    gammaL,
    first,
    product,
    rings,
    waves,
    steady,
    truncatedAt,
    complete: !rings && truncatedAt <= tol * Math.abs(first || 1),
    at,
    atEnd: (time) => at(len, time),
    atSource: (time) => at(0, time),
    /** The arrival times at the load and back at the source, for the diagram's rungs. */
    ladder: waves.map((w) => ({ ...w, arrivesAtEnd: w.dir > 0 ? 'load' : 'source' })),
    says: sentence({ rings, gammaS, gammaL, steady, Rs, RL, Z0, T, waves }),
  }
}

function delayOf(spec, Z0) {
  if (spec.T !== undefined) return positive(spec.T, 'T')
  if (spec.line) return describeLine(spec.line).delay
  const len = positive(spec.len, 'len')
  const vp = positive(spec.vp, 'vp')
  return len / vp
}

function sentence(s) {
  const g = (x) => (x === 1 ? '+1' : x === -1 ? '-1' : x.toFixed(3))
  const head = `The source end reflects ${g(s.gammaS)} and the load end ${g(s.gammaL)}, one way down the line takes ${(s.T * 1e9).toPrecision(3)} ns.`
  if (s.rings) {
    return `${head} Neither end absorbs, so the two reflections multiply to a magnitude of one and the line rings for ever. There is no steady state to quote.`
  }
  return `${head} The arrivals settle to ${s.steady.v.toPrecision(4)} V, which is what the source and the load divide to with the line taken away.`
}

/**
 * The load's voltage sampled on a time grid, for the scope trace.
 * Returns `{ t, v }` arrays, and the sample points include each arrival time so
 * that no step is drawn as a ramp between two samples.
 */
export function loadTrace(diagram, { until, points = 800 } = {}) {
  const end = until ?? 10 * diagram.T
  const ts = []
  for (let k = 0; k <= points; k++) ts.push((end * k) / points)
  // The arrivals themselves, and a sliver before each, so the step is drawn as
  // a step. The sliver is measured against the DELAY rather than against the
  // window, because a long window would otherwise put the sliver inside the
  // sampler's own arrival tolerance and the step would vanish.
  const sliver = diagram.T * 1e-6
  for (const w of diagram.waves) {
    const arrival = w.dir > 0 ? w.launchedAt + diagram.T : w.launchedAt
    if (arrival <= end && w.dir > 0) {
      ts.push(arrival - sliver, arrival)
    }
  }
  ts.sort((a, b) => a - b)
  return { t: ts, v: ts.map((x) => diagram.atEnd(x).v), i: ts.map((x) => diagram.atEnd(x).i) }
}

/**
 * A snapshot of the whole line at one instant: the voltage against position,
 * which is the picture that shows a wave partway down the line.
 */
export function snapshot(diagram, time, { points = 400 } = {}) {
  const len = diagram.len
  const xs = []
  for (let k = 0; k <= points; k++) xs.push((len * k) / points)
  // The wavefronts at this instant, so the drawn edge is vertical.
  for (const w of diagram.waves) {
    const travelled = (time - w.launchedAt) / diagram.T
    if (travelled > 0 && travelled < 1) {
      const x = (w.dir > 0 ? travelled : 1 - travelled) * len
      xs.push(x - len * 1e-6, x)
    }
  }
  xs.sort((a, b) => a - b)
  return { x: xs, v: xs.map((p) => diagram.at(p, time).v), i: xs.map((p) => diagram.at(p, time).i) }
}

/** The error a caller sees when it asks for a bounce diagram of a line that cannot have one. */
export function requireLossless(line) {
  const ln = describeLine(line)
  if (ln.lossy) {
    throw new FieldsError(
      `The bounce diagram is exact for a lossless line, and this line has R = ${ln.R} ohms per metre and G = ${ln.G} siemens per metre. A lossy line's step spreads as it travels, so it has no finite set of arrivals. Its frequency-domain response is exact at every frequency.`,
      { field: 'R', kind: 'lossy-line-in-time' },
    )
  }
  return ln
}
