import { describe, it, expect } from 'vitest'
import { magnitudeAt } from '../../../packages/systems/index.js'
import { parseCircuitLink } from '@ee-labs/ui'
import { CIRCUITS, transferOf } from '../../circuit-lab/src/circuits.js'
import { PRESETS } from './presets.js'
import { CIRCUIT_KNOBS, circuitFor, circuitFragment, circuitUrl, rlcFor } from './toCircuitLab.js'

// The one outbound hand-over in the suite must be EXACT: the circuit Circuit
// Lab opens has to carry the same cutoff and Q as the block that sent it, or
// the link is a lie with a nice label. Measured against Circuit Lab's own
// catalog, through the same link grammar the receiving end parses — the same
// discipline control-lab/src/toCircuitLab.test.js holds its own reverse
// hand-over to.

describe('this low-pass block, as the circuit it is', () => {
  it('mirrors Circuit Lab\'s own knob ranges, so "in range" here is in range there', () => {
    const rlc = CIRCUITS.rlcSeries.params
    const range = (key) => {
      const p = rlc.find((x) => x.key === key)
      return [p.min, p.max]
    }
    expect(range('r')).toEqual(CIRCUIT_KNOBS.r)
    expect(range('l')).toEqual(CIRCUIT_KNOBS.l)
    expect(range('c')).toEqual(CIRCUIT_KNOBS.c)
    expect(rlc.map((p) => p.key)).toEqual(['r', 'l', 'c'])
  })

  it('rlcFor inverts (freq, q) exactly: 1/√(LC) is the corner, (1/R)√(L/C) is Q', () => {
    for (const [freq, q] of [[800, 0.7071], [800, 1], [800, 10], [800, 20], [250, 5], [4000, 2]]) {
      const built = rlcFor({ freq, q })
      expect(built, `freq=${freq} q=${q}`).not.toBeNull()
      const { R, L, C } = built
      expect(1 / (2 * Math.PI * Math.sqrt(L * C))).toBeCloseTo(freq, 6)
      expect((1 / R) * Math.sqrt(L / C)).toBeCloseTo(q, 9)
    }
  })

  it('the "Resonance is Q" block, at every one of its own chip values, crosses', () => {
    const preset = PRESETS.find((p) => p.name === 'Resonance is Q')
    expect(preset.handOver).toBe(true)
    const block = preset.patch.blocks[0]
    for (const chip of preset.chips) {
      const q = chip.patch.blocks[0].params.q
      const c = circuitFor({ ...block, params: { ...block.params, q } })
      expect(c, `q=${q}`).not.toBeNull()
      expect(c.id).toBe('rlcSeries')
      expect(c.output).toBe('c')
      // The claim the hand-over text makes: the rebuilt circuit's own
      // resonance, |H| at its corner, equals Q — the same fact Signal Lab's
      // own digital biquad already measures at this preset's cutoff
      // (try.test.js: db(H(twenty, 800)) ≈ 26.02, i.e. ×20). transferOf wants
      // the catalog's own lowercase keys, which is what `values` already is,
      // in the catalog's own (r, l, c) order.
      const tf = transferOf(c.id, { r: c.values[0], l: c.values[1], c: c.values[2] }, c.output)
      expect(magnitudeAt(tf, block.params.freq)).toBeCloseTo(q, 2)
    }
  })

  it('the link names this preset as its provenance and round-trips through the catalog', () => {
    const preset = PRESETS.find((p) => p.name === 'Resonance is Q')
    const block = preset.patch.blocks[0]
    const frag = circuitFragment(block, preset.name)
    const { patch, warnings } = parseCircuitLink(frag)
    expect(warnings).toEqual([])
    expect(patch.id).toBe('rlcSeries')
    expect(patch.output).toBe('c')
    expect(patch.from).toEqual({ app: 'signal', id: 'Resonance is Q', label: 'Resonance is Q' })
    const c = CIRCUITS[patch.id]
    c.params.forEach((k, i) => {
      expect(patch.values[i], `${k.label} inside Circuit Lab's knob`).toBeGreaterThanOrEqual(k.min)
      expect(patch.values[i]).toBeLessThanOrEqual(k.max)
    })
  })

  it('exact only: not a low-pass, bypassed, or a value no knob holds', () => {
    expect(circuitFor(null)).toBeNull()
    expect(circuitFor({ type: 'highpass', bypass: false, params: { freq: 800, q: 10 } })).toBeNull()
    expect(circuitFor({ type: 'lowpass', bypass: true, params: { freq: 800, q: 10 } })).toBeNull()
    // A 1 Hz corner needs LC so large no candidate L keeps C on Circuit Lab's
    // 1 mF ceiling.
    expect(circuitFor({ type: 'lowpass', bypass: false, params: { freq: 1, q: 1 } })).toBeNull()
    expect(rlcFor({ freq: 0, q: 1 })).toBeNull()
    expect(rlcFor({ freq: 800, q: 0 })).toBeNull()
  })

  it('links only where Circuit Lab is deployed beside this page', () => {
    const preset = PRESETS.find((p) => p.name === 'Resonance is Q')
    const block = preset.patch.blocks[0]
    // A bare dev port: nothing beside it, so no link (the LabNav rule).
    expect(circuitUrl(block, preset.name, { origin: 'http://127.0.0.1:47340', pathname: '/' })).toBeNull()
    const url = circuitUrl(block, preset.name, {
      origin: 'https://example.github.io',
      pathname: '/ee-labs/signal-lab/',
    })
    expect(url).toMatch(/^https:\/\/example\.github\.io\/ee-labs\/circuit-lab\/#circuit=rlcSeries:/)
  })
})
