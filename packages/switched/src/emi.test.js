import { describe, it, expect } from 'vitest'
import { spectrum } from '@ee-labs/dsp'
import {
  emiConverter,
  ringConverter,
  emiSteadyState,
  emiMeasures,
  ringMeasures,
  emiHarmonics,
  fftHarmonics,
  sampleUniform,
  pulseHarmonic,
  inputFilter,
  middlebrook,
  ringOf,
} from './emi.js'
import { clockedSteadyState } from './clocked.js'

// The input side and the switch node owe the package's own invariants —
// volt-second balance, charge balance, the power identity, a steady state
// that stays steady — and three of their own:
//
//   the converter's input current is the pulse train its closed form says,
//   the exact Fourier integral and @ee-labs/dsp's FFT read one spectrum,
//   and the filter attenuates what its |H| says it attenuates.

const rnd = (seed) => {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
const logPick = (r, lo, hi) => lo * Math.pow(hi / lo, r())

function emiSample(seed) {
  const r = rnd(seed)
  return emiConverter({
    Vin: logPick(r, 5, 400),
    D: 0.05 + 0.9 * r(),
    fs: logPick(r, 20e3, 1e6),
    L: logPick(r, 10e-6, 1e-3),
    C: logPick(r, 10e-6, 1e-3),
    R: logPick(r, 1, 100),
    Ron: r() < 0.5 ? 0 : logPick(r, 1e-3, 0.2),
    RL: r() < 0.5 ? 0 : logPick(r, 1e-3, 0.2),
    Lf: logPick(r, 0.5e-6, 200e-6),
    Cin: logPick(r, 1e-6, 100e-6),
    Rf: logPick(r, 0.01, 1),
    Rd: logPick(r, 0.5, 1e4),
  })
}

// The ring's own knob ranges, and they are bounded on purpose. The quadrature
// cuts every segment into pieces short against the fastest mode in it, so a
// snubber whose time constant is picoseconds inside a microsecond period
// costs a million pieces to integrate. The app's knobs carry the same bounds,
// and the snubber is a switch rather than a resistance turned up until its
// branch stops mattering.
function ringSample(seed) {
  const r = rnd(seed)
  return ringConverter({
    Vin: logPick(r, 5, 200),
    D: 0.1 + 0.8 * r(),
    fs: logPick(r, 500e3, 2e6),
    L: logPick(r, 2e-6, 100e-6),
    C: logPick(r, 1e-6, 100e-6),
    R: logPick(r, 1, 50),
    RL: r() < 0.5 ? 0 : logPick(r, 1e-3, 0.1),
    Lp: logPick(r, 20e-9, 500e-9),
    Cp: logPick(r, 470e-12, 10e-9),
    Rp: logPick(r, 10, 300),
    snubber: r() < 0.5 ? 1 : 0,
    Csn: logPick(r, 470e-12, 10e-9),
    Rsn: logPick(r, 5, 100),
  })
}

describe('the input side', () => {
  it('holds the invariants over 200 seeded settings', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const conv = emiSample(seed * 7919 + 3)
      const ss = emiSteadyState(conv)
      const m = emiMeasures(ss, { dense: 48, harmonics: 3 })
      const where = `emi #${seed}`
      const iScale = Math.max(1e-9, Math.abs(m.sig.iL.max), Math.abs(m.sig.iL.min))
      const vScale = Math.max(conv.p.Vin, Math.abs(m.sig.vcin.max))
      expect(Number.isFinite(m.Pin), where).toBe(true)
      // Volt-seconds on the output inductor, charge on the input capacitor.
      expect(Math.abs(m.sig.vL.avg), `${where} ⟨v_L⟩`).toBeLessThan(1e-9 * vScale)
      expect(Math.abs(m.sig.icin.avg), `${where} ⟨i_Cin⟩`).toBeLessThan(1e-8 * iScale)
      // What the line supplies is what the converter takes, on average: the
      // capacitor stores nothing over a period.
      expect(Math.abs(m.sig.iline.avg - m.sig.iin.avg), `${where} line = converter`).toBeLessThan(1e-8 * iScale)
      // The power books.
      expect(Math.abs(m.balance), `${where} balance`).toBeLessThan(1e-7 * Math.max(1e-12, Math.abs(m.Pin)))
      expect(m.eta, `${where} η`).toBeLessThanOrEqual(1 + 1e-9)
      // Steady state is steady.
      const again = clockedSteadyState(conv.plan, 4)
      for (let i = 0; i < 4; i++) {
        const sc = Math.max(1e-9, Math.abs(ss.x0[i]), i === 1 || i === 3 ? vScale : iScale)
        expect(Math.abs(again.xEnd[i] - ss.x0[i]), `${where} state ${i} returns`).toBeLessThan(1e-8 * sc)
      }
    }
  })

  it('draws the pulse train its closed form describes', () => {
    // A buck's input current is the inductor's current gated by the switch,
    // so where the ripple is small it is a rectangle of height I_L and duty
    // D, and its k-th harmonic is 2·I·|sin(kπD)|/(kπ).
    for (const D of [0.2, 0.35, 0.5, 0.75]) {
      const conv = emiConverter({ D, L: 1e-3 })
      const ss = emiSteadyState(conv)
      const m = emiMeasures(ss, { harmonics: 7 })
      const I = m.sig.iL.avg
      expect(m.sig.iin.avg / I).toBeCloseTo(D, 3)
      for (const h of m.harmonics) {
        const pred = pulseHarmonic(h.k, D) * I
        if (pred < 1e-3 * I) continue
        expect(Math.abs(h.peak / pred - 1), `D = ${D}, k = ${h.k}`).toBeLessThan(0.02)
      }
    }
  })

  it('has no even harmonics at half duty, which is what sin(kπD) says', () => {
    const m = emiMeasures(emiSteadyState(emiConverter({ D: 0.5, L: 1e-3 })), { harmonics: 6 })
    const odd = m.harmonics.filter((h) => h.k % 2 === 1)
    const even = m.harmonics.filter((h) => h.k % 2 === 0)
    for (const h of even) expect(h.peak, `k = ${h.k}`).toBeLessThan(0.05 * odd[0].peak)
    for (const k of [3, 5]) {
      expect(pulseHarmonic(k, 0.5)).toBeCloseTo(2 / (k * Math.PI), 12)
      expect(pulseHarmonic(2, 0.5)).toBeCloseTo(0, 12)
    }
  })
})

describe('one spectrum, read two ways', () => {
  it('the exact Fourier integral and @ee-labs/dsp’s FFT agree on a smooth signal', () => {
    for (const seed of [11, 29, 47]) {
      const conv = emiSample(seed)
      const ss = emiSteadyState(conv)
      // The capacitor voltage is continuous, so a uniform grid resolves it
      // and the two routes agree to the transform's own precision.
      const ex = emiHarmonics(ss, 'vcin', 6)
      const ff = fftHarmonics(ss, 'vcin', 6, { n: 16384 })
      const scale = Math.max(...ex.map((h) => h.peak))
      for (let i = 0; i < ex.length; i++) {
        expect(Math.abs(ex[i].peak - ff[i].peak), `#${seed} k = ${ex[i].k}`).toBeLessThan(1e-5 * scale)
      }
    }
  })

  it('and on the pulse train, to the grid the samples land on', () => {
    // The converter's input current steps at the switching instants, and a
    // uniform grid puts one sample on each edge. That is the whole gap
    // between the two readings, and it shrinks with the grid.
    const ss = emiSteadyState(emiConverter({ D: 0.37 }))
    const ex = emiHarmonics(ss, 'iin', 5)
    const coarse = fftHarmonics(ss, 'iin', 5, { n: 256 })
    const fine = fftHarmonics(ss, 'iin', 5, { n: 32768 })
    const err = (h, i) => Math.abs(h[i].peak / ex[i].peak - 1)
    for (let i = 0; i < ex.length; i++) {
      expect(err(coarse, i), `coarse k = ${ex[i].k}`).toBeLessThan(5e-2)
      expect(err(fine, i), `fine k = ${ex[i].k}`).toBeLessThan(2e-3)
      // A finer grid gets no worse: the error is the samples, not the maths.
      expect(err(fine, i)).toBeLessThanOrEqual(Math.max(err(coarse, i), 1e-4))
    }
  })

  it('and a windowed amplitude spectrum finds the same fundamental', () => {
    // A third route, through the package a spectrum analyser's maths lives
    // in: window the same samples and read the bin at f_s.
    const conv = emiConverter({ D: 0.4 })
    const ss = emiSteadyState(conv)
    const n = 8192
    const y = Array.from(sampleUniform(ss, 'iin', n))
    // Sixteen periods of the same waveform put the fundamental on a bin
    // centre, where a windowed amplitude reads back its own height.
    const long = []
    for (let k = 0; k < 16; k++) long.push(...y)
    const sp = spectrum(long.slice(0, 65536), n * conv.p.fs, 'hann')
    const bin = Math.round(65536 / n)
    const ex = emiHarmonics(ss, 'iin', 1)[0]
    expect(Math.abs(sp.amps[bin] / ex.peak - 1)).toBeLessThan(2e-2)
  })
})

describe('the input filter', () => {
  it('attenuates by exactly its own |H|, at every setting', () => {
    // The divider is Kirchhoff at the input node with a rail that carries no
    // alternating voltage, so it is an identity rather than a small-signal
    // approximation. It agrees with the solved waveform to ten digits, and it
    // is stated with no hedge because it earns none.
    let checked = 0
    for (let seed = 1; seed <= 120; seed++) {
      const conv = emiSample(seed * 104729 + 5)
      const m = emiMeasures(emiSteadyState(conv), { harmonics: 1 })
      if (!(m.conv1 > 1e-9)) continue
      checked++
      expect(Math.abs(m.attenuation / m.predicted - 1), `#${seed}`).toBeLessThan(1e-8)
    }
    expect(checked, 'settings the divider was read at').toBeGreaterThan(100)
  })

  it('holds at every harmonic, not only the first', () => {
    const conv = emiConverter({ Lf: 47e-6, Rd: 1e4, D: 0.37 })
    const ss = emiSteadyState(conv)
    const line = emiHarmonics(ss, 'iline', 5)
    const inp = emiHarmonics(ss, 'iin', 5)
    for (let i = 0; i < line.length; i++) {
      const k = line[i].k
      const pred = conv.filter.attenuationAt(k * conv.p.fs)
      expect(Math.abs(line[i].peak / inp[i].peak / pred - 1), `k = ${k}`).toBeLessThan(1e-7)
    }
  })

  it('gives a 47 µH filter 62 times the rejection of a 1 µH stray, both measured', () => {
    const bare = emiMeasures(emiSteadyState(emiConverter({})), { harmonics: 1 })
    const filtered = emiMeasures(emiSteadyState(emiConverter({ Lf: 47e-6 })), { harmonics: 1 })
    expect(bare.attenuation / bare.predicted).toBeCloseTo(1, 7)
    expect(filtered.attenuation / filtered.predicted).toBeCloseTo(1, 7)
    expect(bare.attenuation / filtered.attenuation).toBeGreaterThan(50)
    expect(filtered.line1).toBeLessThan(bare.line1)
  })

  it('has a corner and a characteristic impedance the numbers give', () => {
    const f = inputFilter({ Lf: 47e-6, Cin: 10e-6, Rf: 0.05, Rd: 1e4 })
    expect(f.f0).toBeCloseTo(1 / (2 * Math.PI * Math.sqrt(47e-6 * 1e-5)), 6)
    expect(f.Z0).toBeCloseTo(Math.sqrt(47e-6 / 1e-5), 12)
    // Two decades above the corner an undamped second-order filter is down by
    // the square of the ratio.
    const ratio = 100
    expect(f.attenuationAt(ratio * f.f0) * ratio * ratio).toBeCloseTo(1, 2)
  })

  it('trades rejection for damping, and Middlebrook’s criterion says why', () => {
    const undamped = emiConverter({ Lf: 47e-6, Rd: 1e4 })
    const damped = emiConverter({ Lf: 47e-6, Rd: 1 })
    const mu = emiMeasures(emiSteadyState(undamped), { harmonics: 1 })
    const md = emiMeasures(emiSteadyState(damped), { harmonics: 1 })
    // Undamped, the filter's output impedance peaks well above the
    // converter's own, which is the case the criterion forbids.
    expect(mu.middlebrook.ratio).toBeGreaterThan(1)
    expect(mu.middlebrook.safe).toBe(false)
    expect(md.middlebrook.ratio).toBeLessThan(0.2)
    expect(md.middlebrook.safe).toBe(true)
    // ...and the price is rejection: the damping resistor shunts the
    // inductor at the switching frequency.
    expect(md.attenuation).toBeGreaterThan(10 * mu.attenuation)
  })

  it('reads the converter’s input impedance as the negative resistance it is', () => {
    const f = inputFilter({ Lf: 47e-6, Cin: 10e-6, Rf: 0.05, Rd: 1e4 })
    const mb = middlebrook(f, { Vin: 24, Pin: 24 })
    expect(mb.Zin).toBeCloseTo(24, 9)
    expect(mb.ratio).toBeCloseTo(mb.Zout / mb.Zin, 12)
    expect(mb.margin).toBeCloseTo(1 / mb.ratio, 9)
  })
})

describe('the switch node', () => {
  it('holds the invariants over 60 seeded settings', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const conv = ringSample(seed * 15485863 + 13)
      const ss = emiSteadyState(conv)
      const m = ringMeasures(ss, { dense: 32 })
      const where = `ring #${seed}`
      const vScale = Math.max(conv.p.Vin, Math.abs(m.sig.vsw.max))
      expect(Number.isFinite(m.Pin), where).toBe(true)
      // The parasitic inductance carries no series resistance, so the node's
      // average is the drive's average exactly.
      expect(Math.abs(m.sig.vsw.avg - conv.p.D * conv.p.Vin), `${where} ⟨v_sw⟩`).toBeLessThan(1e-7 * vScale)
      expect(Math.abs(m.sig.vL.avg), `${where} ⟨v_L⟩`).toBeLessThan(1e-7 * vScale)
      expect(Math.abs(m.balance), `${where} balance`).toBeLessThan(1e-6 * Math.max(1e-12, Math.abs(m.Pin)))
      expect(m.eta, `${where} η`).toBeLessThanOrEqual(1 + 1e-6)
    }
  })

  it('rings where L_p and C_p put it, and overshoots by what ζ says', () => {
    // With the snubber off, the node is the textbook parallel-damped RLC and
    // both closed forms are the waveform's own numbers.
    const conv = ringConverter({})
    const m = ringMeasures(emiSteadyState(conv))
    expect(conv.n).toBe(4)
    expect(m.measured, 'the ring was found').toBeTruthy()
    expect(Math.abs(m.measured.f / conv.ring.f0 - 1)).toBeLessThan(1e-4)
    expect(Math.abs(m.overshoot / conv.ring.overshoot - 1)).toBeLessThan(5e-3)
    expect(conv.ring.zeta).toBeCloseTo(Math.sqrt(100e-9 / 1e-9) / (2 * 50), 9)
    expect(conv.ring.Q).toBeCloseTo(1 / (2 * conv.ring.zeta), 12)
  })

  it('rings twice as slowly when the loop inductance is four times as large', () => {
    const slow = ringMeasures(emiSteadyState(ringConverter({ Lp: 400e-9 })))
    const fast = ringMeasures(emiSteadyState(ringConverter({ Lp: 100e-9 })))
    expect(fast.measured.f / slow.measured.f).toBeCloseTo(2, 3)
  })

  it('rings slower when the snubber’s capacitance joins the node', () => {
    const bare = ringConverter({})
    const snubbed = ringConverter({ snubber: 1, Csn: 2.2e-9, Rsn: 10 })
    const mb = ringMeasures(emiSteadyState(bare))
    const ms = ringMeasures(emiSteadyState(snubbed))
    expect(snubbed.n).toBe(5)
    expect(ms.measured.f).toBeLessThan(mb.measured.f)
    expect(Math.abs(ms.measured.f / snubbed.ring.f0 - 1)).toBeLessThan(0.06)
    // ...and the overshoot falls, because the snubber's resistance damps what
    // the loop's own does not. The ζ of L_p and the node's capacitance does
    // not carry that, which is why this is an inequality and not a form.
    expect(ms.overshoot).toBeLessThan(0.6 * mb.overshoot)
  })

  it('costs C_sn·V²·f_s to add, whatever R_sn is', () => {
    // The snubber's capacitor is charged and discharged once each period, and
    // that energy is dissipated wherever the node's damping happens to be. So
    // the number to hold is the RISE in the node's total loss, not the
    // snubber resistor's own share, which moves with R_sn while the total
    // does not.
    const bare = ringMeasures(emiSteadyState(ringConverter({})))
    const floor = bare.loss.parasitic
    for (const Rsn of [5, 10, 30]) {
      for (const Csn of [470e-12, 2.2e-9]) {
        const conv = ringConverter({ snubber: 1, Csn, Rsn })
        const m = ringMeasures(emiSteadyState(conv))
        const extra = m.loss.parasitic + m.loss.snubber - floor
        expect(conv.ring.Psn).toBeCloseTo(Csn * 24 * 24 * 1e6, 12)
        expect(Math.abs(extra / conv.ring.Psn - 1), `R_sn = ${Rsn}, C_sn = ${Csn}`).toBeLessThan(0.15)
      }
    }
  })

  it('lets the output see the average the switch made, and nothing of the ring', () => {
    const conv = ringConverter({})
    const m = ringMeasures(emiSteadyState(conv))
    expect(m.sig.vout.avg).toBeCloseTo(conv.p.D * conv.p.Vin, 6)
    expect(m.Pout).toBeCloseTo((conv.p.D * conv.p.Vin) ** 2 / conv.p.R, 3)
  })

  it('states the ring in closed form from the two parasitics alone', () => {
    const r = ringOf({ Lp: 100e-9, Cp: 1e-9, Rp: 50, Vin: 24, fs: 1e6, Csn: 0 })
    expect(r.f0).toBeCloseTo(1 / (2 * Math.PI * Math.sqrt(1e-7 * 1e-9)), 3)
    expect(r.zeta).toBeCloseTo(Math.sqrt(1e-7 / 1e-9) / 100, 12)
    expect(r.peak).toBeCloseTo(24 * (1 + r.overshoot), 12)
    expect(r.Ep).toBeCloseTo(0.5 * 1e-9 * 576, 15)
  })
})
