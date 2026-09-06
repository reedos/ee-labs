// Group C's three registers. Every number here was measured by
// scripts/readings.mjs before it was written, and experiments.test.js
// recomputes each one at the setting its step names.

export const LESSONS_C = {
  c1: {
    see:
      'A 100 Ω load and a 50 Ω source are joined by two reactances. The loaded Q is 1.0000, so the series ' +
      'reactance is 50.00 Ω and the shunt reactance is 100.0 Ω. At 1.000 GHz that is a 7.9577 nH inductor in ' +
      'series and a 1.5915 pF capacitor in shunt. The impedance looking in reads 50.00 Ω.',
    seeReads: [
      ['design.Q', 1],
      ['design.Xs', 50],
      ['design.Xp', 100],
      ['element.series.value', 7.95775e-9],
      ['element.shunt.value', 1.59155e-12],
      ['zin.re', 50],
    ],
    try: [
      {
        say: 'Set the topology to series C, shunt L. The same pair is joined by a 3.1831 pF capacitor in series and a 15.915 nH inductor in shunt, and the reflection is still zero.',
        set: { pick: 'highpass' },
        reads: [
          ['element.series.value', 3.1831e-12],
          ['element.shunt.value', 1.59155e-8],
          ['at.mag', 0],
        ],
      },
      {
        say: 'Set the load resistance to 200 Ω. The loaded Q rises to 1.7321, the series reactance to 86.60 Ω and the shunt reactance to 115.5 Ω.',
        set: { RL: 200 },
        reads: [
          ['design.Q', 1.73205],
          ['design.Xs', 86.6025],
          ['design.Xp', 115.47],
        ],
      },
      {
        say: 'Set the source resistance to 5 Ω and the load resistance to 50 Ω. The Q reads 3.0000, and the two elements become a 2.3873 nH inductor and a 9.5493 pF capacitor.',
        set: { RS: 5, RL: 50 },
        reads: [
          ['design.Q', 3],
          ['element.series.value', 2.38732e-9],
          ['element.shunt.value', 9.5493e-12],
        ],
      },
    ],
    why:
      'An L network is two reactances, one in series with the load and one across a node. Two elements give two ' +
      'equations, and those equations have a closed solution rather than a search. The loaded Q is the square ' +
      'root of the transformation ratio less one, which is 1.0000 for 100 Ω against 50 Ω. The series reactance ' +
      'is Q times the lower resistance, and the shunt reactance is the higher resistance over Q. A reactance is ' +
      'not yet a component. At 1.000 GHz the 50.00 Ω of series reactance is a 7.9577 nH inductor, and doubling ' +
      'the frequency doubles that inductor’s reactance. A matching network therefore holds at the one frequency ' +
      'it was designed at and drifts either side of it.',
  },

  c2: {
    see:
      'The enumeration holds four arrangements of two reactances. Two of them join this pair and two of them have ' +
      'no solution, because a shunt element only lowers the resistance seen through it. Both of the two that work ' +
      'read zero reflection at 1.000 GHz. At 2.000 GHz they part company, with the low-pass one at 0.7276 and ' +
      'the high-pass one at 0.2563.',
    seeReads: [
      ['count', 2],
      ['awayAt', 2e9],
      ['away.0.twice', 0.727607],
      ['away.1.twice', 0.256307],
    ],
    try: [
      {
        say: 'Set the load resistance to 5 Ω. Two arrangements still work, the shunt element moves to the source side, and the loaded Q rises to 3.0000.',
        set: { RL: 5 },
        reads: [
          ['count', 2],
          ['design.Q', 3],
          ['chosen.orientation', 'shunt-at-source'],
        ],
      },
      {
        say: 'Set the source resistance to 5 Ω and the load resistance to 50 Ω. Two arrangements work again, and the shunt element is back across the load.',
        set: { RS: 5, RL: 50 },
        reads: [
          ['count', 2],
          ['chosen.orientation', 'shunt-at-load'],
        ],
      },
      {
        say: 'Set the load resistance to 50 Ω. The two resistances are equal, so one entry is offered and it is a wire.',
        set: { RL: 50 },
        reads: [
          ['count', 1],
          ['design.Q', 0],
        ],
      },
    ],
    why:
      'The enumeration is two orientations by two sign choices, which is four. An orientation names which side of ' +
      'the network the shunt element sits on. A shunt element lowers the resistance seen through it, so it has to ' +
      'sit across the higher of the two resistances. That leaves one orientation with a solution and one with ' +
      'none. The two that have none are entries carrying the reason rather than entries left out. Both sign ' +
      'choices work. One is a series inductor with a shunt capacitor, which is also a low-pass filter. The other ' +
      'is a series capacitor with a shunt inductor, which is a high-pass filter. They agree at the design ' +
      'frequency and nowhere else, so the choice is made on what the network has to reject.',
  },

  c3: {
    see:
      'The loaded Q the synthesis used is the loaded Q of the finished network. A single resonance of Q 1.0000 ' +
      'has a fractional bandwidth of 1.0000. This network measures 60.58 per cent to a standing-wave ratio of ' +
      '1.500, and the band runs from 650.1 MHz to 1.256 GHz.',
    seeReads: [
      ['design.Q', 1],
      ['oneOverQ', 1],
      ['bw.fractional', 0.605811],
      ['bw.lower', 6.50115e8],
      ['bw.upper', 1.25593e9],
    ],
    try: [
      {
        say: 'Set the source resistance to 5 Ω and the load resistance to 50 Ω. The Q rises to 3.0000, one over Q falls to 0.33333, and the measured band narrows to 14.38 per cent.',
        set: { RS: 5, RL: 50 },
        reads: [
          ['design.Q', 3],
          ['oneOverQ', 0.333333],
          ['bw.fractional', 0.143816],
        ],
      },
      {
        say: 'Set the ratio the band is read at to 1.2222. The same network measures 28.72 per cent, because a tighter ratio is crossed closer to the design frequency.',
        set: { target: 1.2222 },
        reads: [['bw.fractional', 0.287219]],
      },
      {
        say: 'Set the load resistance to 200 Ω. The Q is 1.7321, one over Q is 0.57735, and the measured band is 27.48 per cent.',
        set: { RL: 200 },
        reads: [
          ['design.Q', 1.73205],
          ['oneOverQ', 0.57735],
          ['bw.fractional', 0.274771],
        ],
      },
    ],
    why:
      'One over Q and the measured band are two numbers, and each measures something of its own. One over Q is ' +
      'the fractional bandwidth of a single resonance read at its half-power points. The band here is read at a ' +
      'standing-wave ratio the reader sets, and that ratio is not the half-power point. Both move the same way. A ' +
      'larger transformation ratio needs a larger Q, and a larger Q makes the band narrower. Neither the topology ' +
      'nor the design frequency changes that, and the edges either side of the design frequency are found by ' +
      'bisection on the exact response rather than read off a swept point. So the answer does not depend on how ' +
      'many points the sweep drew.',
  },

  c4: {
    see:
      'A quarter wave of line makes the same transformation as C1’s two reactances. Its impedance is the ' +
      'geometric mean of 50 Ω and 100 Ω, which is 70.71 Ω, and the section is 5.172 cm long on this dielectric. ' +
      'Read at a standing-wave ratio of 1.2222, the section holds 36.70 per cent and the L network holds ' +
      '28.72 per cent.',
    seeReads: [
      ['qw.Z0', 70.7107],
      ['qw.len', 0.0517191],
      ['bw.fractional', 0.366967],
      ['lumpedBw.fractional', 0.287219],
    ],
    try: [
      {
        say: 'Set the ratio the band is read at to 1.5. The section holds 78.37 per cent and the L network 60.58 per cent, so the section is the wider of the two at both ratios.',
        set: { target: 1.5 },
        reads: [
          ['bw.fractional', 0.783653],
          ['lumpedBw.fractional', 0.605811],
        ],
      },
      {
        say: 'Set the dielectric constant to 1, which is air. The section grows to 7.495 cm, and its band does not move from 36.70 per cent.',
        set: { epsr: 1 },
        reads: [
          ['qw.len', 0.0749481],
          ['bw.fractional', 0.366967],
        ],
      },
      {
        say: 'Set the load resistance to 200 Ω. The section needs 100 Ω of its own, and its band narrows to 17.11 per cent.',
        set: { RL: 200 },
        reads: [
          ['qw.Z0', 100],
          ['bw.fractional', 0.17112],
        ],
      },
    ],
    why:
      'A quarter-wave transformer is one section of line whose impedance is the geometric mean of the two ' +
      'resistances it joins. At a quarter wave the input impedance reduces to the section’s impedance squared ' +
      'over the load, so the section presents the source resistance exactly. It works again at every odd ' +
      'multiple of the design frequency, because the section is an odd number of quarter waves long at each of ' +
      'those. At an even multiple it is a whole number of half waves and hands the load through untouched. The ' +
      'dielectric sets the length and nothing else. Air makes the section longer than this one and gives the ' +
      'same response, because the response follows electrical length rather than centimetres.',
  },

  c5: {
    see:
      'A load of 30 Ω with −40 Ω of reactance is handled in two moves. The reactance is cancelled by 40.00 Ω in ' +
      'series, which leaves 30 Ω against the 50 Ω source. That residue needs a Q of 0.81650 and a shunt capacitor ' +
      'of 2.599 pF. The cancelling element and the network’s own series element are one element of 64.49 Ω.',
    seeReads: [
      ['cancel.X', 40],
      ['design.Q', 0.816497],
      ['element.shunt.value', 2.59899e-12],
      ['element.series.X', 64.4949],
    ],
    try: [
      {
        say: 'Set the load reactance to 40 Ω, which makes it an inductor. The cancelling element becomes a capacitor of −40.00 Ω, and the folded series element reads −15.51 Ω.',
        set: { XL: 40 },
        reads: [
          ['cancel.X', -40],
          ['element.series.X', -15.5051],
        ],
      },
      {
        say: 'Set the load reactance to zero. The load is a plain 30 Ω, no cancelling element is needed, and the network is still two elements.',
        set: { XL: 0 },
        reads: [
          ['chosen.elements.length', 2],
          ['design.Q', 0.816497],
        ],
      },
      {
        say: 'Set the topology to series C, shunt L. The shunt element becomes an inductor of 61.24 Ω, and the folded series element becomes an inductor of 15.51 Ω.',
        set: { pick: 'highpass' },
        reads: [
          ['element.shunt.X', 61.2372],
          ['element.series.X', 15.5051],
        ],
      },
    ],
    why:
      'A complex load is absorbed before it is transformed. A series element of the opposite reactance cancels ' +
      'the load’s reactance and leaves its resistance where it was. The residue is the resistive pair the closed ' +
      'form solves, so the Q comes from 30 Ω against 50 Ω and reads 0.81650. The cancelling element and the ' +
      'network’s own series element sit beside each other in the same branch. Two reactances in series are one ' +
      'reactance, so this network has two elements rather than three and the chart draws two arcs. The load’s ' +
      'reactance here is fixed at every frequency and a capacitor’s is not, and the numbers pane says which of ' +
      'the two is on the bench.',
  },
}
