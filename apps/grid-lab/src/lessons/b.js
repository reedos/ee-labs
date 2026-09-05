// Group B: three phase, from the circuits side.

import { cx } from '@ee-labs/grid'

const { carg, deg } = cx

export const LESSONS_B = {
  b1: {
    see:
      'Between two lines the voltage is 230 kV. Between a line and the neutral it is 132.791 kV, which is ' +
      'smaller by √3. The three phasors are equal and 120° apart, so they add to zero and the neutral ' +
      'carries nothing.',
    seeReads: [
      ['phase.Vln', 132790.6],
      ['phase.ratio', 1.7320508],
      [(x) => x.phasors.sumMag / x.load.Vln, 0, 1e-14],
      [(x) => -deg(carg(x.phasors.set[1]) - carg(x.phasors.set[0])), 120],
    ],
    try: [
      {
        say: 'Set the line voltage to 400 kV. The line-to-neutral value follows to 230.940 kV, and the ratio does not move.',
        set: { Vll: 400 },
        reads: [
          ['phase.Vln', 230940],
          ['phase.ratio', 1.7320508],
        ],
      },
      {
        say: 'Set the line voltage to 138 kV. The line-to-neutral value is 79.6743 kV and the three phasors still add to nothing.',
        set: { Vll: 138 },
        reads: [
          ['phase.Vln', 79674.3],
          [(x) => x.phasors.sumMag / x.load.Vln, 0, 1e-14],
        ],
      },
    ],
    why:
      'The line-to-line voltage is the difference of two line-to-neutral phasors 120° apart. Two unit ' +
      'phasors at that angle differ by √3, so the line voltage is √3 times the phase voltage and leads it ' +
      'by 30°. Nameplates quote the line value and per-phase circuits use the phase value, which is where ' +
      'the factor keeps appearing. The three phasors summing to zero is the same identity written another ' +
      'way, because 1 plus a plus a² is zero when a is 1 at 120°. Group F leans on that identity for the ' +
      'whole of the symmetrical-component transform.',
    whyReads: [
      [(x) => x.load.Vll / x.load.Vln, 1.7320508],
      [(x) => -deg(carg(x.phasors.set[1]) - carg(x.phasors.set[0])), 120],
      // The line-to-line phasor leads the line-to-neutral one by half of the
      // 60° between two of them, which is the 30° the sentence names.
      [(x) => deg(carg([x.phasors.set[0][0] - x.phasors.set[1][0], x.phasors.set[0][1] - x.phasors.set[1][1]])), 30],
    ],
  },

  b2: {
    see:
      'A balanced wye load of 100 Ω and 50 Ω of reactance per phase draws 1187.71 A in every line. The ' +
      'three-phase power is 423.200 MW at a power factor of 0.894427. Writing it as √3 times the line ' +
      'voltage, the line current and the power factor gives the same number.',
    seeReads: [
      ['phase.I', 1187.71],
      ['phase.P', 423.2e6],
      ['phase.pf', 0.894427],
      ['phase.Pline', 423.2e6],
    ],
    try: [
      {
        say: 'Set the reactance to zero. The current rises to 1327.91 A, the power factor goes to one, and the load takes 528.999 MW.',
        set: { X: 0 },
        reads: [
          ['phase.I', 1327.91],
          ['phase.pf', 1],
          ['phase.P', 528.999e6],
        ],
      },
      {
        say: 'Double the resistance to 200 Ω. The current falls to 644.129 A and the power factor rises to 0.970143.',
        set: { R: 200 },
        reads: [
          ['phase.I', 644.129],
          ['phase.pf', 0.970143],
        ],
      },
      {
        say: 'Read one phase alone. It carries 141.067 MW, which is a third of the three-phase total.',
        set: {},
        reads: [
          ['phase.Pphase', 141.0667e6],
          [(x) => x.load.P / x.load.Pphase, 3],
        ],
      },
    ],
    why:
      'A balanced three-phase circuit is three copies of one circuit, so solving one phase solves all ' +
      'three. The per-phase circuit takes the line-to-neutral voltage and one leg of the load, and its ' +
      'answer is multiplied by three for the whole. The line form √3 V_LL I_L cos φ is the same product ' +
      'with the line voltage substituted, which is why the √3 appears there and not in the per-phase form. ' +
      'Circuit Elements Lab h5 measures P, Q and the power factor on one phase of exactly this circuit. ' +
      'Everything in the rest of this lab is written per phase for the same reason.',
    whyReads: [[(x) => x.load.Pline / x.load.P, 1, 1e-12]],
  },

  b3: {
    see:
      'One phase of this load pulses. Its power runs from −16.6507 MW to 298.784 MW twice a cycle, about a ' +
      'mean of 141.067 MW. The three phases together do not pulse at all, and their sum is flat to about a ' +
      'part in 10¹⁵ of its own value.',
    seeReads: [
      ['phase.min', -16.6507e6],
      ['phase.max', 298.784e6],
      ['phase.mean', 141.0667e6],
      ['phase.ripple', 0, 1e-13],
    ],
    try: [
      {
        say: 'Set the reactance to zero. One phase now touches zero at the bottom rather than going negative, and its mean rises to 176.333 MW.',
        set: { X: 0 },
        reads: [
          ['phase.min', 0, 1e-6],
          ['phase.mean', 176.333e6],
        ],
      },
      {
        say: 'Set the reactance to 100 Ω. One phase now swings to −36.5198 MW, because the power factor has fallen and more energy goes back and forth.',
        set: { X: 100 },
        reads: [['phase.min', -36.5198e6]],
      },
      {
        say: 'Read the three-phase ripple at each of those settings. It stays at the arithmetic’s own floor, because the cancellation is an identity.',
        set: { X: 100 },
        reads: [['phase.ripple', 0, 1e-13]],
      },
    ],
    why:
      'One phase carries v(t)·i(t), which is V I cos φ minus V I cos(2ωt − φ) in root-mean-square terms. ' +
      'The second term is a pulsation at twice the supply frequency, and it is as big as V I whatever the ' +
      'power factor. So one phase always swings by the same amount, and it goes negative whenever the ' +
      'power factor is below one. Adding the three phases adds three such pulsations, each a third of a ' +
      'cycle from the next, and those sum to zero exactly. That is why a three-phase motor has no torque ripple from its supply, ' +
      'and why a single-phase motor needs a second winding to start.',
    whyReads: [
      [(x) => (x.inst.max - x.inst.mean) / (x.load.Vln * x.load.I), 1, 1e-9],
      [(x) => Math.abs(x.inst.rippleThree), 0, 1e-13],
    ],
  },

  b4: {
    see:
      'A delta of 300 Ω per leg is a wye of 100 Ω per phase. Both draw 1327.91 A from the same 230 kV ' +
      'source, and the two line currents agree to floating point. Inside the delta each leg carries ' +
      '766.667 A, which is the line current divided by √3.',
    seeReads: [
      ['phase.wye', 100],
      ['phase.Iline', 1327.91],
      ['phase.Iphase', 766.667],
      ['phase.sameLine', 0, 1e-9],
    ],
    try: [
      {
        say: 'Set the delta to 600 Ω per leg. The line current halves to 663.953 A and the equivalent wye becomes 200 Ω.',
        set: { Rdelta: 600 },
        reads: [
          ['phase.Iline', 663.953],
          ['phase.wye', 200],
        ],
      },
      {
        say: 'Set the delta to 150 Ω. The line current doubles to 2655.81 A and each leg carries 1533.33 A.',
        set: { Rdelta: 150 },
        reads: [
          ['phase.Iline', 2655.81],
          ['phase.Iphase', 1533.33],
        ],
      },
    ],
    why:
      'A delta leg sees the line-to-line voltage, and a wye phase sees the line-to-neutral voltage, which ' +
      'is smaller by √3. A delta leg carries the phase current, and the line current outside is larger by ' +
      '√3. Multiply the two factors and the impedance ratio is three. So a delta of 3Z draws the same line ' +
      'current as a wye of Z, and no measurement outside the terminals can tell the two apart. That is ' +
      'why a network diagram may show either. The distinction returns in Group F, where a delta winding ' +
      'has no neutral and so blocks zero-sequence current.',
    whyReads: [
      [(x) => x.delta.Iline / x.delta.Iphase, 1.7320508],
      [(x) => x.delta.R / x.wyeOfDelta, 3],
    ],
  },

  b5: {
    see:
      'Three unbalanced currents of 10 A, 6 A and 8 A resolve into three balanced sets. The positive set ' +
      'is 7.80894 A, the negative set is 1.32184 A, and the zero set is 1.98492 A. The neutral carries ' +
      '5.95477 A, which is three times the zero-sequence current.',
    seeReads: [
      ['seq.positive.mag', 7.80894],
      ['seq.negative.mag', 1.32184],
      ['seq.zero.mag', 1.98492],
      ['seq.neutral', 5.95477],
    ],
    try: [
      {
        say: 'Set the second current to 10 A and its angle to −120°. Two of the three are balanced now, and the negative set falls to 1.23149 A.',
        set: { Ib: 10, angB: -120 },
        reads: [['seq.negative.mag', 1.23149]],
      },
      {
        say: 'Set every magnitude to 10 A and the two angles to −120° and 120°. The set is balanced, so the zero and negative sets both go to nothing.',
        set: { Ia: 10, Ib: 10, Ic: 10, angB: -120, angC: 120 },
        reads: [
          ['seq.zero.mag', 0, 1e-14],
          ['seq.negative.mag', 0, 1e-14],
          ['seq.positive.mag', 10],
        ],
      },
      {
        say: 'Read the unbalance factor at the defaults. It is 16.9272 %, which is the negative set over the positive one.',
        set: {},
        reads: [[(x) => 100 * x.unbalance, 16.9272]],
      },
    ],
    why:
      'Any three phasors are the sum of one balanced positive-sequence set, one balanced negative-sequence ' +
      'set and one zero-sequence set in which all three are equal. The transform is a change of basis, so ' +
      'it is exact and reversible, and rebuilding the three original currents from the three sets returns ' +
      'them to floating point. The zero set is the one that needs a return path. Its three currents are ' +
      'equal and in phase, so they add rather than cancel, and the neutral carries three times one of ' +
      'them. Group F builds the three networks this transform implies, and Group G connects them into ' +
      'four faults. A balanced set produced by an inverter is Power Lab I3.',
    whyReads: [[(x) => x.abc.reduce((m, z, k) => Math.max(m, Math.hypot(z[0] - x.sets.total[k][0], z[1] - x.sets.total[k][1])), 0), 0, 1e-13]],
  },
}
