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
            latex: `\\frac{${diffSym(node, other)}}{R${sub(eff.id.replace(/^R/, '') || eff.id)}}`,
            value: val(() => (v[node] - v[other]) / eff.value),
            id: eff.id,
            kind: 'ohm',
          })
          break
        case 'I':
          terms.push({ sign, latex: `I${sub(eff.id.replace(/^I/, '') || eff.id)}`, value: val(() => sign * eff.value), id: eff.id, kind: 'source' })
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
          latex: `${diffSym(a, b)} = ${eff.value === 0 ? '0' : `E${sub(eff.id.replace(/^V/, '') || eff.id)}`}`,
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

  return { rows, unknowns: sys.unknowns, M: sys.M, r: sys.r, matrixLatex: matrixLatex(sys) }
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
