import { describe, it, expect } from 'vitest'
import { operating, timeConstants, integrate } from '@ee-labs/machines'
import {
  drive,
  driveSteadyState,
  drivePeriod,
  driveRunUp,
  driveMeasures,
  driveAveraged,
  driveBalance,
  armatureRipple,
  commutation,
  DRIVE_KINDS,
} from './drive.js'

// A drive is a converter with a shaft in it, so it owes the same invariants
// every other converter in this package owes, plus the two the shaft brings.
//
//   1. ⟨v_L⟩ = 0 over a period, per armature.
//   2. ⟨T_e⟩ = the load torque, which is the shaft's own balance.
//   3. P_in = P_shaft + Σ losses, as an identity rather than an estimate.
//   4. One more period returns the same state.
//   5. The walk from rest lands on the solver's orbit.
//   6. The averaged machine in @ee-labs/machines and the exact switched
//      steady state tell one story: the triple agreement of §6, with the
//      run-up as the third leg.

const rnd = (seed) => {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
const logPick = (r, lo, hi) => lo * Math.pow(hi / lo, r())

/** A seeded drive, across the whole space of settings each kind allows. */
function sample(kind, seed) {
  const r = rnd(seed)
  const p = {
    Vdc: logPick(r, 6, 400),
    D: 0.03 + 0.94 * r(),
    fs: logPick(r, 2e3, 100e3),
    Ra: logPick(r, 0.05, 20),
    La: logPick(r, 100e-6, 50e-3),
    k: logPick(r, 0.005, 1.5),
    J: logPick(r, 1e-5, 5e-3),
    B: logPick(r, 1e-6, 1e-3),
    TL: r() < 0.15 ? 0 : logPick(r, 1e-4, 1),
    Ron: r() < 0.5 ? 0 : logPick(r, 1e-3, 0.3),
    Vf: r() < 0.5 ? 0 : 0.2 + 1.2 * r(),
    rd: r() < 0.7 ? 0 : logPick(r, 1e-3, 0.2),
    bipolar: r() < 0.5 ? 1 : 0,
    lambda: logPick(r, 0.002, 0.2),
    pairs: 1 + Math.floor(r() * 8),
    Rs: logPick(r, 0.02, 5),
    Ls: logPick(r, 50e-6, 20e-3),
  }
  return drive(kind, p)
}

const scaleOf = (m) => Math.max(1e-9, Math.abs(m.sig.iL.max), Math.abs(m.sig.iL.min))

describe('a drive is a converter with a shaft', () => {
  it.each(DRIVE_KINDS)('%s: the invariants hold over 240 seeded settings', (kind) => {
    for (let seed = 1; seed <= 240; seed++) {
      const conv = sample(kind, seed * 7919 + kind.length)
      const ss = driveSteadyState(conv)
      const m = driveMeasures(ss, { dense: 48 })
      const where = `${kind} #${seed}`
      expect(Number.isFinite(m.omega), where).toBe(true)
      expect(Number.isFinite(m.torque), where).toBe(true)
      // 1. Volt-second balance on the armature.
      const vScale = Math.max(conv.p.Vdc, Math.abs(m.sig.vout.max))
      expect(Math.abs(m.sig.vL.avg), `${where} ⟨v_L⟩`).toBeLessThan(1e-9 * vScale)
      // 2. The shaft's balance: the torque the machine makes is the torque
      //    the load takes, averaged over a period.
      const tScale = Math.max(1e-12, Math.abs(m.torque), Math.abs(m.torqueLoad), conv.mach.TL)
      expect(Math.abs(m.torque - m.torqueLoad), `${where} torque balance`).toBeLessThan(1e-7 * tScale)
      // 3. The power books.
      const pScale = Math.max(1e-12, Math.abs(m.Pin), Math.abs(m.Pout))
      expect(Math.abs(m.balance), `${where} P_in − P_shaft − Σ`).toBeLessThan(1e-7 * pScale)
      // 4. Steady state is steady.
      const again = drivePeriod(conv, ss.x0).xEnd
      expect(Math.abs(again[0] - ss.x0[0]), `${where} i returns`).toBeLessThan(1e-8 * scaleOf(m))
      expect(Math.abs(again[1] - ss.x0[1]), `${where} ω returns`).toBeLessThan(1e-8 * Math.max(1e-6, Math.abs(m.omega)))
      // A one-quadrant chopper cannot carry a negative armature current: if
      // the diode blocked, the mode says so and the period starts empty.
      if (conv.hasDead) {
        expect(m.sig.iL.min, `${where} i_a below zero`).toBeGreaterThan(-1e-9 * scaleOf(m))
        if (ss.mode === 'DCM') expect(Math.abs(ss.x0[0]), `${where} DCM starts empty`).toBeLessThan(1e-9 * scaleOf(m))
      }
    }
  })
})

describe('the averaged machine and the switched waveform', () => {
  it('agree exactly with ideal devices, wherever conduction is continuous', () => {
    // With no device drop the terminal voltage averages to what the duty
    // commands, and averaging the two state equations over a closed period
    // leaves the averaged model's own two equations. So this is not an
    // approximation agreeing to a tolerance: it is one answer, read twice.
    let checked = 0
    for (const kind of DRIVE_KINDS) {
      for (let seed = 1; seed <= 200; seed++) {
        const base = sample(kind, seed * 104729 + 11)
        const conv = drive(kind, { ...base.p, Ron: 0, Vf: 0, rd: 0 })
        const ss = driveSteadyState(conv)
        if (ss.mode !== 'CCM') continue
        checked++
        const m = driveMeasures(ss, { dense: 48 })
        const a = driveAveraged(conv)
        const where = `${kind} #${seed}`
        expect(Math.abs(m.omega - a.omega), `${where} ω`).toBeLessThan(1e-8 * Math.abs(a.omega) + 1e-9)
        expect(Math.abs(m.Iavg - a.ia), `${where} ⟨i_a⟩`).toBeLessThan(1e-8 * Math.abs(a.ia) + 1e-9)
        // The torque is a constant times the current, so it carries the
        // current's own last bits and the friction's beside them.
        expect(Math.abs(m.torque - a.torque), `${where} T_e`).toBeLessThan(1e-7 * Math.abs(a.torque) + 1e-12)
      }
    }
    expect(checked, 'settings where the averaged model claims validity').toBeGreaterThan(150)
  })

  it('part company by no more than the ripple through the device drops', () => {
    // With real devices the averaged model charges R_on for the duty rather
    // than for the current's own shape over the interval, so it is out by at
    // most the ripple times that resistance. The bound is the error's own
    // formula, not a tolerance chosen to pass.
    let checked = 0
    for (const kind of DRIVE_KINDS) {
      for (let seed = 1; seed <= 160; seed++) {
        const conv = sample(kind, seed * 15485863 + 7)
        const ss = driveSteadyState(conv)
        if (ss.mode !== 'CCM') continue
        const m = driveMeasures(ss, { dense: 48 })
        const a = driveAveraged(conv)
        const drop = Math.max(conv.p.Ron, conv.p.rd) * m.ripple
        const bound = (drop / conv.mach.ke) * (1 + Math.abs(m.omega) / Math.max(1e-9, Math.abs(a.Va))) + 1e-9
        checked++
        expect(Math.abs(m.omega - a.omega), `${kind} #${seed} ω`).toBeLessThan(bound + 1e-6 * Math.abs(a.omega))
      }
    }
    expect(checked).toBeGreaterThan(100)
  })

  it('is exact at the defaults of each kind, where nothing else is on', () => {
    for (const kind of DRIVE_KINDS) {
      const conv = drive(kind, kind === 'hbridge' ? { D: 0.75 } : {})
      const m = driveMeasures(driveSteadyState(conv))
      const a = driveAveraged(conv)
      // No device drops and no dead interval, so the average of the exact
      // waveform is the averaged model's own answer to eight digits.
      expect(Math.abs(m.omega / a.omega - 1), `${kind} ω`).toBeLessThan(1e-8)
      expect(Math.abs(m.Iavg / a.ia - 1), `${kind} ⟨i_a⟩`).toBeLessThan(1e-8)
      expect(a.separated, `${kind} τ_m / τ_e`).toBeGreaterThan(2)
    }
  })
})

describe('the walk from rest', () => {
  // A drive settles on its mechanical time constant, which is thousands of
  // switching periods. These cases carry a light rotor on purpose, so the
  // walk is affordable and still starts from an empty armature and a
  // stationary shaft.
  const light = { J: 4e-6, B: 1e-5 }
  const cases = [
    ['dcdrive', { ...light }],
    // Running dry: a light load with no torque on the shaft, so the diode
    // blocks and the walk has to find the same dead interval the solver did.
    // The friction is raised with the rotor lightened, because a shaft with
    // neither load nor friction coasts for a hundred thousand periods.
    ['dcdrive', { ...light, B: 1e-3, D: 0.05, TL: 0 }],
    ['hbridge', { ...light, D: 0.75 }],
    ['hbridge', { ...light, D: 0.3, bipolar: 0 }],
    ['bldc', { ...light, TL: 0.05 }],
  ]
  it.each(cases.map((c, i) => [`${c[0]} #${i + 1}`, c[0], c[1]]))('%s lands on the solver’s orbit', (_, kind, over) => {
    const conv = drive(kind, over)
    const ss = driveSteadyState(conv)
    const r = driveRunUp(conv, [0, 0], { periods: 40000, settle: 1e-13 })
    expect(r.periods, 'settled inside the period cap').toBeLessThan(40000)
    expect(Math.abs(r.x[0] - ss.x0[0]) / r.scale[0]).toBeLessThan(1e-8)
    expect(Math.abs(r.x[1] - ss.x0[1]) / r.scale[1]).toBeLessThan(1e-8)
  })

  it('agrees with the machine package’s own integrator on the averaged run-up', () => {
    // A third route to the same shaft: @ee-labs/machines integrates the
    // averaged two-state system with its own Runge–Kutta and its own error
    // guard, and it must land where both of the others do.
    const conv = drive('dcdrive', { J: 4e-6, B: 1e-5 })
    const mach = conv.mach
    const Va = conv.commanded
    const f = (t, y) => [
      (Va - mach.Ra * y[0] - mach.ke * y[1]) / mach.La,
      (mach.km * y[0] - (mach.B + mach.loadB) * y[1] - mach.TL) / mach.J,
    ]
    const run = integrate(f, [0, 0], 0.05, { steps: 4000 })
    const end = run.y[run.y.length - 1]
    const a = driveAveraged(conv)
    expect(Math.abs(end[1] / a.omega - 1)).toBeLessThan(1e-3)
    const m = driveMeasures(driveSteadyState(conv))
    expect(Math.abs(end[1] / m.omega - 1)).toBeLessThan(1e-3)
  })
})

describe('the ripple the drives course writes down', () => {
  it('matches the exact waveform wherever the EMF is the flat number it averages to', () => {
    const cases = [
      ['dcdrive', {}],
      ['dcdrive', { D: 0.25 }],
      ['dcdrive', { D: 0.8 }],
      ['hbridge', { D: 0.75 }],
      ['hbridge', { D: 0.3 }],
      ['hbridge', { D: 0.75, bipolar: 0 }],
      ['hbridge', { D: 0.3, bipolar: 0 }],
      ['bldc', { TL: 0.2 }],
    ]
    for (const [kind, over] of cases) {
      const conv = drive(kind, over)
      const m = driveMeasures(driveSteadyState(conv))
      const pred = armatureRipple(kind, {
        Vdc: conv.p.Vdc,
        D: conv.p.D,
        La: conv.mach.La,
        fs: conv.p.fs,
        bipolar: conv.bipolar,
      })
      // The written form takes the ramp as a straight line, and the armature
      // is an exponential with a 2.5 ms time constant under a 50 µs period.
      // The gap between the two is that curvature, and it is a part in a
      // hundred thousand here.
      expect(Math.abs(m.ripple / pred - 1), `${kind} ${JSON.stringify(over)}`).toBeLessThan(1e-4)
    }
  })

  it('halves when the inductance doubles, and again when the frequency does', () => {
    const base = driveMeasures(driveSteadyState(drive('dcdrive', {}))).ripple
    expect(driveMeasures(driveSteadyState(drive('dcdrive', { La: 6e-3 }))).ripple / (base / 2)).toBeCloseTo(1, 4)
    expect(driveMeasures(driveSteadyState(drive('dcdrive', { fs: 40e3 }))).ripple / (base / 2)).toBeCloseTo(1, 4)
  })

  it('is three times smaller unipolar than bipolar at three-quarter duty, at twice the rate', () => {
    const bip = driveMeasures(driveSteadyState(drive('hbridge', { D: 0.75 })))
    const uni = driveMeasures(driveSteadyState(drive('hbridge', { D: 0.75, bipolar: 0 })))
    expect(bip.ripple / uni.ripple).toBeCloseTo(3, 4)
    expect(bip.omega).toBeCloseTo(uni.omega, 3)
    expect(drive('hbridge', { D: 0.75, bipolar: 0 }).pulses).toBe(2)
    expect(drive('hbridge', { D: 0.75 }).pulses).toBe(1)
  })
})

describe('four quadrants', () => {
  it('sends current back to the rail when the duty falls below what holds the load', () => {
    const motoring = driveMeasures(driveSteadyState(drive('hbridge', { D: 0.75 })))
    const braking = driveMeasures(driveSteadyState(drive('hbridge', { D: 0.3 })))
    expect(motoring.Iin).toBeGreaterThan(0)
    expect(motoring.regenerating).toBe(false)
    expect(braking.Iin).toBeLessThan(0)
    expect(braking.regenerating).toBe(true)
    expect(braking.omega).toBeLessThan(0)
    // The rail takes back what the shaft gives up, and the books still close.
    expect(Math.abs(braking.balance)).toBeLessThan(1e-9 * Math.abs(braking.Pin))
  })

  it('gives the bus current the duty’s own signed share of the armature current', () => {
    // The rail carries +i for the positive interval and −i for the negative
    // one, so its average is (2D − 1)·⟨i⟩ up to how far the ramp leans inside
    // each. That lean is the ripple, and it is a part in a thousand here.
    for (const D of [0.2, 0.4, 0.6, 0.9]) {
      const m = driveMeasures(driveSteadyState(drive('hbridge', { D })))
      expect(Math.abs(m.Iin / ((2 * D - 1) * m.Iavg) - 1), `D = ${D}`).toBeLessThan(2e-3)
      expect(Math.sign(m.Iin), `D = ${D} sign`).toBe(Math.sign((2 * D - 1) * m.Iavg))
    }
  })
})

describe('six-step commutation', () => {
  it('turns 60° between commutations, six to the electrical revolution', () => {
    const conv = drive('bldc', { TL: 0.2 })
    const m = driveMeasures(driveSteadyState(conv))
    const c = commutation(conv, m.omega)
    expect(c.sectors).toBe(6)
    expect(c.angle).toBeCloseTo(60, 9)
    expect(c.omegaE).toBeCloseTo(Math.abs(m.omega) * conv.machine.pairs, 9)
    expect(c.sector).toBeCloseTo(Math.PI / 3 / c.omegaE, 12)
    expect(c.rate).toBeCloseTo(6 * c.fe, 9)
    expect(c.periodsPerSector).toBeCloseTo(c.sector * conv.p.fs, 9)
    // Each phase carries the link current for 120° of every 180°.
    expect(c.phaseShare).toBeCloseTo(Math.sqrt(2 / 3), 12)
  })

  it('takes its constants from the brushless machine, doubled for the conducting pair', () => {
    const conv = drive('bldc', {})
    const m = conv.machine
    expect(conv.mach.Ra).toBeCloseTo(2 * m.R, 12)
    expect(conv.mach.La).toBeCloseTo(2 * m.Ld, 12)
    expect(conv.mach.k).toBeCloseTo(2 * m.lambda * m.pairs, 12)
  })
})

describe('the two balances, per segment', () => {
  it('sum to zero over the period, both of them', () => {
    for (const kind of DRIVE_KINDS) {
      const conv = drive(kind, kind === 'hbridge' ? { D: 0.75 } : {})
      const ss = driveSteadyState(conv)
      const b = driveBalance(ss)
      const vScale = Math.max(...b.segs.map((s) => Math.abs(s.vs)))
      const qScale = Math.max(...b.segs.map((s) => Math.abs(s.q)), conv.mach.TL * conv.T)
      expect(Math.abs(b.vsTotal), `${kind} volt-seconds`).toBeLessThan(1e-9 * vScale)
      expect(Math.abs(b.qTotal), `${kind} torque-seconds`).toBeLessThan(1e-9 * qScale)
    }
  })
})

describe('the machine package is the one source of the machine', () => {
  it('rejects a machine that cannot exist, in @ee-labs/machines’ own words', () => {
    expect(() => drive('dcdrive', { Ra: 0 })).toThrow(/armature resistance/)
    expect(() => drive('dcdrive', { J: 0 })).toThrow(/rotor inertia/)
    expect(() => drive('bldc', { lambda: 0 })).toThrow(/lambda/)
    expect(() => drive('nosuch', {})).toThrow(/unknown drive/)
  })

  it('reads the same operating point the machines lab would print', () => {
    const conv = drive('dcdrive', {})
    const op = operating({ Va: conv.commanded, Ra: 1.2, La: 3e-3, k: 0.06, J: 2e-4, B: 1e-5, TL: 0.05 })
    const a = driveAveraged(conv)
    expect(a.omega).toBeCloseTo(op.omega, 12)
    expect(a.ia).toBeCloseTo(op.ia, 12)
    const tc = timeConstants({ Ra: 1.2, La: 3e-3, k: 0.06, J: 2e-4, B: 1e-5 })
    expect(a.tauE).toBeCloseTo(tc.tauE, 12)
    expect(a.separated).toBeCloseTo(tc.separated, 12)
  })
})
