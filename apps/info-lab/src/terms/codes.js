// The terms Group C leans on: the field, the matrices, the syndrome, and the
// distance that decides what a code can do.

export const CODE_TERMS = {
  parity: {
    name: 'Parity bit',
    def: 'One extra bit, set so that the codeword has an even number of ones. The receiver adds up the bits it got, and a nonzero sum means an odd number of them changed. One check detects one error and corrects none.',
  },
  gf2: {
    name: 'GF(2)',
    def: 'The field of two elements, where addition is the exclusive-or and multiplication is the logical AND. Every codeword in this group is a vector over it. Nothing rounds, because every value is 0 or 1.',
  },
  syndrome: {
    name: 'Syndrome',
    def: 'The parity checks applied to a received word, written H rᵀ. It is zero exactly on the codewords, and it depends on the error and not on the codeword the error landed on. A decoder reads it and looks up the error it names.',
  },
  linearcode: {
    name: 'Linear code',
    def: 'A code whose codewords are closed under addition, so the sum of two of them is a third. That makes the code a subspace, and it makes the minimum distance equal to the smallest nonzero weight. Every code in this lab is linear.',
  },
  paritycheck: {
    name: 'Parity-check matrix',
    def: 'The matrix H whose null space is the code. Each of its rows is one check over the bits it covers. A code of n bits and k message bits has n − k independent rows.',
  },
  hamming: {
    name: 'Hamming code',
    def: 'The family with r parity bits, length 2^r − 1 and distance 3 at every r. Each corrects one error, and each is perfect. Its rate rises towards one as r grows.',
  },
  coset: {
    name: 'Coset',
    def: 'The code with one error pattern added to every word of it. Every received word lies in exactly one coset, and every word of a coset has the same syndrome. The lowest-weight word of a coset is what a decoder subtracts.',
  },
  generator: {
    name: 'Generator matrix',
    def: 'The matrix G whose rows span the code, so that a message m becomes the codeword mG. In systematic form it is the identity beside the checks, and the message is then readable off the front of the codeword.',
  },
  distance: {
    name: 'Minimum distance',
    def: 'The fewest places in which two codewords differ. For a linear code it is the smallest weight of a nonzero codeword. It decides both radii: a code corrects ⌊(d − 1)/2⌋ errors and detects d − 1.',
  },
  weight: {
    name: 'Weight',
    def: 'How many ones a word has. The weight distribution counts the codewords of each weight, and its first nonzero entry above zero is the minimum distance. It is a count over the whole code rather than a sample of it.',
  },
  radius: {
    name: 'Correction radius',
    def: 'How many errors a decoder can always undo, which is ⌊(d − 1)/2⌋. Past it some pattern decodes to the wrong codeword. The detection radius reaches further, to d − 1, because detecting asks less than correcting.',
  },
  perfect: {
    name: 'Perfect code',
    def: 'A code whose spheres of the correction radius fill the space of words exactly, with nothing left over. The Hamming codes and the Golay code are the binary ones. A perfect code has a complete syndrome table with no spare rows.',
  },
  rate: {
    name: 'Rate',
    def: 'The message bits over the transmitted bits, k/n. It is what a code costs, and it multiplies the energy each transmitted bit carries. A higher rate spends less and corrects less.',
  },
  cyclic: {
    name: 'Cyclic code',
    def: 'A code in which a codeword shifted round is again a codeword. Every such code is the multiples of one generator polynomial. Encoding is a polynomial multiplication and checking is a division.',
  },
  generatorpoly: {
    name: 'Generator polynomial',
    def: 'The polynomial whose multiples are the codewords of a cyclic code. Its degree is the number of check bits. This lab builds each Hamming code from a primitive polynomial of the right degree.',
  },
  remainder: {
    name: 'Remainder',
    def: 'What is left when the received word is divided by the generator polynomial. It is zero exactly on the codewords, and it equals the syndrome the matrix gives. In hardware it is the state of a shift register.',
  },
  golay: {
    name: 'Golay code',
    def: 'The (23,12) cyclic code with distance 7, which corrects 3 errors. It is perfect, like the Hamming codes, and it is the longest binary perfect code that corrects more than one error.',
  },
  gfm: {
    name: 'GF(2^m)',
    def: 'The field of m-bit symbols, built from a primitive polynomial. Addition is the exclusive-or of the two symbols, and multiplication is a polynomial product reduced by that polynomial. GF(2⁴) has 15 nonzero elements and GF(2⁸) is the byte field.',
  },
  primitive: {
    name: 'Primitive element',
    def: 'An element whose powers run through every nonzero element of the field exactly once. Its powers are the log table the field is built from. A polynomial is primitive when the root it defines is one.',
  },
  reedsolomon: {
    name: 'Reed-Solomon code',
    def: 'A code whose symbols are elements of GF(2^m) rather than single bits. Its distance is n − k + 1, the most any code of that length and dimension can have. A burst that ruins several adjacent bits damages one symbol.',
  },
  erasure: {
    name: 'Erasure',
    def: 'A symbol known to be missing, rather than one wrongly received. A code fills n − k of them, twice as many as the errors it corrects. The difference is the position, which an erasure gives and an error hides.',
  },
  singleton: {
    name: 'Singleton bound',
    def: 'No code of length n and dimension k has a distance above n − k + 1. A code that reaches it is called maximum distance separable. Reed-Solomon codes reach it exactly.',
  },
}
