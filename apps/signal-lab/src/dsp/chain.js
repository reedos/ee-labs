import { createChain } from '@ee-labs/dsp'
import { BLOCK_TYPES } from './blocks.js'

// This application's chain: the shared machinery from @ee-labs/dsp, bound once
// to the block registry defined in blocks.js.
//
// The registry is injected rather than imported by the package, so a tool with
// entirely different blocks — a control loop, say — reuses all of this without
// the package needing to know anything about filters.

export const {
  chainSettle,
  applyChain,
  renderChain,
  runChain,
  chainResponse,
  chainPhase,
  chainGroupDelay,
} = createChain(BLOCK_TYPES)

const active = (blocks) => blocks.filter((b) => !b.bypass && BLOCK_TYPES[b.type])

/**
 * Every pole and zero in the chain, gathered onto one z-plane.
 *
 * Cascading multiplies transfer functions, so the poles and zeros of a chain are
 * simply all of them collected — no algebra required, which is exactly why this
 * view scales to a chain in a way that writing out H(z) does not.
 *
 * Returns `{ poles, zeros, exact, any, tooMany }`. `exact` is false when some
 * block has no transfer function at all: a clipper is not a filter and has no
 * roots to draw, so the picture is then only part of the story and the UI says
 * so rather than presenting it as complete.
 */
export function chainPolesZeros(blocks, sampleRate) {
  const poles = []
  const zeros = []
  let exact = true
  let any = false
  let tooMany = 0

  for (const b of active(blocks)) {
    const def = BLOCK_TYPES[b.type]
    if (!def.pz) {
      exact = false
      continue
    }
    const r = def.pz(b.params, sampleRate)
    if (r.tooMany) {
      tooMany = Math.max(tooMany, r.tooMany)
      exact = false
      continue
    }
    any = true
    poles.push(...r.poles)
    zeros.push(...r.zeros)
  }

  return { poles, zeros, exact, any, tooMany }
}

/**
 * How far out the z-plane view is willing to frame, in radii of the unit
 * circle.
 *
 * ZPlaneCanvas sizes its axes to hold every root it is handed, which is right
 * for a pole that has escaped the circle and wrong for an FIR's outliers. A
 * 31-tap windowed sinc puts three of its 28 zeros near |z| = 15, and the frame
 * grew to match: the unit circle — the frequency axis, the whole subject of
 * the view — collapsed to about 8 px across on a laptop and to nothing on a
 * phone, with 25 zeros crushed into one blob on its rim. The lesson's own
 * claim, zeros sitting ON the circle, could not be seen at all.
 *
 * Two radii of margin is enough to show an unstable pole just outside the
 * circle, which is the case the growth was there to protect, and everything
 * further out is counted rather than drawn. Playbook #10: what the frame drops
 * is stated in the readout, never dropped quietly.
 */
export const ZPLANE_MAX_R = 2

/**
 * Split roots into the ones the z-plane frame can show and a count of the rest.
 *
 * Returns `{ poles, zeros, hidden }`, where `hidden` is how many roots of
 * either kind sit further from the origin than `rMax`.
 */
export function framedRoots(poles, zeros, rMax = ZPLANE_MAX_R) {
  const near = ([re, im]) => Math.hypot(re, im) <= rMax
  const p = poles.filter(near)
  const z = zeros.filter(near)
  return { poles: p, zeros: z, hidden: poles.length - p.length + (zeros.length - z.length) }
}

/**
 * The chain's impulse response — its kernel.
 *
 * Fed a single 1 followed by silence, an LTI chain emits exactly the sequence it
 * convolves every input with. That is not an analogy: filtering IS convolution
 * with this, and for the FIR blocks the samples that come back are literally the
 * tap values the designer computed.
 *
 * Measured by running the real chain rather than by asking each block for its
 * kernel, so what is drawn is what the audio path actually does, cascade
 * included. `exact` carries the usual caveat: a nonlinear block has no impulse
 * response, and what comes back is then that block's response to an impulse,
 * which is a different and much weaker claim.
 */
/**
 * The centre of symmetry of a kernel, in samples, or null if it has none.
 *
 * A symmetric kernel is a pure delay times a real amplitude, so this number is
 * the group delay — the same value the overlay plots as a flat line.
 *
 * Trimmed from BOTH ends before testing, which is the whole subtlety. A Hann or
 * Blackman window is exactly zero at its first and last point, so a 31-tap
 * Blackman kernel really does begin and end with a 0. Trimming only the tail
 * left h[0] = 0 paired against a nonzero last tap, the symmetry test failed, and
 * a perfectly linear-phase filter reported "delay varies with frequency". The
 * leading zeros are part of the symmetry, not noise to be cut away.
 */
export function kernelCentre(h, eps = 1e-9) {
  let pk = 0
  for (let i = 0; i < h.length; i++) pk = Math.max(pk, Math.abs(h[i]))
  if (!(pk > 0)) return null
  const floor = pk * eps

  let first = -1
  let last = -1
  for (let i = 0; i < h.length; i++) {
    if (Math.abs(h[i]) > floor) {
      if (first < 0) first = i
      last = i
    }
  }
  // Running to the end of the buffer means the response has not finished, so it
  // is an IIR tail and has no centre to speak of.
  if (first < 0 || last <= first || last >= h.length - 1) return null

  for (let a = first, b = last; a < b; a++, b--) {
    if (Math.abs(h[a] - h[b]) > floor) return null
  }
  return (first + last) / 2
}

export function chainImpulse(blocks, n, sampleRate) {
  const list = active(blocks)
  // A block may be LTI only for some settings — gain is linear until its DC
  // offset moves — so exactness consults the per-params `lti` predicate where
  // one exists, and falls back to the static nonlinear flag.
  const exact = list.every((b) => {
    const def = BLOCK_TYPES[b.type]
    return def.lti ? def.lti(b.params) : !def.nonlinear
  })
  const x = new Float64Array(n)
  x[0] = 1
  // t0 = 0 and no pre-roll: the impulse IS the start of time here, and warming
  // up would feed the chain a signal it is not being asked about.
  const h = applyChain(blocks, x, sampleRate, 0)
  return { h, exact, any: list.length > 0 }
}

/**
 * How long the convolution view's kernel must be for the dot product to match
 * the chain, and whether even that had to be cut short.
 *
 * The kernel length was a flat 0.05 s, and a Q = 20 low-pass at 100 Hz rings
 * for 7,000+ samples: at n = 800 the chain said -15.84 while the truncated sum
 * said -10.88 — a 31% disagreement presented, unflagged, for a perfectly
 * linear chain. On the one view whose entire message is "these two numbers are
 * equal", a silently truncated kernel is not an approximation, it is the
 * exhibit lying.
 *
 * So the length comes from chainSettle — the same bound the FFT pre-roll
 * trusts — and the cap is generous. When a chain out-rings even the cap,
 * `truncated` is true and the view says so instead of letting the numbers
 * quietly diverge.
 */
export function convKernel(blocks, sampleRate) {
  const settle = chainSettle(blocks, sampleRate)
  const cap = 32768
  // settle + 2, not + 1: with the tight size a complete FIR kernel ran to the
  // very last sample of its buffer, which is exactly the signature kernelCentre
  // uses to recognize an unfinished IIR tail — so a perfectly symmetric moving
  // average was refused its centre. One trailing zero disambiguates.
  const n = Math.min(cap, Math.max(64, settle + 2))
  return { n, truncated: settle + 2 > cap }
}
