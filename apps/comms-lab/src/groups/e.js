// Group E: synchronisation.
//
// Every experiment before this one assumed the receiver knew the carrier phase
// and the symbol instant. This group removes both assumptions and recovers them
// with loops. Both loops are discrete second-order loops with a zero-order hold,
// which is Control Lab II's subject, and the `why` lines name that lab rather
// than duplicating it.

export const GROUP_E = 'Synchronisation'

export default [
  {
    id: 'E1',
    group: GROUP_E,
    name: 'A phase error rotates the constellation',
    terms: ['constellation', 'carrier', 'coherent', 'evm'],
    params: { scheme: 'qpsk', ebN0Db: 14, phaseOffsetDeg: 30, symbols: 4096, seed: 1 },
    view: 'constellation',
    views: ['constellation', 'loop'],
    featured: { field: 'phaseOffsetDeg' },
    claims: [
      {
        label: 'a 30 degree error scales the wanted component by 0.866',
        path: 'loop.phaseLossDb',
        formula: () => -20 * Math.log10(Math.cos(Math.PI / 6)),
        tol: 1e-9,
      },
      {
        label: 'which costs 1.249 dB',
        path: 'loop.phaseLossDb',
        formula: () => 1.2494,
        tol: 1e-3,
      },
      {
        label: 'and the rotation shows up in the error vector reading',
        path: 'cloud.evm.rms',
        atLeastValue: 0.1,
      },
    ],
  },
  {
    id: 'E2',
    group: GROUP_E,
    name: 'The Costas loop finds the phase',
    terms: ['costas', 'carrier', 'loopbandwidth'],
    params: { scheme: 'bpsk', phaseOffsetDeg: 40, bnT: 0.02, zeta: 0.707, loopOrder: 2, symbols: 4000, seed: 1 },
    view: 'loop',
    views: ['loop', 'constellation'],
    featured: { field: 'bnT' },
    claims: [
      {
        label: 'the loop bandwidth is the normalised one times the symbol rate',
        path: 'loop.bn',
        formula: (p) => p.bnT * p.symbolRate,
        tol: 1e-12,
      },
      {
        label: 'which is 20.00 Hz at these settings',
        path: 'loop.bn',
        formula: () => 20,
        tol: 1e-12,
      },
      {
        label: 'the natural frequency follows from the bandwidth and the damping',
        path: 'loop.wn',
        formula: (p) => (2 * p.bnT * p.symbolRate) / (p.zeta + 1 / (4 * p.zeta)),
        tol: 1e-12,
      },
      {
        label: 'both poles sit inside the unit circle, so the loop is stable',
        path: 'loop.poleRadius',
        atMostValue: 1,
      },
      {
        label: 'and the residual phase error settles below half a degree',
        path: 'loop.residualDeg',
        atMostValue: 0.5,
      },
    ],
  },
  {
    id: 'E3',
    group: GROUP_E,
    name: 'A frequency offset needs a second-order loop',
    terms: ['costas', 'carrier', 'loopbandwidth'],
    params: { scheme: 'bpsk', freqOffsetHz: 5, bnT: 0.02, zeta: 0.707, loopOrder: 2, symbols: 8000, seed: 3 },
    view: 'loop',
    views: ['loop', 'constellation'],
    featured: { field: 'freqOffsetHz' },
    claims: [
      {
        label: 'a second-order loop follows the offset and leaves nothing behind',
        path: 'loop.residualDeg',
        atMostValue: 0.5,
      },
      {
        label: 'a first-order loop leaves a static error instead',
        path: 'loop.firstOrderErrorDeg',
        atLeastValue: 1,
      },
      {
        label: 'and that error is many times the second-order one',
        path: 'loop.firstOrderErrorDeg',
        atLeastScaled: { path: 'loop.residualDeg', by: 2 },
      },
    ],
  },
  {
    id: 'E4',
    group: GROUP_E,
    name: 'The early-late gate finds the instant',
    terms: ['earlylate', 'eye', 'rrc', 'loopbandwidth'],
    params: { shape: 'rrc', beta: 0.35, span: 12, gate: 0.5, symbols: 2000, seed: 1 },
    view: 'gate',
    views: ['gate', 'eye'],
    featured: { field: 'gate' },
    claims: [
      {
        label: 'the gate spacing of half a symbol is four samples at eight a symbol',
        path: 'loop.gate.gateSamples',
        formula: (p) => p.gate * p.sps,
        tol: 1e-12,
      },
      {
        label: 'the error signal has a slope at the instant, so it says which way to move',
        path: 'loop.slope',
        atLeastValue: 0.5,
      },
      {
        label: 'and it turns over past a fifth of a symbol, which bounds the pull-in',
        path: 'loop.peakAt',
        atLeastValue: 0.2,
      },
      {
        label: 'the eye is fully open once the instant is found',
        path: 'eye.openingClean',
        formula: () => 1,
        tol: 1e-6,
      },
    ],
  },
  {
    id: 'E5',
    group: GROUP_E,
    name: 'Loop bandwidth is a trade',
    terms: ['loopbandwidth', 'costas', 'awgn'],
    params: { scheme: 'bpsk', phaseOffsetDeg: 40, bnT: 0.02, zeta: 0.707, symbols: 8000, seed: 6 },
    view: 'loop',
    views: ['loop'],
    featured: { field: 'bnT' },
    claims: [
      {
        label: 'the loop settles inside one per cent in 173 symbols',
        path: 'loop.settleSymbols1pc',
        formula: () => 173,
        tol: 0,
      },
      {
        label: 'which is 172.7 ms at 1000 symbols a second',
        path: 'loop.settleMs',
        formula: () => 172.71,
        tol: 1e-3,
      },
      {
        label: 'the loop ratio is one over twice the normalised bandwidth',
        path: 'loop.snrDb',
        formula: (p) => 10 * Math.log10(1 / (2 * p.bnT)),
        tol: 1e-12,
      },
      {
        label: 'so narrowing the loop fourfold buys 6.02 dB and costs four times the settling',
        path: 'loop.snrDb',
        formula: () => 13.979,
        tol: 1e-3,
      },
    ],
  },
]
