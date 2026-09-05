// Group G: the four faults.

export const LESSONS_G = {
  g1: {
    see:
      'A three-phase fault shorts the positive-sequence network alone. Here that gives 2.22222 pu in ' +
      'every phase, which is 557.826 A at a 100 MVA and 230 kV base, or 222.222 MVA at the fault bus. The ' +
      'negative and zero networks carry nothing at all.',
    seeReads: [
      ['fault.phaseA', 2.22222],
      ['fault.amps', 557.826],
      ['fault.level', 222.222],
      ['fault.seq.negative', 0, 1e-14],
      ['fault.seq.zero', 0, 1e-14],
      ['base.MVA', 100],
      ['base.kV', 230],
    ],
    try: [
      {
        say: 'Set the line reactance to 0.3 pu. The path is longer, so the fault current falls to 1.81818 pu, or 456.404 A.',
        set: { Xl: 0.3 },
        reads: [
          ['fault.phaseA', 1.81818],
          ['fault.amps', 456.404],
        ],
      },
      {
        say: 'Add 0.1 pu of fault impedance. The current falls to 2.16931 pu, because the fault impedance is in series with the network’s.',
        set: { Zf: 0.1 },
        reads: [['fault.phaseA', 2.16931]],
      },
      {
        say: 'Set the generator reactance to 0.05 pu. The source is stiffer and the fault current rises to 2.85714 pu.',
        set: { Xg: 0.05 },
        reads: [['fault.phaseA', 2.85714]],
      },
    ],
    why:
      'A three-phase fault is balanced, so it makes only positive-sequence current. The three sequence ' +
      'networks are uncoupled, and a fault that produces no negative or zero sequence leaves those two ' +
      'networks with nothing in them. What is left is the prefault voltage divided by the ' +
      'positive-sequence impedance, which is the same short-circuit calculation a single-phase circuit ' +
      'gives. The fault level in megavolt-amperes is that current times the prefault voltage times the ' +
      'base, and it is the number a switchgear rating is compared against. On many networks this is the ' +
      'largest fault, and G5 shows when it is not.',
    whyReads: [[(x) => x.study.seqMag[1] * x.z.Z1[1], 1, 1e-12]],
  },

  g2: {
    see:
      'A single line to ground puts the three networks in series, so the current is three times the ' +
      'prefault voltage over the sum of the three impedances. That is 1.875 pu in phase A, or 470.666 A, ' +
      'with 0.625 pu in each sequence. The other two phases carry nothing.',
    seeReads: [
      ['fault.phaseA', 1.875],
      ['fault.amps', 470.666],
      ['fault.seq.zero', 0.625],
      ['fault.seq.positive', 0.625],
      ['fault.seq.negative', 0.625],
      ['fault.phaseB', 0, 1e-12],
    ],
    try: [
      {
        say: 'Set the line’s zero-sequence reactance to 1.2 pu. The zero network is longer, so the fault current falls to 1.36364 pu.',
        set: { Xl0: 1.2 },
        reads: [['fault.phaseA', 1.36364]],
      },
      {
        say: 'Set it to 0.2 pu instead. The zero network is now shorter than the other two and the current rises to 2.5 pu.',
        set: { Xl0: 0.2 },
        reads: [['fault.phaseA', 2.5]],
      },
      {
        say: 'Read the ground current at the defaults. It is 1.875 pu, which is the whole fault current and also three times the zero sequence.',
        set: {},
        reads: [
          ['fault.ground', 1.875],
          ['fault.groundAmps', 470.666],
        ],
      },
    ],
    why:
      'One conductor touching earth forces two conditions at the fault bus. The two healthy phases carry ' +
      'no current, and the faulted phase has no voltage. Writing both in sequence quantities gives three ' +
      'equal sequence currents and a voltage equation that puts the three networks in series. So the ' +
      'zero-sequence impedance matters as much as the positive one, and a network with a weak earth path ' +
      'has a small ground-fault current. That is a design choice rather than an accident. Grounding a ' +
      'neutral through an impedance limits this current deliberately, at the cost of a higher voltage on ' +
      'the healthy phases.',
    whyReads: [[(x) => x.study.phaseMag[0] * (x.z.Z1[1] + x.z.Z2[1] + x.z.Z0[1]), 3, 1e-12]],
  },

  g3: {
    see:
      'A line-to-line fault puts the positive and negative networks in parallel and leaves the zero ' +
      'network alone. Two phases carry 1.92450 pu in opposite directions and the third carries nothing. ' +
      'The ground carries no current at all.',
    seeReads: [
      ['fault.phaseB', 1.9245],
      ['fault.phaseC', 1.9245],
      ['fault.phaseA', 0, 1e-13],
      ['fault.ground', 0, 1e-14],
      ['fault.seq.zero', 0, 1e-14],
    ],
    try: [
      {
        say: 'Set the line reactance to 0.4 pu. The two faulted phases fall to 1.33235 pu, and the third is still empty.',
        set: { Xl: 0.4 },
        reads: [
          ['fault.phaseB', 1.33235],
          ['fault.phaseA', 0, 1e-13],
        ],
      },
      {
        say: 'Add 0.2 pu of fault impedance. The current falls to 1.87867 pu, because the impedance sits between the two conductors.',
        set: { Zf: 0.2 },
        reads: [['fault.phaseB', 1.87867]],
      },
      {
        say: 'Compare with the three-phase fault on the same network. That one carries 2.22222 pu, so this fault is smaller by a factor of √3 over two.',
        set: {},
        reads: [
          ['fault.of.3ph.phase', 2.22222],
          [(x) => x.table[0].phaseMag[0] / x.table[2].phaseMag[1], 1.1547],
        ],
      },
    ],
    why:
      'Two conductors touching each other and nothing else forces two conditions. The third phase ' +
      'carries no current, and the two faulted phases carry equal and opposite currents. Those make the ' +
      'zero-sequence current zero and the negative-sequence current the negative of the positive one. ' +
      'That is the two networks in parallel. With equal positive and negative impedances the sequence ' +
      'current is the three-phase value times a half, and the phase current is that times √3. So a ' +
      'line-to-line fault is always smaller than a three-phase fault on the same network, by a factor of ' +
      '√3 over two.',
    whyReads: [[(x) => x.study.phaseMag[1] * (x.z.Z1[1] + x.z.Z2[1]) / Math.sqrt(3), 1, 1e-12]],
  },

  g4: {
    see:
      'A double line to ground puts the negative and zero networks in parallel across the positive one. ' +
      'The sequence currents are 1.38138 pu, 0.840841 pu and 0.540541 pu. The two faulted phases carry ' +
      '2.08833 pu, and 1.62162 pu returns through the ground, which is 407.062 A.',
    seeReads: [
      ['fault.seq.positive', 1.38138],
      ['fault.seq.negative', 0.840841],
      ['fault.seq.zero', 0.540541],
      ['fault.phaseB', 2.08833],
      ['fault.ground', 1.62162],
      ['fault.groundAmps', 407.062],
    ],
    try: [
      {
        say: 'Set the line’s zero-sequence reactance to 1.2 pu. The earth path is weaker, so the ground current falls to 0.983607 pu.',
        set: { Xl0: 1.2 },
        reads: [['fault.ground', 0.983607]],
      },
      {
        say: 'Set it to 0.2 pu. The earth path is now stronger than the others and the ground current rises to 2.85714 pu.',
        set: { Xl0: 0.2 },
        reads: [['fault.ground', 2.85714]],
      },
      {
        say: 'Read the ground current against the zero-sequence current at the defaults. The first is exactly three times the second.',
        set: {},
        reads: [[(x) => x.study.groundMag / (3 * x.study.seqMag[0]), 1, 1e-12]],
      },
    ],
    why:
      'Two conductors touching each other and the earth forces both faulted phases to no voltage and the ' +
      'healthy phase to no current. In sequence quantities that puts the negative and zero networks in ' +
      'parallel, and that parallel pair in series with the positive one. The split between the two ' +
      'parallel branches is set by their impedances, so a strong earth path takes more of the current. ' +
      'This fault carries the largest phase current of the three unbalanced ones here. That is the reason ' +
      'a study cannot stop at the single line to ground. Which one is worst depends on the ratio of the ' +
      'zero to the positive impedance, and G5 finds where it changes.',
    whyReads: [[(x) => x.study.seqMag[1] - x.study.seqMag[2] - x.study.seqMag[0], 0, 1e-12]],
  },

  g5: {
    see:
      'Four faults arrive at one bus. The three-phase fault carries the largest phase current at ' +
      '2.22222 pu. The ' +
      'double line to ground carries 2.08833 pu and the line to line carries 1.92450 pu. The single line ' +
      'to ground carries 1.875 pu, and its ground current is the largest of the four.',
    seeReads: [
      ['fault.of.3ph.phase', 2.22222],
      ['fault.of.dlg.phase', 2.08833],
      ['fault.of.ll.phase', 1.9245],
      ['fault.of.slg.phase', 1.875],
    ],
    try: [
      {
        say: 'Read the two ground currents. The single line to ground puts 1.875 pu into the earth and the double line to ground puts 1.62162 pu.',
        set: {},
        reads: [
          ['fault.of.slg.ground', 1.875],
          ['fault.of.dlg.ground', 1.62162],
        ],
      },
      {
        say: 'Set the winding connection to grounded wye on both sides and the line’s zero-sequence reactance to 0.2 pu. The ground fault now carries 2.4 pu, more than the three-phase one.',
        set: { connection: 'wyeg-wyeg', Xl0: 0.2 },
        reads: [
          ['fault.of.slg.phase', 2.4],
          ['fault.of.3ph.phase', 2.22222],
        ],
      },
      {
        say: 'Read the ratio at which the two are equal. It is a zero-sequence impedance equal to the positive one.',
        set: {},
        reads: [['fault.crossover', 1]],
      },
    ],
    why:
      'The three-phase fault is the largest here, and on many networks it is. It is not always. The ' +
      'single line-to-ground current is three times the prefault voltage over the sum of the three ' +
      'impedances, and the three-phase current is the prefault voltage over one of them. With equal ' +
      'positive and negative impedances those are equal when the zero-sequence impedance equals the ' +
      'positive one, and the ground fault is the larger below that. A generator with a solidly grounded ' +
      'neutral and a transformer that passes the zero sequence has exactly that arrangement, which is why ' +
      'such machines are usually grounded through an impedance.',
    whyReads: [[(x) => x.cross.at(0.5).slg - x.cross.at(0.5).three, 0.444444, 0.01]],
  },
}
