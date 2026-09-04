import { polesZeros, margins, stepResponse, dcGain } from '@ee-labs/systems'
import { PLANTS, CONTROLLERS, buildLoop } from './systems.js'
import { CUES, TOPBAR_TERMS, termsFor } from './terms.js'
import { watchPartLabels } from './watch.js'
import { verdictOf, verdictBadge, bodeMarginNote, joinParts, arrivalErrorNote } from './verdict.js'
import { crossingGain, locusHereNote } from './lessons.js'
import { naturalWindow, overshootOf } from './stepWindow.js'
import { ladderUp } from './stepAxis.js'
import { simCost, simBlockReason, STEP_BUDGET } from './affordable.js'
import { loopMath } from './math.js'

// Definitions on contact for the PICKER — the state a plant or controller
// click leaves the student in, with no lesson note and so, before this,
// nowhere to look a word up. clearLesson() (App.jsx) wipes the lesson's own
// terms list along with the lesson, and the top bar's own vocabulary (phase
// margin, gain margin, crossover, steady error) is on screen throughout
// regardless — so a picker click used to meet all of it with no glossary.
//
// The first cut fixed that by scanning three things: the plant's hint, the
// controller's hint, and a hand-written VIEW_CHROME stand-in for a view's
// own static prose. That caught every cue word living in HINT text, and
// missed every one living in the READOUT — the verdict badge, the Bode
// pane's margin sentence, the root-locus "you are here" line, the step
// pane's overshoot line — because none of that is static: it depends on the
// loop's actual poles and margins, which VIEW_CHROME cannot know without
// computing them. Three of those readouts got patched by hand (the marginal
// badge, the marginal locus line, Kp·e), and the same hole regrew in the
// other branch of every one of them: the ROUTINE "past the boundary"
// sentence, the ROUTINE "crossed the axis" line, the plants whose hint
// prose happens not to repeat "−180°", and the step pane's ordinary
// overshoot line.
//
// The second cut fixed THAT by building the loop the picker's OWN default
// click would (buildLoop + ctrlDefaultsFor) and calling the SAME note
// functions App.jsx renders from — verdictBadge and bodeMarginNote
// (verdict.js), locusHereNote (lessons.js), overshootOf (stepWindow.js) — so
// every word one of those functions can ever print is a word this scan has
// already seen. It fixed every REPORTED instance and left the cause: this
// file modelled the loop the picker leaves you at on a fresh click, not the
// loop that is actually on screen, because it rebuilt the loop from
// defaultsOf/ctrlDefaultsFor instead of taking the live plantP/ctrlP a
// dragged slider has long since moved away from them. An adversarial walk
// found three live consequences of that one gap, all from the SAME cause:
//
//   1. The fold goes stale the moment a knob moves. Three lags × Proportional
//      at Kp = 1 settles; drag Kp to 80 and the top bar reads UNSTABLE with
//      "past the boundary", both terms this file never re-derives because it
//      was never told the gain had moved.
//   2. The disturbance toggle was invisible to it. chromeTermIds had no
//      stepInput parameter, so it could not model the pane heading ("Response
//      to a disturbance at the plant input") App.jsx renders depending on
//      it — "disturbance" never fired for any plant or controller while that
//      heading was on screen.
//   3. The arrival banner (App.jsx, a hand-over link's orientation notice)
//      was not scanned at all — reachable with a link such as
//      #plant=integrator:1&ctrl=lead:1:1:10&from=circuit:xyz, printing
//      "integrator" with neither hint anywhere near the word.
//
// The fix is not a fifth patch on top of a stale model: it is passing the
// state that is ACTUALLY on screen in, instead of reconstructing a plausible
// one. chromeTermIds now takes the live plantP and ctrlP (so the loop it
// builds is the loop being rendered, not the loop a fresh click would have
// left), the live stepInput (so it can call paneHeading — hoisted below,
// verbatim, from App.jsx's own h2 ternary — the same way it already called
// verdictBadge and bodeMarginNote), and whether this session arrived via a
// hand-over link (so it can call arrivalErrorNote, verdict.js, the same
// function App.jsx's banner renders from). A cue word can still go unscanned
// if a NEW readout is added to App.jsx without also being built from a
// function chrome.js calls — that is what verify.mjs's whole-cue-table
// browser probe exists to catch, on the actual rendered page rather than
// this file's model of it, and it now DRIVES the page instead of only
// reading its 140 default states (item 33).
//
// Round four's own finding was the same cause wearing a fourth disguise:
// VIEW_CHROME.math was a hand-picked stand-in for the Math tab, not built
// from loopMath the way the other readouts here are — the fourth "fifth
// patch" this file's own comment above already warned against, in the one
// spot it had not yet reached. verify.mjs excused the whole pane from its
// scan on the theory that this stand-in (or a hand audit of the pane
// itself) covered it, and neither did: the pane's actual opening paragraph
// names "the right half plane" and "a plot of L" — RHP and the Nyquist
// plot — on the plainest click there is, and a plant with no integrator in
// the loop names it too, none of it in VIEW_CHROME.math or in any hint.
// VIEW_CHROME.math is now '', and chromeTermIds calls loopMath itself
// (mathProseText) so a term the Math pane can print is a term this file has
// actually read, not guessed at.
//
// Unblinding verify.mjs's scan (dropping the math-pane exclusion, reading
// `title` attributes) surfaced two more instances of the SAME cause, neither
// inside the Math tab: the topbar's own flow strip prints the plant and
// controller's NAMES unconditionally, and this file had never scanned
// either one, only their hints — so "Three lags" and "Integrator" fired
// CUES.lag and CUES.integrator with nothing in this file to see them
// whenever the hint that would normally cover the word happened to belong
// to a DIFFERENT plant or controller. And the topbar's "⧉ diagram" button
// carries a tooltip naming "disturbance" on every single state, a source
// this file never modelled at all — "disturbance" is now in TOPBAR_TERMS
// (terms.js) instead of staying a toggle-gated cue, and plant.name/ctrl.name
// join plantHint/ctrl.hint below.

/**
 * The prose that is on screen for each lower view with no lesson active,
 * independent of the live numbers — copied verbatim from what App.jsx
 * renders there so the scan and the screen can never drift apart. Step adds
 * no FIXED prose beyond what the top bar and the plant/controller hints
 * already carry (its own live overshoot line is handled below, not here —
 * it exists or not depending on the loop, the same reason Watch's readout
 * strip isn't a stand-in either). Locus's fixed half ("shaded half",
 * "closed-loop vs open-loop poles") lives here; its live "you are here"
 * line is also handled below.
 */
export const VIEW_CHROME = {
  step: '',
  // Watch's own vocabulary is NOT static prose — it is the readout strip's
  // part labels (Kp·e, Ki·∫e, Kd·ė), which exist or not depending on the
  // controller (App.jsx only renders the strip once watch.parts.length > 1:
  // a plain P controller shows one part and no strip at all; PI and PID
  // show two or three). A hand-written stand-in here would have to repeat
  // that same controller-dependent gate to stay honest, and the previous
  // one did not — it read '', on the theory that watch added nothing the
  // top bar and the hints did not already carry, which stopped being true
  // the moment "Kp·e" started needing its OWN cue with no lucky match in
  // any hint. chromeTermIds below asks watch.js's own watchPartLabels
  // instead of repeating the gate here, so the two cannot drift apart.
  watch: '',
  nyquist:
    'Stability is a statement about one point: 1 + L = 0. ' +
    'The Nyquist view plots the open loop against the point −1.',
  locus:
    'Root locus — the closed-loop poles, as the gain K sweeps. ' +
    'Crosses into the shaded half and the loop oscillates. ' +
    'Open-loop poles and closed-loop poles.',
  // Math is NOT static prose either, and a hand-picked stand-in here was
  // wrong on the same grounds watch's was: packages/explain renders
  // loopMath's actual blocks — text paragraphs, check-row labels,
  // value-row labels and notes — and that derivation branches on the live
  // loop (how many integrators, whether a crossover exists, whether the
  // closed loop is second order, whether it is stable) exactly the way the
  // other readouts here do. A verify.mjs audit once excused this pane from
  // its own whole-cue-table scan on the theory that this file's stand-in
  // covered it; the pane's REAL opening paragraph reads "a solution in the
  // right half plane" and "the Nyquist view is a plot of L" on the plainest
  // click there is (First order lag × Proportional), and the stand-in named
  // neither. chromeTermIds below calls loopMath itself (mathProseText) so
  // this file reads what the pane actually renders instead of a guess at it.
  math: '',
}

/**
 * The plain text loopMath's blocks would put on screen — text paragraphs,
 * a check row's label and its footnoted reason, a value row's label and its
 * note — reproducing what packages/explain's MathBody actually renders
 * (Formula's own LaTeX is not prose and is skipped, the same way a `tex`-
 * named check/value row would render as typeset math rather than the plain
 * label MathBody falls back to; none of this app's rows use one). This is
 * the SAME function App.jsx's math pane renders from, called with the live
 * loop and margins, so a term the pane can print is a term this scan can see
 * — the fix for the false premise the old .math-pane exclusion rested on.
 */
function mathProseText(math) {
  if (!math) return ''
  const bits = []
  for (const b of math.blocks) {
    if (b.kind === 'text') bits.push(b.text)
    else if (b.kind === 'formula') {
      if (b.caption) bits.push(b.caption)
    } else if (b.kind === 'check') {
      for (const r of b.rows) {
        bits.push(r.label)
        if (r.unchecked) bits.push(r.unchecked)
      }
    } else if (b.kind === 'values') {
      for (const r of b.rows) {
        bits.push(r.label)
        if (r.note) bits.push(r.note)
      }
    }
  }
  return bits.join(' ')
}

/**
 * Fixed prose that is on screen regardless of the lower view, alongside the
 * top bar — the "Open loop" pane's own heading. Unlike the badge and the
 * Bode margin sentence, this one never depends on the loop's numbers, so it
 * is a literal rather than a function call; it still needs to be IN the
 * scanned text, which is exactly the gap the whole-cue-table probe
 * (verify.mjs item 33) found on its first run: "open loop" fires
 * CUES.openloop on every single state, and nothing here had ever scanned a
 * pane heading before.
 */
const ALWAYS_ON_CHROME = 'Open loop L(s) = C(s)·P(s)'

/**
 * The section-header definitions (App.jsx's `#controller`/`#plant` cards):
 * what a plant and a controller ARE, rendered unconditionally right under
 * each `<h2>` regardless of lesson or view — NEEDS.md's own ask, and the
 * load-bearing content is the input/output identity (u, y, r − y) that
 * confused a reader arriving from a hand-over link. One string apiece, kept
 * here rather than inline in App.jsx so this scan and the screen read the
 * exact same words, the same reason ALWAYS_ON_CHROME above is not a literal
 * repeated in two files.
 */
export const PLANT_DEF =
  'The plant is the system you are stuck with, a motor, a tank, a circuit. Its input is the drive u, ' +
  'whatever the controller sends, and its output is the measured y fed back to it.'
export const CONTROLLER_DEF =
  'The controller is the block you design. Its input is the error, the reference r minus the measured y, ' +
  'and its output is the drive u sent to the plant.'

/**
 * The four ids these two definitions introduce (drive already had one:
 * CUES.drive). Kept apart from TOPBAR_TERMS — which every LESSON also
 * inherits via lessons.js's own `terms()` helper — because these belong to
 * the picker's section headers specifically; folding them into TOPBAR_TERMS
 * would widen every lesson's own "terms used here" fold by four entries no
 * lesson asked for. chromeTermIds seeds its id set with both lists, so the
 * picker's fold (the only one item 33's browser probe walks) offers all of
 * them unconditionally, the same guarantee TOPBAR_TERMS gives its own four.
 */
export const SECTION_TERMS = ['plant', 'controller', 'error', 'reference']

/**
 * The wide, 1600-point margin-measurement grid App.jsx's `wideFreqs` builds
 * (16 decades around the loop's own pole/zero geometric mean), reproduced
 * here from the open loop alone. App.jsx's version centres on
 * `sqrt(freqs[0] * freqs[last])`, where `freqs` is itself centred on the
 * SAME geometric mean — so the two grids share one centre by construction,
 * and this skips only the plotted grid's sticky-frame bookkeeping (frame.js),
 * which exists to hold the AXIS still across a sequence of renders and has
 * nothing to answer for a single fresh reading.
 */
function wideFreqsFor(openPz) {
  const ws = [...openPz.poles, ...openPz.zeros].map(([re, im]) => Math.hypot(re, im)).filter((w) => w > 1e-9)
  const centre = ws.length ? Math.exp(ws.reduce((s, w) => s + Math.log(w), 0) / ws.length) / (2 * Math.PI) : 1
  const lo = Math.log10(centre) - 8
  return Float64Array.from({ length: 1600 }, (_, i) => Math.pow(10, lo + (16 * i) / 1599))
}

/**
 * Whether the Step pane's overshoot line would print for THIS loop, at
 * THIS stepInput, reproducing App.jsx's own duration/affordability pipeline
 * (naturalWindow, ladderUp, simBlockReason — all already-shared pure
 * functions; only the orchestration is repeated, the same way App.jsx's
 * useMemo repeats it, because chrome.js has no React state to memoize into
 * and does not need stickyDuration's hold-still behaviour for a single
 * one-shot reading) then measuring overshootOf on the simulated trace —
 * the SAME function App.jsx calls to decide whether to print it.
 *
 * App.jsx only ever prints this line for a REFERENCE step (`stepInput ===
 * 'ref'`) — a disturbance step's own destination is zero, and "overshoot"
 * is not a question that pane asks of it. This used to run for every
 * stepInput because chromeTermIds had nowhere to get one from at all; adding
 * the parameter is part of the same fix as the pane heading below, not a
 * second, unrelated change.
 */
function stepOverviewShowsOvershoot(loop, verdict, stepInput) {
  if (stepInput !== 'ref' || verdict !== 'stable') return false
  const pz = polesZeros(loop.closed)
  const finite = pz.poles.filter(([re]) => Math.abs(re) > 1e-9).map(([re]) => Math.abs(re))
  const slow = finite.length ? Math.min(...finite) : Infinity
  const grow = Math.max(0, ...pz.poles.map(([re]) => re))
  const canSim = (d) => simCost(pz.poles, d) <= STEP_BUDGET
  const natural = naturalWindow(loop.closed, { verdict, slow, grow, osc: 0 }, canSim)
  const duration = ladderUp(natural)
  if (simBlockReason(loop.open, pz.poles, duration)) return false
  const step = stepResponse(loop.closed, { duration, points: 900 })
  return overshootOf(step.y, dcGain(loop.closed)) != null
}

/**
 * The pane title App.jsx's `.view-head h2` renders for the lower view —
 * copied verbatim from the ternary it used to live in only there (App.jsx,
 * beside the lower-view switch) so this is the ONE place that string is
 * written. Step and Watch are the only two views whose heading depends on
 * `stepInput`: Step's disturbance heading is where "disturbance" actually
 * lives on screen (cold-walk finding 2 — chromeTermIds had no stepInput
 * parameter at all, so this heading, and the cue inside it, went unmodelled
 * for every plant and every controller). Watch's own two headings use
 * "shove" rather than "disturbance", so they carry no cue either way.
 */
export function paneHeading(view, stepInput) {
  if (view === 'step') {
    return stepInput === 'dist' ? 'Response to a disturbance at the plant input' : 'Closed-loop step response'
  }
  if (view === 'watch') {
    return stepInput === 'dist' ? 'The loop fighting a shove, watched' : 'The loop closing the gap, watched'
  }
  if (view === 'nyquist') return 'Nyquist — the loop against −1'
  if (view === 'math') return 'The math — theory against what this loop measures'
  return 'Root locus — the closed-loop poles, as the gain K sweeps'
}

/**
 * Every term id whose cue appears in what is actually on screen for this
 * plant, controller and lower view with NO lesson loaded — at the LIVE
 * gains (`plantP`, `ctrlP`) the sliders actually sit at, not the defaults a
 * fresh click would leave. The top bar's own terms are always included — it
 * is on screen under every state, lesson or not, the same rule `terms()` in
 * lessons.js already applies to every lesson.
 *
 * Every argument here is something the student can actually change, and
 * every one of them is read straight off React state by chromeTerms' one
 * caller (App.jsx) — there is no default-reconstruction step left for the
 * fold to go stale against.
 *
 * What is scanned:
 *   - the plant hint (a function of the LIVE plantP where the plant's hint
 *     is one, e.g. the second-order plant's Circuit Lab cross-reference),
 *     the controller hint, VIEW_CHROME's static stand-in — prose that never
 *     changes with the loop's numbers.
 *   - the pane's own h2 title (paneHeading, above) — the disturbance heading
 *     lives here.
 *   - the verdict badge and the Bode pane's margin sentence (verdictBadge,
 *     bodeMarginNote — verdict.js), which ARE on screen regardless of the
 *     lower view (the topbar and the "Open loop" pane render unconditionally)
 *     and DO depend on the loop: whether it is marginal, and whether its
 *     gain margin is above 1, below 1, or absent entirely — all read off the
 *     LIVE loop, so a knob dragged past the boundary changes this exactly
 *     when the screen does, not only at the picker's own defaults.
 *   - on the locus view, the root-locus "you are here" sentence
 *     (locusHereNote — lessons.js), in whichever of its three shapes this
 *     loop's margins actually produce.
 *   - on the step view, the live overshoot line, added as the literal word
 *     it prints only when stepOverviewShowsOvershoot says the pane would.
 *   - on the watch view, the readout strip's part labels (watchPartLabels),
 *     as before.
 *   - on the math view, the pane's own derivation (mathProseText, calling
 *     loopMath — math.js), in whichever shape the live loop actually gives
 *     it: how many integrators it counts, whether a crossover exists, and
 *     whether the closed loop is second order all change which sentences
 *     and rows loopMath returns.
 *   - the arrival banner's variable tail (arrivalErrorNote — verdict.js),
 *     when `arrival` says a hand-over link put this student here AND the
 *     live loop is stable — App.jsx's own gate for rendering it at all.
 *
 * A cue word that only ever appears INSIDE a formatted number ("21.0 dB",
 * "Kp·e = 0.184") never shows up in any of that — TOPBAR_TERMS carries the
 * numeric ones that are always on screen (db, radpersec), and now
 * disturbance, which lives only in the topbar's own diagram-button tooltip
 * (round four). The plant and controller's own NAMES are scanned alongside
 * their hints, below, for the same reason: "Three lags" and "Integrator"
 * are on screen in the topbar's flow strip whether or not either hint ever
 * repeats the word.
 */
export function chromeTermIds({ plantId, plantP, ctrlId, ctrlP, view, stepInput, arrival }) {
  const plant = PLANTS[plantId]
  const ctrl = CONTROLLERS[ctrlId]
  const plantHint = typeof plant.hint === 'function' ? plant.hint(plantP) : plant.hint

  const loop = buildLoop(plantId, plantP, ctrlId, ctrlP)
  const openPz = polesZeros(loop.open)
  const freqsWide = wideFreqsFor(openPz)
  const marg = margins(loop.open, freqsWide)
  const verdict = verdictOf(loop.closed, marg)
  const marginal = verdict === 'marginal'

  // On screen regardless of the lower view: the topbar badge and the Bode
  // pane's margin sentence directly below the crossover line.
  const badge = verdictBadge(verdict)
  const marginNote = bodeMarginNote(verdict, marg.gainMargin)

  const watchLabels = view === 'watch' ? watchPartLabels(ctrlId) : []
  const watchText = watchLabels.length > 1 ? watchLabels.join(' ') : ''

  let viewText = (VIEW_CHROME[view] || '') + ' ' + paneHeading(view, stepInput)
  if (view === 'locus') {
    const crossing = crossingGain(ctrlId, ctrlP, marg)
    viewText += ' ' + joinParts(locusHereNote(marginal, crossing).parts)
  }
  if (view === 'math') {
    viewText += ' ' + mathProseText(loopMath(plantId, plantP, ctrlId, ctrlP, loop, marg, freqsWide))
  }
  if (view === 'step' && stepOverviewShowsOvershoot(loop, verdict, stepInput)) {
    // The literal word the readout prints ("overshoot 12.3%"), not a
    // hand-kept id — so it goes through the SAME CUES scan as everything
    // else, the discipline the "derives the list from the cue table, not a
    // hand-kept one" test (chrome.test.js) exists to hold this file to.
    viewText += ' overshoot'
  }

  // The arrival banner (App.jsx: `linked.state && stable`) — a hand-over
  // link's own orientation notice, on screen regardless of the lower view,
  // gone the moment the live loop stops being stable.
  const arrivalText = arrival && verdict === 'stable' ? arrivalErrorNote(1 - dcGain(loop.closed)) : ''

  const text = [
    plantHint,
    ctrl.hint,
    // The topbar's own flow strip prints these two NAMES unconditionally
    // (App.jsx: "{ctrl.name} C(s) → {plant.name} P(s)"), regardless of
    // lesson or view — and a plant or controller can be named with a cue
    // word its own hint never repeats. "Three lags" fires CUES.lag with no
    // help from its hint (three RC stages, never called a lag there), and
    // "Integrator" fires CUES.integrator the same way under Lead, the one
    // controller whose hint does not already say the word. Scanning the
    // hint alone let both hide behind whichever OTHER plant or controller
    // happened to repeat the word in ITS hint — round four's adversarial
    // walk found them by testing the full matrix rather than trusting that
    // coincidence.
    plant.name,
    ctrl.name,
    viewText,
    watchText,
    badge.badge,
    badge.full,
    badge.short,
    joinParts(marginNote.parts),
    ALWAYS_ON_CHROME,
    PLANT_DEF,
    CONTROLLER_DEF,
    arrivalText,
  ].join(' ')

  const ids = new Set([...TOPBAR_TERMS, ...SECTION_TERMS])
  for (const [id, re] of Object.entries(CUES)) {
    if (re.test(text)) ids.add(id)
  }
  return [...ids]
}

/** The definitions themselves, in the same shape the lesson's own fold renders. */
export function chromeTerms(state) {
  return termsFor(chromeTermIds(state))
}
