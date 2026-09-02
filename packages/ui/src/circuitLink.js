// Handing a circuit to Circuit Lab, through the URL.
//
// deeplink.js carries blocks, plants and controllers — objects that are a type
// and some numbers. A circuit from Circuit Lab's catalog is the same shape: a
// topology id and its component values, in the order the catalog lists them,
// plus which output is being looked at. So the grammar is the same one word
// longer, and lives beside deeplink.js for the same reason: both ends must
// agree on it, and a format only one side can read is not a format.
//
//   circuit=<id>:<number>...        the catalog id and its component values, SI
//   out=<key>                       which output node (the catalog's key)
//   from=<app>:<id>:<label>         provenance, as in deeplink.js
//
// Component values travel EXACT — String(Number(v)) round-trips every double —
// because the claim the link makes is "this is the same circuit", and a
// six-figure value would be a different circuit by a part in a million.
// Anything unrecognised is dropped and reported rather than guessed at.

const NUM = /^-?\d*\.?\d+(?:e[-+]?\d+)?$/i
const ID = /^[a-z][a-zA-Z0-9]*$/

/** Build a fragment for a circuit: `{ id, values, output, from }`. */
export function buildCircuitLink({ id, values = [], output, from }) {
  const parts = [`circuit=${[id, ...values.map((v) => String(Number(v)))].join(':')}`]
  if (output) parts.push(`out=${output}`)
  if (from) parts.push(`from=${[from.app, from.id, encodeURIComponent(from.label || '')].join(':')}`)
  return parts.join('&')
}

/**
 * Parse a fragment. Returns `{ patch, warnings }`: patch is
 * `{ id, values, output?, from? }` or null when no circuit was recognised,
 * warnings say what was dropped and why.
 */
export function parseCircuitLink(fragment) {
  const warnings = []
  const patch = {}
  const text = (fragment || '').replace(/^#/, '')
  if (!text) return { patch: null, warnings }
  for (const part of text.split('&')) {
    if (!part) continue
    const eq = part.indexOf('=')
    if (eq < 0) {
      warnings.push(`Ignored "${part}": not key=value.`)
      continue
    }
    const key = part.slice(0, eq)
    const val = part.slice(eq + 1)
    if (key === 'circuit') {
      const [id, ...nums] = val.split(':')
      if (!ID.test(id)) {
        warnings.push(`Ignored circuit "${id}": not a catalog id.`)
        continue
      }
      const bad = nums.find((n) => !NUM.test(n))
      if (bad !== undefined) {
        warnings.push(`Ignored circuit "${id}": "${bad}" is not a number.`)
        continue
      }
      patch.id = id
      patch.values = nums.map(Number)
    } else if (key === 'out') {
      if (!ID.test(val)) warnings.push(`Ignored out "${val}": not an output key.`)
      else patch.output = val
    } else if (key === 'from') {
      const [app, id, label = ''] = val.split(':')
      if (!app || !id) warnings.push(`Ignored from "${val}": needs app:id.`)
      else patch.from = { app, id, label: safeDecode(label) }
    } else {
      warnings.push(`Ignored unknown key "${key}".`)
    }
  }
  if (!patch.id) {
    if (Object.keys(patch).length) warnings.push('The link named an output or a source but no circuit.')
    return { patch: null, warnings }
  }
  return { patch, warnings }
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** The current page's fragment, parsed; `{ patch: null, warnings: [] }` off-browser or with no fragment. */
export function readCircuitLink(loc = typeof window === 'undefined' ? null : window.location) {
  if (!loc || !loc.hash || loc.hash.length < 2) return { patch: null, warnings: [] }
  return parseCircuitLink(loc.hash.slice(1))
}

/**
 * The URL of another lab in the suite, from this page's location: the labs sit
 * side by side under one directory on the deployed site, so the sibling is the
 * same path with the folder name swapped. Null in dev, where each app has its
 * own port and there is nothing beside it — a link to a page that is not there
 * would be worse than none. (deeplink.js's siblingUrl knows three labs; this
 * one knows every folder the suite deploys.)
 */
export function labUrl(app, fragment, loc = typeof window === 'undefined' ? null : window.location) {
  if (!loc) return null
  const apps = ['signal-lab', 'circuit-lab', 'control-lab', 'circuit-elements-lab']
  if (!apps.includes(app)) return null
  const m = loc.pathname.match(new RegExp(`^(.*/)(${apps.join('|')})(/[^/]*)?$`))
  if (!m || m[2] === app) return null
  return `${loc.origin}${m[1]}${app}/${fragment ? '#' + fragment : ''}`
}
