// Group H: metastability.
//
// The one model in this lab that is not exact. Everything else here is a gate
// with a delay, and a gate with a delay has a waveform. A flip-flop whose input
// moved inside the window of Group E does not. It can sit between the two
// levels, and how long it sits there is a random variable rather than a number
// this engine can state. So the answer is a rate, it carries its parameters and
// its three assumptions everywhere it goes, and CORE_SCOPE Rule 3 is why.

import { FLOP, shiftRegister } from '@ee-labs/events'
import { Count, Delay, GROUPS, Period, Rate, Years } from './shared.js'

const YEAR = 365.25 * 24 * 3600

const chain = (p) => shiftRegister(p.n ?? 2, { period: p.period, bits: [1, 0, 1, 1, 0, 0, 0, 0] })

/** The four parameters the law is a function of, as the knobs set them. */
const model = (p) => ({ tau: p.tau, t0: p.t0, fClk: p.fclk, fData: p.fdata })

export const H = [
  {
    id: 'h1',
    group: GROUPS[7],
    name: 'The rate law, and what it rests on',
    terms: ['metastable', 'settling', 'mtbf', 'tau'],
    params: [
      Delay('tr', 'Settling time', 200, 20, 1200),
      Delay('tau', 'Regeneration τ', 20, 5, 100),
      Delay('t0', 'Aperture T0', 20, 5, 100),
      Rate('fclk', 'Clock rate', 1e9),
      Rate('fdata', 'Data rate', 1e6),
    ],
    net: (p) => chain({ ...p, n: 2, period: 1000 }),
    tEnd: () => 6000,
    wants: ['rate'],
    rate: (p) => ({ tr: p.tr, ...model(p) }),
    signals: () => ['clk', 'din', 'q0', 'q1'],
    view: 'rate',
    views: ['rate', 'timing', 'gates', 'events'],
  },
  {
    id: 'h2',
    group: GROUPS[7],
    name: 'The synchroniser, and what the second stage buys',
    terms: ['synchroniser', 'asynchronous', 'settling', 'mtbf'],
    params: [
      Count('n', 'Flip-flops in the chain', 2, 1, 3),
      Period('period', 'Clock period', 1000, 200, 5000),
      Delay('tau', 'Regeneration τ', 20, 5, 100),
      Delay('t0', 'Aperture T0', 20, 5, 100),
      Rate('fclk', 'Clock rate', 1e9),
      Rate('fdata', 'Data rate', 1e6),
    ],
    net: chain,
    tEnd: (p) => (p.n + 3) * p.period,
    wants: ['sync'],
    sync: (p) => ({ n: p.n, period: p.period, tsu: FLOP.tsu, tcq: FLOP.tcq, ...model(p) }),
    signals: (p) => ['clk', 'din', ...Array.from({ length: p.n }, (_, i) => `q${i}`)],
    view: 'rate',
    views: ['rate', 'timing', 'gates', 'events'],
  },
  {
    id: 'h3',
    group: GROUPS[7],
    name: 'Designing to a target',
    terms: ['mtbf', 'settling', 'synchroniser', 'assumption'],
    params: [
      Years('years', 'Target mean time', 1000),
      Delay('tau', 'Regeneration τ', 20, 5, 100),
      Delay('t0', 'Aperture T0', 20, 5, 100),
      Rate('fclk', 'Clock rate', 1e9),
      Rate('fdata', 'Data rate', 1e6),
    ],
    net: (p) => chain({ ...p, n: 2, period: 1000 }),
    tEnd: () => 6000,
    // The settling time the target asks for, and then the mean time that
    // settling time gives back, so the answer is checked against its own input.
    wants: ['settling', 'rate'],
    settling: (p) => ({ mtbf: p.years * YEAR, ...model(p) }),
    rate: (p) => ({ tr: Math.ceil(settlingOf(p)), ...model(p) }),
    signals: () => ['clk', 'din', 'q0', 'q1'],
    view: 'rate',
    views: ['rate', 'timing', 'gates', 'events'],
  },
]

/** The settling time the target asks for, in picoseconds. */
function settlingOf(p) {
  return p.tau * Math.log(p.years * YEAR * p.t0 * 1e-12 * p.fclk * p.fdata)
}
