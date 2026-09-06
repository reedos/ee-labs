// Source coding: Huffman's tree, and the arithmetic coder's interval.
//
// Both coders here are lossless and both round-trip exactly. Huffman assigns a
// whole number of bits to each symbol, which is why it can only reach the
// entropy when every probability is a power of one half. The arithmetic coder
// narrows one interval per symbol and codes the whole sequence at once, so the
// whole-number penalty is paid once rather than once per symbol.
//
// The arithmetic coder works in exact integer arithmetic on BigInt. A hundred
// symbols of a skewed source narrow the interval below what a double can hold,
// and a coder that silently lost the bottom of its interval would round-trip
// wrongly on exactly the sequences the lesson is about.

import { CodesError } from './gf2.js'
import { entropy } from './entropy.js'

/**
 * Huffman's code for a source.
 *
 * The tree is built bottom up: take the two least likely nodes, join them, and
 * put the join back. Ties go to the older node, and a leaf is older than any
 * join, which is the choice that gives the code of least variance in its
 * lengths. For the reference source that is lengths 2, 2, 2, 3, 3 rather than
 * 1, 3, 3, 3, 3, and both have the same average length.
 *
 * @param {number[]} probs
 * @returns {{
 *   lengths: number[], words: string[], tree, entropy, meanLength,
 *   redundancy, efficiency, kraft, fixed
 * }}
 */
export function huffman(probs) {
  const H = entropy(probs)
  const m = probs.length
  if (m === 1) {
    return report(probs, [0], [''], { leaf: 0, p: 1 }, H)
  }
  // Two queues: the leaves in ascending order, and the joins in the order they
  // were made. Both are already sorted, so the two least likely nodes are at
  // the two fronts, and a tie is taken from the leaves.
  const leaves = probs.map((p, leaf) => ({ p, leaf })).sort((a, b) => a.p - b.p || a.leaf - b.leaf)
  const joins = []
  let iLeaf = 0
  let iJoin = 0
  const take = () => {
    const l = iLeaf < leaves.length ? leaves[iLeaf] : null
    const j = iJoin < joins.length ? joins[iJoin] : null
    if (l && (!j || l.p <= j.p)) {
      iLeaf++
      return l
    }
    iJoin++
    return j
  }
  while (leaves.length - iLeaf + joins.length - iJoin > 1) {
    const a = take()
    const b = take()
    joins.push({ p: a.p + b.p, left: a, right: b })
  }
  const root = iJoin < joins.length ? joins[iJoin] : leaves[iLeaf]
  const words = new Array(m).fill(null)
  walk(root, '', words)
  const lengths = words.map((w) => w.length)
  return report(probs, lengths, words, root, H)
}

function walk(node, prefix, words) {
  if (node.leaf !== undefined) {
    words[node.leaf] = prefix || '0'
    return
  }
  walk(node.left, `${prefix}0`, words)
  walk(node.right, `${prefix}1`, words)
}

function report(probs, lengths, words, tree, H) {
  const meanLength = probs.reduce((acc, p, i) => acc + p * lengths[i], 0)
  const kraft = lengths.reduce((acc, l) => acc + 2 ** -l, 0)
  return {
    probs,
    lengths,
    words,
    tree,
    entropy: H,
    meanLength,
    redundancy: meanLength - H,
    efficiency: H / meanLength,
    kraft,
    fixed: Math.max(1, Math.ceil(Math.log2(probs.length))),
  }
}

/** A message as bits, through a Huffman code's words. */
export function huffmanEncode(symbols, code) {
  return symbols.map((s) => {
    if (!code.words[s]) throw new CodesError('source-symbol', `${s} is not a symbol of this source`)
    return code.words[s]
  }).join('')
}

/**
 * The bits back as symbols. A prefix code needs no separators, which is what
 * makes the decode a walk down the tree with no lookahead.
 */
export function huffmanDecode(bits, code) {
  const out = []
  let node = code.tree
  if (node.leaf !== undefined) {
    // A source of one symbol has one codeword, and the decode is a count.
    for (let i = 0; i < bits.length; i++) out.push(node.leaf)
    return out
  }
  for (const b of bits) {
    node = b === '0' ? node.left : node.right
    if (node.leaf !== undefined) {
      out.push(node.leaf)
      node = code.tree
    }
  }
  if (node !== code.tree) throw new CodesError('source-truncated', 'the bit string ends part way down the tree')
  return out
}

/**
 * The source of `n`-symbol blocks drawn from an independent source.
 *
 * Blocking spreads the whole-number penalty over `n` symbols, so the average
 * length per symbol falls towards the entropy as `1/n`.
 *
 * @returns {{ probs, blocks: number[][], entropy }}
 */
export function blockSource(probs, n) {
  checkBlock(probs, n)
  let blocks = [[]]
  let ps = [1]
  for (let i = 0; i < n; i++) {
    const nb = []
    const np = []
    blocks.forEach((b, j) => {
      probs.forEach((p, s) => {
        nb.push([...b, s])
        np.push(ps[j] * p)
      })
    })
    blocks = nb
    ps = np
  }
  return { probs: ps, blocks, entropy: entropy(ps) }
}

function checkBlock(probs, n) {
  if (!Number.isInteger(n) || n < 1) throw new CodesError('source-block', `a block is a whole number of symbols, not ${n}`)
  if (probs.length ** n > 65536) throw new CodesError('source-block', `blocks of ${n} from ${probs.length} symbols make ${probs.length ** n} of them, which is past this coder's limit`)
}

/** Huffman on the blocked source, reported per symbol of the original source. */
export function blockedHuffman(probs, n) {
  const block = blockSource(probs, n)
  const code = huffman(block.probs)
  return {
    n,
    code,
    blocks: block.blocks,
    entropy: entropy(probs),
    meanLength: code.meanLength / n,
    redundancy: code.meanLength / n - entropy(probs),
    efficiency: (entropy(probs) * n) / code.meanLength,
  }
}

/**
 * The arithmetic coder, in exact integer arithmetic.
 *
 * The model is a set of integer counts and their total, so every interval end
 * is a rational with denominator `total^n` and nothing is rounded. The code
 * word is the shortest binary fraction inside the final interval, which is at
 * most `−log₂ P(x) + 2` bits for the whole sequence.
 *
 * @param {number[]} symbols   indices into `counts`
 * @param {number[]} counts    integer weights, one per symbol
 * @returns {{ bits, length, bound, ideal, low, high, denominator, perSymbol }}
 */
export function arithmeticEncode(symbols, counts) {
  const { total, cum } = model(counts)
  const T = BigInt(total)
  let low = 0n
  let range = 1n
  let den = 1n
  for (const s of symbols) {
    if (counts[s] === undefined) throw new CodesError('source-symbol', `${s} is not a symbol of this source`)
    // [low, low + range) over `den` narrows to the symbol's share of itself.
    low = low * T + range * BigInt(cum[s])
    range *= BigInt(counts[s])
    den *= T
  }
  const high = low + range
  // The shortest binary fraction inside [low, high)/den. Try each length until
  // one lands, starting at the length the interval's width allows.
  // The interval's width is `range/den`, and both outgrow a double on a long
  // sequence, so the starting length comes from their bit lengths rather than
  // from a ratio that would overflow to NaN.
  let k = Math.max(0, bitLength(den) - bitLength(range) - 1)
  let bits = null
  for (; k < 4096; k++) {
    const scale = 1n << BigInt(k)
    // The smallest j with j/2^k >= low/den, and the fraction fits when
    // (j + 1)/2^k <= high/den.
    const j = ceilDiv(low * scale, den)
    if ((j + 1n) * den <= high * scale) {
      bits = j.toString(2).padStart(k, '0')
      break
    }
  }
  if (bits === null) throw new CodesError('source-precision', 'no binary fraction of 4096 bits or fewer lands inside this interval')
  const ideal = idealBits(symbols, counts)
  return {
    bits,
    length: bits.length,
    bound: ideal + 2,
    ideal,
    low,
    high,
    denominator: den,
    perSymbol: bits.length / symbols.length,
  }
}

/** The symbols back, given how many were sent. */
export function arithmeticDecode(bits, counts, n) {
  const { total, cum } = model(counts)
  const T = BigInt(total)
  const k = BigInt(bits.length)
  // The value the bits stand for, as v / 2^k, kept as a rational.
  let num = bits.length ? BigInt(`0b${bits}`) : 0n
  let scale = 1n << k
  const out = []
  for (let i = 0; i < n; i++) {
    // Which symbol's share of [0, 1) the value falls in.
    const t = (num * T) / scale
    let s = counts.length - 1
    while (s > 0 && BigInt(cum[s]) > t) s--
    out.push(s)
    // Narrow: v ← (v·T − cum[s]) / count[s], as one rational.
    num = num * T - BigInt(cum[s]) * scale
    scale *= BigInt(counts[s])
    const g = gcd(num, scale)
    if (g > 1n) {
      num /= g
      scale /= g
    }
  }
  return out
}

/** `−log₂ P(x)` for a sequence, in bits. The arithmetic coder's target. */
export function idealBits(symbols, counts) {
  const total = counts.reduce((a, b) => a + b, 0)
  return symbols.reduce((acc, s) => acc + Math.log2(total / counts[s]), 0)
}

function model(counts) {
  if (!counts.length) throw new CodesError('source-empty', 'a model needs at least one symbol')
  for (const c of counts) if (!Number.isInteger(c) || c <= 0) throw new CodesError('source-counts', `an arithmetic coder's counts are whole numbers above zero, and one is ${c}`)
  const cum = []
  let acc = 0
  for (const c of counts) {
    cum.push(acc)
    acc += c
  }
  return { total: acc, cum }
}

const ceilDiv = (a, b) => (a + b - 1n) / b
const bitLength = (a) => (a === 0n ? 0 : a.toString(2).length)
const gcd = (a, b) => (b === 0n ? a : gcd(b, a % b))

/** Counts as the probabilities they stand for. */
export const probsOf = (counts) => {
  const total = counts.reduce((a, b) => a + b, 0)
  return counts.map((c) => c / total)
}

/**
 * A sequence with exactly the composition its probabilities predict, drawn in
 * a fixed order.
 *
 * A lesson that quotes a length needs a sequence it can quote it for. This one
 * has `n·p` of each symbol, so its own probability is exactly `2^{−nH}` and the
 * arithmetic coder's bound on it is `nH + 2` bits with nothing rounded.
 */
export function typicalSequence(counts, n) {
  const total = counts.reduce((a, b) => a + b, 0)
  if (n % total !== 0) throw new CodesError('source-typical', `${n} symbols do not split into whole shares of a model that totals ${total}`)
  const out = []
  counts.forEach((c, s) => {
    for (let i = 0; i < (n * c) / total; i++) out.push(s)
  })
  return out
}
