// Group D's three registers. Every number here was computed by
// scripts/pins.mjs before it was written, and experiments.test.js recomputes
// each one at the setting its step names.
//
// The densities are written in scientific notation, because a photon density
// of 4.9792 × 10²⁰ per cubic metre has no engineering prefix a reader would
// recognise. `experiments.test.js` reads that notation and checks the mantissa
// and the exponent together against the engine.

export const LESSONS_D = {
  d1: {
    see:
      'The pump delivers 1.6713 × 10³³ carriers a cubic metre a second. Recombination and stimulated emission ' +
      'take them all back, so the carrier sum is zero. The photon equation balances the same way, and the photon ' +
      'density sits at 4.9793 × 10²⁰ m⁻³.',
    seeReads: [
      ['carriers.0.value', 1.6713e33],
      ['s', 4.97932e20],
    ],
    try: [
      {
        say: 'Read the carrier equation. The pump adds 1.6713 × 10³³, recombination takes 8.3565 × 10³², and stimulated emission takes 8.3564 × 10³².',
        reads: [
          ['carriers.0.value', 1.6713e33],
          ['carriers.1.value', -8.35646e32],
          ['carriers.2.value', -8.35643e32],
        ],
      },
      {
        say: 'Read the photon equation. Stimulated emission adds 2.5069 × 10³², the cavity takes the same away, and the spontaneous term is zero at a coupling of zero.',
        reads: [
          ['photons.0.value', 2.50693e32],
          ['photons.2.value', 0],
        ],
      },
      {
        say: 'Set the drive current to 10 mA, which is under threshold. The carrier density falls to 1.2483 × 10²⁴ m⁻³ and the photon density is zero.',
        set: { current: 10e-3 },
        reads: [
          ['n', 1.2483e24],
          ['s', 0],
        ],
      },
    ],
    why:
      'The rate equations count two things. The first counts carriers in the active region. The pump puts them ' +
      'in at the current over the charge times the volume. Recombination takes them out at one over the carrier ' +
      'lifetime. Stimulated emission takes them out at the gain times the photon density. The second counts ' +
      'photons in the mode. Stimulated emission puts them in, the cavity takes them out at one over the photon ' +
      'lifetime, and a share of the spontaneous light lands in the mode. Every term is a rate of density, per ' +
      'cubic metre a second, so the terms of one equation can be read against each other. At a steady state both ' +
      'sums are zero. Nothing on this pane is integrated.',
  },

  d2: {
    see:
      'The threshold current is 13.389 mA, and it follows from the six parameters with nothing approximated. ' +
      'Above threshold the carrier density is clamped at 1.6713 × 10²⁴ m⁻³ and the photon density rises in a ' +
      'straight line. At 26.777 mA it is 4.9793 × 10²⁰ m⁻³.',
    seeReads: [
      ['ith', 13.389e-3],
      ['nth', 1.67129e24],
      ['s', 4.97932e20],
    ],
    try: [
      {
        say: 'Set the drive current to 40.166 mA. The photon density doubles to 9.9588 × 10²⁰ m⁻³, because it follows the current above threshold.',
        set: { current: 40.166e-3 },
        reads: [['s', 9.95883e20]],
      },
      {
        say: 'Set the confinement factor to 0.5. The threshold falls to 11.237 mA, because more of the mode sits where the gain is.',
        set: { gamma: 0.5 },
        reads: [['ith', 11.237e-3]],
      },
      {
        say: 'Set the transparency density to 2 × 10²⁴ m⁻³. The threshold rises to 21.399 mA, because the material has further to go before it amplifies.',
        set: { ntr: 2e24 },
        reads: [['ith', 21.399e-3]],
      },
    ],
    why:
      'Setting both derivatives to zero leaves algebra. The photon equation says the gain has to equal one over ' +
      'the photon lifetime. That fixes the threshold density at the transparency density plus one over the ' +
      'confinement factor times the differential gain times the photon lifetime. Here that is ' +
      '1.6713 × 10²⁴ m⁻³. The carrier equation then gives the current reaching it, which is the charge times the ' +
      'volume times that density over the carrier lifetime. That comes to 13.389 mA. Above threshold the ' +
      'density cannot rise, so the photon density follows the current above threshold. None of this is an ' +
      'approximation. The steady state is a root of one quadratic at any spontaneous coupling, so this pane ' +
      'states it with no hedge.',
    whyReads: [
      ['nth', 1.67129e24],
      ['ith', 13.389e-3],
    ],
  },

  d3: {
    see:
      'The relaxation frequency is 3.9844 GHz at 26.777 mA. The response peaks 23.141 dB above its ' +
      'low-frequency value, because the damping ratio is 0.034848. The modulation bandwidth is 6.1855 GHz. The ' +
      'two dashed lines mark the peak and the bandwidth.',
    seeReads: [
      ['sm.fr', 3.9844e9],
      ['sm.peakDb', 23.141],
      ['sm.zeta', 0.034848],
      ['sm.f3db', 6.1855e9],
    ],
    try: [
      {
        say: 'Set the drive current to 40.166 mA. The relaxation frequency rises to 5.6348 GHz, which is the square root of two times its value at twice threshold.',
        set: { current: 40.166e-3 },
        reads: [['sm.fr', 5.6348e9]],
      },
      {
        say: 'Set the drive current to 66.943 mA. The frequency rises to 7.9688 GHz and the peak falls to 19.230 dB, because the damping has grown faster.',
        set: { current: 66.943e-3 },
        reads: [
          ['sm.fr', 7.9688e9],
          ['sm.peakDb', 19.23],
        ],
      },
      {
        say: 'Read the textbook form beside the exact one. It gives 2.5252 GHz here, which is low by a factor of 1.5779.',
        reads: [
          ['sm.frText', 2.5252e9],
          ['textFactor', 1.5779],
        ],
      },
    ],
    why:
      'Perturbing the pair about its steady state gives a second-order response. Its natural frequency squared ' +
      'is the determinant of the Jacobian and its damping is the negative trace, and both are exact. The damping ' +
      'is one over the carrier lifetime plus the differential gain times the photon density, which is 1.7448 per ' +
      'nanosecond here. That leaves a damping ratio of 0.034848, so the response peaks hard. The familiar ' +
      'textbook form drops the transparency density, and it reads low by a factor of 1.5779 at this laser’s own ' +
      'parameters. Both forms are printed, because the difference is the lesson. The linearisation is an exact ' +
      'ratio of polynomials in s, so it crosses to the rest of the suite with no qualification attached to it.',
    whyReads: [
      ['dampingPerNs', 1.7448],
      ['sm.zeta', 0.034848],
      ['textFactor', 1.5779],
    ],
  },

  d4: {
    see:
      'The step raises the drive current by 5 per cent. The pair overshoots to 5.9497 × 10²⁰ m⁻³ and the linear ' +
      'prediction says 5.9235 × 10²⁰ m⁻³. The difference is 5.2638 per cent, which is inside what the pane draws ' +
      'without a flag.',
    seeReads: [
      ['guard.measured', 5.94973e20],
      ['guard.predicted', 5.92352e20],
      ['guard.error', 0.052638],
    ],
    try: [
      {
        say: 'Set the modulation depth to 0.3. The error grows to 26.760 per cent, and the dashed prediction is drawn as an estimate.',
        set: { depth: 0.3 },
        reads: [
          ['guard.error', 0.2676],
          ['guard.declined', false],
        ],
      },
      {
        say: 'Set the modulation depth to 0.6. The error climbs to 45.596 per cent, and the prediction is not drawn at all.',
        set: { depth: 0.6 },
        reads: [
          ['guard.error', 0.455964],
          ['guard.declined', true],
        ],
      },
      {
        say: 'Set the modulation depth to 0.01. The error falls to 1.0853 per cent, which is close to the depth itself.',
        set: { depth: 0.01 },
        reads: [['guard.error', 0.010853]],
      },
    ],
    why:
      'The linearisation describes small departures from one steady state. A step is not small, so the question ' +
      'is how large a step it still describes. The guard is a modulation depth, and the measured error grows ' +
      'with it. At a depth of 0.01 the error is already 1.0853 per cent. The pane draws the prediction plainly ' +
      'up to a depth of 0.05, as an estimate up to 0.3, and not at all past that. Both thresholds come from that ' +
      'measurement rather than from taste. The error is measured against the same pair integrated in time, and ' +
      'that integration is never shown as an answer on its own. A timestep solver’s error cannot be told apart ' +
      'from physics, which is the reason this suite gives everywhere it declines one.',
    whyAt: { depth: 0.01 },
    whyReads: [
      ['guard.error', 0.010853],
      ['guard.warn', 0.05],
      ['guard.decline', 0.3],
    ],
  },
}
