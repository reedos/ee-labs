import { describe, it, expect } from 'vitest'
import { T0, blockOf, bypass, cascade, combine, levels, noiseFloorDbm, passiveNf, reorder } from './budget.js'

// The budget invariants, fuzzed (`SYSTEM_LAB_PLAN.md` §2.9).
//
// Numbered as the plan numbers them, so a failure names the promise it broke.
// This sitting is the plan's phase 1, and its exit is invariants 1, 2, 3 and 9.
// Invariant 4 is cheap enough to fuzz here as well, and half of invariant 7 is
// checkable without the third addition rule. The rest wait for a module, and
// the closing block of this file names each one with what it waits for, so six
// green invariants are not mistaken for twelve.
//
// The hostile corners the plan lists are in the generator rather than in a
// separate test: a block with infinite input IP3, a block with zero gain, a
// chain of nothing but passive blocks, and a chain whose last block dominates
// every budget.

/** A deterministic generator, so a failure is reproducible from its seed. */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const pick = (r, lo, hi) => lo + (hi - lo) * r()

/**
 * A random chain of two to eight blocks.
 *
 * One in six chains is all passive, one in eight ends with a block that
 * dominates every budget, and roughly one block in five has exactly zero gain.
 */
function randomChain(r) {
  const n = 2 + Math.floor(r() * 7)
  const allPassive = r() < 1 / 6
  const blocks = []
  for (let k = 0; k < n; k++) {
    const passive = allPassive || r() < 0.4
    if (passive) {
      blocks.push(
        blockOf({
          id: `b${k}`,
          kind: 'filter',
          gainDb: r() < 0.2 ? 0 : -pick(r, 0.1, 20),
          tempK: r() < 0.25 ? pick(r, 4, 400) : T0,
        }),
      )
    } else {
      blocks.push(
        blockOf({
          id: `b${k}`,
          kind: 'amp',
          gainDb: r() < 0.2 ? 0 : pick(r, -5, 30),
          nfDb: pick(r, 0.2, 15),
          iip3Dbm: r() < 0.15 ? Infinity : pick(r, -25, 40),
          powerMw: r() < 0.15 ? null : pick(r, 0, 400),
        }),
      )
    }
  }
  if (!allPassive && r() < 1 / 8) {
    // A last block that dominates every budget: enormous noise figure, tiny
    // input IP3, and all of the power.
    blocks[blocks.length - 1] = blockOf({ id: 'last', kind: 'amp', gainDb: pick(r, 0, 5), nfDb: pick(r, 25, 40), iip3Dbm: pick(r, -50, -30), powerMw: pick(r, 500, 900) })
  }
  return blocks
}

const SEEDS = 240

/** Decibels are already a logarithm, so a tolerance on one is absolute and still scale free. */
const DB = 1e-9

const near = (got, want, tol, what) => expect(Math.abs(got - want), `${what}: ${got} against ${want}`).toBeLessThanOrEqual(tol)

// -------------------------------------------------------------- invariant 1

describe('invariant 1: the total does not depend on how it is computed', () => {
  it('cascading one block at a time gives the whole list’s noise figure and input IP3', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = rng(seed * 2654435761)
      const chain = randomChain(r)
      const whole = cascade(chain)
      const folded = chain.reduce((a, b) => combine(a, b))
      near(folded.gainDb, whole.gainDb, 1e-9, `seed ${seed} gain`)
      near(folded.nfDb, whole.nfDb, 1e-8, `seed ${seed} noise figure`)
      if (whole.iip3Dbm === Infinity) expect(folded.iip3Dbm, `seed ${seed} IP3`).toBe(Infinity)
      else near(folded.iip3Dbm, whole.iip3Dbm, 1e-8, `seed ${seed} input IP3`)
      if (whole.powerMw === null) expect(folded.powerMw, `seed ${seed} power`).toBe(null)
      else near(folded.powerMw, whole.powerMw, 1e-9 * Math.max(1, whole.powerMw), `seed ${seed} power`)
    }
  })
})

// -------------------------------------------------------------- invariant 2

describe('invariant 2: the cascade is associative', () => {
  it('cascading [A, B, C] equals cascading [A, the composition of B and C]', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = rng(seed * 40503 + 7)
      const chain = randomChain(r)
      // Compose a random adjacent pair and cascade the shorter list.
      const at = Math.floor(r() * (chain.length - 1))
      const grouped = [...chain.slice(0, at), combine(chain[at], chain[at + 1]), ...chain.slice(at + 2)]
      const whole = cascade(chain)
      const part = cascade(grouped)
      near(part.gainDb, whole.gainDb, 1e-9, `seed ${seed} gain`)
      near(part.nfDb, whole.nfDb, 1e-8, `seed ${seed} noise figure`)
      if (whole.iip3Dbm === Infinity) expect(part.iip3Dbm, `seed ${seed} IP3`).toBe(Infinity)
      else near(part.iip3Dbm, whole.iip3Dbm, 1e-8, `seed ${seed} input IP3`)
    }
  })
})

// -------------------------------------------------------------- invariant 3

describe('invariant 3: every block’s share of a budget closes', () => {
  it('the noise shares, the IP3 shares and the power shares each sum to one', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = rng(seed * 22695477 + 1)
      const c = cascade(randomChain(r))
      const sum = (key) => c.blocks.reduce((s, b) => s + b[key], 0)
      // A chain with no excess noise, no third-order product or no stated power
      // has no shares. Every other chain's shares close to one.
      if (c.excess > 0) near(sum('noiseShare'), 1, 1e-12, `seed ${seed} noise shares`)
      if (c.iip3Dbm !== Infinity) near(sum('ip3Share'), 1, 1e-12, `seed ${seed} IP3 shares`)
      if (c.powerMw > 0) near(sum('powerShare'), 1, 1e-12, `seed ${seed} power shares`)
      for (const b of c.blocks) {
        expect(b.noiseShare, `seed ${seed} ${b.id} noise share`).toBeGreaterThanOrEqual(0)
        expect(b.ip3Share, `seed ${seed} ${b.id} IP3 share`).toBeGreaterThanOrEqual(0)
        expect(b.powerShare, `seed ${seed} ${b.id} power share`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('a share is the term it names, so removing the block removes exactly that term', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const r = rng(seed * 69069 + 5)
      const chain = randomChain(r)
      const c = cascade(chain)
      // Only the last block can leave without changing the gain ahead of the
      // ones behind it, so the term test uses that one.
      const last = c.blocks[c.blocks.length - 1]
      const shorter = cascade(chain.slice(0, -1))
      near(c.f - shorter.f, last.fTerm, 1e-9 * Math.max(1, c.f), `seed ${seed} noise term`)
    }
  })
})

// -------------------------------------------------------------- invariant 4

describe('invariant 4: a passive block’s noise figure is its loss', () => {
  it('equals the magnitude of the gain at the reference temperature, for every random loss', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = rng(seed * 1103515245 + 12345)
      const gainDb = -pick(r, 0, 30)
      const b = blockOf({ id: 'p', kind: 'pad', gainDb })
      near(b.nfDb, -gainDb, 1e-12, `seed ${seed}`)
      // Cooled, it is strictly better, and warmed, strictly worse.
      if (gainDb < -0.01) {
        expect(passiveNf(-gainDb, T0 / 2), `seed ${seed} cooled`).toBeLessThan(b.nfDb)
        expect(passiveNf(-gainDb, T0 * 2), `seed ${seed} warmed`).toBeGreaterThan(b.nfDb)
      }
    }
  })
})

// -------------------------------------------------------------- invariant 7

describe('invariant 7: the power-addition total is never below the aligned-phase one', () => {
  it('holds for every random chain, which is the half of the bracket this sitting can state', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = rng(seed * 214013 + 2531011)
      const c = cascade(randomChain(r))
      if (c.iip3Dbm === Infinity) {
        expect(c.iip3PowerDbm, `seed ${seed}`).toBe(Infinity)
        continue
      }
      expect(c.iip3PowerDbm, `seed ${seed}: power ${c.iip3PowerDbm}, aligned ${c.iip3Dbm}`).toBeGreaterThanOrEqual(c.iip3Dbm - 1e-12)
      // The two agree only when one stage carries the whole of the product.
      const terms = c.blocks.filter((b) => b.ip3Term > 0).length
      if (terms > 1) expect(c.iip3PowerDbm, `seed ${seed} with ${terms} contributing stages`).toBeGreaterThan(c.iip3Dbm)
    }
  })
})

// -------------------------------------------------------------- invariant 9

describe('invariant 9: the levels are consistent at every node', () => {
  it('the signal is the input plus the cumulative gain, and the noise is the floor plus the gain and the noise figure', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = rng(seed * 1013904223 + 17)
      const chain = randomChain(r)
      const pinDbm = pick(r, -130, -10)
      const bandwidthHz = Math.pow(10, pick(r, 3, 8))
      const v = levels(chain, { pinDbm, bandwidthHz })
      near(v.floorDbm, noiseFloorDbm(bandwidthHz), 1e-12, `seed ${seed} floor`)
      expect(v.nodes.length, `seed ${seed} node count`).toBe(chain.length + 1)
      for (const node of v.nodes) {
        near(node.signalDbm, pinDbm + node.cumGainDb, 1e-9, `seed ${seed} signal at node ${node.index}`)
        near(node.noiseDbm, v.floorDbm + node.cumGainDb + node.cumNfDb, 1e-9, `seed ${seed} noise at node ${node.index}`)
        near(node.snrDb, node.signalDbm - node.noiseDbm, 1e-9, `seed ${seed} ratio at node ${node.index}`)
      }
      // The ratio falls along the chain and never rises, because a cumulative
      // noise figure never falls.
      for (let k = 1; k < v.nodes.length; k++) {
        expect(v.nodes[k].snrDb, `seed ${seed} ratio rose at node ${k}`).toBeLessThanOrEqual(v.nodes[k - 1].snrDb + 1e-9)
      }
      near(v.snrInDb - v.snrOutDb, v.cascade.nfDb, 1e-9, `seed ${seed} ratio lost`)
    }
  })

  it('ten times the bandwidth costs exactly 10 dB of ratio, whatever the chain', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const r = rng(seed * 8121 + 28411)
      const chain = randomChain(r)
      const narrow = levels(chain, { pinDbm: -90, bandwidthHz: 1e5 })
      const wide = levels(chain, { pinDbm: -90, bandwidthHz: 1e6 })
      near(narrow.snrOutDb - wide.snrOutDb, 10, 1e-9, `seed ${seed}`)
    }
  })
})

// ------------------------------------------------- the two orderings, fuzzed

describe('what order changes, and what it does not', () => {
  it('bypassing a block shifts the cumulative gain by exactly that block’s gain', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const r = rng(seed * 3423 + 99)
      const chain = randomChain(r)
      const before = cascade(chain)
      for (const b of chain) {
        const after = cascade(bypass(chain, b.id))
        near(after.gainDb, before.gainDb - b.gainDb, 1e-9, `seed ${seed} bypassing ${b.id}`)
      }
    }
  })

  it('swapping two blocks leaves the gain and the power alone, because neither is ordered', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const r = rng(seed * 55711 + 3)
      const chain = randomChain(r)
      const i = Math.floor(r() * chain.length)
      const j = Math.floor(r() * chain.length)
      const before = cascade(chain)
      const after = cascade(reorder(chain, chain[i].id, chain[j].id))
      near(after.gainDb, before.gainDb, 1e-9, `seed ${seed} gain`)
      if (before.powerMw !== null) near(after.powerMw, before.powerMw, 1e-9 * Math.max(1, before.powerMw), `seed ${seed} power`)
    }
  })
})

// ------------------------------------------------ what is not checked, and why

describe('the invariants this sitting cannot state', () => {
  it('names each one and the module it waits for', () => {
    // Written as a list rather than as a comment, so a reader who runs the
    // suite sees which promises are still open. `SYSTEM_LAB_PLAN.md` §2.9
    // numbers them, and §9 phases the modules.
    const waiting = {
      5: 'Friis against a simulated chain — the RF Lab’s noise sources, plan phase 2',
      6: 'the IP3 budget against two tones — packages/rf/src/linearity.js, plan phase 3',
      7: 'the third of the three addition rules, the random-phase one — plan phase 3, group C4',
      8: 'spurious-free dynamic range against the simulated product — dynamicRange, plan phase 4',
      10: 'the link budget as a sum — packages/rf/src/link.js, plan phase 5',
      11: 'free-space loss and its reciprocity — the same module, plan phase 5',
      12: 'a block whose numbers came from a solved circuit — the Electronics Lab’s engine',
    }
    expect(Object.keys(waiting).map(Number)).toEqual([5, 6, 7, 8, 10, 11, 12])
    for (const [n, why] of Object.entries(waiting)) expect(why.length, `invariant ${n}`).toBeGreaterThan(30)
  })
})
