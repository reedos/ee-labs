const n = (value) => Number(value.toPrecision(4)).toString()
const text = (value) => ({ kind: 'text', text: value })
const formula = (tex, caption) => ({ kind: 'formula', tex, caption })

// Sample the network's continuous solution independently of the closed-form
// crossing calculation used by the pin adapter.
export function measuredCrossing(run, voltage) {
  const start = run.at(0).x[0]
  const end = run.at(run.tEnd).x[0]
  if (voltage <= Math.min(start, end) || voltage >= Math.max(start, end)) return NaN
  let lo = 0
  let hi = run.tEnd
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2
    if ((run.at(mid).x[0] < voltage) === (end > start)) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export function mathEntry(id, p, x, cursor = {}) {
  const formulas = {
    a1: ['v(t)=V_{DD}(1-e^{-t/(R_{on}C)})', 't_r=R_{on}C\\ln 9'],
    a2: ['V_{IL}=\\frac{3V_{DD}+2V_t}{8},\\quad V_{IH}=\\frac{5V_{DD}-2V_t}{8}', 't_{IH}=-RC\\ln(1-V_{IH}/V_{DD})'],
    a3: ['\\tau_{rise}=R_{pu}C,\\quad \\tau_{fall}=(R_{pu}\\parallel R_{on})C', 'V_{low}=V_{DD}\\frac{R_{on}}{R_{pu}+R_{on}}'],
    a4: ['t_r=C R_{on}\\ln 9', 'C_{max}=\\frac{t_{budget}}{R_{on}\\ln 9}'],
    a5: ['V_{OL}=I R_{on},\\quad V_{OH}=V_{DD}-I R_{on}', 'V_{bounce}=LN\\frac{V_{DD}/R_{on}}{t_{edge}}'],
  }
  const rows = id === 'a5'
    ? [{ label: 'Low noise margin', value: x.margins.nml, unit: 'V' },
      { label: 'High noise margin', value: x.margins.nmh, unit: 'V' },
      { label: 'Ground bounce', value: x.margins.bounce, unit: 'V' }]
    : [{ label: 'Rise time', value: x.rise.tr == null ? NaN : x.rise.tr / 1e-9, unit: 'ns' },
      { label: 'Delay to VIH', value: x.rise.tpLH == null ? NaN : x.rise.tpLH / 1e-9, unit: 'ns' }]
  const direction = cursor.direction || 'rise'
  const run = x[direction]
  const { tau, initial, target } = run.segments[0]
  const resistance = tau / p.cload
  const base = [
    text('Replace the active switch path by its Thevenin source and resistance. Kirchhoff\'s current law makes the resistor current equal the capacitor current.'),
    formula('C\\frac{dv}{dt}=\\frac{V_\\infty-v}{R_{eq}}'),
    formula('v(t)=V_\\infty+(V_0-V_\\infty)e^{-t/\\tau}', 'Capacitor voltage is continuous. The switch changes its final value, not its initial value.'),
    formula(`\\tau=R_{eq}C=${n(resistance)}\\,\\Omega\\cdot${n(p.cload / 1e-12)}\\,\\mathrm{pF}`),
    formula(`\\tau=${n(tau / 1e-9)}\\,\\mathrm{ns},\\quad V_\\infty=${n(target)}\\,\\mathrm{V}`),
  ]
  const specific = {
    a1: [text('Solve the exponential at 10% and 90% of VDD, then subtract. Doubling R or C doubles both the time constant and the rise time.'),
      formula(`t_r=\\ln(9)RC=${n(x.rise.tr / 1e-9)}\\,\\mathrm{ns}`)],
    a2: [text('The matched square-law inverter has slope -1 at each input limit. These are model-derived limits, not a datasheet guarantee for every CMOS family.'),
      ...formulas.a2.map((tex) => formula(tex)),
      formula(`V_{IL}=${n(x.thresholds.vil)}\\,\\mathrm{V},\\quad V_{IH}=${n(x.thresholds.vih)}\\,\\mathrm{V}`)],
    a3: [text('Releasing the output removes the pull-down path. Pulling low leaves both resistors connected. Use their parallel resistance and divider voltage, not Ron alone.'),
      ...formulas.a3.map((tex) => formula(tex)),
      formula(`V_{low}=${n(x.fall.segments[0].target)}\\,\\mathrm{V}`)],
    a4: [text('A rise-time budget places an upper bound on load capacitance. The budget is a limit on the 10-90% interval, not the time to reach VIH.'),
      ...formulas.a4.map((tex) => formula(tex)),
      formula(`C_{max}=${n(x.budget.maxCap / 1e-12)}\\,\\mathrm{pF}`),
      text(`Remaining rise budget: ${n(x.budget.slack / 1e-9)} ns. ${x.budget.pass ? 'The current load meets this limit.' : 'The current load exceeds this limit.'}`)],
    a5: [text('Static load current reduces the available logic margins. Solve the loaded pin at DC before subtracting the receiver limits.'),
      ...formulas.a5.map((tex) => formula(tex)),
      formula('NM_L=V_{IL}-V_{OL},\\quad NM_H=V_{OH}-V_{IH}'),
      formula(`V_{OL}=${n(p.loadCurrent / 1e-3)}\\,\\mathrm{mA}\\cdot${n(p.ron)}\\,\\Omega`),
      formula(`V_{OL}=${n(x.margins.vol)}\\,\\mathrm{V},\\quad V_{OH}=${n(x.margins.voh)}\\,\\mathrm{V}`),
      text(`Each pin contributes a ${n(x.margins.currentStep / 1e-3)} mA current step over ${n(p.edgeTime / 1e-9)} ns. The shared return inductance is ${n(p.inductance / 1e-9)} nH.`),
      formula(`V_{bounce}=${n(p.inductance / 1e-9)}\\,\\mathrm{nH}\\cdot${p.pins}\\cdot\\frac{${n(x.margins.currentStep / 1e-3)}\\,\\mathrm{mA}}{${n(p.edgeTime / 1e-9)}\\,\\mathrm{ns}}`),
      text(`The separate ramp model gives ${n(x.margins.bounce)} V of bounce for ${p.pins} pins. Remaining margin is ${n(x.margins.slack)} V. It does not alter the RC waveform or simulate package ringing.`)],
  }
  const trMeasured = measuredCrossing(x.rise, 0.9 * p.vdd) - measuredCrossing(x.rise, 0.1 * p.vdd)
  const check = id === 'a5' ? [
    { label: 'Low output', predicted: p.loadCurrent * p.ron, measured: x.margins.vol, unit: 'V', abs: 1e-9 },
    { label: 'High output', predicted: p.vdd - p.loadCurrent * p.ron, measured: x.margins.voh, unit: 'V', abs: 1e-9 },
  ] : [
    { label: '10-90% rise', predicted: x.rise.tr / 1e-9, measured: trMeasured / 1e-9, unit: 'ns', tol: 1e-6 },
    { label: 'Delay to VIH', predicted: x.rise.tpLH / 1e-9, measured: measuredCrossing(x.rise, x.thresholds.vih) / 1e-9, unit: 'ns', tol: 1e-6 },
  ]
  return { blocks: [
    ...(id === 'a5' ? [text('The noise budget contains two separate models. Static DC sets the available logic margin. A linear current ramp estimates the return-inductance voltage.')] : base),
    ...specific[id],
    text('Compare the calculation with the network solution. Crossing times are measured by bisection on the continuous waveform. DC voltages come from the loaded circuit solve.'),
    { kind: 'check', rows: check }, { kind: 'values', rows },
    ...(cursor.now ? [
      text(`The cursor time is ${n(cursor.t / 1e-9)} ns. The ${direction === 'rise' ? 'rising' : 'falling'} capacitor began at ${n(initial)} V.`),
      formula(`v(t)=${n(cursor.now.voltage)}\\,\\mathrm{V}`),
      formula('i_C(t)=\\frac{V_\\infty-v(t)}{R_{eq}},\\quad E_C=\\frac12 Cv^2'),
      { kind: 'values', rows: [
        { label: 'Capacitor current', value: cursor.now.current / 1e-3, unit: 'mA' },
        { label: 'Stored energy', value: cursor.now.energy / 1e-12, unit: 'pJ' },
      ] },
    ] : []),
  ] }
}
