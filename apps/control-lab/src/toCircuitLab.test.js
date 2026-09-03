import { describe, it, expect } from 'vitest'
import { magnitudeAt, phaseAt } from '@ee-labs/systems'
import { parseCircuitLink } from '@ee-labs/ui'
import { CIRCUITS, transferOf } from '../../circuit-lab/src/circuits.js'
import { PLANTS, defaultsOf } from './systems.js'
import { LESSONS, applyLesson } from './lessons.js'
import { CIRCUIT_KNOBS, circuitFor, circuitFragment, circuitUrl } from './toCircuitLab.js'

// The reverse hand-over must be EXACT: the circuit Circuit Lab opens has to be
// the same transfer function as the plant, or the link is a lie with a nice
// label. So the round trip is measured against Circuit Lab's own catalog,
// through the same link grammar the receiving end parses.

const FREQS = (f0) => [0.1, 0.5, 1, 2, 10].map((r) => r * f0)

/** Build the circuit exactly the way Circuit Lab will: parse the link, feed the catalog. */
const rebuild = (frag) => {
  const { patch, warnings } = parseCircuitLink(frag)
  expect(warnings).toEqual([])
  const c = CIRCUITS[patch.id]
  const params = {}
  c.params.forEach((k, i) => {
    params[k.key] = patch.values[i]
    expect(patch.values[i], `${patch.id} ${k.label} inside Circuit Lab's knob`).toBeGreaterThanOrEqual(k.min)
    expect(patch.values[i]).toBeLessThanOrEqual(k.max)
  })
  return transferOf(patch.id, params, patch.output)
}

describe('this plant, as the circuit it is', () => {
  it('mirrors Circuit Lab\'s knob ranges, so "in range" here is in range there', () => {
    const rlc = CIRCUITS.rlcSeries.params
    const rc = CIRCUITS.rcLow.params
    const range = (list, key) => {
      const p = list.find((x) => x.key === key)
      return [p.min, p.max]
    }
    expect(range(rlc, 'r')).toEqual(CIRCUIT_KNOBS.r)
    expect(range(rlc, 'l')).toEqual(CIRCUIT_KNOBS.l)
    expect(range(rlc, 'c')).toEqual(CIRCUIT_KNOBS.c)
    expect(range(rc, 'r')).toEqual(CIRCUIT_KNOBS.r)
    expect(range(rc, 'c')).toEqual(CIRCUIT_KNOBS.c)
    expect(CIRCUITS.rlcSeries.params.map((p) => p.key)).toEqual(['r', 'l', 'c'])
    expect(CIRCUITS.rcLow.params.map((p) => p.key)).toEqual(['r', 'c'])
  })

  it('a second-order plant is a series RLC across C, to nine decimals', () => {
    // The circuit that arrives from Circuit Lab's default RLC: 100 nF, 10 mH, 100 Ω.
    const plantP = { k: 1, wn: 1 / Math.sqrt(10e-3 * 100e-9), zeta: (100 / 2) * Math.sqrt(100e-9 / 10e-3) }
    const c = circuitFor('secondOrder', plantP)
    expect(c.id).toBe('rlcSeries')
    expect(c.output).toBe('c')
    const tf = PLANTS.secondOrder.tf(plantP)
    const back = rebuild(circuitFragment('secondOrder', plantP))
    const f0 = plantP.wn / (2 * Math.PI)
    for (const f of FREQS(f0)) {
      expect(magnitudeAt(back, f), `|H| at ${f} Hz`).toBeCloseTo(magnitudeAt(tf, f), 9)
      expect(phaseAt(back, f), `∠H at ${f} Hz`).toBeCloseTo(phaseAt(tf, f), 9)
    }
    // And the two numbers the mapping is built on, read back from the parts.
    const { R, L, C } = c.components
    expect(1 / Math.sqrt(L * C)).toBeCloseTo(plantP.wn, 6)
    expect((R / 2) * Math.sqrt(C / L)).toBeCloseTo(plantP.zeta, 9)
  })

  it('a first-order lag is an RC low-pass, exactly', () => {
    for (const tau of [1e-6, 0.001, 1, 100]) {
      const plantP = { k: 1, tau }
      const c = circuitFor('firstOrder', plantP)
      expect(c, `τ = ${tau}`).not.toBeNull()
      expect(c.id).toBe('rcLow')
      const tf = PLANTS.firstOrder.tf(plantP)
      const back = rebuild(circuitFragment('firstOrder', plantP))
      const f0 = 1 / (2 * Math.PI * tau)
      for (const f of FREQS(f0)) {
        expect(magnitudeAt(back, f)).toBeCloseTo(magnitudeAt(tf, f), 9)
        expect(phaseAt(back, f)).toBeCloseTo(phaseAt(tf, f), 9)
      }
    }
  })

  it('exact only: a plant gain, or a value no knob holds, draws nothing', () => {
    // K ≠ 1 is an amplifier no passive network carries.
    expect(circuitFor('secondOrder', { k: 2, wn: 3e4, zeta: 0.3 })).toBeNull()
    expect(circuitFor('firstOrder', { k: 0.5, tau: 1 })).toBeNull()
    // A 1 Hz resonance needs LC = 0.025 s²; Circuit Lab's L ≤ 1 H and C ≤ 1 mF
    // cannot make it, so the lesson's own second-order plant has no circuit.
    const s = applyLesson(LESSONS.find((l) => l.name === 'Derivative buys the phase back'))
    expect(circuitFor(s.plantId, s.plantP)).toBeNull()
    // Plants that are not catalog circuits at all.
    for (const id of ['motor', 'threePole', 'unstable', 'integrator', 'custom']) {
      expect(circuitFor(id, defaultsOf(PLANTS[id])), id).toBeNull()
    }
  })

  it('the link names this plant as its provenance', () => {
    const frag = circuitFragment('firstOrder', { k: 1, tau: 1 })
    const { patch } = parseCircuitLink(frag)
    expect(patch.from).toEqual({ app: 'control', id: 'firstOrder', label: 'First order lag' })
  })

  it('links only where Circuit Lab is deployed beside this page', () => {
    const plantP = { k: 1, tau: 1 }
    // A bare dev port: nothing beside it, so no link (the LabNav rule).
    expect(circuitUrl('firstOrder', plantP, { origin: 'http://127.0.0.1:47360', pathname: '/' })).toBeNull()
    const url = circuitUrl('firstOrder', plantP, {
      origin: 'https://example.github.io',
      pathname: '/ee-labs/control-lab/',
    })
    expect(url).toMatch(/^https:\/\/example\.github\.io\/ee-labs\/circuit-lab\/#circuit=rcLow:/)
    // Nothing to link for a plant that is not a circuit, deployed or not.
    expect(
      circuitUrl('motor', defaultsOf(PLANTS.motor), { origin: 'https://x', pathname: '/ee-labs/control-lab/' }),
    ).toBeNull()
  })

  it('the second-order plant\'s hint never promises a link circuitFor cannot build', () => {
    // "Open in Circuit Lab" renders only where circuitFor(...) is non-null
    // (App.jsx: `circuit && circuitHref`); the hint text is the only other
    // place that promise is made, and the two must agree.
    const buildable = { k: 1, wn: 10000, zeta: 0.3 } // L = 10 mH, C = 1 uF, R = 60 ohm — all on-knob
    const notBuildable = { k: 1, wn: 6.283, zeta: 0.3 } // the registry default: needs C = 2.5 F
    expect(circuitFor('secondOrder', buildable)).toBeTruthy()
    expect(PLANTS.secondOrder.hint(buildable)).toMatch(/"Open in Circuit Lab" link below builds it/)
    expect(circuitFor('secondOrder', notBuildable)).toBeNull()
    expect(PLANTS.secondOrder.hint(notBuildable)).not.toMatch(/link below builds it/)
  })
})
