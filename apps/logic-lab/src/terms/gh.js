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
}
