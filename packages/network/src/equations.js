// The equations the solver solved, written out for a reader.
//
// One KCL row per node (sum of currents leaving = 0), one constraint row per
// element that fixes a voltage. The terms are produced by walking the same
// effective elements the solver stamped, so what is printed is what was
// solved — and each term carries its numeric value from the solution, so the
// reader can see the row add to zero.

import { GROUND } from './netlist.js'
import { assemble } from './mna.js'

const sub = (s) => (s.length > 1 ? `_{${s}}` : `_${s}`)
const vSym = (node) => (node === GROUND ? '0' : `v${sub(node)}`)
const iSym = (id) => `i${sub(id)}`

/** LaTeX for v_a − v_b with ground dropping out. */
export function diffSym(a, b) {
  if (b === GROUND) return vSym(a)
  if (a === GROUND) return `-${vSym(b)}`
  return `(${vSym(a)} - ${vSym(b)})`
}

/**
 * Build the equation set for a netlist. `sol` (from solveDC) is optional; when
 * given, every term also carries its value.
 */
export function equations(norm, sol = null, opts = {}) {
  const sys = sol ? sol.sys : assemble(norm, opts)
  const v = sol ? sol.v : null
  const val = (fn) => (v ? fn() : undefined)
  const rows = []

  for (const node of norm.nodeNames) {
    const terms = []
    for (const eff of sys.effs) {
      const [a, b] = eff.nodes
      if (eff.type === 'OPAMP') {
        if (a === node)
          terms.push({ sign: +1, latex: iSym(eff.id), value: val(() => sol.i[eff.id]), id: eff.id, kind: 'unknown' })
        continue
      }
      if (a !== node && b !== node) continue
      if (eff.type === 'OPEN') continue
      const sign = a === node ? +1 : -1
      const other = a === node ? b : a
      switch (eff.type) {
        case 'R':
          terms.push({
            sign: +1,
            latex: `\\frac{${diffSym(node, other)}}{${rSym(eff)}}`,
            value: val(() => (v[node] - v[other]) / eff.value),
            id: eff.id,
            kind: 'ohm',
          })
          break
        case 'GI':
          // A diode's straight piece: a conductance with a current source
          // beside it, so it contributes both a term in the node voltages and
          // a constant — the same two terms a resistor and a source would.
          terms.push({
            sign: +1,
            latex: `\frac{${diffSym(node, other)}}{r_{${sub(eff.id)}}}`,
            value: val(() => eff.g * (v[node] - v[other])),
            id: eff.id,
            kind: 'ohm',
          })
          terms.push({ sign, latex: `I_{${sub(eff.id)}}`, value: val(() => sign * eff.i0), id: eff.id, kind: 'source' })
          break
        case 'I':
          terms.push({ sign, latex: jSym(eff), value: val(() => sign * eff.value), id: eff.id, kind: 'source' })
          break
        case 'VCCS':
          terms.push({
            sign,
            latex: `g${sub(eff.id)}\\,${diffSym(eff.ctrl[0], eff.ctrl[1])}`,
            value: val(() => sign * sol.i[eff.id]),
            id: eff.id,
            kind: 'dependent',
          })
          break
        default:
          terms.push({ sign, latex: iSym(eff.id), value: val(() => sign * sol.i[eff.id]), id: eff.id, kind: 'unknown' })
      }
    }
    const latex = terms.length
      ? terms.map((t, k) => (t.sign < 0 ? ' - ' : k ? ' + ' : '') + t.latex).join('') + ' = 0'
      : '0 = 0'
    rows.push({ kind: 'kcl', node, terms, latex, sum: v ? terms.reduce((s, t) => s + t.value, 0) : undefined })
  }

  for (const eff of sys.effs) {
    const [a, b] = eff.nodes
    switch (eff.type) {
      case 'V':
        rows.push({
          kind: 'constraint',
          id: eff.id,
          latex: `${diffSym(a, b)} = ${eff.value === 0 && eff.from !== 'C' ? '0' : eSym(eff)}`,
          value: eff.value,
          lhs: val(() => v[a] - v[b]),
        })
        break
      case 'VCVS':
        rows.push({
          kind: 'constraint',
          id: eff.id,
          latex: `${diffSym(a, b)} = ${eff.gain === 1 ? '' : `A${sub(eff.id)}\\,`}${diffSym(eff.ctrl[0], eff.ctrl[1])}`,
          lhs: val(() => v[a] - v[b]),
          rhs: val(() => eff.gain * (v[eff.ctrl[0]] - v[eff.ctrl[1]])),
        })
        break
      case 'OPAMP':
        rows.push({
          kind: 'constraint',
          id: eff.id,
          latex: `${vSym(eff.ctrl[0])} = ${vSym(eff.ctrl[1])}`,
          lhs: val(() => v[eff.ctrl[0]]),
          rhs: val(() => v[eff.ctrl[1]]),
        })
        break
      default:
    }
  }

  const symbolic = symbolicSystem(sys, norm)
  return { rows, unknowns: sys.unknowns, M: sys.M, r: sys.r, matrixLatex: matrixLatex(sys), symbolic, symbolicLatex: symbolicMatrixLatex(symbolic) }
}

const rSym = (eff) => (eff.from === 'SW' ? `R${sub(eff.id)}` : `R${sub(eff.id.replace(/^R/, '') || eff.id)}`)
const eSym = (eff) => (eff.from === 'C' ? `v${sub(eff.id)}` : `E${sub(eff.id.replace(/^V/, '') || eff.id)}`)
const jSym = (eff) => (eff.from === 'L' ? `i${sub(eff.id)}` : `I${sub(eff.id.replace(/^I/, '') || eff.id)}`)

/**
 * The assembled system written in symbols: every cell of M and of r is the
 * list of terms the stamps put there — `1/R_1`, `-1/R_2`, `1`, `E_1` — each
 * carrying the number it stands for, so the symbolic matrix can be checked
 * against the numeric one cell by cell. Rows are labelled by the equation
 * they are (KCL at a node, or the constraint one element imposes) and columns
 * by the unknown they multiply. `symbols` lists every letter used, with its
 * value and what it is, for a legend.
 */
export function symbolicSystem(sys, norm) {
  const m = sys.M.length
  const cells = Array.from({ length: m }, () => Array.from({ length: m }, () => []))
  const rhs = Array.from({ length: m }, () => [])
  const ix = (node) => norm.index.get(node)
  const symbols = new Map()
  const symbol = (latex, value, eff, what) => {
    if (!symbols.has(latex)) symbols.set(latex, { latex, value, id: eff.id, what })
    return latex
  }
  const put = (i, j, sign, latex, value) => cells[i][j].push({ sign, latex, value: sign * value })
  const putR = (i, sign, latex, value) => rhs[i].push({ sign, latex, value: sign * value })
  const branch = (row, a, b) => {
    const ia = ix(a)
    const ib = ix(b)
    if (ia >= 0) {
      put(ia, row, +1, '1', 1)
      put(row, ia, +1, '1', 1)
    }
    if (ib >= 0) {
      put(ib, row, -1, '1', 1)
      put(row, ib, -1, '1', 1)
    }
  }

  for (const eff of sys.effs) {
    const [a, b] = eff.nodes
    switch (eff.type) {
      case 'GI': {
        const g = `\frac{1}{${symbol(`r_{${sub(eff.id)}}`, 1 / eff.g, eff, 'R')}}`
        const ia = ix(a)
        const ib = ix(b)
        if (ia >= 0) put(ia, ia, +1, g, eff.g)
        if (ib >= 0) put(ib, ib, +1, g, eff.g)
        if (ia >= 0 && ib >= 0) {
          put(ia, ib, -1, g, eff.g)
          put(ib, ia, -1, g, eff.g)
        }
        if (ia >= 0) putR(ia, -1, `I_{${sub(eff.id)}}`, eff.i0)
        if (ib >= 0) putR(ib, +1, `I_{${sub(eff.id)}}`, eff.i0)
        break
      }
      case 'R': {
        const R = symbol(rSym(eff), eff.value, eff, eff.from === 'SW' ? 'switchR' : 'R')
        const g = `\\frac{1}{${R}}`
        const ia = ix(a)
        const ib = ix(b)
        if (ia >= 0) put(ia, ia, +1, g, 1 / eff.value)
        if (ib >= 0) put(ib, ib, +1, g, 1 / eff.value)
        if (ia >= 0 && ib >= 0) {
          put(ia, ib, -1, g, 1 / eff.value)
          put(ib, ia, -1, g, 1 / eff.value)
        }
        break
      }
      case 'I': {
        const I = symbol(jSym(eff), eff.value, eff, eff.from === 'L' ? 'iL' : 'I')
        if (ix(a) >= 0) putR(ix(a), -1, I, eff.value)
        if (ix(b) >= 0) putR(ix(b), +1, I, eff.value)
        break
      }
      case 'V': {
        const row = sys.currentIdx.get(eff.id)
        branch(row, a, b)
        // A zero on the right (a short, a wire, a 0 V source) needs no symbol.
        if (eff.value !== 0 || eff.from === 'C') putR(row, +1, symbol(eSym(eff), eff.value, eff, eff.from === 'C' ? 'vC' : 'E'), eff.value)
        break
      }
      case 'VCVS': {
        const row = sys.currentIdx.get(eff.id)
        branch(row, a, b)
        const A = symbol(`A${sub(eff.id)}`, eff.gain, eff, 'A')
        const [c, d] = eff.ctrl
        if (ix(c) >= 0) put(row, ix(c), -1, A, eff.gain)
        if (ix(d) >= 0) put(row, ix(d), +1, A, eff.gain)
        break
      }
      case 'VCCS': {
        const g = symbol(`g${sub(eff.id)}`, eff.gain, eff, 'g')
        const [c, d] = eff.ctrl
        const [ia, ib, ic, id] = [a, b, c, d].map(ix)
        if (ia >= 0 && ic >= 0) put(ia, ic, +1, g, eff.gain)
        if (ia >= 0 && id >= 0) put(ia, id, -1, g, eff.gain)
        if (ib >= 0 && ic >= 0) put(ib, ic, -1, g, eff.gain)
        if (ib >= 0 && id >= 0) put(ib, id, +1, g, eff.gain)
        break
      }
      case 'OPAMP': {
        const row = sys.currentIdx.get(eff.id)
        if (ix(a) >= 0) put(ix(a), row, +1, '1', 1)
        const [p, q] = eff.ctrl
        if (ix(p) >= 0) put(row, ix(p), +1, '1', 1)
        if (ix(q) >= 0) put(row, ix(q), -1, '1', 1)
        break
      }
      default:
    }
  }

  const byRow = new Map([...sys.currentIdx.entries()].map(([id, row]) => [row, id]))
  const rows = Array.from({ length: m }, (_, k) => {
    if (k < norm.n) return { kind: 'kcl', node: norm.nodeNames[k] }
    const eff = sys.effs.find((e) => e.id === byRow.get(k))
    return { kind: 'constraint', id: eff.id, type: eff.type, from: eff.from || eff.type, wire: !!eff.wire, value: eff.value }
  })
  const cols = sys.unknowns.map((u) => ({ ...u, latex: u.kind === 'v' ? vSym(u.node) : iSym(u.id) }))
  return { cells, rhs, rows, cols, symbols: [...symbols.values()] }
}

/** One cell's terms as LaTeX: `\frac{1}{R_1} - \frac{1}{R_2}`, or `0`. */
export function cellLatex(terms) {
  if (!terms.length) return '0'
  return terms.map((t, k) => (t.sign < 0 ? '-' : k ? '+' : '') + t.latex).join('')
}

/** The symbolic system as LaTeX: M x = r with letters in place of numbers. */
export function symbolicMatrixLatex(sym) {
  const M = sym.cells.map((row) => row.map(cellLatex).join(' & ')).join(' \\\\ ')
  const x = sym.cols.map((c) => c.latex).join(' \\\\ ')
  const r = sym.rhs.map(cellLatex).join(' \\\\ ')
  return `\\begin{bmatrix} ${M} \\end{bmatrix} \\begin{bmatrix} ${x} \\end{bmatrix} = \\begin{bmatrix} ${r} \\end{bmatrix}`
}

/** Format a number for a matrix cell: short, no trailing noise. */
export function fmtCell(x) {
  if (x === 0) return '0'
  const a = Math.abs(x)
  if (a >= 1e4 || a < 1e-3) {
    const e = Math.floor(Math.log10(a))
    const m = x / 10 ** e
    return `${+m.toFixed(3)}\\times10^{${e}}`
  }
  return String(+x.toPrecision(4))
}

/** The assembled system as LaTeX: M x = r with the unknowns named. */
export function matrixLatex(sys) {
  const cols = sys.unknowns.map((u) => (u.kind === 'v' ? vSym(u.node) : iSym(u.id)))
  const M = sys.M.map((row) => row.map(fmtCell).join(' & ')).join(' \\\\ ')
  const x = cols.join(' \\\\ ')
  const r = sys.r.map(fmtCell).join(' \\\\ ')
  return `\\begin{bmatrix} ${M} \\end{bmatrix} \\begin{bmatrix} ${x} \\end{bmatrix} = \\begin{bmatrix} ${r} \\end{bmatrix}`
}

export { vSym, iSym }
