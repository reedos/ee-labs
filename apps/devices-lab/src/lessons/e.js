// Group E's three registers.
//
// Two junctions on one base. The two diffusion constants are inputs, because a
// mobility at a doping is a measured curve rather than a consequence, and the
// pane says so. Everything else comes off the two Gummel numbers and the
// profile of Group B.

export const LESSONS_E = {
  e1: {
    see:
      'Two junctions share one base, and each takes a depletion region out of it. The base is 500 nm as the ' +
      'process laid it down. At 5 V on the collector junction, that junction has eaten 82.24 nm of it, so ' +
      '417.8 nm of neutral base is left. That is 16.4 per cent gone.',
    seeReads: [
      ['bjt.intoBase', 8.2238161e-8],
      ['bjt.neutralBase', 4.1776184e-7],
      ['bjt.taken', 0.16447632],
    ],
    try: [
      {
        say: 'Take the collector bias to zero. The junction still eats 29.75 nm, because the doping built a barrier before any bias was applied.',
        set: { vcb: 0 },
        reads: [
          ['bjt.intoBase', 2.9750445e-8],
          ['bjt.neutralBase', 4.7024956e-7],
        ],
      },
      {
        say: 'Take it to 10 V. The edge has moved to 112.4 nm and the neutral base is down to 387.6 nm, which is 22.5 per cent gone.',
        set: { vcb: 10 },
        reads: [
          ['bjt.intoBase', 1.1243283e-7],
          ['bjt.neutralBase', 3.8756717e-7],
          ['bjt.taken', 0.22486566],
        ],
      },
      {
        say: 'Halve the base to 250 nm. The same 82.24 nm is now a third of it, and only 167.8 nm of neutral base is left.',
        set: { wb: 0.25e-6 },
        reads: [
          ['bjt.intoBase', 8.2238161e-8],
          ['bjt.neutralBase', 1.6776184e-7],
          ['bjt.taken', 0.32895264],
        ],
      },
    ],
    why:
      'A transistor is two junctions close enough together that what one injects the other collects. How close ' +
      'is the whole design problem. Carriers injected into the base have to cross it before they recombine. So ' +
      'a thin base is what makes the device work at all, and every number in this group improves as the base ' +
      'thins. What stops a designer thinning it is on this pane. The collector junction eats into the base ' +
      'from one side and the emitter junction from the other. Both eat further as their voltages rise. A base ' +
      'thin enough to be fast is a base the collector can reach through, and the transistor then has no ' +
      'neutral base left at all.',
  },

  e2: {
    see:
      'A doping times a thickness is a Gummel number, and two of them decide this device. The base carries ' +
      '5.000 × 10¹² cm⁻² and the emitter 3.000 × 10¹⁴ cm⁻². The first sets the saturation current at ' +
      '7.456 fA, and the ratio sets the current gain at 480.0. At 1 mA the junction needs 662.4 mV.',
    seeReads: [
      ['bjt.gummelBase', 5e16],
      ['bjt.gummelEmitter', 3e18],
      ['bjt.is', 7.4556489e-15],
      ['bjt.beta', 480.00928],
      ['bjt.vbe', 0.66238121],
    ],
    try: [
      {
        say: 'Drop the emitter doping a decade, to 10¹⁸ cm⁻³. The saturation current does not move, and the gain falls with the ratio, to 48.00.',
        set: { ne: 1e24 },
        reads: [
          ['bjt.is', 7.4556489e-15],
          ['bjt.beta', 48.000928],
        ],
      },
      {
        say: 'Return it and raise the base doping to 10¹⁸ cm⁻³. Now both move: the saturation current falls to 0.7456 fA and the gain falls to 48.00.',
        set: { nb: 1e24 },
        reads: [
          ['bjt.is', 7.4556489e-16],
          ['bjt.beta', 48.000928],
        ],
      },
      {
        say: 'Raise the collector current to 10 mA. The junction voltage climbs one decade’s worth, to 721.9 mV.',
        set: { ic: 1e-2 },
        reads: [['bjt.vbe', 0.72190764]],
      },
    ],
    why:
      'Both results come from the same picture. The base Gummel number is how many dopant atoms per unit area a ' +
      'carrier injected from the emitter has to get past, so it divides the current the emitter manages to ' +
      'inject. That gives the saturation current. The current gain is the ratio of what the emitter injects ' +
      'into the base to what the base injects back into the emitter, and each is set by the other side’s Gummel ' +
      'number. So doping the emitter a hundred times more heavily than the base buys a gain near a hundred, and ' +
      'that is the whole design rule. The α of 0.9979 is the same fact written as a fraction. This β is the ' +
      'ceiling emitter injection sets, and recombination inside the base pulls a real device below it.',
    whyReads: [['bjt.alpha', 0.99792104]],
  },

  e3: {
    see:
      'A carrier crossing the base by diffusion takes W_B²/2D_B, which is 120.9 ps here. Nothing about the ' +
      'device can be faster than that, so the transition frequency cannot exceed 1.317 GHz. The base thickness ' +
      'is squared in it, so it is the parameter worth fighting for.',
    seeReads: [
      ['bjt.tauB', 1.2087806e-10],
      ['bjt.ftLimit', 1.316657e9],
    ],
    try: [
      {
        say: 'Halve the base to 250 nm. The transit time quarters, to 30.22 ps, and the ceiling quadruples to 5.267 GHz.',
        set: { wb: 0.25e-6 },
        reads: [
          ['bjt.tauB', 3.0219515e-11],
          ['bjt.ftLimit', 5.2666281e9],
        ],
      },
      {
        say: 'Double it to 1 µm instead. The transit time is 483.5 ps and the ceiling has fallen to 329.2 MHz.',
        set: { wb: 1e-6 },
        reads: [
          ['bjt.tauB', 4.8351223e-10],
          ['bjt.ftLimit', 3.2916425e8],
        ],
      },
      {
        say: 'Return the base and double the diffusion constant. The transit time halves to 60.44 ps, and the gain doubles as well, to 960.0.',
        set: { db: 2.0682e-3 },
        reads: [
          ['bjt.tauB', 6.0439029e-11],
          ['bjt.ftLimit', 2.633314e9],
          ['bjt.beta', 960.01857],
        ],
      },
    ],
    why:
      'The base transit time is the one delay a transistor cannot design around, because it is how long the ' +
      'physics takes rather than how long a capacitance takes to charge. Diffusion across a distance goes as ' +
      'the square of the distance, which is why halving the base quarters the time. It is also why the same ' +
      'change quadruples the ceiling on f_T. Nothing here says a device reaches that ceiling. A real one is ' +
      'held below it by the capacitances the junctions carry, and a circuit course meets that as f_T rising ' +
      'with bias current and then flattening. The number on this pane is where the flattening happens, and it ' +
      'is set by the process rather than by the bias.',
  },

  e4: {
    see:
      'The collector junction’s edge moves further into the base as the collector voltage rises, at 7.148 nm ' +
      'per volt here. Dividing the base thickness by that rate gives the Early voltage, 69.95 V. A circuit ' +
      'course reads the same number off the slope of a collector curve.',
    seeReads: [
      ['bjt.rate', 7.1475652e-9],
      ['bjt.va', 69.953892],
    ],
    try: [
      {
        say: 'Drop the collector bias to 2 V. The edge moves faster there, 10.33 nm per volt, so the Early voltage falls to 48.39 V.',
        set: { vcb: 2 },
        reads: [
          ['bjt.rate', 1.0332542e-8],
          ['bjt.va', 48.390804],
        ],
      },
      {
        say: 'Take it to 10 V. The rate has fallen to 5.228 nm per volt and the Early voltage has climbed to 95.64 V.',
        set: { vcb: 10 },
        reads: [
          ['bjt.rate', 5.2280336e-9],
          ['bjt.va', 95.638253],
        ],
      },
      {
        say: 'Lighten the collector to 10¹⁵ cm⁻³. The junction now spreads into the collector instead, so only 27.00 nm reaches the base and the Early voltage is 210.9 V.',
        set: { nc: 1e21 },
        reads: [
          ['bjt.intoBase', 2.6999173e-8],
          ['bjt.va', 210.87138],
        ],
      },
    ],
    why:
      'The Early effect is the base getting thinner while the collector voltage rises. A thinner base means ' +
      'less for the injected carriers to cross, so more of them arrive and the collector current climbs. That ' +
      'is the slope a circuit course measures on a collector curve and calls an output resistance. Here it is ' +
      'computed from the profile instead, and the two routes should meet. The rate the edge moves at is ' +
      'x_p/2V_j, which falls as the bias rises because the width follows a square root, so V_A is larger at ' +
      'larger collector voltages rather than constant. A lightly doped collector keeps most of the depletion ' +
      'region on its own side, which is why a process that wants a high Early voltage dopes the collector ' +
      'lightly.',
  },
}
