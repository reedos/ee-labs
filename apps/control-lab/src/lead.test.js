import { describe, it, expect } from 'vitest'
import { leadPeak } from './lead.js'
import { CONTROLLERS } from './systems.js'
import { magnitudeAt, phaseAt } from '@ee-labs/systems'

// The network's own number, checked against the controller's live phase
// curve — not just the closed-form algebra, so a slip in either the formula
// or the transfer function would show up here.

const deg = (r) => (r * 180) / Math.PI

describe('leadPeak', () => {
  it('lands at the geometric mean, and matches the phase curve there', () => {
    const [z, p] = [1, 20]
    const peak = leadPeak(z, p)
    expect(peak.w).toBeCloseTo(Math.sqrt(z * p), 9)
    expect(peak.kind).toBe('lead')
    const c = CONTROLLERS.lead.tf({ k: 3, z, p })
    // phaseAt takes hertz, not rad/s — peak.f is the same frequency in Hz.
    const measured = deg(phaseAt(c, peak.f))
    expect(peak.phiMax).toBeCloseTo(measured, 6)
    // The try line's own figure: 1 -> 20 rad/s peaks at 64.8 degrees.
    expect(peak.phiMax).toBeCloseTo(64.8, 1)
  })

  it('the phase peak is not the loop\'s margin — it moves the OTHER way as the pole passes the zero', () => {
    // pole 20 -> 5: the network's own phiMax falls (64.8 -> 41.8), while the
    // loop's phase margin (a different, non-monotone quantity) can rise —
    // which is exactly why the try line was rewritten to quote this number.
    expect(leadPeak(1, 20).phiMax).toBeCloseTo(64.8, 1)
    expect(leadPeak(1, 5).phiMax).toBeCloseTo(41.8, 1)
  })

  it('is a lag, not a lead, once the pole sits below the zero', () => {
    const peak = leadPeak(20, 1)
    expect(peak.kind).toBe('lag')
    expect(peak.phiMax).toBeLessThan(0)
  })

  it('is null without two positive corners', () => {
    expect(leadPeak(0, 20)).toBeNull()
    expect(leadPeak(1, 0)).toBeNull()
    expect(leadPeak(-1, 20)).toBeNull()
  })

  it('the gain at the peak is bounded, unlike a derivative', () => {
    const peak = leadPeak(1, 20)
    const c = CONTROLLERS.lead.tf({ k: 3, z: 1, p: 20 })
    expect(Number.isFinite(magnitudeAt(c, peak.f))).toBe(true)
  })
})
