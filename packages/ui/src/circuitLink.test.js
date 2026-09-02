import { describe, it, expect } from 'vitest'
import { buildCircuitLink, parseCircuitLink, readCircuitLink, labUrl } from './circuitLink.js'

// Both ends of the bridge have to agree, so the round trip is the contract —
// and for a circuit the contract is exactness: the values that arrive are the
// values that left, to the last bit.

describe('circuit links', () => {
  it('round-trips a circuit exactly, awkward doubles included', () => {
    const values = [1000, 1e-6, 0.1 + 0.2, 1 / 3, 2.5e-11, 123456.789]
    const { patch, warnings } = parseCircuitLink(buildCircuitLink({ id: 'rlcSeries', values, output: 'c' }))
    expect(warnings).toEqual([])
    expect(patch.id).toBe('rlcSeries')
    expect(patch.values).toEqual(values)
    expect(patch.output).toBe('c')
  })

  it('stays readable', () => {
    expect(buildCircuitLink({ id: 'rcLow', values: [1000, 1e-6], output: 'c' })).toBe('circuit=rcLow:1000:0.000001&out=c')
  })

  it('carries provenance, label encoded', () => {
    const link = buildCircuitLink({ id: 'rcLow', values: [1, 2], from: { app: 'elements', id: 'h6', label: 'Sine in, the same sine out — after a while' } })
    const { patch } = parseCircuitLink(link)
    expect(patch.from).toEqual({ app: 'elements', id: 'h6', label: 'Sine in, the same sine out — after a while' })
  })

  it('survives a leading hash and empty segments', () => {
    const { patch, warnings } = parseCircuitLink('#circuit=rcLow:1000:1e-7&&out=c')
    expect(warnings).toEqual([])
    expect(patch).toEqual({ id: 'rcLow', values: [1000, 1e-7], output: 'c' })
  })

  it('drops and reports what it does not understand instead of guessing', () => {
    const { patch, warnings } = parseCircuitLink('circuit=rcLow:1000:abc&out=c')
    expect(patch).toBeNull()
    expect(warnings.length).toBe(2) // the bad number, and "no circuit"
    const r = parseCircuitLink('circuit=rcLow:1000:1e-6&zoom=5&out=c!')
    expect(r.patch).toEqual({ id: 'rcLow', values: [1000, 1e-6] })
    expect(r.warnings.some((w) => w.includes('zoom'))).toBe(true)
    expect(r.warnings.some((w) => w.includes('out'))).toBe(true)
    expect(parseCircuitLink('')).toEqual({ patch: null, warnings: [] })
    expect(parseCircuitLink('rate=48000').patch).toBeNull()
  })

  it('reads the page fragment, and nothing off-browser', () => {
    expect(readCircuitLink(null)).toEqual({ patch: null, warnings: [] })
    expect(readCircuitLink({ hash: '' })).toEqual({ patch: null, warnings: [] })
    expect(readCircuitLink({ hash: '#circuit=rlLow:100:0.3' }).patch).toEqual({ id: 'rlLow', values: [100, 0.3] })
  })

  it('finds the sibling lab beside this one on the deployed site, and declines in dev', () => {
    const loc = { origin: 'https://reedos.github.io', pathname: '/ee-labs/circuit-elements-lab/' }
    expect(labUrl('circuit-lab', 'circuit=rcLow:1:2', loc)).toBe('https://reedos.github.io/ee-labs/circuit-lab/#circuit=rcLow:1:2')
    expect(labUrl('circuit-lab', 'x', { origin: 'http://localhost:5173', pathname: '/' })).toBeNull()
    expect(labUrl('circuit-lab', 'x', { origin: 'https://reedos.github.io', pathname: '/ee-labs/circuit-lab/' })).toBeNull()
    expect(labUrl('power-lab', 'x', loc)).toBeNull()
    expect(labUrl('circuit-lab', 'x', null)).toBeNull()
  })
})
