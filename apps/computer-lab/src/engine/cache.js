// The cache, as a count over a trace.
//
// There is no time in this model. A cache is a lookup on part of an address,
// and a hit rate is how often that lookup found what it was asked for. Both are
// counts over the address list the reader can see, and the trace view sits
// beside every number this file produces.
//
// A hit rate is exact for its trace, and it is not a prediction about any other
// program (plan §2.7). Nothing here is approximated and nothing is declined,
// which is what makes this the simplest object in the whole map.
//
// The three kinds of miss are counted rather than estimated. A compulsory miss
// is the first reference to a block. A capacity miss is a miss that a fully
// associative cache of the same size would also take, so the model runs that
// cache alongside the real one and reads the answer off it. A conflict miss is
// what is left. That is the definition, rather than a rule of thumb.

/** The address splits into a tag, an index and an offset. This is where. */
export function geometryOf(cfg) {
  const { bytes, blockBytes, ways = 1 } = cfg
  if (!isPow2(blockBytes)) throw new Error(`a block is a power of two bytes, and ${blockBytes} is not one`)
  const blocks = bytes / blockBytes
  if (!Number.isInteger(blocks) || blocks < 1) throw new Error(`a ${bytes} byte cache holds no whole ${blockBytes} byte blocks`)
  if (blocks % ways) throw new Error(`${blocks} blocks do not divide into ${ways} ways`)
  const sets = blocks / ways
  // The index is the low bits of the block number, so the number of sets is a
  // power of two. The number of ways is not, which is how a three-way cache
  // gets built (F2's replacement policies, and Belady's anomaly).
  if (!isPow2(sets)) throw new Error(`${blocks} blocks in ${ways} ways is ${sets} sets, and an index of whole bits needs a power of two`)
  return {
    bytes,
    blockBytes,
    ways,
    blocks,
    sets,
    offsetBits: Math.log2(blockBytes),
    indexBits: Math.log2(sets),
    tagBits: 32 - Math.log2(sets) - Math.log2(blockBytes),
    wordsPerBlock: blockBytes / 4,
  }
}

const isPow2 = (n) => Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0

/** Where one address lands, given the geometry. */
export function splitOf(addr, geo) {
  const block = Math.floor(addr / geo.blockBytes)
  return {
    addr,
    block,
    offset: addr % geo.blockBytes,
    set: block % geo.sets,
    tag: Math.floor(block / geo.sets),
  }
}

/** A trace entry, whichever of the two shapes the caller passed. */
const entryOf = (e) => (typeof e === 'number' ? { addr: e, kind: 'read' } : { addr: e.addr, kind: e.kind === 'd' ? 'read' : e.kind || 'read' })

/**
 * Run `trace` through one cache configuration.
 *
 * @param trace  [{ addr, kind }] or a plain list of addresses
 * @param cfg    { bytes, blockBytes, ways, policy, write, allocate }
 * @returns {{ hits, misses, rate, compulsory, capacity, conflict, evictions,
 *             writebacks, geometry, perAccess }}
 */
export function cacheRun(trace, cfg) {
  const geo = geometryOf(cfg)
  const policy = cfg.policy || 'lru'
  if (!['lru', 'fifo'].includes(policy)) throw new Error(`this model replaces by lru or fifo, and not by "${policy}"`)
  const writeBack = (cfg.write || 'back') === 'back'
  const allocate = cfg.allocate !== false
  const entries = trace.map(entryOf)

  // The fully associative cache of the same size, run beside the real one. A
  // miss it also takes is a capacity miss, by definition.
  const full = geo.ways === geo.blocks ? null : new Sim(geometryOf({ bytes: cfg.bytes, blockBytes: cfg.blockBytes, ways: geo.blocks }), policy, allocate, writeBack)
  const sim = new Sim(geo, policy, allocate, writeBack)

  const perAccess = []
  const seen = new Set()
  let hits = 0
  let compulsory = 0
  let capacity = 0
  let conflict = 0
  for (const e of entries) {
    const s = splitOf(e.addr, geo)
    const out = sim.access(s, e.kind)
    const alsoMissed = full ? !full.access(splitOf(e.addr, full.geo), e.kind).hit : false
    let cause = null
    if (out.hit) hits++
    else if (!seen.has(s.block)) {
      cause = 'compulsory'
      compulsory++
    } else if (full ? alsoMissed : true) {
      cause = 'capacity'
      capacity++
    } else {
      cause = 'conflict'
      conflict++
    }
    seen.add(s.block)
    perAccess.push({ ...s, kind: e.kind, hit: out.hit, cause, evicted: out.evicted, wroteBack: out.wroteBack, way: out.way })
  }
  const misses = entries.length - hits
  return {
    geometry: geo,
    policy,
    hits,
    misses,
    refs: entries.length,
    rate: entries.length ? hits / entries.length : 0,
    missRate: entries.length ? misses / entries.length : 0,
    compulsory,
    capacity,
    conflict,
    evictions: sim.evictions,
    writebacks: sim.writebacks,
    distinct: seen.size,
    perAccess,
  }
}

/** One cache, as an array of sets of lines. */
class Sim {
  constructor(geo, policy, allocate, writeBack) {
    this.geo = geo
    this.policy = policy
    this.allocate = allocate
    this.writeBack = writeBack
    this.sets = Array.from({ length: geo.sets }, () => [])
    this.evictions = 0
    this.writebacks = 0
    this.clock = 0
  }

  access(s, kind) {
    this.clock++
    const set = this.sets[s.set]
    const line = set.find((l) => l.tag === s.tag)
    if (line) {
      if (this.policy === 'lru') line.used = this.clock
      if (kind === 'write') {
        if (this.writeBack) line.dirty = true
        else this.writebacks++
      }
      return { hit: true, evicted: null, wroteBack: false, way: set.indexOf(line) }
    }
    if (kind === 'write' && !this.allocate) {
      this.writebacks++
      return { hit: false, evicted: null, wroteBack: true, way: null }
    }
    let evicted = null
    let wroteBack = false
    if (set.length === this.geo.ways) {
      // Least recently used, or first in first out. Both read the same field,
      // and the difference is whether a hit refreshes it.
      let victim = 0
      for (let i = 1; i < set.length; i++) if (set[i].used < set[victim].used) victim = i
      evicted = { tag: set[victim].tag, block: set[victim].block }
      if (set[victim].dirty) {
        this.writebacks++
        wroteBack = true
      }
      set.splice(victim, 1)
      this.evictions++
    }
    set.push({ tag: s.tag, block: s.block, used: this.clock, dirty: kind === 'write' && this.writeBack })
    if (kind === 'write' && !this.writeBack) this.writebacks++
    return { hit: false, evicted, wroteBack, way: set.length - 1 }
  }
}

/**
 * The average memory access time, in cycles.
 *
 * Hit time plus the hit penalty an associative lookup costs, plus the miss rate
 * times the penalty. Every term is on screen with the answer, because the
 * answer is a sum and not a measurement.
 */
export function amat({ hitTime = 1, hitPenalty = 0, missRate, penalty }) {
  return { hitTime, hitPenalty, missRate, penalty, cycles: hitTime + hitPenalty + missRate * penalty }
}

/** The same with a second level, whose miss rate is local to that level. */
export function amat2({ hitTime = 1, missRate, l2Time, l2MissRate, penalty }) {
  const l2 = l2Time + l2MissRate * penalty
  return { hitTime, missRate, l2Time, l2MissRate, penalty, l2, cycles: hitTime + missRate * l2 }
}

/**
 * Virtual memory, as three numbers (F6).
 *
 * A page table is one entry per page of the address space. A translation buffer
 * reaches as far as the pages it holds. Translation costs a lookup plus the
 * share of walks the buffer misses.
 */
export function pagingOf({ pageBytes = 4096, addressBits = 32, entryBytes = 4, tlbEntries = 64, tlbMissRate = 0.01, walkCycles = 40 }) {
  const pageBits = Math.log2(pageBytes)
  const numberBits = addressBits - pageBits
  return {
    pageBytes,
    pageBits,
    numberBits,
    entries: 2 ** numberBits,
    tableBytes: 2 ** numberBits * entryBytes,
    tlbEntries,
    reachBytes: tlbEntries * pageBytes,
    tlbMissRate,
    walkCycles,
    cycles: 1 + tlbMissRate * walkCycles,
  }
}

/** A trace as an address list, from a stated stride and count. */
export const walk = (words, { base = 0, stride = 4 } = {}) => Array.from({ length: words }, (_, i) => base + i * stride)

/**
 * The trace Group F is about: an array of eight words at address 0, then one
 * scalar at address 256, four times over. Thirty-six references to nine
 * distinct addresses, and every cache number in the lab names it.
 */
export function arrayTrace({ words = 8, scalar = 256, passes = 4, base = 0 } = {}) {
  const out = []
  for (let k = 0; k < passes; k++) {
    for (let i = 0; i < words; i++) out.push(base + i * 4)
    out.push(scalar)
  }
  return out
}

/**
 * Two arrays whose blocks share an index, read alternately. A direct-mapped
 * cache evicts one for the other on every reference, and a second way holds
 * both.
 */
export function thrashTrace({ a = 0, b = 64, words = 4, passes = 2 } = {}) {
  const out = []
  for (let k = 0; k < passes; k++) for (let i = 0; i < words; i++) out.push(a + i * 4, b + i * 4)
  return out
}
