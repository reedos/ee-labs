import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DETECTOR_101, fsmTable } from '@ee-labs/events'
import StateCanvas, { layoutOf, sceneOf } from './StateCanvas.jsx'

// The state machine diagram. Built by the Logic Lab (LOGIC_LAB_PLAN.md §9),
// promoted here once the Computer Lab claimed it too (PROGRAM.md §4), for its
// multicycle control unit.
//
// The geometry is computed by a pure function that the draw call then reads,
// so a test of the three props the Computer Lab asked for measures what the
// reader sees: the Moore output, the encoding and the lit arc.

describe('the state machine diagram', () => {
  const table = fsmTable(DETECTOR_101)
  const states = table.states
  const edges = table.rows.map((r) => ({ from: r.state, to: r.next, label: `x = ${r.in.x}`, out: r.out }))

  it('puts the states on a ring inside the canvas, and one state in the middle', () => {
    const at = layoutOf(states, 480, 260)
    for (const s of states) {
      expect(at[s].x).toBeGreaterThan(0)
      expect(at[s].x).toBeLessThan(480)
      expect(at[s].y).toBeGreaterThan(0)
      expect(at[s].y).toBeLessThan(260)
    }
    const rs = states.map((s) => Math.hypot(at[s].x - 240, at[s].y - 130))
    for (const r of rs) expect(r).toBeCloseTo(rs[0], 6)
    expect(layoutOf(['only'], 480, 260)).toEqual({ only: { x: 240, y: 130 } })
  })

  it('lights the state it is in, and the arc that was last taken', () => {
    const scene = sceneOf({ states, edges, active: 's1', taken: { from: 's0', to: 's1' }, width: 480, height: 260 })
    expect(scene.states.filter((s) => s.lit).map((s) => s.name)).toEqual(['s1'])
    const lit = scene.edges.filter((e) => e.lit)
    expect(lit.length).toBeGreaterThan(0)
    for (const e of lit) expect([e.from, e.to]).toEqual(['s0', 's1'])
    // Nothing is lit when nothing has been taken yet.
    expect(sceneOf({ states, edges, width: 480, height: 260 }).edges.some((e) => e.lit)).toBe(false)
  })

  it('prints each state’s bits beside its name when it is given an encoding', () => {
    const encoding = Object.fromEntries(states.map((s) => [s, table.code[s].toString(2).padStart(table.bits, '0')]))
    const scene = sceneOf({ states, edges, encoding, width: 480, height: 260 })
    expect(scene.states.map((s) => s.code)).toEqual(['00', '01', '10'])
    expect(sceneOf({ states, edges, width: 480, height: 260 }).states.every((s) => s.code === null)).toBe(true)
  })

  it('draws an output inside a state only where every arc leaving it agrees', () => {
    // The Computer Lab's prop is a Moore output, which is one the state has
    // whatever the input does. The 101 detector is Mealy, and the state where
    // that shows is s2: it raises y on x = 1 and not on x = 0, so nothing goes
    // inside that circle. The two states whose arcs agree do carry theirs.
    const mealy = sceneOf({ states, edges, outputs: true, width: 480, height: 260 })
    expect(table.type).toBe('Mealy')
    const differs = table.rows.filter((r) => r.state === 's2').map((r) => r.out.y)
    expect(new Set(differs).size).toBe(2)
    expect(mealy.states.find((s) => s.name === 's2').text).toBeNull()
    expect(mealy.states.find((s) => s.name === 's0').text).toBe('y=0')
    const moore = [
      { from: 'a', to: 'b', label: 'x = 1', out: { y: 0 } },
      { from: 'b', to: 'a', label: 'x = 0', out: { y: 1 } },
      { from: 'b', to: 'b', label: 'x = 1', out: { y: 1 } },
    ]
    const scene = sceneOf({ states: ['a', 'b'], edges: moore, outputs: true, width: 480, height: 260 })
    expect(scene.states.find((s) => s.name === 'b').text).toBe('y=1')
    expect(scene.states.find((s) => s.name === 'a').text).toBe('y=0')
    expect(scene.edges.find((e) => e.self)).toMatchObject({ from: 'b', to: 'b' })
    // Without the prop, the same machine draws no output at all.
    expect(sceneOf({ states: ['a', 'b'], edges: moore, width: 480, height: 260 }).states.every((s) => s.text === null)).toBe(true)
  })

  it('renders with every prop it offers', () => {
    const html = renderToStaticMarkup(
      <StateCanvas states={states} edges={edges} encoding={{ s0: '00', s1: '01', s2: '10' }} active="s1" taken={{ from: 's0', to: 's1' }} outputs />,
    )
    expect(html).toContain('aria-label="State machine diagram"')
  })
})
