// One call from an experiment into `@ee-labs/codes`, and everything a pane or a
// lesson can read off the result.
//
// An experiment names the objects it works with as functions of its knobs: a
// source, a code, a channel, a convolutional encoder or a parity-check matrix.
// `analyse` builds them once and every pane reads the same object, so the code
// table, the trellis walker and the topbar can never disagree about what was
// decoded.

import { awgn, berClosed, ebN0For, mapBits, noiseVariance, softMetric } from '@ee-labs/comms'
import {
  CodesError,
  addVec,
  asymptoticHard,
  asymptoticSoft,
  correctionRadius as radiusOf,
  crossover as crossoverOf,
  ebN0AtBer,
  gainCurve,
  hardBlockBer,
  hardConvBound,
  levelsFromLlr,
  realGain,
  softConvBound,
  uncodedBer,
  arithmeticEncode,
  biAwgnCapacity,
  binaryEntropy,
  blockedHuffman,
  capacityAWGNDb,
  capacityBEC,
  capacityBSC,
  codeFromParity,
  CONV_CODES,
  convEncode,
  encoder as encoderOf,
  correctionRadius,
  crossoverForCapacity,
  esN0ForBiAwgnCapacity,
  esN0ForBscCapacity,
  decode as blockDecode,
  describe,
  encode as blockEncode,
  entropy,
  errorCount,
  freeDistance,
  gaussian,
  huffman,
  huffmanEncode,
  idealBits,
  L102,
  L12,
  maxEntropy,
  minimumDistance,
  polyRemainder,
  rateOf,
  rsEncode,
  rsErasureDecode,
  rsSyndromes,
  SHANNON_FLOOR_DB,
  shannonLimitDb,
  softAsymptoticGain,
  sumProduct,
  symmetric,
  syndromeOf,
  syndromeWeight,
  tannerGraph,
  tracebackRule,
  typicalSequence,
  viterbi,
  weightSpectrum,
} from '@ee-labs/codes'
import { GF16 } from '@ee-labs/codes'
import { bitStream } from '@ee-labs/codes'
import { errorPattern, messageBits } from './groups/shared.js'

/**
 * Run one experiment at one setting.
 *
 * @returns {{
 *   exp, p, refusal,
 *   source, capacity, block, field, conv, ldpc, curve
 * }} each part present only when the experiment asked for it.
 */
export function analyse(exp, p) {
  const out = { exp, p, refusal: null, source: null, capacity: null, block: null, field: null, conv: null, ldpc: null, gain: null, chain: null, curve: null }
  try {
    if (exp.source) out.source = sourceOf(exp, p)
    if (exp.capacity) out.capacity = capacityOf(exp, p)
    if (exp.code) out.block = blockOf(exp, p)
    if (exp.field) out.field = fieldOf(exp, p)
    if (exp.conv) out.conv = convOf(exp, p)
    if (exp.ldpc) out.ldpc = ldpcOf(exp, p)
    if (exp.gain) out.gain = gainOf(exp, p)
    if (exp.chain) out.chain = chainOf(exp, p)
    if (exp.curve) out.curve = exp.curve(p, out)
  } catch (e) {
    if (!(e instanceof CodesError)) throw e
    // A refusal an experiment is about is the answer, and the pane prints it.
    out.refusal = e
  }
  return out
}

/** The source, its Huffman code, and whichever of the two coders the experiment asked for. */
function sourceOf(exp, p) {
  const probs = exp.source(p)
  const H = entropy(probs)
  const code = huffman(probs)
  const out = {
    probs,
    H,
    max: maxEntropy(probs.length),
    code,
    words: code.words,
    lengths: code.lengths,
    meanLength: code.meanLength,
    redundancy: code.redundancy,
    efficiency: code.efficiency,
    kraft: code.kraft,
    fixed: code.fixed,
    saving: 1 - code.meanLength / code.fixed,
    blocked: null,
    arith: null,
    stream: null,
  }
  if (exp.blocks) {
    // One Huffman code per block size, so the fall towards the entropy is a
    // measurement at each size rather than a formula.
    out.blocked = exp.blocks(p).map((n) => blockedHuffman(probs, n))
    out.blockSizes = exp.blocks(p)
  }
  if (exp.arith) {
    const { counts, n } = exp.arith(p)
    const symbols = typicalSequence(counts, n)
    const a = arithmeticEncode(symbols, counts)
    out.arith = { ...a, counts, n, symbols, ideal: idealBits(symbols, counts) }
  }
  if (exp.stream) {
    const symbols = exp.stream(p)
    out.stream = { symbols, bits: huffmanEncode(symbols, code) }
  }
  return out
}

/** The capacities and limits this experiment reads. */
function capacityOf(exp, p) {
  const spec = exp.capacity(p)
  const out = { ...spec }
  if (spec.snrDb !== undefined) out.awgn = capacityAWGNDb(spec.snrDb)
  if (spec.crossover !== undefined) out.bsc = capacityBSC(spec.crossover)
  if (spec.erasure !== undefined) out.bec = capacityBEC(spec.erasure)
  if (spec.efficiency !== undefined) {
    out.limitDb = shannonLimitDb(spec.efficiency)
    out.floorDb = SHANNON_FLOOR_DB
  }
  if (spec.thresholds !== undefined) {
    // The ratio per channel use at which each channel reaches that capacity.
    // The difference between them is what soft decisions are worth.
    out.softDb = esN0ForBiAwgnCapacity(spec.thresholds)
    out.hardDb = esN0ForBscCapacity(spec.thresholds)
    out.softOver = out.hardDb - out.softDb
  }
  out.half = crossoverForCapacity(0.5)
  if (spec.esN0Db !== undefined) out.bi = biAwgnCapacity(spec.esN0Db)
  return out
}

/** The block code, one message through it, and one error pattern on top. */
function blockOf(exp, p) {
  const code = exp.code(p)
  const d = describe(code)
  const message = messageBits(exp.message ? exp.message(p) : 0, code.k)
  const codeword = blockEncode(code, message)
  const error = errorPattern(code.n, exp.flips ? exp.flips(p) : [])
  const received = addVec(codeword, error)
  const syndrome = syndromeOf(code, received)
  const decoded = d.table ? blockDecode(code, received, d.table) : null
  return {
    code,
    ...d,
    message,
    codeword,
    error,
    received,
    syndrome,
    decoded,
    flips: error.reduce((a, b) => a + b, 0),
    right: decoded ? decoded.word.join('') === codeword.join('') : null,
    // A cyclic code carries its polynomial view beside its matrix one.
    remainder: code.generatorPoly ? polyRemainder(received, code.generatorPoly) : null,
  }
}

/** GF(2⁴) and the Reed-Solomon code built over it. */
function fieldOf(exp, p) {
  const rs = exp.field(p)
  const f = GF16
  const powers = Array.from({ length: f.order }, (_, i) => ({ i, value: f.exp[i] }))
  const message = Array.from({ length: rs.k }, (_, i) => (i + 1) % f.size)
  const codeword = rsEncode(rs, message)
  const positions = []
  for (let i = 0; i < (exp.erasures ? exp.erasures(p) : 0); i++) positions.push(i * 3)
  const received = [...codeword]
  for (const q of positions) received[q] = 0
  let filled = null
  let refusal = null
  try {
    filled = positions.length ? rsErasureDecode(rs, received, positions) : { word: received, values: [], positions, filled: true }
  } catch (e) {
    if (!(e instanceof CodesError)) throw e
    refusal = e
  }
  return {
    rs,
    f,
    powers,
    orders: new Set(powers.map((x) => x.value)).size,
    message,
    codeword,
    positions,
    received,
    filled,
    refusal,
    syndromes: rsSyndromes(rs, received),
    right: filled ? filled.word.join(',') === codeword.join(',') : false,
  }
}

/** The convolutional encoder, one message through it, and Viterbi's whole walk. */
function convOf(exp, p) {
  const enc = exp.conv(p)
  const bits = exp.bits ? exp.bits(p) : messageBits(0, 4)
  const sent = convEncode(enc, bits)
  const channel = exp.channel ? exp.channel(p, sent) : null
  const received = channel ? channel.received : addVec(sent.bits, errorPattern(sent.bits.length, exp.flips ? exp.flips(p) : []))
  const soft = !!(channel && channel.soft)
  const out = viterbi(enc, received, { soft, depth: exp.depth ? exp.depth(p) : null })
  const dfree = freeDistance(enc)
  const maxWeight = exp.spectrum ? exp.spectrum(p) : 0
  return {
    enc,
    bits,
    sent,
    received,
    channel,
    soft,
    viterbi: out,
    dfree,
    spectrum: maxWeight ? weightSpectrum(enc, maxWeight) : null,
    gain: softAsymptoticGain(enc.rate, dfree),
    traceback: tracebackRule(enc),
    errors: errorCount(out.bits, bits),
    flips: errorCount(soft ? channel.hard : received, sent.bits),
  }
}

/** The Tanner graph, one word over the channel, and every iteration of the decode. */
function ldpcOf(exp, p) {
  const H = exp.ldpc(p)
  const graph = tannerGraph(H)
  const out = { H, graph, ...rateOf(H), girth: 6, code: null, bp: null }
  const value = exp.message ? exp.message(p) : null
  if (value === null) return out
  const code = codeFromParity(H)
  const message = messageBits(value, code.k)
  const codeword = blockEncode(code, message)
  const channel = exp.channel ? exp.channel(p, { bits: codeword }) : null
  const received = channel ? channel.received : addVec(codeword, errorPattern(H[0].length, exp.flips ? exp.flips(p) : []))
  // A hard channel gives every bit the same size of belief, and the sign of it
  // is the bit that arrived. A soft one gives its own.
  const llr = channel && channel.llr ? channel.llr : received.map((b) => (b ? -2 : 2))
  const iterations = exp.iterations ? exp.iterations(p) : null
  const bp = iterations ? sumProduct(H, llr, { maxIter: iterations, stopEarly: false }) : null
  const d = exp.distance ? minimumDistance(code).d : null
  return {
    ...out,
    code,
    message,
    codeword,
    received,
    llr,
    bp,
    d,
    t: d === null ? null : correctionRadius(d),
    syndrome: syndromeOf(code, received),
    weight: syndromeWeight(H, received),
    flips: errorCount(received, codeword),
    right: bp ? bp.bits.join('') === codeword.join('') : null,
  }
}

/**
 * The two curves Group F measures between, and the distances between them.
 *
 * The uncoded curve is the Communications Lab's closed form. The coded one is
 * this lab's, from the code's own parameters. Neither is stored, and every
 * number below is read off the two by bisection.
 */
function gainOf(exp, p) {
  const spec = exp.gain(p)
  const scheme = spec.scheme || 'bpsk'
  const uncoded = (db) => berClosed(scheme, 10 ** (db / 10))
  const out = {
    ...spec,
    scheme,
    uncoded,
    limitDb: shannonLimitDb(spec.efficiency),
    atUncoded: ebN0For(scheme, spec.target),
    coded: null,
    bound: false,
  }
  out.gap = out.atUncoded - out.limitDb
  if (spec.block) {
    const code = spec.block
    const found = minimumDistance(code)
    const d = found.d
    const t = radiusOf(d)
    out.code = code
    out.d = d
    out.t = t
    out.detect = d - 1
    // The weight view draws the same distribution Group C draws, so a reader
    // who follows the gain back to the code sees the picture they left.
    out.weights = found.weights
    out.rate = code.k / code.n
    out.coded = (db) => hardBlockBer({ n: code.n, k: code.k, t }, db).ber
    out.asymptotic = asymptoticHard(out.rate, t)
  }
  if (spec.conv) {
    const { enc, dFree, spectrum } = spec.conv
    out.enc = enc
    out.dFree = dFree
    out.rate = enc.rate
    out.bound = true
    out.spectrumA = spectrum.a
    const soft = (db) => softConvBound({ rate: enc.rate, spectrum, dFree }, db).ber
    const hard = (db) => hardConvBound({ rate: enc.rate, spectrum, dFree }, db).ber
    out.coded = spec.decision === 'hard' ? hard : soft
    out.other = spec.decision === 'hard' ? soft : hard
    out.asymptotic = asymptoticSoft(enc.rate, dFree)
    out.atSoft = ebN0AtBer(soft, spec.target)
    out.atHard = ebN0AtBer(hard, spec.target)
    out.softOver = out.atHard - out.atSoft
  }
  if (out.coded) {
    const g = realGain({ coded: out.coded, uncoded, target: spec.target, bound: out.bound })
    out.atCoded = g.coded
    out.real = g.gain
    out.difference = out.asymptotic - g.gain
    out.direction = g.direction
    try {
      const x = crossoverOf({ coded: out.coded, uncoded, lo: -2, hi: 14 })
      out.crossoverDb = x.ebN0Db
      out.crossoverBer = x.ber
    } catch (e) {
      if (!(e instanceof CodesError)) throw e
      out.crossoverDb = null
      out.crossoverRefusal = e
    }
  }
  // The two rates where the reader is looking, for the pane and for a lesson
  // that quotes them.
  if (spec.at !== undefined) {
    out.at = spec.at
    out.uncodedAt = uncoded(spec.at)
    out.codedAt = out.coded ? out.coded(spec.at) : null
  }
  out.curve = gainCurve({ coded: out.coded || uncoded, uncoded, from: 0, to: 12, step: 0.25, target: spec.target })
  return out
}

/**
 * One block through the Communications Lab's chain and back through this lab's
 * decoder, so the hand-over between the two is a thing on screen rather than a
 * promise in a document.
 *
 * That lab maps the bits, adds the noise and returns a belief per bit. This lab
 * turns each belief into the level it stands for and walks the trellis.
 */
function chainOf(exp, p) {
  const spec = exp.chain(p)
  const enc = encoderOf(CONV_CODES[spec.K])
  const bits = bitStream(spec.bits, 3)
  const sent = convEncode(enc, bits)
  const syms = mapBits('bpsk', Int8Array.from(sent.bits))
  const { sigma2 } = noiseVariance({ ebN0Db: spec.ebN0Db, bitsPerSymbol: 1 })
  const noisy = awgn(syms, { ebN0Db: spec.ebN0Db, bitsPerSymbol: 1, seed: spec.seed })
  const llr = Array.from(softMetric('bpsk', noisy.out, sigma2))
  const hard = llr.map((v) => (v < 0 ? 1 : 0))
  const soft = viterbi(enc, levelsFromLlr(llr, sigma2), { soft: true })
  const hardOut = viterbi(enc, hard)
  return {
    enc,
    bits,
    sent,
    llr,
    sigma2,
    ebN0Db: spec.ebN0Db,
    hard,
    flips: errorCount(hard, sent.bits),
    softErrors: errorCount(soft.bits, bits),
    hardErrors: errorCount(hardOut.bits, bits),
    viterbi: soft,
  }
}

// ---------- the objects the groups reach for ----------


export { L12, L102, bitStream, gaussian, symmetric, binaryEntropy }

/**
 * How many bits a decode gets wrong, averaged over blocks, at each iteration
 * count. The all-zero word is a codeword of every linear code, so sending it
 * costs no generality and every error is a bit the decoder turned over.
 */
export function iterationCurve({ H, ebN0Db, rate, blocks, iterations, seed = 100 }) {
  const n = H[0].length
  const zero = new Array(n).fill(0)
  const totals = new Array(iterations + 1).fill(0)
  let converged = 0
  for (let b = 0; b < blocks; b++) {
    const ch = gaussian(zero, { ebN0Db, rate, seed: seed + b })
    totals[0] += ch.flips
    const out = sumProduct(H, ch.llr, { maxIter: iterations, stopEarly: false })
    if (out.converged) converged++
    for (let i = 0; i < iterations; i++) {
      const it = out.iterations[Math.min(i, out.iterations.length - 1)]
      totals[i + 1] += errorCount(it.bits, zero)
    }
  }
  return { totals, blocks, bits: blocks * n, converged, rates: totals.map((t) => t / (blocks * n)) }
}

/** How many bits Viterbi gets wrong at each traceback depth, on one run of the channel. */
export function depthCurve({ enc, bits, received, depths, soft }) {
  return depths.map((depth) => ({ depth, errors: errorCount(viterbi(enc, received, { soft, depth }).bits, bits) }))
}
