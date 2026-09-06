// Group C's three registers.
//
// `see` names the quantity on screen. `try` is one instruction, verb first, with
// the reading it produces. `why` is the folded explanation, which may define a
// term and carries numbers rather than abstractions. The budgets are STYLE.md's
// and prose.test.js measures every one of them.

export const LESSONS = {
  c1: {
    see:
      'White noise into an eight-tap plant, with the best fixed filter of the same length solved ' +
      'for rather than searched for. The diagonal of R reads 0.336, which is the input power a ' +
      'sample. The answer matches the plant to 3.9e-4 of its own size.',
    try: 'Set the taps to 4. The answer stops matching, because four taps cannot hold an eight-tap plant and the best they do is the first four of them.',
    why:
      'For a stationary input the mean squared error is a quadratic in the weights, so it has one ' +
      'minimum and its gradient is zero there. Setting that gradient to zero gives R w = p. R ' +
      'holds the autocorrelations of the input and p the correlations between the input and what ' +
      'was wanted. Both are averages, so this needs no probability beyond one. With white noise ' +
      'the input is uncorrelated with itself at every lag but zero, so R is the input power times ' +
      'the identity and its diagonal reads 0.336. The answer matches the plant to 3.9e-4 over 8192 ' +
      'samples, and that figure falls as the record grows, because R and p are estimated from it. ' +
      'Every algorithm in this group is reaching for this answer without solving anything.',
  },
  c2: {
    see:
      'The same plant, reached by an update of one line rather than by a solve. From zero weights ' +
      'the first update moves each weight by the step size times the error times the input. After ' +
      '337 samples the weights are within a tenth of the plant, and by the end they match it to ' +
      '1.9e-15.',
    try: 'Set the output to the estimate. The scope shows what the filter produced rather than what was left over, and it grows into the wanted signal over the first few hundred samples.',
    why:
      'LMS follows the gradient of one sample of squared error rather than of the average. That ' +
      'gradient is minus two e x, so the update is w <- w + mu e x, where e is what was wanted ' +
      'minus what came out. It costs one multiply-accumulate a tap for the output and one more for ' +
      'the update, so 2N a sample, which is 16 here. The first update is checkable by hand. The ' +
      'weights start at zero, so the output is zero and the error is the whole of what was ' +
      'wanted. The first weight then moves to the step size times that error times the first ' +
      'input sample. ' +
      'Nothing about the plant appears anywhere in the update. It is reached from the input and ' +
      'the error alone.',
  },
  c3: {
    see:
      'The same run at four step sizes. Below 0.248 the mean square of the weights converges, and ' +
      'the run reaches the plant in 337 samples at 0.02 and in 18 at 0.5. At 0.99 the weights ' +
      'leave for infinity and the readout says the plant was not reached.',
    try: 'Set the step size to 0.99. The weights leave for infinity within the first few hundred samples, and the readout reports that the plant was not reached.',
    why:
      'The bound comes out of the update itself. Each step multiplies the distance to the answer ' +
      'by one minus the step size times the energy in the delay line, so the distance shrinks ' +
      'while that factor stays inside minus one to one. That gives a step below 2 over N Px for ' +
      'the mean of the weights, which is 0.743 here, and below 2 over 3 N Px for their mean ' +
      'square, which is 0.248. The second is the one a reader watching the error sees. Both rest ' +
      'on the weights being independent of the input, and they are not, so both are conservative. ' +
      'This run still converges at 0.5, twice the tighter figure. At 0.99, four times it, the ' +
      'weights leave for infinity.',
  },
  c4: {
    see:
      'The same plant with a floor of 8.76e-4 added to what was wanted. Four step sizes reach a ' +
      'tenth of the plant in 1325, 652, 333 and 107 samples. The settled error over that floor ' +
      'reads 0.967, 0.971, 0.982 and 1.023, rising with the step.',
    try: 'Set the step size to 0.05. The run reaches the plant in 107 samples rather than 1325, and the settled error rises from 0.967 of the floor to 1.023.',
    why:
      'The noise added to what was wanted is not in the input, so no filter of the input can ' +
      'produce it. It is the floor. A filter that had reached the plant exactly would sit on it. ' +
      'LMS does not, because the gradient it follows is estimated from one sample and is noisy, so ' +
      'the weights keep moving around the answer. That excess is predicted as mu N Px over 2, ' +
      'which is 0.0067, 0.0135, 0.0269 and 0.0673 of the floor at the four steps. The measurement ' +
      'rises with the step in the same way and stays under the prediction at every one of them. ' +
      'Halving the step halves the excess and doubles the samples, and the four counts are close ' +
      'to that.',
  },
  c5: {
    see:
      'The same eight-tap plant with the input ten times louder. The input power reads 33.6 rather ' +
      'than 0.336. NLMS divides its update by the energy in the delay line. It reaches a tenth of ' +
      'the plant in 22 samples at either level.',
    try: 'Load the LMS chip. At this amplitude a step size of 0.02 is a hundred times too large, and the weights leave for infinity.',
    why:
      'The LMS bound has the input power in it, so a step size that works at one level fails at ' +
      'another. Ten times the amplitude is a hundred times the power, and the bound falls by a ' +
      'hundred. A step of 0.02 sits under it at amplitude 1 and far over it at amplitude 10. NLMS ' +
      'divides the update by the energy in the delay line, which takes the input power out of the ' +
      'bound and leaves 0 to 2 whatever the level is. It costs one more multiply-accumulate a tap, ' +
      'so 3N a sample rather than 2N. The run reaches a tenth of the plant in 22 samples at both ' +
      'amplitudes, and the two weight traces lie on top of each other.',
  },
  c6: {
    see:
      'Three algorithms run on the same plant. LMS reaches a tenth of it in 337 samples at 16 ' +
      'multiplies a sample, NLMS in 22 at 24, and RLS in 5 at 64. The weight view draws the one ' +
      'that is loaded.',
    try: 'Load the RLS chip. The weights reach the plant in 5 samples, which is fewer than the eight taps the filter has.',
    why:
      'RLS follows no gradient. It keeps the least-squares answer over every sample seen so far, ' +
      'by updating an inverse correlation matrix rather than a weight vector alone. The answer at ' +
      'sample n is the one the normal equations give for those n samples, so what sets the speed ' +
      'is how many samples it takes for those equations to fix eight numbers. Here that is 5. The ' +
      'cost is about N squared a sample, which is 64 at eight taps and 256 at sixteen, where LMS ' +
      'goes from 16 to 32. The forgetting factor of 0.999 sets how far back the equations look, ' +
      'and it is what lets RLS follow a plant that moves.',
  },
  c7: {
    see:
      'An echo path with three samples of bulk delay, learned by a twelve-tap NLMS filter, with a ' +
      '300 Hz near-end voice added to what was wanted. The echo falls from 0.175 to 7.06e-3 in ' +
      'power, an echo return loss enhancement of 13.9 dB. The voice carries 0.005 of what is left.',
    try: 'Set the near-end talker to zero. What is left drops by thirty orders of magnitude, because the echo is then the whole of what was wanted.',
    why:
      'An echo canceller is the unknown plant arrangement with the names changed. The far-end ' +
      'signal is the input, the echo path is the plant, and the near-end microphone carries the ' +
      'echo plus whoever is talking at this end. A filter can only produce filtered versions of ' +
      'its own input. The near-end voice is not one of those, so it survives, and the arrangement ' +
      'is built for it to survive. What is left reads 7.06e-3, of which 0.005 is the voice itself. ' +
      'Twelve taps cover three samples of bulk delay and the nine of path that follow. With the ' +
      'voice switched off, twelve taps cancel the echo to nothing and eight leave the last four ' +
      'taps of the path behind at 24 dB. The voice also slows the filter down, because to the ' +
      'update it looks like error a weight change could remove.',
  },
}
