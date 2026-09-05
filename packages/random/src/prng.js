// The generator, named and stated.
//
// A lab about randomness cannot use an unnamed source of randomness. Two
// requirements decide the algorithm here, and neither is speed.
//
// 1. The same seed gives the same stream, on every machine, forever. Every
//    number a lesson quotes is a function of a seed, so a lesson's claim is
//    reproducible in the same way a solved circuit is. `Math.random()` has no
//    seed and is therefore unusable for that.
// 2. The stream passes the tests a statistics course would apply to it. A
//    generator with a short period or visible lattice structure would put its
//    own defects into every histogram the lab draws, and the reader would learn
//    the generator instead of the distribution.
//
// The algorithm is **xoshiro128\*\***, by Blackman and Vigna (2018). State is
// four 32-bit words, the period is 2^128 − 1, and it passes BigCrush. Every
// operation is a 32-bit shift, xor, rotate or multiply, so JavaScript runs it
// exactly with `Math.imul` and `>>>` and there is no float in the state.
//
// The seeder is **splitmix32**, run four times from the user's seed. Seeding
// xoshiro's four words directly from a small integer leaves the state nearly
// zero, and a nearly-zero xoshiro state takes thousands of draws to mix. The
// splitmix step avalanches a counter so that seed 1 and seed 2 give unrelated
// streams from the first draw. Both facts are measured in `prng.test.js`.
//
// The all-zero state is the one state xoshiro cannot leave, so `seedState`
// refuses it and substitutes the splitmix output for seed 1.

const U32 = 4294967296

/** One splitmix32 step. `c` is the counter, returned mixed as a uint32. */
export function splitmix32(c) {
  let z = (c + 0x9e3779b9) | 0
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad)
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97)
  return (z ^ (z >>> 15)) >>> 0
}

/**
 * Four 32-bit words from one seed, never all zero.
 * Returns a `Uint32Array(4)`, which is xoshiro128's whole state.
 */
export function seedState(seed = 1) {
  const s = new Uint32Array(4)
  let c = Math.trunc(seed) | 0
  for (let i = 0; i < 4; i++) {
    c = (c + 0x9e3779b9) | 0
    let z = Math.imul(c ^ (c >>> 16), 0x21f0aaad)
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97)
    s[i] = (z ^ (z >>> 15)) >>> 0
  }
  if ((s[0] | s[1] | s[2] | s[3]) === 0) s[0] = 1
  return s
}

const rotl = (x, k) => ((x << k) | (x >>> (32 - k))) >>> 0

/**
 * A seeded generator.
 *
 * Every method draws from the same stream, so the order of calls is part of
 * what a seed determines. `clone()` copies the state, which is how an ensemble
 * gives each run its own independent stream without re-seeding mid-flight.
 *
 * @param {number} seed  any integer. Different seeds give unrelated streams.
 */
export function rng(seed = 1) {
  const s = seedState(seed)
  // Box-Muller produces two independent normals per pair of uniforms. The
  // second is kept here rather than discarded, which halves the cost and, more
  // usefully, makes the stream's consumption of uniforms exactly two per two
  // normals. A discarded second value would make the stream depend on how the
  // caller interleaved its draws.
  let spare = null

  const u32 = () => {
    const result = (Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0)
    const t = (s[1] << 9) >>> 0
    s[2] ^= s[0]
    s[3] ^= s[1]
    s[1] ^= s[2]
    s[0] ^= s[3]
    s[2] ^= t
    s[3] = rotl(s[3], 11)
    return result
  }

  // 53 significant bits, the most a double holds, assembled from two draws in
  // xoshiro's documented way. Taking a single 32-bit word divided by 2^32 would
  // quantise every uniform to 2.3e-10 and put a visible staircase in the tail
  // of an exponential.
  const uniform = () => {
    const hi = u32() >>> 5
    const lo = u32() >>> 6
    return (hi * 67108864 + lo) / 9007199254740992
  }

  const api = {
    /** The next 32-bit word of the stream. */
    u32,
    /** Uniform on [0, 1), 53-bit. */
    uniform,
    /** Uniform on [a, b). */
    uniformIn: (a, b) => a + (b - a) * uniform(),

    /**
     * Gaussian by the Box-Muller transform.
     *
     * `r = sqrt(-2 ln u1)`, `theta = 2 pi u2`, and `(r cos t, r sin t)` are two
     * independent standard normals. The transform is exact, with no rejection
     * step and no table, which is why it is here rather than the ziggurat: the
     * ziggurat is faster and its correctness rests on a generated table of 128
     * rectangles, and a lab that shows the reader where its numbers come from
     * should not hide that table.
     *
     * `u1` is drawn on (0, 1] rather than [0, 1), because ln(0) is infinite.
     * The shift costs one bit at the bottom of the range and is exact above it.
     */
    normal: (mu = 0, sigma = 1) => {
      if (spare !== null) {
        const v = spare
        spare = null
        return mu + sigma * v
      }
      const u1 = 1 - uniform()
      const u2 = uniform()
      const r = Math.sqrt(-2 * Math.log(u1))
      const th = 2 * Math.PI * u2
      spare = r * Math.sin(th)
      return mu + sigma * r * Math.cos(th)
    },

    /** Exponential with rate `lambda`, mean 1/lambda. */
    exponential: (lambda = 1) => -Math.log(1 - uniform()) / lambda,

    /** 1 with probability `p`, else 0. */
    bernoulli: (p = 0.5) => (uniform() < p ? 1 : 0),

    /** +1 or -1 with equal probability, the antipodal symbol. */
    sign: () => (uniform() < 0.5 ? -1 : 1),

    /** `n` draws of `fn` as a Float64Array. `fn` defaults to `normal`. */
    take: (n, fn) => {
      const f = fn || api.normal
      const out = new Float64Array(n)
      for (let i = 0; i < n; i++) out[i] = f()
      return out
    },

    /** The state as four words, for a test that needs to compare streams. */
    state: () => Uint32Array.from(s),

    /**
     * An independent generator whose stream is a function of this one's next
     * draw. An ensemble uses this to give run k its own stream, so that runs
     * are reproducible one at a time and in any order.
     */
    spawn: () => rng(u32() | 0),
  }
  return api
}

/**
 * The seed an ensemble gives run `k`, as a pure function.
 *
 * Run k must not depend on runs 0..k-1 having been drawn, or a reader who opens
 * run 7 alone would see a different run 7 than the ensemble drew. Hashing
 * (seed, k) keeps every run addressable, the way `hash01` keeps Signal Lab's
 * noise addressable by sample index.
 */
export function runSeed(seed, k) {
  return splitmix32((Math.trunc(seed) | 0) + Math.imul(k | 0, 0x85ebca6b)) | 0
}
