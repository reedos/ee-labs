// The five-stage machine: the same blocks, with four sets of registers between
// them.
//
// This is a second machine and not a second answer. The values flow through
// the pipeline registers, the forwarding multiplexers choose their operands
// from those registers, and the hazard unit freezes the front of the pipe when
// it has to. Nothing here consults the single-cycle machine, which is what
// makes invariant 1 a test rather than a tautology: for every program, the two
// machines end with the same registers and the same memory.
//
// A stall is a repeated stage in the schedule and a flush is a struck-through
// row. Both are read from what the machine did, and neither is drawn from a
// formula.

import { alu, classOf, controlOf, initialState, writesTo } from './isa.js'
import { assemble } from './datapath.js'

const EMPTY = { valid: false, bubble: true, cause: 'fill' }

/**
 * An empty pipeline slot, tagged with why it is empty.
 *
 * The tag is how the cycles are accounted for. Every cycle either writes an
 * instruction back or writes a bubble back, so counting the bubbles by cause
 * as they leave the pipeline closes invariant 3 exactly: the fill at the
 * start, the stalls the hazard unit inserted, the slots a redirect threw away,
 * and the slots where there was nothing to fetch.
 */
const bubbleOf = (cause) => ({ valid: false, bubble: true, cause })

/**
 * Run a program on the five-stage machine.
 *
 * @param opts { regs, mem, words, cycles, forwarding, resolve: 'execute' | 'decode' }
 * @returns the datapath's return shape, plus `schedule`, `stallsBy` and `flushes`
 */
export function runPipeline(program, opts = {}) {
  const code = assemble(program)
  const state = initialState({ regs: opts.regs || [], mem: opts.mem || [], words: opts.words || 256 })
  const forwarding = opts.forwarding !== false
  const resolve = opts.resolve || 'execute'
  const limit = opts.cycles ?? 2000

  let ifid = bubbleOf('fill')
  let idex = bubbleOf('fill')
  let exmem = bubbleOf('fill')
  let memwb = bubbleOf('fill')
  let pc = 0
  let cycle = 0
  let retired = 0
  let stalls = 0
  let flushes = 0
  // Two different counts, and two names for them. `flushes` is how many
  // instructions were thrown away. `flushCycles` is how many fetch slots the
  // redirect wasted, which is the penalty, and it is the term invariant 3
  // needs.
  let flushCycles = 0
  // Every bubble that reaches the end of the pipeline, by what made it.
  const bubbles = { fill: 0, stall: 0, flush: 0, idle: 0 }
  const stallsBy = { loadUse: 0, data: 0, branch: 0 }
  const cells = code.map(() => [])
  const trace = []
  const addresses = []
  const forwards = []
  const redirects = []

  const inRange = (p) => p >= 0 && p >> 2 < code.length
  const seat = (index, stage, bubble = false) => {
    if (index == null) return
    cells[index].push({ cycle, stage, bubble })
  }

  while (cycle < limit) {
    const busy = ifid.valid || idex.valid || exmem.valid || memwb.valid || inRange(pc)
    if (!busy) break

    // Write back first, so the register file's write reaches a read in the same
    // cycle. That is the standard half-cycle write, and B2 measures it.
    if (memwb.valid && memwb.regWrite && memwb.writeReg !== 0) state.regs[memwb.writeReg] = memwb.writeData | 0

    // Memory.
    const nextMemwb = exmem.valid
      ? {
          valid: true,
          index: exmem.index,
          instr: exmem.instr,
          regWrite: exmem.regWrite,
          writeReg: exmem.writeReg,
          memToReg: exmem.memToReg,
          aluResult: exmem.aluResult,
          memReadData: exmem.memRead ? state.mem[exmem.aluResult >> 2] ?? 0 : 0,
        }
      : bubbleOf(exmem.cause)
    if (exmem.valid) {
      if (exmem.memRead || exmem.memWrite) addresses.push({ cycle, kind: 'd', addr: exmem.aluResult })
      if (exmem.memWrite) state.mem[exmem.aluResult >> 2] = exmem.writeValue | 0
      nextMemwb.writeData = exmem.memToReg ? nextMemwb.memReadData : exmem.aluResult
      seat(exmem.index, 'memory')
    }

    // Execute, with the forwarding multiplexers in front of the ALU.
    let nextExmem = bubbleOf(idex.cause)
    let taken = false
    let branchTarget = null
    if (idex.valid) {
      const pick = (regNo, base) => {
        if (!forwarding || regNo === 0) return { value: base, from: 'register file' }
        if (exmem.valid && exmem.regWrite && exmem.writeReg === regNo && exmem.writeReg !== 0) return { value: exmem.aluResult, from: 'execute' }
        if (memwb.valid && memwb.regWrite && memwb.writeReg === regNo && memwb.writeReg !== 0) return { value: memwb.writeData, from: 'memory' }
        return { value: base, from: 'register file' }
      }
      const a = pick(idex.rs, idex.readData1)
      const b = pick(idex.rt, idex.readData2)
      if (a.from !== 'register file') forwards.push({ cycle, index: idex.index, port: 'a', from: a.from })
      if (b.from !== 'register file') forwards.push({ cycle, index: idex.index, port: 'b', from: b.from })
      const second = idex.aluSrc ? idex.signImm : b.value
      const result = idex.cls === 'jump' ? 0 : alu(idex.aluOp, a.value, second)
      nextExmem = {
        valid: true,
        index: idex.index,
        instr: idex.instr,
        regWrite: idex.regWrite,
        writeReg: idex.writeReg,
        memRead: idex.memRead,
        memWrite: idex.memWrite,
        memToReg: idex.memToReg,
        aluResult: result,
        writeValue: b.value,
        forwardA: a.from,
        forwardB: b.from,
      }
      if (resolve === 'execute' && idex.cls === 'branch') {
        taken = idex.instr.op === 'beq' ? result === 0 : result !== 0
        branchTarget = idex.pc4 + idex.instr.imm * 4
      }
      seat(idex.index, 'execute')
    }

    // Decode, with the hazard unit in front of it.
    let nextIdex = bubbleOf(ifid.cause)
    let stall = false
    let decodeTaken = false
    let decodeTarget = null
    if (ifid.valid) {
      const instr = ifid.instr
      const c = controlOf(instr.op)
      const cls = classOf(instr.op)
      const sources = cls === 'jump' ? [] : cls === 'load' || (instr.kind === 'i' && cls === 'arith') ? [instr.rs] : [instr.rs, instr.rt]
      const pending = (reg, stage) => stage.valid && stage.regWrite && stage.writeReg !== 0 && sources.includes(stage.writeReg) && reg
      // A load's value leaves memory one stage after the ALU wanted it, so one
      // bubble is unavoidable however much forwarding there is.
      const loadUse = idex.valid && idex.memRead && idex.writeReg !== 0 && sources.includes(idex.writeReg)
      const dataHazard = !forwarding && (pending(true, idex) || pending(true, exmem))
      // A comparison in decode reads the register file before the value it
      // needs has been written, so it waits for it. That is the second cost of
      // resolving a branch early, beside the comparator itself.
      const earlyBranch = resolve === 'decode' && cls === 'branch' && (pending(true, idex) || pending(true, exmem))
      stall = loadUse || dataHazard || earlyBranch
      if (stall) {
        stalls++
        nextIdex = bubbleOf('stall')
        if (loadUse) stallsBy.loadUse++
        else if (earlyBranch) stallsBy.branch++
        else stallsBy.data++
        seat(ifid.index, 'decode', true)
      } else {
        const read = (i) => (i === 0 ? 0 : state.regs[i])
        nextIdex = {
          valid: true,
          index: ifid.index,
          instr,
          cls,
          pc4: ifid.pc4,
          rs: instr.rs,
          rt: instr.rt,
          aluOp: c.aluOp,
          aluSrc: c.aluSrc,
          regWrite: c.regWrite,
          memRead: c.memRead,
          memWrite: c.memWrite,
          memToReg: c.memToReg,
          writeReg: c.regWrite ? (c.regDst ? instr.rd : instr.rt) : 0,
          readData1: read(instr.rs),
          readData2: read(instr.rt),
          signImm: instr.op === 'andi' ? instr.uimm : instr.imm,
        }
        if (resolve === 'decode' && cls === 'branch') {
          const equal = read(instr.rs) === read(instr.rt)
          decodeTaken = instr.op === 'beq' ? equal : !equal
          decodeTarget = ifid.pc4 + instr.imm * 4
        }
        seat(ifid.index, 'decode')
      }
    }

    // Fetch. A stalled instruction stays in the register it is in, and the
    // program counter holds with it.
    let nextIfid = stall ? ifid : bubbleOf('idle')
    let fetched = null
    if (!stall && inRange(pc)) {
      const instr = code[pc >> 2]
      nextIfid = { valid: true, index: pc >> 2, instr, pc, pc4: pc + 4 }
      addresses.push({ cycle, kind: 'i', addr: pc })
      seat(pc >> 2, 'fetch')
      fetched = pc >> 2
    }

    // The program counter, and what a taken branch or a jump throws away.
    let nextPc = stall ? pc : inRange(pc) ? pc + 4 : pc
    // What a redirect costs, counted rather than assumed.
    //
    // A slot the redirect throws away costs a cycle when the front end did
    // work in it. A slot that was empty costs a cycle too, because the front
    // end spent that cycle on the wrong path. It costs nothing when it was
    // empty because the machine had already run off the end of the program and
    // is not coming back, and nothing when the stall that emptied it has
    // already been counted. That is the difference between `flushes`, which is
    // instructions, and `flushCycles`, which is time.
    const redirect = (target, slots) => {
      const home = target >= 0 && target >> 2 < code.length
      let thrown = 0
      for (const reg of slots) if (reg.valid) thrown++
      flushes += thrown
      redirects.push({ cycle, target, thrown, home })
      return thrown
    }
    // The older instruction wins. A branch resolving in execute throws away
    // whatever the decode stage was about to do, jump included, so only one
    // redirect happens in a cycle.
    const jumping = nextIdex.valid && nextIdex.cls === 'jump'
    if (taken) {
      nextPc = branchTarget
      // Resolved in execute, a taken branch discards the two instructions
      // behind it. Resolved in decode it discards one.
      if (nextIfid.valid) stallsBy.branch++
      if (nextIdex.valid) stallsBy.branch++
      redirect(nextPc, [nextIfid, nextIdex])
      // A slot the redirect empties is a flush slot, whatever was in it. A
      // slot the hazard unit had already emptied keeps its own cause, so a
      // stall is never counted twice.
      nextIfid = nextIfid.valid ? bubbleOf('flush') : bubbleOf(stall ? 'stall' : nextIfid.cause)
      nextIdex = nextIdex.valid ? bubbleOf('flush') : bubbleOf(nextIdex.cause)
    } else if (decodeTaken) {
      nextPc = decodeTarget
      if (nextIfid.valid) stallsBy.branch++
      redirect(nextPc, [nextIfid])
      nextIfid = nextIfid.valid ? bubbleOf('flush') : bubbleOf(nextIfid.cause)
    } else if (jumping) {
      nextPc = (nextIdex.pc4 & 0xf0000000) | (nextIdex.instr.target << 2)
      redirect(nextPc, [nextIfid])
      nextIfid = nextIfid.valid ? bubbleOf('flush') : bubbleOf(nextIfid.cause)
    }

    if (memwb.valid) retired++
    else bubbles[memwb.cause]++
    trace.push({
      cycle,
      pc,
      stall,
      taken: taken || decodeTaken,
      fetched,
      stages: {
        fetch: nextIfid.valid ? nextIfid.index : fetched,
        decode: ifid.valid ? ifid.index : null,
        execute: idex.valid ? idex.index : null,
        memory: exmem.valid ? exmem.index : null,
        writeback: memwb.valid ? memwb.index : null,
      },
      forwardA: idex.valid ? nextExmem.forwardA : null,
      forwardB: idex.valid ? nextExmem.forwardB : null,
    })
    if (memwb.valid) seat(memwb.index, 'writeback')

    memwb = nextMemwb
    exmem = nextExmem
    idex = nextIdex
    ifid = nextIfid
    pc = nextPc
    cycle++
  }

  return {
    stages: 5,
    program: code,
    trace,
    schedule: cells.map((c, index) => ({ index, instr: code[index], cells: c })),
    regs: state.regs,
    mem: state.mem,
    pc,
    cycles: cycle,
    retired,
    cpi: retired ? cycle / retired : 0,
    // The four kinds of cycle that are not a retirement, counted as they left
    // the pipeline rather than as they were made (invariant 3).
    fill: bubbles.fill,
    stallCycles: bubbles.stall,
    flushCycles: bubbles.flush,
    idleCycles: bubbles.idle,
    bubbles,
    stalls,
    flushes,
    stallsBy,
    forwards,
    addresses,
    redirects,
    forwarding,
    resolve,
  }
}

/** One row a cycle for the schedule view, in the order the instructions issued. */
export const scheduleOf = (run) => run.schedule.filter((r) => r.cells.length)

/**
 * The four predictors of E6, each run over the same list of branch outcomes.
 *
 * `always` predicts taken every time. `one` is a single bit that remembers what
 * the branch did last. `two` is a saturating counter that needs two misses in a
 * row to change its mind. `correlate` indexes a one-bit predictor by the last
 * three outcomes, so a loop whose period is four is a pattern it can learn.
 */
export function predictorRun(pattern, kind, { history = 3 } = {}) {
  const predictions = []
  let mispredicts = 0
  let bit = 1
  let counter = 3
  const table = new Array(2 ** history).fill(1)
  let hist = 2 ** history - 1
  for (const actual of pattern) {
    let predicted
    if (kind === 'always') predicted = 1
    else if (kind === 'one') predicted = bit
    else if (kind === 'two') predicted = counter >= 2 ? 1 : 0
    else if (kind === 'correlate') predicted = table[hist]
    else throw new Error(`this lab has no predictor called "${kind}"`)
    const hit = predicted === actual
    if (!hit) mispredicts++
    predictions.push({ predicted, actual, hit })
    bit = actual
    counter = actual ? Math.min(3, counter + 1) : Math.max(0, counter - 1)
    table[hist] = actual
    hist = ((hist << 1) | actual) & (2 ** history - 1)
  }
  return { kind, mispredicts, hits: pattern.length - mispredicts, branches: pattern.length, rate: mispredicts / pattern.length, predictions }
}

/** A loop of `iterations` taken branches and one not taken, repeated. */
export const loopPattern = (iterations = 4, repeats = 10) => Array.from({ length: iterations * repeats }, (_, i) => ((i + 1) % iterations ? 1 : 0))

export { writesTo }
