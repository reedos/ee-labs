// Group G's three registers.
//
// The two structures the earlier groups used, built step by step, with the step
// slider walking the cross-section. Each step carries the one number a previous
// group took as a knob, so the group closes the loop rather than opening a new
// subject.

export const LESSONS_G = {
  g1: {
    see:
      'Five steps make a junction. Oxidise, open a window, implant, drive in, and put metal on it. The implant ' +
      'fires 10¹² cm⁻² into the surface and the drive-in spreads it over 100.0 nm, which is a doping of ' +
      '10¹⁷ cm⁻³. Against a substrate at 10¹⁶ cm⁻³ that gives a barrier of 752.9 mV.',
    seeReads: [
      ['fab.doping', 1e23],
      ['fab.v0', 0.75287941],
      ['j.w', 3.2725489e-7],
    ],
    try: [
      {
        say: 'Cut the implant dose a decade, to 10¹¹ cm⁻². The doping falls with it to 10¹⁶ cm⁻³, and the barrier drops to 693.4 mV.',
        set: { dose: 1e15 },
        reads: [
          ['fab.doping', 1e22],
          ['fab.v0', 0.69335298],
        ],
      },
      {
        say: 'Return the dose and drive it five times deeper, to 500.0 nm. The same atoms are spread thinner, so the doping is 2 × 10¹⁶ cm⁻³ and the barrier is 711.3 mV.',
        set: { depth: 0.5e-6 },
        reads: [
          ['fab.doping', 2e22],
          ['fab.v0', 0.71127222],
        ],
      },
      {
        say: 'Raise the substrate to 10¹⁷ cm⁻³ instead. The junction is symmetric now, the barrier reads 812.4 mV, and the region narrows to 145.0 nm.',
        set: { nd: 1e23 },
        reads: [
          ['fab.v0', 0.81240584],
          ['j.w', 1.4495347e-7],
        ],
      },
    ],
    why:
      'Every knob the earlier groups turned is the output of a step here. The implant dose and the drive-in ' +
      'depth divide to give the doping, and the doping gives the barrier, the width, the field and the ' +
      'capacitance. That is the whole chain from a machine setting to a device number, and it runs in one ' +
      'direction. What this group does not do is simulate the process. A real drive-in gives a graded profile ' +
      'whose shape depends on the thermal budget, and getting that right needs a tool this suite does not have. ' +
      'The dose over the depth is the arithmetic of the step, and the pane says which of the two it is doing.',
  },

  g2: {
    see:
      'The same sequence with a gate and two more implants makes a transistor. The gate oxide of 10.0 nm sets ' +
      'C_ox at 345.3 nF/cm². The threshold implant of 8.152 × 10¹¹ cm⁻² sets the threshold at 700.0 mV. And the ' +
      'finished device at a gate of 1.200 V passes 215.8 µA.',
    seeReads: [
      ['fab.cox', 3.4531332e-3],
      ['fab.vt', 0.70000011],
      ['fab.id', 2.1582073e-4],
    ],
    try: [
      {
        say: 'Cut the threshold implant to 10⁸ cm⁻². The process alone gives 321.8 mV, and the current at the same gate voltage more than triples, to 665.8 µA.',
        set: { implant: 1e12 },
        reads: [
          ['fab.vt', 0.32176878],
          ['fab.id', 6.6584184e-4],
        ],
      },
      {
        say: 'Restore the implant and halve the gate oxide to 5.00 nm. C_ox doubles to 690.6 nF/cm², the threshold falls to 273.1 mV, and the current reaches 1.483 mA.',
        set: { tox: 5e-9 },
        reads: [
          ['fab.cox', 6.9062665e-3],
          ['fab.vt', 0.27310152],
          ['fab.id', 1.4833638e-3],
        ],
      },
      {
        say: 'Return the oxide and raise the substrate implant dose to 10¹³ cm⁻². The substrate reaches 10¹⁸ cm⁻³, the threshold climbs to 1.894 V, and the device is off.',
        set: { dose: 1e17 },
        reads: [
          ['fab.doping', 1e24],
          ['fab.vt', 1.8942576],
          ['fab.id', 0, 1e-30],
        ],
      },
    ],
    why:
      'Three steps and three numbers, and each one was a knob in Group C or Group D. The oxide growth sets ' +
      'C_ox, and every voltage in the transistor divides by it. The substrate implant sets the doping, which ' +
      'sets the bulk potential, the depletion charge and the body coefficient. The threshold implant is last. ' +
      'It is the only one that can be changed without moving anything else, which is why a process uses it to ' +
      'land on a number a circuit was designed against. The 700.0 mV this sequence produces is the threshold ' +
      'the Electronics Lab’s transistor was given as a fact. This is where that fact comes from.',
    whyReads: [
      ['fab.vt', 0.70000011],
      ['fab.cox', 3.4531332e-3],
    ],
  },
}
