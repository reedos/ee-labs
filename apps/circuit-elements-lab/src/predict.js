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
import { defaultsOf } from './experiments.js'
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
 * The predict item for an experiment, or null when no try step moves a
 * numeric knob and reads a path (or when the guesses collapse onto the
 * answer). { step, ask, set, knob, path, unit, correct, options: [{ text,
 * value, rule }] sorted by value, reason }.
 */
export function predictFor(exp) {
  const step = (exp.try || []).findIndex((t) => {
    const keys = Object.keys(t.set || {})
    const numeric = keys.some((k) => exp.params.some((q) => q.key === k && !q.kind))
    return numeric && !t.refuses && (t.reads || []).some((r) => typeof r[0] === 'string')
  })
  if (step < 0) return null
  const t = exp.try[step]
  const knobKey = Object.keys(t.set).find((k) => exp.params.some((q) => q.key === k && !q.kind))
  const knob = exp.params.find((q) => q.key === knobKey)
  const [path] = t.reads.find((r) => typeof r[0] === 'string')
  const p0 = defaultsOf(exp.id)
  const p1 = { ...p0, ...t.set }
  let now, correct
  try {
    const x0 = analyse(exp, p0, t.at)
    const x1 = analyse(exp, p1, t.at)
    if (!x0.sol || !x1.sol) return null
    now = readQuantity(x0, p0, path, exp)
    correct = readQuantity(x1, p1, path, exp)
  } catch {
    return null
  }
  if (!Number.isFinite(now) || !Number.isFinite(correct)) return null
  const unit = unitOf(path)
  const ratio = p1[knobKey] / p0[knobKey]
  const answer = { text: printQ(correct, unit), value: correct, rule: 'solver' }
  const seen = new Set([answer.text])
  const wrong = []
  for (const [rule, f] of Object.entries(RULES)) {
    const v = f(now, ratio)
    const text = printQ(v, unit)
    if (!Number.isFinite(v) || seen.has(text) || !Number.isFinite(ratio) || ratio === 0) continue
    seen.add(text)
    wrong.push({ text, value: v, rule })
    if (wrong.length === 2) break
  }
  if (wrong.length < 2) return null
  const options = [answer, ...wrong].sort((a, b) => a.value - b.value)
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
