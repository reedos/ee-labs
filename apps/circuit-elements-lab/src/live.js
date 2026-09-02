/**
 * Notes that are alive (student review, Phase 6).
 *
 * A lesson's `see` was written at the defaults, and every number in it is a
 * measurement (experiments.test.js checks each one against `seeReads` and the
 * knobs). This module turns those same numbers into bindings: each
 * number-with-unit in the sentence is matched, once, to the quantity it stands
 * for — a `seeReads` path, a function read, a knob, the cursor — and from then
 * on the sentence re-reads that quantity from the current solution. Turn a knob
 * and "R₁ absorbs 4 mW" says 11.8 mW, the same number the meter shows; the note
 * and the meters cannot disagree.
 *
 * At the defaults the note renders exactly as written: a binding keeps the
 * author's text while that text is still a fair rounding of the live value, and
 * only reformats when it is not. Numbers with no source — 63.2 %, −3.01 dB, the
 * constants of the subject — stay literal, and the test lists which ones may.
 */
import { analyse } from './math.js'
import { readQuantity } from './lessons.js'
import { defaultsOf } from './experiments.js'
import { num } from './format.js'

const PREFIX = { p: 1e-12, n: 1e-9, µ: 1e-6, u: 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9, '': 1 }
const UNITS = /(-?\d+(?:\.\d+)?)\s*([pnµumkMG]?)(VA|var|V|A|W|Ω|s|Hz|J|°|%|dB|rad\/s)(?![A-Za-z⁰¹²³⁴⁵⁶⁷⁸⁹⁻])/g
// A bare number after an equals sign — "ζ = 0.25" — has no unit to find it
// by, so it is only taken when the text puts it after "=" or "≈" and no
// operator follows: "1/√LC" and "1 + R_f/R_g" are formulas, not readings.
const BARE = /(?<=[=≈]\s)(-?\d+(?:\.\d+)?)(?![\d.]|\s*[pnµumkMG]?(?:VA|var|V|A|W|Ω|s|Hz|J|°|%|dB|rad\/s)|\s*[/+\-−·×])/g
// The solver paths a bare number may stand for: the dimensionless ones.
const UNITLESS = /^(state\.(zeta|Q)|damping\.at\.(zeta|overshoot)|ac\.pf)$/

/** Every number in a sentence: { text, start, end, value (base units, unsigned), digits, scale, unit, spaced }. */
export function quoted(text) {
  const plain = text.replace(/−/g, '-')
  const out = []
  for (const m of plain.matchAll(UNITS)) {
    const unit = m[3]
    out.push({
      text: text.slice(m.index, m.index + m[0].length),
      start: m.index,
      end: m.index + m[0].length,
      digits: (m[1].split('.')[1] || '').length,
      scale: PREFIX[m[2]],
      value: Math.abs(+m[1]) * PREFIX[m[2]],
      unit,
      spaced: /\s/.test(m[0]),
    })
  }
  for (const m of plain.matchAll(BARE)) {
    if (out.some((q) => m.index >= q.start && m.index < q.end)) continue
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length, digits: (m[1].split('.')[1] || '').length, scale: 1, value: Math.abs(+m[1]), unit: '', spaced: false })
  }
  return out.sort((a, b) => a.start - b.start)
}

/** Whether the quoted number is the value rounded to the digits printed (or within 0.6 %). */
export function stands(q, v) {
  if (!Number.isFinite(v)) return false
  // A written zero means zero — "0 V" at a virtual ground — not "under half a volt".
  if (q.value === 0) return Math.abs(v) <= 1e-3 * q.scale
  const half = 0.5 * 10 ** -q.digits * q.scale
  return Math.abs(q.value - Math.abs(v)) <= Math.max(0.006 * Math.abs(v), half * (1 + 1e-9))
}

const signed = (q) => /^[-−]/.test(q.text)

const KNOB_NEAR = 14 // characters: "R₄ = 1010 Ω" names its knob just before the number
// A knob's symbol is the last word of its label — "Op-amp gain A" is written
// "A" in a sentence, "Load R_L" is "R_L" — matched as a whole word.
const symbolOf = (k) => k.label.replace(/\s*\(.*\)$/, '').split(/\s+/).pop()
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const namedIn = (text, k) => new RegExp(`(?<![\\w₀-₉])${escapeRe(symbolOf(k))}(?![\\w₀-₉])`).test(text)

/** The instant a note's numbers were read at: its own, or the experiment's opening cursor. */
export const seeAtOf = (exp, p) => exp.seeAt ?? (exp.window ? exp.cursor * exp.window(p) : undefined)

/**
 * The bindings of an experiment's `see`, found once at the defaults. Each
 * token becomes { ...q, kind, key } with kind 'knob' | 'read' | 'fn' | 'cursor'
 * | 'literal'. A knob named in the few characters before a number claims it;
 * otherwise a matching read, then any knob with that default, then the cursor.
 */
export function bindSee(exp) {
  const p = defaultsOf(exp.id)
  const seeAt = seeAtOf(exp, p)
  const x = exp.seeRefuses ? null : analyse(exp, p, seeAt)
  const again = (over, t) => analyse(exp, { ...p, ...over }, t ?? seeAt)
  const reads = (exp.seeReads || []).map(([q], k) => {
    if (!x || !x.sol) return null
    const value = typeof q === 'function' ? q(x, p, again, exp) : readQuantity(x, p, q, exp)
    return typeof q === 'function' ? { kind: 'fn', key: k, value } : { kind: 'read', key: q, value }
  })
  const knobs = exp.params.filter((k) => !k.kind)
  const used = new Set()
  // Two numbers in one sentence rarely mean the same quantity twice, so a
  // source already claimed yields to an unclaimed one that also stands.
  const pick = (list, fits) => list.find((c) => fits(c) && !used.has(c)) || list.find(fits)
  const take = (c, b) => {
    used.add(c)
    return b
  }
  return quoted(exp.see).map((q) => {
    const bare = q.unit === ''
    if (bare && q.value === 0) return { ...q, kind: 'literal' }
    const before = exp.see.slice(Math.max(0, q.start - KNOB_NEAR), q.start)
    const named = knobs.find((k) => namedIn(before, k) && stands(q, k.default))
    if (named) return take(named, { ...q, kind: 'knob', key: named.key })
    const read = pick(reads, (r) => r && stands(q, r.value) && (!bare || (r.kind === 'read' && UNITLESS.test(r.key))))
    if (read) return take(read, { ...q, kind: read.kind, key: read.key, flip: signed(q) !== (read.value < 0) })
    const knob = !bare && pick(knobs, (k) => stands(q, k.default))
    if (knob) return take(knob, { ...q, kind: 'knob', key: knob.key })
    if (!bare && seeAt != null && stands(q, seeAt)) return { ...q, kind: 'cursor' }
    return { ...q, kind: 'literal' }
  })
}

const cache = new Map()
/** The bindings, computed once per experiment. */
export const bindingsOf = (exp) => {
  if (!cache.has(exp.id)) cache.set(exp.id, bindSee(exp))
  return cache.get(exp.id)
}

/** The live value of one binding, or null when the solution cannot give it. */
export function readBinding(b, exp, x, p) {
  const sign = b.flip ? -1 : 1
  try {
    if (b.kind === 'knob') return p[b.key]
    if (b.kind === 'cursor') return x.cursor
    if (!x.sol) return null
    if (b.kind === 'read') return sign * readQuantity(x, p, b.key, exp)
    if (b.kind === 'fn') {
      const again = (over, t) => analyse(exp, { ...p, ...over }, t ?? x.cursor)
      return sign * exp.seeReads[b.key][0](x, p, again, exp)
    }
  } catch {
    return null
  }
  return null
}

/** A live value printed the way the sentence prints its kind: 63.2 % keeps its decimals, 4 mW takes a prefix. */
export function printLike(q, v) {
  if (!Number.isFinite(v)) return '—'
  const neg = v < 0 && signed(q) ? '−' : ''
  if (q.unit === '' || q.unit === '%' || q.unit === '°' || q.unit === 'dB') {
    const sep = q.unit === '%' || q.unit === 'dB' ? ' ' : ''
    return `${neg}${Math.abs(v).toFixed(q.digits)}${sep}${q.unit}`
  }
  return `${neg}${num(Math.abs(v), q.unit, 3)}`
}

/**
 * The sentence as segments for rendering: { text, start } for the author's
 * words (start is the offset in `see`, so term marks can be placed), and
 * { text, live: true, key, changed } for each bound number, `text` being the
 * author's words while they still stand for the live value and a fresh print
 * otherwise.
 */
export function liveSee(exp, x, p) {
  const bindings = bindingsOf(exp)
  const out = []
  let at = 0
  for (const b of bindings) {
    if (b.kind === 'literal') continue
    if (b.start > at) out.push({ text: exp.see.slice(at, b.start), start: at })
    const v = readBinding(b, exp, x, p)
    // Unsigned words name a magnitude ("swinging 0.25 V either side"); a
    // written minus must still be a minus.
    const keep = stands(b, v) && (!signed(b) || v < 0)
    out.push({ live: true, key: b.kind === 'knob' ? `knob:${b.key}` : b.kind === 'cursor' ? 'cursor' : `${b.kind}:${b.key}`, text: keep ? b.text : printLike(b, v), changed: !keep })
    at = b.end
  }
  if (at < exp.see.length) out.push({ text: exp.see.slice(at), start: at })
  return out
}

/** The plain text of a live sentence. */
export const liveText = (segments) => segments.map((s) => s.text).join('')

/**
 * The regime a note was written in: a refusal, or — for a note that tells a
 * damping story — the second-order face (over/critically/underdamped). When a
 * knob moves the circuit out of it, the numbers still re-read but the
 * sentence's story may not hold, and the note says so.
 */
export const regimeOf = (x, exp) => {
  if (x.refusal) return 'refused'
  // A diode lesson is written about one arrangement of its diodes — "D₁
  // conducting, D₂ blocking", "it holds 5.1 V" — and a knob can move the
  // circuit to another one. The numbers re-read either way; the sentence may
  // not, and that is what the provenance line is for.
  if (x.regions && Object.keys(x.regions).length) return `regions:${Object.entries(x.regions).sort().map(([k, v]) => `${k}=${v}`).join(',')}`
  return x.state && x.state.face && /damp|overshoot|roots|ring/i.test(exp.see) ? x.state.face : null
}

/** The regions a diode lesson was written about, in the reader's words. */
export function regionWords(regime) {
  if (!regime || !regime.startsWith('regions:')) return null
  const parts = regime
    .slice('regions:'.length)
    .split(',')
    .map((q) => {
      const [id, region] = q.split('=')
      return `${id} ${region === 'on' ? 'conducting' : region === 'zener' ? 'in breakdown' : region === 'off' ? 'blocking' : region}`
    })
  return `a circuit with ${parts.join(' and ')}`
}

/** The words for a regime, as the prov line says them. */
export const REGIME_WORDS = {
  refused: 'a circuit the solver refuses',
  overdamped: 'an overdamped circuit',
  critical: 'a critically damped circuit',
  underdamped: 'an underdamped circuit',
  undamped: 'an undamped circuit',
}

const regimeCache = new Map()
/** The regime the note was written in — the defaults' regime. */
export const writtenRegime = (exp) => {
  if (!regimeCache.has(exp.id)) {
    const p = defaultsOf(exp.id)
    regimeCache.set(exp.id, regimeOf(analyse(exp, p, seeAtOf(exp, p)), exp))
  }
  return regimeCache.get(exp.id)
}

/**
 * The provenance line under a note once a knob has moved: what the numbers
 * are doing, and — when the settings have left the regime the sentence was
 * written in — that its story may no longer hold. Null while pristine.
 */
export function provenance(exp, x, pristine) {
  if (pristine) return null
  const wrote = writtenRegime(exp)
  const now = regimeOf(x, exp)
  const wroteWords = REGIME_WORDS[wrote] || regionWords(wrote)
  if (wrote !== now && wroteWords) {
    const nowWords = regionWords(now)
    const is = now === 'refused' ? 'the solver refuses it' : nowWords ? `it is ${nowWords.replace(/^a circuit with /, '')}` : now ? `it is ${now === 'critical' ? 'critically damped' : now}` : 'it solves'
    return `— written for ${wroteWords}; at your settings ${is}, so the numbers re-read but the story may not hold.`
  }
  if (!bindingsOf(exp).some((b) => b.kind !== 'literal')) return '— the note describes the defaults; you have moved away from them.'
  return '— the numbers re-read at your settings.'
}
