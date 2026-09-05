// The terms Groups D and E lean on: the trellis, Viterbi's survivors, and the
// graph belief propagation walks.

export const DECODER_TERMS = {
  convolutional: {
    name: 'Convolutional code',
    def: 'A code with no block boundary, made by running the message through a shift register. Each output bit is a modulo-two sum of the register bits under a fixed set of taps. Its rate is the message bits over the output bits.',
  },
  constraint: {
    name: 'Constraint length',
    def: 'How many message bits the encoder holds at once, written K. The state is the K − 1 bits already in, so the trellis has 2^(K−1) states. Every further bit of it doubles the decoder’s work.',
  },
  state: {
    name: 'State',
    def: 'The bits the encoder still remembers, which is everything the next output depends on beside the incoming bit. Two branches leave each state and two arrive at it. The decoder tracks one path into each.',
  },
  impulse: {
    name: 'Impulse response',
    def: 'What the encoder puts out for a single one followed by zeros. Read down each output it is that output’s generator. It is the shortest way to see which taps a generator names.',
  },
  trellis: {
    name: 'Trellis',
    def: 'The state diagram drawn once per step, with branches joining one column to the next. A path through it is a message and the bits along it are the codeword. Decoding is a search over this picture.',
  },
  branch: {
    name: 'Branch',
    def: 'One step of the trellis from a state to the next state, carrying the input that takes it and the output it sends. A branch metric is the distance between that output and what arrived. Adding branch metrics along a path gives the path metric.',
  },
  path: {
    name: 'Path',
    def: 'A run of branches through the trellis from the first column to the last. Every path is a codeword and every codeword is a path. The decoder returns the path whose metric is lowest.',
  },
  termination: {
    name: 'Termination',
    def: 'The zeros appended to a message to return the encoder to the all-zero state. It costs one bit of rate per memory bit and gives the decoder a known end. A terminated path both starts and ends at state 00.',
  },
  viterbi: {
    name: 'Viterbi decoder',
    def: 'The decoder that keeps one path into each state at each step and discards the other. Two paths that meet at a state have the same future, so the worse one can be dropped at once. The path it returns is the one an exhaustive search would return.',
  },
  survivor: {
    name: 'Survivor',
    def: 'The path into a state that the decoder kept, because its metric was the lower of the two. Its metric and the branch it came from are what the walker view draws. Tracing survivors backwards recovers the message.',
  },
  metric: {
    name: 'Path metric',
    def: 'The total distance between a path’s output and what arrived. On hard bits it counts the places they differ. On soft values it adds the squared distance to the level each branch would have sent.',
  },
  acs: {
    name: 'Add-compare-select',
    def: 'The operation the decoder does once per branch pair: add the branch metric, compare the two totals, and keep the smaller. A code of 2^(K−1) states needs two of them per state per step. It is the unit of work a Viterbi datapath is budgeted in.',
  },
  traceback: {
    name: 'Traceback',
    def: 'Walking the survivors backwards to read the message off the trellis. A decoder with unbounded memory traces back from the end of the block. One on a wire traces back a fixed depth behind the front.',
  },
  freedistance: {
    name: 'Free distance',
    def: 'The lowest output weight of any path that leaves the all-zero state and returns to it. It plays the part the minimum distance plays for a block code. This lab searches the states for it rather than quoting it.',
  },
  errorevent: {
    name: 'Error event',
    def: 'A path that leaves the correct path and rejoins it later. Its output weight is how many received bits it disagrees with, and its input weight is how many message bits it gets wrong. Counting them by weight gives the code’s spectrum.',
  },
  codinggain: {
    name: 'Coding gain',
    def: 'How much energy per bit a code saves at a stated error rate, in decibels. The asymptotic gain is what the two curves approach, 10 log₁₀(R d) for soft decisions. It is not the distance between them at any one error rate.',
  },
  unionbound: {
    name: 'Union bound',
    def: 'A bound on the error rate that adds one term per error event. It is an upper bound, because the events it adds overlap. A gain read from an upper bound on the error rate is a lower bound on the gain.',
  },
  depth: {
    name: 'Traceback depth',
    def: 'How many steps behind the front a decoder reads its decision. Too short and the survivors have not merged, so the decision is not the one a full traceback would make. The rule of thumb is five constraint lengths.',
  },
  softdecision: {
    name: 'Soft decision',
    def: 'A decoder input that keeps the received value rather than its sign alone. It tells the decoder how sure the channel was, which a hard bit does not. On the Gaussian channel it is worth over a decibel of energy per bit.',
  },
  ldpc: {
    name: 'LDPC code',
    def: 'A code whose parity-check matrix has few ones in each row and column. That sparsity is what makes message passing on its graph cheap. A regular code has the same count in every row and in every column.',
  },
  tanner: {
    name: 'Tanner graph',
    def: 'The parity-check matrix read as a graph, with one node per bit and one per check. An edge joins a bit to a check that covers it. Decoding is passing one number along each edge in each direction.',
  },
  variablenode: {
    name: 'Variable node',
    def: 'A node of the graph standing for one bit of the codeword. It adds what the channel said to what its checks said, and passes the total on. Its degree is how many checks cover that bit.',
  },
  checknode: {
    name: 'Check node',
    def: 'A node of the graph standing for one parity check. It tells each bit what the other bits on that check imply about it. Its degree is how many bits the check covers.',
  },
  girth: {
    name: 'Girth',
    def: 'The length of the shortest cycle in the graph. A girth of four means two bits share two checks, which makes a belief come back to where it started at once. This lab’s codes have no four-cycle.',
  },
  beliefpropagation: {
    name: 'Belief propagation',
    def: 'The decoder that passes beliefs along the edges of the graph until the checks pass. Each message leaves out what came back along its own edge, so no belief counts itself twice. It is exact on a graph with no cycles.',
  },
  llr: {
    name: 'Log-likelihood ratio',
    def: 'The logarithm of the probability a bit is zero over the probability it is one. Its sign is the hard decision and its size is the strength of the argument. On the Gaussian channel the channel value is 2y/σ².',
  },
  iteration: {
    name: 'Iteration',
    def: 'One round of messages from checks to bits and back. The syndrome weight after each round says how far the word still is from a codeword. The decoder stops when that weight reaches zero.',
  },
  syndromeweight: {
    name: 'Syndrome weight',
    def: 'How many parity checks a word fails. It is zero exactly on the codewords, and it is what the pane prints after each iteration. A weight that stops falling is a decode that has stalled.',
  },
  convergence: {
    name: 'Convergence',
    def: 'The decoder reaching a word that satisfies every check. It is not the same as reaching the right word, and it is not guaranteed to happen at all. A decode that has not converged has a nonzero syndrome weight at every iteration.',
  },
  cycle: {
    name: 'Cycle',
    def: 'A loop in the Tanner graph, along which a belief can travel and return. A returning belief looks like new evidence and is not. Every code worth using has cycles, so belief propagation is always approximate on one.',
  },
  uncoded: {
    name: 'Uncoded curve',
    def: 'The error rate of the same link with no code on it, `Q(√(2 E_b/N_0))` for an antipodal signal. It is the line every gain in this lab is measured from. The Communications Lab computes it, and this lab draws that function rather than a copy of it.',
  },
  harddecision: {
    name: 'Hard decision',
    def: 'A detector output reduced to one bit, the sign of the sample. It is what a decoder reads when the receiver throws away how sure it was. On a Gaussian channel that loss is worth over a decibel of energy per bit.',
  },
  crossoverpoint: {
    name: 'Crossover point',
    def: 'The energy per bit at which a coded curve meets the uncoded one. Above it the code is the better of the two, and below it the code is worse than sending nothing. A code with a larger correction radius crosses at a lower ratio.',
  },
  threshold: {
    name: 'Capacity threshold',
    def: 'The signal-to-noise ratio at which a channel’s capacity reaches a stated rate. No code of that rate works below it, whatever its length. The soft and hard thresholds at rate one half are 1.585 dB apart.',
  },
  maximumlikelihood: {
    name: 'Maximum likelihood',
    def: 'The decoding that returns the codeword most likely to have been sent. Viterbi is one for a convolutional code, and exhaustive search is one for a block code. Belief propagation on a graph with cycles is not one.',
  },
}
