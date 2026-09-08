// Group A's terms, defined where they first do work.

export const TERMS_A = {
  reflection: {
    name: 'Reflection coefficient',
    def:
      'The ratio of the wave coming back to the wave going in, written Γ. It is (Z_L − Z_0)/(Z_L + Z_0), so a ' +
      'matched load gives zero and an open circuit gives one. Its magnitude never exceeds one for a passive load.',
  },
  reference: {
    name: 'Reference impedance',
    def:
      'The impedance every wave on a line is measured against, written Z_0. This lab uses 50 Ω throughout, which ' +
      'is the connector industry’s choice. Change it and every reflection coefficient changes, which is why it is ' +
      'printed beside every reading.',
  },
  incidentwave: {
    name: 'Incident wave',
    def:
      'The wave travelling towards the load, written a. The one coming back is written b, and Γ is b over a at a ' +
      'one-port. Both are defined from the voltage and the current at the reference impedance.',
  },
  vswr: {
    name: 'Standing-wave ratio',
    def:
      'The ratio of the largest voltage along a line to the smallest. It is (1 + |Γ|)/(1 − |Γ|), so a matched ' +
      'load reads 1 and a total reflection reads infinity. A ratio of 2.000 means a third of the arriving ' +
      'amplitude comes back.',
  },
  returnloss: {
    name: 'Return loss',
    def:
      'The reflected power in decibels below the incident power, which is −20 log of the reflection magnitude. It ' +
      'is quoted as a positive number, so a larger return loss is a better match. A magnitude of 0.3333 is ' +
      '9.542 dB.',
  },
  mismatchloss: {
    name: 'Mismatch loss',
    def:
      'The power a mismatched load does not accept, in decibels. A standing-wave ratio of 2.000 costs 0.5115 dB, ' +
      'which is 11.11 per cent of the power. It is much smaller than the return loss for the same mismatch, ' +
      'because the reflected power is a small fraction of the total.',
  },
  electricallength: {
    name: 'Electrical length',
    def:
      'The length of a line measured in wavelengths at the frequency in use, or in degrees. A quarter wave is 90 ' +
      'degrees. The same copper has a different electrical length at every frequency, which is why a section that ' +
      'matches at one frequency does not at another.',
  },
  wavelength: {
    name: 'Wavelength',
    def:
      'The distance a wave travels in one cycle, which is the phase velocity divided by the frequency. On PTFE at ' +
      '1.000 GHz it is 20.69 cm. In air it would be 29.98 cm, and the dielectric is what shortens it.',
  },
  quarterwave: {
    name: 'Quarter-wave section',
    def:
      'A length of line one quarter of a wavelength long at the frequency in use. It turns a load into Z_0 ' +
      'squared over that load, so it inverts about the line’s own impedance. It is the simplest matching element ' +
      'there is.',
  },
  attenuation: {
    name: 'Attenuation constant',
    def:
      'The rate a wave loses amplitude along a line, written α, in nepers per metre. One neper per metre divides ' +
      'the amplitude by e over each metre. Multiply by 8.686 for decibels per metre.',
  },
  neper: {
    name: 'Neper',
    def:
      'The unit of a natural logarithm ratio, as the decibel is the unit of a base-ten one. One neper is a factor ' +
      'of e in amplitude, which is 8.686 dB. Attenuation is quoted in nepers per metre because the propagation ' +
      'constant is defined that way.',
  },
  rational: {
    name: 'Rational function',
    def:
      'A ratio of two polynomials. Every transfer function the suite holds is one, fixed by a finite list of ' +
      'poles and zeros. A function that is not rational has no such list, and the suite declines to invent one.',
  },
  transcendental: {
    name: 'Transcendental function',
    def:
      'A function that is no ratio of polynomials, such as an exponential or a sine. The delay factor exp(−γl) is ' +
      'one of them. It has no finite poles and no finite zeros, so no polynomial ratio equals it at any order.',
  },
}

export const MATCH_A = {
  reflection: /\breflect/i,
  reference: /\breference impedance\b/i,
  incidentwave: /\bincident\b/i,
  vswr: /\bstanding-wave ratio\b/i,
  returnloss: /\breturn loss\b/i,
  mismatchloss: /\bmismatch loss\b/i,
  electricallength: /\belectrical length\b/i,
  wavelength: /\bwavelength\b/i,
  quarterwave: /\bquarter wave\b/i,
  attenuation: /\battenuation\b/i,
  neper: /\bneper/i,
  rational: /\brational\b/i,
  transcendental: /\btranscendental\b/i,
}
