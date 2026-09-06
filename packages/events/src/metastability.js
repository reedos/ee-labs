// Metastability, as a labelled statistical model.
//
// Everything else in this package is exact, because a gate with a delay is
// exact. This is not. A flip-flop whose setup or hold time is violated can sit
// between the two levels for a while, and how long is a random variable. The
// model below is the standard one, and CORE_SCOPE.md's Rule 3 applies to it:
// it ships with its parameters printed and its assumptions named, and nothing
// in this package substitutes it for a measurement.
//
// The model. The probability that the output is still undecided after a
// settling time t falls as exp(−t/τ), where τ is the flip-flop's regeneration
// time constant. The rate of failures is then
//
//     1 / MTBF = T0 · f_clk · f_data · exp(−t_r / τ)
//
// with T0 the width of the window in which an edge can upset the flip-flop,
// f_clk the sampling rate, f_data the rate of asynchronous edges, and t_r the
// time available for the output to settle before anything reads it.
//
// What it assumes, and what a lesson must say when it quotes a number:
//
//   - The asynchronous edges are uniform in time and independent of the clock.
//     A data source correlated with the clock breaks this completely.
//   - τ and T0 are constants of the cell. They are not: both vary with supply,
//     temperature and load, and τ is the small-signal time constant of the
//     latch around its balance point, so it belongs to a linearisation.
//   - The exponential holds only well past the first τ, because it is the
//     large-t tail of the settling, not the whole of it.
//
// τ and T0 come from the Analog IC Lab's latch when that lab is built. Until
// then they are the parameters of this model and nothing else, and the panel
// says so.

/** The lab's default cell: 20 ps of regeneration and a 20 ps aperture. */
export const META = { tau: 20, t0: 20, model: 'exponential settling, uniform asynchronous edges' }

/**
 * The mean time between metastable failures, in seconds.
 *
 * @param p { tr, tau, t0, fClk, fData }  times in picoseconds, rates in hertz
 * @returns {{ mtbf, rate, terms, model, assumptions }}  mtbf in seconds, rate in per second
 */
export function mtbf({ tr, tau = META.tau, t0 = META.t0, fClk, fData }) {
  const rate = t0 * 1e-12 * fClk * fData * Math.exp(-tr / tau)
  return {
    mtbf: 1 / rate,
    rate,
    terms: { tr, tau, t0, fClk, fData },
    model: META.model,
    assumptions: ['the asynchronous edges are uniform and independent of the clock', 'τ and T0 are taken as constants of the cell', 'the exponential is the tail, not the first τ'],
  }
}

/**
 * The settling time a target MTBF asks for, in picoseconds. The inverse of
 * `mtbf`, and the number a synchroniser is designed to.
 */
export function settlingFor({ mtbf: target, tau = META.tau, t0 = META.t0, fClk, fData }) {
  return tau * Math.log(target * t0 * 1e-12 * fClk * fData)
}

/**
 * A chain of `n` flip-flops clocked together gives each stage a whole clock
 * period less the setup time to settle in, except the last, which gives
 * whatever the logic after it leaves. Returns the settling time the chain
 * buys and the MTBF that follows.
 */
export function synchroniser({ n = 2, period, tsu, tcq, ...rest }) {
  const tr = (n - 1) * period - tsu - tcq
  return { n, tr, ...mtbf({ tr, ...rest }) }
}
