export const LESSONS = {
  a1: {
    see:
      'Two states, and one of them is not electrical. The armature current belongs to the inductor. ' +
      'The shaft speed belongs to the rotor, which sits in the same netlist as a capacitance. The state ' +
      'matrix reads −400 and −20 along its top row, 300 and −0.05 along its bottom row, every entry per ' +
      'second.',
    seeReads: [
      ['A.0.0', -400],
      ['A.0.1', -20],
      ['A.1.0', 300],
      ['A.1.1', -0.05],
    ],
    try: [
      {
        say: 'Set the armature inductance to 30 mH. The top-left entry rises to −40 per second, and the electrical time constant grows tenfold to 25 ms.',
        set: { La: 30e-3 },
        reads: [
          ['A.0.0', -40],
          ['tau.e', 0.025],
        ],
      },
      {
        say: 'Double the inertia. The bottom-left entry halves to 150 per second, and the mechanical time constant doubles to 133 ms.',
        set: { J: 4e-4 },
        reads: [
          ['A.1.0', 150],
          ['tau.m', 0.13289],
        ],
      },
      {
        say: 'Raise the friction a hundredfold. The bottom-right entry falls to −5 per second, which is the shaft slowing itself.',
        set: { B: 1e-3 },
        reads: [['A.1.1', -5]],
      },
    ],
    why:
      'Replace every capacitor by a source at its voltage and every inductor by a source at its current. ' +
      'One resistive solve then gives every derivative. That is the substitution theorem, and it is exact. ' +
      'The rotor joins the same solve because torque is carried as a current and speed as a voltage. So the ' +
      'second row of A is read the way the first is, off one solve, and no matrix is written by hand. The ' +
      'energy the engine stores in a capacitance is half C times v squared. Under the analogy that is half J ' +
      'times omega squared, the rotor kinetic energy, and the energy ledger closes over the shaft without ' +
      'being told what a shaft is.',
  },

  a2: {
    see:
      'The 24 V supply splits in two. Only 1.076 V of it pushes current through the armature resistance. ' +
      'The other 22.92 V is the back-EMF, a voltage the turning shaft makes. Divide that voltage by the ' +
      'speed of 3648 rev/min and the answer is the machine constant.',
    seeReads: [
      ['mech.ra', 1.0764],
      ['op.emf', 22.9236],
      ['op.rpm', 3648.4],
      [(x) => x.op.emf / x.op.omega, 0.06],
    ],
    try: [
      {
        say: 'Halve the load torque to 0.025 N·m. The machine speeds up to 3728 rev/min, the back-EMF rises to 23.42 V, and the resistive drop falls to 0.5781 V.',
        set: { TL: 0.025 },
        reads: [
          ['op.rpm', 3727.7],
          ['op.emf', 23.422],
          ['mech.ra', 0.57807],
        ],
      },
      {
        say: 'Double the armature resistance to 2.4 Ω. The same load now needs 0.894 A through twice the resistance, so the speed falls to 3478 rev/min.',
        set: { Ra: 2.4 },
        reads: [
          ['op.ia', 0.89404],
          ['op.rpm', 3478.2],
        ],
      },
    ],
    why:
      'A conductor moving through a field has a voltage induced along it. In a motor that voltage opposes ' +
      'the supply, which is why it is called back-EMF. It is proportional to speed, and the constant of ' +
      'proportionality is a property of the winding and the magnet. Nothing else limits the speed of a DC ' +
      'motor. Without the back-EMF the armature would draw the supply voltage over the armature resistance ' +
      'for ever, which is 20 A here rather than 0.897 A. The machine reaches the speed at which the back-EMF ' +
      'leaves just enough voltage across the resistance to carry the current the load asks for.',
    whyReads: [
      ['line.free', 20],
      ['op.ia', 0.89701],
    ],
  },

  a3: {
    see:
      'Torque is the same constant read the other way. At 0.897 A the machine makes 0.0538 N·m, and the ' +
      'number that connects them is the one A2 read from the back-EMF. The power view shows why. The ' +
      'coupling absorbs and delivers the same 20.6 W, so its net power is zero to rounding.',
    seeReads: [
      ['op.ia', 0.89701],
      ['op.torque', 0.053821],
      ['audit.coupled', 0, 1e-9],
      [(x) => x.op.torque * x.op.omega, 20.563],
    ],
    try: [
      {
        say: 'Set the torque constant to 0.09 V·s/rad, away from the back-EMF constant. The coupling now shows −6.97 W of net power against 14.37 W supplied, which no machine can do.',
        set: { kt: 0.09 },
        reads: [
          ['audit.coupled', -6.969],
          ['audit.supplied', 14.368],
        ],
      },
      {
        say: 'Put the torque constant back and double the load to 0.1 N·m. The current rises to 1.728 A, and the torque follows it to 0.1037 N·m.',
        set: { TL: 0.1 },
        reads: [
          ['op.ia', 1.7276],
          ['op.torque', 0.10365],
        ],
      },
    ],
    why:
      'The two constants are one number in SI units, and the reason is conservation of energy. The ' +
      'coupling takes electrical power at the rate of the back-EMF times the current. It delivers ' +
      'mechanical power at the rate of the torque times the speed. Setting those equal gives the two ' +
      'constants equal. The engine does not assert it. It stamps the back-EMF as a voltage source ' +
      'controlled by the speed. It stamps the torque as a current source controlled by the armature ' +
      'current. Tellegen over the whole netlist is then the power balance. Break the equality and the ' +
      'balance reports the size of the break, which is what the second step shows.',
  },

  a4: {
    see:
      'Torque against speed is a straight line. At standstill the machine makes 1.2 N·m, the stall torque. ' +
      'At 3820 rev/min it makes none, which is the no-load speed. The load line crosses it at 3648 rev/min ' +
      'and 0.0538 N·m, and that crossing is where the machine runs.',
    seeReads: [
      ['line.stall', 1.2],
      ['line.noLoadRpm', 3819.7],
      ['op.rpm', 3648.4],
      ['op.torque', 0.053821],
    ],
    try: [
      {
        say: 'Raise the load to 0.1 N·m. The crossing slides down the line to 3490 rev/min, and the current rises to 1.728 A.',
        set: { TL: 0.1 },
        reads: [
          ['op.rpm', 3489.8],
          ['op.ia', 1.7276],
        ],
      },
      {
        say: 'Double the armature resistance. The stall torque halves to 0.6 N·m and the line slackens to −0.0015 N·m per rad/s, so the same load costs more speed.',
        set: { Ra: 2.4 },
        reads: [
          ['line.stall', 0.6],
          ['line.slope', -0.0015],
          ['op.rpm', 3478.2],
        ],
      },
    ],
    why:
      'In the steady state the current stops changing, so the armature is a resistance with the back-EMF ' +
      'behind it. The current is the supply minus the back-EMF, over the resistance. Multiply by the ' +
      'constant and the torque falls linearly with speed. The slope is the machine constant squared over ' +
      'the armature resistance, and it is the stiffness of the drive. A low armature resistance gives a ' +
      'steep line, so the speed hardly moves when the load changes. A stiff machine is one whose speed a ' +
      'change of load barely moves. It is why the same motor with a starting resistor in series makes a ' +
      'poor speed regulator.',
  },

  a5: {
    see:
      'With a flywheel on the shaft, the speed has barely moved while the current reaches its peak. That ' +
      'peak is 19.8 A, 15.8 ms after the supply is applied, against a free current of 20 A. The running ' +
      'current at this load is 0.0664 A, so starting costs nearly three hundred times it.',
    seeReads: [
      ['mech.peak', 19.802],
      ['mech.peakAt', 0.015751],
      ['line.free', 20],
      ['op.ia', 0.066445],
    ],
    try: [
      {
        say: 'Put 3.6 Ω of starter resistance in series, so the armature reads 4.8 Ω. The peak falls to 5 A, and the stall torque falls with it to 0.3 N·m.',
        set: { Ra: 4.8 },
        reads: [
          ['mech.peak', 4.9953],
          ['line.stall', 0.3],
          [(x, p) => p.Ra - 1.2, 3.6],
        ],
      },
      {
        say: 'Start at 8 V instead. The peak falls to 6.6 A, and the machine starts on a third of the voltage rather than on extra resistance.',
        set: { Va: 8 },
        reads: [['mech.peak', 6.6007]],
      },
    ],
    why:
      'At standstill there is no back-EMF, so nothing limits the current but the armature resistance. That ' +
      'is why a large machine is never switched straight onto its supply. The two ways out are both in the ' +
      'steps above. Add resistance, which limits the current and the torque together and wastes power while ' +
      'it does. Or start at a lower voltage and raise it, which limits the current without touching the ' +
      'stall torque per volt. The second is what a drive does, and Power Lab Group L builds the chopper ' +
      'that does it.',
  },

  a6: {
    see:
      'One machine has two time constants. The electrical one is 2.5 ms, the armature inductance over its ' +
      'resistance. The mechanical one is 66.4 ms, and they are 26.6 apart. The roots of the second-order ' +
      'equation sit at −15.66 and −384.4 per second, one for each. The phase plane shows the fast rise in ' +
      'current, then the slow climb in speed.',
    seeReads: [
      ['tau.e', 0.0025],
      ['tau.m', 0.066445],
      ['tau.separated', 26.578],
      ['root.0', -15.661],
      ['root.1', -384.39],
    ],
    try: [
      {
        say: 'Add a flywheel, twenty times the rotor inertia. The mechanical constant grows to 1.329 s, the separation to 532, and the slow root creeps in to −0.7539 per second.',
        set: { J: 4e-3 },
        reads: [
          ['tau.m', 1.3289],
          ['tau.separated', 531.56],
          ['root.0', -0.75392],
        ],
      },
      {
        say: 'Instead raise the inductance to 30 mH. The two roots meet at −20.03 per second, the separation falls to 2.658, and the phase plane curves rather than turning a corner.',
        set: { La: 0.03 },
        reads: [
          ['root.0', -20.025],
          ['root.1', -20.025],
          ['tau.separated', 2.6578],
        ],
      },
    ],
    why:
      'A drives course assumes the current settles before the speed moves, and then treats the speed as ' +
      'quasi-static. That assumption is the ratio of the two time constants, and the ratio is a number this ' +
      'view prints. Ten is the usual threshold. Below it the two roots interact, the current overshoots, and ' +
      'the quasi-static picture stops predicting the shape. The machine is second order either way, and the ' +
      'roots come from the same characteristic polynomial Elements G writes for an RLC. Only the meaning of ' +
      'the second state has changed.',
  },

  a7: {
    see:
      'Armature voltage slides the line sideways and leaves its slope alone. At 8 V, 16 V and 24 V the ' +
      'no-load speeds are 1273, 2546 and 3820 rev/min, in proportion. The slope stays at −0.003 N·m per ' +
      'rad/s at all three, so the machine is exactly as stiff at low speed as at high.',
    seeReads: [
      [(x) => x.control.armature[0].Va, 8],
      [(x) => x.control.armature[1].Va, 16],
      ['control.armature.0.noLoadRpm', 1273.2],
      ['control.armature.1.noLoadRpm', 2546.5],
      ['control.armature.2.noLoadRpm', 3819.7],
      ['control.armature.0.slope', -0.003],
      ['control.armature.2.slope', -0.003],
    ],
    try: [
      {
        say: 'Press the 8 V chip. The running speed falls to 1110 rev/min, and the current holds near 0.853 A because the load has not changed.',
        set: { Va: 8 },
        reads: [
          ['op.rpm', 1110.4],
          ['op.ia', 0.85271],
        ],
      },
      {
        say: 'Press 16 V. The speed lands at 2379 rev/min, close to two thirds of the way, and the current is 0.875 A.',
        set: { Va: 16 },
        reads: [
          ['op.rpm', 2379.4],
          ['op.ia', 0.87486],
        ],
      },
    ],
    why:
      'The line is the stall torque minus the slope times the speed, and the supply voltage appears in the ' +
      'stall torque alone. So changing it moves both ends of the line by the same factor and leaves the ' +
      'slope untouched. The armature current at a given load is nearly unchanged, because it is set by the ' +
      'torque and not by the voltage. This is the reason armature control is the usual way to run a DC ' +
      'machine below its rated speed. It buys speed at constant available torque, and the drive that ' +
      'provides the variable voltage is a chopper.',
  },

  a8: {
    see:
      'Field control rotates the line instead. Weaken the flux to half and the no-load speed doubles to ' +
      '7639 rev/min, while the stall torque halves to 0.6 N·m. The same load now needs 1.908 A rather than ' +
      '0.897 A, because each amp buys less torque.',
    seeReads: [
      ['control.field.2.noLoadRpm', 7639.4],
      ['control.field.2.stall', 0.6],
      ['control.field.2.ia', 1.9079],
      ['control.field.0.ia', 0.89701],
    ],
    try: [
      {
        say: 'Set the flux to 0.7 of rated. The no-load speed rises to 5457 rev/min, the stall torque falls to 0.84 N·m, and the current rises to 1.318 A.',
        set: { field: 0.7 },
        reads: [
          ['control.field.1.noLoadRpm', 5456.7],
          ['control.field.1.stall', 0.84],
          ['op.ia', 1.3176],
        ],
      },
      {
        say: 'Set it to 0.5. The current reaches 1.908 A for the same 0.05 N·m of load, and the copper loss with it.',
        set: { field: 0.5 },
        reads: [['op.ia', 1.9079]],
      },
    ],
    why:
      'The no-load speed is the supply over the constant, so it goes as one over the flux. The stall torque ' +
      'is the constant times the supply over the resistance, so it goes as the flux. The slope carries the ' +
      'constant squared and so falls as the square. Field weakening therefore buys speed above the rated ' +
      'point and pays for it in torque and in current. A machine run this way is limited by heating, ' +
      'because the copper loss goes as the square of the current, and Group E puts a number on that limit.',
  },
}
