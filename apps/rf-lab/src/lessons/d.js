// Group D's three registers. Every number here was measured by
// scripts/readings.mjs before it was written, and experiments.test.js
// recomputes each one at the setting its step names.

export const LESSONS_D = {
  d1: {
    see:
      'A wave is a voltage divided by the square root of an impedance, so its square is a power. Drive one volt ' +
      'into a 100 Ω load through 50 Ω, and the wave going in reads 0.070711 while the wave coming back reads ' +
      '0.023570. Their ratio is 0.33333, which is the scattering parameter S11 of that load.',
    seeReads: [
      ['waves.a', 0.0707107],
      ['waves.b', 0.0235702],
      ['gamma.mag', 0.333333],
    ],
    try: [
      {
        say: 'Set the load resistance to 25 Ω. S11 reads −0.33333, which is the same magnitude with the sign reversed, and the solve and the closed form still agree.',
        set: { RL: 25 },
        reads: [
          ['gamma.re', -0.333333],
          ['solvedMag', 0.333333],
        ],
      },
      {
        say: 'Set the load to 30 Ω with −40 Ω of reactance. The magnitude of S11 reads 0.50000, and the two routes to it agree to fifteen digits.',
        set: { RL: 30, XL: -40 },
        reads: [
          ['gamma.mag', 0.5],
          ['solvedMag', 0.5],
          ['agree', 5e-16, 1e-15],
        ],
      },
      {
        say: 'Set the reference impedance to 75 Ω. The same 100 Ω load reflects 0.14286, and the wave going in falls to 0.057735, because both depend on the reference.',
        set: { z0: 75 },
        reads: [
          ['gamma.mag', 0.142857],
          ['waves.a', 0.057735],
        ],
      },
    ],
    why:
      'The wave going into port k is a = (V + Z_0 I)/(2 √Z_0). The wave coming back is b = (V − Z_0 I)/(2 √Z_0). ' +
      'S is the matrix with b = S a. Every entry is measured with the ports that are not driven terminated in ' +
      'the reference impedance. That is why the description works at a frequency where an open circuit is not ' +
      'open. A one-port has one entry, and that entry is the reflection coefficient A1 defines. The ' +
      'S-parameters of a two-port are four of these ratios. Nothing in the reading needs a current. Driving ' +
      'through the reference impedance with one volt fixes the wave going in, so S11 is twice the port voltage ' +
      'less one and S21 is twice the other port’s voltage.',
  },

  d2: {
    see:
      'A pi attenuator of 3 dB in 50 Ω is a 17.61 Ω resistor between two of 292.4 Ω. Two exact solves of that ' +
      'circuit give S21 as 0.70795, which is −3.0000 dB, and S11 as zero. The closed form for the same three ' +
      'resistors gives the same four numbers, and the two routes agree to fifteen digits.',
    seeReads: [
      ['built.pad.series', 17.6148],
      ['built.pad.shunt', 292.402],
      ['s.21.mag', 0.707946],
      ['s.21.db', -3],
      ['s.11.mag', 0],
      ['agree', 5e-16, 1e-15],
    ],
    try: [
      {
        say: 'Set the attenuator loss to 10 dB. The series resistor grows to 71.15 Ω, the shunt resistors fall to 96.25 Ω, and S21 reads 0.31623.',
        set: { db: 10 },
        reads: [
          ['built.pad.series', 71.1512],
          ['built.pad.shunt', 96.2475],
          ['s.21.mag', 0.316228],
        ],
      },
      {
        say: 'Set the attenuator loss to 20 dB. The series resistor is 247.5 Ω, the shunt resistors are 61.11 Ω, and S11 is still zero.',
        set: { db: 20 },
        reads: [
          ['built.pad.series', 247.5],
          ['built.pad.shunt', 61.1111],
          ['s.11.mag', 0],
        ],
      },
      {
        say: 'Set the frequency to 4.000 GHz. The pad is three resistors, so S21 still reads −3.0000 dB and nothing along the trace moves.',
        set: { f: 4e9 },
        reads: [['s.21.db', -3]],
      },
    ],
    why:
      'S11 is the returning wave over the incident one at port 1, with port 2 terminated in the reference ' +
      'impedance. S21 is the wave leaving port 2 over the same incident wave. Driving port 1 through Z_0 with ' +
      'one volt fixes the incident wave, so S11 is twice the port-one voltage less one and S21 is twice the ' +
      'port-two voltage. Swapping the ports and solving again gives the other two entries. Two exact solves give ' +
      'four exact complex numbers, and no current is measured anywhere. The pi attenuator is the plainest ' +
      'two-port there is. Its S11 is zero at both ports, so it is matched at both, and its insertion loss is the ' +
      'decibels it was designed for. Three resistors have no frequency of their own.',
  },

  d3: {
    see:
      'S, Z, Y and the chain matrix describe one object. The pi attenuator has all four, and the trip from S to ' +
      'Z to the chain matrix to Y and back returns the input to fifteen digits. Each conversion is a closed form ' +
      'on a two-by-two complex matrix, and each is exact wherever the inverse it needs exists.',
    seeReads: [
      ['conv.count', 4],
      ['conv.roundTrip.error', 1e-15, 5e-15],
    ],
    try: [
      {
        say: 'Set the two-port to an ideal transformer. Its S11 reads 0.60000 and its S21 reads 0.80000, and it has two of the four descriptions, because I − S has no inverse.',
        set: { object: 'transformer' },
        refuses: true,
        reads: [
          ['conv.count', 2],
          ['s.11.mag', 0.6],
          ['s.21.mag', 0.8],
        ],
      },
      {
        say: 'Set the turns ratio to 3. S11 rises to 0.80000 and S21 falls to 0.60000, and the transformer still has neither a Z-matrix nor a Y-matrix.',
        set: { object: 'transformer', n: 3 },
        refuses: true,
        reads: [
          ['conv.count', 2],
          ['s.11.mag', 0.8],
          ['s.21.mag', 0.6],
        ],
      },
      {
        say: 'Set the two-port to two resistors with no path. S21 is zero, so there is no chain matrix, and this object has S, Z and Y.',
        set: { object: 'blocked' },
        refuses: true,
        reads: [
          ['conv.count', 3],
          ['s.21.mag', 0],
        ],
      },
    ],
    why:
      'A description exists when the matrix its conversion inverts has an inverse. Z is Z_0 (I + S) times the ' +
      'inverse of (I − S), so a two-port that leaves I − S singular has no Z-matrix. An ideal transformer is ' +
      'that two-port, and its S-matrix is finite while its Z-matrix and its Y-matrix are not. The chain matrix ' +
      'divides by S21, so a two-port with no path from one port to the other does not have one. A missing ' +
      'description is reported by name with the reason, rather than as a large number a reader would take for a ' +
      'measurement. The threshold is relative to the matrix’s own scale, so the same object written in ' +
      'milliohms and in kilohms is treated the same way.',
  },

  d4: {
    see:
      'Two attenuators of 3 dB in cascade give −6.0000 dB, and S11 stays at zero. The closed composition of the ' +
      'two S-matrices and the product of the two chain matrices give the same two-port, and they agree to ' +
      'fifteen digits. Decibels add along a chain because magnitudes multiply.',
    seeReads: [
      ['s.21.db', -6],
      ['s.11.mag', 0],
      ['agree', 1.1e-15, 5e-15],
    ],
    try: [
      {
        say: 'Set the number of attenuators to 4. The chain reads −12.000 dB, and S11 is still zero, because every stage is matched at both ports.',
        set: { stages: 4 },
        reads: [
          ['s.21.db', -12],
          ['s.11.mag', 0],
        ],
      },
      {
        say: 'Set the chain to a quarter-wave section. Split in half and joined again it reads 0.33333 for S11 and 0.94281 for S21, and the two squares sum to one.',
        set: { chain: 'section' },
        reads: [
          ['s.11.mag', 0.333333],
          ['s.21.mag', 0.942809],
          ['power.sum', 1],
        ],
      },
      {
        say: 'Set the impedance the section joins to 200 Ω. Its S11 reads 0.60000 and its S21 reads 0.80000, which are the entries D3’s ideal transformer has.',
        set: { chain: 'section', RL: 200 },
        reads: [
          ['s.11.mag', 0.6],
          ['s.21.mag', 0.8],
          ['power.sum', 1],
        ],
      },
    ],
    why:
      'Joining two-ports has two routes, and they make one claim. The chain matrix composes by multiplication ' +
      'and carries no reference impedance of its own. The S-matrix composes by a closed form whose denominator ' +
      'is one less the product of the two reflections facing each other between the blocks. That denominator ' +
      'vanishes at a lossless resonance between two mismatched ports, and the composition is declined by name ' +
      'there rather than divided by nothing. A row of matched pads is the easy case, because every stage sees ' +
      'the reference impedance at both ends and no reflection is left to bounce. A row of mismatched blocks is ' +
      'not, and the denominator is where the difference sits.',
  },

  d5: {
    see:
      'An 8 nH inductor in series with a 1.6 pF capacitor across the output loses nothing. S12 and S21 agree to ' +
      'fifteen digits, which is reciprocity. S†S is the identity to fifteen digits, which makes the matrix ' +
      'unitary. The squared magnitudes of S11 and S21 sum to 1.0000, so every watt that arrives either comes ' +
      'back or gets through.',
    seeReads: [
      ['power.sum', 1],
      ['power.reciprocity', 0],
      ['power.unitarity', 0],
    ],
    try: [
      {
        say: 'Set the series resistance to 1 Ω. The sum falls to 0.97821, and the dissipation reads 0.021792, which is exactly what S†S − I now reads.',
        set: { Rs: 1 },
        reads: [
          ['power.sum', 0.978208],
          ['power.dissipated', 0.021792],
          ['power.unitarity', 0.021792],
        ],
      },
      {
        say: 'Set the series resistance to 5 Ω. The sum falls to 0.89920, the dissipation rises to 0.10080, and S12 and S21 still agree.',
        set: { Rs: 5 },
        reads: [
          ['power.sum', 0.899204],
          ['power.dissipated', 0.100796],
          ['power.reciprocity', 0],
        ],
      },
      {
        say: 'Set the series resistance to 25 Ω. The sum reads 0.64583, so 0.35417 of every watt that arrives is turned into heat in one resistor.',
        set: { Rs: 25 },
        reads: [
          ['power.sum', 0.645833],
          ['power.dissipated', 0.354167],
        ],
      },
    ],
    why:
      'Reciprocity is S12 equal to S21, and every network of ordinary resistors, inductors and capacitors has ' +
      'it. A network of inductors and capacitors alone loses nothing, so S†S is the identity and the matrix is ' +
      'unitary. The two properties are independent. A unitary matrix carries every watt that arrives, and the ' +
      'squared magnitudes down any column sum to one. Add a resistor and that sum falls by the fraction the ' +
      'resistor took, which is the dissipation. The largest singular value of S is at most one for any passive ' +
      'two-port. It stays at 1.0000 with 25 Ω in the series branch, because one pair of incident waves drives no ' +
      'current through that resistor. So the singular value says only that a two-port could have come off a ' +
      'passive bench, and the dissipation says how much it takes.',
    whyAt: { Rs: 25 },
    whyReads: [
      ['power.largest', 1],
      ['p.Rs', 25],
    ],
  },
}
