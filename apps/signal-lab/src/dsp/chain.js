import { BLOCK_TYPES } from './blocks.js'
import { render } from './signals.js'

// The processing chain.
//
// The load-bearing decision: `make()` is called on every invocation, so no filter
// state ever outlives a single call. That makes applyChain a pure function of its
// arguments — deterministic, and safe to call twice per render (once for the scope
// buffer, once for the FFT frame) with no chance of one contaminating the other.
// There is no filter state in React, no useRef, and no reset button.

const active = (blocks) => blocks.filter((b) => !b.bypass && BLOCK_TYPES[b.type])

/** Upper bound on how long the chain takes to forget its initial conditions. */
export function chainSettle(blocks, sampleRate) {
  let total = 0
  for (const b of active(blocks)) {
    const { settle } = BLOCK_TYPES[b.type].make(b.params, sampleRate)
    total += Number.isFinite(settle) ? Math.max(0, settle) : 0
  }
  return total
}

/** Run `buf` through the chain. Pure: same inputs, bit-identical output. */
export function applyChain(blocks, buf, sampleRate, t0 = 0) {
  const procs = active(blocks).map((b) => BLOCK_TYPES[b.type].make(b.params, sampleRate))
  if (procs.length === 0) return buf
  const out = new Float64Array(buf.length)
  for (let i = 0; i < buf.length; i++) {
    let v = buf[i]
    const t = t0 + i / sampleRate
    for (let j = 0; j < procs.length; j++) v = procs[j].process(v, t)
    out[i] = v
  }
  return out
}

/**
 * Render `n` samples of the sources through the chain, with enough pre-roll that
 * the filters have stopped ringing before the returned frame starts.
 *
 * The pre-roll is the same signal *continued backwards in time* (t0 goes negative),
 * not a zero pad — which would merely move the discontinuity — and not a repeat of
 * the frame, which is only phase-continuous when the frame happens to be exactly
 * periodic. Without this, an IIR filter's startup transient smears every FFT bin.
 *
 * Returns `{ buf, warmup, clamped }`. `clamped` means the chain rings for longer
 * than we are willing to pre-roll, so the frame is not fully settled — a real DSP
 * fact worth surfacing rather than hiding.
 */
export function renderChain(sources, blocks, n, sampleRate, opts = {}) {
  const { t0 = 0, warmup = 'auto' } = opts
  const want = warmup === 'auto' ? chainSettle(blocks, sampleRate) : Math.max(0, warmup)
  const cap = 4 * n
  const W = Math.min(want, cap)
  const clamped = want > cap

  if (W === 0) {
    return { buf: applyChain(blocks, render(sources, n, sampleRate, t0), sampleRate, t0), warmup: 0, clamped }
  }

  const start = t0 - W / sampleRate
  const full = render(sources, W + n, sampleRate, start)
  const processed = applyChain(blocks, full, sampleRate, start)
  return { buf: processed.slice(W), warmup: W, clamped }
}

/**
 * Like renderChain, but also returns the buffer after each stage so the flow strip
 * can show what every block did.
 */
export function runChain(sources, blocks, n, sampleRate, opts = {}) {
  const { t0 = 0 } = opts
  const want = chainSettle(blocks, sampleRate)
  const W = Math.min(want, 4 * n)
  const start = t0 - W / sampleRate
  const total = W + n

  let cur = render(sources, total, sampleRate, start)
  const stages = [{ id: 'sum', label: 'Σ', buf: cur.slice(W) }]

  for (const b of blocks) {
    const def = BLOCK_TYPES[b.type]
    if (!def) continue
    if (b.bypass) {
      stages.push({ id: b.id, label: def.label, buf: cur.slice(W), bypassed: true })
      continue
    }
    const proc = def.make(b.params, sampleRate)
    const next = new Float64Array(total)
    for (let i = 0; i < total; i++) next[i] = proc.process(cur[i], start + i / sampleRate)
    cur = next
    stages.push({ id: b.id, label: def.label, buf: cur.slice(W) })
  }

  return { out: cur.slice(W), stages, warmup: W, clamped: want > 4 * n }
}

/**
 * Combined |H(f)| of the linear blocks, evaluated on `freqs`.
 *
 * Magnitudes of cascaded LTI blocks multiply. `exact` is false when a nonlinear
 * block is in the chain, because then the curve describes only part of what is
 * happening — the UI draws it dashed rather than presenting a half-truth as fact.
 */
export function chainResponse(blocks, freqs, sampleRate) {
  const list = active(blocks)
  const mag = new Float64Array(freqs.length).fill(1)
  let exact = true
  let any = false

  for (const b of list) {
    const def = BLOCK_TYPES[b.type]
    const probe = def.response(b.params, freqs[0] || 0, sampleRate)
    if (probe == null) {
      exact = false
      continue
    }
    any = true
    for (let i = 0; i < freqs.length; i++) {
      mag[i] *= def.response(b.params, freqs[i], sampleRate)
    }
  }

  return { mag, exact, any }
}

/**
 * Combined phase response of the linear blocks, in radians, on `freqs`.
 *
 * Phases of cascaded LTI blocks ADD, where magnitudes multiply. Returned
 * unwrapped, because the wrapped version jumps by 2pi wherever atan2 crosses
 * its branch cut and those jumps read as though the filter did something
 * abrupt, which it did not.
 *
 * Only the chain's own phase is offered, never the measured phase of the
 * signal. That one depends on where the frame happens to start — shift the
 * window by a sample and every value changes — and at bins holding no signal it
 * is uniformly random, so plotting it fills the view with noise that means
 * nothing.
 */
export function chainPhase(blocks, freqs, sampleRate) {
  const list = active(blocks)
  const phase = new Float64Array(freqs.length)
  let exact = true
  let any = false

  for (const b of list) {
    const def = BLOCK_TYPES[b.type]
    if (!def.phase) {
      exact = false
      continue
    }
    any = true

    // Where |H| is exactly zero the angle is genuinely undefined, and atan2(0,0)
    // answers 0 — which lands a spurious spike at the end of the axis: a
    // low-pass at Nyquist, a high-pass at DC. Mark those and fill them from the
    // nearest frequency that does have an angle.
    const own = new Float64Array(freqs.length)
    const known = new Array(freqs.length).fill(false)
    for (let i = 0; i < freqs.length; i++) {
      const m = def.response(b.params, freqs[i], sampleRate)
      if (m == null || m < 1e-12) continue
      own[i] = def.phase(b.params, freqs[i], sampleRate)
      known[i] = true
    }
    let last = null
    for (let i = 0; i < freqs.length; i++) {
      if (known[i]) last = own[i]
      else if (last != null) own[i] = last
    }
    for (let i = freqs.length - 1; i >= 0; i--) {
      if (known[i]) last = own[i]
      else if (last != null) own[i] = last
    }
    for (let i = 0; i < freqs.length; i++) phase[i] += own[i]
  }

  // Unwrap: remove 2pi steps introduced by atan2 rather than by the filter.
  for (let i = 1; i < phase.length; i++) {
    let d = phase[i] - phase[i - 1]
    while (d > Math.PI) {
      phase[i] -= 2 * Math.PI
      d = phase[i] - phase[i - 1]
    }
    while (d < -Math.PI) {
      phase[i] += 2 * Math.PI
      d = phase[i] - phase[i - 1]
    }
  }

  return { phase, exact, any }
}
