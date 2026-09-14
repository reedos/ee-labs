import {complex as z} from '@ee-labs/network'
import {n, rect, polar} from './derivationMath.js'

const step = (title, text, ...latex) => ({title, text, latex: latex.map(line => `&${line}`)})
const row = (label, predicted, measured, unit) => ({label, predicted, measured, unit, tol: 1e-7, abs: 1e-9})
const abs = z.cabs

export function acEquivalent(p) {
  const w = 2 * Math.PI * p.f, U = z.polar(p.A, p.phi * Math.PI / 180)
  const divider = [1, w * p.R1 * p.C1]
  const Vth = z.cdiv(U, divider), Zth = z.cdiv([p.R1, 0], divider), Zload = [p.R2, w * p.L1]
  const I = z.cdiv(Vth, z.cadd(Zth, Zload)), Vload = z.cmul(I, Zload)
  const input = z.cdiv(z.csub(U, Vload), [p.R1, 0])
  const S = z.cscale(z.cmul(U, z.conj(input)), .5)
  return {w, U, Vth, Zth, Zload, I, Vload, S}
}

export function acStudy(id, p, x) {
  const a = acEquivalent(p)
  const actualI = x.ac.i.L1, actualV = x.ac.volt.C1
  const actualS = z.cscale(z.cmul(x.ac.volt.V1, z.conj(x.ac.i.V1)), -.5)
  const power = .5 * abs(a.I) ** 2 * p.R2, maximum = abs(a.Vth) ** 2 / (8 * a.Zth[0])
  const matched = {R2: a.Zth[0], L1: -a.Zth[1] / a.w}
  const targetC = p.L1 / (p.R2 * p.R2 + (a.w * p.L1) ** 2)
  const common = [
    step('Define the port and the phasor convention', 'Node n relative to ground is the port. R2 and L1 form the load branch; V1, R1 and C1 form the source network. Underlined quantities here use peak amplitudes with the lab’s sine reference.', String.raw`u(t)=A\sin(\omega t+\phi),\qquad \underline U=${polar(a.U)}\,\mathrm V`, String.raw`\omega=2\pi f=${n(a.w)}\,\mathrm{rad/s},\qquad V_{\mathrm{rms}}=|\underline U|/\sqrt2`),
    step('Open the load branch to find the port voltage', 'Removing R2 and L1 leaves a series RC divider. Use its complex ratio: a phasor has both real and imaginary parts, and its magnitude alone is not enough for the next division.', String.raw`\underline V_{\mathrm{Th}}=\frac{\underline U}{1+j\omega R_1C_1}=${rect(a.Vth)}\,\mathrm V`),
    step('Deactivate the source and find the port impedance', 'Replace the independent voltage source by a short. The port sees R1 in parallel with the capacitor impedance. The equivalent impedance is frequency dependent.', String.raw`Z_{\mathrm{Th}}=R_1\parallel\frac1{j\omega C_1}=\frac{R_1}{1+j\omega R_1C_1}=${rect(a.Zth)}\,\Omega`),
  ]
  let steps, title, practice, action
  if (id === 'h9') {
    title = 'Use AC Thévenin and Norton equivalents'
    const In = z.cdiv(a.Vth, a.Zth)
    steps = [...common,
      step('Convert the equivalent to Norton form', 'The Norton current points into the port from ground. Divide complex voltage by complex impedance; keep the same impedance in parallel with the source.', String.raw`\underline I_N=\frac{\underline V_{\mathrm{Th}}}{Z_{\mathrm{Th}}}=${rect(In)}\,\mathrm A`),
      step('Reconnect the complex load', 'The inductor contributes jωL1 in series with R2. Add complex impedances before dividing. Multiplying back gives the port voltage.', String.raw`Z_L=R_2+j\omega L_1=${rect(a.Zload)}\,\Omega`, String.raw`\underline I_L=\frac{\underline V_{\mathrm{Th}}}{Z_{\mathrm{Th}}+Z_L}=${rect(a.I)}\,\mathrm A`, String.raw`\underline V_L=Z_L\underline I_L=${rect(a.Vload)}\,\mathrm V`),
      step('Check the original branched circuit', 'The native complex nodal solve keeps all original branches. Its load-current and port-voltage components must agree with the independently reduced circuit.', String.raw`\underline I_{L,\mathrm{nodal}}=${rect(actualI)}\,\mathrm A`, String.raw`\underline V_{n,\mathrm{nodal}}=${rect(actualV)}\,\mathrm V`),
    ]
    practice = {prompt: 'Calculate the magnitude of the Norton source current in amperes at these settings.', target: abs(In), unit: 'A', hint: 'Divide VTh by ZTh as complex numbers, then take the magnitude. For this particular source network the ratio simplifies to U/R1.'}
  } else if (id === 'h10') {
    title = 'Maximize load power with conjugate matching'
    steps = [...common,
      step('Separate resistance and reactance in the power expression', 'Let ZTh = Rth + jXth and ZL = RL + jXL. Only RL absorbs average load power. The magnitude-squared denominator shows the cost of resistance and uncompensated reactance.', String.raw`P_L=\frac{|\underline V_{\mathrm{Th}}|^2R_L}{2[(R_{\mathrm{Th}}+R_L)^2+(X_{\mathrm{Th}}+X_L)^2]}`),
      step('Cancel reactance, then optimize resistance', 'At a fixed source frequency, cancel the imaginary parts first. Maximizing the remaining resistance ratio gives RL = Rth. Here Xth is capacitive, so an inductive load can supply the opposite reactance.', String.raw`Z_L=Z_{\mathrm{Th}}^*=R_{\mathrm{Th}}-jX_{\mathrm{Th}}`, String.raw`R_2=${n(matched.R2)}\,\Omega,\qquad L_1=-X_{\mathrm{Th}}/\omega=${n(matched.L1)}\,\mathrm H`),
      step('Compare actual and maximum average load power', 'These expressions use peak phasors, which supplies the factor of one half. In an RMS convention the corresponding maximum is |VTh,rms|²/(4Rth).', String.raw`P_L=\tfrac12|\underline I_L|^2R_2=${n(power)}\,\mathrm W`, String.raw`P_{L,\max}=\frac{|\underline V_{\mathrm{Th}}|^2}{8R_{\mathrm{Th}}}=${n(maximum)}\,\mathrm W`),
      step('Recognize the design tradeoff', 'Maximum power transfer is not maximum efficiency. At conjugate match the equivalent source resistance dissipates the same average power as the load resistance. Changing frequency generally breaks the match.', String.raw`P_{R_{\mathrm{Th}}}=P_L\quad\text{at conjugate match}`),
    ]
    action = {label: 'Apply the matched load', settings: matched}
    practice = {prompt: 'If the source peak amplitude doubles while the impedances stay fixed, calculate the new maximum average load power in watts.', target: 4 * maximum, unit: 'W', hint: 'Average power is proportional to voltage amplitude squared, so doubling amplitude multiplies power by four.'}
  } else {
    title = 'Correct power factor with a shunt capacitor'
    const B = a.w * p.C1 - a.w * p.L1 / (p.R2 * p.R2 + (a.w * p.L1) ** 2)
    const pf = abs(a.S) === 0 ? null : a.S[0] / abs(a.S)
    steps = [common[0],
      step('Write the parallel load admittance', 'The RL branch takes lagging current. The shunt capacitor supplies a leading branch current. Add admittances at node n to see their reactive parts cancel.', String.raw`Y_n=\frac1{R_2+j\omega L_1}+j\omega C_1=G+jB`, String.raw`G=\frac{R_2}{R_2^2+(\omega L_1)^2},\qquad B=\omega C_1-\frac{\omega L_1}{R_2^2+(\omega L_1)^2}=${n(B)}\,\mathrm S`),
      step('Choose capacitance for zero net susceptance', 'Set B = 0. This cancels reactive current at the branch node; the series feeder R1 is purely resistive, so source current also becomes in phase with source voltage.', String.raw`C_{\mathrm{correct}}=\frac{L_1}{R_2^2+(\omega L_1)^2}=${n(targetC)}\,\mathrm F`),
      step('Find source complex power using a consistent reference', 'Use current leaving the positive source terminal. For peak phasors S = ½ U I*. Its real part P is average power in watts; its imaginary part Q is reactive power in var; |S| is apparent power in VA.', String.raw`S=\tfrac12\underline U\underline I_s^*=${rect(a.S)}\,\mathrm{VA}`, String.raw`P=${n(a.S[0])}\,\mathrm W,\quad Q=${n(a.S[1])}\,\mathrm{var},\quad |S|=${n(abs(a.S))}\,\mathrm{VA}`),
      step('Read the power factor and the effect of compensation', 'Power factor is P/|S| when nonzero power is supplied. Positive Q is inductive (lagging), and negative Q is capacitive (leading). The correction changes the loaded port voltage too, because R1 has a voltage drop.', pf === null ? String.raw`P=Q=|S|=0:\quad\text{power factor is not defined}` : String.raw`\mathrm{pf}=P/|S|=${n(pf)}`, String.raw`Q=0\Rightarrow \mathrm{pf}=1\quad\text{for nonzero source amplitude}`),
      step('Check the operating-frequency limitation', 'The chosen capacitance is correct for this frequency and this RL load. Too much capacitance overcompensates and gives leading power factor. The capacitor carries current but absorbs zero average power in the ideal model.', String.raw`P_C=0,\qquad Q_C=-\tfrac12\omega C_1|\underline V_n|^2`),
    ]
    action = {label: 'Apply power-factor correction', settings: {C1: targetC}}
    practice = {prompt: 'At unity power factor, if the source supplies 20 W at 10 V RMS, what source RMS current is required in amperes?', target: 2, unit: 'A', hint: 'Use P = Vrms Irms pf. These are RMS quantities, so there is no extra factor of one half.'}
  }
  return {title, intro: 'Use phasors for the steady sinusoid, not the startup transient. Scope and state equations still show how the physical circuit reaches that steady behavior.', steps, practice, action,
    advantage: id === 'h9' ? 'Port equivalents simplify repeated calculations with changing loads. They work for linear AC circuits when impedances and phasors use the same frequency.' : id === 'h10' ? 'Conjugate matching gives the greatest average load power for a fixed linear source equivalent at one frequency.' : 'Shunt compensation can reduce reactive source current and apparent power required for a given real load demand.',
    limitation: id === 'h9' ? 'An AC equivalent is generally frequency dependent and does not carry the initial-state transient. Dependent sources stay active when finding port impedance.' : id === 'h10' ? 'Maximum power is different from maximum efficiency or voltage transfer. Component limits and available tuning range can prevent a physical match.' : 'Correction is frequency and load dependent. Real capacitors also have losses, ratings and switching effects; the ideal circuit does not model those effects.',
    checks: [row('load current, real component', a.I[0], actualI[0], 'A'), row('load current, imaginary component', a.I[1], actualI[1], 'A'), row('source average power', a.S[0], actualS[0], 'W'), row('source reactive power', a.S[1], actualS[1], 'var')],
  }
}

export function completionAC(base) {
  const original = base.find(e => e.id === 'h8')
  return [
    ['h9', 'AC Thévenin and Norton equivalents', ['h8', 'd8'], 700],
    ['h10', 'Conjugate matching for maximum average power', ['h9', 'd6'], 800],
    ['h11', 'Power-factor correction at the source', ['h9', 'h5'], 900],
  ].map(([id, name, prerequisites, frequency]) => ({...original, id, name, prerequisites, claim: {}, study: acStudy, studyViews: ['phasor', 'acpower'],
    params: original.params.map(k => ({...k, ...(k.key === 'f' ? {default: frequency} : {})})),
    headline: {label: 'the steady port voltage amplitude', tag: '|V_n|', unit: 'V', where: null, value: x => abs(x.ac.volt.C1)},
    closedHeadline: p => abs(acEquivalent(p).Vload),
    lesson: {see: 'The source resistor feeds a capacitor in parallel with an RL load. Use the same branched circuit to connect a port equivalent, complex power and a practical design choice.', why: 'Keep complex signs and the amplitude convention throughout the calculation. A steady-state design result does not remove startup behavior or guarantee the same result at another frequency. The worked method compares independent reduction with the native nodal solve.', try: [{say: 'Change the frequency and predict how the required load or compensation changes.', reads: []}, {say: 'Compare Scope with Phasors after the initial transient decays.', reads: []}]},
  }))
}
