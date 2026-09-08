// Group B's terms, defined where they first do work.

export const TERMS_B = {
  smithchart: {
    name: 'Smith chart',
    def:
      'The unit disc every passive load maps onto, with a grid of circles drawn on it. It holds the whole right ' +
      'half of the impedance plane in a picture the size of a coin. The centre is a matched load and the ' +
      'boundary is a total reflection.',
  },
  mobius: {
    name: 'Möbius map',
    def:
      'A map of the form (az + b)/(cz + d), with complex coefficients. It sends lines and circles to lines and ' +
      'circles, which is why the chart’s grid is made of circles. Γ = (z − 1)/(z + 1) is one of them.',
  },
  normalised: {
    name: 'Normalised impedance',
    def:
      'An impedance divided by the reference, written z. A 100 Ω load in a 50 Ω line is z = 2. The chart is drawn ' +
      'in normalised units, so one picture serves every reference impedance.',
  },
  constantresistance: {
    name: 'Constant-resistance circle',
    def:
      'The set of impedances with one resistance and any reactance, drawn on the chart. It is centred at ' +
      'r/(1 + r) on the real axis with radius 1/(1 + r). A series reactance moves a point along one of them.',
  },
  constantreactance: {
    name: 'Constant-reactance arc',
    def:
      'The set of impedances with one reactance and any resistance. It is the arc of the circle centred at ' +
      '(1, 1/x) with radius the size of 1/x. Positive reactance fills the upper half of the chart and negative ' +
      'the lower.',
  },
  towardsgenerator: {
    name: 'Towards the generator',
    def:
      'The direction along a line away from the load, which turns a point clockwise on the chart. One half ' +
      'wavelength is a full turn. Reading back towards the load turns anticlockwise, and both directions are ' +
      'marked on a printed chart.',
  },
  vswrcircle: {
    name: 'Standing-wave circle',
    def:
      'The circle of constant reflection magnitude, centred on the match, with radius (S − 1)/(S + 1). Moving ' +
      'along a lossless line stays on it. Loss pulls the path inside it, so a lossy line reads a better match ' +
      'than its load has.',
  },
  admittance: {
    name: 'Admittance',
    def:
      'One over impedance, written y in normalised form. A load of z = 2 has y = 0.5000. Its point on the chart ' +
      'is the impedance point turned half a turn, because the two reflection coefficients differ by a sign.',
  },
  susceptance: {
    name: 'Susceptance',
    def:
      'The imaginary part of an admittance, written b. A shunt capacitor adds positive susceptance and a shunt ' +
      'inductor adds negative. Adding susceptance moves a point along a circle of constant conductance, which is ' +
      'why matching networks are designed on the admittance chart as well.',
  },
}

export const MATCH_B = {
  smithchart: /\bSmith chart\b/i,
  mobius: /\bMöbius\b/i,
  normalised: /\bnormalised\b/i,
  constantresistance: /\bconstant-resistance\b/i,
  constantreactance: /\bconstant-reactance\b/i,
  towardsgenerator: /\btowards the generator\b/i,
  vswrcircle: /\bstanding-wave circle\b/i,
  admittance: /\badmittance\b/i,
  susceptance: /\bsusceptance\b/i,
}
