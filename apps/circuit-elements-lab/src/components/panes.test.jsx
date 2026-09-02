import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { equations } from '@ee-labs/network'
import { fmt } from '@ee-labs/ui'
import { EquationsPane, PowerPane } from './panes.jsx'
import { EXPERIMENTS, byId, defaultsOf } from '../experiments.js'
import { analyse, powerLedger } from '../math.js'

// The panes print numbers next to letters. These tests read the printed
// numbers back out of the markup, so a sign or a unit that is wrong on the
// page is wrong in the suite too — not only in the engine, which is already
// tested, but in what the reader actually sees.

const solve = (id) => {
  const exp = byId[id]
  const x = analyse(exp, defaultsOf(exp.id))
  return { exp, x, eq: equations(x.sol.norm, x.sol) }
}
const html = (el) => renderToStaticMarkup(el)
const strip = (s) => s.replace(/<[^>]+>/g, '')
const rowsOf = (h) => [...h.matchAll(/<div class="eq-row">([\s\S]*?)<\/div><\/div>/g)].map((m) => m[1])
const amber = (row) => [...row.matchAll(/<span class="eq-val">([^<]*)<\/span>/g)].map((m) => m[1])

describe('the equations pane', () => {
  it('prints each KCL term with the sign it adds to the row, so the amber numbers add to the sum shown', () => {
    for (const exp of EXPERIMENTS) {
      const x = analyse(exp, defaultsOf(exp.id))
      if (!x.sol) continue
      const eq = equations(x.sol.norm, x.sol)
      const h = html(<EquationsPane eq={eq} solved />)
      const rows = rowsOf(h)
      const kcl = eq.rows.filter((r) => r.kind === 'kcl')
      expect(rows.length, exp.id).toBe(eq.rows.length)
      kcl.forEach((r, k) => {
        const shown = amber(rows[k])
        expect(shown, `${exp.id} KCL at ${r.node}`).toEqual(r.terms.map((t) => fmt(t.value, 'A', 3)))
        // A term drawn with a minus sign shows the value it adds, not a forced negative.
        for (const t of r.terms) if (t.sign < 0 && t.value > 0) expect(shown).toContain(fmt(t.value, 'A', 3))
      })
    }
  })

  it('a3: the minus in front of i_V1 at ref goes with a positive amber value, and the row says it adds to 0', () => {
    const { eq } = solve('a3')
    const h = html(<EquationsPane eq={eq} solved />)
    const ref = rowsOf(h).find((r) => r.includes('currents leaving node ref'))
    const t = eq.rows.find((r) => r.kind === 'kcl' && r.node === 'ref').terms.find((q) => q.id === 'V1')
    expect(t.sign).toBe(-1)
    expect(t.value).toBeGreaterThan(0)
    expect(amber(ref)).toContain(fmt(t.value, 'A', 3))
    expect(strip(ref)).toContain('adds to 0 A')
  })

  it('shows the primer only when asked, and the three steps and legend always', () => {
    const { eq } = solve('a1')
    const bare = html(<EquationsPane eq={eq} solved />)
    const primed = html(<EquationsPane eq={eq} solved primer />)
    expect(bare).not.toContain('data-role="primer"')
    expect(primed).toContain('data-role="primer"')
    for (const s of ['KCL', 'KVL', 'Ohm’s law']) expect(strip(primed)).toContain(s)
    for (const s of ['1 · The equations.', '2 · The same rows as a matrix.', '3 · What the letters are.', 'In letters']) {
      expect(strip(bare)).toContain(s)
    }
    // The matrix grid has one header per unknown plus the right-hand side, one body row per equation.
    expect((bare.match(/<th>/g) || []).length).toBe(eq.unknowns.length + eq.rows.length)
    // Every letter in the legend names its part and shows its value.
    const legend = bare.slice(bare.indexOf('eq-legend'))
    for (const s of eq.symbolic.symbols) {
      expect(strip(legend)).toContain(s.id)
      expect(strip(legend)).toContain(fmt(s.value, s.what === 'E' ? 'V' : 'Ω', 4))
    }
  })
})

describe('the power pane', () => {
  it('lists every element with v, i and p, names its role, and the two bars carry the same total', () => {
    const { x } = solve('b3')
    const led = powerLedger(x.sol)
    const h = html(<PowerPane sol={x.sol} />)
    const text = strip(h)
    for (const r of led.rows) {
      expect(text).toContain(r.id)
      expect(text).toContain(fmt(r.p, 'W', 3))
      expect(h).toContain(`is-${r.role}`)
    }
    expect(text).toContain(fmt(led.delivered, 'W', 3))
    expect(text).toContain(fmt(led.absorbed, 'W', 3))
    expect(led.absorbed).toBeCloseTo(led.delivered, 9)
  })
})
