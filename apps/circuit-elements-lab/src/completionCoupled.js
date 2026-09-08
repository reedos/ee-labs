import {complex as z} from '@ee-labs/network'
import {n, rect, polar, mat} from './derivationMath.js'

const step = (title, text, ...latex) => ({title, text, latex: latex.map(line => `&${line}`)})
const row = (label, predicted, measured, unit) => ({label, predicted, measured, unit, tol: 1e-7, abs: 1e-8})
const field = (key, label, unit, value, min, max, scale = 'log') => ({key, label, unit, default: value, min, max, scale})
const sine = (id, node, p, phase = 0) => ({type: 'V', id, nodes: [node, 'gnd'], value: 0, wave: {kind: 'sine', amp: p.A, freq: p.f, phase}})
const element = (type, id, a, b, value) => ({type, id, nodes: [a, b], value})
const leg = (id, x) => [{el: id, x, y: 120, dir: 'v'}, {wire: [x, 40, x, 100]}, {wire: [x, 140, x, 200]}]

export function coupledAnswer(p) {
  const w = 2 * Math.PI * p.f, M = (p.opposed ? -1 : 1) * p.k * Math.sqrt(p.L1 * p.L2)
  const secondary = [p.R2, w * p.L2], mutual = [0, w * M]
  const input = z.cadd([p.R1, w * p.L1], z.cdiv([w * w * M * M, 0], secondary))
  const I1 = z.cdiv([p.A, 0], input), I2 = z.cscale(z.cdiv(z.cmul(mutual, I1), secondary), -1)
  return {w, M, I1, I2, V2: z.cscale(I2, -p.R2)}
}

export function coupledStudy(id, p, x) {
  if (id === 'l1') {
    const a = coupledAnswer(p), det = p.L1 * p.L2 - a.M * a.M
    const A = [[-p.L2 * p.R1 / det, a.M * p.R2 / det], [a.M * p.R1 / det, -p.L1 * p.R2 / det]], B = [[p.L2 / det], [-a.M / det]]
    const i1 = x.sol.i.L1, i2 = x.sol.i.L2, magneticEnergy = .5 * p.L1 * i1 * i1 + .5 * p.L2 * i2 * i2 + a.M * i1 * i2
    return {
      title: 'Use the dot convention in both phasor and state equations',
      intro: 'The windings share magnetic flux, not an electrical wire. Both inductor reference currents point from their upper node toward ground. A dot marks a corresponding winding terminal; reversing one winding changes the mutual-term sign.',
      steps: [
        step('Define the mutual inductance and its sign', 'L1 and L2 are self-inductances in henries. k is the magnitude of coupling, between zero and one. M is signed for the chosen current references: positive when both reference currents enter dotted terminals, negative when one enters an undotted terminal.', String.raw`M=\pm k\sqrt{L_1L_2}=${n(a.M)}\,\mathrm H`, String.raw`L_1L_2-M^2=${n(det)}\,\mathrm{H^2}>0`),
        step('Write the two winding voltage laws', 'Each winding voltage contains a self term and a mutual term. The same signed M appears in both equations because the magnetic coupling is reciprocal.', String.raw`v_{L1}=L_1\dot i_1+M\dot i_2`, String.raw`v_{L2}=M\dot i_1+L_2\dot i_2`),
        step('Combine with the two loop laws', 'In the primary, source voltage equals resistor drop plus winding voltage. In the secondary, the winding and load share the same voltage, while their downward reference currents are opposite by KCL.', String.raw`u=R_1i_1+v_{L1},\qquad v_{L2}=-R_2i_2`, String.raw`\begin{bmatrix}L_1&M\\M&L_2\end{bmatrix}\begin{bmatrix}\dot i_1\\\dot i_2\end{bmatrix}=\begin{bmatrix}u-R_1i_1\\-R_2i_2\end{bmatrix}`),
        step('Invert the inductance matrix to obtain state space', 'The state vector is [i1, i2] in amperes. The positive determinant permits an ordinary differential equation. Perfect coupling is a singular limit and is treated separately by the ideal-transformer lesson.', String.raw`\dot{\boldsymbol x}=A\boldsymbol x+Bu`, String.raw`A=\frac1{L_1L_2-M^2}\begin{bmatrix}-L_2R_1&MR_2\\MR_1&-L_1R_2\end{bmatrix}=${mat(A)}`, String.raw`B=\frac1{L_1L_2-M^2}\begin{bmatrix}L_2\\-M\end{bmatrix}=${mat(B)}`),
        step('Use the same laws for sinusoidal steady state', 'Replace time differentiation by jω. Eliminate the secondary current to expose its reflected impedance in the primary. Its resistance accounts for power delivered to the secondary load.', String.raw`(R_1+j\omega L_1)\underline I_1+j\omega M\underline I_2=\underline U`, String.raw`j\omega M\underline I_1+(R_2+j\omega L_2)\underline I_2=0`, String.raw`\underline I_1=\frac{\underline U}{R_1+j\omega L_1+\omega^2M^2/(R_2+j\omega L_2)}=${rect(a.I1)}\,\mathrm A`, String.raw`\underline I_2=-\frac{j\omega M\underline I_1}{R_2+j\omega L_2}=${rect(a.I2)}\,\mathrm A`),
        step('Check polarity, load voltage and shared magnetic energy', 'Reversing one dot changes secondary polarity but leaves the reflected input impedance unchanged because that impedance contains M squared. Magnetic energy includes the cross term; adding only the two self-energies would miss it.', String.raw`\underline V_{\mathrm{load}}=-R_2\underline I_2=${polar(a.V2)}\,\mathrm V`, String.raw`W=\tfrac12L_1i_1^2+\tfrac12L_2i_2^2+Mi_1i_2=${n(magneticEnergy)}\,\mathrm J`),
      ],
      advantage: 'The same reciprocal model supports induced-voltage, loading, energy and transient calculations. The dot convention makes polarity explicit.',
      limitation: 'This linear model excludes saturation, hysteresis and winding capacitance. Coupling magnitude must stay below one for an invertible state model; ideal-transformer constraints describe a different limit.',
      checks: [row('primary phasor, real part', a.I1[0], x.ac.i.L1[0], 'A'), row('secondary phasor, imaginary part', a.I2[1], x.ac.i.L2[1], 'A'), row('shared magnetic energy', magneticEnergy, x.dyn.stored(x.now.x).reduce((a, b) => a + b, 0), 'J')],
      practice: {prompt: 'Keep both self-inductances fixed and halve k. Calculate the new magnitude of mutual inductance in henries.', target: Math.abs(a.M) / 2, unit: 'H', hint: 'M is proportional to k. The reflected impedance, in contrast, is proportional to M squared.'},
    }
  }
  if (id === 'l2') {
    const reflected = p.RL / (p.ratio * p.ratio), ip = p.A / (p.R1 + reflected), vp = ip * reflected, vs = p.ratio * vp, il = vs / p.RL
    return {
      title: 'An ideal transformer changes voltage, current and apparent load',
      intro: 'Define n = Ns/Np, secondary turns divided by primary turns. The two controlled sources on the schematic are an exact ideal-transformer equivalent: the voltage constraint and the reciprocal current constraint act together.',
      steps: [
        step('Write the voltage and current constraints', 'Primary and secondary voltages are measured from corresponding dotted ends. Define both winding currents into those ends. Conservation of power fixes the current sign.', String.raw`v_s=n v_p,\qquad i_p=-n i_s`, String.raw`v_pi_p+v_si_s=0`),
        step('Relate winding current to load current', 'The load current leaves the secondary positive terminal, so iLoad = −is. Thus input current is n times load current, while secondary voltage is n times primary voltage.', String.raw`i_{\mathrm{load}}=-i_s,\qquad i_p=n i_{\mathrm{load}}`),
        step('Reflect the load to the primary', 'Use the voltage and current ratios together. The impedance ratio is the square of the turns ratio, not the turns ratio itself.', String.raw`Z_{\mathrm{in}}=\frac{v_p}{i_p}=\frac{Z_L}{n^2}`, String.raw`R_{\mathrm{reflected}}=\frac{${n(p.RL)}}{${n(p.ratio)}^2}=${n(reflected)}\,\Omega`),
        step('Include the source resistance', 'The source sees R1 in series with the reflected load. Calculate the primary voltage before multiplying by n; source resistance means the primary voltage need not equal the source voltage.', String.raw`\underline I_p=\frac{\underline U}{R_1+R_L/n^2}=${n(ip)}\,\mathrm A`, String.raw`\underline V_p=\underline I_p R_L/n^2=${n(vp)}\,\mathrm V`, String.raw`\underline V_s=n\underline V_p=${n(vs)}\,\mathrm V,\qquad \underline I_{\mathrm{load}}=\underline V_s/R_L=${n(il)}\,\mathrm A`),
        step('Verify power using peak phasors', 'The ideal transformer absorbs no average power. The source resistor still dissipates power, and that loss is outside the ideal transformer.', String.raw`P_p=\tfrac12V_p I_p=${n(.5 * vp * ip)}\,\mathrm W`, String.raw`P_{\mathrm{load}}=\tfrac12V_s I_{\mathrm{load}}=${n(.5 * vs * il)}\,\mathrm W`),
      ],
      advantage: 'The reflected-load method reduces a transformer-coupled circuit to a familiar source and impedance calculation.',
      limitation: 'The model omits magnetizing current, leakage, losses and saturation. It is an ideal AC operating model; it does not imply a physical transformer can sustain these ratios under DC excitation.',
      checks: [row('secondary voltage amplitude', Math.abs(vs), z.cabs(x.ac.volt.V2), 'V'), row('primary current amplitude', Math.abs(ip), z.cabs(x.ac.i.R1), 'A'), row('load average power', .5 * vs * il, .5 * z.cabs(x.ac.volt.RL) ** 2 / p.RL, 'W')],
      practice: {prompt: 'Double the turns ratio n, leaving the secondary load unchanged. What resistance does the primary then see from the transformer, in ohms?', target: reflected / 4, unit: 'Ω', hint: 'Use RL/(2n)². Keep the source resistance separate from the transformer input resistance.'},
    }
  }
  const w = 2 * Math.PI * p.f, U = [0, -2 * Math.PI / 3, 2 * Math.PI / 3].map(phi => z.polar(p.A, phi))
  const balanced = id === 'l3'
  const Z = balanced ? [p.R, w * p.L] : null
  const Y = balanced ? null : [p.R1, p.R2, p.R3].map(r => 1 / r)
  const neutral = balanced || p.neutral ? [0, 0] : z.cscale(U.reduce((s, u, k) => z.cadd(s, z.cscale(u, Y[k])), [0, 0]), 1 / Y.reduce((a, b) => a + b, 0))
  const I = U.map((u, k) => balanced ? z.cdiv(u, Z) : z.cscale(z.csub(u, neutral), Y[k]))
  const line = z.csub(U[0], U[1]), totalPower = balanced ? 1.5 * p.A * p.A * p.R / (p.R * p.R + (w * p.L) ** 2) : I.reduce((s, i, k) => s + .5 * z.cabs(i) ** 2 * [p.R1, p.R2, p.R3][k], 0)
  const currentSum = I.reduce((s, i) => z.cadd(s, i), [0, 0])
  return {
    title: balanced ? 'Relate phase, line and total three-phase quantities' : 'Solve an unbalanced star with and without its neutral',
    intro: 'The sources form a positive-sequence three-phase supply. Va, Vb and Vc are phase-to-source-neutral voltages, separated by 120 degrees. The lab uses peak phasors; divide magnitudes by √2 for RMS.',
    steps: [
      step('Write all three source phasors', 'Choose phase A as the reference. The 120-degree separation is an angle difference, not a time delay independent of frequency.', String.raw`\underline V_a=${polar(U[0])},\quad \underline V_b=${polar(U[1])},\quad \underline V_c=${polar(U[2])}\,\mathrm V`),
      step('Subtract phase voltages to obtain a line voltage', 'A line-to-line voltage is a phasor difference. For this positive sequence, Vab leads Va by 30 degrees and has √3 times its magnitude.', String.raw`\underline V_{ab}=\underline V_a-\underline V_b=${polar(line)}\,\mathrm V`, String.raw`|V_{LL,\mathrm{rms}}|=\sqrt3\,|V_{\mathrm{phase,rms}}|=${n(z.cabs(line) / Math.sqrt(2))}\,\mathrm V`),
      ...(balanced ? [
        step('Solve one phase and rotate the answer', 'The three star impedances are equal. In a star connection each line current is its phase current. The same impedance angle shifts every current relative to its phase voltage.', String.raw`Z_{\mathrm{phase}}=R+j\omega L=${rect(Z)}\,\Omega`, String.raw`\underline I_a=\underline V_a/Z_{\mathrm{phase}}=${polar(I[0])}\,\mathrm A`, String.raw`\underline I_b=\underline I_a e^{-j2\pi/3},\qquad \underline I_c=\underline I_a e^{j2\pi/3}`),
        step('Add currents and average powers', 'Balanced line currents sum to zero, so no neutral current is required. Total real power is three times phase power. Use RMS values consistently in the line-voltage formula.', String.raw`\underline I_a+\underline I_b+\underline I_c=0`, String.raw`P=3V_{\mathrm{phase,rms}}I_{\mathrm{phase,rms}}\cos\theta=\sqrt3 V_{LL,\mathrm{rms}}I_{\mathrm{line,rms}}\cos\theta=${n(totalPower)}\,\mathrm W`),
        step('Contrast a balanced delta connection', 'In a delta connection each branch sees line voltage. The line current is a phasor difference of adjacent branch currents, giving √3 times branch-current magnitude. Do not use the star current relation for delta.', String.raw`V_{\mathrm{phase},\Delta}=V_{LL},\qquad |I_{\mathrm{line},\Delta}|=\sqrt3|I_{\mathrm{phase},\Delta}|`, String.raw`Z_Y=Z_\Delta/3\quad\text{for equivalent balanced terminal loads}`),
      ] : [
        step('Find the load-neutral voltage', 'When the neutral switch is closed, N is held at source ground. When it opens, the three load currents must sum to zero, which determines the floating neutral. This example uses unequal resistive loads to isolate the neutral-shift effect.', String.raw`\sum_{k=a,b,c}\frac{\underline V_k-\underline V_N}{R_k}=0\quad\text{with the neutral open}`, p.neutral ? String.raw`\underline V_N=0\,\mathrm V\quad\text{neutral connected}` : String.raw`\underline V_N=\frac{\underline V_a/R_1+\underline V_b/R_2+\underline V_c/R_3}{1/R_1+1/R_2+1/R_3}=${rect(neutral)}\,\mathrm V`),
        step('Use each actual phase-to-load-neutral voltage', 'The supply remains balanced, but unequal loads with a floating neutral no longer receive equal voltage magnitudes. Subtract VN before dividing by each load resistance.', String.raw`\underline I_a=\frac{\underline V_a-\underline V_N}{R_1}=${rect(I[0])}\,\mathrm A`, String.raw`\underline I_b=${rect(I[1])}\,\mathrm A,\qquad \underline I_c=${rect(I[2])}\,\mathrm A`),
        step('Check the neutral current and total power', 'With the neutral connected, the sum of phase currents returns through that conductor. With it open, the current sum is zero and the neutral voltage shifts instead. Calculate power phase by phase for the unbalanced case.', String.raw`\underline I_N=\underline I_a+\underline I_b+\underline I_c=${rect(currentSum)}\,\mathrm A`, String.raw`P=\tfrac12\sum_k |\underline I_k|^2R_k=${n(totalPower)}\,\mathrm W`),
      ]),
    ],
    advantage: balanced ? 'Symmetry reduces a balanced three-phase network to one phase, then recovers line quantities with phasor relations.' : 'A neutral-node KCL equation handles unbalanced loads without assuming equal phase voltages at the load.',
    limitation: balanced ? 'The √3 shortcuts require the stated balanced connection and phase sequence. Unbalanced networks need separate phase equations.' : 'The balanced three-phase power shortcut does not apply to this unbalanced load. The model treats ideal sinusoidal sources and ideal resistive loads.',
    checks: [row('phase A current, real part', I[0][0], x.ac.i.R1[0], 'A'), row('phase B current, imaginary part', I[1][1], x.ac.i.R2[1], 'A'), ...(balanced ? [] : [row('neutral voltage, real part', neutral[0], x.ac.v.N[0], 'V')])],
    practice: balanced ? {prompt: 'A balanced star supply has 120 V RMS phase-to-neutral. Calculate its RMS line-to-line voltage.', target: 120 * Math.sqrt(3), unit: 'V', hint: 'For a balanced star, line-to-line voltage magnitude is √3 times phase-to-neutral voltage magnitude.'} : {prompt: 'With the neutral open, calculate the magnitude of the phasor sum of all three line currents.', target: 0, unit: 'A', hint: 'Apply KCL at the floating load neutral. Add phasors, not current magnitudes.'},
  }
}

export function completionCoupled(groups) {
  const sourceParams = [field('A', 'Source peak amplitude', 'V', 8, 1, 20, 'linear'), field('f', 'Frequency', 'Hz', 100, 20, 1000), field('N', 'Window', 'cycles', 5, 1, 12, 'linear')]
  const make = (id, name, params, net, layout, prerequisites, out, phasor, scope) => ({id, name, params, net, layout, prerequisites, out, phasor, scope, group: groups[10], terms: ['phasor', 'kcl', 'kvl'], claim: {}, show: 'v', view: 'phasor', views: ['equations', 'scope', 'phasor'], window: p => p.N / p.f, cursor: .85, study: coupledStudy, studyViews: ['phasor'], studyOwnPhasor: true,
    headline: {label: 'the selected output voltage amplitude', tag: '|V_out|', unit: 'V', where: null, value: x => z.cabs(x.ac[out.q][out.key])},
    lesson: {see: 'Begin with the voltage and current references on the schematic. The worked method defines the coupling or connection before using its equations, then checks the calculated phasors against the original circuit.', why: 'These foundation models explain terminal behavior without requiring motor, power-flow or radio prerequisites. Keep the reference directions and peak-versus-RMS convention consistent, and check the limits before applying a shortcut.', try: [{say: 'Change the load or coupling and predict the change in output before reading the result.', reads: []}, {say: 'Compare the phase angles and magnitudes in the worked calculation with the Phasors view.', reads: []}]},
  })
  const winding = make('l1', 'Mutual inductance: dots, reflected load and two states', [...sourceParams, field('R1', 'R₁', 'Ω', 20, 5, 200), field('R2', 'R₂', 'Ω', 40, 5, 200), field('L1', 'L₁', 'H', .02, .005, .1), field('L2', 'L₂', 'H', .03, .005, .1), field('k', 'Coupling magnitude k', '', .6, 0, .95, 'linear'), {key: 'opposed', label: 'Secondary dot', kind: 'toggle', default: false, on: 'lower terminal', off: 'upper terminal'}],
    p => ({elements: [sine('V1', 'in', p), element('R', 'R1', 'in', 'a', p.R1), {...element('L', 'L1', 'a', 'gnd', p.L1), x0: 0, coupledTo: 'L2', mutual: (p.opposed ? -1 : 1) * p.k * Math.sqrt(p.L1 * p.L2)}, {...element('L', 'L2', 'b', 'gnd', p.L2), x0: 0}, element('R', 'R2', 'b', 'gnd', p.R2)]}),
    {w: 770, h: 260, items: [{node:'in',x:50,y:40,side:'t'}, ...leg('V1', 50), {el: 'R1', x: 150, y: 40, dir: 'h'}, {wire: [50, 40, 130, 40]}, {wire: [170, 40, 250, 40]}, ...leg('L1', 250), ...leg('L2', 430), ...leg('R2', 650), {wire: [430, 40, 650, 40]}, {wire: [50, 200, 250, 200]}, {wire: [430, 200, 650, 200]}, {gnd: [100, 200]}, {gnd: [520, 200]}, {text: '•', x: 232, y: 94}, {text: '•', x: 412, y: 94, when: {key: 'opposed', value: false}}, {text: '•', x: 412, y: 158, when: {key: 'opposed', value: true}}, {text: 'magnetic coupling', x: 290, y: 235}, {node: 'a', x: 250, y: 40, side: 't'}, {node: 'b', x: 430, y: 40, side: 't'}]},
    ['j7', 'h9'], {q: 'volt', key: 'R2', label: 'v_out'}, {volts: ['R1', 'L1'], total: 'V1', current: 'R1'}, {left: {unit: 'V', traces: [{q: 'volt', key: 'V1', label: 'v_in', dim: true}, {q: 'volt', key: 'R2', label: 'v_out'}]}, right: {unit: 'A', traces: [{q: 'i', key: 'L1', label: 'i_1'}, {q: 'i', key: 'L2', label: 'i_2'}]}})
  winding.views.push('state'); winding.studyViews.push('state'); winding.studyOwnState = true
  winding.closedHeadline = p => z.cabs(coupledAnswer(p).V2)
  const transformer = make('l2', 'Ideal transformer: turns ratio and reflected impedance', [...sourceParams, field('R1', 'R₁', 'Ω', 20, 1, 200), field('RL', 'Load R_L', 'Ω', 200, 10, 1000), field('ratio', 'Turns ratio Ns/Np', '', 2, .25, 4, 'linear')],
    p => ({elements: [sine('V1', 'in', p), element('R', 'R1', 'in', 'p', p.R1), {type: 'CCCS', id: 'I1', nodes: ['p', 'gnd'], over: 'V2', gain: -p.ratio}, {type: 'VCVS', id: 'V2', nodes: ['s', 'gnd'], ctrl: ['p', 'gnd'], gain: p.ratio}, element('R', 'RL', 's', 'gnd', p.RL)]}),
    {w: 770, h: 250, items: [{node:'in',x:50,y:40,side:'t'}, ...leg('V1', 50), {el: 'R1', x: 150, y: 40, dir: 'h'}, {wire: [50, 40, 130, 40]}, {wire: [170, 40, 250, 40]}, ...leg('I1', 250), ...leg('V2', 430), ...leg('RL', 650), {wire: [430, 40, 650, 40]}, {wire: [50, 200, 250, 200]}, {wire: [430, 200, 650, 200]}, {gnd: [100, 200]}, {gnd: [520, 200]}, {node: 'p', x: 250, y: 40, side: 't'}, {node: 's', x: 430, y: 40, side: 't'}, {text: 'ideal transformer equivalent', x: 230, y: 230}]},
    ['l1', 'd8'], {q: 'volt', key: 'RL', label: 'v_out'}, {volts: ['R1', 'I1'], total: 'V1', current: 'R1'}, {left: {unit: 'V', traces: [{q: 'v', key: 'p', label: 'v_p'}, {q: 'v', key: 's', label: 'v_s'}]}})
  transformer.closedHeadline = p => Math.abs(p.ratio * p.A * (p.RL / p.ratio ** 2) / (p.R1 + p.RL / p.ratio ** 2))
  const phaseLayout = balanced => ({w: 740, h: 410, items: [
    ...[70, 170, 270].flatMap((y, i) => [{el: `V${i+1}`, x: 100, y, dir: 'h', flip: true}, {wire: [0, y, 80, y]}, {wire: [120, y, 230, y]}, {el: `R${i+1}`, x: 250, y, dir: 'h'}, ...(balanced ? [{wire: [270, y, 400, y]}, {node: `r${i}`, x:340, y, side:'t'}, {el: `L${i+1}`, x: 420, y, dir: 'h'}, {wire: [440, y, 550, y]}] : [{wire: [270, y, 550, y]}]), {node: ['a','b','c'][i], x: 180, y, side: 't'}]),
    {wire: [0, 70, 0, 360]}, {wire: [550, 70, 550, 360]}, {wire: [0, 360, 280, 360]}, {el: 'S1', x: 300, y: 360, dir: 'h', flip: true}, {wire: [320, 360, 550, 360]}, {gnd: [0, 360]}, {node: 'N', x: 550, y: 170, side: 'r'},
  ].map(it => it.wire ? {...it,wire:it.wire.map((v,i)=>i%2===0?v+40:v)} : it.gnd ? {...it,gnd:[it.gnd[0]+40,it.gnd[1]]} : {...it,x:it.x+40})})
  const phases = [true, false].map(balanced => {
    const id = balanced ? 'l3' : 'l4'
    const exp = make(id, balanced ? 'Balanced three-phase: star, delta and power' : 'Unbalanced three-phase: the floating neutral', [...sourceParams.map(k => k.key === 'A' ? {...k, default: 120 * Math.sqrt(2), min: 10, max: 350, label: 'Phase peak voltage'} : k.key === 'f' ? {...k, default: 60} : k), ...(balanced ? [field('R', 'Phase resistance', 'Ω', 30, 10, 200), field('L', 'Phase inductance', 'H', .03, .001, .2)] : [field('R1', 'R₁', 'Ω', 30, 10, 200), field('R2', 'R₂', 'Ω', 60, 10, 200), field('R3', 'R₃', 'Ω', 90, 10, 200), {key: 'neutral', label: 'Neutral connection', kind: 'toggle', default: false, on: 'connected', off: 'open'}])],
      p => ({elements: [
        ...['a','b','c'].map((node, i) => sine(`V${i+1}`, node, p, [0,-2*Math.PI/3,2*Math.PI/3][i])),
        ...['a','b','c'].flatMap((node, i) => balanced ? [element('R', `R${i+1}`, node, `r${i}`, p.R), {...element('L', `L${i+1}`, `r${i}`, 'N', p.L), x0: 0}] : [element('R', `R${i+1}`, node, 'N', p[`R${i+1}`])]),
        {type: 'SW', id: 'S1', nodes: ['N','gnd'], closed: balanced || p.neutral, before: balanced || p.neutral},
      ]}), phaseLayout(balanced), balanced ? ['l2', 'h5'] : ['l3', 'd1'], {q: 'volt', key: 'R1', label: 'v_phase_load'}, {volts: balanced ? ['R1', 'L1'] : ['R1', 'S1'], total: 'V1', current: 'R1'}, {left: {unit: 'V', traces: ['a','b','c'].map(node => ({q: 'v', key: node, label: `v_${node}`}))}, right: {unit: 'A', traces: ['R1','R2','R3'].map((key, i) => ({q: 'i', key, label: `i_${['a','b','c'][i]}`}))}})
    exp.closedHeadline = p => {if (balanced) return Math.abs(p.A) * p.R / Math.hypot(p.R, 2*Math.PI*p.f*p.L); const u = [0,-2*Math.PI/3,2*Math.PI/3].map(phi => z.polar(p.A, phi)); const r=[p.R1,p.R2,p.R3]; const vn=p.neutral?[0,0]:z.cscale(u.reduce((s,v,i)=>z.cadd(s,z.cscale(v,1/r[i])),[0,0]),1/r.reduce((s,v)=>s+1/v,0));return z.cabs(z.csub(u[0],vn))}
    exp.fixedSwitches = balanced
    if (balanced) exp.headline = {...exp.headline, label:'the phase A resistor voltage amplitude',tag:'|V_R1|'}
    return exp
  })
  return [winding, transformer, ...phases]
}
