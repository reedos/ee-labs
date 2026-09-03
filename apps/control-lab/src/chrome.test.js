import { describe, it, expect } from 'vitest'
import { PLANTS, CONTROLLERS } from './systems.js'
import { CUES, TOPBAR_TERMS } from './terms.js'
import { chromeTermIds, chromeTerms, VIEW_CHROME } from './chrome.js'

// Definitions on contact in the PICKER: a plant or controller click clears
// the lesson (App.jsx's clearLesson), and before this there was nowhere left
// to look up phase margin, gain margin, "-1", the shaded half, or the
// characteristic equation once that happened. chromeTermIds derives its
// list from the SAME cue table (terms.js's CUES) that terms.scan.test.js
// already scans a lesson's note against, applied to what the picker itself
// shows instead — the current plant's hint, the current controller's hint,
// and the lower view's own static chrome (VIEW_CHROME, copied verbatim from
// what App.jsx renders there).

const plantIds = Object.keys(PLANTS)
const ctrlIds = Object.keys(CONTROLLERS)
const views = ['step', 'watch', 'nyquist', 'locus', 'math']

describe('picker terms: reachable with no lesson active', () => {
  it('every one of the 7 x 4 x 5 = 140 states resolves every id it offers, and always offers the top bar', () => {
    expect(plantIds.length).toBe(7)
    expect(ctrlIds.length).toBe(4)
    expect(views.length).toBe(5)
    let states = 0
    for (const pid of plantIds) {
      for (const cid of ctrlIds) {
        for (const view of views) {
          states++
          const ids = chromeTermIds(pid, cid, view)
          const resolved = chromeTerms(pid, cid, view)
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
    const anyState = chromeTermIds('firstOrder', 'p', 'step')
    for (const t of ['phasemargin', 'gainmargin', 'crossover', 'steadystate']) {
      expect(anyState).toContain(t)
    }

    // Nyquist: "-1" is explained by the Nyquist-plot definition itself
    // ("judged against the single point -1"), reached via its own cue.
    expect(chromeTermIds('firstOrder', 'p', 'nyquist')).toContain('nyquistplot')

    // Root locus: "crosses into the shaded half", and open-loop vs
    // closed-loop poles — the readout text that is on screen regardless of
    // any lesson.
    const locus = chromeTermIds('firstOrder', 'p', 'locus')
    expect(locus).toContain('shadedhalf')
    expect(locus).toContain('closedvsopen')

    // Math: the characteristic equation.
    expect(chromeTermIds('firstOrder', 'p', 'math')).toContain('characteristicequation')
  })

  it('derives the list from the cue table, not a hand-kept one', () => {
    // Independently re-scan each view's own static chrome with the SAME
    // table chromeTermIds uses, and require every match to appear in what
    // it offers — this would catch a cue silently dropped from the scan
    // without relying on chromeTermIds' own internals to grade itself.
    for (const [view, text] of Object.entries(VIEW_CHROME)) {
      if (!text) continue
      const ids = chromeTermIds('firstOrder', 'p', view)
      for (const [id, re] of Object.entries(CUES)) {
        if (re.test(text)) expect(ids, `${view}: "${id}" cue is in its own chrome`).toContain(id)
      }
    }
  })
})
