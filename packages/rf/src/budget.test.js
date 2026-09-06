import { describe, it, expect } from 'vitest'
import { RfError } from './const.js'
import { BOLTZMANN, KT0_DBM_HZ, T0, blockOf, bypass, cascade, chainOf, combine, fromDbPower, levels, noiseFloorDbm, passiveNf, reorder, toDbPower } from './budget.js'

// The budget arithmetic, against hand-computed chains (`SYSTEM_LAB_PLAN.md` §7).
//
// Nothing below compares the module against itself. Every expected value is
// either written out here as its own arithmetic, in the form a textbook states
// it, or derived from a property the formula must have. `invariants.test.js`
// covers the fuzzed properties, and this file covers the worked cases.

/** The reference chain of `SYSTEM_LAB_PLAN.md` §4.3, six blocks. */
const REFERENCE = () =>
  chainOf([
    { id: 'presel', name: 'Preselect filter', kind: 'filter', gainDb: -2 },
    { id: 'lna', name: 'Low-noise amplifier', kind: 'lna', gainDb: 15, nfDb: 1.5, iip3Dbm: -5, powerMw: 33 },
    { id: 'image', name: 'Image filter', kind: 'filter', gainDb: -2 },
    { id: 'mixer', name: 'Mixer', kind: 'mixer', gainDb: 8, nfDb: 8, iip3Dbm: 5, powerMw: 45 },
    { id: 'iffilt', name: 'IF filter', kind: 'filter', gainDb: -3 },
    { id: 'ifamp', name: 'IF amplifier', kind: 'amp', gainDb: 22, nfDb: 10, iip3Dbm: 20, powerMw: 60 },
  ])

/** Friis, written out again, term by term, so the module is checked and not echoed. */
function friisByHand(blocks) {
  let f = 1
  let g = 1
  for (const b of blocks) {
    f += (Math.pow(10, b.nfDb / 10) - 1) / g
    g *= Math.pow(10, b.gainDb / 10)
  }
  return 10 * Math.log10(f)
}

/** The cascaded input IP3, written out again, in the voltage-addition form. */
function iip3ByHand(blocks) {
  let inv = 0
  let g = 1
  for (const b of blocks) {
    if (b.iip3Dbm !== Infinity) inv += g / Math.pow(10, b.iip3Dbm / 10)
    g *= Math.pow(10, b.gainDb / 10)
  }
  return inv === 0 ? Infinity : 10 * Math.log10(1 / inv)
}

const close = (got, want, rel = 1e-12) => expect(Math.abs(got - want)).toBeLessThanOrEqual(Math.max(rel * Math.abs(want), 1e-12))

describe('the constants are computed, not memorised', () => {
  it('kT_0 is −173.975 dBm/Hz at 290 K, from Boltzmann and the temperature', () => {
    expect(BOLTZMANN * T0 * 1000).toBeCloseTo(4.0038821e-18, 24)
    close(KT0_DBM_HZ, 10 * Math.log10(1.380649e-23 * 290 * 1000))
    // The four figures, and what rounding to −174 would cost.
    expect(Number(KT0_DBM_HZ.toPrecision(6))).toBe(-173.975)
    expect(Math.abs(KT0_DBM_HZ + 174)).toBeGreaterThan(0.02)
  })

  it('the floor rises 10.000 dB for ten times the bandwidth, and 3.0103 dB for twice', () => {
    const a = noiseFloorDbm(2e5)
    close(a, KT0_DBM_HZ + 10 * Math.log10(2e5))
    close(noiseFloorDbm(2e6) - a, 10)
    close(noiseFloorDbm(4e5) - a, 10 * Math.log10(2))
  })

  it('the floor carries the noise figure it is given', () => {
    close(noiseFloorDbm(2e5, 4.5) - noiseFloorDbm(2e5), 4.5)
  })
})

describe('the noise figure of a passive block', () => {
  it('equals its loss at the reference temperature, for every loss', () => {
    for (const lossDb of [0.5, 1, 2, 3, 6, 10, 20]) close(passiveNf(lossDb, T0), lossDb)
  })

  it('falls when the block is cooled, by 1 + (L − 1) T/T_0', () => {
    for (const lossDb of [2, 6]) {
      for (const tempK of [4, 77, 150, 290, 400]) {
        const L = Math.pow(10, lossDb / 10)
        close(passiveNf(lossDb, tempK), 10 * Math.log10(1 + (L - 1) * (tempK / T0)))
      }
      expect(passiveNf(lossDb, 77)).toBeLessThan(passiveNf(lossDb, T0))
      expect(passiveNf(lossDb, 400)).toBeGreaterThan(passiveNf(lossDb, T0))
    }
  })

  it('gives the two figures this module’s own comment quotes', () => {
    // The comment over `passiveNf` names a 2 dB filter at 290 K and at 77 K,
    // and it named 0.6271 dB for the cold one, which the function has never
    // returned. A figure in a comment drifts like a figure in a note, so both
    // are pinned here.
    expect(Number(passiveNf(2, T0).toPrecision(5))).toBe(2)
    expect(Number(passiveNf(2, 77).toPrecision(4))).toBe(0.6269)
  })

  it('is zero for a lossless block at any temperature, because there is nothing to be thermal', () => {
    for (const tempK of [4, 77, 290, 400]) close(passiveNf(0, tempK), 0)
  })

  it('refuses a negative loss and a temperature at or below zero, by name', () => {
    expect(() => passiveNf(-1)).toThrow(RfError)
    expect(() => passiveNf(2, 0)).toThrow(/above zero kelvin/)
  })
})

describe('the block record', () => {
  it('computes a passive block’s noise figure from its loss rather than taking one', () => {
    const b = blockOf({ id: 'f', kind: 'filter', gainDb: -2 })
    close(b.nfDb, 2)
    expect(b.iip3Dbm).toBe(Infinity)
    expect(b.powerMw).toBe(0)
    expect(b.passive).toBe(true)
  })

  it('recomputes that noise figure from a cooled block’s own temperature', () => {
    const cold = blockOf({ id: 'f', kind: 'filter', gainDb: -2, tempK: 77 })
    close(cold.nfDb, passiveNf(2, 77))
    expect(cold.nfDb).toBeLessThan(0.63)
  })

  it('leaves an unstated DC power unknown rather than zero', () => {
    expect(blockOf({ id: 'a', kind: 'amp', gainDb: 10, nfDb: 2, iip3Dbm: 0 }).powerMw).toBe(null)
    expect(blockOf({ id: 'a', kind: 'amp', gainDb: 10, nfDb: 2, iip3Dbm: 0, powerMw: 0 }).powerMw).toBe(0)
  })

  it('refuses a passive block with gain, and says why the temperature form does not describe it', () => {
    expect(() => blockOf({ id: 'f', kind: 'filter', gainDb: 3 })).toThrow(/describes a loss/)
    expect(() => blockOf({ id: 'f', kind: 'filter', gainDb: 3 })).toThrow(RfError)
  })

  it('refuses a block with no id, no gain, a negative noise figure or a negative power', () => {
    expect(() => blockOf({ kind: 'amp', gainDb: 1 })).toThrow(/needs an id/)
    expect(() => blockOf({ id: 'a', kind: 'amp' })).toThrow(/gain in decibels/)
    expect(() => blockOf({ id: 'a', kind: 'amp', gainDb: 1, nfDb: -0.1 })).toThrow(/noise figure/)
    expect(() => blockOf({ id: 'a', kind: 'amp', gainDb: 1, nfDb: 1, powerMw: -1 })).toThrow(/DC power/)
  })
})

describe('the reference chain, against Friis by hand', () => {
  const chain = REFERENCE()
  const c = cascade(chain)

  it('adds its gains in decibels, and multiplies the same ratios', () => {
    close(c.gainDb, chain.reduce((s, b) => s + b.gainDb, 0))
    close(c.gain, chain.reduce((p, b) => p * Math.pow(10, b.gainDb / 10), 1))
  })

  it('walks the cumulative gain node by node, and each step is that block’s gain', () => {
    let running = 0
    for (const b of c.blocks) {
      running += b.gainDb
      close(b.cumGainDb, running)
    }
  })

  it('gives the noise figure Friis gives, and every partial chain gives Friis of that prefix', () => {
    close(c.nfDb, friisByHand(chain))
    for (let k = 1; k <= chain.length; k++) close(c.blocks[k - 1].cumNfDb, friisByHand(chain.slice(0, k)))
  })

  it('gives the input IP3 the voltage-addition form gives, and the output IP3 is that plus the gain', () => {
    close(c.iip3Dbm, iip3ByHand(chain))
    close(c.oip3Dbm, c.iip3Dbm + c.gainDb)
  })

  it('names the first stage as the largest noise term and the mixer as the largest IP3 term', () => {
    const worstNoise = c.blocks.reduce((a, b) => (b.noiseShare > a.noiseShare ? b : a))
    const worstIp3 = c.blocks.reduce((a, b) => (b.ip3Share > a.ip3Share ? b : a))
    const worstPower = c.blocks.reduce((a, b) => (b.powerShare > a.powerShare ? b : a))
    expect(worstNoise.id).toBe('lna')
    expect(worstIp3.id).toBe('mixer')
    expect(worstPower.id).toBe('ifamp')
  })

  it('gives the three passive blocks no third-order term at all', () => {
    for (const b of c.blocks.filter((q) => q.passive)) {
      expect(b.ip3Term).toBe(0)
      expect(b.ip3Share).toBe(0)
    }
  })

  it('totals the DC power, and the shares are each block’s power over that total', () => {
    close(c.powerMw, 33 + 45 + 60)
    for (const b of c.blocks) close(b.powerShare, b.powerMw / c.powerMw)
  })
})

describe('the power total is refused when a block does not state its power', () => {
  it('reads unknown and names the blocks, rather than totalling them as zero', () => {
    const c = cascade([
      { id: 'a', kind: 'amp', gainDb: 10, nfDb: 2, iip3Dbm: 0, powerMw: 20 },
      { id: 'b', kind: 'amp', gainDb: 10, nfDb: 4, iip3Dbm: 5 },
    ])
    expect(c.powerMw).toBe(null)
    expect(c.unknownPower).toEqual(['b'])
  })
})

describe('order, and what it costs', () => {
  const chain = REFERENCE()

  it('moving the amplifier in front of the filter improves the noise figure and worsens the IP3', () => {
    const moved = reorder(chain, 'presel', 'lna')
    const before = cascade(chain)
    const after = cascade(moved)
    expect(after.nfDb).toBeLessThan(before.nfDb)
    expect(after.iip3Dbm).toBeLessThan(before.iip3Dbm)
    // Both orders hold the same gain and the same power, because neither is an
    // ordered quantity.
    close(after.gainDb, before.gainDb)
    close(after.powerMw, before.powerMw)
    close(after.nfDb, friisByHand(moved))
  })

  it('bypassing a block shifts the cumulative gain by exactly that block’s gain', () => {
    const before = cascade(chain)
    for (const b of chain) {
      const after = cascade(bypass(chain, b.id))
      close(after.gainDb, before.gainDb - b.gainDb)
      expect(after.n).toBe(before.n - 1)
    }
  })

  it('refuses a bypass of a block the chain does not hold, and lists what it does hold', () => {
    expect(() => bypass(chain, 'nothing')).toThrow(/has no block called nothing/)
    expect(() => bypass(chain, 'nothing')).toThrow(/presel, lna/)
    expect(() => reorder(chain, 'presel', 'nothing')).toThrow(/has no block called nothing/)
  })
})

describe('the levels along the chain', () => {
  const chain = REFERENCE()
  const PIN = -80
  const B = 2e5
  const v = levels(chain, { pinDbm: PIN, bandwidthHz: B })

  it('has one node more than the chain has blocks, and the first is the input', () => {
    expect(v.nodes.length).toBe(chain.length + 1)
    expect(v.nodes[0].id).toBe('in')
    close(v.nodes[0].signalDbm, PIN)
    close(v.nodes[0].noiseDbm, v.floorDbm)
  })

  it('puts the signal at the input level plus the cumulative gain, at every node', () => {
    for (const node of v.nodes) close(node.signalDbm, PIN + node.cumGainDb)
  })

  it('puts the noise at the floor plus the cumulative gain plus the cumulative noise figure', () => {
    for (const node of v.nodes) close(node.noiseDbm, v.floorDbm + node.cumGainDb + node.cumNfDb)
  })

  it('never improves the signal-to-noise ratio along the chain', () => {
    for (let k = 1; k < v.nodes.length; k++) expect(v.nodes[k].snrDb).toBeLessThanOrEqual(v.nodes[k - 1].snrDb + 1e-12)
    close(v.snrInDb - v.snrOutDb, v.cascade.nfDb)
  })

  it('reads the drive into each block as the input plus the gain ahead of it', () => {
    for (let k = 1; k < v.nodes.length; k++) close(v.nodes[k].driveDbm, PIN + v.cascade.blocks[k - 1].gainBeforeDb)
  })

  it('names the block with the least backoff against its own input IP3', () => {
    const finite = v.nodes.slice(1).filter((n) => Number.isFinite(n.backoffDb))
    const least = finite.reduce((a, b) => (b.backoffDb < a.backoffDb ? b : a))
    expect(v.limits.id).toBe(least.id)
    close(v.limits.backoffDb, least.backoffDb)
  })

  it('widens the bandwidth and the ratio falls by exactly the decibels the bandwidth grew', () => {
    const wide = levels(chain, { pinDbm: PIN, bandwidthHz: 100 * B })
    close(v.snrOutDb - wide.snrOutDb, 20)
    close(wide.floorDbm - v.floorDbm, 20)
  })

  it('refuses an input level that is not a number, and a bandwidth at or below zero', () => {
    expect(() => levels(chain, { pinDbm: NaN, bandwidthHz: B })).toThrow(/input level/)
    expect(() => levels(chain, { pinDbm: PIN, bandwidthHz: 0 })).toThrow(/above zero hertz/)
  })
})

describe('the two addition rules for the third-order products', () => {
  const chain = REFERENCE()
  const c = cascade(chain)

  it('quotes the aligned-phase rule as the total, and labels which rule that is', () => {
    expect(c.rule).toBe('aligned')
    close(c.iip3Dbm, iip3ByHand(chain))
  })

  it('puts the power-addition total above the aligned one, because squares add to less than the square of the sum', () => {
    expect(c.iip3PowerDbm).toBeGreaterThan(c.iip3Dbm)
    let sq = 0
    let g = 1
    for (const b of chain) {
      if (b.iip3Dbm !== Infinity) sq += Math.pow(g / Math.pow(10, b.iip3Dbm / 10), 2)
      g *= Math.pow(10, b.gainDb / 10)
    }
    close(c.iip3PowerDbm, 10 * Math.log10(1 / Math.sqrt(sq)))
  })

  it('makes the two rules agree exactly when one stage has the whole of the product', () => {
    const one = cascade([
      { id: 'f', kind: 'filter', gainDb: -2 },
      { id: 'a', kind: 'amp', gainDb: 20, nfDb: 3, iip3Dbm: 0, powerMw: 10 },
    ])
    close(one.iip3PowerDbm, one.iip3Dbm)
  })
})

describe('a chain composed two blocks at a time gives the whole chain', () => {
  it('folds the reference chain by the closed form and gets the walk’s numbers', () => {
    const chain = REFERENCE()
    const folded = chain.reduce((a, b) => combine(a, b))
    const c = cascade(chain)
    close(folded.gainDb, c.gainDb)
    close(folded.nfDb, c.nfDb, 1e-11)
    close(folded.iip3Dbm, c.iip3Dbm, 1e-11)
    close(folded.powerMw, c.powerMw)
  })

  it('composes an empty chain into nothing that changes anything', () => {
    const c = cascade([])
    close(c.gainDb, 0)
    close(c.nfDb, 0)
    expect(c.iip3Dbm).toBe(Infinity)
    expect(c.powerMw).toBe(0)
    expect(c.blocks).toEqual([])
  })

  it('gives a chain of only passive blocks its total loss as its noise figure, and no IP3 at all', () => {
    const c = cascade(chainOf([
      { id: 'a', kind: 'filter', gainDb: -2 },
      { id: 'b', kind: 'filter', gainDb: -3 },
      { id: 'c', kind: 'cable', gainDb: -1.5 },
    ]))
    close(c.gainDb, -6.5)
    close(c.nfDb, 6.5, 1e-11)
    expect(c.iip3Dbm).toBe(Infinity)
    expect(c.iip3PowerDbm).toBe(Infinity)
    close(c.powerMw, 0)
  })
})

describe('the decibel helpers are the ones every reading uses', () => {
  it('round-trip through the power decibel and back', () => {
    for (const db of [-30, -2, 0, 1.5, 38]) close(toDbPower(fromDbPower(db)), db)
  })
})
