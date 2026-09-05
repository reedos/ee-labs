// Group B's three registers. One specification runs through all eight.

export const LESSONS = {
  b1: {
    see:
      'Four numbers become two bands. The passband reaches 4 kHz and may vary by 1 dB. The ' +
      'stopband starts at 6 kHz and must stay 60 dB down. The pane reads the margin at each.',
    try: 'Set the stopband depth to 80 dB. The margin goes negative until the design grows, and the pane names the band that binds.',
    why:
      'A specification is a mask the response has to stay inside. Two bands here, and the 2 kHz ' +
      'between them is the transition band, which carries no bound at all. That is what makes it a ' +
      'transition band rather than a gap in the specification. Every bound is measured from the ' +
      'passband peak rather than from unity, because a filter with a gain of two meets a ripple ' +
      'specification just as well as one with a gain of one. The margin is the decibels to spare at ' +
      'the band that binds. Positive means met, and negative names the frequency where it is not.',
  },
  b2: {
    see:
      'The same specification met by a windowed sinc. The transition width the window gives is ' +
      'about C times fs over N, with C from the window, so a wider window needs more taps for the ' +
      'same 2 kHz.',
    try: 'Click through the four windows. The taps rise from the rectangular window to Blackman as the transition constant does.',
    why:
      'Truncating the ideal sinc is itself a rectangular window, and the ripple that produces does ' +
      'not shrink as taps are added. Tapering the ends fixes the ripple and widens the transition. ' +
      'The four windows have transition constants of 0.9, 3.1, 3.3 and 5.5, so at 81 taps and ' +
      '48 kHz they predict 533, 1837, 1956 and 3259 Hz. Measured, they give 528, 1782, 1518 and ' +
      '2346 Hz. The estimate is the right size and is not an identity, so the design measures what ' +
      'it built rather than trusting the formula.',
  },
  b3: {
    see:
      'A Hamming design at four lengths. The transition width falls from 3863 Hz to 788 Hz as the ' +
      'taps go from 41 to 201, and the stopband depth moves from 48.7 dB to 51.6 dB.',
    try: 'Raise the required depth to 50 dB. Hamming still meets it, and the taps rise only because the transition has to narrow.',
    why:
      'A window sets two things and only one of them depends on the length. The transition width ' +
      'falls as one over N, so adding taps buys width. The stopband depth is the window’s own ' +
      'sidelobe level, and it barely moves: quadrupling the length changes it by under three ' +
      'decibels. That is why the window is chosen first and the length second. A design that needs ' +
      '60 dB cannot get there by growing a Hamming window, and the next experiment is what happens ' +
      'when someone tries.',
  },
  b4: {
    see:
      'The full specification asked of a Hamming window. It cannot reach 60 dB at any length, so ' +
      'the design says so rather than returning a filter that misses. Blackman reaches it in 133 ' +
      'taps.',
    try: 'Switch the window to Blackman. The design meets the specification, and the pane reports a positive margin in both bands.',
    why:
      'A refusal with a reason is a finished feature here, not a gap. Hamming’s sidelobes sit ' +
      'about 53 dB down whatever its length, so a 60 dB specification is outside what it can do and ' +
      'no search over lengths will find it. The design reports that, names the window and names the ' +
      'depth asked for. Blackman’s sidelobes sit about 74 dB down, so it has the depth to ' +
      'spare and needs only enough taps for the 2 kHz transition. Its constant of 5.5 asks for 133, ' +
      'and 133 is what meets the mask.',
  },
  b5: {
    see:
      'The same specification by the Remez exchange. Every stopband lobe reaches the same height ' +
      'rather than falling away from the corner, and the whole stopband sits on the mask instead ' +
      'of far below it.',
    try: 'Switch the method to window. The first lobe is at the limit and the rest are wasted depth, so the design needs far more taps.',
    why:
      'Parks-McClellan finds the best possible fit for a given length, in the sense that no other ' +
      'set of taps has a smaller peak error. The alternation theorem says the answer is the one ' +
      'whose error reaches that peak, with alternating signs, at M plus two frequencies. A window ' +
      'design spends depth it does not need in the far stopband and runs out at the corner. An ' +
      'equiripple design spends the same everywhere, which is why it meets this mask in 53 taps ' +
      'where Blackman needs 133.',
  },
  b6: {
    see:
      'Kaiser’s formula estimates the taps from the ripple and the transition width. It asks ' +
      'for 51 here, and the design that meets the mask is 53, having grown once.',
    try: 'Move the stopband edge to 5 kHz. The transition halves, the estimate roughly doubles, and the design follows it.',
    why:
      'The estimate is a fit to many designs rather than a theorem, so it is close and not exact. ' +
      'The design starts there, measures the margin, and adds two taps at a time until the mask is ' +
      'met. So the number a lesson quotes is the length that was verified rather than the one ' +
      'predicted, and the difference between them is printed. Narrowing the transition is the ' +
      'expensive change: the taps go as one over the width, so halving the transition roughly ' +
      'doubles the filter. Deepening the stopband is cheap by comparison, because it enters the ' +
      'formula through a logarithm.',
  },
  b7: {
    see:
      'The same specification by an analog prototype mapped to the unit circle. The z-plane shows ' +
      'the poles inside it, in conjugate pairs, with all the zeros at z equals minus one.',
    try: 'Switch the prototype to chebyshev1. The order falls from 18 to 9, and the passband floor drops to the ripple you asked for.',
    why:
      'The bilinear transform maps the whole left half of the s-plane inside the unit circle. So a ' +
      'stable analog filter becomes a stable digital one. It maps frequency through a tangent, ' +
      'which compresses the axis. The corner is prewarped before the prototype is scaled to it. ' +
      'The mapping is exact within that meaning and carries no hedge. A fourth-order Butterworth ' +
      'at 5 kHz reads 3.0103 dB down at its corner. At 10 kHz it reads 28.3423 dB down, which is ' +
      'what the prototype gives at the prewarped ratio.',
  },
  b8: {
    see:
      'The same two bands met four ways. A Blackman window needs 133 taps, Parks-McClellan needs ' +
      '53, an 18th-order Butterworth needs 45 coefficients and a 9th-order Chebyshev needs 25.',
    try: 'Switch the prototype to butterworth. The order doubles for the same mask, which is the price of a flat passband.',
    why:
      'The IIR wins on count by a factor of five and loses on phase. A symmetric FIR delays every ' +
      'frequency by the same 26 samples, so a waveform passes through with its shape intact. An IIR ' +
      'has no such property, and its group delay peaks near the corner where the poles are. The ' +
      'job decides which of the two matters. A filter in an audio path needs the shape it keeps. A filter ' +
      'inside a decimator needs the count it saves. The Chebyshev buys its extra sharpness with ' +
      'passband ripple, and that is the third thing being traded.',
  },
}
