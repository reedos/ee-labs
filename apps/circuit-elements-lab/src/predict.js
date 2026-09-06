/**
 * Predict before you turn (student review, Phase 6).
 *
 * The first try step that moves a knob and reads a quantity becomes a
 * question: "Set R₂ to 4 kΩ: what does the current through R₂ read?" — three
 * answers, one of them the solver's. The wrong ones are not random: they are
 * the guesses a first student actually makes (nothing changes; it scales with
 * the knob; it scales the other way; it doubles or halves), so a wrong pick
 * says which habit to unlearn. After the pick, the reading appears with the
 * step's own sentence as the reason, and the knob is set.
 */
import { defaultsOf, isDynamic } from './experiments.js'
import { analyse } from './math.js'
import { readQuantity } from './lessons.js'
import { num } from './format.js'

/** The unit a quantity path reads in. */
export function unitOf(path) {
  const [head, second] = path.split('.')
  if (head === 'v' || head === 'volt' || head === 'vd') return 'V'
  if (head === 'i') return 'A'
  if (head === 'p') return 'W'
  if (head === 'thevenin') return second === 'voc' ? 'V' : 'Ω'
  if (head === 'mag') return second === 'volt' || second === 'v' ? 'V' : 'A'
  if (head === 'lead' || head === 'deg') return '°'
  if (head === 'energy') return 'J'
  if (head === 'period') return 's'
  if (head === 'omega') return 'rad/s'
  if (head === 'state') return second === 'tau' ? 's' : second === 'zeta' || second === 'Q' ? '' : 'rad/s'
  if (head === 'damping') return second === 'at' ? (path.endsWith('overshoot') ? '%' : path.endsWith('zeta') ? '' : 's') : 'Ω'
  if (head === 'Z') return second === 'mag' ? 'Ω' : '°'
  if (head === 'H') return second === 'db' ? 'dB' : second === 'deg' ? '°' : ''
  if (head === 'ac') return second === 'P' ? 'W' : second === 'S' ? 'VA' : second === 'Q' ? 'var' : ''
  return ''
}

const sub = (id) => id.replace(/(\D+)(\d+)$/, (m, a, d) => `${a}${d.replace(/\d/g, (c) => '₀₁₂₃₄₅₆₇₈₉'[+c])}`)

/** The words for a quantity path: "the current through R₂", "V_th", "τ". */
export function nameOf(path) {
  const [head, second, third] = path.split('.')
  if (head === 'v') return `v_${second}`
  if (head === 'volt') return `the voltage across ${sub(second)}`
  if (head === 'i') return `the current through ${sub(second)}`
  if (head === 'p') return `the power in ${sub(second)}`
  if (head === 'vd') return `v_${second} − v_${third}`
  if (head === 'thevenin') return second === 'voc' ? 'V_th' : 'R_th'
  if (head === 'mag') return `the amplitude of ${second === 'i' ? 'the current through' : 'the voltage across'} ${sub(third)}`
  if (head === 'lead') return `the phase of ${second === 'i' ? 'the current through' : 'the voltage across'} ${sub(third)}`
  if (head === 'energy') return `the energy ${second}`
  if (head === 'period') return 'the period'
  if (head === 'state') return { tau: 'τ', zeta: 'ζ', w0: 'ω₀', alpha: 'α', wd: 'ω_d', Q: 'Q' }[second] || second
  if (head === 'damping') return second === 'at' ? { overshoot: 'the overshoot', settle: 'the settling time', zeta: 'ζ' }[third] || third : 'the critical R'
  if (head === 'Z') return second === 'mag' ? '|Z|' : '∠Z'
  if (head === 'H') return second === 'db' ? '|H| in dB' : second === 'deg' ? 'the phase of H' : '|H|'
  if (head === 'ac') return { P: 'the real power P', S: 'the apparent power S', Q: 'the reactive power Q', pf: 'the power factor' }[second] || second
  return path
}

const WORDS = [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]

/** A reading printed for an answer card. */
export function printQ(v, unit) {
  if (!Number.isFinite(v)) return '—'
  if (unit === '' || unit === '%' || unit === '°' || unit === 'dB') {
    const a = Math.abs(v)
    // A gain of a million is written the way a student writes it, not as 1000000.
    const body = a >= 1e4 ? WORDS.reduce((s, [at, word]) => s || (a >= at ? `${+(a / at).toPrecision(3)} ${word}` : ''), '') : String(+a.toPrecision(3))
    return `${v < 0 ? '−' : ''}${body}${unit === '' ? '' : unit === '°' ? '°' : ` ${unit}`}`
  }
  return num(v, unit, 3).replace(/^-/, '−')
}

// The guesses a first student makes, by name. Each is a function of the
// reading now and the knob's ratio new/old.
const RULES = {
  same: (now) => now,
  proportional: (now, r) => now * r,
  inverse: (now, r) => now / r,
  double: (now) => 2 * now,
  half: (now) => now / 2,
}

/**
 * The three wrong-guess options plus the answer, built from a "before" and
 * "after" reading and the ratio between whatever moved (a knob's new value
 * over its old one, or a cursor time over the moment the student already
 * read). Null when the guesses collapse onto the answer or onto each other.
 */
function optionsFor(now, correct, unit, ratio) {
  const answer = { text: printQ(correct, unit), value: correct, rule: 'solver' }
  const seen = new Set([answer.text])
  const wrong = []
  // "proportional" and "inverse" are guesses about how the reading scales with
  // whatever moved, so they need a finite, nonzero ratio to mean anything (a
  // knob driven to zero, or a cursor already at the window's start, makes
  // "scales with it" undefined, not "skip every guess"). "same", "double" and
  // "half" do not depend on the ratio at all.
  const needsRatio = { proportional: true, inverse: true }
  for (const [rule, f] of Object.entries(RULES)) {
    if (needsRatio[rule] && (!Number.isFinite(ratio) || ratio === 0)) continue
    const v = f(now, ratio)
    const text = printQ(v, unit)
    if (!Number.isFinite(v) || seen.has(text)) continue
    seen.add(text)
    wrong.push({ text, value: v, rule })
    if (wrong.length === 2) break
  }
  if (wrong.length < 2) return null
  return [answer, ...wrong].sort((a, b) => a.value - b.value)
}

/**
 * The predict item for an experiment, or null when no try step moves a
 * numeric knob and reads a path (or when the guesses collapse onto the
 * answer). { step, ask, set, knob, path, unit, correct, options: [{ text,
 * value, rule }] sorted by value, reason }.
 *
 * A try step that sets no numeric knob but drags the cursor (`at`) still
 * poses a real question when the reading it names already has a value on
 * screen to reason from: the one the student read at the experiment's own
 * resting cursor position. The "knob" being turned is then time itself, and
 * the same three habits (nothing changes, it scales with the move, it scales
 * the other way, or doubles or halves) are still the wrong guesses a first
 * student makes.
 */
export function predictFor(exp) {
  const step = (exp.try || []).findIndex((t) => {
    const keys = Object.keys(t.set || {})
    const numeric = keys.some((k) => exp.params.some((q) => q.key === k && !q.kind))
    const cursorOnly = keys.length === 0 && t.at != null
    return (numeric || cursorOnly) && !t.refuses && (t.reads || []).some((r) => typeof r[0] === 'string')
  })
  if (step < 0) return null
  const t = exp.try[step]
  const knobKey = Object.keys(t.set || {}).find((k) => exp.params.some((q) => q.key === k && !q.kind))
  const [path] = t.reads.find((r) => typeof r[0] === 'string')
  const p0 = defaultsOf(exp.id)

  if (!knobKey) {
    // The cursor alone moves. "Now" is the reading at the resting position the
    // student already saw (the same one `see` is analysed at); "correct" is
    // the reading at this step's own `at`.
    const restAt = isDynamic(exp) ? exp.cursor * exp.window(p0) : null
    if (!Number.isFinite(restAt) || restAt <= 0) return null
    let now, correct
    try {
      const x0 = analyse(exp, p0, restAt)
      const x1 = analyse(exp, p0, t.at)
      if (!x0.sol || !x1.sol) return null
      now = readQuantity(x0, p0, path, exp)
      correct = readQuantity(x1, p0, path, exp)
    } catch {
      return null
    }
    if (!Number.isFinite(now) || !Number.isFinite(correct)) return null
    const unit = unitOf(path)
    const options = optionsFor(now, correct, unit, t.at / restAt)
    if (!options) return null
    return {
      step,
      ask: `Drag the cursor to ${printQ(t.at, 's')}: what does ${nameOf(path)} read?`,
      set: t.set,
      knob: null,
      path,
      unit,
      now,
      correct,
      options,
      reason: t.say,
    }
  }

  const knob = exp.params.find((q) => q.key === knobKey)
  const p1 = { ...p0, ...t.set }
  // Some experiments refuse at their bare defaults (E3's ideal op-amp, open
  // loop). The "before" reading then has to come from the structural choice
  // this step already makes (its toggle or choice keys), holding the knob
  // under test at its own default, rather than from the pure defaults, which
  // have no reading at all.
  let p0ref = p0
  let now, correct
  try {
    let x0 = analyse(exp, p0ref, t.at)
    if (!x0.sol) {
      const structural = Object.fromEntries(Object.entries(t.set).filter(([k]) => exp.params.some((q) => q.key === k && q.kind)))
      p0ref = { ...p0, ...structural }
      x0 = analyse(exp, p0ref, t.at)
    }
    const x1 = analyse(exp, p1, t.at)
    if (!x0.sol || !x1.sol) return null
    now = readQuantity(x0, p0ref, path, exp)
    correct = readQuantity(x1, p1, path, exp)
  } catch {
    return null
  }
  if (!Number.isFinite(now) || !Number.isFinite(correct)) return null
  const unit = unitOf(path)
  const ratio = p1[knobKey] / p0[knobKey]
  const options = optionsFor(now, correct, unit, ratio)
  if (!options) return null
  return {
    step,
    ask: `Set ${knob.label} to ${printQ(p1[knobKey], knob.unit)}: what does ${nameOf(path)} read?`,
    set: t.set,
    knob: knobKey,
    path,
    unit,
    now,
    correct,
    options,
    reason: t.say,
  }
}
