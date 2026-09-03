import { fmtNum } from '@ee-labs/ui'
import { PLANTS, CONTROLLERS, defaultsOf } from './systems.js'
import { TOPBAR_TERMS } from './terms.js'

// The curriculum.
//
// Control Lab opened with six plants and four controllers and no reason to pick
// any of them. These are the questions worth asking in that order, each loading
// a setup where the answer is visible rather than described.
//
// Every note makes ONE claim and lessons.test.js measures it — the same
// discipline that caught a rule of thumb I had wrongly presented as an identity
// three commits ago. The verb lives in `try`, apart from the note, with chips
// that do it in one click; `featured` names the knob the note is about, so it
// renders under the try line instead of a card below the fold (the student
// review: "raise Kp" pointed at a slider the reader could not see, while the
// visible one was the PLANT's gain).

const pp = (id, over = {}) => ({ ...defaultsOf(PLANTS[id]), ...over })
const cp = (id, over = {}) => ({ ...defaultsOf(CONTROLLERS[id]), ...over })

export const LESSON_GROUPS = ['What feedback buys', 'Losing stability', 'Reading the loop', 'Harder plants']

const LABELS = { kp: 'Kp', ki: 'Ki', kd: 'Kd', k: 'Kc', z: 'zero', p: 'pole' }

/** A lesson's own terms, then the top bar's — it is on screen under every lesson. */
const terms = (...own) => [...own, ...TOPBAR_TERMS.filter((t) => !own.includes(t))]

/** Four significant figures: the precision a gain field shows and a chip label prints. */
export const round4 = (v) => Number(v.toPrecision(4))

/** A chip that sets one controller gain, keeping the controller. */
const gain = (key, value, label = `${LABELS[key]} → ${fmtNum(value, 3)}`, title) => ({
  label,
  set: { ctrlP: { [key]: value } },
  title,
})

/** The gain a root locus sweeps: Kp for the PID family, K for lead. */
export const gainKeyOf = (ctrlId) => (ctrlId === 'lead' ? 'k' : 'kp')

/**
 * Where the closed-loop poles cross the imaginary axis, in units of the
 * controller's own gain: the current gain times the gain margin. Null when
 * there is no phase crossover — the locus never crosses (a first-order lag,
 * a motor under P) — or the loop has no gain knob to speak of.
 */
export function crossingGain(ctrlId, ctrlP, marg) {
  const key = gainKeyOf(ctrlId)
  const now = ctrlP[key]
  if (!(now > 0) || marg?.gainMargin == null) return null
  const crossing = now * marg.gainMargin
  // `shown` is the one rendering of this number every pane and chip uses.
  return { key, label: LABELS[key], now, crossing, shown: fmtNum(crossing, 4) }
}

/**
 * The 0.9× / 1.1× chips read the LIVE margin, so they work from wherever the
 * gain is. They SET the four-figure value they print: the first cut set the
 * exact product and printed it rounded, and after a click the margin was
 * re-read at the new gain, the product drifted in its sixth figure, and the
 * label under the reader's finger changed from 12.38 to 12.37. A value the
 * field can show exactly re-reads to itself.
 */
const marginChips = (s, marg) => {
  const x = crossingGain(s.ctrlId, s.ctrlP, marg)
  if (!x) return []
  return [0.9, 1.1].map((f) => {
    const v = round4(x.crossing * f)
    return gain(
      x.key,
      v,
      `${f} × gain margin → ${x.label} ${fmtNum(v, 4)}`,
      f < 1 ? 'Just inside the boundary — still stable' : 'Just past the boundary — no longer stable',
    )
  })
}
// The crossing chip sets the EXACT boundary gain, not the four-figure one:
// the verdict for "on the axis" is measured to a millionth, and 11.25 is the
// exact crossing for the three-lag plant (Routh: 0.875 × 1.75 = 0.125(1 + K))
// only because that plant's numbers are round.
const crossingChip = (s, marg, title = 'The closed-loop poles land exactly on the imaginary axis') => {
  const x = crossingGain(s.ctrlId, s.ctrlP, marg)
  return x ? [gain(x.key, x.crossing, `${x.label} → ${x.shown} (on the axis)`, title)] : []
}

const ctrlChip = (label, ctrlId, ctrlP, title) => ({ label, set: { ctrlId, ctrlP }, title })

export const LESSONS = [
  // ------------------------------------------------- What feedback buys
  {
    group: 'What feedback buys',
    name: 'Proportional cannot get there',
    note:
      'A plain lag under proportional control, gain already at 9. The output settles at 90% of ' +
      'what was asked and stays there: the controller drives the plant with the error, so zero ' +
      'error would mean zero drive, and nothing would hold it.',
    try:
      'Kp → 12 and the gap shrinks to 7.7%; Kp → 0.5 and it is 67%. Raise it as far as you ' +
      'like — it never closes.',
    featured: ['kp'],
    chips: [gain('kp', 0.5), gain('kp', 9), gain('kp', 12)],
    terms: terms('lag', 'proportional', 'drive', 'steadystate'),
    patch: { plant: 'firstOrder', plantP: pp('firstOrder'), ctrl: 'p', ctrlP: cp('p', { kp: 9 }), view: 'step' },
  },
  {
    group: 'What feedback buys',
    name: 'The integrator closes the gap',
    // Kp is 1 here, not the 9 of the lesson before, and the note says so:
    // the same plant at Kp = 9 needs Ki = 9 to cancel its pole, and the
    // chips then span windows from 0.4 s to 15 s (measured) — not one
    // picture a note can describe.
    note:
      'The same plant with an integral term added — and Kp back at 1, since the gain no ' +
      'longer has to do the holding. The error goes to exactly zero: the integral keeps ' +
      'accumulating for as long as any error remains, and stops growing only when there is ' +
      'nothing left to grow on.',
    try:
      'Ki → 0.2 settles in 30 s (the readout measures it), Ki → 5 overshoots 23% — and both ' +
      'land on exactly 1. Back to P and the 10% gap returns.',
    featured: ['ki'],
    chips: [
      gain('ki', 0.2),
      gain('ki', 1),
      gain('ki', 5),
      ctrlChip('back to P', 'p', { kp: 9 }, 'Proportional only, Kp = 9: the gap comes back'),
    ],
    terms: terms('integral', 'integrator', 'overshoot', 'steadystate'),
    patch: { plant: 'firstOrder', plantP: pp('firstOrder'), ctrl: 'pi', ctrlP: cp('pi'), view: 'step' },
  },
  {
    group: 'What feedback buys',
    name: 'Watch the integrator take over',
    note:
      'The same handoff, watched. At first the proportional part carries all the effort — the ' +
      'error is the whole ask; as y arrives, Kp·e falls with the gap while Ki·∫e climbs, ' +
      'remembering every moment of error. By the end the integral holds the entire drive.',
    try:
      'scrub the cursor, or press play — it opens mid-handoff, both parts still working. Then ' +
      'Disturbance: the same memory winds down to exactly −1.',
    featured: ['disturbance', 'ki'],
    // The step toggle is the featured control, so the chips carry the other
    // thing worth doing: Ki sets how soon the integral takes the drive over.
    chips: [
      gain('ki', 0.3, undefined, 'A slow handoff: the integral takes longer to overtake Kp·e'),
      gain('ki', 1),
      gain('ki', 3, undefined, 'A quick handoff: the integral overtakes Kp·e sooner'),
    ],
    terms: terms('handoff', 'kpe', 'kiint', 'scrub', 'windsdown', 'disturbance', 'proportional', 'drive', 'integral', 'integrator', 'effort'),
    patch: { plant: 'firstOrder', plantP: pp('firstOrder'), ctrl: 'pi', ctrlP: cp('pi'), view: 'watch' },
  },
  {
    group: 'What feedback buys',
    name: 'A shove at the plant input',
    note:
      'A disturbance lands on the PLANT — a load transient, supply ripple — and the loop must ' +
      'fight it off. Under proportional control the shove leaves a permanent offset of ' +
      'P(0)/(1+L(0)), here 0.1: shrunk, not removed. THAT is why feedback exists.',
    // "climbs", not "winds up": windup names a specific pathology (an
    // integrator growing while the drive is stuck at a limit), and this loop
    // has no limit. The terms panel keeps the word and says what it means.
    try:
      'switch to PI and the offset is erased exactly — the integral climbs until nothing of ' +
      'the shove remains. Back to P and the 0.1 is back.',
    featured: ['disturbance'],
    chips: [
      ctrlChip('switch to PI', 'pi', { kp: 9, ki: 3 }, 'Same Kp, plus an integral term'),
      ctrlChip('back to P', 'p', { kp: 9 }),
    ],
    terms: terms('disturbance', 'l0', 'loadtransient', 'supplyripple', 'offset', 'windup', 'proportional', 'integral', 'integrator'),
    patch: {
      plant: 'firstOrder',
      plantP: pp('firstOrder'),
      ctrl: 'p',
      ctrlP: cp('p', { kp: 9 }),
      view: 'step',
      stepInput: 'dist',
    },
  },
  {
    group: 'What feedback buys',
    name: '...and what it costs',
    // The first cut said the loop "reaches −180° sooner" under a readout
    // saying the phase never reaches −180° (motor + PI: it cannot). The
    // claim is the margin, measured both ways in lessons.test.js.
    note:
      'Nothing is free — now on the motor. An integrator costs −90° of phase at every ' +
      'frequency, and it comes out of the margin: at Kp = 2 plain proportional control has ' +
      '52° of phase margin; add the integral term and it is 19°. Phase never reaches −180° ' +
      'here; the crossover just sits closer.',
    try:
      'Proportional at the same Kp = 2: the phase margin in the top bar climbs from 19° to 52°. ' +
      'PI, and it falls back.',
    featured: ['ki'],
    chips: [
      ctrlChip('Proportional, Kp 2', 'p', { kp: 2 }, 'The integrator taken out, the gain kept'),
      ctrlChip('PI, Kp 2 · Ki 2', 'pi', { kp: 2, ki: 2 }),
    ],
    // ki 2, not 4: at ki 4 this exact loop has poles AT ±2j — a 0.0° margin,
    // an UNSTABLE badge, and a step that rings forever under a note calmly
    // discussing margins. ki 2 leaves 19° — thin enough to feel, still a loop.
    terms: terms('margin', 'minus180', 'oscillates', 'integral', 'integrator', 'proportional', 'phasemargin', 'crossover'),
    patch: { plant: 'motor', plantP: pp('motor'), ctrl: 'pi', ctrlP: cp('pi', { kp: 2, ki: 2 }), view: 'step' },
  },

  // --------------------------------------------------- Losing stability
  {
    group: 'Losing stability',
    name: 'Turn it up until it sings',
    // Written to the loop on screen (Kp = 4, gain margin 9 dB), not to the
    // one past Kp = 11.25 the first cut described: 0.36 and 2.81× are the
    // measured gain at −180° and its reciprocal (lessons.test.js).
    note:
      'Three lags, each costing up to 90° of phase — 45° already spent at its corner. At Kp = 4 ' +
      'the loop gain where the phase reaches −180° is 0.36, so there is room for 2.81× more, ' +
      'and the loop already rings 42%. 2.81× more gain and it sings.',
    try:
      'Kp → 0.5 for the sluggish start, Kp → 8 for 71% overshoot, Kp → 12 — past the 11.25 ' +
      'boundary — and it diverges.',
    featured: ['kp'],
    chips: [gain('kp', 0.5), gain('kp', 4), gain('kp', 8), gain('kp', 12, 'Kp → 12 (diverges)')],
    terms: terms('lag', 'corner', 'minus180', 'boundary', 'diverges', 'rings', 'sluggish', 'overshoot', 'pole', 'phasemargin'),
    patch: { plant: 'threePole', plantP: pp('threePole'), ctrl: 'p', ctrlP: cp('p', { kp: 4 }), view: 'step' },
  },
  {
    group: 'Losing stability',
    name: 'The margin says exactly how far',
    note:
      'The gain margin is not a guideline. The Bode pane prints it as a factor — "room for N× ' +
      'more gain" — and the top bar as the same number in dB. Multiply Kp by that factor and the ' +
      'loop sits exactly on the boundary.',
    try:
      '0.9 × the gain margin and the verdict stays stable; 1.1 × and it flips. Both chips read ' +
      'the live margin, so they work from wherever Kp is.',
    featured: ['kp'],
    chips: (s, marg) => [...marginChips(s, marg), gain('kp', 1)],
    terms: terms('gainmargin', 'verdict', 'boundary', 'margin', 'db'),
    patch: { plant: 'threePole', plantP: pp('threePole'), ctrl: 'p', ctrlP: cp('p', { kp: 1 }), view: 'step' },
  },
  {
    group: 'Losing stability',
    name: 'Watch the poles cross',
    note:
      'The same loss of stability, seen as pole positions. Each branch traces where a ' +
      'closed-loop pole travels as the gain sweeps; the pink crosses are the poles at this Kp. ' +
      'Where a branch enters the shaded half, the loop starts oscillating.',
    try:
      'Kp → 11.25 and the crosses land on the axis; Kp → 15 and they are across it. The readout ' +
      'names the crossing gain.',
    featured: ['kp'],
    chips: (s, marg) => [gain('kp', 4), ...crossingChip(s, marg), gain('kp', 15, 'Kp → 15 (across)')],
    terms: terms('branch', 'imaginaryaxis', 'shadedhalf', 'closedvsopen', 'oscillates', 'pole', 'rootlocus'),
    patch: { plant: 'threePole', plantP: pp('threePole'), ctrl: 'p', ctrlP: cp('p', { kp: 4 }), view: 'locus' },
  },

  // -------------------------------------------------- Reading the loop
  {
    group: 'Reading the loop',
    name: 'Everything is about one point',
    note:
      'The Nyquist view plots the open loop on the complex plane against −1. That point is the ' +
      'whole of stability: 1 + L = 0 means L = −1, a signal returning inverted and the same ' +
      'size it went out. The margins become distances you can see.',
    try: 'Kp → 11.25 and the curve passes through −1 exactly; Kp → 2 and it misses by a wide margin.',
    featured: ['kp'],
    chips: (s, marg) => [
      gain('kp', 2),
      gain('kp', 4),
      ...crossingChip(s, marg, 'The curve passes through −1 exactly'),
    ],
    terms: terms('complexplane', 'openloop', 'unitcircle', 'nyquistplot', 'margin', 'phasemargin', 'gainmargin'),
    patch: { plant: 'threePole', plantP: pp('threePole'), ctrl: 'p', ctrlP: cp('p', { kp: 4 }), view: 'nyquist' },
  },
  {
    group: 'Reading the loop',
    name: 'A margin thin enough to feel',
    note:
      'Phase margin is 25° here. The rule of thumb — phase margin in degrees ≈ 100 × the ' +
      'damping ratio — predicts ζ ≈ 0.25; the actual ζ is 0.22, overshooting 49% rather than ' +
      'the 44% a true 0.25 gives. Close enough to design with, not an identity.',
    try:
      'Kp → 40 and the margin thins to 13° with 70% overshoot; Kp → 2 and it is 52° and 16%. ' +
      'The Math tab says when the rule applies at all.',
    featured: ['kp'],
    chips: [gain('kp', 2), gain('kp', 10), gain('kp', 40)],
    terms: terms('ruleofthumb', 'identity', 'margin', 'phasemargin', 'zeta', 'overshoot'),
    patch: { plant: 'motor', plantP: pp('motor'), ctrl: 'p', ctrlP: cp('p', { kp: 10 }), view: 'step' },
  },

  // ------------------------------------------------------ Harder plants
  {
    group: 'Harder plants',
    name: 'The plant that needs feedback',
    note:
      'A pole in the right half plane: a positive-feedback stage, a maglev coil. Left alone it ' +
      'runs away exponentially. Feedback is not an improvement here but the only reason it ' +
      'works — and the failure mode is inverted: too little gain breaks it, not too much.',
    try:
      'Kp → 0.5 and the loop latches — it runs away instead of settling. Kp → 5 and it sits at ' +
      '1.25; Kp → 20 and it sits at 1.05.',
    featured: ['kp'],
    chips: [
      gain('kp', 0.5, 'Kp → 0.5 (latches)', 'Too little gain: the loop runs away to a rail'),
      gain('kp', 5),
      gain('kp', 20),
    ],
    terms: terms('positivefeedback', 'latches', 'rail', 'negativeerror', 'runsaway', 'rhp', 'pole'),
    patch: { plant: 'unstable', plantP: pp('unstable'), ctrl: 'p', ctrlP: cp('p', { kp: 5 }), view: 'step' },
  },
  {
    group: 'Harder plants',
    name: 'Derivative buys the phase back',
    // The jump at t = 0 is named: it is the unfiltered Kd·s meeting the
    // step's edge, the artefact the last sentence is about, and the step
    // view captions it the way the watch view marks the kick.
    note:
      'A resonant plant that proportional control alone makes worse. Derivative action answers ' +
      'where the error is heading, not where it is, adding phase where the loop is short of it. ' +
      "The jump at t = 0 is the unfiltered Kd·s meeting the step's edge — real derivative " +
      'terms are filtered; this also amplifies noise.',
    try:
      'Kd → its floor and the margin collapses to 12° with 23% overshoot; Kd → 1 and it is 90° ' +
      'with none. Margin and overshoot move together.',
    featured: ['kd'],
    chips: [gain('kd', 0.0001, 'Kd → 0.0001 (floor)'), gain('kd', 0.2), gain('kd', 1)],
    terms: terms('resonant', 'derivative', 'filtered', 'noise', 'floor', 'wn', 'zeta', 'margin', 'proportional', 'zero', 'phasemargin', 'overshoot'),
    patch: {
      plant: 'secondOrder',
      plantP: pp('secondOrder', { zeta: 0.15 }),
      ctrl: 'pid',
      ctrlP: cp('pid', { kp: 2, ki: 1, kd: 0.2 }),
      view: 'step',
    },
  },
  {
    group: 'Harder plants',
    name: 'Lead does it without the noise',
    note:
      'A lead network adds phase between its zero and its pole, peaking at their geometric mean ' +
      '— but unlike a derivative its gain stops rising above the pole, so it cannot amplify ' +
      'noise without limit. The ghost on the Bode is this loop without the lead.',
    // The try line quotes the network's OWN number — φmax = asin((p−z)/(p+z)),
    // read out on the Bode pane — because the phase margin is not monotone
    // in the pole: it fell 63.7° → 45.7° and then ROSE to 67.7° as the pole
    // passed the zero and the network turned into a lag. Both figures are
    // measured in lessons.test.js against the controller's own phase peak.
    try:
      'Proportional at the same gain and the margin drops from 64° to 54° — the ghost trace ' +
      'becomes the trace. Pole 20 → 5 and the phase the lead adds, in the Bode readout, ' +
      'falls from 64.8° to 41.8°.',
    // The pole is the knob the try line names; the zero follows it in the card.
    featured: ['p'],
    // Inside this lesson the pole cannot be dragged below the zero: that is
    // a lag, a different lesson, and the note would go quietly false. The
    // picker still allows it.
    ranges: { p: (ctrlP) => ({ min: ctrlP.z }) },
    chips: [
      ctrlChip('Proportional, Kp 3', 'p', { kp: 3 }, 'The same gain with the lead taken out'),
      ctrlChip('Lead 1 → 20 rad/s', 'lead', { k: 3, z: 1, p: 20 }),
      gain('p', 5, 'pole → 5 rad/s', 'A narrower lead: less phase added'),
    ],
    terms: terms('leadnetwork', 'geometricmean', 'ghost', 'lag', 'derivative', 'noise', 'proportional', 'margin', 'zero', 'pole', 'radpersec'),
    patch: {
      plant: 'threePole',
      plantP: pp('threePole'),
      ctrl: 'lead',
      ctrlP: cp('lead', { k: 3, z: 1, p: 20 }),
      view: 'step',
    },
  },
]

/** Apply a lesson to the app's state shape. */
export function applyLesson(l) {
  return {
    plantId: l.patch.plant,
    plantP: l.patch.plantP,
    ctrlId: l.patch.ctrl,
    ctrlP: l.patch.ctrlP,
    view: l.patch.view || 'step',
    stepInput: l.patch.stepInput || 'ref',
  }
}

/** The lesson's chips for the loop on screen — a function of the live margins where a chip reads one. */
export function chipsFor(lesson, state, marg) {
  if (!lesson || !lesson.chips) return []
  return typeof lesson.chips === 'function' ? lesson.chips(state, marg) : lesson.chips
}

/**
 * What a chip does to the state. A chip that changes the controller starts
 * from that controller's defaults (the same rule as the controller buttons)
 * and lays its own gains over them; a chip that keeps it changes only the
 * gains it names.
 */
export function applyChip(state, chip) {
  const next = { ...state }
  const set = chip.set || {}
  if (set.ctrlId && set.ctrlId !== state.ctrlId) {
    next.ctrlId = set.ctrlId
    next.ctrlP = { ...defaultsOf(CONTROLLERS[set.ctrlId]), ...(set.ctrlP || {}) }
  } else if (set.ctrlP) {
    next.ctrlP = { ...state.ctrlP, ...set.ctrlP }
  }
  if (set.stepInput) next.stepInput = set.stepInput
  return next
}

const same = (a, b) =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)) : a === b

/** Does the state already sit where this chip would put it? */
export function chipMatches(chip, state) {
  const set = chip.set || {}
  if (set.ctrlId && set.ctrlId !== state.ctrlId) return false
  if (set.stepInput && set.stepInput !== state.stepInput) return false
  for (const [k, v] of Object.entries(set.ctrlP || {})) {
    if (!same(state.ctrlP[k], v)) return false
  }
  return true
}

/** The chip to highlight: the most specific one the state satisfies, or null. */
export function activeChipOf(chips, state) {
  let best = null
  let bestN = -1
  for (const c of chips) {
    if (!chipMatches(c, state)) continue
    const n = Object.keys(c.set?.ctrlP || {}).length + (c.set?.ctrlId ? 1 : 0) + (c.set?.stepInput ? 1 : 0)
    if (n > bestN) {
      best = c
      bestN = n
    }
  }
  return best ? best.label : null
}

/**
 * Has the student moved away from the lesson's setup? Compared against the
 * lesson itself rather than flagged on every change, so dragging a knob back
 * to where it started un-dirties the lesson, and the view tab never counts.
 */
export function isDirty(lesson, state) {
  if (!lesson) return false
  const s = applyLesson(lesson)
  if (s.plantId !== state.plantId || s.ctrlId !== state.ctrlId || s.stepInput !== state.stepInput) return true
  for (const [k, v] of Object.entries(s.plantP)) if (!same(state.plantP[k], v)) return true
  for (const [k, v] of Object.entries(s.ctrlP)) if (!same(state.ctrlP[k], v)) return true
  return false
}
