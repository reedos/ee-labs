import { complex as cx } from '@ee-labs/network'
import { n, qty, par, vec, mat, rect, polar } from './derivationMath.js'

export const FOUNDATIONS = {
  f1: { title: 'Before state equations: values, slopes and initial conditions', next: 'state',
    intro: 'Start with the capacitor on this schematic. Learn what its state means before using the differential equation to follow it through time.',
    tasks: ['Read the difference between a voltage, an initial voltage and a voltage slope.', 'Move the time cursor and follow the current and slope substitutions.', 'Continue to State equation to solve the full time response.'] },
  g1: { title: 'Before coupled equations: two states and a matrix', next: 'state',
    intro: 'Use capacitor voltage and inductor current to build two ordinary circuit equations, then arrange those same equations into rows of a matrix.',
    tasks: ['Name both states and their different units.', 'Follow each circuit law into one matrix row, then change a component value.', 'Continue to State equation to connect those rows with the time response.'] },
  h1: { title: 'Before phasor analysis: complex numbers and sinusoids', next: 'phasor',
    intro: 'Read the sinusoid, construct its complex amplitude, then use the RC circuit to connect complex arithmetic with physical voltage and current.',
    tasks: ['Read amplitude, frequency and phase before the complex notation.', 'Change the source phase and compare rectangular and polar values.', 'Continue to Phasors to calculate the voltages and see their rotating arrows.'] },
}

/** An early lesson to revisit when arriving directly at a later experiment. */
export function foundationFor(exp, view) {
  if (view === 'phasor' || view === 'impedance' || view === 'acpower' || view === 'bode') return 'h1'
  if (view === 'state') return exp.net(Object.fromEntries(exp.params.map(p => [p.key, p.default]))).elements.filter(e => ['C', 'L'].includes(e.type)).length > 1 ? 'g1' : 'f1'
  return null
}

export function foundationSteps(id, x) {
  if (id === 'h1') return phasorSteps(x)
  const coupled = id === 'g1'
  const el = Object.fromEntries(x.net.elements.map(e => [e.id, e]))
  const ci = x.dyn.states.findIndex(s => s.id === 'C1')
  const vc = x.now.x[ci], initial = x.tr.x0[ci], u = x.now.u[0]
  const R = coupled ? el.R1.value : el.Rs.value, C = el.C1.value
  const steps = [{ title: 'Distinguish a value from its slope',
    text: 'Time t is measured in seconds. The capacitor voltage v_C(t) is a value in volts. Its derivative is the slope of the voltage curve, in volts per second. The dot is shorthand for the derivative; it is not another unknown voltage.',
    latex: coupled ? [String.raw`\dot v_C(t)=\frac{dv_C}{dt}`, String.raw`v_C(t+\Delta t)\approx v_C(t)+\dot v_C(t)\Delta t`]
      : [String.raw`x(t)=v_C(t),\qquad \dot{x}(t)=\frac{dx}{dt}`, String.raw`x(t+\Delta t)\approx x(t)+\dot{x}(t)\Delta t\quad\text{for a small time step}`],
    note: 'The small-step expression explains a slope. It is an approximation, not the exact time-domain solution used by the lab.' },
  { title: 'Read an initial condition and a time evaluation',
    text: 'The superscripts 0 minus and 0 plus mean immediately before and immediately after switching. They do not mean negative and positive voltage. A finite current cannot make capacitor voltage jump. Lowercase x(T) evaluates the same waveform at a chosen time T; capital X will later denote a phasor.',
    latex: [String.raw`v_C(0^+)=v_C(0^-)=${qty(initial, 'V')}`, String.raw`t=${qty(x.cursor, 's')},\qquad v_C(t)=${qty(vc, 'V')}`],
    note: 'The initial value supplies the starting point. The differential equation supplies the slope at each later time. Both are needed to determine the response.' }]
  if (!coupled) {
    const current = (u - vc) / R, slope = current / C, tau = R * C
    steps.push({ title: 'Use the resistor to find the capacitor current',
      text: 'Call the source voltage u(t). Current flows from the source through the series resistor toward the capacitor. KVL gives the resistor voltage u(t) minus v_C(t). Ohm’s law gives its current, which is also the capacitor current in this loop.',
      latex: [String.raw`u(t)=v_{R_s}(t)+v_C(t),\qquad i_C(t)=\frac{u(t)-v_C(t)}{R_s}`,
        String.raw`i_C(t)=\frac{${n(u)}-${par(vc)}}{${n(R)}}=${qty(current, 'A')}`] })
    steps.push({ title: 'Turn current into a voltage slope',
      text: 'The element law i_C = C times dv_C/dt connects the current with the slope. Divide by capacitance. A positive current increases the voltage; a negative current decreases it.',
      latex: [String.raw`i_C=C\frac{dv_C}{dt}\quad\Longrightarrow\quad\dot{x}(t)=\frac{u(t)-x(t)}{R_sC}`,
        String.raw`\dot{x}(t)=` + String.raw`\frac{${n(current)}}{${n(C)}}=${qty(slope, 'V/s')}`] })
    steps.push({ title: 'Identify the time constant and the coefficients',
      text: 'Tau is the product of resistance and capacitance, measured in seconds. A and B are coefficients, not the source amplitude or another state. Multiplying A by the present voltage and B by the source voltage gives two contributions to the slope.',
      latex: [String.raw`\tau=R_sC=` + qty(tau, 's'),
        String.raw`\dot{x}=Ax+Bu,\qquad A=-\frac1\tau,\quad B=\frac1\tau`,
        String.raw`\dot{x}=` + String.raw`${par(-1 / tau)}${par(vc)}+${par(1 / tau)}${par(u)}=${qty(slope, 'V/s')}`] })
    steps.push({ title: 'Separate a constant-source example from this changing source',
      text: 'If the source is held at a constant voltage U, the initial value and differential equation give the exponential below. This experiment uses a triangle source, so U cannot be replaced by the changing u(t) in that formula. Its complete walkthrough solves each rising and falling interval.',
      latex: [String.raw`x(t)=U+[x(0^+)-U]e^{-t/\tau}\quad\text{only for constant }U`,
        String.raw`x(\tau)-U=[x(0^+)-U]e^{-1}\approx0.368[x(0^+)-U]`],
      note: 'Open State equation next for the full response of this triangle-driven circuit. Scope shows that response as a waveform; Equations checks the circuit at the cursor.' })
    return { steps, slope, current }
  }
  const li = x.dyn.states.findIndex(s => s.id === 'L1'), il = x.now.x[li], L = el.L1.value
  const A = [[0, 1 / C], [-1 / L, -R / L]], B = [[0], [1 / L]]
  const slopes = [il / C, (u - vc - R * il) / L]
  steps.push({ title: 'Choose and order the two states',
    text: 'The capacitor stores energy through its voltage. The inductor stores energy through its current. Put capacitor voltage first and inductor current second. A vector is this ordered column, not a new physical quantity. Its entries have different units.',
    latex: [String.raw`x(t)=\begin{bmatrix}v_C(t)\\i_L(t)\end{bmatrix},\qquad\dot{x}(t)=\begin{bmatrix}\dot v_C(t)\\\dot i_L(t)\end{bmatrix}`,
      String.raw`x(t)=` + vec([qty(vc, 'V'), qty(il, 'A')]), String.raw`x(0^+)=` + vec([qty(initial, 'V'), qty(x.tr.x0[li], 'A')])],
    note: 'Inductor current also remains continuous here. Changing its value instantly would require an impulse of voltage.' })
  steps.push({ title: 'Write one physical equation for each stored quantity',
    text: 'Call the source voltage u(t). Every element shares the inductor current in this series loop. The capacitor law gives the first slope. KVL gives the voltage left across the inductor after subtracting resistor and capacitor voltages. The inductor law gives the second slope.',
    latex: [String.raw`i_L=C\dot v_C\quad\Longrightarrow\quad\dot v_C=\frac{i_L}{C}`,
      String.raw`u=Ri_L+L\dot i_L+v_C\quad\Longrightarrow\quad\dot i_L=-\frac{v_C}{L}-\frac{R}{L}i_L+\frac{u}{L}`] })
  steps.push({ title: 'Collect the same equations into matrix rows',
    text: 'The columns follow the chosen state order. Each row contains the coefficients of capacitor voltage and inductor current. B lists the source coefficient for each row. Matrix multiplication means multiplying matching entries and adding them, one row at a time.',
    latex: [String.raw`\dot x=Ax+Bu,\qquad A=\begin{bmatrix}0&1/C\\-1/L&-R/L\end{bmatrix},\quad B=\begin{bmatrix}0\\1/L\end{bmatrix}`,
      String.raw`A=${mat(A)},\qquad B=${mat(B)}`] })
  steps.push({ title: 'Substitute the cursor values row by row',
    text: 'The first result is a voltage slope in volts per second. The second is a current slope in amperes per second. They cannot be added to each other. The coefficients supply the unit conversions needed by each row.',
    latex: [String.raw`\dot v_C=` + String.raw`${par(1 / C)}${par(il)}=${qty(slopes[0], 'V/s')}`,
      String.raw`\dot i_L=` + String.raw`${par(-1 / L)}${par(vc)}+${par(-R / L)}${par(il)}+${par(1 / L)}${par(u)}=${qty(slopes[1], 'A/s')}`] })
  steps.push({ title: 'Distinguish the state from the output you measure',
    text: 'An output y(t) is a quantity you choose to observe. For resistor voltage, multiply inductor current by resistance. In the output equation, C_y is a matrix of output coefficients, not the capacitor’s capacitance. D_y describes any direct source contribution, which is zero for this output.',
    latex: [String.raw`y=v_R=Ri_L=C_yx+D_yu,\qquad C_y=\begin{bmatrix}0&R\end{bmatrix},\quad D_y=0`,
      String.raw`y=${par(R)}${par(il)}=${qty(R * il, 'V')}`],
    note: 'Open State equation to solve these coupled equations through time. Their roots describe natural decay or ringing; the initial state determines how much of each natural response appears.' })
  return { steps, A, B, slopes }
}

function phasorSteps(x) {
  const source = x.net.elements.find(e => e.id === 'V1').wave
  const R = x.net.elements.find(e => e.id === 'R1').value, C = x.net.elements.find(e => e.id === 'C1').value
  const w = x.omega, f = w / (2 * Math.PI), peak = Math.abs(source.amp)
  const phase = (source.phase || 0) + (source.amp < 0 ? Math.PI : 0)
  const V = cx.polar(peak, phase), Z = [R, -1 / (w * C)], I = cx.cdiv(V, Z)
  const denominator = Z[0] ** 2 + Z[1] ** 2
  const steps = [{ title: 'Read amplitude, frequency and phase before using complex numbers',
    text: 'The source is a sine wave. Its peak amplitude is in volts, frequency f is in cycles per second, angular frequency omega is in radians per second, and phase phi tells where the wave starts. The period T is the time for one cycle.',
    latex: [String.raw`v_s(t)=A_{\mathrm{pk}}\sin(\omega t+\varphi),\qquad \omega=2\pi f,\quad T=1/f`,
      String.raw`A_{\mathrm{pk}}=` + qty(peak, 'V') + String.raw`,\quad f=` + qty(f, 'Hz') + String.raw`,\quad T=` + qty(1 / f, 's'),
      String.raw`v_s(t)=` + String.raw`${n(peak)}\sin(${n(w)}t+${par(phase)})\,\mathrm V`],
    note: 'The amplitude control can be signed. A negative setting is represented here by a positive peak amplitude and a phase shifted by 180 degrees. It is the same physical waveform.' },
  { title: 'Represent one complex number in two forms',
    text: 'The imaginary unit j satisfies j squared equals minus one. Rectangular form a + jb gives horizontal and vertical components. Polar form gives a magnitude and an angle. They represent the same number. atan2 chooses the angle in the correct quadrant; an ordinary arctangent of b/a alone can choose the wrong one.',
    latex: [String.raw`j^2=-1,\qquad z=a+jb=M(\cos\theta+j\sin\theta)=Me^{j\theta}`,
      String.raw`M=\sqrt{a^2+b^2},\qquad\theta=\operatorname{atan2}(b,a),\quad a=M\cos\theta,\quad b=M\sin\theta`] },
  { title: 'Define the phasor and recover the waveform',
    text: 'A capital phasor V_s stores the peak amplitude and phase of this sinusoid. It does not store time and is not the instantaneous voltage v_s(T). This lab uses a sine reference: rotate V_s by omega times t, then take the imaginary part. Phasors describe steady sinusoids, so startup needs a separate time-domain solution.',
    latex: [String.raw`V_s=A_{\mathrm{pk}}e^{j\varphi}=` + rect(V) + String.raw`\,\mathrm V=` + polar(V) + String.raw`\,\mathrm V`,
      String.raw`v_{s,\mathrm{ss}}(t)=\operatorname{Im}\{V_se^{j\omega t}\}`, String.raw`V_{s,\mathrm{rms}}=|V_s|/\sqrt2`],
    note: 'The calculations use peak amplitudes. RMS is a different amplitude convention used in power calculations. At zero amplitude, a phase angle has no physical meaning.' },
  { title: 'Connect differentiation with complex impedance',
    text: 'Differentiating a sinusoid multiplies its complex amplitude by j times omega. Apply that rule to the capacitor and inductor laws. Impedance Z is the complex ratio of voltage to current, measured in ohms. The resistor has no phase shift, while capacitor and inductor impedances have opposite imaginary signs.',
    latex: [String.raw`\frac d{dt}\operatorname{Im}\{Ve^{j\omega t}\}=\operatorname{Im}\{j\omega Ve^{j\omega t}\}`,
      String.raw`I_C=j\omega CV_C\Rightarrow Z_C=\frac1{j\omega C}=-\frac j{\omega C}`,
      String.raw`V_L=j\omega LI_L\Rightarrow Z_L=j\omega L,\qquad Z_R=R`] },
  { title: 'Add impedances and divide using a complex conjugate',
    text: 'This RC loop has one common current. Add the rectangular impedances, then divide the source phasor by their sum. The conjugate reverses the imaginary sign. Multiplying top and bottom by it makes the denominator real.',
    latex: [String.raw`Z=R+Z_C=` + rect(Z) + String.raw`\,\Omega`,
      String.raw`I=\frac{V_s}{Z}=\frac{V_sZ^*}{ZZ^*},\qquad ZZ^*=R^2+[1/(\omega C)]^2=` + n(denominator),
      String.raw`\operatorname{Re}I=\frac{` + String.raw`${par(V[0])}${par(Z[0])}+${par(V[1])}${par(Z[1])}}{${n(denominator)}}=${n(I[0])}`,
      String.raw`\operatorname{Im}I=\frac{` + String.raw`${par(V[1])}${par(Z[0])}-${par(V[0])}${par(Z[1])}}{${n(denominator)}}=${n(I[1])}`,
      String.raw`I=` + rect(I) + String.raw`\,\mathrm A=` + polar(I) + String.raw`\,\mathrm A`] },
  { title: 'Choose the next calculation',
    text: 'The phasor current gives amplitude and phase after the natural response has decayed. The State equation route also includes startup from the capacitor’s initial voltage. Equations uses the state at the cursor to solve that particular instant. Open Phasors next to calculate every voltage and compare the arrows with their waveforms.',
    latex: [String.raw`i_{\mathrm{ss}}(t)=|I|\sin(\omega t+\arg I)`, String.raw`v_C(t)=v_{C,\mathrm{ss}}(t)+[v_C(0^+)-v_{C,\mathrm{ss}}(0)]e^{-t/(RC)}`] }]
  return { steps, V, Z, I, peak, phase }
}
