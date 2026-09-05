import { describe, it, expect } from 'vitest'
import {
  firstOrderFraction,
  ktOverC,
  noiseBandwidth,
  noiseDensity,
  noiseRms,
  noiseSources,
  perRootHz,
  shotCurrent,
  thermalCurrent,
  thermalVoltageDensity,
} from './noise.js'
import { NetworkError } from './netlist.js'
import { K_B, Q_E, T_ROOM } from './diode.js'

// Noise, source by source. The densities are closed forms and are checked
// against the numbers a datasheet quotes. The integrals are numerical and are
// checked against the one case that has a closed form, kT/C, which is also
// invariant 9 of the plan's §2.12.

const RC = (r, c) => ({
  elements: [
    { type: 'I', id: 'Is', nodes: ['gnd', 'out'], value: 0 },
    { type: 'R', id: 'R1', nodes: ['out', 'gnd'], value: r },
    { type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: c },
  ],
})

describe('the two densities', () => {
  it('gives a kilohm at room temperature 4.07 nV/√Hz', () => {
    const psd = thermalVoltageDensity(1000)
    expect(psd).toBeCloseTo(4 * K_B * T_ROOM * 1000, 24)
    expect(perRootHz(psd) * 1e9).toBeCloseTo(4.07, 2)
    // Seen as a current in parallel, the same source: 4kT/R.
    expect(thermalCurrent(1000) * 1000 * 1000).toBeCloseTo(psd * 1e3, 12)
    // It goes with the resistance, so four times the resistance is twice the
    // voltage density.
    expect(perRootHz(thermalVoltageDensity(4000)) / perRootHz(psd)).toBeCloseTo(2, 9)
  })

  it('gives a milliamp 17.9 pA/√Hz of shot noise, and a tenth of that current a third of it', () => {
    expect(perRootHz(shotCurrent(1e-3)) * 1e12).toBeCloseTo(17.9, 1)
    expect(shotCurrent(1e-3)).toBeCloseTo(2 * Q_E * 1e-3, 24)
    // The density goes with the current, so the amplitude goes with its root.
    expect(perRootHz(shotCurrent(10e-6)) * 1e12).toBeCloseTo(1.79, 2)
    expect(perRootHz(shotCurrent(1e-3)) / perRootHz(shotCurrent(1e-4))).toBeCloseTo(Math.sqrt(10), 9)
  })

  it('makes the noise bandwidth of a first-order stage π/2 times its corner', () => {
    expect(noiseBandwidth(1000)).toBeCloseTo(1570.8, 1)
    expect(noiseBandwidth(1000) / 1000).toBeCloseTo(Math.PI / 2, 12)
  })
})

describe('the sources a circuit carries', () => {
  it('finds one thermal source per resistor, and shot noise where a junction is', () => {
    const net = {
      elements: [
        { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0 },
        { type: 'R', id: 'Rs', nodes: ['in', 'b'], value: 1000 },
        // r_π: a resistance the tangent drew, marked as such.
        { type: 'R', id: 'rpi', nodes: ['b', 'gnd'], value: 2585, from: 'Q' },
        { type: 'C', id: 'C1', nodes: ['b', 'gnd'], value: 1e-9 },
      ],
    }
    const plain = noiseSources(net)
    // Only the real resistor. r_π is the slope of a junction, and a junction's
    // noise is the shot noise of its current, which arrives with the current.
    expect(plain.map((s) => s.id)).toEqual(['Rs'])
    expect(plain[0].kind).toBe('thermal')
    // A capacitor makes no noise of its own. It sets the bandwidth, which is
    // the whole of its part in kT/C.
    expect(plain.some((s) => s.id === 'C1')).toBe(false)

    const withShot = noiseSources(net, { currents: { rpi: 10e-6 } })
    const shot = withShot.find((s) => s.kind === 'shot')
    expect(shot.id).toBe('rpi')
    expect(shot.psd(1000)).toBeCloseTo(shotCurrent(10e-6), 30)
    expect(withShot.map((s) => s.id).sort()).toEqual(['Rs', 'rpi'])
  })

  it('leaves flicker noise out until it is given a constant, and then labels it', () => {
    const net = { elements: [{ type: 'R', id: 'R1', nodes: ['out', 'gnd'], value: 1000 }] }
    const [s] = noiseSources(net, { currents: { R1: 1e-3 } })
    expect(s.kind).toBe('thermal')
    const q = noiseSources({ elements: [{ type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: 1e-9 }] }, { currents: { C1: 1e-3 }, kf: 1e-12 })
    // At 1 Hz the flicker term is K_f I/f and it falls with frequency, while
    // the shot term does not move at all.
    expect(q[0].psd(1) - q[0].psd(1e6)).toBeCloseTo(1e-12 * 1e-3, 20)
    expect(q[0].psd(1e12) / shotCurrent(1e-3) - 1).toBeLessThan(1e-5)
  })
})

describe('the density at the output', () => {
  it('is the resistor’s own density in band, and falls with the stage past its corner', () => {
    const [r, c] = [1000, 1e-9]
    const fc = 1 / (2 * Math.PI * r * c)
    const flat = noiseDensity(RC(r, c), { output: 'out' }, 1)
    expect(perRootHz(flat.total) * 1e9).toBeCloseTo(4.07, 2)
    // At the corner the density is half the flat value: −3 dB in amplitude is
    // a factor of two in power.
    const corner = noiseDensity(RC(r, c), { output: 'out' }, fc)
    expect(corner.total / flat.total).toBeCloseTo(0.5, 6)
    const decade = noiseDensity(RC(r, c), { output: 'out' }, 10 * fc)
    expect(decade.total / flat.total).toBeCloseTo(1 / 101, 6)
  })

  it('adds two resistors as powers rather than as amplitudes', () => {
    const net = {
      elements: [
        { type: 'R', id: 'R1', nodes: ['out', 'gnd'], value: 1000 },
        { type: 'R', id: 'R2', nodes: ['out', 'gnd'], value: 1000 },
      ],
    }
    const d = noiseDensity(net, { output: 'out' }, 100)
    // Two kilohms in parallel is 500 Ω, and 500 Ω of thermal noise is what the
    // pair makes: half the power of one of them alone.
    expect(perRootHz(d.total)).toBeCloseTo(perRootHz(thermalVoltageDensity(500)), 15)
    expect(d.byId.R1).toBeCloseTo(d.byId.R2, 20)
    expect(d.byId.R1 + d.byId.R2).toBeCloseTo(d.total, 20)
    // Not the sum of the amplitudes, which is what makes noise noise.
    expect(perRootHz(d.total)).toBeLessThan(2 * perRootHz(d.byId.R1))
  })

  it('names what is missing when there is nothing to make noise', () => {
    const net = { elements: [{ type: 'C', id: 'C1', nodes: ['out', 'gnd'], value: 1e-9 }] }
    expect(() => noiseDensity(net, { output: 'out' }, 100)).toThrow(NetworkError)
    expect(() => noiseDensity(net, { output: 'out' }, 100)).toThrow(/no resistor and no junction/)
    expect(() => noiseDensity(RC(1000, 1e-9), { output: 'out' }, -1)).toThrow(/negative/)
    expect(() => noiseDensity(RC(1000, 1e-9), { output: 'nowhere' }, 1)).toThrow()
  })
})

describe('invariant 9: one resistor into one capacitor integrates to kT/C', () => {
  it('is 2.04 µV at a nanofarad, whatever the resistance is', () => {
    expect(ktOverC(1e-9) * 1e6).toBeCloseTo(2.04, 2)
    for (const r of [100, 1000, 10000, 100000]) {
      const c = 1e-9
      const fc = 1 / (2 * Math.PI * r * c)
      const got = noiseRms(RC(r, c), { output: 'out' }, { from: fc / 1e4, to: 1000 * fc, perDecade: 60 })
      // Within a tenth of a per cent, and the gap is the tail past the band
      // rather than the integration: the analysis says the tail is 0.064 %.
      expect(got.rms / ktOverC(c) - 1, `R = ${r}`).toBeLessThan(1e-3)
      expect(got.rms / ktOverC(c), `R = ${r}`).toBeGreaterThan(0.999)
      expect(got.band[1] / fc).toBeCloseTo(1000, 6)
    }
  })

  it('states the tail it left outside the band, which is where the gap went', () => {
    const [r, c] = [1000, 1e-9]
    const fc = 1 / (2 * Math.PI * r * c)
    // The band has two tails, one at each end, and each is 0.064 % of the
    // power: the density is flat below the corner and falls as 1/f² above it.
    const inside = firstOrderFraction(1000 * fc, fc) - firstOrderFraction(fc / 1e4, fc)
    expect(1 - firstOrderFraction(1000 * fc, fc)).toBeCloseTo(6.366e-4, 6)
    expect(firstOrderFraction(fc / 1e4, fc)).toBeCloseTo(6.366e-5, 7)
    const got = noiseRms(RC(r, c), { output: 'out' }, { from: fc / 1e4, to: 1000 * fc, perDecade: 60 })
    // The power that arrived is the power the closed form says is in band, to
    // five figures, so what is missing is the tail and not the arithmetic.
    expect(got.power / (ktOverC(c) ** 2 * inside)).toBeCloseTo(1, 4)
  })

  it('gives the same power as the noise bandwidth written the other way round', () => {
    const [r, c] = [4700, 2.2e-9]
    const fc = 1 / (2 * Math.PI * r * c)
    // The brick wall of width (π/2)f_c passing the flat density carries the
    // whole power, which is the reason that factor exists.
    const flat = thermalVoltageDensity(r)
    expect(flat * noiseBandwidth(fc)).toBeCloseTo(ktOverC(c) ** 2, 20)
  })
})

describe('O4: the amplifier’s noise, referred to its input', () => {
  // The plan's CE stage as a small-signal netlist: the source resistance, the
  // base's shot noise through it, and the collector's shot noise divided by
  // g_m. The optimum source resistance is √β/g_m and the noise figure there is
  // 1 + 1/√β, which is 0.41 dB at β = 100.
  const stage = (rs, gm = 0.0386817, beta = 100) => ({
    elements: [
      { type: 'V', id: 'Vs', nodes: ['s', 'gnd'], value: 0 },
      { type: 'R', id: 'Rs', nodes: ['s', 'b'], value: rs },
      { type: 'R', id: 'rpi', nodes: ['b', 'gnd'], value: beta / gm, from: 'Q' },
      { type: 'VCCS', id: 'gm', nodes: ['c', 'gnd'], ctrl: ['b', 'gnd'], gain: gm },
      { type: 'R', id: 'RC', nodes: ['c', 'gnd'], value: 5000 },
    ],
  })

  it('puts the minimum of the noise figure at √β/g_m, and its value at 0.41 dB', () => {
    const gm = 0.0386817
    const beta = 100
    const ic = gm * 0.025852
    const best = Math.sqrt(beta) / gm
    expect(best).toBeCloseTo(258.5, 1)

    /**
     * The noise figure of the stage from a source resistance: three sources,
     * which are the source's own thermal noise, the base's shot noise through
     * it, and the collector's shot noise divided by g_m. The collector
     * resistor's thermal noise is left out, because the figure is quoted of
     * the amplifier rather than of the amplifier and its load. And r_π is a
     * tangent rather than a resistor, so it carries the base's shot noise and
     * no thermal noise of its own.
     */
    const nf = (rs) => {
      const net = stage(rs, gm, beta)
      const currents = { rpi: ic / beta, gm: ic }
      const total = noiseDensity(net, { output: 'c', currents, exclude: ['RC'] }, 1000)
      // The source's own thermal noise is the reference the figure is against.
      const fromSource = total.byId.Rs
      return total.total / fromSource
    }
    // The textbook's 1 + 1/√β is 1.1, which is 0.414 dB. It is derived with
    // the base's noise current flowing through R_s alone. In the circuit r_π
    // sits across that node too, and at the optimum R_s is a tenth of r_π, so
    // the measured figure is one per cent higher than the closed form.
    const at = nf(best)
    expect(at).toBeCloseTo(1.1105, 3)
    expect(10 * Math.log10(at)).toBeCloseTo(0.455, 2)
    expect(at / (1 + 1 / Math.sqrt(beta)) - 1).toBeCloseTo(0.0095, 3)
    // It is a minimum: a decade either side of it is worse.
    expect(nf(best / 10)).toBeGreaterThan(at)
    expect(nf(best * 10)).toBeGreaterThan(at)
  })

  it('sums the stack to the total, source by source', () => {
    const gm = 0.0386817
    const ic = gm * 0.025852
    const d = noiseDensity(stage(259), { output: 'c', currents: { rpi: ic / 100, gm: ic } }, 1000)
    const stack = Object.values(d.byId).reduce((a, b) => a + b, 0)
    expect(stack).toBeCloseTo(d.total, 24)
    // Four sources: two real resistors, and the two junction currents.
    expect(Object.keys(d.byId).sort()).toEqual(['RC', 'Rs', 'gm', 'rpi'])
  })
})
