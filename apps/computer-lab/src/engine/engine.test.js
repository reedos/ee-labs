import { describe, it, expect } from 'vitest'
import { CARD, UNIT, gates, psOf, singleCyclePaths, stageLogic, timingOf } from './card.js'
import { OPS, OP_NAMES, classOf, controlOf, decode, encode, fields, reference, signed16 } from './isa.js'
import { runDatapath, WIRE_NAMES, WIRES, BLOCKS, activeWires, assemble, textOf } from './datapath.js'
import { loopPattern, predictorRun, runPipeline, scheduleOf } from './pipeline.js'
import { amat, amat2, arrayTrace, cacheRun, geometryOf, pagingOf, splitOf, thrashTrace, walk } from './cache.js'
import { PROGRAMS, PROGRAM_IDS, programOf } from './programs.js'
import { amdahl, busOf, cpiOf, interruptOf, worthOf } from './cost.js'

// The engine's own tests, before any of it is drawn.
//
// The plan's §2.8 lists ten invariants. Numbers 1, 2, 3, 6, 7, 8 and 9 are
// fuzzed here over generated programs, traces and configurations. Number 4 and
// number 5 belong to the netlists and are in `blocks.test.js`. Number 10 is
// cross-lab and waits for the VLSI Lab, which `NEEDS.md` records.
//
// Nothing below is a constant that could not be computed. A delay is the card's
// gate delay times a whole number, a cycle count comes from a run, and a hit
// rate comes from a trace.

const G = CARD.gate
const at4 = (x) => Number(x.toFixed(4))

describe('the model card', () => {
  it('holds every time as a whole number of the grid it declares', () => {
    expect(UNIT).toEqual({ num: 1, den: 1e14 })
    for (const key of ['gate', 'inverter', 'fo4', 'tcq', 'tsu', 'th']) expect(Number.isInteger(CARD[key]), key).toBe(true)
    for (const [name, n] of Object.entries(CARD.blocks)) {
      expect(Number.isInteger(n), name).toBe(true)
      expect(Number.isInteger(gates(n)), name).toBe(true)
    }
    // The two unit values, as picoseconds a reader reads.
    expect(psOf(CARD.gate)).toBeCloseTo(37.65, 10)
    expect(psOf(CARD.inverter)).toBeCloseTo(22.59, 10)
    expect(psOf(CARD.tcq + CARD.tsu)).toBeCloseTo(82.86, 10)
  })

  it('derives every path in the single-cycle machine from the blocks it walks', () => {
    const t = timingOf()
    const paths = singleCyclePaths()
    for (const [cls, path] of Object.entries(paths)) {
      const sum = path.through.reduce((n, b) => n + CARD.blocks[b], 0)
      expect(path.gates, cls).toBe(sum)
      expect(t.single[cls].delay, cls).toBe(gates(sum) + CARD.tcq + CARD.tsu)
    }
    // The load is the longest path, which is what sets the clock (C4).
    expect(t.critical).toBe('load')
    expect(t.single.load.gates).toBe(44)
    expect(psOf(t.singlePeriod)).toBeCloseTo(1739.46, 6)
    expect(t.singleFreq / 1e6).toBeCloseTo(574.89, 1)
    // Every other instruction finishes early and waits.
    expect(at4(t.waste)).toBe(at4((t.singlePeriod - t.single.arith.delay) / t.singlePeriod))
    expect(t.waste).toBeGreaterThan(0.25)
  })

  it('derives the pipeline period from the slowest stage, and the stages from the same blocks', () => {
    const t = timingOf()
    const logic = stageLogic()
    expect(Object.values(logic).reduce((n, s) => n + s.gates, 0)).toBe(48)
    expect(t.slowest).toBe('fetch')
    expect(t.pipePeriod).toBe(gates(12) + CARD.tcq + CARD.tsu)
    expect(psOf(t.pipePeriod)).toBeCloseTo(534.66, 6)
    expect(t.stage.memory.delay).toBe(t.pipePeriod)
    expect(at4(t.throughput)).toBe(at4(t.singlePeriod / t.pipePeriod))
    expect(at4(t.overheadShare)).toBe(at4((CARD.tcq + CARD.tsu) / t.pipePeriod))
    // Five stages of one period is the latency the throughput was bought with.
    expect(t.latency).toBe(5 * t.pipePeriod)
    expect(t.latencyRatio).toBeGreaterThan(1)
    expect(t.throughput).toBeGreaterThan(3)
  })
})

describe('the instruction set', () => {
  it('round-trips every one of the twelve opcodes through its encoding', () => {
    expect(OP_NAMES.length).toBe(12)
    for (const op of OP_NAMES) {
      const spec = OPS[op]
      const instr = spec.kind === 'r' ? { op, rd: 9, rs: 17, rt: 23 } : spec.kind === 'i' ? { op, rt: 9, rs: 17, imm: -13 } : { op, target: 12345 }
      const back = decode(encode(instr))
      expect(back.op, op).toBe(op)
      if (spec.kind === 'r') expect([back.rd, back.rs, back.rt], op).toEqual([9, 17, 23])
      if (spec.kind === 'i') expect([back.rt, back.rs, back.imm], op).toEqual([9, 17, -13])
      if (spec.kind === 'j') expect(back.target, op).toBe(12345)
    }
  })

  it('slices the six fields where the encoding table says they are', () => {
    const word = encode({ op: 'add', rd: 9, rs: 17, rt: 23 })
    const f = fields(word)
    expect(f.op).toBe(0)
    expect(f.rs).toBe(17)
    expect(f.rt).toBe(23)
    expect(f.rd).toBe(9)
    expect(f.funct).toBe(OPS.add.funct)
    expect(fields(encode({ op: 'lw', rt: 3, rs: 1, imm: 8 })).op).toBe(OPS.lw.op)
    expect(signed16(0xffff)).toBe(-1)
    expect(signed16(0x7fff)).toBe(32767)
  })

  it('gives every opcode nine control signals, and the classes the mix counts', () => {
    for (const op of OP_NAMES) {
      const c = controlOf(op)
      expect(Object.keys(c).length, op).toBe(9)
      expect(['arith', 'load', 'store', 'branch', 'jump'], op).toContain(classOf(op))
      // Only the instructions that produce a value write one back.
      expect(c.regWrite, op).toBe(classOf(op) === 'arith' || classOf(op) === 'load' ? 1 : 0)
      expect(c.memRead, op).toBe(classOf(op) === 'load' ? 1 : 0)
    }
    expect(controlOf('lw').aluOp).toBe('add')
    expect(controlOf('beq').aluOp).toBe('sub')
  })
})

describe('the single-cycle machine', () => {
  it('names every wire the canvas draws, and lights only the ones an instruction uses', () => {
    expect(new Set(WIRE_NAMES).size).toBe(WIRES.length)
    for (const w of WIRES) {
      expect(BLOCKS.map((b) => b.id), `${w.name} from`).toContain(w.from)
      expect(BLOCKS.map((b) => b.id), `${w.name} to`).toContain(w.to)
    }
    const [add] = assemble([{ op: 'add', rd: 3, rs: 1, rt: 2 }])
    const [lw] = assemble([{ op: 'lw', rt: 2, rs: 1, imm: 8 }])
    const [jump] = assemble([{ op: 'j', target: 4 }])
    expect(activeWires(add).has('memReadData')).toBe(false)
    expect(activeWires(lw).has('memReadData')).toBe(true)
    expect(activeWires(jump).has('jumpTarget')).toBe(true)
    expect(activeWires(jump).has('memAddr')).toBe(false)
    // Every instruction lights the fetch path, whatever else it does.
    for (const instr of [add, lw, jump]) for (const w of ['pc', 'pc4', 'instr', 'pcNext']) expect(activeWires(instr).has(w), `${instr.op} ${w}`).toBe(true)
  })

  it('executes each of the twelve opcodes to the definition, wire by wire', () => {
    const cases = [
      [{ op: 'add', rd: 3, rs: 1, rt: 2 }, [0, 6, 7], { aluResult: 13, writeReg: 3, writeData: 13 }],
      [{ op: 'sub', rd: 3, rs: 1, rt: 2 }, [0, 6, 7], { aluResult: -1, zero: 0 }],
      [{ op: 'and', rd: 3, rs: 1, rt: 2 }, [0, 12, 10], { aluResult: 8 }],
      [{ op: 'or', rd: 3, rs: 1, rt: 2 }, [0, 12, 10], { aluResult: 14 }],
      [{ op: 'slt', rd: 3, rs: 1, rt: 2 }, [0, 6, 7], { aluResult: 1 }],
      [{ op: 'addi', rt: 3, rs: 1, imm: -2 }, [0, 6], { aluResult: 4, writeReg: 3 }],
      [{ op: 'andi', rt: 3, rs: 1, imm: 12 }, [0, 10], { aluResult: 8 }],
      [{ op: 'lw', rt: 3, rs: 1, imm: 4 }, [0, 8], { memAddr: 12, memReadData: 0, memToReg: 1 }],
      [{ op: 'sw', rt: 2, rs: 1, imm: 4 }, [0, 8, 5], { memAddr: 12, memWrite: 1, regWrite: 0 }],
      [{ op: 'beq', rt: 2, rs: 1, imm: 3 }, [0, 5, 5], { zero: 1, pcSrc: 'branch', pcNext: 16 }],
      [{ op: 'bne', rt: 2, rs: 1, imm: 3 }, [0, 5, 5], { zero: 1, pcSrc: 'pc4', pcNext: 4 }],
      [{ op: 'j', target: 6 }, [0], { pcSrc: 'jump', pcNext: 24 }],
    ]
    for (const [instr, regs, want] of cases) {
      const run = runDatapath([instr], { regs })
      const w = run.trace[0].wires
      for (const [k, v] of Object.entries(want)) expect(w[k], `${instr.op} ${k}`).toBe(v)
      expect(run.cycles, instr.op).toBe(1)
      expect(run.cpi, instr.op).toBe(1)
    }
  })

  it('holds register zero at zero, whatever is written to it', () => {
    const run = runDatapath([{ op: 'addi', rt: 0, rs: 0, imm: 99 }, { op: 'add', rd: 1, rs: 0, rt: 0 }], { regs: [] })
    expect(run.regs[0]).toBe(0)
    expect(run.regs[1]).toBe(0)
  })

  it('agrees with the instruction set’s own reference on every curated program', () => {
    for (const id of PROGRAM_IDS) {
      const p = programOf(id)
      const run = runDatapath(p.code, { regs: p.regs, mem: p.mem, cycles: 4000 })
      const ref = reference(p.code, { regs: p.regs, mem: p.mem })
      expect([...run.regs], id).toEqual([...ref.regs])
      expect([...run.mem], id).toEqual([...ref.mem])
      expect(run.retired, id).toBe(ref.retired)
      expect(textOf(p.code[0]).length, id).toBeGreaterThan(3)
    }
  })
})

/** A random program of the twelve opcodes, with its branches kept in range. */
function randomProgram(rng, n) {
  const pick = (list) => list[Math.floor(rng() * list.length)]
  const reg = () => Math.floor(rng() * 8)
  const code = []
  for (let k = 0; k < n; k++) {
    const op = pick(OP_NAMES)
    if (op === 'j') {
      // A jump forward, so a generated program always ends.
      code.push({ op, target: Math.min(n - 1, k + 1 + Math.floor(rng() * 3)) })
    } else if (OPS[op].kind === 'r') code.push({ op, rd: reg(), rs: reg(), rt: reg() })
    else if (classOf(op) === 'branch') {
      const off = Math.floor(rng() * 3)
      code.push({ op, rs: reg(), rt: reg(), imm: off })
    } else if (classOf(op) === 'load' || classOf(op) === 'store') code.push({ op, rt: reg(), rs: reg(), imm: 4 * Math.floor(rng() * 8) })
    else code.push({ op, rt: reg(), rs: reg(), imm: Math.floor(rng() * 32) - 16 })
  }
  return code
}

/** A small deterministic generator, so a failure is reproducible. */
function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

describe('the pipeline, against the machine it has to agree with (§2.8)', () => {
  const RUNS = 10000
  it('invariant 1: for every program the five-stage machine ends where the one-cycle machine ends', () => {
    const rng = seeded(20260905)
    let checked = 0
    for (let k = 0; k < RUNS; k++) {
      const code = randomProgram(rng, 1 + Math.floor(rng() * 40))
      const regs = Array.from({ length: 8 }, () => Math.floor(rng() * 64) - 32)
      const mem = Array.from({ length: 16 }, () => Math.floor(rng() * 100))
      const single = runDatapath(code, { regs, mem, cycles: 3000 })
      const pipe = runPipeline(code, { regs, mem, cycles: 8000 })
      if (single.cycles >= 3000 || pipe.cycles >= 8000) continue
      expect([...pipe.regs], `program ${k}`).toEqual([...single.regs])
      expect([...pipe.mem], `program ${k}`).toEqual([...single.mem])
      expect(pipe.retired, `program ${k}`).toBe(single.retired)
      checked++
    }
    expect(checked).toBeGreaterThan(RUNS * 0.8)
  })

  it('invariant 2: forwarding changes the time and not the answer', () => {
    const rng = seeded(4242)
    let slower = 0
    for (let k = 0; k < 2000; k++) {
      const code = randomProgram(rng, 1 + Math.floor(rng() * 20))
      const regs = Array.from({ length: 8 }, () => Math.floor(rng() * 64) - 32)
      const on = runPipeline(code, { regs, cycles: 8000 })
      const off = runPipeline(code, { regs, forwarding: false, cycles: 8000 })
      if (on.cycles >= 8000 || off.cycles >= 8000) continue
      expect([...off.regs], `program ${k}`).toEqual([...on.regs])
      expect([...off.mem], `program ${k}`).toEqual([...on.mem])
      expect(off.cycles >= on.cycles, `program ${k}`).toBe(true)
      if (off.cycles > on.cycles) slower++
    }
    expect(slower).toBeGreaterThan(100)
  })

  it('invariant 3: every cycle is an instruction or a bubble, and every bubble has a cause', () => {
    // The plan writes this as cycles = retired + stalls + flushes + fill. The
    // machine has a fourth kind of bubble, and the identity needs it: a cycle
    // where the front end had nothing to fetch because the wrong path ran off
    // the end of the program. Counted as they leave the pipeline rather than
    // as they are made, the five terms close exactly, on every program.
    const rng = seeded(99991)
    let checked = 0
    let idle = 0
    for (let k = 0; k < 3000; k++) {
      const code = randomProgram(rng, 1 + Math.floor(rng() * 30))
      const regs = Array.from({ length: 8 }, () => Math.floor(rng() * 64) - 32)
      const forwarding = rng() > 0.5
      const run = runPipeline(code, { regs, forwarding, cycles: 8000 })
      if (run.cycles >= 8000) continue
      expect(run.cycles, `program ${k}`).toBe(run.fill + run.retired + run.stallCycles + run.flushCycles + run.idleCycles)
      // A stall event costs at most one cycle, and costs none at all when the
      // run ends before its bubble reaches the end of the pipeline.
      expect(run.stallCycles, `program ${k}`).toBeLessThanOrEqual(run.stalls)
      checked++
      idle += run.idleCycles
    }
    expect(checked).toBeGreaterThan(2000)
    expect(idle).toBeGreaterThan(0)
    // The fill is the four stages ahead of the first write-back, on any
    // program that retires anything at all.
    const p = programOf('chain')
    const run = runPipeline(p.code, { regs: p.regs })
    expect(run.fill).toBe(4)
    expect(run.cycles).toBe(4 + run.retired)
  })

  it('resolving a branch in decode throws away one instruction where execute throws two', () => {
    const p = programOf('branchOne')
    const late = runPipeline(p.code, { regs: p.regs })
    const early = runPipeline(p.code, { regs: p.regs, resolve: 'decode' })
    expect(late.flushes).toBe(2)
    expect(early.flushes).toBe(1)
    expect([...early.regs]).toEqual([...late.regs])
  })

  it('a load and its use costs one bubble, and forwarding cannot remove it', () => {
    const p = programOf('loadUse')
    const run = runPipeline(p.code, { regs: p.regs, mem: p.mem })
    expect(run.stallsBy.loadUse).toBe(1)
    expect(run.stalls).toBe(1)
    const rows = scheduleOf(run)
    expect(rows[1].cells.filter((c) => c.bubble).length).toBe(1)
    // The chain of three that depends but does not load costs none at all.
    const chain = programOf('chain')
    expect(runPipeline(chain.code, { regs: chain.regs }).stalls).toBe(0)
  })

  it('counts every predictor on the same pattern, and each is a different machine', () => {
    const four = loopPattern(4, 10)
    expect(four.length).toBe(40)
    expect(four.filter((b) => b === 0).length).toBe(10)
    const counts = Object.fromEntries(['always', 'one', 'two', 'correlate'].map((k) => [k, predictorRun(four, k).mispredicts]))
    expect(counts.always).toBe(10)
    expect(counts.two).toBe(10)
    expect(counts.one).toBe(19)
    expect(counts.correlate).toBe(1)
    // Eight iterations is longer than three bits of history can hold.
    const eight = loopPattern(8, 10)
    expect(predictorRun(eight, 'correlate').mispredicts).toBe(19)
    expect(predictorRun(eight, 'two').mispredicts).toBe(10)
    expect(() => predictorRun(four, 'crystal')).toThrow(/no predictor/)
  })
})

describe('the cache, over the traces the lessons name (§2.8)', () => {
  const trace = arrayTrace()

  it('splits an address the way the configuration says', () => {
    const geo = geometryOf({ bytes: 64, blockBytes: 16, ways: 1 })
    expect([geo.sets, geo.indexBits, geo.offsetBits, geo.tagBits]).toEqual([4, 2, 4, 26])
    expect(splitOf(0, geo)).toMatchObject({ set: 0, tag: 0, offset: 0 })
    expect(splitOf(256, geo)).toMatchObject({ set: 0, tag: 4 })
    expect(splitOf(20, geo)).toMatchObject({ set: 1, offset: 4 })
    expect(() => geometryOf({ bytes: 64, blockBytes: 12 })).toThrow(/power of two bytes/)
    // Three ways in one set is a cache this model builds, because the index is
    // still whole bits. Three sets is not.
    expect(geometryOf({ bytes: 48, blockBytes: 16, ways: 3 }).sets).toBe(1)
    expect(() => geometryOf({ bytes: 48, blockBytes: 16, ways: 1 })).toThrow(/whole bits/)
  })

  it('counts the array trace at 36 references to 9 addresses, and its hits', () => {
    expect(trace.length).toBe(36)
    expect(new Set(trace).size).toBe(9)
    const dm = cacheRun(trace, { bytes: 64, blockBytes: 16, ways: 1 })
    expect(dm.hits + dm.misses).toBe(trace.length)
    expect(dm.misses).toBe(9)
    expect(dm.compulsory).toBe(3)
    expect(dm.conflict).toBe(6)
    expect(dm.capacity).toBe(0)
    expect(at4(dm.rate)).toBe(at4(27 / 36))
    const two = cacheRun(trace, { bytes: 64, blockBytes: 16, ways: 2 })
    expect(two.misses).toBe(3)
    expect(two.conflict).toBe(0)
    expect(at4(two.rate)).toBe(at4(33 / 36))
  })

  it('invariant 6: hits and misses close, for every configuration and every trace', () => {
    const rng = seeded(7)
    for (let k = 0; k < 600; k++) {
      const t = Array.from({ length: 1 + Math.floor(rng() * 200) }, () => 4 * Math.floor(rng() * 128))
      const blockBytes = 2 ** (2 + Math.floor(rng() * 4))
      const blocks = 2 ** (1 + Math.floor(rng() * 5))
      const ways = 2 ** Math.floor(rng() * (1 + Math.log2(blocks)))
      const r = cacheRun(t, { bytes: blocks * blockBytes, blockBytes, ways, policy: rng() > 0.5 ? 'lru' : 'fifo' })
      expect(r.hits + r.misses, `run ${k}`).toBe(t.length)
      expect(r.compulsory + r.capacity + r.conflict, `run ${k}`).toBe(r.misses)
      expect(r.compulsory, `run ${k}`).toBe(new Set(t.map((a) => Math.floor(a / blockBytes))).size)
    }
  })

  it('invariant 7 as the plan states it is false, and here is the trace that breaks it', () => {
    // The plan's §2.8 item 7 says a fully associative cache with least recently
    // used replacement never misses more than a direct-mapped one of the same
    // size, and that a counter-example fails the suite. The fuzzer found one on
    // its second run, so the claim is not a theorem and this test pins the
    // counter-example instead. Four references, two blocks, eight-byte blocks.
    const trace = [12, 64, 4, 12]
    const cfg = { bytes: 16, blockBytes: 8 }
    const direct = cacheRun(trace, { ...cfg, ways: 1 })
    const full = cacheRun(trace, { ...cfg, ways: 2 })
    expect(direct.misses).toBe(3)
    expect(full.misses).toBe(4)
    // The last reference is the difference. Direct mapping kept block 1 in the
    // set the other two addresses do not use, and the fully associative cache
    // replaced it as the least recently used line.
    expect(direct.perAccess[3].hit).toBe(true)
    expect(full.perAccess[3].hit).toBe(false)
  })

  it('invariant 7, as it holds: associativity removes the conflict misses it is for', () => {
    const rng = seeded(31337)
    let helped = 0
    for (let k = 0; k < 400; k++) {
      const t = Array.from({ length: 1 + Math.floor(rng() * 120) }, () => 4 * Math.floor(rng() * 96))
      const blockBytes = 2 ** (2 + Math.floor(rng() * 3))
      const blocks = 2 ** (1 + Math.floor(rng() * 4))
      const bytes = blocks * blockBytes
      const direct = cacheRun(t, { bytes, blockBytes, ways: 1 })
      const full = cacheRun(t, { bytes, blockBytes, ways: blocks })
      // A fully associative cache has one set, so no miss in it can be a
      // conflict miss. That is the definition, and it is what associativity
      // buys.
      expect(full.conflict, `run ${k}`).toBe(0)
      expect(full.compulsory, `run ${k}`).toBe(direct.compulsory)
      if (full.misses < direct.misses) helped++
    }
    expect(helped).toBeGreaterThan(120)
    // On the lab's own traces it helps, which is what Group F shows.
    for (const t of [arrayTrace(), thrashTrace()]) {
      const direct = cacheRun(t, { bytes: 64, blockBytes: 16, ways: 1 })
      const two = cacheRun(t, { bytes: 64, blockBytes: 16, ways: 2 })
      expect(two.misses).toBeLessThan(direct.misses)
    }
  })

  it('invariant 9: a bigger cache does not miss more, and first in first out is where that fails', () => {
    const rng = seeded(2718)
    for (let k = 0; k < 300; k++) {
      const t = Array.from({ length: 1 + Math.floor(rng() * 120) }, () => 4 * Math.floor(rng() * 64))
      const blockBytes = 2 ** (2 + Math.floor(rng() * 3))
      const small = cacheRun(t, { bytes: 8 * blockBytes, blockBytes, ways: 8, policy: 'lru' })
      const big = cacheRun(t, { bytes: 16 * blockBytes, blockBytes, ways: 16, policy: 'lru' })
      expect(big.misses <= small.misses, `run ${k}`).toBe(true)
    }
    // Belady's anomaly: the same trace missing more in the larger cache, under
    // first in first out. The sequence is the textbook one, in blocks.
    const belady = [0, 1, 2, 3, 0, 1, 4, 0, 1, 2, 3, 4].map((b) => b * 16)
    const three = cacheRun(belady, { bytes: 48, blockBytes: 16, ways: 3, policy: 'fifo' })
    const four = cacheRun(belady, { bytes: 64, blockBytes: 16, ways: 4, policy: 'fifo' })
    expect(four.misses).toBeGreaterThan(three.misses)
    const lruThree = cacheRun(belady, { bytes: 48, blockBytes: 16, ways: 3, policy: 'lru' })
    const lruFour = cacheRun(belady, { bytes: 64, blockBytes: 16, ways: 4, policy: 'lru' })
    expect(lruFour.misses).toBeLessThanOrEqual(lruThree.misses)
  })

  it('sweeps the block size on both traces, and the sequential walk follows its own law', () => {
    const rates = [4, 8, 16, 32].map((blockBytes) => cacheRun(trace, { bytes: 64, blockBytes, ways: 1 }).rate)
    expect(rates.map(at4)).toEqual([21 / 36, 25 / 36, 27 / 36, 28 / 36].map(at4))
    const sequential = [4, 8, 16, 32].map((blockBytes) => cacheRun(walk(64), { bytes: 64, blockBytes, ways: 1 }))
    // One miss a block and the rest hits, so the rate is 1 − one over the
    // words in a block. Nothing here is a constant.
    sequential.forEach((r) => expect(at4(r.rate), `${r.geometry.blockBytes} bytes`).toBe(at4(1 - 1 / r.geometry.wordsPerBlock)))
  })

  it('thrashes a direct-mapped cache, and a second way holds both arrays', () => {
    const t = thrashTrace()
    expect(t.length).toBe(16)
    expect(cacheRun(t, { bytes: 64, blockBytes: 16, ways: 1 }).rate).toBe(0)
    expect(at4(cacheRun(t, { bytes: 64, blockBytes: 16, ways: 2 }).rate)).toBe(at4(14 / 16))
  })

  it('adds up the access time, one level and two, and the page table’s three numbers', () => {
    const dm = cacheRun(trace, { bytes: 64, blockBytes: 16, ways: 1 })
    const two = cacheRun(trace, { bytes: 64, blockBytes: 16, ways: 2 })
    expect(at4(amat({ missRate: dm.missRate, penalty: 100 }).cycles)).toBe(at4(1 + dm.missRate * 100))
    expect(amat({ missRate: dm.missRate, penalty: 100 }).cycles).toBe(26)
    expect(at4(amat({ missRate: two.missRate, penalty: 100, hitPenalty: 0.2 }).cycles)).toBe(at4(1.2 + two.missRate * 100))
    const second = amat2({ missRate: 0.25, l2Time: 10, l2MissRate: 0.2, penalty: 100 })
    expect(at4(second.cycles)).toBe(at4(1 + 0.25 * (10 + 0.2 * 100)))
    const pages = pagingOf({})
    expect(pages.numberBits).toBe(20)
    expect(pages.tableBytes).toBe(4 * 2 ** 20)
    expect(pages.reachBytes).toBe(64 * 4096)
    expect(at4(pages.cycles)).toBe(1.4)
  })
})

describe('what the machine costs', () => {
  it('adds the stated mix and the stated rates into cycles per instruction', () => {
    const on = cpiOf({})
    expect(at4(on.cpi)).toBe(1.33)
    expect(at4(on.terms.loadUse)).toBe(at4(CARD.mix.load * CARD.rates.loadUse))
    expect(at4(on.terms.branch)).toBe(at4(CARD.mix.branch * CARD.rates.taken * 2))
    expect(at4(cpiOf({ resolve: 'decode' }).cpi)).toBe(1.24)
    expect(at4(cpiOf({ accuracy: 0.9 }).cpi)).toBe(1.18)
    const off = cpiOf({ forwarding: false })
    expect(at4(off.cpi)).toBe(2.08)
    expect(worthOf(off, on).saved).toBeCloseTo(off.cpi - on.cpi, 12)
    // Every term is on the page with the total, because the total is a sum.
    expect(Object.values(on.terms).reduce((a, b) => a + b, 0)).toBeCloseTo(on.cpi, 12)
  })

  it('bounds every improvement by the share of the time it touches', () => {
    expect(at4(amdahl(0.2, 3).speedup)).toBe(1.1538)
    expect(at4(amdahl(0.35, 2).speedup)).toBe(1.2121)
    expect(amdahl(0.2, Infinity).speedup).toBeCloseTo(amdahl(0.2, 3).bound, 12)
    // A part that takes none of the time buys nothing, however fast it becomes.
    expect(amdahl(0, 1000).speedup).toBe(1)
  })

  it('costs a bus transfer and an interrupt in cycles first, and in time second', () => {
    const t = timingOf()
    const bus = busOf({ period: t.pipePeriod })
    expect([bus.single, bus.burst]).toEqual([8, 5])
    expect(at4(bus.share)).toBe(0.375)
    expect(psOf(bus.singleTime) / 1000).toBeCloseTo(4.2773, 3)
    expect(psOf(bus.burstTime) / 1000).toBeCloseTo(2.6733, 3)
    const irq = interruptOf({ period: t.pipePeriod })
    expect(irq.cycles).toBe(23)
    expect(psOf(irq.time) / 1000).toBeCloseTo(12.297, 2)
    expect(irq.share).toBeCloseTo(1e4 * 23 * (t.pipePeriod / 1e14), 12)
  })
})

describe('the programs', () => {
  it('names each one, says what it is for, and ends inside its own code', () => {
    for (const id of PROGRAM_IDS) {
      const p = programOf(id)
      expect(p.code.length, id).toBeGreaterThan(0)
      expect(p.note.length, id).toBeGreaterThan(20)
      expect(PROGRAMS[id].for.length, id).toBeGreaterThan(0)
      const run = runDatapath(p.code, { regs: p.regs, mem: p.mem, cycles: 4000 })
      expect(run.cycles, `${id} ends`).toBeLessThan(4000)
    }
    expect(() => programOf('nope')).toThrow(/no program called/)
  })

  it('gives Group F the trace the lessons name, from a program rather than by hand', () => {
    const p = programOf('arrayScalar')
    const run = runPipeline(p.code, { regs: p.regs, mem: p.mem, cycles: 4000 })
    const data = run.addresses.filter((a) => a.kind === 'd').map((a) => a.addr)
    expect(data).toEqual(arrayTrace())
    const th = programOf('thrash')
    const thRun = runPipeline(th.code, { regs: th.regs, mem: th.mem, cycles: 4000 })
    expect(thRun.addresses.filter((a) => a.kind === 'd').map((a) => a.addr)).toEqual(thrashTrace())
    const wk = programOf('walk')
    const wkRun = runPipeline(wk.code, { regs: wk.regs, mem: wk.mem, cycles: 4000 })
    expect(wkRun.addresses.filter((a) => a.kind === 'd').map((a) => a.addr)).toEqual(walk(64))
  })
})
