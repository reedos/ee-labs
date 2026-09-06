// One-click settings under a lesson's try line.
//
// A chip carries a PARTIAL patch: "the first source at 6000 Hz", "the first
// block's Q at 1", "FFT 2048". The playbook's rule is that when a note says
// "set X", doing it must be one click — and the chip must know when it is
// already done, so the active one reads as pressed.
//
// Patch shape:
//   { fftSize: 2048 }                          — a top-level field, replaced
//   { sources: [{ freq: 6000 }] }              — merged into sources by index
//   { blocks: [{ params: { q: 1 } }] }         — merged into blocks by index,
//                                                 params merged one level deeper
// A list entry past the end of the current list is appended as given, so a
// chip can add a source; nothing here removes one (reset does that).

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

const mergeEntry = (cur, part) => {
  if (!cur) return part
  const next = { ...cur, ...part }
  if (isObj(part.params) && isObj(cur.params)) next.params = { ...cur.params, ...part.params }
  return next
}

const mergeList = (cur, part) => {
  const out = cur.slice()
  part.forEach((p, i) => {
    out[i] = mergeEntry(cur[i], p)
  })
  return out
}

/** The state after a chip is clicked. */
export function applyChip(state, patch) {
  const next = { ...state }
  for (const [k, v] of Object.entries(patch)) {
    if ((k === 'sources' || k === 'blocks') && Array.isArray(v)) next[k] = mergeList(state[k], v)
    else next[k] = v
  }
  return next
}

// Relative 1e-3, not 1e-9: a chip that stores Math.SQRT1_2 must light when
// the student types 0.707 into the field beside it — that IS doing what the
// try line says. At 1e-9 the "0.707 twice" chip never read as pressed for a
// typed value (the cold walk).
const same = (a, b) => {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-3 * Math.max(1, Math.abs(a))
  return a === b
}

const entryMatches = (cur, part) => {
  if (!cur) return false
  for (const [k, v] of Object.entries(part)) {
    if (k === 'params' && isObj(v)) {
      if (!isObj(cur.params)) return false
      for (const [pk, pv] of Object.entries(v)) if (!same(cur.params[pk], pv)) return false
    } else if (!same(cur[k], v)) return false
  }
  return true
}

/** Is the state already where this chip would put it? */
export function chipMatches(state, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if ((k === 'sources' || k === 'blocks') && Array.isArray(v)) {
      if (!v.every((p, i) => entryMatches(state[k][i], p))) return false
    } else if (!same(state[k], v)) return false
  }
  return true
}

/**
 * The label of the chip the state currently satisfies, or null.
 *
 * A chip patch is partial by design ("dither: true" says nothing about
 * bits), so two chips can both match at once: click "12 bits" then "dither"
 * and the state (bits: 12, dither: true) still satisfies the "12 bits" chip
 * too, since its patch never checks dither. `find` then returned whichever
 * chip happened to sit first in the array — "12 bits" stayed lit while
 * "dither" was the one just clicked (Reed's review).
 *
 * `justClicked` names the chip the caller knows was actually pressed. When it
 * still matches the state, it wins over array order; when a later drag moves
 * a param away from it, it stops matching and the normal first-match search
 * takes back over, same as before a click ever happened.
 */
export function activeChip(state, chips = [], justClicked = null) {
  if (justClicked) {
    const c = chips.find((x) => x.label === justClicked)
    if (c && chipMatches(state, c.patch)) return c.label
  }
  const hit = chips.find((c) => chipMatches(state, c.patch))
  return hit ? hit.label : null
}
