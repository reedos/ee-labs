import { PLANTS, CONTROLLERS, defaultsOf } from './systems.js'
import { CUES, TOPBAR_TERMS, termsFor } from './terms.js'
import { watchPartLabels } from './watch.js'

// Definitions on contact for the PICKER — the state a plant or controller
// click leaves the student in, with no lesson note and so, before this,
// nowhere to look a word up. clearLesson() (App.jsx) wipes the lesson's own
// terms list along with the lesson, and the top bar's own vocabulary (phase
// margin, gain margin, crossover, steady error) is on screen throughout
// regardless — so a picker click used to meet all of it with no glossary.
//
// The fix follows the lesson's own pattern rather than inventing a second
// one: fold the same "terms used here" affordance under the picker, fed by
// what the picker is actually showing — the current plant's hint, the
// current controller's hint, and the lower view's own on-screen prose — run
// through the SAME cue table terms.scan.test.js already scans a lesson's
// note against (CUES, terms.js), so a new cue word anywhere in that prose
// is caught automatically rather than requiring a hand-kept list per view.

/**
 * The prose that is on screen for each lower view with no lesson active,
 * independent of the live numbers — copied verbatim from what App.jsx
 * renders there so the scan and the screen can never drift apart. Step and
 * Watch add no cue word beyond what the top bar and the plant/controller
 * hints already carry, so they contribute nothing extra here.
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
 * Every term id whose cue appears in what is actually on screen for this
 * plant, controller and lower view with NO lesson loaded. The top bar's own
 * terms are always included — it is on screen under every state, lesson or
 * not, the same rule `terms()` in lessons.js already applies to every
 * lesson.
 *
 * Everything scanned here is prose: the plant hint, the controller hint,
 * VIEW_CHROME's static stand-in for a view's own on-screen words. A cue word
 * that only ever appears INSIDE a formatted number ("21.0 dB", "Kp·e =
 * 0.184") never shows up in any of that — TOPBAR_TERMS now carries the
 * numeric ones that are always on screen (db, radpersec), and the watch
 * view's own numeric strip is handled below by asking watch.js what it
 * would print, rather than by trying to teach a text scan to read inside a
 * number.
 */
export function chromeTermIds(plantId, ctrlId, view) {
  const plant = PLANTS[plantId]
  const ctrl = CONTROLLERS[ctrlId]
  const plantHint = typeof plant.hint === 'function' ? plant.hint(defaultsOf(plant)) : plant.hint
  // The watch view's readout strip, exactly as gated in App.jsx: rendered
  // only once there is more than one part to split the effort into. Read
  // from watch.js's own label list (watch.test.js pins it against
  // watchSignals) rather than copied by hand, so a label this scan does not
  // know about — the actual shape of the defect — cannot ship silently.
  const watchLabels = view === 'watch' ? watchPartLabels(ctrlId) : []
  const watchText = watchLabels.length > 1 ? watchLabels.join(' ') : ''
  const text = `${plantHint} ${ctrl.hint} ${VIEW_CHROME[view] || ''} ${watchText}`
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
