// @ee-labs/codes: entropy, capacity, and the codes that reach them.
//
// The admission test for this package, from CORE_SCOPE.md Rule 1 restated for
// coding theory:
//
//   An object goes in here only if it is a finite set with exact arithmetic on
//   it. A field, a code, a trellis and a Tanner graph all are, so every count
//   this package returns is exact and is stated without a hedge.
//
//   Two things here are not. The binary-input Gaussian channel's capacity is a
//   numerical integral, and it returns its own convergence with it. A union
//   bound on an error rate is a bound, and the function that returns one says
//   which way the inequality runs. Rule 3 asks for both, and they are the only
//   two in the package.
//
// The one estimated object this lab works with, the counted bit error rate,
// belongs to `@ee-labs/random` and arrives with its confidence interval
// attached. Nothing here re-derives it.

export { CodesError, addVec, allVectors, augment, binomial, bitsOf, distance, dot, generatorOf, identity, matMul, matVec, nullSpace, parityOf, patternsOfWeight, rank, rref, systematic, transpose, valueOf, vecMat, weight, zeros } from './src/gf2.js'

export { PRIMITIVE, GF16, GF256, field, orderOf, polyEval, polyMod, polyMul, polyText, solve } from './src/gfm.js'

export {
  ENUMERATION_LIMIT,
  codeFromGenerator,
  codeFromParity,
  codewords,
  correctionRadius,
  cyclicCode,
  cyclicEncode,
  decode,
  describe,
  detectionRadius,
  encode,
  golayCode,
  hammingCode,
  messageOf,
  minimumDistance,
  parityCheckCode,
  polyRemainder,
  repetitionCode,
  singletonBound,
  spherePacking,
  standardArray,
  syndromeOf,
  syndromeTable,
  weightDistribution,
} from './src/block.js'

export {
  SHANNON_FLOOR,
  SHANNON_FLOOR_DB,
  becMatrix,
  biAwgnCapacity,
  binaryEntropy,
  bscCrossoverAt,
  bscMatrix,
  capacityAWGN,
  capacityAWGNDb,
  capacityBEC,
  capacityBSC,
  checkDistribution,
  crossoverForCapacity,
  entropy,
  esN0ForBiAwgnCapacity,
  esN0ForBscCapacity,
  maxEntropy,
  mutualInformation,
  shannonLimit,
  shannonLimitDb,
} from './src/entropy.js'

export {
  arithmeticDecode,
  arithmeticEncode,
  blockSource,
  blockedHuffman,
  huffman,
  huffmanDecode,
  huffmanEncode,
  idealBits,
  probsOf,
  typicalSequence,
} from './src/source.js'

export {
  CONV_CODES,
  branchMetric,
  encoder,
  encode as convEncode,
  freeDistance,
  softAsymptoticGain,
  stateText,
  tracebackRule,
  trellis,
  viterbi,
  weightSpectrum,
} from './src/conv.js'

export { L12, L12_CHECKS, L102, arrayLdpc, fourCycles, hardOf, matrixOf, rateOf, sumProduct, syndrome, syndromeWeight, tannerGraph } from './src/ldpc.js'

export { RS15, RS255, RS_DECODER_STATUS, rsCheckMatrix, rsCode, rsEncode, rsErasureDecode, rsIsCodeword, rsMessageOf, rsSyndromes } from './src/rs.js'

export { bitStream, crossoverFor, demodulate, errorCount, esN0Db, gaussian, modulate, sigmaFor, symbolStream, symmetric } from './src/channel.js'
