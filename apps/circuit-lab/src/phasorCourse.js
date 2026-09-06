import { complex as z, solveAC } from '@ee-labs/network'

export const PHASOR_LESSONS = [
  { id: 'complex', title: 'Complex numbers and an RC circuit', topology: 'rc', aim: 'Use rectangular and polar forms to divide a source voltage by a complex impedance.', task: 'Set the frequency to the RC corner. Predict the current phase before revealing the answer.', answer: 'The current leads the source voltage by 45 degrees. The capacitor voltage lags the source by 45 degrees.' },
  { id: 'series', title: 'Series RLC: solve the complex KVL equation', topology: 'series', aim: 'Add impedances, solve for the common current, then reconstruct every voltage.', task: 'Set the frequency to resonance. Predict the inductor and capacitor voltage sum.', answer: 'The inductor and capacitor voltages cancel. The source voltage equals the resistor voltage, and the current is in phase with the source.' },
  { id: 'nodal', title: 'A branched circuit: solve complex KCL', topology: 'branched', aim: 'Write a node equation when the capacitor and RL branch carry different currents.', task: 'Double R2. Predict whether the RL branch current magnitude increases or decreases.', answer: 'The RL branch current magnitude decreases. The source resistor means that the node voltage also changes, so solve the whole circuit again.' },
  { id: 'power', title: 'AC power from branch phasors', topology: 'branched', aim: 'Calculate real, reactive and apparent power with a consistent amplitude convention.', task: 'Increase the source amplitude from 5 V peak to 10 V peak. Predict the factor by which each complex power changes.', answer: 'Every voltage and current doubles in this linear circuit. Each complex power becomes four times its previous value.' },
]

export const PHASOR_DEFAULTS = { r: 100, r2: 150, l: 0.01, c: 0.000001, f: 1000, v: 5, phase: 0 }
export const PHASOR_FIELDS = [
  { key: 'v', label: 'Source amplitude (V peak)', min: 0.1, max: 20, step: 0.1 },
  { key: 'phase', label: 'Source phase (degrees)', min: -180, max: 180, step: 5 },
  { key: 'f', label: 'Frequency (Hz)', min: 10, max: 10000, step: 10 },
  { key: 'r', label: 'R1 (ohms)', min: 10, max: 1000, step: 10 },
  { key: 'r2', label: 'R2 (ohms)', min: 10, max: 1000, step: 10 },
  { key: 'l', label: 'L1 (mH)', min: 1, max: 100, step: 1, scale: 1000 },
  { key: 'c', label: 'C1 (µF)', min: 0.1, max: 10, step: 0.1, scale: 1000000 },
]

export function phasorCircuit(topology, p) {
  const branch = topology === 'branched'
  const elements = [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.v },
    { type: 'R', id: 'R1', nodes: ['in', 'n'], value: p.r },
  ]
  if (topology === 'rc') elements.push({ type: 'C', id: 'C1', nodes: ['n', 'gnd'], value: p.c })
  else if (branch) elements.push(
    { type: 'C', id: 'C1', nodes: ['n', 'gnd'], value: p.c },
    { type: 'R', id: 'R2', nodes: ['n', 'm'], value: p.r2 },
    { type: 'L', id: 'L1', nodes: ['m', 'gnd'], value: p.l },
  )
  else elements.push(
    { type: 'L', id: 'L1', nodes: ['n', 'm'], value: p.l },
    { type: 'C', id: 'C1', nodes: ['m', 'gnd'], value: p.c },
  )
  return { elements }
}

export const numberTex = value => {
  if (Math.abs(value) < 1e-14) return '0'
  const [a, b] = Number(value.toPrecision(5)).toString().split('e')
  return b ? `${a}\\times10^{${Number(b)}}` : a
}
export const rectTex = v => `${numberTex(v[0])}${v[1] < 0 ? '-' : '+'}j${numberTex(Math.abs(v[1]))}`
export const polarTex = v => z.cabs(v) < 1e-14 ? '0' : `${numberTex(z.cabs(v))}\\angle ${numberTex(z.carg(v) * 180 / Math.PI)}^\\circ`
const par = v => `\\left(${rectTex(v)}\\right)`

/** The teaching path uses circuit reduction. The comparison uses a separate complex MNA solve. */
export function analysePhasors(topology, p) {
  const w = 2 * Math.PI * p.f
  const vs = z.polar(p.v, p.phase * Math.PI / 180)
  const zr = [p.r, 0], zl = [0, w * p.l], zc = [0, -1 / (w * p.c)]
  const branch = topology === 'branched'
  const zrl = z.cadd([p.r2, 0], zl)
  const y = branch ? z.cadd(z.cdiv([1, 0], zc), z.cdiv([1, 0], zrl)) : null
  const total = z.cadd(zr, branch ? z.cdiv([1, 0], y) : z.cadd(zc, topology === 'rc' ? [0, 0] : zl))
  const current = z.cdiv(vs, total)
  const vn = z.csub(vs, z.cmul(zr, current))
  const ic = branch ? z.cdiv(vn, zc) : current
  const il = branch ? z.cdiv(vn, zrl) : current
  const rows = [{ id: 'R1', voltage: z.cmul(zr, current), current }]
  if (branch) rows.push({ id: 'R2', voltage: z.cscale(il, p.r2), current: il })
  if (topology !== 'rc') rows.push({ id: 'L1', voltage: z.cmul(zl, il), current: il })
  rows.push({ id: 'C1', voltage: z.cmul(zc, ic), current: ic })
  rows.forEach(row => { row.power = z.cscale(z.cmul(row.voltage, z.conj(row.current)), 0.5) })
  const net = phasorCircuit(topology, p)
  const solved = solveAC(net, w, { sources: { V1: vs } })
  const errors = rows.map(row => ({ id: row.id,
    voltage: z.cabs(z.csub(row.voltage, solved.volt[row.id])),
    current: z.cabs(z.csub(row.current, solved.i[row.id])),
  }))
  const power = z.cscale(z.cmul(vs, z.conj(current)), 0.5)
  const sumPower = rows.reduce((sum, row) => z.cadd(sum, row.power), [0, 0])
  const balance = branch ? z.csub(current, z.cadd(ic, il)) : z.csub(vs, rows.reduce((sum, row) => z.cadd(sum, row.voltage), [0, 0]))
  return { net, w, vs, zr, zl, zc, zrl, y, total, current, vn, ic, il, rows, solved, errors, power, sumPower, balance }
}

export function phasorSteps(topology, p, a) {
  const n = numberTex
  const steps = [
    { title: '1. Define the source and the convention', text: 'All phasors here use peak amplitudes and a sine reference. j is the imaginary unit. Frequency f is in hertz, and angular frequency ω is in radians per second.', math: [
      `j^2=-1,\\qquad \\omega=2\\pi f=2\\pi(${n(p.f)})=${n(a.w)}\\;\\mathrm{rad/s}`,
      `v_s(t)=${n(p.v)}\\sin(${n(a.w)}t+${n(p.phase * Math.PI / 180)})\\;\\mathrm V`,
      `\\underline V_s=${polarTex(a.vs)}=${rectTex(a.vs)}\\;\\mathrm V`,
    ] },
    { title: '2. Replace each element law by its impedance', text: 'A time derivative becomes multiplication by jω for a sinusoid at this frequency. Voltage divided by current is impedance, measured in ohms.', math: [
      `\\underline V_R=R\\underline I_R,\\quad Z_R=R=${n(p.r)}\\;\\Omega`,
      `i_C=C\\frac{dv_C}{dt}\\;\\Rightarrow\\;Z_C=\\frac{1}{j\\omega C}=-\\frac{j}{\\omega C}=${rectTex(a.zc)}\\;\\Omega`,
      ...(topology === 'rc' ? [] : [`v_L=L\\frac{di_L}{dt}\\;\\Rightarrow\\;Z_L=j\\omega L=${rectTex(a.zl)}\\;\\Omega`]),
    ] },
  ]
  if (topology === 'branched') {
    const coeff = z.cadd([1 / p.r, 0], a.y)
    const rhs = z.cscale(a.vs, 1 / p.r)
    steps.push({ title: '3. Write KCL at the branch node n', text: 'Current through R1 enters node n. Capacitor current and the R2–L1 branch current leave it. The node voltage is the unknown.', math: [
      `Z_{RL}=R_2+j\\omega L=${rectTex(a.zrl)}\\;\\Omega`,
      `\\frac{\\underline V_s-\\underline V_n}{R_1}=j\\omega C\\underline V_n+\\frac{\\underline V_n}{R_2+j\\omega L}`,
      `\\underbrace{\\left(\\frac1{R_1}+j\\omega C+\\frac1{R_2+j\\omega L}\\right)}_{Y_n\\;(\\mathrm S)}\\underline V_n=\\frac{\\underline V_s}{R_1}`,
      `${par(coeff)}\\underline V_n=${rectTex(rhs)}\\;\\mathrm A`,
      `\\underline V_n=\\frac{${par(rhs)}}{${par(coeff)}}=\\frac{${par(rhs)}${par(z.conj(coeff))}}{${n(z.cabs(coeff) ** 2)}}=${rectTex(a.vn)}\\;\\mathrm V`,
    ] })
    steps.push({ title: '4. Substitute the node voltage into each branch law', text: 'The branch currents are different. Add them as complex numbers, not as magnitudes.', math: [
      `\\underline I_{R1}=\\frac{${par(a.vs)}-${par(a.vn)}}{${n(p.r)}}=${rectTex(a.current)}\\;\\mathrm A`,
      `\\underline I_C=\\frac{${par(a.vn)}}{${par(a.zc)}}=${rectTex(a.ic)}\\;\\mathrm A`,
      `\\underline I_{RL}=\\frac{${par(a.vn)}}{${par(a.zrl)}}=${rectTex(a.il)}\\;\\mathrm A`,
      `\\underline I_{R1}-\\underline I_C-\\underline I_{RL}=${rectTex(a.balance)}\\;\\mathrm A`,
    ] })
  } else {
    steps.push({ title: '3. Write KVL and solve the common current', text: 'Every element carries the same current. Multiply numerator and denominator by the conjugate of the total impedance to make the denominator real.', math: [
      `\\underline V_s=\\underline I\\left(R_1${topology === 'rc' ? '' : '+j\\omega L'}+\\frac1{j\\omega C}\\right)`,
      `Z=${rectTex(a.total)}\\;\\Omega`,
      `\\underline I=\\frac{${par(a.vs)}}{${par(a.total)}}=\\frac{${par(a.vs)}${par(z.conj(a.total))}}{${n(z.cabs(a.total) ** 2)}}=${rectTex(a.current)}\\;\\mathrm A`,
      `|\\underline I|=\\sqrt{(${n(a.current[0])})^2+(${n(a.current[1])})^2}=${n(z.cabs(a.current))}\\;\\mathrm A`,
      `\\angle\\underline I=\\operatorname{atan2}(${n(a.current[1])},${n(a.current[0])})=${n(z.carg(a.current) * 180 / Math.PI)}^\\circ`,
    ] })
  }
  steps.push({ title: '5. Reconstruct the element voltages', text: 'Use the passive sign convention: each current enters the terminal used as the positive voltage reference. Multiply each impedance by its own branch current.', math: a.rows.map(row => {
    const impedance = row.id === 'R1' ? a.zr : row.id === 'R2' ? [p.r2, 0] : row.id === 'L1' ? a.zl : a.zc
    return `\\underline V_{${row.id}}=${par(impedance)}${par(row.current)}=${rectTex(row.voltage)}=${polarTex(row.voltage)}\\;\\mathrm V`
  }) })
  steps.push({ title: '6. Return to a steady-state waveform', text: 'The angle in a polar phasor becomes the waveform phase. The time variable t is in seconds. This waveform omits startup and initial stored energy.', math: [
    `i_{R1,\\mathrm{ss}}(t)=${n(z.cabs(a.current))}\\sin(${n(a.w)}t+${n(z.carg(a.current))})\\;\\mathrm A`,
    `v_{C1,\\mathrm{ss}}(t)=${n(z.cabs(a.rows.at(-1).voltage))}\\sin(${n(a.w)}t+${n(z.carg(a.rows.at(-1).voltage))})\\;\\mathrm V`,
  ] })
  steps.push({ title: '7. Calculate power and check the result', text: 'The star denotes complex conjugation. Peak-amplitude phasors require the factor 1/2. P is real power in watts, Q is reactive power in var, and |S| is apparent power in VA.', math: [
    `V_{s,\\mathrm{rms}}=\\frac{${n(p.v)}}{\\sqrt2}=${n(p.v / Math.sqrt(2))}\\;\\mathrm V`,
    `S_{\\mathrm{delivered}}=\\tfrac12\\underline V_s\\underline I_{R1}^*=\\tfrac12${par(a.vs)}${par(z.conj(a.current))}=${rectTex(a.power)}\\;\\mathrm{VA}`,
    `P=${n(a.power[0])}\\;\\mathrm W,\\quad Q=${n(a.power[1])}\\;\\mathrm{var},\\quad |S|=${n(z.cabs(a.power))}\\;\\mathrm{VA}`,
    `\\mathrm{pf}=\\frac{P}{|S|}=${n(a.power[0] / z.cabs(a.power))}`,
    ...a.rows.map(row => `S_{${row.id}}=\\tfrac12${par(row.voltage)}${par(z.conj(row.current))}=${rectTex(row.power)}\\;\\mathrm{VA}`),
    `\\sum S_{\\mathrm{elements}}-S_{\\mathrm{delivered}}=${rectTex(z.csub(a.sumPower, a.power))}\\;\\mathrm{VA}`,
  ] })
  return steps.map((step, index) => ({ ...step, title: step.title.replace(/^\d+\./, `${index + 1}.`) }))
}
