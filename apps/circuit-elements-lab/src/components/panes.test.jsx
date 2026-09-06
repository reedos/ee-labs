import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { equations } from '@ee-labs/network'
import { fmt } from '@ee-labs/ui'
import { EquationsPane, PowerPane, StatePane } from './panes.jsx'
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
// Rows carry data-node / data-el so the schematic can light what a row is about (Phase 8).
const rowsOf = (h) => [...h.matchAll(/<div class="eq-row"(?: data-(?:node|el)="[^"]*")?>([\s\S]*?)<\/div><\/div>/g)].map((m) => m[1])
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

describe('the state pane: printed relationships are the reader’s own arithmetic', () => {
  // rate()/rateAt() spell a rate's prefix on the TIME UNIT it divides by, not
  // on the numerator ("0.25 ms⁻¹" is 0.25 per millisecond, i.e. 250 per
  // second) — see format.js. So recovering the base per-second value from the
  // printed text means DIVIDING by the prefix's ordinary multiplier, not
  // multiplying by it.
  // The prefix sits on the TIME UNIT: 'ms⁻¹' before the 's⁻¹', but 'rad/ms'
  // AFTER the slash — 'rad/s' is one named unit, and its per-time notation
  // rewrites the 's' that already sits inside it.
  const RATE_S = /^(-?\d+(?:\.\d+)?)\s*([pnµmkMGT]?)s⁻¹$/
  const RATE_RAD = /^(-?\d+(?:\.\d+)?)\s*rad\/([pnµmkMGT]?)s$/
  // num()/fmt() spell an ordinary quantity's prefix the usual way (numerator).
  const TIME_RE = /^(-?\d+(?:\.\d+)?)\s*([pnµmkMGT]?)s$/
  const PRE = { '': 1, p: 1e-12, n: 1e-9, 'µ': 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9, T: 1e12 }
  const rateToBase = (text) => {
    const t = text.trim()
    const m = RATE_S.exec(t) || RATE_RAD.exec(t)
    return m ? Number(m[1]) / PRE[m[2]] : null
  }
  const timeToBase = (text) => {
    const m = TIME_RE.exec(text.trim())
    return m ? Number(m[1]) * PRE[m[2]] : null
  }
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  /** The `<td class="num">` text of the row whose first cell is exactly `label`. */
  const cell = (h, label) => {
    const m = new RegExp(`<td>${esc(label)}</td><td class="num">([^<]*)</td>`).exec(h)
    return m ? m[1] : null
  }
  // Each side of a relationship is independently rounded to 4 significant
  // figures before it is printed, so their ratio or difference cannot match
  // to more than roughly that precision. `toBeCloseTo`'s fixed decimal count
  // is the wrong tool once ω_d runs into four digits before the point; a
  // relative tolerance is what "to within display precision" means here.
  const closeRel = (actual, expected, tol, msg) => {
    expect(Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-12), msg).toBeLessThan(tol)
  }

  it('for every experiment with a State-equation pane, ζ, Q and (τ or the roots) are what a reader gets by dividing the printed numbers, not just the raw ones', () => {
    let n1 = 0
    let n2 = 0
    for (const exp of EXPERIMENTS) {
      if (!exp.views.includes('state')) continue
      const x = analyse(exp, defaultsOf(exp.id))
      if (!x.tr || !x.state) continue
      const s = x.state
      const h = html(<StatePane x={x} />)
      if (s.n === 1) {
        n1++
        const tauTxt = cell(h, 'τ = −1/A₁₁')
        const rootTxt = cell(h, 'root s')
        expect(tauTxt, exp.id).not.toBeNull()
        expect(rootTxt, exp.id).not.toBeNull()
        if (s.tau === Infinity) continue // a pure integrator has no τ to check against its root
        const tau = timeToBase(tauTxt)
        const root = rateToBase(rootTxt)
        expect(tau, `${exp.id} τ "${tauTxt}" did not parse as a time`).not.toBeNull()
        expect(root, `${exp.id} root "${rootTxt}" did not parse as a rate`).not.toBeNull()
        // τ = −1/A₁₁ = −1/root, read off the two printed numbers.
        closeRel(tau, -1 / root, 2e-3, `${exp.id}: printed τ "${tauTxt}" is not −1/(printed root) "${rootTxt}"`)
      } else if (s.n === 2) {
        n2++
        const alphaTxt = cell(h, 'α (neper frequency)')
        const w0Txt = cell(h, 'ω₀ (undamped natural)')
        const wdTxt = cell(h, 'ω_d = √(ω₀² − α²)')
        const zetaTxt = cell(h, 'ζ = α/ω₀')
        const qTxt = cell(h, 'Q = ω₀/2α')
        for (const [label, t] of [['α', alphaTxt], ['ω₀', w0Txt], ['ω_d', wdTxt], ['ζ', zetaTxt], ['Q', qTxt]]) {
          expect(t, `${exp.id} ${label} row`).not.toBeNull()
        }
        const alpha = rateToBase(alphaTxt)
        const w0 = rateToBase(w0Txt)
        const wd = rateToBase(wdTxt)
        const zeta = Number(zetaTxt)
        const Q = qTxt === '∞' ? Infinity : Number(qTxt)
        expect(alpha, `${exp.id} α "${alphaTxt}"`).not.toBeNull()
        expect(w0, `${exp.id} ω₀ "${w0Txt}"`).not.toBeNull()
        expect(wd, `${exp.id} ω_d "${wdTxt}"`).not.toBeNull()
        // ζ = α/ω₀, Q = ω₀/2α and ω_d = √(ω₀² − α²), each from the PRINTED
        // α, ω₀ and ω_d — the whole point of a shared scale.
        closeRel(zeta, alpha / w0, 5e-3, `${exp.id}: printed ζ "${zetaTxt}" ≠ printed α "${alphaTxt}" / printed ω₀ "${w0Txt}"`)
        if (Number.isFinite(Q)) closeRel(Q, w0 / (2 * alpha), 5e-3, `${exp.id}: printed Q "${qTxt}" ≠ printed ω₀ / (2 × printed α)`)
        closeRel(wd, Math.sqrt(Math.max(0, w0 * w0 - alpha * alpha)), 5e-3, `${exp.id}: printed ω_d "${wdTxt}" ≠ √(printed ω₀² − printed α²)`)
      }
    }
    expect(n1, 'first-order experiments checked').toBeGreaterThan(0)
    expect(n2, 'second-order experiments checked').toBeGreaterThan(0)
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
