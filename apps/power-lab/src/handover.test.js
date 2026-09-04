import { describe, it, expect } from 'vitest'
import { parseLink } from '@ee-labs/ui'
import { buckParams } from './analysis.js'
import { buckPlant, buckHandOverLink, powerSiblingUrl } from './handover.js'

// The one hand-over (POWER_LAB_PLAN.md §5, CORE_SCOPE.md's worked-examples
// table): the buck's averaged small-signal plant, admitted with an fs/5
// guard. Every number here is the same algebra Control Lab's own custom
// plant expects (a2 = 1/ω0², a1 = 1/(Qω0), a0 = 1), so a round trip through
// buildLink/parseLink must come back exact.

const at = (over = {}) => buckPlant(buckParams(over))

describe('the buck plant (§1.5)', () => {
  it('at the defaults: ω0/2π ≈ 1592 Hz, Q = 5, ample margin under f_s/5', () => {
    const plant = at()
    expect(plant.f0).toBeCloseTo(1591.55, 1)
    expect(plant.Q).toBeCloseTo(5, 9)
    expect(plant.fsGuard).toBeCloseTo(20000, 6)
    expect(plant.refused).toBe(false)
    expect(plant.fsGuard / plant.f0).toBeGreaterThan(10)
  })
  it('the coefficients are the averaged G_vd(s), the custom-plant convention (a2 = 1/ω0², a1 = 1/(Qω0), a0 = 1)', () => {
    const p = buckParams({})
    const plant = at()
    expect(plant.coeffs.b0).toBe(p.Vin)
    expect(plant.coeffs.b1).toBe(0)
    expect(plant.coeffs.b2).toBe(0)
    expect(plant.coeffs.a0).toBe(1)
    expect(1 / Math.sqrt(plant.coeffs.a2)).toBeCloseTo(plant.w0, 6)
    expect(1 / (plant.coeffs.a1 * plant.w0)).toBeCloseTo(plant.Q, 6)
  })
  it('is refused once its own LC corner reaches the fs/5 guard (both L and C at their floor)', () => {
    const plant = at({ L: 1e-6, C: 1e-6 })
    expect(plant.f0).toBeGreaterThan(plant.fsGuard)
    expect(plant.refused).toBe(true)
  })
  it('every chip on every buck experiment’s L or C stays clear of the guard', () => {
    // B1's chip (22 µH), A3's (10 µF), B3's (400 kHz f_s) — the values a
    // reader can actually reach by clicking a chip, not a synthetic corner.
    for (const over of [{ L: 22e-6 }, { C: 10e-6 }, { fs: 400e3 }, { L: 1e-3 }, { C: 1e-3 }]) {
      const plant = at(over)
      expect(plant.refused, JSON.stringify(over)).toBe(false)
    }
  })
})

describe('the Control Lab link', () => {
  it('resolves on the deployed layout (siblings side by side) and not on a bare dev port', () => {
    const p = buckParams({})
    const deployed = { origin: 'https://reedos.github.io', pathname: '/ee-labs/power-lab/' }
    const dev = { origin: 'http://localhost:5173', pathname: '/' }
    expect(buckHandOverLink(p, deployed).url).toMatch(/^https:\/\/reedos\.github\.io\/ee-labs\/control-lab\/#/)
    expect(buckHandOverLink(p, dev).url).toBeNull()
  })
  it('is null (declined) once the plant itself is refused, even on the deployed layout', () => {
    const p = buckParams({ L: 1e-6, C: 1e-6 })
    const deployed = { origin: 'https://reedos.github.io', pathname: '/ee-labs/power-lab/' }
    const { plant, url } = buckHandOverLink(p, deployed)
    expect(plant.refused).toBe(true)
    expect(url).toBeNull()
  })
  it('the fragment round-trips through parseLink as an exact custom plant', () => {
    const p = buckParams({ Vin: 24, L: 47e-6, C: 220e-6, R: 8, fs: 150e3 })
    const plant = buckPlant(p)
    const deployed = { origin: 'https://reedos.github.io', pathname: '/ee-labs/power-lab/' }
    const { url } = buckHandOverLink(p, deployed)
    const frag = url.split('#')[1]
    const { patch } = parseLink(frag)
    expect(patch.plant.type).toBe('custom')
    const [b2, b1, b0, a2, a1, a0] = patch.plant.params
    expect(b0).toBeCloseTo(plant.coeffs.b0, 9)
    expect(b1).toBe(0)
    expect(b2).toBe(0)
    expect(a2).toBeCloseTo(plant.coeffs.a2, 20)
    expect(a1).toBeCloseTo(plant.coeffs.a1, 15)
    expect(a0).toBe(1)
    expect(patch.from).toEqual({ app: 'power', id: 'buck', label: 'The buck converter, averaged' })
  })
  it('powerSiblingUrl never points at its own app', () => {
    const loc = { origin: 'https://reedos.github.io', pathname: '/ee-labs/power-lab/' }
    expect(powerSiblingUrl('power-lab', 'x', loc)).toBeNull()
    expect(powerSiblingUrl('not-a-lab', 'x', loc)).toBeNull()
  })
})
