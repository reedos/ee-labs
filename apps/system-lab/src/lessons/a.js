// Group A's prose: the chain as a budget.
//
// Three registers per experiment. `see` describes the picture at the defaults.
// Each `try` step names one setting and the reading it produces. `why` is the
// reasoning, folded, for after the picture has made its point.
//
// Every number quoted below is a `reads` pair, and `experiments.test.js` solves
// the chain at the step's own settings and compares. A number in a sentence
// that is neither a reading nor a knob value fails that test, so a figure
// cannot be typed here and left to drift.

export const LESSONS_A = {
  a1: {
    see:
      'The table holds one block. Its gain is 15 dB, its noise figure 1.5 dB, its input IP3 −5 dBm, and it ' +
      'draws 33 mW. Those four numbers are the whole record, and no circuit stands behind them. The output IP3 ' +
      'reads 10.000 dBm, which is the input IP3 plus the gain.',
    seeReads: [['total.oip3Dbm', 10]],
    try: [
      {
        say: 'Set the gain to 25 dB. The output IP3 rises to 20.000 dBm, because the block’s own input IP3 has not moved.',
        set: { gainDb: 25 },
        reads: [
          ['total.oip3Dbm', 20],
          ['total.iip3Dbm', -5],
        ],
      },
      {
        say: 'Set the input IP3 to 5 dBm and leave the gain at 15 dB. The output IP3 is 20.000 dBm again, reached by moving the other number.',
        set: { iip3Dbm: 5 },
        reads: [['total.oip3Dbm', 20]],
      },
      {
        say: 'Set the noise figure to 3 dB. The output IP3 stays at 10.000 dBm, because the noise budget and the linearity budget share no term.',
        set: { nfDb: 3 },
        reads: [
          ['total.nfDb', 3],
          ['total.oip3Dbm', 10],
        ],
      },
      {
        say: 'Set the DC power to 66 mW. The power column reads 66.000 mW and no other column moves.',
        set: { powerMw: 66 },
        reads: [
          ['total.powerMw', 66],
          ['total.oip3Dbm', 10],
        ],
      },
    ],
    why:
      'A systems engineer writes these four numbers down before any circuit exists, and this lab’s claim is ' +
      'that they predict what the chain does. Gain and DC power belong to the block alone. The noise figure ' +
      'and the input IP3 belong to the block and to its place in the chain, because each is divided by the ' +
      'gain in front of it. The output IP3 is the input IP3 plus the gain, so a block given more gain hands ' +
      'its third-order product on at a higher level. Where several stages each make a product, the column adds ' +
      'them as voltages with their phases aligned. That is the worst case rather than the answer, and the pane ' +
      'prints the power sum beside it. With one block the two rules give the same number.',
  },

  a2: {
    see:
      'The chain has six blocks. The cumulative gain runs −2.000, 13.000, 11.000, 19.000, 16.000 and 38.000 dB, ' +
      'one step per block. Each step is that block’s own gain, added. Multiply the six power ratios instead and ' +
      'the answer is the same 6309.57 to one.',
    seeReads: [
      ['cum.1.gain', -2],
      ['cum.2.gain', 13],
      ['cum.3.gain', 11],
      ['cum.4.gain', 19],
      ['cum.5.gain', 16],
      ['cum.6.gain', 38],
      ['total.gain', 6309.573],
    ],
    try: [
      {
        say: 'Bypass the low-noise amplifier. The total falls to 23.000 dB, which is 15 dB less, and every node behind it shifts by that same step.',
        set: { bypass: 'lna' },
        reads: [['total.gainDb', 23]],
      },
      {
        say: 'Bypass the preselect filter instead. The total rises to 40.000 dB, because the loss that filter was adding is out of the chain.',
        set: { bypass: 'presel' },
        reads: [['total.gainDb', 40]],
      },
      {
        say: 'Set the amplifier gain to 25 dB. The total is 48.000 dB, ten decibels more, and every node behind the amplifier moves with it.',
        set: { lnaGainDb: 25 },
        reads: [
          ['total.gainDb', 48],
          ['cum.2.gain', 23],
        ],
      },
      {
        say: 'Set the IF amplifier gain to 10 dB. The total is 26.000 dB, and the first five nodes have not moved at all.',
        set: { ifGainDb: 10 },
        reads: [
          ['total.gainDb', 26],
          ['cum.5.gain', 16],
        ],
      },
    ],
    why:
      'A cascade of blocks multiplies power ratios, and decibels turn that product into a sum. The column is ' +
      'drawn in decibels so that a reader can add along it by eye. The gains here are available gains, which ' +
      'means the power a block delivers into a matched load over the power available from its source. Friis ' +
      'wrote the noise figure of a cascade in the same currency, so every interface in this lab is taken as ' +
      'matched. A reflecting interface would add a mismatch loss, and the block record carries no reflection ' +
      'coefficient to compute one from. Bypassing a block shifts every node behind it by exactly that block’s ' +
      'gain, which makes the column a budget rather than a report.',
  },

  a3: {
    see:
      'One filter, and its loss is the knob that matters. At 2 dB of loss and 290 K the noise figure reads ' +
      '2.0000 dB. The two numbers are equal at the reference temperature and nowhere else. Cool the filter and ' +
      'the noise figure falls while the loss stays where it was.',
    seeReads: [['total.nfDb', 2]],
    try: [
      {
        say: 'Cool the filter to 77 K. The noise figure falls to 0.6269 dB, while the loss is still 2 dB.',
        set: { tempK: 77 },
        reads: [['total.nfDb', 0.626945]],
      },
      {
        say: 'Cool it to 4 K. The noise figure is 0.03490 dB, and the block still costs 2 dB of signal.',
        set: { tempK: 4 },
        reads: [['total.nfDb', 0.0348961]],
      },
      {
        say: 'Set the loss to 6 dB at 290 K. The noise figure is 6.0000 dB, so the two are equal at every loss.',
        set: { lossDb: 6, tempK: 290 },
        reads: [['total.nfDb', 6]],
      },
      {
        say: 'Keep the loss at 6 dB and cool the filter to 77 K. The noise figure is 2.5322 dB, well under the loss.',
        set: { lossDb: 6, tempK: 77 },
        reads: [['total.nfDb', 2.53223]],
      },
    ],
    why:
      'A matched attenuator at a physical temperature T has a noise factor of 1 + (L − 1) T/T_0. L is its loss ' +
      'as a power ratio. Its output noise is thermal noise at its own temperature, whatever arrived at its ' +
      'input. The signal is attenuated by L and that noise is not, so the ratio between them falls by L. At ' +
      'the reference temperature the two are the same number. That is why a datasheet gives a passive part’s ' +
      'noise figure as its insertion loss. Cooled, the same part is much quieter than its loss suggests.',
  },

  a4: {
    see:
      'The input is −80 dBm and the noise floor is −120.965 dBm over a 200 kHz noise bandwidth. The ' +
      'signal-to-noise ratio starts at 40.965 dB and ends at 36.299 dB. The gap between the two lines is that ' +
      'ratio. It narrows along the chain and never widens.',
    seeReads: [
      ['floor.dbm', -120.965],
      ['snr.in', 40.9649],
      ['snr.out', 36.2986],
    ],
    try: [
      {
        say: 'Widen the noise bandwidth to 20.00 MHz. The floor rises to −100.965 dBm and the output ratio falls to 16.299 dB, twenty decibels of each.',
        set: { bandwidthHz: 2e7 },
        reads: [
          ['floor.dbm', -100.965],
          ['snr.out', 16.2986],
        ],
      },
      {
        say: 'Raise the input to −60 dBm. The output ratio is 56.299 dB, twenty decibels better, because the floor has not moved.',
        set: { pinDbm: -60 },
        reads: [
          ['snr.out', 56.2986],
          ['floor.dbm', -120.965],
        ],
      },
      {
        say: 'Set the amplifier gain to 25 dB. The output ratio improves to 37.333 dB, and every level after the amplifier rises by ten decibels.',
        set: { lnaGainDb: 25 },
        reads: [
          ['snr.out', 37.3331],
          ['level.6.signal', -32],
        ],
      },
      {
        say: 'Set the IF amplifier gain to 10 dB. The last node falls to −54.000 dBm and the output ratio stays at 36.299 dB.',
        set: { ifGainDb: 10 },
        reads: [
          ['level.6.signal', -54],
          ['snr.out', 36.2986],
        ],
      },
    ],
    why:
      'The signal at a node is the input level plus the cumulative gain. The noise is the floor plus that same ' +
      'cumulative gain plus the cumulative noise figure. Subtract one from the other and the gain cancels, so ' +
      'the ratio at any node is the input ratio less the noise figure up to that node. Gain moves both lines ' +
      'together and leaves the gap alone. Only a noise figure narrows the gap. The cumulative noise figure runs ' +
      '2.0000, 3.5000, 3.5565, 4.2972, 4.3174 and 4.6663 dB along this chain, and the ratio falls by exactly ' +
      'those decibels.',
    whyReads: [
      ['cum.1.nf', 2],
      ['cum.2.nf', 3.5],
      ['cum.3.nf', 3.5565],
      ['cum.4.nf', 4.2972],
      ['cum.5.nf', 4.3174],
      ['cum.6.nf', 4.6663],
    ],
  },
}
