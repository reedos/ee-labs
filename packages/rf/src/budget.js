// The chain as a budget: the block record, the cascade walk, and the levels.
//
// `SYSTEM_LAB_PLAN.md` Decision 3 puts this module in `@ee-labs/rf` rather than
// in a package of its own, because the RF Lab's Groups F and G and the System
// Lab's Groups B to D are the same formulas. Two copies would drift.
//
// CORE_SCOPE class, object by object, as `index.js` requires of every object in
// this package.
//
//   EXACT, and never hedged:
//     the block record, which is four numbers per block. The cumulative gain,
//     which is a sum in decibels. The noise figure of a passive block at a
//     stated physical temperature, F = 1 + (L − 1) T/T_0. Friis's cascaded
//     noise figure over available gains. The noise floor kTB. The level walk in
//     decibels. Each block's share of a budget, which is one term over the sum
//     of the terms. The DC power total.
//
//   APPROXIMATE, and carrying its guard:
//     the cascaded input IP3. Each stage's third-order product is added as a
//     voltage with its phase aligned, which is the worst case rather than the
//     answer. `cascade` returns the power-addition total beside the aligned one
//     and labels which rule produced which, so the worst case is never quoted
//     alone. `SYSTEM_LAB_PLAN.md` §5 C4 adds the random-phase rule, and
//     `IIP3_RULES` names the two that are built.
//
//   DECLINED, with the reason as content:
//     the DC power of a block that does not state one. It is `null` and reads
//     as unknown. `cascade` returns `powerMw` of `null` and lists the blocks
//     whose power is unknown, so a total is refused rather than quoted low.
//     A passive block with gain above zero is refused by name, because the
//     temperature form of its noise figure describes a loss and nothing else.
//
// See /CORE_SCOPE.md and /SYSTEM_LAB_PLAN.md §2.2, which is this table budget
// by budget.

import { RfError, require_ } from './const.js'

/** The reference temperature every noise figure is quoted against, in kelvin. */
export const T0 = 290

/** Boltzmann's constant, exact in the SI since 2019, in joules per kelvin. */
export const BOLTZMANN = 1.380649e-23

/**
 * The available noise power density of a matched resistor at T_0, in dBm/Hz.
 *
 * Computed from the constant and the temperature rather than typed as −174.
 * It is −173.975 dBm/Hz, and the four figures matter: over 20.00 MHz the
 * rounding is worth 0.025 dB and a reader comparing two labs will find it.
 */
export const KT0_DBM_HZ = 10 * Math.log10(BOLTZMANN * T0 * 1000)

/** A power ratio from decibels, and back. Powers, so ten times the logarithm. */
export const fromDbPower = (db) => Math.pow(10, db / 10)
export const toDbPower = (x) => 10 * Math.log10(x)

/** A power in milliwatts from dBm, and back. */
export const fromDbm = (dbm) => Math.pow(10, dbm / 10)
export const toDbm = (mw) => 10 * Math.log10(mw)

/** The two ways this module adds the stages' third-order products. */
export const IIP3_RULES = ['aligned', 'power']

/** The kinds of block that have no gain of their own and no third-order product. */
export const PASSIVE_KINDS = ['filter', 'pad', 'cable', 'switch', 'splitter']

// ------------------------------------------------------------- the record

/**
 * One block of a chain, checked and completed.
 *
 * A block is `{ id, name, kind, gainDb, nfDb, iip3Dbm, powerMw }`, and those
 * four numbers are what a systems engineer writes down before any circuit
 * exists. The lab's claim is that they predict what the chain does.
 *
 * A passive block carries `gainDb` negative, and its noise figure is computed
 * from that loss and its physical temperature rather than typed. Its input IP3
 * is `Infinity`, which the cascade arithmetic handles with no special case. A
 * block whose numbers came from a solved circuit carries `fromCircuit`, which
 * is that circuit's identifier, and `linksTo`, which is the experiment that
 * solves it.
 */
export function blockOf(spec) {
  const { id, name, kind = 'amp', gainDb, tempK = T0, fromCircuit = null, linksTo = null } = spec
  require_(typeof id === 'string' && id.length > 0, 'A block needs an id, and this one has none.', { field: 'id' })
  require_(Number.isFinite(gainDb), `Block ${id} needs a gain in decibels, and it is ${gainDb}.`, { field: 'gainDb' })
  require_(Number.isFinite(tempK) && tempK > 0, `Block ${id} needs a physical temperature above zero kelvin, and it is ${tempK}.`, { field: 'tempK' })

  const passive = PASSIVE_KINDS.includes(kind)
  if (passive) {
    require_(
      gainDb <= 0,
      `Block ${id} is a ${kind}, which has no gain of its own, and its gain is ${gainDb} dB. ` +
        'The temperature form of a passive noise figure describes a loss and nothing else.',
      { field: 'gainDb', kind: 'passive-gain' },
    )
  }

  const nfDb = spec.nfDb === undefined ? (passive ? passiveNf(-gainDb, tempK) : 0) : spec.nfDb
  require_(Number.isFinite(nfDb) && nfDb >= 0, `Block ${id} needs a noise figure at or above zero decibels, and it is ${nfDb}.`, { field: 'nfDb' })

  const iip3Dbm = spec.iip3Dbm === undefined ? (passive ? Infinity : 0) : spec.iip3Dbm
  require_(iip3Dbm === Infinity || Number.isFinite(iip3Dbm), `Block ${id} needs an input IP3 in dBm or Infinity, and it is ${iip3Dbm}.`, { field: 'iip3Dbm' })

  // A power that is not stated is unknown, never zero. A passive block draws
  // nothing, and that is a statement rather than an omission.
  const powerMw = spec.powerMw === undefined ? (passive ? 0 : null) : spec.powerMw
  require_(powerMw === null || (Number.isFinite(powerMw) && powerMw >= 0), `Block ${id} needs a DC power at or above zero milliwatts, or null for unknown, and it is ${powerMw}.`, {
    field: 'powerMw',
  })

  return { id, name: name || id, kind, gainDb, nfDb, iip3Dbm, powerMw, tempK, passive, fromCircuit, linksTo }
}

/** A whole chain, each block checked and completed. */
export const chainOf = (specs) => specs.map(blockOf)

/**
 * The noise figure of a passive block, from its loss and its physical
 * temperature, in decibels.
 *
 * A matched attenuator at temperature T has F = 1 + (L − 1) T/T_0, where L is
 * its loss as a power ratio at or above one. At the reference temperature that
 * is exactly L, so a 2.0 dB filter has a 2.0 dB noise figure. Cool the same
 * filter to 77 K and its noise figure falls to 0.6269 dB, because its output
 * noise is thermal at whatever temperature it is. `budget.test.js` pins both
 * figures, so neither can drift out of this sentence.
 */
export function passiveNf(lossDb, tempK = T0) {
  require_(Number.isFinite(lossDb) && lossDb >= 0, `A passive block's loss is a positive number of decibels, and it is ${lossDb}.`, { field: 'lossDb' })
  require_(Number.isFinite(tempK) && tempK > 0, `A physical temperature is above zero kelvin, and it is ${tempK}.`, { field: 'tempK' })
  const L = fromDbPower(lossDb)
  return toDbPower(1 + (L - 1) * (tempK / T0))
}

/**
 * The noise floor of a stated bandwidth, in dBm.
 *
 * kT_0 B in decibels, plus the noise figure. The bandwidth is the noise
 * bandwidth, and a number without its bandwidth means nothing here, so every
 * caller states one.
 */
export function noiseFloorDbm(bandwidthHz, nfDb = 0, tempK = T0) {
  require_(Number.isFinite(bandwidthHz) && bandwidthHz > 0, `A noise bandwidth is above zero hertz, and it is ${bandwidthHz}.`, { field: 'bandwidthHz' })
  require_(Number.isFinite(tempK) && tempK > 0, `A noise temperature is above zero kelvin, and it is ${tempK}.`, { field: 'tempK' })
  return 10 * Math.log10(BOLTZMANN * tempK * 1000) + 10 * Math.log10(bandwidthHz) + nfDb
}

// ------------------------------------------------------------- the walk

/**
 * The cascade, walked once, with every accumulator.
 *
 * `SYSTEM_LAB_PLAN.md` §2.4 asks for one function with several accumulators
 * rather than three walks, and this is it. At every step the walk records the
 * cumulative gain, the cumulative noise figure, the cumulative input IP3 and
 * the block's own share of each budget. The share is what makes a budget a
 * design tool rather than a total: it names the block to change.
 *
 * The noise share of block k is (F_k − 1)/G_{k−1} over the sum of those terms.
 * The IP3 share is G_{k−1}/A_k over the sum of those, with A the input IP3 as a
 * power ratio. A passive block's term is zero, because its input IP3 is
 * infinite.
 */
export function cascade(blocks) {
  const list = blocks.map((b) => (b.passive === undefined ? blockOf(b) : b))

  let gain = 1
  let f = 1
  let ip3Aligned = 0
  let ip3Power = 0
  let powerMw = 0
  const unknownPower = []

  const walked = list.map((b, index) => {
    const gainBefore = gain
    const fTerm = (fromDbPower(b.nfDb) - 1) / gainBefore
    const ip3Term = b.iip3Dbm === Infinity ? 0 : gainBefore / fromDbm(b.iip3Dbm)

    f += fTerm
    ip3Aligned += ip3Term
    ip3Power += ip3Term * ip3Term
    gain *= fromDbPower(b.gainDb)
    if (b.powerMw === null) unknownPower.push(b.id)
    else powerMw += b.powerMw

    return {
      ...b,
      index,
      gainBeforeDb: toDbPower(gainBefore),
      cumGainDb: toDbPower(gain),
      cumNfDb: toDbPower(f),
      cumIip3Dbm: ip3Aligned === 0 ? Infinity : toDbm(1 / ip3Aligned),
      fTerm,
      ip3Term,
    }
  })

  const excess = f - 1
  const iip3Dbm = ip3Aligned === 0 ? Infinity : toDbm(1 / ip3Aligned)
  const iip3PowerDbm = ip3Power === 0 ? Infinity : toDbm(1 / Math.sqrt(ip3Power))
  const totalPower = unknownPower.length ? null : powerMw

  // A share is a term over the sum of the terms, so a chain whose sum is zero
  // has no shares rather than shares of zero over zero. A chain of nothing but
  // passive blocks at absolute zero has no excess noise, and a chain of nothing
  // but passive blocks has no third-order product at all.
  const shared = walked.map((b) => ({
    ...b,
    noiseShare: excess > 0 ? b.fTerm / excess : 0,
    ip3Share: ip3Aligned > 0 ? b.ip3Term / ip3Aligned : 0,
    powerShare: totalPower > 0 && b.powerMw !== null ? b.powerMw / totalPower : 0,
  }))

  return {
    n: list.length,
    blocks: shared,
    gain,
    gainDb: toDbPower(gain),
    f,
    excess,
    nfDb: toDbPower(f),
    iip3Dbm,
    iip3PowerDbm,
    oip3Dbm: iip3Dbm + toDbPower(gain),
    powerMw: totalPower,
    unknownPower,
    rule: 'aligned',
  }
}

/**
 * Two blocks composed into the one block that behaves as they do.
 *
 * G = G_1 G_2, F = F_1 + (F_2 − 1)/G_1, 1/A = 1/A_1 + G_1/A_2, and the powers
 * add. The walk above and this closed form are two routes to the same numbers,
 * and invariants 1 and 2 hold them equal.
 */
export function combine(a, b) {
  const A = a.passive === undefined ? blockOf(a) : a
  const B = b.passive === undefined ? blockOf(b) : b
  const g1 = fromDbPower(A.gainDb)
  const f = fromDbPower(A.nfDb) + (fromDbPower(B.nfDb) - 1) / g1
  const inv = (A.iip3Dbm === Infinity ? 0 : 1 / fromDbm(A.iip3Dbm)) + (B.iip3Dbm === Infinity ? 0 : g1 / fromDbm(B.iip3Dbm))
  const powerMw = A.powerMw === null || B.powerMw === null ? null : A.powerMw + B.powerMw
  return {
    id: `${A.id}+${B.id}`,
    name: `${A.name} and ${B.name}`,
    kind: 'composite',
    gainDb: A.gainDb + B.gainDb,
    nfDb: toDbPower(f),
    iip3Dbm: inv === 0 ? Infinity : toDbm(1 / inv),
    powerMw,
    tempK: T0,
    passive: false,
    fromCircuit: null,
    linksTo: null,
  }
}

/**
 * The signal, the noise and their ratio at every node of the chain.
 *
 * Node 0 is the chain's input and node k is the output of block k, so a chain
 * of six blocks has seven nodes. The signal at node k is the input level plus
 * the cumulative gain. The noise is the floor plus the cumulative gain plus the
 * cumulative noise figure. The ratio between them is the input ratio less the
 * cumulative noise figure, so it falls along the chain and never rises.
 *
 * `driveDbm` is the level arriving at each block, and `backoffDb` is how far
 * that level sits below the block's own input IP3. The block with the least
 * backoff is the one a rising input overloads first, and it is named.
 */
export function levels(blocks, { pinDbm, bandwidthHz, tempK = T0 } = {}) {
  require_(Number.isFinite(pinDbm), `The input level is a number of dBm, and it is ${pinDbm}.`, { field: 'pinDbm' })
  const c = cascade(blocks)
  const floorDbm = noiseFloorDbm(bandwidthHz, 0, tempK)

  const nodes = [
    {
      index: 0,
      id: 'in',
      name: 'Input',
      cumGainDb: 0,
      cumNfDb: 0,
      signalDbm: pinDbm,
      noiseDbm: floorDbm,
      snrDb: pinDbm - floorDbm,
      driveDbm: pinDbm,
      backoffDb: Infinity,
    },
  ]

  let worst = null
  for (const b of c.blocks) {
    const driveDbm = pinDbm + b.gainBeforeDb
    const backoffDb = b.iip3Dbm === Infinity ? Infinity : b.iip3Dbm - driveDbm
    if (worst === null || backoffDb < worst.backoffDb) worst = { id: b.id, name: b.name, backoffDb, driveDbm }
    nodes.push({
      index: b.index + 1,
      id: b.id,
      name: b.name,
      cumGainDb: b.cumGainDb,
      cumNfDb: b.cumNfDb,
      signalDbm: pinDbm + b.cumGainDb,
      noiseDbm: floorDbm + b.cumGainDb + b.cumNfDb,
      snrDb: pinDbm - floorDbm - b.cumNfDb,
      driveDbm,
      backoffDb,
    })
  }

  return {
    cascade: c,
    pinDbm,
    bandwidthHz,
    tempK,
    floorDbm,
    snrInDb: pinDbm - floorDbm,
    snrOutDb: pinDbm - floorDbm - c.nfDb,
    nodes,
    limits: worst,
  }
}

/**
 * The chain with one block bypassed, by id.
 *
 * Bypassing is how a reader asks what one block is worth. The block leaves the
 * list rather than being set to unity, because a block set to 0 dB with its
 * noise figure still in place is a different chain.
 */
export function bypass(blocks, id) {
  const list = blocks.map((b) => (b.passive === undefined ? blockOf(b) : b))
  if (!id) return list
  require_(
    list.some((b) => b.id === id),
    `This chain has no block called ${id}, so nothing can be bypassed. It holds ${list.map((b) => b.id).join(', ')}.`,
    { field: 'id' },
  )
  return list.filter((b) => b.id !== id)
}

/**
 * The chain with two blocks swapped, by id.
 *
 * Order is the whole of `SYSTEM_LAB_PLAN.md` §5 B3, and moving the low-noise
 * amplifier in front of the filter it sits behind is the move that group makes.
 */
export function reorder(blocks, first, second) {
  const list = blocks.map((b) => (b.passive === undefined ? blockOf(b) : b))
  const i = list.findIndex((b) => b.id === first)
  const j = list.findIndex((b) => b.id === second)
  require_(i >= 0 && j >= 0, `This chain has no block called ${i < 0 ? first : second}. It holds ${list.map((b) => b.id).join(', ')}.`, { field: 'id' })
  const out = list.slice()
  out[i] = list[j]
  out[j] = list[i]
  return out
}

/** The error type this module throws, re-exported so a caller catches one name. */
export { RfError }
