import { complex as cx } from '@ee-labs/network'
import { mathNumber } from './workedSolve.js'

export const n = mathNumber
export const par = (x) => `\\left(${n(x)}\\right)`
export const vec = (xs) => `\\begin{bmatrix}${xs.join(' \\\\ ')}\\end{bmatrix}`
export const mat = (A, fmt = n) => `\\begin{bmatrix}${A.map((r) => r.map(fmt).join(' & ')).join(' \\\\ ')}\\end{bmatrix}`
export const sum = (xs) => xs.length ? xs.join(' + ').replaceAll('+ -', '- ') : '0'
export const dot = (a, b) => a.reduce((s, v, j) => s + v * b[j], 0)
export const linear = (a, symbols) => sum(a.flatMap((v, j) => v === 0 ? [] : [`${par(v)}${symbols[j]}`]))
export const products = (a, b) => sum(a.flatMap((v, j) => v === 0 ? [] : [`${par(v)}${par(b[j])}`]))
export const qty = (value, unit) => `${n(value)}\\,\\mathrm{${unit}}`
export const rect = (z) => `${n(z[0])}${z[1] < 0 ? '-' : '+'}j\\,${n(Math.abs(z[1]))}`
export const polar = (z) => `${n(cx.cabs(z))}\\angle ${n(cx.cabs(z) === 0 ? 0 : cx.carg(z) * 180 / Math.PI)}^{\\circ}`

/** The 1×1 or 2×2 inverse written explicitly for the state-phasor derivation. */
export function statePhasor(A, B, U, omega) {
  const M = A.map((row, i) => row.map((v, j) => [-v, i === j ? omega : 0]))
  const g = B.map((row) => row.reduce((s, v, j) => cx.cadd(s, cx.cscale(U[j], v)), [0, 0]))
  if (A.length === 1) return { M, g, X: [cx.cdiv(g[0], M[0][0])] }
  const det = cx.csub(cx.cmul(M[0][0], M[1][1]), cx.cmul(M[0][1], M[1][0]))
  const X = [
    cx.cdiv(cx.csub(cx.cmul(M[1][1], g[0]), cx.cmul(M[0][1], g[1])), det),
    cx.cdiv(cx.csub(cx.cmul(M[0][0], g[1]), cx.cmul(M[1][0], g[0])), det),
  ]
  return { M, g, X, det }
}
