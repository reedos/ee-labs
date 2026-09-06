// The numbers Groups D, F and G quote, computed before they are written.
import {
  converter, steadyState, measures, signalIntegral, average,
  saturatingConverter, saturatingSteadyState, saturationEvent, fluxSwing, fluxDensity,
  flyback, halfBridge, isolatedM,
  inverter, inverterSteadyState, inverterMeasures, inverterDistortion,
  squareFundamentalRms, squareThd, spwmFundamentalPeak, lcMagnitude, carrierRatio,
  lossLedger, switchingCrossover, peakEfficiencyLoad, capacitorRms, inductorRipple,
  Rcrit, spectrumOf,
} from '@ee-labs/switched'

const s = (x, n = 4) => (typeof x === 'number' ? Number(x.toPrecision(n)) : x)
const line = (...a) => console.log(...a)

line('=== D1 · volt-seconds are flux (buck + core, R = 2 Ω) ===')
{
  const base = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 2, fs: 100e3 }
  for (const fs of [100e3, 10e3]) {
    const conv = saturatingConverter('buck', { ...base, fs })
    const ss = saturatingSteadyState(conv)
    const m = measures(ss)
    const vs = signalIntegral(ss.segments[0], 'vL')
    line(` fs=${fs / 1e3}kHz mode=${ss.mode} Vo=${s(m.sig.vout.avg, 6)} vs=${s(vs * 1e6)}uVs dB=${s(fluxSwing(conv.core, vs) * 1e3)}mT Bpk=${s(fluxDensity({ L: base.L, ...conv.core }, m.sig.iL.max) * 1e3)}mT iLpp=${s(m.sig.iL.pp)}A Isat=${s(conv.Isat)}A ripple=${s(m.sig.vout.pp * 1e3)}mV`)
  }
}

line('=== D2 · saturation (buck + core) ===')
{
  const base = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, fs: 100e3 }
  for (const R of [1, 2]) {
    const conv = saturatingConverter('buck', { ...base, R })
    const ss = saturatingSteadyState(conv)
    const m = measures(ss)
    const ev = saturationEvent(ss)
    const satT = ss.segments.filter((q) => q.name.endsWith('sat')).reduce((a, q) => a + q.T, 0)
    line(` R=${R} mode=${ss.mode} Vo=${s(m.sig.vout.avg, 6)} iLavg=${s(m.sig.iL.avg)} pp=${s(m.sig.iL.pp)} max=${s(m.sig.iL.max)} Bpk=${s(fluxDensity({ L: base.L, ...conv.core }, m.sig.iL.max) * 1e3)}mT Isat=${s(conv.Isat)} Lsat=${s(conv.Lsat * 1e6)}uH sat=${s((100 * satT) / ss.T)}% ev_i=${ev ? s(ev.i) : '-'} ev_t=${ev ? s(ev.t * 1e6) : '-'}us`)
  }
  const lin = measures(steadyState(converter('buck', { ...base, R: 1 })))
  line(` linear at R=1: iLpp=${s(lin.sig.iL.pp)} vs saturating ${s(measures(saturatingSteadyState(saturatingConverter('buck', { ...base, R: 1 }))).sig.iL.pp)}`)
}

line('=== D3 · flyback ===')
{
  const p = { Vin: 24, D: 0.5, n: 0.5, L: 100e-6, C: 100e-6, R: 12, fs: 100e3 }
  const conv = flyback(p)
  const ss = steadyState(conv)
  const m = measures(ss)
  line(` mode=${ss.mode} M=${s(m.M, 5)} ideal=${s(isolatedM('flyback', p.D, p.n), 5)} Vo=${s(m.sig.vout.avg, 5)} Io=${s(m.Iout)} P=${s(m.Pout)}W`)
  line(` iM avg=${s(m.sig.iL.avg)} pp=${s(m.sig.iL.pp)} max=${s(m.sig.iL.max)} iD avg=${s(m.sig.iD.avg)} max=${s(m.sig.iD.max)} ripple=${s(m.sig.vout.pp * 1e3)}mV vsw max=${s(m.sig.vsw.max)} blocking=${s(conv.blocking(m.sig.vout.avg))}`)
  for (const n of [0.25, 1]) {
    const q = measures(steadyState(flyback({ ...p, n })))
    line(`  n=${n}: M=${s(q.M, 4)} ideal=${s(isolatedM('flyback', p.D, n), 4)} Vo=${s(q.sig.vout.avg, 4)} mode=${q.mode}`)
  }
}

line('=== D4 · half-bridge ===')
{
  const p = { Vin: 48, D: 5 / 12, n: 0.25, L: 100e-6, C: 100e-6, R: 5, fs: 100e3 }
  const conv = halfBridge(p)
  const ss = steadyState(conv)
  const m = measures(ss)
  line(` mode=${ss.mode} M=${s(m.M, 5)} ideal=${s(isolatedM('halfbridge', p.D, p.n), 5)} Vo=${s(m.sig.vout.avg, 5)} Io=${s(m.Iout)} P=${s(m.Pout)}W`)
  line(` iL avg=${s(m.sig.iL.avg)} pp=${s(m.sig.iL.pp * 1e3)}mA vout pp=${s(m.sig.vout.pp * 1e6)}uV vsw max=${s(m.sig.vsw.max)} blocking=${s(conv.blocking())} iQ max=${s(m.sig.iQ.max)}`)
  line(` half period=${s(conv.T * 1e6)}us, ripple at ${s(2 * p.fs / 1e3)}kHz; a buck fed at f_s would ripple ${s((m.sig.iL.pp / (8 * p.fs * p.C)) * 1e6)}uV`)
  for (const D of [0.25]) {
    const q = measures(steadyState(halfBridge({ ...p, D })))
    line(`  D=${D}: M=${s(q.M, 4)} Vo=${s(q.sig.vout.avg, 4)}`)
  }
  const fly = flyback({ Vin: 24, D: 0.5, n: 0.5, L: 100e-6, C: 100e-6, R: 12, fs: 100e3 })
  const fm = measures(steadyState(fly))
  line(` stress: half-bridge ${s(conv.blocking())}V on a ${p.Vin}V rail; flyback ${s(fly.blocking(fm.sig.vout.avg))}V on a 24V rail`)
}

line('=== F1 · square wave ===')
{
  for (const Vdc of [48, 24]) {
    const conv = inverter('square', { Vdc })
    const m = inverterMeasures(inverterSteadyState(conv))
    line(` Vdc=${Vdc}: V1(bridge)=${s(m.Vsw1, 5)} closed=${s(squareFundamentalRms(Vdc), 5)} THD(bridge)=${s(m.thdSw * 100, 4)}% Vrms=${s(m.VswRms, 5)} V1(load)=${s(m.V1, 5)} THD(load)=${s(m.thd * 100, 4)}% P=${s(m.Pout)}W`)
  }
  line(` |H| at 180 Hz = ${s(lcMagnitude({ L: 1e-3, C: 10e-6, R: 10 }, 180), 4)}, at 60 Hz = ${s(lcMagnitude({ L: 1e-3, C: 10e-6, R: 10 }, 60), 4)}, f0 = ${s(1 / (2 * Math.PI * Math.sqrt(1e-3 * 1e-5)))}Hz`)
}

line('=== F2 · sine PWM (fsw 3780, mf 63) ===')
{
  for (const ma of [0.8, 0.4, 1.2]) {
    const conv = inverter('spwm', { ma })
    const m = inverterMeasures(inverterSteadyState(conv))
    line(` ma=${ma}: mf=${conv.mf} V1 peak=${s(m.Vsw1 * Math.SQRT2, 5)} commanded=${s(spwmFundamentalPeak(ma, 48), 5)} V1 rms=${s(m.Vsw1, 5)} load V1=${s(m.V1, 5)} THD(load)=${s(m.thd * 100, 4)}% Vrms(load)=${s(m.Vrms, 5)}`)
  }
}

line('=== F3 · the families ===')
{
  for (const fsw of [3780, 1980]) {
    const conv = inverter('spwm', { fsw, ma: 0.8 })
    const ss = inverterSteadyState(conv)
    const m = inverterMeasures(ss)
    const h = m.harmonics
    const first = h[0].rms
    const biggestBaseband = Math.max(...h.filter((q) => q.k > 1 && q.k <= conv.mf - 5).map((q) => q.rms))
    line(` fsw=${fsw} mf=${conv.mf}: cluster at k=${m.carrier.k} rms=${s(m.carrier.rms, 4)} (${s((100 * m.carrier.rms) / first, 3)}% of the fundamental); largest baseband ${s((100 * biggestBaseband) / first, 3)}%`)
    line(`   attenuation measured=${s(m.attenuation, 4)} |H| at ${m.carrier.k * 60}Hz=${s(lcMagnitude({ L: 1e-3, C: 10e-6, R: 10 }, m.carrier.k * 60), 4)}  THD load=${s(m.thd * 100, 4)}%`)
  }
}

line('=== F4 · THD against the carrier ===')
{
  for (const fsw of [900, 1980, 3780, 7740]) {
    const conv = inverter('spwm', { fsw, ma: 0.8 })
    const d = inverterDistortion(inverterSteadyState(conv))
    line(` fsw=${fsw} (mf=${conv.mf}, ${s(conv.fsw / 1e3, 3)}kHz): THD=${s(d.thd * 100, 4)}% V1=${s(d.V1, 5)} |H|=${s(lcMagnitude({ L: 1e-3, C: 10e-6, R: 10 }, conv.fsw), 4)}`)
  }
}

line('=== G1 · conduction against switching ===')
{
  const base = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, Ron: 0.12, sync: true, tr: 20e-9, tf: 20e-9 }
  const at = (fs) => {
    const m = measures(steadyState(converter('buck', { ...base, fs })))
    return { m, led: lossLedger(m) }
  }
  const here = at(100e3)
  const fstar = switchingCrossover({ Ron: base.Ron, Iout: here.m.Iout, Vblk: here.m.Vblk, tsw: base.tr })
  line(` crossover f* = ${s(fstar / 1e3, 4)} kHz  (Vblk=${s(here.m.Vblk)} Iout=${s(here.m.Iout, 4)})`)
  for (const fs of [100e3, fstar, 2e6]) {
    const q = at(fs)
    line(`  fs=${s(fs / 1e3, 4)}kHz cond=${s(q.led.conduction * 1e3, 4)}mW sw=${s(q.led.switching * 1e3, 4)}mW eta=${s(q.led.eta * 100, 4)}% Vo=${s(q.m.sig.vout.avg, 4)} ripple=${s(q.m.sig.vout.pp * 1e3, 3)}mV`)
  }
}

line('=== G2 · the efficiency curve ===')
{
  const base = { Vin: 12, D: 5 / 12, L: 22e-6, C: 100e-6, fs: 100e3, Ron: 0.1, RL: 0.05, sync: true }
  const Rstar = peakEfficiencyLoad(base)
  line(` R* = ${s(Rstar, 4)} Ω = √3 × R_crit (${s(Rcrit('buck', base), 4)} Ω)`)
  for (const R of [Rstar, 1, 1000]) {
    const m = measures(steadyState(converter('buck', { ...base, R })))
    const led = lossLedger(m)
    line(`  R=${s(R, 4)} eta=${s(led.eta * 100, 4)}% Pout=${s(m.Pout, 4)}W Io=${s(m.Iout, 4)}A ripple loss=${s((base.Ron + base.RL) * (m.sig.iL.rms ** 2 - m.Iout ** 2) * 1e3, 3)}mW load loss=${s((base.Ron + base.RL) * m.Iout ** 2 * 1e3, 3)}mW dI=${s(m.sig.iL.pp, 4)}`)
  }
}

line('=== G3 · the capacitor’s heat ===')
{
  const p = { Vin: 12, D: 0.5, L: 100e-6, C: 220e-6, R: 24, fs: 100e3, ESR: 0.05 }
  const m = measures(steadyState(converter('boost', p)))
  const dI = m.sig.iL.pp
  const buckLike = capacitorRms('buck', { D: p.D, Iout: m.Iout, dI })
  line(` boost iC rms=${s(m.sig.iC.rms, 4)} closed=${s(capacitorRms('boost', { D: p.D, Iout: m.Iout, dI }), 4)}  buck-with-the-same-ripple=${s(buckLike, 4)}  ratio=${s(m.sig.iC.rms / buckLike, 3)}`)
  line(` ESR heat boost=${s(m.loss.esr * 1e3, 4)}mW buck-like=${s(p.ESR * buckLike ** 2 * 1e3, 3)}mW ratio=${s(m.loss.esr / (p.ESR * buckLike ** 2), 3)}  Vo=${s(m.sig.vout.avg, 4)} Io=${s(m.Iout, 3)} dI=${s(dI, 3)}`)
  for (const ESR of [0.2, 0]) {
    const q = measures(steadyState(converter('boost', { ...p, ESR })))
    line(`  ESR=${ESR}: heat=${s(q.loss.esr * 1e3, 4)}mW ripple=${s(q.sig.vout.pp * 1e3, 4)}mV eta=${s(q.eta * 100, 4)}%`)
  }
}

line('=== G4 · the ledger ===')
{
  const p = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, Ron: 0.05, Vf: 0.5, RL: 0.03, ESR: 0.05, tr: 20e-9, tf: 20e-9 }
  for (const Ron of [0.05, 0.2, 0]) {
    const m = measures(steadyState(converter('buck', { ...p, Ron })))
    const led = lossLedger(m)
    line(` Ron=${Ron}: ${led.rows.map((q) => `${q.key}=${s(q.watts * 1e3, 3)}mW`).join(' ')} | Pout=${s(led.Pout, 4)}W Psource=${s(led.Psource, 4)}W eta=${s(led.eta * 100, 4)}% residual=${led.residual}`)
  }
}
