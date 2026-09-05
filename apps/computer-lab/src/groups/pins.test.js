import { describe, it, expect } from 'vitest'
import { criticalPath, timingPaths } from '@ee-labs/events'
import { CARD, gates, overheadOf, psOf } from '../engine/card.js'
import { lookaheadAdder, rippleAdder } from '../engine/blocks.js'
import { runDatapath } from '../engine/datapath.js'
import { runPipeline, loopPattern, predictorRun } from '../engine/pipeline.js'
import { cacheRun } from '../engine/cache.js'
import { cyclesOf } from '../engine/control.js'
import { programOf } from '../engine/programs.js'
import { amdahl, busOf, cpiOf, interruptOf } from '../engine/cost.js'
import { byId, defaultsOf } from '../experiments.js'
import { analyse, readQuantity } from '../analysis.js'

// The pins: every headline number of every group, recomputed here from the
// model card and the engine rather than read back from the group file that
// produced it.
//
// `experiments.test.js` checks that a lesson's numbers are readings. This file
// checks that the readings are the right readings, by working each one out a
// second time from the card. Change the gate delay and both move together, or
// this file fails.

const G = CARD.gate
const read = (id, path, over = {}) => readQuantity(analyse(byId[id], { ...defaultsOf(id), ...over }), path)
const close = (got, want, digits = 6) => expect(Number(got.toPrecision(digits))).toBe(Number(want.toPrecision(digits)))

describe('group A pins the two adders against the engine', () => {
  it('A1: the carry chain is two gate delays a bit, measured on the netlist', () => {
    for (const width of [4, 8, 32]) {
      expect(read('a1', 'g.carry', { width }), `${width} bits`).toBe(2 * width)
      close(read('a1', 'ps.carry', { width }), psOf(2 * width * G))
    }
    // Bit 0 is two exclusive-ors above the operands, whatever the width is.
    close(read('a1', 'ps.bit0'), psOf(4 * G))
    expect(read('a1', 'n.gates', { width: 4 })).toBe(20)
  })

  it('A2: the lookahead carry is what the engine times, and the factor follows from it', () => {
    const cla = timingPaths(lookaheadAdder(32, { a: -1, b: 0 })).arrival.cout.long
    expect(read('a2', 'g.lookahead')).toBe(cla / G)
    expect(read('a2', 'g.lookahead')).toBe(8)
    for (const width of [4, 16, 32]) {
      const ripple = timingPaths(rippleAdder(width, { a: -1, b: 0 })).arrival
      const chain = ripple.cout.long - ripple.s0.long + 2 * G
      expect(read('a2', 'g.ripple', { width }), `${width} bits`).toBe(chain / G)
      close(read('a2', 'n.factor', { width }), chain / cla)
    }
    expect(read('a2', 'ps.sum')).toBe(psOf(criticalPath(lookaheadAdder(32, { a: -1, b: 0 })).delay))
  })

  it('A3: the ALU’s output is the netlist’s longest path, and the card’s two entries sit inside it', () => {
    for (const fn of ['add', 'sub', 'and', 'or']) {
      const g = read('a3', 'g.alu', { fn })
      expect(g, fn).toBe(17)
      close(read('a3', 'ps.alu', { fn }), psOf(g * G))
    }
    expect(read('a3', 'g.carry')).toBe(CARD.blocks.aluCarry)
    expect(read('a3', 'g.mux')).toBe(CARD.blocks.mux2)
    // The card charges the datapath less than the netlist measures, and the
    // difference is the two exclusive-ors the card leaves inside the adder.
    expect(read('a3', 'g.alu') - read('a3', 'g.carry') - read('a3', 'g.mux')).toBe(7)
  })

  it('A4: a multiply is one cycle a bit at the pipelined period', () => {
    const period = gates(CARD.blocks.imem) + overheadOf()
    for (const width of [8, 16, 32]) {
      expect(read('a4', 'cycles.multiply', { width }), `${width} bits`).toBe(width)
      close(read('a4', 'ns.multiply', { width }), (psOf(width * period) / 1000))
      expect(read('a4', 'n.array', { width })).toBe(width)
    }
  })
})

describe('group B pins the two arrays', () => {
  it('B1: the decoder raises one line, and the card’s read is longer than the decode', () => {
    for (const addr of [0, 13, 31]) {
      expect(read('b1', 'n.high', { addr }), `register ${addr}`).toBe(1)
      expect(read('b1', 'text.line', { addr }), `register ${addr}`).toBe(`w${addr}`)
    }
    close(read('b1', 'ps.decode'), psOf(CARD.inverter + 2 * G))
    expect(read('b1', 'g.read')).toBe(CARD.blocks.rfRead)
    expect(read('b1', 'ps.decode')).toBeLessThan(read('b1', 'ps.read'))
  })

  it('B2: the file’s two delays are the card’s, and the run agrees either way', () => {
    close(read('b2', 'ps.read'), psOf(gates(CARD.blocks.rfRead)))
    close(read('b2', 'ps.write'), psOf(gates(CARD.blocks.rfWrite)))
    const p = programOf('chain')
    for (const forwarding of [1, 0]) {
      const run = runPipeline(p.code, { regs: p.regs, forwarding: forwarding === 1 })
      expect(read('b2', 'cycles.run', { forwarding }), `forwarding ${forwarding}`).toBe(run.cycles)
      expect(read('b2', 'n.result', { forwarding }), `forwarding ${forwarding}`).toBe(run.regs[5])
    }
  })

  it('B3: the memory’s share of the period follows the knob', () => {
    for (const access of [6, 12, 24]) {
      const single = gates(access) * 2 + gates(CARD.blocks.rfRead + 2 * CARD.blocks.mux2 + CARD.blocks.aluCarry) + overheadOf()
      close(read('b3', 'ps.single', { access }), psOf(single))
      close(read('b3', 'share.period', { access }), (2 * gates(access)) / single)
    }
  })
})

describe('groups C and D pin the single-cycle machine and its control', () => {
  it('C3 and C4: every path is the blocks it walks, and the load is the longest', () => {
    const b = CARD.blocks
    const arith = gates(b.imem + b.rfRead + b.mux2 + b.aluCarry + b.mux2) + overheadOf()
    const load = gates(b.imem + b.rfRead + b.mux2 + b.aluCarry + b.dmem + b.mux2) + overheadOf()
    const branch = gates(b.imem + b.rfRead + b.aluCarry + b.mux2) + overheadOf()
    close(read('c3', 'ps.path'), psOf(arith))
    close(read('c4', 'ps.load'), psOf(load))
    close(read('c4', 'ps.branch'), psOf(branch))
    close(read('c4', 'freq.clock'), 1 / (psOf(load) * 1e-12))
    close(read('c4', 'share.waste'), (load - arith) / load)
    expect(read('c4', 'text.critical')).toBe('load')
  })

  it('C3: the wires lit are the wires that instruction uses, and the rest are drawn idle', () => {
    const run = runDatapath(programOf('one').code, { regs: [0, 6, 7] })
    expect(read('c3', 'n.lit')).toBe([...run.trace[0].active].length)
    expect(read('c3', 'n.lit') + read('c3', 'n.dark')).toBe(read('c3', 'n.wires'))
    expect(read('c3', 'word.aluresult')).toBe(run.trace[0].wires.aluResult)
  })

  it('C5: the target is the offset in instructions, from the address after the branch', () => {
    for (const offset of [-1, 0, 1, 4]) {
      expect(read('c5', 'word.target', { offset }), `offset ${offset}`).toBe(4 + 4 * offset)
    }
    // Equal registers take the branch, and unequal ones do not.
    expect(read('c5', 'n.taken', { a: 4, b: 4 })).toBe(1)
    expect(read('c5', 'n.taken', { a: 4, b: 5 })).toBe(0)
  })

  it('D1 and D2: nine signals over twelve opcodes, and five states walked per class', () => {
    expect(read('d1', 'n.signals')).toBe(9)
    expect(read('d1', 'n.rows')).toBe(12)
    close(read('d1', 'ps.control'), psOf(gates(CARD.blocks.control)))
    expect(read('d1', 'n.regwrite', { op: 'add' })).toBe(1)
    expect(read('d1', 'n.regwrite', { op: 'sw' })).toBe(0)
    for (const [cls, path] of [['arith', 'cycles.arith'], ['load', 'cycles.load'], ['store', 'cycles.store'], ['branch', 'cycles.branch']]) {
      expect(read('d2', path), cls).toBe(cyclesOf(cls))
    }
  })

  it('D3: the multicycle count is the mix over the states each class walks', () => {
    const cpi = Object.entries(CARD.mix).reduce((sum, [cls, share]) => sum + share * cyclesOf(cls), 0)
    close(read('d3', 'n.cpi'), cpi)
    const period = Math.max(...Object.values(CARD.blocks).map((n) => gates(n))) + overheadOf()
    close(read('d3', 'ps.multiperiod'), psOf(period))
    close(read('d3', 'ps.multitime'), psOf(cpi * period))
  })
})

describe('group E pins the pipeline against its own runs', () => {
  it('E1 and E2: the period is the slowest stage, and the overhead is the flip-flop’s two times', () => {
    const period = gates(CARD.blocks.imem) + overheadOf()
    close(read('e1', 'ps.period'), psOf(period))
    close(read('e2', 'ps.overhead'), psOf(CARD.tcq + CARD.tsu))
    close(read('e2', 'share.overhead'), (CARD.tcq + CARD.tsu) / period)
    close(read('e1', 'n.throughput'), read('e1', 'ps.single') / read('e1', 'ps.period'))
    // The even split is the five stages' logic shared out, plus one overhead.
    const logic = gates(CARD.blocks.imem + CARD.blocks.rfRead + CARD.blocks.mux2 + CARD.blocks.aluCarry + CARD.blocks.dmem + CARD.blocks.mux2 + CARD.blocks.rfWrite)
    close(read('e2', 'ps.even'), psOf(logic / 5 + overheadOf()))
  })

  it('E3 and E4: the cycle counts are the runs’, and the answers do not move', () => {
    const chain = programOf('chain')
    for (const forwarding of [1, 0]) {
      const run = runPipeline(chain.code, { regs: chain.regs, forwarding: forwarding === 1 })
      expect(read('e3', 'cycles.here', { forwarding }), `forwarding ${forwarding}`).toBe(run.cycles)
      expect(read('e3', 'n.result', { forwarding }), `forwarding ${forwarding}`).toBe(run.regs[5])
    }
    const loadUse = programOf('loadUse')
    const run = runPipeline(loadUse.code, { regs: loadUse.regs, mem: loadUse.mem })
    expect(read('e4', 'n.loaduse')).toBe(run.stallsBy.loadUse)
    expect(read('e4', 'cycles.here')).toBe(run.cycles)
    // The mix's load-use term is the loads times the share used at once.
    close(read('e4', 'n.term'), CARD.mix.load * CARD.rates.loadUse)
  })

  it('E5: both branch penalties are the mix’s arithmetic, and the run is its own number', () => {
    close(read('e5', 'n.late'), CARD.mix.branch * CARD.rates.taken * 2)
    close(read('e5', 'n.early'), CARD.mix.branch * CARD.rates.taken)
    const loop = programOf('loop')
    for (const resolve of ['execute', 'decode']) {
      const run = runPipeline(loop.code, { regs: loop.regs, resolve })
      expect(read('e5', 'cycles.here', { resolve }), resolve).toBe(run.cycles)
    }
    close(read('e5', 'n.penalty', { resolve: 'decode' }), cpiOf({ resolve: 'decode' }).terms.branch)
  })

  it('E6: every predictor’s count is that predictor run over that pattern', () => {
    for (const iterations of [2, 4, 8]) {
      const pattern = loopPattern(iterations, 10)
      for (const [kind, path] of [['always', 'n.always'], ['one', 'n.one'], ['two', 'n.two'], ['correlate', 'n.correlate']]) {
        expect(read('e6', path, { iterations }), `${kind} at ${iterations}`).toBe(predictorRun(pattern, kind).mispredicts)
      }
      expect(read('e6', 'n.branches', { iterations })).toBe(pattern.length)
    }
  })
})

describe('groups F and G pin the counts', () => {
  const trace = () => {
    const p = programOf('arrayScalar')
    return runDatapath(p.code, { regs: p.regs, mem: p.mem, cycles: 4000 }).addresses.filter((a) => a.kind === 'd').map((a) => a.addr)
  }

  it('F1 and F2: the geometry and the counts are the model’s, over the program’s own trace', () => {
    const t = trace()
    for (const ways of [1, 2, 4]) {
      const run = cacheRun(t, { bytes: 64, blockBytes: 16, ways })
      expect(read('f2', 'n.hits', { ways }), `${ways} way`).toBe(run.hits)
      expect(read('f2', 'n.misses', { ways }), `${ways} way`).toBe(run.misses)
      close(read('f2', 'share.rate', { ways }), run.rate)
      expect(read('f2', 'n.compulsory', { ways }), `${ways} way`).toBe(run.compulsory)
    }
    expect(read('f2', 'n.refs')).toBe(t.length)
    expect(read('f2', 'n.addresses')).toBe(new Set(t).size)
    expect(read('f1', 'n.indexbits')).toBe(Math.log2(64 / 16))
    expect(read('f1', 'n.offsetbits')).toBe(Math.log2(16))
  })

  it('F4: every rate in the sweep is that configuration run over that trace', () => {
    const t = trace()
    for (const [bytes, path] of [[4, 'share.four'], [8, 'share.eight'], [16, 'share.sixteen'], [32, 'share.thirtytwo']]) {
      close(read('f4', path), cacheRun(t, { bytes: 64, blockBytes: bytes, ways: 1 }).rate)
    }
  })

  it('F5 and F6: the access time and the page table are their own arithmetic', () => {
    const t = trace()
    for (const penalty of [10, 50, 100, 200]) {
      const run = cacheRun(t, { bytes: 64, blockBytes: 16, ways: 1 })
      close(read('f5', 'cycles.here', { penalty }), 1 + run.missRate * penalty)
    }
    for (const pageBits of [8, 12, 16]) {
      expect(read('f6', 'n.pagebits', { pageBits }), `${pageBits} bits`).toBe(32 - pageBits)
      expect(read('f6', 'bytes.table', { pageBits })).toBe(4 * 2 ** (32 - pageBits))
      expect(read('f6', 'bytes.reach', { pageBits })).toBe(64 * 2 ** pageBits)
    }
  })

  it('G1, G2 and G3: the bus, the interrupt and the law are arithmetic over the period', () => {
    const period = gates(CARD.blocks.imem) + overheadOf()
    for (const lineBytes of [4, 16, 32]) {
      const bus = busOf({ period, lineBytes })
      expect(read('g1', 'cycles.single', { lineBytes }), `${lineBytes} bytes`).toBe(bus.single)
      expect(read('g1', 'cycles.burst', { lineBytes }), `${lineBytes} bytes`).toBe(bus.burst)
      close(read('g1', 'ns.single', { lineBytes }), psOf(bus.singleTime) / 1000)
    }
    for (const saves of [0, 8, 16, 32]) {
      const irq = interruptOf({ period, saves })
      expect(read('g2', 'cycles.latency', { saves }), `${saves} saves`).toBe(irq.cycles)
      close(read('g2', 'ns.latency', { saves }), psOf(irq.time) / 1000)
    }
    for (const speedup of [1, 3, 20]) {
      close(read('g3', 'n.adder', { speedup }), amdahl(CARD.profile.adder, speedup).speedup)
    }
    close(read('g3', 'n.bound'), 1 / (1 - CARD.profile.adder))
    // The branch penalty's share comes from the cycles-an-instruction sum.
    close(read('g3', 'share.branch'), cpiOf({}).terms.branch / cpiOf({}).cpi)
  })
})
