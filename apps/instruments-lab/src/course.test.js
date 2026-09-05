import { describe, expect, test } from 'vitest'
import { EXPERIMENTS, GROUPS, byId } from './experiments.js'
import { BUILDS, GROUP_INTRO, LETTERS, buildsOn, introFor, leadsTo, opensGroup } from './course.js'

// The course is a thread, not a list. Every experiment but the first names what
// it builds on, and the same relation read backwards is what each one leads to.
// A pointer at an experiment that does not exist, or at one that comes later,
// fails here rather than on a reader's screen.

const words = (s) => s.trim().split(/\s+/).length

describe('the course’s shape', () => {
  test('every group has a one-sentence intro of at most thirty words', () => {
    expect(LETTERS).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
    expect(Object.keys(GROUP_INTRO).sort()).toEqual(LETTERS)
    for (const [k, s] of Object.entries(GROUP_INTRO)) expect(words(s), k).toBeLessThanOrEqual(30)
    for (const e of EXPERIMENTS) expect(introFor(e)).toBe(GROUP_INTRO[e.group[0]])
  })

  test('exactly one experiment opens each group — the first', () => {
    const openers = EXPERIMENTS.filter(opensGroup)
    expect(openers.map((e) => e.group)).toEqual(GROUPS)
    expect(openers.map((e) => e.id)).toEqual(['a1', 'b1', 'c1', 'd1', 'e1', 'f1'])
  })

  test('the six groups hold twenty-five experiments, in the plan’s counts', () => {
    const counts = GROUPS.map((g) => EXPERIMENTS.filter((e) => e.group === g).length)
    expect(counts).toEqual([6, 2, 5, 4, 4, 4])
    expect(counts.reduce((a, b) => a + b)).toBe(EXPERIMENTS.length)
  })

  test('every experiment but the first builds on at least one earlier experiment that exists', () => {
    const order = EXPERIMENTS.map((e) => e.id)
    for (const e of EXPERIMENTS) {
      const on = buildsOn(e.id)
      if (e.id === 'a1') {
        expect(on).toEqual([])
        continue
      }
      expect(on.length, e.id).toBeGreaterThanOrEqual(1)
      for (const id of on) {
        expect(byId[id], `${e.id} builds on ${id}`).toBeDefined()
        expect(order.indexOf(id), `${e.id} builds on ${id}, which comes later`).toBeLessThan(order.indexOf(e.id))
      }
      expect(new Set(on).size, e.id).toBe(on.length)
    }
    expect(Object.keys(BUILDS).every((id) => byId[id])).toBe(true)
  })

  test('leads-to is the inverse of builds-on, in course order', () => {
    const order = EXPERIMENTS.map((x) => x.id)
    for (const e of EXPERIMENTS) {
      const to = leadsTo(e.id)
      for (const id of to) expect(buildsOn(id)).toContain(e.id)
      expect([...to].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(to)
    }
    // The scope input is the lab's first idea, and four groups take it up again.
    expect(leadsTo('a1')).toEqual(expect.arrayContaining(['a2', 'a3', 'b2', 'd1', 'e2', 'f4']))
    expect(leadsTo('f4')).toEqual([])
  })

  test('the thread is connected: from A1 every experiment is reachable by following leads-to', () => {
    const seen = new Set(['a1'])
    const queue = ['a1']
    while (queue.length) for (const id of leadsTo(queue.shift())) if (!seen.has(id)) { seen.add(id); queue.push(id) }
    expect(seen.size).toBe(EXPERIMENTS.length)
  })
})
