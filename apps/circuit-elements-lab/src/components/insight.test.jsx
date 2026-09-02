import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { equations, normalize } from '@ee-labs/network'
import App from '../App.jsx'
import { EquationsPane } from './panes.jsx'
import { Bridge, EquivalentPane, Headline, Readings, TheoremBlock } from './insight.jsx'
import { EXPERIMENTS, byId, defaultsOf, drawables } from '../experiments.js'
import { analyse } from '../math.js'
import { num } from '../format.js'
import { bridgeText, headlineValue, tagLatex } from '../headlines.js'
import { Formula } from '@ee-labs/explain'

// The headline, the bridge and the theorem drawings are what a student meets
// before the solver's working. These tests read the rendered markup: the
// number on the page is the number in the analysis, the first thing in the
// Analysis pane is the headline, and the working is folded away for the
// early groups.

const html = (el) => renderToStaticMarkup(el)
const strip = (s) =>
  s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
const solve = (id, over = {}) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  const x = analyse(exp, p)
  return { exp, p, x, elements: drawables(x.net) }
}

describe('the headline', () => {
  it('prints the tag, an equals sign and the same value the analysis reads, for every experiment', () => {
    for (const exp of EXPERIMENTS) {
      const { p, x } = solve(exp.id)
      const h = html(<Headline exp={exp} x={x} params={p} />)
      const value = headlineValue(exp.headline, x, p)
      expect(h.startsWith('<div class="headline" data-role="headline">'), exp.id).toBe(value !== null)
      expect(strip(h)).toContain(exp.headline.label)
      // The tag is set as maths, so v_out reads with a real subscript.
      expect(h).toContain(`<b class="headline-tag">${html(<Formula display={false}>{tagLatex(exp.headline.tag)}</Formula>)}</b>`)
      expect(html(<Formula display={false}>{tagLatex(exp.headline.tag)}</Formula>)).not.toContain('<code>')
      if (value !== null) expect(h, exp.id).toContain(`<span class="headline-eq">=</span><strong>${value}</strong>`)
    }
  })

  it('E3 at the defaults refuses in amber and says why; with finite gain it reads A·V₁', () => {
    const ideal = solve('e3')
    const h = html(<Headline exp={ideal.exp} x={ideal.x} params={ideal.p} />)
    expect(h).toContain('class="headline is-refused"')
    expect(strip(h)).toContain('no value')
    expect(strip(h)).toContain(byId.e3.headline.refused)
    const fin = solve('e3', { ideal: false })
    const g = html(<Headline exp={fin.exp} x={fin.x} params={fin.p} />)
    expect(g).not.toContain('is-refused')
    expect(strip(g)).toContain(num(fin.p.A * fin.p.E, 'V', 3))
  })

  it('the bridge is one paragraph: the view’s lead and the lesson’s first sentence', () => {
    for (const exp of EXPERIMENTS) {
      for (const view of exp.views) {
        const h = html(<Bridge exp={exp} view={view} />)
        expect(h.startsWith('<p class="bridge" data-role="bridge">')).toBe(true)
        expect(strip(h)).toBe(bridgeText(exp, view))
      }
    }
  })
})

describe('the readings table', () => {
  it('lists every drawn element’s voltage and current, power only once asked, then the node voltages', () => {
    const { x, elements } = solve('b1')
    const bare = html(<Readings x={x} elements={elements} power={false} />)
    const withP = html(<Readings x={x} elements={elements} power />)
    const text = strip(bare)
    for (const e of elements) {
      expect(text).toContain(e.id)
      expect(text).toContain(num(x.sol.volt[e.id], 'V', 3))
      expect(text).toContain(num(x.sol.i[e.id], 'A', 3))
    }
    expect((bare.match(/<th/g) || []).length).toBeLessThan((withP.match(/<th/g) || []).length)
    for (const e of elements) expect(strip(withP)).toContain(num(x.sol.p[e.id], 'W', 3))
    for (const n of Object.keys(x.sol.v)) if (n !== 'gnd') expect(text).toContain(num(x.sol.v[n], 'V', 3))
  })
})

describe('the theorem drawings on the page', () => {
  const block = (id, over = {}) => {
    const { exp, p, x, elements } = solve(id, over)
    return { exp, p, x, h: html(<TheoremBlock exp={exp} x={x} params={p} elements={elements} layout={exp.layout} />) }
  }

  it('B2 shows the loop’s three voltages and that they add to zero', () => {
    const { x, h } = block('b2')
    expect(h).toContain('data-role="kvl"')
    const text = strip(h)
    for (const id of ['V1', 'R1', 'R2']) expect(text).toContain(num(Math.abs(x.sol.volt[id]), 'V', 3))
    expect(text).toMatch(/adds to\s*0/)
  })

  it('D3 shows two mesh rows with both sides read live and equal', () => {
    const { p, h } = block('d3')
    expect(h).toContain('data-role="mesh"')
    const text = strip(h)
    expect(text).toContain(num(p.E1, 'V', 3))
    expect(text).toContain(num(-p.E2, 'V', 3))
  })

  it('D4 draws one schematic per source with the other dead, then the whole', () => {
    const { h } = block('d4')
    expect(h).toContain('data-role="parts"')
    expect((h.match(/<figure/g) || []).length).toBe(3)
    for (const cap of ['V1 alone', 'I1 alone', 'both together']) expect(strip(h)).toContain(cap)
    // The dead sources are drawn as switches, labelled with what they became.
    expect(strip(h)).toContain('I1 → 0 A')
    expect(strip(h)).toContain('V1 → 0 V')
  })

  it('E3 shows the contradiction only while the op-amp is ideal', () => {
    expect(block('e3').h).toContain('data-role="contradiction"')
    expect(block('e3', { ideal: false }).h).toBe('')
  })

  it('H5 draws the triangle with P, Q and |S| labelled and p(t) with its mean', () => {
    const { h } = block('h5')
    expect(h).toContain('data-role="triangle"')
    for (const cls of ['tri-p', 'tri-q', 'tri-s', 'tri-mean', 'tri-trace']) expect(h).toContain(`class="${cls}"`)
  })

  it('D5’s equivalent pane draws V_th behind R_th with the open-port reading, beside the load line', () => {
    const { exp, x } = solve('d5')
    const h = html(<EquivalentPane x={x} exp={exp} />)
    expect(h).toContain('data-role="equivalent"')
    const text = strip(h)
    expect(text).toContain(num(x.thevenin.voc, 'V', 3))
    expect(text).toContain(num(x.thevenin.rth.test, 'Ω', 3))
    expect((h.match(/class="tri-dot"/g) || []).length).toBe(x.thevenin.points.length)
  })
})

describe('the equations pane, folded and marked', () => {
  const eqOf = (id, over) => {
    const { x } = solve(id, over)
    return x.sol ? equations(x.sol.norm, x.sol) : equations(normalize(x.net))
  }

  it('folds the working under a summary when asked, open otherwise', () => {
    const eq = eqOf('a1')
    const folded = html(<EquationsPane eq={eq} solved fold />)
    const open = html(<EquationsPane eq={eq} solved />)
    expect(folded).toContain('<details class="eq-fold" data-role="eq-fold">')
    expect(strip(folded)).toContain('The solver’s own working — 2 equations in 2 unknowns')
    expect(open).not.toContain('data-role="eq-fold"')
    expect(open).not.toContain('<summary')
  })

  it('the brief primer is one line naming KCL and KVL; the full primer is the three-law card', () => {
    const eq = eqOf('a1')
    const brief = html(<EquationsPane eq={eq} solved primer="brief" />)
    const full = html(<EquationsPane eq={eq} solved primer="full" />)
    expect(brief).toContain('class="eq-primer eq-primer-line" data-role="primer"')
    expect(strip(brief)).toContain('KCL')
    expect(strip(brief)).toContain('KVL')
    expect(full).toContain('data-role="primer"')
    expect(full).not.toContain('eq-primer-line')
    expect(strip(full)).toContain('Ohm’s law')
  })

  // A1's first screen: Ohm's law is the one law its circuit needs. The primer
  // says it, explains the KCL row's name in a clause, and leaves KVL for B.
  it('the Ohm primer (A1) is one line built on Ohm’s law, and does not name KVL', () => {
    const ohm = strip(html(<EquationsPane eq={eqOf('a1')} solved primer="ohm" />))
    expect(ohm).toContain('Ohm’s law builds the resistor’s row')
    expect(ohm).toContain('Group B')
    expect(ohm).not.toContain('KVL')
  })

  it('E3 ideal marks the two contradicting rows, and no row is marked once the gain is finite', () => {
    const eq = eqOf('e3')
    const marked = html(<EquationsPane eq={eq} solved={false} fold contradiction={['V1', 'U1']} />)
    expect((marked.match(/eq-row is-contradiction/g) || []).length).toBe(2)
    // The marked rows are the point, so the fold opens to show them.
    expect(marked).toContain('<details class="eq-fold" data-role="eq-fold" open="">')
    const fin = html(<EquationsPane eq={eqOf('e3', { ideal: false })} solved />)
    expect(fin).not.toContain('is-contradiction')
  })
})

describe('the analysis pane, assembled', () => {
  it('opens on the first experiment with the headline first, then the bridge, then the readings', () => {
    const h = html(<App />)
    const first = EXPERIMENTS[0]
    expect(first.view).toBe('reading')
    const headline = h.indexOf('data-role="headline"')
    expect(headline).toBeGreaterThan(-1)
    // Nothing sits between the pane's body and the headline: it is the first child.
    const open = '<div class="view-body">'
    expect(h.slice(h.lastIndexOf(open, headline) + open.length, headline)).toBe('<div class="headline" ')
    const bridge = h.indexOf('data-role="bridge"')
    const readings = h.indexOf('data-role="readings"')
    expect(bridge).toBeGreaterThan(headline)
    expect(readings).toBeGreaterThan(bridge)
    // Its callout is on the schematic, reading the same number.
    const { p, x } = solve(first.id)
    expect(h).toContain(`class="sch-note sch-callout"`)
    expect(strip(h)).toContain(`${first.headline.tag} = ${headlineValue(first.headline, x, p)}`)
  })

})

describe('the readings table snaps noise', () => {
  it('E2 prints a power of a few femtowatts as 0 W, as the schematic’s meters would', () => {
    const { exp, x, elements } = solve('e2')
    const h = html(<Readings x={x} elements={elements} power />)
    expect(strip(h)).not.toMatch(/\d\s?f[VAW]\b/)
    const tiny = elements.filter((e) => Math.abs(x.sol.p[e.id]) < 1e-9 * Math.max(...elements.map((f) => Math.abs(x.sol.p[f.id]))))
    expect(tiny.length, `${exp.id} has a noise-level power to snap`).toBeGreaterThan(0)
    expect(strip(h)).toContain('0 W')
  })
})

describe('the tag as maths', () => {
  it('turns the lab’s tags into KaTeX with real subscripts and Greek', () => {
    expect(tagLatex('v_out')).toBe('v_{\\mathrm{out}}')
    expect(tagLatex('R_th')).toBe('R_{\\mathrm{th}}')
    expect(tagLatex('v_R1')).toBe('v_{R_{1}}')
    expect(tagLatex('i₁')).toBe('i_{1}')
    expect(tagLatex('ω₀')).toBe('\\omega _{0}')
    expect(tagLatex('ω_d')).toBe('\\omega _{d}')
    expect(tagLatex('v_C(0⁺)')).toBe('v_{C}(0^{+})')
    expect(tagLatex('|V_C|')).toBe('|V_{C}|')
    expect(tagLatex('1/α')).toBe('1/\\alpha')
    expect(tagLatex('τ')).toBe('\\tau')
    expect(tagLatex('i')).toBe('i')
  })
})
