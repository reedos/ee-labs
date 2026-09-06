// Group D's terms, defined where they first do work.

export const TERMS_D = {
  scattering: {
    name: 'Scattering parameters',
    def:
      'The matrix S with b = S a, where a is the wave going into a port and b the wave coming back. Each entry is ' +
      'a ratio of two waves at a stated reference impedance. It is the description a network analyser measures, ' +
      'because it needs terminations rather than opens and shorts.',
  },
  sparameter: {
    name: 'S11, S21, S12 and S22',
    def:
      'The four entries of a two-port’s S-parameters, written S with the receiving port first. S11 is what comes ' +
      'back out of port 1 when port 1 is driven. S21 is what leaves port 2 for the same drive. The other two are ' +
      'the same pair with the ports swapped.',
  },
  terminated: {
    name: 'Terminated',
    def:
      'Closed in the reference impedance, so no wave returns from that port. Every entry of S is measured with ' +
      'the ports that are not driven terminated. An open circuit will not do, because at 1.000 GHz an open ' +
      'connector still has capacitance.',
  },
  attenuator: {
    name: 'Attenuator',
    def:
      'A resistive network that loses a stated number of decibels and is matched at both ports while doing it. ' +
      'The pi form is one series resistor between two shunt resistors. At 3 dB in 50 Ω that is 17.61 Ω between ' +
      'two of 292.4 Ω.',
  },
  insertionloss: {
    name: 'Insertion loss',
    def:
      'The decibels a block takes out of a matched path, which is −20 log of the magnitude of S21. A 3 dB ' +
      'attenuator has an insertion loss of 3.000 dB. For a matched block it is the whole of what the block does ' +
      'to the level.',
  },
  chainmatrix: {
    name: 'Chain matrix',
    def:
      'The ABCD description, which relates the voltage and current at one port to those at the other. Two blocks ' +
      'in a row have the product of their chain matrices. It carries no reference impedance of its own, and it ' +
      'does not exist when nothing gets through.',
  },
  conversion: {
    name: 'Conversion',
    def:
      'The closed form that turns one description of a two-port into another, such as S into Z. Each is a ratio ' +
      'of two-by-two complex matrices, and each is exact wherever the inverse it needs exists. Where that inverse ' +
      'does not exist, the description is missing and the reason is given.',
  },
  cascade: {
    name: 'Cascade',
    def:
      'Two two-ports joined port to port, so that what leaves one enters the next. Chain matrices cascade by ' +
      'multiplication. S-matrices cascade by a closed form whose denominator carries the reflection bouncing ' +
      'between the two blocks.',
  },
  reciprocity: {
    name: 'Reciprocity',
    def:
      'S12 equal to S21, so a two-port passes a wave the same way in both directions. Every network of ordinary ' +
      'resistors, inductors and capacitors is reciprocal. A ferrite circulator is not, which is why it is worth ' +
      'stating rather than assuming.',
  },
  unitary: {
    name: 'Unitary matrix',
    def:
      'A matrix whose conjugate transpose times itself is the identity. A lossless two-port has a unitary ' +
      'S-matrix, so the squared magnitudes down any column sum to one. Unitarity and reciprocity are separate ' +
      'properties, and unitarity fails as soon as any resistor is added.',
  },
  dissipation: {
    name: 'Dissipation',
    def:
      'The fraction of the incident power a two-port turns into heat, which is 1 − |S11|² − |S21|² at port 1. It ' +
      'is zero for a network of inductors and capacitors alone. Adding one 5 Ω resistor to this network takes ' +
      '0.10080 of what arrives.',
  },
}

export const MATCH_D = {
  scattering: /\bscattering\b/i,
  sparameter: /\bS-parameters?\b/,
  terminated: /\bterminated\b/i,
  attenuator: /\battenuator\b/i,
  insertionloss: /\binsertion loss\b/i,
  chainmatrix: /\bchain matrix\b/i,
  conversion: /\bconversion\b/i,
  cascade: /\bcascad/i,
  reciprocity: /\breciprocity\b/i,
  unitary: /\bunitary\b/i,
  dissipation: /\bdissipation\b/i,
}
