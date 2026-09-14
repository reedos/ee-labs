import {complex as z} from '@ee-labs/network'
import {n, rect} from './derivationMath.js'

const step = (title, text, ...latex) => ({title, text, latex: latex.map(line => `&${line}`)})
const row = (label, predicted, measured, unit, abs = 1e-8) => ({label, predicted, measured, unit, tol: 1e-7, abs})

export function loadedRC(p) {
  const gain = p.RL === undefined ? 1 : p.RL / (p.R1 + p.RL)
  const tau = (p.RL === undefined ? p.R1 : p.R1 * p.RL / (p.R1 + p.RL)) * p.C1
  const H = z.cdiv([gain, 0], [1, 2 * Math.PI * p.f * tau])
  const output = z.cmul(z.polar(p.A, (p.phi || 0) * Math.PI / 180), H)
  return {gain, tau, H, output}
}

export function squareResponse(p, t) {
  const tau = p.R1 * p.C1, T = 1 / p.f
  const start = -p.A * Math.tanh(T / (4 * tau))
  const local = ((t % T) + T) % T, first = local < T / 2
  const periodic = first ? p.A + (start - p.A) * Math.exp(-local / tau) : -p.A + (-start + p.A) * Math.exp(-(local - T / 2) / tau)
  const startup = (p.v0 - start) * Math.exp(-t / tau)
  let fourier = 0
  for (let k = 0; k < p.harmonics; k++) {
    const h = 2 * k + 1, q = h * 2 * Math.PI * p.f * tau
    fourier += 4 * p.A / (Math.PI * h) / Math.hypot(1, q) * Math.sin(h * 2 * Math.PI * p.f * t - Math.atan(q))
  }
  const last = 2 * p.harmonics - 1
  const bound = 4 * Math.abs(p.A) / (Math.PI * 2 * Math.PI * p.f * tau * last)
  return {periodic, startup, exact: periodic + startup, fourier, bound, tau, start}
}

export function filterStudy(id, p, x) {
  if (id === 'k4') {
    const tau=p.R1*p.C1,t=x.cursor,v=p.E*(1-Math.exp(-t/tau))
    return {title:'From impulse response to step response and convolution',intro:'This RC circuit begins uncharged. H(s) describes its zero-state voltage ratio. Its inverse h(t) is the response per unit-area voltage impulse; integrating shifted, scaled copies of h predicts an arbitrary causal input.',steps:[
      step('Invert the transfer function','Write H in a standard exponential transform pair. The causal impulse response has units of inverse seconds because its convolution with voltage and time must give voltage.',String.raw`H(s)=\frac1{1+s\tau}=\frac{1/\tau}{s+1/\tau},\qquad \tau=R_1C_1=${n(tau)}\,\mathrm s`,String.raw`h(t)=\frac1\tau e^{-t/\tau}\quad(t\ge0),\qquad h(t)=0\quad(t<0)`),
      step('Define convolution with a separate integration variable','λ is a dummy time variable in seconds, while t is the observation time. An input slice u(λ)dλ excites a copy of the impulse response delayed by λ. Add all slices from zero to t.',String.raw`v_{\mathrm{zs}}(t)=\int_0^t h(t-\lambda)u(\lambda)\,d\lambda`),
      step('Integrate for the displayed step input','The source holds V₁ after zero, so its value can be taken outside the integral. Substitute h and integrate the exponential.',String.raw`v(t)=\frac{V_1}{\tau}\int_0^t e^{-(t-\lambda)/\tau}\,d\lambda=V_1(1-e^{-t/\tau})`,String.raw`v(${n(t)})=(${n(p.E)})(1-e^{-${n(t)}/${n(tau)}})=${n(v)}\,\mathrm V`),
      step('Relate a pulse to two shifted steps','A pulse of height V₁ lasting T is a rising step minus a delayed step. Linearity and time invariance give its response without a new differential-equation solve. Here s₀ denotes the unit-step response, not the Laplace variable.',String.raw`s_0(t)=(1-e^{-t/\tau})\,\mathbf1_{t\ge0}`,String.raw`v_{\mathrm{pulse}}(t)=V_1[s_0(t)-s_0(t-T)]`),
      step('Check initial-state assumptions','Convolution with h gives the zero-state response. If the capacitor already holds v₀, add v₀ exp(−t/τ). This lesson keeps v₀ = 0 so its displayed step directly checks the integral.',String.raw`v_{\mathrm{complete}}(t)=v_{\mathrm{zs}}(t)+v_0e^{-t/\tau}`),
    ],advantage:'The impulse response reuses one linear circuit model for steps, pulses and general input waveforms. Convolution explains how input history contributes to the voltage now.',limitation:'This formula assumes a causal linear time-invariant circuit and zero initial state unless the natural term is added. An ideal impulse is a mathematical unit-area input; the displayed source is an ordinary finite step.',checks:[row('integrated step response',v,x.sol.volt.C1,'V')],practice:{prompt:'A pulse lasts one time constant and then turns off. Calculate the capacitor voltage one more time constant after turn-off.',target:p.E*(1-Math.exp(-1))*Math.exp(-1),unit:'V',hint:'First charge to V₁(1 − e⁻¹), then discharge that voltage by another factor e⁻¹.'}}
  }
  if (id === 'k3') {
    const a = squareResponse(p, x.cursor)
    return {
      title: 'Pass each Fourier harmonic through the circuit',
      intro: 'The input is a zero-mean square wave, +A for the first half-cycle and −A for the second. A finite Fourier series approximates its steady periodic response. The exact time solver also includes the separate startup response.',
      steps: [
        step('Define the Fourier coefficients', 'For a general real periodic input, a0/2 is its mean, an multiplies cosine and bn multiplies sine. The coefficients are projections over one complete period T; ω = 2π/T.', String.raw`u(t)=\frac{a_0}{2}+\sum_{n=1}^{\infty}[a_n\cos(n\omega t)+b_n\sin(n\omega t)]`, String.raw`a_n=\frac2T\int_0^T u(t)\cos(n\omega t)\,dt,\qquad b_n=\frac2T\int_0^T u(t)\sin(n\omega t)\,dt`),
        step('Use symmetry for this square wave', 'This waveform has zero mean and no cosine coefficients. Even sine harmonics cancel; the odd sine coefficients decrease as 1/n. The series takes the midpoint value at each jump.', String.raw`a_0=a_n=0,\qquad b_n=\begin{cases}4A/(\pi n)&n\text{ odd}\\0&n\text{ even}\end{cases}`, String.raw`u(t)\sim\frac{4A}{\pi}\left[\sin\omega t+\frac{\sin3\omega t}{3}+\cdots\right]`),
        step('Evaluate the transfer function at each harmonic frequency', 'A linear time-invariant circuit treats each sinusoid independently. The nth harmonic sees H(jnω), not H(jω). The capacitor reduces the high-frequency harmonics more strongly.', String.raw`H(jn\omega)=\frac1{1+jn\omega R_1C_1}`, String.raw`|H(jn\omega)|=\frac1{\sqrt{1+(n\omega\tau)^2}},\qquad \angle H=-\tan^{-1}(n\omega\tau)`),
        step('Reconstruct the filtered periodic output', 'Multiply each input coefficient by its own gain and add its own phase shift. This sum is a steady periodic prediction; it is not yet the complete startup response.', String.raw`v_{\mathrm{Fourier}}(t)=\sum_{k=0}^{K-1}\frac{4A}{\pi(2k+1)}\frac{\sin[(2k+1)\omega t-\tan^{-1}((2k+1)\omega\tau)]}{\sqrt{1+[(2k+1)\omega\tau]^2}}`, String.raw`K=${n(p.harmonics)},\qquad v_{\mathrm{Fourier}}(${n(x.cursor)})=${n(a.fourier)}\,\mathrm V`),
        step('Separate truncation error from startup', 'The exact periodic RC voltage at the rising edge is −A tanh(T/(4τ)). Any different initial capacitor voltage adds a decaying natural response. Compare the truncated series against the periodic curve, and add startup before comparing with Scope.', String.raw`v_{\mathrm{per}}(0)=-A\tanh\!\left(\frac{T}{4\tau}\right)=${n(a.start)}\,\mathrm V`, String.raw`v_C(t)=v_{\mathrm{per}}(t)+[v_0-v_{\mathrm{per}}(0)]e^{-t/\tau}`, String.raw`v_{\mathrm{per}}(${n(x.cursor)})=${n(a.periodic)},\quad v_{\mathrm{startup}}=${n(a.startup)},\quad v_C=${n(a.exact)}\,\mathrm V`),
        step('Bound the omitted harmonics', 'For this RC output, each omitted term is bounded by 4|A|/(πωτn²). Bounding the odd tail by the full integer tail gives the conservative bound below. More harmonics improve the approximation; they do not remove startup.', String.raw`|v_{\mathrm{per}}-v_{\mathrm{Fourier}}|\le\frac{4|A|}{\pi\omega\tau(2K-1)}=${n(a.bound)}\,\mathrm V`),
      ],
      advantage: 'Fourier analysis connects a nonsinusoidal input to familiar sinusoidal circuit responses and explains how a filter changes waveform shape.',
      limitation: 'A finite series has truncation error. The source series has Gibbs behavior near jumps, and phasor superposition applies only to the linear steady-periodic response unless the natural startup term is added.',
      checks: [row('exact periodic plus startup', a.exact, x.sol.volt.C1, 'V'), row('truncated harmonics plus startup (bounded error)', a.fourier + a.startup, x.sol.volt.C1, 'V', a.bound + 1e-8)],
      plot: {title: 'Compare Fourier approximation and startup', unit: 'V', tEnd: x.tEnd, traces: [{label: 'Exact periodic response', at: t => squareResponse(p,t).periodic}, {label: 'Finite Fourier response', at: t => squareResponse(p,t).fourier}, {label: 'Complete response', at: t => squareResponse(p,t).exact}]},
      practice: {prompt: 'Calculate the peak amplitude of the third input harmonic before filtering, in volts.', target: Math.abs(4 * p.A / (3 * Math.PI)), unit: 'V', hint: 'The third harmonic is odd, so its coefficient magnitude is 4|A|/(3π). The circuit gain has not yet been applied.'},
    }
  }
  const a = loadedRC(p), w = 2 * Math.PI * p.f, fc = 1 / (2 * Math.PI * a.tau)
  const loaded = id === 'k2'
  return {
    title: loaded ? 'Loading changes both passband gain and corner frequency' : 'Derive and design a first-order low-pass filter',
    intro: 'The output is the capacitor voltage. Derive its transfer function from KCL before using the frequency-response curve. The curve gives steady-state gain and phase; the state view retains initial energy and startup.',
    steps: [
      step('Write KCL at the output node', loaded ? 'Current through R1 splits between the capacitor and the load resistor. Ignoring the load would remove a real current path and predict the wrong gain.' : 'Current through R1 flows into the capacitor. Use the passive reference directions to write both terms with consistent signs.', loaded ? String.raw`\frac{u-v}{R_1}=C_1\dot v+\frac v{R_L}` : String.raw`\frac{u-v}{R_1}=C_1\dot v`),
      step('Transform at zero initial state and solve for the ratio', 'The transfer function is V(s)/U(s) with the capacitor initially uncharged. Collect every term multiplying the output before dividing.', loaded ? String.raw`H(s)=\frac{1/R_1}{sC_1+1/R_1+1/R_L}=\frac K{1+s\tau}` : String.raw`H(s)=\frac1{1+sR_1C_1}`, String.raw`K=${n(a.gain)},\qquad \tau=${n(a.tau)}\,\mathrm s`),
      step('Identify the DC gain and the corner', loaded ? 'The load divider sets the DC gain. The capacitor sees R1 parallel RL with the source deactivated, giving a shorter time constant and a higher corner than the unloaded circuit.' : 'The capacitor is open at DC, so the passband gain is one. The corner occurs when the resistor and capacitor impedance magnitudes are equal.', loaded ? String.raw`K=\frac{R_L}{R_1+R_L},\qquad \tau=(R_1\parallel R_L)C_1` : String.raw`K=1,\qquad \tau=R_1C_1`, String.raw`f_c=\frac1{2\pi\tau}=${n(fc)}\,\mathrm{Hz}`),
      step('Evaluate magnitude and phase at the drive frequency', 'Set s = jω. The corner is 3.01 dB below this filter’s own DC gain, which is not necessarily 0 dB. Far above the corner, the magnitude falls by approximately 20 dB per decade.', String.raw`H(j\omega)=\frac K{1+j\omega\tau}=${rect(a.H)}`, String.raw`|H|=${n(z.cabs(a.H))},\qquad \angle H=${n(-Math.atan(w * a.tau) * 180 / Math.PI)}^\circ`, String.raw`|H(j\omega_c)|=K/\sqrt2`),
      step(loaded ? 'Check a loading tradeoff' : 'Choose a component from a response target', loaded ? 'A smaller RL draws more current, lowers passband gain and changes the corner. A buffer can reduce loading, but its nonideal limits belong to a later design model.' : 'For a specified target corner and fixed capacitance, solve for the required resistor. Apply that value and check the curve at the target frequency.', loaded ? String.raw`\lim_{R_L\to\infty}K=1,\qquad\lim_{R_L\to\infty}\tau=R_1C_1` : String.raw`R_{\mathrm{design}}=\frac1{2\pi f_{\mathrm{target}}C_1}=${n(1 / (2 * Math.PI * p.target * p.C1))}\,\Omega`),
    ],
    advantage: 'Deriving H(s) connects circuit laws, poles, time constants and Bode plots. A target can be translated into a component value and checked immediately.',
    limitation: 'The result assumes ideal lumped components and the stated load. Component tolerance, source impedance and buffer limits can change the response. A transfer function alone does not include initial stored energy.',
    checks: [row('output phasor, real part', a.output[0], x.ac.volt.C1[0], 'V'), row('output phasor, imaginary part', a.output[1], x.ac.volt.C1[1], 'V')],
    action: loaded ? null : {label: 'Apply the target corner', settings: {R1: 1 / (2 * Math.PI * p.target * p.C1), f: p.target}},
    practice: loaded ? {prompt: 'At DC, calculate the output voltage for a 10 V input with the current resistor values.', target: 10 * a.gain, unit: 'V', hint: 'At DC the capacitor is open, leaving the R1–RL divider.'} : {prompt: 'Keep R1 fixed and double C1. Calculate the resulting corner frequency in hertz.', target: fc / 2, unit: 'Hz', hint: 'The corner frequency is inversely proportional to R1C1.'},
  }
}

export function completionFilters(base, groups) {
  const find = id => base.find(e => e.id === id)
  const make = (id, original, name, prerequisites) => ({...original, id, name, prerequisites, group: groups[11], study: filterStudy, studyViews: ['bode'], claim: {}, circuitLab: undefined,
    headline: {label: 'the steady capacitor voltage amplitude', tag: '|V_C|', unit: 'V', where: null, value: x => z.cabs(x.ac.volt.C1)}, closedHeadline: p => z.cabs(loadedRC(p).output),
    lesson: {see: 'Connect the circuit laws to a frequency-domain prediction. Follow the worked derivation, change the component or input settings and compare the predicted result with the original circuit solve.', why: 'Frequency response is a consequence of the circuit equations, not a separate unexplained curve. Loading, initial conditions and approximation error need to be stated before using a shortcut or comparing representations.', try: [{say: 'Change the capacitance and predict the change in the response before checking it.', reads: []}, {say: 'Compare the time and frequency representations for the same circuit settings.', reads: []}]},
  })
  const design = make('k1', find('h6'), 'Filter design from a corner-frequency target', ['j7', 'h6'])
  design.params = design.params.map(k => ({...k, ...(k.key === 'R1' ? {default: 1500} : {})}))
  design.params.push({key: 'target', label: 'Target corner', unit: 'Hz', min: 10, max: 10000, scale: 'log', default: 200})
  const loaded = make('k2', find('h6'), 'Loaded filters: passband loss and shifted poles', ['k1', 'c3'])
  loaded.studyOwnPhasor = true; loaded.studyViews = ['bode', 'phasor']
  loaded.params = [...loaded.params.map(k => ({...k,...(k.key==='R1'?{label:'R₁'}:{})})), {key: 'RL', label: 'Load R_L', unit: 'Ω', min: 100, max: 100000, scale: 'log', default: 3000}]
  loaded.net = p => ({elements: [
    {type: 'V', id: 'V1', nodes: ['in','gnd'], value: 0, wave: {kind: 'sine', amp: p.A, freq: p.f, phase: p.phi * Math.PI / 180}},
    {type: 'R', id: 'R1', nodes: ['in','n1'], value: p.R1}, {type: 'C', id: 'C1', nodes: ['n1','gnd'], value: p.C1}, {type: 'R', id: 'RL', nodes: ['n1','gnd'], value: p.RL},
  ]})
  loaded.layout = {w:650,h:260,items:[
    {el:'V1',x:50,y:140,dir:'v'},{el:'C1',x:330,y:140,dir:'v'},{el:'RL',x:520,y:140,dir:'v'},{el:'R1',x:200,y:50,dir:'h'},
    ...[50,330,520].flatMap(xx=>[{wire:[xx,50,xx,120]},{wire:[xx,160,xx,220]}]),
    {wire:[50,50,180,50]},{wire:[220,50,520,50]},{wire:[50,220,520,220]},{gnd:[330,220]},{node:'in',x:50,y:50,side:'t'},{node:'n1',x:330,y:50,side:'t'},
  ]}
  const fourier = make('k3', find('f3'), 'Fourier series through an RC circuit', ['k2', 'f9', 'h1'])
  fourier.params = fourier.params.filter(k => k.key !== 'E').map(k => ({...k, ...(k.key === 'N' ? {unit: 'cycles', default: 6} : {})}))
  fourier.params.push({key: 'A', label: 'Square-wave amplitude', unit: 'V', default: 5, min: 1, max: 20, scale: 'linear'}, {key: 'f', label: 'Frequency', unit: 'Hz', default: 500, min: 10, max: 10000, scale: 'log'}, {key: 'harmonics', label: 'Odd harmonics retained', kind: 'choice', default: 9, options: [1,3,9,25].map(value => ({value, label: String(value)}))})
  fourier.net = p => {const net=find('f3').net({...p,E:0});return {...net,elements:net.elements.map(e=>e.id==='V1'?{...e,wave:{kind:'square',amp:p.A,period:1/p.f}}:e)}}
  fourier.window = p => p.N / p.f; fourier.view = 'equations'; fourier.studyViews = ['scope']
  fourier.headline = {label: 'the complete capacitor voltage at the cursor', tag: 'v_C', unit: 'V', where: null, value: x => x.sol.volt.C1}
  fourier.closedHeadline = (p, x) => squareResponse(p, x.cursor).exact
  const convolution=make('k4',find('f3'),'Impulse response, convolution and finite pulses',['k3','j1'])
  convolution.params=convolution.params.filter(k=>k.key!=='v0')
  convolution.net=p=>find('f3').net({...p,v0:0})
  convolution.view='equations';convolution.views=['equations','scope','state'];convolution.studyViews=[]
  convolution.headline={label:'the step response at the cursor',tag:'v_C',unit:'V',where:null,value:x=>x.sol.volt.C1}
  convolution.closedHeadline=(p,x)=>p.E*(1-Math.exp(-x.cursor/(p.R1*p.C1)))
  return [design, loaded, fourier, convolution]
}
