// Group F: the memory hierarchy.
//
// The one group that needs no processor, and the one the plan ships first. A
// hit rate here is a count over a trace the reader can see, and the trace view
// sits beside every number. The trace comes from a program's own data
// addresses wherever a program produces it, so the addresses are the ones the
// machine asked for rather than a list written by hand.

import { amat, amat2, arrayTrace, walk } from '../engine/cache.js'
import { Choice, Count, GROUPS, q } from './shared.js'

/** The data addresses a program asked for, in the order it asked. */
const dataOf = (x) => x.run.addresses.filter((a) => a.kind === 'd').map((a) => a.addr)

const SIZES = [
  { value: 32, label: '32 B' },
  { value: 64, label: '64 B' },
  { value: 128, label: '128 B' },
  { value: 256, label: '256 B' },
]
const BLOCKS = [
  { value: 4, label: '4 B' },
  { value: 8, label: '8 B' },
  { value: 16, label: '16 B' },
  { value: 32, label: '32 B' },
]
const WAYS = [
  { value: 1, label: 'direct' },
  { value: 2, label: 'two way' },
  { value: 4, label: 'four way' },
]

export const F = [
  {
    id: 'f1',
    group: GROUPS[5],
    name: 'A cache is a lookup on part of the address',
    terms: ['cache', 'tag', 'index', 'offset'],
    params: [Choice('bytes', 'Cache size', 64, SIZES), Choice('blockBytes', 'Block size', 16, BLOCKS), Choice('ways', 'Associativity', 1, WAYS), Count('step', 'Reference', 8, 0, 35)],
    program: () => 'arrayScalar',
    wants: ['run', 'cache'],
    trace: (p, x) => dataOf(x),
    cfg: (p) => ({ bytes: p.bytes, blockBytes: p.blockBytes, ways: p.ways }),
    quantities: (x) => {
      const g = x.cache.geometry
      const a = x.cache.perAccess[Math.min(x.p.step, x.cache.perAccess.length - 1)]
      return {
        'bytes.cache': q('the cache’s size', g.bytes),
        'bytes.block': q('one block', g.blockBytes),
        'n.sets': q('sets in the cache', g.sets),
        'n.blocks': q('blocks it holds', g.blocks),
        'n.indexbits': q('bits of index', g.indexBits),
        'n.offsetbits': q('bits of offset', g.offsetBits),
        'n.tagbits': q('bits of tag', g.tagBits),
        'n.words': q('words in a block', g.wordsPerBlock),
        'word.addr': q('the address at this reference', a.addr),
        'n.set': q('the set it lands in', a.set),
        'n.tag': q('its tag', a.tag),
        'n.offset': q('its offset', a.offset),
      }
    },
    main: 'cachemap',
    view: 'cachemap',
    views: ['cachemap', 'trace', 'counts'],
  },
  {
    id: 'f2',
    group: GROUPS[5],
    name: 'A hit rate is a count over a trace',
    terms: ['hitrate', 'compulsory', 'conflict', 'trace'],
    params: [Count('step', 'Reference', 8, 0, 35), Choice('ways', 'Associativity', 1, WAYS)],
    program: () => 'arrayScalar',
    wants: ['run', 'cache'],
    trace: (p, x) => dataOf(x),
    cfg: (p) => ({ bytes: 64, blockBytes: 16, ways: p.ways }),
    quantities: (x) => {
      const a = x.cache.perAccess[Math.min(x.p.step, x.cache.perAccess.length - 1)]
      return {
        'bytes.cache': q('the cache’s size', x.cache.geometry.bytes),
        'n.refs': q('references in the trace', x.cache.refs),
        'n.addresses': q('distinct addresses it names', new Set(x.trace).size),
        'n.distinct': q('distinct blocks it touches', x.cache.distinct),
        'n.hits': q('hits', x.cache.hits),
        'n.misses': q('misses', x.cache.misses),
        'share.rate': q('hit rate on this trace', x.cache.rate),
        'n.compulsory': q('misses that are compulsory', x.cache.compulsory),
        'n.conflict': q('misses that are conflicts', x.cache.conflict),
        'n.capacity': q('misses that are capacity', x.cache.capacity),
        'n.evictions': q('lines evicted', x.cache.evictions),
        'text.result': q('what this reference did', a.hit ? 'hit' : a.cause),
      }
    },
    main: 'trace',
    view: 'trace',
    views: ['trace', 'cachemap', 'counts'],
  },
  {
    id: 'f3',
    group: GROUPS[5],
    name: 'Two ways, and the conflicts go',
    terms: ['associativity', 'way', 'conflict', 'thrash'],
    params: [
      Choice('program', 'Program', 'arrayScalar', [
        { value: 'arrayScalar', label: 'array and scalar' },
        { value: 'thrash', label: 'two arrays' },
      ]),
      Choice('ways', 'Associativity', 2, WAYS),
    ],
    program: (p) => p.program,
    wants: ['run', 'cache'],
    trace: (p, x) => dataOf(x),
    cfg: (p) => ({ bytes: 64, blockBytes: 16, ways: p.ways }),
    against: () => ({ bytes: 64, blockBytes: 16, ways: 1 }),
    quantities: (x) => ({
      'bytes.cache': q('the cache’s size', x.cache.geometry.bytes),
      'share.here': q('hit rate at this associativity', x.cache.rate),
      'share.direct': q('hit rate direct mapped', x.against.rate),
      'n.conflicthere': q('conflict misses at this associativity', x.cache.conflict),
      'n.conflictdirect': q('conflict misses direct mapped', x.against.conflict),
      'n.misseshere': q('misses at this associativity', x.cache.misses),
      'n.missesdirect': q('misses direct mapped', x.against.misses),
      'n.refs': q('references in the trace', x.cache.refs),
      'n.compulsory': q('misses that are compulsory', x.cache.compulsory),
    }),
    main: 'cachemap',
    view: 'cachemap',
    views: ['cachemap', 'trace', 'program', 'counts'],
  },
  {
    id: 'f4',
    group: GROUPS[5],
    name: 'Block size buys locality, then costs it',
    terms: ['blocksize', 'spatiallocality', 'hitrate', 'trace'],
    params: [
      Choice('program', 'Program', 'arrayScalar', [
        { value: 'arrayScalar', label: 'array and scalar' },
        { value: 'walk', label: 'a walk of 64 words' },
      ]),
      Choice('blockBytes', 'Block size', 16, BLOCKS),
    ],
    program: (p) => p.program,
    wants: ['run', 'cache'],
    trace: (p, x) => dataOf(x),
    cfg: (p) => ({ bytes: 64, blockBytes: p.blockBytes, ways: 1 }),
    sweep: () => BLOCKS.map((b) => ({ bytes: 64, blockBytes: b.value, ways: 1 })),
    quantities: (x) => {
      const rate = (bytes) => x.sweep.find((s) => s.cfg.blockBytes === bytes).run.rate
      const size = (k) => x.sweep[k].cfg.blockBytes
      return {
        'bytes.cache': q('the cache’s size', x.cache.geometry.bytes),
        'bytes.block': q('one block at this setting', x.cache.geometry.blockBytes),
        'share.here': q('hit rate at this block size', x.cache.rate),
        'bytes.four': q('the smallest block the sweep runs', size(0)),
        'share.four': q('hit rate at that block size', rate(4)),
        'bytes.eight': q('the second block size', size(1)),
        'share.eight': q('hit rate at that block size', rate(8)),
        'bytes.sixteen': q('the third block size', size(2)),
        'share.sixteen': q('hit rate at that block size', rate(16)),
        'bytes.thirtytwo': q('the largest block the sweep runs', size(3)),
        'share.thirtytwo': q('hit rate at that block size', rate(32)),
        'n.words': q('words in a block at this size', x.cache.geometry.wordsPerBlock),
        'n.blocks': q('blocks the cache holds', x.cache.geometry.blocks),
        'n.refs': q('references in the trace', x.cache.refs),
        'share.law': q('one miss a block, as a rate', 1 - 1 / x.cache.geometry.wordsPerBlock),
      }
    },
    main: 'trace',
    view: 'trace',
    views: ['trace', 'cachemap', 'counts'],
  },
  {
    id: 'f5',
    group: GROUPS[5],
    name: 'The miss penalty is the whole story',
    terms: ['accesstime', 'penalty', 'secondlevel', 'hitrate'],
    params: [Count('penalty', 'Miss penalty', 100, 10, 200), Choice('ways', 'Associativity', 1, WAYS)],
    program: () => 'arrayScalar',
    wants: ['run', 'cache'],
    trace: (p, x) => dataOf(x),
    cfg: (p) => ({ bytes: 64, blockBytes: 16, ways: p.ways }),
    against: () => ({ bytes: 64, blockBytes: 16, ways: 2 }),
    against2: () => ({ bytes: 64, blockBytes: 16, ways: 1 }),
    amat: (p, x) => ({
      here: amat({ missRate: x.cache.missRate, penalty: p.penalty, hitPenalty: p.ways > 1 ? 0.2 : 0 }),
      direct: amat({ missRate: x.against2.missRate, penalty: p.penalty }),
      two: amat({ missRate: x.against.missRate, penalty: p.penalty, hitPenalty: 0.2 }),
      levels: amat2({ missRate: 0.25, l2Time: 10, l2MissRate: 0.2, penalty: p.penalty }),
    }),
    quantities: (x) => ({
      'bytes.cache': q('the cache’s size', x.cache.geometry.bytes),
      'cycles.here': q('access time at this setting', x.amat.here.cycles),
      'cycles.misspart': q('the misses’ share of that access time', x.amat.here.missRate * x.amat.here.penalty),
      'cycles.direct': q('access time direct mapped', x.amat.direct.cycles),
      'cycles.two': q('access time two way', x.amat.two.cycles),
      'cycles.levels': q('access time with a second level', x.amat.levels.cycles),
      'cycles.penalty': q('the miss penalty', x.p.penalty),
      'cycles.l2': q('the second level’s own time', x.amat.levels.l2Time),
      'share.miss': q('miss rate at this setting', x.cache.missRate),
      'share.misstwo': q('miss rate two way', x.against.missRate),
      'share.l2miss': q('of second-level accesses that miss', x.amat.levels.l2MissRate),
      'cycles.hit': q('a hit', x.amat.here.hitTime),
    }),
    main: 'counts',
    view: 'counts',
    views: ['counts', 'trace', 'cachemap'],
  },
  {
    id: 'f6',
    group: GROUPS[5],
    name: 'Addresses that are not addresses',
    terms: ['virtualmemory', 'page', 'pagetable', 'translationbuffer'],
    params: [Count('pageBits', 'Page size, in bits', 12, 8, 16), Count('entries', 'Buffer entries', 64, 8, 256)],
    program: () => 'arrayScalar',
    wants: ['run', 'cache'],
    trace: (p, x) => dataOf(x),
    cfg: () => ({ bytes: 64, blockBytes: 16, ways: 1 }),
    pages: (p) => ({ pageBytes: 2 ** p.pageBits, tlbEntries: p.entries, tlbMissRate: 0.01, walkCycles: 40 }),
    quantities: (x) => ({
      'bytes.page': q('one page', x.pages.pageBytes),
      'n.pagebits': q('bits of page number', x.pages.numberBits),
      'n.addressbits': q('bits in an address', x.pages.pageBits + x.pages.numberBits),
      'bytes.table': q('a one-level page table', x.pages.tableBytes),
      'n.entries': q('entries in the buffer', x.pages.tlbEntries),
      'bytes.reach': q('memory the buffer reaches', x.pages.reachBytes),
      'cycles.translate': q('what a translation costs', x.pages.cycles),
      'cycles.walk': q('what a walk costs when the buffer misses', x.pages.walkCycles),
      'share.tlbmiss': q('of translations that miss the buffer', x.pages.tlbMissRate),
    }),
    main: 'counts',
    view: 'counts',
    views: ['counts', 'trace'],
  },
]
