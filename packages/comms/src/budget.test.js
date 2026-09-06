import { describe, it, expect } from 'vitest'
import {
  ktDbm,
  noiseFloorDbm,
  wavelength,
  pathLossDb,
  rangeFor,
  friisNoiseFigure,
  linkBudget,
  implementationLoss,
  HARD_DECISION_DB,
} from './budget.js'
import { ebN0For } from './ber.js'
import { ofdmRate } from './ofdm.js'
import { eyeOpening } from './shape.js'

describe('the noise floor', () => {
  it('starts from kT at 290 K, which is -173.9752 dBm per hertz', () => {
    expect(ktDbm(290)).toBeCloseTo(-173.9752, 4)
  })

  it('reads -107.975 dBm in a megahertz at a noise figure of 6 dB', () => {
    expect(noiseFloorDbm({ bandwidth: 1e6, noiseFigureDb: 6 })).toBeCloseTo(-107.975, 3)
  })

  it('rises by 3.010 dB when the band is doubled', () => {
    const a = noiseFloorDbm({ bandwidth: 1e6, noiseFigureDb: 6 })
    const b = noiseFloorDbm({ bandwidth: 2e6, noiseFigureDb: 6 })
    expect(b - a).toBeCloseTo(10 * Math.log10(2), 9)
  })

  it('rises decibel for decibel with the noise figure', () => {
    const a = noiseFloorDbm({ noiseFigureDb: 6 })
    const b = noiseFloorDbm({ noiseFigureDb: 9 })
    expect(b - a).toBeCloseTo(3, 9)
  })
})

describe('Friis, and why the order of two stages is not free', () => {
  const lna = { gainDb: 12, noiseFigureDb: 1.5 }
  const mixer = { gainDb: 10, noiseFigureDb: 4 }

  it('is dominated by the first stage', () => {
    const f = friisNoiseFigure([lna, mixer])
    expect(f.db).toBeGreaterThan(lna.noiseFigureDb)
    expect(f.db).toBeLessThan(mixer.noiseFigureDb)
  })

  it('is worse with the noisier stage first', () => {
    expect(friisNoiseFigure([mixer, lna]).db).toBeGreaterThan(friisNoiseFigure([lna, mixer]).db)
  })

  it('reads 1.784 dB one way and 4.071 dB the other, at these two stages', () => {
    // The plan quotes 1.944 dB and 4.166 dB for this pair. Both are recomputed
    // here from the stated gains and noise figures, and the difference is
    // recorded in NEEDS.md for the director.
    expect(friisNoiseFigure([lna, mixer]).db).toBeCloseTo(1.784, 3)
    expect(friisNoiseFigure([mixer, lna]).db).toBeCloseTo(4.071, 3)
  })

  it('adds the gains of the stages it cascades', () => {
    expect(friisNoiseFigure([lna, mixer]).gainDb).toBeCloseTo(22, 9)
  })

  it('gives one stage its own noise figure back', () => {
    expect(friisNoiseFigure([lna]).db).toBeCloseTo(1.5, 9)
  })
})

describe('free-space path loss', () => {
  it('puts the wavelength at 124.91 mm for 2.4 GHz', () => {
    expect(wavelength(2.4e9) * 1000).toBeCloseTo(124.91, 2)
  })

  it('reads 80.052, 100.052 and 120.052 dB over three decades of distance', () => {
    expect(pathLossDb({ distance: 100 })).toBeCloseTo(80.052, 3)
    expect(pathLossDb({ distance: 1000 })).toBeCloseTo(100.052, 3)
    expect(pathLossDb({ distance: 10000 })).toBeCloseTo(120.052, 3)
  })

  it('is 20 dB a decade, which is the whole shape of the curve', () => {
    expect(pathLossDb({ distance: 1000 }) - pathLossDb({ distance: 100 })).toBeCloseTo(20, 9)
  })

  it('inverts, so a loss gives back the distance that produced it', () => {
    expect(rangeFor({ lossDb: pathLossDb({ distance: 1234 }) })).toBeCloseTo(1234, 6)
  })
})

describe('the budget to a margin', () => {
  const b = linkBudget({})

  it('receives -76.052 dBm at a kilometre', () => {
    expect(b.received).toBeCloseTo(-76.052, 3)
  })

  it('reads a ratio of 31.923 dB in a megahertz', () => {
    expect(b.snr).toBeCloseTo(31.923, 3)
  })

  it('reads 28.913 dB of Eb over N0 at 2 megabit a second', () => {
    expect(b.ebN0).toBeCloseTo(28.913, 3)
  })

  it('leaves 19.325 dB of margin over what QPSK needs', () => {
    expect(b.requiredEbN0Db).toBeCloseTo(ebN0For('qpsk', 1e-5), 3)
    expect(b.margin).toBeCloseTo(19.325, 3)
  })

  it('reaches 9252 m before the margin runs out', () => {
    expect(b.range).toBeCloseTo(9252, 0)
  })

  it('moves the margin when the distance moves, decibel for decibel', () => {
    const far = linkBudget({ distance: 2000 })
    expect(b.margin - far.margin).toBeCloseTo(20 * Math.log10(2), 6)
  })

  it('costs 3.010 dB of Eb over N0 for every doubling of the bit rate', () => {
    const fast = linkBudget({ bitRate: 4e6 })
    expect(b.ebN0 - fast.ebN0).toBeCloseTo(10 * Math.log10(2), 9)
  })
})

describe('what the implementation costs', () => {
  it('adds the four losses this lab has already measured', () => {
    const g = ofdmRate({ n: 64, cp: 16, used: 52, pilots: 4 })
    // The timing loss is the eye opening at a twentieth of a symbol, in dB.
    const timing = -20 * Math.log10(eyeOpening(0.35, 0.05))
    const l = implementationLoss({
      prefixCostDb: g.prefixCostDb,
      pilotCostDb: g.pilotCostDb,
      hardDecisionDb: HARD_DECISION_DB,
      timingLossDb: timing,
    })
    expect(timing).toBeCloseTo(1.291, 3)
    expect(l.total).toBeCloseTo(4.193, 2)
    expect(l.rows.length).toBe(4)
  })

  it('names the experiment each row came from', () => {
    const l = implementationLoss({
      prefixCostDb: 1,
      pilotCostDb: 1,
      hardDecisionDb: 1,
      timingLossDb: 1,
    })
    expect(l.rows.map((r) => r.from)).toEqual(['F6', 'F6', 'D2', 'C5'])
    expect(l.total).toBe(4)
  })
})
