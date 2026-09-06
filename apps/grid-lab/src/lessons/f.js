// Group F: symmetrical components.

export const LESSONS_F = {
  f1: {
    see:
      'Three unbalanced currents of 10 A, 6 A and 8 A are drawn beside the three balanced sets they add ' +
      'up to. The positive set is 7.80894 A, the negative set is 1.32184 A, and the zero set is ' +
      '1.98492 A. Rebuilding the three originals from those sets is exact.',
    seeReads: [
      ['seq.positive.mag', 7.80894],
      ['seq.negative.mag', 1.32184],
      ['seq.zero.mag', 1.98492],
      ['seq.rebuild', 0, 1e-13],
    ],
    try: [
      {
        say: 'Set the third current to 20 A. The positive set rises to 11.7953 A and the negative set to 2.89277 A.',
        set: { Ic: 20 },
        reads: [
          ['seq.positive.mag', 11.7953],
          ['seq.negative.mag', 2.89277],
        ],
      },
      {
        say: 'Set the third current to 0 A. The three sets become 5.16315 A, 3.88730 A and 1.88788 A, and the rebuild is still exact.',
        set: { Ic: 0 },
        reads: [
          ['seq.positive.mag', 5.16315],
          ['seq.negative.mag', 3.8873],
          ['seq.zero.mag', 1.88788],
          ['seq.rebuild', 0, 1e-13],
        ],
      },
      {
        say: 'Balance the set: 10 A in each phase, at −120° and 120°. Only the positive set is left.',
        set: { Ia: 10, Ib: 10, Ic: 10, angB: -120, angC: 120 },
        reads: [
          ['seq.positive.mag', 10],
          ['seq.negative.mag', 0, 1e-14],
          ['seq.zero.mag', 0, 1e-14],
        ],
      },
    ],
    why:
      'The transform is a change of basis. Three complex numbers go in and three come out, and the matrix ' +
      'that does it is built from the cube roots of one. Its inverse is the same matrix transposed and ' +
      'scaled, so the product of the two is the identity to floating point, and no information is lost in ' +
      'either direction. That is the whole of why the method works. The three sets are not approximations ' +
      'of an unbalanced set. They are an exact decomposition, and each one behaves differently in the ' +
      'network, which is what F3 builds and Group G connects. Circuit Elements Lab h2 is where the phasor ' +
      'picture itself is introduced.',
    whyReads: [[(x) => x.rebuilt.abc.length, 3]],
  },

  f2: {
    see:
      'The three phase currents add to 5.95477 A, and that is exactly three times the zero-sequence ' +
      'current of 1.98492 A. Whatever the three currents are, that identity holds, because the zero set ' +
      'is defined as their average.',
    seeReads: [
      ['seq.neutral', 5.95477],
      ['seq.zero.mag', 1.98492],
      [(x) => x.neutral.mag / (3 * x.seq.mag[0]), 1, 1e-12],
    ],
    try: [
      {
        say: 'Set the second current to 12 A. The neutral falls to 2.58889 A, and the zero-sequence current follows it to 0.862962 A.',
        set: { Ib: 12 },
        reads: [
          ['seq.neutral', 2.58889],
          ['seq.zero.mag', 0.862962],
        ],
      },
      {
        say: 'Balance the set. The neutral falls to nothing, so a fourth wire could be left out and no current would be lost.',
        set: { Ia: 10, Ib: 10, Ic: 10, angB: -120, angC: 120 },
        reads: [
          ['seq.neutral', 0, 1e-13],
          ['seq.zero.mag', 0, 1e-14],
        ],
      },
      {
        say: 'Set every angle to zero and every magnitude to 10 A. The set is now pure zero sequence, and the neutral carries 30 A.',
        set: { Ia: 10, Ib: 10, Ic: 10, angB: 0, angC: 0 },
        reads: [
          ['seq.neutral', 30],
          ['seq.zero.mag', 10],
        ],
      },
    ],
    why:
      'The zero-sequence current is the average of the three phase currents, so their sum is three times ' +
      'it. A neutral wire carries that sum, which is where the factor of three comes from and why it ' +
      'keeps appearing. A grounding impedance in the neutral carries three times the zero-sequence ' +
      'current while the sequence network carries one of them, so it enters the zero-sequence network ' +
      'three times over, and F3 measures that. A delta winding has no neutral at all. Zero-sequence ' +
      'current can circulate inside a delta but cannot leave it, so a delta blocks the zero sequence from ' +
      'the network beyond.',
    whyReads: [[(x) => x.neutral.mag - 3 * x.seq.mag[0], 0, 1e-13]],
  },

  f3: {
    see:
      'The positive and negative networks run back through the transformer to the generator, so both are ' +
      '0.45 pu. The zero-sequence network stops at the delta winding, so it is 0.7 pu, made of the ' +
      'transformer’s 0.1 pu and the line’s 0.6 pu. The zero-sequence number is not a multiple of the ' +
      'other two.',
    seeReads: [
      ['z.Z1', 0.45],
      ['z.Z2', 0.45],
      ['z.Z0', 0.7],
    ],
    try: [
      {
        say: 'Set the winding connection to grounded wye on both sides. Zero-sequence current now reaches the generator, and the impedance rises to 0.75 pu.',
        set: { connection: 'wyeg-wyeg' },
        reads: [['z.Z0', 0.75]],
      },
      {
        say: 'Keep both windings grounded and put 0.1 pu in the generator’s neutral. The zero-sequence impedance rises by 0.3 pu, to 1.05 pu.',
        set: { connection: 'wyeg-wyeg', Zn: 0.1 },
        reads: [
          ['z.Z0', 1.05],
          [(x) => x.z.Z0[1] - x.zSolid.Z0[1], 0.3],
        ],
      },
      {
        say: 'Set the line’s zero-sequence reactance to 0.9 pu. The zero network reaches 1 pu while the other two do not move.',
        set: { Xl0: 0.9 },
        reads: [
          ['z.Z0', 1],
          ['z.Z1', 0.45],
        ],
      },
    ],
    why:
      'Each sequence has its own network. The positive-sequence network is the ordinary per-phase ' +
      'circuit. The negative-sequence network is the same circuit with the reactances a reversed field ' +
      'sees, which differ only at rotating machines. The zero-sequence network is a different circuit ' +
      'altogether, because zero-sequence current needs a return path and only some connections give it ' +
      'one. A delta winding gives it nowhere to go beyond the winding, and a grounded wye gives it a path ' +
      'through the neutral. On a line the zero-sequence reactance is two or three times the positive one, ' +
      'because the return is through the earth and not through the other conductors.',
    whyReads: [[(x) => x.zWye.Z0[1] - x.z.Z0[1], 0.05, 1e-12]],
  },

  f4: {
    see:
      'The set here is unbalanced but healthy. Its negative-sequence current is 1.32184 A against a ' +
      'positive-sequence current of 7.80894 A, which is an unbalance factor of 16.9272 %. A motor on ' +
      'this supply sees that negative-sequence current as heat.',
    seeReads: [
      ['seq.negative.mag', 1.32184],
      ['seq.positive.mag', 7.80894],
      [(x) => 100 * x.unbalance, 16.9272],
    ],
    try: [
      {
        say: 'Set the third current to 9 A, closer to the other two. The unbalance factor falls to 12.6931 %.',
        set: { Ic: 9 },
        reads: [[(x) => 100 * x.unbalance, 12.6931]],
      },
      {
        say: 'Set the third current to 4 A. The unbalance factor rises to 39.7759 %, and the negative-sequence current with it.',
        set: { Ic: 4 },
        reads: [[(x) => 100 * x.unbalance, 39.7759]],
      },
      {
        say: 'Balance the set. The unbalance factor goes to nothing, and only the positive sequence is left.',
        set: { Ia: 10, Ib: 10, Ic: 10, angB: -120, angC: 120 },
        reads: [[(x) => 100 * x.unbalance, 0, 1e-12]],
      },
    ],
    why:
      'Nothing has failed here. A network can be unbalanced simply because its loads are, and the ' +
      'transform applies to any three phasors whether or not anything is wrong. What makes the negative ' +
      'sequence worth reading is what it does inside a machine. A negative-sequence set produces a field ' +
      'turning backwards, which the rotor sees at twice the supply frequency, and the currents that ' +
      'induces are loss. A few percent of negative-sequence current is enough to matter for a large ' +
      'motor, which is why supply codes put a limit on this ratio. Group G is the same machinery applied ' +
      'to a network where something has failed.',
    whyReads: [[(x) => x.unbalance - x.seq.mag[2] / x.seq.mag[1], 0, 1e-15]],
  },
}
