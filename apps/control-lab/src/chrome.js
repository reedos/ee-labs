import { polesZeros, margins, stepResponse, dcGain } from '@ee-labs/systems'
import { PLANTS, CONTROLLERS, defaultsOf, buildLoop, ctrlDefaultsFor } from './systems.js'
import { CUES, TOPBAR_TERMS, termsFor } from './terms.js'
import { watchPartLabels } from './watch.js'
import { verdictOf, verdictBadge, bodeMarginNote, joinParts } from './verdict.js'
import { crossingGain, locusHereNote } from './lessons.js'
import { naturalWindow, overshootOf } from './stepWindow.js'
import { ladderUp } from './stepAxis.js'
import { simCost, simBlockReason, STEP_BUDGET } from './affordable.js'

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
// The fix this time is not a fourth patch: it is building the loop the
// picker's OWN default click would (buildLoop + ctrlDefaultsFor, the exact
// pair choosePlant/chooseCtrl call in App.jsx) and calling the SAME note
// functions App.jsx renders from — verdictBadge and bodeMarginNote
// (verdict.js), locusHereNote (lessons.js), overshootOf (stepWindow.js) —
// so every word one of those functions can ever print is a word this scan
// has already seen. A cue word can still go unscanned if a NEW readout is
// added to App.jsx without also being built from a function chrome.js
// calls — that is what verify.mjs's whole-cue-table browser probe exists to
// catch, on the actual rendered page rather than this file's model of it.

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
  math:
    'The math — theory against what this loop measures. ' +
    'Setting the denominator to zero gives the characteristic equation.',
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
 * Whether the Step pane's overshoot line would print at the picker's own
 * default gains, reproducing App.jsx's own duration/affordability pipeline
 * (naturalWindow, ladderUp, simBlockReason — all already-shared pure
 * functions; only the orchestration is repeated, the same way App.jsx's
 * useMemo repeats it, because chrome.js has no React state to memoize into
 * and does not need stickyDuration's hold-still behaviour for a single
 * one-shot reading) then measuring overshootOf on the simulated trace —
 * the SAME function App.jsx calls to decide whether to print it.
 */
function stepOverviewShowsOvershoot(loop, verdict) {
  if (verdict !== 'stable') return false
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
 * Every term id whose cue appears in what is actually on screen for this
 * plant, controller and lower view with NO lesson loaded — at the exact
 * gains the picker itself would leave the student at (defaultsOf the plant,
 * ctrlDefaultsFor the controller: the same pair choosePlant/chooseCtrl call
 * in App.jsx). The top bar's own terms are always included — it is on
 * screen under every state, lesson or not, the same rule `terms()` in
 * lessons.js already applies to every lesson.
 *
 * What is scanned:
 *   - the plant hint, the controller hint, VIEW_CHROME's static stand-in —
 *     prose that never changes with the loop's numbers.
 *   - the verdict badge and the Bode pane's margin sentence (verdictBadge,
 *     bodeMarginNote — verdict.js), which ARE on screen regardless of the
 *     lower view (the topbar and the "Open loop" pane render unconditionally)
 *     and DO depend on the loop: whether it is marginal, and whether its
 *     gain margin is above 1, below 1, or absent entirely.
 *   - on the locus view, the root-locus "you are here" sentence
 *     (locusHereNote — lessons.js), in whichever of its three shapes this
 *     loop's margins actually produce.
 *   - on the step view, the live overshoot line, added as the literal word
 *     it prints only when stepOverviewShowsOvershoot says the pane would.
 *   - on the watch view, the readout strip's part labels (watchPartLabels),
 *     as before.
 *
 * A cue word that only ever appears INSIDE a formatted number ("21.0 dB",
 * "Kp·e = 0.184") never shows up in any of that — TOPBAR_TERMS carries the
 * numeric ones that are always on screen (db, radpersec).
 */
export function chromeTermIds(plantId, ctrlId, view) {
  const plant = PLANTS[plantId]
  const ctrl = CONTROLLERS[ctrlId]
  const plantP = defaultsOf(plant)
  const ctrlP = ctrlDefaultsFor(plantId, plantP, ctrlId)
  const plantHint = typeof plant.hint === 'function' ? plant.hint(plantP) : plant.hint

  const loop = buildLoop(plantId, plantP, ctrlId, ctrlP)
  const openPz = polesZeros(loop.open)
  const marg = margins(loop.open, wideFreqsFor(openPz))
  const verdict = verdictOf(loop.closed, marg)
  const marginal = verdict === 'marginal'

  // On screen regardless of the lower view: the topbar badge and the Bode
  // pane's margin sentence directly below the crossover line.
  const badge = verdictBadge(verdict)
  const marginNote = bodeMarginNote(marginal, marg.gainMargin)

  const watchLabels = view === 'watch' ? watchPartLabels(ctrlId) : []
  const watchText = watchLabels.length > 1 ? watchLabels.join(' ') : ''

  let viewText = VIEW_CHROME[view] || ''
  if (view === 'locus') {
    const crossing = crossingGain(ctrlId, ctrlP, marg)
    viewText += ' ' + joinParts(locusHereNote(marginal, crossing).parts)
  }
  if (view === 'step' && stepOverviewShowsOvershoot(loop, verdict)) {
    // The literal word the readout prints ("overshoot 12.3%"), not a
    // hand-kept id — so it goes through the SAME CUES scan as everything
    // else, the discipline the "derives the list from the cue table, not a
    // hand-kept one" test (chrome.test.js) exists to hold this file to.
    viewText += ' overshoot'
  }

  const text = [
    plantHint,
    ctrl.hint,
    viewText,
    watchText,
    badge.badge,
    badge.full,
    badge.short,
    joinParts(marginNote.parts),
    ALWAYS_ON_CHROME,
  ].join(' ')

  const ids = new Set(TOPBAR_TERMS)
  for (const [id, re] of Object.entries(CUES)) {
    if (re.test(text)) ids.add(id)
  }
  return [...ids]
}

/** The definitions themselves, in the same shape the lesson's own fold renders. */
export function chromeTerms(plantId, ctrlId, view) {
  return termsFor(chromeTermIds(plantId, ctrlId, view))
}
