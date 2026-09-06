import { describe, expect, it } from 'vitest'
import {
  GROUND,
  NetworkError,
  assemble,
  cellLatex,
  equations,
  killed,
  loadSweep,
  matVec,
  normalize,
  solve,
  solveDC,
  superposition,
  thevenin,
  withElements,
} from '../index.js'

const close = (a, b, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(a), Math.abs(b)))

// The Group A/B/C default: 12 V into 1k feeding node A, 2k and 3k from A to ground.
const divider = {
  elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 12 },
    { type: 'R', id: 'R1', nodes: ['in', 'A'], value: 1000 },
    { type: 'R', id: 'R2', nodes: ['A', 'gnd'], value: 2000 },
    { type: 'R', id: 'R3', nodes: ['A', 'gnd'], value: 3000 },
  ],
}

describe('linalg', () => {
  it('solves a 3×3 system and reproduces the right-hand side', () => {
    const M = [
      [4, 1, 2],
      [1, 5, 3],
      [2, 3, 6],
    ]
    const r = [1, 2, 3]
    const x = solve(M, r)
    matVec(M, x).forEach((y, k) => close(y, r[k]))
  })
  it('names a singular matrix instead of returning huge numbers', () => {
    expect(() =>
      solve(
        [
          [1, 2],
          [2, 4],
        ],
        [1, 2],
      ),
    ).toThrow(/singular/)
  })
})

describe('stamps against hand matrices', () => {
  it('resistor divider: the conductance matrix is exactly the hand one', () => {
    // Nodes sorted: A (0), in (1); unknown current of V1 is index 2.
    const { M, r, unknowns } = assemble(normalize(divider))
    expect(unknowns.map((u) => u.node || u.id)).toEqual(['A', 'in', 'V1'])
    const g1 = 1 / 1000
    const g2 = 1 / 2000
    const g3 = 1 / 3000
    expect(M[0][0]).toBeCloseTo(g1 + g2 + g3, 15)
    expect(M[0][1]).toBeCloseTo(-g1, 15)
    expect(M[1][0]).toBeCloseTo(-g1, 15)
    expect(M[1][1]).toBeCloseTo(g1, 15)
    // The source: current unknown enters KCL at 'in', and its row fixes v_in = 12.
    expect(M[1][2]).toBe(1)
    expect(M[2][1]).toBe(1)
    expect(M[0][2]).toBe(0)
    expect(r).toEqual([0, 0, 12])
  })

  it('current source stamps −I at its + node and +I at its − node', () => {
    const { r } = assemble(
      normalize({
        elements: [
          { type: 'I', id: 'I1', nodes: ['a', 'b'], value: 2 },
          { type: 'R', nodes: ['a', 'gnd'], value: 1 },
          { type: 'R', nodes: ['b', 'gnd'], value: 1 },
        ],
      }),
    )
    expect(r).toEqual([-2, 2])
  })

  it('ideal op-amp: one unknown output current, one row v₊ − v₋ = 0', () => {
    // Inverting amplifier: in → Rg → n, n → Rf → out, op-amp (+ = gnd, − = n).
    const net = {
      elements: [
        { type: 'V', id: 'Vs', nodes: ['in', 'gnd'], value: 1 },
        { type: 'R', id: 'Rg', nodes: ['in', 'n'], value: 1000 },
        { type: 'R', id: 'Rf', nodes: ['n', 'out'], value: 10000 },
        { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['gnd', 'n'] },
      ],
    }
    const norm = normalize(net)
    const { M, unknowns } = assemble(norm)
    const iU = unknowns.findIndex((u) => u.id === 'U1')
    const nN = norm.index.get('n')
    const nOut = norm.index.get('out')
    expect(M[nOut][iU]).toBe(1)
    expect(M[iU][nN]).toBe(-1) // v_+ (ground, dropped) − v_n = 0
    expect(M[iU][nOut]).toBe(0)
  })
})

describe('solveDC', () => {
  it('divider: V_A = (E/R1)/(1/R1+1/R2+1/R3) and every current follows', () => {
    const s = solveDC(divider)
    const vA = (12 / 1000) / (1 / 1000 + 1 / 2000 + 1 / 3000)
    close(s.v.A, vA)
    close(s.v.in, 12)
    close(s.i.R1, (12 - vA) / 1000)
    close(s.i.R2, vA / 2000)
    close(s.i.R3, vA / 3000)
    // Source current: passive convention, in at +, so the source current is negative.
    close(s.i.V1, -(12 - vA) / 1000)
    expect(s.p.V1).toBeLessThan(0)
    close(s.pTotal, 0, 1e-12)
    expect(s.maxResidual).toBeLessThan(1e-12)
  })

  it('unloaded divider matches R2/(R1+R2)', () => {
    const s = solveDC({
      elements: [
        { type: 'V', nodes: ['in', 'gnd'], value: 5 },
        { type: 'R', nodes: ['in', 'out'], value: 1000 },
        { type: 'R', nodes: ['out', 'gnd'], value: 4000 },
      ],
    })
    close(s.v.out, 4)
  })

  it('Wheatstone bridge balances at R1/R2 = R3/R4 and reads the textbook offset otherwise', () => {
    const bridge = (R4) => ({
      elements: [
        { type: 'V', nodes: ['top', 'gnd'], value: 10 },
        { type: 'R', nodes: ['top', 'L'], value: 1000 },
        { type: 'R', nodes: ['L', 'gnd'], value: 1000 },
        { type: 'R', nodes: ['top', 'R'], value: 1000 },
        { type: 'R', nodes: ['R', 'gnd'], value: R4 },
      ],
    })
    close(solveDC(bridge(1000)).v.L - solveDC(bridge(1000)).v.R, 0, 1e-12)
    const s = solveDC(bridge(1100))
    close(s.v.R - s.v.L, 10 * (1100 / 2100 - 0.5))
  })

  it('ideal inverting amplifier: gain −Rf/Rg, virtual ground at the − input', () => {
    const s = solveDC({
      elements: [
        { type: 'V', id: 'Vs', nodes: ['in', 'gnd'], value: 0.5 },
        { type: 'R', id: 'Rg', nodes: ['in', 'n'], value: 1000 },
        { type: 'R', id: 'Rf', nodes: ['n', 'out'], value: 10000 },
        { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['gnd', 'n'] },
      ],
    })
    close(s.v.out, -5)
    close(s.v.n, 0, 1e-12)
    // The op-amp output supplies the feedback current: it sinks i_Rf = 0.5 mA.
    close(s.i.U1, 0.5e-3)
    expect(s.maxResidual).toBeLessThan(1e-12)
  })

  it('finite-gain op-amp approaches the ideal as A grows, from the closed form', () => {
    const inv = (gain) => ({
      elements: [
        { type: 'V', nodes: ['in', 'gnd'], value: 1 },
        { type: 'R', nodes: ['in', 'n'], value: 1000 },
        { type: 'R', nodes: ['n', 'out'], value: 10000 },
        { type: 'OPAMP', nodes: ['out'], ctrl: ['gnd', 'n'], gain },
      ],
    })
    // v_out = −A(Rf/(Rg+Rf)) / (1 + A Rg/(Rg+Rf)) · v_in ... written as −Rf/Rg · 1/(1 + (1+Rf/Rg)/A)
    for (const A of [10, 1000, 1e5]) close(solveDC(inv(A)).v.out, -10 / (1 + 11 / A))
    close(solveDC(inv(Infinity)).v.out, -10)
  })

  it('non-inverting: gain 1 + Rf/Rg', () => {
    const s = solveDC({
      elements: [
        { type: 'V', nodes: ['in', 'gnd'], value: 1 },
        { type: 'R', nodes: ['n', 'gnd'], value: 1000 },
        { type: 'R', nodes: ['n', 'out'], value: 9000 },
        { type: 'OPAMP', nodes: ['out'], ctrl: ['in', 'n'] },
      ],
    })
    close(s.v.out, 10)
  })

  it('VCCS and VCVS stamp as their laws say', () => {
    // 1 V across R_in drives g = 2 mS into a 1k load: v_out = −g·R·v = −2 V.
    const s = solveDC({
      elements: [
        { type: 'V', nodes: ['in', 'gnd'], value: 1 },
        { type: 'R', nodes: ['in', 'gnd'], value: 1000 },
        { type: 'VCCS', id: 'G1', nodes: ['out', 'gnd'], ctrl: ['in', 'gnd'], gain: 2e-3 },
        { type: 'R', nodes: ['out', 'gnd'], value: 1000 },
      ],
    })
    close(s.v.out, -2)
    const t = solveDC({
      elements: [
        { type: 'V', nodes: ['in', 'gnd'], value: 1 },
        { type: 'VCVS', nodes: ['out', 'gnd'], ctrl: ['in', 'gnd'], gain: 3 },
        { type: 'R', nodes: ['out', 'gnd'], value: 1000 },
      ],
    })
    close(t.v.out, 3)
  })

  it('switches: closed is a short, open is gone; C is open and L a short at DC', () => {
    const net = (closed) => ({
      elements: [
        { type: 'V', nodes: ['in', 'gnd'], value: 6 },
        { type: 'SW', id: 'S1', nodes: ['in', 'a'], closed },
        { type: 'R', nodes: ['a', 'b'], value: 1000 },
        { type: 'L', id: 'L1', nodes: ['b', 'c'], value: 1e-3 },
        { type: 'R', nodes: ['c', 'gnd'], value: 1000 },
        { type: 'C', id: 'C1', nodes: ['c', 'gnd'], value: 1e-6 },
      ],
    })
    const on = solveDC(net(true))
    close(on.v.c, 3)
    close(on.i.L1, 3e-3)
    expect(on.i.C1).toBe(0)
    // Open switch: the rest still has its path to ground, so everything is a defined zero.
    const off = solveDC(net(false))
    close(off.v.c, 0, 1e-12)
    close(off.i.L1, 0, 1e-12)
    expect(off.i.S1).toBe(0)
    // Cut the ground path too and node a really is floating — a refusal, not a zero.
    const cut = { elements: net(false).elements.filter((e) => e.nodes[1] !== 'gnd' || e.type === 'V') }
    expect(() => solveDC(cut)).toThrow(NetworkError)
    expect(() => solveDC(cut)).toThrow(/no path to ground/)
  })

  it('composite amplifier: feedback through a second op-amp still counts as feedback', () => {
    // U1 drives U2 (a buffer); U2's output feeds back to U1's − input.
    const s = solveDC({
      elements: [
        { type: 'V', nodes: ['in', 'gnd'], value: 1 },
        { type: 'OPAMP', id: 'U1', nodes: ['m'], ctrl: ['in', 'n'] },
        { type: 'OPAMP', id: 'U2', nodes: ['out'], ctrl: ['m', 'out'] },
        { type: 'R', nodes: ['out', 'n'], value: 9000 },
        { type: 'R', nodes: ['n', 'gnd'], value: 1000 },
      ],
    })
    close(s.v.out, 10)
  })
})

describe('refusals carry their reasons', () => {
  const pick = (net) => {
    try {
      solveDC(net)
    } catch (err) {
      return err
    }
    throw new Error('expected a refusal')
  }

  it('no ground', () => {
    const err = pick({ elements: [{ type: 'R', nodes: ['a', 'b'], value: 1 }] })
    expect(err.code).toBe('ground')
    expect(err.message).toMatch(/one node has to be called zero/)
  })

  it('op-amp with no feedback', () => {
    const err = pick({
      elements: [
        { type: 'V', nodes: ['in', 'gnd'], value: 1 },
        { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['in', 'gnd'] },
        { type: 'R', nodes: ['out', 'gnd'], value: 1000 },
      ],
    })
    expect(err.code).toBe('opamp-open-loop')
    expect(err.message).toMatch(/no feedback path/)
    expect(err.message).toMatch(/finite gain and rails/)
  })

  it('the same op-amp with finite gain is a comparator and does solve', () => {
    const s = solveDC({
      elements: [
        { type: 'V', nodes: ['in', 'gnd'], value: 1e-3 },
        { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['in', 'gnd'], gain: 1e5 },
        { type: 'R', nodes: ['out', 'gnd'], value: 1000 },
      ],
    })
    close(s.v.out, 100)
  })

  it('voltage-source loop', () => {
    const err = pick({
      elements: [
        { type: 'V', id: 'V1', nodes: ['a', 'gnd'], value: 5 },
        { type: 'V', id: 'V2', nodes: ['a', 'gnd'], value: 5 },
        { type: 'R', nodes: ['a', 'gnd'], value: 1 },
      ],
    })
    expect(err.code).toBe('source-loop')
    expect(err.message).toMatch(/two things are trying to set the same voltage/)
  })

  it('current source into nowhere', () => {
    const err = pick({
      elements: [
        { type: 'I', nodes: ['gnd', 'a'], value: 1 },
        { type: 'I', nodes: ['a', 'gnd'], value: 2 },
      ],
    })
    expect(err.code).toBe('current-cutset')
    expect(err.message).toMatch(/nowhere to go/)
  })

  it('floating node', () => {
    const err = pick({
      elements: [
        { type: 'V', nodes: ['a', 'gnd'], value: 1 },
        { type: 'R', nodes: ['a', 'gnd'], value: 1 },
        { type: 'R', nodes: ['b', 'c'], value: 1 },
      ],
    })
    expect(err.code).toBe('floating')
    expect(err.message).toMatch(/no path to ground/)
  })
})

describe('equations are what was solved', () => {
  it('prints one KCL row per node whose terms sum to zero, and the source constraint', () => {
    const norm = normalize(divider)
    const s = solveDC(norm)
    const eq = equations(norm, s)
    const kcl = eq.rows.filter((r) => r.kind === 'kcl')
    expect(kcl.map((r) => r.node)).toEqual(['A', 'in'])
    for (const row of kcl) expect(Math.abs(row.sum)).toBeLessThan(1e-12)
    const rowA = kcl[0]
    expect(rowA.terms).toHaveLength(3)
    expect(rowA.latex).toContain('\\frac{(v_A - v_{in})}{R_1}')
    expect(rowA.latex).toContain('\\frac{v_A}{R_2}')
    const con = eq.rows.find((r) => r.kind === 'constraint')
    expect(con.latex).toBe('v_{in} = V_1')
    close(con.lhs, 12)
    expect(eq.matrixLatex).toMatch(/^\\begin\{bmatrix\}/)
  })

  // The symbolic matrix is the numeric one with the letters left in. Every
  // cell's terms must add to the number the solver used, and the letters must
  // be the reference designators on the schematic.
  const symbolicMatches = (norm, sol) => {
    const eq = equations(norm, sol)
    const { cells, rhs, rows, cols, symbols } = eq.symbolic
    expect(cells).toHaveLength(sol.sys.M.length)
    expect(cols.map((c) => c.latex)).toEqual(eq.unknowns.map((u) => (u.kind === 'v' ? `v_${u.node.length > 1 ? `{${u.node}}` : u.node}` : `i_{${u.id}}`)))
    cells.forEach((row, i) => {
      row.forEach((terms, j) => close(terms.reduce((s, t) => s + t.value, 0), sol.sys.M[i][j], 1e-12))
      close(rhs[i].reduce((s, t) => s + t.value, 0), sol.sys.r[i], 1e-12)
    })
    for (const s of symbols) expect(Number.isFinite(s.value)).toBe(true)
    return { eq, rows, cols, symbols }
  }

  it('symbolic matrix: cells carry the letters, and add to the numbers', () => {
    const norm = normalize(divider)
    const sol = solveDC(norm)
    const { eq, rows, symbols } = symbolicMatches(norm, sol)
    expect(rows.map((r) => r.kind)).toEqual(['kcl', 'kcl', 'constraint'])
    expect(rows[2].id).toBe('V1')
    const { cells, rhs } = eq.symbolic
    // KCL at A: 1/R1 + 1/R2 + 1/R3 on the diagonal, -1/R1 towards in, nothing in the current column.
    expect(cellLatex(cells[0][0])).toBe('\\frac{1}{R_1}+\\frac{1}{R_2}+\\frac{1}{R_3}')
    expect(cellLatex(cells[0][1])).toBe('-\\frac{1}{R_1}')
    expect(cellLatex(cells[0][2])).toBe('0')
    // The source row v_in = V_1, and a 1 in the source current's column at node in.
    expect(cellLatex(cells[2][1])).toBe('1')
    expect(cellLatex(cells[1][2])).toBe('1')
    expect(cellLatex(rhs[2])).toBe('V_1')
    expect(cellLatex(rhs[0])).toBe('0')
    expect(eq.symbolicLatex).toMatch(/^\\begin\{bmatrix\} \\frac\{1\}\{R_1\}/)
    expect(symbols.map((s) => [s.latex, s.value, s.what])).toEqual([
      ['V_1', 12, 'E'],
      ['R_1', 1000, 'R'],
      ['R_2', 2000, 'R'],
      ['R_3', 3000, 'R'],
    ])
  })

  it('symbolic matrix names substituted elements by what they are: v_C1, i_L1, R_S1, A_U1, g_G1', () => {
    const norm = normalize({
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 5 },
        { type: 'SW', id: 'S1', nodes: ['in', 'a'], ron: 2, closed: true },
        { type: 'C', id: 'C1', nodes: ['a', 'gnd'], value: 1e-6 },
        { type: 'L', id: 'L1', nodes: ['a', 'b'], value: 1e-3 },
        { type: 'R', id: 'R1', nodes: ['b', 'gnd'], value: 100 },
        { type: 'VCCS', id: 'G1', nodes: ['b', 'gnd'], ctrl: ['a', 'gnd'], gain: 0.01 },
        { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['a', 'out'], gain: 1000 },
        { type: 'R', id: 'R2', nodes: ['out', 'gnd'], value: 1000 },
      ],
    })
    const sol = solveDC(norm, { states: { C1: 3, L1: 0.02 } })
    const { symbols, rows } = symbolicMatches(norm, sol)
    expect(symbols.map((s) => `${s.what}:${s.latex}`).sort()).toEqual(
      ['E:V_1', 'switchR:R_{S1}', 'vC:v_{C1}', 'iL:i_{L1}', 'R:R_1', 'R:R_2', 'g:g_{G1}', 'A:A_{U1}'].sort(),
    )
    expect(symbols.find((s) => s.what === 'vC').value).toBe(3)
    expect(symbols.find((s) => s.what === 'iL').value).toBe(0.02)
    expect(rows.find((r) => r.id === 'C1')).toMatchObject({ kind: 'constraint', from: 'C', type: 'V' })
    expect(rows.find((r) => r.id === 'U1')).toMatchObject({ from: 'OPAMP', type: 'VCVS' })
    // At DC the inductor is a short: a constraint row with a bare zero on the right.
    const dc = solveDC(norm)
    const { eq } = symbolicMatches(norm, dc)
    const lRow = eq.symbolic.rows.findIndex((r) => r.id === 'L1')
    expect(eq.symbolic.rows[lRow].from).toBe('L')
    expect(cellLatex(eq.symbolic.rhs[lRow])).toBe('0')
  })

  it('op-amp constraint prints the golden rule', () => {
    const norm = normalize({
      elements: [
        { type: 'V', nodes: ['in', 'gnd'], value: 1 },
        { type: 'R', nodes: ['n', 'gnd'], value: 1000 },
        { type: 'R', nodes: ['n', 'out'], value: 9000 },
        { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['in', 'n'] },
      ],
    })
    const eq = equations(norm, solveDC(norm))
    const con = eq.rows.find((r) => r.id === 'U1')
    expect(con.latex).toBe('v_{in} = v_n')
    close(con.lhs, con.rhs)
  })
})

describe('theorems', () => {
  it('Thévenin three ways agree on the divider port A', () => {
    const th = thevenin(divider, 'A')
    // Kill the source: 1k ∥ 2k ∥ 3k = 545.45 Ω; V_oc is the loaded divider voltage.
    const rth = 1 / (1 / 1000 + 1 / 2000 + 1 / 3000)
    close(th.rth.test, rth)
    close(th.rth.ratio, rth)
    close(th.rth.fit, rth, 1e-8)
    close(th.voc, (12 / 1000) * rth)
    close(th.fitVoc, th.voc, 1e-8)
    expect(th.fitResidual).toBeLessThan(1e-9)
  })

  it('Thévenin with a dependent source inside: the test-source method is the one that still works', () => {
    // Port out: R 1k from gnd to out, with a VCCS from out to gnd controlled by v_out (g = 1 mS).
    // R_th = 1 / (1/1000 + 1e-3) = 500 Ω; no independent source so V_oc = 0, I_sc = 0.
    const net = {
      elements: [
        { type: 'R', nodes: ['out', 'gnd'], value: 1000 },
        { type: 'VCCS', nodes: ['out', 'gnd'], ctrl: ['out', 'gnd'], gain: 1e-3 },
      ],
    }
    const th = thevenin(net, 'out')
    close(th.rth.test, 500)
    close(th.voc, 0, 1e-12)
    expect(th.rth.ratio).toBeNaN() // 0/0: the ratio method has nothing to say
  })

  it('a bare current source has no Thévenin equivalent, and says so', () => {
    expect(() => thevenin({ elements: [{ type: 'I', nodes: ['gnd', 'a'], value: 1 }] }, 'a')).toThrow(/no Thévenin equivalent/)
  })

  it('superposition: voltages and currents add, powers do not', () => {
    const net = {
      elements: [
        { type: 'V', id: 'V1', nodes: ['a', 'gnd'], value: 10 },
        { type: 'R', id: 'R1', nodes: ['a', 'b'], value: 1000 },
        { type: 'R', id: 'R2', nodes: ['b', 'gnd'], value: 1000 },
        { type: 'I', id: 'I1', nodes: ['gnd', 'b'], value: 5e-3 },
      ],
    }
    const sp = superposition(net)
    expect(sp.parts).toHaveLength(2)
    for (const node of Object.keys(sp.full.v)) close(sp.sumV[node], sp.full.v[node])
    for (const id of Object.keys(sp.full.i)) close(sp.sumI[id], sp.full.i[id])
    // Power in R1: the cross term 2·i₁·i₂·R is what superposition misses.
    const i1 = sp.parts[0].sol.i.R1
    const i2 = sp.parts[1].sol.i.R1
    close(sp.full.p.R1 - sp.sumP.R1, 2 * i1 * i2 * 1000)
    expect(Math.abs(sp.full.p.R1 - sp.sumP.R1)).toBeGreaterThan(1e-6)
  })

  it('maximum power at R_L = R_th, efficiency 50 % there', () => {
    const rth = 1 / (1 / 1000 + 1 / 2000 + 1 / 3000)
    const loads = [100, 300, rth * 0.999, rth, rth * 1.001, 1000, 3000]
    const sw = loadSweep(divider, 'A', GROUND, loads)
    const best = sw.points.reduce((m, q) => (q.p > m.p ? q : m))
    expect(best.R).toBe(rth)
    close(best.p, sw.pMax)
    // Efficiency is w.r.t. the whole source power, not the Thévenin model's, so
    // it is not 50 % here — that claim needs the Thévenin equivalent itself.
    const eqv = {
      elements: [
        { type: 'V', nodes: ['s', 'gnd'], value: 12 },
        { type: 'R', nodes: ['s', 'A'], value: 500 },
      ],
    }
    const sw2 = loadSweep(eqv, 'A', GROUND, [500])
    close(sw2.points[0].efficiency, 0.5)
    close(sw2.points[0].p, 144 / 2000)
  })
})

describe('invariants, fuzzed', () => {
  // A deterministic LCG so a failure is reproducible.
  let seed = 12345
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32
  const randomNet = () => {
    const nodes = ['gnd', 'a', 'b', 'c', 'd']
    const pick = () => nodes[Math.floor(rnd() * nodes.length)]
    const els = []
    // A resistive skeleton that touches every node, so nothing floats.
    for (let k = 1; k < nodes.length; k++) els.push({ type: 'R', nodes: [nodes[k], nodes[k - 1]], value: 10 ** (1 + 3 * rnd()) })
    for (let k = 0; k < 4; k++) {
      let a = pick()
      let b = pick()
      if (a === b) b = a === 'gnd' ? 'a' : 'gnd'
      els.push({ type: 'R', nodes: [a, b], value: 10 ** (1 + 3 * rnd()) })
    }
    // One voltage source to ground and one current source between distinct nodes.
    els.push({ type: 'V', nodes: [nodes[1 + Math.floor(rnd() * 4)], 'gnd'], value: 20 * rnd() - 10 })
    {
      let a = pick()
      let b = pick()
      if (a === b) b = a === 'gnd' ? 'a' : 'gnd'
      els.push({ type: 'I', nodes: [a, b], value: 0.02 * rnd() - 0.01 })
    }
    return { elements: els }
  }

  it('KCL residual and Tellegen hold on 200 random networks; superposition adds; Thévenin ways agree', () => {
    let driven = 0
    for (let t = 0; t < 200; t++) {
      const net = randomNet()
      const s = solveDC(net)
      expect(s.maxResidual).toBeLessThan(1e-9)
      close(s.pTotal, 0, 1e-9)
      const sp = superposition(net)
      for (const node of Object.keys(s.v)) close(sp.sumV[node], s.v[node], 1e-9)
      const th = thevenin(net, 'b', 'c')
      // Killing the sources leaves a passive network: the test-source R_th is positive.
      expect(th.rth.test).toBeGreaterThan(0)
      // The other two ways need a source to actually reach the port; when one
      // does, all three agree. (Random nets sometimes leave b–c undriven.)
      if (Math.abs(th.voc) > 1e-9) {
        driven++
        close(th.rth.test, th.rth.ratio, 1e-8)
        close(th.rth.fit, th.rth.test, 1e-7)
      } else {
        expect(th.rth.ratio).toBeNaN()
      }
    }
    // Most random nets do drive the port — the agreement check has to have run.
    expect(driven).toBeGreaterThan(150)
  })

  it('withElements and killed never mutate their input', () => {
    const before = JSON.stringify(divider)
    killed(divider)
    withElements(divider, [{ type: 'R', nodes: ['A', 'gnd'], value: 1 }])
    expect(JSON.stringify(divider)).toBe(before)
  })
})
