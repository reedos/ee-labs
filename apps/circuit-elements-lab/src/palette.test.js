import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { COLORS } from '@ee-labs/ui'
import { EXPERIMENTS } from './experiments.js'
import { CSS_VAR, DASH_OF, HUE, SHADES, SHARED, WORD, familyOf, familyOfLabel, shade, styleTraces } from './palette.js'

// One hue per quantity, everywhere (student review, Phase 7). These tests hold
// the palette to that: the hexes the stylesheet paints the meters and readouts
// with are the hexes the canvases draw with, every scope trace in the lab is
// drawn in its family's hue, two traces of one family are never the same
// colour AND dash, and no chart carries a legend or a legend band any more.

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const css = src('./styles.css')

describe('one hue per quantity', () => {
  it('the four families the shared plot palette already had keep its hexes, so this lab and the others agree', () => {
    expect(HUE.voltage).toBe(COLORS.response)
    expect(HUE.current).toBe(COLORS.spectrum)
    expect(HUE.power).toBe(COLORS.trace)
    expect(HUE.angle).toBe(COLORS.phase)
    for (const f of Object.keys(SHARED)) expect(SHARED[f]).toBe(HUE[f])
  })

  it('styles.css publishes each family as a custom property with the same hex the canvases use', () => {
    for (const [family, name] of Object.entries(CSS_VAR)) {
      const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i'))
      expect(m, `${name} defined`).not.toBeNull()
      expect(m[1].toLowerCase()).toBe(HUE[family].toLowerCase())
    }
    // The meters take the hue of what they show; the readouts the hue of what they read.
    expect(css).toMatch(/\.sch-meter\s*\{[^}]*fill:\s*var\(--q-voltage\)/)
    expect(css).toMatch(/\.view-body\[data-show='i'\] text\.sch-meter \{ fill: var\(--q-current\); \}/)
    expect(css).toMatch(/\.view-body\[data-show='p'\] text\.sch-meter \{ fill: var\(--q-power\); \}/)
    for (const family of Object.keys(HUE)) expect(css).toContain(`.readout [data-q='${family}'] b { color: var(--q-${family}); }`)
    // App stamps the mode on the schematic's pane so the stylesheet can read it.
    expect(src('./App.jsx')).toContain('data-show={show}')
  })

  it('every family has a base shade equal to its hue, three distinct shades and a word a caption can use', () => {
    for (const family of Object.keys(HUE)) {
      expect(SHADES[family][0]).toBe(HUE[family])
      expect(new Set(SHADES[family]).size).toBe(3)
      expect(shade(family, 0)).toBe(HUE[family])
      expect(shade(family, 9)).toBe(SHADES[family][2])
      expect(typeof WORD[family]).toBe('string')
    }
  })

  it('a trace’s family follows its quantity, a label’s its name', () => {
    expect(familyOf({ q: 'v', key: 'A' })).toBe('voltage')
    expect(familyOf({ q: 'volt', key: 'C1' })).toBe('voltage')
    expect(familyOf({ q: 'i', key: 'R1' })).toBe('current')
    expect(familyOf({ q: 'p', key: 'R1' })).toBe('power')
    expect(familyOfLabel('v_C')).toBe('voltage')
    expect(familyOfLabel('|H|')).toBe('voltage')
    expect(familyOfLabel('i_L')).toBe('current')
    expect(familyOfLabel('p_R')).toBe('power')
    expect(familyOfLabel('∠Z')).toBe('angle')
    expect(familyOfLabel('overshoot')).toBe('angle')
    expect(familyOfLabel('settles in')).toBe('power')
    expect(familyOfLabel('stored')).toBe('energy')
  })

  it('every scope trace in the lab is drawn in its family’s hue, and no two bright traces of one family share colour and dash', () => {
    let traces = 0
    for (const exp of EXPERIMENTS) {
      if (!exp.scope) continue
      for (const side of [exp.scope.left, exp.scope.right].filter(Boolean)) {
        const styles = styleTraces(side.traces)
        const seen = new Map()
        side.traces.forEach((q, i) => {
          traces++
          const s = styles[i]
          expect(s.family).toBe(familyOf(q))
          expect(SHADES[s.family], `${exp.id} ${q.label} colour`).toContain(s.color)
          if (q.dim) {
            expect(s.alpha).toBeLessThan(1)
            expect(s.dash).toEqual([3, 3])
            return
          }
          const key = `${s.family}|${s.color}|${JSON.stringify(s.dash)}`
          expect(seen.has(key), `${exp.id}: ${q.label} repeats ${seen.get(key)}'s colour and dash`).toBe(false)
          seen.set(key, q.label)
        })
      }
    }
    expect(traces).toBeGreaterThan(40)
  })

  it('the n-th bright trace of a family gets the n-th shade and the n-th dash; a declared dash wins', () => {
    const [a, b, c, d] = styleTraces([
      { q: 'volt', key: 'R1', label: 'v_R' },
      { q: 'volt', key: 'C1', label: 'v_C' },
      { q: 'volt', key: 'L1', label: 'v_L' },
      { q: 'volt', key: 'S1', label: 'v_sw', dash: true },
    ])
    expect([a.color, b.color, c.color]).toEqual(SHADES.voltage)
    expect([a.dash, b.dash, c.dash]).toEqual(DASH_OF)
    expect(d.dash).toEqual([7, 4])
    expect(a.width).toBeGreaterThan(b.width)
  })

  it('no chart carries a legend or reserves a band for one: the series are named where they leave the frame', () => {
    const dir = fileURLToPath(new URL('./components/', import.meta.url))
    const canvases = readdirSync(dir).filter((f) => /Canvas\.jsx$/.test(f) || f === 'timePlot.js')
    expect(canvases.length).toBeGreaterThanOrEqual(7)
    for (const f of canvases) {
      const s = readFileSync(`${dir}${f}`, 'utf8')
      expect(s, `${f} legend`).not.toMatch(/drawLegend|LEFT_COLORS|RIGHT_COLORS/)
      expect(s, `${f} topInset`).not.toContain('topInset')
      if (/Canvas\.jsx$/.test(f)) {
        expect(s, `${f} tracks its text`).toContain('trackText(ctx)')
        expect(s, `${f} names its series`).toContain('drawEndLabels(')
      }
    }
    // The shared plot helper keeps its colour constants; this lab reads them through palette.js only.
    for (const f of canvases.filter((f) => f !== 'timePlot.js')) {
      const s = readFileSync(`${dir}${f}`, 'utf8')
      expect(s, `${f} draws series in palette hues`).not.toMatch(/COLORS\.(response|spectrum|phase)\b/)
    }
  })
})
