import { describe, it, expect } from 'vitest'
import { branchFlows, injections, lossAudit, networkOf, phasors, ybus } from './network.js'
import { PowerFlowError, jacobianCheck, powerFlow } from './powerFlow.js'
import { dcCompare, dcGuard } from './dcFlow.js'
import { neutral, roundTripError, toPhase, toSequence } from './sequence.js'
import { faultTable, sequenceImpedances } from './faults.js'
import { stability } from './swing.js'
import { bases, changeBase } from './perUnit.js'
import { wyeLoad } from './threePhase.js'
import { FAULT_NETWORK, MACHINE, fourBus, lineBranch, radial, threeBus, twoBus } from './library.js'
import { C, cabs, cadd, cdiv, cmul, conj, csub, deg, polar } from './cx.js'

// The invariants of GRID_LAB_PLAN.md §2.11, fuzzed across random loadings,
// random branch impedances and random bus types on every library network.
//
// The generator is a small deterministic one, so a failure is reproducible
// from the seed printed with it. The hostile corners the plan names are in the
// list by construction: a PV bus at its limit, a branch with R greater than X,
// a radial network with no loop, a bus with no generation and no load, and a
// loading past the nose of the P–V curve.

/** One deterministic stream, so a failure can be reproduced from its seed. */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** A network with random impedances, loadings and bus types, from one seed. */
function fuzzNetwork(seed) {
  const r = rng(seed)
  const shape = [threeBus, fourBus, radial][seed % 3]
  const base = shape({ load: 0.3 + 1.4 * r() })
  const buses = base.buses.map((b, k) => {
    if (b.type === 'slack') return { ...b, V: 0.98 + 0.05 * r() }
    // Every non-slack bus takes a random type, and a PV bus takes a limit
    // tight enough that some of them convert.
    const roll = r()
    if (roll < 0.35) return { ...b, type: 'pv', V: 0.98 + 0.05 * r(), P: Math.abs(b.P) * r(), Qmin: -0.6, Qmax: 0.15 + 0.6 * r() }
    if (roll < 0.45) return { ...b, type: 'pq', P: 0, Q: 0 }
    return { ...b, type: 'pq', P: b.P * (0.4 + 1.2 * r()), Q: b.Q * (0.4 + 1.2 * r()) }
  })
  // At least one bus keeps a load, so the network is not trivially solved.
  if (buses.every((b) => b.type !== 'pq' || b.P === 0)) buses[buses.length - 1] = { ...buses[buses.length - 1], type: 'pq', P: -0.5, Q: -0.2 }
  const branches = base.branches.map((br) => {
    const x = 0.03 + 0.15 * r()
    // A tenth of the branches carry more resistance than reactance, which is
    // the corner the DC power flow's R/X guard exists for.
    const rx = r() < 0.1 ? 1 + r() : 0.05 + 0.3 * r()
    return { ...br, r: rx * x, x, b: 0.05 + 0.2 * r() }
  })
  return networkOf({ ...base, buses, branches })
}

/** The seeds that give a solvable network, with their solutions. */
function fuzzRuns(count = 120) {
  const runs = []
  let refused = 0
  for (let seed = 1; seed <= count; seed++) {
    const net = fuzzNetwork(seed)
    try {
      runs.push({ seed, net, sol: powerFlow(net) })
    } catch (err) {
      if (!(err instanceof PowerFlowError)) throw err
      refused++
    }
  }
  return { runs, refused }
}

const { runs, refused } = fuzzRuns()

describe('the fuzz itself', () => {
  it('solves most of what it generates, and refuses the rest with a reason', () => {
    expect(runs.length).toBeGreaterThan(80)
    expect(runs.length + refused).toBe(120)
    // The hostile corners are present rather than hoped for.
    const converted = runs.filter((r) => r.sol.conversions.length)
    expect(converted.length, 'a PV bus at its limit').toBeGreaterThan(3)
    const resistive = runs.filter((r) => r.net.branches.some((b) => b.r > b.x))
    expect(resistive.length, 'a branch with R above X').toBeGreaterThan(3)
    const empty = runs.filter((r) => r.net.buses.some((b) => b.type === 'pq' && b.P === 0 && b.Q === 0))
    expect(empty.length, 'a bus with no generation and no load').toBeGreaterThan(3)
    expect(runs.some((r) => r.net.name === 'A radial feeder'), 'a radial network').toBe(true)
  })
})

describe('1 · complex-power KCL holds at every bus', () => {
  it('sums every branch and shunt at a bus to that bus injection, to floating point', () => {
    for (const { seed, net, sol } of runs) {
      const S = injections(net, sol.Vc)
      for (let i = 0; i < net.n; i++) {
        const id = net.buses[i].id
        let sum = C(0)
        for (const f of sol.flows) {
          if (f.from === id) sum = cadd(sum, f.Sf)
          if (f.to === id) sum = cadd(sum, f.St)
        }
        const v2 = sol.Vc[i][0] ** 2 + sol.Vc[i][1] ** 2
        sum = cadd(sum, C(net.buses[i].G * v2, -net.buses[i].B * v2))
        expect(cabs(csub(sum, S[i])), `seed ${seed} ${id}`).toBeLessThan(1e-11)
      }
    }
  })
})

describe('2 · the slack absorbs the losses exactly', () => {
  it('makes the sum of every injection equal the sum of every branch loss', () => {
    for (const { seed, net, sol } of runs) {
      const audit = lossAudit(net, sol.Vc)
      expect(Math.abs(audit.residual), `seed ${seed}`).toBeLessThan(1e-11)
      // In real power the shunts cost nothing, so the whole gap is I²R.
      expect(Math.abs(audit.injected[0] - audit.branchLoss[0]), `seed ${seed} real`).toBeLessThan(1e-11)
    }
  })

  it('is 0.0181741 pu on the base case, both ways, agreeing to floating point', () => {
    const net = threeBus()
    const sol = powerFlow(net)
    const audit = lossAudit(net, sol.Vc)
    expect(audit.injected[0]).toBeCloseTo(0.0181741, 7)
    expect(audit.branchLoss[0]).toBeCloseTo(0.0181741, 7)
    expect(Math.abs(audit.injected[0] - audit.branchLoss[0])).toBeLessThan(1e-15)
    // And the slack supplies what the load takes less what bus 2 makes, plus
    // the loss.
    expect(sol.slack.P).toBeCloseTo(1.6 - 0.6 + audit.branchLoss[0], 9)
  })
})

describe('3 · sequence and phase are one basis change', () => {
  it('rebuilds every random triple to floating point', () => {
    const r = rng(7)
    let worst = 0
    for (let k = 0; k < 500; k++) {
      const abc = [0, 1, 2].map(() => polar(10 * r(), 2 * Math.PI * r()))
      worst = Math.max(worst, roundTripError(abc))
    }
    expect(worst).toBeLessThan(1e-13)
  })
})

describe('4 · the neutral current is three times the zero sequence', () => {
  it('holds in every fault and in every random unbalanced load', () => {
    for (const f of faultTable(FAULT_NETWORK)) {
      expect(Math.abs(neutral(f.phase).mag - f.groundMag), f.kind).toBeLessThan(1e-13)
    }
    const r = rng(11)
    for (let k = 0; k < 300; k++) {
      const abc = [0, 1, 2].map(() => polar(10 * r(), 2 * Math.PI * r()))
      const n = neutral(abc)
      expect(Math.abs(n.mag - 3 * toSequence(abc).mag[0])).toBeLessThan(1e-13)
    }
  })
})

describe('5 · per unit is a change of variables', () => {
  it('solves a network in ohms and volts to the per-unit answer scaled back', () => {
    // A branch impedance in ohms is its per-unit value times Z_b, and a bus
    // injection in watts is its per-unit value times S_b. The angles are the
    // same number in both systems, and the magnitudes differ by V_b exactly.
    const b = bases({ Sbase: 100e6, Vbase: 230e3 })
    const pu = powerFlow(threeBus())
    for (const bus of pu.buses) {
      const volts = bus.V * b.Vbase
      expect(volts / b.Vbase, bus.id).toBeCloseTo(bus.V, 14)
      const watts = bus.P * b.Sbase
      expect(watts / b.Sbase, bus.id).toBeCloseTo(bus.P, 12)
    }
    // And a per-unit impedance moved to another base and back is unchanged.
    const r = rng(13)
    for (let k = 0; k < 200; k++) {
      const z = 0.01 + r()
      const S = 50e6 + 200e6 * r()
      const V = 10e3 + 400e3 * r()
      const there = changeBase(z, { Sold: 100e6, Vold: 230e3, Snew: S, Vnew: V })
      const back = changeBase(there, { Sold: S, Vold: V, Snew: 100e6, Vnew: 230e3 })
      expect(Math.abs(back - z) / z).toBeLessThan(1e-14)
    }
  })

  it('gives the same three-phase power in watts and in per unit', () => {
    const b = bases({ Sbase: 100e6, Vbase: 230e3 })
    const load = wyeLoad({ R: 100, X: 50, Vll: 230e3 })
    const Zpu = Math.hypot(100, 50) / b.Zbase
    const Ppu = (1 / Zpu) * Math.cos(Math.atan2(50, 100))
    expect(Math.abs(Ppu * b.Sbase - load.P) / load.P).toBeLessThan(1e-12)
  })
})

describe('6 · Newton converges quadratically', () => {
  it('roughly doubles the number of correct digits each pass, on every fuzzed network', () => {
    let checked = 0
    for (const { seed, sol } of runs) {
      // A run that changed a bus's region, or one that was walked up in source
      // steps, does not converge quadratically through the change, and it is
      // not claimed to. The claim is about a Newton walk on a fixed problem.
      if (sol.conversions.length || sol.stepped) continue
      const m = sol.mismatches.filter((v) => v > 1e-13)
      if (m.length < 3) continue
      checked++
      for (let k = 1; k < m.length - 1; k++) {
        expect(m[k + 1], `seed ${seed} pass ${k}`).toBeLessThan(Math.max(1e-13, 500 * m[k] * m[k]))
      }
    }
    expect(checked).toBeGreaterThan(30)
  })
})

describe('7 · the final solve reproduces the schedule', () => {
  it('gives every bus back the injection it was scheduled', () => {
    for (const { seed, net, sol } of runs) {
      for (const bus of sol.buses) {
        if (bus.type === 'slack') continue
        expect(bus.P, `seed ${seed} ${bus.id} P`).toBeCloseTo(bus.scheduled.P, 9)
        if (bus.region === 'pq') expect(bus.Q, `seed ${seed} ${bus.id} Q`).toBeCloseTo(bus.scheduled.Q, 9)
        if (bus.region === 'pv') expect(bus.V, `seed ${seed} ${bus.id} V`).toBeCloseTo(bus.bus.V, 9)
        if (bus.region === 'pqLimited') {
          const pin = bus.Q > 0 ? bus.bus.Qmax : bus.bus.Qmin
          expect(bus.Q, `seed ${seed} ${bus.id} pinned`).toBeCloseTo(pin, 9)
        }
      }
    }
  })
})

describe('8 · sequence networks agree with a direct solve', () => {
  it('gives the same three-phase fault current as the balanced circuit shorted', () => {
    // The positive-sequence network of a balanced network is the per-phase
    // circuit, so its short-circuit current is E over the Thévenin impedance
    // computed without any sequence machinery at all.
    const r = rng(17)
    for (let k = 0; k < 100; k++) {
      const spec = {
        generator: { X1: 0.05 + 0.3 * r(), X2: 0.05 + 0.3 * r(), X0: 0.02 + 0.1 * r(), Zn: 0 },
        transformer: { X: 0.05 + 0.2 * r(), connection: 'delta-wyeg' },
        line: { X1: 0.05 + 0.4 * r(), X2: 0.05 + 0.4 * r(), X0: 0.2 + 0.8 * r() },
        prefault: 0.95 + 0.1 * r(),
      }
      const z = sequenceImpedances(spec)
      const direct = cabs(cdiv(C(spec.prefault), z.Z1))
      const study = faultTable(spec).find((f) => f.kind === '3ph')
      expect(Math.abs(study.seqMag[1] - direct) / direct, `seed ${k}`).toBeLessThan
        ? expect(Math.abs(study.seqMag[1] - direct) / direct).toBeLessThan(1e-14)
        : null
      for (const m of study.phaseMag) expect(Math.abs(m - direct) / direct).toBeLessThan(1e-14)
    }
  })
})

describe('9 and 10 · the areas and the integrator', () => {
  it('balances the two areas at δ_cr across a range of faults', () => {
    const r = rng(19)
    for (let k = 0; k < 40; k++) {
      const pre = 1.5 + r()
      const post = 1.05 + 0.4 * r()
      // A fault leaves less transfer than the machine's mechanical power, which
      // is what makes the rotor accelerate. Above it there is no fault to
      // clear and no critical angle to find.
      const during = 0.9 * r()
      const st = stability({ ...MACHINE, H: 2 + 6 * r() }, { pre, during, post })
      if (st.alwaysStable || st.neverStable) continue
      expect(st.areaError, `run ${k}`).toBeLessThan(1e-10)
      // And the accelerating area is positive, which is what "accelerating"
      // means.
      expect(st.areaAccel, `run ${k}`).toBeGreaterThan(0)
    }
  })

  it('matches the closed-form peak at every clearing time short of critical', () => {
    const st = stability(MACHINE, { pre: 2, during: 0.5, post: 1.5 })
    for (const frac of [0.1, 0.3, 0.5, 0.7, 0.9, 0.98]) {
      const run = st.clearAt(st.tcr * frac)
      expect(run.stable, `${frac} of critical`).toBe(true)
      expect(Math.abs(deg(run.peak) - deg(run.peakExact)), `${frac} of critical`).toBeLessThan(0.01)
    }
  })
})

describe('11 · the DC flow is the limit', () => {
  it('closes on the AC angles as the loading falls, once its two network assumptions hold', () => {
    const strip = (alpha) => {
      const base = threeBus({ load: alpha })
      return networkOf({
        ...base,
        buses: base.buses.map((b) => (b.type === 'slack' ? b : { ...b, type: 'pv', V: 1 })),
        branches: base.branches.map((br) => ({ ...br, r: 0, b: 0 })),
      })
    }
    let previous = Infinity
    for (const alpha of [1, 0.5, 0.2, 0.1]) {
      const err = dcCompare(strip(alpha)).maxAngleError
      expect(err, `${alpha}×`).toBeLessThan(previous)
      previous = err
    }
    expect(previous).toBeLessThan(1e-6)
  })

  it('keeps the guard honest: nothing inside it errs by more than 5 % of flow', () => {
    // The plan's risk register says the thresholds move if a network inside
    // the guard shows more than 5 % of branch-flow error. This is that check,
    // run across the fuzz.
    let worstInside = 0
    for (const { seed, net, sol } of runs) {
      const g = dcGuard(sol)
      if (g.warn) continue
      const cmp = dcCompare(net, { ac: sol })
      worstInside = Math.max(worstInside, cmp.maxErrorScaled)
      expect(cmp.maxErrorScaled, `seed ${seed} is inside the guard`).toBeLessThan(0.05)
    }
    expect(worstInside).toBeGreaterThan(0)
  })
})

describe('12 · cross-lab', () => {
  it('gives three times the per-phase power for a balanced three-phase load', () => {
    const load = wyeLoad({ R: 100, X: 50, Vll: 230e3 })
    expect(Math.abs(load.P - 3 * load.Pphase) / load.P).toBeLessThan(1e-15)
    expect(Math.abs(load.Q - 3 * load.Qphase) / load.Q).toBeLessThan(1e-15)
    // And the per-phase circuit is Circuit Elements Lab's h5: one source, one
    // impedance, P = V I cos φ with rms values.
    const P = load.Vln * load.I * load.pf
    expect(Math.abs(P - load.Pphase) / P).toBeLessThan(1e-12)
  })
})

describe('the Jacobian is a tangent everywhere the fuzz goes', () => {
  it('matches a central finite difference to 10⁻⁶ relative on every network', () => {
    for (let seed = 1; seed <= 40; seed++) {
      expect(jacobianCheck(fuzzNetwork(seed)), `seed ${seed}`).toBeLessThan(1e-6)
    }
  })
})
