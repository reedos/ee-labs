import { describe, expect, test } from 'vitest'
import { EXPERIMENTS, GROUPS, byId } from './experiments.js'
import { GROUP_INTRO, LETTERS, introFor, opensGroup, buildsOn, leadsTo, BUILDS } from './course.js'

const words = (s) => s.trim().split(/\s+/).length

describe('the course’s shape', () => {
  test('every group has a one-sentence intro of at most thirty words', () => {
    expect(LETTERS).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    expect(Object.keys(GROUP_INTRO).sort()).toEqual(LETTERS)
    for (const [k, s] of Object.entries(GROUP_INTRO)) expect(words(s), k).toBeLessThanOrEqual(30)
    for (const e of EXPERIMENTS) expect(introFor(e)).toBe(GROUP_INTRO[e.group[0]])
  })

  test('exactly one experiment opens each group — the first', () => {
    const openers = EXPERIMENTS.filter(opensGroup)
    expect(openers.map((e) => e.group)).toEqual(GROUPS)
    expect(openers.map((e) => e.id)).toEqual(['a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1'])
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
    for (const e of EXPERIMENTS) {
      const to = leadsTo(e.id)
      for (const id of to) expect(buildsOn(id)).toContain(e.id)
      const order = EXPERIMENTS.map((x) => x.id)
      expect([...to].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(to)
    }
    expect(leadsTo('a1')).toEqual(expect.arrayContaining(['a2', 'a3', 'a4', 'f1']))
    expect(leadsTo('h6')).toEqual([])
  })

  test('the thread is connected: from A1 every experiment is reachable by following leads-to', () => {
    const seen = new Set(['a1'])
    const queue = ['a1']
    while (queue.length) for (const id of leadsTo(queue.shift())) if (!seen.has(id)) { seen.add(id); queue.push(id) }
    expect(seen.size).toBe(EXPERIMENTS.length)
  })
})
