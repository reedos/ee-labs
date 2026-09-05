import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, GROUPS, VIEW_ORDER, VIEW_LABELS, byId, defaultsOf, drawables, isDynamic, viewLabel } from './experiments.js'
import { num } from './format.js'
import { VIEW_LEADS, bridgeText, calloutStandIn, calloutText, firstSentence, headlineValue, widestValue } from './headlines.js'
import { equivalentOf, kvlLoop, meshRows, partsFigures, powerCycle, theoremShows } from './theorems.js'
import { readQuantity } from './lessons.js'
import { alternating, analyse, acTable, atDrive, dampingSweep, experimentMath, integrated, netPower, powerLedger, refusalReason, snapNoise, turned, turnedLabel } from './math.js'
import { CROP_PAD, layoutExtent, layoutProblems, standInLabel } from './layoutCheck.js'
import { agrees } from '@ee-labs/explain'
import {
  equations, extrema, normalize, solveAC, drivingPointZ, acPower, NetworkError, complex as cx,
} from '@ee-labs/network'
import { buildCircuitLink, fmt, parseCircuitLink, schematicGeometry } from '@ee-labs/ui'
import { evalAtFreq } from '@ee-labs/systems'
import { CIRCUITS, transferOf } from '../../circuit-lab/src/circuits.js'
import { stateFromLink } from '../../circuit-lab/src/incoming.js'

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a))

// Every note makes a claim; every claim is measured here. The math panel's
// check rows are the first line — each row is a closed form against a solve —
// and the specific sentences of each note are the second, so the prose cannot
// drift from the circuit without a test noticing.

const at = (id, over = {}, cursor) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return { exp, p, x: analyse(exp, p, cursor) }
}

/** A deterministic random setting inside every knob's range. */
function randomParams(exp, seed) {
  let s = seed >>> 0
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
  const p = {}
  for (const k of exp.params) {
    if (k.kind) {
      // A toggle or a choice changes the circuit's structure, not a value; the
      // random settings exercise the default structure and the try steps the
      // others.
      p[k.key] = k.default
    } else if (k.scale === 'log') {
      // Keep resistances within four decades of each other so the checks stay
      // well above float noise; the knobs themselves allow six. Capacitances,
      // inductances and periods roam their whole range.
      const narrow = k.unit === 'Ω' || k.unit === ''
      const lo = narrow ? Math.max(k.min, 10) : k.min
      const hi = narrow ? Math.min(k.max, 1e5) : k.max
      p[k.key] = lo * Math.pow(hi / lo, rnd())
    } else {
      p[k.key] = k.min + (k.max - k.min) * rnd()
    }
  }
  // E3 at random settings is the finite-gain comparator; ideal refuses.
  if (exp.id === 'e3') {
    p.ideal = false
    p.A = 100 + 1e4 * rnd()
  }
  return p
}

describe('every experiment', () => {
  it('has a unique id, a group from the list, a note, knobs, a layout and views', () => {
    const ids = new Set()
    for (const e of EXPERIMENTS) {
      expect(ids.has(e.id), e.id).toBe(false)
      ids.add(e.id)
      expect(e.name.length).toBeGreaterThan(4)
      expect(e.note.length).toBeGreaterThan(80)
      expect(e.params.length).toBeGreaterThan(0)
      expect(e.layout.items.length).toBeGreaterThan(2)
      expect(e.views).toContain(e.view)
      expect(['i', 'v', 'p']).toContain(e.show)
      for (const k of e.params) {
        if (k.kind === 'toggle') {
          expect(typeof k.default, `${e.id}.${k.key}`).toBe('boolean')
          expect(k.on && k.off, `${e.id}.${k.key} labels`).toBeTruthy()
          continue
        }
        if (k.kind === 'choice') {
          expect(k.options.length, `${e.id}.${k.key} options`).toBeGreaterThan(2)
          expect(k.options.map((o) => o.value), `${e.id}.${k.key} default`).toContain(k.default)
          for (const o of k.options) expect(o.label, `${e.id}.${k.key} label`).toBeTruthy()
          continue
        }
        expect(k.default, `${e.id}.${k.key}`).toBeGreaterThanOrEqual(k.min)
        expect(k.default, `${e.id}.${k.key}`).toBeLessThanOrEqual(k.max)
      }
    }
  })

  it('draws every element it solves, and solves every element it draws', () => {
    for (const e of EXPERIMENTS) {
      const ids = new Set(e.net(defaultsOf(e.id)).elements.map((el) => el.id))
      const drawn = new Set(e.layout.items.filter((it) => it.el).map((it) => it.el))
      expect([...drawn].sort(), e.id).toEqual([...ids].sort())
      // Every node the netlist names (except ground) has a dot, so its voltage is readable.
      const nodes = new Set(e.net(defaultsOf(e.id)).elements.flatMap((el) => el.nodes))
      nodes.delete('gnd')
      const dots = new Set(e.layout.items.filter((it) => it.node).map((it) => it.node))
      for (const n of nodes) expect(dots.has(n), `${e.id}: node ${n} has no dot`).toBe(true)
    }
  })

  it('solves at its defaults with KCL holding, except E3 which refuses by design', () => {
    for (const e of EXPERIMENTS) {
      const { x } = at(e.id)
      if (e.id === 'e3') {
        expect(x.sol).toBeNull()
        expect(x.refusal.code).toBe('opamp-open-loop')
        continue
      }
      expect(x.sol, e.id).not.toBeNull()
      expect(x.sol.maxResidual, e.id).toBeLessThan(1e-9)
      expect(Math.abs(x.sol.pTotal), `${e.id} Tellegen`).toBeLessThan(1e-9)
    }
  })

  it('has a math panel whose every check row agrees, at the defaults and at 25 random settings', () => {
    for (const e of EXPERIMENTS) {
      const settings = [defaultsOf(e.id), ...Array.from({ length: 25 }, (_, k) => randomParams(e, k * 7919 + 17))]
      for (const p of settings) {
        const x = analyse(e, p)
        const m = experimentMath(e, p, x)
        expect(m, `${e.id} has math`).not.toBeNull()
        if (!x.sol) continue
        const rows = m.blocks.filter((b) => b.kind === 'check').flatMap((b) => b.rows)
        expect(rows.length, `${e.id} has check rows`).toBeGreaterThan(0)
        for (const r of rows) {
          expect(Number.isFinite(r.measured), `${e.id} "${r.label}" measured is finite at ${JSON.stringify(p)}`).toBe(true)
          expect(
            agrees(r),
            `${e.id} "${r.label}": theory ${r.predicted} vs measured ${r.measured} at ${JSON.stringify(p)}`,
          ).toBe(true)
        }
      }
    }
    // 26 settings × 26 experiments, half of them exact transients with energy
    // integrals: a few seconds alone, longer when the whole monorepo's workers
    // share the machine.
  // Group I walks every rectifier through its events at 26 settings each, and
  // an event is a fresh exact solve: real work, and slower than the rest of
  // the suite put together.
  }, 180000)

  it('prints a system whose unknown count matches the topbar claim', () => {
    for (const e of EXPERIMENTS) {
      const { x } = at(e.id)
      if (!x.sol) continue
      const eq = equations(x.sol.norm, x.sol)
      expect(eq.unknowns.length).toBe(x.sol.x.length)
      // Every KCL row sums to zero with the solved values in.
      for (const r of eq.rows.filter((q) => q.kind === 'kcl')) expect(Math.abs(r.sum), `${e.id} KCL at ${r.node}`).toBeLessThan(1e-9)
    }
  })

  it('exposes drawables with the fields the schematic labels need', () => {
    const d = drawables(byId.e1.net(defaultsOf('e1')))
    expect(d.find((q) => q.id === 'E1').gain).toBe(10)
    expect(d.find((q) => q.id === 'RL').value).toBe(1000)
  })

  // The first screenshots had a reading clipped off the canvas and a label on
  // top of a neighbour's reading, with every browser probe green. So the
  // drawing is checked as geometry, with the widest texts on: readings of
  // every kind at the defaults, and at settings that make the numbers long.
  // The frame around each drawing is cut to what it draws (Reed, 2026-09-01:
  // the schematics were "taking up too much real estate"). Since the layout
  // test below judges every box against `crop`, the frame is proven to hold at
  // random settings there; this test is about the saving and the stability.
  it('frames each drawing to its extent: within the canvas, fixed, and much smaller than the canvas overall', () => {
    let canvas = 0
    let framed = 0
    for (const e of EXPERIMENTS) {
      const { w, h, crop } = e.layout
      expect(crop, e.id).toHaveLength(4)
      const [x0, y0, x1, y1] = crop
      expect(x0, e.id).toBeGreaterThanOrEqual(0)
      expect(y0, e.id).toBeGreaterThanOrEqual(0)
      expect(x1, e.id).toBeLessThanOrEqual(w)
      expect(y1, e.id).toBeLessThanOrEqual(h)
      expect(x1 - x0, e.id).toBeGreaterThan(60)
      expect(y1 - y0, e.id).toBeGreaterThan(60)
      canvas += w * h
      framed += (x1 - x0) * (y1 - y0)
      // The frame does not depend on the settings: it is computed from
      // stand-in readings, so the same layout at any parameters gives the same box.
      for (const k of [3, 5]) {
        const els = drawables(e.net(randomParams(e, k)))
        expect(layoutExtent(e.layout, els), `${e.id} seed ${k}`).toEqual(crop)
      }
    }
    // The saving is honest, not dramatic: a three-leg ladder nearly fills its
    // canvas (0.86), so across the lab the frames cover about four fifths of
    // the area they replaced — the one-element experiments drop under half.
    // The rest of the screen space comes back from the pane sizing in the CSS.
    expect(framed / canvas).toBeLessThan(0.85)
    // A1 is one element beside its source; A2 has a switch on the rail as well, so its frame is a little wider.
    for (const [id, cap] of [['a1', 0.5], ['a2', 0.55]]) {
      const [x0, y0, x1, y1] = byId[id].layout.crop
      expect(((x1 - x0) * (y1 - y0)) / (420 * 180), id).toBeLessThan(cap)
    }
  })

  it('stand-in labels widen every value and never depend on the setting', () => {
    expect(standInLabel({ id: 'R1', type: 'R', value: 1000 })).toBe('R1 −1.23 mV')
    expect(standInLabel({ id: 'R1', type: 'R', value: 254.27 })).toBe('R1 −1.23 mV')
    expect(standInLabel({ id: 'V2', type: 'V', value: -10.7 })).toBe('V2 −1.23 mV')
    expect(standInLabel({ id: 'V1', type: 'V', value: 1, label: 'V1 1 V sine · 1 kHz' })).toBe('V1 −1.23 mV sine · −1.23 mV')
    expect(standInLabel({ id: 'S1', type: 'SW', closed: false })).toBe('S1 closes')
    expect(standInLabel({ id: 'S1', type: 'SW', closed: true, label: 'S1 opens at 0' })).toBe('S1 closes at −1.23 mV')
    expect(standInLabel({ id: 'U1', type: 'OPAMP', gain: 1e5 })).toBe('U1 A=−1.23 mV')
    // Wider than or equal to any real label at 3 significant figures.
    for (const v of [1, 12, 999, 1190, -10.74, 0.00123, 2.2e6]) {
      expect(standInLabel({ id: 'R1', type: 'R', value: v }).length).toBeGreaterThanOrEqual(`R1 ${fmt(v, 'Ω', 3)}`.length)
    }
  })

  it('the extent is the padded union of everything drawn, with readings at their widest', () => {
    const els = [{ id: 'R1', type: 'R', value: 1000 }]
    const one = { w: 400, h: 200, items: [{ el: 'R1', x: 200, y: 100, dir: 'v' }] }
    const [x0, y0, x1, y1] = layoutExtent(one, els)
    // A vertical resistor 40 tall, its current arrow on the left (strip out to
    // x − 19), label and an 8-character reading on the right from x + 14: the
    // box runs from the arrow to the end of the reading, and over the symbol's
    // height, each side padded.
    expect(x0).toBe(200 - 19 - CROP_PAD)
    expect(x1).toBeGreaterThanOrEqual(Math.ceil(200 + 14 + 8 * 5.4 + CROP_PAD))
    expect(y0).toBe(100 - 20 - CROP_PAD)
    expect(y1).toBe(100 + 20 + CROP_PAD)
    // Anything the checker would flag as leaving this frame is inside it at real readings.
    const meters = { v: {}, i: { R1: -0.00123 }, volt: { R1: -1.23 }, p: { R1: 0.0015 } }
    for (const show of ['i', 'v', 'p']) {
      expect(layoutProblems({ ...one, crop: [x0, y0, x1, y1] }, els, meters, show)).toEqual([])
    }
    // And a reading that does not fit the stand-in's width is caught, not hidden.
    const off = { ...one, crop: [x0, y0, x1 - 30, y1] }
    expect(layoutProblems(off, els, meters, 'i').some((s) => /R1 reading .* leaves the .* frame/.test(s))).toBe(true)
  })

  it('draws without any text on any other text, symbol or wire, and nothing off the canvas', () => {
    // Fifteen seeds, not three: "R3 3 kΩ" fits where "R3 1.19 kΩ" runs off the
    // canvas, and a negative sign is one more character on every reading.
    const seeds = [7, 11, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71]
    const settings = (e) => [defaultsOf(e.id), ...seeds.map((k) => randomParams(e, k))]
    for (const e of EXPERIMENTS) {
      for (const p of settings(e)) {
        // E3 refuses at its defaults; the drawing with readings needs a solve.
        if (e.id === 'e3' && p.ideal) Object.assign(p, { ideal: false, A: 1e5 })
        const x = analyse(e, p)
        expect(x.sol, `${e.id} did not solve`).toBeTruthy()
        // The meters the app actually draws: noise snapped to zero, so the
        // drawing is checked with "0 V" where the app shows "0 V" and not with
        // the "0.000302 fV" a raw solve would print.
        const meters = snapNoise(x.sol)
        for (const show of ['i', 'v', 'p']) {
          const problems = layoutProblems(e.layout, drawables(x.net), meters, show)
          expect(problems, `${e.id} (${show}) with ${JSON.stringify(p)}`).toEqual([])
        }
      }
      expect(layoutProblems(e.layout, drawables(e.net(defaultsOf(e.id))), null, 'none'), `${e.id} bare`).toEqual([])
    }
  })

  // The view switch reads the same left to right in every experiment (Reed,
  // 2026-09-01: "how come some examples show power first?"). The data keeps
  // that order too, so nobody has to know the switch re-sorts.
  it('lists its views in the one canonical order', () => {
    for (const e of EXPERIMENTS) {
      const sorted = VIEW_ORDER.filter((v) => e.views.includes(v))
      expect(e.views, e.id).toEqual(sorted)
      for (const v of e.views) expect(VIEW_ORDER, `${e.id} view ${v}`).toContain(v)
    }
  })

  // A theorem's name arrives with the experiment that introduces it. C3 uses
  // the equivalent one experiment before D5 names it, so its tab is called by
  // what it shows; from D5 on the view has its name.
  it('no view is called Thévenin before D5 introduces the name', () => {
    const d5 = EXPERIMENTS.findIndex((e) => e.id === 'd5')
    EXPERIMENTS.forEach((e, k) => {
      for (const v of e.views) {
        const { label, title } = viewLabel(v, e)
        if (k < d5) {
          expect(label, `${e.id} ${v}`).not.toMatch(/Th[ée]venin/)
          expect(title, `${e.id} ${v}`).not.toMatch(/Th[ée]venin/)
        } else expect(viewLabel(v, e), `${e.id} ${v}`).toBe(VIEW_LABELS[v])
      }
    })
    expect(viewLabel('thevenin', byId.c3).label).toBe('Seen from the load')
    expect(viewLabel('thevenin', byId.d5).label).toBe('Thévenin')
  })

  // Each experiment is its own picture: no two draw the same circuit with the
  // same numbers on it (Reed's review: A4/B4 and B2/B3 looked like repeats).
  it('no two experiments share a drawing and its defaults', () => {
    const seen = new Map()
    for (const e of EXPERIMENTS) {
      const key = JSON.stringify([e.layout.items, defaultsOf(e.id)])
      expect(seen.has(key), `${e.id} is the same picture as ${seen.get(key)}`).toBe(false)
      seen.set(key, e.id)
    }
  })

  // Charge is where voltage and current come from, so it is said first, on A1,
  // not left for the capacitor's q = Cv in Group F.
  it('A1 opens with charge: the term leads its list and its note defines voltage and current by it before any number', () => {
    expect(byId.a1.terms[0]).toBe('charge')
    const see = byId.a1.see
    const firstDigit = see.search(/\d/)
    const opening = see.slice(0, firstDigit).toLowerCase()
    expect(opening).toMatch(/voltage is energy per unit of charge/)
    expect(opening).toMatch(/current is charge passing per second/)
  })

  // The bridge is drawn as two dividers, not the textbook diamond (the drawing
  // primitives are axis-aligned); the note owes the reader the reason and the
  // correspondence.
  it('C4 says why it is not drawn as a diamond', () => {
    expect(byId.c4.why).toMatch(/diamond/)
    expect(byId.c4.why).toMatch(/two dividers side by side/)
    expect(byId.c4.why).toMatch(/B2/)
  })

  // KCL/KVL are used by name in Group A's equations pane before Group B takes
  // them apart, so Group A carries the terms (and the pane carries a primer).
  it('Group A defines KCL where its equations first use it', () => {
    for (const e of EXPERIMENTS.filter((x) => x.group === GROUPS[0])) expect(e.terms, e.id).toContain('kcl')
    expect(byId.a1.terms).toContain('kvl')
    expect(byId.a4.terms).toContain('kvl')
  })

  // The matrix shown in letters is the matrix solved in numbers: every cell's
  // symbolic terms add to the numeric entry, in every experiment, at the
  // defaults and at random settings. The letters name parts on the schematic.
  it('symbolic matrix agrees with the numeric one cell by cell, and every letter is a drawn part', () => {
    for (const e of EXPERIMENTS) {
      for (const p of [defaultsOf(e.id), randomParams(e, 5)]) {
        if (e.id === 'e3' && p.ideal) Object.assign(p, { ideal: false, A: 1e5 })
        const x = analyse(e, p)
        const eq = equations(x.sol.norm, x.sol)
        const { cells, rhs, rows, cols, symbols } = eq.symbolic
        expect(rows.length, e.id).toBe(eq.M.length)
        expect(cols.length, e.id).toBe(eq.M.length)
        cells.forEach((row, i) => {
          row.forEach((terms, j) => {
            const sum = terms.reduce((s, t) => s + t.value, 0)
            expect(Math.abs(sum - eq.M[i][j]), `${e.id} M[${i}][${j}]`).toBeLessThanOrEqual(1e-12 * Math.max(1, Math.abs(eq.M[i][j])))
          })
          const rs = rhs[i].reduce((s, t) => s + t.value, 0)
          expect(Math.abs(rs - eq.r[i]), `${e.id} r[${i}]`).toBeLessThanOrEqual(1e-12 * Math.max(1, Math.abs(eq.r[i])))
        })
        const drawn = new Set(drawables(x.net).map((d) => d.id))
        for (const s of symbols) expect(drawn.has(s.id), `${e.id}: ${s.latex} names ${s.id}`).toBe(true)
        expect(eq.symbolicLatex).toMatch(/^\\begin\{bmatrix\}/)
      }
    }
  })

  // The power ledger: delivered equals absorbed in every experiment, every
  // element is on exactly one side, and p is the product of the v and i shown.
  it('power ledger balances, and each row is v × i', () => {
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      if (e.id === 'e3') Object.assign(p, { ideal: false, A: 1e5 })
      const { x } = at(e.id, p)
      const led = powerLedger(x.sol)
      expect(led.rows.map((r) => r.id).sort()).toEqual(x.sol.sys.effs.map((q) => q.id).sort())
      const scale = Math.max(led.delivered, led.absorbed)
      if (scale > 0) expect(Math.abs(led.delivered - led.absorbed) / scale, e.id).toBeLessThan(1e-9)
      for (const r of led.rows) {
        if (r.role === 'idle') expect(r.p).toBe(0)
        else {
          expect(r.role, `${e.id} ${r.id}`).toBe(r.p > 0 ? 'absorbs' : 'delivers')
          expect(Math.abs(r.v * r.i - r.p), `${e.id} ${r.id}`).toBeLessThanOrEqual(1e-12 * Math.abs(r.p))
        }
      }
      expect(led.net).toBe(0)
    }
    // A source that delivers is the amber side; a1 at the defaults: V1 delivers everything R1 absorbs.
    const { x } = at('a1')
    const led = powerLedger(x.sol)
    expect(led.rows.find((r) => r.id === 'V1').role).toBe('delivers')
    expect(led.rows.find((r) => r.id === 'R1').role).toBe('absorbs')
  })

  it('the layout checker itself sees a label on a reading, a wire through a symbol and a crossing', () => {
    const els = [
      { id: 'R1', type: 'R', value: 1000 },
      { id: 'R2', type: 'R', value: 2000 },
    ]
    const meters = { v: { a: 1 }, i: { R1: 0.001, R2: 0.002 }, volt: { R1: 1, R2: 2 }, p: { R1: 1e-3, R2: 2e-3 } }
    // Two vertical resistors 30 apart: R1's texts land on R2's symbol.
    const tight = { w: 200, h: 120, items: [{ el: 'R1', x: 40, y: 60, dir: 'v' }, { el: 'R2', x: 70, y: 60, dir: 'v' }] }
    expect(layoutProblems(tight, els, meters, 'i').some((s) => /R1 label .* sits on R2 symbol/.test(s))).toBe(true)
    // A wire straight through a horizontal resistor.
    const through = { w: 200, h: 120, items: [{ el: 'R1', x: 100, y: 60 }, { wire: [100, 20, 100, 100] }] }
    expect(layoutProblems(through, els, null, 'none').some((s) => /runs through R1 symbol/.test(s))).toBe(true)
    // Two wires crossing with no junction; a T is fine.
    const cross = { w: 200, h: 120, items: [{ wire: [20, 60, 180, 60] }, { wire: [100, 20, 100, 100] }] }
    expect(layoutProblems(cross, els, null, 'none').some((s) => /crosses/.test(s))).toBe(true)
    const tee = { w: 200, h: 120, items: [{ wire: [20, 60, 180, 60] }, { wire: [100, 60, 100, 100] }] }
    expect(layoutProblems(tee, els, null, 'none')).toEqual([])
    // Off the canvas.
    const off = { w: 100, h: 100, items: [{ el: 'R1', x: 5, y: 50, dir: 'v' }] }
    expect(layoutProblems(off, els, null, 'none').some((s) => /leaves the 100×100 canvas/.test(s))).toBe(true)
  })

  it('the layout checker sees a caption on a frame edge and a symbol straddling one, and lets a wire cross', () => {
    const els = [{ id: 'R1', type: 'R', value: 1000 }]
    const frame = { box: [60, 20, 160, 100] }
    const caption = { w: 200, h: 120, items: [frame, { text: 'inside', x: 110, y: 22 }] }
    expect(layoutProblems(caption, els, null, 'none').some((s) => /caption “inside” sits on the frame/.test(s))).toBe(true)
    const straddle = { w: 200, h: 120, items: [frame, { el: 'R1', x: 60, y: 60 }] }
    expect(layoutProblems(straddle, els, null, 'none').some((s) => /R1 symbol straddles the frame/.test(s))).toBe(true)
    const crossing = { w: 200, h: 120, items: [frame, { wire: [20, 60, 80, 60] }, { el: 'R1', x: 100, y: 60 }, { wire: [120, 60, 180, 60] }] }
    expect(layoutProblems(crossing, els, null, 'none')).toEqual([])
  })
})

describe('the notes, sentence by sentence', () => {
  it('A1: the source decides the voltage, the resistor the current; turn R down and E does not move', () => {
    const { p, x } = at('a1')
    expect(x.sol.volt.R1).toBeCloseTo(p.E, 12)
    expect(x.sol.i.R1).toBeCloseTo(p.E / p.R1, 12)
    expect(x.sol.v.in).toBeCloseTo(p.E, 12)
    const low = at('a1', { R1: 10 }).x.sol
    expect(low.i.R1).toBeCloseTo(p.E / 10, 12)
    expect(low.volt.V1).toBe(x.sol.volt.V1)
    // The source's own current leaves its + terminal: negative in the passive convention.
    expect(x.sol.i.V1).toBeCloseTo(-x.sol.i.R1, 12)
  })

  it('A2: i = I whatever R, v = I·R, 5 mA into a megohm is 5 kV, and opening the switch on screen is refused with the reason', () => {
    const { p, x } = at('a2')
    expect(x.sol.i.R1).toBeCloseTo(p.I, 12)
    expect(x.sol.v.in).toBeCloseTo(p.I * p.R1, 12)
    expect(x.sol.v.n1).toBeCloseTo(p.I * p.R1, 12) // the closed switch is a wire
    const meg = at('a2', { R1: 1e6 }).x.sol
    expect(meg.i.R1).toBeCloseTo(p.I, 12)
    expect(meg.v.in).toBeCloseTo(5000, 9)
    // The note says "open the switch … the solver refuses": the knob on screen must cause it.
    const open = at('a2', { open: true }).x
    expect(open.sol).toBeNull()
    expect(open.refusal).toBeInstanceOf(NetworkError)
    expect(open.refusal.code).toBe('current-cutset')
    expect(open.refusal.message).toMatch(/nowhere to go/)
  })

  it('A3: sliding V_ref moves every node voltage by exactly V_ref and nothing an element feels; V_ref carries no current', () => {
    const base = at('a3', { Vref: 0 }).x.sol
    for (const lift of [5, -7.5, 24]) {
      const s = at('a3', { Vref: lift }).x.sol
      for (const n of ['in', 'A', 'ref']) expect(s.v[n] - base.v[n], `node ${n} at V_ref = ${lift}`).toBeCloseTo(lift, 12)
      for (const id of ['V1', 'R1', 'R2']) {
        expect(s.volt[id], `volt ${id}`).toBeCloseTo(base.volt[id], 12)
        expect(s.i[id], `i ${id}`).toBeCloseTo(base.i[id], 12)
        expect(s.p[id], `p ${id}`).toBeCloseTo(base.p[id], 12)
      }
      expect(Math.abs(s.i.V0), `i through V_ref at ${lift}`).toBeLessThan(1e-12)
      expect(Math.abs(s.p.V0)).toBeLessThan(1e-12)
    }
  })

  it('A4: with E₁ > E₂, v and i of R are positive; E₂ above E₁ flips both together while p_R stays positive; the pusher’s p is negative', () => {
    const { p, x } = at('a4')
    expect(x.sol.volt.R1).toBeCloseTo(p.E1 - p.E2, 12)
    expect(x.sol.volt.R1).toBeGreaterThan(0)
    expect(x.sol.i.R1).toBeGreaterThan(0)
    expect(x.sol.p.R1).toBeGreaterThan(0)
    expect(x.sol.p.V1).toBeLessThan(0)
    const flipped = at('a4', { E2: 20 }).x.sol
    expect(flipped.volt.R1).toBeLessThan(0)
    expect(flipped.i.R1).toBeLessThan(0)
    expect(flipped.p.R1).toBeGreaterThan(0)
    expect(flipped.p.V2).toBeLessThan(0)
    expect(flipped.p.V1).toBeGreaterThan(0)
  })

  it('B1: R₁ carries exactly what R₂ and R₃ carry between them, and the sum never moves as R₂ shrinks', () => {
    const { x } = at('b1')
    expect(x.sol.i.R1).toBeCloseTo(x.sol.i.R2 + x.sol.i.R3, 12)
    const tiny = at('b1', { R2: 1 }).x.sol
    expect(tiny.i.R2 / tiny.i.R1).toBeGreaterThan(0.999)
    expect(tiny.i.R1).toBeCloseTo(tiny.i.R2 + tiny.i.R3, 12)
  })

  it('B2: the source lifts by E and the resistors drop it all again, in proportion', () => {
    const { p, x } = at('b2')
    expect(x.sol.volt.V1).toBeCloseTo(p.E, 12)
    expect(x.sol.volt.R1 + x.sol.volt.R2).toBeCloseTo(p.E, 12)
    expect(x.sol.volt.R2 / x.sol.volt.R1).toBeCloseTo(p.R2 / p.R1, 9)
  })

  it('B3: resistors positive, source negative, total exactly zero', () => {
    const { x } = at('b3')
    expect(x.sol.p.R1).toBeGreaterThan(0)
    expect(x.sol.p.R2).toBeGreaterThan(0)
    expect(x.sol.p.R3).toBeGreaterThan(0)
    expect(x.sol.p.V1).toBeLessThan(0)
    expect(Math.abs(x.sol.pTotal)).toBeLessThan(1e-12)
  })

  it('B4: current (E₁−E₂)/R flows into the weaker source, which absorbs; raise E₂ past E₁ and it reverses', () => {
    const { p, x } = at('b4')
    expect(x.sol.i.R1).toBeCloseTo((p.E1 - p.E2) / p.R1, 12)
    expect(x.sol.p.V2).toBeGreaterThan(0)
    expect(x.sol.p.V1).toBeLessThan(0)
    const flipped = at('b4', { E2: 15 }).x.sol
    expect(flipped.i.R1).toBeLessThan(0)
    expect(flipped.p.V2).toBeLessThan(0)
    expect(flipped.p.V1).toBeGreaterThan(0)
  })

  it('C1: a resistor ten times the others takes ten times the voltage', () => {
    const s = at('c1', { R1: 1000, R2: 1000, R3: 10000 }).x.sol
    expect(s.volt.R3 / s.volt.R1).toBeCloseTo(10, 9)
    expect(s.volt.R3 / 12).toBeCloseTo(10 / 12, 9)
  })

  it('C2: the equivalent is below the smallest branch and the smallest resistor takes the biggest share', () => {
    const { p, x } = at('c2')
    const req = p.E / -x.sol.i.V1
    expect(req).toBeLessThan(Math.min(p.R1, p.R2, p.R3))
    expect(x.sol.i.R1).toBeGreaterThan(x.sol.i.R2)
    expect(x.sol.i.R2).toBeGreaterThan(x.sol.i.R3)
  })

  it('C3: the droop is small only while R_L ≫ R₂', () => {
    const unloaded = 6
    const light = at('c3', { RL: 1e5 }).x.sol.v.A
    const heavy = at('c3', { RL: 1000 }).x.sol.v.A
    expect(unloaded - light).toBeLessThan(0.05)
    expect(unloaded - heavy).toBeGreaterThan(1.5)
    // And the sweep pane is a real measurement: its point at the knob matches the solve.
    const { x, p } = at('c3')
    const near = x.sweep.points.reduce((b, q) => (Math.abs(Math.log(q.R / p.RL)) < Math.abs(Math.log(b.R / p.RL)) ? q : b))
    expect(Math.abs(near.v - x.sol.v.A) / x.sol.v.A).toBeLessThan(0.05)
  })

  it('C4: balanced when R₁/R₂ = R₃/R₄, whatever the supply; 1 % of R₄ moves it by about E/4 × 1 %', () => {
    for (const E of [1, 10, 24]) expect(Math.abs(at('c4', { R4: 1000, E }).x.sol.v.R - at('c4', { R4: 1000, E }).x.sol.v.L)).toBeLessThan(1e-12)
    const s = at('c4', { R4: 1010 }).x.sol
    const out = s.v.R - s.v.L
    expect(out / ((10 / 4) * 0.01)).toBeCloseTo(1, 1)
  })

  it('D1: V_A = (E/R₁)/(1/R₁+1/R₂+1/R₃) — one equation, one unknown', () => {
    const { p, x } = at('d1')
    expect(x.sol.v.A).toBeCloseTo(p.E / p.R1 / (1 / p.R1 + 1 / p.R2 + 1 / p.R3), 12)
    const eq = equations(x.sol.norm, x.sol)
    // Two node unknowns (in, A) plus the source current: the printed system.
    expect(eq.rows.filter((r) => r.kind === 'kcl').length).toBe(2)
  })

  it('D2: the printed system has five unknowns — three node voltages (in, A, B) and two source currents — and the note and math panel say exactly that', () => {
    const { exp, p, x } = at('d2')
    const eq = equations(x.sol.norm, x.sol)
    expect(eq.unknowns.filter((u) => u.kind === 'v').map((u) => u.node).sort()).toEqual(['A', 'B', 'in'])
    expect(eq.unknowns.filter((u) => u.kind === 'i').map((u) => u.id).sort()).toEqual(['V1', 'V2'])
    expect(eq.unknowns.length).toBe(5)
    expect(exp.note).toMatch(/five unknowns: the three node voltages \(in, A, B\) and the current through each of the two sources/)
    const m = experimentMath(exp, p, x)
    const v = m.blocks.filter((b) => b.kind === 'values').flatMap((b) => b.rows).find((r) => /unknowns/.test(r.label))
    expect(v.value).toBe(5)
    expect(v.note).toBe('3 node voltages + 2 source currents')
  })

  it('D3: the hand 2×2 matches nodal exactly, and E₂ above E₁R₂/(R₁+R₂) reverses i₂', () => {
    const { p, x } = at('d3')
    const a = p.R1 + p.R2
    const b = -p.R2
    const d = p.R2 + p.R3
    const det = a * d - b * b
    const i1 = (p.E1 * d + b * p.E2) / det
    const i2 = (-a * p.E2 - b * p.E1) / det
    expect(x.sol.i.R1).toBeCloseTo(i1, 12)
    expect(x.sol.i.R3).toBeCloseTo(i2, 12)
    const threshold = (p.E1 * p.R2) / (p.R1 + p.R2)
    expect(at('d3', { E2: threshold * 0.9 }).x.sol.i.R3).toBeGreaterThan(0)
    expect(at('d3', { E2: threshold * 1.1 }).x.sol.i.R3).toBeLessThan(0)
  })

  it('D4: voltages and currents superpose to the last digit; power does not, by 2·i₁·i₂·R', () => {
    const { p, x } = at('d4')
    const sp = x.superposition
    for (const n of Object.keys(x.sol.v)) expect(sp.sumV[n]).toBeCloseTo(x.sol.v[n], 12)
    for (const id of Object.keys(x.sol.i)) expect(sp.sumI[id]).toBeCloseTo(x.sol.i[id], 12)
    const iE = sp.parts.find((q) => q.id === 'V1').sol.i.R2
    const iI = sp.parts.find((q) => q.id === 'I1').sol.i.R2
    expect(x.sol.p.R2 - sp.sumP.R2).toBeCloseTo(2 * iE * iI * p.R2, 12)
    expect(Math.abs(x.sol.p.R2 - sp.sumP.R2)).toBeGreaterThan(1e-6)
  })

  it('D5: all three R_th agree with R₁∥R₂∥R₃ and the load line’s intercepts are V_oc and I_sc', () => {
    const { p, x } = at('d5')
    const rth = 1 / (1 / p.R1 + 1 / p.R2 + 1 / p.R3)
    expect(x.thevenin.rth.ratio).toBeCloseTo(rth, 9)
    expect(x.thevenin.rth.test).toBeCloseTo(rth, 9)
    expect(x.thevenin.rth.fit).toBeCloseTo(rth, 6)
    expect(x.thevenin.fitVoc).toBeCloseTo(x.thevenin.voc, 9)
    expect(x.thevenin.fitVoc / x.thevenin.rth.fit).toBeCloseTo(x.thevenin.isc, 9)
  })

  it('D6: the sweep peaks at R_L = R_s with 50 % efficiency; efficiency climbs past it while power falls', () => {
    const { p, x } = at('d6')
    expect(x.thevenin.rth.test).toBeCloseTo(p.Rs, 9)
    expect(x.sweep.rOpt / p.Rs).toBeGreaterThan(0.94)
    expect(x.sweep.rOpt / p.Rs).toBeLessThan(1.06)
    expect(x.sol.p.RL / -x.sol.p.V1).toBeCloseTo(0.5, 12)
    const pts = x.sweep.points
    const atOpt = pts.reduce((b, q) => (Math.abs(Math.log(q.R / p.Rs)) < Math.abs(Math.log(b.R / p.Rs)) ? q : b))
    const later = pts.filter((q) => q.R > p.Rs * 10)
    expect(later.every((q) => q.p < atOpt.p)).toBe(true)
    expect(later.every((q) => q.efficiency > atOpt.efficiency)).toBe(true)
    expect(pts[pts.length - 1].efficiency).toBeGreaterThan(0.99)
  })

  it('E1: v_out = A·v_in whatever the load; the dependent source delivers more than the input source works', () => {
    const { p, x } = at('e1')
    expect(x.sol.v.out).toBeCloseTo(p.A * p.E, 12)
    expect(at('e1', { RL: 10 }).x.sol.v.out).toBeCloseTo(p.A * p.E, 12)
    expect(x.sol.p.E1).toBeLessThan(0)
    expect(-x.sol.p.E1).toBeGreaterThan(-x.sol.p.V1 * 100)
  })

  it('E2: the input divider and the output divider each cost a little; the ideal recovers at the limits; power gain a resistor network cannot reach', () => {
    const { p, x } = at('e2')
    const kin = p.Rin / (p.Rs + p.Rin)
    const kout = p.RL / (p.Rout + p.RL)
    expect(x.sol.v.p).toBeCloseTo(p.E * kin, 12)
    expect(x.sol.v.out).toBeCloseTo(p.A * p.E * kin * kout, 12)
    expect(kin).toBeLessThan(1)
    expect(kout).toBeLessThan(1)
    // The knobs' limits: R_in at its max and R_out at its min recover A·E within 1 %.
    const ideal = at('e2', { Rin: 1e6, Rout: 1, Rs: 100 }).x.sol
    expect(Math.abs(ideal.v.out / (p.A * p.E) - 1)).toBeLessThan(0.01)
    // Far more power into the load than the source supplies.
    expect(x.sol.p.RL).toBeGreaterThan(-x.sol.p.V1 * 1000)
    expect(x.sol.p.E1).toBeLessThan(0)
    // Every circuit in the lab made of resistors and one voltage source obeys the
    // limit the note names: no node above the source, no load power above what the
    // source puts in.
    let passive = 0
    for (const e of EXPERIMENTS) {
      const net = e.net(defaultsOf(e.id))
      const sources = net.elements.filter((el) => el.type !== 'R')
      if (sources.length !== 1 || sources[0].type !== 'V') continue
      passive++
      const s = analyse(e, defaultsOf(e.id)).sol
      const E = Math.abs(sources[0].value)
      for (const [n, v] of Object.entries(s.v)) expect(Math.abs(v), `${e.id} node ${n}`).toBeLessThanOrEqual(E + 1e-12)
      for (const el of net.elements.filter((q) => q.type === 'R')) expect(s.p[el.id], `${e.id} ${el.id}`).toBeLessThanOrEqual(-s.p[sources[0].id] + 1e-12)
    }
    expect(passive).toBeGreaterThan(5)
  })

  it('E3: ideal → refuses with the open-loop message; finite gain → 1 mV in, 100 V out at A = 10⁵', () => {
    const { x } = at('e3')
    expect(x.sol).toBeNull()
    expect(x.refusal.code).toBe('opamp-open-loop')
    expect(x.refusal.message).toMatch(/no feedback path/)
    expect(x.refusal.message).toMatch(/finite gain/)
    const fin = at('e3', { ideal: false, A: 1e5 }).x
    expect(fin.sol.v.out).toBeCloseTo(100, 9)
  })

  it('E4: v_out = GE/(1+G/A), the input difference is v_out/A, and the gain converges on G as A grows', () => {
    const { p, x } = at('e4')
    const G = 1 + p.Rf / p.Rg
    expect(x.sol.v.out).toBeCloseTo((G * p.E) / (1 + G / p.A), 12)
    expect(x.sol.v.in - x.sol.v.n).toBeCloseTo(x.sol.v.out / p.A, 12)
    const gains = [1e2, 1e4, 1e6].map((A) => at('e4', { A }).x.sol.v.out / p.E)
    expect(Math.abs(gains[0] - G)).toBeGreaterThan(Math.abs(gains[1] - G))
    expect(Math.abs(gains[1] - G)).toBeGreaterThan(Math.abs(gains[2] - G))
    // The shortfall is exactly G/A of the ideal, as the note says.
    expect((G - gains[2]) / G).toBeCloseTo(G / 1e6 / (1 + G / 1e6), 12)
  })

  it('E5: virtual ground at 0 V, v_out = −(R_f/R_g)E, the source sees R_g, the load current is the op-amp’s', () => {
    const { p, x } = at('e5')
    expect(Math.abs(x.sol.v.n)).toBeLessThan(1e-12)
    expect(x.sol.v.out).toBeCloseTo(-(p.Rf / p.Rg) * p.E, 12)
    expect(p.E / -x.sol.i.V1).toBeCloseTo(p.Rg, 9)
    // The source's current is E/Rg regardless of the load: the load current is not its business.
    expect(at('e5', { RL: 100 }).x.sol.i.V1).toBeCloseTo(x.sol.i.V1, 12)
    expect(at('e5', { RL: 100 }).x.sol.i.U1).not.toBeCloseTo(x.sol.i.U1, 6)
  })

  it('E6: v_out = −R_f(E₁/R₁ + E₂/R₂) and each input current is set by its own resistor alone', () => {
    const { p, x } = at('e6')
    expect(x.sol.v.out).toBeCloseTo(-p.Rf * (p.E1 / p.R1 + p.E2 / p.R2), 12)
    // Change E₂: i_R1 does not move.
    expect(at('e6', { E2: -3 }).x.sol.i.R1).toBeCloseTo(x.sol.i.R1, 12)
  })

  it('E7: matched → (R₂/R₁)(E₂−E₁) and common mode rejected; 1 % mismatch leaks about 1 % of the differential gain', () => {
    const matched = at('e7', { R4: 10000 })
    expect(matched.x.sol.v.out).toBeCloseTo(10 * (1.2 - 1), 12)
    // Every element carries current at the defaults — the − side is not sitting dead at E₁.
    for (const [id, i] of Object.entries(matched.x.sol.i)) expect(Math.abs(i), id).toBeGreaterThan(1e-6)
    expect(at('e7', { R4: 10000, E1: 5, E2: 5 }).x.sol.v.out).toBeCloseTo(0, 12)
    const cm = at('e7', { R4: 10100, E1: 1, E2: 1 }).x.sol.v.out
    // Common-mode gain ≈ 0.01 × differential gain × (R1/(R1+R2)) scale — order 1 % of 10.
    expect(Math.abs(cm)).toBeGreaterThan(0.001)
    expect(Math.abs(cm)).toBeLessThan(0.2)
  })

  it('E8: the output is the UNLOADED divider voltage whatever R_L, and the sweep is flat', () => {
    const { p, x } = at('e8')
    const unloaded = (p.E * p.R2) / (p.R1 + p.R2)
    for (const RL of [1, 100, 1e6]) expect(at('e8', { RL }).x.sol.v.out).toBeCloseTo(unloaded, 12)
    const vs = x.sweep.points.map((q) => q.v)
    expect(Math.max(...vs) - Math.min(...vs)).toBeLessThan(1e-9)
    // And C3, the same divider without the buffer, is not flat.
    const c3 = at('c3').x.sweep.points.map((q) => q.v)
    expect(Math.max(...c3) - Math.min(...c3)).toBeGreaterThan(1)
  })
})

// ------------------------------------------------------------------ dynamics
const DYNAMIC = EXPERIMENTS.filter((e) => e.window)
// Group I and E9 put a time axis on circuits that have no state at all: what
// moves is which region the circuit is in, not a capacitor's charge. They are
// dynamic in the sense that they have a window and a cursor, and the checks
// below that are about states apply only to the ones that have states.
const STATEFUL = DYNAMIC.filter((e) => e.net(defaultsOf(e.id)).elements.some((q) => q.type === 'C' || q.type === 'L'))
const last = (arr) => arr[arr.length - 1]
const peaks = (tr, q, key) => extrema(tr.t, tr.series(q, key), (t) => tr.at(t).sol[q][key])

const SECOND_ORDER = new Set(['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'h3', 'h4'])

describe('every dynamic experiment (F, G, H)', () => {
  it('has a transient, a state summary, a cursor solve, and the meters read that instant', () => {
    expect(DYNAMIC.length).toBe(25)
    expect(STATEFUL.length).toBe(21)
    for (const e of DYNAMIC) {
      const { x } = at(e.id)
      expect(x.tr, e.id).toBeTruthy()
      expect(x.sol, e.id).toBeTruthy()
      expect(x.cursor).toBeCloseTo(e.cursor * x.tEnd, 12)
      expect(x.sol.maxResidual, e.id).toBeLessThan(1e-9)
      expect(x.state.n, e.id).toBe(STATEFUL.includes(e) ? (SECOND_ORDER.has(e.id) ? 2 : 1) : 0)
      if (x.state.n === 2) expect(['overdamped', 'critical', 'underdamped', 'undamped']).toContain(x.state.face)
      // The scope's traces are all readable from the cursor solve.
      for (const q of [...e.scope.left.traces, ...(e.scope.right?.traces || [])]) expect(Number.isFinite(x.sol[q.q][q.key]), `${e.id} ${q.label}`).toBe(true)
    }
  })

  it('the differential equation is true at the cursor: C·dv/dt is the capacitor’s current, L·di/dt the inductor’s voltage', () => {
    for (const e of STATEFUL) {
      for (const frac of [0, 0.1, 0.37, 0.8, 1]) {
        const x = analyse(e, defaultsOf(e.id), frac * e.window(defaultsOf(e.id)))
        x.state.states.forEach((q, k) => {
          const law = q.type === 'C' ? x.now.sol.i[q.id] / q.value : x.now.sol.volt[q.id] / q.value
          expect(agrees({ predicted: law, measured: x.now.dxdt[k], tol: 1e-9, abs: 1e-12 }), `${e.id} ${q.id} at ${frac}`).toBe(true)
        })
      }
    }
  })

  it('a state cannot jump: x(0⁺) is x(0⁻) for every experiment, including the ones with a switch', () => {
    for (const e of STATEFUL) {
      const { x } = at(e.id)
      const x0plus = x.tr.at(0).x
      x.before.x0.forEach((v, k) => expect(x0plus[k], `${e.id} state ${k}`).toBeCloseTo(v, 12))
    }
  })

  it('energy is conserved along every transient: stored + dissipated = stored₀ + supplied at every sample', () => {
    for (const e of STATEFUL) {
      const { x } = at(e.id)
      const scale = Math.max(...x.energy.points.map((q) => Math.abs(q.supplied) + q.stored)) || 1
      for (const q of x.energy.points) expect(Math.abs(q.gap) / scale, `${e.id} at t = ${q.t}`).toBeLessThan(1e-9)
    }
  })

  it('Σ power reads a clean zero, not a rounding residual, at the cursor', () => {
    for (const e of DYNAMIC) {
      const { x } = at(e.id)
      expect(netPower(x.sol), e.id).toBe(0)
    }
    // But a real imbalance is left alone.
    expect(netPower({ p: { a: 1, b: -0.9 }, pTotal: 0.1 })).toBe(0.1)
  })
})

describe('the dynamic notes, sentence by sentence', () => {
  it('F1: a triangle of voltage makes a square of current, ±C·4A/T = ±20 mA, lagging by τ = R_sC = 10 µs', () => {
    const { p, x } = at('f1')
    const i = x.tr.series('i', 'C1')
    expect(Math.max(...i)).toBeCloseTo((p.C1 * 4 * p.A) / p.T, 9)
    expect(Math.min(...i)).toBeCloseTo(-(p.C1 * 4 * p.A) / p.T, 9)
    expect(x.state.tau).toBeCloseTo(p.Rs * p.C1, 15)
    // Flat while the voltage falls: after the corner at T/4 the current swings
    // from +Cs to −Cs along 2Cs·e^(−Δt/τ), so at 0.4T it is on the plateau to
    // 2e⁻¹⁵ — the lag is τ and nothing else.
    const s = (4 * p.A) / p.T
    expect(x.tr.at(0.4 * p.T).sol.i.C1).toBeCloseTo(-p.C1 * s * (1 - 2 * Math.exp(-(0.15 * p.T) / x.state.tau)), 12)
  })

  it('F2: the dual — a triangle of current makes a square of voltage, ±L·4A/T = ±0.4 V, lagging by τ = L/R_p = 1 µs', () => {
    const { p, x } = at('f2')
    const v = x.tr.series('volt', 'L1')
    expect(Math.max(...v)).toBeCloseTo((p.L1 * 4 * p.A) / p.T, 9)
    expect(Math.min(...v)).toBeCloseTo(-(p.L1 * 4 * p.A) / p.T, 9)
    expect(x.state.tau).toBeCloseTo(p.L1 / p.Rp, 15)
  })

  it('F3: τ = RC = 1 ms, 63.2 % after one τ and 99.3 % after five, 12 mA at the instant the switch closes; v₀ only moves the start', () => {
    const { p, x } = at('f3')
    const tau = p.R1 * p.C1
    expect(x.state.tau).toBeCloseTo(tau, 15)
    expect(x.tr.at(tau).sol.volt.C1 / p.E).toBeCloseTo(1 - Math.exp(-1), 9)
    expect(x.tr.at(5 * tau).sol.volt.C1 / p.E).toBeCloseTo(1 - Math.exp(-5), 9)
    expect(x.tr.at(0).sol.i.C1).toBeCloseTo(p.E / p.R1, 12)
    const y = at('f3', { v0: 4 }).x
    expect(y.before.x0[0]).toBe(4)
    expect(y.tr.at(tau).sol.volt.C1).toBeCloseTo(p.E + (4 - p.E) * Math.exp(-1), 9)
  })

  it('F4: V_th = 8 V, R_th = 1.167 kΩ, τ = R_th·C = 1.167 ms, and node A starts at 3.43 V', () => {
    const { p, x } = at('f4')
    const rth = p.R3 + (p.R1 * p.R2) / (p.R1 + p.R2)
    expect(x.thevenin.voc).toBeCloseTo(8, 9)
    expect(x.thevenin.rth.test).toBeCloseTo(rth, 9)
    expect(x.state.tau).toBeCloseTo(rth * p.C1, 15)
    // The empty capacitor is a short: A sees R₂∥R₃ against R₁.
    const r23 = (p.R2 * p.R3) / (p.R2 + p.R3)
    expect(x.tr.at(0).sol.v.A).toBeCloseTo((p.E * r23) / (p.R1 + r23), 9)
    expect(x.tr.at(x.tEnd).sol.v.B / 8).toBeCloseTo(1 - Math.exp(-5), 9)
  })

  it('F5: the source delivers CE² = 144 µJ, the capacitor keeps 72 µJ, the resistor takes 72 µJ — the same at 100 Ω, 1 kΩ and 10 kΩ', () => {
    const heat = []
    for (const R1 of [100, 1000, 10000]) {
      const { p, x } = at('f5', { R1 })
      const e = last(x.energy.points)
      // After ten time constants the charge is complete to e⁻¹⁰: the source
      // has delivered CE²·(1 − e⁻¹⁰), the capacitor holds ½CE²·(1 − e⁻¹⁰)²,
      // and the resistor has the difference. Exact, not "about half".
      const q = 1 - Math.exp(-10)
      expect(e.supplied / (p.C1 * p.E * p.E)).toBeCloseTo(q, 8)
      expect(e.stored / (0.5 * p.C1 * p.E * p.E)).toBeCloseTo(q * q, 8)
      expect((e.dissipated - (e.supplied - e.stored)) / e.supplied).toBeCloseTo(0, 9)
      expect(e.dissipated / e.supplied).toBeCloseTo(0.5, 4)
      heat.push(e.dissipated)
    }
    // "whatever R": the three heats agree far beyond the e⁻¹⁰ tail.
    expect(Math.abs(heat[0] - heat[1]) / heat[1]).toBeLessThan(1e-9)
    expect(Math.abs(heat[2] - heat[1]) / heat[1]).toBeLessThan(1e-9)
  })

  it('F6: I₀ = 12 mA, 1.2 kV across the opening switch, τ = 9.9 µs — a hundred times faster than L/R; ideal → refused', () => {
    const { p, x } = at('f6')
    expect(x.before.x0[0]).toBeCloseTo(p.E / p.R1, 12)
    expect(x.tr.at(0).sol.volt.S1).toBeCloseTo((p.E / p.R1) * p.Roff, 9)
    expect(x.state.tau).toBeCloseTo(p.L1 / (p.R1 + p.Roff), 15)
    expect(p.L1 / p.R1 / x.state.tau).toBeCloseTo(101, 9)
    const ideal = at('f6', { ideal: true }).x
    expect(ideal.sol).toBeNull()
    expect(ideal.refusal.code).toBe('inductor-cutset')
    expect(ideal.refusal.message).toMatch(/cannot change instantly/)
  })

  it('F7: i_in = v_in/R = 100 µA exactly, output slope 1 V/ms, 0.5 V peak to peak; finite gain makes τ = RC(A+1) = 100 s', () => {
    const { p, x } = at('f7')
    const iin = x.tr.series('i', 'R1')
    expect(Math.max(...iin)).toBeCloseTo(p.A / p.R1, 12)
    expect(Math.min(...iin)).toBeCloseTo(-p.A / p.R1, 12)
    // The ideal integrator has no time constant; the state runs at v_in/RC.
    expect(x.state.tau).toBe(Infinity)
    expect(Math.abs(x.tr.at(0.25 * p.T).dxdt[0])).toBeCloseTo(p.A / (p.R1 * p.C1), 9)
    const vout = x.tr.series('v', 'out')
    expect(Math.max(...vout) - Math.min(...vout)).toBeCloseTo((p.A * p.T) / (2 * p.R1 * p.C1), 9)
    const fin = at('f7', { ideal: false }).x
    expect(fin.state.tau).toBeCloseTo(p.R1 * p.C1 * (p.G + 1), 6)
  })

  it('G1: overdamped at 800 Ω — ω₀ = 10⁴, α = 4×10⁴, roots −1.27×10³ and −7.87×10⁴ s⁻¹, and v_C never passes E', () => {
    const { p, x } = at('g1')
    expect(x.state.face).toBe('overdamped')
    expect(x.state.w0).toBeCloseTo(1 / Math.sqrt(p.L1 * p.C1), 9)
    expect(x.state.alpha).toBeCloseTo(p.R1 / (2 * p.L1), 9)
    const re = x.state.roots.map((r) => r.re).sort((a, b) => b - a)
    expect(re[0] / -1270.17).toBeCloseTo(1, 4)
    expect(re[1] / -78729.8).toBeCloseTo(1, 4)
    expect(Math.max(...x.tr.series('volt', 'C1'))).toBeLessThanOrEqual(p.E + 1e-12)
  })

  it('G2: at 200 Ω the roots merge at −10⁴; no overshoot; the current peaks at t = 1/α = 100 µs, E/(Lαe) = 3.68 mA', () => {
    const { p, x } = at('g2')
    expect(x.state.face).toBe('critical')
    for (const r of x.state.roots) expect(r.re).toBeCloseTo(-1e4, 6)
    expect(Math.max(...x.tr.series('volt', 'C1'))).toBeLessThanOrEqual(p.E + 1e-12)
    const pk = peaks(x.tr, 'i', 'L1')[0]
    expect(pk.kind).toBe('max')
    expect(pk.t).toBeCloseTo(1 / x.state.alpha, 9)
    expect(pk.y).toBeCloseTo(p.E / (p.L1 * x.state.alpha * Math.E), 12)
  })

  it('G3: the sweep — no overshoot above 200 Ω, 44 % at 50 Ω, 85 % at the ζ = 0.05 edge, overshoot falling with R, fastest settling near 160 Ω', () => {
    const { exp, p, x } = at('g3')
    const sw = dampingSweep(exp, p)
    expect(sw.Rcrit).toBeCloseTo(2 * Math.sqrt(p.L1 / p.C1), 9)
    const near = (R) => sw.points.reduce((b, q) => (Math.abs(Math.log(q.R / R)) < Math.abs(Math.log(b.R / R)) ? q : b))
    expect(sw.points.filter((q) => q.R > sw.Rcrit * 1.001).every((q) => q.overshoot === 0)).toBe(true)
    expect(near(50).overshoot).toBeGreaterThan(0.43)
    expect(near(50).overshoot).toBeLessThan(0.46)
    expect(sw.points[0].zeta).toBeCloseTo(0.05, 9)
    expect(sw.points[0].overshoot).toBeCloseTo(Math.exp((-Math.PI * 0.05) / Math.sqrt(1 - 0.0025)), 3)
    for (let k = 1; k < sw.points.length; k++) expect(sw.points[k].overshoot).toBeLessThanOrEqual(sw.points[k - 1].overshoot + 1e-12)
    // Settling: falls from the overdamped side down to the fastest, climbs again as the ringing takes over.
    expect(near(1000).settle).toBeGreaterThan(near(300).settle)
    expect(near(300).settle).toBeGreaterThan(sw.fastest.settle)
    expect(near(50).settle).toBeGreaterThan(sw.fastest.settle)
    expect(sw.fastest.R).toBeGreaterThan(155)
    expect(sw.fastest.R).toBeLessThan(165)
    expect(sw.fastest.overshoot).toBeLessThan(0.02)
    expect(sw.fastest.settle / x.damping.at.settle).toBeLessThan(0.7)
    // The knob's own point is a member of the same measurement.
    expect(x.damping.at.R).toBe(p.R1)
    expect(x.damping.at.zeta).toBeCloseTo(2, 12) // 400 Ω: G3 opens on the overdamped side, not at G2's critical point
    expect(x.damping.at.overshoot).toBe(0)
  })

  it('G4: ζ = 0.25, ω_d = 9682 rad/s, first peak 44.4 % over at π/ω_d = 324 µs, each peak the same fraction of the last, Q = 2', () => {
    const { p, x } = at('g4')
    expect(x.state.face).toBe('underdamped')
    expect(x.state.zeta).toBeCloseTo(0.25, 12)
    expect(x.state.wd).toBeCloseTo(Math.sqrt(1e8 - 2500 ** 2), 6)
    expect(x.state.Q).toBeCloseTo(2, 12)
    const maxes = peaks(x.tr, 'volt', 'C1').filter((q) => q.kind === 'max')
    const os = Math.exp((-Math.PI * 0.25) / Math.sqrt(1 - 0.0625))
    expect(maxes[0].y - p.E).toBeCloseTo(os * p.E, 9)
    // The peak is located by refining a bracket on the derivative: a part in 10⁹ of t.
    expect(maxes[0].t / (Math.PI / x.state.wd)).toBeCloseTo(1, 8)
    expect((maxes[1].y - p.E) / (maxes[0].y - p.E)).toBeCloseTo(os * os, 6)
    // The envelope guides drawn on the scope are E ± (ω₀/ω_d)E·e^(−αt), and the waveform never leaves them.
    const m = experimentMath(byId.g4, p, x)
    expect(m.guides.length).toBe(2)
    expect(m.guides[0].f(maxes[0].t) - p.E).toBeCloseTo((x.state.w0 / x.state.wd) * p.E * Math.exp(-x.state.alpha * maxes[0].t), 12)
    const v = x.tr.series('volt', 'C1')
    x.tr.t.forEach((t, k) => {
      expect(v[k]).toBeLessThanOrEqual(m.guides[0].f(t) + 1e-12)
      expect(v[k]).toBeGreaterThanOrEqual(m.guides[1].f(t) - 1e-12)
    })
  })

  it('G5: undamped — v_C swings between 0 and 2E, i peaks at E√(C/L) = 10 mA, nothing is dissipated and stored = supplied throughout', () => {
    const { p, x } = at('g5')
    expect(x.state.face).toBe('undamped')
    const v = x.tr.series('volt', 'C1')
    expect(Math.max(...v)).toBeCloseTo(2 * p.E, 9)
    expect(Math.min(...v)).toBeCloseTo(0, 9)
    expect(Math.max(...x.tr.series('i', 'L1'))).toBeCloseTo(p.E * Math.sqrt(p.C1 / p.L1), 9)
    for (const q of x.energy.points) {
      expect(q.dissipated).toBe(0)
      expect(Math.abs(q.stored - q.supplied)).toBeLessThan(1e-15)
    }
  })

  it('G6: the initial conditions are knobs, the ghost starts from rest, both settle to E and no current, and they differ by a natural response', () => {
    const { p, x } = at('g6')
    expect(x.before.x0).toEqual([p.v0, p.i0])
    expect(x.ghost.x0).toEqual([0, 0])
    expect(x.tr.at(0).sol.volt.C1).toBeCloseTo(p.v0, 12)
    expect(x.tr.at(0).sol.i.L1).toBeCloseTo(p.i0, 12)
    const end = x.tr.at(x.tEnd)
    expect(end.sol.volt.C1).toBeCloseTo(p.E, 3)
    expect(Math.abs(end.sol.i.L1)).toBeLessThan(1e-4)
    // The difference decays inside the e^(−αt) envelope set by its own start, and is gone by the end.
    const alpha = x.state.alpha
    for (const frac of [0.1, 0.3, 0.6, 1]) {
      const t = frac * x.tEnd
      const d = x.tr.at(t).sol.volt.C1 - x.ghost.at(t).sol.volt.C1
      const bound = Math.exp(-alpha * t) * (Math.abs(p.v0) + Math.abs(p.i0) * Math.sqrt(p.L1 / p.C1)) * (1 / Math.sqrt(1 - x.state.zeta ** 2))
      expect(Math.abs(d), `t = ${t}`).toBeLessThanOrEqual(bound + 1e-12)
    }
  })

  it('G7: the dual — α = 1/2RC, ζ = 0.25 at 200 Ω, i_L steps to I with the same 44.4 % overshoot, v rings to zero; critical at 50 Ω', () => {
    const { p, x } = at('g7')
    expect(x.state.face).toBe('underdamped')
    expect(x.state.alpha).toBeCloseTo(1 / (2 * p.R1 * p.C1), 9)
    expect(x.state.zeta).toBeCloseTo(0.25, 12)
    const pk = peaks(x.tr, 'i', 'L1')[0]
    expect((pk.y - p.I) / p.I).toBeCloseTo(Math.exp((-Math.PI * 0.25) / Math.sqrt(1 - 0.0625)), 9)
    expect(x.tr.at(x.tEnd).sol.i.L1).toBeCloseTo(p.I, 4)
    expect(Math.abs(x.tr.at(x.tEnd).sol.v.in)).toBeLessThan(1e-3)
    expect(at('g7', { R1: 50 }).x.state.face).toBe('critical')
    expect(at('g7', { R1: 12.5 }).x.state.face).toBe('overdamped')
  })
})

// ------------------------------------------------------------------ group H
// The phasor-vs-time invariant (plan §1.7) is the exit test for the group: the
// complex solve at jω and the transient started in the forced state must agree
// at every instant, for every state, at every setting. The math panel's
// steadyRows hold it at the cursor for every experiment (tested above at 25
// random settings each); here it is held across whole windows, and the notes'
// own numbers are measured.

const H_IDS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
const period = (x) => (2 * Math.PI) / x.omega

describe('group H: phasor against time', () => {
  it('every H experiment has a complex solve, a forced-start ghost, and an output phasor', () => {
    for (const id of H_IDS) {
      const { exp, x } = at(id)
      expect(x.ac, id).toBeTruthy()
      expect(x.omega, id).toBeCloseTo(2 * Math.PI * defaultsOf(id).f, 9)
      expect(x.ghost, id).toBeTruthy()
      expect(exp.out && x.ac[exp.out.q][exp.out.key], id).toBeTruthy()
      expect(exp.phasor.volts.every((v) => x.ac.volt[v]), id).toBe(true)
    }
  })

  it('the ghost IS the steady state: at 64 instants across the window every state matches Im{X·e^(jωt)} from the phasor solve', () => {
    for (const id of H_IDS) {
      for (const seed of [0, 1, 2]) {
        const exp = byId[id]
        const p = seed ? randomParams(exp, 7000 + seed) : defaultsOf(id)
        const x = analyse(exp, p)
        // The same stiffness allowance the math panel uses: ε·|λ_max|·t_end, never under 1e-12.
        const fastest = Math.max(...x.state.roots.map((r) => Math.hypot(r.re, r.im)))
        const eps = Math.max(1e-12, 1e-16 * fastest * x.tEnd)
        for (let k = 0; k <= 64; k++) {
          const t = (x.tEnd * k) / 64
          const g = x.ghost.at(t).sol
          for (const s of x.dyn.states) {
            const X = s.type === 'C' ? x.ac.volt[s.id] : x.ac.i[s.id]
            const want = cx.instant(X, x.omega, t)
            const got = s.type === 'C' ? g.volt[s.id] : g.i[s.id]
            expect(Math.abs(got - want), `${id} seed ${seed} ${s.id} t=${t}`).toBeLessThanOrEqual(1e-9 * Math.abs(want) + eps * cx.cabs(X))
          }
        }
      }
    }
  })

  it('the transient forgets its start: after the natural response has decayed the real trace lies on the ghost, and it is periodic', () => {
    for (const id of ['h1', 'h2', 'h3', 'h5', 'h6']) {
      const { x } = at(id, { N: 12 })
      // Slowest decay in the circuit; wait 30 of them, or as long as the window allows.
      const slowest = Math.min(...x.state.roots.map((r) => Math.abs(r.re)))
      const t0 = Math.min(x.tEnd - period(x), 30 / slowest)
      const scale = Math.max(...x.dyn.states.map((s) => cx.cabs(s.type === 'C' ? x.ac.volt[s.id] : x.ac.i[s.id])))
      const left = Math.exp(-slowest * t0)
      for (let k = 0; k <= 16; k++) {
        const t = t0 + (period(x) * k) / 16
        const a = x.tr.at(t).sol
        const g = x.ghost.at(t).sol
        for (const s of x.dyn.states) {
          const d = Math.abs((s.type === 'C' ? a.volt[s.id] : a.i[s.id]) - (s.type === 'C' ? g.volt[s.id] : g.i[s.id]))
          expect(d, `${id} ${s.id} t=${t}`).toBeLessThanOrEqual(scale * (left * 10 + 1e-9))
        }
        // One period later the ghost repeats itself exactly.
        const g2 = x.ghost.at(t + period(x))
        if (t + period(x) <= x.tEnd) for (const s of x.dyn.states) expect(Math.abs((s.type === 'C' ? g2.sol.volt[s.id] : g2.sol.i[s.id]) - (s.type === 'C' ? g.volt[s.id] : g.i[s.id])), `${id} periodic`).toBeLessThan(1e-9 * scale)
      }
    }
  })

  it('the phasor diagram’s projection: the tip of X turned by ωt has height Im{X·e^(jωt)} = the instantaneous value', () => {
    const { exp, x } = at('h2')
    for (const t of [0, 0.3e-3, 1.7e-3, x.tEnd]) {
      for (const id of [...exp.phasor.volts, exp.phasor.total]) {
        const X = x.ac.volt[id]
        const tip = cx.cmul(X, cx.cexpj(x.omega * t))
        expect(tip[1]).toBeCloseTo(cx.instant(X, x.omega, t), 12)
        expect(tip[1]).toBeCloseTo(x.ghost.at(t).sol.volt[id], 9)
      }
    }
  })

  it('the meters read a zero crossing as 0, not femtovolts: H6 opens at t = 3 ms, exactly three cycles of 1 kHz', () => {
    const { x } = at('h6', {}, 3e-3)
    expect(Math.abs(x.sol.v.in)).toBeGreaterThan(0)
    expect(Math.abs(x.sol.v.in)).toBeLessThan(1e-13)
    const m = snapNoise(x.sol)
    expect(m.v.in).toBe(0)
    expect(m.v.n1).toBe(x.sol.v.n1) // a real reading is untouched
    expect(Object.keys(m)).toEqual(['v', 'i', 'volt', 'p'])
    // Each kind is scaled by its own largest reading: a 1 fA current beside 1 mA is noise, beside 1 fA it is the reading.
    expect(snapNoise({ v: {}, i: { a: 1e-15, b: 1e-3 }, volt: {}, p: {} }).i).toEqual({ a: 0, b: 1e-3 })
    expect(snapNoise({ v: {}, i: { a: 1e-15, b: 2e-15 }, volt: {}, p: {} }).i).toEqual({ a: 1e-15, b: 2e-15 })
  })
})

describe('the H notes, sentence by sentence', () => {
  it('H1: τ = RC = 1 ms; the difference from the steady state is −v_f(0)e^(−t/τ); under 1 % of |V_C| after 5τ and under 10⁻⁹ after 25τ', () => {
    const { p, x } = at('h1', { N: 8 }) // 8 cycles at 159.2 Hz ≈ 50 ms ≫ 25 ms
    const tau = p.R1 * p.C1
    expect(tau).toBeCloseTo(1e-3, 15)
    expect(x.state.tau).toBeCloseTo(tau, 12)
    const magC = cx.cabs(x.ac.volt.C1)
    const vf0 = cx.instant(x.ac.volt.C1, x.omega, 0)
    const natural = (t) => x.tr.at(t).sol.volt.C1 - x.ghost.at(t).sol.volt.C1
    for (const t of [0, 0.5 * tau, tau, 2 * tau, 4 * tau]) expect(natural(t)).toBeCloseTo(-vf0 * Math.exp(-t / tau), 10)
    expect(Math.abs(natural(5 * tau)) / magC).toBeLessThan(0.01)
    expect(Math.abs(natural(5 * tau)) / magC).toBeCloseTo(Math.exp(-5) * Math.abs(vf0) / magC, 9)
    expect(Math.abs(natural(25 * tau)) / magC).toBeLessThan(1e-9)
    // "The source sets its size but not its shape": v_C lags the source by 45° at f_c, so φ = 135° puts
    // the forced v_C at its peak at t = 0 (largest natural part, |v_f(0)| = |V_C|) and φ = 45° puts it
    // through zero (no natural part at all). Either way the shape is the same e^(−t/τ).
    const q = at('h1', { phi: 135, N: 8 })
    const vf0q = cx.instant(q.x.ac.volt.C1, q.x.omega, 0)
    expect(Math.abs(vf0q)).toBeCloseTo(cx.cabs(q.x.ac.volt.C1), 3)
    expect(Math.abs(vf0q)).toBeGreaterThan(Math.abs(vf0))
    expect(q.x.tr.at(0).sol.volt.C1).toBeCloseTo(0, 12)
    for (const t of [0, tau, 3 * tau]) expect(q.x.tr.at(t).sol.volt.C1 - q.x.ghost.at(t).sol.volt.C1).toBeCloseTo(-vf0q * Math.exp(-t / tau), 10)
    const z = at('h1', { phi: 45, N: 8 })
    expect(Math.abs(cx.instant(z.x.ac.volt.C1, z.x.omega, 0))).toBeLessThan(1e-3 * cx.cabs(z.x.ac.volt.C1))
    expect(Math.abs(z.x.tr.at(tau).sol.volt.C1 - z.x.ghost.at(tau).sol.volt.C1)).toBeLessThan(1e-3 * cx.cabs(z.x.ac.volt.C1))
  })

  it('H2: V_R + V_C = V_s exactly; V_C is 90° behind I; at f_c = 159.2 Hz both are |V_s|/√2 and v_C lags 45°', () => {
    const { p, x } = at('h2')
    const { volt, i } = x.ac
    const sum = cx.cadd(volt.R1, volt.C1)
    expect(cx.cabs(cx.csub(sum, volt.V1))).toBeLessThan(1e-12 * p.A)
    expect(wrapA(cx.carg(volt.C1) - cx.carg(i.R1))).toBeCloseTo(-Math.PI / 2, 12)
    expect(wrapA(cx.carg(volt.R1) - cx.carg(i.R1))).toBeCloseTo(0, 12)
    expect(cx.cabs(volt.C1)).toBeCloseTo(cx.cabs(i.R1) / (x.omega * p.C1), 12)
    // The corner: exact at f = 1/(2πRC), which the chip's 159.2 Hz is not quite — so test at the exact value too.
    const fc = 1 / (2 * Math.PI * p.R1 * p.C1)
    expect(fc).toBeCloseTo(159.15, 2)
    const ex = at('h2', { f: fc }).x
    expect(cx.cabs(ex.ac.volt.C1) / p.A).toBeCloseTo(Math.SQRT1_2, 12)
    expect(cx.cabs(ex.ac.volt.R1) / p.A).toBeCloseTo(Math.SQRT1_2, 12)
    expect(wrapA(cx.carg(ex.ac.volt.C1) - cx.carg(ex.ac.volt.V1))).toBeCloseTo(-Math.PI / 4, 12)
    // At the chip's 159.2 Hz the same to four figures — the note's "exactly 45°" is about f_c, which the chip approximates.
    expect(cx.cabs(volt.C1) / p.A).toBeCloseTo(Math.SQRT1_2, 3)
    expect((wrapA(cx.carg(volt.C1) - cx.carg(volt.V1)) * 180) / Math.PI).toBeCloseTo(-45, 1)
  })

  it('H3: ωL = 62.8 Ω, 1/ωC = 159.2 Ω, X = −96.3 Ω, |Z| = 138.8 Ω, current leads 43.9°, |V_C| = 1.146 V > 1 V; past 1591.5 Hz the current lags and V_L outgrows V_C', () => {
    const { p, x } = at('h3')
    const Z = drivingPointZ(x.ac, 'V1')
    expect(x.omega * p.L1).toBeCloseTo(62.83, 2)
    expect(1 / (x.omega * p.C1)).toBeCloseTo(159.15, 2)
    expect(Z[0]).toBeCloseTo(p.R1, 9)
    expect(Z[1]).toBeCloseTo(-96.3, 1)
    expect(cx.cabs(Z)).toBeCloseTo(138.8, 1)
    const lead = wrapA(cx.carg(x.ac.i.R1) - cx.carg(x.ac.volt.V1))
    expect((lead * 180) / Math.PI).toBeCloseTo(43.9, 1)
    expect(cx.cabs(x.ac.volt.C1)).toBeCloseTo(1.146, 3)
    expect(cx.cabs(x.ac.volt.C1)).toBeGreaterThan(p.A)
    expect(cx.cabs(x.ac.volt.L1)).toBeLessThan(cx.cabs(x.ac.volt.C1))
    expect(Math.abs(wrapA(cx.carg(x.ac.volt.L1) - cx.carg(x.ac.volt.C1)))).toBeCloseTo(Math.PI, 9)
    const hi = at('h3', { f: 2500 }).x
    expect(wrapA(cx.carg(hi.ac.i.R1) - cx.carg(hi.ac.volt.V1))).toBeLessThan(0)
    expect(cx.cabs(hi.ac.volt.L1)).toBeGreaterThan(cx.cabs(hi.ac.volt.C1))
    expect(1 / (2 * Math.PI * Math.sqrt(p.L1 * p.C1))).toBeCloseTo(1591.5, 1)
  })

  it('H4: at ω₀ V_L + V_C = 0, Z = R, current in phase; Q = 20 so |V_C| = 20 V; half-power points 79.6 Hz apart; 1 − 1/e at Q/π = 6.4 cycles; within ¼ % after 40', () => {
    const { p, x } = at('h4')
    const w0 = 1 / Math.sqrt(p.L1 * p.C1)
    const Q = Math.sqrt(p.L1 / p.C1) / p.R1
    expect(Q).toBeCloseTo(20, 12)
    expect(w0 / (2 * Math.PI)).toBeCloseTo(1591.5, 1)
    const at0 = solveAC(x.net, w0, { anyFreq: true })
    expect(cx.cabs(cx.cadd(at0.volt.L1, at0.volt.C1))).toBeLessThan(1e-12 * Q * p.A)
    const Z0 = drivingPointZ(at0, 'V1')
    expect(Z0[0]).toBeCloseTo(p.R1, 9)
    expect(Math.abs(Z0[1])).toBeLessThan(1e-9)
    expect(wrapA(cx.carg(at0.i.R1) - cx.carg(at0.volt.V1))).toBeCloseTo(0, 9)
    expect(cx.cabs(at0.volt.C1)).toBeCloseTo(20, 9)
    // Half-power: |Z| = √2·R at the two frequencies; their gap is R/L in rad/s = f₀/Q in Hz.
    const alpha = p.R1 / (2 * p.L1)
    const hyp = Math.sqrt(alpha * alpha + w0 * w0)
    const wA = (w0 * w0) / (alpha + hyp)
    const wB = alpha + hyp
    for (const w of [wA, wB]) expect(cx.cabs(drivingPointZ(solveAC(x.net, w, { anyFreq: true }), 'V1'))).toBeCloseTo(Math.SQRT2 * p.R1, 9)
    expect((wB - wA) / (2 * Math.PI)).toBeCloseTo(79.58, 1)
    // The impedance sweep shows the dip and the phase crossing.
    const magZ = x.freq.Z.map(cx.cabs)
    const kMin = magZ.indexOf(Math.min(...magZ))
    expect(x.freq.omega[kMin] / w0).toBeCloseTo(1, 1)
    expect(x.freq.Z[Math.max(0, kMin - 20)][1]).toBeLessThan(0) // capacitive below
    expect(x.freq.Z[Math.min(magZ.length - 1, kMin + 20)][1]).toBeGreaterThan(0) // inductive above
    // Build-up: the envelope of v_C grows as 1 − e^(−αt); at t = 1/α the natural part is 1/e of the forced amplitude.
    const T = period(x) // the chip's 1591.5 Hz, which is f₀ to five figures
    expect(1 / alpha / T).toBeCloseTo(Q / Math.PI, 3)
    expect((1 / alpha) * (w0 / (2 * Math.PI))).toBeCloseTo(Q / Math.PI, 9)
    expect(Q / Math.PI).toBeCloseTo(6.37, 2)
    const naturalAmp = (t) => {
      // Largest |natural| over one cycle around t — the envelope, not a sample of it.
      let m = 0
      for (let k = 0; k <= 32; k++) {
        const tt = t + (T * k) / 32
        m = Math.max(m, Math.abs(x.tr.at(tt).sol.volt.C1 - x.ghost.at(tt).sol.volt.C1))
      }
      return m
    }
    expect(naturalAmp(1 / alpha) / (Q * p.A)).toBeCloseTo(Math.exp(-1), 1)
    expect(Math.abs(naturalAmp(1 / alpha) / (Q * p.A) - Math.exp(-1))).toBeLessThan(0.1 * Math.exp(-1))
    // The last cycle of the 40-cycle window: under a quarter of one percent, and not under a fifth.
    const lastCycle = naturalAmp(x.tEnd - T) / (Q * p.A)
    expect(lastCycle).toBeLessThan(0.0025)
    expect(lastCycle).toBeGreaterThan(0.002)
    expect(x.tEnd / T).toBeCloseTo(40, 9)
  })

  it('H5: |I| = 72.8 mA lagging 43.3°; P = 265 mW all in R, P_L = 0; V_rms 7.07 V, I_rms 51.5 mA, 364 mVA, pf 0.728, Q = 250 mvar; p(t) is DC plus 2f only', () => {
    const { p, x } = at('h5')
    const I = x.ac.i.R1
    expect(cx.cabs(I)).toBeCloseTo(72.8e-3, 4)
    expect((wrapA(cx.carg(x.ac.volt.V1) - cx.carg(I)) * 180) / Math.PI).toBeCloseTo(43.3, 1)
    const tab = acTable(x)
    const R = tab.find((e) => e.id === 'R1')
    const L = tab.find((e) => e.id === 'L1')
    const V = tab.find((e) => e.id === 'V1')
    expect(R.P).toBeCloseTo(0.265, 3)
    // The inductor's P is arithmetic noise (femtowatts) and the table reads it as exactly 0, with pf 0 and φ = 90° to match.
    expect(L.P).toBe(0)
    expect(L.pf).toBe(0)
    expect(L.phi).toBeCloseTo(Math.PI / 2, 12)
    expect(R.Q).toBe(0)
    expect(R.pf).toBe(1)
    expect(R.phi).toBe(0)
    expect(cx.cabs(cx.csub(acPower(x.ac.volt.L1, x.ac.i.L1).S, [0, L.Q]))).toBeLessThan(1e-12 * L.apparent)
    expect(V.P).toBeCloseTo(-R.P, 12)
    expect(V.Q).toBeCloseTo(-L.Q, 12)
    expect(p.A / Math.SQRT2).toBeCloseTo(7.07, 2)
    expect(cx.cabs(I) / Math.SQRT2).toBeCloseTo(51.5e-3, 4)
    expect(V.apparent).toBeCloseTo(0.364, 3)
    expect(-V.P / V.apparent).toBeCloseTo(0.728, 3)
    expect(-V.Q).toBeCloseTo(0.25, 2)
    // The instantaneous power on the ghost (steady state): mean = P, and its spectrum has DC and 2f, nothing at f or 3f.
    const T = period(x)
    const n = 64
    const pR = (t) => x.ghost.at(t).sol.p.R1
    const pL = (t) => x.ghost.at(t).sol.p.L1
    const mean = (f) => {
      let s = 0
      for (let k = 0; k < n; k++) s += f((T * (k + 0.5)) / n)
      return s / n
    }
    const harm = (f, m) => Math.hypot(mean((t) => 2 * f(t) * Math.cos(m * x.omega * t)), mean((t) => 2 * f(t) * Math.sin(m * x.omega * t)))
    expect(mean(pR)).toBeCloseTo(R.P, 9)
    expect(Math.abs(mean(pL))).toBeLessThan(1e-9 * R.P)
    expect(harm(pR, 2)).toBeCloseTo(R.apparent, 9)
    expect(harm(pL, 2)).toBeCloseTo(Math.abs(L.Q), 9)
    for (const m of [1, 3, 4]) {
      expect(harm(pR, m)).toBeLessThan(1e-9 * R.P)
      expect(harm(pL, m)).toBeLessThan(1e-9 * R.P)
    }
    // Both power sums are zero for complex power, as for real.
    expect(Math.abs(tab.reduce((a, e) => a + e.P, 0))).toBeLessThan(1e-12)
    expect(Math.abs(tab.reduce((a, e) => a + e.Q, 0))).toBeLessThan(1e-12)
  })

  it('H6: H = 1/(1 + jωRC): −3.01 dB and −45° at f_c = 159.2 Hz, −20 dB per decade above, phase heading for −90°, the marker on the curve', () => {
    const { p, x } = at('h6')
    const tau = p.R1 * p.C1
    const wc = 1 / tau
    expect(wc / (2 * Math.PI)).toBeCloseTo(159.15, 1)
    expect(x.freq.wc).toBeCloseTo(wc, 9)
    const Hat = (w) => {
      const a = solveAC(x.net, w, { anyFreq: true, sources: { V1: 1 } })
      return cx.cdiv(a.volt.C1, a.volt.V1)
    }
    const dB = (z) => 20 * Math.log10(cx.cabs(z))
    expect(dB(Hat(wc))).toBeCloseTo(-3.0103, 4)
    expect((cx.carg(Hat(wc)) * 180) / Math.PI).toBeCloseTo(-45, 9)
    // −20 dB per decade is the asymptote: −19.96 for the first decade above f_c, −19.9996 for the next.
    expect(dB(Hat(100 * wc)) - dB(Hat(10 * wc))).toBeCloseTo(-20, 1)
    expect(dB(Hat(1000 * wc)) - dB(Hat(100 * wc))).toBeCloseTo(-20, 3)
    expect((cx.carg(Hat(100 * wc)) * 180) / Math.PI).toBeCloseTo(-89.4, 1)
    // Well below the corner the output follows the input.
    expect(cx.cabs(Hat(wc / 100))).toBeCloseTo(1, 4)
    // Every sweep point is the closed form.
    x.freq.omega.forEach((w, k) => {
      const want = cx.cdiv(cx.C(1, 0), cx.C(1, w * tau))
      expect(cx.cabs(cx.csub(x.freq.H[k], want))).toBeLessThan(1e-12)
    })
    // The drive marker is the same solve the meters use, at the drive's frequency.
    const d = atDrive(byId.h6, x)
    expect(cx.cabs(cx.csub(d.H, cx.cdiv(x.ac.volt.C1, x.ac.volt.V1)))).toBeLessThan(1e-15)
    expect(dB(d.H)).toBeCloseTo(20 * Math.log10(1 / Math.sqrt(1 + (x.omega * tau) ** 2)), 9)
  })
})

// ---------------------------------------------------------- hand-over (H6)
// Plan §5: an exact mapping to Circuit Lab, tested both ways — the circuit that
// arrives has this circuit's transfer function at every sweep point, and what
// the link carries loads there without a warning and with the same values.

// Every plain RC or series-RLC experiment outside H offers the same exact
// hand-over: F3, F5 and G1–G4 share H's transfer function, component for
// component, and the round-four review asked that the bridge reach them too.
// F4's port sees a divider ahead of its RC, which scales the source by
// R₂/(R₁+R₂) — Circuit Lab's RC template has no such knob, so F4 stays bare.
const HANDOVER_IDS = ['f3', 'f5', 'g1', 'g2', 'g3', 'g4', ...H_IDS]

describe('hand-over to Circuit Lab, both ways', () => {
  const withHandOver = EXPERIMENTS.filter((e) => e.circuitLab)

  it('every eligible experiment offers one, and the mapping names a catalog circuit with the right count of values', () => {
    expect(withHandOver.map((e) => e.id)).toEqual(HANDOVER_IDS)
    for (const e of withHandOver) {
      const m = e.circuitLab(defaultsOf(e.id))
      expect(m.decline, e.id).toBeUndefined()
      expect(CIRCUITS[m.id], `${e.id} → ${m.id}`).toBeTruthy()
      expect(m.values.length, e.id).toBe(CIRCUITS[m.id].params.length)
      expect(CIRCUITS[m.id].outputs.some((o) => o.key === m.output), e.id).toBe(true)
    }
  })

  it('there: Circuit Lab’s transfer function for the mapped circuit equals this lab’s H = V_out/V_s at all 241 sweep points, to 1e-9', () => {
    for (const e of withHandOver) {
      for (const seed of [0, 11, 12]) {
        const p = seed ? randomParams(e, seed) : defaultsOf(e.id)
        const m = e.circuitLab(p)
        if (m.decline) continue
        const x = analyse(e, p)
        const { state } = stateFromLink(parseCircuitLink(buildCircuitLink(m)).patch)
        const tf = transferOf(m.id, state.params, state.output)
        // H5's output is the current i, which Circuit Lab's RL low-pass reads as the voltage across R: v_R = R·i.
        // Every other experiment's output is a plain element voltage — the one the mapping's own output key names
        // (c → C1, r → R1, l → L1) when the experiment does not already say so with `out`.
        const outQ = e.out ? e.out.q : 'volt'
        const outKey = e.out ? e.out.key : { c: 'C1', r: 'R1', l: 'L1' }[m.output]
        const scale = outQ === 'i' ? p.R1 : 1
        // The sweep the impedance/Bode views draw where the experiment has one; the same grid, solved here, where it does not.
        const wc = x.state.n === 1 ? 1 / x.state.tau : x.state.w0
        const omega = x.freq ? x.freq.omega : Array.from({ length: 241 }, (_, k) => wc * 10 ** (-2 + (4 * k) / 240))
        const H = x.freq ? x.freq.H : omega.map((w) => {
          const ac = solveAC(x.net, w, { anyFreq: true, sources: { V1: 1 } })
          return cx.cdiv(ac[outQ][outKey], ac.volt.V1)
        })
        expect(omega.length).toBe(241)
        omega.forEach((w, k) => {
          const f = w / (2 * Math.PI)
          const theirs = evalAtFreq(tf, f)
          const ours = cx.cscale(H[k], scale)
          expect(cx.cabs(cx.csub(theirs, ours)), `${e.id} seed ${seed} f=${f}`).toBeLessThanOrEqual(1e-9 * cx.cabs(theirs) + 1e-15)
        })
      }
    }
  })

  it('back: the link round-trips through Circuit Lab’s parser and catalog check with values identical and no warning', () => {
    for (const e of withHandOver) {
      for (const seed of [0, 21, 22, 23]) {
        const p = seed ? randomParams(e, seed) : defaultsOf(e.id)
        const m = e.circuitLab(p)
        if (m.decline) continue
        const frag = buildCircuitLink({ ...m, from: { app: 'elements', id: e.id, label: e.name } })
        const parsed = parseCircuitLink(frag)
        expect(parsed.warnings, e.id).toEqual([])
        const { state, warnings } = stateFromLink(parsed.patch)
        expect(warnings, `${e.id} seed ${seed}: ${frag}`).toEqual([])
        expect(state.id).toBe(m.id)
        expect(state.output).toBe(m.output)
        expect(state.from).toEqual({ app: 'elements', id: e.id, label: e.name })
        CIRCUITS[m.id].params.forEach((k, i) => expect(state.params[k.key], `${e.id} ${k.key}`).toBe(m.values[i]))
      }
    }
  })

  it('a value Circuit Lab’s knobs cannot hold is declined with the reason, never clamped into a different circuit', () => {
    const m = byId.h5.circuitLab({ ...defaultsOf('h5'), L1: 2 })
    expect(m.decline).toMatch(/1 H/)
    expect(m.id).toBeUndefined()
    const m3 = byId.h3.circuitLab({ ...defaultsOf('h3'), L1: 1.5 })
    expect(m3.decline).toMatch(/1 H/)
    // Everything else in this lab's knob ranges fits Circuit Lab's: R 1–1 MΩ, C 1 pF–1 mF, L up to 1 H.
    for (const e of withHandOver) {
      for (const k of e.params) {
        if (!['Ω', 'H', 'F'].includes(k.unit)) continue
        const c = CIRCUITS[e.circuitLab(defaultsOf(e.id)).id]
        const knob = c.params.find((q) => q.unit === k.unit)
        expect(k.min, `${e.id} ${k.key} min`).toBeGreaterThanOrEqual(knob.min)
        if (k.unit !== 'H') expect(k.max, `${e.id} ${k.key} max`).toBeLessThanOrEqual(knob.max)
      }
    }
  })
})

// Phase 0 of the student review: a claim is not only a number. Notes point at
// other experiments, count unknowns in words, name the reason a circuit is
// refused, and open at an instant — each of those is measured here, because
// the numeric check rows above cannot see any of them (H1 once pointed at the
// wrong experiment, D2 miscounted, A2's refusal was unreachable from the knobs,
// and H2 opened with every phasor lying flat on the axis).
describe('what the student reads is what the solver did', () => {
  /** Everything a student can read on an experiment at its defaults: see, try, why and the whole math panel. */
  const prose = (e) => {
    const p = defaultsOf(e.id)
    const x = analyse(e, p)
    return { p, x, text: `${e.see}\n${e.try.map((t) => t.say).join('\n')}\n${e.why}\n${JSON.stringify(experimentMath(e, p, x).blocks)}` }
  }
  /** Experiment ids named in the prose — element ids and knob keys of the experiment itself (E1, C1…) are not references. */
  const refsIn = (e, x, text) => {
    const own = new Set([...x.net.elements.map((el) => el.id), ...e.params.map((k) => k.key)])
    return [...new Set([...text.matchAll(/\b([A-H][1-9])\b/g)].map((m) => m[1]).filter((t) => !own.has(t)))]
  }
  const hasPart = (t, p, type) => t.net(p).elements.some((el) => el.type === type)
  /** A first-order experiment whose time constant is its R times its C. */
  const isRC = (t, p) => Math.abs(analyse(t, p).state.tau - p.R1 * p.C1) < 1e-9 * p.R1 * p.C1

  it('every cross-reference names an experiment that exists and holds what the sentence says it holds', () => {
    // What each reference leans on, checked against the referenced experiment itself.
    const holds = {
      'c1→E2': (t) => t.params.some((k) => k.key === 'Rin') && t.params.some((k) => k.key === 'Rout'), // "the same ratio returns as E2's own input and output dividers"
      'c2→D5': (t, p) => t.views.includes('thevenin') && t.net(p).elements.filter((el) => el.type === 'R').length === 3, // "the same sum returns as D5's Thévenin resistance"
      'c3→E8': (t) => t.params.some((k) => k.key === 'RL') && t.views.includes('sweep'), // "why, in E8, an op-amp…": the same load sweep, buffered
      'c4→B2': (t, p) => t.net(p).elements.filter((el) => el.type === 'R').length === 2 && t.net(p).elements.length === 3, // "B2’s loop — two resistors in series"
      'e1→E2': (t) => t.terms.includes('opamp') && t.params.some((k) => k.key === 'A'), // "exactly what an op-amp (E2) is": a dependent source with a gain knob
      'e8→C3': (t) => t.params.some((k) => k.key === 'RL') && t.views.includes('sweep'), // "Compare the same sweep in C3"
      'f2→F1': (t, p) => t.params.some((k) => k.key === 'Rs') && hasPart(t, p, 'C'), // "the role R_s played in F1"
      'f4→F3': (t, p) => t.params.map((k) => k.key).join() === 'E,R1,C1,v0,N' && isRC(t, p), // "then it IS F3: τ = RC"
      'f4→D5': (t) => t.views.includes('thevenin'), // "(D5)" for the Thévenin source
      'f7→E5': (t) => t.terms.includes('virtual'), // "The virtual ground (E5)"
      'g2→G3': (t) => t.views.includes('damping'), // "(G3 measures overshoot)"
      'g4→H4': (t) => t.terms.includes('qualityfactor'), // "what H4 calls Q, the quality factor"
      'g6→G4': (t) => t.params.every((k) => !['v0', 'i0'].includes(k.key)), // "the response from rest (G4)": no initial-state knobs
      'h1→F3': (t, p) => hasPart(t, p, 'C') && !hasPart(t, p, 'L') && isRC(t, p), // "the same e^(−t/τ) as F3 with τ = RC"
      'h1→H2': (t) => t.view === 'phasor', // "the phasor views (H2 onward)"
    }
    const seen = []
    for (const e of EXPERIMENTS) {
      const { x, text } = prose(e)
      for (const ref of refsIn(e, x, text)) {
        const target = byId[ref.toLowerCase()]
        expect(target, `${e.id} points at ${ref}, which is not an experiment`).toBeDefined()
        const key = `${e.id}→${ref}`
        expect(holds[key], `${key} is a new cross-reference: say here what it leans on`).toBeDefined()
        expect(holds[key](target, defaultsOf(target.id)), `${key}: ${ref} does not hold what ${e.id} says it does`).toBe(true)
        seen.push(key)
      }
    }
    expect(seen.sort()).toEqual(Object.keys(holds).sort())
    // The bug this catches: F2 is the inductor experiment, so "the same e^(−t/τ) as F2 with τ = RC" was false.
    expect(holds['h1→F3'](byId.f2, defaultsOf('f2'))).toBe(false)
  })

  it('a count of unknowns in words is the count the solver printed', () => {
    const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
    const found = []
    for (const e of EXPERIMENTS) {
      const { x, text } = prose(e)
      if (!x.sol) continue
      const eq = equations(x.sol.norm, x.sol)
      for (const m of text.matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten) unknowns?\b/gi)) {
        const n = words[m[1].toLowerCase()]
        found.push(`${e.id}:${n}`)
        const before = text.slice(Math.max(0, m.index - 40), m.index)
        if (/printed system has $/.test(before)) {
          // Counting the printed system: every unknown in it, node voltages and source currents alike.
          expect(n, `${e.id} says "${m[0]}" but the printed system has ${eq.unknowns.length}`).toBe(eq.unknowns.length)
        } else if (/mesh/i.test(before)) {
          // Counting meshes: independent loops, B − N with N the non-ground nodes.
          expect(n, `${e.id} says "${m[0]}" of meshes`).toBe(x.net.elements.length - x.sol.norm.n)
        } else {
          // Counting hand nodal unknowns: node voltages not pinned to ground by a source.
          const pinned = new Set(x.net.elements.filter((el) => el.type === 'V' && el.nodes.includes('gnd')).flatMap((el) => el.nodes))
          expect(n, `${e.id} says "${m[0]}" of free node voltages`).toBe(x.sol.norm.nodeNames.filter((nm) => !pinned.has(nm)).length)
        }
      }
    }
    expect(found).toEqual(['d1:1', 'd1:1', 'd2:5', 'd3:2', 'i2:1', 'i2:1'])
  })

  it('a refusal reaches the student as a sentence, never as the machine code', () => {
    for (const [id, over] of [['e3', {}], ['a2', { open: true }]]) {
      const { x } = at(id, over)
      expect(x.sol).toBeNull()
      const reason = refusalReason(x.refusal)
      expect(reason).toMatch(/^[A-Z].*\.$/)
      expect(reason).not.toContain(x.refusal.code)
      expect(reason).not.toMatch(/\b[a-z]+-[a-z]+\b/)
      expect(x.refusal.message.startsWith(reason)).toBe(true)
    }
    expect(refusalReason(at('e3').x.refusal)).toBe('U1 has no feedback path from its output to either input.')
    expect(refusalReason(at('a2', { open: true }).x.refusal)).toBe('Node in is fed only by current sources, so the current arriving there has nowhere to go.')
    expect(refusalReason({ message: '' })).toBe('the circuit as drawn has no solution')
  })

  it('every sine experiment opens with the source well off its zero crossing; H2 and H6 at its peak', () => {
    const sines = EXPERIMENTS.filter((q) => q.net(defaultsOf(q.id)).elements.some((el) => el.wave && el.wave.kind === 'sine'))
    expect(sines.map((q) => q.id)).toEqual(['e9', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'i4', 'i5', 'i6', 'i7'])
    for (const e of sines) {
      const { p, x } = at(e.id)
      // The source's own voltage, not a node called "in": the bridge's source
      // floats between two nodes and has no terminal at ground.
      const vs = x.tr.at(x.cursor).sol.volt.V1
      expect(Math.abs(vs) / p.A, `${e.id} opens at t = ${x.cursor} with v_s = ${vs}`).toBeGreaterThanOrEqual(0.5)
    }
    // H2 opens with the source at its peak: at the corner frequency v_R and v_C then each read half of it, so the meters show KVL as 2.5 V + 2.5 V = 5 V.
    const h2 = at('h2')
    expect(turned(h2.x.omega, h2.x.cursor).cycles).toBe(3)
    expect(turned(h2.x.omega, h2.x.cursor).deg).toBeCloseTo(90, 9)
    const m = h2.x.tr.at(h2.x.cursor).sol
    expect(m.v.in).toBeCloseTo(h2.p.A, 9)
    expect(m.volt.R1 / h2.p.A).toBeCloseTo(0.5, 3) // the chip's 159.2 Hz is a hair off the exact corner
    expect(m.volt.C1 / h2.p.A).toBeCloseTo(0.5, 3)
    const h6 = at('h6')
    expect(turned(h6.x.omega, h6.x.cursor).cycles).toBe(3)
    expect(turned(h6.x.omega, h6.x.cursor).deg).toBeCloseTo(90, 9)
    expect(h6.x.tr.at(h6.x.cursor).sol.v.in).toBeCloseTo(h6.p.A, 9)
  })

  it('"turned" reads as cycles plus an angle under 360°, on screen and in the math panel', () => {
    const w = 2 * Math.PI * 100
    expect(turnedLabel(w, 0)).toBe('0.0°')
    expect(turnedLabel(w, 0.00125)).toBe('45.0°')
    expect(turnedLabel(w, 0.01125)).toBe('1 cycle + 45.0°')
    expect(turnedLabel(w, 0.03)).toBe('3 cycles + 0.0°') // once "1080.0°"
    expect(turnedLabel(w, 0.03 - 1e-9)).toBe('3 cycles + 0.0°') // a hair short of the cycle snaps, never "2 cycles + 360.0°"
    const { exp, p, x } = at('h2')
    const t = experimentMath(exp, p, x).blocks.find((b) => b.kind === 'values').rows.find((r) => r.label === 'arrows have turned')
    expect(t.value).toBeCloseTo(90, 9)
    expect(t.note).toBe('after 3 full cycles')
    for (const tc of [0, 0.3, 0.75, 1].map((f) => f * exp.window(p))) {
      const r = experimentMath(exp, p, analyse(exp, p, tc)).blocks.find((b) => b.kind === 'values').rows.find((q) => q.label === 'arrows have turned')
      expect(r.value).toBeGreaterThanOrEqual(0)
      expect(r.value).toBeLessThan(360)
    }
  })
})

// Phase 1 of the student review: the note became three registers — see, try,
// why — and the middle one is a list of knob moves, each with the reading it
// produces. A step's `set` is applied over the defaults, its `at` moves the
// cursor, its `reads` are solved and compared, and then every number-with-unit
// in the sentence has to be one of those readings (or a knob value, or the
// cursor time). The same rule holds for the numbers in `see` and `why`. So a
// lesson cannot quote a value the solver does not produce, and a knob move
// cannot name a setting the knob cannot reach.
describe('every lesson is measured', () => {
  const PREFIX = { p: 1e-12, n: 1e-9, 'µ': 1e-6, u: 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9, '': 1 }
  const UNITS = /(-?\d+(?:\.\d+)?)\s*([pnµumkMG]?)(VA|var|V|A|W|Ω|s|Hz|J|°|%|dB|rad\/s)(?![A-Za-z⁰¹²³⁴⁵⁶⁷⁸⁹⁻])/g
  /** Every number-with-unit in a sentence, as { text, value, scale } with the value in base units. */
  const quoted = (text) =>
    [...text.replace(/−/g, '-').matchAll(UNITS)].map((m) => ({
      text: m[0].trim(),
      digits: (m[1].split('.')[1] || '').length,
      scale: PREFIX[m[2]],
      value: Math.abs(+m[1]) * PREFIX[m[2]],
    }))
  /** A quoted number stands for a value when it is that value rounded to the digits printed (or within 0.6 %). */
  const stands = (q, v) => {
    const half = 0.5 * 10 ** -q.digits * q.scale
    return Math.abs(q.value - Math.abs(v)) <= Math.max(0.006 * Math.abs(v), half * (1 + 1e-9))
  }
  const close = (got, want, tol) => (want === 0 || Math.abs(want) < 1e-12 ? Math.abs(got) <= (tol ?? 1e-9) : Math.abs(got - want) <= (tol ?? 0.006 * Math.abs(want)))
  const words = (s) => s.trim().split(/\s+/).length
  const knobOf = (e, key) => e.params.find((k) => k.key === key)

  /** Solve one step (or the see/why register) and check its reads; returns the numbers it justifies. */
  function measure(e, p, reads, cursor, label) {
    const x = analyse(e, p, cursor)
    const again = (over, t) => analyse(e, { ...p, ...over }, t ?? cursor)
    expect(x.sol, `${label}: the circuit has no solution here (${x.refusal && x.refusal.code})`).toBeTruthy()
    const values = []
    for (const [q, want, tol] of reads) {
      const name = typeof q === 'function' ? 'fn' : q
      const got = typeof q === 'function' ? q(x, p, again, e) : readQuantity(x, p, q, e)
      if (typeof want === 'string') expect(got, `${label}: ${name}`).toBe(want)
      else {
        expect(Number.isFinite(got), `${label}: ${name} is ${got}`).toBe(true)
        expect(close(got, want, tol), `${label}: ${name} reads ${got}, the lesson says ${want}`).toBe(true)
        values.push(want)
      }
    }
    return values
  }
  /** Every quoted number in `text` stands for one of `values`. */
  function justified(text, values, label) {
    for (const q of quoted(text)) {
      const ok = values.some((v) => stands(q, v))
      expect(ok, `${label}: "${q.text}" is not a reading, a knob value or the cursor time (have ${values.map((v) => +v.toPrecision(5)).join(', ')})`).toBe(true)
    }
  }
  const knobValues = (e) => e.params.filter((k) => !k.kind).map((k) => k.default)

  it('every experiment has a see, two to four tries and a why, and note is see + why', () => {
    for (const e of EXPERIMENTS) {
      expect(typeof e.see, e.id).toBe('string')
      expect(typeof e.why, e.id).toBe('string')
      expect(e.try.length, `${e.id} tries`).toBeGreaterThanOrEqual(2)
      expect(e.try.length, `${e.id} tries`).toBeLessThanOrEqual(4)
      expect(e.note).toBe(`${e.see} ${e.why}`)
      // The first screen on a phone holds the picture and this paragraph; keep it a paragraph.
      expect(words(e.see), `${e.id} see is ${words(e.see)} words`).toBeLessThanOrEqual(70)
      for (const t of e.try) expect(words(t.say), `${e.id} try "${t.say.slice(0, 30)}…" is ${words(t.say)} words`).toBeLessThanOrEqual(45)
    }
  })

  it('the numbers in see and why are readings at the defaults, or knob values', () => {
    for (const e of EXPERIMENTS) {
      const p = defaultsOf(e.id)
      const seeAt = e.seeAt ?? (isDynamic(e) ? e.cursor * e.window(p) : undefined)
      if (e.seeRefuses) {
        expect(analyse(e, p).sol, `${e.id} see says it refuses`).toBeNull()
        justified(e.see, knobValues(e), `${e.id} see`)
        justified(e.why, knobValues(e), `${e.id} why`)
        continue
      }
      const seen = measure(e, p, e.seeReads || [], seeAt, `${e.id} see`)
      justified(e.see, [...seen, ...knobValues(e), ...(e.seeAt != null ? [e.seeAt] : [])], `${e.id} see`)
      const why = measure(e, p, e.whyReads || [], seeAt, `${e.id} why`)
      justified(e.why, [...why, ...knobValues(e)], `${e.id} why`)
    }
  })

  it('every try sets knobs inside their range, moves the cursor inside the window, and reads what it says', () => {
    let steps = 0
    let refusals = 0
    for (const e of EXPERIMENTS) {
      const d = defaultsOf(e.id)
      e.try.forEach((t, i) => {
        const label = `${e.id} try ${i + 1}`
        const values = []
        for (const [key, v] of Object.entries(t.set || {})) {
          const k = knobOf(e, key)
          expect(k, `${label} sets ${key}, which is not a knob`).toBeDefined()
          if (k.kind === 'toggle') expect(typeof v, `${label} ${key}`).toBe('boolean')
          else if (k.kind === 'choice') expect(k.options.map((o) => o.value), `${label} ${key}`).toContain(v)
          else {
            expect(v, `${label} ${key} below min`).toBeGreaterThanOrEqual(k.min)
            expect(v, `${label} ${key} above max`).toBeLessThanOrEqual(k.max)
            values.push(v)
          }
        }
        const p = { ...d, ...(t.set || {}) }
        if (t.at != null) {
          expect(isDynamic(e), `${label} moves the cursor of a DC experiment`).toBe(true)
          expect(t.at).toBeGreaterThanOrEqual(0)
          expect(t.at, `${label} cursor past the window`).toBeLessThanOrEqual(e.window(p))
          values.push(t.at)
        }
        if (t.refuses) {
          const x = analyse(e, p, t.at)
          expect(x.sol, `${label} says the solver refuses; it did not`).toBeNull()
          expect(refusalReason(x.refusal)).toMatch(/^[A-Z]/)
          refusals++
        } else values.push(...measure(e, p, t.reads || [], t.at, label))
        justified(t.say, [...values, ...knobValues(e)], label)
        steps++
      })
    }
    expect(steps).toBeGreaterThanOrEqual(2 * EXPERIMENTS.length)
    expect(refusals).toBe(2) // A2 open, F6 ideal
  })

  // The app never resets a knob between steps: App.jsx's `pick` merges each
  // step's `set` into whatever `params` already holds, and the cursor only
  // moves when a step names an `at`. So a step's claim is authored and tested
  // above as "the defaults, plus this step's own set" — but a student reads it
  // after doing every earlier step in the same try array, in order, with
  // nothing reset. This test plays the try array the way a student does: it
  // carries params and cursor forward from step to step, and requires each
  // step's own claim to still hold under that accumulated state. A step whose
  // reading depends on a knob (or the ideal/toggle state) an earlier step
  // touched, without setting it back itself, fails here even though the
  // isolated test above passes.
  it("a step's claim survives doing the earlier steps first, not just the defaults", () => {
    let checked = 0
    for (const e of EXPERIMENTS) {
      let p = defaultsOf(e.id)
      let cursor
      e.try.forEach((t, i) => {
        p = { ...p, ...(t.set || {}) }
        if (t.at != null) cursor = t.at
        const label = `${e.id} try ${i + 1}, done in order from step 1 (knobs not reset)`
        if (t.refuses) {
          const x = analyse(e, p, cursor)
          expect(x.sol, `${label}: the note says the solver refuses here`).toBeNull()
        } else {
          measure(e, p, t.reads || [], cursor, label)
        }
        checked++
      })
    }
    expect(checked).toBeGreaterThanOrEqual(2 * EXPERIMENTS.length)
  })

  it('readQuantity reads every kind of path, and throws on a path it does not know', () => {
    const b1 = at('b1')
    expect(readQuantity(b1.x, b1.p, 'v.A', b1.exp)).toBeCloseTo(b1.x.sol.v.A, 12)
    expect(readQuantity(b1.x, b1.p, 'vd.in.A', b1.exp)).toBeCloseTo(b1.x.sol.volt.R1, 12)
    expect(() => readQuantity(b1.x, b1.p, 'nope.A', b1.exp)).toThrow(/unknown quantity path/)
    const h2 = at('h2')
    expect(readQuantity(h2.x, h2.p, 'lead.volt.C1', h2.exp)).toBeCloseTo(-45, 1)
    expect(readQuantity(h2.x, h2.p, 'deg.volt.V1', h2.exp)).toBeCloseTo(0, 9)
    expect(readQuantity(h2.x, h2.p, 'period', h2.exp)).toBeCloseTo(1 / h2.p.f, 12)
    const h6 = at('h6')
    expect(readQuantity(h6.x, h6.p, 'H.mag', h6.exp)).toBeCloseTo(cx.cabs(atDrive(h6.exp, h6.x).H), 12)
    expect(readQuantity(h6.x, h6.p, 'Z.deg', h6.exp)).toBeCloseTo((cx.carg(atDrive(h6.exp, h6.x).Z) * 180) / Math.PI, 12)
    const h5 = at('h5')
    const S = readQuantity(h5.x, h5.p, 'ac.S', h5.exp)
    const P = readQuantity(h5.x, h5.p, 'ac.P', h5.exp)
    const Q = readQuantity(h5.x, h5.p, 'ac.Q', h5.exp)
    expect(Math.hypot(P, Q)).toBeCloseTo(S, 9)
    expect(readQuantity(h5.x, h5.p, 'ac.pf', h5.exp)).toBeCloseTo(P / S, 12)
    // Real power is what the resistor takes: ½R|I|²; reactive is what the inductor borrows: ½ωL|I|².
    expect(P).toBeCloseTo(0.5 * h5.p.R1 * cx.cabs(h5.x.ac.i.R1) ** 2, 9)
    expect(Q).toBeCloseTo(0.5 * h5.x.omega * h5.p.L1 * cx.cabs(h5.x.ac.i.R1) ** 2, 9)
    const f5 = at('f5', {}, 0.01)
    const E = readQuantity(f5.x, f5.p, 'energy.supplied', f5.exp)
    expect(E).toBeCloseTo(readQuantity(f5.x, f5.p, 'energy.stored', f5.exp) + readQuantity(f5.x, f5.p, 'energy.dissipated', f5.exp), 9)
  })
})

describe('the knobs are named after the drawing', () => {
  // A knob label that names an element uses the drawing's name for it: V₁ for
  // the source drawn V1, R_L for RL. The matrix still writes E₁ for the source's
  // voltage — that is the symbol for what it holds, and the legend says so —
  // but a knob is a handle on a part, and the part has one name.
  const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' }
  const tokenOf = (id) => {
    const { sym, sub } = schematicGeometry.labelParts({ id })
    return sub ? (/^\d+$/.test(sub) ? sym + [...sub].map((d) => SUB[d]).join('') : `${sym}_${sub}`) : sym
  }
  const TOKEN = /(?<![A-Za-z])([VIRLCSE])(?:_([A-Za-z]+)|([₀-₉]+))?(?![A-Za-z])/g

  it('every element token in a knob label is drawn on the schematic', () => {
    for (const e of EXPERIMENTS) {
      const ids = drawables(e.net(defaultsOf(e.id))).map((d) => d.id)
      const drawn = new Set(ids.map(tokenOf))
      const count = (letter) => ids.filter((id) => tokenOf(id)[0] === letter).length
      for (const k of e.params) {
        const label = k.label
        for (const m of label.matchAll(TOKEN)) {
          const token = m[0]
          const plain = !m[2] && !m[3]
          if (k.of) {
            // A property of one element (F6's R_off of S₁): the element is named.
            expect(drawn.has(tokenOf(k.of)), `${e.id} knob “${label}” is of ${k.of}, which is not drawn`).toBe(true)
            expect(label.includes(tokenOf(k.of)), `${e.id} knob “${label}” should name ${tokenOf(k.of)}`).toBe(true)
            continue
          }
          // A bare R, L or C is fine when the drawing has exactly one of that letter.
          if (plain && 'RLC'.includes(token) && count(token) === 1) continue
          expect(drawn.has(token), `${e.id} knob “${label}” names ${token}, but the drawing has ${[...drawn].join(', ')}`).toBe(true)
        }
      }
    }
  })

  it('no knob is called E: the source on the drawing is V₁', () => {
    for (const e of EXPERIMENTS) {
      for (const k of e.params) expect(k.label, `${e.id} knob ${k.key}`).not.toMatch(/(?<![A-Za-z])E(?![A-Za-z])|E[₀-₉]/)
    }
  })

  it('preset chips carry the knob’s unit and set exactly the value they show', () => {
    let seen = 0
    for (const e of EXPERIMENTS) {
      for (const k of e.params) {
        if (!k.presets) continue
        for (const p of k.presets) {
          seen++
          expect(typeof p.value).toBe('number')
          expect(p.value).toBeGreaterThanOrEqual(k.min)
          expect(p.value).toBeLessThanOrEqual(k.max)
          expect(p.label, `${e.id} ${k.key}`).toBe(fmt(p.value, k.unit, 3))
          expect(p.label.endsWith(k.unit)).toBe(true)
        }
      }
    }
    expect(seen).toBeGreaterThanOrEqual(15)
  })

  it('E3’s op-amp is a switch, ideal by default: ideal refuses, finite gain solves with that gain', () => {
    const e3 = byId.e3
    const sw = e3.params.find((k) => k.key === 'ideal')
    expect(sw.kind).toBe('toggle')
    expect(sw.default).toBe(true)
    expect(e3.params.find((k) => k.key === 'A').default).toBe(1e5)
    expect(at('e3').x.refusal.code).toBe('opamp-open-loop')
    const fin = at('e3', { ideal: false, A: 2000 }).x
    expect(fin.sol.v.out).toBeCloseTo(2000 * 0.001, 9)
    // Every lesson step that asks for finite gain flips the switch.
    for (const t of e3.try) if (t.set && 'A' in t.set) expect(t.set.ideal).toBe(false)
  })
})

// ── Phase 2: the headline, the callout, the bridge, the theorem drawings ──────
//
// Every experiment leads with one number. Each is restated here in closed form
// from the knobs alone, so the headline cannot drift from the circuit; the
// callout that carries it onto the schematic must never outgrow the stand-in
// the layout was checked with; and each theorem drawing is measured against
// the theorem it illustrates.

const par = (...rs) => 1 / rs.reduce((a, r) => a + 1 / r, 0)

/** The headline of every experiment, from the knobs — the solver never consulted. */
const HEADLINE_CLOSED = {
  a1: (p) => p.E / p.R1,
  a2: (p) => p.I * p.R1,
  a3: (p) => (p.E * p.R1) / (p.R1 + p.R2),
  a4: (p) => (p.E1 - p.E2) ** 2 / p.R1,
  b1: (p) => (p.E - p.E / p.R1 / (1 / p.R1 + 1 / p.R2 + 1 / p.R3)) / p.R1,
  b2: (p) => p.E / (p.R1 + p.R2),
  b3: (p) => -(p.E ** 2) / (p.R1 + p.R2 + p.R3),
  b4: (p) => (p.E1 - p.E2) / p.R1,
  c1: (p) => p.R1 + p.R2 + p.R3,
  c2: (p) => par(p.R1, p.R2, p.R3),
  c3: (p) => (p.E * par(p.R2, p.RL)) / (p.R1 + par(p.R2, p.RL)),
  c4: (p) => (p.E * p.R4) / (p.R3 + p.R4) - (p.E * p.R2) / (p.R1 + p.R2),
  d1: (p) => p.E / p.R1 / (1 / p.R1 + 1 / p.R2 + 1 / p.R3),
  // Supernode {A, B} with v_B = v_A − E₂: (E₁ − v_A)/R₁ = v_A/R₂ + v_B/R₃.
  d2: (p) => (p.E1 / p.R1 + p.E2 / p.R3) / (1 / p.R1 + 1 / p.R2 + 1 / p.R3) - p.E2,
  // Two meshes, Cramer's rule.
  d3: (p) => {
    const a = p.R1 + p.R2
    const b = -p.R2
    const c = -p.R2
    const d = p.R2 + p.R3
    const det = a * d - b * c
    return (p.E1 * d - b * -p.E2) / det
  },
  d4: (p) => (p.E1 / p.R1 + p.I1) / (1 / p.R1 + 1 / p.R2),
  d5: (p) => par(p.R1, p.R2, p.R3),
  d6: (p) => (p.E ** 2 * p.RL) / (p.Rs + p.RL) ** 2,
  e1: (p) => p.A * p.E,
  e2: (p) => (((p.A * p.E * p.Rin) / (p.Rs + p.Rin)) * p.RL) / (p.Rout + p.RL),
  e3: (p) => (p.ideal ? null : p.A * p.E),
  e4: (p) => {
    const G = 1 + p.Rf / p.Rg
    return (G * p.E) / (1 + G / p.A)
  },
  e5: (p) => (-p.Rf / p.Rg) * p.E,
  e6: (p) => -p.Rf * (p.E1 / p.R1 + p.E2 / p.R2),
  e7: (p) => ((p.E2 * p.R4) / (p.R3 + p.R4)) * (1 + p.R2 / p.R1) - (p.R2 / p.R1) * p.E1,
  e8: (p) => (p.E * p.R2) / (p.R1 + p.R2),
  f1: (p, x) => alternating((p.C1 * 4 * p.A) / p.T, p.Rs * p.C1, p.T, x.cursor),
  f2: (p, x) => alternating((p.L1 * 4 * p.A) / p.T, p.L1 / p.Rp, p.T, x.cursor),
  f3: (p) => p.R1 * p.C1,
  f4: (p) => (p.R3 + par(p.R1, p.R2)) * p.C1,
  f5: (p, x) => {
    const vC = p.E * (1 - Math.exp(-x.cursor / (p.R1 * p.C1)))
    return p.C1 * p.E * vC - 0.5 * p.C1 * vC ** 2
  },
  f6: (p) => (p.E / p.R1) * (p.ideal ? Infinity : p.Roff),
  f7: (p, x) => integrated(p.A, p.T, p.R1 * p.C1, p.ideal ? Infinity : p.G, x.cursor),
  g1: (p) => (p.R1 / 2) * Math.sqrt(p.C1 / p.L1),
  g2: (p) => (p.R1 / 2) * Math.sqrt(p.C1 / p.L1),
  g3: (p) => (p.R1 / 2) * Math.sqrt(p.C1 / p.L1),
  g4: (p) => {
    const d = 1 / (p.L1 * p.C1) - (p.R1 / (2 * p.L1)) ** 2
    return d > 0 ? Math.sqrt(d) : 0 // no ringing once overdamped
  },
  g5: (p) => 1 / Math.sqrt(p.L1 * p.C1),
  g6: (p) => p.v0,
  g7: (p) => 2 * p.R1 * p.C1,
  h1: (p) => p.R1 * p.C1,
  h2: (p) => Math.abs(p.A) / Math.sqrt(1 + (2 * Math.PI * p.f * p.R1 * p.C1) ** 2),
  h3: (p) => {
    const w = 2 * Math.PI * p.f
    return Math.sqrt(p.R1 ** 2 + (w * p.L1 - 1 / (w * p.C1)) ** 2)
  },
  h4: (p) => 1 / (2 * Math.PI * Math.sqrt(p.L1 * p.C1)),
  h5: (p) => {
    const w = 2 * Math.PI * p.f
    return (0.5 * p.R1 * p.A ** 2) / (p.R1 ** 2 + (w * p.L1) ** 2)
  },
  h6: (p) => 20 * Math.log10(1 / Math.sqrt(1 + (2 * Math.PI * p.f * p.R1 * p.C1) ** 2)),
  // ---- the piecewise groups. V_f is the diode default, 0.7 V.
  e9: (p) => (p.Vsat * p.R1) / (p.R1 + p.R2),
  // A blocking diode passes nothing, so the node it feeds sits at the source.
  i1: (p) => (p.E > 0.7 ? 0.7 : p.E),
  // The exponential has no elementary inverse; bisection on the same two
  // equations is a genuinely different method from the solver's Newton.
  i2: (p) => {
    const nvt = 0.025851999786435535
    const is = 1e-14
    const f = (v) => is * (Math.exp(v / nvt) - 1) - (p.E - v) / p.R1
    let a = Math.min(p.E, 0) - 1
    let b = Math.max(p.E, 1)
    for (let k = 0; k < 300; k++) {
      const c = (a + b) / 2
      if (f(a) < 0 === f(c) < 0) a = c
      else b = c
    }
    return is * (Math.exp((a + b) / 2 / nvt) - 1)
  },
  i3: (p) => Math.max(-0.7, Math.min(0.7, p.E)),
  // Mean of (V_p sin θ − V_f) over the window the diode conducts.
  i4: (p) => {
    const A = Math.abs(p.A)
    if (A <= 0.7) return 0
    const phi = Math.asin(0.7 / A)
    return (2 * A * Math.cos(phi) - 0.7 * (Math.PI - 2 * phi)) / (2 * Math.PI)
  },
  // The same, both halves and two drops — hence twice over, and 2V_f.
  i5: (p) => {
    const A = Math.abs(p.A)
    if (A <= 1.4) return 0
    const phi = Math.asin(1.4 / A)
    return (2 * A * Math.cos(phi) - 1.4 * (Math.PI - 2 * phi)) / Math.PI
  },
  // While the diode blocks, the capacitor sees only the load: the fall across
  // that gap is exactly V_top(1 − e^(−Δt/RC)), whatever the source is doing.
  i6: (p, x) => {
    const off = x.tr.runs.filter((r) => r.regions.D1 === 'off' && r.t1 > r.t0 && r.t1 < x.tEnd)
    const last = off[off.length - 1]
    if (!last) return 0
    const top = x.tr.at(last.t0).sol.v.out
    return top * (1 - Math.exp(-(last.t1 - last.t0) / (p.RL * p.C1)))
  },
  i7: (p) => Math.min(Math.abs(p.A), p.Vref + 0.7),
  // Regulated at V_z while the divider would have gone above it; an ordinary
  // divider below the knee.
  i8: (p) => Math.max(-0.7, Math.min(p.Vz, (p.E * p.RL) / (p.RS + p.RL))),
}

const closeRel = (got, want, rel, msg) => {
  if (!Number.isFinite(want)) return expect(got, msg).toBe(want)
  expect(Math.abs(got - want), `${msg}: got ${got}, want ${want}`).toBeLessThanOrEqual(rel * Math.max(Math.abs(want), 1e-300))
}

describe('the headline number', () => {
  it('every experiment has one, and its closed form matches the solve at the defaults and at random settings', () => {
    for (const exp of EXPERIMENTS) {
      const h = exp.headline
      expect(h, exp.id).toBeTruthy()
      expect(h.label.length, `${exp.id} label`).toBeGreaterThan(8)
      expect(HEADLINE_CLOSED[exp.id], `${exp.id} closed form`).toBeTypeOf('function')
      // i5's diodes leak by design; i6's ripple can be attovolts; i7 reads a
      // peak off the drawn samples. Each is right to a part in ten thousand.
      const tol = ['i5', 'i6', 'i7'].includes(exp.id) ? 1e-4 : isDynamic(exp) ? 1e-6 : 1e-9
      const settings = [defaultsOf(exp.id), ...Array.from({ length: 25 }, (_, k) => randomParams(exp, k * 7919 + 17))]
      for (const p of settings) {
        const x = analyse(exp, p)
        const want = HEADLINE_CLOSED[exp.id](p, x)
        const got = headlineValue(h, x, p)
        if (want === null) {
          expect(got, `${exp.id} refuses`).toBeNull()
          expect(h.refused, `${exp.id} explains its refusal`).toBeTypeOf('string')
          continue
        }
        expect(got, `${exp.id} has a value`).not.toBeNull()
        // Decibels are a log: a level near 0 dB carries no relative scale, so they are held to 1e-7 dB.
        if (h.unit === 'dB') expect(Math.abs(h.value(x, p) - want), exp.id).toBeLessThanOrEqual(1e-7)
        else closeRel(h.value(x, p), want, tol, exp.id)
        // The printed form is the lab's own three-figure format of the same number.
        if (h.plain) {
          const raw = h.value(x, p)
          if (Number.isFinite(raw)) {
            const text = h.unit === 'dB' ? raw.toFixed(1).replace('-0.0', '0.0') : Number(raw.toPrecision(3)).toString()
            expect(got).toBe(text.replace('-', '−') + (h.unit ? ` ${h.unit}` : ''))
          }
        } else expect(got).toBe(num(h.value(x, p), h.unit, 3))
      }
    }
  })

  it('E3 refuses at the defaults and reads A·V₁ with finite gain; F6 reads I₀·R_off', () => {
    expect(headlineValue(byId.e3.headline, at('e3').x, at('e3').p)).toBeNull()
    const { x, p } = at('e3', { ideal: false })
    expect(headlineValue(byId.e3.headline, x, p)).toBe(num(p.A * p.E, 'V', 3))
    const f6 = at('f6')
    closeRel(f6.exp.headline.value(f6.x, f6.p), (f6.p.E / f6.p.R1) * f6.p.Roff, 1e-6, 'f6')
    expect(headlineValue(byId.f6.headline, at('f6', { ideal: true }).x, at('f6', { ideal: true }).p)).toBeNull()
  })

  it('the callout sits on the schematic beside the element it reads, and never outgrows the stand-in the layout was checked with', () => {
    for (const exp of EXPERIMENTS) {
      const h = exp.headline
      const callouts = exp.layout.items.filter((it) => it.callout)
      if (!h.where) {
        expect(callouts, `${exp.id} has no anchor, so no callout`).toHaveLength(0)
        continue
      }
      expect(callouts, exp.id).toHaveLength(1)
      const it = callouts[0]
      expect(it.text).toBe(calloutStandIn(h))
      expect(it.className).toBe('sch-callout')
      // Inside the crop the layout was measured with.
      const [cx0, cy0, cw, ch] = exp.layout.crop
      expect(it.x, `${exp.id} callout x`).toBeGreaterThanOrEqual(cx0)
      expect(it.x, `${exp.id} callout x`).toBeLessThanOrEqual(cx0 + cw)
      expect(it.y, `${exp.id} callout y`).toBeGreaterThanOrEqual(cy0)
      expect(it.y, `${exp.id} callout y`).toBeLessThanOrEqual(cy0 + ch)
      const settings = [defaultsOf(exp.id), ...Array.from({ length: 25 }, (_, k) => randomParams(exp, k * 7919 + 17))]
      for (const p of settings) {
        const x = analyse(exp, p)
        const live = calloutText(h, x, p)
        if (live === null) continue
        expect(live.startsWith(`${h.tag} = `)).toBe(true)
        expect(live.length, `${exp.id}: "${live}" wider than "${it.text}"`).toBeLessThanOrEqual(it.text.length)
      }
    }
  })

  it('D3’s mesh arrows carry the live currents, in a text no wider than their stand-in', () => {
    const d3 = byId.d3
    const arrows = d3.layout.items.filter((it) => it.live)
    expect(arrows.map((a) => a.live.key)).toEqual(['R1', 'R3'])
    for (const a of arrows) expect(a.text).toBe(`${a.live.prefix}−1.23 mV`)
    for (const p of [defaultsOf('d3'), ...Array.from({ length: 25 }, (_, k) => randomParams(d3, k * 7919 + 17))]) {
      const x = analyse(d3, p)
      for (const a of arrows) {
        const text = a.live.prefix + num(x.sol[a.live.q][a.live.key], a.live.unit, 3)
        expect(text.length, `${text} vs ${a.text}`).toBeLessThanOrEqual(a.text.length)
      }
    }
  })

  it('the stand-in is the widest value each unit can print', () => {
    for (const exp of EXPERIMENTS) {
      const h = exp.headline
      const w = widestValue(h)
      if (h.plain) expect(w).toBe(h.unit === 'dB' ? '−123.4 dB' : '−0.00123')
      else {
        expect(w).toBe(`−1.23 m${h.unit}`)
        // Three significant figures with a prefix is never wider than the stand-in.
        for (const v of [-1.23e-3, 9.99e-3, -123e3, 1e-12, 999e9]) expect(num(v, h.unit, 3).length).toBeLessThanOrEqual(w.length)
      }
    }
  })
})

describe('the bridge and the default view', () => {
  it('every experiment×view has a bridge: the view’s lead, then the first sentence of the lesson', () => {
    for (const exp of EXPERIMENTS) {
      const first = firstSentence(exp.see)
      expect(first.length, `${exp.id} first sentence`).toBeGreaterThan(20)
      expect(exp.see.startsWith(first)).toBe(true)
      for (const view of exp.views) {
        const b = bridgeText(exp, view)
        expect(b.startsWith(VIEW_LEADS[view]), `${exp.id}/${view}`).toBe(true)
        expect(b.endsWith(first), `${exp.id}/${view}`).toBe(true)
      }
    }
    expect(firstSentence('Two states now — v_C = 1.5 V. Then more.')).toBe('Two states now — v_C = 1.5 V.')
    expect(() => bridgeText(byId.a1, 'nonesuch')).toThrow(/no bridge lead/)
  })

  it('no experiment before Group G opens on the equations; D5 opens on the equivalent, G1 on the scope', () => {
    for (const exp of EXPERIMENTS) {
      expect(exp.views.includes(exp.view), exp.id).toBe(true)
      if (GROUPS.indexOf(exp.group) < 6) expect(exp.view, exp.id).not.toBe('equations')
    }
    expect(byId.d5.view).toBe('equivalent')
    expect(byId.g1.view).toBe('scope')
    // Groups A–E all carry the reading view, first.
    for (const exp of EXPERIMENTS) if (GROUPS.indexOf(exp.group) < 5) expect(exp.views[0], exp.id).toBe('reading')
  })
})

describe('the theorem drawings', () => {
  it('B2: the KVL loop’s terms sum to zero, source rise against two drops', () => {
    for (const p of [defaultsOf('b2'), ...Array.from({ length: 25 }, (_, k) => randomParams(byId.b2, k * 7919 + 17))]) {
      const x = analyse(byId.b2, p)
      const loop = kvlLoop(byId.b2.theorem, x.sol)
      expect(loop.terms.map((t) => t.id)).toEqual(['V1', 'R1', 'R2'])
      expect(loop.terms[0].value).toBeCloseTo(p.E, 9)
      expect(Math.abs(loop.sum)).toBeLessThan(1e-9 * Math.abs(p.E))
    }
    expect(theoremShows(byId.b2, 'reading')).toBe(true)
    expect(theoremShows(byId.b2, 'power')).toBe(false)
    expect(theoremShows(byId.a1, 'reading')).toBe(false)
  })

  it('D3: both mesh rows balance with the solved currents, and i₁ is the headline', () => {
    for (const p of [defaultsOf('d3'), ...Array.from({ length: 25 }, (_, k) => randomParams(byId.d3, k * 7919 + 17))]) {
      const x = analyse(byId.d3, p)
      const m = meshRows(p, x.sol)
      expect(m.rows).toHaveLength(2)
      for (const r of m.rows) closeRel(r.lhs, r.rhs, 1e-9, r.latex)
      expect(m.i1).toBe(x.sol.i.R1)
      closeRel(m.i1, HEADLINE_CLOSED.d3(p), 1e-9, 'i1')
      // The middle branch carries the difference.
      closeRel(x.sol.i.R2, m.i1 - m.i2, 1e-9, 'i_R2 = i1 − i2')
    }
  })

  it('D4: one figure per source with the other drawn dead, and the parts add to the full solve at every node', () => {
    for (const p of [defaultsOf('d4'), ...Array.from({ length: 25 }, (_, k) => randomParams(byId.d4, k * 7919 + 17))]) {
      const x = analyse(byId.d4, p)
      const elements = drawables(x.net)
      const figs = partsFigures(byId.d4, x, elements)
      expect(figs.map((f) => f.caption)).toEqual(['V1 alone', 'I1 alone', 'both together'])
      const dead = (fig, id) => fig.elements.find((e) => e.id === id)
      expect(dead(figs[0], 'I1')).toMatchObject({ type: 'SW', closed: false, label: 'I1 → 0 A' })
      expect(dead(figs[0], 'V1').type).toBe('V')
      expect(dead(figs[1], 'V1')).toMatchObject({ type: 'SW', closed: true, label: 'V1 → 0 V' })
      expect(dead(figs[1], 'I1').type).toBe('I')
      for (const node of Object.keys(x.sol.v)) closeRel(figs[0].meters.v[node] + figs[1].meters.v[node], figs[2].meters.v[node], 1e-9, node)
      closeRel(figs[2].meters.v.A, x.sol.v.A, 1e-12, 'full')
    }
  })

  it('D5: the equivalent reads V_oc at its open port, and its load line passes through every measured point', () => {
    for (const p of [defaultsOf('d5'), ...Array.from({ length: 25 }, (_, k) => randomParams(byId.d5, k * 7919 + 17))]) {
      const x = analyse(byId.d5, p)
      const eq = equivalentOf(x, ['A', 'gnd'])
      expect(eq.elements.map((e) => e.id)).toEqual(['Vth', 'Rth'])
      closeRel(eq.elements[0].value, (p.E * par(p.R2, p.R3)) / (p.R1 + par(p.R2, p.R3)), 1e-9, 'Vth')
      closeRel(eq.elements[1].value, par(p.R1, p.R2, p.R3), 1e-9, 'Rth')
      expect(eq.meters.v.A).toBe(eq.elements[0].value)
      expect(eq.meters.volt.Vth).toBe(eq.elements[0].value)
      expect(eq.meters.i.Rth).toBe(0)
      expect(eq.line).not.toBeNull()
      closeRel(eq.line.isc, eq.line.voc / eq.line.rth, 1e-9, 'isc = voc/rth')
      expect(eq.line.points.length).toBeGreaterThanOrEqual(3)
      for (const pt of eq.line.points) closeRel(pt.v, eq.line.voc - eq.line.rth * pt.i, 1e-9, `load ${pt.R}`)
      expect(layoutProblems(eq.layout, eq.elements, eq.meters, 'v')).toEqual([])
    }
  })

  it('E3: the contradiction names the two rows that fix the same node, and only while the op-amp is ideal', () => {
    expect(byId.e3.theorem).toMatchObject({ kind: 'contradiction', rows: ['V1', 'U1'] })
    const ideal = at('e3').x
    expect(ideal.sol).toBeNull()
    const eq = equations(normalize(ideal.net))
    for (const id of byId.e3.theorem.rows) expect(eq.rows.some((r) => r.id === id), id).toBe(true)
    expect(at('e3', { ideal: false }).x.sol).not.toBeNull()
  })

  it('H5: the triangle’s sides are P and Q, and the mean of p(t) over a cycle is P', () => {
    for (const p of [defaultsOf('h5'), ...Array.from({ length: 25 }, (_, k) => randomParams(byId.h5, k * 7919 + 17))]) {
      const x = analyse(byId.h5, p)
      const c = powerCycle(x)
      const w = 2 * Math.PI * p.f
      const P = (0.5 * p.R1 * p.A ** 2) / (p.R1 ** 2 + (w * p.L1) ** 2)
      const Q = (0.5 * w * p.L1 * p.A ** 2) / (p.R1 ** 2 + (w * p.L1) ** 2)
      closeRel(c.P, P, 1e-9, 'P')
      closeRel(c.Q, Q, 1e-9, 'Q')
      closeRel(c.S, Math.hypot(P, Q), 1e-9, 'S')
      closeRel(c.pf, P / Math.hypot(P, Q), 1e-9, 'pf')
      closeRel(c.mean, P, 1e-6, 'mean p(t)')
      closeRel(c.T, 1 / p.f, 1e-12, 'T')
      expect(c.samples).toHaveLength(200)
      expect(c.peak).toBeGreaterThanOrEqual(c.mean)
    }
  })
})
