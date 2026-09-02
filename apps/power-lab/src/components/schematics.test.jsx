import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import Schematic, { topologyOf, TOPOLOGIES } from './schematics.jsx'
import { EXPERIMENTS, byId, defaultsOf } from '../experiments.js'
import { analyse } from '../analysis.js'
import { rectifier, converter } from '@ee-labs/switched'
import { TRACES } from '../experiments.js'
import { TRACE_COLORS } from './ScopeCanvas.jsx'
import { ORDER } from './panes.jsx'
import { signalsOf } from './schematics.jsx'

// The drawings are hand-laid-out, so what a test can hold is the two things
// that go wrong when they are: a picture that stops matching the circuit the
// engine is solving, and a label that runs off the edge of the frame.

const svgFor = (id, over = {}) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return renderToStaticMarkup(<Schematic exp={exp} x={analyse(exp, p)} />)
}

/** Every symbol kind, counted by the marks only it draws. */
const counts = (svg) => ({
  // A diode is a triangle plus its bar; a triac has two triangles.
  diodes: (svg.match(/points="-5,-7 -5,7 5,0"/g) || []).length,
  switches: (svg.match(/x1="-9" y1="0" x2="9" y2="-10"/g) || []).length,
  triacs: (svg.match(/points="-11,-8 -11,8 0,0"/g) || []).length,
  inductors: (svg.match(/stroke="var\(--blue\)"/g) || []).length,
  caps: (svg.match(/<g stroke="var\(--amber\)"/g) || []).length,
  resistors: (svg.match(/stroke="var\(--accent\)"/g) || []).length,
  acSources: (svg.match(/A 3\.5 3\.5 0 0 1/g) || []).length,
})

describe('every experiment', () => {
  it('has a schematic', () => {
    for (const e of EXPERIMENTS) {
      expect(TOPOLOGIES, e.id).toContain(topologyOf(e))
      expect(svgFor(e.id), e.id).toContain('<svg')
    }
  })

  it('draws it with the values the engine was given, not the knobs it was shown', () => {
    // c2 leaves the capacitor off its knob list, so C comes from the defaults;
    // the drawing has to show what the converter actually ran with.
    const x = analyse(byId.c2, defaultsOf('c2'))
    expect(x.p.C).toBe(100e-6)
    expect(svgFor('c2')).toContain('100 µF')
  })

  it('redraws when a knob moves', () => {
    expect(svgFor('b2')).toContain('100 µH')
    expect(svgFor('b2', { L: 470e-6 })).toContain('470 µH')
    expect(svgFor('e1')).toContain('1 mF')
    expect(svgFor('e1', { C: 220e-6 })).toContain('220 µF')
  })

  it('keeps every mark and label inside the frame', () => {
    for (const e of EXPERIMENTS) {
      const svg = svgFor(e.id)
      const [, w, h] = svg.match(/viewBox="0 0 (\d+) (\d+)"/).map(Number)
      // Text extents, estimated from the font sizes the stylesheet sets.
      for (const m of svg.matchAll(/<text class="([\w-]+)" x="([\d.-]+)" y="([\d.-]+)"(?: text-anchor="(\w+)")?[^>]*>([^<]*)</g)) {
        const [, cls, xs, ys, anchor, text] = m
        const size = cls === 'sch-port' ? 10 : cls === 'sch-sign' ? 11 : 9
        const width = text.length * size * 0.58
        const x = Number(xs)
        const lo = anchor === 'end' ? x - width : anchor === 'start' ? x : x - width / 2
        expect(lo, `${e.id}: "${text}" left edge`).toBeGreaterThanOrEqual(-1)
        expect(lo + width, `${e.id}: "${text}" right edge`).toBeLessThanOrEqual(w + 1)
        expect(Number(ys), `${e.id}: "${text}" baseline`).toBeLessThanOrEqual(h)
        expect(Number(ys), `${e.id}: "${text}" baseline`).toBeGreaterThan(0)
      }
      for (const m of svg.matchAll(/(?:x1|x2)="([\d.-]+)"/g)) {
        const v = Number(m[1])
        // Symbol interiors are drawn in a rotated local frame around the origin.
        if (Math.abs(v) > 20) {
          expect(v, `${e.id}: x ${v}`).toBeGreaterThanOrEqual(0)
          expect(v, `${e.id}: x ${v}`).toBeLessThanOrEqual(w)
        }
      }
    }
  })
})

describe('the picture and the model', () => {
  it('draws as many diodes as the rectifier the engine builds has', () => {
    // The engine names the pairs that can conduct; the drawing has to show the
    // devices those pairs are made of.
    for (const [id, rect, drawn] of [
      ['e1', 'half', 1],
      ['e2', 'bridge', 4],
      ['e6', 'six', 6],
    ]) {
      const conv = rectifier(rect, { Vs: 12.6 })
      // Two devices per conducting pair, except the half-wave's single diode.
      const devices = rect === 'half' ? 1 : rect === 'bridge' ? 4 : 6
      expect(conv.nD, `${rect} drops in series`).toBe(rect === 'half' ? 1 : 2)
      expect(conv.pulses, `${rect} pulses`).toBe(rect === 'half' ? 1 : rect === 'bridge' ? 2 : 6)
      expect(counts(svgFor(id)).diodes, `${id} diodes drawn`).toBe(devices)
      expect(devices, `${rect} device count`).toBe(drawn)
    }
  })

  it('gives the three-phase bridge three inputs and the others one source', () => {
    expect(svgFor('e6')).toMatch(/>a</)
    expect(svgFor('e6')).toMatch(/>b</)
    expect(svgFor('e6')).toMatch(/>c</)
    expect(counts(svgFor('e6')).acSources).toBe(0)
    expect(counts(svgFor('e1')).acSources).toBe(1)
    expect(counts(svgFor('e2')).acSources).toBe(1)
    expect(counts(svgFor('e5')).triacs).toBe(1)
  })

  it('draws one switch and one diode for the three clocked converters', () => {
    for (const id of ['b2', 'c1', 'c4']) {
      const c = counts(svgFor(id))
      expect(c.switches, `${id} switches`).toBe(1)
      expect(c.diodes, `${id} diodes`).toBe(1)
      expect(c.inductors, `${id} inductor`).toBe(1)
      expect(c.caps, `${id} capacitor`).toBe(1)
      expect(c.resistors, `${id} load resistor`).toBe(1)
    }
  })

  it('replaces the buck’s diode with a switch when the freewheel is synchronous', () => {
    // The toggle changes the circuit the engine solves (topologies.js: hasDead
    // goes false), so it has to change the circuit on screen too.
    expect(converter('buck', { sync: false }).hasDead).toBe(true)
    expect(converter('buck', { sync: true }).hasDead).toBe(false)
    const diode = counts(svgFor('b6', { sync: 0 }))
    const sync = counts(svgFor('b6', { sync: 1 }))
    expect(diode.diodes).toBe(1)
    expect(diode.switches).toBe(1)
    expect(sync.diodes).toBe(0)
    expect(sync.switches).toBe(2)
    expect(svgFor('b6', { sync: 1 })).toContain('Q₂')
  })

  it('draws the buck-boost’s output as the negative one it is', () => {
    const x = analyse(byId.c4, defaultsOf('c4'))
    expect(x.m.sig.vout.avg).toBeLessThan(0)
    // The load's polarity marks carry it: its top end is the negative one.
    const svg = svgFor('c4')
    expect(svg).toContain('below ground')
    expect(svg).toMatch(/<text class="sch-sign"[^>]*y="62"[^>]*>−</)
    expect(svg).toMatch(/<text class="sch-sign"[^>]*y="104"[^>]*>\+</)
    // ...and nobody else claims it.
    expect(svgFor('c1')).not.toContain('below ground')
  })
})

describe('the signal probes', () => {
  // The measures table names eight or so signals per circuit; each has to be
  // findable on the drawing, or the table is a list of words.
  const shown = (id) => {
    const x = analyse(byId[id], defaultsOf(id))
    const carried = signalsOf(byId[id])
    return ORDER.filter((k) => x.m.sig[k] && carried.includes(k))
  }
  const probed = (id) => {
    const svg = svgFor(id)
    const found = new Set()
    for (const m of svg.matchAll(/class="sch-sig"[^>]*>([^<]+)</g)) found.add(m[1])
    return found
  }

  it('marks every signal the measures table lists, on every experiment', () => {
    for (const e of EXPERIMENTS) {
      const want = shown(e.id).map((k) => TRACES[k].label)
      const got = probed(e.id)
      for (const label of want) expect([...got], `${e.id} (${topologyOf(e)}) is missing ${label}`).toContain(label)
    }
  })

  it('marks nothing the circuit does not carry', () => {
    for (const e of EXPERIMENTS) {
      const want = new Set(shown(e.id).map((k) => TRACES[k].label))
      for (const label of probed(e.id)) expect(want.has(label), `${e.id} marks ${label}, which its table does not list`).toBe(true)
    }
  })

  it('draws each mark in the colour the scope draws that trace', () => {
    const svg = svgFor('b2')
    for (const key of ['vsw', 'vout', 'iL', 'iD']) {
      const colour = TRACE_COLORS[key].replace(/[()]/g, '\$&')
      expect(svg, `b2 ${key}`).toMatch(new RegExp(`fill="${colour}"[^>]*>${TRACES[key].label.replace('_', '_')}<`))
    }
  })
})
