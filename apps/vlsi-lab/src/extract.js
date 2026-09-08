import { pwlTransient } from '@ee-labs/network'
import { simulate } from '@ee-labs/events'

export const EXTRACTION_SCOPE = 'Extraction requires one complementary inverter with an ideal rail step and one output capacitance.'
export const EVENT_GUARD = 'The event chain rounds each delay to 1 fs. Each stage adds at most 0.5 fs of rounding error.'

function inspect(cell, load) {
  if (!Number.isFinite(load) || load < 0) throw new Error('Output load must be finite and nonnegative.')
  const es = cell?.net?.elements || []
  const mos = es.filter((e) => e.type === 'M')
  const n = mos.find((e) => e.polarity === 'n')
  const p = mos.find((e) => e.polarity === 'p')
  const input = cell?.inputs?.[0]
  const sources = es.filter((e) => e.type === 'V')
  const supply = sources.find((e) => e.id === 'VDD')
  const drive = sources.find((e) => e.id === 'Vin')
  const valid = cell?.model === 'switch' && cell.inputs.length === 1 && mos.length === 2 && es.length === 4 && n && p &&
    cell.output === 'out' && input === 'in' && Number.isFinite(cell.vdd) && cell.vdd > 0 &&
    supply?.nodes.join() === 'vdd,gnd' && supply.value === cell.vdd && !supply.wave &&
    drive?.nodes.join() === 'in,gnd' && !drive.wave &&
    n.nodes.join() === 'out,in,gnd' && p.nodes.join() === 'out,in,vdd' &&
    mos.every((e) => e.model === 'switch' && Number.isFinite(e.ron) && e.ron > 0 &&
      Number.isFinite(e.vt) && e.vt > 0 && e.vt < cell.vdd && e.roff == null &&
      !e.cgs && !e.cgd && Number.isFinite(e.cgate) && e.cgate > 0 && Number.isFinite(e.cdrain) && e.cdrain > 0)
  if (!valid) throw new Error(EXTRACTION_SCOPE)
  return { n, p, cself: n.cdrain + p.cdrain, cin: n.cgate + p.cgate }
}

export function extractGate(cell, load) {
  const { n, p, cself, cin } = inspect(cell, load)
  const ctotal = cself + load
  const tpHL = n.ron * ctotal * Math.LN2
  const tpLH = p.ron * ctotal * Math.LN2
  return { tpHL, tpLH, tr: p.ron * ctotal * Math.log(9), tf: n.ron * ctotal * Math.log(9),
    cin: { in: cin }, cself, ctotal, exact: true, scope: 'isolated-rail-step',
    path: [{ input: 'in', pattern: [0, 1], tp: tpHL }, { input: 'in', pattern: [1, 0], tp: tpLH }] }
}

export function edgeResponse(cell, load, edge = 'fall', points = 181) {
  if (!['rise', 'fall'].includes(edge)) throw new Error('The output edge must be rise or fall.')
  const gate = extractGate(cell, load)
  const falling = edge === 'fall'
  const net = { elements: cell.net.elements.map((e) => e.id === 'Vin'
    ? { ...e, value: falling ? cell.vdd : 0, wave: { kind: 'step', from: falling ? 0 : cell.vdd, to: falling ? cell.vdd : 0 } }
    : { ...e }) }
  net.elements.push({ type: 'C', id: 'CL', nodes: ['out', 'gnd'], value: gate.ctotal })
  const tau = (falling ? gate.tpHL : gate.tpLH) / Math.LN2
  const tEnd = 6 * tau
  // This is a t=0 rail step with a charged output, not a ramp or a chain input.
  const walk = pwlTransient(net, { tEnd, points, x0: [falling ? cell.vdd : 0] })
  const crossing = (fraction) => {
    let lo = 0
    let hi = tEnd
    for (let i = 0; i < 55; i++) {
      const mid = (lo + hi) / 2
      const below = walk.at(mid).sol.v.out < cell.vdd * fraction
      if (below === falling) hi = mid
      else lo = mid
    }
    return (lo + hi) / 2
  }
  return { net, gate, walk, tau, tEnd, measured: crossing(0.5),
    transition: Math.abs(crossing(0.9) - crossing(0.1)), edge }
}

export function eventChain(gate, stages = 3, edge = 'fall') {
  if (!Number.isInteger(stages) || stages < 1 || stages > 8) throw new Error('The chain must contain 1 to 8 stages.')
  if (!['rise', 'fall'].includes(edge)) throw new Error('The output edge must be rise or fall.')
  const tick = 1e-15
  const tr = Math.round(gate.tpLH / tick)
  const tf = Math.round(gate.tpHL / tick)
  if (![tr, tf].every((t) => Number.isSafeInteger(t) && t >= 1)) throw new Error('The delay is outside the 1 fs event grid.')
  const start = 1000
  const gates = Array.from({ length: stages }, (_, i) => ({ id: `q${i + 1}`, kind: 'not',
    in: [i ? `q${i}` : 'in'], tpLH: tr, tpHL: tf }))
  const net = { unit: { num: 1, den: 1e15 }, sources: [{ id: 'in', kind: 'step', at: start,
    from: edge === 'fall' ? 0 : 1, to: edge === 'fall' ? 1 : 0 }], gates, outputs: [`q${stages}`] }
  const res = simulate(net, { tEnd: start + (stages + 1) * Math.max(tr, tf) })
  const reference = Array.from({ length: stages }, (_, i) =>
    (i % 2 === 0) === (edge === 'fall') ? gate.tpHL : gate.tpLH).reduce((a, b) => a + b, 0)
  const last = res.waves[`q${stages}`].t.at(-1)
  const elapsed = (last - start) * tick
  return { res, start, tick, reference, elapsed, error: elapsed - reference, bound: stages * tick / 2, exact: false }
}
