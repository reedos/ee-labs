// Handing a setup from one tool to another, through the URL.
//
// This lives in the UI package rather than in either app because both ends need
// to agree on it, and a format only one side can read is not a format. It is
// deliberately a readable scheme rather than encoded JSON: someone landing on
//
//   signal-lab/#b=lowpass:800:10&rate=48000
//
// can see what it says, edit it, and guess the rules — which matters for a tool
// whose whole point is that nothing is hidden.
//
// Grammar, in the fragment so it never reaches a server:
//
//   b=<type>:<number>:<number>...   a block, repeatable, params positional
//   rate=<number>                   sample rate
//   src=<type>:<freq>:<amp>         a source, repeatable
//
// Anything unrecognised is dropped and reported rather than guessed at. A link
// that silently loads as something else is worse than one that refuses.

const NUM = /^-?\d*\.?\d+(?:e[-+]?\d+)?$/i

/** Build a fragment from a patch. Omits anything empty. */
export function buildLink(patch = {}) {
  const parts = []
  if (patch.rate) parts.push(`rate=${trim(patch.rate)}`)
  for (const s of patch.sources || []) {
    parts.push(`src=${[s.type, trim(s.freq), trim(s.amp)].join(':')}`)
  }
  for (const b of patch.blocks || []) {
    parts.push(`b=${[b.type, ...(b.params || []).map(trim)].join(':')}`)
  }
  return parts.join('&')
}

const trim = (v) => String(Number(Number(v).toPrecision(6)))

/**
 * Read a fragment back.
 *
 * Returns `{ patch, warnings }`. Validation is the caller's job for anything
 * domain-specific — this only guarantees the shape and that every number is a
 * number, because a NaN reaching a plot is far harder to trace back than a
 * warning saying which field was wrong.
 */
export function parseLink(fragment) {
  const warnings = []
  const patch = { blocks: [], sources: [] }
  const text = String(fragment || '').replace(/^#/, '')
  if (!text) return { patch: null, warnings }

  for (const pair of text.split('&')) {
    if (!pair) continue
    const eq = pair.indexOf('=')
    if (eq < 0) {
      warnings.push(`"${pair}" is not a key=value pair`)
      continue
    }
    const key = pair.slice(0, eq)
    const value = decodeURIComponent(pair.slice(eq + 1))

    if (key === 'rate') {
      if (!NUM.test(value)) {
        warnings.push(`rate "${value}" is not a number`)
        continue
      }
      patch.rate = Number(value)
      continue
    }

    if (key === 'b' || key === 'src') {
      const bits = value.split(':')
      const type = bits.shift()
      if (!type) {
        warnings.push(`${key}= has no type`)
        continue
      }
      const nums = []
      let bad = false
      for (const n of bits) {
        if (!NUM.test(n)) {
          warnings.push(`${key}=${type}: "${n}" is not a number`)
          bad = true
          break
        }
        nums.push(Number(n))
      }
      if (bad) continue
      if (key === 'b') patch.blocks.push({ type, params: nums })
      else patch.sources.push({ type, freq: nums[0], amp: nums[1] })
      continue
    }

    warnings.push(`unknown setting "${key}"`)
  }

  const empty = !patch.rate && !patch.blocks.length && !patch.sources.length
  return { patch: empty ? null : patch, warnings }
}

/** Read the current page's fragment, if there is one. */
export function readLocationLink() {
  if (typeof window === 'undefined') return { patch: null, warnings: [] }
  return parseLink(window.location.hash)
}
