// Group M's terms: the parts an op-amp is made of, named where they first do
// work. Merged into the lab's one registry by terms.js.

export const TERMS_M = {
  twostage: {
    name: 'The two-stage op-amp',
    def:
      'The shape almost every general-purpose amplifier has. A differential pair takes the two inputs and turns ' +
      'their difference into a current. A common-emitter stage turns that current into a large voltage. One ' +
      'capacitor across the second stage sets how fast the whole thing is allowed to be.',
  },
  rhpzero: {
    name: 'The right-half-plane zero',
    def:
      'A zero whose own real part is positive, which the compensation capacitor makes by carrying signal forward ' +
      'past the stage it is meant to slow down. It cuts the magnitude like any zero. It subtracts phase instead ' +
      'of adding it, so it takes phase margin away exactly where the margin is being counted.',
  },
  slewderived: {
    name: 'The tail current',
    def:
      'The fixed current a differential pair shares between its two sides. A large input steers all of it into one ' +
      'side, and that is the most the pair can ever deliver. Into the compensation capacitor it sets the fastest ' +
      'the output can move, whatever the small-signal bandwidth says.',
  },
  pairoffset: {
    name: 'Offset from a mismatched pair',
    def:
      'The input voltage that puts a real pair’s output back where a matched pair’s would be. Two transistors that ' +
      'differ by a factor r in saturation current need V_T ln r between their bases to carry the same current. One ' +
      'per cent of difference is 257 µV, and that is the battery Group A hung on the input.',
  },
  classb: {
    name: 'Class B',
    def:
      'An output stage whose two transistors each conduct for half of the cycle and neither of which carries any ' +
      'current at rest. That is where its efficiency comes from. It is also where its distortion comes from, ' +
      'because neither device conducts until the drive exceeds its own turn-on voltage.',
  },
  crossoverdist: {
    name: 'Crossover distortion',
    def:
      'The flat piece a class B stage leaves in the output while the drive passes through zero and neither ' +
      'transistor is on. It is worst for small signals, because the dead band is a fixed number of volts. At one ' +
      'volt of drive it costs 59 % of total harmonic distortion, and at nine volts 4.6 %.',
  },
  efficiency: {
    name: 'Efficiency',
    def:
      'Power delivered to the load over power taken from the supplies, as a percentage. A class B stage driven to ' +
      'nine volts into a kilohm reaches 65 %. The ceiling is π/4, which is 78.5 %, and it belongs to an ideal ' +
      'stage driven to the rail. A stage that idles at a current can never reach it.',
  },
}

/** Each term's pattern, tried in the order the prose is read. */
export const MATCH_M = {
  twostage: /\btwo-stage\b/i,
  rhpzero: /\bright-half-plane zero\b/i,
  slewderived: /\bsteered\b/i,
  pairoffset: /\bmismatched pair\b/i,
  classb: /\bclass B\b/i,
  crossoverdist: /\bcrossover distortion\b/i,
  efficiency: /\befficienc\w+\b/i,
}
