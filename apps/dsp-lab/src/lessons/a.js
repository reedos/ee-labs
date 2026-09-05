// Group A's three registers.
//
// `see` names the quantity on screen. `try` is one instruction, verb first, with
// the reading it produces. `why` is the folded explanation, which may define a
// term and carries numbers rather than abstractions. The budgets are STYLE.md's
// and prose.test.js measures every one of them.

export const LESSONS = {
  a1: {
    see:
      'One tone at 9 kHz goes in. Keeping every fourth sample halves the rate twice, so the new ' +
      'Nyquist is 6 kHz. The spectrum shows a line at 3 kHz, which is where 9 kHz lands once ' +
      'the rate is 12 kHz.',
    try: 'Set the source to 1500 Hz. The line stays where it is, because 1500 Hz is below the new Nyquist.',
    why:
      'Keeping every Mth sample is decimation. What comes out is the same signal sampled at fs over ' +
      'M, so its Nyquist is fs over 2M. Anything above that folds down, exactly as it does when a ' +
      'converter samples too slowly. Here fs is 48 kHz and M is 4, so the new Nyquist is 6 kHz and a ' +
      '9 kHz tone arrives at 12000 minus 9000, which is 3 kHz. Nothing about the samples records ' +
      'which tone it was. The amplitude reads 0.9061 rather than 1.0000 because each kept sample ' +
      'is held for four samples, and a rectangle four samples wide has a sinc transform worth ' +
      '0.9003 at 3 kHz.',
  },
  a2: {
    see:
      'The same 9 kHz tone, with a 121-tap Blackman low-pass ahead of the decimator. Its cutoff is ' +
      '4800 Hz, which is 0.8 of the new Nyquist. The alias at 3 kHz has gone.',
    try: 'Turn the anti-alias filter off. The line at 3 kHz returns at 0.9061, and no later filter can remove it.',
    why:
      'A decimator throws samples away, and an alias is what arrives in their place. Once it has ' +
      'arrived it sits on top of the wanted band and no filter can separate the two. So the filter ' +
      'goes first. This one is 117.7 dB down at 9 kHz, which drops the alias from 0.9061 to ' +
      '2.043e-6, a suppression of 112.9 dB. Its cutoff sits at 0.8 of the new Nyquist rather than ' +
      'at it, because a filter needs somewhere to fall. The 1200 Hz between 4800 and 6000 is the ' +
      'transition band, and 121 taps is what fits a Blackman transition into it.',
  },
  a3: {
    see:
      'A 1500 Hz tone on a 12 kHz grid, with three zeros written after every sample. The spectrum ' +
      'shows the wanted line at 0.2500 and three more at 10.5, 13.5 and 22.5 kHz, all the same ' +
      'height.',
    try: 'Set the fill to hold. The images fall away unevenly, because a held sample is a rectangle and its transform is a sinc.',
    why:
      'Zero stuffing does not change a spectrum at all. The same numbers are being read against a ' +
      'rate four times higher, so what was one band below 6 kHz is now four copies below 24 kHz. ' +
      'Those copies are images, and they sit at multiples of the coarse rate plus and minus the ' +
      'signal. Here the coarse rate is 12 kHz, so the images land at 10500, 13500 and 22500 Hz. ' +
      'Each reads 0.2500, which is one Lth of the amplitude that went in, because the same energy ' +
      'is now spread over four times as many samples with three of every four at zero.',
  },
  a4: {
    see:
      'The same signal with the interpolation filter switched on. The images have gone and the ' +
      'wanted line reads 1.0000 rather than 0.2500, because the filter has a passband gain of 4.',
    try: 'Set the fill back to zeros. The line drops to 0.2500 and the three images return at the same height.',
    why:
      'An interpolator is two steps. Zero stuffing raises the rate and leaves the images, and a ' +
      'low-pass at the old Nyquist removes them. This one rejects the 10.5 kHz image by 95.1 dB. ' +
      'The second step has a detail that is easy to miss. Three of every four samples are zero, so ' +
      'the average has fallen by four, and a filter with unit gain would leave the signal a quarter ' +
      'of its size. The taps are scaled by L, so the passband gain is 4.0000 and the amplitude ' +
      'comes back. Every interpolation filter carries that factor.',
  },
  a5: {
    see:
      'Noise through the same decimator, with the multiply count beside it. A 121-tap filter at ' +
      '48 kHz costs 5.808 million multiplies a second run directly, and 1.452 million run as four ' +
      'polyphase branches.',
    try: 'Set M to 8. The direct cost does not move and the polyphase cost halves again, so the saving is always M.',
    why:
      'The direct route filters every sample and then throws three of every four results away. The ' +
      'polyphase route never computes them. Deal the taps out to M subfilters, so that subfilter p ' +
      'holds taps p, p plus M, p plus 2M and so on. Each one runs at the output rate, and their ' +
      'outputs are summed. The same products are added in a different order, so the answer agrees ' +
      'to the last few bits, and the work falls by exactly M whatever the length is. That is the ' +
      'saving, and it is the reason every real decimator is built this way.',
  },
  a6: {
    see:
      'The interpolator, with the same count. Each output phase is its own short filter run at the ' +
      'low rate, so no tap is ever multiplied by a stuffed zero.',
    try: 'Set the taps to 241. Both counts double, and the ratio between them stays at L.',
    why:
      'The polyphase interpolator is the decimator read backwards. Deal the taps out to L ' +
      'subfilters, run each at the input rate, and interleave their outputs. Output sample nL plus ' +
      'p is subfilter p applied to the input, so each of the L outputs costs N over L multiplies ' +
      'and the set of them costs N. The direct route costs N per output sample, which is NL for the ' +
      'same set. Three quarters of those multiplies are by zero and produce nothing. This is the ' +
      'same arithmetic with the zeros not written down.',
  },
  a7: {
    see:
      'A 31-tap filter and a decimator by 4. Filtering after the decimator and filtering with the ' +
      'expanded H(z^4) before it give the same output, sample for sample, to the last bit.',
    try: 'Set M to 3. The expanded filter grows from 31 taps to 91, and the two routes still agree exactly.',
    why:
      'H(z^M) is the same taps with M minus one zeros between them, so a 31-tap filter becomes 121 ' +
      'taps at M of 4. Its response repeats M times around the unit circle. The first noble ' +
      'identity says that filtering with H(z) after downsampling equals filtering with H(z^M) ' +
      'before it. The second says the mirror image for upsampling. Both are exact rather than ' +
      'approximate, because both sides add the same products in the same order. That is what makes ' +
      'them worth having. A filter can be moved to the side of a rate change where it costs less, ' +
      'and nothing about the output changes.',
  },
}
