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
    foundation: {
      purpose: 'See why a logic output takes time to change, even when its input changes instantly.',
      input: 'An ideal input step between ground (0 V) and the supply (1.8 V). A rising input produces a falling output. A falling input produces a rising output.',
      output: 'The output voltage approaches the opposite rail. Read its half-supply crossing as propagation delay and its 10-90% interval as transition time.',
      parameters: 'Fanout counts driven unit inverter inputs and adds load capacitance. Output edge selects which transistor charges or discharges that load. Supply and transistor widths stay fixed here. Stages affects only the Timing view.',
      prediction: 'Before increasing fanout from one to four, predict whether the half-supply crossing moves earlier or later.',
      tradeoffs: 'More load costs delay and switching energy. Charging and discharging capacitance C through a full cycle draws about C VDD^2 from the supply. VDD is the supply voltage. This estimate omits leakage and current overlap.',
      limits: 'This isolated switch model uses constant on-resistance and lumped capacitance. Its ideal input step omits finite input slopes and switching current overlap.',
    },
    see: (x, p) => `The output crosses half the supply after ${ps(x.response.measured)} on this ${p.edge === 'fall' ? 'falling' : 'rising'} edge. The total output capacitance is ${(x.gate.ctotal * 1e15).toFixed(3)} fF.`,
    try: [{ say: 'Set fanout to four. The delay increases.', set: { fanout: 4 } },
      { say: 'Set the output edge to rise. The matched inverter has the same delay.', set: { edge: 'rise' } }],
    why: 'A rail step turns one transistor on and the other off. The output then has one resistance and one capacitance. The remaining voltage difference decays exponentially. Its time constant is resistance times capacitance. The half-supply delay is that time constant times ln(2).',
  },
  {
    id: 'a2', name: 'The transfer curve sets the noise margins', shortName: 'Noise margins', view: 'transfer', terms: ['vih', 'vil', 'square', 'margin', 'switch'],
    foundation: {
      purpose: 'Find how much voltage disturbance a logic level can tolerate before the next gate may misread it.',
      input: 'A held input voltage from 0 to 1.8 V, with a separate static solution at each value.',
      output: 'Low input gives output near 1.8 V. High input gives output near 0 V. The transfer curve supplies the input and output limits used for both noise margins.',
      parameters: 'Input voltage selects the operating point. Supply, device thresholds and the matched widths are fixed. Load capacitance does not set this static transfer curve.',
      prediction: 'Before moving the input from zero to the supply, predict the output at each endpoint and near half-supply.',
      tradeoffs: 'Inputs near a rail give a clear logic level with one transistor off. Intermediate inputs reduce logic certainty and can draw steady supply current through both transistors.',
      limits: 'Noise margins describe voltage tolerance, not switching speed. Both transistors can conduct at intermediate inputs. The square-law model is static. The switch approximation is ambiguous at exact thresholds and cannot resolve those points uniquely.',
    },
    see: (x) => `The output is ${volts(x.point.v.out)} at this input. The low and high noise margins are ${volts(x.dc.nml)} and ${volts(x.dc.nmh)}. The square-law and switch-model rail outputs agree.`,
    try: [{ say: 'Set the input to zero. The output reaches the supply.', set: { vin: 0 } },
      { say: 'Set the input to the supply. The output reaches ground.', set: { vin: CARD.vdd } }],
    why: 'The input limits occur where the transfer slope is minus one. A noise margin subtracts an output limit from an input limit, or the reverse for the high level. Both devices conduct between their thresholds. At the rails one device is off. The square-law view is static. At an exact switch threshold, both adjacent states can satisfy the model.',
  },
  {
    id: 'a3', name: 'Transistor delays become a gate model', shortName: 'Gate delay extraction', view: 'timing', terms: ['delay', 'transport'],
    foundation: {
      purpose: 'Connect an isolated transistor response to the delayed logic transitions used in a gate simulation.',
      input: 'The chain input changes at 1 ps. Each inverter reverses the logic level, so a rising input gives a falling first-stage output and alternating edges thereafter.',
      output: 'The q1, q2 and later traces switch in sequence. Compare the event delay with the isolated-stage sum and the separate analog output crossing.',
      parameters: 'Stages counts inverters in the chain. Fanout sets the same assumed load for each extracted stage. Output edge selects the first-stage output edge. Width and supply stay fixed.',
      prediction: 'Before changing three stages to five, predict the final output polarity and whether its transition occurs later.',
      tradeoffs: 'Adding stages adds propagation delay, device area and capacitance that consumes switching energy. This identical-stage chain does not optimize buffer sizes for a heavy load.',
      limits: 'Events restore ideal logic levels with transport delays rounded to 1 fs. The separate analog row connects switch-model stages with capacitive loads and finite interstage slopes. Neither model includes square-law transient currents or distributed wires.',
    },
    see: (x, p) => `The extracted falling and rising delays are ${ps(x.gate.tpHL)} and ${ps(x.gate.tpLH)}. The ${p.stages}-stage event chain takes ${ps(x.chain.elapsed)}. Its difference from the isolated-delay sum is ${(x.chain.error * 1e15).toFixed(3)} fs.`,
    try: [{ say: 'Set the chain to five stages. Its delay increases.', set: { stages: 5 } }],
    why: 'Extraction reads each transistor resistance and its output capacitance. Continuous waveform crossings give isolated-stage delays. The event chain uses those delays on a discrete grid. The separate connected chain advances its capacitor voltages through transistor threshold events. Its later inputs have finite slopes, so its crossings can differ from the event model.',
  },
  {
    id: 'a4', name: 'Pull-up width changes resistance and capacitance', shortName: 'Pull-up sizing', view: 'scope', terms: ['self', 'delay'],
    foundation: {
      purpose: 'Choose a pull-up size by comparing the cost of extra capacitance with stronger charging current.',
      input: 'The input makes an ideal rail step. A falling input turns on the pMOS pull-up and makes the output rise. A rising input turns on the nMOS pull-down and makes the output fall.',
      output: 'Compare rising and falling half-supply delays. Width two balances them in this model. Width one gives a slower rise. Width four gives a faster rise than fall.',
      parameters: 'Pull-up width multiplies the unit transistor width. It lowers pMOS resistance and increases output self-capacitance. Fanout adds fixed unit input loads. Output edge chooses the measured response. Stages applies in Timing.',
      prediction: 'Before increasing pull-up width, predict what happens to the falling delay even though the nMOS width does not change.',
      tradeoffs: 'A wider pull-up improves rising delay but increases falling delay and device area. Its extra capacitance C also costs about C VDD^2 per full charge-discharge cycle. VDD is the supply voltage.',
      limits: 'Each external load is a unit inverter. Constant resistance and lumped capacitance omit layout wiring, finite input slopes and detailed device effects. The energy estimate omits leakage and current overlap.',
    },
    see: (x, p) => `The rising delay is ${ps(x.gate.tpLH)} and the falling delay is ${ps(x.gate.tpHL)} at pull-up width ${p.wp}. The self-capacitance is ${(x.gate.cself * 1e15).toFixed(3)} fF.`,
    try: [{ say: 'Set pull-up width to one. The rising delay exceeds the falling delay.', set: { wp: 1 } },
      { say: 'Set pull-up width to four. The rising delay is shorter than the falling delay.', set: { wp: 4 } }],
    why: 'The pMOS resistance is inversely proportional to its width. Its unit-width resistance is twice the nMOS resistance in this model. Width two gives equal resistance and equal edge delays. Increasing width also increases self-capacitance. The falling delay therefore changes even though the nMOS resistance stays fixed. Each external load is a unit inverter.',
  },
  {
    id: 'a5', name: 'Delay grows linearly with fanout', shortName: 'Fanout delay', view: 'fanout', terms: ['fanout', 'self', 'delay'],
    foundation: {
      purpose: 'Estimate the timing cost of connecting one output to more gate inputs.',
      input: 'Each curve assumes an ideal input rail step and varies the number of unit inverter inputs attached to the output. Input and output edges have opposite directions.',
      output: 'The rising and falling delay curves increase with fanout. Their nonzero value at zero fanout comes from the driving inverter itself.',
      parameters: 'Selected fanout sets the circuit load and its marked position. Probe fanout samples the curve without changing that selection. Output edge chooses the probe delay. Width and supply stay fixed. Stages affects only Timing.',
      prediction: 'Before doubling fanout from four to eight, predict whether total delay doubles. Account for the delay already present at zero load.',
      tradeoffs: 'One gate can drive more inputs at the cost of delay and energy. Each added input adds capacitance C, costing about C VDD^2 per full charge-discharge cycle. VDD is the supply voltage.',
      limits: 'Linearity assumes fixed drive resistance and identical capacitive loads. Wiring, receiver switching behavior and finite input slopes are omitted. Zero external load does not mean zero capacitance.',
    },
    see: (x, p) => `The falling delay is ${ps(x.gate.tpHL)} at fanout ${p.fanout}. The zero-fanout delay is ${ps(x.fanouts[0].tpHL)}. Self-capacitance leaves a nonzero delay even without external loads.`,
    try: [{ say: 'Set fanout to four. The delay increases.', set: { fanout: 4 } },
      { say: 'Set fanout to eight. The delay increases again.', set: { fanout: 8 } }],
    why: 'Each unit load adds the same input capacitance. At fixed drive resistance, half-supply delay therefore grows linearly with fanout. The slope is resistance times unit input capacitance times ln(2). The intercept uses self-capacitance instead. These are switch-model delays for ideal input steps.',
  },
].map((e) => ({ ...e, terms: ['inverter', 'cmos', ...e.terms], group: GROUPS[0], defaults: { ...DEFAULTS } }))

export const byId = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]))
