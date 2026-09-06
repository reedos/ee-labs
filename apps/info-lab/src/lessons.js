/**
 * What the student reads, per experiment, in three registers:
 *
 *   see — what the picture shows at the defaults, in a few lines;
 *   try — knob moves with the reading each one produces;
 *   why — the reasoning, for after the picture has made its point.
 *
 * Every number a step quotes is a measurement. A step's `set` is applied on top
 * of the defaults, and each `reads` pair is a quantity path with the value the
 * sentence quotes. experiments.test.js runs each step and checks both the pair
 * and every number in the sentence against it.
 *
 * A `see` or a `why` that compares two settings carries `seeAlso` or `whyAlso`,
 * a list of `{ set, reads }`. Those readings are measured at that setting, so a
 * sentence about the other position of a knob is measured there and not taken
 * on trust.
 *
 * The quantity paths, by the part of the analysis they read:
 *
 *   the source and its code
 *     H  Hmax  L  redundancy  efficiency  kraft  fixed  saving  symbols
 *     length.<s>            the codeword length of symbol s, counting from 1
 *     prob.<s>              that symbol's probability
 *     blocked.<n>           bits per symbol at that block size
 *     alphabet.<n>          how many blocks of that size there are
 *     arith.<bits|bound|ideal|per|symbols|overhead>
 *
 *   capacity and the limits
 *     capacity.<awgn|bsc|bec>   bits per use, or per second per hertz
 *     limitdb  floordb  half    the Shannon limit, its floor, and the crossover
 *                               at which a binary channel reaches one half
 *     bi.<capacity|delta>       the binary-input Gaussian capacity and its guard
 *
 *   the block code
 *     n  k  rate  d  t  detect  cosets  words  parity
 *     weights.<w>           how many codewords have weight w
 *     covered  total  spare  sphere  perfect
 *     syndrome              the syndrome as the number its bits stand for
 *     syndromeweight        how many of its bits are 1
 *     flips  corrected  right
 *     remainder             the cyclic remainder, as a number
 *     gain.<hard|soft>      the asymptotic gain in decibels
 *
 *   the field and the Reed-Solomon code
 *     field.<order|size|powers>   the field's own counts
 *     rs.<n|k|d|t|erasures|rate>  the code's parameters
 *     erasures  filled            how many were erased, and whether they were
 *
 *   the convolutional code
 *     states  branches  acs  acsstep  dfree  traceback  paths
 *     outputs  memory  constraint  coderate
 *     metric  errors  encoded  msgbits  steps
 *     spectrum.<d>          how many error events have output weight d
 *     bits.<d>              their total input weight
 *     gain.soft             10 log₁₀(R d_free)
 *
 *   the Tanner graph and its decode
 *     edges  checks  vars  degreev  degreec  rank  dependent
 *     rate  designrate  girth
 *     weight.<i>            the syndrome weight after iteration i
 *     iteration  converged  iterations
 *
 *   the coding gain
 *     gain.<real|asymptotic|difference>   the two gains, and the gap between them
 *     gain.<coded|uncoded>                where each curve reaches the target
 *     gain.<limit|gap|target|efficiency>  the Shannon limit and the distance to it
 *     gain.<crossover|crossber>           where the two curves meet, and at what rate
 *     gain.<codedat|uncodedat>            both rates where the reader is looking
 *     gain.<soft|hard>                    the asymptotic gain of the code
 *     gain.<atsoft|athard|softover>       where each decision reaches the target
 *     gain.<rate|d|t|dfree>               the code the gain is of
 *     chain.<soft|hard|flips|bits|sent|ebn0>  that lab's chain, decoded here
 *     softdb  harddb  softover            the two capacity thresholds
 *
 *   the curve
 *     curve.<x>             the curve's y at that x
 *     curve.mark            the y at the present setting
 *     curve.bits            how many bits a counted curve counted over
 */
import {
  arithmeticEncode,
  blockedHuffman,
  entropy,
  huffman,
  typicalSequence,
} from '@ee-labs/codes'
import { A_LESSONS } from './lessons/a.js'
import { B_LESSONS } from './lessons/b.js'
import { C_LESSONS } from './lessons/c.js'
import { D_LESSONS } from './lessons/d.js'
import { E_LESSONS } from './lessons/e.js'
import { F_LESSONS } from './lessons/f.js'

export const LESSONS = { ...A_LESSONS, ...B_LESSONS, ...C_LESSONS, ...D_LESSONS, ...E_LESSONS, ...F_LESSONS }

/** One reading of an analysis, by path. */
export function readQuantity(x, p, path) {
  const [head, ...rest] = path.split('.')
  const s = x.source
  const c = x.capacity
  const b = x.block
  const f = x.field
  const v = x.conv
  const g = x.ldpc
  switch (head) {
    // ---- the source and its code ----
    case 'H':
      return need(s && s.H, path)
    case 'Hmax':
      return need(s && s.max, path)
    case 'L':
      return need(s && s.meanLength, path)
    case 'redundancy':
      return needNumber(s && s.redundancy, path)
    case 'efficiency':
      return need(s && 100 * s.efficiency, path)
    case 'kraft':
      return need(s && s.kraft, path)
    case 'fixed':
      return need(s && s.fixed, path)
    case 'saving':
      return needNumber(s && 100 * s.saving, path)
    case 'symbols':
      return need(s && s.probs.length, path)
    case 'length':
      return need(s && s.lengths[Number(rest[0]) - 1], path)
    case 'prob':
      return needNumber(s && s.probs[Number(rest[0]) - 1], path)
    case 'blocked': {
      const n = Number(rest[0])
      const row = need(s && s.blocked, path).find((x2) => x2.n === n)
      if (!row) throw new Error(`${path}: this experiment codes blocks of ${(s.blockSizes || []).join(', ')}`)
      return row.meanLength
    }
    case 'alphabet': {
      const n = Number(rest[0])
      const row = need(s && s.blocked, path).find((x2) => x2.n === n)
      if (!row) throw new Error(`${path}: this experiment codes blocks of ${(s.blockSizes || []).join(', ')}`)
      return row.blocks.length
    }
    case 'arith': {
      const a = need(s && s.arith, path)
      if (rest[0] === 'per') return a.bound / a.n
      if (rest[0] === 'symbols') return a.n
      // The coder returns its word as a string of bits, and a lesson quotes how
      // many there are of them.
      if (rest[0] === 'bits') return a.length
      // The overhead the coder pays once for the whole sequence, measured as
      // the distance between the bound and the sequence's own information.
      if (rest[0] === 'overhead') return a.bound - a.ideal
      return need(a[rest[0]], path)
    }

    // ---- capacity ----
    case 'capacity':
      return need(c && c[rest[0]], path)
    case 'limitdb':
      return needNumber(c && c.limitDb, path)
    case 'floordb':
      return needNumber(c && c.floorDb, path)
    case 'half':
      return need(c && c.half, path)
    case 'softdb':
      return needNumber(c && c.softDb, path)
    case 'harddb':
      return needNumber(c && c.hardDb, path)
    case 'softover':
      return needNumber(c && c.softOver, path)
    case 'bi':
      return need(c && c.bi && c.bi[rest[0]], path)

    // ---- the block code ----
    // The code on screen, wherever this experiment keeps it. Group F holds it
    // inside the gain, and it is the same code with the same numbers.
    case 'n':
      return need(b ? b.n : g ? g.n : code(x) && code(x).n, path)
    case 'k':
      return need(b ? b.k : g && g.code ? g.code.k : code(x) && code(x).k, path)
    case 'rate':
      return need(b ? b.rate : g ? g.rate : x.gain && x.gain.rate, path)
    case 'd':
      return need(b ? b.d : g ? g.d : x.gain && x.gain.d, path)
    case 't':
      return need(b ? b.t : g ? g.t : x.gain && x.gain.t, path)
    case 'detect':
      return need(b && b.detect, path)
    case 'cosets':
      return need(b && b.table && b.table.cosets, path)
    case 'parity':
      return need(b && b.n - b.k, path)
    case 'words':
      return need(b && 2 ** b.k, path)
    case 'weights':
      return needNumber(b && b.weights && b.weights[Number(rest[0])], path)
    case 'covered':
      return need(b && b.packing && b.packing.covered, path)
    case 'total':
      return need(b && b.packing && b.packing.total, path)
    case 'sphere':
      return need(b && b.packing && b.packing.sphere, path)
    case 'spare':
      return needNumber(b && b.packing && b.packing.spare, path)
    case 'perfect':
      return need(b && b.packing && (b.packing.perfect ? 1 : 0), path)
    case 'syndrome':
      return needNumber(valueOfBits(b ? b.syndrome : g && g.syndrome), path)
    case 'syndromeweight':
      return needNumber(weightOfBits(b ? b.syndrome : g && g.syndrome), path)
    case 'remainder':
      return needNumber(valueOfBits(b && b.remainder), path)
    case 'corrected':
      return needNumber(b && b.decoded && b.decoded.weight, path)
    case 'right':
      return needNumber((b ? b.right : g && g.right) ? 1 : 0, path)

    // ---- the field and Reed-Solomon ----
    case 'field': {
      const ff = need(f && f.f, path)
      if (rest[0] === 'order') return ff.order
      if (rest[0] === 'size') return ff.size
      if (rest[0] === 'powers') return f.orders
      throw new Error(`${path}: the field reads its order, its size or its powers`)
    }
    case 'rs':
      return need(f && f.rs[rest[0]], path)
    case 'erasures':
      return needNumber(f && f.positions.length, path)
    case 'filled':
      return needNumber(f && (f.right ? 1 : 0), path)

    // ---- the convolutional code ----
    case 'states':
      return need(v && v.enc.states, path)
    case 'outputs':
      return need(v && v.enc.n, path)
    case 'memory':
      return need(v && v.enc.memory, path)
    case 'constraint':
      return need(v && v.enc.K, path)
    case 'coderate':
      return need(v && v.enc.rate, path)
    case 'branches':
      return need(v && v.enc.table.length, path)
    case 'acsstep':
      return need(v && v.enc.acs, path)
    case 'acs':
      return need(v && v.viterbi.acs, path)
    case 'steps':
      return need(v && v.viterbi.steps.length, path)
    case 'dfree':
      return need(v && v.dfree, path)
    case 'traceback':
      return need(v && v.traceback, path)
    case 'paths':
      return need(v && 2 ** v.bits.length, path)
    case 'encoded':
      return need(v && v.sent.bits.length, path)
    case 'msgbits':
      return need(v && v.bits.length, path)
    case 'metric':
      return needNumber(v && v.viterbi.metric, path)
    case 'errors':
      return needNumber(v && v.errors, path)
    case 'flips':
      return needNumber(v ? v.flips : b ? b.flips : g && g.flips, path)
    case 'spectrum':
      return needNumber(v && v.spectrum && v.spectrum.a[Number(rest[0])], path)
    case 'bits':
      return needNumber(v && v.spectrum && v.spectrum.b[Number(rest[0])], path)
    // ---- the graph and its decode ----
    case 'edges':
      return need(g && g.graph.edges.length, path)
    case 'checks':
      return need(g && g.graph.m, path)
    case 'vars':
      return need(g && g.graph.n, path)
    case 'degreev':
      return need(g && g.graph.degreeV, path)
    case 'degreec':
      return need(g && g.graph.degreeC, path)
    case 'rank':
      return need(g && g.rank, path)
    case 'dependent':
      return needNumber(g && g.dependent, path)
    case 'designrate':
      return need(g && g.designRate, path)
    case 'girth':
      return need(g && g.girth, path)
    case 'weight': {
      const bp = need(g && g.bp, path)
      const i = Number(rest[0])
      if (!bp.syndromeWeights.length) throw new Error(`${path}: this decode ran no iterations`)
      return needNumber(bp.syndromeWeights[Math.min(i, bp.syndromeWeights.length) - 1], path)
    }
    case 'iteration': {
      const bp = need(g && g.bp, path)
      if (bp.iteration === null) throw new Error(`${path}: this decode never converged, so no iteration reached a codeword`)
      return bp.iteration
    }
    case 'converged':
      return needNumber(need(g && g.bp, path).converged ? 1 : 0, path)
    case 'iterations':
      return need(g && g.bp && g.bp.iterations.length, path)

    // ---- the coding gain ----
    case 'gain': {
      const key = rest[0]
      // The asymptotic gains are a property of the code, and Groups C and D
      // read them without a pair of curves. `gain.soft` means the same thing
      // on every screen of the lab (STYLE.md S11).
      if (key === 'soft' && !x.gain) return need(v ? v.gain : b && 10 * Math.log10(b.rate * b.d), path)
      if (key === 'hard' && !x.gain) return need(b && 10 * Math.log10(b.rate * (b.t + 1)), path)
      const g = need(x.gain, path)
      if (key === 'soft') return needNumber(g.rate && g.dFree ? 10 * Math.log10(g.rate * g.dFree) : 10 * Math.log10(g.rate * g.d), path)
      if (key === 'hard') return needNumber(10 * Math.log10(g.rate * (g.t + 1)), path)
      if (key === 'real') return needNumber(g.real, path)
      if (key === 'asymptotic') return needNumber(g.asymptotic, path)
      if (key === 'difference') return needNumber(g.difference, path)
      if (key === 'coded') return needNumber(g.atCoded, path)
      if (key === 'uncoded') return needNumber(g.atUncoded, path)
      if (key === 'limit') return needNumber(g.limitDb, path)
      if (key === 'gap') return needNumber(g.gap, path)
      if (key === 'crossover') return need(g.crossoverDb, path)
      if (key === 'crossber') return need(g.crossoverBer, path)
      if (key === 'codedat') return need(g.codedAt, path)
      if (key === 'uncodedat') return need(g.uncodedAt, path)
      if (key === 'atsoft') return needNumber(g.atSoft, path)
      if (key === 'athard') return needNumber(g.atHard, path)
      if (key === 'softover') return needNumber(g.softOver, path)
      if (key === 'rate') return need(g.rate, path)
      if (key === 'target') return need(g.target, path)
      if (key === 'efficiency') return need(g.efficiency, path)
      if (key === 'dfree') return need(g.dFree, path)
      if (key === 'd') return need(g.d, path)
      if (key === 't') return needNumber(g.t, path)
      throw new Error(`${path}: the gain has no reading called "${key}"`)
    }
    case 'chain': {
      const c = need(x.chain, path)
      if (rest[0] === 'soft') return needNumber(c.softErrors, path)
      if (rest[0] === 'hard') return needNumber(c.hardErrors, path)
      if (rest[0] === 'flips') return needNumber(c.flips, path)
      if (rest[0] === 'bits') return need(c.bits.length, path)
      if (rest[0] === 'sent') return need(c.sent.bits.length, path)
      if (rest[0] === 'ebn0') return needNumber(c.ebN0Db, path)
      throw new Error(`${path}: the chain reads its soft errors, its hard errors, its flips or its counts`)
    }

    // ---- the curve ----
    case 'curve': {
      const curve = need(x.curve, path)
      if (rest[0] === 'mark') return need(curve.mark && curve.mark.y, path)
      // A curve made of counted blocks knows how many bits it counted over.
      if (rest[0] === 'bits') return need(curve.counts && curve.counts.bits, path)
      if (rest[0] === 'floor') return needNumber(curve.floor, path)
      const at = Number(rest[0])
      const point = curve.points.find((q) => Math.abs(q.x - at) < 1e-9)
      if (!point) throw new Error(`${path}: the curve has no point at x = ${at}`)
      return point.y
    }
    default:
      throw new Error(`unknown quantity path: ${path}`)
  }
}

/** The block code an experiment is about, wherever it keeps it. */
const code = (x) => (x.block && x.block.code) || (x.gain && x.gain.code) || null

const valueOfBits = (v) => (v ? v.reduce((acc, b) => acc * 2 + b, 0) : null)
const weightOfBits = (v) => (v ? v.reduce((acc, b) => acc + b, 0) : null)

const need = (v, path) => {
  if (v == null) throw new Error(`${path}: this experiment did not ask for that analysis`)
  return v
}

/** The same, for a reading whose right answer can be 0. */
const needNumber = (v, path) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${path}: this experiment did not ask for that analysis`)
  return v
}

/** The three coders, for a test that recomputes a lesson's number its own way. */
export const reference = { huffman, entropy, blockedHuffman, arithmeticEncode, typicalSequence }
