// Groups G and H: the clock period, skew, and metastability as a rate.
//
// House rules, as in `base.js`: two to four sentences, the first saying what
// the thing is. Concrete numbers over abstraction, and no term defined using a
// term the reader has not met.

export const GH_TERMS = {
  fmax: {
    name: 'Maximum frequency',
    def:
      'One over the shortest clock period a design works at. It is the same statement as that period, written the ' +
      'other way round. The 4-bit adder between registers closes at 770 ps, so it is quoted either as that or as ' +
      '1.2987 GHz.',
  },
  skew: {
    name: 'Clock skew',
    def:
      'How much later the clock reaches one flip-flop than another. Here it is the delay of a wire between the ' +
      'launching clock and the capturing one. It buys time for the setup check and takes exactly as much away from ' +
      'the hold check.',
  },
  holdslack: {
    name: 'Hold margin',
    def:
      'How much longer the shortest path from one flip-flop to the next is than the hold time it has to cover. ' +
      'The clock period is not in it at all, so slowing a clock down never improves it. A negative one is a design ' +
      'that works at no frequency.',
  },
  setupslack: {
    name: 'Setup slack',
    def:
      'How much of the clock period is left after the clock-to-Q, the longest path and the setup time. ' +
      'A negative one is a design being clocked faster than it closes, and there is always a slower clock that ' +
      'fixes it.',
  },
  pipeline: {
    name: 'Pipelining',
    def:
      'Cutting the logic between two registers into shorter pieces with registers between them. The clock gets ' +
      'faster because the longest piece is shorter. The answer takes one clock per piece, so it does not arrive ' +
      'any sooner.',
  },
  latency: {
    name: 'Latency and throughput',
    def:
      'Latency is how long one answer takes, and throughput is how many answers arrive per second. Pipelining ' +
      'raises the second and does not lower the first. Two stages of 490 ps take longer than one of 770 ps, and ' +
      'they finish an addition twice as often.',
  },
  metastable: {
    name: 'Metastable',
    def:
      'What a flip-flop can be when its input changed inside the window. Its output sits between the two levels ' +
      'instead of at one of them, and how long it stays there is a random variable. Everything else in this lab is ' +
      'exact, and this is not.',
  },
  settling: {
    name: 'Settling time',
    def:
      'How long a flip-flop that came out metastable is given before anything reads it. It is the one term in the ' +
      'rate law a designer chooses. Every extra 20 ps of it here multiplies the mean time between failures by e.',
  },
  mtbf: {
    name: 'Mean time to failure',
    def:
      'The average time between two occasions on which a metastable output is read before it settled. It is one ' +
      'over the failure rate. It is a statistical statement about many runs and not a prediction about the next one.',
  },
  tau: {
    name: 'The two parameters',
    def:
      'τ is how fast a flip-flop that is metastable resolves, and T0 is the width of the window in which an edge ' +
      'can upset it. This lab takes both as 20 ps. They belong to a real cell and a measurement, and the Analog IC ' +
      'Lab is where they would come from.',
  },
  synchroniser: {
    name: 'Synchroniser',
    def:
      'Two flip-flops in a row, both on the same clock, used to bring in a signal that is not clocked by it. ' +
      'The first one may come out metastable, and the second is not read until a whole clock period later. ' +
      'That period is the settling time the rate law asks for.',
  },
  asynchronous: {
    name: 'Asynchronous input',
    def:
      'A signal whose changes have nothing to do with the clock that samples it. Its edges can land anywhere, ' +
      'including inside the window. No amount of care in the design removes that, which is why the answer is a ' +
      'rate rather than a guarantee.',
  },
}
