// Group D's three registers.
//
// `see` names the quantity on screen. `try` is one instruction, verb first, with
// the reading it produces. `why` is the folded explanation, which may define a
// term and carries numbers rather than abstractions. The budgets are STYLE.md's
// and prose.test.js measures every one of them.

export const LESSONS = {
  d1: {
    see:
      'White noise into one 4096-point transform, squared and scaled to a density. The source ' +
      'carries 1.408e-5 of power in each hertz and the estimate reads 1.408e-5 on average. Its ' +
      'bins scatter about that mean by 1.015 of it.',
    try: 'Set the frame to 16384. The bin narrows from 11.72 Hz to 2.93 Hz and the scatter reads 1.003, which is where it was.',
    why:
      'A periodogram is one transform of one record, with each bin squared and divided by the ' +
      'sample rate and the window power. That scaling is checkable. The sum of the density over ' +
      'the bins, times the bin width, is the mean power of the record. Here the source is uniform ' +
      'noise of amplitude 1, so it carries a third of a unit of power a sample. A flat one-sided ' +
      'density spreads that over 24 kHz as 1.408e-5 a hertz. The mean of the estimate lands on ' +
      'that. The individual bins do not. Each is the sum of two squared quantities and scatters ' +
      'about the true value by about the true value, which reads as 1.0 whatever the record is.',
  },
  d2: {
    see:
      'The same noise at three record lengths. Sixteen times the samples gives sixteen times the ' +
      'resolution, from a bin of 46.88 Hz to one of 2.93 Hz. The scatter reads 1.003 at both ends ' +
      'and has not moved.',
    try: 'Set the frame to 1024. The bin widens to 46.88 Hz and the trace is the same thickness as it was at sixteen times the length.',
    why:
      'A longer record buys resolution and nothing else. The transform of N samples has N over 2 ' +
      'bins across the same band, so each bin is narrower, and two components a bin apart can be ' +
      'told apart where before they could not. What it does not buy is a steadier reading. Each ' +
      'new bin is estimated from its own share of the record, so there are more of them and each ' +
      'is as uncertain as before. That is why the trace looks the same however far it is stretched. ' +
      'Getting a steadier reading means averaging, and averaging is what the next three lessons ' +
      'are about, along with what it costs.',
  },
  d3: {
    see:
      'The same 16384 samples cut into 16 abutting pieces, with their periodograms averaged. The ' +
      'scatter falls from 1.003 to 0.250 and the bin widens from 2.93 Hz to 46.88 Hz. The ' +
      'prediction beside it is one over the root of 16.',
    try: 'Set the segment count to 64. The scatter falls to 0.130 against a prediction of 0.125, and the bin widens to 187.5 Hz.',
    why:
      'Averaging K independent estimates of the same quantity divides the variance by K, so it ' +
      'divides the spread by the root of K. Cutting a record into K abutting pieces gives K ' +
      'estimates that are close enough to independent for that to hold. At 4, 16, 64 and 256 ' +
      'segments the measurement reads 0.513, 0.250, 0.130 and 0.065 against predictions of 0.5, ' +
      '0.25, 0.125 and 0.0625. What is paid for it is resolution. Each piece is K times shorter, ' +
      'so its transform has K times fewer bins and each is K times wider. The record length sets ' +
      'the product of the two, and the segment count decides how it is divided.',
  },
  d4: {
    see:
      'The same 16 segments with a Hann window on each and half of each one overlapping the next. ' +
      'The scatter reads 0.245 against 0.250 for the abutting version. It reached that from 8704 ' +
      'samples rather than from 16384.',
    try: 'Load the Bartlett chip. The scatter rises slightly to 0.250, and the samples the estimate read rise from 8704 to 16384.',
    why:
      'A window on each segment is the first change. Without one, a strong component spreads its ' +
      'skirts over the whole estimate and the density beside it is that leakage rather than the ' +
      'signal. A Hann window drops those skirts, at the cost of tapering most of each segment ' +
      'towards zero. Overlapping is the second change, and it is there to recover what the taper ' +
      'threw away. At half overlap the same K segments come from about half as many samples, which ' +
      'is 8704 here rather than 16384. The segments are no longer independent, so the scatter falls ' +
      'a little short of one over the root of K, and it reads 0.245 rather than 0.25.',
  },
  d5: {
    see:
      'Two tones 120 Hz apart, at 4380 and 4500 Hz. One transform of the whole record gives a bin ' +
      'of 2.93 Hz and shows two lines. Sixty-four averaged segments give a bin of 187.5 Hz and ' +
      'show one.',
    try: 'Load the K = 64 chip. The two lines merge into one hump, because 187.5 Hz of bin is wider than the 120 Hz between them.',
    why:
      'Every estimator here trades the same two things against each other. The record holds a fixed ' +
      'number of samples, and cutting it into K pieces buys a steadier reading by giving up K times ' +
      'the bin width. At one segment the bin is 2.93 Hz, the two tones sit 41 bins apart and the ' +
      'readout counts two lines. At 16 segments the bin is 46.88 Hz, they are still two bins apart ' +
      'and the count is still two. At 64 segments the bin is 187.5 Hz, which is wider than the gap, ' +
      'and the count drops to one. Nothing was lost from the record. What was given up was the ' +
      'ability to ask this particular question of it.',
  },
  d6: {
    see:
      'White noise through a two-pole filter, whose coefficients are -1.6 and 0.9. An all-pole ' +
      'model of order two fitted to 16384 samples of the output returns -1.6002 and 0.9012, and ' +
      'puts its peak at 4321 Hz.',
    try: 'Set the frame to 1024. The fit reads -1.5864 and 0.8860 from a sixteenth of the samples, and the peak stays at 4321 Hz.',
    why:
      'An average makes no assumption about the signal and pays for that with resolution. A model ' +
      'makes one and is paid back. Assume the signal came from white noise through a filter with ' +
      'poles and no zeros, and what is left to find is a handful of coefficients rather than a ' +
      'curve. Levinson-Durbin finds them from the autocorrelations of the record, and every model ' +
      'it returns is stable, because each step multiplies the prediction error by one minus a ' +
      'reflection coefficient squared. From 1024 samples the fit is already within 1 % of the two ' +
      'numbers the process was built from. From 16384 it is within 0.2 %. The assumption is doing ' +
      'the work that samples would otherwise have to.',
  },
  d7: {
    see:
      'The same process, fitted at every order from 1 to 12. The prediction error falls at every ' +
      'step, because more poles always fit better. Akaike picks order 3 and the description length ' +
      'picks order 2, which is the order the process has.',
    try: 'Set the order to 6. The prediction error is lower than at 2 and the model has four poles the process never had.',
    why:
      'Each pole added takes the fit closer to the record, so the error alone cannot say when to ' +
      'stop. A criterion charges for poles. Akaike adds 2p over N to the log of the error and the ' +
      'description length adds p ln N over N. At 4096 samples ln N is 8.3, so the second charges ' +
      'four times as much a pole and stops earlier. Here it stops at 2, which is what the process ' +
      'has, and Akaike stops at 3. Neither is a proof. They are two prices for the same thing. Both ' +
      'are printed because a reader who sees them disagree asks what the model is for, and that is ' +
      'the question which decides.',
  },
}
