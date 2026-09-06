// Group E's three registers.
//
// `see` names the quantity on screen. `try` is one instruction, verb first, with
// the reading it produces. `why` is the folded explanation, which may define a
// term and carries numbers rather than abstractions. The budgets are STYLE.md's
// and prose.test.js measures every one of them.

export const LESSONS = {
  e1: {
    see:
      'The section runs with its five coefficients on a twelve-bit grid, two bits above the binary ' +
      'point. The step is 1.95e-3 and the range runs from -4 to 4 minus one step. Every coefficient ' +
      'the block stores is an exact multiple of that step.',
    try: 'Set the coefficient bits to 16. The step falls to 1.22e-4 and the range does not move, because the bits above the point set the range and the rest set the step.',
    why:
      'A processor holds a number in a fixed count of bits, split at the binary point. Two bits ' +
      'above it give a range from -4 to 4, and the nine below it divide that range into steps of ' +
      '2^-9, which is 1.95e-3. The last bit carries the sign. Nothing between two steps can be ' +
      'stored, so every coefficient is rounded to the nearest one and the error is at most half a ' +
      'step. Adding bits below the point makes the step smaller and leaves the range where it was. ' +
      'Adding bits above the point does the opposite. What the number has to hold decides the ' +
      'split. A coefficient of -1.986 needs two bits above the point, and a signal that stays ' +
      'between -1 and 1 needs one.',
  },
  e2: {
    see:
      'The same section at twelve bits, with its poles on the z-plane. The exact pair sits at a ' +
      'pole radius of 0.996085 and the quantised pair sits 1.82e-3 away from it. The readout prints ' +
      'the radius, the distance, and whether the section still settles.',
    try: 'Set the coefficient bits to 8. The poles reach the unit circle, the radius reads 1.000000, and the section is no longer stable.',
    why:
      'Quantising the five coefficients gives a different filter, and it is exactly as rational as ' +
      'the one it came from. Its poles are the roots of the quantised denominator, so they are ' +
      'printed rather than estimated. At twenty bits the pair moves 3.04e-6, at sixteen 2.41e-4, ' +
      'at twelve 1.82e-3 and at ten 1.00e-2. Each of those is about one step of the grid the bits ' +
      'make, so removing bits moves the poles by as much as it coarsens the grid. The reference ' +
      'section has a pole radius of 0.996085, so the pair has 3.9e-3 of room before the unit ' +
      'circle. At eight bits one step is 3.13e-2, eight times that room, and the pair lands on the ' +
      'circle. The block then passes its input through, and its summary says why.',
  },
  e3: {
    see:
      'The pole grid at ten bits, with the exact pole and the quantised pole marked on it. Two ' +
      'boxes of the same size are counted. The one on the diagonal at 45 degrees holds 290 ' +
      'positions and the one against the real axis near z of 1 holds 28.',
    try: 'Set the coefficient bits to 12. Both counts rise by about sixteen and the ratio between them stays near ten, because the direct form sets the shape of the grid.',
    why:
      'A direct form stores a1 and a2, and the poles follow from those two numbers. The pair sits ' +
      'at a radius whose square is a2, and at an angle whose cosine is minus a1 over twice that ' +
      'radius. Both coefficients move in equal steps, and the positions they produce do not. Near ' +
      '45 degrees that mapping is flat and the positions crowd together. Near z of 1 it is steep ' +
      'and they spread out. At ten bits the diagonal box holds 290 positions and the box by the ' +
      'real axis holds 28, a ratio of 10.4. A low-frequency section at a high Q needs a pole in ' +
      'the second box, which is where the grid has least to offer. Other structures store other ' +
      'numbers and reach other positions, and this lab builds one structure.',
  },
  e4: {
    see:
      'An impulse into the section, with the state on a twelve-bit grid. In float64 the ring decays ' +
      'to 2.3e-7 by the end of the trace. Here it stops at 0.0791 and stays there. That level is 81 ' +
      'steps of the stored value.',
    try: 'Set the state bits to 16. The level falls to 4.94e-3 and the count stays at 81, because the coefficients set the count and the word length sets how large a step is.',
    why:
      'Rounding every stored value makes the recursion nonlinear, so the argument that a pole ' +
      'radius below one decays no longer reaches. The decay stops instead. Once the state is small ' +
      'enough, one pass round the loop rounds back to where it started, and the section repeats ' +
      'that state for as long as it runs. The state is four numbers on a grid, so there are ' +
      'finitely many of them, and a run with no input either reaches zero or repeats. This one ' +
      'repeats with a period of one, which is a fixed level. The range of levels it cannot decay ' +
      'out of is the dead band, and it is 81 steps at 10, 12, 14 and 16 bits. In float64 the same ' +
      'section decays to 2.3e-7 over the same trace.',
  },
  e5: {
    see:
      'The section is driven past what its state can hold. It asks for 2.530 and the largest value ' +
      'the twelve-bit state holds is 1.999. Saturating clamps that to 1.999 and wrapping turns it ' +
      'into -1.470. The line at 600 Hz reads 1.923 under the first rule.',
    try: 'Switch the overflow rule to wrap. The line at 600 Hz falls from 1.923 to 0.734 and the trace breaks up, because the wrong sign is fed back round the loop.',
    why:
      'The state here has one bit above the binary point, so it holds -2 to 1.999. A resonant ' +
      'section asks for much more than its input. This one has a peak gain of 9.4, so an input of ' +
      '0.25 asks for 2.53 and there is no room for it. Saturating clamps the value to the top of ' +
      'the range. The error is large and its sign is right, so what comes out is a distorted ' +
      'version of what was wanted, and the line at 600 Hz still reads 1.923. Wrapping keeps the low ' +
      'bits and discards the top one, so 2.53 reappears at -1.470. That value is fed back, and the ' +
      'line falls to 0.734. Headroom is bought either with bits above the point or by scaling the ' +
      'input down.',
  },
  e6: {
    see:
      'White noise into the section, with the state on a twelve-bit grid. One rounding has an rms ' +
      'of 2.82e-4. The recursion amplifies it by 10502, so the model predicts 2.89e-2 at the ' +
      'output. The measurement reads 3.02e-2, which is 1.05 times the prediction.',
    try: 'Load the three-code chip. The measurement falls to 1.43e-3 while the prediction stays where it was, so the ratio drops to 0.049 and the model is wrong by a factor of twenty.',
    why:
      'One rounding is an error of at most half a step. The white model treats the sequence of ' +
      'those errors as noise of power one step squared over twelve, which puts its rms at 2.82e-4 ' +
      'here. That error enters at the output node. From there only the feedback part shapes it, so ' +
      'the gain that applies is the sum of the squared impulse response of 1 over A(z). For this ' +
      'section that noise gain is 10502, an amplification of 40.2 dB, and the predicted output rms ' +
      'is 2.89e-2. The model needs the error to look random. Broadband noise moves across 512 ' +
      'values of the grid, and the measurement lands within 5 % of the prediction. A small tone ' +
      'that visits three values does not, and the measurement is a twentieth of the prediction. So ' +
      'the model ships with a guard on it.',
  },
}
