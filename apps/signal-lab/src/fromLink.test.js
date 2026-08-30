import { describe, it, expect } from 'vitest'
import { parseLink } from '@ee-labs/ui'
import { stateFromLink } from './fromLink.js'
import { BLOCK_TYPES } from './dsp/blocks.js'

const BASE = {
  sources: [{ id: 1, type: 'sine', freq: 250, amp: 1, phase: 0, enabled: true }],
  blocks: [],
  sampleRate: 8000,
  fftSize: 2048,
}

const load = (link) => stateFromLink(parseLink(link).patch, BASE)

describe('loading a setup from a link', () => {
  it('builds the block a circuit handed over', () => {
    const { state, warnings } = load('rate=48000&b=lowpass:800:10')
    expect(warnings).toEqual([])
    expect(state.sampleRate).toBe(48000)
    expect(state.blocks).toHaveLength(1)
    expect(state.blocks[0].type).toBe('lowpass')
    expect(state.blocks[0].params.freq).toBe(800)
    expect(state.blocks[0].params.q).toBe(10)
  })

  it('maps positional values in the order the block declares them', () => {
    const { state } = load('b=peaking:1000:2:6')
    const p = state.blocks[0].params
    const order = BLOCK_TYPES.peaking.params.map((x) => x.key)
    expect(order.slice(0, 3)).toEqual(['freq', 'q', 'gainDb'])
    expect([p.freq, p.q, p.gainDb]).toEqual([1000, 2, 6])
  })

  it('fills anything the link left out from the block defaults', () => {
    const { state } = load('b=lowpass:1200')
    expect(state.blocks[0].params.freq).toBe(1200)
    expect(state.blocks[0].params.q).toBe(BLOCK_TYPES.lowpass.defaults.q)
  })

  it('refuses a block that does not exist, and says so', () => {
    const { state, warnings } = load('b=flux:1')
    expect(warnings[0]).toMatch(/no block called "flux"/)
    expect(state).toBeNull()
  })

  it('clamps an out-of-range value rather than loading it', () => {
    const { state, warnings } = load('b=lowpass:800:9999')
    expect(warnings.join(' ')).toMatch(/outside/)
    expect(state.blocks[0].params.q).toBeLessThanOrEqual(20)
  })

  it('rejects an impossible sample rate but keeps the rest', () => {
    const { state, warnings } = load('rate=3&b=highpass:500:1')
    expect(warnings.join(' ')).toMatch(/sample rate 3/)
    expect(state.sampleRate).toBe(8000)
    expect(state.blocks).toHaveLength(1)
  })

  it('loads sources too', () => {
    const { state } = load('src=square:440:0.5&b=lowpass:1000:1')
    expect(state.sources).toEqual([
      { id: 1, type: 'square', freq: 440, amp: 0.5, phase: 0, enabled: true },
    ])
  })

  it('refuses a waveform that does not exist', () => {
    const { warnings } = load('src=triangular:100:1')
    expect(warnings[0]).toMatch(/no waveform/)
  })

  it('leaves the app alone when there is nothing to load', () => {
    expect(stateFromLink(null, BASE).state).toBeNull()
    expect(load('').state).toBeNull()
  })
})
