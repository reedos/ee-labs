// Ideal (Whittaker-Shannon) reconstruction: the continuous signal a run of
// samples actually describes.
//
//   x(t) = sum_i x[i] * sinc(t - i)        (t in samples, sinc(x) = sin(pi x)/(pi x))
//
// This is not a display nicety - it is the sampling theorem run forwards, and
// it is what a bench DSO's sin(x)/x mode computes between its own samples.
// For a signal bandlimited below Nyquist the sum reproduces the original
// exactly (in the infinite limit); for a sine ABOVE Nyquist it reproduces the
// alias, because the samples genuinely describe that lower sine. Both faces
// are tested.
//
// The window is finite, so there is truncation error: sinc tails fall as 1/x,
// giving roughly percent-level error at half = 64 near worst case and better
// in practice. That is invisible at plot scale but stated here because a
// drawn curve is a claim: use generous margins from the buffer's edges, where
// the window is one-sided and the error is largest.

/**
 * The reconstructed value at fractional sample position t, from the samples
 * within +-half of it.
 */
export function sincInterp(buf, t, half = 64) {
  const n = buf.length
  const i0 = Math.max(0, Math.ceil(t - half))
  const i1 = Math.min(n - 1, Math.floor(t + half))
  let acc = 0
  for (let i = i0; i <= i1; i++) {
    const x = t - i
    acc += buf[i] * (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x))
  }
  return acc
}
