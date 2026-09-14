import { pwlTransient } from '@ee-labs/network'
import { extractGate } from './extract.js'

/** Continuous switch-model chain; later gates see actual preceding node voltages. */
export function analogChain(cell, load, stages = 3, edge = 'fall', points = 181) {
  if (!Number.isInteger(stages) || stages < 1 || stages > 8) throw new Error('The chain must contain 1 to 8 stages.')
  if (!['fall', 'rise'].includes(edge)) throw new Error('The output edge must be rise or fall.')
  const gate = extractGate(cell, load)
  // Each stage drives one next gate, plus enough explicit external load to make
  // the total equal to the extracted load used by the event chain.
  if (load < gate.cin.in) throw new Error('A connected chain requires at least one following gate input capacitance per stage.')
  const falling = edge === 'fall'
  const elements = [
    { type: 'V', id: 'VDD', nodes: ['vdd', 'gnd'], value: cell.vdd },
    { type: 'V', id: 'Vin', nodes: ['in', 'gnd'], value: falling ? cell.vdd : 0,
      wave: { kind: 'step', from: falling ? 0 : cell.vdd, to: falling ? cell.vdd : 0 } },
  ]
  const x0 = []
  for (let i = 1; i <= stages; i++) {
    const input = i === 1 ? 'in' : `q${i - 1}`
    for (const mos of cell.net.elements.filter(e => e.type === 'M')) {
      elements.push({ ...mos, id: `${mos.id}${i}`, nodes: [`q${i}`, input, mos.polarity === 'p' ? 'vdd' : 'gnd'] })
    }
    elements.push({ type: 'C', id: `CL${i}`, nodes: [`q${i}`, 'gnd'], value: gate.ctotal })
    x0.push((i % 2 === 1) === falling ? cell.vdd : 0)
  }
  const tEnd = (stages + 2) * 10 * Math.max(gate.tpHL, gate.tpLH) / Math.LN2
  const walk = pwlTransient({ elements }, { tEnd, points, x0 })
  const crossings = x0.map((initial, i) => {
    const down = initial > cell.vdd / 2
    let lo = 0, hi = tEnd
    if ((walk.at(hi).sol.v[`q${i + 1}`] < cell.vdd / 2) !== down) return null
    for (let k = 0; k < 55; k++) {
      const mid = (lo + hi) / 2
      if ((walk.at(mid).sol.v[`q${i + 1}`] < cell.vdd / 2) === down) hi = mid
      else lo = mid
    }
    return (lo + hi) / 2
  })
  return { walk, crossings, elapsed: crossings.at(-1), tEnd, net: { elements }, gate }
}
