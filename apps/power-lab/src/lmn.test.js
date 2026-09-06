import { describe, it, expect } from 'vitest'
import {
  drive,
  driveSteadyState,
  driveMeasures,
  driveAveraged,
  driveRunUp,
  armatureRipple,
  commutation,
  emiConverter,
  emiSteadyState,
  emiMeasures,
  emiHarmonics,
  fftHarmonics,
  pulseHarmonic,
  thermalNetwork,
  stagesOf,
  zth,
  fosterZth,
  stepRise,
  pulsedRise,
} from '@ee-labs/switched'
import { byId, defaultsOf, EXPERIMENTS } from './experiments.js'
import { analyse } from './analysis.js'
import { experimentMath } from './math.js'
import { sweepFor, outcomeOf } from './App.jsx'
import { sweepMarks } from './marks.js'
import {
  driveParams,
  LMN_KINDS,
  LMN_HEADLINES,
  sweepDriveD,
  sweepDriveFs,
  sweepDamping,
  sweepThermalR,
  sweepThermalFs,
} from './groups/lmn.js'

// Every number Groups L, M and N put on the screen, pinned against the engine
// that produced it.
//
// The notes are prose and prose drifts, so each figure in a note or a `try`
// line is measured here from the same analysis the panes draw. Beside that,
// three things the groups claim that no single number would catch:
//
//   the triple agreement of §6 — the exact switched steady state, the walk
//   from rest, and the averaged machine from @ee-labs/machines — for L,
//   one spectrum read by exact Fourier integral and by @ee-labs/dsp's FFT
//   for M, and the propagator against Σ R(1 − e^{−t/τ}) for N.
//
// Every pin is a function of the knobs: `moves` takes each one, turns the
// knob it depends on, and requires the number to follow. A pin that holds
// still under its own knob is measuring the test rather than the circuit.

const at = (id, over = {}) => analyse(byId[id], { ...defaultsOf(id), ...over })
const pct = (v) => v * 100

/**
 * A reading and the knob it depends on: turning the knob has to move it.
 * The share is generous on purpose — this catches a pin that reads a
 * constant, not one that reads the wrong constant.
 */
function moves(id, knob, factor, read, share = 0.01) {
  const base = read(at(id))
  const p = defaultsOf(id)
  const other = read(at(id, { [knob]: p[knob] * factor }))
  expect(Math.abs(other - base), `${id}: ${knob} × ${factor} left the reading at ${base}`).toBeGreaterThan(
    share * Math.abs(base) + 1e-15,
  )
}

describe('the nine are in the lab', () => {
  it('carry the groups, the kinds and the meters the shell was told about', () => {
    const ids = EXPERIMENTS.filter((e) => LMN_KINDS.includes(e.kind)).map((e) => e.id)
    expect(ids).toEqual(['l1', 'l2', 'l3', 'm1', 'm2', 'm3', 'n1', 'n2', 'n3'])
    expect(EXPERIMENTS.length).toBe(43)
    for (const id of ids) {
      const e = byId[id]
      expect(e.views, `${id} offers its math`).toContain('math')
      expect(experimentMath(e, defaultsOf(id), at(id)).blocks.length, `${id} math`).toBeGreaterThan(3)
      expect(outcomeOf(e, at(id)), `${id} outcome`).not.toMatch(/undefined|NaN/)
    }
  })

  it('draws the sweep each one that has one declares', () => {
    for (const id of ['l1', 'l2', 'l3', 'm2', 'n1', 'n3']) {
      const e = byId[id]
      const s = sweepFor(e, defaultsOf(id))
      expect(s && s.points.length, `${id} sweep`).toBeGreaterThan(10)
      for (const q of s.points) expect(Number.isFinite(q[e.sweep.y]), `${id} ${e.sweep.y} at ${q.x}`).toBe(true)
    }
    for (const id of ['m1', 'm3', 'n2']) expect(byId[id].sweep, `${id} has no sweep`).toBeUndefined()
  })
})

// ---------------------------------------------------------------- Group L

describe('L1 · the armature is an inductor with a speed in it', () => {
  it('commands 24.0 V at half duty and settles at 3648 rev/min', () => {
    const x = at('l1')
    expect(x.formulas.Va).toBeCloseTo(24, 9)
    expect(x.m.sig.vout.avg).toBeCloseTo(24, 6)
    expect(x.m.rpm).toBeCloseTo(3648, 0)
    expect(x.m.omega).toBeCloseTo(382.06, 2)
  })

  it('draws 897 mA and makes 53.8 mN·m, which is what the load takes', () => {
    const x = at('l1')
    expect(x.m.Iavg * 1e3).toBeCloseTo(897.0, 1)
    expect(x.m.torque * 1e3).toBeCloseTo(53.82, 2)
    expect(x.m.torque).toBeCloseTo(x.m.torqueLoad, 9)
  })

  it('ripples 200 mA, a fifth of its mean, against V_dc·D(1−D)/(L_a f_s)', () => {
    const x = at('l1')
    expect(x.m.ripple * 1e3).toBeCloseTo(200.0, 1)
    expect(pct(x.m.ripple / x.m.Iavg)).toBeCloseTo(22.3, 1)
    const p = defaultsOf('l1')
    expect(x.m.ripple).toBeCloseTo(armatureRipple('dcdrive', { Vdc: p.Vdc, D: p.D, La: p.La, fs: p.fs }), 4)
  })

  it('ripples the speed 375 µrad/s, a millionth of it', () => {
    const x = at('l1')
    expect(x.m.omegaRipple * 1e6).toBeCloseTo(375, 0)
    expect(x.m.omegaRipple / x.m.omega).toBeLessThan(2e-6)
    expect(x.formulas.avg.separated).toBeCloseTo(26.6, 1)
  })

  it('reaches 5552 rev/min at 75 % duty, which is the try line’s promise', () => {
    const x = at('l1', { D: 0.75 })
    expect(x.m.rpm).toBeCloseTo(5552, 0)
    expect(x.m.ripple * 1e3).toBeCloseTo(150.0, 1)
  })

  it('moves every one of those with the knob it belongs to', () => {
    moves('l1', 'D', 1.2, (x) => x.m.rpm)
    moves('l1', 'Vdc', 1.2, (x) => x.m.rpm)
    moves('l1', 'La', 2, (x) => x.m.ripple, 0.4)
    moves('l1', 'fs', 2, (x) => x.m.ripple, 0.4)
    moves('l1', 'TL', 2, (x) => x.m.torque, 0.5)
    moves('l1', 'k', 1.2, (x) => x.m.omega)
    moves('l1', 'J', 4, (x) => x.m.omegaRipple, 0.5)
  })
})

describe('L2 · four quadrants', () => {
  it('commands the same 24.0 V at 75 % duty as the chopper does at 50 %', () => {
    const x = at('l2')
    expect(x.formulas.Va).toBeCloseTo(24, 9)
    expect(x.m.sig.vout.avg).toBeCloseTo(24, 6)
    expect(x.m.rpm).toBeCloseTo(at('l1').m.rpm, 6)
    expect(x.m.Iin * 1e3).toBeCloseTo(448.7, 1)
    expect(x.m.regenerating).toBe(false)
  })

  it('reverses at 30 % duty and sends 311 mA back to the rail', () => {
    const x = at('l2', { D: 0.3 })
    expect(x.formulas.Va).toBeCloseTo(-19.2, 9)
    expect(x.m.rpm).toBeCloseTo(-3204, 0)
    expect(x.m.Iin * 1e3).toBeCloseTo(-310.7, 1)
    expect(x.m.Pin).toBeCloseTo(-14.91, 2)
    expect(x.m.regenerating).toBe(true)
  })

  it('reads the braking quadrant’s efficiency from the shaft, and says so in the top bar', () => {
    // The rail is the load here, so what is delivered is the rail's 14.91 W
    // out of the shaft's 16.78 W. Dividing the other way gives 112 % on the
    // screen of the experiment whose whole subject is that the power can run
    // backwards, which is the §11.0 class of defect.
    const x = at('l2', { D: 0.3 })
    expect(x.m.delivering).toBe('rail')
    expect(pct(x.m.eta)).toBeCloseTo(88.90, 1)
    expect(x.m.eta).toBeCloseTo(x.m.Pin / x.m.Pout, 12)
    expect(outcomeOf(byId.l2, x)).toMatch(/η = 88\.9/)
    expect(LMN_HEADLINES.drive(x.m).value).toMatch(/88\.9 %/)
    // Motoring it is the other way round, and both are under one.
    const m = at('l2').m
    expect(m.delivering).toBe('shaft')
    expect(m.eta).toBeCloseTo(m.Pout / m.Pin, 12)
    for (const D of [0.02, 0.2, 0.3, 0.4, 0.6, 0.75, 0.98]) {
      const q = at('l2', { D })
      if (Number.isFinite(q.m.eta)) expect(q.m.eta, `D = ${D}`).toBeLessThanOrEqual(1)
      else expect(q.m.delivering, `D = ${D}`).toBe('neither')
      expect(outcomeOf(byId.l2, q), `D = ${D}`).not.toMatch(/NaN|η = -|η = 1\d\d/)
    }
  })

  it('names the duty where neither side delivers, rather than dividing two losses', () => {
    // At half duty the bridge commands zero volts and the load still turns
    // the shaft backwards, so the rail and the shaft both feed the losses.
    const x = at('l2', { D: 0.5 })
    expect(x.m.Pin).toBeGreaterThan(0)
    expect(x.m.Pout).toBeLessThan(0)
    expect(x.m.delivering).toBe('neither')
    expect(Number.isFinite(x.m.eta)).toBe(false)
    expect(LMN_HEADLINES.drive(x.m).value).toBe('all of it loss')
    expect(outcomeOf(byId.l2, x)).toMatch(/nothing delivered either way/)
  })

  it('ripples 300 mA bipolar and 100 mA unipolar, at twice the rate', () => {
    const bip = at('l2')
    const uni = at('l2', { bipolar: 0 })
    expect(bip.m.ripple * 1e3).toBeCloseTo(300.0, 1)
    expect(uni.m.ripple * 1e3).toBeCloseTo(100.0, 1)
    expect(bip.conv.pulses).toBe(1)
    expect(uni.conv.pulses).toBe(2)
    // The same speed either way: the modulation moves the ripple, not the
    // average the machine runs on.
    expect(uni.m.rpm).toBeCloseTo(bip.m.rpm, 3)
  })

  it('moves the rail current with the duty, through zero', () => {
    moves('l2', 'D', 0.5, (x) => x.m.Iin, 0.5)
    moves('l2', 'Vdc', 1.2, (x) => x.m.rpm)
    moves('l2', 'La', 2, (x) => x.m.ripple, 0.4)
    const sweep = sweepFor(byId.l2, defaultsOf('l2'))
    const signs = new Set(sweep.points.map((q) => Math.sign(q.iin)))
    expect(signs.has(1) && signs.has(-1), 'the sweep crosses zero').toBe(true)
  })
})

describe('L3 · six-step commutation', () => {
  it('is the conducting pair in series: 1 Ω, 3 mH and 0.16 V·s per radian', () => {
    const x = at('l3')
    expect(x.mach.Ra).toBeCloseTo(1, 9)
    expect(x.mach.La * 1e3).toBeCloseTo(3, 9)
    expect(x.mach.k).toBeCloseTo(0.16, 9)
  })

  it('holds 1357 rev/min against 201 mN·m at half duty', () => {
    const x = at('l3')
    expect(x.m.rpm).toBeCloseTo(1357, 0)
    expect(x.m.torque * 1e3).toBeCloseTo(201.4, 1)
    expect(pct(x.m.eta)).toBeCloseTo(94.08, 1)
  })

  it('turns 60° between commutations, 543 times a second, 37 periods apart', () => {
    const x = at('l3')
    const c = x.formulas.comm
    expect(c.angle).toBeCloseTo(60, 9)
    expect(c.fe).toBeCloseTo(90.48, 1)
    expect(c.sector * 1e3).toBeCloseTo(1.842, 3)
    expect(c.rate).toBeCloseTo(543, 0)
    expect(c.periodsPerSector).toBeCloseTo(36.8, 1)
    expect(c.phaseShare * x.m.Irms).toBeCloseTo(1.029, 3)
  })

  it('modulates the torque 15.9 % with 200 mA of ripple, and 63.5 % at 5 kHz', () => {
    const x = at('l3')
    expect(x.m.ripple * 1e3).toBeCloseTo(200.0, 1)
    expect(pct(x.m.rippleShare)).toBeCloseTo(15.89, 1)
    expect(x.m.torqueRipple * 1e3).toBeCloseTo(32.0, 1)
    const slow = at('l3', { fs: 5e3 })
    expect(pct(slow.m.rippleShare)).toBeCloseTo(63.54, 1)
    // Four times the period, four times the ripple.
    expect(slow.m.ripple / x.m.ripple).toBeCloseTo(4, 2)
  })

  it('moves the commutation rate with the speed and the ripple with the frequency', () => {
    moves('l3', 'fs', 0.25, (x) => x.m.rippleShare, 0.5)
    moves('l3', 'TL', 2, (x) => x.formulas.comm.rate, 0.01)
    moves('l3', 'lambda', 1.5, (x) => x.m.rpm, 0.1)
    moves('l3', 'Ls', 2, (x) => x.m.ripple, 0.4)
  })
})

describe('the triple agreement (§6): the solver, the walk, and the averaged machine', () => {
  it.each([['l1'], ['l2'], ['l3']])('%s', (id) => {
    const p = defaultsOf(id)
    const conv = drive(byId[id].kind, driveParams(p))
    const ss = driveSteadyState(conv)
    const m = driveMeasures(ss)
    const a = driveAveraged(conv)
    // The averaged machine, which knows nothing of the switching.
    expect(Math.abs(m.omega / a.omega - 1), `${id} ω`).toBeLessThan(1e-8)
    expect(Math.abs(m.Iavg / a.ia - 1), `${id} ⟨i_a⟩`).toBeLessThan(1e-8)
    // The walk from rest, with a light rotor so it settles inside the cap and
    // the same machine otherwise. It knows nothing of the solver's answer.
    const light = drive(byId[id].kind, { ...driveParams(p), J: 4e-6 })
    const lightSs = driveSteadyState(light)
    const r = driveRunUp(light, [0, 0], { periods: 40000, settle: 1e-13 })
    expect(r.periods, `${id} settled`).toBeLessThan(40000)
    expect(Math.abs(r.x[0] - lightSs.x0[0]) / r.scale[0], `${id} walk i`).toBeLessThan(1e-8)
    expect(Math.abs(r.x[1] - lightSs.x0[1]) / r.scale[1], `${id} walk ω`).toBeLessThan(1e-8)
  })
})

// ---------------------------------------------------------------- Group M

describe('M1 · the input current is a pulse train', () => {
  it('takes 2.00 A for half of each period and nothing for the rest', () => {
    const x = at('m1')
    expect(x.m.sig.iL.avg).toBeCloseTo(1.9959, 3)
    expect(x.m.Iconv).toBeCloseTo(0.998, 3)
    expect(x.m.sig.iin.min).toBeCloseTo(0, 9)
    expect(x.m.convRipple).toBeCloseTo(2.295, 2)
    expect(x.m.sig.vout.avg).toBeCloseTo(11.976, 3)
  })

  it('has 1.28 A at 100 kHz, 424 mA at 300 kHz, and nothing at the even multiples', () => {
    const x = at('m1')
    const h = x.formulas.pulse
    expect(h[0].peak).toBeCloseTo(1.277, 2)
    expect(h[2].peak * 1e3).toBeCloseTo(423.8, 0)
    // The closed form beside each, and the even orders it puts at zero.
    expect(h[0].ideal).toBeCloseTo(1.271, 2)
    expect(pulseHarmonic(2, 0.5)).toBeCloseTo(0, 12)
    expect(h[1].peak).toBeLessThan(0.1 * h[0].peak)
    expect(h[3].peak).toBeLessThan(0.1 * h[0].peak)
  })

  it('gives the input capacitor 1.03 A rms, against I√(D(1−D))', () => {
    const x = at('m1')
    expect(x.m.sig.icin.rms).toBeCloseTo(1.027, 2)
    expect(x.formulas.Icap).toBeCloseTo(0.998, 2)
    expect(x.m.lineRipple * 1e3).toBeCloseTo(64.16, 1)
    expect(x.m.cinRipple * 1e3).toBeCloseTo(50.97, 1)
  })

  it('ripples 638 mV on the input and 842 mA on the line at 10 µF', () => {
    const x = at('m1', { Cin: 10e-6 })
    expect(x.m.cinRipple * 1e3).toBeCloseTo(638.3, 0)
    expect(x.m.lineRipple * 1e3).toBeCloseTo(842.1, 0)
  })

  it('moves the ripple with the capacitor and the harmonics with the duty', () => {
    moves('m1', 'Cin', 0.1, (x) => x.m.cinRipple, 0.5)
    moves('m1', 'Cin', 0.1, (x) => x.m.lineRipple, 0.5)
    moves('m1', 'D', 0.5, (x) => x.formulas.pulse[1].peak, 0.5)
    moves('m1', 'fs', 2, (x) => x.m.cinRipple, 0.3)
    moves('m1', 'R', 0.5, (x) => x.formulas.pulse[0].peak, 0.5)
  })
})

describe('one spectrum, read two ways (§6)', () => {
  it('the exact Fourier integral and @ee-labs/dsp’s FFT agree on the pulse train', () => {
    for (const id of ['m1', 'm2']) {
      const p = defaultsOf(id)
      const ss = emiSteadyState(emiConverter({ ...p }))
      const ex = emiHarmonics(ss, 'iin', 5)
      const ff = fftHarmonics(ss, 'iin', 5, { n: 32768 })
      for (let i = 0; i < ex.length; i++) {
        expect(Math.abs(ff[i].peak / ex[i].peak - 1), `${id} k = ${ex[i].k}`).toBeLessThan(2e-3)
      }
    }
  })
})

describe('M2 · the input filter', () => {
  it('corners at 7.34 kHz and rejects the switching frequency 184 times', () => {
    const x = at('m2')
    expect(x.formulas.f0 / 1e3).toBeCloseTo(7.341, 2)
    expect(x.formulas.rejection).toBeCloseTo(184.5, 0)
    expect(x.m.conv1).toBeCloseTo(1.278, 2)
    expect(x.m.line1 * 1e3).toBeCloseTo(6.925, 1)
    // The rejection is |H| at the switching frequency, exactly.
    expect(Math.abs(x.m.attenuation / x.m.predicted - 1)).toBeLessThan(1e-8)
  })

  it('peaks at 93 Ω against the converter’s 24 Ω, which the rule forbids', () => {
    const x = at('m2')
    expect(x.formulas.middlebrook.Zout).toBeCloseTo(93.15, 0)
    expect(x.formulas.middlebrook.Zin).toBeCloseTo(24.02, 1)
    expect(x.formulas.middlebrook.ratio).toBeCloseTo(3.877, 2)
    expect(x.formulas.middlebrook.safe).toBe(false)
  })

  it('brings the peak to 0.99 Ω with a 1 Ω resistor, and the rejection to 6.3', () => {
    const x = at('m2', { Rd: 1 })
    expect(x.formulas.middlebrook.Zout).toBeCloseTo(0.9897, 2)
    expect(x.formulas.middlebrook.ratio).toBeCloseTo(0.0412, 3)
    expect(x.formulas.middlebrook.safe).toBe(true)
    expect(x.formulas.rejection).toBeCloseTo(6.325, 2)
  })

  it('moves both with the damping, and the corner with the inductor', () => {
    moves('m2', 'Rd', 1e-4, (x) => x.formulas.rejection, 0.5)
    moves('m2', 'Rd', 1e-4, (x) => x.formulas.middlebrook.ratio, 0.5)
    moves('m2', 'Lf', 0.1, (x) => x.formulas.f0, 0.5)
    moves('m2', 'Cin', 4, (x) => x.formulas.f0, 0.3)
  })
})

describe('M3 · the switch node rings', () => {
  it('rings at 15.9 MHz, where 1/(2π√(L_p C_p)) puts it', () => {
    const x = at('m3')
    expect(x.formulas.f0 / 1e6).toBeCloseTo(15.915, 2)
    expect(x.m.measured.f / 1e6).toBeCloseTo(15.915, 2)
    expect(x.formulas.Q).toBeCloseTo(5, 3)
    expect(x.formulas.zeta).toBeCloseTo(0.1, 6)
    // The damped frequency over the switching one: sixteen rings a period.
    expect(x.formulas.cycles).toBeCloseTo(15.84, 1)
  })

  it('overshoots 72.8 % of a 24 V rail and reaches 41.5 V', () => {
    const x = at('m3')
    expect(pct(x.m.overshoot)).toBeCloseTo(72.8, 1)
    expect(pct(x.formulas.overshoot)).toBeCloseTo(72.9, 1)
    expect(x.m.peak).toBeCloseTo(41.48, 1)
    expect(x.m.sig.vsw.avg).toBeCloseTo(12, 6)
  })

  it('decays 0.530 of a peak each cycle, which is ζ = 0.100 read back', () => {
    // §4 asks M3 for the frequency AND the decay, each measured against the
    // parasitic values. The decay is the ratio of one peak to the next, and
    // the logarithmic decrement turns it back into the damping the loop's own
    // R_p and C_p set.
    const x = at('m3')
    expect(x.m.measured.decay).toBeCloseTo(0.5303, 3)
    expect(x.m.measured.zeta).toBeCloseTo(0.1004, 3)
    expect(x.formulas.decay).toBeCloseTo(0.5318, 3)
    expect(Math.abs(x.m.measured.zeta / x.formulas.zeta - 1)).toBeLessThan(0.01)
    // The envelope's own time constant is 2·R_p·C, a hundred nanoseconds
    // here, which is 1.6 ring cycles and not the loop's 2·L_p/R_p.
    expect(x.formulas.tau * 1e9).toBeCloseTo(100, 6)
    // Less damping, a slower decay: the sign the series form would reverse.
    const soft = at('m3', { Rp: 200 })
    expect(soft.m.measured.decay).toBeGreaterThan(x.m.measured.decay)
    expect(soft.formulas.tau).toBeGreaterThan(x.formulas.tau)
    moves('m3', 'Rp', 3, (q) => q.m.measured.zeta, 0.5)
    moves('m3', 'Rp', 3, (q) => q.formulas.tau, 0.5)
  })

  it('costs 557 mW of the 24 W it delivers', () => {
    const x = at('m3')
    expect(x.m.loss.parasitic * 1e3).toBeCloseTo(557.4, 0)
    expect(x.m.Pout).toBeCloseTo(24, 2)
    expect(x.m.loss.snubber).toBe(0)
  })

  it('halves the ring at 400 nH, and damps it to 39 % with a snubber that costs 1.25 W', () => {
    const slow = at('m3', { Lp: 400e-9 })
    expect(slow.formulas.f0 / 1e6).toBeCloseTo(7.958, 2)
    expect(slow.m.measured.f / 1e6).toBeCloseTo(7.958, 2)
    const snub = at('m3', { snubber: 1 })
    expect(pct(snub.m.overshoot)).toBeCloseTo(38.9, 1)
    const bare = at('m3')
    const extra = snub.m.loss.parasitic + snub.m.loss.snubber - bare.m.loss.parasitic
    expect(extra).toBeCloseTo(1.25, 1)
    // ...and that is C_sn·V²·f_s, which does not depend on R_sn.
    expect(snub.formulas.Psn).toBeCloseTo(1.267, 2)
    expect(Math.abs(extra / snub.formulas.Psn - 1)).toBeLessThan(0.15)
  })

  it('footnotes the two ring forms where their own assumptions fail', () => {
    // CORE_SCOPE rule 3: every approximation carries a threshold, and the
    // threshold is exercised. The forms hold the loop's own parasitics and
    // nothing else, so a snubber and hard damping each take a row out of the
    // comparison rather than marking correct physics wrong.
    const rows = (over) => {
      const p = { ...defaultsOf('m3'), ...over }
      return experimentMath(byId.m3, p, at('m3', over)).blocks.find((b) => b.kind === 'check').rows
    }
    const find = (rs, label) => rs.find((r) => r.label === label)
    expect(find(rows({}), 'ζ from the decay').unchecked).toBeUndefined()
    expect(find(rows({}), 'the overshoot').unchecked).toBeUndefined()
    // Hard damping leaves the second peak a few per cent of the first.
    expect(find(rows({ Rp: 5 }), 'ζ from the decay').unchecked).toBeTruthy()
    // A snubber damps through a resistance the loop's own ζ does not carry,
    // and it slows the decay past the interval it has to die in. Either
    // reason takes both rows out of the comparison.
    expect(find(rows({ snubber: 1 }), 'the overshoot').unchecked).toBeTruthy()
    expect(find(rows({ snubber: 1 }), 'ζ from the decay').unchecked).toBeTruthy()
    // With the ring given room to die away between edges, the snubber's own
    // resistance is the reason left.
    expect(find(rows({ snubber: 1, fs: 500e3, Csn: 470e-12 }), 'the overshoot').unchecked).toMatch(/snubber/)
  })

  it('moves the ring with both parasitics, and the loss with the damping', () => {
    moves('m3', 'Lp', 4, (x) => x.formulas.f0, 0.4)
    moves('m3', 'Cp', 4, (x) => x.formulas.f0, 0.4)
    moves('m3', 'Rp', 3, (x) => x.formulas.overshoot, 0.05)
    moves('m3', 'Rp', 3, (x) => x.m.loss.parasitic, 0.1)
    moves('m3', 'Lp', 4, (x) => x.m.measured.f, 0.4)
  })
})

// ---------------------------------------------------------------- Group N

describe('N1 · loss becomes temperature', () => {
  it('delivers 68.5 W into 2 Ω and loses 3.40 W, 1.72 W of it conduction', () => {
    const x = at('n1')
    const t = x.m.thermal
    expect(x.m.ledger.Pout).toBeCloseTo(68.53, 1)
    expect(t.conduction).toBeCloseTo(1.715, 2)
    expect(t.switching).toBeCloseTo(1.686, 2)
    expect(t.P).toBeCloseTo(3.401, 2)
    expect(pct(x.m.ledger.eta)).toBeCloseTo(95.27, 1)
    // The ledger's identity: every conduction term is an integral of one
    // waveform, so what is left over is zero.
    expect(Math.abs(x.m.ledger.residual)).toBeLessThan(1e-9 * x.m.ledger.Pin)
  })

  it('lifts the junction 47.6 K above a 25 °C ambient, to 72.6 °C', () => {
    const x = at('n1')
    const t = x.m.thermal
    expect(t.net.Rtotal).toBeCloseTo(14, 9)
    expect(t.rise).toBeCloseTo(47.61, 1)
    expect(t.Tj).toBeCloseTo(72.61, 1)
    expect(t.Pmax).toBeCloseTo(8.929, 2)
    expect(t.headroom).toBeCloseTo(77.4, 0)
  })

  it('passes the limit at 1 Ω, by 12.5 K', () => {
    const x = at('n1', { R: 1 })
    const t = x.m.thermal
    expect(t.P).toBeCloseTo(9.824, 2)
    expect(t.Tj).toBeCloseTo(162.5, 0)
    expect(t.headroom).toBeCloseTo(-12.5, 0)
    expect(t.margin).toBeGreaterThan(1)
  })

  it('moves the junction with the load, the ambient and every stage', () => {
    moves('n1', 'R', 0.5, (x) => x.m.thermal.Tj, 0.1)
    moves('n1', 'Ta', 2, (x) => x.m.thermal.Tj, 0.1)
    moves('n1', 'R3', 1.5, (x) => x.m.thermal.Tj, 0.1)
    moves('n1', 'Ron', 3, (x) => x.m.thermal.P, 0.05)
    moves('n1', 'Tjmax', 1.2, (x) => x.m.thermal.Pmax, 0.1)
  })
})

describe('N2 · the thermal RC', () => {
  it('follows Σ R(1 − e^{−t/τ}) at every time the plot draws', () => {
    const x = at('n2')
    const t = x.m.thermal
    const times = [1e-4, 1e-3, 1e-2, 0.1, 1, 10, 100, 1000]
    const got = zth(t.net, times)
    const want = [0.0585, 0.39324, 0.7336, 1.489, 2.0399, 2.3934, 5.4016, 13.572]
    times.forEach((q, i) => {
      expect(got[i], `t = ${q}`).toBeCloseTo(want[i], 3)
      expect(got[i], `t = ${q} against the closed form`).toBeCloseTo(fosterZth(t.stages, q), 9)
    })
  })

  it('runs 3.8 % cooler as a ladder at ten milliseconds, and the same at the end', () => {
    const x = at('n2')
    const t = x.m.thermal
    const [f] = zth(t.net, [1e-2])
    const [c] = zth(t.other, [1e-2])
    expect(pct(1 - c / f)).toBeCloseTo(3.84, 1)
    const [ff] = zth(t.net, [1e5])
    const [cc] = zth(t.other, [1e5])
    expect(ff).toBeCloseTo(cc, 6)
    expect(ff).toBeCloseTo(14, 6)
  })

  it('swings the junction 6.77 K about 23.8 K with a 1 s period, 512 mK at 1 ms', () => {
    const x = at('n2')
    const t = x.m.thermal
    expect(t.P).toBeCloseTo(3.401, 2)
    expect(t.pulse.swing).toBeCloseTo(6.772, 2)
    expect(t.pulse.mean).toBeCloseTo(23.806, 2)
    expect(t.pulse.peak).toBeCloseTo(27.192, 2)
    // The mean is ⟨P⟩·ΣR exactly, whatever the period is.
    expect(t.pulse.mean).toBeCloseTo(t.pulse.flat, 9)
    const fast = at('n2', { pulsePeriod: 1e-3 })
    expect(fast.m.thermal.pulse.swing * 1e3).toBeCloseTo(511.7, 0)
    expect(fast.m.thermal.pulse.mean).toBeCloseTo(fast.m.thermal.pulse.flat, 9)
  })

  it('moves the swing with the period, the duty and the stages', () => {
    moves('n2', 'pulsePeriod', 1e-3, (x) => x.m.thermal.pulse.swing, 0.5)
    moves('n2', 'pulseDuty', 0.4, (x) => x.m.thermal.pulse.mean, 0.3)
    // A stage far faster than the pulse charges and discharges whole either
    // way, so its own time constant shows in the swing only once the pulse
    // is quick enough to catch it. At a millisecond period it is the whole
    // of the swing, and moving it moves the reading by half again.
    const fast = (tau1) => at('n2', { pulsePeriod: 1e-3, tau1 }).m.thermal.pulse.swing
    expect(Math.abs(fast(1e-2) / fast(1e-3) - 1)).toBeGreaterThan(0.5)
    moves('n2', 'R1', 2, (x) => x.m.thermal.pulse.swing, 0.05)
    moves('n2', 'R', 0.5, (x) => x.m.thermal.P, 0.1)
  })
})

describe('N3 · faster is hotter', () => {
  it('charges 5.62 µW a hertz, and the junction follows', () => {
    const x = at('n3')
    const t = x.m.thermal
    expect(t.kSw * 1e6).toBeCloseTo(5.62, 2)
    expect(t.switching).toBeCloseTo(1.686, 2)
    expect(t.Tj).toBeCloseTo(72.61, 1)
    // The edges are the model's own row: the slope times the frequency.
    expect(t.switching).toBeCloseTo(t.kSw * x.p.fs, 9)
  })

  it('takes 5.62 W at the edges and 128 °C at 1 MHz', () => {
    const x = at('n3', { fs: 1e6 })
    expect(x.m.thermal.switching).toBeCloseTo(5.62, 1)
    expect(x.m.thermal.Tj).toBeCloseTo(127.7, 0)
    expect(pct(x.m.ledger.eta)).toBeCloseTo(90.33, 1)
  })

  it('ripples 638 mA at 300 kHz and 191 mA at 1 MHz, which is why faster is wanted', () => {
    const x = at('n3')
    const p = x.p
    expect(x.m.sig.iL.pp * 1e3).toBeCloseTo(638.3, 1)
    // The ideal triangle is V_o(1−D)/(L f_s). The exact waveform runs 2.5 %
    // above it, because the winding and the switch raise the on-state
    // volt-second above V_o(1−D) by i·(R_on + R_L).
    const ideal = (fs) => (x.m.sig.vout.avg * (1 - p.D)) / (p.L * fs)
    expect(x.m.sig.iL.pp / ideal(p.fs)).toBeCloseTo(1, 1)
    const fast = at('n3', { fs: 1e6 })
    expect(fast.m.sig.iL.pp * 1e3).toBeCloseTo(191.5, 1)
    // The whole tradeoff in one line: the ripple goes as 1/f_s while the
    // edges go as f_s, so the same knob divides one and multiplies the other.
    // The edges track f_s to a part in ten thousand rather than exactly, since
    // the energy an edge costs is set by the current at the instant it opens,
    // and a smaller ripple moves that current.
    expect(x.m.sig.iL.pp / fast.m.sig.iL.pp).toBeCloseTo(1e6 / p.fs, 2)
    expect(fast.m.thermal.switching / x.m.thermal.switching).toBeCloseTo(1e6 / p.fs, 3)
    moves('n3', 'fs', 3, (x) => x.m.sig.iL.pp, 0.5)
    moves('n3', 'L', 2, (x) => x.m.sig.iL.pp, 0.4)
  })

  it('runs coolest at 38 kHz, below which the ripple costs more than the edges save', () => {
    const x = at('n3')
    const c = x.m.thermal.coolest
    expect(c.interior, 'the turning point is inside the swept range').toBe(true)
    expect(c.x / 1e3).toBeCloseTo(38.07, 1)
    expect(c.Tj).toBeCloseTo(53.47, 1)
    // Almost all of it is conduction there: 1.82 W against 214 mW at the edges.
    expect(c.P).toBeCloseTo(2.034, 2)
    // It is a minimum: a decade either side of it is hotter.
    for (const f of [c.x / 3, c.x * 3]) {
      const q = at('n3', { fs: f })
      expect(q.m.thermal.Tj, `${(f / 1e3).toFixed(1)} kHz`).toBeGreaterThan(c.Tj)
    }
    // A larger inductor makes the same ripple at a lower frequency, so the
    // turning point moves down. The pin follows the knob it is about.
    const big = at('n3', { L: 4 * defaultsOf('n3').L })
    expect(big.m.thermal.coolest.x).toBeLessThan(0.75 * c.x)
    moves('n3', 'Ron', 3, (x) => x.m.thermal.coolest.x, 0.05)
  })

  it('draws both halves of that tradeoff on the one sweep', () => {
    const e = byId.n3
    expect(e.sweep.y2, 'the ripple rides the right axis').toBe('dil')
    const sw = sweepFor(e, defaultsOf('n3'))
    expect(sw.points.length).toBeGreaterThan(10)
    for (const q of sw.points) expect(Number.isFinite(q.dil), `ΔI_L at ${q.x}`).toBe(true)
    // The ripple falls at every step of the sweep. The junction falls to the
    // turning point and rises after it, which is the shape the note describes
    // and the reason the group's title needs the word "above".
    const cool = at('n3').m.thermal.coolest.x
    for (let i = 1; i < sw.points.length; i++) {
      const [a, b] = [sw.points[i - 1], sw.points[i]]
      expect(b.dil, `ΔI_L at ${b.x} Hz`).toBeLessThan(a.dil)
      if (a.x >= cool) expect(b.Tj, `T_j at ${b.x} Hz`).toBeGreaterThan(a.Tj)
      if (b.x <= cool) expect(b.Tj, `T_j at ${b.x} Hz`).toBeLessThan(a.Tj)
    }
  })

  it('marks the turning point and the ceiling where the note says they are', () => {
    const e = byId.n3
    const x = at('n3')
    const sw = sweepFor(e, defaultsOf('n3'))
    const marks = sweepMarks(e, x, sw)
    const cool = marks.find((q) => q.type === 'point' && /coolest/.test(q.label))
    expect(cool, 'the coolest point is drawn').toBeTruthy()
    expect(cool.x).toBeCloseTo(x.m.thermal.coolest.x, 6)
    expect(cool.y).toBeCloseTo(x.m.thermal.coolest.Tj, 6)
    const ceiling = marks.find((q) => q.type === 'vline')
    expect(ceiling.x).toBeCloseTo(x.m.thermal.ceiling.fs, 6)
  })

  it('can afford 1.28 MHz, where the whole 8.93 W budget is spent', () => {
    const x = at('n3')
    const t = x.m.thermal
    expect(t.ceiling.budget).toBeCloseTo(8.929, 2)
    expect(t.ceiling.fs / 1e6).toBeCloseTo(1.284, 2)
    expect(t.ceiling.feasible).toBe(true)
    // At that frequency the junction is exactly at its limit.
    const P = t.conduction + t.kSw * t.ceiling.fs
    expect(t.Ta + P * t.net.Rtotal).toBeCloseTo(t.Tjmax, 6)
  })

  it('moves the ceiling with the load, the ambient and the edges', () => {
    moves('n3', 'fs', 3, (x) => x.m.thermal.Tj, 0.2)
    moves('n3', 'tsw', 2, (x) => x.m.thermal.ceiling.fs, 0.3)
    moves('n3', 'Ta', 2, (x) => x.m.thermal.ceiling.fs, 0.1)
    moves('n3', 'R', 0.5, (x) => x.m.thermal.ceiling.fs, 0.3)
  })
})

describe('the thermal network is the same propagator with degrees on it', () => {
  it('settles where P·ΣR says, from a route that never used the sum', () => {
    const net = thermalNetwork('foster', stagesOf({ R1: 0.6, tau1: 1e-3, R2: 1.4, tau2: 0.1, R3: 12, tau3: 300 }))
    for (const P of [0.5, 3.401, 20]) {
      const [rise] = stepRise(net, P, [60 * net.Rtotal * net.Ctotal])
      expect(Math.abs(rise / (P * net.Rtotal) - 1), `P = ${P}`).toBeLessThan(1e-9)
    }
  })

  it('draws each of the six sweeps as a curve rather than a set of points', () => {
    // §11.1.4's rule, for the curves these groups add: continuity by
    // refinement. Four times the points and the largest step between
    // neighbours at most halves. A jump would not care how fine the grid is.
    const maxStep = (pts, y) => Math.max(...pts.slice(1).map((q, i) => Math.abs(q[y] - pts[i][y])))
    const cases = [
      ['l1', 'speed', (p, n) => sweepDriveD('dcdrive', p, n)],
      ['l2', 'iin', (p, n) => sweepDriveD('hbridge', p, n)],
      ['l3', 'ripple', (p, n) => sweepDriveFs('bldc', p, n)],
      ['m2', 'att', (p, n) => sweepDamping(p, n)],
      ['n1', 'Tj', (p, n) => sweepThermalR(p, n)],
      ['n3', 'Tj', (p, n) => sweepThermalFs(p, n)],
    ]
    for (const [id, y, sweep] of cases) {
      const p = defaultsOf(id)
      const coarse = sweep(p, 41)
      const fine = sweep(p, 161)
      for (const q of fine) expect(Number.isFinite(q[y]), `${id} ${y} at ${q.x}`).toBe(true)
      expect(maxStep(fine, y), `${id} ${y}`).toBeLessThanOrEqual(0.5 * maxStep(coarse, y))
    }
  })

  it('averages a pulse to ⟨P⟩·ΣR, in both networks', () => {
    const stages = stagesOf({ R1: 0.6, tau1: 1e-3, R2: 1.4, tau2: 0.1, R3: 12, tau3: 300 })
    for (const model of ['foster', 'cauer']) {
      const net = thermalNetwork(model, stages)
      const q = pulsedRise(net, { P: 3.401, duty: 0.35, period: 2 })
      expect(Math.abs(q.mean / q.flat - 1), model).toBeLessThan(1e-8)
      expect(q.flat).toBeCloseTo(3.401 * 0.35 * 14, 9)
    }
  })
})
