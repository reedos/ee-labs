// Group D: the channel, and the bit error rate.
//
// The lab's centre. Every experiment here shows the closed form and the count
// together, and the claim kind `inside` is this group's own. A counted rate is
// checked against the form by its own interval, never by a tolerance chosen to
// make a test pass.
//
// The four objects this group reads from the Random Signals Lab are the seeded
// generator, the Q function, the Wilson interval and the matched filter's
// 2E/N0. All four are built and are used rather than rebuilt.

export const GROUP_D = 'The AWGN channel and the bit error rate'

export default [
  {
    id: 'D1',
    group: GROUP_D,
    name: 'The channel is a seeded Gaussian',
    terms: ['awgn', 'seed', 'evm', 'ebn0', 'constellation'],
    params: { scheme: 'qpsk', ebN0Db: 10, symbols: 8192, seed: 1 },
    view: 'constellation',
    views: ['constellation', 'ber'],
    featured: { field: 'seed' },
    claims: [
      {
        label: 'each arm carries half the noise density',
        path: 'cloud.sigma',
        formula: (p) => Math.sqrt(1 / (2 * 2 * 10 ** (p.ebN0Db / 10))),
        tol: 1e-12,
      },
      {
        label: 'and the spread of the cloud reads that number over both arms',
        path: 'cloud.evm.rms',
        againstScaled: { path: 'cloud.sigma', by: Math.SQRT2 },
        tol: 0.05,
      },
      {
        label: 'so the counted rate sits where the closed form puts it',
        path: 'ber.closed',
        inside: { lo: 'ber.counted.ci.0', hi: 'ber.counted.ci.1' },
      },
    ],
  },
  {
    id: 'D2',
    group: GROUP_D,
    name: 'The matched filter',
    terms: ['matchedfilter', 'awgn', 'ebn0', 'softmetric'],
    params: { pulse: 'rect', pulseLength: 64, n0: 0.05, trials: 20000, seed: 1 },
    view: 'ber',
    views: ['ber'],
    featured: { field: 'n0' },
    claims: [
      {
        label: 'the output ratio is twice the pulse energy over the noise density',
        path: 'snr.twoEOverN0',
        formula: (p) => 2 / p.n0,
        tol: 1e-12,
      },
      {
        label: 'which is 40.000 for a unit-energy pulse at a density of 0.05',
        path: 'snr.twoEOverN0',
        formula: () => 40,
        tol: 1e-12,
      },
      {
        label: 'the measured mean sits on what the correlation predicts',
        path: 'snr.expectedMean',
        inside: { lo: 'snr.mean.ci.0', hi: 'snr.mean.ci.1' },
      },
      {
        label: 'and the measured variance on what the noise predicts',
        path: 'snr.expectedVariance',
        inside: { lo: 'snr.variance.ci.0', hi: 'snr.variance.ci.1' },
      },
      {
        label: 'a filter that does not match reaches less, which is the bound',
        path: 'snr.mismatchLoss',
        atMostValue: 1,
      },
    ],
  },
  {
    id: 'D3',
    group: GROUP_D,
    name: 'BPSK, the form and the count',
    terms: ['ber', 'qfunction', 'ebn0', 'interval'],
    params: {
      scheme: 'bpsk',
      ebN0Db: 4,
      berFrom: 0,
      berTo: 10,
      berStep: 2,
      countTo: 8,
      countSymbols: 200000,
      seed: 13,
    },
    view: 'ber',
    views: ['ber'],
    featured: { field: 'ebN0Db' },
    claims: [
      {
        label: 'the form reads 7.8650 in a hundred at nothing',
        path: 'ber.at.0.closed',
        formula: () => 0.078650,
        tol: 1e-4,
      },
      {
        label: 'and 1.2501 in a hundred at 4 dB',
        path: 'ber.at.4.closed',
        formula: () => 0.0125008,
        tol: 1e-4,
      },
      {
        label: 'and 1.9091 in ten thousand at 8 dB',
        path: 'ber.at.8.closed',
        formula: () => 1.90908e-4,
        tol: 1e-4,
      },
      {
        label: 'the count at nothing lands inside its own interval of the form',
        path: 'ber.at.0.closed',
        inside: { lo: 'ber.at.0.lo', hi: 'ber.at.0.hi' },
      },
      {
        label: 'and at 4 dB',
        path: 'ber.at.4.closed',
        inside: { lo: 'ber.at.4.lo', hi: 'ber.at.4.hi' },
      },
      {
        label: 'and at 6 dB',
        path: 'ber.at.6.closed',
        inside: { lo: 'ber.at.6.lo', hi: 'ber.at.6.hi' },
      },
    ],
  },
  {
    id: 'D4',
    group: GROUP_D,
    name: 'The interval is the guard',
    terms: ['interval', 'ber', 'seed'],
    params: {
      scheme: 'bpsk',
      ebN0Db: 8,
      countSymbols: 4000,
      berFrom: 0,
      berTo: 10,
      berStep: 2,
      countTo: 8,
      seed: 1,
    },
    view: 'ber',
    views: ['ber'],
    featured: { field: 'countSymbols' },
    claims: [
      {
        label: 'a hundred errors give a half width of 19.6 per cent',
        path: 'ber.halfWidth100',
        formula: () => 1.959963984540054 / 10,
        tol: 1e-12,
      },
      {
        label: 'a thousand give 6.2 per cent',
        path: 'ber.halfWidth1000',
        formula: () => 1.959963984540054 / Math.sqrt(1000),
        tol: 1e-12,
      },
      {
        label: 'and 385 errors are needed for a tenth',
        path: 'ber.errorsForTenth',
        formula: () => 385,
        tol: 0,
      },
      {
        label: 'at 4000 symbols and 8 dB the point rests on too few errors',
        path: 'ber.counted.errors',
        atMostValue: 30,
      },
      {
        label: 'so it is drawn hollow and its interval is printed instead',
        path: 'ber.hollowBelow',
        formula: () => 30,
        tol: 0,
      },
    ],
  },
  {
    id: 'D5',
    group: GROUP_D,
    name: 'QPSK costs nothing per bit',
    terms: ['ber', 'ser', 'gray', 'constellation'],
    params: { scheme: 'qpsk', ebN0Db: 10, countSymbols: 100000, countTo: 6, seed: 3 },
    view: 'ber',
    views: ['ber', 'constellation'],
    featured: { field: 'ebN0Db' },
    claims: [
      {
        label: 'the bit rate at 10 dB is 3.8721 in a million',
        path: 'ber.closed',
        formula: () => 3.87211e-6,
        tol: 1e-4,
      },
      {
        label: 'which is what BPSK reads at the same energy per bit',
        path: 'ber.threshold.qpsk',
        against: 'ber.threshold.bpsk',
        tol: 1e-9,
      },
      {
        label: 'the symbol rate is exactly twice the bit rate',
        path: 'ber.ser',
        againstScaled: { path: 'ber.closed', by: 2 },
        tol: 1e-3,
      },
    ],
  },
  {
    id: 'D6',
    group: GROUP_D,
    name: '16-QAM buys rate with 3.847 dB',
    terms: ['ber', 'constellation', 'mindistance'],
    params: { scheme: 'qam16', ebN0Db: 13.435, target: 1e-5, countSymbols: 60000, countTo: 6 },
    view: 'ber',
    views: ['ber', 'constellation'],
    featured: { field: 'ebN0Db' },
    claims: [
      {
        label: '16-QAM needs 13.435 dB for one error in a hundred thousand',
        path: 'ber.threshold.qam16',
        formula: () => 13.435,
        tol: 1e-3,
      },
      {
        label: 'against 9.588 dB for QPSK',
        path: 'ber.threshold.qpsk',
        formula: () => 9.5879,
        tol: 1e-3,
      },
      {
        label: '64-QAM needs 17.787 dB',
        path: 'ber.threshold.qam64',
        formula: () => 17.787,
        tol: 1e-3,
      },
      {
        label: 'so two more bits a symbol cost a further 4.352 dB',
        path: 'ber.threshold.qam64',
        againstScaled: { path: 'ber.threshold.qam16', by: 17.787 / 13.435 },
        tol: 1e-3,
      },
    ],
  },
  {
    id: 'D7',
    group: GROUP_D,
    name: 'Coherent against noncoherent FSK',
    terms: ['ber', 'qfunction', 'ebn0', 'carrier', 'coherent'],
    params: { scheme: 'fskCoherent', ebN0Db: 12.598, target: 1e-5, countSymbols: 200000, countTo: 8 },
    view: 'ber',
    views: ['ber'],
    featured: { field: 'ebN0Db' },
    claims: [
      {
        label: 'coherent FSK needs 12.598 dB',
        path: 'ber.threshold.fskCoherent',
        formula: () => 12.598,
        tol: 1e-3,
      },
      {
        label: 'noncoherent FSK needs 13.352 dB',
        path: 'ber.threshold.fskNoncoherent',
        formula: () => 13.352,
        tol: 1e-3,
      },
      {
        label: 'and the gap to BPSK is exactly 3.010 dB',
        path: 'ber.orthogonalPenaltyDb',
        formula: () => 10 * Math.log10(2),
        tol: 1e-3,
      },
      {
        label: 'the count at 6 dB sits inside its own interval of the form',
        path: 'ber.at.6.closed',
        inside: { lo: 'ber.at.6.lo', hi: 'ber.at.6.hi' },
      },
    ],
  },
  {
    id: 'D8',
    group: GROUP_D,
    name: 'Symbol errors and bit errors',
    terms: ['ser', 'ber', 'gray'],
    params: { scheme: 'qam16', ebN0Db: 10, countSymbols: 60000, countTo: 6 },
    view: 'ber',
    views: ['ber', 'constellation'],
    featured: { field: 'ebN0Db' },
    claims: [
      {
        label: 'the symbol rate at 10 dB is 7.004 in a thousand',
        path: 'ber.ser',
        formula: () => 7.00429e-3,
        tol: 1e-3,
      },
      {
        label: 'the bit rate is 1.7542 in a thousand',
        path: 'ber.closed',
        formula: () => 1.75415e-3,
        tol: 1e-3,
      },
      {
        label: 'so the ratio to four times the bit rate is 0.9982',
        path: 'ber.serRatio',
        formula: () => 0.998246,
        tol: 1e-4,
      },
      {
        label: 'and counting the symbols outside their region reaches the same rate',
        path: 'ber.ser',
        inside: { lo: 'cloud.ser.ci.0', hi: 'cloud.ser.ci.1' },
      },
    ],
  },
]
