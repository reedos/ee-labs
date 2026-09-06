#!/usr/bin/env node
// Every number RANDOM_LAB_PLAN.md quotes, computed here first.
//
//   node packages/random/scripts/pins.mjs
//
// The house rule is that a plan quotes no number a script has not produced.
// This is that script. It is grouped the way the plan's curriculum is grouped,
// and its output is pasted into the plan rather than the plan being written
// from memory and checked afterwards. `experiments.test.js` in the app then
// pins the same numbers as functions of the knobs.

import {
  rng, runSeed, distribution, qFunction, qInv, zFor, chi2Inv,
  sampleMean, sampleVariance, proportion, histogram, histogramError,
  ensemble, ergodicity,
  autocorrelation, psdFromAcf,
  periodogram, averagedPeriodogram, integratePsd, whitePsd, filteredPsd,
  thermalDensity, shotDensity, noiseBandwidthFirstOrder, capacitorNoise,
  whiteNoise, firstOrderLowpass,
  energy, matchedFilter, filterSnr, matchedSnr,
  errorRateAntipodal, errorRateAntipodalDb, errorRateOrthogonalDb, detectionRun, PULSES,
  wienerScalar, wienerFir, kalmanSteadyState, kalmanRun, stationaryVariance,
} from '../index.js'

const out = []
const say = (s) => out.push(s)
const head = (s) => say(`\n--- ${s}`)
const num = (label, v, unit = '') => say(`  ${label.padEnd(46)} ${fmt(v)}${unit ? ' ' + unit : ''}`)
const fmt = (v) => {
  if (typeof v !== 'number') return String(v)
  if (v === 0) return '0'
  const a = Math.abs(v)
  if (a >= 1e5 || a < 1e-3) return v.toExponential(4)
  return v.toPrecision(6)
}

// Group A: a random variable as a seeded source
head('A. A random variable, and its histogram against its density')
{
  const d = distribution('gaussian', { mu: 0, sigma: 1 })
  for (const N of [100, 1000, 10000, 100000]) {
    let acc = 0
    let accP = 0
    const S = 20
    for (let t = 0; t < S; t++) {
      const r = rng(runSeed(1, t))
      const h = histogram(r.take(N, () => d.draw(r)), { bins: 40, lo: -4, hi: 4 })
      const e = histogramError(h, (v) => d.pdf(v))
      acc += e.rms ** 2
      accP += e.predicted ** 2
    }
    num(`N = ${N}: rms gap to the density`, Math.sqrt(acc / S))
    num(`N = ${N}: what the binomial predicts`, Math.sqrt(accP / S))
  }
  num('quadrupling N divides the gap by', 2)
  const r = rng(7)
  const h = histogram(r.take(10000, () => d.draw(r)), { bins: 40, lo: -4, hi: 4 })
  num('bin width at 40 bins over -4 to 4', h.width)
  num('density at the centre bin, true', d.pdf(0.1))
  num('density at the centre bin, measured', h.density[20])
  num('that bin interval half width, 95 %', zFor(0.95) * h.se[20])
  num('samples outside -4 to 4, of 10000', h.outside)
  num('what 4 sigma predicts, of 10000', 10000 * 2 * qFunction(4))
}

head('B. Expectation and variance')
{
  const cases = [
    ['uniform', { a: 0, b: 1 }],
    ['gaussian', { mu: 0, sigma: 1 }],
    ['exponential', { lambda: 1 }],
    ['bernoulli', { p: 0.3 }],
    ['rayleigh', { sigma: 1 }],
  ]
  for (const [name, p] of cases) {
    const d = distribution(name, p)
    num(`${name} mean`, d.mean)
    num(`${name} variance`, d.variance)
  }
  const r = rng(11)
  const d = distribution('uniform', { a: 0, b: 1 })
  const x = r.take(1000, () => d.draw(r))
  const m = sampleMean(x)
  const v = sampleVariance(x)
  num('1000 uniforms: sample mean', m.value)
  num('1000 uniforms: its interval half width', (m.ci[1] - m.ci[0]) / 2)
  num('1000 uniforms: sample variance', v.value)
  num('1000 uniforms: true variance 1/12', 1 / 12)
  num('exponential kurtosis, which breaks the Gaussian formula', 9)
}

head('C. The Gaussian and the central limit theorem')
{
  const r = rng(13)
  for (const k of [1, 2, 4, 12]) {
    const N = 200000
    const vals = new Float64Array(N)
    for (let i = 0; i < N; i++) {
      let s = 0
      for (let j = 0; j < k; j++) s += r.uniform() - 0.5
      vals[i] = s / Math.sqrt(k / 12)
    }
    let m4 = 0
    let m2 = 0
    for (const v of vals) {
      m2 += v * v
      m4 += v ** 4
    }
    num(`sum of ${k} uniforms: kurtosis`, m4 / N / (m2 / N) ** 2)
  }
  num('a Gaussian kurtosis', 3)
  num('one uniform kurtosis, 9/5', 1.8)
  num('Q(1), the mass beyond one sigma', qFunction(1))
  num('mass inside one sigma', 1 - 2 * qFunction(1))
  num('mass inside two sigma', 1 - 2 * qFunction(2))
  num('mass inside three sigma', 1 - 2 * qFunction(3))
  num('z for a 95 % two-sided interval', zFor(0.95))
  num('z for a 99 % two-sided interval', zFor(0.99))
}

head('D. Autocorrelation and the density, as a pair')
{
  const fs = 8000
  const { x } = whiteNoise({ n: 4096, sampleRate: fs, rms: 1, seed: 17 })
  const acf = autocorrelation(x, 4095, { removeMean: false })
  const viaAcf = psdFromAcf(acf.r, fs)
  const direct = periodogram(x, fs, { window: 'none' })
  let worst = 0
  for (let k = 0; k <= 2048; k++) {
    const j = Math.round((direct.freqs[k] * viaAcf.nfft) / fs)
    worst = Math.max(worst, Math.abs(viaAcf.psd[j] - direct.psd[k]) / direct.psd[k])
  }
  num('Wiener-Khinchin: worst relative gap', worst)
  const fc = 500
  const lp = firstOrderLowpass(fc, 48000)
  num('filtered noise: corner', fc, 'Hz')
  num('its time constant', 1 / (2 * Math.PI * fc), 's')
  num('that in samples at 48 kHz', 48000 / (2 * Math.PI * fc))
  const { x: w } = whiteNoise({ n: 1 << 18, sampleRate: 48000, rms: 1, seed: 18 })
  const facf = autocorrelation(lp.run(w), 400, { removeMean: false })
  let cross = 0
  while (cross < 400 && facf.normalised[cross] > Math.exp(-1)) cross++
  num('lags until the correlation falls to 1/e', cross)
}

head('E. Ergodicity')
{
  for (const length of [64, 1024]) {
    const e = ensemble({
      seed: 21, runs: 800, length,
      make: (r) => r.take(length, () => r.normal(0, 1)),
    })
    num(`stationary process, length ${length}: spread of time averages`, ergodicity(e).spread)
    num(`  what 1/sqrt(length) predicts`, 1 / Math.sqrt(length))
  }
  for (const length of [64, 1024]) {
    const e = ensemble({
      seed: 22, runs: 800, length,
      make: (r) => {
        const c = r.normal()
        return new Float64Array(length).fill(c)
      },
    })
    num(`constant per run, length ${length}: spread of time averages`, ergodicity(e).spread)
  }
  say('  the second process is stationary and not ergodic: the spread does not fall')
}

head('F. White noise, the periodogram, and the density')
{
  const fs = 48000
  const rms = 1e-3
  const wn = whiteNoise({ n: 512 * 400, sampleRate: fs, rms, seed: 31 })
  num('1 mV rms at 48 kHz: the density', wn.density, 'V/sqrt(Hz)')
  num('  as microvolts per root hertz', wn.density * 1e6)
  for (const M of [1, 4, 25, 100, 400]) {
    const ap = averagedPeriodogram(wn.x.subarray(0, 512 * M), fs, { segment: 512, window: 'hann' })
    num(`M = ${M}: relative spread predicted 1/sqrt(M)`, ap.relativeSe)
    num(`M = ${M}: measured across the interior bins`, ap.flatness)
    num(`M = ${M}: integral back to rms`, Math.sqrt(ap.integral))
  }
  const ap100 = averagedPeriodogram(wn.x.subarray(0, 512 * 100), fs, { segment: 512, window: 'hann' })
  num('M = 100: degrees of freedom', ap100.dof)
  num('M = 100: interval width, relative, 95 %', (ap100.ci[10][1] - ap100.ci[10][0]) / ap100.psd[10])
  num('  from chi-square at 200 dof, lower', 200 / chi2Inv(0.975, 200))
  num('  and upper', 200 / chi2Inv(0.025, 200))
  num('bin width at 512 samples and 48 kHz', ap100.df, 'Hz')
  num('DC and Nyquist bins sit at this fraction', 0.5)
}

head('G. White noise through a filter')
{
  const fs = 48000
  for (const fc of [500, 2000]) {
    const lp = firstOrderLowpass(fc, fs)
    num(`fc = ${fc} Hz: noise gain sum h^2 = K/(K+1)`, lp.noiseGain)
    num(`  the filter's own noise bandwidth`, lp.enb, 'Hz')
    num(`  the analogue (pi/2) fc`, lp.analogueEnb, 'Hz')
    num(`  the ratio between them`, lp.enbRatio)
    const { x } = whiteNoise({ n: 1024 * 400, sampleRate: fs, rms: 1, seed: fc })
    const ap = averagedPeriodogram(lp.run(x), fs, { segment: 1024, window: 'hann' })
    num(`  measured output variance`, ap.integral)
    const sIn = whitePsd(1, fs)
    const pred = filteredPsd(ap.freqs, new Float64Array(ap.freqs.length).fill(sIn), (f) => lp.magnitude(f))
    num(`  |H|^2 S integrated`, integratePsd({ freqs: ap.freqs, psd: pred }))
  }
  num('ratio at which the analogue formula is within 1 %', firstOrderLowpass(48000 / 320, 48000).enbRatio)
  num('  that corner', 48000 / 320, 'Hz')
}

head('H. The kT over C pin')
{
  num('Boltzmann times 300 K', 1.380649e-23 * 300)
  num('1 kohm at 300 K, thermal density', thermalDensity(1000), 'V/sqrt(Hz)')
  num('  in nanovolts per root hertz', thermalDensity(1000) * 1e9)
  num('1 mA of shot noise', shotDensity(1e-3), 'A/sqrt(Hz)')
  num('  in picoamps per root hertz', shotDensity(1e-3) * 1e12)
  for (const R of [1e3, 1e4, 1e5, 1e6]) {
    const n = capacitorNoise({ R, C: 1e-9 })
    num(`R = ${R} ohm, C = 1 nF: rms`, n.rms, 'V')
    num(`  density`, n.density, 'V/sqrt(Hz)')
    num(`  corner`, n.fc, 'Hz')
    num(`  noise bandwidth (pi/2) fc`, n.enb, 'Hz')
  }
  num('the rms in microvolts, any R', capacitorNoise({ R: 1e3, C: 1e-9 }).rms * 1e6)
  num('at 1 pF instead', capacitorNoise({ R: 1e3, C: 1e-12 }).rms * 1e6)
  num('noise bandwidth over corner', noiseBandwidthFirstOrder(1) / 1)
}

head('I. The sample mean and its variance')
{
  for (const N of [10, 100, 1000, 10000]) {
    const sigma = 1
    num(`N = ${N}: sd of the sample mean, sigma/sqrt(N)`, sigma / Math.sqrt(N))
    num(`  the 95 % interval half width`, (zFor(0.95) * sigma) / Math.sqrt(N))
  }
  const trials = 4000
  const N = 300
  let inside = 0
  for (let t = 0; t < trials; t++) {
    const r = rng(runSeed(41, t))
    const est = sampleMean(r.take(N, () => r.normal(2, 1.5)))
    if (est.ci[0] <= 2 && 2 <= est.ci[1]) inside++
  }
  num('coverage of the 95 % interval over 4000 ensembles', inside / trials)
  num('  what it claims', 0.95)
  num('a hundredfold N narrows the interval by', 10)
}

head('J. The matched filter')
{
  const fs = 1e6
  const sigma2 = 0.01
  for (const name of ['rect', 'halfSine', 'ramp']) {
    const s = PULSES[name](64)
    const m = matchedSnr({ s, sigma2, sampleRate: fs })
    num(`${name}, 64 samples, unit energy: output ratio`, m.snr)
    num(`  in decibels`, m.snrDb)
    num(`  2E/N0 by the other route`, m.twoEOverN0)
  }
  const s = PULSES.halfSine(64)
  num('a rectangular filter on a half-sine pulse', filterSnr(PULSES.rect(64), s, sigma2))
  num('  as a fraction of the best', filterSnr(PULSES.rect(64), s, sigma2) / (1 / sigma2))
  num('  the loss in decibels', -10 * Math.log10(filterSnr(PULSES.rect(64), s, sigma2) * sigma2))
  const x = new Float64Array(256)
  for (let i = 0; i < 64; i++) x[100 + i] = s[i]
  const y = matchedFilter(s, x)
  let best = 0
  for (let k = 1; k < y.length; k++) if (y[k] > y[best]) best = k
  num('the peak lands at sample', best)
  num('and its height is the pulse energy', y[best])
}

head('K. The Q function and the error rate')
{
  for (const db of [0, 4, 7, 10, 12]) {
    num(`Eb/N0 = ${db} dB: antipodal error rate`, errorRateAntipodalDb(db))
    num(`  on-off keying`, errorRateOrthogonalDb(db))
  }
  num('the gap between them, in decibels', 10 * Math.log10(2))
  num('one more decibel at 9 dB divides the rate by', errorRateAntipodalDb(9) / errorRateAntipodalDb(10))
  num('Eb/N0 for a rate of 1e-6', 10 * Math.log10((qInv(1e-6) ** 2) / 2))
  num('Eb/N0 for a rate of 1e-9', 10 * Math.log10((qInv(1e-9) ** 2) / 2))
  const run = detectionRun({ s: PULSES.rect(32), ebN0: 10 ** 0.7, symbols: 200000, seed: 51 })
  num('200000 symbols at 7 dB: errors counted', run.errors)
  num('  the rate', run.measured.value)
  num('  its 95 % interval, low', run.measured.ci[0])
  num('  its 95 % interval, high', run.measured.ci[1])
  num('  the closed form', run.predicted)
  const quiet = detectionRun({ s: PULSES.rect(32), ebN0: 10 ** 1.2, symbols: 1000, seed: 52 })
  num('1000 symbols at 12 dB: errors counted', quiet.errors)
  num('  the interval still reaches', quiet.measured.ci[1])
  num('  and the true rate is', quiet.predicted)
}

head('L. The Wiener filter')
{
  const w = wienerScalar({ signalVariance: 1, noiseVariance: 0.25 })
  num('one weight, SNR 4: the weight', w.w)
  num('  the error it leaves', w.mmse)
  num('  the error of doing nothing', w.unfilteredMse)
  num('  the ratio it reaches, unchanged', w.snrOut)
  num('  the gain in decibels, identically zero', w.gainDb)
  const fs = 8000
  const n = 1 << 15
  const lp = firstOrderLowpass(400, fs)
  const r = rng(61)
  const clean = lp.run(r.take(n, () => r.normal(0, 1)))
  let power = 0
  for (let i = 0; i < n; i++) power += clean[i] * clean[i]
  power /= n
  const sigma = Math.sqrt(power)
  const x = new Float64Array(n)
  for (let i = 0; i < n; i++) x[i] = clean[i] + r.normal(0, sigma)
  num('signal power', power)
  num('noise power, equal', sigma * sigma)
  const scalar = wienerScalar({ signalVariance: power, noiseVariance: sigma * sigma })
  num('one weight leaves', scalar.mmse)
  for (const taps of [2, 4, 8, 16]) {
    num(`${taps} taps leave`, wienerFir({ x, d: clean, taps }).mmse)
  }
  num('16 taps against one weight, as a fraction', wienerFir({ x, d: clean, taps: 16 }).mmse / scalar.mmse)
}

head('M. The Kalman filter')
{
  const a = 0.9
  const q = 0.1
  const r = 1
  const ss = kalmanSteadyState({ a, q, r })
  num('a = 0.9, q = 0.1, r = 1: prior variance', ss.priorVariance)
  num('  the settled gain', ss.gain)
  num('  the error it leaves', ss.posteriorVariance)
  num('the stationary variance of the process', stationaryVariance({ a, q }))
  const oneShot = wienerScalar({ signalVariance: stationaryVariance({ a, q }), noiseVariance: r })
  num('the one-shot Wiener error', oneShot.mmse)
  num('what the memory is worth, as a fraction', ss.posteriorVariance / oneShot.mmse)
  const g = rng(71)
  const N = 200
  const z = new Float64Array(N)
  let xs = 0
  for (let i = 0; i < N; i++) {
    xs = a * xs + g.normal(0, Math.sqrt(q))
    z[i] = xs + g.normal(0, Math.sqrt(r))
  }
  const k = kalmanRun({ z, q, r, a, x0: 500, p0: 1e6 })
  num('from a start 500 away, gain settles at step', k.settledAt)
  num('  the innovation variance predicted', ss.priorVariance + r)
  for (const rr of [0.01, 1, 100]) {
    num(`r = ${rr}: the settled gain`, kalmanSteadyState({ a, q, r: rr }).gain)
  }
  for (const qq of [0.001, 0.1, 10]) {
    num(`q = ${qq}: the settled gain`, kalmanSteadyState({ a, q: qq, r }).gain)
  }
}

head('N. Monte Carlo, the shape the Applied Analog Lab will reuse')
{
  const e = ensemble({
    seed: 81, runs: 2000, length: 1,
    make: (r) => Float64Array.from([r.normal(10, 0.5)]),
    stat: (x) => x[0],
    spec: [9, 11],
  })
  const y = e.withinSpec()
  num('a 10 unit target with 0.5 spread, spec 9 to 11', y.value)
  num('  the interval, low', y.ci[0])
  num('  the interval, high', y.ci[1])
  num('  what the Gaussian says', 1 - 2 * qFunction(2))
  const tight = e.withinSpec([9.5, 10.5])
  num('a tighter spec, 9.5 to 10.5', tight.value)
  num('  what the Gaussian says', 1 - 2 * qFunction(1))
}

console.log(out.join('\n'))
console.log('')
