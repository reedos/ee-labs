import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import App from './App.jsx'
import { EXPERIMENTS, byId, defaultsOf } from './experiments.js'
import { analyse } from './math.js'
import { tablePropsFor } from './view.js'

// A passing `vite build` proves only that the modules parse. This mounts the
// real component tree, so a render-phase crash fails here rather than in the
// browser: a bad hook, a field the analysis does not have, a pane fed the wrong
// shape. It is what this lab has instead of a Playwright harness, which the
// plan's §7 asks for at the release gate rather than at this phase.

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(here, 'styles.css'), 'utf8')
const html = (props = {}) => renderToString(React.createElement(App, props)).replace(/<!--\s*-->/g, '')

describe('App', () => {
  it('renders the lab, the first experiment, its note, its knobs and the chain', () => {
    const h = html()
    expect(h).toContain('System Lab')
    expect(h).toContain(EXPERIMENTS[0].name)
    expect(h).toContain('data-role="chain"')
    expect(h).toContain('data-role="budget-table"')
    expect(h).toContain('data-role="headline"')
    expect(h).toContain('report-issue')
    expect(h).toMatch(/<details class="terms[^"]*"><summary>Terms: /)
  })

  it('mounts every experiment in every one of its views, with nothing undefined in it', () => {
    for (const e of EXPERIMENTS) {
      for (const v of e.views) {
        const h = html({ initialId: e.id, initialView: v })
        expect(h, `${e.id} ${v}`).toContain(e.name)
        expect(h, `${e.id} ${v}`).not.toMatch(/undefined|NaN/)
      }
    }
  }, 120000)

  it('draws one chain block per block of the experiment’s own chain', () => {
    for (const e of EXPERIMENTS) {
      const h = html({ initialId: e.id })
      expect([...h.matchAll(/data-block="/g)].length, `${e.id} chain blocks`).toBe(e.chain(Object.fromEntries(e.params.map((k) => [k.key, k.default]))).length)
    }
  })

  it('puts the whole chain’s totals in the table’s last row, in every view that has one', () => {
    for (const e of EXPERIMENTS.filter((x) => x.views.includes('table'))) {
      const h = html({ initialId: e.id, initialView: 'table' })
      for (const col of ['gain', 'nf', 'iip3', 'power']) expect(h, `${e.id} total ${col}`).toContain(`data-cell="total-${col}"`)
    }
  })

  it('never shows the arithmetic’s own residue as a reading', () => {
    // A share that comes out as 4e-17 would print as "40 atto per cent" and a
    // reader would take it for a measurement. `format.js` snaps a value far
    // below its own scale to zero, and this is the check that it does.
    const dust = /[\d.]\s*[fazy](W|Hz|dB|dBm|K)/
    for (const e of EXPERIMENTS) {
      for (const v of e.views) {
        const h = html({ initialId: e.id, initialView: v }).replace(/<[^>]*>/g, ' ')
        expect(h.match(dust)?.[0], `${e.id} ${v}`).toBeFalsy()
      }
    }
  }, 120000)

  it('names both lines of the levels plot, and every column of numbers under it', () => {
    // Two of the three readings are levels in dBm, so a reader cannot tell the
    // signal from the noise by its unit. The key names the lines and the header
    // row names the columns, and a colour alone would name neither.
    for (const e of EXPERIMENTS.filter((x) => x.views.includes('levels'))) {
      const h = html({ initialId: e.id, initialView: 'levels' })
      expect(h, `${e.id} has no key over the levels`).toContain('data-role="level-keys"')
      for (const key of ['signal', 'noise']) expect(h, `${e.id} key for ${key}`).toContain(`data-key="${key}"`)
      for (const key of ['signal', 'noise', 'snr']) expect(h, `${e.id} header for ${key}`).toContain(`data-role="${key}-head"`)
      const stripped = h.replace(/<[^>]*>/g, ' ')
      for (const word of ['Signal, dBm', 'Noise, dBm', 'Ratio, dB']) expect(stripped, `${e.id} does not name ${word}`).toContain(word)
    }
  })

  it('shows the shares closing at 100 % under the column they belong to', () => {
    // The share mode's total row is where invariant 3 becomes something a
    // reader sees. It must not go on printing the cumulative decibels while
    // every cell above it is a percentage.
    const props = tablePropsFor(null, null, analyse(byId.a2, defaultsOf('a2')))
    expect(props.shareTotals.nf).toBe('100.0 %')
    expect(props.shareTotals.iip3).toBe('100.0 %')
    expect(props.shareTotals.power).toBe('100.0 %')
    expect(props.totals.nf, 'the cumulative total is unchanged').toMatch(/dB$/)
  })

  it('gives every table cell the label the phone layout draws in front of it', () => {
    // Below 900 px the table transposes into one card per block, and each cell
    // grows a `::before` carrying its column's name. A cell with no
    // `data-label` would read as a bare number with nothing naming it, which is
    // the plan's §11 risk. The rule and the attribute have to agree.
    expect(css).toMatch(/@media \(max-width: 900px\)/)
    expect(css).toMatch(/\.sys-table td::before\s*\{[^}]*content:\s*attr\(data-label\)/)
    for (const e of EXPERIMENTS.filter((x) => x.views.includes('table'))) {
      const h = html({ initialId: e.id, initialView: 'table' })
      const cells = [...h.matchAll(/<td([^>]*)>/g)]
      expect(cells.length, `${e.id} has no table cells`).toBeGreaterThan(0)
      for (const c of cells) expect(c[1], `${e.id} cell without a label: ${c[1]}`).toMatch(/data-label="/)
    }
  })

  it('never lets a pane widen the page, whatever the chain’s length', () => {
    // `phone-layout` in one line: a grid or flex item sizes from its content
    // unless it is told otherwise, so one long row sets the whole track. Every
    // pane in this lab carries `min-width: 0`, and only the chain strip scrolls
    // inside itself.
    for (const cls of ['.sys-table-pane', '.sys-table-scroll', '.sys-plot', '.chain']) {
      expect(css, `${cls} has no min-width: 0`).toMatch(new RegExp(`\\${cls}\\s*\\{[^}]*min-width:\\s*0`))
    }
    expect([...css.matchAll(/overflow-x:\s*auto/g)].length, 'more panes scroll sideways than the chain and the table').toBe(2)
  })
})
