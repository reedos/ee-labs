import { describe, it, expect } from 'vitest'
import { parseLink } from '@ee-labs/ui'
import { stateFromLink, CIRCUIT_NAMES, fromAppName, fromDisplayName } from './fromLink.js'
import { PLANTS } from './systems.js'
import { asControlPlant } from '../../circuit-lab/src/toSignalLab.js'
import { transferOf, defaultsOf, CIRCUITS } from '../../circuit-lab/src/circuits.js'
import { magnitudeAt } from '@ee-labs/systems'

const load = (link) => stateFromLink(parseLink(link).patch)

describe('naming an arrival', () => {
  it('every catalog entry is pinned against Circuit Lab\'s own display name', () => {
    for (const [id, c] of Object.entries(CIRCUITS)) {
      expect(CIRCUIT_NAMES[id], id).toBe(c.name)
    }
    // And nothing here names a circuit the catalog does not have.
    for (const id of Object.keys(CIRCUIT_NAMES)) {
      expect(CIRCUITS[id], id).toBeTruthy()
    }
  })

  it('names the sending app as a person would say it', () => {
    expect(fromAppName({ app: 'circuit', id: 'rcLow' })).toBe('Circuit Lab')
    expect(fromAppName({ app: 'signal', id: 'x' })).toBe('Signal Lab')
    expect(fromAppName(null)).toBeNull()
  })

  it('prefers the arrival\'s own label, falls back to the catalog name, then the bare id', () => {
    expect(fromDisplayName({ app: 'circuit', id: 'rlcSeries', label: 'My RLC' })).toBe('My RLC')
    // No label — Circuit Lab's own walker arrives this way — so the catalog
    // name is what the banner and the P(s) box must show, not the raw id.
    expect(fromDisplayName({ app: 'circuit', id: 'rlcSeries' })).toBe('Series RLC')
    expect(fromDisplayName({ app: 'circuit', id: 'not-a-real-circuit' })).toBe('not-a-real-circuit')
    expect(fromDisplayName(null)).toBeNull()
  })
})

describe('loading a loop from a link', () => {
  it('builds the plant and controller a circuit handed over', () => {
    const { state, warnings } = load('plant=secondOrder:1:31622.8:0.158&ctrl=p:2')
    expect(warnings).toEqual([])
    expect(state.plantId).toBe('secondOrder')
    expect(state.plantP.wn).toBeCloseTo(31622.8, 1)
    expect(state.plantP.zeta).toBeCloseTo(0.158, 6)
    expect(state.ctrlId).toBe('p')
    expect(state.ctrlP.kp).toBe(2)
  })

  it('refuses a plant that does not exist', () => {
    const { state, warnings } = load('plant=pendulum:1')
    expect(warnings[0]).toMatch(/no plant called "pendulum"/)
    expect(state).toBeNull()
  })

  it('clamps rather than loading an impossible value', () => {
    const { state, warnings } = load('plant=firstOrder:1:99999')
    expect(warnings.join(' ')).toMatch(/outside/)
    expect(state.plantP.tau).toBeLessThanOrEqual(PLANTS.firstOrder.params[1].max)
  })

  it('takes a plant without a controller', () => {
    const { state } = load('plant=integrator:5')
    expect(state.plantId).toBe('integrator')
    expect(state.ctrlId).toBeNull()
  })

  it('provenance rides along, and only with a plant that survived', () => {
    const { state } = load('plant=firstOrder:1:1&ctrl=p:9&from=circuit:rc:My%20RC%20low-pass')
    expect(state.from).toEqual({ app: 'circuit', id: 'rc', label: 'My RC low-pass' })
    // Provenance without a usable plant would name a circuit that is not
    // on screen — dropped.
    const { state: ctrlOnly } = load('ctrl=p:9&from=circuit:rc:x')
    expect(ctrlOnly.from).toBeNull()
  })

  it('a custom plant arrives with exact, unclamped coefficients', () => {
    // The whole point of custom: an RLC's a₂ = LC ≈ 1e-10 must land as
    // itself, not clamped to some slider's idea of reasonable.
    const { state, warnings } = load('plant=custom:0:0:1:1e-10:1e-5:1&ctrl=p:2')
    expect(warnings).toEqual([])
    expect(state.plantId).toBe('custom')
    expect(state.plantP.b0).toBe(1)
    expect(state.plantP.a2).toBe(1e-10)
    expect(state.plantP.a1).toBe(1e-5)
    expect(state.ctrlP.kp).toBe(2)
  })
})

describe('a circuit really arrives as the same system', () => {
  // The end of the triangle: Circuit Lab describes a network, Control Lab
  // closes a loop around it, and the plant in the middle must be the same
  // object or every margin downstream is wrong.
  it('an RLC handed over has the response it had as a circuit', () => {
    const p = defaultsOf('rlcSeries')
    const tf = transferOf('rlcSeries', p, 'c')
    const handed = asControlPlant(tf)
    const { state, warnings } = load(handed.link)
    expect(warnings).toEqual([])

    const rebuilt = PLANTS[state.plantId].tf(state.plantP)
    const f0 = 1 / (2 * Math.PI * Math.sqrt(p.l * p.c))
    // Agreement is limited by the link's own precision, not by the mapping: it
    // carries six significant figures so that it stays readable and editable,
    // which puts a floor of about a part in a million on the round trip. That
    // is far below anything a plot or a margin can show.
    for (const r of [0.1, 0.5, 1, 2, 10]) {
      const ratio = magnitudeAt(rebuilt, f0 * r) / magnitudeAt(tf, f0 * r)
      expect(ratio, `${r}x f0`).toBeCloseTo(1, 5)
    }
  })

  it('an RC low-pass arrives as a first-order lag with the same corner', () => {
    const p = defaultsOf('rcLow')
    const tf = transferOf('rcLow', p, 'c')
    const { state } = load(asControlPlant(tf).link)
    const rebuilt = PLANTS[state.plantId].tf(state.plantP)
    const fc = 1 / (2 * Math.PI * p.r * p.c)
    expect(magnitudeAt(rebuilt, fc)).toBeCloseTo(Math.SQRT1_2, 6)
    expect(magnitudeAt(rebuilt, fc)).toBeCloseTo(magnitudeAt(tf, fc), 9)
  })
})
