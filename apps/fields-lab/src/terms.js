// Definitions, delivered where the term first does work. Each experiment lists
// the terms its notes lean on, and the sidebar offers them under the note.
//
// House rules: three or four sentences, the first saying what the thing IS and
// the rest why it matters here, concrete numbers over abstraction, and no term
// defined using an undefined term. terms.test.js checks the last of those by
// walking the experiments in order.

export const TERMS = {
  charge: {
    name: 'Charge',
    def:
      'The source of every electric field, measured in coulombs. One coulomb is about 6.24 × 10¹⁸ electrons. A ' +
      'nanocoulomb, the unit this lab works in, is about 6.24 billion of them.',
  },
  coulomb: {
    name: 'Coulomb’s law',
    def:
      'The force between two point charges, q₁q₂ over 4πε₀r². It falls as the square of the distance, so two ' +
      'charges twice as far apart feel a quarter of the force. The sign of the product says whether they push or ' +
      'pull.',
  },
  field: {
    name: 'Electric field',
    def:
      'The force a unit of positive charge would feel at a point, in volts per metre. It is a property of the ' +
      'space, present whether or not a charge is there to feel it. Its direction is the direction that force ' +
      'points.',
  },
  permittivity: {
    name: 'Permittivity',
    def:
      'How much charge a material lets you store for a given field, in farads per metre. Vacuum has ε₀ = 8.854 × ' +
      '10⁻¹² F/m. A material is quoted by its relative permittivity, which multiplies that. Polyethylene is 2.25 ' +
      'and glass epoxy 3.9.',
  },
  superposition: {
    name: 'Superposition',
    def:
      'The field of several charges is the vector sum of the field each would make alone. No charge changes what ' +
      'another one does. It holds because Maxwell’s equations are linear in the sources, and it is what lets a ' +
      'wire be drawn as many short pieces and added.',
  },
  dipole: {
    name: 'Dipole',
    def:
      'Two equal and opposite charges a short distance apart. Far away its field falls as one over r³, faster than ' +
      'a single charge, because the two contributions nearly cancel. Between them the two contributions add.',
  },
  gauss: {
    name: 'Gauss’s law',
    def:
      'The flux of E out of any closed surface equals the charge inside divided by ε₀. The shape of the surface ' +
      'does not enter it. A charge outside contributes nothing, because its flux enters one side and leaves the ' +
      'other.',
  },
  flux: {
    name: 'Flux',
    def:
      'The field crossing a surface, counted as the field times the area and reckoned positive outward. For an ' +
      'electric field it is measured in volt metres, and dividing it by ε₀ gives the charge it came from.',
  },
  linecharge: {
    name: 'Line charge',
    def:
      'Charge spread along a line, in coulombs per metre. Gauss’s law on a cylinder gives its field as λ over ' +
      '2πε₀r, which falls as one over r rather than as one over r squared.',
  },
  sheetcharge: {
    name: 'Sheet charge',
    def:
      'Charge spread over a plane, in coulombs per square metre. Its field is σ over 2ε₀ and it is the same at ' +
      'every distance, because the area of the Gaussian box does not grow with distance.',
  },
  potential: {
    name: 'Potential',
    def:
      'The work per unit charge to bring a charge from infinity to a point, in volts. It is a scalar, one number ' +
      'at each point, which makes it far easier to compute than the field. The field is minus its gradient.',
  },
  equipotential: {
    name: 'Equipotential',
    def:
      'A curve or a surface on which the potential does not change. A conductor at rest is one, since any field ' +
      'along it would move charge. Equipotentials cross field lines at right angles everywhere.',
  },
  fieldline: {
    name: 'Field line',
    def:
      'A curve drawn everywhere along the local field direction. Lines start on positive charge and end on ' +
      'negative charge, and their crowding shows where the field is strong. They cross equipotentials at right ' +
      'angles.',
  },
  capacitance: {
    name: 'Capacitance',
    def:
      'Charge stored per volt applied, in farads. It is set by geometry and by permittivity, and by nothing else. ' +
      'A picofarad is a working unit here: two plates of 100 mm² a millimetre apart hold 0.885 pF in air.',
  },
  uniformfield: {
    name: 'Uniform field',
    def:
      'A field of the same size and direction everywhere. The gap of a parallel plate is the only place in this ' +
      'lab where one appears, and it is why that geometry has the simplest formula of the four.',
  },
  coaxial: {
    name: 'Coaxial geometry',
    def:
      'An inner conductor of radius a inside a shield of inner radius b. Its field falls as one over r between ' +
      'them, so the field is largest at the inner conductor. Every capacitance, inductance and resistance it has ' +
      'carries the logarithm of b over a.',
  },
  breakdown: {
    name: 'Breakdown field',
    def:
      'The field at which a dielectric stops insulating and conducts. Air breaks down near 3 MV/m and ' +
      'polyethylene near 20 MV/m. What matters is the PEAK field in the geometry, not the average one.',
  },
  isolatedsphere: {
    name: 'Isolated sphere',
    def:
      'A conductor with no second conductor nearby. It still has a capacitance, 4πεa, because its second ' +
      'conductor is everything else in the universe. A 50 mm sphere holds 5.56 pF that way.',
  },
  images: {
    name: 'Method of images',
    def:
      'Replacing a conductor by a charge placed where the conductor was, chosen so the boundary condition still ' +
      'holds. Two charged round wires are exactly two line charges offset towards each other, which is what makes ' +
      'the two-wire formula exact at any spacing.',
  },
  twowire: {
    name: 'Two-wire line',
    def:
      'Two parallel round conductors carrying opposite charge. Its capacitance is πε over arccosh(d/2a). The ' +
      'familiar πε over ln(d/a) is that formula’s wide-spacing limit, and it is about a fifth of a per cent out at ' +
      'six millimetres of spacing.',
  },
  energy: {
    name: 'Stored energy',
    def:
      'The work done to charge a capacitor, CV²/2 in joules. Integrating εE²/2 over the whole volume gives the ' +
      'same number, and the second form says where the energy is. It is in the field.',
  },
  energydensity: {
    name: 'Energy density',
    def:
      'The energy per cubic metre in an electric field, εE²/2 in joules per cubic metre. It is largest where the ' +
      'field is largest, so a coaxial cable stores most of its energy next to the inner conductor.',
  },
  laplace: {
    name: 'Laplace’s equation',
    def:
      'The equation the potential obeys wherever no charge sits, ∇²V = 0. Its solutions have no local peaks, and ' +
      'the value at a point is the average of the values around it. That averaging property is what relaxation ' +
      'uses.',
  },
  relaxation: {
    name: 'Relaxation',
    def:
      'Solving Laplace’s equation by sweeping the grid and replacing each free node with the average of its four ' +
      'neighbours, over and over, until nothing moves. This lab over-relaxes, which takes the step a little ' +
      'further than the average and converges faster.',
  },
  boundarycondition: {
    name: 'Boundary condition',
    def:
      'What the potential is doing at the edge of the region. A conductor fixes it, which is a Dirichlet ' +
      'condition. A plane of symmetry lets no flux through, which is a Neumann condition and lets a quarter of a ' +
      'symmetric geometry be solved instead of all of it.',
  },
  meanvalue: {
    name: 'Mean-value property',
    def:
      'A solution of Laplace’s equation equals the average of its values on any circle drawn about the point. It ' +
      'is why the centre of a square trough with one side raised reads exactly a quarter of that side, at every ' +
      'mesh.',
  },
  convergence: {
    name: 'Convergence',
    def:
      'How fast the answer approaches its true value as the mesh is refined. Second order means halving the cell ' +
      'size quarters the error. The observed order is read off three refinements, and it is measured rather than ' +
      'assumed.',
  },
  meshguard: {
    name: 'Mesh guard',
    def:
      'The change in the answer between two mesh refinements, measured against a threshold. It is the warrant a ' +
      'grid answer carries. A residual is not a substitute, because it says how well the discrete problem was ' +
      'solved and not how well that problem stands for the real one.',
  },
  richardson: {
    name: 'Richardson extrapolation',
    def:
      'Estimating the true value from three refinements by assuming the error falls as a fixed power of the cell ' +
      'size. It gives both an extrapolated answer and an error estimate. It is only reliable where the three ' +
      'levels are already converging cleanly.',
  },
  order: {
    name: 'Order of convergence',
    def:
      'The power of the cell size the error falls as. This scheme is second order where the boundary follows the ' +
      'mesh, so the observed order comes out near 2. A staircase boundary or a sharp corner drags it lower.',
  },
  staircase: {
    name: 'Staircase boundary',
    def:
      'A curved conductor drawn as a set of square cells, so its edge is a flight of steps. The steps do not shrink ' +
      'in proportion as the mesh is refined. That is why a circle on a square mesh converges at first order and ' +
      'not at second.',
  },
  safetyfactor: {
    name: 'Safety factor',
    def:
      'What the extrapolated error is multiplied by before anything is claimed. It is 1.25 where the boundary ' +
      'follows the mesh and the observed order is near two, and 3 where it does not. The result is the band the ' +
      'guard defends.',
  },
  corner: {
    name: 'Re-entrant corner',
    def:
      'A sharp inward corner of a conductor, where the field is singular. No mesh can follow a singularity, so the ' +
      'error picks up a term that falls more slowly than the cell size squared and the observed order drops below ' +
      'two.',
  },
  divergence: {
    name: 'Divergence theorem',
    def:
      'The flux out of a closed surface equals the integral of the divergence inside it. On a grid it becomes an ' +
      'exact identity between the flux across a block’s faces and the charges in its cells. That is why those two ' +
      'numbers agree to the solver’s residual.',
  },
  currentdensity: {
    name: 'Current density',
    def:
      'Current per unit area, in amperes per square metre. It is the local form of a current the way the field is ' +
      'the local form of a voltage. A copper bar of a square millimetre carrying 2.9 A holds 2.9 MA/m².',
  },
  conductivity: {
    name: 'Conductivity',
    def:
      'How readily a material carries current, in siemens per metre. Annealed copper is 5.8 × 10⁷ S/m. Its ' +
      'reciprocal is the resistivity, and one or the other appears in every formula in this group.',
  },
  ohmpoint: {
    name: 'Ohm’s law at a point',
    def:
      'J = σE, a statement about a material with no geometry in it. Multiply the field by a length and the current ' +
      'density by an area, and V = IR falls out with the geometry attached.',
  },
  resistivity: {
    name: 'Resistivity',
    def:
      'The reciprocal of conductivity, in ohm metres. Copper is 1.72 × 10⁻⁸ Ω·m and silicon steel about 4.7 × ' +
      '10⁻⁷ Ω·m. A bar’s resistance is its resistivity times its length over its area.',
  },
  leakage: {
    name: 'Leakage',
    def:
      'The small current a real dielectric passes between two conductors. Its resistance follows from the ' +
      'capacitance formula with ε replaced by σ, because the two problems obey the same equation with the same ' +
      'boundaries.',
  },
  relaxationtime: {
    name: 'Relaxation time',
    def:
      'ε over σ, in seconds. It is the product of a geometry’s resistance and its capacitance, and the geometry ' +
      'cancels out of it. Charge placed inside a material spreads to the surface with that time constant.',
  },
  fourpoint: {
    name: 'Four-point probe',
    def:
      'Four contacts in a line, with current forced through the outer pair and voltage sensed across the inner ' +
      'pair. The sensing pair draws no current, so its own contact resistance does not enter the reading.',
  },
  sheetresistance: {
    name: 'Sheet resistance',
    def:
      'The resistance of a square of thin film, in ohms per square, and it is the same for any size of square. A ' +
      'strip’s resistance is its sheet resistance times its length over its width, which is its count of squares.',
  },
  spreading: {
    name: 'Spreading resistance',
    def:
      'The resistance a small contact sees because the current has to fan out from it. For a contact of radius a ' +
      'on a large block it is ρ over 4a, which is finite even for a very small contact.',
  },
  biotsavart: {
    name: 'Biot-Savart law',
    def:
      'Each short piece of current makes a field falling as one over the square of the distance. It points at ' +
      'right angles to both the piece and the line to the field point. A whole wire is the sum of its pieces, and ' +
      'one straight piece has a closed form.',
  },
  fluxdensity: {
    name: 'Magnetic flux density',
    def:
      'The magnetic field B, in tesla. A tesla is a large unit. The earth’s field is about 50 µT, a 50 mm loop ' +
      'carrying 3 A gives 37.7 µT at its centre, and a transformer core runs near 1.2 T.',
  },
  permeability: {
    name: 'Permeability',
    def:
      'How readily a material carries magnetic flux, in henries per metre. Vacuum has µ₀ = 1.2566 × 10⁻⁶ H/m. A ' +
      'transformer core is quoted by its relative permeability, which multiplies that, and 2000 is a typical ' +
      'figure.',
  },
  ampere: {
    name: 'Ampère’s law',
    def:
      'The line integral of B round any closed loop is µ₀ times the current threading it. It is the magnetic twin ' +
      'of Gauss’s law. A wider loop sees a weaker field over a longer path, and the product does not change.',
  },
  lineintegral: {
    name: 'Line integral',
    def:
      'The field summed along a path, counting only the part of it that lies along the path. A field at right ' +
      'angles to the path contributes nothing. Ampère’s law is a line integral round a closed path.',
  },
  enclosedcurrent: {
    name: 'Enclosed current',
    def:
      'The net current passing through a surface bounded by the contour. Two wires the same way add, two opposite ' +
      'ways cancel, and a wire outside the contour contributes nothing.',
  },
  longwire: {
    name: 'Long straight wire',
    def:
      'The simplest magnetic geometry. Ampère on a circle gives B = µ₀I over 2πr, so the field circles the wire ' +
      'and falls as one over r. Ten amperes gives 100 µT at 20 mm.',
  },
  solenoid: {
    name: 'Solenoid',
    def:
      'A coil wound as a cylinder. A long one has B = µnI inside and nothing outside, where n is turns per metre. ' +
      'A real one falls short of that, and the shortfall is set by the angles the two ends subtend.',
  },
  turnsdensity: {
    name: 'Turns per metre',
    def:
      'The number of turns divided by the winding length, written n. A long solenoid’s field depends on that ' +
      'ratio and not on the two numbers separately, so 400 turns over 200 mm and 100 over 50 mm give the same ' +
      'field.',
  },
  endeffect: {
    name: 'End effect',
    def:
      'The fall in a solenoid’s field near its ends, where flux escapes sideways. At the end of a long coil the ' +
      'axial field is half its middle value. The app reports the field as a fraction of the infinite-solenoid ' +
      'value.',
  },
  inductance: {
    name: 'Inductance',
    def:
      'Flux linkage per ampere, in henries. It is set by geometry and permeability, and by nothing else, in the ' +
      'same way capacitance is set by geometry and permittivity. RG-58 has 237 nH/m.',
  },
  internalinductance: {
    name: 'Internal inductance',
    def:
      'The part of an inductance from flux inside a conductor, which links only part of the current. For a solid ' +
      'round wire it is µ₀ over 8π, which is 50 nH/m whatever the radius. At high frequency the current leaves the ' +
      'interior and that term goes with it.',
  },
  reluctance: {
    name: 'Reluctance',
    def:
      'The magnetic circuit’s resistance, l over µA, in reciprocal henries. Reluctances in series add exactly as ' +
      'resistances do. Air has a reluctance 2000 times a typical core’s, so a small gap dominates the circuit.',
  },
  mmf: {
    name: 'Magnetomotive force',
    def:
      'Turns times current, NI, in ampere-turns. It stands for voltage in the magnetic circuit, with flux standing ' +
      'for current and reluctance for resistance. Flux is the magnetomotive force over the total reluctance.',
  },
  airgap: {
    name: 'Air gap',
    def:
      'A deliberate break in a magnetic core. It raises the reluctance, lowers the inductance and lets the core ' +
      'take more current before it saturates. A millimetre of air in a 200 mm path of relative permeability 2000 ' +
      'takes 91 per cent of the drive.',
  },
  fringing: {
    name: 'Fringing',
    def:
      'The spreading of flux into the air beside a gap, which lowers the gap’s reluctance below the simple figure. ' +
      'It matters once the gap is a large fraction of the core’s width, and the app reports that ratio against a ' +
      'threshold of a tenth.',
  },
  mutualinductance: {
    name: 'Mutual inductance',
    def:
      'The flux one winding links in another, per ampere, in henries. On a shared core it is the product of the ' +
      'two turns over the reluctance. With no leakage it satisfies M² = L₁L₂ exactly.',
  },
  coupling: {
    name: 'Coupling coefficient',
    def:
      'M over the square root of L₁L₂, between zero and one. It is one when every flux line links both windings ' +
      'and falls to one minus the leakage fraction when they do not. A power transformer reaches 0.99 and an ' +
      'air-cored pair much less.',
  },
  leakageflux: {
    name: 'Leakage flux',
    def:
      'Flux that links one winding and not the other. It appears in the equivalent circuit as a series inductance ' +
      'outside the ideal transformer, and a short-circuit test measures it directly.',
  },
  turnsratio: {
    name: 'Turns ratio',
    def:
      'The ratio of the two winding turns. In an ideal transformer it is also the voltage ratio, and its ' +
      'reciprocal is the current ratio. The impedance seen through the transformer is scaled by its square.',
  },
  faraday: {
    name: 'Faraday’s law',
    def:
      'The emf round a loop is minus the rate of change of the flux through it. A steady flux induces nothing. ' +
      'For a sinusoidal flux the rate of change brings down a factor of ω, so the emf grows with frequency.',
  },
  emf: {
    name: 'Electromotive force',
    def:
      'The voltage a changing flux or a moving conductor drives round a loop, in volts. It is not a force. The ' +
      'name is older than the units.',
  },
  rms: {
    name: 'Root mean square',
    def:
      'The steady value that would dissipate the same power as the varying one. For a sinusoid it is the peak over ' +
      'the square root of two. The 4.443 in the transformer equation is 2π divided by that square root.',
  },
  motionalemf: {
    name: 'Motional emf',
    def:
      'The voltage along a conductor moving across a magnetic field, Blv when the three are mutually ' +
      'perpendicular. A conductor sliding along the field lines generates nothing, because only the part of the ' +
      'motion across the field counts.',
  },
  lorentz: {
    name: 'Lorentz force',
    def:
      'The force qv × B on a charge moving through a magnetic field. It is what pushes charge along a moving ' +
      'conductor until the electric field it builds balances it, which is where motional emf comes from.',
  },
  eddycurrent: {
    name: 'Eddy current',
    def:
      'Current driven in a loop of conducting material by a changing flux through it. A solid core is nothing but ' +
      'such loops, and the power they waste grows as the square of the loop size, the frequency and the flux ' +
      'density.',
  },
  lamination: {
    name: 'Lamination',
    def:
      'One insulated sheet of a core built from many. Halving the sheet thickness quarters the eddy-current loss, ' +
      'because the loss follows the square of the thickness. A 50 Hz core uses sheets around 0.35 mm.',
  },
  losses: {
    name: 'Core loss',
    def:
      'The power a magnetic core turns into heat, split between eddy currents and hysteresis. This lab computes ' +
      'the eddy part, which follows f² and d², and leaves hysteresis to the Machines Lab.',
  },
  skindepth: {
    name: 'Skin depth',
    def:
      'The depth at which the current in a conductor has fallen to 1/e of its surface value, one over the square ' +
      'root of πfµσ. Copper is 9.35 mm deep at 50 Hz and 66 µm at 1 MHz.',
  },
  surfaceimpedance: {
    name: 'Surface impedance',
    def:
      'The impedance a plane conductor presents to a wave entering it, (1 + j) over σδ, in ohms per square. Its ' +
      'resistance and its reactance are equal at every frequency, so its angle is always 45 degrees.',
  },
  acresistance: {
    name: 'Alternating-current resistance',
    def:
      'A conductor’s resistance at a frequency, above its direct-current value because the current has crowded ' +
      'towards the surface. A 1 mm copper wire carries 7.8 times its direct-current resistance at 1 MHz.',
  },
  crowding: {
    name: 'Current crowding',
    def:
      'The pushing of current towards a conductor’s surface by the eddy currents its own changing field drives. ' +
      'Once the radius is several skin depths the wire behaves as a tube one skin depth thick.',
  },
}

/** The word or phrase in a note that a term is offered under. */
export const MATCH = {
  charge: /\bcharges?\b/i,
  coulomb: /Coulomb’s law/i,
  field: /\bfields?\b/i,
  permittivity: /\bdielectric\b|\bpermittivit/i,
  superposition: /\bsuperpos/i,
  dipole: /\bdipole\b/i,
  gauss: /Gauss’s law/i,
  flux: /\bflux\b/i,
  linecharge: /\bline of charge\b|\bline charge\b/i,
  sheetcharge: /\bsheet\b/i,
  potential: /\bpotential\b/i,
  equipotential: /\bequipotential/i,
  fieldline: /\bfield lines?\b/i,
  capacitance: /\bcapacitance\b/i,
  uniformfield: /\buniform\b/i,
  coaxial: /\bcoaxial\b/i,
  breakdown: /\bbreaks? down\b|\bbreakdown\b/i,
  isolatedsphere: /\bisolated sphere\b/i,
  images: /\bimage\b|\bimages\b/i,
  twowire: /\btwo-wire\b|\btwo wires\b/i,
  energy: /\benergy\b/i,
  energydensity: /\benergy density\b/i,
  laplace: /Laplace’s equation/i,
  relaxation: /\brelaxation\b|\brelaxes\b/i,
  boundarycondition: /\bboundary condition/i,
  meanvalue: /\baverage of\b/i,
  convergence: /\bconverg/i,
  meshguard: /\bguard\b/i,
  richardson: /\bextrapolat/i,
  order: /\border\b/i,
  staircase: /\bstaircase\b|\bsteps across\b/i,
  safetyfactor: /\bsafety factor\b/i,
  corner: /\bcorner/i,
  divergence: /\bdivergence theorem\b/i,
  currentdensity: /\bcurrent density\b/i,
  conductivity: /\bconductivit/i,
  ohmpoint: /\bOhm(’s law)? at a point\b|\bpoint form\b/i,
  resistivity: /\bresistivit/i,
  leakage: /\bleak/i,
  relaxationtime: /\brelaxation time\b/i,
  fourpoint: /\bfour-point probe\b|\bfour probes\b/i,
  sheetresistance: /\bsheet resistance\b|\bper square\b/i,
  spreading: /\bspreading\b/i,
  biotsavart: /Biot-Savart/i,
  fluxdensity: /\bflux density\b/i,
  permeability: /\bpermeabilit/i,
  ampere: /Ampère’s law/i,
  lineintegral: /\bline integral\b|\bIntegrate that\b/i,
  enclosedcurrent: /\bencloses?\b|\benclosed\b/i,
  longwire: /\blong straight wire\b/i,
  solenoid: /\bsolenoid\b/i,
  turnsdensity: /\bturns per metre\b/i,
  endeffect: /\bend of the winding\b|\bends\b/i,
  inductance: /\binductance\b/i,
  internalinductance: /\binternal\b/i,
  reluctance: /\breluctance/i,
  mmf: /\bmagnetomotive force\b/i,
  airgap: /\bair gap\b/i,
  fringing: /\bfringing\b/i,
  mutualinductance: /\bmutual inductance\b|\bmutual\b/i,
  coupling: /\bcoupling\b/i,
  leakageflux: /\bleakage\b/i,
  turnsratio: /\bturns ratio\b/i,
  faraday: /Faraday’s law/i,
  emf: /\bemf\b/i,
  rms: /\broot mean square\b/i,
  motionalemf: /\bmoving at\b|\bmotional\b/i,
  lorentz: /\bqv × B\b|\bLorentz\b/i,
  eddycurrent: /\beddy currents?\b/i,
  lamination: /\blamination\b/i,
  losses: /\bloses?\b|\bloss\b/i,
  skindepth: /\bskin depth\b/i,
  surfaceimpedance: /\bsurface impedance\b/i,
  acresistance: /\bdirect-current value\b/i,
  crowding: /\bcrowded\b|\bcrowding\b/i,
}

/** The definitions an experiment's `terms` list names, in that order, for the sidebar's fold. */
export const termsFor = (ids = []) => ids.map((id) => ({ id, ...TERMS[id] })).filter((t) => t.name)
