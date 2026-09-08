// Group C's terms, defined where they first do work.

export const TERMS_C = {
  lnetwork: {
    name: 'L network',
    def:
      'Two reactances, one in series with the load and one across a node, arranged in the shape of the letter. It ' +
      'is the smallest network that transforms one resistance into another without loss. Two elements give two ' +
      'equations, so the values are solved rather than searched for.',
  },
  matching: {
    name: 'Matching network',
    def:
      'A lossless network placed between a source and a load so that the source sees its own resistance. Nothing ' +
      'is reflected at the design frequency, so all the available power reaches the load. It holds at one ' +
      'frequency, because its elements have a different reactance at every other one.',
  },
  loadedq: {
    name: 'Loaded Q',
    def:
      'The Q the synthesis produces, which is the square root of the transformation ratio less one. Matching 100 Ω ' +
      'to 50 Ω needs a loaded Q of 1.0000. A larger transformation needs a larger Q, and a larger Q makes the ' +
      'match narrower.',
  },
  orientation: {
    name: 'Orientation',
    def:
      'Which side of the network the shunt element sits on. A shunt element lowers the resistance seen through ' +
      'it, so it goes across the higher of the two resistances. The other orientation has no real solution, and ' +
      'the enumeration says so rather than leaving the entry out.',
  },
  fractionalbandwidth: {
    name: 'Fractional bandwidth',
    def:
      'The width of a band divided by the frequency at its centre, usually quoted as a percentage. A band from ' +
      '650.1 MHz to 1.256 GHz around 1.000 GHz is 60.58 per cent. The ratio the edges are read at has to be ' +
      'stated, because the width depends on it.',
  },
  transformer: {
    name: 'Quarter-wave transformer',
    def:
      'One section of line, a quarter wavelength long, whose characteristic impedance is the geometric mean of ' +
      'the two resistances it joins. It matches at the design frequency and at every odd multiple of it. It needs ' +
      'no lumped components at all.',
  },
  geometricmean: {
    name: 'Geometric mean',
    def:
      'The square root of the product of two numbers, as against the arithmetic mean, which is half their sum. ' +
      'The geometric mean of 50 Ω and 100 Ω is 70.71 Ω. A quarter-wave section inverts about its own impedance, ' +
      'which is why that is the impedance it needs.',
  },
  absorb: {
    name: 'Absorbing a reactance',
    def:
      'Cancelling a load’s reactance with an element of the opposite sign before the resistance is transformed. ' +
      'The residue is the resistive pair the closed form solves. Two reactances in the same branch beside each ' +
      'other are one reactance, so absorbing costs no extra component.',
  },
}

export const MATCH_C = {
  lnetwork: /\bL network\b/,
  matching: /\bmatching network\b/,
  loadedq: /\bloaded Q\b/,
  orientation: /\borientation\b/i,
  fractionalbandwidth: /\bfractional bandwidth\b/i,
  transformer: /\btransformer\b/i,
  geometricmean: /\bgeometric mean\b/i,
  absorb: /\babsorb/i,
}
