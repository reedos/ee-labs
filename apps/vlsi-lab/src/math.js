import { CARD, CU, RU } from './model.js'

const formula = (tex, caption) => ({ kind: 'formula', tex, caption })
const text = (text) => ({ kind: 'text', text })
const n = (v) => v.toFixed(3)

export function workedMath(x, p, view) {
  if (x.dc) {
    const d = x.dc
    return { blocks: [
      text('The lowest guaranteed high input voltage is VIH (V_IH). The highest guaranteed low input voltage is VIL (V_IL). These limits occur where the square-law transfer slope equals -1. These expressions use matched devices and zero channel-length modulation.'),
      formula('V_{IL}=\\frac{3V_{DD}+2V_t}{8}', `V_IL = (3 x ${CARD.vdd} + 2 x ${CARD.vt}) / 8 = ${n(d.vil)} V.`),
      formula('V_{IH}=\\frac{5V_{DD}-2V_t}{8}', `V_IH = (5 x ${CARD.vdd} - 2 x ${CARD.vt}) / 8 = ${n(d.vih)} V.`),
      { kind: 'check', rows: [
        { label: 'Low input limit', predicted: (3 * CARD.vdd + 2 * CARD.vt) / 8, measured: d.vil, unit: 'V', tol: 1e-6 },
        { label: 'High input limit', predicted: (5 * CARD.vdd - 2 * CARD.vt) / 8, measured: d.vih, unit: 'V', tol: 1e-6 },
      ] },
      text('The highest guaranteed low output voltage is VOL (V_OL). The lowest guaranteed high output voltage is VOH (V_OH). NML (NM_L) and NMH (NM_H) are the low and high noise margins.'),
      formula('NM_L=V_{IL}-V_{OL}', `NM_L = ${n(d.vil)} - ${n(d.vol)} = ${n(d.nml)} V.`),
      formula('NM_H=V_{OH}-V_{IH}', `NM_H = ${n(d.voh)} - ${n(d.vih)} = ${n(d.nmh)} V.`),
      text('The output limits are measured at the unity-slope inputs. A static input sweep contains no transient delay information.'),
    ] }
  }
  const g = x.gate
  const resistance = p.edge === 'fall' ? RU : RU * CARD.mobilityRatio / p.wp
  const blocks = [
    text('The ideal input step turns one switch on. The output capacitance then charges or discharges through its on-resistance.'),
    formula('R_n=R_u,\\qquad R_p=\\frac{2R_u}{W_p}', `R_n = ${n(RU / 1000)} kohm. R_p = ${n(RU * 2 / p.wp / 1000)} kohm.`),
    formula('C_{out}=(1+W_p)C_u+3FC_u', `C_out = ${n(g.cself * 1e15)} + ${n(x.load * 1e15)} = ${n(g.ctotal * 1e15)} fF.`),
    text(`W_p is pull-up width in unit widths. F is fanout in unit inverter inputs. C_u is ${n(CU * 1e15)} fF.`),
    formula('\\tau=R_{on}C_{out}', `tau = ${n(resistance / 1000)} kohm x ${n(g.ctotal * 1e15)} fF = ${n(x.response.tau * 1e12)} ps.`),
    formula(p.edge === 'fall' ? 'V_{out}(t)=V_{DD}e^{-t/\\tau}' : 'V_{out}(t)=V_{DD}(1-e^{-t/\\tau})'),
    formula('t_{50}=\\tau\\ln 2', `t_50 = ${n(x.response.tau * 1e12)} x ln(2) = ${n(x.response.measured * 1e12)} ps.`),
    { kind: 'check', rows: [
      { label: 'Half-supply delay', predicted: resistance * g.ctotal * Math.LN2 * 1e12, measured: x.response.measured * 1e12, unit: 'ps', tol: 1e-10 },
      { label: '10-90% interval', predicted: resistance * g.ctotal * Math.log(9) * 1e12, measured: x.response.transition * 1e12, unit: 'ps', tol: 1e-10 },
    ] },
  ]
  if (view === 'timing') blocks.unshift(
    formula('t_{chain}=\\sum_{i=1}^{N}t_i', `The isolated-stage sum is ${n(x.chain.reference * 1e12)} ps for ${p.stages} stages.`),
    text(`Alternating stages use rising and falling delays. Rounding each delay to 1 fs gives ${n(x.chain.elapsed * 1e12)} ps.`),
    { kind: 'values', rows: [
      { label: 'Rounding error', value: x.chain.error * 1e15, unit: 'fs' },
      { label: 'Absolute error bound', value: x.chain.bound * 1e15, unit: 'fs' },
    ] },
  )
  if (view === 'fanout') blocks.unshift(
    formula('t_{50}(F)=b+mF'),
    formula('b=R_{on}C_{self}\\ln 2'),
    formula('m=3R_{on}C_u\\ln 2'),
    text(`The ${p.edge === 'fall' ? 'falling' : 'rising'} slope is ${n(3 * resistance * CU * Math.LN2 * 1e12)} ps per unit input.`),
    text(`The intercept is ${n(resistance * g.cself * Math.LN2 * 1e12)} ps. Width changes both resistance and self-capacitance.`),
  )
  if (view === 'timing' && x.analog) blocks.unshift(
    text('The analog comparison connects each switch-model output to the next gate input. Each node carries the same total capacitance used for extraction. The first input is an ideal step; later inputs are the preceding node voltages.'),
    formula('C_i\\dot v_i=G_{p,i}(V_{DD}-v_i)-G_{n,i}v_i'),
    text('C_i is node capacitance. G_p,i and G_n,i are the instantaneous pull-up and pull-down conductances, either zero or one over their on-resistance. They change when the preceding voltage crosses a transistor threshold.'),
    formula('t_{a,i}:v_i(t_{a,i})=V_{DD}/2,\\qquad \\Delta t=t_{a,N}-t_{event}'),
    { kind: 'values', rows: x.analog.crossings.map((value, i) => ({ label: `Analog stage ${i + 1} crossing`, value: value * 1e12, unit: 'ps' })).concat([
      { label: 'Analog minus event delay', value: (x.analog.elapsed - x.chain.elapsed) * 1e12, unit: 'ps' },
    ]) },
    text('This is a comparison of two models, not an agreement check. The event grid bound covers rounding only. The connected model includes threshold-controlled overlap conduction and finite interstage slopes, but not square-law transient currents, leakage or distributed wires.'),
  )
  return { blocks }
}
