// Bits to points in the plane, and back.
//
// A constellation here is a fixed table: M points at unit mean square, one
// label per point, and the bit width. Mapping is exact arithmetic on that
// table, so CORE_SCOPE admits it in full and it carries no hedge.
//
// The labels are Gray codes, `g(i) = i ^ (i >> 1)`, applied per dimension for
// square QAM and around the circle for PSK. The property the lab teaches is a
// counted fact rather than a claim: every pair of nearest neighbours in the
// plane differs in exactly one bit. `mappers.test.js` checks it by enumeration
// for every constellation shipped, which is invariant 2 of the plan's §2.11.

/** The Gray code of `i`. Neighbouring integers map to labels one bit apart. */
export const gray = (i) => i ^ (i >> 1)

/** How many bits differ between two labels. */
export function hamming(a, b) {
  let x = a ^ b
  let n = 0
  while (x) {
    n += x & 1
    x >>>= 1
  }
  return n
}

export const CONSTELLATIONS = ['bpsk', 'qpsk', 'psk8', 'pam4', 'qam16', 'qam64']

/** The name each constellation carries on screen and in a lesson. */
export const CONSTELLATION_NAMES = {
  bpsk: 'BPSK',
  qpsk: 'QPSK',
  psk8: '8-PSK',
  pam4: '4-PAM',
  qam16: '16-QAM',
  qam64: '64-QAM',
}

/**
 * A square QAM table. `L` levels a dimension, so M is L squared.
 *
 * The level spacing follows from unit mean square and nothing else. The levels
 * are `(2i - L + 1) a`, whose mean square over both dimensions is
 * `2 a^2 (L^2 - 1) / 3`, so `a = sqrt(3 / (2 (M - 1)))` and the minimum
 * distance is `2a`.
 */
function squareQam(L) {
  const M = L * L
  const m = Math.log2(L)
  const a = Math.sqrt(3 / (2 * (M - 1)))
  const points = new Float64Array(2 * M)
  const labels = new Int32Array(M)
  let k = 0
  for (let row = 0; row < L; row++) {
    for (let col = 0; col < L; col++) {
      points[2 * k] = (2 * col - L + 1) * a
      points[2 * k + 1] = (2 * row - L + 1) * a
      labels[k] = (gray(row) << m) | gray(col)
      k++
    }
  }
  return { points, labels, bits: 2 * m }
}

/** An M-PAM table on the real axis, at unit mean square. */
function pam(L) {
  const a = Math.sqrt(3 / (L * L - 1))
  const points = new Float64Array(2 * L)
  const labels = new Int32Array(L)
  for (let i = 0; i < L; i++) {
    points[2 * i] = (2 * i - L + 1) * a
    points[2 * i + 1] = 0
    labels[i] = gray(i)
  }
  return { points, labels, bits: Math.log2(L) }
}

/** An M-PSK table on the unit circle. */
function psk(M) {
  const bits = Math.log2(M)
  const points = new Float64Array(2 * M)
  const labels = new Int32Array(M)
  for (let i = 0; i < M; i++) {
    const th = (2 * Math.PI * i) / M + (M === 4 ? Math.PI / 4 : 0)
    points[2 * i] = Math.cos(th)
    points[2 * i + 1] = Math.sin(th)
    labels[i] = gray(i)
  }
  return { points, labels, bits }
}

function build(name) {
  switch (name) {
    case 'bpsk': {
      const points = Float64Array.from([-1, 0, 1, 0])
      return { points, labels: Int32Array.from([0, 1]), bits: 1 }
    }
    case 'qpsk':
      return psk(4)
    case 'psk8':
      return psk(8)
    case 'pam4':
      return pam(4)
    case 'qam16':
      return squareQam(4)
    case 'qam64':
      return squareQam(8)
    default:
      throw new Error(`constellation: no such table "${name}"`)
  }
}

const cache = new Map()

/**
 * One constellation as a table.
 *
 * `points` is interleaved `[re, im]` of length 2M. `labels[i]` is the Gray
 * label of point i, and `indexOfLabel[v]` inverts that. `meanSquare` is 1 to
 * floating point, which is what makes `Es/N0` and `Eb/N0` differ by exactly
 * `10 log10(bits)`.
 */
export function constellation(name) {
  if (cache.has(name)) return cache.get(name)
  const { points, labels, bits } = build(name)
  const M = points.length / 2

  let sum = 0
  let peak = 0
  for (let i = 0; i < M; i++) {
    const e = points[2 * i] ** 2 + points[2 * i + 1] ** 2
    sum += e
    peak = Math.max(peak, e)
  }
  const meanSquare = sum / M

  let minDistance = Infinity
  for (let i = 0; i < M; i++) {
    for (let j = i + 1; j < M; j++) {
      const d = Math.hypot(points[2 * i] - points[2 * j], points[2 * i + 1] - points[2 * j + 1])
      if (d < minDistance) minDistance = d
    }
  }

  const indexOfLabel = new Int32Array(1 << bits).fill(-1)
  for (let i = 0; i < M; i++) indexOfLabel[labels[i]] = i

  const table = {
    name,
    label: CONSTELLATION_NAMES[name] || name,
    bits,
    size: M,
    points,
    labels,
    indexOfLabel,
    minDistance,
    meanSquare,
    papr: peak / meanSquare,
    paprDb: 10 * Math.log10(peak / meanSquare),
  }
  cache.set(name, table)
  return table
}

/**
 * The nearest-neighbour pairs, meaning every pair at the minimum distance.
 * Invariant 2 enumerates these, and B3 counts the bits between their labels.
 */
export function neighbourPairs(name, eps = 1e-9) {
  const c = constellation(name)
  const out = []
  for (let i = 0; i < c.size; i++) {
    for (let j = i + 1; j < c.size; j++) {
      const d = Math.hypot(
        c.points[2 * i] - c.points[2 * j],
        c.points[2 * i + 1] - c.points[2 * j + 1],
      )
      if (Math.abs(d - c.minDistance) < eps) out.push([i, j])
    }
  }
  return out
}

/** The largest Hamming distance across the nearest-neighbour pairs. */
export function adjacency(name, labels = null) {
  const c = constellation(name)
  const use = labels || c.labels
  let worst = 0
  for (const [i, j] of neighbourPairs(name)) worst = Math.max(worst, hamming(use[i], use[j]))
  return worst
}

/** The natural-binary label set, which B3 compares against Gray. */
export function naturalLabels(name) {
  const c = constellation(name)
  const out = new Int32Array(c.size)
  for (let i = 0; i < c.size; i++) out[i] = i
  return out
}

/** `n` bits from a seeded generator, as a Uint8Array of 0 and 1. */
export function randomBits(n, r) {
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) out[i] = r.uniform() < 0.5 ? 0 : 1
  return out
}

/**
 * Bits to interleaved complex symbols, most significant bit first.
 * A bit stream whose length is not a multiple of the bit width is refused
 * rather than padded, because a pad would silently change the count a bit
 * error rate is measured against.
 */
export function mapBits(name, bits) {
  const c = constellation(name)
  if (bits.length % c.bits !== 0) {
    throw new Error(`mapBits: ${bits.length} bits is not a whole number of ${c.label} symbols`)
  }
  const n = bits.length / c.bits
  const out = new Float64Array(2 * n)
  for (let s = 0; s < n; s++) {
    let v = 0
    for (let b = 0; b < c.bits; b++) v = (v << 1) | bits[s * c.bits + b]
    const i = c.indexOfLabel[v]
    out[2 * s] = c.points[2 * i]
    out[2 * s + 1] = c.points[2 * i + 1]
  }
  return out
}

/**
 * The minimum-distance decision, which is the maximum-likelihood detector for
 * equally likely symbols in additive white Gaussian noise. Exact arithmetic
 * over the table.
 */
export function decide(name, syms) {
  const c = constellation(name)
  const n = syms.length / 2
  const out = new Int32Array(n)
  for (let s = 0; s < n; s++) {
    const x = syms[2 * s]
    const y = syms[2 * s + 1]
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < c.size; i++) {
      const d = (x - c.points[2 * i]) ** 2 + (y - c.points[2 * i + 1]) ** 2
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    out[s] = best
  }
  return out
}

/** Interleaved complex symbols back to bits, by minimum distance. */
export function demapSymbols(name, syms) {
  const c = constellation(name)
  const idx = decide(name, syms)
  const out = new Uint8Array(idx.length * c.bits)
  for (let s = 0; s < idx.length; s++) {
    const v = c.labels[idx[s]]
    for (let b = 0; b < c.bits; b++) out[s * c.bits + b] = (v >> (c.bits - 1 - b)) & 1
  }
  return out
}

/** The error vector magnitude of a received cloud against its ideal points. */
export function errorVectorMagnitude(name, syms) {
  const c = constellation(name)
  const idx = decide(name, syms)
  let err = 0
  for (let s = 0; s < idx.length; s++) {
    const i = idx[s]
    err += (syms[2 * s] - c.points[2 * i]) ** 2 + (syms[2 * s + 1] - c.points[2 * i + 1]) ** 2
  }
  const rms = Math.sqrt(err / idx.length / c.meanSquare)
  return { percent: rms * 100, db: 20 * Math.log10(rms), rms }
}
