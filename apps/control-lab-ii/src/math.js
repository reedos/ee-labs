import { PLANTS, CONTROLLERS } from './systems.js'

// The math panel for whatever is on screen.
//
// The two rules `packages/explain` enforces, restated so they are followed here
// rather than looked up. A two-column comparison appears only where the
// measured side is genuinely read from something the tool is showing, because
// marking 1 = 1 correct teaches a reader to trust a tick carrying no
// information. And a claim these settings cannot show is footnoted with the
// reason rather than crossed out, because the formula has not stopped being
// true.
//
// This lab's own addition: every block that prints an approximation prints its
// guard in the same block.

const T = (text) => ({ kind: 'text', text })
const F = (tex, caption) => ({ kind: 'formula', tex, caption })
const C = (rows) => ({ kind: 'check', rows })
const V = (rows) => ({ kind: 'values', rows })

/** The blocks the math panel renders, for one analysis. */
export function experimentMath(a) {
  const plant = PLANTS[a.state.plantId]
  const ctrl = CONTROLLERS[a.state.ctrlId]
  const blocks = [F(plant.tex, plant.name), F(ctrl.tex, ctrl.name)]

  if (a.state_) return [...blocks, ...stateMath(a)]
  if (a.sampled) return [...blocks, ...sampledMath(a)]
  if (a.nonlinear) return [...blocks, ...nonlinearMath(a)]
  if (a.fit) return [...blocks, ...fitMath(a)]
  if (a.filter) return [...blocks, ...filterMath(a)]
  return blocks
}

function stateMath(a) {
  const s = a.state_
  const out = [
    F('\\dot{x} = Ax + Bu, \\quad y = Cx + Du', 'The state equation'),
    F('\\det(sI - A) = 0', 'Its poles are the roots of this'),
  ]
  // Measured: the denominator the conversion produced. Theory: the
  // characteristic polynomial of A. Two different paths through the same
  // matrices, so a dropped term separates them.
  out.push(
    C(
      s.fromSs.a.map((v, i) => ({
        name: `denominator coefficient ${i}`,
        theory: v / s.fromSs.a[0],
        measured: s.fromSs.a[i] / s.fromSs.a[0],
      })),
    ),
  )
  if (s.place) {
    out.push(F('u = -Kx, \\quad A_{cl} = A - BK', "Ackermann's placement"))
    out.push(
      V([
        { name: 'K', value: `[${s.place.K.map((v) => v.toPrecision(6)).join(', ')}]` },
        { name: 'condition of the controllability matrix', value: s.ctrl.condition.toPrecision(5) },
      ]),
    )
  }
  if (s.lqr) {
    out.push(F('A^\\mathsf{T}P + PA - PBR^{-1}B^\\mathsf{T}P + Q = 0', 'The Riccati equation'))
    out.push(F('K = R^{-1}B^\\mathsf{T}P', 'and the gain it gives'))
    out.push(
      V([
        { name: 'K', value: `[${s.lqr.K.map((v) => v.toPrecision(6)).join(', ')}]` },
        // The residual is in the same block as the gain, always.
        { name: 'relative Riccati residual', value: s.lqr.relResidual.toExponential(2) },
      ]),
    )
  }
  if (s.observer) {
    out.push(F("\\dot{e} = (A - LC)e", 'The observer error'))
    out.push(V([{ name: 'L', value: `[${s.observer.L.map((v) => v.toPrecision(6)).join(', ')}]` }]))
  }
  if (s.declined) out.push(T(s.declined.message))
  return out
}

function sampledMath(a) {
  const s = a.sampled
  const out = [
    F('\\Phi = e^{AT}, \\quad \\Gamma = \\int_0^T e^{A\\tau}B\\,d\\tau', 'The hold, exactly'),
    F('z = e^{sT}', 'and the map it puts on the poles'),
    V([
      { name: 'sample time', value: `${s.Ts.toPrecision(5)} s` },
      { name: 'pole in z', value: s.alpha.toPrecision(7) },
    ]),
  ]
  out.push(
    T(
      'The hold itself has no transfer function in s. (1 − e^(−sT))/s has no finite poles or ' +
        'zeros, so it is not a rational function and this suite declines to carry it as one. Its ' +
        'magnitude and phase at a frequency are exact numbers and are printed as such.',
    ),
  )
  out.push(F('\\angle H_{zoh}(j\\omega) = -\\tfrac{\\omega T}{2}', 'The phase the hold costs'))
  out.push(
    C([
      {
        name: 'lag at crossover, in degrees',
        theory: ((2 * Math.PI * a.margins.gainCrossover * s.Ts) / 2) * (180 / Math.PI),
        measured: s.holdLagDeg,
      },
    ]),
  )
  // The approximation, with its guard in the same block.
  out.push(F(`s \\to \\text{${s.method}}`, 'The emulation rule, an approximation'))
  out.push(
    V([
      { name: 'labelled approximate', value: String(s.controllerZ.approximate) },
      { name: 'samples a cycle at crossover', value: s.guard.samplesPerCycle?.toPrecision(4) ?? 'no crossover' },
      { name: 'threshold', value: `${s.guard.threshold}` },
      { name: 'guard holds', value: String(s.guard.holds) },
    ]),
  )
  if (!s.guard.holds && s.guard.reason) out.push(T(s.guard.reason))
  return out
}

function nonlinearMath(a) {
  const n = a.nonlinear
  const out = [
    F('u = \\mathrm{sat}_\\delta(C_c x_c + D_c e)', 'The drive, and where it stops growing'),
    T(
      'Inside each of the three segments the loop is linear, so the trajectory has a closed form ' +
        'and the only thing left to compute is when the state leaves. There is no step size here ' +
        'and no error that shrinks when the pane asks for more points.',
    ),
  ]
  if (n.lines) {
    out.push(
      V(
        n.lines.map((l, i) => ({
          name: `switching line ${i + 1}`,
          value: `${l.a.toPrecision(4)}·x₁ + ${l.b.toPrecision(4)}·x₂ = ${l.c.toPrecision(4)}`,
        })),
      ),
    )
  }
  if (n.lyapunov) {
    out.push(F('A^\\mathsf{T}P + PA = -I, \\quad V = x^\\mathsf{T}Px', 'The Lyapunov argument, in the linear region'))
    out.push(
      V([
        { name: 'P', value: `[[${n.lyapunov.P[0].map((v) => v.toPrecision(5)).join(', ')}], [${n.lyapunov.P[1].map((v) => v.toPrecision(5)).join(', ')}]]` },
        { name: 'eigenvalues', value: n.lyapunov.eigenvalues.map((e) => e[0].toPrecision(5)).join(', ') },
      ]),
    )
  }
  if (n.predicted) {
    out.push(F('N(A) = \\tfrac{2}{\\pi}\\left(\\arcsin r + r\\sqrt{1 - r^2}\\right), \\; r = \\delta/A', 'The describing function'))
    out.push(F('N(A)\\,L(j\\omega) = -1', 'and the condition it solves'))
    // The whole of this lab's extra rule, in one block. The prediction, the
    // exact simulation, the difference and the guard, together.
    const rows = [
      { name: 'predicted amplitude', value: n.predicted.amplitude?.toPrecision(6) ?? 'none' },
      { name: 'predicted frequency', value: n.predicted.omega ? `${n.predicted.omega.toPrecision(6)} rad/s` : 'none' },
    ]
    if (n.measured) {
      rows.push({ name: 'measured amplitude', value: n.measured.amplitude.toPrecision(6) })
      rows.push({ name: 'measured frequency', value: `${n.measured.omega.toPrecision(6)} rad/s` })
      rows.push({ name: 'the prediction is off by', value: `${(100 * n.error.amplitude).toPrecision(3)} %` })
    }
    rows.push({ name: 'third harmonic returning', value: `${(100 * n.predicted.harmonicRatio).toPrecision(3)} %` })
    rows.push({ name: 'threshold', value: `${(100 * n.predicted.threshold).toPrecision(3)} %` })
    rows.push({ name: 'the filter hypothesis holds', value: String(n.predicted.holds) })
    out.push(V(rows))
    if (!n.predicted.holds && n.predicted.reason) out.push(T(n.predicted.reason))
  }
  return out
}

function fitMath(a) {
  const f = a.fit
  return [
    F('y(t) = K\\left(1 - e^{-t/\\tau}\\right)', 'The first-order shape'),
    F('r = \\sqrt{\\tfrac{1}{N}\\sum (y_i - \\hat{y}_i)^2}', 'and the residual it leaves'),
    V([
      { name: 'K', value: f.first.K.toPrecision(7) },
      { name: 'τ', value: `${f.first.tau.toPrecision(7)} s` },
      // Never printed without this row.
      { name: 'relative residual', value: `${(100 * f.first.relResidual).toPrecision(4)} %` },
      { name: 'second order, relative residual', value: `${(100 * f.second.relResidual).toPrecision(4)} %` },
      { name: 'improvement', value: f.improvement.toPrecision(6) },
    ]),
    T(
      'The fit is a rational model and is admitted as one. The claim that it IS the plant is not ' +
        'admitted, and the residual is what stands in place of that claim.',
    ),
  ]
}

function filterMath(a) {
  const f = a.filter
  return [
    F('L = PC^\\mathsf{T}R^{-1}', 'The filter gain'),
    F('(A^\\mathsf{T}, C^\\mathsf{T}, Q, R)', 'is the regulator on the transposed system'),
    V([
      { name: 'L', value: `[${f.L.map((v) => v.toPrecision(6)).join(', ')}]` },
      { name: 'trust in the model over the measurement', value: f.ratio.toPrecision(5) },
      { name: 'relative Riccati residual', value: f.relResidual.toExponential(2) },
    ]),
  ]
}
