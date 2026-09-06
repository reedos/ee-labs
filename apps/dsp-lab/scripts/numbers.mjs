// Every number the plan and the lessons quote, computed here first.
//
//   node apps/dsp-lab/scripts/numbers.mjs
//
// Nothing in DSP_LAB_PLAN.md is a number someone remembered. Each line below
// prints one, from the same functions the app runs, at the lab's defaults. When
// a default moves, this script is rerun and the plan is corrected from it.

import {
  arOrderCriteria,
  arSpectrum,
  arYuleWalker,
  bandStats,
  bartlett,
  biquadResponse,
  bitReversal,
  decimate,
  designBiquad,
  designDecimationFir,
  designFir,
  designFirSpec,
  designInterpolationFir,
  designIir,
  designIirSpec,
  designRemezSpec,
  expandTaps,
  fftCost,
  findLimitCycle,
  firResponse,
  hash01,
  iirOrderFor,
  interpolate,
  lmsStepBound,
  makeDecimateHold,
  makeFixedBiquad,
  makeInterpolateFill,
  measureFir,
  misadjustment,
  multirateCost,
  periodogram,
  polyphaseDecimate,
  polyphaseInterpolate,
  poleRadius,
  quantizeBiquad,
  quantizer,
  remez,
  remezOrder,
  render,
  roundingNoise,
  runAdaptive,
  scalingNorms,
  spectrum,
  stopbandDepth,
  tailPower,
  upsample,
  weightError,
  welch,
  wiener,
  windowTaps,
  windowTransition,
  WINDOW_SPECS,
  convolveFir,
  downsample,
} from '@ee-labs/dsp'

const SR = 48000
const FRAME = 4096
const cascade = (secs, f, sr) => secs.reduce((m, c) => m * biquadResponse(c, f, sr), 1)
const white = (n, seed) => Float64Array.from({ length: n }, (_, i) => 2 * hash01(i, seed) - 1)
const db = (x) => 20 * Math.log10(x)
const p = (label, value) => console.log(`${label.padEnd(58)} ${value}`)
const head = (s) => console.log(`\n=== ${s} ===`)

/** The amplitude of a spectral line, the way the app's readout reads it. */
function lineAt(buf, f) {
  const s = spectrum(buf, SR, 'hann')
  let bi = 0
  for (let i = 1; i < s.freqs.length; i++) {
    if (Math.abs(s.freqs[i] - f) < Math.abs(s.freqs[bi] - f)) bi = i
  }
  let m = 0
  for (let i = Math.max(0, bi - 2); i <= Math.min(s.amps.length - 1, bi + 2); i++) {
    m = Math.max(m, s.amps[i])
  }
  return m
}

const tone = (freq, amp = 1) => [{ id: 1, type: 'sine', freq, amp, phase: 0, enabled: true }]

function runBlock(proc, buf) {
  const out = new Float64Array(buf.length)
  for (let i = 0; i < buf.length; i++) out[i] = proc.process(buf[i])
  return out
}

// --------------------------------------------------------- Group A, rate

head('Group A: changing the rate (fs = 48 kHz, M = L = 4)')
const M = 4
p('new Nyquist after decimating by 4', `${SR / (2 * M)} Hz`)
{
  // Every frequency here is a multiple of 375 Hz, which is fs/128, so it lands
  // on a bin centre of the 4096-point frame and the readout is not reading a
  // window's skirt.
  const x = render(tone(9000), FRAME, SR)
  const bare = runBlock(makeDecimateHold({ M }), x)
  p('A1 9 kHz tone folds to', `${SR / M - 9000} Hz`)
  p('A1 alias amplitude at 3 kHz, no anti-alias filter', lineAt(bare, 3000).toFixed(4))
  p('A1 the zero-order hold droop at 3 kHz', (Math.sin((Math.PI * 3000 * M) / SR) / ((Math.PI * 3000 * M) / SR)).toFixed(4))
  p('A1 the 9 kHz line that remains', lineAt(bare, 9000).toExponential(3))

  const h = designDecimationFir({ M, taps: 121, window: 'blackman' }, SR)
  p('A2 anti-alias cutoff (edge 0.8 of fs/2M)', `${(0.8 * SR) / (2 * M)} Hz`)
  p('A2 filter response at 9 kHz', `${db(firResponse(h, 9000, SR)).toFixed(1)} dB`)
  const guarded = runBlock(makeDecimateHold({ M, h }), x)
  p('A2 alias amplitude with the filter', lineAt(guarded, 3000).toExponential(3))
  p('A2 alias suppressed by', `${db(lineAt(bare, 3000) / lineAt(guarded, 3000)).toFixed(1)} dB`)

  const keep = render(tone(1500), FRAME, SR)
  p('A1 a 1500 Hz tone is below the new Nyquist and survives', lineAt(runBlock(makeDecimateHold({ M, h }), keep), 1500).toFixed(4))
  p('A1 the hold droop predicted at 1500 Hz', (Math.sin((Math.PI * 1500 * M) / SR) / ((Math.PI * 1500 * M) / SR)).toFixed(4))
}
{
  const L = 4
  const x = render(tone(1500), FRAME, SR)
  const zeros = runBlock(makeInterpolateFill({ L, fill: 'zeros' }), x)
  p('A3 the coarse grid rate', `${SR / L} Hz`)
  for (const f of [10500, 13500, 22500]) p(`A3 image at ${f} Hz, zero stuffed`, lineAt(zeros, f).toFixed(4))
  p('A3 the wanted 1500 Hz line, zero stuffed', lineAt(zeros, 1500).toFixed(4))
  p('A3 which is 1/L of the amplitude that went in', (1 / L).toFixed(4))

  const hNoGain = designFir({ mode: 'lowpass', taps: 121, window: 'blackman', freq: (0.8 * SR) / (2 * L) }, SR)
  const h = designInterpolationFir({ L, taps: 121, window: 'blackman' }, SR)
  p('A4 interpolation filter DC gain', firResponse(h, 0, SR).toFixed(4))
  const filtered = runBlock(makeInterpolateFill({ L, fill: 'filter', h }), x)
  const noGain = runBlock(makeInterpolateFill({ L, fill: 'filter', h: hNoGain }), x)
  p('A4 1500 Hz amplitude with the gain of L', lineAt(filtered, 1500).toFixed(4))
  p('A4 1500 Hz amplitude without it', lineAt(noGain, 1500).toFixed(4))
  p('A4 image at 10500 Hz after filtering', lineAt(filtered, 10500).toExponential(3))
  p('A4 image rejection', `${db(lineAt(zeros, 10500) / lineAt(filtered, 10500)).toFixed(1)} dB`)
}
{
  const taps = 121
  const c = multirateCost({ taps, factor: M, sampleRate: SR })
  p('A5 direct decimator, multiplies a second', c.direct.toExponential(3))
  p('A5 polyphase decimator, multiplies a second', c.polyphase.toExponential(3))
  p('A5 saving', `${c.ratio}x`)
  const h = designDecimationFir({ M, taps }, SR)
  const x = white(4096, 3)
  const a = decimate(x, M, h)
  const b = polyphaseDecimate(x, M, h)
  let worst = 0
  let scale = 0
  for (let i = 0; i < a.length; i++) {
    worst = Math.max(worst, Math.abs(a[i] - b[i]))
    scale = Math.max(scale, Math.abs(a[i]))
  }
  p('A5 polyphase against direct, worst relative difference', (worst / scale).toExponential(2))
  const hi = designInterpolationFir({ L: M, taps }, SR)
  const c1 = interpolate(x, M, hi)
  const c2 = polyphaseInterpolate(x, M, hi)
  let w2 = 0
  for (let i = 0; i < c1.length; i++) w2 = Math.max(w2, Math.abs(c1[i] - c2[i]))
  p('A6 polyphase interpolator against direct, worst difference', w2.toExponential(2))
  p('A6 multiplies a second, direct against polyphase', `${(taps * SR).toExponential(3)} / ${((taps * SR) / M).toExponential(3)}`)

  const hn = designFir({ mode: 'lowpass', taps: 15, freq: 4000 }, SR)
  const n1 = convolveFir(downsample(x, M), hn)
  const n2 = downsample(convolveFir(x, expandTaps(hn, M)), M)
  let same = true
  for (let i = 0; i < n1.length; i++) if (n1[i] !== n2[i]) same = false
  p('A7 noble identity 1, bit for bit', String(same))
  const u1 = upsample(convolveFir(x, hn), M)
  const u2 = convolveFir(upsample(x, M), expandTaps(hn, M))
  let same2 = true
  for (let i = 0; i < u1.length; i++) if (u1[i] !== u2[i]) same2 = false
  p('A7 noble identity 2, bit for bit', String(same2))
  p('A7 taps in H(z) against H(z^4)', `${hn.length} / ${expandTaps(hn, M).length}`)
}

// ------------------------------------------------- Group B, the specification

head('Group B: designing to a specification')
const SPEC = { fpass: 4000, fstop: 6000, ripplePassDb: 1, stopDb: 60 }
p('the specification', `pass 0-${SPEC.fpass} Hz within ${SPEC.ripplePassDb} dB, stop ${SPEC.fstop} Hz to Nyquist below -${SPEC.stopDb} dB`)
{
  console.log('\n  window      estimate Hz   measured Hz   table dB   measured dB   at N = 81')
  for (const w of ['none', 'hann', 'hamming', 'blackman']) {
    const N = 81
    const h = designFir({ mode: 'lowpass', taps: N, freq: 6000, window: w }, SR)
    const est = windowTransition(w, N, SR)
    const m = measureFir(h, SR, { passDb: 1, stopDb: WINDOW_SPECS[w].stopbandDb })
    const depth = stopbandDepth(h, 6000 + est / 2, SR)
    console.log(
      `  ${w.padEnd(12)}${est.toFixed(0).padStart(8)}${m.transition.toFixed(0).padStart(14)}${String(WINDOW_SPECS[w].stopbandDb).padStart(11)}${depth.toFixed(1).padStart(14)}`,
    )
  }
  console.log('\n  the stopband depth against length, Hamming at 6 kHz:')
  for (const N of [41, 81, 161, 201]) {
    const h = designFir({ mode: 'lowpass', taps: N, freq: 6000, window: 'hamming' }, SR)
    const est = windowTransition('hamming', N, SR)
    console.log(`    N = ${String(N).padEnd(5)} transition ${est.toFixed(0).padStart(6)} Hz   stopband ${stopbandDepth(h, 6000 + est / 2, SR).toFixed(1)} dB`)
  }
}
{
  const win = designFirSpec({ ...SPEC, window: 'blackman' }, SR)
  const bad = designFirSpec({ ...SPEC, window: 'hamming' }, SR)
  const pm = designRemezSpec(SPEC, SR)
  const btw = designIirSpec({ ...SPEC, type: 'butterworth' }, SR, cascade)
  const cby = designIirSpec({ ...SPEC, type: 'chebyshev1' }, SR, cascade)

  p('B2 Blackman taps the estimate asks for', windowTaps('blackman', SPEC.fstop - SPEC.fpass, SR))
  p('B4 Hamming reaches the specification', String(bad.met))
  p('B4 the reason given', bad.reason)
  p('B6 Kaiser estimate for Parks-McClellan', remezOrder(SPEC, SR).taps)
  p('B6 taps the search settled on', `${pm.taps} (grew ${pm.grew} times)`)
  p('B5 equiripple delta', pm.delta.toExponential(4))
  p('B5 stopband depth reached', `${stopbandDepth(pm.h, SPEC.fstop, SR).toFixed(2)} dB`)
  p('B5 alternations found', pm.extremals.length)
  p('B7 Butterworth order estimate / used', `${btw.estimateOrder} / ${btw.order}`)
  p('B7 Butterworth corner placed at', `${btw.fc.toFixed(1)} Hz`)
  p('B7 Chebyshev order estimate / used', `${cby.estimateOrder} / ${cby.order}`)
  console.log('\n  B8 one specification, four filters:')
  console.log(`    windowed sinc (Blackman)   ${String(win.taps).padStart(4)} taps       ${win.taps} coefficients`)
  console.log(`    Parks-McClellan            ${String(pm.taps).padStart(4)} taps       ${pm.taps} coefficients`)
  console.log(`    Butterworth IIR            ${String(btw.order).padStart(4)} order      ${btw.coefficients} coefficients`)
  console.log(`    Chebyshev I IIR            ${String(cby.order).padStart(4)} order      ${cby.coefficients} coefficients`)
  p('B8 window against Chebyshev, coefficient ratio', (win.taps / cby.coefficients).toFixed(1))
  p('B8 Parks-McClellan group delay', `${(pm.taps - 1) / 2} samples`)
  p('B8 Chebyshev group delay at DC', 'varies with frequency, no single number')
}
{
  // Prewarping, stated as the identity it is.
  const order = 4
  const fc = 5000
  const secs = designIir({ type: 'butterworth', mode: 'lowpass', order, freq: fc }, SR)
  p('B7 Butterworth 4th at its corner', `${db(cascade(secs, fc, SR)).toFixed(4)} dB`)
  const f = 10000
  const ratio = Math.tan((Math.PI * f) / SR) / Math.tan((Math.PI * fc) / SR)
  p('B7 at 10 kHz, measured', `${db(cascade(secs, f, SR)).toFixed(4)} dB`)
  p('B7 at 10 kHz, from the prewarped prototype', `${(-10 * Math.log10(1 + Math.pow(ratio, 2 * order))).toFixed(4)} dB`)
}

// ---------------------------------------------------- Group C, adaptive

head('Group C: filters that learn')
const PLANT = Float64Array.from([0.4, -0.3, 0.25, 0.1, -0.05, 0.02, 0.01, 0])
{
  const x = white(60000, 7)
  const px = x.reduce((a, v) => a + v * v, 0) / x.length
  const bound = lmsStepBound({ taps: 8, inputPower: px })
  p('C1 input power per sample', px.toFixed(5))
  p('C3 step bound for the mean, 2/(N Px)', bound.mean.toFixed(4))
  p('C3 step bound for the mean square, 2/(3 N Px)', bound.meanSquare.toFixed(4))

  const d = convolveFir(x, PLANT)
  const w = wiener(x, d, 8)
  p('C1 Wiener solution against the plant, relative error', weightError(w.w, PLANT).toExponential(2))

  const noise = Float64Array.from({ length: x.length }, (_, i) => 0.05 * (2 * hash01(i, 99) - 1))
  const floor = noise.reduce((a, v) => a + v * v, 0) / noise.length
  p('C4 the noise floor the filter cannot cancel', floor.toExponential(3))
  console.log('\n  mu      samples to 10% error   settled error / floor   misadjustment bound')
  for (const mu of [0.005, 0.01, 0.02, 0.05]) {
    const r = runAdaptive({ x, plant: PLANT, algorithm: 'lms', taps: 8, mu, noise, stride: 1 })
    const reach = r.history.findIndex((v) => weightError(v, PLANT) < 0.1)
    const settled = tailPower(r.e, 10000)
    console.log(
      `  ${String(mu).padEnd(8)}${String(reach).padStart(14)}${(settled / floor).toFixed(4).padStart(24)}${(1 + misadjustment({ mu, taps: 8, inputPower: px })).toFixed(4).padStart(22)}`,
    )
  }
  console.log('\n  algorithm   samples to 10% error   cost per sample')
  const short = x.slice(0, 8000)
  for (const [algorithm, opts, cost] of [
    ['lms', { mu: 0.02 }, '2N'],
    ['nlms', { mu: 0.5 }, '3N'],
    ['rls', { lambda: 0.999, delta: 0.01 }, 'N squared'],
  ]) {
    const r = runAdaptive({ x: short, plant: PLANT, algorithm, taps: 8, ...opts, stride: 1 })
    const reach = r.history.findIndex((v) => weightError(v, PLANT) < 0.1)
    console.log(`  ${algorithm.padEnd(12)}${String(reach).padStart(14)}${cost.padStart(20)}`)
  }
  // NLMS holds its rate when the level changes.
  const loud = Float64Array.from(short, (v) => 10 * v)
  const a = runAdaptive({ x: short, plant: PLANT, algorithm: 'nlms', taps: 8, mu: 0.5, stride: 1 })
  const b = runAdaptive({ x: loud, plant: PLANT, algorithm: 'nlms', taps: 8, mu: 0.5, stride: 1 })
  const reachOf = (r) => r.history.findIndex((v) => weightError(v, PLANT) < 0.1)
  p('C5 NLMS samples at amplitude 1 and at amplitude 10', `${reachOf(a)} and ${reachOf(b)}`)
  const lmsLoud = runAdaptive({ x: loud, plant: PLANT, algorithm: 'lms', taps: 8, mu: 0.02, stride: 1 })
  p('C5 plain LMS at amplitude 10, same step size', Number.isFinite(lmsLoud.w[0]) ? 'converges' : 'diverges')
}
{
  const far = white(40000, 21)
  const path = Float64Array.from([0, 0, 0, 0.6, 0.3, -0.2, 0.1, 0.05])
  const near = Float64Array.from({ length: far.length }, (_, i) => 0.1 * Math.sin((2 * Math.PI * 300 * i) / SR))
  const r = runAdaptive({ x: far, plant: path, algorithm: 'nlms', taps: 12, mu: 0.5, noise: near, stride: 4000 })
  const residual = tailPower(r.e, 8000)
  const echo = tailPower(convolveFir(far, path), 8000)
  const nearPower = tailPower(near, 8000)
  p('C7 echo power before cancellation', echo.toExponential(3))
  p('C7 residual after cancellation', residual.toExponential(3))
  p('C7 echo return loss enhancement', `${(10 * Math.log10(echo / residual)).toFixed(1)} dB`)
  p('C7 the near-end talker left behind', nearPower.toExponential(3))
}

// -------------------------------------------------- Group D, estimation

head('Group D: estimating a spectrum')
{
  const TRUE = (2 * (1 / 3)) / SR
  p('D1 true one-sided density of the noise source', TRUE.toExponential(4))
  console.log('\n  N        bin spacing   mean density   scatter over mean')
  for (const n of [1024, 4096, 16384, 65536]) {
    const est = periodogram(white(n, 5), SR)
    const st = bandStats(est, 3000, 21000)
    console.log(
      `  ${String(n).padEnd(9)}${est.df.toFixed(2).padStart(9)} Hz${st.mean.toExponential(3).padStart(15)}${st.cv.toFixed(3).padStart(20)}`,
    )
  }
  const x = white(65536, 5)
  console.log('\n  K        segment   bin spacing   scatter    1/sqrt(K)')
  for (const K of [1, 4, 16, 64, 256]) {
    const w = welch(x, SR, { segments: K, overlap: 0.5, window: 'hann' })
    const st = bandStats(w, 3000, 21000)
    console.log(
      `  ${String(K).padEnd(9)}${String(w.n).padStart(7)}${w.df.toFixed(1).padStart(12)} Hz${st.cv.toFixed(3).padStart(11)}${(1 / Math.sqrt(K)).toFixed(3).padStart(13)}`,
    )
  }
  const b = bartlett(x, SR, { segments: 16 })
  const w = welch(x, SR, { segments: 16, overlap: 0.5, window: 'hann' })
  p('D3 Bartlett at K = 16, scatter', bandStats(b, 3000, 21000).cv.toFixed(3))
  p('D4 Welch at K = 16 with half overlap, scatter', bandStats(w, 3000, 21000).cv.toFixed(3))
  p('D5 record length the two use', `${16 * b.n} and ${w.n + 15 * (w.n / 2)} samples`)
}
{
  const a1 = -1.6
  const a2 = 0.9
  const drive = white(66000, 17)
  const y = new Float64Array(65536)
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < 66000; i++) {
    const v = -a1 * y1 - a2 * y2 + drive[i]
    y2 = y1
    y1 = v
    if (i >= 464) y[i - 464] = v
  }
  const m = arYuleWalker(y.slice(0, 1024), 2)
  p('D6 AR(2) fitted from 1024 samples, a1', `${m.a[1].toFixed(4)} against ${a1}`)
  p('D6 AR(2) fitted from 1024 samples, a2', `${m.a[2].toFixed(4)} against ${a2}`)
  const long = arYuleWalker(y, 2)
  p('D6 the same fit from 65536 samples', `a1 ${long.a[1].toFixed(4)}, a2 ${long.a[2].toFixed(4)}`)
  const peakFreq = (mm) => {
    const freqs = Float64Array.from({ length: 2000 }, (_, i) => (i * SR) / 4000)
    const s = arSpectrum(mm, freqs, SR)
    let bi = 0
    for (let i = 1; i < s.length; i++) if (s[i] > s[bi]) bi = i
    return freqs[bi]
  }
  p('D6 peak of the model, from 1024 samples', `${peakFreq(m).toFixed(0)} Hz`)
  p('D6 peak of the model, from 65536 samples', `${peakFreq(long).toFixed(0)} Hz`)
  const crit = arOrderCriteria(y.slice(0, 4096), 12)
  p('D7 AIC picks order', crit.aicOrder)
  p('D7 MDL picks order', crit.mdlOrder)
}

// -------------------------------------------------- Group E, fixed point

head('Group E: fixed point')
const FIXED = designBiquad({ mode: 'lowpass', freq: 600, q: 10 }, SR)
{
  p('E1 the section: low-pass, 600 Hz, Q = 10', Object.entries(FIXED).map(([k, v]) => `${k} ${v.toFixed(6)}`).join('  '))
  p('E1 its pole radius', poleRadius(FIXED).toFixed(6))
  console.log('\n  bits   step        pole radius   pole moved by   stable')
  for (const bits of [8, 10, 12, 16, 20, 24]) {
    const q = quantizer({ bits, intBits: 2 })
    const r = quantizeBiquad(FIXED, q)
    console.log(
      `  ${String(bits).padEnd(7)}${q.delta.toExponential(2).padStart(10)}${r.radius.toFixed(6).padStart(14)}${r.moved[0].toExponential(2).padStart(16)}${String(r.stable).padStart(9)}`,
    )
  }
  const coeffQ = quantizer({ bits: 16, intBits: 2 })
  console.log('\n  state bits   step        dead band (steps)   dead band (units)')
  for (const bits of [10, 12, 14, 16]) {
    const stateQ = quantizer({ bits, intBits: 1 })
    const step = makeFixedBiquad(FIXED, { coeffQ, stateQ })
    const start = 400 * stateQ.delta
    const lc = findLimitCycle(step, { start: [0, 0, start, start] })
    console.log(
      `  ${String(bits).padEnd(13)}${stateQ.delta.toExponential(2).padStart(10)}${String(Math.round(lc.amplitude / stateQ.delta)).padStart(18)}${lc.amplitude.toExponential(3).padStart(20)}`,
    )
  }
  const q8 = quantizer({ bits: 8, intBits: 0, overflow: 'wrap' })
  const s8 = quantizer({ bits: 8, intBits: 0, overflow: 'saturate' })
  p('E5 range at 8 bits, no integer bits', `${s8.bottom} to ${s8.top}`)
  p('E5 1.2 saturated', s8(1.2))
  p('E5 1.2 wrapped', q8(1.2))
  const stateQ = quantizer({ bits: 12, intBits: 1 })
  const noise = roundingNoise(FIXED, stateQ)
  p('E6 one rounding, rms', Math.sqrt(noise.source).toExponential(3))
  p('E6 noise gain of 1/A(z) at Q = 10', noise.noiseGain.toFixed(1))
  p('E6 output noise, rms', noise.rmsOut.toExponential(3))
  p('E6 amplification', `${db(noise.rmsOut / Math.sqrt(noise.source)).toFixed(1)} dB`)
  const norms = scalingNorms(FIXED, SR)
  p('E6 peak gain, L1 norm', norms.l1.toFixed(3))
  p('E6 peak of |H|', norms.peak.toFixed(3))
  p('E6 integer bits the accumulator needs', norms.bits)
}

// ------------------------------------------------------ Group F, the FFT

head('Group F: the transform itself')
for (const n of [64, 256, 1024, 4096]) {
  const c = fftCost(n)
  p(`F4 N = ${n}: butterflies against direct multiplies`, `${c.butterflies} against ${c.direct}, ${c.ratio.toFixed(1)} times`)
}
p('F3 bit reversal of eight points', Array.from(bitReversal(8)).join(' '))
p('F4 stages at N = 1024', fftCost(1024).stages)
p('F1 the frame the lab defaults to', `${FRAME} points, ${fftCost(FRAME).ratio.toFixed(1)} times cheaper than the sum`)
