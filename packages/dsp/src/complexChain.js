import { createChain } from './chain.js'
import { render, sample } from './signals.js'

// The same chain, over a complex baseband signal.
//
// `createChain` calls process(v, t) with one real number per sample, which is
// the right shape for everything a filter sandbox does. A modulated signal is
// not that. Its in-phase and quadrature parts are two numbers that travel
// together, and a receiver that keeps only one of them cannot tell an upper
// sideband from a lower one, cannot draw a constellation, and cannot rotate a
// carrier offset out.
//
// So this is `createChain` again over an interleaved Float64Array: 2n numbers
// for n samples, real at 2i and imaginary at 2i+1. Interleaved rather than two
// arrays because every function here walks the pair together, and one buffer is
// one allocation, one slice and one cache line.
//
// Nothing in `chain.js` changes. A registry written for the real chain works
// here unaltered: a block with real coefficients acts on the real part and the
// imaginary part separately, which is what a real filter does to a complex
// signal, so this file makes two instances of it and runs one on each. A block
// that genuinely mixes the two parts (a rotation, a frequency shift, a complex
// coefficient) declares `makeComplex` instead, and gets both numbers.
//
// The invariant the portable test pins: a real-only registry, fed a signal with
// a zero imaginary part, produces exactly what `createChain` produces, sample
// for sample and bit for bit.

/** An interleaved complex buffer of n samples, all zero. */
export function complexBuffer(n) {
  return new Float64Array(2 * n)
}

/** The real parts of an interleaved buffer, as a plain buffer of n samples. */
export function realOf(buf) {
  const n = buf.length / 2
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) out[i] = buf[2 * i]
  return out
}

/** The imaginary parts, likewise. */
export function imagOf(buf) {
  const n = buf.length / 2
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) out[i] = buf[2 * i + 1]
  return out
}

/** A real signal as a complex one with nothing in quadrature. */
export function toComplex(re, im = null) {
  const n = re.length
  const out = new Float64Array(2 * n)
  for (let i = 0; i < n; i++) {
    out[2 * i] = re[i]
    out[2 * i + 1] = im ? im[i] : 0
  }
  return out
}

/** The magnitude of each sample, which is the envelope. */
export function magnitudeOf(buf) {
  const n = buf.length / 2
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) out[i] = Math.hypot(buf[2 * i], buf[2 * i + 1])
  return out
}

/**
 * Render sources into an interleaved complex buffer.
 *
 * A source with `analytic: true` contributes its own waveform to the real part
 * and the same waveform shifted by a quarter cycle to the imaginary part, which
 * is the analytic signal e^{jwt} rather than a cosine. That shift is the Hilbert
 * transform only for a sine, so `analytic` is refused on any other waveform with
 * the reason, rather than being applied to something it does not describe.
 *
 * Every other source contributes to the real part alone, exactly as `render`
 * places it, so a source list written for the real chain arrives here unchanged
 * with a zero imaginary part.
 */
export function renderComplex(sources, n, sampleRate, t0 = 0) {
  for (const s of sources) {
    if (s.enabled && s.analytic && s.type !== 'sine') {
      throw new Error(
        `analytic source: the quarter-cycle shift is the Hilbert transform only for a sine, and this source is a ${s.type}`,
      )
    }
  }
  const out = new Float64Array(2 * n)
  const plain = render(
    sources.map((s) => (s.analytic ? { ...s, enabled: false } : s)),
    n,
    sampleRate,
    t0,
  )
  for (let i = 0; i < n; i++) out[2 * i] = plain[i]

  const n0 = Math.round(t0 * sampleRate)
  for (const s of sources) {
    if (!s.enabled || !s.analytic) continue
    const seed = s.id ?? 0
    for (let i = 0; i < n; i++) {
      const t = (n0 + i) / sampleRate
      // cos + j sin, written as the sine source shifted by +pi/2 and by 0, so
      // the generator stays the one in signals.js and nothing is duplicated.
      out[2 * i] += sample('sine', t, s.freq, s.amp, s.phase + Math.PI / 2, n0 + i, seed)
      out[2 * i + 1] += sample('sine', t, s.freq, s.amp, s.phase, n0 + i, seed)
    }
  }
  return out
}

/**
 * The chain bound to a block registry, over complex samples.
 *
 * `chainSettle`, `chainResponse`, `chainPhase` and `chainGroupDelay` are the
 * real chain's, unchanged: they describe the blocks rather than the samples, and
 * a block's |H(f)| does not depend on what it is being fed.
 */
export function createComplexChain(BLOCK_TYPES) {
  const base = createChain(BLOCK_TYPES)
  const active = (blocks) => blocks.filter((b) => !b.bypass && BLOCK_TYPES[b.type])

  /**
   * One block's complex processor.
   *
   * A registry entry with `makeComplex` is asked for it. Anything else is built
   * twice from `make`, once for each part, which is exactly what a real-
   * coefficient block does to a complex signal. Two instances, not one, because
   * each carries its own delay line.
   */
  function makeComplexProc(def, params, sampleRate) {
    if (def.makeComplex) {
      const p = def.makeComplex(params, sampleRate)
      return { process: p.process, settle: p.settle, complex: true }
    }
    const re = def.make(params, sampleRate)
    const im = def.make(params, sampleRate)
    const pair = [0, 0]
    return {
      process: (x, y, t) => {
        pair[0] = re.process(x, t)
        pair[1] = im.process(y, t)
        return pair
      },
      settle: re.settle,
      complex: false,
    }
  }

  /** Run an interleaved buffer through the chain. Pure, as the real one is. */
  function applyComplexChain(blocks, buf, sampleRate, t0 = 0) {
    const list = active(blocks)
    const n = buf.length / 2
    if (list.length === 0) return Float64Array.from(buf)
    const procs = list.map((b) => makeComplexProc(BLOCK_TYPES[b.type], b.params, sampleRate))
    const out = new Float64Array(2 * n)
    for (let i = 0; i < n; i++) {
      let x = buf[2 * i]
      let y = buf[2 * i + 1]
      const t = t0 + i / sampleRate
      for (let j = 0; j < procs.length; j++) {
        const r = procs[j].process(x, y, t)
        x = r[0]
        y = r[1]
      }
      out[2 * i] = x
      out[2 * i + 1] = y
    }
    return out
  }

  /**
   * Render `n` complex samples through the chain, with the same pre-roll rule as
   * `renderChain`: the signal continued backwards in time, never a zero pad.
   */
  function renderComplexChain(sources, blocks, n, sampleRate, opts = {}) {
    const { t0 = 0, warmup = 'auto' } = opts
    const want = warmup === 'auto' ? base.chainSettle(blocks, sampleRate) : Math.max(0, warmup)
    const cap = 4 * n
    const W = Math.min(want, cap)
    const clamped = want > cap

    if (W === 0) {
      const buf = applyComplexChain(blocks, renderComplex(sources, n, sampleRate, t0), sampleRate, t0)
      return { buf, warmup: 0, clamped }
    }
    const start = t0 - W / sampleRate
    const full = renderComplex(sources, W + n, sampleRate, start)
    const processed = applyComplexChain(blocks, full, sampleRate, start)
    return { buf: processed.slice(2 * W), warmup: W, clamped }
  }

  /** Like renderComplexChain, and keeps the buffer after each stage. */
  function runComplexChain(sources, blocks, n, sampleRate, opts = {}) {
    const { t0 = 0, warmup = 'auto' } = opts
    const want = warmup === 'auto' ? base.chainSettle(blocks, sampleRate) : Math.max(0, warmup)
    const W = Math.min(want, 4 * n)
    const start = t0 - W / sampleRate
    const total = W + n

    let cur = renderComplex(sources, total, sampleRate, start)
    const stages = [{ id: 'sum', label: 'Σ', buf: cur.slice(2 * W) }]

    for (const b of blocks) {
      const def = BLOCK_TYPES[b.type]
      if (!def) continue
      if (b.bypass) {
        stages.push({ id: b.id, label: def.label, buf: cur.slice(2 * W), bypassed: true })
        continue
      }
      const proc = makeComplexProc(def, b.params, sampleRate)
      const next = new Float64Array(2 * total)
      for (let i = 0; i < total; i++) {
        const r = proc.process(cur[2 * i], cur[2 * i + 1], start + i / sampleRate)
        next[2 * i] = r[0]
        next[2 * i + 1] = r[1]
      }
      cur = next
      stages.push({ id: b.id, label: def.label, buf: cur.slice(2 * W) })
    }

    return { out: cur.slice(2 * W), stages, warmup: W, clamped: want > 4 * n }
  }

  return {
    chainSettle: base.chainSettle,
    chainResponse: base.chainResponse,
    chainPhase: base.chainPhase,
    chainGroupDelay: base.chainGroupDelay,
    applyComplexChain,
    renderComplexChain,
    runComplexChain,
  }
}
