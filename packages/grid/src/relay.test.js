import { describe, it, expect } from 'vitest'
import { IEC_CURVES, apparentZ, coordinate, curvePoints, definiteTime, distanceZones, iecTime, ieeeTime, measuredZ, multiple, zoneOf } from './relay.js'
import { polar } from './cx.js'

// GRID_LAB_PLAN.md §4.3's protection numbers: IEC very inverse, a 400 A
// pickup, and a 40 Ω line with zones at 80 % and 120 %.

const RELAY = { pickup: 400, tds: 0.1, curve: 'veryInverse' }

describe('the inverse-time overcurrent curve', () => {
  it('operates in 1.35 s at 800 A, 0.45 s at 1600 A and 0.15 s at 4000 A', () => {
    const { K, alpha } = IEC_CURVES.veryInverse
    for (const I of [800, 1600, 4000]) {
      const M = multiple(RELAY, I)
      expect(iecTime(RELAY, I), `${I} A`).toBeCloseTo((RELAY.tds * K) / (M ** alpha - 1), 12)
    }
    expect(iecTime(RELAY, 800)).toBeCloseTo(1.35, 10)
    expect(iecTime(RELAY, 1600)).toBeCloseTo(0.45, 10)
    expect(iecTime(RELAY, 4000)).toBeCloseTo(0.15, 10)
  })

  it('is inverse: a bigger fault clears sooner, at every multiple', () => {
    let previous = Infinity
    for (const I of [500, 800, 1200, 1600, 3000, 8000]) {
      const t = iecTime(RELAY, I)
      expect(t, `${I} A`).toBeLessThan(previous)
      previous = t
    }
  })

  it('never operates at or below pickup, and says so with an infinite time', () => {
    expect(iecTime(RELAY, 400)).toBe(Infinity)
    expect(iecTime(RELAY, 399)).toBe(Infinity)
    expect(Number.isFinite(iecTime(RELAY, 401))).toBe(true)
    expect(definiteTime({ pickup: 400, time: 0.5 }, 300)).toBe(Infinity)
    expect(definiteTime({ pickup: 400, time: 0.5 }, 500)).toBe(0.5)
  })

  it('has a slope of −1 on log axes for the very inverse curve, far above pickup', () => {
    // t = TDS·K/(M − 1), so at large M the time halves when the current
    // doubles, which is a slope of −1 in log-log.
    const t1 = iecTime(RELAY, 40000)
    const t2 = iecTime(RELAY, 80000)
    expect(Math.abs(Math.log(t2 / t1) / Math.log(2) + 1)).toBeLessThan(0.01)
  })

  it('refuses a curve it does not carry, and draws the ones it does', () => {
    expect(() => iecTime({ ...RELAY, curve: 'nonesuch' }, 1600)).toThrow(/unknown IEC curve/)
    expect(() => ieeeTime({ pickup: 400, curve: 'nonesuch' }, 1600)).toThrow(/unknown IEEE curve/)
    const pts = curvePoints(RELAY)
    expect(pts.length).toBe(120)
    for (const p of pts) expect(Number.isFinite(p.t)).toBe(true)
  })
})

describe('coordination', () => {
  it('needs TDS 0.16667 upstream for a 0.30 s margin over 0.45 s at 1600 A', () => {
    const c = coordinate({ pickup: 400, curve: 'veryInverse' }, 1600, 0.45, 0.3)
    expect(c.tds).toBeCloseTo(0.166667, 6)
    expect(c.time).toBeCloseTo(0.75, 10)
    expect(c.time - 0.45).toBeCloseTo(0.3, 12)
  })

  it('follows the downstream setting: raise it and the upstream dial follows', () => {
    const low = coordinate({ pickup: 400, curve: 'veryInverse' }, 1600, 0.45, 0.3)
    const high = coordinate({ pickup: 400, curve: 'veryInverse' }, 1600, 0.9, 0.3)
    expect(high.tds).toBeGreaterThan(low.tds)
    expect(high.time).toBeCloseTo(1.2, 10)
    // The dial is linear in the time it buys.
    expect(high.tds / low.tds).toBeCloseTo(1.2 / 0.75, 9)
  })
})

describe('the distance relay', () => {
  const zones = distanceZones({ Zline: 40 })

  it('reaches 32 Ω in zone 1 and 48 Ω in zone 2', () => {
    expect(zones.zone1).toBeCloseTo(32, 12)
    expect(zones.zone2).toBeCloseTo(48, 12)
    expect(zones.zone1 / zones.Zline).toBeCloseTo(0.8, 12)
    expect(zones.zone2 / zones.Zline).toBeCloseTo(1.2, 12)
  })

  it('sees 24 Ω for a fault 60 km along a 0.4 Ω/km line, inside zone 1', () => {
    const z = apparentZ({ ohmPerKm: 0.4, km: 60 })
    expect(z.Z).toBeCloseTo(24, 12)
    expect(zoneOf(zones, z.Z).zone).toBe(1)
    expect(zoneOf(zones, z.Z).time).toBe(0)
    expect(zoneOf(zones, apparentZ({ ohmPerKm: 0.4, km: 90 }).Z).zone).toBe(2)
    expect(zoneOf(zones, apparentZ({ ohmPerKm: 0.4, km: 130 }).Z).zone).toBe(null)
  })

  it('lengthens the reach with a remote infeed past a tapped bus', () => {
    const none = apparentZ({ ohmPerKm: 0.4, km: 60, tapKm: 30, infeed: 0 })
    expect(none.Z).toBeCloseTo(24, 12)
    const half = apparentZ({ ohmPerKm: 0.4, km: 60, tapKm: 30, infeed: 0.5 })
    expect(half.Z).toBeCloseTo(12 + 1.5 * 12, 12)
    expect(half.Z).toBeCloseTo(30, 12)
    expect(zoneOf(zones, half.Z).zone).toBe(1)
    const full = apparentZ({ ohmPerKm: 0.4, km: 60, tapKm: 30, infeed: 1 })
    expect(full.Z).toBeCloseTo(36, 12)
    // Which is outside zone 1, so the relay waits on a fault it was set to
    // clear at once.
    expect(zoneOf(zones, full.Z).zone).toBe(2)
    expect(zoneOf(zones, full.Z).time).toBeGreaterThan(0)
  })

  it('stops reaching the 60 km fault at an infeed of 66.7 %', () => {
    const z = apparentZ({ ohmPerKm: 0.4, km: 60, tapKm: 30 })
    const k = z.infeedForReach(zones.zone1)
    expect(k).toBeCloseTo(2 / 3, 9)
    expect(apparentZ({ ohmPerKm: 0.4, km: 60, tapKm: 30, infeed: k - 0.01 }).Z).toBeLessThan(zones.zone1)
    expect(apparentZ({ ohmPerKm: 0.4, km: 60, tapKm: 30, infeed: k + 0.01 }).Z).toBeGreaterThan(zones.zone1)
  })

  it('measures the impedance as a ratio of two phasors, and refuses a zero current', () => {
    const V = polar(20, 0.4)
    const I = polar(0.5, 0.1)
    const z = measuredZ(V, I)
    expect(z.mag).toBeCloseTo(40, 12)
    expect(z.angle).toBeCloseTo(0.3, 12)
    expect(measuredZ(V, [0, 0]).mag).toBe(Infinity)
  })
})
