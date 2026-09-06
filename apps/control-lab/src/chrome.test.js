import { describe, it, expect } from 'vitest'
import { margins } from '@ee-labs/systems'
import { PLANTS, CONTROLLERS, defaultsOf, ctrlDefaultsFor, buildLoop } from './systems.js'
import { CUES, TOPBAR_TERMS, TERMS } from './terms.js'
import { chromeTermIds, chromeTerms, VIEW_CHROME, paneHeading, PLANT_DEF, CONTROLLER_DEF, SECTION_TERMS } from './chrome.js'
import { verdictOf } from './verdict.js'

// Definitions on contact in the PICKER: a plant or controller click clears
// the lesson (App.jsx's clearLesson), and before this there was nowhere left
// to look up phase margin, gain margin, "-1", the shaded half, or the
// characteristic equation once that happened. chromeTermIds derives its
// list from the SAME cue table (terms.js's CUES) that terms.scan.test.js
// already scans a lesson's note against, applied to what the picker itself
// shows instead — the current plant's hint, the current controller's hint,
// and the lower view's own static chrome (VIEW_CHROME, copied verbatim from
// what App.jsx renders there).
//
// Round three's fix: chromeTermIds takes the LIVE plantP/ctrlP/stepInput/
// arrival instead of reconstructing a plausible default state — so this
// file's helper builds those the same way App.jsx's own choosePlant/
// chooseCtrl would (defaultsOf, ctrlDefaultsFor), but every test that needs
// to prove the fold TRACKS a change constructs its own plantP/ctrlP/stepInput
// away from that default, exactly as a dragged slider or a clicked toggle
// would.

const plantIds = Object.keys(PLANTS)
const ctrlIds = Object.keys(CONTROLLERS)
const views = ['step', 'watch', 'nyquist', 'locus', 'math']

/** The picker's own default state for a plant/controller pair — what a fresh click leaves. */
function defaultState(plantId, ctrlId, view, extra = {}) {
  const plantP = defaultsOf(PLANTS[plantId])
  const ctrlP = ctrlDefaultsFor(plantId, plantP, ctrlId)
  return { plantId, plantP, ctrlId, ctrlP, view, stepInput: 'ref', arrival: false, ...extra }
}

/** 'stable' | 'marginal' | 'unstable' for a chromeTermIds-shaped state, independent of chrome.js's own internals. */
function verdictOfLoop({ plantId, plantP, ctrlId, ctrlP }) {
  const loop = buildLoop(plantId, plantP, ctrlId, ctrlP)
  const grid = Float64Array.from({ length: 4000 }, (_, i) => Math.pow(10, -8 + (16 * i) / 3999))
  return verdictOf(loop.closed, margins(loop.open, grid))
}

describe('picker terms: reachable with no lesson active', () => {
  it('every one of the 7 x 4 x 5 = 140 default states resolves every id it offers, and always offers the top bar', () => {
    expect(plantIds.length).toBe(7)
    expect(ctrlIds.length).toBe(4)
    expect(views.length).toBe(5)
    let states = 0
    for (const pid of plantIds) {
      for (const cid of ctrlIds) {
        for (const view of views) {
          states++
          const state = defaultState(pid, cid, view)
          const ids = chromeTermIds(state)
          const resolved = chromeTerms(state)
          expect(resolved.length, `${pid} x ${cid} x ${view}: an offered id with no definition`).toBe(ids.length)
          // The top bar is on screen throughout, lesson or not.
          for (const t of TOPBAR_TERMS) {
            expect(ids, `${pid} x ${cid} x ${view}: missing top bar term "${t}"`).toContain(t)
          }
        }
      }
    }
    expect(states).toBe(140)
  })

  it('the specific defects Reed hit: no path to a definition once the lesson unloads', () => {
    // The top bar, always: phase margin, gain margin, crossover, steady error.
    const anyState = chromeTermIds(defaultState('firstOrder', 'p', 'step'))
    for (const t of ['phasemargin', 'gainmargin', 'crossover', 'steadystate']) {
      expect(anyState).toContain(t)
    }

    // Nyquist: "-1" is explained by the Nyquist-plot definition itself
    // ("judged against the single point -1"), reached via its own cue.
    expect(chromeTermIds(defaultState('firstOrder', 'p', 'nyquist'))).toContain('nyquistplot')

    // Root locus: "crosses into the shaded half", and open-loop vs
    // closed-loop poles — the readout text that is on screen regardless of
    // any lesson.
    const locus = chromeTermIds(defaultState('firstOrder', 'p', 'locus'))
    expect(locus).toContain('shadedhalf')
    expect(locus).toContain('closedvsopen')

    // Math: the characteristic equation.
    expect(chromeTermIds(defaultState('firstOrder', 'p', 'math'))).toContain('characteristicequation')
  })

  it('Reed\'s cold-walk defect: dB, rad/s and Kp·e all reachable with no lesson loaded', () => {
    // dB (top bar gain margin) and rad/s (the open-loop pane's crossover
    // readout) are printed only inside a formatted NUMBER — never as a bare
    // word a prose scan of the plant/controller hints or VIEW_CHROME would
    // ever see — so both are on screen in EVERY state, not just some.
    for (const view of views) {
      const ids = chromeTermIds(defaultState('firstOrder', 'p', view))
      expect(ids, `${view}: dB`).toContain('db')
      expect(ids, `${view}: rad/s`).toContain('radpersec')
    }

    // Kp·e: the watch view's own readout strip, rendered only once there is
    // more than one part to split the effort into — PI and PID, not plain P
    // (one part, no strip at all) and not Lead (also one part, its own u).
    expect(chromeTermIds(defaultState('firstOrder', 'pi', 'watch'))).toContain('kpe')
    expect(chromeTermIds(defaultState('secondOrder', 'pid', 'watch'))).toContain('kpe')
    expect(chromeTermIds(defaultState('firstOrder', 'p', 'watch'))).not.toContain('kpe')
    expect(chromeTermIds(defaultState('firstOrder', 'lead', 'watch'))).not.toContain('kpe')
    // And only on the watch view — Kp·e is not on screen anywhere else.
    expect(chromeTermIds(defaultState('firstOrder', 'pi', 'step'))).not.toContain('kpe')
  })

  it("Reed's cold walk, round two: the boundary, the axis, \"phase never reaches −180°\" and overshoot all resolve wherever the readout actually prints them — not just the rare instance a hand patch would catch", () => {
    // "the boundary": both the verdict badge AND the Bode pane's margin
    // sentence can print it, and the picker's OWN defaults (ctrlDefaultsFor,
    // the same pair choosePlant/chooseCtrl call) land on it for real —
    // unstable × PI and × PID sit at a gain margin below 1 ("past the
    // boundary — it sits at ~0.20× this gain"), not the rare marginal case.
    // Since the Bode pane is on screen regardless of the lower view, so is
    // this cue.
    for (const cid of ['pi', 'pid']) {
      for (const view of views) {
        expect(chromeTermIds(defaultState('unstable', cid, view)), `unstable x ${cid} x ${view}`).toContain(
          'boundary',
        )
      }
    }

    // "the axis": the ROUTINE root-locus "you are here ... crossed the axis
    // at ..." line, printed for any plant/controller whose default has a
    // real gain margin to report — not only the marginal case. Three lags
    // is far from its own boundary (Kp = 1 of 11.25) at every controller's
    // default, and still names the axis on the way there.
    for (const cid of ctrlIds) {
      expect(
        chromeTermIds(defaultState('threePole', cid, 'locus')),
        `threePole x ${cid} x locus`,
      ).toContain('imaginaryaxis')
    }

    // "phase never reaches −180°": printed whenever the loop has no gain
    // crossover at all — Integrator, Second order and Custom H(s) get there
    // with no help from their own hint prose (unlike First order, Motor and
    // Three lags, which happen to repeat the phrase and would resolve it
    // even with the old, hint-only scan).
    for (const pid of ['integrator', 'secondOrder', 'custom']) {
      for (const cid of ['p', 'lead']) {
        expect(chromeTermIds(defaultState(pid, cid, 'step')), `${pid} x ${cid}`).toContain('minus180')
      }
    }

    // Bare "overshoot NN%" on the Step readout, structurally identical to
    // the already-fixed Kp·e case: it exists or not depending on the loop,
    // and a hand-kept VIEW_CHROME stand-in cannot know which without running
    // the same simulation the pane itself does.
    expect(chromeTermIds(defaultState('firstOrder', 'p', 'step'))).toContain('overshoot')
    expect(chromeTermIds(defaultState('motor', 'pid', 'step'))).toContain('overshoot')
    // A single real pole never overshoots, and the unstable plant's own
    // hint never uses the word either — so its P-controller default (a
    // single real closed-loop pole at Kp = 5) must NOT offer a definition
    // the pane never prints, on the Step view or anywhere else.
    for (const view of views) {
      expect(chromeTermIds(defaultState('unstable', 'p', view)), `unstable x p x ${view}`).not.toContain('overshoot')
    }
  })

  it('derives the list from the cue table, not a hand-kept one', () => {
    // Independently re-scan each view's own static chrome with the SAME
    // table chromeTermIds uses, and require every match to appear in what
    // it offers — this would catch a cue silently dropped from the scan
    // without relying on chromeTermIds' own internals to grade itself.
    for (const [view, text] of Object.entries(VIEW_CHROME)) {
      if (!text) continue
      const ids = chromeTermIds(defaultState('firstOrder', 'p', view))
      for (const [id, re] of Object.entries(CUES)) {
        if (re.test(text)) expect(ids, `${view}: "${id}" cue is in its own chrome`).toContain(id)
      }
    }
  })

  // -------------------------------------------------------------------
  // The adversarial walk's cause, not just its reported instances: the
  // three consequences below all trace back to chromeTermIds building the
  // loop from DEFAULTS instead of the live state — fixed by taking
  // plantP/ctrlP/stepInput/arrival straight from the caller instead of
  // reconstructing them.
  // -------------------------------------------------------------------

  it('consequence 1: a knob dragged past the boundary changes the fold, not just the picker-default gain', () => {
    // Three lags x Proportional at Kp = 1 (the default) settles. The old
    // chromeTermIds rebuilt the loop from ctrlDefaultsFor every time, so
    // dragging Kp to 80 (still inside the slider's own 0.001..1000 range)
    // never changed a single id it offered — the crossing gain here is
    // 11.25 (chrome.test.js's own "the axis" case above), so 80 is well
    // past it.
    const atDefault = defaultState('threePole', 'p', 'step')
    const dragged = { ...atDefault, ctrlP: { ...atDefault.ctrlP, kp: 80 } }

    const idsDefault = chromeTermIds(atDefault)
    const idsDragged = chromeTermIds(dragged)

    expect(idsDefault).not.toContain('runsaway')
    expect(idsDefault).not.toContain('boundary')
    expect(idsDragged, 'past the boundary, the badge reads "closed loop runs away"').toContain('runsaway')
    expect(idsDragged, 'the Bode margin sentence reads "past the boundary"').toContain('boundary')
    expect(idsDragged).not.toEqual(idsDefault)

    // And dragging it back below the boundary restores the original fold —
    // this is not a one-way latch, it tracks the live value both ways.
    const back = { ...atDefault, ctrlP: { ...atDefault.ctrlP, kp: 2 } }
    expect(chromeTermIds(back)).not.toContain('runsaway')
  })

  it('consequence 2, revisited: "disturbance" is a top-bar term now, not a toggle-gated one', () => {
    // App.jsx's Step h2 reads "Response to a disturbance at the plant
    // input" only when stepInput === 'dist' — a heading chromeTermIds used
    // to have no parameter to even ask about, so round three made
    // "disturbance" fire only once that heading was on screen. Round four's
    // title-attribute scan (verify.mjs) found the SAME word sitting in the
    // topbar's own "⧉ diagram" button tooltip ("...the summing junction,
    // where the disturbance gets in..."), unconditionally, on every state —
    // that button lives in `.topbar` itself, on screen under every lesson
    // and every picker state alike, TOPBAR_TERMS's own definition. So
    // "disturbance" joined TOPBAR_TERMS (terms.js), and is offered on every
    // state below regardless of the toggle; the heading's own
    // toggle-dependent contribution still fires too, just no longer alone.
    for (const pid of plantIds) {
      for (const cid of ctrlIds) {
        const ref = defaultState(pid, cid, 'step')
        const dist = { ...ref, stepInput: 'dist' }
        expect(chromeTermIds(ref), `${pid} x ${cid} x step x ref`).toContain('disturbance')
        expect(chromeTermIds(dist), `${pid} x ${cid} x step x dist`).toContain('disturbance')
      }
    }
    // Off the step view it is still there, toggle or not — TOPBAR_TERMS
    // does not care which lower view is open.
    for (const view of ['watch', 'nyquist', 'locus', 'math']) {
      const dist = defaultState('firstOrder', 'p', view, { stepInput: 'dist' })
      expect(chromeTermIds(dist), view).toContain('disturbance')
    }
  })

  it('consequence 3: the arrival banner changes the fold when a hand-over link is live and the loop is stable', () => {
    // #plant=integrator:1&ctrl=lead:1:1:10&from=circuit:xyz — an integrator
    // plant under a lead controller settles with zero steady error, so the
    // banner reads "with an integrator in the loop the error is erased
    // exactly". Chosen originally because neither the Integrator plant's
    // hint nor the Lead controller's hint contains the bare word
    // "integrator" — but the PLANT's own NAME does, and it sits in the
    // topbar's flow strip ("Lead C(s) → Integrator P(s)") on screen
    // regardless of arrival, a gap chromeTermIds now closes by scanning
    // plant.name/ctrl.name alongside their hints (round four). That makes
    // "integrator" unconditionally offered for this plant, arrival or not,
    // so this combo can no longer isolate the arrival gate's OWN
    // contribution — what it still proves is that the banner keeps
    // supplying "integrator" when it fires, and the STABLE half of the
    // gate is isolated cleanly below, on a plant whose name carries no cue
    // word at all.
    const noLink = defaultState('integrator', 'lead', 'step')
    const linked = { ...noLink, arrival: true }
    expect(PLANTS.integrator.hint).not.toMatch(/\bintegrators?\b/i)
    expect(CONTROLLERS.lead.hint).not.toMatch(/\bintegrators?\b/i)
    expect(chromeTermIds(noLink), "the plant's own name already supplies it").toContain('integrator')
    expect(chromeTermIds(linked), 'arrival true and stable: the banner names it too').toContain('integrator')

    // The banner is gone the moment the live loop stops being stable — the
    // same `stable` gate App.jsx's own JSX uses — so a dragged gain that
    // tips it unstable must drop the cue again even with arrival still true.
    // Unstable plant x Lead: neither the plant's NAME nor either hint
    // contains "integrator" (unlike the Integrator plant above), so this
    // isolates the stable/unstable half of the gate cleanly. k = 0.1 sits
    // well under the 5 the plant's own ctrlDefaults opens with, and "too
    // little gain" is this plant's failure mode (its hint), so the loop is
    // genuinely unstable there.
    const unstablePlantP = defaultsOf(PLANTS.unstable)
    const unstable = {
      ...linked,
      plantId: 'unstable',
      ctrlId: 'lead',
      plantP: unstablePlantP,
      ctrlP: { ...ctrlDefaultsFor('unstable', unstablePlantP, 'lead'), k: 0.1 },
    }
    expect(PLANTS.unstable.name).not.toMatch(/\bintegrators?\b/i)
    expect(CONTROLLERS.lead.hint).not.toMatch(/\bintegrators?\b/i)
    expect(verdictOfLoop(unstable)).not.toBe('stable')
    expect(chromeTermIds(unstable)).not.toContain('integrator')
  })

  it('the section-header definitions (item 3) are reachable on every state, no lesson loaded', () => {
    // PLANT_DEF/CONTROLLER_DEF render unconditionally under App.jsx's
    // #plant/#controller headers, so every one of their own cue words (and
    // SECTION_TERMS itself) must resolve at every state — not just the ones
    // where a plant or controller hint happens to repeat the same word.
    for (const id of SECTION_TERMS) expect(TERMS[id], id).toBeTruthy()
    for (const pid of plantIds) {
      for (const cid of ctrlIds) {
        for (const view of views) {
          const ids = chromeTermIds(defaultState(pid, cid, view))
          for (const id of SECTION_TERMS) {
            expect(ids, `${pid} x ${cid} x ${view}: missing section term "${id}"`).toContain(id)
          }
        }
      }
    }
    // And every cue PLANT_DEF/CONTROLLER_DEF themselves contain (drive,
    // already a term before this) resolves too — the same "derives from the
    // cue table" discipline the VIEW_CHROME test above holds this file to.
    const text = `${PLANT_DEF} ${CONTROLLER_DEF}`
    const ids = chromeTermIds(defaultState('firstOrder', 'p', 'step'))
    for (const [id, re] of Object.entries(CUES)) {
      if (re.test(text)) expect(ids, `section defs: "${id}" cue`).toContain(id)
    }
  })

  it('the "This is also a circuit" spot: a refusal\'s cue words resolve exactly where App.jsx renders them', () => {
    // App.jsx's own gate at that spot is `!circuit && plant.circuitNote`
    // (round three: the four plants with no catalog match rendered nothing
    // there at all). chromeTermIds must scan the SAME text — unconditional
    // of view, the way App.jsx renders it — or a cue word in a refusal goes
    // unscanned exactly the way the marginNote defect once did.
    for (const pid of ['integrator', 'motor', 'threePole', 'unstable', 'custom']) {
      const note = PLANTS[pid].circuitNote
      expect(note, pid).toBeTruthy()
      for (const view of views) {
        const ids = chromeTermIds(defaultState(pid, 'p', view))
        for (const [id, re] of Object.entries(CUES)) {
          if (re.test(note)) expect(ids, `${pid} x ${view}: "${id}" cue in its own circuitNote`).toContain(id)
        }
      }
    }
    // The two plants that DO get a live link never carry a circuitNote, so
    // there is nothing for this spot to scan beyond the ordinary hint text.
    for (const pid of ['firstOrder', 'secondOrder']) {
      expect(PLANTS[pid].circuitNote, pid).toBeUndefined()
    }
  })

  it('paneHeading matches App.jsx verbatim for every view x stepInput', () => {
    expect(paneHeading('step', 'ref')).toBe('Closed-loop step response')
    expect(paneHeading('step', 'dist')).toBe('Response to a disturbance at the plant input')
    expect(paneHeading('watch', 'ref')).toBe('The loop closing the gap, watched')
    expect(paneHeading('watch', 'dist')).toBe('The loop fighting a shove, watched')
    expect(paneHeading('nyquist', 'ref')).toBe('Nyquist — the loop against −1')
    expect(paneHeading('math', 'ref')).toBe('The math — theory against what this loop measures')
    expect(paneHeading('locus', 'ref')).toBe('Root locus — the closed-loop poles, as the gain K sweeps')
  })
})
