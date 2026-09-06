import { CARD, CU, DEFAULTS, dcPoint, inverter } from './model.js'
import { edgeResponse, eventChain, extractGate } from './extract.js'

export const ps = (v) => `${(v * 1e12).toFixed(2)} ps`
export const volts = (v) => `${v.toFixed(3)} V`
export const GROUPS = ['A. The inverter as two switches']

export function analyse(p, dc = null) {
  const cell = inverter({ wp: p.wp })
  const load = p.fanout * 3 * CU
  const response = edgeResponse(cell, load, p.edge)
  const gate = response.gate
  return { cell, gate, load, response, dc, point: dc ? dcPoint(p.vin) : null,
    switchPoint: dc ? dcPoint(p.vin, 'switch') : null,
    chain: eventChain(gate, p.stages, p.edge),
    fanouts: Array.from({ length: 9 }, (_, fanout) => ({ fanout, ...extractGate(cell, fanout * 3 * CU) })) }
}

export const EXPERIMENTS = [
  {
    id: 'a1', name: 'An inverter output follows one exponential', shortName: 'Inverter response', view: 'scope', terms: ['switch', 'delay', 'fanout'],
    see: (x, p) => `The output crosses half the supply after ${ps(x.response.measured)} on this ${p.edge === 'fall' ? 'falling' : 'rising'} edge. The total output capacitance is ${(x.gate.ctotal * 1e15).toFixed(3)} fF.`,
    try: [{ say: 'Set fanout to four. The delay increases.', set: { fanout: 4 } },
      { say: 'Set the output edge to rise. The matched inverter has the same delay.', set: { edge: 'rise' } }],
    why: 'A rail step turns one transistor on and the other off. The output then has one resistance and one capacitance. The remaining voltage difference decays exponentially. Its time constant is resistance times capacitance. The half-supply delay is that time constant times ln(2).',
  },
  {
    id: 'a2', name: 'The transfer curve sets the noise margins', shortName: 'Noise margins', view: 'transfer', terms: ['square', 'margin', 'switch'],
    see: (x) => `The output is ${volts(x.point.v.out)} at this input. The low and high noise margins are ${volts(x.dc.nml)} and ${volts(x.dc.nmh)}. The square-law and switch-model rail outputs agree.`,
    try: [{ say: 'Set the input to zero. The output reaches the supply.', set: { vin: 0 } },
      { say: 'Set the input to the supply. The output reaches ground.', set: { vin: CARD.vdd } }],
    why: 'The input limits occur where the transfer slope is minus one. A noise margin subtracts an output limit from an input limit, or the reverse for the high level. Both devices conduct between their thresholds. At the rails one device is off. The square-law view is static. At an exact switch threshold, both adjacent states can satisfy the model.',
  },
  {
    id: 'a3', name: 'Transistor delays become a gate model', shortName: 'Gate delay extraction', view: 'timing', terms: ['delay', 'transport'],
    see: (x, p) => `The extracted falling and rising delays are ${ps(x.gate.tpHL)} and ${ps(x.gate.tpLH)}. The ${p.stages}-stage event chain takes ${ps(x.chain.elapsed)}. Its difference from the isolated-delay sum is ${(x.chain.error * 1e15).toFixed(3)} fs.`,
    try: [{ say: 'Set the chain to five stages. Its delay increases.', set: { stages: 5 } }],
    why: 'Extraction reads each transistor resistance and its output capacitance. Continuous waveform crossings give the isolated-stage delays. The event chain uses those delays on a discrete grid. It represents transport delay between logic levels. An analog chain has finite input slopes, so its transistor crossings need a separate simulation.',
  },
  {
    id: 'a4', name: 'Pull-up width changes resistance and capacitance', shortName: 'Pull-up sizing', view: 'scope', terms: ['self', 'delay'],
    see: (x, p) => `The rising delay is ${ps(x.gate.tpLH)} and the falling delay is ${ps(x.gate.tpHL)} at pull-up width ${p.wp}. The self-capacitance is ${(x.gate.cself * 1e15).toFixed(3)} fF.`,
    try: [{ say: 'Set pull-up width to one. The rising delay exceeds the falling delay.', set: { wp: 1 } },
      { say: 'Set pull-up width to four. The rising delay is shorter than the falling delay.', set: { wp: 4 } }],
    why: 'The pMOS resistance is inversely proportional to its width. Its unit-width resistance is twice the nMOS resistance in this model. Width two gives equal resistance and equal edge delays. Increasing width also increases self-capacitance. The falling delay therefore changes even though the nMOS resistance stays fixed. Each external load is a unit inverter.',
  },
  {
    id: 'a5', name: 'Delay grows linearly with fanout', shortName: 'Fanout delay', view: 'fanout', terms: ['fanout', 'self', 'delay'],
    see: (x, p) => `The falling delay is ${ps(x.gate.tpHL)} at fanout ${p.fanout}. The zero-fanout delay is ${ps(x.fanouts[0].tpHL)}. Self-capacitance leaves a nonzero delay even without external loads.`,
    try: [{ say: 'Set fanout to four. The delay increases.', set: { fanout: 4 } },
      { say: 'Set fanout to eight. The delay increases again.', set: { fanout: 8 } }],
    why: 'Each unit load adds the same input capacitance. At fixed drive resistance, half-supply delay therefore grows linearly with fanout. The slope is resistance times unit input capacitance times ln(2). The intercept uses self-capacitance instead. These are switch-model delays for ideal input steps.',
  },
].map((e) => ({ ...e, group: GROUPS[0], defaults: { ...DEFAULTS } }))

export const byId = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]))
