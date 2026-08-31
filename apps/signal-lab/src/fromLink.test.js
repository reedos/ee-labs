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

  it('the order select rides the link as a trailing positional (Circuit Lab’s 1st-order tier)', () => {
    // b=lowpass:<fc>:<q>:<order> — the numeric params first, then any select
    // whose options are all numbers. An RC low-pass must arrive AS a
    // 1st-order low-pass, Q knob hidden, not as an order-2 lookalike.
    const { state, warnings } = load('rate=192000&b=lowpass:2456.6:0.70711:1')
    expect(warnings).toEqual([])
    const b = state.blocks[0]
    expect(b.type).toBe('lowpass')
    expect(b.params.freq).toBeCloseTo(2456.6, 6)
    expect(b.params.order).toBe('1')
  })

  it('an order the select does not offer is refused by name, default kept', () => {
    const { state, warnings } = load('rate=48000&b=lowpass:1000:0.7:3')
    expect(warnings.some((w) => /Order 3 is not one of 1\/2\/4/.test(w))).toBe(true)
    expect(state.blocks[0].params.order).toBe('2')
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
    // The knob ceiling is 100 now (it tracks Q_MAX, so a hand-over's series
    // RLC crosses by name at everyday component values); 9999 still clamps.
    expect(state.blocks[0].params.q).toBe(100)
  })

  it('accepts the Q a hand-over names up to 100, unclamped', () => {
    const { state, warnings } = load('rate=192000&b=bandpass:5033:31.6228')
    expect(warnings).toEqual([])
    expect(state.blocks[0].params.q).toBeCloseTo(31.6228, 6)
  })

  it('a hand-over gain block arrives beside its filter, up to ±126 dB', () => {
    // Circuit Lab factors an in-band gain (a 1 MΩ tank's 80 dB resonant
    // impedance, a normalized raw biquad's scale) into b=gain:<dB>. The
    // widened range must hold the component box's full ×10⁶.
    const { state, warnings } = load('rate=192000&b=bandpass:5033:31.6&b=gain:80')
    expect(warnings).toEqual([])
    expect(state.blocks).toHaveLength(2)
    expect(state.blocks[1].type).toBe('gain')
    expect(state.blocks[1].params.gainDb).toBe(80)
    // ...and past the knob it still clamps with the warning, never silently.
    const over = load('b=gain:200')
    expect(over.warnings.join(' ')).toMatch(/outside/)
    expect(over.state.blocks[0].params.gainDb).toBe(126)
  })

  it('a source below 1 Hz is clamped — the scope must not buffer hours of signal', () => {
    // The scope spans a fixed count of the fundamental's cycles, so
    // src=square:0.0001 asks for five cycles at 0.1 mHz: fourteen hours of
    // samples, an allocation that kills the tab. Clamped and named.
    const { state, warnings } = load('src=square:0.0001:0.8&b=lowpass:100:1')
    expect(warnings.join(' ')).toMatch(/outside 1…/)
    expect(state.sources[0].freq).toBe(1)
    // The other edge: a source past Nyquist folds; clamped there too.
    const hot = load('src=sine:999999:1')
    expect(hot.warnings.join(' ')).toMatch(/outside/)
    expect(hot.state.sources[0].freq).toBe(4000) // BASE rate 8000
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

it('a raw-coefficient biquad arrives through a link, coefficients in schema order', () => {
  const { patch } = parseLink('#rate=48000&src=noise:100:0.6&b=biquad:0.2:0.1:0.05:-0.3:0.2')
  const { state, warnings } = stateFromLink(patch, BASE)
  expect(warnings).toEqual([])
  const b = state.blocks[0]
  expect(b.type).toBe('biquad')
  expect(b.params).toMatchObject({ b0: 0.2, b1: 0.1, b2: 0.05, a1: -0.3, a2: 0.2 })
})

it('an arriving zoom sets the spectrum span, so the corner is on screen', () => {
  const { state } = load('#rate=192000&b=biquad:0.0254:0.0254:0:-0.9492:0&zoom=12732')
  expect(state.specMax).toBe(12732)
})
