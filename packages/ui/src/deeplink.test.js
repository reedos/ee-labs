import { describe, it, expect } from 'vitest'
import { buildLink, parseLink, siblingUrl, homeUrl } from './deeplink.js'

// Both ends of the bridge have to agree, so the round trip is the contract.

describe('deep links', () => {
  it('round-trips a patch', () => {
    const patch = {
      rate: 48000,
      sources: [{ type: 'square', freq: 250, amp: 1 }],
      blocks: [
        { type: 'lowpass', params: [800, 10] },
        { type: 'clip', params: [0.5] },
      ],
    }
    const { patch: back, warnings } = parseLink(buildLink(patch))
    expect(warnings).toEqual([])
    expect(back.rate).toBe(48000)
    expect(back.sources).toEqual([{ type: 'square', freq: 250, amp: 1 }])
    expect(back.blocks).toEqual(patch.blocks)
  })

  it('stays readable, which is the point of not encoding it', () => {
    const link = buildLink({ rate: 48000, blocks: [{ type: 'lowpass', params: [800, 0.707] }] })
    expect(link).toBe('rate=48000&b=lowpass:800:0.707')
  })

  it('survives a leading hash and empty segments', () => {
    const { patch } = parseLink('#rate=8000&&b=notch:1000:5')
    expect(patch.rate).toBe(8000)
    expect(patch.blocks).toHaveLength(1)
  })

  it('reports what it could not read instead of guessing', () => {
    const { patch, warnings } = parseLink('rate=fast&b=lowpass:eight:1&wat=3&nope')
    expect(warnings).toHaveLength(4)
    expect(warnings.join(' ')).toMatch(/rate "fast"/)
    expect(warnings.join(' ')).toMatch(/"eight" is not a number/)
    expect(warnings.join(' ')).toMatch(/unknown setting "wat"/)
    expect(warnings.join(' ')).toMatch(/not a key=value/)
    // The bad block is dropped, not loaded with a NaN in it.
    expect(patch).toBeNull()
  })

  it('keeps a good block when a different one is bad', () => {
    const { patch, warnings } = parseLink('b=lowpass:800:2&b=bogus:x')
    expect(warnings).toHaveLength(1)
    expect(patch.blocks).toEqual([{ type: 'lowpass', params: [800, 2] }])
  })

  it('is null for nothing at all, so a bare URL is not an empty patch', () => {
    expect(parseLink('').patch).toBeNull()
    expect(parseLink('#').patch).toBeNull()
  })

  it('does not lose precision that matters', () => {
    const link = buildLink({ blocks: [{ type: 'lowpass', params: [1234.5678, 0.7071068] }] })
    const { patch } = parseLink(link)
    expect(patch.blocks[0].params[0]).toBeCloseTo(1234.5678, 2)
    expect(patch.blocks[0].params[1]).toBeCloseTo(0.7071068, 6)
  })

  it('raw-coefficient carriers round-trip bit-exactly', () => {
    // For b=biquad and plant=custom the coefficients ARE the object, and at
    // a high-Q resonance the digits past twelve are the pole's whole
    // distance from instability. String(x) is the shortest decimal that
    // round-trips a float64 exactly — so the contract here is toEqual, not
    // toBeCloseTo.
    const b = [0.9056990020843223, -1.8089416937329754, 0.905699002084322, -1.80894169373, 0.9999999999995452]
    const bi = buildLink({ blocks: [{ type: 'biquad', params: b }] })
    expect(parseLink(bi).patch.blocks[0].params).toEqual(b)
    const cu = buildLink({ plant: { type: 'custom', params: b.concat(1e-13) } })
    expect(parseLink(cu).patch.plant.params).toEqual(b.concat(1e-13))
  })
})

describe('carrying a control loop', () => {
  it('round-trips a plant and a controller', () => {
    const patch = {
      plant: { type: 'secondOrder', params: [1, 31622.8, 0.158] },
      ctrl: { type: 'pi', params: [2, 4] },
    }
    const { patch: back, warnings } = parseLink(buildLink(patch))
    expect(warnings).toEqual([])
    expect(back.plant).toEqual(patch.plant)
    expect(back.ctrl).toEqual(patch.ctrl)
  })

  it('uses the same grammar as the other item keys', () => {
    const link = buildLink({
      plant: { type: 'firstOrder', params: [1, 0.5] },
      ctrl: { type: 'p', params: [9] },
    })
    expect(link).toBe('plant=firstOrder:1:0.5&ctrl=p:9')
  })

  it('a plant alone is a patch, not nothing', () => {
    expect(parseLink('plant=integrator:1').patch.plant.type).toBe('integrator')
  })

  it('still refuses a malformed one', () => {
    const { warnings } = parseLink('plant=secondOrder:1:fast:0.2')
    expect(warnings[0]).toMatch(/"fast" is not a number/)
  })
})

describe('siblingUrl', () => {
  const at = (pathname, origin = 'https://reedos.github.io') => ({ origin, pathname })

  it('swaps the app segment on the deployed site', () => {
    expect(siblingUrl('signal-lab', 'rate=48000', at('/ee-labs/circuit-lab/'))).toBe(
      'https://reedos.github.io/ee-labs/signal-lab/#rate=48000',
    )
    expect(siblingUrl('control-lab', 'plant=integrator:2', at('/ee-labs/circuit-lab/index.html'))).toBe(
      'https://reedos.github.io/ee-labs/control-lab/#plant=integrator:2',
    )
  })

  it('works at any mount depth, including the domain root', () => {
    expect(siblingUrl('signal-lab', 'rate=8000', at('/circuit-lab/'))).toBe(
      'https://reedos.github.io/signal-lab/#rate=8000',
    )
    expect(siblingUrl('signal-lab', 'rate=8000', at('/deep/nest/circuit-lab/'))).toBe(
      'https://reedos.github.io/deep/nest/signal-lab/#rate=8000',
    )
  })

  it('returns null in dev, where no app segment is in the path', () => {
    expect(siblingUrl('signal-lab', 'rate=8000', at('/', 'http://localhost:1422'))).toBeNull()
  })

  it('returns null for itself, an unknown app, and no location at all', () => {
    expect(siblingUrl('circuit-lab', 'x=1', at('/ee-labs/circuit-lab/'))).toBeNull()
    expect(siblingUrl('mystery-lab', 'x=1', at('/ee-labs/circuit-lab/'))).toBeNull()
    expect(siblingUrl('signal-lab', 'x=1', null)).toBeNull()
  })

  it('does not match a segment that merely contains an app name', () => {
    expect(siblingUrl('signal-lab', 'x=1', at('/my-circuit-lab-notes/'))).toBeNull()
  })
})

describe('homeUrl', () => {
  const at = (pathname, origin = 'https://reedos.github.io') => ({ origin, pathname })

  it('points at the directory the lab folders sit in', () => {
    expect(homeUrl(at('/ee-labs/signal-lab/'))).toBe('https://reedos.github.io/ee-labs/')
    expect(homeUrl(at('/ee-labs/control-lab/index.html'))).toBe('https://reedos.github.io/ee-labs/')
    expect(homeUrl(at('/circuit-lab/'))).toBe('https://reedos.github.io/')
  })

  it('returns null in dev and with no location, like siblingUrl', () => {
    expect(homeUrl(at('/', 'http://localhost:1422'))).toBeNull()
    expect(homeUrl(null)).toBeNull()
    expect(homeUrl(at('/my-circuit-lab-notes/'))).toBeNull()
  })
})

describe('provenance', () => {
  it('round-trips app, id and a label with spaces and colons', () => {
    const link = buildLink({
      plant: { type: 'firstOrder', params: [1, 0.0001] },
      from: { app: 'circuit', id: 'rcLow', label: 'RC low-pass: 1k / 100n' },
    })
    const { patch, warnings } = parseLink(link)
    expect(warnings).toEqual([])
    expect(patch.from).toEqual({ app: 'circuit', id: 'rcLow', label: 'RC low-pass: 1k / 100n' })
    expect(patch.plant.type).toBe('firstOrder')
  })

  it('a malformed from= warns instead of guessing', () => {
    const { patch, warnings } = parseLink('#plant=firstOrder:1:0.1&from=circuit')
    expect(patch.plant).toBeTruthy()
    expect(warnings.some((w) => w.includes('from='))).toBe(true)
  })

  it('provenance alone does not make an empty link loadable', () => {
    const { patch } = parseLink('#from=circuit:rcLow:RC')
    expect(patch).toBeNull()
  })
})

it('zoom rides the link and bad zooms warn', () => {
  const link = buildLink({ rate: 192000, zoom: 12732 })
  expect(link).toContain('zoom=12732')
  expect(parseLink(link).patch.zoom).toBe(12732)
  expect(parseLink('#rate=8000&zoom=wat').warnings.some((w) => w.includes('zoom'))).toBe(true)
})
