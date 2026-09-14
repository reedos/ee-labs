import { expm, matVecMul, complex as cx } from '@ee-labs/network'
import { n, par, vec, mat, sum, dot, linear, products, qty, rect, statePhasor } from './derivationMath.js'

/** Build the full derivation for the source interval containing the cursor. */
export function workedState(x) {
  const seg = x.tr.segments.find((s) => x.cursor >= s.t0 && x.cursor < s.t1) || x.tr.segments.at(-1)
  const dyn = seg.dyn || x.dyn
  const { A, B, states, inputs } = dyn
  const count = states.length
  const c = dyn.c || Array(count).fill(0)
  const sx = states.map((s) => `${s.type === 'C' ? 'v' : 'i'}_{${s.id}}`)
  const su = inputs.map((id) => `${dyn.norm.elements.find((e) => e.id === id).type === 'I' ? 'I' : 'V'}_{${id.replace(/^[VI]/, '')}}`)
  const units = states.map((s) => s.type === 'C' ? 'V' : 'A')
  const x0 = x.tr.x0
  const start = seg.z0.slice(0, count)
  const dt = x.cursor - seg.t0
  const u = x.now.u
  const slopes = A.map((row, i) => dot(row, x.now.x) + dot(B[i], u) + c[i])
  const steps = [{ title: 'Name the states, inputs and initial values',
    text: 'Each capacitor contributes its voltage as a state; each inductor contributes its current. Lowercase x(t) is this column of stored quantities, while u(t) lists the independent source values. A dot means a time derivative. The initial state supplies the starting point, not the slope.',
    latex: [
      `x(t) &= ${vec(sx.map((s) => `${s}(t)`))},\\qquad u(t) = ${inputs.length ? vec(su.map((s) => `${s}(t)`)) : '0'}`,
      `x(0^+) &= x(0^-) = ${vec(x0.map((v, i) => qty(v, units[i])))}`,
      `t &= ${qty(x.cursor, 's')},\\qquad x(t) = ${vec(x.now.x.map((v, i) => qty(v, units[i])))}`,
      `t_0 &= ${qty(seg.t0, 's')},\\qquad \\Delta=t-t_0=${qty(dt, 's')}`,
    ], note: 'The superscripts 0⁻ and 0⁺ mean immediately before and after switching. Capacitor voltage and inductor current remain continuous. t₀ begins the current source interval; Δ is time elapsed since t₀.' }]

  states.forEach((s, i) => {
    const isC = s.type === 'C'
    const effort = `${isC ? 'i' : 'v'}_{${s.id}}`
    const storage = `${s.type}_{${s.id.slice(1)}}`
    const a = A[i].map((v) => v * s.value), b = B[i].map((v) => v * s.value)
    steps.push({ title: `Build the differential equation for ${s.id}`,
      text: `${isC ? 'A capacitor obeys i = C·dv/dt' : 'An inductor obeys v = L·di/dt'}. Hold each state at its present value and solve the remaining circuit using KCL and KVL. That gives the ${isC ? 'capacitor current' : 'inductor voltage'} as a linear combination of the states and sources. Divide by ${isC ? 'capacitance' : 'inductance'} to obtain the slope.`,
      latex: [
        `${effort} &= ${storage}\\,\\dot{${sx[i]}}`,
        `${storage} &= ${qty(s.value, isC ? 'F' : 'H')}`,
        `${effort} &= ${linear(a, sx)} + ${linear(b, su)}${c[i] ? ` + ${n(c[i] * s.value)}` : ''}`,
        `\\dot{${sx[i]}} &= \\frac{${effort}}{${storage}} = ${linear(A[i], sx)} + ${linear(B[i], su)}${c[i] ? ` + ${n(c[i])}` : ''}`,
      ], note: 'The state coefficients form one row of A; the source coefficients form the corresponding row of B. Their units convert each voltage or current into this state’s rate of change.' })
  })
  steps.push({ title: 'Collect the rows into the state equation',
    text: 'Multiply every row of A by the state column, every row of B by the source column, and add. This is the same set of differential equations, written compactly. It does not mean that each state changes independently.',
    latex: [
      `\\dot{x} &= A x+B u${c.some(Boolean) ? '+c' : ''}`,
      `${vec(sx.map((s) => `\\dot{${s}}`))} &= ${mat(A)}${vec(sx)}${inputs.length ? `+${mat(B)}${vec(su)}` : ''}${c.some(Boolean) ? `+${vec(c.map(n))}` : ''}`,
    ] })
  states.forEach((s, i) => {
    const law = s.type === 'C' ? x.now.sol.i[s.id] / s.value : x.now.sol.volt[s.id] / s.value
    const effort = s.type === 'C' ? x.now.sol.i[s.id] : x.now.sol.volt[s.id]
    steps.push({ title: `Substitute the cursor values into row ${i + 1}`,
      text: `Use the present states and source values to evaluate each product. Their sum is the slope of ${sx[i].replace(/[{}]/g, '')} at this instant. Check it a second way using the element's measured ${s.type === 'C' ? 'current' : 'voltage'}.`,
      latex: [
        `\\dot{${sx[i]}}(t) &= ${products(A[i], x.now.x)} + ${products(B[i], u)}${c[i] ? ` + ${n(c[i])}` : ''}`,
        `&= ${sum([...A[i].map((a, j) => n(a * x.now.x[j])), ...B[i].map((b, j) => n(b * u[j])), ...(c[i] ? [n(c[i])] : [])])}`,
        `&= ${qty(slopes[i], `${units[i]}/s`)}`,
        `\\frac{${s.type === 'C' ? 'i' : 'v'}_{${s.id}}}{${s.type}_{${s.id.slice(1)}}} &= \\frac{${n(effort)}}{${n(s.value)}} = ${qty(law, `${units[i]}/s`)}`,
      ], note: slopes[i] > 0 ? 'A positive slope means this state is increasing at the cursor.' : slopes[i] < 0 ? 'A negative slope means this state is decreasing at the cursor.' : 'A zero slope means this state is momentarily flat; it need not stay constant.' })
  })

  const phi = expm(A.map((row) => row.map((v) => v * dt)))
  if (count === 1) {
    const a = A[0][0]
    steps.push({ title: 'Read the natural response and time constant',
      text: 'With the independent input set to zero, try a response proportional to e^(s·t). Its derivative is s times itself, so the single coefficient of A is the natural growth or decay rate.',
      latex: [
        `s &= A_{11} = ${qty(a, 's^{-1}')}`,
        ...(a < 0 ? [`\\tau &= -\\frac{1}{A_{11}} = -\\frac{1}{${par(a)}} = ${qty(-1 / a, 's')}`] : []),
        `\\Phi(\\Delta) &= e^{A_{11}\\Delta} = e^{${par(a)}${par(dt)}} = ${n(phi[0][0])}`,
      ], note: a < 0 ? 'After one time constant, a natural-response difference has fallen to e⁻¹, about 37%, of its starting value.' : a === 0 ? 'Here A₁₁ is zero: this is an integrator. There is no finite decay time constant, and a constant input produces a ramp.' : 'A positive root means growth, not decay; a decay time constant would not describe this circuit.' })
  } else {
    const trace = A[0][0] + A[1][1], det = A[0][0] * A[1][1] - A[0][1] * A[1][0]
    const m = trace / 2, q = m * m - det
    const critical = Math.abs(q) <= 1e-9 * Math.max(Math.abs(det), m * m)
    const D = A.map((row, i) => row.map((v, j) => v - (i === j ? m : 0)))
    const mode = critical ? 'repeated' : q < 0 ? 'oscillating' : 'two real'
    steps.push({ title: 'Derive the roots from the two coupled equations',
      text: 'A natural response x = k·e^(s·t) obeys (sI − A)k = 0. A nonzero k exists when the determinant is zero. I here is the identity matrix, not a current. Expanding this 2 × 2 determinant gives a quadratic.',
      latex: [
        `0 &= (s-A_{11})(s-A_{22})-A_{12}A_{21}`,
        `&= (s-${par(A[0][0])})(s-${par(A[1][1])})-${par(A[0][1])}${par(A[1][0])}`,
        `&= s^2-${par(trace)}s+${par(det)}`,
        `s_{1,2} &= \\frac{${n(trace)}\\pm\\sqrt{${par(trace)}^2-4${par(det)}}}{2}`,
        `&= ${n(m)}\\pm ${q < 0 && !critical ? 'j' : ''}${n(critical ? 0 : Math.sqrt(Math.abs(q)))}`,
      ], note: `These are ${mode} roots. Negative real parts make the natural response decay; imaginary parts give its angular ringing frequency in radians per second.` })
    if (det > 0) steps.push({ title: 'Calculate the damping quantities from the roots',
      text: 'Write the characteristic polynomial as s² + 2αs + ω₀². Matching coefficients gives the decay rate α and undamped natural frequency ω₀. Their ratio is the dimensionless damping ratio ζ; Q is the quality factor. The ringing frequency ω_d exists when the roots have imaginary parts.',
      latex: [
        `\\alpha &= -\\tfrac12\\operatorname{tr}A=-\\tfrac12${par(trace)}=${qty(-m, 's^{-1}')}`,
        `\\omega_0 &= \\sqrt{\\det A}=\\sqrt{${n(det)}}=${qty(Math.sqrt(det), 'rad/s')}`,
        `\\zeta &= \\frac{\\alpha}{\\omega_0}=\\frac{${n(-m)}}{${n(Math.sqrt(det))}}=${n(-m / Math.sqrt(det))}`,
        ...(m < 0 ? [`Q &= \\frac{\\omega_0}{2\\alpha}=\\frac{${n(Math.sqrt(det))}}{2${par(-m)}}=${n(Math.sqrt(det) / (-2 * m))}`] : m === 0 ? [`Q &= \\infty\\qquad\\text{(no damping)}`] : []),
        ...(q < 0 && !critical ? [`\\omega_d &= \\sqrt{\\omega_0^2-\\alpha^2}=${qty(Math.sqrt(-q), 'rad/s')}`] : []),
      ], note: q < 0 && !critical ? 'A complex root pair produces oscillation. Its real part sets the envelope, while its imaginary part sets how fast the circuit rings.' : 'Real roots give no sinusoidal ringing term. A repeated root is the boundary between the two damping behaviors.' })
    steps.push({ title: 'Turn those roots into the time-response matrix',
      text: 'Φ(Δ) advances a natural response by Δ seconds. For two states it can be written using the roots rather than an unexplained matrix exponential. Set m to half the trace and D = A − mI; the sign of m² − det(A) chooses the form.',
      latex: [
        `m &= ${n(m)},\\qquad D = ${mat(D)},\\qquad \\Delta = ${qty(dt, 's')}`,
        ...(critical ? [`\\Phi(\\Delta) &= e^{m\\Delta}(I+\\Delta D)`]
          : q < 0 ? [`\\omega_d &= \\sqrt{\\det A-m^2} = ${qty(Math.sqrt(-q), 'rad/s')}`, `\\Phi(\\Delta) &= e^{m\\Delta}\\left[I\\cos(\\omega_d\\Delta)+\\frac{D}{\\omega_d}\\sin(\\omega_d\\Delta)\\right]`]
            : [`\\beta &= \\sqrt{m^2-\\det A} = ${qty(Math.sqrt(q), 's^{-1}')}`, `\\Phi(\\Delta) &= e^{m\\Delta}\\left[I\\cosh(\\beta\\Delta)+\\frac{D}{\\beta}\\sinh(\\beta\\Delta)\\right]`]),
        `\\Phi(${n(dt)}) &= ${mat(phi)}`,
      ], note: 'Each row of Φ combines both starting states. A capacitor voltage can therefore change because of the inductor’s initial current, and conversely.' })
  }

  steps.push({ title: 'Choose the starting point for this source interval',
    text: 'A square wave or triangle wave changes its formula at a corner. Work from the beginning t₀ of the interval containing the cursor, carrying the continuous state from the preceding interval. For an unbroken step or sine, t₀ is zero. Δ = t − t₀ is the elapsed time within this interval.',
    latex: [
      `t_0 &= ${qty(seg.t0, 's')},\\qquad \\Delta = ${n(x.cursor)}-${par(seg.t0)} = ${qty(dt, 's')}`,
      `x(t_0) &= ${vec(start.map((v, i) => qty(v, units[i])))}`,
      ...seg.pieces.map((p, j) => `${su[j]}(t_0+\\xi) &= ${n(p.u0)}+${par(p.slope)}\\xi${p.sines.map((s) => `+${par(s.a)}\\cos(${n(s.omega)}(t_0+\\xi))+${par(s.b)}\\sin(${n(s.omega)}(t_0+\\xi))`).join('')}`),
    ], note: 'ξ is a dummy elapsed-time variable used inside the integral below. It is not the time constant τ.' })

  const constant = seg.pieces.every((p) => p.slope === 0 && p.sines.length === 0)
  const g0 = B.map((row, i) => dot(row, seg.pieces.map((p) => p.u0)) + c[i])
  const transition = expm(seg.M.map((row) => row.map((v) => v * dt)))
  const homogeneous = matVecMul(phi, start)
  const driven = transition.slice(0, count).map((row) => dot(row.slice(count), seg.z0.slice(count)))
  let answer = homogeneous.map((v, i) => v + driven[i])
  if (count === 1 && constant) {
    const a = A[0][0], b = g0[0]
    steps.push({ title: 'Solve the scalar equation for this constant input',
      text: a === 0 ? 'The slope is constant, so integrate it: the change equals slope × elapsed time.' : 'Set the slope to zero to find the equilibrium x∞. Subtract that equilibrium from x: the remaining difference satisfies the homogeneous equation and is multiplied by e^(A₁₁Δ).',
      latex: a === 0 ? [
        `\\dot{x} &= ${n(b)}`, `x(t) &= x(t_0)+${par(b)}\\Delta = ${n(start[0])}+${par(b)}${par(dt)} = ${qty(answer[0], units[0])}`,
      ] : [
        `x_\\infty &= -\\frac{b}{A_{11}} = -\\frac{${n(b)}}{${par(a)}} = ${qty(-b / a, units[0])}`,
        `x(t) &= x_\\infty+[x(t_0)-x_\\infty]e^{A_{11}\\Delta}`,
        `&= ${n(-b / a)}+[${n(start[0])}-${par(-b / a)}]${par(phi[0][0])} = ${qty(answer[0], units[0])}`,
      ] })
  } else if (count === 1 && seg.pieces.every((p) => p.sines.length === 0)) {
    const a = A[0][0], g1 = dot(B[0], seg.pieces.map((p) => p.slope))
    const z = a * dt
    const F0 = Math.abs(z) < 1e-4 ? dt * (1 + z / 2 + z * z / 6 + z ** 3 / 24) : Math.expm1(z) / a
    const F1 = Math.abs(z) < 1e-4 ? dt * dt * (0.5 + z / 6 + z * z / 24 + z ** 3 / 120) : (Math.expm1(z) - z) / (a * a)
    answer = [phi[0][0] * start[0] + g0[0] * F0 + g1 * F1]
    steps.push({ title: 'Integrate the ramp over this interval',
      text: 'The source contribution has the form g₀ + g₁ξ. Integrating the constant and ramp terms separately gives F₀ and F₁. These formulas also have finite limits when A₁₁ = 0.',
      latex: [
        `g_0 &= ${n(g0[0])},\\qquad g_1 = ${n(g1)},\\qquad a=A_{11}=${n(a)}`,
        ...(a === 0 ? [`F_0 = \\Delta &= ${n(dt)},\\qquad F_1=\\frac{\\Delta^2}{2}=${n(dt * dt / 2)}`]
          : [`F_0 &= \\frac{e^{a\\Delta}-1}{a}=${n(F0)},\\qquad F_1=\\frac{e^{a\\Delta}-1-a\\Delta}{a^2}=${n(F1)}`]),
        `x(t) &= e^{a\\Delta}x(t_0)+g_0F_0+g_1F_1`,
        `&= ${par(phi[0][0])}${par(start[0])}+${par(g0[0])}${par(F0)}+${par(g1)}${par(F1)}=${qty(answer[0], units[0])}`,
      ] })
  } else if (count === 2 && constant && A[0][0] * A[1][1] !== A[0][1] * A[1][0]) {
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0]
    const equilibrium = [
      (-A[1][1] * g0[0] + A[0][1] * g0[1]) / det,
      (A[1][0] * g0[0] - A[0][0] * g0[1]) / det,
    ]
    const difference = start.map((v, i) => v - equilibrium[i])
    answer = matVecMul(phi, difference).map((v, i) => v + equilibrium[i])
    steps.push({ title: 'Find the constant-input equilibrium, then evolve the initial difference',
      text: 'For a constant input, set the derivative to zero: Ax∞ + g = 0, where g = Bu + c. Solve the two equilibrium equations by the 2 × 2 inverse formula. The difference x − x∞ then obeys the homogeneous equation, so multiply it by Φ and add x∞ back.',
      latex: [
        `g &= ${vec(g0.map(n))},\\qquad d=A_{11}A_{22}-A_{12}A_{21}=${n(det)}`,
        `x_{\\infty,1} &= \\frac{-${par(A[1][1])}${par(g0[0])}+${par(A[0][1])}${par(g0[1])}}{${n(det)}}=${qty(equilibrium[0], units[0])}`,
        `x_{\\infty,2} &= \\frac{${par(A[1][0])}${par(g0[0])}-${par(A[0][0])}${par(g0[1])}}{${n(det)}}=${qty(equilibrium[1], units[1])}`,
        `x(t) &= x_\\infty+\\Phi(\\Delta)[x(t_0)-x_\\infty]`,
        `&= ${vec(equilibrium.map(n))}+${mat(phi)}${vec(difference.map(n))}`,
        ...states.map((s, i) => `${sx[i]}(t) &= ${n(equilibrium[i])}+${products(phi[i], difference)}=${qty(answer[i], units[i])}`),
      ], note: 'An equilibrium is a state with zero derivative under this constant input. The response approaches it only if the natural roots decay; an ideal undamped LC can oscillate around it indefinitely.' })
  } else if (x.ac && seg.pieces.some((p) => p.sines.length)) {
    const U = seg.pieces.map((p) => {
      const sine = p.sines.find((s) => s.omega === x.omega)
      return sine ? [sine.b, sine.a] : [0, 0]
    })
    const ac = statePhasor(A, B, U, x.omega)
    const ss0 = ac.X.map((z) => cx.instant(z, x.omega, seg.t0))
    const ss = ac.X.map((z) => cx.instant(z, x.omega, x.cursor))
    const correction = matVecMul(phi, start.map((v, i) => v - ss0[i]))
    // The offered sinusoidal state experiments have zero DC offset.
    answer = ss.map((v, i) => v + correction[i])
    steps.push({ title: 'Find the forced sinusoid, then add the startup correction',
      text: 'For a sine, write x_ss(t) = Im{X·e^(jωt)}. Differentiation multiplies the phasor by jω, so (jωI − A)X = BU. Solve this algebraic system, then add the natural response needed to match the starting state. Capital X is a complex amplitude; it is not x(t).',
      latex: [
        `(j\\omega I-A)X &= BU`, `${mat(ac.M, rect)}X &= ${vec(ac.g.map(rect))}`,
        ...(count === 1 ? [`X &= \\frac{${rect(ac.g[0])}}{${rect(ac.M[0][0])}} = ${rect(ac.X[0])}`]
          : [`d &= M_{11}M_{22}-M_{12}M_{21}`, `&=(${rect(ac.M[0][0])})(${rect(ac.M[1][1])})-(${rect(ac.M[0][1])})(${rect(ac.M[1][0])})=${rect(ac.det)}`,
            `X_1 &= \\frac{M_{22}g_1-M_{12}g_2}{d}=\\frac{(${rect(ac.M[1][1])})(${rect(ac.g[0])})-(${rect(ac.M[0][1])})(${rect(ac.g[1])})}{${rect(ac.det)}}=${rect(ac.X[0])}`,
            `X_2 &= \\frac{M_{11}g_2-M_{21}g_1}{d}=\\frac{(${rect(ac.M[0][0])})(${rect(ac.g[1])})-(${rect(ac.M[1][0])})(${rect(ac.g[0])})}{${rect(ac.det)}}=${rect(ac.X[1])}`]),
        ...ac.X.map((z, i) => `${sx[i]}^{ss}(t) &= ${n(cx.cabs(z))}\\sin(${n(x.omega)}t+${par(cx.cabs(z) === 0 ? 0 : cx.carg(z))})`),
        `x_{ss}(t_0) &= ${vec(ss0.map(n))},\\qquad x_{ss}(t)=${vec(ss.map(n))}`,
        `x(t) &= x_{ss}(t)+\\Phi(\\Delta)[x(t_0)-x_{ss}(t_0)]`,
        `&= ${vec(ss.map(n))}+${mat(phi)}\\left[${vec(start.map(n))}-${vec(ss0.map(n))}\\right]`,
        `&= ${vec(ss.map(n))}+${vec(correction.map(n))}=${vec(answer.map(n))}`,
      ], note: 'M is the complex matrix jωI − A above and g = BU is its right-hand side. The steady sinusoid alone usually has the wrong initial state; the correction fixes that and decays when the natural roots have negative real parts.' })
  } else {
    steps.push({ title: 'Add the natural response and the accumulated input',
      text: 'Φ multiplies the starting state. Every later input contribution also evolves under Φ, for the time remaining until the cursor; the integral adds these contributions. The two vectors below are evaluated from that solution, then added component by component.',
      latex: [
        `x(t) &= \\Phi(\\Delta)x(t_0)+\\int_0^{\\Delta}\\Phi(\\Delta-\\xi)[Bu(t_0+\\xi)+c]\\,d\\xi`,
        `x_{natural} &= ${mat(phi)}${vec(start.map(n))}=${vec(homogeneous.map(n))}`,
        `x_{driven} &= \\int_0^{${n(dt)}}e^{${mat(A)}(${n(dt)}-\\xi)}${vec(g0.map(n))}\\,d\\xi=${vec(driven.map(n))}`,
        `x(t) &= ${vec(homogeneous.map(n))}+${vec(driven.map(n))}=${vec(answer.map(n))}`,
      ], note: 'The integral form also works when A has no inverse. For a constant input its integrand contains the constant vector Bu + c shown here.' })
  }
  const error = answer.map((v, i) => v - x.now.x[i])
  steps.push({ title: 'Check the answer against the state at the cursor',
    text: 'The time solution gives the states; substituting them into the differential equation gives their slopes. Compare the derived state with the transient trace at the same time. Each row retains its own voltage or current unit.',
    latex: states.map((s, i) => `${sx[i]}(t) &= ${qty(answer[i], units[i])},\\quad \\text{trace}=${qty(x.now.x[i], units[i])},\\quad \\text{difference}=${qty(error[i], units[i])}`),
    note: 'A slope is a rate of change, not an additional voltage or current. The scope plots states against time; its steepness at the cursor is the derivative calculated above.' })
  return { steps, slopes, answer, error }
}
