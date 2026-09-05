import { describe, it, expect } from 'vitest'
import { FLOP, libDelay, normalize, truthTable } from '@ee-labs/events'
import { byId, defaultsOf } from '../experiments.js'
import { readQuantity } from '../lessons.js'
import { analyse } from '../analysis.js'

// Group E's numbers, every one of them computed from the library rather than
// typed in. Change the NOR from 50 ps to 45 ps and every expectation here moves
// with the lesson, or the test fails and says which.

const D = { not: libDelay('not', 1), nor2: libDelay('nor', 2), nand2: libDelay('nand', 2) }

const at = (id, over = {}) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return { exp, p, x: analyse(exp, p) }
}

describe('group E pins the latch and the flip-flop', () => {
  it('E1: the ring is declined by name, and the netlist it declines is two gates', () => {
    const { x, p } = at('e1')
    expect(readQuantity(x, p, 'refusal')).toBe('combinational-loop')
    expect(x.refusal.detail.loop.sort()).toEqual(['q', 'qn'])
    expect(readQuantity(x, p, 'gates')).toBe(2)
    // The refusal is a property of the netlist, not of the run: the engine
    // declines the same netlist however its inputs are set.
    for (const s of [0, 1]) for (const r of [0, 1]) expect(() => truthTable(at('e1', { s, r }).x.net), `s=${s} r=${r}`).toThrow(/it is a latch/)
    // And both of its states are stable, which is the whole claim.
    expect(analyse(byId.e1, { ...p, q: 0 }).res.final.q).toBe(0)
    expect(analyse(byId.e1, { ...p, q: 1 }).res.final.q).toBe(1)
  })

  it('E2: the two edges are one NOR apart, wherever the pulse is and whatever the NOR costs', () => {
    for (const tnor of [D.nor2, 20, 100]) {
      for (const set of [300, 500, 800]) {
        const { x, p } = at('e2', { at: set, tnor })
        expect(readQuantity(x, p, 'edge.qn.1'), `${set}/${tnor}`).toBe(set + tnor)
        expect(readQuantity(x, p, 'edge.q.1'), `${set}/${tnor}`).toBe(set + 2 * tnor)
        // The pulse is over and the latch has not moved back.
        expect(readQuantity(x, p, 'edge.s.2'), `${set}/${tnor}`).toBe(2 * set)
        expect(readQuantity(x, p, 'final.q'), `${set}/${tnor}`).toBe(1)
      }
    }
    // Setting a latch that is already set moves nothing at all.
    const already = at('e2', { q: 1 })
    expect(readQuantity(already.x, already.p, 'edges.q')).toBe(0)
    // Both inputs at once, and the two outputs are no longer complements.
    const both = at('e2', { r: 1 })
    expect(readQuantity(both.x, both.p, 'at.q.450')).toBe(readQuantity(both.x, both.p, 'at.qn.450'))
  })

  it('E3: the D latch is five gates, and it follows while it is open and holds while it is not', () => {
    const { x, p } = at('e3')
    expect(readQuantity(x, p, 'gates')).toBe(5)
    // Open: the input reaches the output through two NAND gates.
    expect(readQuantity(x, p, 'edge.q.1')).toBe(p.dstep + 2 * D.nand2)
    // Closed: d moves and the output does not.
    expect(readQuantity(x, p, 'edge.d.2')).toBe(4 * p.dstep)
    expect(readQuantity(x, p, 'edge.d.2')).toBeGreaterThan(readQuantity(x, p, 'edge.g.2'))
    expect(readQuantity(x, p, `at.q.${4 * p.dstep + 100}`)).toBe(1)
    // Open again: the output catches up, through the other side of the latch.
    expect(readQuantity(x, p, 'edge.q.2')).toBe(p.period + 3 * D.nand2)
    for (const tnand of [20, D.nand2, 100]) {
      const slow = at('e3', { tnand })
      expect(readQuantity(slow.x, slow.p, 'edge.q.1'), `${tnand}`).toBe(p.dstep + 2 * tnand)
      expect(readQuantity(slow.x, slow.p, 'edge.q.2'), `${tnand}`).toBe(p.period + 3 * tnand)
    }
  })

  it('E4: eleven gates, one output change per edge at most, and the two directions differ by one NAND', () => {
    const { x, p } = at('e4')
    expect(readQuantity(x, p, 'gates')).toBe(11)
    // Two latches, so no path runs through the whole thing in one clock.
    expect(readQuantity(x, p, 'gap.q.1.clk.3')).toBe(2 * D.nand2)
    expect(readQuantity(x, p, 'gap.q.2.clk.5')).toBe(3 * D.nand2)
    // The clock only rises so often, and the output never moves more often, so
    // long as the master has settled by the time the clock catches it.
    for (const dstep of [450, 500, 700]) {
      const y = at('e4', { dstep })
      const rises = y.x.res.events.filter((e) => e.signal === 'clk' && e.to === 1).length
      const moves = y.x.res.events.filter((e) => e.signal === 'q')
      expect(moves.length, `dstep ${dstep}`).toBeLessThanOrEqual(rises)
      expect(readQuantity(y.x, y.p, 'edges.d'), `dstep ${dstep}`).toBeGreaterThan(moves.length)
      // Every output change sits on a rising edge of the clock, at one of the
      // two delays the two directions of this netlist cost.
      for (const e of moves) {
        const lag = e.to === 1 ? 2 * D.nand2 : 3 * D.nand2
        const edge = y.x.res.events.find((v) => v.signal === 'clk' && v.to === 1 && v.t === e.t - lag)
        expect(edge, `dstep ${dstep}: q at ${e.t} to ${e.to}`).toBeDefined()
      }
    }
  })

  it('E4: a master still settling when the clock catches it is the setup time, before it is a number', () => {
    // The one thing this construction shows that the primitive cannot. With a
    // stimulus that moves the master within a setup time of the edge, the
    // clock closes the master mid-change and the output chatters afterwards.
    // E5 gives that same interval as one number of the cell.
    const tight = at('e4', { dstep: 250 })
    const events = tight.x.res.events
    const rise = events.filter((e) => e.signal === 'clk' && e.to === 1).map((e) => e.t)
    const chatter = rise.find((t) => events.filter((e) => e.signal === 'q' && e.t > t && e.t < t + tight.p.period).length > 1)
    expect(chatter, 'some edge catches the master mid-change').toBeDefined()
    const master = events.filter((e) => (e.signal === 'm' || e.signal === 'mn') && e.t < chatter)
    const last = master[master.length - 1].t
    expect(chatter - last, 'the master moved within a setup time of the edge').toBeLessThan(FLOP.tsu)
    // Move the same stimulus clear of the edge and the chatter goes away.
    const clear = at('e4', { dstep: 500 })
    for (const t of clear.x.res.events.filter((e) => e.signal === 'clk' && e.to === 1).map((e) => e.t)) {
      expect(clear.x.res.events.filter((e) => e.signal === 'q' && e.t > t && e.t < t + clear.p.period).length, `edge ${t}`).toBeLessThanOrEqual(1)
    }
  })

  it('E5: the window runs from one setup time before the edge to one hold time after it', () => {
    const edge = 500
    for (const [tsu, th] of [[FLOP.tsu, FLOP.th], [80, FLOP.th], [FLOP.tsu, 60], [10, 10]]) {
      const { exp, x, p } = at('e5', { tsu, th })
      expect(readQuantity(x, p, 'flop.window', exp), `${tsu}/${th}`).toBe(tsu + th)
      expect(readQuantity(x, p, 'window.first', exp), `${tsu}/${th}`).toBe(edge - tsu + 1)
      expect(readQuantity(x, p, 'window.last', exp), `${tsu}/${th}`).toBe(edge + th - 1)
      // One narrower than the two times added up, because the instant of the
      // edge is inside both of them and is counted once.
      expect(readQuantity(x, p, 'window.width', exp), `${tsu}/${th}`).toBe(tsu + th - 1)
    }
    // The two ends are the two kinds, each missing by exactly one picosecond.
    const early = at('e5', { at: edge - FLOP.tsu + 1 })
    expect(readQuantity(early.x, early.p, 'violation.1.kind')).toBe('setup')
    expect(readQuantity(early.x, early.p, 'violation.1.slack')).toBe(-1)
    const late = at('e5', { at: edge + FLOP.th - 1 })
    expect(readQuantity(late.x, late.p, 'violation.1.kind')).toBe('hold')
    expect(readQuantity(late.x, late.p, 'violation.1.slack')).toBe(-1)
    // Outside it, nothing is reported at all.
    expect(readQuantity(at('e5').x, at('e5').p, 'violations')).toBe(0)
  })

  it('E6: the report carries the measured time, the required one and the slack, and Q moves either way', () => {
    const { x, p } = at('e6')
    const edge = readQuantity(x, p, 'violation.1.t')
    expect(readQuantity(x, p, 'violation.1.kind')).toBe('setup')
    expect(readQuantity(x, p, 'violation.1.actual')).toBe(edge - p.at)
    expect(readQuantity(x, p, 'violation.1.required')).toBe(p.tsu)
    expect(readQuantity(x, p, 'violation.1.slack')).toBe(edge - p.at - p.tsu)
    // Q moves one clock-to-Q after the edge whether the run was clean or not,
    // and the run says that the value it took is the model's choice.
    const clean = at('e6', { at: edge - 2 * p.tsu })
    expect(readQuantity(clean.x, clean.p, 'violations')).toBe(0)
    expect(readQuantity(clean.x, clean.p, 'edge.q.1')).toBe(edge + FLOP.tcq)
    expect(readQuantity(x, p, 'edge.q.1')).toBe(edge + FLOP.tcq)
    // Asking for more setup time on the same run makes the same step worse by
    // exactly what was asked for.
    for (const tsu of [p.tsu, 60, 100]) {
      const y = at('e6', { tsu })
      expect(readQuantity(y.x, y.p, 'violation.1.slack'), `${tsu}`).toBe(edge - p.at - tsu)
    }
  })

  it('every netlist in the group is on the picosecond grid, and none of them oscillates', () => {
    for (const e of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6']) {
      const { x } = at(e)
      const norm = x.norm.drivers ? x.norm : normalize(x.net)
      expect(norm.unit, e).toEqual({ num: 1, den: 1e12 })
      expect(x.res.settled, `${e} settles at t = 0`).toBe(true)
      expect(x.res.conflicts, e).toEqual([])
    }
  })
})
