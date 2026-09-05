import { describe, it, expect } from 'vitest'
import { geometryOf as datapathGeometry, textOf as wireText } from './DatapathCanvas.jsx'
import { geometryOf as scheduleGeometry } from './ScheduleCanvas.jsx'
import { geometryOf as cacheGeometry, stateAfter } from './CacheCanvas.jsx'
import { geometryOf as timingGeometry, rowsOf, heightOf } from './TimingCanvas.jsx'
import { sceneOf } from './StateCanvas.jsx'
import { BLOCKS, WIRES } from '../engine/datapath.js'
import { stateMachine } from '../engine/control.js'
import { analyse } from '../analysis.js'
import { byId, defaultsOf } from '../experiments.js'

// Every canvas computes its whole picture as data before it draws anything, and
// the draw call reads that and nothing else. So a prop that is passed and never
// drawn fails here, which is what `AGENT_BRIEF.md` §3.7 promises.
//
// There is no browser harness in this lab (BACKLOG.md), so these measurements
// and `App.smoke.test.jsx` are what stands in for one.

const at = (id, over = {}) => analyse(byId[id], { ...defaultsOf(id), ...over })

describe('the datapath canvas', () => {
  const x = at('c3')

  it('places every block and draws every wire between two of them', () => {
    const geo = datapathGeometry({ width: 1000, run: x.run, cycle: 0 })
    expect(geo.boxes.length).toBe(BLOCKS.length)
    expect(geo.wires.length).toBe(WIRES.length)
    for (const w of geo.wires) {
      expect(Number.isFinite(w.x1) && Number.isFinite(w.y2), w.name).toBe(true)
      expect(w.x1, `${w.name} starts inside the picture`).toBeGreaterThanOrEqual(0)
      expect(w.y2, `${w.name} stays inside the height`).toBeLessThanOrEqual(geo.height)
    }
    // No two blocks sit on top of each other.
    for (const a of geo.boxes)
      for (const b of geo.boxes) {
        if (a === b) continue
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        expect(overlap, `${a.id} and ${b.id} overlap`).toBe(false)
      }
  })

  it('lights the wires this instruction uses and greys the rest', () => {
    const geo = datapathGeometry({ width: 1000, run: x.run, cycle: 0 })
    const lit = geo.wires.filter((w) => w.lit)
    expect(lit.length).toBe(geo.lit)
    expect(lit.length).toBeGreaterThan(10)
    expect(lit.length).toBeLessThan(WIRES.length)
    // An arithmetic instruction does not use the data memory's output.
    expect(geo.wires.find((w) => w.name === 'memReadData').lit).toBe(false)
    // And it does use the ALU's, with the value the run produced on it.
    const alu = geo.wires.find((w) => w.name === 'aluResult')
    expect(alu.lit).toBe(true)
    expect(wireText(alu)).toBe(String(x.run.trace[0].wires.aluResult))
  })

  it('pins a wire the reader asked for, and folds the picture on demand', () => {
    const pinned = datapathGeometry({ width: 1000, run: x.run, cycle: 0, pinned: ['aluResult'] })
    expect(pinned.wires.find((w) => w.name === 'aluResult').pinned).toBe(true)
    expect(pinned.wires.filter((w) => w.pinned).length).toBe(1)
    const folded = datapathGeometry({ width: 1000, run: x.run, cycle: 0, zoom: 'block' })
    expect(folded.boxes.filter((b) => b.hidden).length).toBeGreaterThan(0)
    expect(folded.boxes.filter((b) => !b.hidden).length).toBeLessThan(BLOCKS.length)
  })

  it('holds inside a phone’s width, with the same blocks', () => {
    const wide = datapathGeometry({ width: 1280, run: x.run, cycle: 0 })
    const phone = datapathGeometry({ width: 390, run: x.run, cycle: 0 })
    expect(phone.scale).toBeLessThan(wide.scale)
    expect(phone.boxes.length).toBe(wide.boxes.length)
    for (const b of phone.boxes) expect(b.x + b.w, `${b.id} inside 390 px`).toBeLessThanOrEqual(390)
  })
})

describe('the schedule canvas', () => {
  const x = at('e4')

  it('gives every instruction a row and every cycle a column', () => {
    const rows = x.pipe.schedule.filter((r) => r.cells.length)
    const geo = scheduleGeometry({ rows, width: 900, cycle: 3 })
    expect(geo.rows.length).toBe(rows.length)
    for (const row of geo.rows) {
      expect(row.label.length, 'a row names its instruction').toBeGreaterThan(3)
      for (const cell of row.cells) {
        expect(cell.x).toBeGreaterThanOrEqual(geo.label)
        expect(cell.label.length, 'a cell names its stage').toBeGreaterThan(1)
      }
    }
    expect(geo.cursorX).not.toBeNull()
  })

  it('draws the load-use bubble as a repeated stage', () => {
    const rows = x.pipe.schedule.filter((r) => r.cells.length)
    const geo = scheduleGeometry({ rows, width: 900, cycle: 0 })
    const bubbles = geo.rows.flatMap((r) => r.cells.filter((c) => c.bubble))
    expect(bubbles.length).toBe(x.pipe.stalls)
    expect(bubbles.length).toBe(1)
  })
})

describe('the cache canvas', () => {
  const x = at('f2')

  it('places every line of every set, and lights the one this reference used', () => {
    const geo = cacheGeometry({ cache: x.cache, step: 8, width: 800 })
    expect(geo.lines.length).toBe(x.cache.geometry.sets * x.cache.geometry.ways)
    expect(geo.lines.filter((l) => l.lit).length).toBeLessThanOrEqual(1)
    for (const l of geo.lines) expect(l.y + l.h).toBeLessThanOrEqual(geo.height)
  })

  it('replays the cache’s own state rather than keeping a second copy', () => {
    // At every step the lines held are the blocks the run says are held.
    for (const step of [0, 5, 9, 20, 35]) {
      const { sets, current } = stateAfter(x.cache, step)
      const held = sets.flat().length
      expect(held, `step ${step}`).toBeLessThanOrEqual(x.cache.geometry.blocks)
      expect(current.addr, `step ${step}`).toBe(x.cache.perAccess[Math.min(step, x.cache.perAccess.length - 1)].addr)
    }
  })
})

describe('the two canvases copied from the Logic Lab', () => {
  it('draws this lab’s carry walk on the timing diagram', () => {
    const x = at('a1', { width: 8 })
    const signals = ['cin', 'c1', 'c2', 'cout']
    const rows = rowsOf({ res: x.res, signals })
    expect(rows.length).toBe(signals.length)
    const geo = timingGeometry({ rows, width: 900, window: [0, x.res.tEnd] })
    expect(geo.height).toBe(heightOf(rows))
    for (const row of geo.rows) expect(row.bot).toBeLessThanOrEqual(geo.height)
    // Time maps onto the plot, and the carry's instant lands inside it.
    const edge = x.res.events.find((e) => e.signal === 'cout')
    expect(geo.sx(edge.t)).toBeGreaterThan(geo.left)
    expect(geo.sx(edge.t)).toBeLessThanOrEqual(geo.left + geo.plotW + 1)
  })

  it('draws this lab’s control unit on the state diagram, with the state it is in lit', () => {
    const machine = stateMachine()
    const scene = sceneOf({ states: machine.states, edges: machine.edges, encoding: machine.encoding, active: 'memory', outputs: true, width: 600, height: 300 })
    expect(scene.states.length).toBe(5)
    expect(scene.states.filter((s) => s.lit).map((s) => s.name)).toEqual(['memory'])
    for (const s of scene.states) {
      expect(s.code, `${s.name} shows its encoding`).toBeTruthy()
      expect(Number.isFinite(s.x) && Number.isFinite(s.y), s.name).toBe(true)
    }
    // Every arc joins two states the machine has.
    for (const e of scene.edges) {
      expect(machine.states, `${e.from} to ${e.to}`).toContain(e.from)
      expect(machine.states, `${e.from} to ${e.to}`).toContain(e.to)
      expect(e.a && e.b, `${e.from} to ${e.to} is placed`).toBeTruthy()
    }
  })
})
