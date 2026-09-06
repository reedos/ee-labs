// The terms group H introduces, and the patterns that recognise them in prose.
//
// One boundary, and the four words a reader needs to say what happens at it.
// The last two are about the angled case, where the two polarisations part
// company and where this lab declines a medium rather than approximating it.

export const TERMS_H = {
  reflectioncoefficient: {
    name: 'Reflection coefficient',
    def:
      'The reflected field over the incident field at a boundary, written Γ. It is the difference of the two ' +
      'impedances over their sum, so it is zero when they match and negative when the second is the smaller. ' +
      'Its magnitude squared is the fraction of the power that comes back.',
  },
  transmission: {
    name: 'Transmission coefficient',
    def:
      'The transmitted field over the incident field, written τ, and equal to one plus Γ. It can be larger than ' +
      'one without breaking anything, because the transmitted wave sits in a medium of different impedance and ' +
      'carries less power for the same field.',
  },
  matching: {
    name: 'Matching the fields',
    def:
      'The rules the fields obey where two media meet. The tangential E is the same on both sides, and so is the ' +
      'tangential H where no surface current flows. One incident wave cannot satisfy them alone, which is why a ' +
      'reflected wave and a transmitted wave exist at all.',
  },
  standingwave: {
    name: 'Standing wave',
    def:
      'The pattern an incident wave and its reflection make together. The two run opposite ways, so their sum ' +
      'has fixed places where they add and fixed places where they oppose. The pattern repeats every half ' +
      'wavelength, and it stands still while both waves keep moving.',
  },
  swr: {
    name: 'Standing-wave ratio',
    def:
      'The largest field in the pattern over the smallest, which is one plus the size of Γ over one minus it. A ' +
      'matched boundary gives 1 and a total reflection gives infinity. It is measurable without separating the ' +
      'two waves, which is why it was the first thing anyone could measure on a line.',
  },
  slottedline: {
    name: 'Reading a minimum',
    def:
      'The size of the standing-wave ratio gives the size of Γ, and the position of the first minimum gives its ' +
      'phase. The two together fix the reflection completely. A minimum sitting on the boundary means Γ is ' +
      'negative, and one a quarter wavelength away means it is positive.',
  },
  obliqueincidence: {
    name: 'Oblique incidence',
    def:
      'A wave meeting a boundary at an angle rather than straight on. The boundary conditions apply to the ' +
      'components along the surface, so the answer depends on which way E points. The two cases are named for ' +
      'whether E is perpendicular to the plane of incidence or in it.',
  },
  brewster: {
    name: 'Brewster angle',
    def:
      'The angle where a wave with E in the plane of incidence reflects nothing. There the reflected and ' +
      'transmitted directions are at right angles, and the reflected wave would have to radiate along the axis ' +
      'of a dipole, which no dipole does. Light reflected off water near it is polarised.',
  },
  criticalangle: {
    name: 'Critical angle',
    def:
      'Going into a medium of lower refractive index, the angle where the transmitted direction reaches 90 ' +
      'degrees. Past it there is no transmitted angle at all and the reflection has magnitude one. It is what ' +
      'holds light inside an optical fibre.',
  },
  evanescent: {
    name: 'Evanescent wave',
    def:
      'What is left on the far side past the critical angle. It clings to the surface and falls off with depth ' +
      'instead of travelling, and it carries no power away. Its cosine is imaginary, which is the arithmetic ' +
      'saying the same thing.',
  },
}

export const MATCH_H = {
  reflectioncoefficient: /\breflection coefficient\b|\bcomes back\b/i,
  transmission: /\bgoes through\b|\btransmission coefficient\b/i,
  matching: /\btangential\b/i,
  standingwave: /\bstanding wave\b|\bwaves drawn together\b|\bdrawn together\b/i,
  swr: /\ba ratio of\b|\bstanding-wave ratio\b/i,
  slottedline: /\bfirst minimum\b/i,
  obliqueincidence: /\bplane of incidence\b|\bat an angle\b/i,
  brewster: /\bBrewster\b/i,
  criticalangle: /\bcritical angle\b/i,
  evanescent: /\bnothing is transmitted\b|\bevanescent\b/i,
}
