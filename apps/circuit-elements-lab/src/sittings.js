// Students score it (student review, Phase 9). The last half point of the
// 9.5 is not the lab's to award itself: three people new to circuits sit with
// three experiments each and the numbers they produce — seconds to the first
// knob, whether their one sentence matches the experiment's `see`, a 1–5 for
// clarity — are the last checks of the rubric. Reed records each sitting in
// ../sittings.json; this file turns the record into the score and the one
// status line SITTINGS.md is allowed to print, and sittings.test.js holds the
// record and the document to each other.

/** The script, four lines, read to the student as written. */
export const SCRIPT = [
  'Open it. Do not explain anything.',
  'Do what the lesson says. Say nothing until they ask.',
  'Ask: tell me in one sentence what it showed you.',
  'Ask: from 1 to 5, how clear was it?',
]

/** Each seat: A1, then one of C2 / D5, then one of F3 / G4 — a first look, a method, a dynamic. */
export const SEATS = [
  ['a1', 'c2', 'f3'],
  ['a1', 'd5', 'g4'],
  ['a1', 'c2', 'g4'],
]

/** The targets. Below any of them on an experiment blocks the 9.5 claim for that experiment's group. */
export const TARGETS = {
  firstKnobSeconds: 10, // the first knob found within this, in every sitting
  recallOf: [8, 9], // the one sentence matches `see` in at least 8 of 9
  clarityMean: 4.5, // mean of the 1–5 ratings
}

const isInt = (v) => Number.isInteger(v)

/**
 * What is wrong with a record, as a list of sentences (empty when nothing is).
 * `byId` is the experiment table, so a sitting cannot name an experiment that
 * is not in the course.
 */
export function validate(data, byId) {
  const out = []
  if (!data || typeof data !== 'object') return ['the record is not an object']
  if (!Array.isArray(data.sittings)) return ['the record has no sittings list']
  data.sittings.forEach((s, i) => {
    const at = `sitting ${i + 1}`
    if (!s || typeof s !== 'object') return out.push(`${at} is not an object`)
    if (typeof s.who !== 'string' || !s.who.trim()) out.push(`${at}: who is missing`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date || '')) out.push(`${at}: date is not YYYY-MM-DD`)
    if (!['phone', 'laptop'].includes(s.device)) out.push(`${at}: device is not phone or laptop`)
    if (!byId[s.experiment]) out.push(`${at}: experiment "${s.experiment}" is not in the course`)
    if (!(Number.isFinite(s.firstKnobSeconds) && s.firstKnobSeconds >= 0)) out.push(`${at}: firstKnobSeconds is not a number of seconds`)
    if (typeof s.recall !== 'string' || !s.recall.trim()) out.push(`${at}: recall (their sentence) is missing`)
    if (typeof s.recallMatches !== 'boolean') out.push(`${at}: recallMatches is not true or false`)
    if (!(isInt(s.clarity) && s.clarity >= 1 && s.clarity <= 5)) out.push(`${at}: clarity is not 1–5`)
    if (s.stumbled != null && typeof s.stumbled !== 'string') out.push(`${at}: stumbled is not a sentence`)
  })
  return out
}

const groupOf = (id) => String(id)[0].toUpperCase()

/** The score: the four numbers, and the groups any sitting held below a target. */
export function score(data, targets = TARGETS) {
  const s = (data && data.sittings) || []
  const n = s.length
  const firstKnobMax = n ? Math.max(...s.map((x) => x.firstKnobSeconds)) : null
  const recall = s.filter((x) => x.recallMatches).length
  const clarityMean = n ? s.reduce((a, x) => a + x.clarity, 0) / n : null
  // Recall is a course-wide count with one miss allowed; once the misses
  // exceed that, each blocks the group it happened in. Clarity is a mean per
  // experiment. The first knob is every sitting on its own.
  const [need, of] = targets.recallOf
  const recallShort = n >= of && recall < need
  const blocked = new Set()
  const clarityBy = {}
  for (const x of s) {
    if (x.firstKnobSeconds > targets.firstKnobSeconds) blocked.add(groupOf(x.experiment))
    if (recallShort && !x.recallMatches) blocked.add(groupOf(x.experiment))
    ;(clarityBy[x.experiment] ||= []).push(x.clarity)
  }
  for (const [id, cs] of Object.entries(clarityBy)) if (cs.reduce((a, c) => a + c, 0) / cs.length < targets.clarityMean) blocked.add(groupOf(id))
  return { n, firstKnobMax, recall, clarityMean, blocked: [...blocked].sort() }
}

/** The status line SITTINGS.md prints — the only claim the document makes, and it is computed. */
export function statusLine(data, targets = TARGETS) {
  const r = score(data, targets)
  if (!r.n) return 'Status: no sittings yet — the 9.5 is not claimed for any group.'
  const knob = `first knob ${r.firstKnobMax} s (target ≤ ${targets.firstKnobSeconds})`
  const recall = `recall ${r.recall}/${r.n} (target ≥ ${targets.recallOf[0]}/${targets.recallOf[1]})`
  const clarity = `clarity ${r.clarityMean.toFixed(2)} (target ≥ ${targets.clarityMean})`
  const verdict = r.blocked.length ? `9.5 blocked for group${r.blocked.length > 1 ? 's' : ''} ${r.blocked.join(', ')}.` : r.n < targets.recallOf[1] ? `${targets.recallOf[1] - r.n} sittings to go.` : 'every target met.'
  return `Status: ${r.n} sitting${r.n === 1 ? '' : 's'} — ${knob}, ${recall}, ${clarity} — ${verdict}`
}
