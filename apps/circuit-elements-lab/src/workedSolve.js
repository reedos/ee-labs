import { cellLatex } from '@ee-labs/network'

// Solve a copy of the displayed matrix, recording the actual operations.
// Values from the circuit solver are never used to fill an unknown here.
export function mathNumber(value) {
  if (value === 0) return '0'
  const rounded = Number(value.toPrecision(6))
  if (Math.abs(rounded) >= 1e6 || Math.abs(rounded) < 1e-5) {
    const [m, e] = rounded.toExponential(5).split('e')
    return `${Number(m)}\\times10^{${Number(e)}}`
  }
  return String(rounded)
}

const par = (v) => `\\left(${mathNumber(v)}\\right)`
const unit = (u) => u.kind === 'v' ? 'V' : 'A'
const quantity = (v, u) => `${mathNumber(v)}\\,\\mathrm{${u}}`
const join = (terms) => terms.length ? terms.join(' + ').replaceAll('+ -', '- ') : '0'
const rowName = (r) => r.kind === 'kcl' ? `KCL at ${r.node}` : `${r.id} constraint`

function expression(a, cols, values = [], products = false) {
  return join(a.flatMap((c, j) => {
    if (c === 0) return []
    if (values[j] !== undefined) return [products ? mathNumber(c * values[j]) : `${mathNumber(c)}\\cdot${par(values[j])}`]
    return [c === 1 ? cols[j].latex : c === -1 ? `-${cols[j].latex}` : `${mathNumber(c)}\\,${cols[j].latex}`]
  }))
}

export function workedSolve(eq, sol) {
  const { cols, rows: labels, cells, rhs } = eq.symbolic
  const values = Array(cols.length).fill(undefined)
  const steps = []
  const rows = eq.M.map((a, i) => ({ a: [...a], b: eq.r[i], name: rowName(labels[i]), index: i }))
  const knownResistors = new Set()
  const nodeIndex = new Map(cols.flatMap((c, i) => c.kind === 'v' ? [[c.node, i]] : []))
  const nodeValue = (n) => n === 'gnd' || n === '0' ? 0 : values[nodeIndex.get(n)]
  const unknowns = (row) => row.a.flatMap((c, j) => c !== 0 && values[j] === undefined ? [j] : [])

  const addResistors = () => {
    for (const e of sol.sys.effs) {
      if (e.type !== 'R' || !(e.value > 0) || knownResistors.has(e.id)) continue
      const [a, b] = e.nodes
      const va = nodeValue(a), vb = nodeValue(b)
      if (va === undefined || vb === undefined) continue
      knownResistors.add(e.id)
      const drop = va - vb, current = drop / e.value
      const voltage = (n) => n === 'gnd' || n === '0' ? '0' : cols[nodeIndex.get(n)].latex
      steps.push({ kind: 'resistor', title: `Find the voltage across ${e.id}, then its current`,
        text: `Both end voltages are now known. Subtract the second terminal's voltage from the first, then divide by the resistance. The reference direction for this current is ${a} → ${b}.`,
        latex: [
          `v_{${e.id}} &= ${voltage(a)}-${voltage(b)} = ${mathNumber(va)}-${par(vb)} = ${quantity(drop, 'V')}`,
          `i_{${e.id}} &= \\frac{v_{${e.id}}}{R_{${e.id.replace(/^R/, '')}}} = \\frac{${mathNumber(drop)}}{${mathNumber(e.value)}} = ${quantity(current, 'A')}`,
        ],
        note: current < 0 ? `The negative result means current actually flows from ${b} toward ${a}.` : current > 0 ? `The positive result means current flows from ${a} toward ${b}.` : 'The two ends are at the same voltage, so this resistor carries no current.',
      })
    }
  }

  let eliminated = false
  while (values.some((v) => v === undefined)) {
    // Prefer a constraint with one unknown, then a KCL row with one unknown.
    const ready = rows.filter((row) => unknowns(row).length === 1)
      .sort((a, b) => Number(labels[a.index].kind === 'kcl') - Number(labels[b.index].kind === 'kcl'))[0]
    if (ready) {
      const j = unknowns(ready)[0]
      const coefficient = ready.a[j]
      const sum = ready.a.reduce((s, c, k) => s + (values[k] === undefined ? 0 : c * values[k]), 0)
      const value = (ready.b - sum) / coefficient
      const hasKnown = ready.a.some((c, k) => c !== 0 && values[k] !== undefined)
      const u = cols[j]
      const latex = hasKnown ? [`${expression(ready.a, cols, values)} &= ${mathNumber(ready.b)}`] : []
      if (hasKnown) latex.push(`${expression(ready.a, cols, values, true)} &= ${mathNumber(ready.b)}`)
      if (hasKnown) latex.push(`${u.latex} &= \\frac{${mathNumber(ready.b)}-${par(sum)}}{${mathNumber(coefficient)}} = ${quantity(value, unit(u))}`)
      else latex.push(`${u.latex} &= ${coefficient === 1 ? '' : `\\frac{${mathNumber(ready.b)}}{${mathNumber(coefficient)}} = `}${quantity(value, unit(u))}`)
      const element = sol.norm.elements.find((e) => e.id === u.id)
      steps.push({ kind: 'solve', variable: j, value,
        title: `${hasKnown ? 'Substitute into' : 'Read'} ${ready.name}`,
        text: hasKnown
          ? `Replace the quantities already found by their values. Multiply out those terms, move their sum to the right-hand side, then divide by the coefficient of the remaining unknown.`
          : `This row has only one unknown. Its value follows directly by dividing the right-hand side by its coefficient.`,
        latex,
        note: u.kind === 'v'
          ? `This is the voltage at node ${u.node} relative to ground.${labels[ready.index].from === 'C' ? ' The capacitor holds its voltage at this instant; it can change as the cursor moves in time.' : ''}`
          : element?.nodes.length === 2
            ? `The reference current enters ${element.nodes[0]} and leaves ${element.nodes[1]}. ${value < 0 ? 'The negative sign means the actual current flows in the opposite direction.' : value > 0 ? 'The positive sign means the actual current follows that direction.' : 'The current is zero at this instant.'}`
            : 'This current uses the reference direction shown on the schematic.',
      })
      values[j] = value
      addResistors()
      continue
    }

    if (eliminated) return { unavailable: 'The displayed matrix cannot be reliably reduced to a unique solution for these settings.' }
    eliminated = true
    // Remove known terms, then use scaled pivot selection on the remaining
    // block. Record each row subtraction, including the resulting equation.
    for (const row of rows) {
      row.a.forEach((c, j) => {
        if (values[j] !== undefined) { row.b -= c * values[j]; row.a[j] = 0 }
      })
    }
    let pivotRow = 0
    for (let col = 0; col < cols.length; col++) {
      if (values[col] !== undefined) continue
      let best = -1, score = 0
      for (let k = pivotRow; k < rows.length; k++) {
        const scale = Math.max(...rows[k].a.map(Math.abs))
        const ratio = scale ? Math.abs(rows[k].a[col]) / scale : 0
        if (ratio > score) { score = ratio; best = k }
      }
      if (best < 0) continue
      ;[rows[pivotRow], rows[best]] = [rows[best], rows[pivotRow]]
      const pivot = rows[pivotRow]
      for (let k = pivotRow + 1; k < rows.length; k++) {
        const row = rows[k]
        if (row.a[col] === 0) continue
        const factor = row.a[col] / pivot.a[col]
        const before = expression(row.a, cols)
        const beforeB = row.b
        row.a = row.a.map((c, j) => c - factor * pivot.a[j])
        row.a[col] = 0
        row.b -= factor * pivot.b
        const label = `R_{${row.index + 1}}`, pLabel = `R_{${pivot.index + 1}}`
        steps.push({ kind: 'eliminate', title: `Eliminate one unknown from row ${row.index + 1}`,
          text: `Several unknowns remain coupled, so direct substitution is not enough yet. Substitute any values already found and move their contributions to the right-hand side. Then subtract a multiple of row ${pivot.index + 1} from row ${row.index + 1} to cancel the selected column. Here R with a row number means an equation row, not a resistor.`,
          latex: [
            `${label}:\\quad ${before} &= ${mathNumber(beforeB)}`,
            `${pLabel}:\\quad ${expression(pivot.a, cols)} &= ${mathNumber(pivot.b)}`,
            `${label} &\\leftarrow ${label}-${par(factor)}${pLabel}`,
            `${expression(row.a, cols)} &= ${mathNumber(row.b)}`,
          ], note: 'This row operation preserves the solution. The new row replaces the old one in the remaining steps.',
        })
        row.name = `reduced row ${row.index + 1}`
      }
      pivotRow++
    }
  }
  const residuals = eq.M.map((row, i) => row.reduce((s, c, j) => s + c * values[j], 0) - eq.r[i])
  const relative = Math.max(...eq.M.map((row, i) => Math.abs(residuals[i]) / Math.max(1e-30, Math.abs(eq.r[i]), row.reduce((s, c, j) => s + Math.abs(c * values[j]), 0))))
  if (!values.every(Number.isFinite) || relative > 1e-7) return { unavailable: 'Rounding in this reduction is too large to show a trustworthy worked solution for these settings.' }
  const original = cells.map((row, i) => {
    const lhs = join(row.flatMap((terms, j) => {
      if (!terms.length) return []
      const c = cellLatex(terms)
      return [c === '1' ? cols[j].latex : c === '-1' ? `-${cols[j].latex}` : `\\left(${c}\\right)${cols[j].latex}`]
    }))
    const r = cellLatex(rhs[i])
    return `${lhs} &= ${r}${r !== '0' ? ` = ${quantity(eq.r[i], labels[i].kind === 'kcl' ? 'A' : 'V')}` : ''} &&\\text{(${rowName(labels[i])})}`
  })
  return { steps, values, original, residuals,
    kclResidual: Math.max(0, ...residuals.filter((_, i) => labels[i].kind === 'kcl').map(Math.abs)),
    voltageResidual: Math.max(0, ...residuals.filter((_, i) => labels[i].kind !== 'kcl').map(Math.abs)),
  }
}
