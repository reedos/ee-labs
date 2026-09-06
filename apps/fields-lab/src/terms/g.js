// The terms group G introduces, and the patterns that recognise them in prose.
//
// This is the group where the first half's four laws become one set, so the
// definitions here name the term that ties them together and the three
// properties of the wave that follows from it.

export const TERMS_G = {
  displacement: {
    name: 'Displacement current',
    def:
      'A changing electric field counted as a current, ε dE/dt times the area it crosses. It carries no charge ' +
      'and needs no conductor. Between the plates of a charging capacitor it equals the conduction current in ' +
      'the wire exactly, so a circuit closes through a gap.',
  },
  maxwell: {
    name: 'Maxwell’s equations',
    def:
      'The four laws this lab has built one at a time, taken together. Gauss for E, Gauss for B, Faraday, and ' +
      'Ampère with the displacement current added. The first half of the lab is each of them alone, and the ' +
      'second half is what they say when they are read as one set.',
  },
  chargeconservation: {
    name: 'Charge conservation',
    def:
      'Charge is neither made nor destroyed, so the current out of any closed surface equals the rate the charge ' +
      'inside it falls. Ampère’s law without the displacement current contradicts this at a charging capacitor. ' +
      'That contradiction is what the extra term was written to remove.',
  },
  planewave: {
    name: 'Plane wave',
    def:
      'A wave whose fields are the same everywhere on any plane across its direction of travel. E and H sit at ' +
      'right angles to that direction and to each other. It is the simplest solution of the full set of ' +
      'equations, and far from any source every wave looks like one.',
  },
  intrinsicimpedance: {
    name: 'Intrinsic impedance',
    def:
      'The ratio of E to H in a wave, in ohms, written η. It is the square root of µ over ε, so it belongs to ' +
      'the medium and not to the wave. Vacuum has 376.7 Ω, and a dielectric of relative permittivity 4 has half ' +
      'of that.',
  },
  wavelength: {
    name: 'Wavelength',
    def:
      'The distance a wave travels in one cycle, which is the speed over the frequency. In vacuum at 1 GHz it is ' +
      '299.8 mm. Inside a medium the speed falls and so does the wavelength, while the frequency is fixed by ' +
      'whatever made the wave.',
  },
  phasevelocity: {
    name: 'Phase velocity',
    def:
      'The speed a point of constant phase moves, ω over β. In a uniform lossless medium it is one over the ' +
      'square root of µε, and every frequency travels at it. Where it depends on frequency the parts of a pulse ' +
      'arrive at different times and the pulse spreads as it goes.',
  },
  losstangent: {
    name: 'Loss tangent',
    def:
      'The conduction current in a medium divided by the displacement current in it, σ over ωε. Far above one ' +
      'the medium acts as a conductor and far below it as a dielectric. It falls with frequency, so sea water ' +
      'conducts at 1 MHz and behaves as a dielectric in the microwave band.',
  },
  attenuation: {
    name: 'Attenuation constant',
    def:
      'How fast a wave’s amplitude falls as it travels, written α, in nepers a metre. One neper is a fall to ' +
      'about a third. A lossless medium has α exactly zero, and this lab computes it on the lossless branch ' +
      'rather than as a small number.',
  },
  penetration: {
    name: 'Penetration depth',
    def:
      'The distance a wave travels before its amplitude is down to about a third, which is one over the ' +
      'attenuation constant. Sea water at 1 MHz gives 25.18 cm. It is the same quantity as F4’s skin depth, ' +
      'reached from the wave rather than from the conductor.',
  },
  goodconductor: {
    name: 'Good conductor',
    def:
      'A medium whose loss tangent is far above one, so the conduction current is nearly all of the current. Its ' +
      'intrinsic impedance leans towards 45 degrees and its attenuation equals its phase constant. The label is ' +
      'about the material and the frequency together, never about the material alone.',
  },
  polarisation: {
    name: 'Polarisation',
    def:
      'The path the tip of the electric field vector traces over one cycle, seen looking along the direction of ' +
      'travel. It is a line, a circle or an ellipse, and which one depends on the phase between the two ' +
      'transverse components. It belongs to the wave, so it survives the whole journey.',
  },
  axialratio: {
    name: 'Axial ratio',
    def:
      'The long axis of the polarisation ellipse over the short one, quoted in decibels. A circle is 0 dB and a ' +
      'line is infinite. A receiver built for one sense of circular loses the axial ratio of a wave of the ' +
      'other, which is why the figure is worth a number.',
  },
  circularpolarisation: {
    name: 'Circular polarisation',
    def:
      'Two equal transverse components a quarter cycle apart, so the tip traces a circle. A wave is circularly ' +
      'polarised left hand or right hand depending on the sign of that quarter cycle. A link between one hand ' +
      'and the other carries almost nothing, so both ends have to agree.',
  },
}

export const MATCH_G = {
  displacement: /\bdisplacement current\b/i,
  maxwell: /Maxwell’s\b|\bthe four equations\b/i,
  chargeconservation: /\bcharge conservation\b|\bconservation\b/i,
  planewave: /\bplane wave\b/i,
  intrinsicimpedance: /\bintrinsic impedance\b/i,
  wavelength: /\bwavelength\b/i,
  phasevelocity: /\bspeed of light\b|\bphase velocity\b/i,
  losstangent: /\bloss tangent\b/i,
  attenuation: /\bnepers?\b|\battenuation\b/i,
  penetration: /\bpenetrat/i,
  goodconductor: /\bgood conductor\b/i,
  polarisation: /\bpolarisation\b/i,
  axialratio: /\baxial ratio\b/i,
  circularpolarisation: /\bcircularly polarised\b|\bcircular polarisation\b/i,
}
