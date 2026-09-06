const worstGap = (x) => {
  let worst = 0
  x.theta.forEach((a, k) => {
    worst = Math.max(worst, Math.abs(x.total[k] - x.exact(a)))
  })
  return worst
}

export const LESSONS = {
  c1: {
    see:
      'Three windings, three currents a third of a cycle apart, and one wave that travels. Its height does ' +
      'not change as it moves. The amplitude is 1.5 times what one winding makes on its own, and the sum ' +
      'of the three matches a single travelling wave at every angle. Four poles draw two cycles of it ' +
      'around the gap.',
    seeReads: [
      ['field.amplitude', 1.5],
      ['field.peak', 1.5],
      [worstGap, 0, 1e-12],
    ],
    try: [
      {
        say: 'Move time on a quarter period. The peak has moved a quarter of the way round one pole pair, and its height is the same 1.5 it was.',
        set: { t: 0.25 },
        reads: [
          ['field.peak', 1.5],
          [worstGap, 0, 1e-12],
        ],
      },
      {
        say: 'Double the phase current. The amplitude doubles to 3, and the shape of the wave does not change at all.',
        set: { amp: 2 },
        reads: [['field.amplitude', 3]],
      },
    ],
    why:
      'Each winding makes a magnetomotive force that stands still in space and pulses in time. Add three of ' +
      'them, spaced a third of a turn apart in space and a third of a cycle apart in time, and the product ' +
      'formula for cosines collapses the sum to one term. That term is a wave travelling at the supply ' +
      'frequency, with an amplitude of three halves of one winding. It is an identity rather than an ' +
      'approximation, and the check row measures it at every angle on the plot. Everything an induction ' +
      'machine does rests on this one line of trigonometry.',
  },

  c2: {
    see:
      'Four poles at 50 Hz give 1500 rev/min. The field speed is 120 times the frequency over the number ' +
      'of poles, and nothing about the machine size, its load or its rotor enters that. A pair of poles ' +
      'passes a point once per electrical cycle, so more poles means slower.',
    seeReads: [
      ['field.rpmSync', 1500],
      [(x, p) => p.poles, 4],
    ],
    try: [
      {
        say: 'Press the two-pole chip. The synchronous speed doubles to 3000 rev/min, because half as many poles pass a point in each turn.',
        set: { poles: 2 },
        reads: [['field.rpmSync', 3000]],
      },
      {
        say: 'Put four poles back and set the frequency to 60 Hz. The speed rises in proportion, to 1800 rev/min.',
        set: { f: 60 },
        reads: [['field.rpmSync', 1800]],
      },
    ],
    why:
      'Poles come in pairs, and one electrical cycle carries the field past one pair. So the mechanical ' +
      'speed is the electrical speed divided by the number of pole pairs. In rev/min that is 120 f over the ' +
      'pole count. So a mains machine comes in a short list of speeds, near 3000, 1500, 1000 and ' +
      '750 rev/min at 50 Hz. An inverter is the only way to get a speed between them. It is also why the ' +
      'same frame at 60 Hz turns a fifth faster.',
    whyReads: [
      ['field.rpmSync', 1500],
      [(x, p) => (120 * p.f) / 6, 1000],
      [(x, p) => (120 * p.f) / 8, 750],
    ],
  },

  c3: {
    see:
      'The field turns at 1500 rev/min and the rotor at 1458 rev/min. The difference is 2.77 % of ' +
      'synchronous, which is the slip. The rotor sees the field at 1.385 Hz rather than at 50 Hz, and that ' +
      'slow relative motion is what induces its current. At zero slip nothing is induced and the torque is ' +
      'exactly zero.',
    seeReads: [
      ['im.rpmSync', 1500],
      ['im.rpm', 1458.45],
      [(x) => x.slip * 100, 2.77],
      ['im.rotorHz', 1.385],
      [(x, p) => p.f, 50],
    ],
    try: [
      {
        say: 'Raise the slip to 5 %. The shaft slows to 1425 rev/min, the rotor frequency rises to 2.5 Hz, and the torque rises with it to 34.2 N·m.',
        set: { slip: 0.05 },
        reads: [
          [(x) => x.slip * 100, 5],
          ['im.rpm', 1425],
          ['im.rotorHz', 2.5],
          ['im.torque', 34.216],
        ],
      },
      {
        say: 'Take the slip to a ten-thousandth. The rotor current falls to 18.5 mA and the torque to 0.0787 N·m, on its way to nothing at all.',
        set: { slip: 0.0001 },
        reads: [
          ['im.I2', 0.018534],
          ['im.torque', 0.078723],
        ],
      },
    ],
    why:
      'A cage rotor has no supply of its own. Its current is induced, and induction needs relative motion ' +
      'between the field and the bars. Run the rotor at synchronous speed and there is none, so no current ' +
      'and no torque. The machine therefore settles just below synchronous, at the slip that makes exactly ' +
      'the torque the load asks for. The rotor frequency is the slip times the supply frequency, so a ' +
      'machine at 2.77 % slip has 1.385 Hz in its bars. That low frequency is why rotor iron loss is small ' +
      'enough to leave out of the model.',
  },

  c4: {
    see:
      'One phase of the machine, drawn as a circuit. The stator branch, the magnetising branch, then the ' +
      'rotor branch with its resistance divided by the slip. At 2.77 % slip the stator draws 6.256 A at a ' +
      'power factor of 0.801, and 4.956 A of that crosses the gap into the rotor.',
    seeReads: [
      ['im.I1', 6.2555],
      ['im.I2', 4.9564],
      ['im.pf', 0.80127],
      [(x) => x.slip * 100, 2.77],
    ],
    try: [
      {
        say: 'Set the slip to one, which is standstill. The stator current jumps to 43.1 A and the power factor collapses to 0.47, because the branch is nearly all reactance.',
        set: { slip: 1 },
        reads: [
          ['im.I1', 43.093],
          ['im.pf', 0.47008],
        ],
      },
      {
        say: 'Double the magnetising reactance to 130 Ω. The stator current falls to 5.572 A and the power factor rises to 0.92, because less current is spent on flux.',
        set: { Xm: 130 },
        reads: [
          ['im.I1', 5.5723],
          ['im.pf', 0.92027],
        ],
      },
    ],
    why:
      'The rotor sees the field at slip frequency, so its induced voltage and its reactance both scale with ' +
      'the slip. Divide the rotor equation through by the slip and both scalings vanish, leaving a circuit ' +
      'at the stator frequency with one resistance divided by the slip. That step is exact. The magnetising ' +
      'branch is large but not negligible, because an induction machine has an air gap and an air gap needs ' +
      'ampere-turns. This is why an induction motor runs at a poorer power factor than a transformer of the ' +
      'same rating, and why it runs worse still when it is lightly loaded.',
  },

  c5: {
    see:
      'The air gap carries 3193 W. The slip fraction of that, 88.4 W, heats the rotor bars. The rest, ' +
      '3104 W, comes out as mechanical power. The split is the slip against one minus the slip, and it is ' +
      'not a coincidence. It is what dividing the rotor resistance by the slip means.',
    seeReads: [
      ['im.pGap', 3192.7],
      ['im.pRotorCu', 88.438],
      ['im.pMech', 3104.26],
      [(x) => x.pRotorCu / x.pGap, 0.0277],
    ],
    try: [
      {
        say: 'Set the slip to breakdown, 0.2443. The gap now carries 11.94 kW, of which 2916 W is rotor heat and 9020 W is mechanical.',
        set: { slip: 0.2443 },
        reads: [
          ['im.pGap', 11935.7],
          ['im.pRotorCu', 2915.89],
          ['im.pMech', 9019.8],
        ],
      },
      {
        say: 'Set the slip to one. All 6204 W of the gap power becomes rotor heat, and none of it turns the shaft.',
        set: { slip: 1 },
        reads: [
          ['im.pRotorCu', 6204.11],
          ['im.pMech', 0, 1e-9],
        ],
      },
    ],
    why:
      'Split the resistance R over s into R plus R times one minus s over s. The first piece is the real ' +
      'copper of the bars. The second is not a resistance in the rotor at all. It is the mechanical power ' +
      'leaving through the shaft, written as ohms so that one circuit can carry both. That is why torque is ' +
      'the gap power over the synchronous speed and never over the rotor speed. It also sets a hard limit ' +
      'on efficiency, because a machine running at a slip of s wastes at least that fraction of everything ' +
      'crossing its gap.',
  },

  c6: {
    see:
      'Sweep the slip from one to zero and the torque rises, peaks, then falls steeply to nothing. The ' +
      '20 N·m load crosses the steep part at 2.767 % slip and 1458 rev/min. Running the equation of motion ' +
      'from standstill lands on the same speed, 152.7 rad/s, with an estimated error of 68.8 parts in a ' +
      'trillion. The readout above the plot says the same thing.',
    seeReads: [
      ['im.slip', 0.027671],
      [(x) => x.slip * 100, 2.76706],
      ['im.rpm', 1458.49],
      ['im.torque', 20.3055],
      ['im.settled', 152.733],
      ['im.error', 6.88e-11, 1e-10],
    ],
    try: [
      {
        say: 'Double the load to 40 N·m. The crossing slides down to 6.12 % slip and 1408 rev/min, and the torque follows the load to 40.3 N·m.',
        set: { TL: 40 },
        reads: [
          [(x) => x.slip * 100, 6.11967],
          ['im.rpm', 1408.2],
          ['im.torque', 40.2949],
        ],
      },
      {
        say: 'Drop the supply to 200 V per phase. The peak torque falls to 57 N·m, because torque goes as the square of the voltage, and the slip rises to 3.81 %.',
        set: { V: 200 },
        reads: [
          ['im.tMax', 56.9887],
          [(x) => x.slip * 100, 3.80581],
        ],
      },
    ],
    why:
      'The stator and the magnetising branch reduce to one source behind one impedance, and then the torque ' +
      'is a closed form in the slip. That form and a solve of the full circuit agree to floating point, ' +
      'which is how the curve is checked. Only the steep part between the peak and synchronous speed is a ' +
      'stable place to run. On it, more load means more slip means more torque, so the machine settles. ' +
      'Past the peak the opposite holds and the machine stalls. The run-up is integrated rather than solved, ' +
      'so it reports the error it estimates.',
  },

  c7: {
    see:
      'The largest torque this machine can make is 76 N·m, at a slip of 0.2443 and 1134 rev/min. That is ' +
      '3.74 times the rated 20.33 N·m. Ask for more than the peak and the machine slows, which lowers the ' +
      'torque further, and it stops.',
    seeReads: [
      ['im.tMax', 75.9849],
      ['im.sMax', 0.244255],
      ['im.rpmMax', 1133.62],
      ['im.torque', 75.9849],
      [(x) => x.op.torque, 20.3055],
      [(x) => x.bd.tMax / x.op.torque, 3.74209],
    ],
    try: [
      {
        say: 'Drop the supply to 200 V per phase. The peak falls to 57 N·m, by the square of the voltage ratio, and the slip at which it happens does not move.',
        set: { V: 200 },
        reads: [
          ['im.tMax', 56.9887],
          ['im.sMax', 0.244255],
        ],
      },
      {
        say: 'Double the rotor leakage to 4.8 Ω. The peak falls to 55.2 N·m and moves to a slip of 0.1654, because leakage limits the current that can cross the gap.',
        set: { X2: 4.8 },
        reads: [
          ['im.tMax', 55.1953],
          ['im.sMax', 0.165408],
        ],
      },
    ],
    why:
      'Differentiate the torque with respect to the rotor resistance over slip. The maximum sits where that ' +
      'quantity equals the magnitude of the rest of the loop impedance, which is a matched-load condition ' +
      'in disguise. Substituting back gives a peak that contains the voltage squared and the leakage, and ' +
      'no rotor resistance at all. A machine with 3.74 times its rated torque in hand can ride through a ' +
      'dip in the supply, and one with less cannot. Since torque goes as the voltage squared, a 20 % dip ' +
      'costs 36 % of the margin.',
    whyReads: [
      [() => 20, 20],
      [() => (1 - 0.8 ** 2) * 100, 36],
    ],
  },

  c8: {
    see:
      'At standstill the machine draws 43.09 A and makes 39.5 N·m. Against the running 6.256 A and ' +
      '20.33 N·m, that is 6.89 times the current for 1.94 times the torque. The power factor at standstill ' +
      'is 0.47, because almost all of the impedance is leakage reactance.',
    seeReads: [
      ['im.iStart', 43.093],
      ['im.tStart', 39.4966],
      ['im.pf', 0.47008],
      [(x) => x.op.I1, 6.25116],
      [(x) => x.op.torque, 20.3055],
      [(x) => x.iStart / x.op.I1, 6.89363],
      [(x) => x.tStart / x.op.torque, 1.94512],
    ],
    try: [
      {
        say: 'Raise the rotor resistance to 4.913 Ω. The starting torque rises to 76 N·m, the full breakdown value, and the starting current falls to 29.7 A.',
        set: { R2: 4.913 },
        reads: [
          ['im.tStart', 75.9849],
          ['im.iStart', 29.6982],
        ],
      },
      {
        say: 'Put the rotor back and start at 200 V per phase instead. The current falls to 37.3 A but the torque falls to 29.6 N·m, by the square.',
        set: { V: 200 },
        reads: [
          ['im.iStart', 37.3198],
          ['im.tStart', 29.6225],
        ],
      },
    ],
    why:
      'At standstill the slip is one, so the rotor resistance is not divided by anything and the rotor ' +
      'branch is nearly all reactance. That is a large current at a poor power factor, making a torque far ' +
      'below the peak. Every starting method trades the same two quantities. Reduced voltage cuts the ' +
      'current in proportion and the torque by the square, so it needs a light load. Extra rotor resistance ' +
      'raises the torque and cuts the current at once, which is why a wound rotor machine starts better ' +
      'than a cage one.',
  },

  c9: {
    see:
      'Rotor resistance moves the peak along the slip axis and does not change its height. At the rated ' +
      '1.2 Ω the peak is 76 N·m at a slip of 0.2443. The peak torque has no rotor resistance in it at all, ' +
      'so only the position moves.',
    seeReads: [
      ['im.sMax', 0.244255],
      ['im.tMax', 75.9849],
      [(x, p) => p.R2, 1.2],
      [(x) => x.rotorSweep[1].sMax, 0.488511],
      [(x) => x.rotorSweep[1].tMax, 75.9849],
    ],
    try: [
      {
        say: 'Double the rotor resistance to 2.4 Ω. The peak moves to a slip of 0.4885, exactly twice, and stays at 76 N·m.',
        set: { R2: 2.4 },
        reads: [
          ['im.sMax', 0.488511],
          ['im.tMax', 75.9849],
        ],
      },
      {
        say: 'Raise it to 4.913 Ω. The peak lands at standstill, so the machine now makes its largest torque at the moment it is switched on.',
        set: { R2: 4.913 },
        reads: [
          ['im.sMax', 1.00002],
          ['im.tMax', 75.9849],
        ],
      },
    ],
    why:
      'The breakdown slip is the rotor resistance over the magnitude of the rest of the loop impedance, so ' +
      'it is proportional to that resistance. The peak torque contains the voltage and the leakage and not ' +
      'the resistance, so it stays put. A wound rotor machine uses this. Start with resistance in the rotor ' +
      'circuit for full torque at standstill, then short it out as the machine runs up. The machine ' +
      'finishes on a steep curve with low slip and low loss. The cost is slip rings and a starter.',
  },
}
