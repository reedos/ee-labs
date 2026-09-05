// Group A's three registers. Every number here is a reading, checked against
// the engine by experiments.test.js, and every knob move names a setting the
// knob can reach. Concentrations are written in cm⁻³ because that is what a
// course and a datasheet use, and the engine works in m⁻³.

export const LESSONS_A = {
  a1: {
    see:
      'Silicon doped with 10¹⁶ cm⁻³ of donors carries 10¹⁶ cm⁻³ of electrons. The holes do not disappear. They ' +
      'fall to 2.25 × 10⁴ cm⁻³, and the product of the two stays at the square of the intrinsic concentration. ' +
      'That concentration is 1.5 × 10¹⁰ cm⁻³ at 300 K.',
    seeReads: [
      ['carrier.n', 1e22],
      ['carrier.p', 2.25e10],
      ['carrier.ni', 1.5e16],
    ],
    try: [
      {
        say: 'Raise the donors to 10¹⁷ cm⁻³. The electrons follow them up, and the holes fall a decade with them, to 2.25 × 10³ cm⁻³.',
        set: { nd: 1e23 },
        reads: [
          ['carrier.n', 1e23],
          ['carrier.p', 2.25e9],
        ],
      },
      {
        say: 'Add 10¹⁷ cm⁻³ of acceptors on top. They cancel all but a tenth of the donors, so the sample turns p-type with 9 × 10¹⁶ cm⁻³ of holes.',
        set: { na: 1e23 },
        reads: [
          ['carrier.p', 9e22],
          ['carrier.type', 'p'],
        ],
      },
      {
        say: 'Now drop the donors to 10¹² cm⁻³, close to the intrinsic value. The electrons read 9.902 × 10¹¹ cm⁻³ and the holes 2.272 × 10⁸ cm⁻³, because thermal pairs have started to count.',
        set: { nd: 1e18 },
        reads: [
          ['carrier.n', 9.9022722e17],
          ['carrier.p', 2.2722158e14],
        ],
      },
    ],
    why:
      'Doping does not make carriers so much as trade one kind for the other. Every donor gives up an electron, ' +
      'which raises n. Those extra electrons find holes and recombine, which lowers p. Generation and ' +
      'recombination balance again once the product n p has returned to n_i², and that is the law of mass ' +
      'action. It holds at every doping, and it is not an approximation. What it means in practice is that a ' +
      'doped sample has almost none of one of the two carriers. At 10¹⁶ cm⁻³ of donors there are 2.25 × 10⁴ cm⁻³ ' +
      'of holes, twelve decades below. The minority carrier is still the one that decides things, because it is ' +
      'what crosses a junction, and Group B is where that crossing becomes a current.',
  },

  a2: {
    see:
      'Computed from the band-edge densities, n_i is 1.079 × 10¹⁰ cm⁻³ at 300 K. The suite pins ' +
      '1.5 × 10¹⁰ cm⁻³ instead, which is 1.390 times larger. Both values are in print, and the difference is ' +
      'which band gap each one is consistent with. The pinned value implies 1.103 eV rather than 1.12 eV.',
    seeReads: [
      ['carrier.niComputed', 1.0790409e16],
      ['carrier.ni', 1.5e16],
      ['carrier.niRatio', 1.3901235],
      ['carrier.gapImplied', 1.1029691],
    ],
    try: [
      {
        say: 'Set the band gap to 1.0 eV. The computed n_i climbs two decades, to 1.099 × 10¹¹ cm⁻³, because the gap sits inside an exponential.',
        set: { eg: 1.0 },
        reads: [['carrier.niComputed', 1.0989895e17]],
      },
      {
        say: 'Set it to 1.2 eV instead. The computed value falls to 2.297 × 10⁹ cm⁻³, which is a factor of fifty below the value at 1.12 eV.',
        set: { eg: 1.2 },
        reads: [['carrier.niComputed', 2.2965054e15]],
      },
      {
        say: 'Return the gap and raise N_c to 3.2 × 10¹⁹ cm⁻³. The computed value moves to 1.141 × 10¹⁰ cm⁻³, a change of six per cent for a change of twelve.',
        set: { nc: 3.2e25 },
        reads: [['carrier.niComputed', 1.141379e16]],
      },
    ],
    why:
      'The two numbers come from the same formula read with different inputs. Green measured the band-edge ' +
      'densities and the gap, and those give 1.079 × 10¹⁰ cm⁻³. Streetman quotes 1.5 × 10¹⁰ cm⁻³. The same ' +
      'formula run backwards says that value belongs with a gap of 1.103 eV. Neither is a mistake. The gap and ' +
      'the effective masses are measured quantities with their own spread. And n_i sits inside an exponential ' +
      'of the gap, so a disagreement of 17.03 meV is a 39 per cent one in n_i. The suite keeps ' +
      '1.5 × 10¹⁰ cm⁻³ because the Electronics Lab has pinned numbers against it. Every barrier in Group B ' +
      'moves if that constant moves, and this experiment exists so the choice is visible rather than buried.',
    whyReads: [
      ['carrier.niComputed', 1.0790409e16],
      ['carrier.gapImplied', 1.1029691],
      [(x) => 1.12 - x.carrier.gapImplied, 0.01703086],
      [(x) => x.carrier.niRatio - 1, 0.3901235],
    ],
  },

  a3: {
    see:
      'At 300 K a sample doped 10¹⁶ cm⁻³ has 2.25 × 10⁴ cm⁻³ of holes. Warm it and the intrinsic pairs climb ' +
      'fast, because the band gap sits in an exponential of 1/T. At 400 K n_i has reached 5.193 × 10¹² cm⁻³, ' +
      'which is thirty-five thousand times its value at 250 K.',
    seeReads: [
      ['carrier.p', 2.25e10],
      ['carrier.ni', 1.5e16],
      [(x, p, again) => again({ T: 400 }).carrier.ni, 5.1927313e18],
      [(x, p, again) => again({ T: 400 }).carrier.ni / again({ T: 250 }).carrier.ni, 34641.258],
    ],
    try: [
      {
        say: 'Cool the sample to 250 K. The intrinsic concentration falls to 1.499 × 10⁸ cm⁻³ and the holes fall with it, to 2.247 cm⁻³.',
        set: { T: 250 },
        reads: [
          ['carrier.ni', 1.499002e14],
          ['carrier.p', 2247006.9],
        ],
      },
      {
        say: 'Warm it to 400 K instead. The electrons still read 10¹⁶ cm⁻³, so this sample is extrinsic across the whole range.',
        set: { T: 400 },
        reads: [
          ['carrier.n', 1.0000003e22],
          ['carrier.ni', 5.1927313e18],
        ],
      },
      {
        say: 'Drop the doping to 10¹³ cm⁻³ and the crossover moves into the range. This sample stops being extrinsic at 390.1 K.',
        set: { nd: 1e19 },
        reads: [['carrier.intrinsicT', 390.13397]],
      },
    ],
    why:
      'Every quantity in a semiconductor that carries an exponential of the band gap moves like this. The pairs ' +
      'thermal energy makes go as T^{3/2}e^{−E_g/2kT}, and the exponential wins by a wide margin over the range ' +
      'a circuit lives in. That is why a junction warms and leaks, and why a transistor left uncompensated ' +
      'drifts. It is also where doping stops working. A sample stays extrinsic while its net doping is far above ' +
      'n_i, and once n_i has caught up the dopants have stopped deciding anything. At 10¹³ cm⁻³ that happens at ' +
      '390.1 K, which a power device reaches. At 10¹⁶ cm⁻³ it happens at 621.9 K, which nothing survives, and ' +
      'that is why ordinary silicon is doped as heavily as it is.',
    whyReads: [
      ['carrier.intrinsicT', 621.93244],
      [(x, p, again) => again({ nd: 1e19 }).carrier.intrinsicT, 390.13397],
    ],
  },

  a4: {
    see:
      'The Fermi level sits above the intrinsic level by kT ln(n/n_i), so its height reads the doping directly. ' +
      'At 10¹⁶ cm⁻³ of donors it is 346.7 meV above. The four lines below are flat, because one uniform piece ' +
      'of silicon has nothing to bend them.',
    seeReads: [['carrier.efi', 0.34667649]],
    try: [
      {
        say: 'Drop the doping a decade, to 10¹⁵ cm⁻³. The level falls to 287.2 meV, which is 59.53 meV lower.',
        set: { nd: 1e21 },
        reads: [
          ['carrier.efi', 0.28715006],
          [(x, p, again) => again({ nd: 1e22 }).carrier.efi - x.carrier.efi, 0.059526429],
        ],
      },
      {
        say: 'Raise it two decades instead, to 10¹⁷ cm⁻³. The level reads 406.2 meV, one more step of the same size.',
        set: { nd: 1e23 },
        reads: [['carrier.efi', 0.40620292]],
      },
      {
        say: 'Add 10¹⁷ cm⁻³ of acceptors. The sample turns p-type and the level crosses to the other side, 403.5 meV below the intrinsic level.',
        set: { na: 1e23 },
        reads: [['carrier.efi', -0.40347914]],
      },
    ],
    why:
      'A decade of doping is worth 59.53 meV at 300 K, and that number turns up again and again. It is the same ' +
      '59.53 mV a decade of current costs a forward junction, and for the same reason. Both are kT ln 10, and ' +
      'both come from carriers distributed in energy by a Boltzmann factor. Where the Fermi level sits is the ' +
      'one number that says how heavily a piece of silicon is doped and which type it is, without naming a ' +
      'concentration. Two pieces with their Fermi levels at different heights, pushed together, cannot both ' +
      'keep them. Levelling them is what builds the barrier of Group B, and the height of that barrier is the ' +
      'gap between the two levels the pieces started with.',
    whyReads: [
      [(x, p, again) => again({ nd: 1e23 }).carrier.efi - again({ nd: 1e22 }).carrier.efi, 0.059526429],
    ],
  },

  a5: {
    see:
      'The band diagram is four energies drawn against position. The conduction edge sits 560 meV above the ' +
      'intrinsic level and the valence edge 560 meV below it. The Fermi level sits 346.7 meV above, which ' +
      'leaves 213.3 meV to the conduction edge. All four lines are flat here.',
    seeReads: [
      ['carrier.ec', 0.56],
      ['carrier.ef', 0.34667649],
      ['carrier.barrier', 0.21332351],
    ],
    try: [
      {
        say: 'Raise the doping to 10¹⁷ cm⁻³. Only the Fermi level moves, up to 406.2 meV, and the gap to the conduction edge closes to 153.8 meV.',
        set: { nd: 1e23 },
        reads: [
          ['carrier.ef', 0.40620292],
          ['carrier.barrier', 0.15379708],
        ],
      },
      {
        say: 'Add 10¹⁷ cm⁻³ of acceptors instead. The Fermi level crosses to 403.5 meV below the intrinsic level, and now sits 963.5 meV under the conduction edge.',
        set: { na: 1e23 },
        reads: [
          ['carrier.ef', -0.40347914],
          ['carrier.barrier', 0.96347914],
        ],
      },
      {
        say: 'Set the band gap to 1.0 eV. Both edges close in to 500 meV, and the distance to the conduction edge falls to 153.3 meV.',
        set: { eg: 1.0 },
        reads: [
          ['carrier.ec', 0.5],
          ['carrier.barrier', 0.15332351],
        ],
      },
    ],
    why:
      'Four lines and one moving part. The two band edges are properties of the crystal, and the intrinsic ' +
      'level sits near the middle of them. Doping moves the Fermi level and nothing else. That is worth seeing ' +
      'flat once, because every later diagram in this lab is this one bent. A junction bends all four lines by ' +
      'the same amount at each position, which is what a potential does. The size of that bend is the barrier ' +
      'Group B computes. The distance from the Fermi level to the conduction edge is what an electron has to ' +
      'find to become mobile. A heavily doped sample is one whose electrons have less to find, and its ' +
      'conductivity says so.',
  },
}
