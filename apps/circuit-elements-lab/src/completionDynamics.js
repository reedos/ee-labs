import {n} from './derivationMath.js'

const step = (title, text, ...latex) => ({title, text, latex: latex.map(line => `&${line}`)})
const row = (label, predicted, measured, unit) => ({label, predicted, measured, unit, tol: 2e-7, abs: 1e-8})
const voltage = (key, label, value) => ({key, label, default: value, unit: 'V', min: -10, max: 10, scale: 'linear'})
const rcAt = (p, t) => p.E + (p.v0 - p.E) * Math.exp(-t / (p.R1 * p.C1))

/** Closed-form second-order solution, independent of the network matrix exponential. */
export function rlcClosed(p, t) {
  const alpha = p.R1 / (2 * p.L1), w0 = 1 / Math.sqrt(p.L1 * p.C1)
  const a = (p.v0 || 0) - p.E, d = (p.i0 || 0) / p.C1
  const delta = alpha * alpha - w0 * w0
  let y, dy
  if (Math.abs(delta) < 1e-10 * w0 * w0) {
    const b = d + alpha * a, decay = Math.exp(-alpha * t)
    y = (a + b * t) * decay; dy = (b - alpha * (a + b * t)) * decay
  } else if (delta > 0) {
    const root = Math.sqrt(delta), r2 = -alpha - root, r1 = -w0 * w0 / (alpha + root)
    const A = (d - r2 * a) / (r1 - r2), B = a - A
    y = A * Math.exp(r1 * t) + B * Math.exp(r2 * t)
    dy = r1 * A * Math.exp(r1 * t) + r2 * B * Math.exp(r2 * t)
  } else {
    const wd = Math.sqrt(-delta), b = (d + alpha * a) / wd, decay = Math.exp(-alpha * t)
    y = decay * (a * Math.cos(wd * t) + b * Math.sin(wd * t))
    dy = -alpha * y + decay * wd * (-a * Math.sin(wd * t) + b * Math.cos(wd * t))
  }
  return {v: p.E + y, i: p.C1 * dy, alpha, w0}
}

export function dynamicsStudy(id, p, x) {
  const t = x.cursor
  if (id === 'f8') {
    const gain = p.R2 / (p.R1 + p.R2), initial = p.Vpre * gain, final = p.E * gain
    const resistance = p.R3 + p.R1 * p.R2 / (p.R1 + p.R2), tau = resistance * p.C1
    const at = tt => final + (initial - final) * Math.exp(-tt / tau)
    return {
      title: 'Analyze the circuit before, just after and long after switching',
      intro: 'The source steps from its pre-switch voltage to its post-switch voltage at t = 0. The circuit was in DC equilibrium before that step. The capacitor voltage is the state; the resistor currents can change immediately.',
      steps: [
        step('Solve the pre-switch DC circuit', 'At DC equilibrium the capacitor current is zero. Replace the capacitor by an open circuit, so R3 has no voltage drop; the divider sets the stored voltage.', String.raw`v_C(0^-)=V_{\mathrm{pre}}\frac{R_2}{R_1+R_2}=(${n(p.Vpre)})\frac{${n(p.R2)}}{${n(p.R1)}+${n(p.R2)}}=${n(initial)}\,\mathrm V`),
        step('Carry the state across the switching instant', 'A finite capacitor current cannot change capacitor voltage in zero time. Just after the source step, hold the capacitor at its pre-switch voltage when solving the resistor circuit.', String.raw`v_C(0^+)=v_C(0^-)=${n(initial)}\,\mathrm V`, String.raw`q_C(0^+)=C_1v_C(0^+)=${n(p.C1 * initial)}\,\mathrm C`),
        step('Find the final DC circuit', 'Use the new source voltage and open the capacitor again. This final value is approached only because this passive RC circuit is stable.', String.raw`v_C(\infty)=V_1\frac{R_2}{R_1+R_2}=${n(final)}\,\mathrm V`),
        step('Find the post-switch time constant', 'Deactivate the independent source and look back from the capacitor. R3 is in series with R1 parallel R2. Use the post-switch topology, not an arbitrary sum of resistors.', String.raw`R_{\mathrm{seen}}=R_3+(R_1\parallel R_2)=${n(resistance)}\,\Omega`, String.raw`\tau=R_{\mathrm{seen}}C_1=${n(tau)}\,\mathrm s`),
        step('Assemble the complete response and its initial slope', 'The final value plus a decaying difference satisfies both the initial condition and the differential equation. Time t is measured after the source step.', String.raw`v_C(t)=v_C(\infty)+[v_C(0^+)-v_C(\infty)]e^{-t/\tau}`, String.raw`v_C(${n(t)})=(${n(final)})+[(${n(initial)})-(${n(final)})]e^{-${n(t)}/${n(tau)}}=${n(at(t))}\,\mathrm V`, String.raw`\dot v_C(0^+)=\frac{v_C(\infty)-v_C(0^+)}{\tau}=${n((final - initial) / tau)}\,\mathrm{V/s}`),
      ],
      advantage: 'The initial/final/time-constant procedure is a short way to solve a stable first-order circuit driven by a constant value after switching.',
      limitation: 'The pre-switch DC assumption requires enough settling time. Ideal impulsive excitation can break the finite-current continuity argument. Higher-order circuits require more than one state and one time constant.',
      checks: [row('initial capacitor voltage', initial, x.tr.at(0).sol.volt.C1, 'V'), row('capacitor voltage at cursor', at(t), x.sol.volt.C1, 'V')],
      practice: {prompt: 'Calculate the capacitor voltage one time constant after switching, using the current settings.', target: at(tau), unit: 'V', hint: 'Use final + (initial − final) × exp(−1). The 63.2% rule applies to the change, not always to the full source voltage.'},
    }
  }
  if (id === 'f9' || id === 'j1' || id === 'j2') {
    const tau = p.R1 * p.C1, decay = Math.exp(-t / tau), zi = p.v0 * decay, zs = p.E * (1 - decay)
    const common = [
      step('Name the state and write the circuit law', 'Let x(t) be capacitor voltage in volts and u(t) be the applied voltage in volts. Capacitor current is C1 times the voltage slope. KVL across the series loop gives the differential equation.', String.raw`i_C=C_1\dot x,\qquad u=R_1i_C+x`, String.raw`\tau\dot x+x=u,\qquad \tau=R_1C_1=${n(tau)}\,\mathrm s,\qquad x(0^+)=${n(p.v0)}\,\mathrm V`),
    ]
    const decomposition = [
      step('Solve the zero-input response', 'Set the applied input to zero but retain the stored initial voltage. Zero input does not mean zero initial energy.', String.raw`\tau\dot x_{\mathrm{zi}}+x_{\mathrm{zi}}=0,\qquad x_{\mathrm{zi}}(0)=x_0`, String.raw`x_{\mathrm{zi}}(t)=x_0e^{-t/\tau},\qquad x_{\mathrm{zi}}(${n(t)})=${n(zi)}\,\mathrm V`),
      step('Solve the zero-state response', 'Set the initial voltage to zero but retain the step input. This response describes the effect of the input alone.', String.raw`\tau\dot x_{\mathrm{zs}}+x_{\mathrm{zs}}=V_1,\qquad x_{\mathrm{zs}}(0)=0`, String.raw`x_{\mathrm{zs}}(t)=V_1(1-e^{-t/\tau}),\qquad x_{\mathrm{zs}}(${n(t)})=${n(zs)}\,\mathrm V`),
      step('Add the two responses', 'Linearity permits superposition of the input-driven and initial-state-driven solutions. Their initial values add correctly, and their sum satisfies the same differential equation.', String.raw`x=x_{\mathrm{zi}}+x_{\mathrm{zs}}=V_1+(x_0-V_1)e^{-t/\tau}`, String.raw`x(${n(t)})=(${n(zi)})+(${n(zs)})=${n(zi + zs)}\,\mathrm V`),
      step('Distinguish this split from natural plus forced', 'For a constant input, one particular (forced) solution is V1. The natural correction is (x0 − V1) exp(−t/τ). It differs from the zero-input response because the zero-state response also contains a natural term.', String.raw`x_{\mathrm{forced}}=V_1,\qquad x_{\mathrm{natural}}=(x_0-V_1)e^{-t/\tau}`, String.raw`x_{\mathrm{natural}}\ne x_{\mathrm{zi}}\quad\text{in general}`),
    ]
    const laplace = [
      step('Define the one-sided Laplace transform', 'X(s) is a transformed function, not x evaluated at some time. The complex variable s = σ + jω has units of inverse seconds. The exponential weights the entire response for t ≥ 0; the integral must converge.', String.raw`X(s)=\mathcal L\{x(t)\}=\int_{0^-}^{\infty}x(t)e^{-st}\,dt`, String.raw`\mathcal L\{1\}=\frac1s,\qquad \mathcal L\{e^{-at}\}=\frac1{s+a}\quad (\operatorname{Re}s>\max(0,-a)\text{ for this pair})`),
      step('Transform the derivative with its initial value', 'Integration by parts gives sX(s) minus the pre-switch state. Keeping this term is essential: a transfer function by itself does not describe stored initial energy.', String.raw`\mathcal L\{\dot x\}=sX(s)-x(0^-)`, String.raw`\tau[sX(s)-x_0]+X(s)=\frac{V_1}{s}`),
      step('Solve the algebraic equation for X(s)', 'Collect the terms multiplying X(s). The source step contributes V1/s, and the initial state contributes τx0. Do not combine them by discarding the initial condition.', String.raw`(\tau s+1)X(s)=\frac{V_1}{s}+\tau x_0`, String.raw`X(s)=\frac{V_1}{s(\tau s+1)}+\frac{\tau x_0}{\tau s+1}`),
      step('Split into transform pairs and invert', 'Partial fractions put the expression into terms whose inverse transforms are known. The constant residue is V1; the decaying exponential has coefficient x0 − V1.', String.raw`X(s)=\frac{V_1}{s}+\frac{x_0-V_1}{s+1/\tau}=\frac{${n(p.E)}}s+\frac{${n(p.v0 - p.E)}}{s+${n(1 / tau)}}`, String.raw`x(t)=V_1+(x_0-V_1)e^{-t/\tau},\qquad x(${n(t)})=${n(rcAt(p, t))}\,\mathrm V`),
      step(id === 'j2' ? 'Interpret the initial-condition source' : 'Identify the zero-state transfer function', id === 'j2' ? 'The capacitor law becomes IC(s) = C1 s VC(s) − C1 vC(0−). The second term is the stored-state contribution to the transformed circuit; it is not an extra physical battery added at t = 0.' : 'A transfer function is output transform divided by input transform with zero initial state. Its pole −1/τ encodes the natural decay; setting s = jω gives sinusoidal steady-state response when that response exists.', id === 'j2' ? String.raw`I_C(s)=sC_1V_C(s)-C_1v_C(0^-)` : String.raw`H(s)=\left.\frac{X(s)}{U(s)}\right|_{x_0=0}=\frac1{\tau s+1}`, String.raw`x(0^+)=${n(p.v0)},\qquad x(\infty)=${n(p.E)}\,\mathrm V`),
    ]
    return {
      title: id === 'f9' ? 'Separate initial energy from the applied input' : id === 'j1' ? 'From a differential equation to a Laplace solution' : 'Keep initial conditions in the transformed circuit',
      intro: 'Use the same RC circuit in equations, state and scope views. Every route must predict the same voltage at the time cursor; only the representation changes.',
      steps: [...common, ...(id === 'f9' ? decomposition : laplace)],
      advantage: id === 'f9' ? 'Separating zero-input and zero-state responses shows whether a feature comes from stored energy or the source.' : 'Laplace methods replace linear differential equations by algebra while retaining initial conditions and input changes.',
      limitation: id === 'f9' ? 'This superposition requires a linear model. Zero state and zero input are distinct conditions; neither means the complete response is zero.' : 'The transform requires a convergence region. Inversion and initial conditions still matter, and nonlinear switching cannot generally be reduced to one fixed transfer function.',
      checks: [row('complete capacitor voltage', zi + zs, x.sol.volt.C1, 'V'), row('capacitor current', (p.E - rcAt(p, t)) / p.R1, x.sol.i.C1, 'A')],
      plot: id === 'f9' ? {unit: 'V', tEnd: x.tEnd, traces: [{label: 'Zero input', at: tt => p.v0 * Math.exp(-tt / tau)}, {label: 'Zero state', at: tt => p.E * (1 - Math.exp(-tt / tau))}, {label: 'Complete response', at: tt => rcAt(p, tt)}]} : null,
      practice: {prompt: 'Calculate the initial capacitor-voltage slope immediately after the switch closes, in volts per second.', target: (p.E - p.v0) / tau, unit: 'V/s', hint: 'Rearrange τ dx/dt + x = V1 at t = 0+, using x(0+) = v0.'},
    }
  }
  const resistance = p.zeta === undefined ? (p.R1 || 0) : 2 * p.zeta * Math.sqrt(p.L1 / p.C1)
  const pp = {...p, R1: resistance}
  const response = rlcClosed(pp, t)
  const {alpha, w0} = response
  const a = (p.v0 || 0) - p.E, d = (p.i0 || 0) / p.C1
  const steps = [
    step('Write the two physical state equations', 'The states are capacitor voltage vC in volts and inductor current iL in amperes. The same current passes through L and C. KCL gives the first derivative; KVL gives the second.', String.raw`\dot v_C=\frac{i_L}{C_1},\qquad \dot i_L=\frac{u-R_1i_L-v_C}{L_1}`, String.raw`v_C(0)=${n(p.v0 || 0)}\,\mathrm V,\qquad i_L(0)=${n(p.i0 || 0)}\,\mathrm A`),
    step('Eliminate current to obtain one second-order equation', 'Differentiate the capacitor law and substitute the inductor law. The initial voltage slope is iL(0)/C1, so both initial conditions survive the elimination.', String.raw`L_1C_1\ddot v_C+R_1C_1\dot v_C+v_C=u`, String.raw`\alpha=\frac{R_1}{2L_1}=${n(alpha)}\,\mathrm{s^{-1}},\qquad \omega_0=\frac1{\sqrt{L_1C_1}}=${n(w0)}\,\mathrm{rad/s}`),
    step('Keep the initial sources in the element transforms', 'The capacitor contributes a parallel current term −C₁v₀ in its passive current reference. The inductor contributes a series voltage term −L₁i₀ in its passive voltage reference. These terms represent stored energy, not additional physical sources switched into the schematic.', String.raw`I_C(s)=sC_1V_C(s)-C_1v_0`, String.raw`V_L(s)=sL_1I_L(s)-L_1i_0`, String.raw`V_C(s)=\frac{I_C(s)}{sC_1}+\frac{v_0}s,\qquad I_L(s)=\frac{V_L(s)}{sL_1}+\frac{i_0}s`),
    step('Transform both derivatives', 'Let Y(s) be the transform of capacitor voltage. The second-derivative rule subtracts both the initial voltage and its initial slope. U(s) = V1/s for the step input.', String.raw`\mathcal L\{\ddot v_C\}=s^2Y-sv_0-\dot v_0`, String.raw`Y(s)=\frac{V_1/s+L_1C_1sv_0+L_1i_0+R_1C_1v_0}{L_1C_1s^2+R_1C_1s+1}`),
  ]
  if (id === 'j3') {
    const root = Math.sqrt(alpha * alpha - w0 * w0), r2 = -alpha - root, r1 = -w0 * w0 / (alpha + root)
    const A = (d - r2 * a) / (r1 - r2), B = a - A
    steps.push(step('Factor the denominator into two real poles', 'The damping ratio is kept above one in this lesson, so the roots are distinct and negative. Both exponentials decay, at different rates.', String.raw`r_{1,2}=-\alpha\pm\sqrt{\alpha^2-\omega_0^2}`, String.raw`r_1=${n(r1)},\qquad r_2=${n(r2)}\,\mathrm{s^{-1}}`),
      step('Find the residues and invert', 'The initial value requires A + B = v0 − V1, and the initial slope requires r1 A + r2 B = i0/C1. Solving these two scalar equations gives the same residues as partial fractions.', String.raw`A=\frac{\dot v_0-r_2(v_0-V_1)}{r_1-r_2}=${n(A)},\qquad B=v_0-V_1-A=${n(B)}`, String.raw`Y(s)=\frac{V_1}s+\frac{A}{s-r_1}+\frac{B}{s-r_2}`, String.raw`v_C(t)=V_1+Ae^{r_1t}+Be^{r_2t}`))
  } else if (id === 'j4') {
    const wd = Math.sqrt(w0 * w0 - alpha * alpha), b = (d + alpha * a) / wd
    steps.push(step('Complete the square for a complex-conjugate pair', 'Here the damping ratio remains between zero and one. The imaginary parts give the oscillation frequency; the negative real part gives the decay.', String.raw`s^2+2\alpha s+\omega_0^2=(s+\alpha)^2+\omega_d^2`, String.raw`\omega_d=\sqrt{\omega_0^2-\alpha^2}=${n(wd)}\,\mathrm{rad/s}`),
      step('Match the shifted sine and cosine transform pairs', 'Write the numerator in terms of s + α and ωd. Their inverse transforms are an exponentially decaying cosine and sine, producing a real voltage from the conjugate poles.', String.raw`Y(s)=\frac{V_1}s+\frac{a(s+\alpha)+b\omega_d}{(s+\alpha)^2+\omega_d^2}`, String.raw`a=v_0-V_1=${n(a)},\qquad b=\frac{\dot v_0+\alpha a}{\omega_d}=${n(b)}`, String.raw`v_C(t)=V_1+e^{-\alpha t}[a\cos(\omega_dt)+b\sin(\omega_dt)]`))
  } else if (id === 'j5') {
    const b = d + alpha * a
    steps.push(step('Recognize a repeated pole', 'The resistance is derived as 2√(L1/C1), holding the circuit at critical damping as L and C change. Two equal poles require a repeated-pole term; two identical simple fractions are insufficient.', String.raw`R_1=2\sqrt{L_1/C_1}=${n(resistance)}\,\Omega,\qquad \alpha=\omega_0`, String.raw`s^2+2\alpha s+\omega_0^2=(s+\alpha)^2`),
      step('Invert the repeated-pole term', 'The transform of t exp(−αt) is 1/(s+α)². Its coefficient is determined by the initial slope, not chosen arbitrarily.', String.raw`Y(s)=\frac{V_1}s+\frac a{s+\alpha}+\frac b{(s+\alpha)^2}`, String.raw`a=v_0-V_1=${n(a)},\qquad b=\dot v_0+\alpha a=${n(b)}`, String.raw`v_C(t)=V_1+(a+bt)e^{-\alpha t}`))
  } else if (id === 'j6') {
    steps.push(step('Apply the initial-value theorem with its conditions', 'For this ordinary finite voltage response there is no impulse at the origin. The initial value can be recovered as lim sY(s) as s tends to positive infinity.', String.raw`v_C(0^+)=\lim_{s\to\infty}sY(s)=0`),
      step('Check the poles before using the final-value theorem', 'The final-value theorem requires all poles of sY(s) to lie strictly in the left half-plane for this rational response. This ideal LC circuit has poles on the imaginary axis, so the condition fails.', String.raw`Y(s)=\frac{V_1\omega_0^2}{s(s^2+\omega_0^2)},\qquad s=\pm j\omega_0`, String.raw`\lim_{s\to0}sY(s)=V_1\quad\text{does not establish a final value}`),
      step('Invert and see why no final value exists', 'Energy keeps moving between the ideal inductor and capacitor. The time response continues to oscillate; its average is not a final value. Compare this with a resistively damped circuit in the previous lessons.', String.raw`v_C(t)=V_1[1-\cos(\omega_0t)]`, String.raw`\lim_{t\to\infty}v_C(t)\ \text{does not exist for }V_1\ne0`))
  } else {
    steps.push(step('Assemble the matrix equation', 'Each row retains the units of its own state derivative. The entries of A therefore do not all have the same units. Input u is source voltage; output y is capacitor voltage.', String.raw`\dot{\boldsymbol x}=A\boldsymbol x+B u,\qquad y=C_y\boldsymbol x`, String.raw`A=\begin{bmatrix}0&1/C_1\\-1/L_1&-R_1/L_1\end{bmatrix},\quad B=\begin{bmatrix}0\\1/L_1\end{bmatrix},\quad C_y=\begin{bmatrix}1&0\end{bmatrix}`),
      step('Transform the state equation and isolate the input response', 'The initial-state vector is a separate forcing term. A transfer function is defined only for the zero-state part, even when the displayed circuit begins with stored energy.', String.raw`(sI-A)\boldsymbol X=\boldsymbol x_0+B U`, String.raw`Y=C_y(sI-A)^{-1}\boldsymbol x_0+\underbrace{C_y(sI-A)^{-1}B}_{H(s)}U`),
      step('Evaluate the two-by-two inverse', 'The determinant gives the characteristic polynomial. Taking the first component of the inverse times B recovers the same transfer function derived by eliminating current.', String.raw`\det(sI-A)=s^2+\frac{R_1}{L_1}s+\frac1{L_1C_1}`, String.raw`H(s)=\frac{1/(L_1C_1)}{s^2+(R_1/L_1)s+1/(L_1C_1)}=\frac1{L_1C_1s^2+R_1C_1s+1}`))
  }
  steps.push(step('Evaluate at the cursor and compare the independent solution', 'After inversion, evaluate the time-domain expression in seconds. Recover current from iL = C1 dvC/dt. The native state-space solver provides a separate numerical check of both state components.', String.raw`v_C(${n(t)})=${n(response.v)}\,\mathrm V,\qquad i_L(${n(t)})=${n(response.i)}\,\mathrm A`))
  return {
    title: {j3: 'Invert distinct real poles by partial fractions', j4: 'Invert complex poles into a real damped sinusoid', j5: 'Invert a repeated pole at critical damping', j6: 'Initial and final values: check the theorem conditions', j7: 'Derive a transfer function from coupled state equations'}[id],
    intro: 'The schematic, source and time cursor are the same for every analysis view. Work from physical circuit laws to transformed algebra and back to a measurable voltage and current.',
    steps,
    advantage: 'Factoring a rational transform identifies the natural modes and gives an explicit time response. The state form scales naturally when more energy-storage elements are added.',
    limitation: 'A transfer function omits the initial-state response. Repeated poles, complex poles and poles on the imaginary axis need their own inversion and validity checks; a final-value shortcut cannot bypass them.',
    checks: [row('capacitor voltage', response.v, x.sol.volt.C1, 'V'), row('inductor current', response.i, x.sol.i.L1, 'A')],
    practice: {prompt: 'Using the current initial state, calculate diL/dt at t = 0+, in amperes per second.', target: (p.E - resistance * (p.i0 || 0) - (p.v0 || 0)) / p.L1, unit: 'A/s', hint: 'Use L1 diL/dt = V1 − R1 i0 − v0. Include stored voltage and current where present.'},
  }
}

export function completionDynamics(base, groups) {
  const find = id => base.find(e => e.id === id)
  const make = (id, template, name, prerequisites, settings = {}) => {
    const original = find(template)
    const params = original.params.map(k => ({...k, ...(k.key in settings ? {default: settings[k.key]} : {})}))
    return {...original, id, name, params, claim: {}, ghost: undefined, circuitLab: undefined, prerequisites, study: dynamicsStudy,
      group: id[0] === 'j' ? groups[9] : groups[5], view: id[0] === 'j' ? 'laplace' : 'equations',
      views: id[0] === 'j' ? ['equations', 'scope', 'state', 'laplace'] : ['equations', 'scope', 'state'],
      headline: {label: 'the capacitor voltage at the cursor', tag: 'v_C', unit: 'V', where: null, value: x => x.sol.volt.C1},
      lesson: {see: 'Start with the physical circuit and its stored state. Follow the worked method from the initial conditions to a voltage and current at the time cursor, then compare with Scope and State equation.', why: 'The equations, transform and state representation describe the same circuit. The derivation must retain the input and initial energy, name every symbol and check the conditions behind any shortcut.', try: [{say: 'Move the time cursor and compare the derived capacitor voltage with the scope.', reads: []}, {say: 'Change the source voltage and predict the new initial current slope before checking the worked calculation.', reads: []}]},
    }
  }
  const switching = make('f8', 'f4', 'Before, after and final: a complete switching procedure', ['f4', 'd8'], {E: 9, R3: 750})
  switching.params.push(voltage('Vpre', 'Source before switching', 3))
  switching.net = p => {const net = find('f4').net(p); return {...net, elements: net.elements.map(e => e.id === 'V1' ? {...e, wave: {...e.wave, from: p.Vpre}} : e)}}
  switching.closedHeadline = (p, x) => {const gain = p.R2 / (p.R1 + p.R2), tau = (p.R3 + p.R1 * p.R2 / (p.R1 + p.R2)) * p.C1; return gain * (p.E + (p.Vpre - p.E) * Math.exp(-x.cursor / tau))}
  const firstOrder = [
    make('f9', 'f3', 'Zero input, zero state and the complete response', ['f8'], {E: 8, v0: 3}),
    make('j1', 'f3', 'Laplace foundations: from time to s and back', ['h8', 'f9'], {E: 6, v0: 0, R1: 1500}),
    make('j2', 'f3', 'Laplace with stored initial energy', ['j1'], {E: 4, v0: -2, R1: 1800}),
  ]
  for (const e of firstOrder) e.closedHeadline = (p, x) => rcAt(p, x.cursor)
  const secondOrder = [
    make('j3', 'g6', 'Laplace inversion: distinct real poles', ['j2', 'g1'], {E: 2, v0: 1, i0: .003}),
    make('j4', 'g6', 'Laplace inversion: complex-conjugate poles', ['j3', 'g4'], {E: 2, v0: -1, i0: .002}),
    make('j5', 'g6', 'Laplace inversion: repeated poles', ['j4', 'g2'], {E: 3, v0: 1, i0: 0}),
    make('j6', 'g5', 'When the final-value theorem fails', ['j5', 'g5'], {E: 2}),
    make('j7', 'g6', 'From the state matrix to the transfer function', ['j6', 'g6'], {E: 2, v0: 1, i0: .004}),
  ]
  for (const e of secondOrder) {
    if (['j3', 'j4', 'j5'].includes(e.id)) {
      const zeta = e.id === 'j3' ? 2 : e.id === 'j4' ? .3 : 1
      e.params = e.params.filter(k => k.key !== 'R1')
      if (e.id !== 'j5') e.params.push({key: 'zeta', label: 'Damping ratio ζ', unit: '', default: zeta, min: e.id === 'j3' ? 1.05 : .05, max: e.id === 'j3' ? 5 : .95, scale: 'linear'})
      e.net = p => find('g6').net({...p, R1: 2 * (p.zeta ?? 1) * Math.sqrt(p.L1 / p.C1)})
      e.study = (id, p, x) => dynamicsStudy(id, {...p, zeta: p.zeta ?? 1}, x)
    }
    e.closedHeadline = (p, x) => rlcClosed({...p, R1: e.id === 'j5' ? 2 * Math.sqrt(p.L1 / p.C1) : p.zeta === undefined ? (p.R1 || 0) : 2 * p.zeta * Math.sqrt(p.L1 / p.C1)}, x.cursor).v
  }
  return [switching, ...firstOrder, ...secondOrder]
}
