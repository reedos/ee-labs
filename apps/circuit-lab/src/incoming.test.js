import { describe, it, expect } from 'vitest'
import { buildCircuitLink, parseCircuitLink } from '@ee-labs/ui'
import { stateFromLink } from './incoming.js'
import { CIRCUITS, defaultsOf, transferOf } from './circuits.js'

// What arrives is checked against the catalog. The happy path is exact; every
// unhappy path loads either nothing or a clamped circuit that says so.

const arrive = (fragment) => stateFromLink(parseCircuitLink(fragment).patch)

describe('a circuit arriving by link', () => {
  it('loads every catalog circuit at its defaults, exactly, with the output it asked for', () => {
    for (const [id, c] of Object.entries(CIRCUITS)) {
      const d = defaultsOf(id)
      for (const o of c.outputs) {
        const link = buildCircuitLink({ id, values: c.params.map((p) => d[p.key]), output: o.key })
        const { state, warnings } = arrive(link)
        expect(warnings, link).toEqual([])
        expect(state.id).toBe(id)
        expect(state.params).toEqual(d)
        expect(state.output).toBe(o.key)
        // And the transfer function the receiver will draw is the sender's.
        expect(transferOf(state.id, state.params, state.output)).toEqual(transferOf(id, d, o.key))
      }
    }
  })

  it('carries awkward values to the last bit', () => {
    const values = [1234.5678, 0.1 + 0.2, 4.7e-8]
    const { state } = arrive(buildCircuitLink({ id: 'rlcSeries', values, output: 'r' }))
    expect(state.params).toEqual({ r: values[0], l: values[1], c: values[2] })
  })

  it('refuses an unknown circuit and a wrong value count, and says so', () => {
    expect(arrive('circuit=nope:1:2')).toEqual({ state: null, warnings: ['No circuit called "nope" here; nothing loaded.'] })
    const r = arrive('circuit=rcLow:1000')
    expect(r.state).toBeNull()
    expect(r.warnings[0]).toMatch(/takes 2 values .* carried 1/)
    expect(stateFromLink(null)).toEqual({ state: null, warnings: [] })
  })

  it('clamps a value outside the knob and reports the clamp', () => {
    const { state, warnings } = arrive('circuit=rlLow:1000:5')
    expect(state.params).toEqual({ r: 1000, l: 1 })
    expect(warnings).toEqual(['L = 5 H is outside this knob\'s 0.000001–1 H; clamped to 1 H.'])
  })

  it('falls back to the first output when the one asked for does not exist', () => {
    const { state, warnings } = arrive('circuit=rcLow:1000:1e-7&out=l')
    expect(state.output).toBe('c')
    expect(warnings).toEqual(['"RC low-pass" has no output "l"; showing across C.'])
  })

  it('keeps provenance for the arrival notice', () => {
    const { state } = arrive(buildCircuitLink({ id: 'rcLow', values: [1, 1], from: { app: 'elements', id: 'h6', label: 'Bode' } }))
    expect(state.from).toEqual({ app: 'elements', id: 'h6', label: 'Bode' })
  })
})
