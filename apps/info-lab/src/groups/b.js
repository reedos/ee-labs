// Group B: capacity and the Shannon limit.
//
// Three of the plan's four. B4 draws the limit on the Communications Lab's bit
// error rate plot, and that canvas is not built, so B4 is in `BACKLOG.md` with
// the dependency named.

import { capacityAWGNDb, capacityBEC, capacityBSC, shannonLimitDb } from '@ee-labs/codes'
import { Decibels, Efficiency, GROUPS, Probability } from './shared.js'
import { steps } from './a.js'

export const B = [
  {
    id: 'b1',
    group: GROUPS[1],
    name: 'Capacity is a rate, not a quality',
    terms: ['capacity', 'snr', 'bandwidth', 'decibel'],
    params: [Decibels('snrDb', 'Signal-to-noise ratio', 10, -10, 30)],
    capacity: (p) => ({ snrDb: p.snrDb }),
    curve: (p) => ({
      xLabel: 'signal-to-noise ratio, dB',
      yLabel: 'capacity, bit/s/Hz',
      points: steps(-10, 30, 81).map((db) => ({ x: db, y: capacityAWGNDb(db) })),
      mark: { x: p.snrDb, y: capacityAWGNDb(p.snrDb) },
    }),
    view: 'curve',
    views: ['curve', 'channel'],
  },
  {
    id: 'b2',
    group: GROUPS[1],
    name: 'A noisy binary channel still has a capacity',
    terms: ['bsc', 'bec', 'crossover', 'capacity', 'binaryentropy'],
    params: [Probability('crossover', 'Crossover probability', 0.1, undefined, 0, 0.5), Probability('erasure', 'Erasure probability', 0.25, undefined, 0, 1)],
    capacity: (p) => ({ crossover: p.crossover, erasure: p.erasure }),
    curve: (p) => ({
      xLabel: 'crossover or erasure probability',
      yLabel: 'capacity, bit per use',
      points: steps(0, 0.5, 51).map((x) => ({ x, y: capacityBSC(x) })),
      second: steps(0, 0.5, 51).map((x) => ({ x, y: capacityBEC(x) })),
      secondLabel: 'erasure channel',
      firstLabel: 'symmetric channel',
      mark: { x: p.crossover, y: capacityBSC(p.crossover) },
    }),
    view: 'curve',
    views: ['curve', 'channel'],
  },
  {
    id: 'b3',
    group: GROUPS[1],
    name: 'The limit on the energy per bit',
    terms: ['ebn0', 'shannonlimit', 'efficiency', 'capacity'],
    params: [Efficiency('efficiency', 'Spectral efficiency', 1), Decibels('esN0Db', 'Ratio per channel use', 0, -6, 10)],
    capacity: (p) => ({ efficiency: p.efficiency, esN0Db: p.esN0Db, snrDb: p.esN0Db }),
    curve: (p) => ({
      xLabel: 'spectral efficiency, bit/s/Hz',
      yLabel: 'least energy per bit, dB',
      points: steps(0.125, 4, 63).map((r) => ({ x: r, y: shannonLimitDb(r) })),
      floor: shannonLimitDb(0.001),
      floorLabel: 'floor, ln 2',
      mark: { x: p.efficiency, y: shannonLimitDb(p.efficiency) },
    }),
    view: 'curve',
    views: ['curve', 'channel'],
  },
]
