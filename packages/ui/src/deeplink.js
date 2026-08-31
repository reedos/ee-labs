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
//   rate=<number>                   sample rate
//   src=<type>:<freq>:<amp>         a source, repeatable
//   b=<type>:<number>...            a processing block, repeatable
//   plant=<type>:<number>...        a plant to be controlled
//   ctrl=<type>:<number>...         a controller
//   from=<app>:<id>:<label>         provenance: where this setup was built
//                                   (label URI-encoded; it is a name, not data)
//   zoom=<hz>                       show the spectrum only up to here — a
//                                   hand-over at 192 kHz whose whole story is a
//                                   1.6 kHz corner must not bury it at 1.7% of a
//                                   linear axis
//
// The three item keys share one grammar — a name followed by positional numbers
// — because every tool in the suite describes its parts that way, and one rule
// is easier to remember than three.
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
    // Raw-coefficient carriers get full precision: for a biquad or a custom
    // plant the coefficients ARE the object (six figures priced a twin-T's
    // notch floor at -100 dB instead of -inf). Named params (a cutoff, a Q)
    // stay at six - they are knobs, and the links stay readable.
    const t = b.type === 'biquad' ? trimExact : trim
    parts.push(`b=${[b.type, ...(b.params || []).map(t)].join(':')}`)
  }
  if (patch.plant) {
    const t = patch.plant.type === 'custom' ? trimExact : trim
    parts.push(`plant=${[patch.plant.type, ...(patch.plant.params || []).map(t)].join(':')}`)
  }
  if (patch.ctrl) parts.push(`ctrl=${[patch.ctrl.type, ...(patch.ctrl.params || []).map(trim)].join(':')}`)
  // Provenance travels with the setup, so the receiving lab can say "your RC
  // low-pass" instead of the anonymous name of whatever plant it mapped to —
  // the difference between a hand-over and a teleport with amnesia.
  if (patch.zoom) parts.push(`zoom=${trim(patch.zoom)}`)
  if (patch.from) {
    parts.push(
      `from=${patch.from.app}:${patch.from.id}:${encodeURIComponent(patch.from.label || '')}`,
    )
  }
  return parts.join('&')
}

const trim = (v) => String(Number(Number(v).toPrecision(6)))
// Raw-coefficient carriers get the shortest EXACT decimal: String(x) on a
// float64 is guaranteed to round-trip bit-for-bit. Twelve significant figures
// looked like plenty until a component-extreme tank (Q ≈ 3×10⁴ at 5 Hz)
// arrived with its resonant peak at 16% of the truth — at that Q the
// denominator's whole distance from instability lives in the digits past
// twelve. Exactness costs a few characters; a filter that is quietly a
// different filter costs the suite's one claim.
const trimExact = (v) => String(Number(v))

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

    if (key === 'zoom') {
      if (!NUM.test(value)) {
        warnings.push(`zoom "${value}" is not a number`)
        continue
      }
      patch.zoom = Number(value)
      continue
    }

    if (key === 'from') {
      // Parsed from the RAW value: the label is URI-encoded and may decode to
      // anything, so splitting must happen before decoding or an encoded
      // colon inside a name would shear the field apart.
      const raw = pair.slice(eq + 1)
      const [app, id, ...rest] = raw.split(':')
      if (!app || !id) {
        warnings.push('from= needs at least app:id')
        continue
      }
      patch.from = { app, id, label: decodeURIComponent(rest.join(':') || '') }
      continue
    }

    if (key === 'b' || key === 'src' || key === 'plant' || key === 'ctrl') {
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
      else if (key === 'plant') patch.plant = { type, params: nums }
      else if (key === 'ctrl') patch.ctrl = { type, params: nums }
      else patch.sources.push({ type, freq: nums[0], amp: nums[1] })
      continue
    }

    warnings.push(`unknown setting "${key}"`)
  }

  const empty =
    !patch.rate && !patch.blocks.length && !patch.sources.length && !patch.plant && !patch.ctrl
  return { patch: empty ? null : patch, warnings }
}

/** Read the current page's fragment, if there is one. */
export function readLocationLink() {
  if (typeof window === 'undefined') return { patch: null, warnings: [] }
  return parseLink(window.location.hash)
}

/**
 * The URL of a sibling app in the deployed suite, or null.
 *
 * On the deployed site the three apps live side by side —
 * .../ee-labs/circuit-lab/, .../ee-labs/signal-lab/ — so a hand-over can be a
 * real link rather than a fragment to paste. The current app's own segment is
 * looked up in the path and swapped for the sibling's.
 *
 * In dev the apps run on separate ports and no segment matches, so this
 * returns null and the UI falls back to copy-and-paste. That fallback is kept
 * deliberately: a link that silently pointed at a page that is not there would
 * be worse than the paste flow it replaced.
 */
export function siblingUrl(app, fragment, loc = typeof window === 'undefined' ? null : window.location) {
  if (!loc) return null
  const apps = ['signal-lab', 'circuit-lab', 'control-lab']
  if (!apps.includes(app)) return null
  const m = loc.pathname.match(new RegExp(`^(.*/)(${apps.join('|')})(/[^/]*)?$`))
  if (!m || m[2] === app) return null
  return `${loc.origin}${m[1]}${app}/${fragment ? '#' + fragment : ''}`
}

/**
 * The splash page's URL: the directory the lab folders sit in. Same layout
 * assumption and same dev behaviour as siblingUrl — null on a bare dev port,
 * where there is no splash page to point at.
 */
export function homeUrl(loc = typeof window === 'undefined' ? null : window.location) {
  if (!loc) return null
  const m = loc.pathname.match(/^(.*\/)(signal-lab|circuit-lab|control-lab)(\/[^/]*)?$/)
  if (!m) return null
  return `${loc.origin}${m[1]}`
}
