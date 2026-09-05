// Group A's three registers. Every number is a reading the solver produced.

export const LESSONS_A = {
  a1: {
    see:
      'The scope input is 1 MΩ with 15 pF across it, and a circuit under test has to drive both. At the ' +
      '1 kHz drive the input shows 996 kΩ, which is almost the resistor on its own. The capacitor takes ' +
      'over at 10.61 kHz.',
    seeReads: [
      ['zin.mag', 995589],
      ['corner', 10610.3],
    ],
    try: [
      {
        say: 'Set the frequency to 10.61 kHz. The input shows 707 kΩ, its DC value divided by √2, which is the definition of the corner.',
        set: { f: 10610.3 },
        reads: [['zin.mag', 707108]],
      },
      {
        say: 'Set the frequency to 1 MHz. The input shows 10.61 kΩ, and the resistor now contributes almost nothing.',
        set: { f: 1e6 },
        reads: [['zin.mag', 10609.7]],
      },
      {
        say: 'Raise the input capacitance to 150 pF, a metre of cable. The corner falls to 1.061 kHz and the reading at 1 kHz drops to 728 kΩ.',
        set: { C2: 150e-12 },
        reads: [
          ['corner', 1061.03],
          ['zin.mag', 727730],
        ],
      },
    ],
    why:
      'A resistor and a capacitor in parallel have admittance 1/R + jωC, so the impedance is ' +
      '(1/R² + (ωC)²)^(−1/2). Below the corner the conductance is the larger term and the input is a ' +
      'megohm. Above it the susceptance is, and the input falls as 1/ωC, by a factor of ten for every ' +
      'factor of ten in frequency. The corner between them is 10.61 kHz. Nothing about the instrument ' +
      'changes there. What changes is how much current the circuit under test has to supply, and a ' +
      'source that cannot supply it reads low.',
    whyReads: [['corner', 10610.3]],
  },

  a2: {
    see:
      'Connect a source of 100 kΩ straight to that input. At DC the scope reads 0.909 of the true ' +
      'voltage, because 100 kΩ and 1 MΩ are a divider. The response is down by √2 at 116.7 kHz, and the ' +
      'time constant behind that is R_s in parallel with R_in, not R_in alone.',
    seeReads: [
      ['H.mag', 0.909091],
      ['corner', 116714],
    ],
    try: [
      {
        say: 'Set the frequency to 116.7 kHz. The reading is 0.643, which is 0.909 divided by √2.',
        set: { f: 116714 },
        reads: [['H.mag', 0.642824]],
      },
      {
        say: 'Drop the source resistance to 1 kΩ. The DC reading rises to 0.999 and the corner moves out to 10.62 MHz.',
        set: { Rs: 1e3 },
        reads: [
          ['H.mag', 0.999001],
          ['corner', 10620900],
        ],
      },
      {
        say: 'Raise it to 1 MΩ instead. Now the scope reads half the voltage and the corner has fallen to 21.22 kHz.',
        set: { Rs: 1e6 },
        reads: [
          ['H.mag', 0.499999],
          ['corner', 21220.7],
        ],
      },
    ],
    why:
      'Seen from the input capacitor the network is a source behind R_s in parallel with R_in, which is ' +
      'Elements F4 read as a measurement error. That parallel resistance sets the time constant, so a ' +
      'stiff source barely rolls off and a weak one rolls off early. The DC ratio is the divider the two ' +
      'resistors make. Both errors are systematic, so averaging does not reduce either. The instrument ' +
      'has not measured the circuit. It has measured the circuit with itself attached.',
  },

  a3: {
    see:
      'A 10× probe puts 9 MΩ in front of the scope, with a small capacitor across it. At DC the ratio is ' +
      'the resistors’, 0.1. At high frequency it is the capacitors’, also 0.1 at this setting. Between ' +
      'them the response is flat, and the trimmer is what makes the two ends agree.',
    seeReads: [
      ['ratio.dc', 0.1],
      ['ratio.hf', 0.1],
      ['H.mag', 0.0999999],
    ],
    try: [
      {
        say: 'Set the probe capacitor to 1 pF. The high-frequency ratio drops to 0.0625 while the DC ratio stays at 0.1, so the response is no longer flat.',
        set: { C1: 1e-12 },
        reads: [
          ['ratio.hf', 0.0625],
          ['ratio.dc', 0.1],
        ],
      },
      {
        say: 'Set it to 3 pF. Now the high-frequency ratio is 0.1667, above the DC one, and the tilt has changed sign.',
        set: { C1: 3e-12 },
        reads: [['ratio.hf', 0.166667]],
      },
      {
        say: 'Set the frequency to 1 MHz with the probe back at 1 pF. The reading is 0.0625, the capacitors’ ratio, because the resistors have stopped mattering.',
        set: { C1: 1e-12, f: 1e6 },
        reads: [['H.mag', 0.0625056]],
      },
    ],
    why:
      'Each leg of the divider is a resistor and a capacitor in parallel, so each has impedance ' +
      'R/(1 + sRC). The ratio of the two legs is R₂(1 + sR₁C₁) over R₁(1 + sR₂C₂) plus R₂(1 + sR₁C₁). ' +
      'When R₁C₁ equals R₂C₂ the two brackets are the same factor and cancel, leaving R₂/(R₁+R₂) at ' +
      'every frequency. That is why the trimmer exists, and it is the only setting at which the probe ' +
      'divides by ten. Everywhere else the divider has a pole and a zero at different places, and the ' +
      'trace tilts between them.',
  },

  a4: {
    see:
      'The calibrator puts a 1 V square wave on the probe tip. With the trimmer at 1 pF the edge lands ' +
      'at 62.5 mV, an eighth of the way, and then climbs to 100 mV with a time constant of 14.4 µs. ' +
      'That rounded corner is what an under-compensated probe looks like.',
    seeReads: [
      [(x, p) => x.tr.at(20 * p.Rcal * (p.C1 + p.C2)).sol.v.in, 0.0625218],
      [(x, p) => x.tr.at(0.45 / p.fc).sol.v.in, 0.0999995],
      [(x, p) => (p.R1 * p.R2 * (p.C1 + p.C2)) / (p.R1 + p.R2), 1.44e-5],
    ],
    try: [
      {
        say: 'Set the trimmer to 3 pF. The edge now lands at 167 mV and falls to 100 mV, so the corner overshoots by 66.6 %.',
        set: { C1: 3e-12 },
        reads: [
          [(x, p) => x.tr.at(20 * p.Rcal * (p.C1 + p.C2)).sol.v.in, 0.166622],
          [(x, p) => x.tr.at(0.45 / p.fc).sol.v.in, 0.0999995],
          [(x, p) => 100 * (p.C1 / (p.C1 + p.C2) / (p.R2 / (p.Rcal + p.R1 + p.R2)) - 1), 66.5843],
        ],
      },
      {
        say: 'Set it to 1.667 pF, which is R₂C₂/R₁. The edge lands at 100 mV and stays there. There is no transient left to see.',
        set: { C1: 1.6666666666666667e-12 },
        reads: [
          [(x, p) => x.tr.at(20 * p.Rcal * (p.C1 + p.C2)).sol.v.in, 0.0999995],
          [(x, p) => x.tr.at(0.45 / p.fc).sol.v.in, 0.0999995],
        ],
      },
      {
        say: 'Put the cursor at 14.4 µs, one time constant into the edge. The trace has covered 63.2 % of the gap and reads 86.2 mV.',
        at: 1.44e-5,
        reads: [
          [(x) => x.sol.v.in, 0.0862],
          [(x, p) => (100 * (x.sol.v.in - (p.A * p.C1) / (p.C1 + p.C2))) / ((p.A * p.R2) / (p.Rcal + p.R1 + p.R2) - (p.A * p.C1) / (p.C1 + p.C2)), 63.2],
        ],
      },
    ],
    why:
      'Both capacitors are uncharged at the edge, so the step divides between them by C₁/(C₁+C₂). Long ' +
      'after, the capacitors carry no current and the step divides between the resistors by R₂/(R₁+R₂). ' +
      'Between the two the circuit relaxes with one time constant, (R₁∥R₂)(C₁+C₂), which is 14.4 µs ' +
      'here. Compensation is the setting at which the two ratios are equal, and then the exponential ' +
      'has nothing to travel. A square wave shows the mismatch because its edges excite the transient ' +
      'and its flat tops let it finish.',
    whyReads: [[(x, p) => (p.R1 * p.R2 * (p.C1 + p.C2)) / (p.R1 + p.R2), 1.44e-5]],
  },

  a5: {
    see:
      'The same 100 kΩ source, now through a compensated probe. The scope reads 0.0990 rather than ' +
      '0.909, ten times less, and the response holds to 1.072 MHz rather than 116.7 kHz. The probe ' +
      'shows the circuit 10 MΩ and 1.5 pF instead of 1 MΩ and 15 pF.',
    seeReads: [
      ['H.mag', 0.0990098],
      ['corner', 1071640],
      [(x, p) => 1 / (2 * Math.PI * ((p.Rs * p.R2) / (p.Rs + p.R2)) * p.C2), 116714],
      [(x, p) => p.R2 / (p.Rs + p.R2), 0.909091],
      [(x, p) => p.R1 + p.R2, 1e7],
    ],
    try: [
      {
        say: 'Set the frequency to 1.072 MHz. The reading is 0.07001, which is 0.0990 divided by √2.',
        set: { f: 1071640 },
        reads: [['H.mag', 0.0700099]],
      },
      {
        say: 'Raise the source resistance to 1 MΩ. The reading falls to 0.0909 and the corner to 116.7 kHz, which is 5.5 times the 21.22 kHz the bare input manages.',
        set: { Rs: 1e6 },
        reads: [
          ['H.mag', 0.0909089],
          ['corner', 116714],
          [(x, p) => 1 / (2 * Math.PI * ((p.Rs * p.R2) / (p.Rs + p.R2)) * p.C2), 21220.7],
          [(x, p) => (((p.Rs * p.R2) / (p.Rs + p.R2)) * p.C2) / (((p.Rs * (p.R1 + p.R2)) / (p.Rs + p.R1 + p.R2)) * ((p.C1 * p.C2) / (p.C1 + p.C2))), 5.5],
        ],
      },
    ],
    why:
      'Two capacitors in series present their series combination, which is 1.5 pF here rather than ' +
      '15 pF, and two resistors in series present 10 MΩ. So the probe divides the signal by ten and ' +
      'divides the loading by ten as well. The bandwidth into a 100 kΩ source goes up by 9.18 times, ' +
      'not by ten, because the source resistance is no longer negligible against the input. The ten ' +
      'times smaller signal is the price, and it is why a probe is switched to 1× for small signals ' +
      'and left at 10× for everything else.',
    whyReads: [
      [(x, p) => (1 / (2 * Math.PI * ((p.Rs * (p.R1 + p.R2)) / (p.Rs + p.R1 + p.R2)) * ((p.C1 * p.C2) / (p.C1 + p.C2)))) / (1 / (2 * Math.PI * ((p.Rs * p.R2) / (p.Rs + p.R2)) * p.C2)), 9.18182],
    ],
  },

  a6: {
    see:
      'A step into the same front end. The trace climbs from a tenth to nine tenths of its final value in ' +
      '2.996 µs, which is 2.197 time constants. Multiply that by the 116.7 kHz bandwidth and the ' +
      'answer is 0.3497, whatever the resistors and the capacitor are.',
    seeReads: [
      ['risetime', 2.99622e-6],
      [(x, p) => 1 / (2 * Math.PI * ((p.Rs * p.R2) / (p.Rs + p.R2)) * p.C2), 116714],
      [(x, p) => (Math.log(9) * ((p.Rs * p.R2) / (p.Rs + p.R2)) * p.C2) / (2 * Math.PI * ((p.Rs * p.R2) / (p.Rs + p.R2)) * p.C2), 0.349699],
    ],
    try: [
      {
        say: 'Raise the source resistance to 1 MΩ. The rise time grows to 16.48 µs and the bandwidth falls to 21.22 kHz. Their product has not moved.',
        set: { Rs: 1e6 },
        reads: [
          ['risetime', 1.64792e-5],
          [(x, p) => 1 / (2 * Math.PI * ((p.Rs * p.R2) / (p.Rs + p.R2)) * p.C2), 21220.7],
          [(x, p) => (Math.log(9) * ((p.Rs * p.R2) / (p.Rs + p.R2)) * p.C2) / (2 * Math.PI * ((p.Rs * p.R2) / (p.Rs + p.R2)) * p.C2), 0.349699],
        ],
      },
      {
        say: 'Raise the input capacitance to 150 pF. The rise time is 29.96 µs, ten times the first, and the product is 0.3497 again.',
        set: { C2: 150e-12 },
        reads: [
          ['risetime', 2.99622e-5],
          [(x, p) => (Math.log(9) * ((p.Rs * p.R2) / (p.Rs + p.R2)) * p.C2) / (2 * Math.PI * ((p.Rs * p.R2) / (p.Rs + p.R2)) * p.C2), 0.349699],
        ],
      },
    ],
    why:
      'A single pole answers a step with 1 − e^(−t/τ). That crosses one tenth at τ ln(10/9) and nine ' +
      'tenths at τ ln 10, so the time between them is τ ln 9. The bandwidth of the same pole is ' +
      '1/(2πτ). Multiply and τ cancels, leaving ln 9 over 2π, which is 0.3497. The bench rule of thumb ' +
      'is 0.35, and it is this number rounded. It holds only for one pole. A scope with several poles ' +
      'has a product nearer 0.4, and its maker states which.',
    whyReads: [
      [(x, p) => (Math.log(9) * ((p.Rs * p.R2) / (p.Rs + p.R2)) * p.C2) / (2 * Math.PI * ((p.Rs * p.R2) / (p.Rs + p.R2)) * p.C2), 0.349699],
    ],
  },
}
