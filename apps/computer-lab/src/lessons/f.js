// Group F: the memory hierarchy.

export const F_LESSONS = {
  f1: {
    see:
      'An address is cut into three parts. The low 4 bits are the offset inside a block, ' +
      'the next 2 bits are the index that picks a set, and the 26 bits above them are the tag. ' +
      'This cache holds 4 blocks in 4 sets, and a block holds 4 words. ' +
      'The reference on screen is address 256, which lands in set 0 with tag 4.',
    seeReads: [
      ['n.offsetbits', 4],
      ['n.indexbits', 2],
      ['n.tagbits', 26],
      ['n.blocks', 4],
      ['n.sets', 4],
      ['n.words', 4],
      ['word.addr', 256],
      ['n.set', 0],
      ['n.tag', 4],
    ],
    try: [
      {
        say: 'Set the block size to 4 bytes. There are now 16 sets, 4 bits of index, and 1 word in a block.',
        set: { blockBytes: 4 },
        reads: [
          ['bytes.block', 4],
          ['n.sets', 16],
          ['n.indexbits', 4],
          ['n.words', 1],
        ],
      },
      {
        say: 'Set the cache to 128 B and two way. It holds 8 blocks in 4 sets, so the index is still 2 bits.',
        set: { bytes: 128, ways: 2 },
        reads: [
          ['bytes.cache', 128],
          ['n.blocks', 8],
          ['n.sets', 4],
          ['n.indexbits', 2],
        ],
      },
      {
        say: 'Set the reference to 0. That address lands in set 0 with tag 0 and offset 0.',
        set: { step: 0 },
        reads: [
          ['n.set', 0],
          ['n.tag', 0],
          ['n.offset', 0],
        ],
      },
    ],
    why:
      'The cache has to answer one question quickly. Is this address here. ' +
      'It cannot search, so the address itself says where to look. ' +
      'The index is the part that picks the set, and it is the low bits above the offset ' +
      'so that neighbouring blocks land in different sets rather than the same one. ' +
      'The tag is whatever is left, and it is stored beside the data so the cache can tell which of the many blocks with that index it is holding. ' +
      'Nothing here is a policy. The three widths follow from the size, the block size and the associativity, ' +
      'and every one of them is a whole number of bits.',
    whyReads: [
      ['n.indexbits', 2],
      ['n.tagbits', 26],
      ['n.offsetbits', 4],
    ],
  },

  f2: {
    see:
      'The program reads eight words of an array and then a scalar, four times over. ' +
      'That is 36 references to 9 distinct addresses in 3 blocks. ' +
      'Direct mapped, the cache gives 27 hits and 9 misses, which is 75.00 %. ' +
      '3 of the misses are compulsory and 6 are conflicts.',
    seeReads: [
      ['n.refs', 36],
      ['n.addresses', 9],
      ['n.distinct', 3],
      ['n.hits', 27],
      ['n.misses', 9],
      ['share.rate', 0.75],
      ['n.compulsory', 3],
      ['n.conflict', 6],
    ],
    try: [
      {
        say: 'Set the reference to 0. It is the first touch of that block, so the miss is compulsory.',
        set: { step: 0 },
        reads: [['text.result', 'compulsory']],
      },
      {
        say: 'Set the reference to 9. The array is back and the scalar has taken its line, so this miss is a conflict.',
        set: { step: 9 },
        reads: [['text.result', 'conflict']],
      },
      {
        say: 'Switch to two way. The conflicts go, 3 misses are left, and the rate rises to 91.67 %.',
        set: { ways: 2 },
        reads: [
          ['n.conflict', 0],
          ['n.misses', 3],
          ['share.rate', 0.9166667],
        ],
      },
    ],
    why:
      'A hit rate is a count, and it belongs to the trace it was counted on. ' +
      'This one is 75.00 % for this program on this cache, and it is not a fact about caches. ' +
      'The three kinds of miss are counted rather than estimated. ' +
      'A compulsory miss is the first reference to a block, and there are 3 of them because the trace touches 3 blocks. ' +
      'A capacity miss is one a fully associative cache of the same size would also take, and the model runs that cache alongside to find them. ' +
      'The rest are conflicts, and the 6 of them here are the scalar and the array taking turns in one set.',
    whyReads: [
      ['share.rate', 0.75],
      ['n.compulsory', 3],
      ['n.distinct', 3],
      ['n.conflict', 6],
    ],
  },

  f3: {
    see:
      'The scalar at address 256 and the start of the array share an index. ' +
      'Direct mapped they take turns in one set, and the run takes 9 misses for 75.00 %. ' +
      'A second way lets both stay, so the conflict misses fall to 0 and the rate rises to 91.67 %. ' +
      'Only the 3 compulsory misses are left.',
    seeReads: [
      ['share.direct', 0.75],
      ['n.missesdirect', 9],
      ['share.here', 0.9166667],
      ['n.conflicthere', 0],
      ['n.compulsory', 3],
    ],
    try: [
      {
        say: 'Switch the program to the two arrays. Two way gives 87.50 %, and 2 misses are left in 16 references.',
        set: { program: 'thrash' },
        reads: [
          ['share.here', 0.875],
          ['n.misseshere', 2],
          ['n.refs', 16],
        ],
      },
      {
        say: 'Switch that program to direct mapped. The rate is 0.00 %, because every reference evicts the one before it.',
        set: { program: 'thrash', ways: 1 },
        reads: [
          ['share.here', 0],
          ['n.misseshere', 16],
        ],
      },
      {
        say: 'Read the conflict misses direct mapped on that trace. There are 14 of them in 16 references.',
        set: { program: 'thrash', ways: 1 },
        reads: [
          ['n.conflictdirect', 14],
          ['n.refs', 16],
        ],
      },
    ],
    why:
      'A direct-mapped cache has one place for each block, so two blocks with the same index cannot both be held. ' +
      'The two-array trace is the worst case. ' +
      'Its two arrays are 64 bytes apart, which is exactly the cache size, so every pair of references collides and the rate is 0.00 %. ' +
      'A second way gives each set two lines and both arrays fit. ' +
      'Associativity costs a comparator a way and a slower hit, and it removes only conflict misses. ' +
      'The compulsory misses are the same in every configuration, because a block has to arrive once whatever the cache does.',
    whyReads: [
      ['n.compulsory', 3],
      ['bytes.cache', 64],
    ],
    whyAlso: [
      {
        set: { program: 'thrash', ways: 1 },
        reads: [['share.here', 0]],
      },
    ],
  },

  f4: {
    see:
      'A bigger block brings its neighbours in with it. On the array trace 4-byte blocks give 58.33 %, ' +
      '8-byte blocks give 69.44 %, 16-byte blocks give 75.00 % and 32-byte blocks give 77.78 %. ' +
      'The gain shrinks each time, because a 64 B cache holds fewer blocks as each one grows. ' +
      'At the default a block holds 4 words and the cache holds 4 blocks.',
    seeReads: [
      ['bytes.four', 4],
      ['share.four', 0.5833333],
      ['bytes.eight', 8],
      ['share.eight', 0.6944444],
      ['bytes.sixteen', 16],
      ['share.sixteen', 0.75],
      ['bytes.thirtytwo', 32],
      ['share.thirtytwo', 0.7777778],
      ['bytes.cache', 64],
      ['n.words', 4],
      ['n.blocks', 4],
    ],
    try: [
      {
        say: 'Switch the program to the walk of 64 words. The same four block sizes give 0.00 %, 50.00 %, 75.00 % and 87.50 %.',
        set: { program: 'walk' },
        reads: [
          ['n.refs', 64],
          ['share.four', 0],
          ['share.eight', 0.5],
          ['share.sixteen', 0.75],
          ['share.thirtytwo', 0.875],
        ],
      },
      {
        say: 'Read the walk at 4-byte blocks. Every one of the 64 references misses, because nothing is ever reused.',
        set: { program: 'walk', blockBytes: 4 },
        reads: [
          ['share.here', 0],
          ['bytes.block', 4],
          ['n.refs', 64],
        ],
      },
      {
        say: 'Set the block size to 32 bytes on the array trace. A block now holds 8 words and the cache holds 2 of them.',
        set: { blockBytes: 32 },
        reads: [
          ['bytes.block', 32],
          ['n.words', 8],
          ['n.blocks', 2],
        ],
      },
    ],
    why:
      'A sequential walk touches each word once, in address order, so a block of n words costs one miss and gives n − 1 hits. ' +
      'Its hit rate is one less one over the words in a block, which is what the four numbers on the walk are. ' +
      'The array trace is not sequential. ' +
      'It comes back to the same eight words four times, and a scalar keeps evicting them, ' +
      'so a bigger block helps less and eventually leaves too few blocks to hold both. ' +
      'That is the trade in one picture. Spatial locality rewards a big block, ' +
      'and a cache with few blocks in it starts colliding on the ones it has.',
    whyReads: [['share.law', 0.75]],
    whyAlso: [
      {
        set: { program: 'walk' },
        reads: [
          ['share.here', 0.75],
          ['share.law', 0.75],
        ],
      },
    ],
  },

  f5: {
    see:
      'A hit costs 1 cycle and a miss costs 100 more, so the miss rate decides the average. ' +
      'Direct mapped at a 25.00 % miss rate the average access is 26 cycles. ' +
      'Two way misses 8.333 % of the time and costs 9.533333 cycles. ' +
      'A second level of 10 cycles missing 20.00 % of the time brings that 25.00 % down to 8.5 cycles.',
    seeReads: [
      ['cycles.hit', 1],
      ['cycles.penalty', 100],
      ['share.miss', 0.25],
      ['cycles.here', 26],
      ['share.misstwo', 0.0833333],
      ['cycles.two', 9.533333],
      ['cycles.l2', 10],
      ['share.l2miss', 0.2],
      ['cycles.levels', 8.5],
    ],
    try: [
      {
        say: 'Switch to two way. The average access falls to 9.533333 cycles, from the 26 cycles direct mapping costs.',
        set: { ways: 2 },
        reads: [
          ['cycles.here', 9.533333],
          ['cycles.direct', 26],
        ],
      },
      {
        say: 'Halve the miss penalty to 50 cycles. Direct mapped now costs 13.5 cycles an access.',
        set: { penalty: 50 },
        reads: [
          ['cycles.penalty', 50],
          ['cycles.here', 13.5],
        ],
      },
      {
        say: 'Read the second level at that penalty. It costs 6 cycles an access, and the first level costs 13.5 cycles.',
        set: { penalty: 50 },
        reads: [
          ['cycles.levels', 6],
          ['cycles.here', 13.5],
        ],
      },
    ],
    why:
      'The average memory access time is the hit time plus the miss rate times the penalty. ' +
      'Every term of that sum is on the page with the answer, because the answer is arithmetic rather than a measurement. ' +
      'A 25.00 % miss rate against a 100-cycle penalty puts 25 cycles of penalty into every average access. ' +
      'The 1-cycle hit is almost nothing beside them. ' +
      'That is why associativity is worth a slower hit. ' +
      'It trades 0.2 cycles on every access against 16 fewer cycles of penalty. ' +
      'A second level is the same trade again, with a cache instead of a penalty behind it.',
    whyReads: [
      ['cycles.hit', 1],
      ['share.miss', 0.25],
      ['cycles.penalty', 100],
      ['cycles.misspart', 25],
    ],
  },

  f6: {
    see:
      'A 4096 B page with 32 bits of address leaves 20 bits of page number, ' +
      'so a one-level table of four-byte entries is 4 MB for one process. ' +
      'A buffer of 64 entries reaches 256 kB of memory. ' +
      'At a 1.00 % buffer miss rate and a 40-cycle walk, a translation costs 1.4 cycles.',
    seeReads: [
      ['bytes.page', 4096],
      ['n.addressbits', 32],
      ['n.pagebits', 20],
      ['bytes.table', 4194304],
      ['n.entries', 64],
      ['bytes.reach', 262144],
      ['share.tlbmiss', 0.01],
      ['cycles.walk', 40],
      ['cycles.translate', 1.4],
    ],
    try: [
      {
        say: 'Set the page size to 16 bits. The page number is 16 bits and the table falls to 256 kB.',
        set: { pageBits: 16 },
        reads: [
          ['n.pagebits', 16],
          ['bytes.table', 262144],
        ],
      },
      {
        say: 'Read the buffer’s reach at that page size. The same 64 entries now cover 4 MB.',
        set: { pageBits: 16 },
        reads: [['bytes.reach', 4194304]],
      },
      {
        say: 'Set the buffer to 128 entries. Its reach doubles to 512 kB at the default page size.',
        set: { entries: 128 },
        reads: [
          ['n.entries', 128],
          ['bytes.reach', 524288],
        ],
      },
    ],
    why:
      'A program’s addresses are not the memory’s addresses, and something has to translate between them. ' +
      'The table that does it has one entry a page, which is why the page size decides its size. ' +
      'At 4096 B a process needs 4 MB of table, which is more than the memory this machine has, ' +
      'so real machines build the table in levels and only fill the parts they use. ' +
      'The buffer is a cache of translations, and it is why the table is not read on every access. ' +
      'Its reach is the entries times the page size, and a program that stays inside 256 kB rarely misses it. ' +
      'Everything here is counting, which is what the rest of this group has been.',
    whyReads: [
      ['bytes.page', 4096],
      ['bytes.table', 4194304],
      ['bytes.reach', 262144],
    ],
  },
}
