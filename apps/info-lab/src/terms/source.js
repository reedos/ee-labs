// The terms Groups A and B lean on: a source, its entropy, the coders that
// reach it, and the capacity of a channel.
//
// A definition is three or four sentences. It names the thing, gives the
// formula or the number, and says what it is for. Numbers here are numbers this
// lab produces, and terms.test.js checks each of them against the engine.

export const SOURCE_TERMS = {
  entropy: {
    name: 'Entropy',
    def: 'The average number of bits a source needs per symbol, H = −Σ p log₂ p. It is a property of the probabilities and not of any one message. No lossless code has an average length below it.',
  },
  source: {
    name: 'Source',
    def: 'A set of symbols with a probability for each. This lab draws its symbols independently, so the probability of a sequence is the product of the probabilities of its symbols. Everything a source coder does rests on those numbers.',
  },
  bit: {
    name: 'Bit',
    def: 'The unit of information, and the unit of every entropy on this screen. One bit is the information in one answer to a question whose two answers were equally likely. A fair coin has an entropy of 1 bit per toss.',
  },
  uniform: {
    name: 'Uniform source',
    def: 'A source whose symbols all have the same probability. It has the largest entropy of any source over that alphabet, log₂ m for m symbols. Every code for it is a fixed-length code, because no symbol is more likely than another.',
  },
  huffman: {
    name: 'Huffman code',
    def: 'The shortest code that gives each symbol a whole number of bits. It is built from the leaves up, joining the two least likely nodes at each step. Its average length sits inside one bit of the entropy.',
  },
  codeword: {
    name: 'Codeword',
    def: 'The bits a coder sends for one symbol, or for one message. In this lab a source codeword names a symbol and a channel codeword carries a message with its checks. Both are read off a table the pane draws.',
  },
  prefixcode: {
    name: 'Prefix code',
    def: 'A code in which no codeword is the start of another. That is what lets a decoder read a stream with no separators between the words. Every Huffman code is one, because its codewords are the leaves of a tree.',
  },
  redundancy: {
    name: 'Redundancy',
    def: 'The average code length less the entropy, in bits per symbol. It is what a coder wastes, and it is zero only when every ideal length is already a whole number. The efficiency is the entropy over the length, as a percentage.',
  },
  kraft: {
    name: 'Kraft sum',
    def: 'The sum of 2 raised to minus each codeword length. A prefix code exists for a set of lengths exactly when that sum is at most one. A sum of one says the code uses every leaf of its tree.',
  },
  dyadic: {
    name: 'Dyadic source',
    def: 'A source whose every probability is a power of one half. Its ideal lengths −log₂ p are whole numbers, so Huffman reaches the entropy exactly. It is the one case where a code of whole bits wastes nothing.',
  },
  block: {
    name: 'Block coding',
    def: 'Coding several symbols at once, as one symbol of a larger source. The whole-bit penalty is then paid once per block rather than once per symbol. The alphabet grows as the block does, at m raised to the block size.',
  },
  arithmetic: {
    name: 'Arithmetic coding',
    def: 'A coder that narrows one interval of the unit line by each symbol in turn. The code word is the shortest binary fraction inside the final interval. The whole sequence costs at most −log₂ P(x) + 2 bits.',
  },
  interval: {
    name: 'Interval',
    def: 'The range the arithmetic coder holds, from a low value to a high one. Each symbol narrows it to that symbol’s share of itself. Its width after a sequence is the probability of that whole sequence.',
  },
  capacity: {
    name: 'Capacity',
    def: 'The largest rate at which some code makes the error rate as small as you please. It is measured in bits per channel use, or in bits per second per hertz. It says nothing about which code reaches it.',
  },
  snr: {
    name: 'Signal-to-noise ratio',
    def: 'The signal power over the noise power, usually in decibels. The Gaussian channel’s capacity is log₂(1 + S/N) for that ratio. Doubling the power adds 3 dB to it.',
  },
  bandwidth: {
    name: 'Bandwidth',
    def: 'The width of the band a signal occupies, in hertz. Capacity is proportional to it, so bandwidth buys rate in proportion while power buys it as a logarithm. This lab quotes capacity per hertz, so the bandwidth divides out.',
  },
  decibel: {
    name: 'Decibel',
    def: 'Ten times the base ten logarithm of a power ratio. A factor of two is 3.010 dB and a factor of ten is 10 dB. Every ratio in this lab is quoted in decibels because the limits are naturally logarithmic.',
  },
  bsc: {
    name: 'Symmetric channel',
    def: 'A binary channel that flips each bit with probability p, independently. Its capacity is 1 − h₂(p) bit per use. It is what a Gaussian channel becomes once the detector has thrown away everything but the sign.',
  },
  bec: {
    name: 'Erasure channel',
    def: 'A binary channel that loses each bit with probability e and says which ones it lost. Its capacity is 1 − e exactly. Knowing where the damage is worth more than knowing only how much of it there is.',
  },
  crossover: {
    name: 'Crossover probability',
    def: 'The probability that the symmetric channel flips a bit. At 0.5 the output is independent of the input and the capacity is zero. The capacity reaches one half at a crossover of 0.110028.',
  },
  binaryentropy: {
    name: 'Binary entropy',
    def: 'The entropy of one bit with probability p of being a one, written h₂(p). It is zero at p of 0 or 1 and reaches 1 bit at one half. It is the doubt a flip costs the receiver on the symmetric channel.',
  },
  ebn0: {
    name: 'Energy per bit',
    def: 'The energy spent per message bit, over the noise power spectral density, written E_b/N_0. It is the axis every coding gain in this lab is measured along. A code that spends R of each bit’s energy on the message shifts it by 10 log₁₀ R.',
  },
  shannonlimit: {
    name: 'Shannon limit',
    def: 'The least energy per bit at which a stated spectral efficiency is possible, (2^r − 1)/r. It falls to ln 2 as the efficiency goes to zero, which is −1.5917 dB. No code of any length crosses it.',
  },
  efficiency: {
    name: 'Spectral efficiency',
    def: 'The rate carried per hertz of bandwidth, in bit/s/Hz. It fixes which Shannon limit a link is measured against. A denser signal carries more of it and needs more energy per bit.',
  },
}
