export default {
  F1: {
    see: [
      'White noise into a filter comes out shaped like the filter.',
      'The output density is the input density times the magnitude squared.',
      'The measured curve and the predicted one lie on each other.',
      'The area under both is 0.0317 for a 500 Hz corner.',
    ].join(' '),
    try: [
      { say: 'Raise the corner to 4000 Hz. The area grows roughly eightfold.', set: { fc: 4000 } },
      { say: 'Lower it to 200 Hz. The area shrinks and the curve steepens sooner.', set: { fc: 200 } },
      { say: 'Compare the measured area against the predicted one in the corner.', set: {} },
    ],
    why: [
      'For a linear filter and a stationary input this relation is exact, and the panel states it with no hedge.',
      'It is the reason a noise problem can be solved in one place.',
      'Find the density at the source, find the magnitude to the output, and integrate the product.',
      'Nothing about the phase of the filter enters, because a density carries no phase.',
      'The measured curve here is an estimate and carries its ribbon, and the predicted curve is a formula and does not.',
      'Comparing them is the whole experiment, and it is why the two are drawn differently.',
    ].join(' '),
  },

  F2: {
    see: [
      'A filter passes noise over a width, not up to its corner.',
      'For an analogue single pole that width is (π/2) f_c, 57 % wider than the corner.',
      'At 2 kHz that is 3141.6 Hz.',
      'This sampled filter passes 2792.1 Hz, which is 11 % less.',
    ].join(' '),
    try: [
      { say: 'Lower the corner to 500 Hz. The ratio between the two rises to 0.969.', set: { fc: 500 } },
      { say: 'Lower it to 150 Hz. The ratio reaches 0.990, and the formulas agree.', set: { fc: 150 } },
      { say: 'Raise it to 8000 Hz. The ratio falls, and the panel warns.', set: { fc: 8000 } },
    ],
    why: [
      'The noise bandwidth is the width of the brick wall that would pass the same power.',
      'It is wider than the corner because a first-order roll-off keeps passing power above it.',
      'The (π/2) figure is exact for the analogue filter and is an approximation to the sampled one.',
      'The sampled filter has a null at Nyquist and the analogue one does not, so it passes less.',
      'The panel prints the ratio for that reason, and the ratio is the guard on quoting the analogue number.',
      'Below a corner of about one three-hundredth of the sample rate the two agree within 1 %.',
    ].join(' '),
  },

  F3: {
    see: [
      'A resistor charging a capacitor leaves a noise voltage on it.',
      'At 1 nF and 300 K that voltage is 2.035 µV rms.',
      'It does not depend on the resistance at all.',
      'Raising R from 1 kΩ to 1 MΩ leaves the same 2.035 µV.',
    ].join(' '),
    try: [
      { say: 'Set R to 1 MΩ. The density rises 31.6-fold and the corner drops 1000-fold.', set: { R: 1e6 } },
      { say: 'Set C to 1 pF. The rms rises to 64.358 µV, since it goes as one over the root of C.', set: { C: 1e-12 } },
      { say: 'Set the temperature to 75 K. The rms halves.', set: { T: 75 } },
    ],
    why: [
      'The resistor supplies a density of the root of 4kTR, so raising R raises it as the root of R.',
      'The same resistor sets the corner at one over 2πRC, so raising R narrows the noise bandwidth as one over R.',
      'The mean square is the density squared times the bandwidth, and the two dependencies cancel exactly.',
      'What is left is kT/C.',
      'The result sets a floor on any sampled circuit, because the capacitor that holds a sample also holds this.',
      'A picofarad holds 64 µV, which is why a sample-and-hold capacitor cannot be made arbitrarily small.',
    ].join(' '),
  },

  F4: {
    see: [
      'The same filter, seen in time rather than in frequency.',
      'Before it, the signal correlates with nothing but itself.',
      'After it, the correlation reaches over the time constant.',
      'The runs of the ensemble wander together instead of independently.',
    ].join(' '),
    try: [
      { say: 'Lower the corner to 100 Hz. The runs wander more slowly and further.', set: { fc: 100 } },
      { say: 'Raise it to 8000 Hz. The runs look like the white source again.', set: { fc: 8000 } },
      { say: 'Switch to the ensemble view and watch the spread against time.', set: {} },
    ],
    why: [
      'The filter is the only source of memory here.',
      'Its output at one instant is a weighted sum of recent inputs, so two nearby outputs share most of their inputs and are correlated.',
      'How far that reaches is the filter time constant and nothing about the noise.',
      'The frequency view says the same thing.',
      'A narrower filter gives a narrower density and a wider correlation, which is the usual reciprocal relation between the two domains.',
      'The two panels are one object, as D2 established.',
    ].join(' '),
  },
}
