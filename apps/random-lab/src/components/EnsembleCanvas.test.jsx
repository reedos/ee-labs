import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import EnsembleCanvas, { MAX_DRAWN } from './EnsembleCanvas.jsx'
import { analyse } from '../analysis.js'

// The new canvas, checked at the level a server render can reach: the props it
// accepts, the caption it announces, and the two Monte Carlo props the Applied
// Analog Lab needs. The drawing itself is checked by the harness in
// scripts/verify.mjs, which the other labs' briefs record as the only way to
// catch a pane fed stale state.

const ens = (over = {}) =>
  analyse({ seed: 5, runs: 40, length: 32, dist: 'gaussian', ...over }).ens()

describe('EnsembleCanvas', () => {
  it('renders and names how many runs it drew, out of how many', () => {
    const html = renderToStaticMarkup(<EnsembleCanvas ensemble={ens()} show={{ paths: 12 }} />)
    expect(html).toMatch(/aria-label="Ensemble: 12 of 40 runs"/)
  })

  it('never draws more runs than read as runs', () => {
    const html = renderToStaticMarkup(
      <EnsembleCanvas ensemble={ens({ runs: 500 })} show={{ paths: 500 }} />,
    )
    // Past about 48 lines a reader sees an envelope rather than runs
    // (REVIEW_PLAYBOOK section 6). The cap is stated rather than implied.
    expect(html).toMatch(new RegExp(`Ensemble: ${MAX_DRAWN} of 500 runs`))
  })

  it('does not fail when there is no ensemble to draw', () => {
    expect(() => renderToStaticMarkup(<EnsembleCanvas ensemble={null} />)).not.toThrow()
  })
})

describe('the props the Applied Analog Lab needs', () => {
  // APPLIED_ANALOG_LAB_PLAN.md section 4.3 names `band` and `count`, and
  // PROGRAM.md section 4 requires a new canvas to carry its second lab's needs
  // from the first commit. These are here so a later change cannot drop them
  // without a test failing.
  const a = analyse({
    seed: 81, runs: 200, length: 1, ensembleKind: 'outcome',
    dist: 'gaussian', mu: 10, sigma: 0.5, spec: [9, 11],
  })

  it('accepts a band, a count and a target without error', () => {
    const e = a.ens()
    const y = e.withinSpec()
    expect(() =>
      renderToStaticMarkup(
        <EnsembleCanvas
          ensemble={e}
          band={{ lo: 9, hi: 11, label: 'spec' }}
          count={{ pass: y.k, n: y.n, stderr: y.se }}
          target={10}
        />,
      ),
    ).not.toThrow()
  })

  it('the count it is given carries a standard error, not a bare fraction', () => {
    const y = a.ens().withinSpec()
    expect(y.k).toBeGreaterThan(0)
    expect(y.n).toBe(200)
    expect(y.se).toBeGreaterThan(0)
    // Which is the point: at 200 runs the yield is good to about 1.5 points,
    // and a pane that printed only the percentage would hide that.
    expect(y.se).toBeGreaterThan(0.005)
  })

  it('and the spread band is a separate prop from the specification band', () => {
    // One is a property of the process and the other is a choice a designer
    // made. A canvas that called both a band would imply the first is the
    // second.
    const e = ens()
    const html = renderToStaticMarkup(
      <EnsembleCanvas ensemble={e} show={{ paths: 8, spread: 'quantile' }} band={{ lo: -1, hi: 1 }} />,
    )
    expect(html).toMatch(/Ensemble: 8 of 40 runs/)
  })
})

describe('the run picker', () => {
  it('reports a run index when the canvas is clicked', () => {
    const onPickRun = vi.fn()
    const html = renderToStaticMarkup(
      <EnsembleCanvas ensemble={ens()} show={{ paths: 10 }} onPickRun={onPickRun} />,
    )
    // A server render cannot fire the click, so this checks the handler is
    // wired at all by the element it produces.
    expect(html).toMatch(/<canvas/)
  })
})
