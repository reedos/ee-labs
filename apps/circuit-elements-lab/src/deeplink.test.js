import { describe, it, expect } from 'vitest'
import { buildHash, parseHash, locationFor } from './deeplink.js'
import { byId, defaultsOf } from './experiments.js'

describe('deep links', () => {
  it('an experiment at its defaults is just its id', () => {
    expect(buildHash({ id: 'a1', params: defaultsOf('a1'), show: 'i', view: 'reading', cursor: null })).toBe('a1')
  })

  it('a bare id parses back to that experiment at its defaults', () => {
    const linked = parseHash('a1')
    expect(linked.id).toBe('a1')
    expect(linked.params).toEqual(defaultsOf('a1'))
    expect(linked.show).toBeUndefined()
    expect(linked.view).toBeUndefined()
    expect(linked.warnings).toEqual([])
  })

  it('a leading # is accepted the same as none', () => {
    expect(parseHash('#a1').id).toBe('a1')
    expect(parseHash('a1').id).toBe('a1')
  })

  it('a knob that differs from its default is carried, and only that one', () => {
    const h = buildHash({ id: 'a1', params: { ...defaultsOf('a1'), R1: 100 }, show: 'i', view: 'reading' })
    expect(h).toBe('a1&R1=100')
    const linked = parseHash(h)
    expect(linked.params.R1).toBe(100)
    expect(linked.params.E).toBe(defaultsOf('a1').E)
  })

  it('show and view are carried only when they differ from the experiment’s own', () => {
    const h = buildHash({ id: 'a1', params: defaultsOf('a1'), show: 'v', view: 'equations' })
    expect(h).toBe('a1&show=v&view=equations')
    const linked = parseHash(h)
    expect(linked.show).toBe('v')
    expect(linked.view).toBe('equations')
  })

  it('a toggle round-trips as true or false, never as 1/0', () => {
    const h = buildHash({ id: 'a2', params: { ...defaultsOf('a2'), open: true } })
    expect(h).toBe('a2&open=true')
    expect(parseHash(h).params.open).toBe(true)
    expect(parseHash('a2&open=false').params.open).toBe(false)
  })

  it('a choice knob round-trips its value, and rejects one it does not have', () => {
    const h = buildHash({ id: 'i1', params: { ...defaultsOf('i1'), model: 'exp' } })
    expect(h).toBe('i1&model=exp')
    expect(parseHash(h).params.model).toBe('exp')
    const bad = parseHash('i1&model=nonsense')
    expect(bad.params.model).toBe(defaultsOf('i1').model)
    expect(bad.warnings[0]).toMatch(/not a value model takes/)
  })

  it('the cursor is carried only once it has moved from the experiment’s own opening instant', () => {
    const d = defaultsOf('f3')
    const atOpen = buildHash({ id: 'f3', params: d, cursor: undefined })
    expect(atOpen).toBe('f3')
    const moved = buildHash({ id: 'f3', params: d, cursor: 0.002 })
    expect(moved).toBe('f3&t=0.002')
    expect(parseHash(moved).cursor).toBeCloseTo(0.002, 9)
  })

  it('a DC experiment carries no cursor even if one is passed', () => {
    expect(buildHash({ id: 'a1', params: defaultsOf('a1'), cursor: 0.5 })).toBe('a1')
  })

  it('an unknown id parses to null rather than throwing', () => {
    expect(parseHash('zz9')).toBeNull()
    expect(parseHash('')).toBeNull()
    expect(parseHash('#')).toBeNull()
  })

  it('an unknown knob is dropped and named in warnings, and every other setting still lands', () => {
    const linked = parseHash('a1&R1=100&bogus=3')
    expect(linked.params.R1).toBe(100)
    expect(linked.warnings[0]).toMatch(/"bogus" is not one of its knobs/)
  })

  it('a numeric knob outside its range is clamped, not dropped', () => {
    const linked = parseHash('a1&R1=999999999')
    const r1 = byId.a1.params.find((p) => p.key === 'R1')
    expect(linked.params.R1).toBe(r1.max)
  })

  it('locationFor builds a full URL from the current location and a state', () => {
    const loc = { origin: 'https://reedos.github.io', pathname: '/ee-labs/circuit-elements-lab/' }
    const url = locationFor({ id: 'h4', params: { ...defaultsOf('h4'), R1: 20 }, show: 'i', view: 'bode' }, loc)
    expect(url).toBe('https://reedos.github.io/ee-labs/circuit-elements-lab/#h4&R1=20&show=i&view=bode')
  })

  it('round-trips a real experiment’s full state, not just one knob', () => {
    const state = { id: 'h4', params: { ...defaultsOf('h4'), R1: 20, f: 1400 }, show: 'i', view: 'bode', cursor: undefined }
    const h = buildHash(state)
    const back = parseHash(h)
    expect(back.id).toBe('h4')
    expect(back.params.R1).toBe(20)
    expect(back.params.f).toBe(1400)
    expect(back.show).toBe('i')
    expect(back.view).toBe('bode')
  })
})
