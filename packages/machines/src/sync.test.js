import { describe, it, expect } from 'vitest'
import { transient, GROUND } from '@ee-labs/network'
import { CONVENTIONS } from './dq.js'
import { focPlant, pmsmOf, pmsmState, pmsmTorque, powerAngle, pullOut, syncCurve, syncOf, syncPhasor } from './sync.js'

const rand = (lo, hi) => lo + Math.random() * (hi - lo)

describe('the synchronous machine', () => {
  it('makes power that follows the sine of the angle, from the phasor diagram', () => {
    for (let t = 0; t < 30; t++) {
      const spec = { V: rand(150, 300), E: rand(100, 350), Xs: rand(2, 20), Ra: 0 }
      const d = rand(-1.4, 1.4)
      const ph = syncPhasor(spec, d)
      const pa = powerAngle(spec, d)
      expect(ph.P / pa.P).toBeCloseTo(1, 9)
      expect(pa.P / ((3 * spec.V * spec.E * Math.sin(d)) / spec.Xs)).toBeCloseTo(1, 12)
    }
  })

  it('pulls out at ninety degrees on a round rotor', () => {
    const spec = {}
    const po = pullOut(spec)
    expect(po.delta).toBeCloseTo(Math.PI / 2, 12)
    const curve = syncCurve(spec)
    expect(Math.max(...curve.P) / po.P).toBeCloseTo(1, 8)
    for (const d of [0.7, 0.9, 1.1, 1.3]) expect(powerAngle(spec, (Math.PI / 2) * d)).toBeDefined()
    expect(powerAngle(spec, Math.PI / 2 + 0.3).P).toBeLessThan(po.P)
  })

  it('pulls out below ninety degrees when the rotor is salient', () => {
    const spec = { salient: true, Xd: 8, Xq: 5 }
    const po = pullOut(spec)
    expect(po.delta).toBeLessThan(Math.PI / 2)
    const curve = syncCurve(spec)
    expect(Math.max(...curve.P) / po.P).toBeCloseTo(1, 4)
  })

  it('makes reluctance torque with no field at all', () => {
    const spec = { salient: true, E: 0, Xd: 8, Xq: 5 }
    const pa = powerAngle(spec, Math.PI / 4)
    expect(pa.field).toBeCloseTo(0, 12)
    expect(pa.reluctance).toBeGreaterThan(0)
    // The reluctance term peaks at 45°, twice the angle of the field term.
    for (const d of [0.6, 0.8, 1.2, 1.5]) expect(powerAngle(spec, (Math.PI / 4) * d).P).toBeLessThan(pa.P)
  })

  it('has no reluctance term when the two reactances are equal', () => {
    expect(powerAngle({ salient: true, Xd: 6, Xq: 6 }, 0.5).reluctance).toBeCloseTo(0, 12)
  })

  it('draws leading current when it is over-excited and lagging when it is not', () => {
    const over = syncPhasor({ E: 300 }, 0.2)
    const under = syncPhasor({ E: 150 }, 0.2)
    expect(over.excitation).toBe('over')
    expect(under.excitation).toBe('under')
    expect(over.Q).toBeLessThan(0)
    expect(under.Q).toBeGreaterThan(0)
  })

  it('turns power into torque at the synchronous speed and nowhere else', () => {
    const m = syncOf({})
    expect(m.rpmSync).toBeCloseTo(1500, 12)
    const pa = powerAngle({}, 0.4)
    expect(pa.torque).toBeCloseTo(pa.P / m.omegaSync, 12)
  })

  it('refuses reactances and pole counts a machine cannot have', () => {
    expect(() => syncOf({ Xs: 0 })).toThrow(/synchronous reactance/)
    expect(() => syncOf({ Xd: 0 })).toThrow(/reactances/)
    expect(() => syncOf({ poles: 5 })).toThrow(/even number of poles/)
  })
})

describe('the permanent-magnet machine in dq', () => {
  it('has a state matrix that the network engine reproduces as a circuit', () => {
    // The d and q rows are each an R–L with a source, coupled by the speed
    // terms. Build the q-axis alone with i_d held at zero and the two agree.
    const spec = { Ld: 2e-3, Lq: 2e-3, R: 0.5, lambda: 0.08, omegaE: 2 * Math.PI * 100 }
    const st = pmsmState(spec)
    const m = pmsmOf(spec)
    expect(st.A[1][1]).toBeCloseTo(-m.R / m.Lq, 12)
    expect(st.c[1]).toBeCloseTo((-m.omegaE * m.lambda) / m.Lq, 12)
    const net = {
      elements: [
        { type: 'V', id: 'vq', nodes: ['a', GROUND], value: 0, wave: { kind: 'step', from: 0, to: 80 } },
        { type: 'V', id: 'emf', nodes: ['a', 'b'], value: m.omegaE * m.lambda },
        { type: 'R', id: 'R', nodes: ['b', 'c'], value: m.R },
        { type: 'L', id: 'Lq', nodes: ['c', GROUND], value: m.Lq },
      ],
    }
    const tau = m.Lq / m.R
    // The current starts at zero: the machine is at rest and the drive has
    // not yet applied a volt. Without that the pre-step circuit would put the
    // back-EMF across the winding on its own.
    const tr = transient(net, { tEnd: 20 * tau, points: 401, x0: [0] })
    const settled = (80 - m.omegaE * m.lambda) / m.R
    expect(tr.at(20 * tau).sol.i.R / settled).toBeCloseTo(1, 8)
    expect(tr.at(tau).sol.i.R / (settled * (1 - Math.exp(-1)))).toBeCloseTo(1, 8)
  })

  it('states its torque in the convention it was handed, and the two differ by three halves', () => {
    const amp = pmsmTorque({ convention: 'amplitude-invariant' }, 0, 5)
    const pow = pmsmTorque({ convention: 'power-invariant' }, 0, 5)
    expect(amp.torque / pow.torque).toBeCloseTo(1.5, 12)
    expect(amp.convention).toBe('amplitude-invariant')
    expect(amp.factor).toBeCloseTo(CONVENTIONS['amplitude-invariant'].torqueFactor, 12)
  })

  it('has no reluctance torque on a surface-magnet rotor', () => {
    expect(pmsmTorque({ Ld: 2e-3, Lq: 2e-3 }, -4, 5).reluctance).toBeCloseTo(0, 14)
    expect(pmsmTorque({ Ld: 2e-3, Lq: 3e-3 }, -4, 5).reluctance).toBeGreaterThan(0)
  })

  it('is linear in i_q with i_d held at zero, which is what makes the loop simple', () => {
    for (const iq of [1, 2, 4, 8]) {
      expect(pmsmTorque({}, 0, iq).torque / (iq * pmsmTorque({}, 0, 1).torque)).toBeCloseTo(1, 12)
    }
  })

  it('refuses a machine with a parameter that is not positive', () => {
    expect(() => pmsmOf({ Ld: 0 })).toThrow(/must be positive/)
    expect(() => pmsmOf({ convention: 'nonesuch' })).toThrow(/unknown dq convention/)
  })
})

describe('the plant handed to Control Lab', () => {
  it('is two first-order transfer functions with the torque constant between them', () => {
    const p = focPlant({})
    const m = pmsmOf({})
    expect(p.current.a).toEqual([1, m.R / m.Lq])
    expect(p.current.b[0]).toBeCloseTo(1 / m.Lq, 12)
    expect(p.speed.a).toEqual([1, m.B / m.J])
    expect(p.kT).toBeCloseTo(1.5 * m.pairs * m.lambda, 12)
    expect(p.tauElec).toBeCloseTo(m.Lq / m.R, 12)
    expect(p.tauMech).toBeCloseTo(m.J / m.B, 12)
  })

  it('keeps the current loop far faster than the speed loop, which is why they nest', () => {
    const p = focPlant({})
    expect(p.tauMech / p.tauElec).toBeGreaterThan(10)
  })

  it('has a DC gain of one over the resistance and one over the friction', () => {
    const p = focPlant({})
    const m = pmsmOf({})
    expect(p.current.b[0] / p.current.a[1]).toBeCloseTo(1 / m.R, 12)
    expect(p.speed.b[0] / p.speed.a[1]).toBeCloseTo(1 / m.B, 12)
  })
})
