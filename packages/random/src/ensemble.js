// Ensembles: many realisations of one random process, and their spread.
//
// A random process is not a signal. It is the whole set of signals a mechanism
// can produce, with a probability on that set, and every statement a course
// makes about a process is a statement about the set. The suite has no view for
// that yet, so this module produces the object the view draws: `runs`
// realisations from one seed, the mean and the standard deviation across runs
// at each time index, and one scalar outcome per run.
//
// The scalar outcome is not decoration. A Monte Carlo run in the Applied Analog
// Lab is exactly this object with a component tolerance as the source of
// randomness and a measured specification as the outcome, so `stats`,
// `withinSpec` and `spec` are here from the start rather than added later
// (PROGRAM.md section 4).
//
// Run k is addressable. Its seed is `runSeed(seed, k)`, a pure function, so a
// reader who opens run 7 alone gets the run 7 the ensemble drew. Drawing runs
// from one continuing stream would have made run 7 depend on runs 0 to 6 having
// been drawn first, and the lesson "this is run 7" would then be false whenever
// the app rendered a subset.

import { rng, runSeed } from './prng.js'
import { estimate, proportion, mean as bufMean } from './estimate.js'
import { zFor } from './dist.js'

/** Stored samples above which `ensemble` refuses rather than exhausting memory. */
export const SAMPLE_CAP = 4_000_000

/**
 * Run an ensemble.
 *
 * @param {object} o
 * @param {number} o.seed    the ensemble's seed. Run k uses `runSeed(seed, k)`.
 * @param {number} o.runs    how many realisations
 * @param {number} o.length  samples per realisation, 0 for a scalar-only ensemble
 * @param {(r, k) => Float64Array} [o.make]  one realisation, given its generator
 * @param {(x, r, k) => number} [o.stat]     one scalar outcome per run
 * @param {[number, number]} [o.spec]        a specification band for `withinSpec`
 *
 * @returns {{
 *   seed, runs, length, spec,
 *   paths: Float64Array[],            // every realisation, in run order
 *   mean: Float64Array,               // across runs, at each index
 *   sd: Float64Array,                 // across runs, at each index, unbiased
 *   stats: Float64Array,              // one per run, empty when no `stat`
 *   statEstimate,                     // the mean of `stats` with its interval
 *   band(level): { lo, hi },          // mean +/- z(level)*sd, the Gaussian band
 *   quantileBand(p): { lo, hi },      // the empirical p and 1-p quantiles
 *   withinSpec(spec): proportion,     // the Monte Carlo yield, with its interval
 *   timeAverage(k), ensembleAverage(i)
 * }}
 */
export function ensemble({ seed = 1, runs = 64, length = 0, make, stat, spec = null } = {}) {
  if (runs < 1) throw new Error('ensemble: runs must be at least one')
  if (length * runs > SAMPLE_CAP) {
    throw new Error(
      `ensemble: ${runs} runs of ${length} samples exceeds the ${SAMPLE_CAP}-sample cap`,
    )
  }
  const paths = []
  const stats = new Float64Array(stat ? runs : 0)
  for (let k = 0; k < runs; k++) {
    const r = rng(runSeed(seed, k))
    const x = make ? make(r, k) : new Float64Array(0)
    if (length && x.length !== length) {
      throw new Error(`ensemble: run ${k} returned ${x.length} samples, expected ${length}`)
    }
    paths.push(x)
    if (stat) stats[k] = stat(x, r, k)
  }

  const n = length
  const m = new Float64Array(n)
  const sd = new Float64Array(n)
  if (runs > 0 && n > 0) {
    for (let i = 0; i < n; i++) {
      let s = 0
      for (let k = 0; k < runs; k++) s += paths[k][i]
      m[i] = s / runs
    }
    // Unbiased across runs. With one run the spread is undefined rather than
    // zero, and a band drawn at zero would claim a certainty the single run
    // does not have, so it is left as NaN and the view declines to draw it.
    for (let i = 0; i < n; i++) {
      if (runs < 2) {
        sd[i] = NaN
        continue
      }
      let ss = 0
      for (let k = 0; k < runs; k++) {
        const d = paths[k][i] - m[i]
        ss += d * d
      }
      sd[i] = Math.sqrt(ss / (runs - 1))
    }
  }

  const sortedAt = (i) => {
    const col = new Float64Array(runs)
    for (let k = 0; k < runs; k++) col[k] = paths[k][i]
    return col.sort()
  }

  return {
    seed,
    runs,
    length: n,
    spec,
    paths,
    mean: m,
    sd,
    stats,
    statEstimate: stat && runs > 1 ? estimate(bufMean(stats), varOf(stats) / runs, { n: runs }) : null,

    /** The Gaussian band, `mean +/- z*sd`. Exact only when the process is Gaussian. */
    band(level = 0.6827) {
      const z = zFor(level)
      const lo = new Float64Array(n)
      const hi = new Float64Array(n)
      for (let i = 0; i < n; i++) {
        lo[i] = m[i] - z * sd[i]
        hi[i] = m[i] + z * sd[i]
      }
      return { lo, hi, level, z }
    },

    /**
     * The empirical band between quantiles `p` and `1 - p`, computed from the
     * runs themselves. It makes no Gaussian assumption, so it is the honest
     * band for a process that is not Gaussian, and the two bands agreeing is a
     * measurable claim rather than an assumption.
     */
    quantileBand(p = 0.1587) {
      const lo = new Float64Array(n)
      const hi = new Float64Array(n)
      for (let i = 0; i < n; i++) {
        const col = sortedAt(i)
        lo[i] = quantileOfSorted(col, p)
        hi[i] = quantileOfSorted(col, 1 - p)
      }
      return { lo, hi, p }
    },

    /** The fraction of runs whose outcome lies in `[lo, hi]`, with its interval. */
    withinSpec(band = spec, { level = 0.95 } = {}) {
      if (!band) throw new Error('ensemble.withinSpec: no spec band given')
      const [lo, hi] = band
      let k = 0
      for (let i = 0; i < stats.length; i++) if (stats[i] >= lo && stats[i] <= hi) k++
      return proportion(k, stats.length, { level })
    },

    /** The average along run `k`, over time. */
    timeAverage: (k) => bufMean(paths[k]),
    /** The average across runs at index `i`. */
    ensembleAverage: (i) => m[i],
  }
}

function varOf(x) {
  const m = bufMean(x)
  let ss = 0
  for (let i = 0; i < x.length; i++) ss += (x[i] - m) * (x[i] - m)
  return ss / (x.length - 1)
}

/** Linear-interpolated quantile of an already-sorted buffer. */
export function quantileOfSorted(sorted, p) {
  const n = sorted.length
  if (n === 0) return NaN
  const h = (n - 1) * p
  const lo = Math.floor(h)
  const hi = Math.ceil(h)
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo])
}

/**
 * Ergodicity, measured rather than assumed.
 *
 * A process is mean-ergodic when the time average along one realisation
 * converges to the ensemble average. This returns both numbers and the gap, so
 * a lesson can show a process where they agree and one where they cannot.
 *
 * `spread` is the standard deviation of the per-run time averages. For a
 * mean-ergodic process it falls as the realisation lengthens. For a process
 * whose randomness is a constant drawn once per run (a component tolerance) it
 * does not fall at all, and that is the counter-example the lab needs.
 */
export function ergodicity(e) {
  const times = new Float64Array(e.runs)
  for (let k = 0; k < e.runs; k++) times[k] = e.timeAverage(k)
  const overall = bufMean(times)
  const acrossEnsemble = bufMean(e.mean)
  return {
    timeAverages: times,
    timeAverageMean: overall,
    ensembleAverageMean: acrossEnsemble,
    gap: overall - acrossEnsemble,
    spread: Math.sqrt(varOf(times)),
  }
}
