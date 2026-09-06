// Engineering notation.
//
// This tool now spans 1 Hz to ~4 THz and 1 fs to 1 ms. Raw numbers at those
// scales are unreadable, and "0.000000000004464" is not a time anyone can check
// at a glance. Everything user-facing goes through here.

const PREFIXES = [
  { p: 1e12, s: 'T' },
  { p: 1e9, s: 'G' },
  { p: 1e6, s: 'M' },
  { p: 1e3, s: 'k' },
  { p: 1, s: '' },
  { p: 1e-3, s: 'm' },
  { p: 1e-6, s: 'µ' },
  { p: 1e-9, s: 'n' },
  { p: 1e-12, s: 'p' },
  { p: 1e-15, s: 'f' },
]

// Parsing accepts 'u' for micro because nobody types µ.
const PARSE_MULT = {
  t: 1e12,
  g: 1e9,
  meg: 1e6,
  k: 1e3,
  '': 1,
  m: 1e-3,
  u: 1e-6,
  µ: 1e-6,
  n: 1e-9,
  p: 1e-12,
  f: 1e-15,
}

/**
 * 1.792e12 -> { num: '1.792', prefix: 'T', mult: 1e12 }.
 *
 * The multiplier comes back too, because a field displaying "224" next to
 * "GBd" has to interpret a typed "224" in that same prefix — nobody should be
 * counting zeroes to enter a symbol rate.
 */
export function eng(value, sig = 4) {
  if (!Number.isFinite(value)) return { num: '—', prefix: '', mult: 1 }
  if (value === 0) return { num: '0', prefix: '', mult: 1 }
  // Pick the prefix from the value as it will print, not as it is: a solver's
  // 0.99999999 V is "1 V" to three figures, and must not come out as "1000 mV".
  const mag = Math.abs(Number(value.toPrecision(sig)))
  const hit = PREFIXES.find((x) => mag >= x.p) || PREFIXES[PREFIXES.length - 1]
  return { num: String(Number((value / hit.p).toPrecision(sig))), prefix: hit.s, mult: hit.p }
}

/** 1.792e12, 'Hz' -> "1.792 THz" */
export function fmt(value, unit = '', sig = 4) {
  const { num, prefix } = eng(value, sig)
  const tail = `${prefix}${unit}`
  return tail ? `${num} ${tail}` : num
}

/**
 * Parse engineering notation back to a number.
 *
 * '224G' -> 2.24e11, '4.46p' -> 4.46e-12, '112GHz' -> 1.12e11.
 * A bare unit suffix is stripped, so '224GBd' and '224G' agree.
 * Returns null for anything unparseable — the caller reverts rather than
 * showing NaN.
 */
export function parseEng(text, unit = '') {
  if (text == null) return null
  let t = String(text).trim().replace(/[\s,]/g, '')
  if (!t) return null

  // Strip a trailing unit, case-insensitively, longest first so 'GHz' loses
  // 'Hz' and keeps 'G'.
  //
  // Bare 'm' and 'B' are deliberately not in this list: stripping them turns
  // '5M' (five megahertz) into '5', silently off by a million. Any unit that
  // collides with a prefix letter has to be spelled out by the caller.
  const units = [unit, 'Hz', 'Bd', 'baud', 'bps', 'b/s', 's']
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  for (const u of units) {
    if (u && t.toLowerCase().endsWith(u.toLowerCase())) {
      t = t.slice(0, -u.length)
      break
    }
  }

  // 'M' is mega and 'm' is milli, so the class is deliberately case-sensitive.
  const m = t.match(/^([*/])?(-?\d*\.?\d+(?:[eE][-+]?\d+)?)(meg|[TtGgMkKmuµnpf])?$/)
  if (!m) return null
  const [, ratio, numStr, rawPrefix] = m
  let n = Number(numStr)
  if (!Number.isFinite(n)) return null
  // Whether the user typed a prefix matters: a bare number in an engineering
  // field should be read in the prefix already on display.
  const hadPrefix = !!rawPrefix

  if (rawPrefix) {
    // T and G are unambiguous; 'M' means mega, 'm' means milli.
    const key =
      rawPrefix === 'M' ? 'meg' : rawPrefix === 'K' ? 'k' : rawPrefix === 'T' ? 't' : rawPrefix
    const mult = PARSE_MULT[key.toLowerCase()] ?? PARSE_MULT[key]
    if (mult == null) return null
    n *= mult
  }
  return { value: n, ratio: ratio || null, hadPrefix }
}

/**
 * What a bare number actually commits, given the prefix an engineering field
 * currently has on display for `value`.
 *
 * A bare number in an engineering field is read in the prefix already on
 * screen (see the comment in NumField's parse()) — a field showing "224" next
 * to "GBd" reads a typed "112" as 112 GBd, which is exactly the point: nobody
 * wants to type "112G" into a field already showing gigahertz. But the same
 * rule is silent about what it just did, and a field showing "990" with a
 * milli prefix (i.e. 0.99) reads a typed "1.0001" as 1.0001 MILLI — 0.0010001,
 * a thousand times smaller than the student meant, with nothing on screen
 * saying so.
 *
 * This computes that reading ahead of commit, so a caller can show it while
 * the student is still typing. Returns null whenever there is nothing to
 * warn about: an unparseable draft, a ratio entry (`*2`), an explicit typed
 * prefix (its own answer is right there in what was typed), or a field with
 * no prefix on display (mult 1 — a bare number means exactly what it says).
 */
export function engEcho(text, value, unit = '') {
  const parts = eng(value)
  if (parts.mult === 1) return null // no active prefix; a bare number is read literally
  const r = parseEng(text, unit)
  if (!r || r.hadPrefix || r.ratio) return null
  const full = r.value * parts.mult
  if (!Number.isFinite(full)) return null
  const fullStr = String(Number(full.toPrecision(6)))
  const mantissaUnit = `${parts.prefix}${unit}`
  return {
    full,
    // Plain words, not an arrow glyph: this is read aloud (aria-live), and
    // "becomes" says the same thing an arrow would without asking a screen
    // reader to sound out a symbol.
    text: `${r.value} ${mantissaUnit} becomes ${fullStr}${unit ? ` ${unit}` : ''}`,
  }
}

/** Symbol period for a baud rate, in seconds. 224e9 -> 4.464e-12 */

/** Decibels to a linear power ratio, and back. */
export const dbToLin = (db) => Math.pow(10, db / 10)
export const linToDb = (lin) => 10 * Math.log10(Math.max(lin, 1e-300))

/** Field amplitude ratios use 20log10. */
export const dbToAmp = (db) => Math.pow(10, db / 20)
export const ampToDb = (a) => 20 * Math.log10(Math.max(a, 1e-300))

