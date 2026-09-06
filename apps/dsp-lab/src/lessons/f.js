// Group F's three registers.
//
// `see` names the quantity on screen. `try` is one instruction, verb first, with
// the reading it produces. `why` is the folded explanation, which may define a
// term and carries numbers rather than abstractions. The budgets are STYLE.md's
// and prose.test.js measures every one of them.

export const LESSONS = {
  f1: {
    see:
      'A 1024-point frame, which every group before this one has been taking for granted. The ' +
      'direct sum needs 1048576 complex multiplies for it. The transform needs 5120 and returns ' +
      'the same numbers.',
    try: 'Set the frame to 4096. The direct sum rises to 16777216 multiplies and the transform to 24576, so the gap widens with the frame.',
    why:
      'The discrete Fourier transform is a definition before it is an algorithm. Each of the N ' +
      'outputs is a sum of N terms, one for each input sample, so computing it as written costs N ' +
      'squared complex multiplies. At 1024 points that is 1048576. The fast transform computes the ' +
      'same definition by noticing that the sum for the even-numbered outputs and the sum for the ' +
      'odd-numbered ones share most of their work. Splitting on that and repeating gives log2 N ' +
      'stages of N over 2 butterflies, which is 5120 here. The tests run both on the same data and ' +
      'the results agree to 1e-13 relative, so this is one object computed two ways rather than ' +
      'two objects that resemble each other.',
  },
  f2: {
    see:
      'One butterfly is drawn. Two inputs of 1 go in, one multiply by the twiddle happens on the ' +
      'lower path, and a sum and a difference come out. At k of zero the twiddle is 1, so the ' +
      'outputs are 2 and 0.',
    try: 'Load the k = N/4 chip. The twiddle turns to minus j at an angle of -90 degrees, and the outputs become 1 - j and 1 + j.',
    why:
      'A butterfly is the whole of the arithmetic. X is a plus W b and Y is a minus W b. W is ' +
      'e^{-j 2 pi k / N}, a point on the unit circle at minus 360 k over N degrees. That is one ' +
      'complex multiply and two complex additions, whatever N is. The twiddle is where the ' +
      'frequency enters. At k of zero it is 1, the multiply disappears, and the butterfly is a sum ' +
      'and a difference, which is why the first stage of a transform needs no multiplies at all. ' +
      'At k of N over four it is minus j, a quarter turn, which costs no multiply either because ' +
      'it swaps the two parts and flips a sign.',
  },
  f3: {
    see:
      'The order the transform reads its input in. At eight points it is 0, 4, 2, 6, 1, 5, 3, 7, ' +
      'which is each index with its three bits written backwards. A 1024-point frame takes 10 ' +
      'stages and reads 1024 samples in that order.',
    try: 'Set the frame to 64. The count of stages falls from 10 to 6, because a stage is one halving and 64 is 2 to the 6.',
    why:
      'The split that makes the transform fast is between even-numbered and odd-numbered samples. ' +
      'Doing it once puts the evens first and the odds second. Doing it again inside each half ' +
      'splits on the next bit, and repeating to the end sorts the samples by their index read ' +
      'backwards. At eight points that gives 0, 4, 2, 6, 1, 5, 3, 7. Reversing bits twice returns ' +
      'the original index, so the permutation is its own inverse and one routine does both ' +
      'directions. What it costs is one pass over the data and no multiplies, which is why the ' +
      'ordering is done once at the start rather than tracked through the stages.',
  },
  f4: {
    see:
      'The count, at four frame lengths. A 1024-point transform is 10 stages of 512 butterflies, ' +
      'so 5120 complex multiplies against 1048576 for the sum. That is 204.8 times, and the ' +
      'readout prints all four numbers.',
    try: 'Set the frame to 64. The saving falls to 21.3 times, because the ratio is 2N over log2 N and it grows with N.',
    why:
      'Each stage halves the length of the sums being computed and doubles how many of them there ' +
      'are, so the work in a stage is N over 2 butterflies whatever the stage is. There are log2 N ' +
      'stages, because that is how many halvings reach a length of one. The total is N over 2 ' +
      'times log2 N, against N squared for the sum, so the ratio is 2N over log2 N. At 64, 256, ' +
      '1024 and 4096 points that is 21.3, 64.0, 204.8 and 682.7. The saving grows with the frame, ' +
      'which is why a long transform is cheap per sample and a short one is not. Other radices ' +
      'change the constant in front and not the N log N.',
  },
  f5: {
    see:
      'A record of 3000 samples with a 4800 Hz tone in it. Dividing 48 kHz by 3000 suggests a bin ' +
      'of 16 Hz. The transform padded the record to 4096 points, so the bin is 11.72 Hz and the ' +
      'line is reported at 4804.69 Hz.',
    try: 'Load the 4096 samples chip. The two bin figures agree at 11.72 Hz, because nothing was padded.',
    why:
      'A radix-2 transform halves its input at every stage, so it needs a length that is a power ' +
      'of two. A record that is not one is padded with zeros up to the next one. The padding adds ' +
      'no information, and it is not harmless. Every bin centre is a multiple of the sample rate ' +
      'over the transform length, so padding 3000 samples up to 4096 moves every one of them. A ' +
      'reader who computed 48000 over 3000 and expected bins 16 Hz apart gets bins 11.72 Hz apart ' +
      'instead. A tone that would have sat on a bin at 4800 Hz is reported at 4804.69. The ' +
      'frame is a power of two everywhere else in this lab so that this never happens quietly.',
  },
}
