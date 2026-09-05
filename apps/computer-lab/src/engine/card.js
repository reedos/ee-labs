// The model card: two unit delays, and everything else a multiple of them.
//
// Decision 5 of the plan says where these numbers come from. The gate delays
// are quoted from the VLSI Lab's model card, and until that lab is built they
// are stated here as this lab's own card and pinned as functions of the two
// unit values. Every delay in the lab is `gate` or `inverter` times a whole
// number, so changing either one moves every number in every lesson.
//
// The time grid is 10 fs rather than the picosecond `@ee-labs/events` defaults
// to. A NAND2 driving one NAND2 input takes 37.65 ps, which is not a whole
// picosecond, and the engine takes an exact rational unit for that case. On a
// grid of one hundred-trillionth of a second the same delay is the integer
// 3765, and no addition of times rounds.
//
// The block delays are stated in gate delays, which is how a computer
// organisation course states them. A memory access is 12 gate delays whatever
// a gate costs, and that ratio is the part of the lesson that survives a
// change of process.

/** The time grid: 10 fs, as the exact rational number of seconds events takes. */
export const UNIT = { num: 1, den: 1e14 }

/** Units of the grid in one picosecond. */
export const PER_PS = 100

/**
 * The card. Times are in grid units, block delays are in gate delays.
 *
 * `gate` is the delay of a NAND2 driving one NAND2 input, which is the unit
 * every combinational number in the lab is counted in. `inverter` is an
 * inverter driving one inverter, and `fo4` the same inverter driving four.
 */
export const CARD = {
  gate: 3765,
  inverter: 2259,
  fo4: 5647,
  tcq: 5273,
  tsu: 3013,
  th: 2260,
  /** Every block of the datapath, in gate delays. */
  blocks: {
    imem: 12,
    dmem: 12,
    rfRead: 8,
    rfWrite: 4,
    // The lookahead carry path of the ALU. The output multiplexer is charged
    // separately as `mux2`, because A3's lesson is that the multiplexer costs
    // on every operation and not only on an addition.
    aluCarry: 8,
    mux2: 2,
    control: 3,
    signExtend: 1,
  },
  /** The instruction mix the cycles-per-instruction arithmetic is stated over. */
  mix: { arith: 0.45, load: 0.25, store: 0.1, branch: 0.15, jump: 0.05 },
  /**
   * The hazard rates that arithmetic is stated over. `loadUse` is the share of
   * loads whose value is used by the next instruction. `taken` is the share of
   * branches that are taken. `dep1` and `dep2` are the shares of instructions
   * that read a register written one and two instructions earlier.
   */
  rates: { loadUse: 0.4, taken: 0.6, dep1: 0.3, dep2: 0.15 },
  /** Amdahl's law needs a profile. These two shares are stated, and G3 turns them. */
  profile: { adder: 0.2, memory: 0.35 },
}

/** `n` gate delays, in grid units. */
export const gates = (n, card = CARD) => n * card.gate

/** Grid units in picoseconds. */
export const psOf = (units) => units / PER_PS

/** Grid units in seconds. */
export const secondsOf = (units) => (units * UNIT.num) / UNIT.den

/** A period in grid units as a frequency in hertz. */
export const hzOf = (units) => 1 / secondsOf(units)

/**
 * The delay overrides an `@ee-labs/events` netlist takes, so that a netlist
 * built here is timed by the engine at this card's delays rather than at the
 * Logic Lab's library values.
 *
 * Every two-input gate is one gate delay, which is what "gate delay" means in
 * a computer organisation course. An exclusive-or is two, because it is two
 * levels of them. An inverter has its own number, which is smaller.
 */
export function libOf(card = CARD) {
  const g = card.gate
  return {
    not: { 1: card.inverter },
    buf: { 1: card.inverter },
    and: { 2: g, 3: g, 4: g },
    or: { 2: g, 3: g, 4: g },
    nand: { 2: g, 3: g, 4: g },
    nor: { 2: g, 3: g, 4: g },
    xor: { 2: 2 * g, 3: 4 * g },
    xnor: { 2: 2 * g, 3: 4 * g },
  }
}

/** The flip-flop's overhead on every clock period: clock-to-Q plus setup. */
export const overheadOf = (card = CARD) => card.tcq + card.tsu

/**
 * Every path the single-cycle machine has, in gate delays, by instruction
 * class. Each is the blocks the instruction walks through, named in order.
 */
export function singleCyclePaths(card = CARD) {
  const b = card.blocks
  return {
    arith: { gates: b.imem + b.rfRead + b.mux2 + b.aluCarry + b.mux2, through: ['imem', 'rfRead', 'mux2', 'aluCarry', 'mux2'] },
    load: { gates: b.imem + b.rfRead + b.mux2 + b.aluCarry + b.dmem + b.mux2, through: ['imem', 'rfRead', 'mux2', 'aluCarry', 'dmem', 'mux2'] },
    store: { gates: b.imem + b.rfRead + b.mux2 + b.aluCarry + b.dmem, through: ['imem', 'rfRead', 'mux2', 'aluCarry', 'dmem'] },
    branch: { gates: b.imem + b.rfRead + b.aluCarry + b.mux2, through: ['imem', 'rfRead', 'aluCarry', 'mux2'] },
    jump: { gates: b.imem + b.mux2, through: ['imem', 'mux2'] },
  }
}

/** The five pipeline stages, in gate delays, and what sits in each. */
export function stageLogic(card = CARD) {
  const b = card.blocks
  return {
    fetch: { gates: b.imem, through: ['imem'] },
    decode: { gates: b.rfRead, through: ['rfRead'] },
    execute: { gates: b.mux2 + b.aluCarry, through: ['mux2', 'aluCarry'] },
    memory: { gates: b.dmem, through: ['dmem'] },
    writeback: { gates: b.mux2 + b.rfWrite, through: ['mux2', 'rfWrite'] },
  }
}

export const STAGES = ['fetch', 'decode', 'execute', 'memory', 'writeback']
export const STAGE_LABEL = { fetch: 'IF', decode: 'ID', execute: 'EX', memory: 'MEM', writeback: 'WB' }

/**
 * Every timing number the lab quotes, in grid units unless the name says
 * otherwise. One object, computed from the card, so the topbar, a lesson and a
 * test can never disagree about a period.
 */
export function timingOf(card = CARD) {
  const overhead = overheadOf(card)
  const paths = singleCyclePaths(card)
  const stages = stageLogic(card)
  const single = {}
  for (const [k, v] of Object.entries(paths)) single[k] = { ...v, logic: gates(v.gates, card), delay: gates(v.gates, card) + overhead }
  const stage = {}
  for (const k of STAGES) stage[k] = { ...stages[k], logic: gates(stages[k].gates, card), delay: gates(stages[k].gates, card) + overhead }

  const singlePeriod = Math.max(...Object.values(single).map((s) => s.delay))
  const critical = Object.entries(single).find(([, s]) => s.delay === singlePeriod)[0]
  const pipePeriod = Math.max(...STAGES.map((k) => stage[k].delay))
  const slowest = STAGES.find((k) => stage[k].delay === pipePeriod)
  const fastest = STAGES.reduce((a, k) => (stage[k].delay < stage[a].delay ? k : a), STAGES[0])
  const totalLogic = STAGES.reduce((sum, k) => sum + stage[k].logic, 0)
  // The multicycle clock is set by the slowest block rather than by the longest
  // path, which is the whole of D3's claim.
  const slowestBlock = Math.max(...Object.values(card.blocks).map((n) => gates(n, card)))

  return {
    card,
    overhead,
    single,
    stage,
    singlePeriod,
    critical,
    singleFreq: hzOf(singlePeriod),
    pipePeriod,
    pipeFreq: hzOf(pipePeriod),
    slowest,
    fastest,
    slack: pipePeriod - stage[fastest].delay,
    overheadShare: overhead / pipePeriod,
    evenPeriod: totalLogic / STAGES.length + overhead,
    totalLogic,
    latency: STAGES.length * pipePeriod,
    latencyRatio: (STAGES.length * pipePeriod) / singlePeriod,
    throughput: singlePeriod / pipePeriod,
    multiPeriod: slowestBlock + overhead,
    // The share of the single-cycle period the two memories take, which is B3.
    memoryShare: (gates(card.blocks.imem, card) + gates(card.blocks.dmem, card)) / singlePeriod,
    waste: (singlePeriod - single.arith.delay) / singlePeriod,
  }
}
