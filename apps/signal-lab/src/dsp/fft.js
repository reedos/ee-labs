// Radix-2 Cooley-Tukey FFT.
//
// Twiddle factors are computed directly from cos/sin per butterfly rather than
// accumulated by recurrence. The recurrence is faster but drifts on long
// transforms, and a spectrum that is quietly a few dB wrong is worse than a
// slow one.

/**
 * In-place complex FFT. `re` and `im` are mutated.
 * Length must be a power of two.
 */
export function fft(re, im) {
  const n = re.length
  if (im.length !== n) throw new Error('fft: re and im must be the same length')
  if (n < 2 || (n & (n - 1)) !== 0) {
    throw new Error(`fft: length must be a power of two, got ${n}`)
  }

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t
      t = im[i]; im[i] = im[j]; im[j] = t
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const ang = (-2 * Math.PI * k) / len
        const wr = Math.cos(ang)
        const wi = Math.sin(ang)
        const a = i + k
        const b = a + half
        const vr = re[b] * wr - im[b] * wi
        const vi = re[b] * wi + im[b] * wr
        re[b] = re[a] - vr
        im[b] = im[a] - vi
        re[a] += vr
        im[a] += vi
      }
    }
  }
}

/**
 * In-place inverse FFT, via conjugation: ifft(x) = conj(fft(conj(x))) / n.
 * Reusing the forward transform means there is only one butterfly to get right.
 */
export function ifft(re, im) {
  const n = re.length
  for (let i = 0; i < n; i++) im[i] = -im[i]
  fft(re, im)
  const g = 1 / n
  for (let i = 0; i < n; i++) {
    re[i] *= g
    im[i] = -im[i] * g
  }
}

/**
 * Signed frequency of bin k in an n-point complex spectrum.
 *
 * Bins above n/2 are negative frequencies. Getting this wrong makes a
 * dispersion transfer function asymmetric, which quietly turns a phase-only
 * filter into one that changes magnitude too.
 */
export function binFreq(k, n, sampleRate) {
  return ((k < n / 2 ? k : k - n) * sampleRate) / n
}

/** Magnitude spectrum |X[k]| for k = 0..n-1. */
export function magnitude(re, im) {
  const out = new Float64Array(re.length)
  for (let i = 0; i < re.length; i++) {
    out[i] = Math.hypot(re[i], im[i])
  }
  return out
}
