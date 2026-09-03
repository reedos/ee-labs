import { spectrum } from '@ee-labs/dsp'
import { renderChain } from './dsp/chain.js'

// How this sample rate is coping with this signal — measured, not inferred.
//
// The scope's captions are claims about physics, so they are decided by a
// measurement rather than by pattern-matching on waveform names. Render the
// same chain with twice the headroom, then weigh the energy by where it sits
// relative to the CURRENT Nyquist: content above it is precisely what this
// rate cannot hold and must fold down, and precisely what a higher rate would
// clear.
//
// Counting busy bins instead — the first attempt — described roughness rather
// than aliasing, and so missed the plainest case in the lab: a single tone
// dragged past Nyquist folds to one clean line and lit nothing up.

/**
 * Folded amplitude, as a fraction of what stays. This is the line between "a
 * fold exists in the arithmetic" and "a fold you can see riding on the trace",
 * which is what the caption actually claims.
 *
 * Measured across the whole preset library (see sampling.test.js, which pins
 * these): everything with nothing to fold reads below 1e-4, a low-passed
 * square 1.3e-3, a triangle 8.8e-3, a hard clipper 1.6e-2, undithered 4-bit
 * quantization 3.8e-2, a full square 1.4e-1, a high-passed square 2.6e-1.
 *
 * It was 1e-1, which caught the loud cases and missed the quiet ones: a
 * band-limited square with exactly one harmonic over the line reads 6.1e-2 and
 * drew no warning at all — the case the harmonic-count control exists for.
 */
export const ALIAS_RATIO = 0.02

/**
 * Share of the amplitude parked on Nyquist itself, above which the signal is
 * called a boundary case rather than a folded one. Only a setup built to do it
 * comes near: 1.00 for "Exactly at Nyquist" against 0.004 or less everywhere
 * else, so the threshold has three orders of margin either side.
 */
export const AT_NYQUIST_SHARE = 0.25

/**
 * Weigh a chain's energy against its own Nyquist.
 *
 * Returns `{ aliased, atNyquist, ratio, atShare }`. The two booleans are
 * separate on purpose: content sitting ON Nyquist has not folded from
 * anywhere. Two samples a cycle pin its frequency and leave its amplitude to
 * whatever phase they landed on — a different failure with a different remedy,
 * and telling the reader to raise the rate to "clear the fold" would describe
 * the wrong problem. Lumping them together was not a rounding error: the
 * combined ratio scored 1.4e+4 on "Exactly at Nyquist" and asserted aliasing
 * over the one preset in the library where nothing folds at all.
 *
 * Noise and impulses return neither. They are defined per SAMPLE rather than
 * as continuous signals, so rendering them at twice the rate does not give the
 * same signal with more room — it gives a different one, and the comparison
 * means nothing. (White noise is white at every rate; no rate clears it.)
 */
export function samplingState({ sources, blocks, sampleRate, fftSize, window }) {
  const none = { aliased: false, atNyquist: false, ratio: 0, atShare: 0 }
  const on = (sources || []).filter((s) => s.enabled)
  if (!on.length) return none
  if (on.some((s) => s.type === 'noise' || s.type === 'impulse')) return none
  // A quantizer's error is broadband by construction and does fold, but the
  // caption's remedy — "raise the rate to clear it" — is the wrong one: the
  // steps are the signal's own rounding, and no rate un-rounds them. The
  // walk read that caption over a 4-bit sine and went looking for aliasing.
  if ((blocks || []).some((b) => !b.bypass && b.type === 'quantize')) return none

  const nyq = sampleRate / 2
  const r = renderChain(sources, blocks || [], fftSize * 2, sampleRate * 2)
  const s = spectrum(r.buf, sampleRate * 2, window)
  // A line is not a spike: a window spreads it over about three bins, so the
  // boundary needs a bin or so of width or a tone exactly on Nyquist leaks
  // half of itself into the "folded" tally and reads as aliasing.
  const binHz = sampleRate / fftSize

  let below = 0
  let above = 0
  let at = 0
  for (let i = 0; i < s.amps.length; i++) {
    const e = s.amps[i] * s.amps[i]
    if (Math.abs(s.freqs[i] - nyq) < 1.5 * binHz) at += e
    else if (s.freqs[i] < nyq) below += e
    else above += e
  }

  const total = below + above + at
  const ratio = Math.sqrt(above / (below + at || 1e-30))
  const atShare = Math.sqrt(at / (total || 1e-30))
  return {
    aliased: ratio > ALIAS_RATIO,
    atNyquist: atShare > AT_NYQUIST_SHARE,
    ratio,
    atShare,
  }
}
