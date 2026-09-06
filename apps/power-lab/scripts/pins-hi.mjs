// The numbers Groups H and I quote, computed before they are written.
//
// Every figure in AGENT_BRIEF_HI.md, in the notes of `src/groups/hi.js` and
// in the `try` lines came out of this script run against the engine. Run it
// with `node apps/power-lab/scripts/pins-hi.mjs` from the repository root.
import {
  converter,
  steadyState,
  measures,
  gvd,
  gvdClosedForm,
  averagingGuard,
  stepAgreement,
  dcGainMeasured,
  threePhase,
  threePhaseSteadyState,
  threePhaseMeasures,
  fourierAt,
  sixStepLineRms,
  sixStepLinePeak,
  sixStepPhaseRms,
  sixStepPhaseTotalRms,
  sixStepLineTotalRms,
  spwmLinePeak,
  spwmPhasePeak,
  referencePeak,
  injectionHeadroom,
  triplenRatio,
  INJECTION,
} from '@ee-labs/switched'

const s = (x, n = 4) => (typeof x === 'number' ? Number(x.toPrecision(n)) : x)
const line = (...a) => console.log(...a)
const pct = (x) => `${s(100 * x, 4)} %`

const H1 = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, sync: true, Ron: 0.05, RL: 0.05 }
const H2 = { Vin: 12, D: 5 / 12, L: 100e-6, C: 100e-6, R: 5, fs: 100e3, sync: true }
const H3 = { Vin: 12, D: 0.5, L: 1e-3, C: 100e-6, R: 10, fs: 100e3, sync: true }
const I = { Vdc: 48, f1: 60, L: 20e-3, R: 10 }

line('=== H1 · the averaged model, a load step on a synchronous buck ===')
{
  const conv = converter('buck', H1)
  const m = measures(steadyState(conv))
  line(` before: V_o=${s(m.sig.vout.avg, 6)} ripple=${s(m.sig.vout.pp * 1e3)}mV iL=${s(m.sig.iL.avg)}A mode=${m.mode} eta=${pct(m.eta)}`)
  for (const R of [2.5, 10]) {
    const after = converter('buck', { ...H1, R })
    const q = measures(steadyState(after))
    const a = stepAgreement(conv, after, { periods: 200, n: 24 })
    const ai = stepAgreement(conv, after, { periods: 200, n: 24, out: 'iL' })
    line(
      ` R 5→${R}Ω: V_o ${s(m.sig.vout.avg, 6)}→${s(q.sig.vout.avg, 6)} (${s((q.sig.vout.avg - m.sig.vout.avg) * 1e3, 3)}mV)` +
        ` ripple after=${s(q.sig.vout.pp * 1e3)}mV; worst gap ${s(a.worst * a.span * 1e6, 3)}µV = ${pct(a.worst)} of the step` +
        `; iL ${s(ai.from)}→${s(ai.to)}A, worst ${pct(ai.worst)}`,
    )
  }
  const tf = gvd(conv)
  line(` model: f_0=${s(tf.w0 / (2 * Math.PI))}Hz Q=${s(tf.Q)} G(0)=${s(tf.dc)}V ceiling f_s/5=${s(averagingGuard(tf, H1.fs).limit)}Hz`)
}

line('=== H2 · the buck as a plant ===')
{
  const conv = converter('buck', H2)
  const tf = gvd(conv)
  const cf = gvdClosedForm('buck', H2)
  line(` b=[${tf.b.map((v) => s(v, 6))}] a=[${tf.a.map((v) => s(v, 6))}]`)
  line(
    ` G(0)=${s(tf.dc, 6)}V closed ${s(cf.dc, 6)}V measured on the switched engine ${s(dcGainMeasured(conv, (D) => converter('buck', { ...H2, D })), 6)}V`,
  )
  line(` f_0=${s(tf.w0 / (2 * Math.PI), 6)}Hz closed ${s(cf.f0, 6)}Hz  Q=${s(tf.Q, 6)} closed ${s(cf.Q, 6)}  zeros=${tf.zeros.length}`)
  for (const fs of [100e3, 10e3]) {
    const g = averagingGuard(gvd(converter('buck', { ...H2, fs })), fs)
    line(`  f_s=${s(fs / 1e3)}kHz: ceiling ${s(g.limit)}Hz, highest feature ${s(g.highest)}Hz, ratio ${s(g.ratio, 3)}, ${g.state}`)
  }
  const r = measures(steadyState(converter('buck', { ...H2, fs: 10e3 })))
  line(`  at 10 kHz the converter itself: ripple ${s(r.sig.vout.pp * 1e3)}mV, ΔI_L ${s(r.sig.iL.pp)}A, i_L min ${s(r.sig.iL.min)}A`)
}

line('=== H3 · the zero in the wrong half ===')
{
  for (const D of [0.5, 0.6]) {
    const p = { ...H3, D }
    const conv = converter('boost', p)
    const m = measures(steadyState(conv))
    const tf = gvd(conv)
    const cf = gvdClosedForm('boost', p)
    line(
      ` D=${s(D)}: V_o=${s(m.sig.vout.avg, 6)} iL=${s(m.sig.iL.avg)} f_z=${s(tf.wz / (2 * Math.PI), 6)}Hz closed ${s(cf.fz, 6)}Hz` +
        ` f_0=${s(tf.w0 / (2 * Math.PI), 6)}Hz Q=${s(tf.Q, 6)} G(0)=${s(tf.dc, 6)}V`,
    )
    const dD = 0.05
    const a = stepAgreement(conv, converter('boost', { ...p, D: D + dD }), { periods: 200, n: 24 })
    line(
      `   +${pct(dD)} duty: ${s(a.from, 6)}→${s(a.to, 6)}V, dips to ${s(a.dip, 6)}V (${s((a.from - a.dip) * 1e3, 3)}mV below where it started)` +
        `, initial slope ${s(tf.slope0 * dD, 4)} V/s, worst gap ${pct(a.worst)} of the step`,
    )
  }
}

line('=== I1 · six-step ===')
{
  for (const Vdc of [48, 24]) {
    const conv = threePhase('sixstep', { ...I, Vdc })
    const ss = threePhaseSteadyState(conv)
    const m = threePhaseMeasures(ss)
    line(
      ` V_dc=${Vdc}: V_ll1=${s(m.Vll1, 6)}V rms closed ${s(sixStepLineRms(Vdc), 6)}; peak ${s(m.Vll1 * Math.SQRT2, 6)} closed ${s(sixStepLinePeak(Vdc), 6)}` +
        `; V_ph1=${s(m.V1, 6)} closed ${s(sixStepPhaseRms(Vdc), 6)}`,
    )
    line(
      `   v_ab rms ${s(m.sig.vab.rms, 6)} closed ${s(sixStepLineTotalRms(Vdc), 6)}; v_an rms ${s(m.sig.van.rms, 6)} closed ${s(sixStepPhaseTotalRms(Vdc), 6)}` +
        `; v_an max ${s(m.sig.van.max, 6)} = 2V_dc/3 ${s((2 * Vdc) / 3, 6)}`,
    )
    const sh = (k) => {
      const c = fourierAt(ss, 'vab', k)
      return Math.hypot(c.a, c.b) / Math.SQRT2 / m.Vll1
    }
    line(
      `   harmonics of v_ab: 3rd ${s(sh(3), 3)}, 5th ${pct(sh(5))}, 7th ${pct(sh(7))}, 9th ${s(sh(9), 3)}, 11th ${pct(sh(11))}` +
        `; THD ${pct(m.thdLine)}, current THD ${pct(m.thdCurrent)}`,
    )
    line(`   P=${s(m.Pout)}W bus=${s(m.Pdc)}W balance=${s(m.balance, 3)}W I1=${s(m.I1)}A I_rms=${s(m.Irms)}A p2=${s(m.p2, 3)}W p6=${s(m.p6)}W`)
  }
}

line('=== I2 · sine PWM in three phases ===')
{
  line(` reference peak with the offset: ${s(referencePeak(INJECTION), 6)} = √3/2 ${s(Math.sqrt(3) / 2, 6)}; headroom ${s(injectionHeadroom(), 6)}`)
  line(` the ceiling itself is a knife edge: at m_a = 2/√3 the reference touches the carrier's own peak, so the chip stops at 115 %`)
  line(` carrier ratios: 1260/60 → ${triplenRatio(1260, 60)}, 900/60 → ${triplenRatio(900, 60)}, 3780/60 → ${triplenRatio(3780, 60)}`)
  for (const inject of [0, INJECTION]) {
    for (const ma of [0.8, 1.15]) {
      const conv = threePhase('spwm3', { ...I, ma, inject, fsw: 1260 })
      const ss = threePhaseSteadyState(conv)
      const m = threePhaseMeasures(ss)
      const third = (name) => {
        const c = fourierAt(ss, name, 3)
        return Math.hypot(c.a, c.b)
      }
      line(
        ` offset=${inject ? '1/6' : 'none'} m_a=${s(ma, 5)}: v_ll1 peak ${s(m.Vll1 * Math.SQRT2, 6)}V (line ${s(spwmLinePeak(ma, 48), 6)})` +
          `; v_ph1 peak ${s(m.V1 * Math.SQRT2, 6)} (line ${s(spwmPhasePeak(ma, 48), 6)})` +
          `; 3rd of v_ao ${s(third('vao'), 4)}V, of v_ab ${s(third('vab'), 3)}V, of v_an ${s(third('van'), 3)}V`,
      )
      line(`    THD of v_an ${pct(m.thd)}, of i_a ${pct(m.thdCurrent)}, P=${s(m.Pout)}W, m_f=${conv.mf}`)
    }
  }
}

line('=== I3 · balanced load, constant power ===')
{
  for (const ma of [0.8, 0.4]) {
    const conv = threePhase('spwm3', { ...I, ma, fsw: 1260 })
    const ss = threePhaseSteadyState(conv)
    const m = threePhaseMeasures(ss)
    const Z = Math.hypot(I.R, 2 * Math.PI * I.f1 * I.L)
    const phi = Math.atan2(2 * Math.PI * I.f1 * I.L, I.R)
    line(
      ` m_a=${s(ma)}: P=${s(m.Pdc)}W  one phase P_a=${s(m.Pa)}W swinging ${s(m.pa2)}W at 2f₁ (${pct(m.phaseSwing)} of its mean)` +
        `; the bus swings ${s(m.p2, 3)}W (${s(m.busSwing, 3)}), 6f₁ ${s(m.p6, 3)}W`,
    )
    line(`    |Z|=${s(Z)}Ω φ=${s((phi * 180) / Math.PI)}° 1/cos φ=${s(1 / Math.cos(phi), 6)}; I₁=${s(m.I1)}A I_rms=${s(m.Irms)}A`)
  }
  const conv = threePhase('sixstep', I)
  const m = threePhaseMeasures(threePhaseSteadyState(conv))
  line(` six-step for comparison: bus 2f ${s(m.p2, 3)}W, 6f ${s(m.p6)}W on ${s(m.Pdc)}W`)
}
