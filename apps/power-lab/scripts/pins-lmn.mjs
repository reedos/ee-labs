// The numbers Groups L, M and N quote, computed before they are written.
//
// Run with `node apps/power-lab/scripts/pins-lmn.mjs`. Every figure in
// AGENT_BRIEF_LMN.md and in the notes of `src/groups/lmn.js` came out of here
// first, and `src/lmn.test.js` pins each one against the same engine.
import {
  drive, driveSteadyState, driveMeasures, driveAveraged, driveRunUp,
  armatureRipple, commutation, lossLedger,
  emiConverter, ringConverter, emiSteadyState, emiMeasures, ringMeasures,
  emiHarmonics, fftHarmonics, pulseHarmonic, middlebrook,
  converter, steadyState, measures,
  stagesOf, thermalNetwork, zth, fosterZth, pulsedRise, steadyRise,
  derating, frequencyCeiling, edgeCost,
} from '@ee-labs/switched'

const s = (x, n = 4) => (typeof x === 'number' && Number.isFinite(x) ? Number(x.toPrecision(n)) : x)
const line = (...a) => console.log(...a)

// ---------------------------------------------------------------- Group L

const MOTOR = { Vdc: 48, fs: 20e3, Ra: 1.2, La: 3e-3, k: 0.06, J: 2e-4, B: 1e-5, TL: 0.05 }

line('=== L1 · the armature is the buck’s inductor with a flywheel on it ===')
for (const D of [0.5, 0.75, 0.25]) {
  const conv = drive('dcdrive', { ...MOTOR, D })
  const ss = driveSteadyState(conv)
  const m = driveMeasures(ss)
  const a = driveAveraged(conv)
  line(
    ` D=${D} mode=${ss.mode} Va=${s(a.Va, 5)} w=${s(m.omega, 6)}rad/s rpm=${s(m.rpm, 5)}` +
      ` Ia=${s(m.Iavg, 5)}A dI=${s(m.ripple, 5)}A pred=${s(armatureRipple('dcdrive', { Vdc: 48, D, La: 3e-3, fs: 20e3 }), 5)}` +
      ` T=${s(m.torque, 5)}Nm Tload=${s(m.torqueLoad, 5)} dw=${s(m.omegaRipple, 4)}rad/s` +
      ` share=${s(m.omegaRipple / m.omega, 3)} eta=${s(100 * m.eta, 4)}% Pin=${s(m.Pin, 5)}W`,
  )
}
{
  const conv = drive('dcdrive', MOTOR)
  const a = driveAveraged(conv)
  const m = driveMeasures(driveSteadyState(conv))
  line(` tau_e=${s(a.tauE * 1e3, 4)}ms tau_m=${s(a.tauM * 1e3, 4)}ms separated=${s(a.separated, 4)} periods/tau_e=${s(a.periodsPerTauE, 4)}`)
  line(` averaged w=${s(a.omega, 6)} ia=${s(a.ia, 6)} T=${s(a.torque, 6)} vs exact ${s(m.omega, 6)} ${s(m.Iavg, 6)} ${s(m.torque, 6)}`)
  line(` current ripple as a share of the mean: ${s((100 * m.ripple) / m.Iavg, 3)}%`)
  const l = lossLedger(m)
  line(` ledger: ${l.rows.map((r) => `${r.key}=${s(r.watts * 1e3, 4)}mW`).join(' ')} residual=${s(l.residual, 3)}W`)
  const r = driveRunUp(drive('dcdrive', { ...MOTOR, J: 4e-6 }), [0, 0], { periods: 40000 })
  line(` run-up with a light rotor: settled in ${r.periods} periods`)
}

line('=== L2 · four quadrants ===')
for (const [D, bipolar] of [[0.75, 1], [0.75, 0], [0.3, 1], [0.3, 0], [0.5, 1]]) {
  const conv = drive('hbridge', { ...MOTOR, D, bipolar })
  const m = driveMeasures(driveSteadyState(conv))
  line(
    ` D=${D} ${bipolar ? 'bipolar' : 'unipolar'} Va=${s(conv.commanded, 4)} w=${s(m.omega, 6)} rpm=${s(m.rpm, 5)}` +
      ` Ia=${s(m.Iavg, 5)} dI=${s(m.ripple, 4)} pred=${s(armatureRipple('hbridge', { Vdc: 48, D, La: 3e-3, fs: 20e3, bipolar: !!bipolar }), 4)}` +
      ` iin=${s(m.Iin, 4)}A Pin=${s(m.Pin, 4)}W regen=${m.regenerating} pulses=${conv.pulses}`,
  )
}

line('=== L3 · six-step ===')
for (const fs of [20e3, 5e3]) {
  const conv = drive('bldc', { ...MOTOR, fs, TL: 0.2, lambda: 0.02, pairs: 4, Rs: 0.5, Ls: 1.5e-3 })
  const ss = driveSteadyState(conv)
  const m = driveMeasures(ss)
  const c = commutation(conv, m.omega)
  line(
    ` fs=${fs / 1e3}kHz mode=${ss.mode} w=${s(m.omega, 6)} rpm=${s(m.rpm, 5)} Ia=${s(m.Iavg, 5)} dI=${s(m.ripple, 4)}` +
      ` T=${s(m.torque, 5)} dT=${s(m.torqueRipple, 4)} depth=${s(100 * m.rippleShare, 4)}%` +
      ` fe=${s(c.fe, 5)}Hz sector=${s(c.sector * 1e3, 4)}ms rate=${s(c.rate, 4)}/s periods/sector=${s(c.periodsPerSector, 4)}` +
      ` phaseRms=${s(c.phaseShare * m.Irms, 5)}A eta=${s(100 * m.eta, 4)}%`,
  )
  line(`   pair: Ra=${s(conv.mach.Ra, 4)} La=${s(conv.mach.La * 1e3, 4)}mH k=${s(conv.mach.k, 4)}V·s/rad`)
}

// ---------------------------------------------------------------- Group M

const EMI = { Vin: 24, D: 0.5, fs: 100e3, L: 100e-6, C: 100e-6, R: 6, Rf: 0.05, Rd: 1e4 }

line('=== M1 · what the input sees (stray 1 µH, C_in the knob) ===')
for (const Cin of [100e-6, 10e-6]) {
  const conv = emiConverter({ ...EMI, Lf: 1e-6, Cin })
  const ss = emiSteadyState(conv)
  const m = emiMeasures(ss, { harmonics: 7 })
  const I = m.sig.iL.avg
  line(
    ` Cin=${Cin * 1e6}uF Vo=${s(m.sig.vout.avg, 5)} IL=${s(I, 5)}A dIL=${s(m.sig.iL.pp, 4)}` +
      ` iin avg=${s(m.Iconv, 4)} pp=${s(m.convRipple, 4)} icin rms=${s(m.sig.icin.rms, 4)}A` +
      ` vcin ripple=${s(m.cinRipple * 1e3, 4)}mV iline ripple=${s(m.lineRipple * 1e3, 4)}mA`,
  )
  line(`   harmonics (peak A): ${m.harmonics.map((h) => `k${h.k}=${s(h.peak, 4)}`).join(' ')}`)
  line(`   closed form 2I|sin(kπD)|/kπ: ${m.harmonics.map((h) => `k${h.k}=${s(pulseHarmonic(h.k, 0.5) * I, 4)}`).join(' ')}`)
  line(`   line: ${m.lineHarmonics.map((h) => `k${h.k}=${s(h.peak, 4)}`).join(' ')} att=${s(m.attenuation, 5)} pred=${s(m.predicted, 5)}`)
  const ff = fftHarmonics(ss, 'iin', 3, { n: 32768 })
  line(`   fft vs fourier k1: ${s(ff[0].peak, 6)} / ${s(m.harmonics[0].peak, 6)}`)
  line(`   Cin rms share of the pulse: ${s((100 * m.sig.icin.rms) / m.sig.iin.rms, 4)}%  I√(D(1−D))=${s(I * Math.sqrt(0.25), 4)}A`)
}

line('=== M2 · the input filter ===')
for (const [Lf, Rd] of [[47e-6, 1e4], [47e-6, 1], [47e-6, 10], [1e-6, 1e4]]) {
  const conv = emiConverter({ ...EMI, Cin: 10e-6, Lf, Rd })
  const m = emiMeasures(emiSteadyState(conv), { harmonics: 3 })
  const f = conv.filter
  line(
    ` Lf=${s(Lf * 1e6, 3)}uH Rd=${Rd}Ω f0=${s(f.f0 / 1e3, 4)}kHz Q=${s(f.Q, 4)}` +
      ` att=${s(m.attenuation, 4)} 1/att=${s(1 / m.attenuation, 4)} pred=${s(m.predicted, 4)}` +
      ` line1=${s(m.line1 * 1e3, 4)}mA conv1=${s(m.conv1, 4)}A lineRipple=${s(m.lineRipple * 1e3, 4)}mA`,
  )
  line(
    `   Zout=${s(m.middlebrook.Zout, 4)}Ω at ${s(m.middlebrook.atF / 1e3, 4)}kHz Zin=${s(m.middlebrook.Zin, 4)}Ω` +
      ` ratio=${s(m.middlebrook.ratio, 4)} margin=${s(m.middlebrook.margin, 4)} safe=${m.middlebrook.safe} Pin=${s(m.Pin, 5)}W`,
  )
}

line('=== M3 · the switch node rings ===')
const RING = { Vin: 24, D: 0.5, fs: 1e6, L: 10e-6, C: 10e-6, R: 6, Lp: 100e-9, Cp: 1e-9, Rp: 50 }
for (const over of [{}, { Lp: 400e-9 }, { Cp: 4e-9 }, { Rp: 150 }, { snubber: 1, Csn: 2.2e-9, Rsn: 10 }, { snubber: 1, Csn: 470e-12, Rsn: 10 }]) {
  const conv = ringConverter({ ...RING, ...over })
  const m = ringMeasures(emiSteadyState(conv))
  const r = conv.ring
  line(
    ` ${JSON.stringify(over)} states=${conv.n} f0=${s(r.f0 / 1e6, 5)}MHz meas=${s(m.measured.f / 1e6, 5)}MHz` +
      ` zeta=${s(r.zeta, 4)} Q=${s(r.Q, 4)} over pred=${s(100 * r.overshoot, 4)}% meas=${s(100 * m.overshoot, 4)}%` +
      ` peak=${s(m.peak, 5)}V decay=${s(m.measured.decay, 4)} cycles=${s(r.cycles, 4)}`,
  )
  line(
    `   Vout=${s(m.sig.vout.avg, 6)} Pout=${s(m.Pout, 5)}W loop=${s(m.loss.parasitic * 1e3, 4)}mW snub=${s(m.loss.snubber * 1e3, 4)}mW` +
      ` CV2f=${s(r.Psn * 1e3, 4)}mW Ep=${s(r.Ep * 1e9, 4)}nJ eta=${s(100 * m.eta, 5)}%`,
  )
}

// ---------------------------------------------------------------- Group N

const THERM = { Ta: 25, Tjmax: 150, R1: 0.6, tau1: 1e-3, R2: 1.4, tau2: 0.1, R3: 12, tau3: 300 }
const BUCK = { Vin: 48, D: 0.25, L: 47e-6, C: 100e-6, R: 2, fs: 300e3, Ron: 0.03, RL: 0.02, sync: true, tr: 20e-9, tf: 20e-9 }
const stages = stagesOf(THERM)
const net = thermalNetwork('foster', stages)
const cauer = thermalNetwork('cauer', stages)

const buckAt = (over = {}) => {
  const p = { ...BUCK, ...over }
  const ss = steadyState(converter('buck', p))
  const m = measures(ss)
  const led = lossLedger(m)
  const k = edgeCost({ Vblk: m.Vblk, iOn: m.iTurnOn, iOff: m.iTurnOff, tr: p.tr, tf: p.tf })
  return { p, m, led, k, P: led.conduction + led.switching }
}

line('=== N1 · loss becomes temperature ===')
line(` network Rth=${s(net.Rtotal, 4)}K/W stages=${stages.map((q) => `${s(q.Rth, 3)}K/W@${s(q.tau, 3)}s`).join(' ')} Cth=${net.C.map((c) => s(c, 3)).join(' ')}J/K`)
for (const R of [2, 1]) {
  const { m, led, P, k } = buckAt({ R })
  const d = derating(net, { Ta: THERM.Ta, Tjmax: THERM.Tjmax, P })
  line(
    ` R=${R}Ω Vo=${s(m.sig.vout.avg, 5)} Io=${s(m.Iout, 4)}A Pout=${s(led.Pout, 5)}W cond=${s(led.conduction, 4)}W` +
      ` sw=${s(led.switching, 4)}W P=${s(P, 4)}W eta=${s(100 * led.eta, 5)}% rise=${s(d.rise, 4)}K Tj=${s(d.Tj, 4)}C` +
      ` Pmax=${s(d.Pmax, 4)}W margin=${s(d.margin, 4)} headroom=${s(d.headroom, 4)}K kSw=${s(k * 1e6, 4)}uW/Hz`,
  )
  line(`   rows: ${led.rows.map((r) => `${r.key}=${s(r.watts * 1e3, 4)}mW`).join(' ')} residual=${s(led.residual, 3)}`)
}

line('=== N2 · the thermal RC ===')
{
  const { P } = buckAt({})
  line(` step response of ${s(P, 4)}W:`)
  for (const t of [1e-4, 1e-3, 1e-2, 0.1, 1, 10, 100, 1000]) {
    const [f] = zth(net, [t])
    const [c] = zth(cauer, [t])
    line(`   t=${t}s foster Zth=${s(f, 5)}K/W (closed ${s(fosterZth(stages, t), 5)}) cauer=${s(c, 5)} gap=${s(100 * (1 - c / f), 3)}%`)
  }
  line(` steady rise ${s(steadyRise(net, P), 5)}K, Tj ${s(THERM.Ta + steadyRise(net, P), 5)}C`)
  for (const period of [1, 1e-3, 100]) {
    const q = pulsedRise(net, { P, duty: 0.5, period })
    const qc = pulsedRise(cauer, { P, duty: 0.5, period })
    line(
      `   pulse ${period}s at 50%: peak=${s(q.peak, 5)}K valley=${s(q.valley, 5)} swing=${s(q.swing, 4)} mean=${s(q.mean, 5)}` +
        ` flat=${s(q.flat, 5)} Tj=${s(THERM.Ta + q.peak, 5)}C | cauer peak=${s(qc.peak, 5)} swing=${s(qc.swing, 4)}`,
    )
  }
}

line('=== N3 · faster is hotter ===')
{
  for (const fs of [300e3, 1e6, 2e6]) {
    const { m, led, P, k } = buckAt({ fs })
    const d = derating(net, { Ta: THERM.Ta, Tjmax: THERM.Tjmax, P })
    const c = frequencyCeiling({ Rtotal: net.Rtotal, Ta: THERM.Ta, Tjmax: THERM.Tjmax, Pcond: led.conduction, kSw: k })
    line(
      ` fs=${s(fs / 1e3, 4)}kHz cond=${s(led.conduction, 4)}W sw=${s(led.switching, 4)}W P=${s(P, 4)}W` +
        ` Tj=${s(d.Tj, 5)}C eta=${s(100 * led.eta, 5)}% budget=${s(c.budget, 4)}W ceiling=${s(c.fs / 1e6, 4)}MHz kSw=${s(k * 1e6, 4)}uW/Hz`,
    )
    // The other half of the tradeoff: what the frequency buys. §4's N3 asks for
    // the ripple beside the heat, on the one curve.
    line(
      `   ripple dIL=${s(m.sig.iL.pp * 1e3, 5)}mA against Vo(1-D)/(L fs)=${s((m.sig.vout.avg * (1 - 0.25) * 1e3) / (47e-6 * fs), 5)}mA`,
    )
  }
  // The turning point. Below it the ripple costs more in conduction than the
  // edges save, so the curve falls and "faster is hotter" does not yet hold.
  // A ternary search on log f_s, the same one `coolestFrequency` runs.
  {
    let a = Math.log(20e3)
    let b = Math.log(3e6)
    const TjAt = (u) => THERM.Ta + buckAt({ fs: Math.exp(u) }).P * net.Rtotal
    for (let i = 0; i < 20; i++) {
      const c1 = a + (b - a) / 3
      const d1 = b - (b - a) / 3
      if (TjAt(c1) < TjAt(d1)) b = d1
      else a = c1
    }
    const fs = Math.exp((a + b) / 2)
    const { m, led, P } = buckAt({ fs })
    line(
      ` coolest fs=${s(fs / 1e3, 4)}kHz Tj=${s(THERM.Ta + P * net.Rtotal, 5)}C P=${s(P, 4)}W` +
        ` cond=${s(led.conduction, 4)}W sw=${s(led.switching, 4)}W ripple=${s(m.sig.iL.pp * 1e3, 5)}mA`,
    )
  }
  const hot = buckAt({ R: 1 })
  const c = frequencyCeiling({ Rtotal: net.Rtotal, Ta: THERM.Ta, Tjmax: THERM.Tjmax, Pcond: hot.led.conduction, kSw: hot.k })
  line(` at R=1Ω the ceiling is ${s(c.fs / 1e3, 4)}kHz, feasible=${c.feasible}`)
  const warm = derating(net, { Ta: 60, Tjmax: 150 })
  line(` at 60 C ambient the budget falls to ${s(warm.Pmax, 4)}W from ${s(derating(net, { Ta: 25, Tjmax: 150 }).Pmax, 4)}W`)
}
