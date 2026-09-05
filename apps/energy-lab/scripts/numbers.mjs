// Every number this lab quotes, computed once and printed.
//
// The rule the suite runs on is that no note quotes a figure the solver does
// not produce. This script is where the figures come from in the first place.
// The plan was written from its output, and running it again says whether the
// plan still agrees with the engine.
//
//   npm run numbers --workspace apps/energy-lab

import {
  BATTERY_DEFAULTS,
  BUS_DEFAULTS,
  CELL_DEFAULTS,
  CELSIUS,
  DAY,
  G_REF,
  T_REF,
  atI,
  atR,
  atV,
  buckPoint,
  cccv,
  chargeCap,
  day,
  decadeOfLight,
  figures,
  firstReversal,
  heat,
  isAt,
  mpptDuty,
  ocv,
  openCircuit,
  poRun,
  pulse,
  rDC,
  roundTrip,
  settled,
  shortCircuit,
  socOf,
  terminalEnergy,
  vocFormula,
  vtAt,
} from '../src/physics.js'

const f = (x, d = 4) => (Number.isFinite(x) ? Number(x.toPrecision(d)) : x)
const head = (s) => console.log(`\n=== ${s}`)

const C = CELL_DEFAULTS
const B = BATTERY_DEFAULTS
const S = { ...C, Ns: 12 }
const SHADE = { ...C, Ns: 12, Rsh: 5 }

head('A · the cell at standard test conditions')
console.log('V_T at 25 °C          ', f(vtAt(T_REF), 6), 'V')
const fig = figures(C)
console.log('I_sc                  ', f(fig.isc, 6), 'A')
console.log('V_oc solved           ', f(fig.voc, 6), 'V')
console.log('V_oc closed form      ', f(vocFormula(C), 6), 'V')
console.log('the two differ by     ', (fig.voc - vocFormula(C)).toExponential(2), 'V')
console.log('V_mpp                 ', f(fig.vmpp, 6), 'V')
console.log('I_mpp                 ', f(fig.impp, 6), 'A')
console.log('P_mpp                 ', f(fig.pmpp, 6), 'W')
console.log('fill factor           ', f(fig.ff, 5))
console.log('R_mpp                 ', f(fig.rmpp, 5), 'Ω')
console.log('V_oc·I_sc rectangle   ', f(fig.voc * fig.isc, 6), 'W')
console.log('newton iterations at the MPP', atI(C, fig.impp).iters)
console.log('n·V_T·ln 10 per decade of light', f(decadeOfLight(C) * 1000, 5), 'mV')

head('A · what a fixed load resistance takes')
for (const R of [0.05, 0.1157, 0.5, 1]) {
  const x = atR(C, R)
  console.log(`R = ${R} Ω  ->  v ${f(x.v, 5)} V, i ${f(x.i, 5)} A, p ${f(x.p, 5)} W, ${f((x.p / fig.pmpp) * 100, 4)} % of P_mpp`)
}

head('A · series resistance, as a toggle')
for (const Rs of [0, 5e-3, 20e-3]) {
  const g = figures({ ...C, Rs })
  console.log(`R_s = ${Rs * 1000} mΩ -> I_sc ${f(g.isc, 6)} A, V_oc ${f(g.voc, 6)} V, V_mpp ${f(g.vmpp, 6)} V, P_mpp ${f(g.pmpp, 5)} W, FF ${f(g.ff, 5)}`)
}

head('A · shunt resistance, as a toggle')
for (const Rsh of [0, 5, 1]) {
  const g = figures({ ...C, Rsh })
  console.log(`R_sh = ${Rsh || 'absent'} Ω -> I_sc ${f(g.isc, 6)} A, V_oc ${f(g.voc, 6)} V, P_mpp ${f(g.pmpp, 5)} W, FF ${f(g.ff, 5)}`)
}
console.log('R_sh = 1 Ω: V_oc closed form would be', f(vocFormula({ ...C, Rsh: 1 }), 6), 'V, solved', f(figures({ ...C, Rsh: 1 }).voc, 6), 'V')

head('A · irradiance')
for (const G of [1000, 500, 200, 100]) {
  const g = figures({ ...C, G })
  console.log(
    `G = ${G} W/m² -> I_sc ${f(g.isc, 6)} A (I_sc/I_sc,ref ${f(g.isc / fig.isc, 5)}), V_oc ${f(g.voc, 6)} V (down ${f((fig.voc - g.voc) * 1000, 5)} mV), P_mpp ${f(g.pmpp, 5)} W, FF ${f(g.ff, 5)}`,
  )
}
console.log('n·V_T·ln 2 per halving of G   ', f(C.n * vtAt(T_REF) * Math.LN2 * 1000, 5), 'mV')
console.log('measured V_oc(1000) − V_oc(500)', f((figures({ ...C, G: 1000 }).voc - figures({ ...C, G: 500 }).voc) * 1000, 5), 'mV')

head('A · temperature')
for (const tc of [25, 45, 65]) {
  const T = tc + CELSIUS
  const g = figures({ ...C, T })
  console.log(
    `T = ${tc} °C -> I_s ${isAt(C.is, C.n, T).toExponential(4)} A, V_T ${f(vtAt(T) * 1000, 5)} mV, I_sc ${f(g.isc, 6)} A, V_oc ${f(g.voc, 6)} V, P_mpp ${f(g.pmpp, 5)} W, FF ${f(g.ff, 5)}`,
  )
}
const v25 = figures({ ...C, T: 25 + CELSIUS }).voc
const v45 = figures({ ...C, T: 45 + CELSIUS }).voc
const v65 = figures({ ...C, T: 65 + CELSIUS }).voc
console.log('dV_oc/dT, 25 → 45 °C   ', f(((v45 - v25) / 20) * 1000, 5), 'mV/K')
console.log('dV_oc/dT, 25 → 65 °C   ', f(((v65 - v25) / 40) * 1000, 5), 'mV/K')
const p25 = figures({ ...C, T: 25 + CELSIUS }).pmpp
const p65 = figures({ ...C, T: 65 + CELSIUS }).pmpp
console.log('P_mpp change per kelvin', f(((p65 - p25) / p25 / 40) * 100, 4), '%/K')
console.log('I_s doubles every      ', f(20 / (Math.log2(isAt(C.is, C.n, 45 + CELSIUS) / isAt(C.is, C.n, 25 + CELSIUS))), 5), 'K')

head('B · strings and parallel strings')
for (const Ns of [1, 12]) {
  const g = figures({ ...C, Ns })
  console.log(`Ns = ${Ns} -> I_sc ${f(g.isc, 6)} A, V_oc ${f(g.voc, 6)} V, V_mpp ${f(g.vmpp, 6)} V, P_mpp ${f(g.pmpp, 5)} W, R_mpp ${f(g.rmpp, 5)} Ω, FF ${f(g.ff, 5)}`)
}
const par = figures({ ...C, Ns: 12, Np: 3 })
console.log(`Ns = 12, Np = 3 -> I_sc ${f(par.isc, 6)} A, V_oc ${f(par.voc, 6)} V, P_mpp ${f(par.pmpp, 5)} W, R_mpp ${f(par.rmpp, 5)} Ω`)
console.log('three strings against one: power ratio', f(par.pmpp / figures({ ...C, Ns: 12 }).pmpp, 6))

head('B · one cell of twelve shaded to 30 %, R_sh = 5 Ω on every cell')
const shade = (frac) => ({ cells: (k) => (k === 0 ? { G: frac * G_REF } : {}) })
const clear = figures(SHADE)
console.log('clear   I_sc', f(clear.isc, 6), 'A, V_oc', f(clear.voc, 6), 'V, P_mpp', f(clear.pmpp, 5), 'W at', f(clear.vmpp, 5), 'V')
const shaded = figures(SHADE, shade(0.3))
console.log('shaded  I_sc', f(shaded.isc, 6), 'A, V_oc', f(shaded.voc, 6), 'V, P_mpp', f(shaded.pmpp, 5), 'W at', f(shaded.vmpp, 5), 'V')
console.log('power lost          ', f((1 - shaded.pmpp / clear.pmpp) * 100, 4), '%   for 1 cell of 12 at 30 % light')
{
  const x = atI(SHADE, shaded.impp, shade(0.3))
  console.log('at the shaded MPP the shaded cell holds', f(x.sol.volt.D0_0, 5), 'V and the other eleven each', f(x.sol.volt.D0_1, 5), 'V')
  const y = atI(SHADE, clear.impp, shade(0.3))
  const vShaded = y.sol.v.s0n1
  console.log('driven at the clear MPP current instead, the shaded cell holds', f(vShaded, 5), 'V across itself')
  console.log('   and turns', f(-vShaded * clear.impp, 5), 'W into heat, in one cell — the hot spot')
  console.log('   the string terminal is then at', f(y.v, 5), 'V')
}

head('B · the bypass diode')
const byp = { ...shade(0.3), bypass: (k) => k === 0 }
const withByp = figures(SHADE, byp)
console.log('with bypass  I_sc', f(withByp.isc, 6), 'A, V_oc', f(withByp.voc, 6), 'V, P_mpp', f(withByp.pmpp, 5), 'W at', f(withByp.vmpp, 5), 'V')
console.log('recovered           ', f(withByp.pmpp - shaded.pmpp, 5), 'W, i.e.', f((withByp.pmpp / shaded.pmpp - 1) * 100, 4), '% more than without it')
console.log('still short of clear', f((1 - withByp.pmpp / clear.pmpp) * 100, 4), '%')
{
  const x = atI(SHADE, withByp.impp, byp)
  console.log('at the new MPP the bypass diode holds', f(x.sol.volt.Db0_0, 5), 'V and carries', f(x.sol.i.Db0_0, 5), 'A')
  console.log('the shaded cell now holds            ', f(x.sol.volt.D0_0, 5), 'V and dissipates', f(-x.sol.p.D0_0, 5), 'W')
}

head('B · the two humps')
{
  const isc = shortCircuit(SHADE, byp)
  const n = 600
  const pts = Array.from({ length: n + 1 }, (_, k) => atI(SHADE, (isc * (1 - 1e-4) * k) / n, byp))
  const peaks = []
  for (let k = 1; k < n; k++) if (pts[k].p > pts[k - 1].p && pts[k].p >= pts[k + 1].p) peaks.push(pts[k])
  console.log('local maxima on the P–V curve:', peaks.map((x) => `${f(x.v, 5)} V / ${f(x.p, 5)} W`).join('    |    '))
}

head('C · a fixed resistor cannot follow the sun')
{
  const Rfix = figures(S).rmpp
  console.log('R chosen at the standard condition =', f(Rfix, 5), 'Ω')
  for (const G of [1000, 500, 200]) {
    const c = { ...S, G }
    const g = figures(c)
    const x = atR(c, Rfix)
    console.log(`G = ${G} W/m² -> the fixed load takes ${f(x.p, 5)} W of ${f(g.pmpp, 5)} W available, ${f((x.p / g.pmpp) * 100, 4)} %`)
  }
}

head('C · perturb and observe')
{
  const clear12 = figures(S)
  const power = (v) => atV(S, v).p
  const path = poRun(power, { v0: 2, step: 0.2, n: 40, vmin: 0, vmax: clear12.voc })
  const s = settled(path)
  console.log('start 2.000 V, step 200 mV, on a 12-cell string')
  console.log('first six voltages ', path.slice(0, 6).map((x) => f(x.v, 5)).join(', '))
  console.log('steps to the first reversal', firstReversal(path))
  console.log('settled mean power ', f(s.mean, 6), 'W of', f(clear12.pmpp, 6), 'W available =', f((s.mean / clear12.pmpp) * 100, 5), '%')
  console.log('dither             ', f(s.swing, 4), 'V wide, between', f(s.vmin, 5), 'and', f(s.vmax, 5), 'V')
  for (const step of [0.4, 0.2, 0.05]) {
    const p2 = poRun(power, { v0: 2, step, n: 160, vmin: 0, vmax: clear12.voc })
    const s2 = settled(p2)
    console.log(
      `step ${f(step * 1000, 3)} mV -> ${firstReversal(p2)} steps to the peak, settled ${f(s2.mean, 6)} W, ${f((1 - s2.mean / clear12.pmpp) * 100, 4)} % under the maximum, dither ${f(s2.swing, 4)} V`,
    )
  }
}

head('C · the buck as a resistance knob')
{
  const R = 0.5
  const d = mpptDuty(S, R)
  console.log('R_load', R, 'Ω, R_mpp', f(d.rmpp, 5), 'Ω -> D at the maximum power point =', f(d.D, 5), ', reachable:', d.reachable)
  for (const D of [0.4, d.D, 0.8]) {
    const b = buckPoint(S, { D, R })
    console.log(
      `D = ${f(D, 4)} -> R_in ${f(b.rin, 5)} Ω, v_pv ${f(b.v, 5)} V, i_pv ${f(b.i, 5)} A, P_pv ${f(b.p, 5)} W, V_out ${f(b.m.sig.vout.avg, 5)} V, P_out ${f(b.m.Pout, 5)} W, ${b.m.mode}`,
    )
    console.log(`         input current: R/D² model ${f(b.iinModel, 7)} A, switched engine ${f(b.iinSwitched, 7)} A, apart by ${(b.iinSwitched - b.iinModel).toExponential(2)} A`)
  }
  const best = buckPoint(S, { D: d.D, R })
  console.log('at the tracking duty the array gives', f(best.p, 6), 'W against P_mpp', f(d.pmpp, 6), 'W, short by', (d.pmpp - best.p).toExponential(2), 'W')
}

head('D · the battery')
console.log('charge store Cq       ', f(chargeCap(B), 6), 'F')
console.log('OCV at z = 0.5        ', f(ocv(0.5), 5), 'V')
console.log('R₀ + R₁ + R₂          ', f(rDC(B), 4), 'Ω')
console.log('τ₁ = R₁C₁             ', f(B.R1 * B.C1, 4), 's')
console.log('τ₂ = R₂C₂             ', f(B.R2 * B.C2, 4), 's')
{
  const i = 1
  const tEnd = 1200
  const tr = pulse(B, { i, tEnd, points: 2401 })
  const v = (t) => tr.at(t).sol.v.t
  console.log(`a ${i}.00 A discharge from z = 0.5, for ${tEnd} s`)
  console.log('at rest                ', f(v(0), 6), 'V')
  console.log('the instant after      ', f(v(1e-9), 6), 'V   (a step of', f((ocv(0.5) - v(1e-9)) * 1000, 5), 'mV, which is i·R₀)')
  console.log('i·R₀                   ', f(i * B.R0 * 1000, 5), 'mV')
  console.log('at 30 s                ', f(v(30), 6), 'V')
  console.log('at 200 s               ', f(v(200), 6), 'V')
  console.log('at 1200 s              ', f(v(1200), 6), 'V')
  console.log('SoC at 1200 s          ', f(socOf(tr.at(1200).x[0]), 5), `(started at 0.5, and ${i} A for ${tEnd} s is`, f((i * tEnd) / B.Q, 5), 'of the capacity)')
  console.log('heat in the resistances', f(heat(tr), 6), 'J')
  console.log('i²·(R₀+R₁+R₂)·t        ', f(i * i * rDC(B) * tEnd, 6), 'J')
  console.log('energy out of terminal ', f(terminalEnergy(tr, i), 6), 'J')
}

head('D · CC/CV')
{
  const r = cccv(B, { icc: 2, vlim: 4.1, tEnd: 4000, z0: 0.2, points: 4001 })
  console.log('constant current 2.00 A from z = 0.2, limit 4.100 V')
  console.log('the limit is reached at', f(r.tSwitch, 6), 's =', f(r.tSwitch / 60, 5), 'min')
  console.log('SoC there              ', f(socOf(r.xSwitch[0]), 5))
  const iAt = (t) => -r.cv.at(t).sol.i.Vt
  console.log('current at the changeover', f(iAt(1e-9), 5), 'A')
  console.log('current 300 s later      ', f(iAt(300), 5), 'A')
  console.log('current 1800 s later     ', f(iAt(1800), 5), 'A')
  console.log('SoC 1800 s later         ', f(socOf(r.cv.at(1800).x[0]), 5))
  console.log('SoC at the end of the window', f(socOf(r.cv.at(4000 - r.tSwitch).x[0]), 5))
}

head('D · round trip')
{
  const i = 2
  const t = 900
  const r = roundTrip(B, { i, t })
  console.log('2.00 A out for 15 min, then 2.00 A back in for 15 min, from z = 0.5')
  console.log('state of charge   ', f(r.zStart, 5), '->', f(r.zLow, 5), '->', f(r.zEnd, 5))
  console.log('energy out        ', f(r.eOut, 6), 'J   heat', f(r.heatOut, 5), 'J')
  console.log('energy in         ', f(r.eIn, 6), 'J   heat', f(r.heatIn, 5), 'J')
  console.log('in − out          ', f(r.eIn - r.eOut, 5), 'J against the two heats summed', f(r.heatOut + r.heatIn, 5), 'J')
  console.log('round-trip efficiency', f(r.eta, 5), '=', f(r.eta * 100, 4), '%')
  console.log('i²·(R₀+R₁+R₂)·t each way', f(i * i * rDC(B) * t, 5), 'J')
}

head('E · a day on one bus')
{
  const g = day(C, B, {})
  const small = day(C, B, { bankParallel: 50 })
  console.log(`array: ${BUS_DEFAULTS.modules} modules of ${BUS_DEFAULTS.cellsPerModule} cells; bank ${BUS_DEFAULTS.bankSeries} cells in series by ${BUS_DEFAULTS.bankParallel} in parallel`)
  console.log('bank capacity         ', f(g.bankQ / 3600, 5), 'Ah, bank resistance', f(g.bankR * 1000, 4), 'mΩ')
  console.log('bank voltage          ', f(g.bankV, 5), 'V, so its store holds', f(g.bankE / 3.6e6, 5), 'kWh')
  console.log('energy from the array ', f(g.eIn / 3.6e6, 5), 'kWh')
  console.log('energy the load asked ', f(g.eLoad / 3.6e6, 5), 'kWh')
  console.log('curtailed             ', f(g.curtailed / 3.6e6, 5), 'kWh')
  console.log('unserved              ', f(g.unserved / 3.6e6, 5), 'kWh')
  console.log('heat in the bank      ', f(g.lost / 3.6e6, 6), 'kWh')
  console.log('net into storage      ', f(g.stored / 3.6e6, 5), 'kWh')
  console.log('SoC at midnight       ', f(g.zEnd, 5))
  console.log('lowest SoC of the day ', f(Math.min(...g.rows.map((r) => r.z)), 5), 'at hour', g.rows.reduce((a, r) => (r.z < a.z ? r : a)).h)
  console.log('highest SoC of the day', f(Math.max(...g.rows.map((r) => r.z)), 5), 'at hour', g.rows.reduce((a, r) => (r.z > a.z ? r : a)).h)
  const peak = g.rows.reduce((a, r) => (r.pv > a.pv ? r : a))
  console.log('peak array power      ', f(peak.pv, 5), 'W at hour', peak.h, 'on', peak.G, 'W/m² and', f(peak.T - 273.15, 4), '°C')
  console.log('peak load             ', f(Math.max(...g.rows.map((r) => r.load)), 5), 'W')
  console.log('ledger residual       ', g.residual.toExponential(3), 'J')
  console.log('--- the same day on half the bank (100 Ah)')
  console.log('curtailed', f(small.curtailed / 3.6e6, 5), 'kWh, unserved', f(small.unserved / 3.6e6, 5), 'kWh, SoC at midnight', f(small.zEnd, 4))
  console.log('--- the same day on double the bank (400 Ah)')
  const big = day(C, B, { bankParallel: 200 })
  console.log('curtailed', f(big.curtailed / 3.6e6, 5), 'kWh, unserved', f(big.unserved / 3.6e6, 5), 'kWh, SoC at midnight', f(big.zEnd, 4))
  console.log('--- hourly, hour / G / P_pv / load / to bank / SoC')
  for (const r of g.rows) console.log('   ', String(r.h).padStart(2), String(r.G).padStart(4), f(r.pv, 5).toString().padStart(8), f(r.load, 4).toString().padStart(6), f(r.toBank / 3.6e6, 4).toString().padStart(9), f(r.z, 4))
}
