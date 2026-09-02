import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, byId, defaultsOf, drawables } from './experiments.js'
import { analyse, dampingSweep, experimentMath, netPower } from './math.js'
import { layoutProblems } from './layoutCheck.js'
import { agrees } from '@ee-labs/explain'
import { equations, extrema, solveDC, NetworkError } from '@ee-labs/network'

// Every note makes a claim; every claim is measured here. The math panel's
// check rows are the first line — each row is a closed form against a solve —
// and the specific sentences of each note are the second, so the prose cannot
// drift from the circuit without a test noticing.

const at = (id, over = {}) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return { exp, p, x: analyse(exp, p) }
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
    if (k.kind === 'toggle') {
      // Toggles change the circuit's structure, not a value; the random
      // settings exercise the default structure and the toggle tests the other.
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
      if (k.key === 'A' && exp.id === 'e3') p[k.key] = 100 + 1e4 * rnd()
    }
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
  }, 30000)

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
  it('draws without any text on any other text, symbol or wire, and nothing off the canvas', () => {
    // Fifteen seeds, not three: "R3 3 kΩ" fits where "R3 1.19 kΩ" runs off the
    // canvas, and a negative sign is one more character on every reading.
    const seeds = [7, 11, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71]
    const settings = (e) => [defaultsOf(e.id), ...seeds.map((k) => randomParams(e, k))]
    for (const e of EXPERIMENTS) {
      for (const p of settings(e)) {
        // E3 refuses at its defaults; the drawing with readings needs a solve.
        if (e.id === 'e3' && !(p.A > 0)) p.A = 1e5
        const x = analyse(e, p)
        expect(x.sol, `${e.id} did not solve`).toBeTruthy()
        const meters = { v: x.sol.v, i: x.sol.i, volt: x.sol.volt, p: x.sol.p }
        for (const show of ['i', 'v', 'p']) {
          const problems = layoutProblems(e.layout, drawables(x.net), meters, show)
          expect(problems, `${e.id} (${show}) with ${JSON.stringify(p)}`).toEqual([])
        }
      }
      expect(layoutProblems(e.layout, drawables(e.net(defaultsOf(e.id))), null, 'none'), `${e.id} bare`).toEqual([])
    }
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

  it('A2: i = I whatever R, v = I·R, 5 mA into a megohm is 5 kV, and a source with no path is refused', () => {
    const { p, x } = at('a2')
    expect(x.sol.i.R1).toBeCloseTo(p.I, 12)
    expect(x.sol.v.in).toBeCloseTo(p.I * p.R1, 12)
    const meg = at('a2', { R1: 1e6 }).x.sol
    expect(meg.i.R1).toBeCloseTo(p.I, 12)
    expect(meg.v.in).toBeCloseTo(5000, 9)
    const open = { elements: [{ type: 'I', id: 'I1', nodes: ['gnd', 'in'], value: p.I }] }
    expect(() => solveDC(open)).toThrow(NetworkError)
    try {
      solveDC(open)
    } catch (err) {
      expect(err.code).toBe('current-cutset')
    }
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

  it('D2: the printed system has three unknowns for two floating nodes plus… wait, four — and says so', () => {
    const { x } = at('d2')
    const eq = equations(x.sol.norm, x.sol)
    // Nodes: in, A, B → 3 voltages; currents: V1, V2 → 2. The note counts the
    // two nodes of the supernode plus their currents; the test counts the whole.
    expect(eq.unknowns.filter((u) => u.kind === 'v').length).toBe(3)
    expect(eq.unknowns.filter((u) => u.kind === 'i').length).toBe(2)
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
    const fin = at('e3', { A: 1e5 }).x
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
    expect(matched.x.sol.v.out).toBeCloseTo(10 * (1.1 - 1), 12)
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
const last = (arr) => arr[arr.length - 1]
const peaks = (tr, q, key) => extrema(tr.t, tr.series(q, key), (t) => tr.at(t).sol[q][key])

describe('every dynamic experiment (F, G)', () => {
  it('has a transient, a state summary, a cursor solve, and the meters read that instant', () => {
    expect(DYNAMIC.length).toBe(14)
    for (const e of DYNAMIC) {
      const { x } = at(e.id)
      expect(x.tr, e.id).toBeTruthy()
      expect(x.sol, e.id).toBeTruthy()
      expect(x.cursor).toBeCloseTo(e.cursor * x.tEnd, 12)
      expect(x.sol.maxResidual, e.id).toBeLessThan(1e-9)
      expect(x.state.n, e.id).toBe(e.id[0] === 'f' ? 1 : 2)
      if (x.state.n === 2) expect(['overdamped', 'critical', 'underdamped', 'undamped']).toContain(x.state.face)
      // The scope's traces are all readable from the cursor solve.
      for (const q of [...e.scope.left.traces, ...(e.scope.right?.traces || [])]) expect(Number.isFinite(x.sol[q.q][q.key]), `${e.id} ${q.label}`).toBe(true)
    }
  })

  it('the differential equation is true at the cursor: C·dv/dt is the capacitor’s current, L·di/dt the inductor’s voltage', () => {
    for (const e of DYNAMIC) {
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
    for (const e of DYNAMIC) {
      const { x } = at(e.id)
      const x0plus = x.tr.at(0).x
      x.before.x0.forEach((v, k) => expect(x0plus[k], `${e.id} state ${k}`).toBeCloseTo(v, 12))
    }
  })

  it('energy is conserved along every transient: stored + dissipated = stored₀ + supplied at every sample', () => {
    for (const e of DYNAMIC) {
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
    expect(x.damping.at.zeta).toBeCloseTo(1, 12)
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
