import { describe, it, expect } from 'vitest'
import { FAULT_KINDS, crossoverRatio, faultStudy, faultTable, sequenceImpedances } from './faults.js'
import { neutral, toSequence } from './sequence.js'
import { bases } from './perUnit.js'
import { FAULT_NETWORK } from './library.js'
import { C, cabs, cadd, cdiv, csub } from './cx.js'

// The fault network of GRID_LAB_PLAN.md §4.3: a generator at X1 = X2 = 0.15,
// X0 = 0.05 pu solidly grounded, a delta to grounded-wye transformer at
// 0.10 pu, and a line at X1 = X2 = 0.20, X0 = 0.60 pu.

const B = bases({ Sbase: 100e6, Vbase: 230e3 })
const amps = (pu) => pu * B.Ibase

describe('the three sequence impedances', () => {
  it('gives Z1 = Z2 = j0.45 pu and Z0 = j0.70 pu behind a delta winding', () => {
    const z = sequenceImpedances(FAULT_NETWORK)
    expect(z.Z1[1]).toBeCloseTo(0.15 + 0.1 + 0.2, 12)
    expect(z.Z1[1]).toBeCloseTo(0.45, 12)
    expect(z.Z2[1]).toBeCloseTo(0.45, 12)
    expect(z.Z0[1]).toBeCloseTo(0.1 + 0.6, 12)
    expect(z.throughTransformer).toBe(false)
    // The delta blocks the generator's own zero sequence, so Z0 is not a
    // multiple of Z1.
    expect(z.Z0[1] / z.Z1[1]).not.toBeCloseTo(3, 3)
  })

  it('opens the delta into a grounded wye and Z0 takes in the generator 0.05 pu', () => {
    const z = sequenceImpedances({ ...FAULT_NETWORK, transformer: { X: 0.1, connection: 'wyeg-wyeg' } })
    expect(z.Z0[1]).toBeCloseTo(0.75, 12)
    expect(z.throughTransformer).toBe(true)
  })

  it('counts a neutral grounding impedance three times', () => {
    const z = sequenceImpedances({
      ...FAULT_NETWORK,
      generator: { ...FAULT_NETWORK.generator, Zn: 0.1 },
      transformer: { X: 0.1, connection: 'wyeg-wyeg' },
    })
    expect(z.Z0[1]).toBeCloseTo(0.75 + 0.3, 12)
    expect(z.Z0[1] - 0.75).toBeCloseTo(3 * 0.1, 12)
  })

  it('refuses a winding connection it does not know', () => {
    expect(() => sequenceImpedances({ ...FAULT_NETWORK, transformer: { X: 0.1, connection: 'nonesuch' } })).toThrow(/winding connection/)
    expect(() => faultStudy(FAULT_NETWORK, { kind: 'nonesuch' })).toThrow(/unknown fault/)
  })
})

describe('the three-phase fault', () => {
  const f = faultStudy(FAULT_NETWORK, { kind: '3ph' })

  it('is 2.2222 pu, which is 557.83 A and 222.22 MVA at the fault bus', () => {
    expect(f.seqMag[1]).toBeCloseTo(1 / 0.45, 9)
    expect(f.seqMag[1]).toBeCloseTo(2.2222, 4)
    expect(amps(f.seqMag[1])).toBeCloseTo(557.83, 2)
    expect(f.seqMag[1] * 100).toBeCloseTo(222.22, 2)
  })

  it('leaves the negative and zero networks carrying nothing', () => {
    expect(f.seqMag[0]).toBeLessThan(1e-15)
    expect(f.seqMag[2]).toBeLessThan(1e-15)
    expect(f.groundMag).toBeLessThan(1e-15)
    // And every phase carries the same current, 120° apart.
    for (const m of f.phaseMag) expect(m).toBeCloseTo(f.seqMag[1], 12)
  })
})

describe('single line to ground', () => {
  const f = faultStudy(FAULT_NETWORK, { kind: 'slg' })

  it('puts the three networks in series, so the current is 3E/(Z0+Z1+Z2)', () => {
    expect(f.phaseMag[0]).toBeCloseTo(3 / (0.45 + 0.45 + 0.7), 9)
    expect(f.phaseMag[0]).toBeCloseTo(1.875, 6)
    expect(amps(f.phaseMag[0])).toBeCloseTo(470.67, 2)
    for (const m of f.seqMag) expect(m).toBeCloseTo(0.625, 9)
  })

  it('leaves the other two phases carrying nothing, and the ground carrying it all', () => {
    expect(f.phaseMag[1]).toBeLessThan(1e-12)
    expect(f.phaseMag[2]).toBeLessThan(1e-12)
    expect(f.groundMag).toBeCloseTo(f.phaseMag[0], 9)
    expect(f.groundMag).toBeCloseTo(3 * f.seqMag[0], 12)
  })
})

describe('line to line', () => {
  const f = faultStudy(FAULT_NETWORK, { kind: 'll' })

  it('carries 1.9245 pu in two phases in opposite directions', () => {
    expect(f.phaseMag[1]).toBeCloseTo(Math.sqrt(3) / (0.45 + 0.45), 9)
    expect(f.phaseMag[1]).toBeCloseTo(1.9245, 4)
    expect(f.phaseMag[2]).toBeCloseTo(f.phaseMag[1], 12)
    expect(cabs(cadd(f.phase[1], f.phase[2]))).toBeLessThan(1e-14)
  })

  it('leaves the third phase and the ground with nothing', () => {
    expect(f.phaseMag[0]).toBeLessThan(1e-14)
    expect(f.groundMag).toBeLessThan(1e-15)
    expect(f.seqMag[0]).toBeLessThan(1e-15)
  })
})

describe('double line to ground', () => {
  const f = faultStudy(FAULT_NETWORK, { kind: 'dlg' })

  it('gives I1 = 1.3814, I2 = 0.84084 and I0 = 0.54054 pu', () => {
    expect(f.seqMag[1]).toBeCloseTo(1.3814, 4)
    expect(f.seqMag[2]).toBeCloseTo(0.84084, 5)
    expect(f.seqMag[0]).toBeCloseTo(0.54054, 5)
    // The positive current is E over Z1 in series with Z2 ∥ Z0.
    const par = (0.45 * 0.7) / (0.45 + 0.7)
    expect(f.seqMag[1]).toBeCloseTo(1 / (0.45 + par), 9)
  })

  it('carries 2.0883 pu in the two faulted phases and 1.6216 pu, 407.06 A, in the ground', () => {
    expect(f.phaseMag[1]).toBeCloseTo(2.0883, 4)
    expect(f.phaseMag[2]).toBeCloseTo(2.0883, 4)
    expect(f.phaseMag[0]).toBeLessThan(1e-14)
    expect(f.groundMag).toBeCloseTo(1.6216, 4)
    expect(f.groundMag).toBeCloseTo(3 * f.seqMag[0], 12)
    expect(amps(f.groundMag)).toBeCloseTo(407.06, 2)
  })
})

describe('every fault', () => {
  it('has its phase currents summing to three times its zero sequence', () => {
    for (const f of faultTable(FAULT_NETWORK)) {
      const n = neutral(f.phase)
      expect(Math.abs(n.mag - f.groundMag), f.kind).toBeLessThan(1e-13)
    }
  })

  it('is smaller through a fault impedance than through a bolted short', () => {
    for (const kind of FAULT_KINDS) {
      const bolted = faultStudy(FAULT_NETWORK, { kind })
      const through = faultStudy(FAULT_NETWORK, { kind, Zf: [0.05, 0] })
      expect(through.seqMag[1], kind).toBeLessThan(bolted.seqMag[1])
    }
  })

  it('carries a connection sentence naming which networks it joins', () => {
    for (const f of faultTable(FAULT_NETWORK)) {
      expect(f.connection.length, f.kind).toBeGreaterThan(30)
      expect(f.label.length, f.kind).toBeGreaterThan(3)
    }
  })
})

describe('which fault is the worst', () => {
  it('is the three-phase fault here, and the ground fault overtakes it below Z0 = Z1', () => {
    const table = faultTable(FAULT_NETWORK)
    const worst = table.reduce((a, b) => (Math.max(...b.phaseMag) > Math.max(...a.phaseMag) ? b : a))
    expect(worst.kind).toBe('3ph')
    // The single line-to-ground fault carries the largest ground current.
    const ground = table.reduce((a, b) => (b.groundMag > a.groundMag ? b : a))
    expect(ground.kind).toBe('slg')
    const cross = crossoverRatio(FAULT_NETWORK)
    expect(cross.ratio).toBeCloseTo(1, 3)
    expect(cross.at(0.5).slg).toBeGreaterThan(cross.at(0.5).three)
    expect(cross.at(2).slg).toBeLessThan(cross.at(2).three)
  })
})
