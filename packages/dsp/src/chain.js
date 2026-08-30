import { render } from './signals.js'

// The processing chain.
//
// `createChain(BLOCK_TYPES)` binds these functions to one application's block
// registry and returns them. The registry is injected rather than imported so
// this package knows nothing about any particular tool's blocks — a filter
// sandbox and a control loop can define entirely different ones and still share
// the machinery below.
//
// The load-bearing decision: `make()` is called on every invocation, so no filter
// state ever outlives a single call. That makes applyChain a pure function of its
// arguments — deterministic, and safe to call twice per render (once for the scope
// buffer, once for the FFT frame) with no chance of one contaminating the other.
// There is no filter state in React, no useRef, and no reset button.

export function createChain(BLOCK_TYPES) {
  const active = (blocks) => blocks.filter((b) => !b.bypass && BLOCK_TYPES[b.type])

  /** Upper bound on how long the chain takes to forget its initial conditions. */
  function chainSettle(blocks, sampleRate) {
    let total = 0
    for (const b of active(blocks)) {
      const { settle } = BLOCK_TYPES[b.type].make(b.params, sampleRate)
      total += Number.isFinite(settle) ? Math.max(0, settle) : 0
    }
    return total
  }

  /** Run `buf` through the chain. Pure: same inputs, bit-identical output. */
  function applyChain(blocks, buf, sampleRate, t0 = 0) {
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
  function renderChain(sources, blocks, n, sampleRate, opts = {}) {
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
  function runChain(sources, blocks, n, sampleRate, opts = {}) {
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
  function chainResponse(blocks, freqs, sampleRate) {
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
  function chainPhase(blocks, freqs, sampleRate) {
    const list = active(blocks)
    const phase = new Float64Array(freqs.length)
    // Which bins carry a real angle rather than one carried in from a
    // neighbour. Filling is right for drawing a continuous curve and wrong for
    // differentiating one, so the fact is reported rather than buried.
    const known = new Uint8Array(freqs.length).fill(1)
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
      const ownKnown = new Array(freqs.length).fill(false)
      for (let i = 0; i < freqs.length; i++) {
        const m = def.response(b.params, freqs[i], sampleRate)
        if (m == null || m < 1e-12) continue
        own[i] = def.phase(b.params, freqs[i], sampleRate)
        ownKnown[i] = true
      }
      let last = null
      for (let i = 0; i < freqs.length; i++) {
        if (ownKnown[i]) last = own[i]
        else if (last != null) own[i] = last
      }
      for (let i = freqs.length - 1; i >= 0; i--) {
        if (ownKnown[i]) last = own[i]
        else if (last != null) own[i] = last
      }
      // One block not knowing a bin is enough to spoil the sum there.
      for (let i = 0; i < freqs.length; i++) {
        phase[i] += own[i]
        if (!ownKnown[i]) known[i] = 0
      }
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

    return { phase, exact, any, known }
  }

  /**
   * Group delay of the chain, in SAMPLES, on `freqs`.
   *
   * Group delay is -dphi/dOmega with Omega in radians per sample, so measuring
   * it in samples is not a display choice — it is the natural unit, and it makes
   * the headline result readable straight off the axis: a symmetric FIR sits on
   * a flat line at exactly (N-1)/2.
   *
   * It answers the question a magnitude plot cannot. Two filters can remove the
   * same frequencies and still do very different things to a waveform, because
   * what survives can come out with its parts shifted relative to one another.
   * Where the group delay is flat, the output is the input delayed and nothing
   * more. Where it has a peak — and every IIR has one at its corner — components
   * near that frequency arrive late relative to the rest, and the shape changes.
   * That is exactly what the all-pass block does while leaving |H| at 1.0.
   *
   * Computed by differencing the already-unwrapped phase. Central differences in
   * the interior, one-sided at the ends. The bins are uniformly spaced, so this
   * is second-order accurate and there is nothing to gain from a closed form
   * that every block type would have to implement separately.
   *
   * Bins across a null come back as NaN, and the caller must break the trace
   * rather than plot them. A null spoils the derivative in two separate ways,
   * and both had to be handled before a moving average — whose delay is exactly
   * (N-1)/2 at every frequency — would say so:
   *
   *   - The phase steps by pi there, because the real amplitude behind it has
   *     changed SIGN, and a sign is not a delay. Differencing through that step
   *     produced a spike of pi/dOmega, reported as -125 samples.
   *   - At the null itself the angle does not exist at all, and chainPhase fills
   *     it from a neighbour so the curve stays continuous. Differencing across a
   *     filled bin is differencing a value that was copied rather than measured,
   *     which read as exactly HALF the true delay in the bin beside each null —
   *     a plausible-looking number, and the more dangerous of the two.
   *
   * There is also nothing at a null to be delayed, so undefined is the honest
   * answer rather than merely a convenient one.
   *
   * The same test bounds what this can measure at all. A step is read as a sign
   * flip once it exceeds pi/2 per bin, so a delay beyond about a quarter of the
   * frame length cannot be told from one — which is not a flaw in the rule but
   * the resolution limit of a phase sampled at these bins.
   */
  const SIGN_FLIP = Math.PI / 2

  function chainGroupDelay(blocks, freqs, sampleRate) {
    const { phase, exact, any, known } = chainPhase(blocks, freqs, sampleRate)
    const n = freqs.length
    const delay = new Float64Array(n)
    if (!any || n < 2) return { delay, exact, any }

    // dOmega between adjacent bins, in radians per sample.
    const dW = ((2 * Math.PI) / sampleRate) * (freqs[1] - freqs[0])
    if (!(dW > 0)) return { delay, exact, any }

    // A step spanning bins i and i+1 is unusable if either end was filled in
    // rather than measured, or if the phase jumped by about half a turn across
    // it. step[i] covers the gap between i and i+1.
    const bad = new Array(n - 1)
    for (let i = 0; i < n - 1; i++) {
      bad[i] =
        !known[i] || !known[i + 1] || Math.abs(phase[i + 1] - phase[i]) > SIGN_FLIP
    }

    for (let i = 0; i < n; i++) {
      let d
      if (i === 0) {
        if (bad[0]) {
          delay[i] = NaN
          continue
        }
        d = phase[1] - phase[0]
      } else if (i === n - 1) {
        if (bad[n - 2]) {
          delay[i] = NaN
          continue
        }
        d = phase[n - 1] - phase[n - 2]
      } else {
        // A central difference straddles two steps, so either one spoils it.
        if (bad[i - 1] || bad[i]) {
          delay[i] = NaN
          continue
        }
        d = (phase[i + 1] - phase[i - 1]) / 2
      }
      delay[i] = -d / dW
    }
    return { delay, exact, any }
  }

  return {
    chainSettle,
    applyChain,
    renderChain,
    runChain,
    chainResponse,
    chainPhase,
    chainGroupDelay,
  }
}
