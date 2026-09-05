// The chain over complex samples.
//
// `createChain` in @ee-labs/dsp runs a `Float64Array` and calls `process(v, t)`
// with one real number per sample. A constellation needs two. This is the same
// machinery over an interleaved buffer of length 2n, `[re0, im0, re1, im1, …]`,
// with `process([re, im], t)` returning a two-element array.
//
// COMMUNICATIONS_LAB_PLAN.md Decision 5 asks the DSP Lab overseer for this
// function in `packages/dsp`, where `createChain` lives and where the block
// registry pattern belongs. That function does not exist yet, so it is built
// here against the signature the plan states, and `apps/comms-lab/NEEDS.md` §4
// carries the contract outward. When it lands in `dsp` this file becomes a
// re-export and nothing that imports it changes.
//
// The load-bearing decision is `createChain`'s, kept deliberately. `make()` is
// called on every invocation, so no block state outlives a single call. That
// makes `applyChain` a pure function of its arguments, and safe to call twice
// per render with no chance of one call contaminating the other.

/** Two floats from an interleaved buffer at sample `i`. */
export const at = (buf, i) => [buf[2 * i], buf[2 * i + 1]]

/** Write two floats into an interleaved buffer at sample `i`. */
export function put(buf, i, re, im) {
  buf[2 * i] = re
  buf[2 * i + 1] = im
}

/** Complex multiply, as a two-element array. */
export const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]

/** Complex divide. A zero divisor returns zero rather than a NaN pair. */
export function cdiv(a, b) {
  const d = b[0] * b[0] + b[1] * b[1]
  if (d === 0) return [0, 0]
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]
}

/** The magnitude of one interleaved sample. */
export const cabs = (a) => Math.hypot(a[0], a[1])

/** A rotation by `phase` radians, as a complex number. */
export const rot = (phase) => [Math.cos(phase), Math.sin(phase)]

export function createComplexChain(BLOCK_TYPES) {
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

  /**
   * Run an interleaved buffer through the chain. Pure: the same inputs give a
   * bit-identical output, and the input is never returned by reference.
   */
  function applyChain(blocks, buf, sampleRate, t0 = 0) {
    const procs = active(blocks).map((b) => BLOCK_TYPES[b.type].make(b.params, sampleRate))
    if (procs.length === 0) return Float64Array.from(buf)
    const n = buf.length / 2
    const out = new Float64Array(buf.length)
    for (let i = 0; i < n; i++) {
      let v = at(buf, i)
      const t = t0 + i / sampleRate
      for (let j = 0; j < procs.length; j++) v = procs[j].process(v, t)
      put(out, i, v[0], v[1])
    }
    return out
  }

  /**
   * Like `applyChain`, but also returns the buffer after each stage, so the
   * flow strip can show what every block did. This is where a reader watches
   * the pulse shaper widen a symbol and the matched filter narrow it again.
   */
  function runChain(source, blocks, sampleRate, opts = {}) {
    const { t0 = 0 } = opts
    const n = source.length / 2
    let cur = Float64Array.from(source)
    const stages = [{ id: 'source', label: 'Source', buf: Float64Array.from(cur) }]

    for (const b of blocks) {
      const def = BLOCK_TYPES[b.type]
      if (!def) continue
      if (b.bypass) {
        stages.push({ id: b.id, label: def.label, buf: Float64Array.from(cur), bypassed: true })
        continue
      }
      const proc = def.make(b.params, sampleRate)
      const next = new Float64Array(cur.length)
      for (let i = 0; i < n; i++) {
        const v = proc.process(at(cur, i), t0 + i / sampleRate)
        put(next, i, v[0], v[1])
      }
      cur = next
      stages.push({ id: b.id, label: def.label, buf: Float64Array.from(cur) })
    }

    return { out: cur, stages }
  }

  return { chainSettle, applyChain, runChain }
}
