import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COLORS } from '@ee-labs/ui'
import App from './App.jsx'
import { EXPERIMENTS } from './experiments.js'

// A passing `vite build` proves only that the modules parse. This mounts the
// real component tree, so a render-phase crash — a bad hook, a field the
// analysis does not have, a pane fed the wrong shape — fails here rather than
// in the browser. It is what this lab has instead of a Playwright harness.
//
// The last two checks are for the failures a render test alone does not see.
// A canvas asks the shared palette for a colour by name, and a name it does
// not have comes back undefined; the 2D context then silently keeps the last
// colour it was given, so a plot draws in the wrong hue and nothing throws.
// And `.num` belongs to the shared NumField, where it is a block, so the
// table cells that borrow the name need the reset Power Lab's stylesheet
// found necessary.

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(join(here, p), 'utf8')
const html = (props = {}) => renderToString(React.createElement(App, props)).replace(/<!--\s*-->/g, '')

describe('App', () => {
  it('renders the first experiment, its note, its knobs and both panes', () => {
    const h = html()
    expect(h).toContain('Energy Lab')
    expect(h).toContain('A diode in the light')
    // Two panes: the picture above, the analysis below.
    expect(h).toContain('One cell')
    expect(h).toContain('Analysis')
    expect(h).toContain('report-issue')
    expect(h).toMatch(/<details class="terms[^"]*"><summary>Terms: /)
  })

  it('puts the cell’s own figures in the top bar', () => {
    const h = html()
    expect(h).toMatch(/632\.94 mV|0\.63294 V/)
    expect(h).toMatch(/5\.0000 A/)
  })

  it('mounts every experiment in every one of its views, with nothing undefined in it', () => {
    for (const e of EXPERIMENTS) {
      for (const v of e.views) {
        const h = html({ initialId: e.id, initialView: v })
        expect(h, `${e.id} ${v}`).toContain(e.name)
        expect(h, `${e.id} ${v}`).not.toMatch(/undefined|NaN/)
      }
    }
  }, 300000)

  it('gives the battery experiments a cursor, and no other experiment one', () => {
    for (const e of EXPERIMENTS) {
      const h = html({ initialId: e.id })
      expect(h.includes('data-role="cursor"'), `${e.id} cursor`).toBe(e.kind === 'battery')
    }
  }, 120000)

  it('never shows the arithmetic’s own residue as a reading', () => {
    // An energy that is zero comes back from exact integration as ~1e-16, and
    // the formatter would render it "0.68 fJ" — a number that reads like a
    // measurement. Nothing in this lab is legitimately femto-anything.
    const dust = /[\d.]\s*[fazy](V|A|W|C|Hz|s|J)/
    for (const e of EXPERIMENTS) {
      const h = html({ initialId: e.id })
      const hit = h.replace(/<[^>]*>/g, ' ').match(dust)
      expect(hit && hit[0], e.id).toBeFalsy()
    }
  }, 120000)

  it('asks the shared palette only for colours it has', () => {
    const dir = join(here, 'components')
    let asked = 0
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.jsx'))) {
      for (const m of read(join('components', f)).matchAll(/COLORS\.(\w+)/g)) {
        expect(COLORS[m[1]], `${f} asks for COLORS.${m[1]}`).toBeTruthy()
        asked++
      }
    }
    expect(asked).toBeGreaterThan(10)
  })

  it('resets the shared .num block rule on the table cells that borrow the name', () => {
    const css = read('styles.css')
    const base = readFileSync(join(here, '..', '..', '..', 'packages', 'ui', 'src', 'base.css'), 'utf8')
    expect(base, 'the shared rule this defends against').toMatch(/\.num\s*\{[^}]*display:\s*block/)
    expect(css).toMatch(/\.table td\.num[^{]*\{[^}]*display:\s*table-cell/)
    expect(css).toMatch(/\.table td\.num[^{]*\{[^}]*margin:\s*0/)
    // And the name is used only where that reset applies.
    for (const f of ['App.jsx', 'components/panes.jsx']) {
      for (const m of read(f).matchAll(/<(\w+)[^>]*className="num"/g)) {
        expect(['td', 'th'], `${f}: <${m[1]} className="num">`).toContain(m[1])
      }
    }
  })
})
