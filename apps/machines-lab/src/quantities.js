// The quantity paths a lesson step may name.
//
// A `reads` pair is a path and the value the sentence quotes, and
// experiments.test.js resolves the path against the analysis and compares. A
// path this file cannot resolve fails the test, so a lesson cannot quote a
// number nothing computes.
//
// Elements' own paths (v, volt, i, p) resolve against `x.sol` when the
// experiment has one. Everything below is this lab's.

import { radToRpm } from '@ee-labs/machines'

const RAD_TO_RPM = radToRpm

/** Read one quantity of an analysis by path. Throws when the path is unknown. */
export function readQuantity(x, path) {
  const [head, ...rest] = path.split('.')
  const key = rest[0]
  switch (head) {
    // Elements' own element and node paths, when the experiment has a solve.
    case 'v':
    case 'volt':
    case 'i':
    case 'p':
      if (!x.sol) throw new Error(`${path}: this experiment has no time-domain solve`)
      return x.sol[head][key]

    // The shaft and the armature, now.
    case 'mech':
      if (key === 'omega') return x.sol ? x.sol.v.wm : x.op.omega
      if (key === 'rpm') return RAD_TO_RPM(x.sol ? x.sol.v.wm : x.op.omega)
      if (key === 'ia') return x.sol ? x.sol.i.Ra : x.op.ia
      if (key === 'torque') return x.spec.k * (x.sol ? x.sol.i.Ra : x.op.ia)
      if (key === 'emf') return x.sol ? x.sol.volt.Eb : x.op.emf
      if (key === 'ra') return x.spec.Ra * (x.sol ? x.sol.i.Ra : x.op.ia)
      if (key === 'peak') return x.peak
      if (key === 'peakAt') return x.peakAt
      if (key === 'stored') return 0.5 * x.spec.J * (x.sol ? x.sol.v.wm : x.op.omega) ** 2
      break

    case 'line':
      if (key === 'stall') return x.line.stall
      if (key === 'noLoad') return x.line.noLoad
      if (key === 'noLoadRpm') return RAD_TO_RPM(x.line.noLoad)
      if (key === 'slope') return x.line.slope
      if (key === 'free') return x.spec.Va / x.spec.Ra
      break

    case 'op':
      if (key === 'rpm') return RAD_TO_RPM(x.op.omega)
      if (key in x.op) return x.op[key]
      break

    case 'tau':
      if (key === 'e') return x.tc.tauE
      if (key === 'm') return x.tc.tauM
      if (key === 'separated') return x.tc.separated
      break

    case 'root':
      return x.tc.roots[Number(key)].re

    case 'A':
      return x.dyn.A[Number(key)][Number(rest[1])]

    case 'audit':
      return x.audit[key]

    case 'control': {
      // control.<armature|field>.<index>.<field>
      const row = x.control[key][Number(rest[1])]
      const what = rest[2]
      if (what === 'rpm') return RAD_TO_RPM(row.point.omega)
      if (what === 'noLoadRpm') return RAD_TO_RPM(row.noLoad)
      if (what === 'ia') return row.point.ia
      if (what === 'stall') return row.stall
      if (what === 'slope') return row.slope
      break
    }

    // The transformer.
    case 'xf':
      if (key in x) return x[key]
      if (key === 'Req') return x.reflected.Req
      if (key === 'Xeq') return x.reflected.Xeq
      if (key === 'reflectedZL') return x.reflected.reflectedZL[0]
      if (key === 'Zoc') return Math.hypot(...x.openShort.Zoc)
      if (key === 'Zsc') return Math.hypot(...x.openShort.Zsc)
      if (key === 'Poc') return x.openShort.Poc
      if (key === 'Ioc') return x.openShort.Ioc
      break

    // The induction machine.
    case 'im':
      if (key === 'rpm') return RAD_TO_RPM((1 - x.slip) * x.machine.omegaSync)
      if (key === 'rpmSync') return x.machine.rpmSync
      if (key === 'omegaSync') return x.machine.omegaSync
      if (key === 'rotorHz') return x.slip * x.machine.f
      if (key === 'sMax') return x.bd.sMax
      if (key === 'tMax') return x.bd.tMax
      if (key === 'rpmMax') return RAD_TO_RPM(x.bd.speedAt)
      if (key === 'Vth') return x.th.Vmag
      if (key === 'Rth') return x.th.Rth
      if (key === 'Xth') return x.th.Xth
      if (key === 'settled') return x.runUp.omega[x.runUp.omega.length - 1]
      if (key === 'error') return x.runUp.relative
      if (key in x) return x[key]
      if (key in x.op) return x.op[key]
      break

    case 'field':
      if (key === 'amplitude') return x.field.amplitude
      if (key === 'rpmSync') return x.field.rpmSync
      if (key === 'omegaSync') return x.field.omegaSync
      if (key === 'peak') return Math.max(...x.total)
      break

    // The synchronous machine.
    case 'sync':
      if (key === 'delta') return (x.delta * 180) / Math.PI
      if (key === 'P') return x.power.P
      if (key === 'field') return x.power.field
      if (key === 'reluctance') return x.power.reluctance
      if (key === 'torque') return x.power.torque
      if (key === 'I') return x.phasor.Imag
      if (key === 'Q') return x.phasor.Q
      if (key === 'pf') return x.phasor.pf
      if (key === 'pullOut') return x.pullOut.P
      if (key === 'pullOutDeg') return (x.pullOut.delta * 180) / Math.PI
      if (key === 'margin') return x.pullOut.P / x.power.P
      if (key === 'rpmSync') return x.machine.rpmSync
      break

    case 'vcurve': {
      const row = x.vCurve[Number(key)]
      return rest[1] === 'I' ? row.Imag : rest[1] === 'Q' ? row.Q : row[rest[1]]
    }

    // The dq transform.
    case 'dq':
      if (key === 'd') return x.dq[0]
      if (key === 'q') return x.dq[1]
      if (key === 'zero') return x.dq[2]
      if (key === 'radius') return x.radius
      if (key === 'otherRadius') return Math.hypot(x.other[0], x.other[1])
      if (key === 'pAbc') return x.power.pAbc
      if (key === 'pDq') return x.power.pDq
      break

    // The permanent-magnet machine.
    case 'pmsm':
      if (key === 'kT') return x.foc.kT
      if (key === 'tauElec') return x.foc.tauElec
      if (key === 'tauMech') return x.foc.tauMech
      if (key === 'separation') return x.foc.tauMech / x.foc.tauElec
      if (key === 'torque') return x.torque.torque
      if (key === 'A') return x.state.A[Number(rest[1])][Number(rest[2])]
      if (key === 'c') return x.state.c[Number(rest[1])]
      if (key === 'gainI') return x.foc.current.b[0] / x.foc.current.a[1]
      if (key === 'gainW') return x.foc.speed.b[0] / x.foc.speed.a[1]
      break

    // Losses and heat.
    case 'loss':
      if (key === 'bestX') return x.best.x
      if (key === 'bestEff') return x.best.efficiency
      if (key === 'total') return x.split.loss
      if (key in x.split) return x.split[key]
      break

    case 'heat':
      if (key === 'overload') return x.overload
      if (key === 'tauMin') return x.heat.tau / 60
      if (key === 'riseNow') return x.sol ? x.sol.v.hot : x.heat.rise
      if (key === 'timeTo100') return x.heat.timeTo(100) / 60
      if (key in x.heat) return x.heat[key]
      break

    case 'sat':
      if (key === 'lambda') return x.sat.lambda
      if (key === 'L') return x.sat.L
      if (key === 'iKnee') return x.iKnee
      if (key === 'linear') return x.spec.L0 * x.i
      break

    default:
      break
  }
  throw new Error(`unknown quantity path "${path}"`)
}
