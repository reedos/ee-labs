import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, byId, defaultsOf, drawables } from './experiments.js'
import { analyse, experimentMath } from './math.js'
import { layoutProblems } from './layoutCheck.js'
import { agrees } from '@ee-labs/explain'
import { equations } from '@ee-labs/network'

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
    if (k.scale === 'log') {
      // Keep resistances within four decades of each other so the checks stay
      // well above float noise; the knobs themselves allow six.
      const lo = Math.max(k.min, 10)
      const hi = Math.min(k.max, 1e5)
      p[k.key] = lo * Math.pow(hi / lo, rnd())
    } else {
      p[k.key] = k.min + (k.max - k.min) * rnd()
      if (k.key === 'A' && exp.id === 'd2') p[k.key] = 100 + 1e4 * rnd()
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

  it('solves at its defaults with KCL holding, except D2 which refuses by design', () => {
    for (const e of EXPERIMENTS) {
      const { x } = at(e.id)
      if (e.id === 'd2') {
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
  })

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
    const d = drawables(byId.d1.net(defaultsOf('d1')))
    expect(d.find((q) => q.id === 'E1').gain).toBe(10)
    expect(d.find((q) => q.id === 'RL').value).toBe(1000)
  })

  // The first screenshots had a reading clipped off the canvas and a label on
  // top of a neighbour's reading, with every browser probe green. So the
  // drawing is checked as geometry, with the widest texts on: readings of
  // every kind at the defaults, and at settings that make the numbers long.
  it('draws without any text on any other text, symbol or wire, and nothing off the canvas', () => {
    const settings = (e) => [defaultsOf(e.id), randomParams(e, 7), randomParams(e, 11), randomParams(e, 19)]
    for (const e of EXPERIMENTS) {
      for (const p of settings(e)) {
        // D2 refuses at its defaults; the drawing with readings needs a solve.
        if (e.id === 'd2' && !(p.A > 0)) p.A = 1e5
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
})

describe('the notes, sentence by sentence', () => {
  it('A1: R₁ carries exactly what R₂ and R₃ carry between them, and the sum never moves as R₂ shrinks', () => {
    const { x } = at('a1')
    expect(x.sol.i.R1).toBeCloseTo(x.sol.i.R2 + x.sol.i.R3, 12)
    const tiny = at('a1', { R2: 1 }).x.sol
    expect(tiny.i.R2 / tiny.i.R1).toBeGreaterThan(0.999)
    expect(tiny.i.R1).toBeCloseTo(tiny.i.R2 + tiny.i.R3, 12)
  })

  it('A2: the source lifts by E and the resistors drop it all again, in proportion', () => {
    const { p, x } = at('a2')
    expect(x.sol.volt.V1).toBeCloseTo(p.E, 12)
    expect(x.sol.volt.R1 + x.sol.volt.R2).toBeCloseTo(p.E, 12)
    expect(x.sol.volt.R2 / x.sol.volt.R1).toBeCloseTo(p.R2 / p.R1, 9)
  })

  it('A3: resistors positive, source negative, total exactly zero', () => {
    const { x } = at('a3')
    expect(x.sol.p.R1).toBeGreaterThan(0)
    expect(x.sol.p.R2).toBeGreaterThan(0)
    expect(x.sol.p.V1).toBeLessThan(0)
    expect(Math.abs(x.sol.pTotal)).toBeLessThan(1e-12)
  })

  it('A4: current (E₁−E₂)/R flows into the weaker source, which absorbs; raise E₂ past E₁ and it reverses', () => {
    const { p, x } = at('a4')
    expect(x.sol.i.R1).toBeCloseTo((p.E1 - p.E2) / p.R1, 12)
    expect(x.sol.p.V2).toBeGreaterThan(0)
    expect(x.sol.p.V1).toBeLessThan(0)
    const flipped = at('a4', { E2: 15 }).x.sol
    expect(flipped.i.R1).toBeLessThan(0)
    expect(flipped.p.V2).toBeLessThan(0)
    expect(flipped.p.V1).toBeGreaterThan(0)
  })

  it('B1: a resistor ten times the others takes ten times the voltage', () => {
    const s = at('b1', { R1: 1000, R2: 1000, R3: 10000 }).x.sol
    expect(s.volt.R3 / s.volt.R1).toBeCloseTo(10, 9)
    expect(s.volt.R3 / 12).toBeCloseTo(10 / 12, 9)
  })

  it('B2: the equivalent is below the smallest branch and the smallest resistor takes the biggest share', () => {
    const { p, x } = at('b2')
    const req = p.E / -x.sol.i.V1
    expect(req).toBeLessThan(Math.min(p.R1, p.R2, p.R3))
    expect(x.sol.i.R1).toBeGreaterThan(x.sol.i.R2)
    expect(x.sol.i.R2).toBeGreaterThan(x.sol.i.R3)
  })

  it('B3: the droop is small only while R_L ≫ R₂', () => {
    const unloaded = 6
    const light = at('b3', { RL: 1e5 }).x.sol.v.A
    const heavy = at('b3', { RL: 1000 }).x.sol.v.A
    expect(unloaded - light).toBeLessThan(0.05)
    expect(unloaded - heavy).toBeGreaterThan(1.5)
    // And the sweep pane is a real measurement: its point at the knob matches the solve.
    const { x, p } = at('b3')
    const near = x.sweep.points.reduce((b, q) => (Math.abs(Math.log(q.R / p.RL)) < Math.abs(Math.log(b.R / p.RL)) ? q : b))
    expect(Math.abs(near.v - x.sol.v.A) / x.sol.v.A).toBeLessThan(0.05)
  })

  it('B4: balanced when R₁/R₂ = R₃/R₄, whatever the supply; 1 % of R₄ moves it by about E/4 × 1 %', () => {
    for (const E of [1, 10, 24]) expect(Math.abs(at('b4', { R4: 1000, E }).x.sol.v.R - at('b4', { R4: 1000, E }).x.sol.v.L)).toBeLessThan(1e-12)
    const s = at('b4', { R4: 1010 }).x.sol
    const out = s.v.R - s.v.L
    expect(out / ((10 / 4) * 0.01)).toBeCloseTo(1, 1)
  })

  it('C1: V_A = (E/R₁)/(1/R₁+1/R₂+1/R₃) — one equation, one unknown', () => {
    const { p, x } = at('c1')
    expect(x.sol.v.A).toBeCloseTo(p.E / p.R1 / (1 / p.R1 + 1 / p.R2 + 1 / p.R3), 12)
    const eq = equations(x.sol.norm, x.sol)
    // Two node unknowns (in, A) plus the source current: the printed system.
    expect(eq.rows.filter((r) => r.kind === 'kcl').length).toBe(2)
  })

  it('C2: the printed system has three unknowns for two floating nodes plus… wait, four — and says so', () => {
    const { x } = at('c2')
    const eq = equations(x.sol.norm, x.sol)
    // Nodes: in, A, B → 3 voltages; currents: V1, V2 → 2. The note counts the
    // two nodes of the supernode plus their currents; the test counts the whole.
    expect(eq.unknowns.filter((u) => u.kind === 'v').length).toBe(3)
    expect(eq.unknowns.filter((u) => u.kind === 'i').length).toBe(2)
  })

  it('C3: the hand 2×2 matches nodal exactly, and E₂ above E₁R₂/(R₁+R₂) reverses i₂', () => {
    const { p, x } = at('c3')
    const a = p.R1 + p.R2
    const b = -p.R2
    const d = p.R2 + p.R3
    const det = a * d - b * b
    const i1 = (p.E1 * d + b * p.E2) / det
    const i2 = (-a * p.E2 - b * p.E1) / det
    expect(x.sol.i.R1).toBeCloseTo(i1, 12)
    expect(x.sol.i.R3).toBeCloseTo(i2, 12)
    const threshold = (p.E1 * p.R2) / (p.R1 + p.R2)
    expect(at('c3', { E2: threshold * 0.9 }).x.sol.i.R3).toBeGreaterThan(0)
    expect(at('c3', { E2: threshold * 1.1 }).x.sol.i.R3).toBeLessThan(0)
  })

  it('C4: voltages and currents superpose to the last digit; power does not, by 2·i₁·i₂·R', () => {
    const { p, x } = at('c4')
    const sp = x.superposition
    for (const n of Object.keys(x.sol.v)) expect(sp.sumV[n]).toBeCloseTo(x.sol.v[n], 12)
    for (const id of Object.keys(x.sol.i)) expect(sp.sumI[id]).toBeCloseTo(x.sol.i[id], 12)
    const iE = sp.parts.find((q) => q.id === 'V1').sol.i.R2
    const iI = sp.parts.find((q) => q.id === 'I1').sol.i.R2
    expect(x.sol.p.R2 - sp.sumP.R2).toBeCloseTo(2 * iE * iI * p.R2, 12)
    expect(Math.abs(x.sol.p.R2 - sp.sumP.R2)).toBeGreaterThan(1e-6)
  })

  it('C5: all three R_th agree with R₁∥R₂∥R₃ and the load line’s intercepts are V_oc and I_sc', () => {
    const { p, x } = at('c5')
    const rth = 1 / (1 / p.R1 + 1 / p.R2 + 1 / p.R3)
    expect(x.thevenin.rth.ratio).toBeCloseTo(rth, 9)
    expect(x.thevenin.rth.test).toBeCloseTo(rth, 9)
    expect(x.thevenin.rth.fit).toBeCloseTo(rth, 6)
    expect(x.thevenin.fitVoc).toBeCloseTo(x.thevenin.voc, 9)
    expect(x.thevenin.fitVoc / x.thevenin.rth.fit).toBeCloseTo(x.thevenin.isc, 9)
  })

  it('C6: the sweep peaks at R_L = R_s with 50 % efficiency; efficiency climbs past it while power falls', () => {
    const { p, x } = at('c6')
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

  it('D1: v_out = A·v_in whatever the load; the dependent source delivers more than the input source works', () => {
    const { p, x } = at('d1')
    expect(x.sol.v.out).toBeCloseTo(p.A * p.E, 12)
    expect(at('d1', { RL: 10 }).x.sol.v.out).toBeCloseTo(p.A * p.E, 12)
    expect(x.sol.p.E1).toBeLessThan(0)
    expect(-x.sol.p.E1).toBeGreaterThan(-x.sol.p.V1 * 100)
  })

  it('D2: ideal → refuses with the open-loop message; finite gain → 1 mV in, 100 V out at A = 10⁵', () => {
    const { x } = at('d2')
    expect(x.sol).toBeNull()
    expect(x.refusal.code).toBe('opamp-open-loop')
    expect(x.refusal.message).toMatch(/no feedback path/)
    expect(x.refusal.message).toMatch(/finite gain/)
    const fin = at('d2', { A: 1e5 }).x
    expect(fin.sol.v.out).toBeCloseTo(100, 9)
  })

  it('D3: v_out = GE/(1+G/A), the input difference is v_out/A, and the gain converges on G as A grows', () => {
    const { p, x } = at('d3')
    const G = 1 + p.Rf / p.Rg
    expect(x.sol.v.out).toBeCloseTo((G * p.E) / (1 + G / p.A), 12)
    expect(x.sol.v.in - x.sol.v.n).toBeCloseTo(x.sol.v.out / p.A, 12)
    const gains = [1e2, 1e4, 1e6].map((A) => at('d3', { A }).x.sol.v.out / p.E)
    expect(Math.abs(gains[0] - G)).toBeGreaterThan(Math.abs(gains[1] - G))
    expect(Math.abs(gains[1] - G)).toBeGreaterThan(Math.abs(gains[2] - G))
    // The shortfall is exactly G/A of the ideal, as the note says.
    expect((G - gains[2]) / G).toBeCloseTo(G / 1e6 / (1 + G / 1e6), 12)
  })

  it('D4: virtual ground at 0 V, v_out = −(R_f/R_g)E, the source sees R_g, the load current is the op-amp’s', () => {
    const { p, x } = at('d4')
    expect(Math.abs(x.sol.v.n)).toBeLessThan(1e-12)
    expect(x.sol.v.out).toBeCloseTo(-(p.Rf / p.Rg) * p.E, 12)
    expect(p.E / -x.sol.i.V1).toBeCloseTo(p.Rg, 9)
    // The source's current is E/Rg regardless of the load: the load current is not its business.
    expect(at('d4', { RL: 100 }).x.sol.i.V1).toBeCloseTo(x.sol.i.V1, 12)
    expect(at('d4', { RL: 100 }).x.sol.i.U1).not.toBeCloseTo(x.sol.i.U1, 6)
  })

  it('D5: v_out = −R_f(E₁/R₁ + E₂/R₂) and each input current is set by its own resistor alone', () => {
    const { p, x } = at('d5')
    expect(x.sol.v.out).toBeCloseTo(-p.Rf * (p.E1 / p.R1 + p.E2 / p.R2), 12)
    // Change E₂: i_R1 does not move.
    expect(at('d5', { E2: -3 }).x.sol.i.R1).toBeCloseTo(x.sol.i.R1, 12)
  })

  it('D6: matched → (R₂/R₁)(E₂−E₁) and common mode rejected; 1 % mismatch leaks about 1 % of the differential gain', () => {
    const matched = at('d6', { R4: 10000 })
    expect(matched.x.sol.v.out).toBeCloseTo(10 * (1.1 - 1), 12)
    expect(at('d6', { R4: 10000, E1: 5, E2: 5 }).x.sol.v.out).toBeCloseTo(0, 12)
    const cm = at('d6', { R4: 10100, E1: 1, E2: 1 }).x.sol.v.out
    // Common-mode gain ≈ 0.01 × differential gain × (R1/(R1+R2)) scale — order 1 % of 10.
    expect(Math.abs(cm)).toBeGreaterThan(0.001)
    expect(Math.abs(cm)).toBeLessThan(0.2)
  })

  it('D7: the output is the UNLOADED divider voltage whatever R_L, and the sweep is flat', () => {
    const { p, x } = at('d7')
    const unloaded = (p.E * p.R2) / (p.R1 + p.R2)
    for (const RL of [1, 100, 1e6]) expect(at('d7', { RL }).x.sol.v.out).toBeCloseTo(unloaded, 12)
    const vs = x.sweep.points.map((q) => q.v)
    expect(Math.max(...vs) - Math.min(...vs)).toBeLessThan(1e-9)
    // And B3, the same divider without the buffer, is not flat.
    const b3 = at('b3').x.sweep.points.map((q) => q.v)
    expect(Math.max(...b3) - Math.min(...b3)).toBeGreaterThan(1)
  })
})
