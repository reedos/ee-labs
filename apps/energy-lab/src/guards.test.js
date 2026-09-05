import { describe, it, expect } from 'vitest'
import { expectPlain } from '@ee-labs/prose/testing'
import { BREAKDOWN, bandGuard, dataGuard, guardsFor, reverseGuard } from './guards.js'
import { analyse } from './analysis.js'
import { byId, defaultsOf } from './experiments.js'

// Rule 3 of CORE_SCOPE.md: an object admitted approximately is guarded, and
// the guard travels with the number. These tests check that it does — that
// the sentence appears exactly where the model is being read outside what it
// stands for, that it says which way, and that it is not printed where there
// is nothing to guard.

const at = (id, over = {}) => analyse(byId[id], { ...defaultsOf(id), ...over })
const textOf = (g) => (g ? g.text : '')

describe('the reverse branch carries its bound', () => {
  it('appears on a shaded string, and names the cell, the volts and the heat', () => {
    const x = at('b4')
    const g = reverseGuard(x)
    expect(g).toBeTruthy()
    // B4 drives the string past the shaded cell's photocurrent, so the model
    // is outside the range it stands in for and the guard says so.
    expect(x.cells[0].v).toBeLessThan(BREAKDOWN)
    expect(g.level).toBe('warn')
    expect(g.text).toContain('16.39 V')
    expect(g.text).toContain('78.31 W')
    expect(g.text).toMatch(/Cell 1/)
    expect(g.text).toMatch(/no breakdown/)
  })

  it('says so the other way when the reverse voltage is inside the bound', () => {
    // The bypass diode holds the shaded cell at a fraction of a volt, which is
    // a reverse voltage this model does represent.
    const x = at('b5', { bypass: true })
    const g = reverseGuard(x)
    expect(g.level).toBe('note')
    expect(g.text).toMatch(/inside it/)
    expect(Math.abs(x.cells[0].v)).toBeLessThan(1)
  })

  it('is absent when no cell is driven backwards', () => {
    expect(reverseGuard(at('b1'))).toBe(null)
    expect(reverseGuard(at('a1'))).toBe(null)
  })
})

describe('the open-circuit fit carries its band', () => {
  it('names the band, and says the run stayed inside it at the defaults', () => {
    const g = bandGuard(at('d1'))
    expect(g.level).toBe('note')
    expect(g.text).toContain('0.10 to 0.90')
    expect(g.text).toMatch(/labelled data/)
    expect(g.text).toMatch(/inside it/)
  })

  it('warns when a knob takes the run outside it, and does not refuse', () => {
    // Nine amps for twenty minutes is 10800 C of a 7200 C cell, so the state
    // of charge leaves the band the fit holds over. The circuit still solves.
    const x = at('d2', { i: 9, tEnd: 1200, z0: 0.3 })
    const g = bandGuard(x)
    expect(g.level).toBe('warn')
    expect(g.text).toMatch(/outside that band/)
    expect(Number.isFinite(x.at.v)).toBe(true)
  })

  it('is absent where there is no battery', () => {
    expect(bandGuard(at('a1'))).toBe(null)
    expect(bandGuard(at('e1'))).toBe(null)
  })
})

describe('the day’s profiles are named as data', () => {
  it('says what they are and are not, on every day experiment', () => {
    for (const id of ['e1', 'e2', 'e3']) {
      const g = dataGuard(at(id))
      expect(g, id).toBeTruthy()
      expect(g.text, id).toMatch(/labelled data/)
      expect(g.text, id).toMatch(/not a measurement of any real place/)
      expect(g.text, id).toMatch(/arithmetic on exact solves/)
    }
    expect(dataGuard(at('a1'))).toBe(null)
  })
})

describe('every guard', () => {
  it('is collected for the analysis it belongs to, and to no other', () => {
    expect(guardsFor(at('a1'))).toEqual([])
    expect(guardsFor(at('b4')).length).toBe(1)
    expect(guardsFor(at('d1')).length).toBe(1)
    expect(guardsFor(at('e2')).length).toBe(1)
  })

  it('reads plainly, in both of its two states', () => {
    const cases = [
      ['b4 reverse', textOf(reverseGuard(at('b4')))],
      ['b5 reverse', textOf(reverseGuard(at('b5', { bypass: true })))],
      ['d1 band', textOf(bandGuard(at('d1')))],
      ['d2 band, outside', textOf(bandGuard(at('d2', { i: 9, tEnd: 1200, z0: 0.3 })))],
      ['e1 data', textOf(dataGuard(at('e1')))],
    ]
    for (const [label, text] of cases) {
      expect(text.length, label).toBeGreaterThan(40)
      expectPlain(text, 'why', label)
    }
  })
})
