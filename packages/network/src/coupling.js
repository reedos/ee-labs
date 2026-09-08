import {NetworkError} from './netlist.js'

/** A signed mutual inductance is declared once: L1 {coupledTo: 'L2', mutual: M}.
 * Positive M means both reference currents enter corresponding dotted terminals.
 * Reject a singular/non-passive magnetic model rather than silently approximating it.
 */
export function inductanceMatrix(elements) {
  const inductors = elements.filter(e => e.type === 'L')
  const index = new Map(inductors.map((e, i) => [e.id, i]))
  const matrix = inductors.map((e, i) => inductors.map((_, j) => i === j ? e.value : 0))
  const pairs = [], seen = new Set()
  for (const e of elements) {
    if (e.coupledTo === undefined && e.mutual === undefined) continue
    const i = index.get(e.id), j = index.get(e.coupledTo)
    if (i === undefined || j === undefined || i === j || !Number.isFinite(e.mutual))
      throw new NetworkError('coupling', 'Mutual inductance must name two distinct inductors and a finite signed value in henries.')
    const key = [e.id, e.coupledTo].sort().join('\0')
    if (seen.has(key)) throw new NetworkError('coupling', 'Declare each mutual-inductance pair once; the reciprocal term is added automatically.')
    seen.add(key)
    matrix[i][j] = matrix[j][i] = e.mutual
    pairs.push({a: e.id, b: e.coupledTo, mutual: e.mutual, i, j})
  }
  if (pairs.length) {
    // Cholesky on the normalized inductance matrix checks the full magnetic
    // energy form, including networks with more than one coupled pair.
    const lower = matrix.map(row => row.map(() => 0))
    for (let i = 0; i < matrix.length; i++) for (let j = 0; j <= i; j++) {
      let value = matrix[i][j] / Math.sqrt(matrix[i][i] * matrix[j][j])
      for (let k = 0; k < j; k++) value -= lower[i][k] * lower[j][k]
      if (i === j) {
        if (!(value > 1e-12)) throw new NetworkError('coupling', 'The inductance matrix must have positive magnetic energy. Perfect coupling is singular; use an ideal-transformer model for that limit.')
        lower[i][j] = Math.sqrt(value)
      } else lower[i][j] = value / lower[j][j]
    }
  }
  return {inductors, matrix, pairs}
}
