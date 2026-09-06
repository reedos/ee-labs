// Every number Groups J and K quote, computed from the engine before a word
// of the brief or the notes was written.
//
// The house rule is that a number in a note is a test, and the way that rule
// is kept is that the note is written from this script's output rather than
// the other way round. Run it with `node apps/power-lab/scripts/pins-jk.mjs`.
//
// J is the half-bridge's three siblings: the forward, the push-pull and the
// full bridge. K is resonant conversion: the series tank and the LLC.

import {
  forward,
  pushPull,
  fullBridge,
  forwardFamily,
  forwardM,
  forwardMeasures,
  windowedSteadyState,
  fluxWalk,
  halfBridge,
  steadyState,
  measures,
  resonantConverter,
  resonantSteadyState,
  resonantMeasures,
  fhaRatio,
  seriesResonance,
  lowerResonance,
  tankQ,
  tankImpedance,
  acLoad,
  hardSwitchedEdgeLoss,
} from '@ee-labs/switched'

const f = (v, d = 4) => (Number.isFinite(v) ? v.toPrecision(d) : String(v))
const pc = (v, d = 2) => `${(100 * v).toFixed(d)} %`
const us = (v) => `${(v * 1e6).toFixed(3)} µs`
const mA = (v) => `${(v * 1e3).toFixed(3)} mA`
const mW = (v) => `${(v * 1e3).toFixed(3)} mW`
const mV = (v) => `${(v * 1e3).toFixed(3)} mV`
const kHz = (v) => `${(v / 1e3).toFixed(3)} kHz`

const head = (s) => console.log(`\n=== ${s} ===`)

// ------------------------------------------------------------------ J1
const J1 = { Vin: 48, D: 0.4, n: 0.25, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, Lm: 1e-3 }
head('J1 · the forward converter')
{
  const at = (over = {}) => {
    const conv = forward({ ...J1, ...over })
    const ss = windowedSteadyState(conv)
    return { conv, ss, m: forwardMeasures(ss) }
  }
  const { conv, ss, m } = at()
  console.log('defaults      ', JSON.stringify(J1))
  console.log('M             ', f(m.M, 6), 'ideal n·D =', f(forwardM('forward', J1.D, J1.n), 6))
  console.log('V_out         ', f(m.sig.vout.avg, 6), 'V')
  console.log('mode          ', ss.mode, ' intervals:', ss.segments.map((s) => `${s.name} ${us(s.T)}`).join(', '))
  console.log('reset         ', us(ss.segments.find((s) => s.name === 'reset').T), '= n_r·D·T =', us(conv.resetTime))
  console.log('duty ceiling  ', pc(conv.maxDuty), ' resets:', conv.resets)
  console.log('switch blocks ', f(conv.blocking(), 4), 'V =', f(conv.blocking() / J1.Vin, 3), '× the rail')
  console.log('i_M peak      ', f(m.sig.iM.max, 4), 'A', '  V_in·D/(L_m f_s) =', f((J1.Vin * J1.D) / (J1.Lm * J1.fs), 4))
  console.log('⟨i_M⟩         ', mA(m.sig.iM.avg))
  console.log('ΔI_L          ', mA(m.sig.iL.pp), ' ΔV_out', mV(m.sig.vout.pp))
  console.log('i_in min      ', f(m.sig.iin.min, 4), 'A (the reset returns it)')
  console.log('P_in          ', f(m.Pin, 5), 'W  P_out', f(m.Pout, 5), 'W  η', pc(m.eta))
  for (const D of [0.25, 0.45, 0.3]) {
    const q = at({ D })
    console.log(`  D = ${pc(D, 0)}:`, 'M', f(q.m.M, 5), 'V_out', f(q.m.sig.vout.avg, 5), 'reset', us(q.ss.segments.find((s) => s.name === 'reset').T), 'left', us(q.ss.segments.filter((s) => s.name === 'freewheel' || s.name === 'dead').reduce((a, s) => a + s.T, 0)))
  }
}

// ------------------------------------------------------------------ J2
const J2 = { Vin: 48, D: 0.4, n: 0.125, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, Lm: 4e-3, Ron: 0.05, mismatch: 0.5 }
head('J2 · the push-pull')
{
  const at = (over = {}) => {
    const conv = pushPull({ ...J2, ...over })
    const ss = windowedSteadyState(conv)
    return { conv, ss, m: forwardMeasures(ss) }
  }
  const { conv, ss, m } = at()
  console.log('defaults      ', JSON.stringify(J2))
  console.log('M             ', f(m.M, 6), 'ideal 2·n·D =', f(forwardM('pushpull', J2.D, J2.n), 6))
  console.log('V_out         ', f(m.sig.vout.avg, 6), 'V   I_out', f(m.Iout, 5), 'A')
  console.log('intervals     ', ss.segments.map((s) => `${s.name} ${us(s.T)}`).join(', '))
  console.log('ΔI_L          ', mA(m.sig.iL.pp), ' ΔV_out', mV(m.sig.vout.pp), 'at 2 f_s =', kHz(2 * J2.fs))
  console.log('ΔV at f_s     ', mV(m.sig.iL.pp / (8 * J2.fs * J2.C)))
  console.log('R_on1/R_on2   ', f(conv.Ron1, 4), '/', f(conv.Ron2, 4), 'Ω')
  console.log('ΔI_M          ', mA(m.sig.iM.pp), ' V_in·D/(L_m f_s) =', mA((J2.Vin * J2.D) / (J2.Lm * J2.fs)))
  console.log('⟨i_M⟩         ', mA(m.sig.iM.avg), ' formula', mA(fluxWalk({ n: J2.n, Iout: m.Iout, Ron1: conv.Ron1, Ron2: conv.Ron2 })))
  console.log('i_M min/max   ', mA(m.sig.iM.min), '/', mA(m.sig.iM.max))
  console.log('switch blocks ', f(conv.blocking(), 4), 'V')
  console.log('η             ', pc(m.eta), ' switch loss', mW(m.loss.switch))
  for (const mm of [0, 1, 0.25, 2]) {
    const q = at({ mismatch: mm })
    console.log(`  mismatch ${pc(mm, 0)}:`, '⟨i_M⟩', mA(q.m.sig.iM.avg), 'of a', mA(q.m.sig.iM.pp), 'ripple', '=', pc(q.m.sig.iM.avg / q.m.sig.iM.pp, 1), '  ceiling n·I_out', mA(J2.n * q.m.Iout))
  }
}

// ------------------------------------------------------------------ J3
const J3 = { Vin: 48, D: 0.4, n: 0.125, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, Lm: 1e-3, Ron: 0.05 }
head('J3 · the full bridge, and the three on one table')
{
  const at = (kind, over = {}) => {
    const n = kind === 'forward' ? 2 * J3.n : J3.n
    const conv = forwardFamily(kind, { ...J3, n, ...over })
    const ss = windowedSteadyState(conv)
    return { conv, ss, m: forwardMeasures(ss) }
  }
  const rows = ['forward', 'pushpull', 'fullbridge'].map((k) => ({ k, ...at(k) }))
  for (const r of rows) {
    console.log(
      r.k.padEnd(11),
      'M', f(r.m.M, 5),
      'V_out', f(r.m.sig.vout.avg, 5),
      'stress', f(r.conv.blocking(), 4), 'V',
      'switches', r.k === 'forward' ? 1 : r.k === 'pushpull' ? 2 : 4,
      'switch loss', mW(r.m.loss.switch),
      'ΔI_L', mA(r.m.sig.iL.pp),
      'ΔV', mV(r.m.sig.vout.pp),
      'η', pc(r.m.eta),
    )
  }
  const fb = rows[2]
  console.log('bridge stress / push-pull stress:', f(rows[2].conv.blocking() / rows[1].conv.blocking(), 3))
  console.log('bridge switch loss / push-pull  :', f(rows[2].m.loss.switch / rows[1].m.loss.switch, 4))
  for (const D of [0.25, 0.45]) {
    const q = at('fullbridge', { D })
    console.log(`  D = ${pc(D, 0)}: M`, f(q.m.M, 5), 'V_out', f(q.m.sig.vout.avg, 5))
  }
  console.log('the forward needs twice the turns for the same output: n = 0.25 against 0.125')
}

// ------------------------------------------------------------------ K
const TANK = { Vin: 48, Lr: 30e-6, Cr: 84.4e-9, Lm: 150e-6, n: 0.5, C: 100e-6, R: 12 }
const FR = seriesResonance(TANK)
head('the tank')
console.log('f_r           ', kHz(FR))
console.log('f_r2 (LLC)    ', kHz(lowerResonance(TANK)))
console.log('Z_0           ', f(tankImpedance(TANK), 5), 'Ω   R_ac', f(acLoad(TANK), 5), 'Ω   Q', f(tankQ(TANK), 4))

// ------------------------------------------------------------------ K1
head('K1 · the series resonant tank')
{
  const at = (over = {}) => {
    const conv = resonantConverter('src', { ...TANK, fs: 120e3, ...over })
    const ss = resonantSteadyState(conv)
    return { conv, ss, m: resonantMeasures(ss) }
  }
  const { conv, ss, m } = at()
  console.log('defaults      ', JSON.stringify({ ...TANK, fs: Math.round(FR) }))
  console.log('M at f_r      ', f(m.M, 6), ' n/2 =', f(TANK.n / 2, 6), ' V_out', f(m.sig.vout.avg, 6), 'V')
  console.log('FHA at f_r    ', f(m.Mfha, 6), ' error', pc(m.fhaError, 3))
  console.log('intervals     ', ss.segments.map((s) => `${s.name} ${us(s.T)}`).join(', '))
  console.log('i_r peak      ', f(m.sig.iL.max, 5), 'A  rms', f(m.sig.iL.rms, 5), 'A')
  console.log('v_Cr swing    ', f(m.sig.vC.pp, 5), 'V')
  console.log('P_out         ', f(m.Pout, 5), 'W  η', pc(m.eta))
  for (const ratio of [0.6, 0.8, 1.2, 1.6, 2.0]) {
    const q = at({ fs: ratio * FR })
    console.log(
      `  f = ${kHz(ratio * FR)} (${ratio}×):`,
      'M', f(q.m.M, 5),
      'FHA', f(q.m.Mfha, 5),
      'error', pc(q.m.fhaError, 2),
      'V_out', f(q.m.sig.vout.avg, 5),
      q.m.zvs ? 'ZVS' : q.m.zcs ? 'zero current at the edge' : 'hard',
      'i_on', f(q.m.iTurnOn, 4),
    )
  }
  // Round frequencies a knob would sit at.
  for (const fs of [120e3, 60e3, 160e3, 100e3]) {
    const q = at({ fs })
    console.log(`  f_s = ${kHz(fs)}:`, 'M', f(q.m.M, 5), 'V_out', f(q.m.sig.vout.avg, 5), 'FHA', f(q.m.Mfha, 5), 'error', pc(q.m.fhaError, 2), q.m.zvs ? 'ZVS' : q.m.zcs ? 'ZCS' : 'hard')
  }
}

// ------------------------------------------------------------------ K2
head('K2 · the LLC')
{
  const at = (over = {}) => {
    const conv = resonantConverter('llc', { ...TANK, fs: 80e3, ...over })
    const ss = resonantSteadyState(conv)
    return { conv, ss, m: resonantMeasures(ss) }
  }
  const { conv, m } = at()
  console.log('defaults      ', JSON.stringify({ ...TANK, fs: 80e3 }))
  console.log('M at 80 kHz   ', f(m.M, 6), ' V_out', f(m.sig.vout.avg, 6), 'V  gain over n/2:', f(m.M / (TANK.n / 2), 5))
  console.log('FHA           ', f(m.Mfha, 6), ' error', pc(m.fhaError, 2))
  console.log('L_m/L_r       ', f(TANK.Lm / TANK.Lr, 4), ' f_r2', kHz(lowerResonance(TANK)))
  for (const R of [6, 12, 48]) {
    const q = at({ R })
    console.log(`  R = ${R} Ω:`, 'M', f(q.m.M, 5), 'V_out', f(q.m.sig.vout.avg, 5), 'Q', f(tankQ({ ...TANK, R }), 4))
  }
  const peakOf = (Lm, R = 12) => {
    let best = { M: -1, fs: 0 }
    for (let i = 0; i <= 120; i++) {
      const fs = (0.35 + (0.75 * i) / 120) * FR
      const M = at({ Lm, R, fs }).m.M
      if (M > best.M) best = { M, fs }
    }
    return best
  }
  for (const Lm of [60e-6, 150e-6, 300e-6]) {
    const p = peakOf(Lm)
    console.log(`  L_m = ${(Lm * 1e6).toFixed(0)} µH (L_m/L_r = ${(Lm / TANK.Lr).toFixed(1)}): peak M`, f(p.M, 5), 'at', kHz(p.fs), `(${f(p.fs / FR, 4)}×)`, ' f_r2', kHz(lowerResonance({ ...TANK, Lm })))
  }
  for (const fs of [80e3, 120e3, 60e3]) {
    const q = at({ fs })
    console.log(`  f_s = ${kHz(fs)}:`, 'M', f(q.m.M, 5), 'V_out', f(q.m.sig.vout.avg, 5), q.m.zvs ? 'ZVS' : q.m.zcs ? 'ZCS' : 'hard')
  }
}

// ------------------------------------------------------------------ K3
const K3 = { ...TANK, fs: 130e3, Rs: 0.2, tr: 20e-9, tf: 20e-9 }
head('K3 · why resonant')
{
  const at = (over = {}) => {
    const conv = resonantConverter('llc', { ...K3, ...over })
    const ss = resonantSteadyState(conv)
    return { conv, ss, m: resonantMeasures(ss) }
  }
  const { m } = at()
  console.log('defaults      ', JSON.stringify(K3))
  console.log('M             ', f(m.M, 6), ' V_out', f(m.sig.vout.avg, 6), 'V  P_out', f(m.Pout, 5), 'W')
  console.log('i at turn-on  ', f(m.iTurnOn, 5), 'A   at turn-off', f(m.iTurnOff, 5), 'A   ZVS', m.zvs)
  console.log('turn-on loss  ', mW(m.lossTurnOn), '  turn-off loss', mW(m.lossTurnOff))
  console.log('tank loss     ', mW(m.loss.inductor), '  η', pc(m.eta))
  // The hard-switched half-bridge that delivers the same output from the
  // same rail with the same devices.
  const Vo = m.sig.vout.avg
  const hbN = 0.5
  const hardAt = (tsw) =>
    measures(steadyState(halfBridge({ Vin: K3.Vin, n: hbN, D: Vo / (hbN * K3.Vin), L: 100e-6, C: 100e-6, R: K3.R, fs: K3.fs, RL: K3.Rs, tr: tsw, tf: tsw })))
  const hb = halfBridge({ Vin: K3.Vin, n: hbN, D: Vo / (hbN * K3.Vin), L: 100e-6, C: 100e-6, R: K3.R, fs: K3.fs, RL: K3.Rs, tr: K3.tr, tf: K3.tf })
  const hm = measures(steadyState(hb))
  console.log('hard-switched : V_out', f(hm.sig.vout.avg, 5), 'D', f(hb.p.D / 2, 4), 'i_on', f(hm.iTurnOn, 5), 'i_off', f(hm.iTurnOff, 5))
  console.log('  edge loss   ', mW(hm.loss.switching), ' against the LLC’s', mW(m.loss.switching), '=', f(hm.loss.switching / Math.max(1e-30, m.loss.switching), 4), '×')
  console.log('  η           ', pc(hm.eta))
  console.log('  closed form ', mW(hardSwitchedEdgeLoss({ Vin: K3.Vin, Iout: hm.Iout, tr: K3.tr, tf: K3.tf, fs: K3.fs })))
  for (const tsw of [100e-9, 0]) {
    const q = at({ tr: tsw, tf: tsw })
    const h = hardAt(tsw)
    console.log(`  t_sw = ${(tsw * 1e9).toFixed(0)} ns:`, 'LLC edges', mW(q.m.loss.switching), 'η', pc(q.m.eta), '| hard', mW(h.loss.switching), 'η', pc(h.eta))
  }
}
