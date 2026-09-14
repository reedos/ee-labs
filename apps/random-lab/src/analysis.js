// One analysis, read by the app and by the tests.
//
// Every number a pane prints and every number `experiments.test.js` pins comes
// from this function. There is no second path, so a lesson cannot quote a
// number the app does not draw, and a test cannot pass against arithmetic the
// reader never sees.
//
// Sections are computed lazily and memoised. An experiment that shows a
// histogram never runs an ensemble, and the test suite walks thirty experiments
// without drawing the whole package thirty times.
//
// The house rule of this lab, from RANDOM_LAB_PLAN.md section 2.1: a closed form
// is a bare number and an estimate is an object with an interval. The sections
// below keep them apart, and `resolve` returns whichever the path names.

import {
  rng, runSeed, distribution, qFunction, zFor, chi2Inv,
  sampleMean, sampleVariance, proportion, histogram, histogramError,
  ensemble, ergodicity,
  autocorrelation, psdFromAcf,
  periodogram, averagedPeriodogram, integratePsd, whitePsd, filteredPsd,
  capacitorNoise, thermalDensity, whiteNoise, firstOrderLowpass,
  matchedSnr, filterSnr, matchedFilter, errorRateAntipodal, errorRateOrthogonal,
  detectionRun, PULSES,
  wienerScalar, wienerFir,
  kalmanSteadyState, kalmanRun, stationaryVariance,
} from '@ee-labs/random'

/**
 * The values every lane uses, from AGENT_BRIEF.md section 5.
 * A knob that is not in an experiment's `params` takes its value here.
 */
export const DEFAULTS = {
  seed: 1,
  level: 0.95,

  // The source
  dist: 'gaussian',
  mu: 0,
  sigma: 1,
  a: 0,
  b: 1,
  lambda: 1,
  p: 0.5,
  n: 1000,
  cltTerms: 1,

  // The histogram
  bins: 40,
  lo: -4,
  hi: 4,
  histRepeats: 20,
  // Where the tail marker stands, in standard deviations from the mean. The
  // histogram shades beyond it and prints the mass it holds.
  qx: null,

  // The ensemble
  runs: 200,
  length: 256,
  ensembleKind: 'gaussian',

  // Spectra
  sampleRate: 48000,
  noiseRms: 1e-3,
  segment: 512,
  averages: 100,
  window: 'hann',
  overlap: 0,

  // The filter
  fc: 500,
  filtered: false,

  // The capacitor
  R: 1e3,
  C: 1e-9,
  T: 300,

  // Detection
  pulse: 'halfSine',
  pulseLength: 64,
  noiseVariance: 0.01,
  ebN0Db: 7,
  symbols: 200000,

  // The Wiener filter
  signalVariance: 1,
  wienerNoiseVariance: 0.25,
  taps: 16,

  // The Kalman filter
  kalmanA: 0.9,
  q: 0.1,
  r: 1,
  x0: 500,
  p0: 1e6,
  kalmanSteps: 200,
}

const memo = (fn) => {
  let done = false
  let value
  return () => {
    if (!done) {
      value = fn()
      done = true
    }
    return value
  }
}

/** The distribution an experiment's params name, with its own parameters filled in. */
function distFor(p) {
  const byName = {
    gaussian: { mu: p.mu, sigma: p.sigma },
    uniform: { a: p.a, b: p.b },
    exponential: { lambda: p.lambda },
    bernoulli: { p: p.p },
    rayleigh: { sigma: p.sigma },
  }
  return distribution(p.dist, byName[p.dist] || {})
}

/**
 * Everything an experiment can show, from its parameters.
 * @param {object} params  merged over DEFAULTS
 */
export function analyse(params = {}) {
  const p = { ...DEFAULTS, ...params }
  const d = distFor(p)

  // One realisation of the source. The central limit experiments draw a sum of
  // `cltTerms` uniforms instead, normalised to unit variance so that the shape
  // is what changes and the width is not.
  const draw = memo(() => {
    const r = rng(p.seed)
    if (p.cltTerms > 1) {
      const scale = Math.sqrt(p.cltTerms / 12)
      return r.take(p.n, () => {
        let s = 0
        for (let j = 0; j < p.cltTerms; j++) s += r.uniform() - 0.5
        return s / scale
      })
    }
    return r.take(p.n, () => d.draw(r))
  })

  const hist = memo(() => {
    const h = histogram(draw(), { bins: p.bins, lo: p.lo, hi: p.hi, level: p.level })
    const truth = p.cltTerms > 1 ? distribution('gaussian', { mu: 0, sigma: 1 }) : d
    return { ...h, error: histogramError(h, (v) => truth.pdf(v)), truth }
  })

  // The one-over-root-N law, measured rather than asserted. Repeats average the
  // spread of the spread away, and the seeds are a pure function of the index so
  // the sweep is reproducible.
  const histSweep = memo(() => {
    const truth = p.cltTerms > 1 ? distribution('gaussian', { mu: 0, sigma: 1 }) : d
    const counts = p.sweepN || [100, 1000, 10000, 100000]
    return counts.map((N) => {
      let acc = 0
      let accP = 0
      for (let t = 0; t < p.histRepeats; t++) {
        const r = rng(runSeed(p.seed, t))
        const x =
          p.cltTerms > 1
            ? r.take(N, () => {
                let s = 0
                for (let j = 0; j < p.cltTerms; j++) s += r.uniform() - 0.5
                return s / Math.sqrt(p.cltTerms / 12)
              })
            : r.take(N, () => d.draw(r))
        const h = histogram(x, { bins: p.bins, lo: p.lo, hi: p.hi })
        const e = histogramError(h, (v) => truth.pdf(v))
        acc += e.rms * e.rms
        accP += e.predicted * e.predicted
      }
      return { n: N, rms: Math.sqrt(acc / p.histRepeats), predicted: Math.sqrt(accP / p.histRepeats) }
    })
  })

  const est = memo(() => ({
    mean: sampleMean(draw(), { level: p.level }),
    variance: sampleVariance(draw(), { level: p.level }),
  }))

  // The mass inside one, two and three standard deviations, counted from the
  // draw and stated as a closed form beside it. C2 is the comparison, and
  // counting rather than restating `1 - 2Q(k)` is what makes it a measurement.
  const tail = memo(() => {
    const x = draw()
    const m = p.cltTerms > 1 ? 0 : d.mean
    const s = p.cltTerms > 1 ? 1 : d.sd
    return [1, 2, 3].map((k) => {
      let inside = 0
      for (let i = 0; i < x.length; i++) if (Math.abs(x[i] - m) < k * s) inside++
      const counted = proportion(inside, x.length, { level: p.level })
      return { k, counted, closed: 1 - 2 * qFunction(k) }
    })
  })

  // The tail beyond the marker, closed and counted. C3's note says the Q
  // function is the shaded tail on the plot, and until this existed there was
  // no marker and no shading to point at.
  const qmark = memo(() => {
    const x = p.qx == null ? 1 : p.qx
    const m = p.cltTerms > 1 ? 0 : d.mean
    const s = p.cltTerms > 1 ? 1 : d.sd
    const threshold = m + x * s
    const draws = draw()
    let beyond = 0
    for (let i = 0; i < draws.length; i++) if (draws[i] > threshold) beyond++
    return {
      x,
      threshold,
      closed: qFunction(x),
      counted: proportion(beyond, draws.length, { level: p.level }),
    }
  })

  const filter = memo(() => firstOrderLowpass(p.fc, p.sampleRate))

  // What the one-run view draws, with the estimates of that same series beside
  // it. The pane had no readouts at all, on the one experiment whose try line
  // says to read the interval on the mean, and on the six others that offer the
  // view as their second. An experiment that filters or scales the source draws
  // its record rather than the bare draw, so the estimates are taken from
  // whichever series is on screen and not from the other one.
  const scope = memo(() => {
    const usesRecord = p.filtered || p.noiseRms !== DEFAULTS.noiseRms
    const series = usesRecord ? record().x.subarray(0, 2048) : draw()
    return {
      series,
      usesRecord,
      label: usesRecord ? 'Voltage' : 'Value',
      units: usesRecord ? 'V' : '',
      n: series.length,
      mean: sampleMean(series, { level: p.level }),
      variance: sampleVariance(series, { level: p.level }),
    }
  })

  const ens = memo(() => {
    const kind = p.ensembleKind
    const e = ensemble({
      seed: p.seed,
      runs: p.runs,
      length: p.length,
      spec: p.spec || null,
      make: (r) => {
        if (kind === 'constant') {
          // Stationary and not ergodic: the randomness is drawn once per run,
          // so a longer run adds nothing.
          const c = r.normal(p.mu, p.sigma)
          return new Float64Array(p.length).fill(c)
        }
        const x = r.take(p.length, () => d.draw(r))
        return kind === 'filtered' ? filter().run(x) : x
      },
      stat: (x) => {
        if (kind === 'outcome') return x[0]
        let s = 0
        for (let i = 0; i < x.length; i++) s += x[i]
        return s / x.length
      },
    })
    return { ...e, ergodicity: ergodicity(e) }
  })

  // The spread of the per-run time averages, at two run lengths and for both
  // kinds of process. D4's whole experiment is the contrast between them, so
  // both are computed here rather than in two experiments the reader compares
  // from memory. The constant process takes the neighbouring seed.
  const ergSweep = memo(() =>
    (p.sweepLengths || [64, 1024]).map((length) => {
      const build = (kind, seed) =>
        ergodicity(
          ensemble({
            seed,
            runs: p.runs,
            length,
            make: (r) => {
              if (kind === 'constant') {
                const c = r.normal(p.mu, p.sigma)
                return new Float64Array(length).fill(c)
              }
              return r.take(length, () => d.draw(r))
            },
          }),
        )
      return {
        length,
        stationary: build('gaussian', p.seed).spread,
        constant: build('constant', p.seed + 1).spread,
        predicted: p.sigma / Math.sqrt(length),
      }
    }),
  )

  // Wiener and Khinchin as an identity about arithmetic. The biased
  // autocorrelation of one frame transforms to that frame's periodogram, and
  // the gap between the two routes is floating point and nothing else.
  const wk = memo(() => {
    const n = p.wkN || 4096
    const { x } = whiteNoise({
      n,
      sampleRate: p.sampleRate,
      rms: p.noiseRms,
      seed: p.seed,
    })
    const a = autocorrelation(x, n - 1, { removeMean: false })
    const viaAcf = psdFromAcf(a.r, p.sampleRate)
    const direct = periodogram(x, p.sampleRate, { window: 'none' })
    let worst = 0
    for (let k = 0; k < direct.freqs.length; k++) {
      const j = Math.round((direct.freqs[k] * viaAcf.nfft) / p.sampleRate)
      worst = Math.max(worst, Math.abs(viaAcf.psd[j] - direct.psd[k]) / direct.psd[k])
    }
    // The trapezoid rule takes half of each end panel and the exact bin sum
    // takes all of both. The pane states that gap rather than hiding it.
    const df = viaAcf.freqs[1] - viaAcf.freqs[0]
    const endGap = 0.5 * (viaAcf.psd[0] + viaAcf.psd[viaAcf.psd.length - 1]) * df
    return {
      worst,
      direct,
      viaAcf,
      acf: a,
      r0: a.r0,
      integral: integratePsd(viaAcf),
      integralWithEnds: integratePsd(viaAcf) + endGap,
      endGap,
    }
  })

  // Does the interval cover the truth as often as it claims? Repeat the whole
  // estimate and count. This is G2, and it is the experiment that separates an
  // interval from an error bar.
  const coverage = memo(() => {
    const trials = p.covTrials || 4000
    const N = p.covN || 300
    const mu = p.covMu === undefined ? 2 : p.covMu
    const sigma = p.covSigma === undefined ? 1.5 : p.covSigma
    let inside = 0
    const widths = new Float64Array(trials)
    for (let t = 0; t < trials; t++) {
      const r = rng(runSeed(p.seed, t))
      const e = sampleMean(r.take(N, () => r.normal(mu, sigma)), { level: p.level })
      widths[t] = e.ci[1] - e.ci[0]
      if (e.ci[0] <= mu && mu <= e.ci[1]) inside++
    }
    let mw = 0
    for (const w of widths) mw += w
    // The counted rate is itself an estimate, so it carries an interval like
    // every other counted thing here. The pane prints this one, and the level
    // it claims beside it.
    const counted = proportion(inside, trials, { level: 0.95 })
    return {
      rate: inside / trials,
      counted,
      countedLo: counted.ci[0],
      countedHi: counted.ci[1],
      claimed: p.level,
      trials,
      n: N,
      meanWidth: mw / trials,
      predictedWidth: (2 * zFor(p.level) * sigma) / Math.sqrt(N),
      // The band a sound interval sits inside, from the count's own variance.
      se: Math.sqrt((p.level * (1 - p.level)) / trials),
    }
  })

  // How the standard error falls with N, which is G1.
  const meanSweep = memo(() =>
    (p.sweepMeanN || [10, 100, 1000, 10000]).map((N) => ({
      n: N,
      se: p.sigma / Math.sqrt(N),
      half: (zFor(p.level) * p.sigma) / Math.sqrt(N),
    })),
  )

  // The record the spectral views read. One long realisation, filtered when the
  // experiment asks for it.
  const record = memo(() => {
    const need = p.segment * p.averages
    const w = whiteNoise({ n: need, sampleRate: p.sampleRate, rms: p.noiseRms, seed: p.seed })
    return { ...w, x: p.filtered ? filter().run(w.x) : w.x }
  })

  const psd = memo(() => {
    const rec = record()
    const ap = averagedPeriodogram(rec.x, p.sampleRate, {
      segment: p.segment,
      overlap: p.overlap,
      window: p.window,
      level: p.level,
    })
    // The interval multipliers, which are what the pane prints as a band.
    const lo = ap.dof / chi2Inv(1 - (1 - p.level) / 2, ap.dof)
    const hi = ap.dof / chi2Inv((1 - p.level) / 2, ap.dof)
    // What the closed form says the density should be, where there is one.
    const flat = whitePsd(rec.rms * rec.rms, p.sampleRate)
    const predicted = p.filtered
      ? filteredPsd(ap.freqs, new Float64Array(ap.freqs.length).fill(flat), (f) =>
          filter().magnitude(f),
        )
      : new Float64Array(ap.freqs.length).fill(flat)
    // The mean over the interior bins, which is the flat floor a reader reads.
    let acc = 0
    let count = 0
    for (let k = ap.interior[0]; k <= ap.interior[1]; k++) {
      acc += ap.psd[k]
      count++
    }
    return {
      ...ap,
      ciLo: lo,
      ciHi: hi,
      inputRms: rec.rms,
      inputDensity: rec.density,
      predicted,
      predictedIntegral: integratePsd({ freqs: ap.freqs, psd: predicted }),
      interiorMean: acc / count,
      interiorDensity: Math.sqrt(acc / count),
      rmsFromIntegral: Math.sqrt(ap.integral),
      // The end bins sit at half the flat level, because a one-sided density
      // doubles only the bins with a mirror partner.
      endRatio: (ap.psd[0] + ap.psd[ap.psd.length - 1]) / 2 / (acc / count),
    }
  })

  // The spread against the number of averages, which is E2's whole experiment.
  const psdSweep = memo(() => {
    const rec = record()
    return (p.sweepM || [1, 4, 25, 100, 400]).map((M) => {
      const ap = averagedPeriodogram(rec.x.subarray(0, p.segment * M), p.sampleRate, {
        segment: p.segment,
        window: p.window,
      })
      return { m: M, flatness: ap.flatness, relativeSe: ap.relativeSe, rms: Math.sqrt(ap.integral) }
    })
  })

  const acf = memo(() => {
    const rec = record()
    const maxLag = p.maxLag || 400
    const a = autocorrelation(rec.x, maxLag, { removeMean: false })
    let lagAt1e = 0
    while (lagAt1e < maxLag && a.normalised[lagAt1e] > Math.exp(-1)) lagAt1e++
    return {
      ...a,
      lagAt1e,
      // The filter's time constant in samples, which is what lagAt1e should be.
      tauSamples: p.sampleRate / (2 * Math.PI * p.fc),
      // The band a white record's lags should stay inside.
      whiteBand: 5 / Math.sqrt(rec.x.length),
    }
  })

  const ktc = memo(() => {
    const base = capacitorNoise({ R: p.R, C: p.C, T: p.T })
    return {
      ...base,
      // The same result at four decades of resistance, which is the experiment.
      sweep: [1e3, 1e4, 1e5, 1e6].map((R) => capacitorNoise({ R, C: p.C, T: p.T })),
      thermal: thermalDensity(p.R, p.T),
    }
  })

  const pulse = memo(() => PULSES[p.pulse](p.pulseLength))

  const snr = memo(() => {
    const s = pulse()
    const m = matchedSnr({ s, sigma2: p.noiseVariance, sampleRate: p.sampleRate })
    const mismatch = filterSnr(PULSES.rect(p.pulseLength), s, p.noiseVariance)
    // The filter run over a record that holds the pulse, so the peak is drawn.
    const at = Math.floor(p.pulseLength / 2)
    const x = new Float64Array(p.pulseLength * 4)
    for (let i = 0; i < p.pulseLength; i++) x[at + i] = s[i]
    const y = matchedFilter(s, x)
    let peakAt = 0
    for (let k = 1; k < y.length; k++) if (y[k] > y[peakAt]) peakAt = k
    return {
      ...m,
      output: y,
      peakAt,
      peak: y[peakAt],
      pulseAt: at,
      mismatch,
      mismatchFraction: mismatch / m.snr,
      mismatchLossDb: -10 * Math.log10(mismatch / m.snr),
      shapes: ['rect', 'halfSine', 'ramp'].map((name) => ({
        name,
        snr: matchedSnr({ s: PULSES[name](p.pulseLength), sigma2: p.noiseVariance, sampleRate: p.sampleRate }).snr,
      })),
    }
  })

  const ber = memo(() => {
    const ebN0 = 10 ** (p.ebN0Db / 10)
    const run = detectionRun({
      s: pulse(),
      ebN0,
      symbols: p.symbols,
      seed: p.seed,
      level: p.level,
    })
    const curve = []
    for (let db = 0; db <= 13; db += 0.25) {
      curve.push({
        db,
        antipodal: errorRateAntipodal(10 ** (db / 10)),
        orthogonal: errorRateOrthogonal(10 ** (db / 10)),
      })
    }
    return {
      ...run,
      curve,
      orthogonal: errorRateOrthogonal(ebN0),
      // The two curves are one curve shifted by this many decibels.
      gapDb: 10 * Math.log10(2),
    }
  })

  const wiener = memo(() => {
    const scalar = wienerScalar({
      signalVariance: p.signalVariance,
      noiseVariance: p.wienerNoiseVariance,
    })
    // A filtered process in white noise of equal power, which is where more
    // taps start to pay.
    const n = 1 << 15
    const lp = firstOrderLowpass(400, 8000)
    const r = rng(p.seed)
    const clean = lp.run(r.take(n, () => r.normal(0, 1)))
    let power = 0
    for (let i = 0; i < n; i++) power += clean[i] * clean[i]
    power /= n
    const sigma = Math.sqrt(power)
    const x = new Float64Array(n)
    for (let i = 0; i < n; i++) x[i] = clean[i] + r.normal(0, sigma)
    const one = wienerScalar({ signalVariance: power, noiseVariance: power })
    const sweep = (p.sweepTaps || [2, 4, 8, 16]).map((taps) => ({
      taps,
      mmse: wienerFir({ x, d: clean, taps }).mmse,
    }))
    const best = sweep[sweep.length - 1]

    // The scalar weight on a record, so a reader can see the shrink the weight
    // is. The signal, the observation it is buried in, and w times that
    // observation. Two hundred samples, which is enough to read and few enough
    // to draw as lines rather than as spray.
    const t = rng(runSeed(p.seed, 7))
    const M = 200
    const signal = new Float64Array(M)
    const observed = new Float64Array(M)
    const estimate = new Float64Array(M)
    const sSignal = Math.sqrt(p.signalVariance)
    const sNoise = Math.sqrt(p.wienerNoiseVariance)
    let mse = 0
    let estPower = 0
    let obsPower = 0
    for (let i = 0; i < M; i++) {
      signal[i] = t.normal(0, sSignal)
      observed[i] = signal[i] + t.normal(0, sNoise)
      estimate[i] = scalar.w * observed[i]
      mse += (estimate[i] - signal[i]) ** 2
      estPower += estimate[i] * estimate[i]
      obsPower += observed[i] * observed[i]
    }

    return {
      ...scalar,
      trace: { signal, observed, estimate },
      // What the drawn record measures, so the picture and the closed form can
      // be compared rather than asserted to agree. The relative standard error
      // of a mean square over M samples is sqrt(2/M), which is 10 % here.
      traceMse: mse / M,
      traceShrink: Math.sqrt(estPower / obsPower),
      traceSe: scalar.mmse * Math.sqrt(2 / M),
      signalPower: power,
      oneWeightMmse: one.mmse,
      sweep,
      bestMmse: best.mmse,
      bestFraction: best.mmse / one.mmse,
      fir: wienerFir({ x, d: clean, taps: p.taps }),
    }
  })

  const kalman = memo(() => {
    const steady = kalmanSteadyState({ a: p.kalmanA, q: p.q, r: p.r })
    const g = rng(p.seed)
    const N = p.kalmanSteps
    const z = new Float64Array(N)
    const truth = new Float64Array(N)
    let xs = 0
    for (let i = 0; i < N; i++) {
      xs = p.kalmanA * xs + g.normal(0, Math.sqrt(p.q))
      truth[i] = xs
      z[i] = xs + g.normal(0, Math.sqrt(p.r))
    }
    const run = kalmanRun({ z, q: p.q, r: p.r, a: p.kalmanA, x0: p.x0, p0: p.p0 })
    // The one-shot estimate, for the comparison that says what memory is worth.
    let oneShot = null
    let varX = null
    try {
      varX = stationaryVariance({ a: p.kalmanA, q: p.q })
      oneShot = wienerScalar({ signalVariance: varX, noiseVariance: p.r })
    } catch {
      // A random walk has no stationary variance, so there is no one-shot
      // estimate to compare against. The pane says so rather than showing a
      // number that would look like an answer.
      oneShot = null
    }
    return {
      ...run,
      truth,
      z,
      steadyGain: steady.gain,
      priorVariance: steady.priorVariance,
      posteriorVariance: steady.posteriorVariance,
      innovationVariance: steady.priorVariance + p.r,
      stationaryVariance: varX,
      oneShotMmse: oneShot ? oneShot.mmse : null,
      memoryWorth: oneShot ? steady.posteriorVariance / oneShot.mmse : null,
    }
  })

  return {
    params: p,
    dist: d,
    draw,
    hist,
    histSweep,
    est,
    tail,
    qmark,
    scope,
    ens,
    ergSweep,
    wk,
    coverage,
    meanSweep,
    filter,
    record,
    psd,
    psdSweep,
    acf,
    ktc,
    pulse,
    snr,
    ber,
    wiener,
    kalman,
    // The closed forms a lesson quotes without any data behind them.
    closed: {
      q: qFunction,
      z: zFor,
      insideOneSigma: 1 - 2 * qFunction(1),
      insideTwoSigma: 1 - 2 * qFunction(2),
      insideThreeSigma: 1 - 2 * qFunction(3),
    },
  }
}

/**
 * Resolve one quantity path against an analysis, as AGENT_BRIEF.md section 4
 * lists them. Throws on a path it cannot resolve, so a lesson cannot quote a
 * quantity the app does not compute.
 */
export function resolve(a, path) {
  const parts = path.split('.')
  const [head] = parts
  const rest = parts.slice(1)
  const at = (obj, keys) =>
    keys.reduce((o, k) => {
      if (o === undefined || o === null) return undefined
      return o[/^\d+$/.test(k) ? Number(k) : k]
    }, obj)

  let v
  switch (head) {
    case 'dist':
      v = at(a.dist, rest)
      break
    case 'hist': {
      const h = a.hist()
      if (rest[0] === 'rms') v = h.error.rms
      else if (rest[0] === 'predicted') v = h.error.predicted
      else if (rest[0] === 'bin') {
        const k = Number(rest[1])
        const which = rest[2]
        v =
          which === 'density'
            ? h.density[k]
            : which === 'se'
              ? h.se[k]
              : which === 'lo'
                ? h.ci[k][0]
                : which === 'hi'
                  ? h.ci[k][1]
                  : which === 'truth'
                    ? h.truth.pdf(h.centres[k])
                    : undefined
      } else if (rest[0] === 'sweep') {
        const row = a.histSweep()[Number(rest[1])]
        v = at(row, rest.slice(2))
      } else v = at(h, rest)
      break
    }
    case 'est':
      v = at(a.est(), rest)
      break
    case 'scope': {
      const sc = a.scope()
      if (rest[0] === 'mean') v = sc.mean.value
      else if (rest[0] === 'variance') v = sc.variance.value
      else v = at(sc, rest)
      break
    }
    case 'qmark': {
      const q = a.qmark()
      if (rest[0] === 'counted') v = q.counted.value
      else if (rest[0] === 'lo') v = q.counted.ci[0]
      else if (rest[0] === 'hi') v = q.counted.ci[1]
      else if (rest[0] === 'se') v = q.counted.se
      else v = at(q, rest)
      break
    }
    case 'tail': {
      const row = a.tail()[Number(rest[0]) - 1]
      if (rest[1] === 'counted') v = row.counted.value
      else if (rest[1] === 'lo') v = row.counted.ci[0]
      else if (rest[1] === 'hi') v = row.counted.ci[1]
      else v = at(row, rest.slice(1))
      break
    }
    case 'ens': {
      const e = a.ens()
      if (rest[0] === 'sdAt0') v = e.sd[0]
      else if (rest[0] === 'spread') v = e.ergodicity.spread
      else if (rest[0] === 'gap') v = e.ergodicity.gap
      else if (rest[0] === 'yield') {
        const y = e.withinSpec()
        v = rest[1] === 'value' ? y.value : rest[1] === 'lo' ? y.ci[0] : y.ci[1]
      } else if (rest[0] === 'yield2') {
        const y = e.withinSpec(a.params.spec2)
        v = rest[1] === 'value' ? y.value : rest[1] === 'lo' ? y.ci[0] : y.ci[1]
      } else if (rest[0] === 'stat') v = at(e.statEstimate, rest.slice(1))
      else v = at(e, rest)
      break
    }
    case 'acf':
      v = at(a.acf(), rest)
      break
    case 'erg': {
      const row = a.ergSweep()[Number(rest[0])]
      v = at(row, rest.slice(1))
      break
    }
    case 'wk':
      v = at(a.wk(), rest)
      break
    case 'cov':
      v = at(a.coverage(), rest)
      break
    case 'meanN': {
      const row = a.meanSweep()[Number(rest[0])]
      v = at(row, rest.slice(1))
      break
    }
    case 'psd': {
      const s = a.psd()
      if (rest[0] === 'sweep') {
        const row = a.psdSweep()[Number(rest[1])]
        v = at(row, rest.slice(2))
      } else if (rest[0] === 'ci') v = rest[1] === 'lo' ? s.ciLo : s.ciHi
      else v = at(s, rest)
      break
    }
    case 'filt':
      v = at(a.filter(), rest)
      break
    case 'ktc': {
      const k = a.ktc()
      if (rest[0] === 'sweep') v = at(k.sweep[Number(rest[1])], rest.slice(2))
      else v = at(k, rest)
      break
    }
    case 'snr': {
      const s = a.snr()
      if (rest[0] === 'shape') v = s.shapes[Number(rest[1])].snr
      else v = at(s, rest)
      break
    }
    case 'ber': {
      const b = a.ber()
      if (rest[0] === 'lo') v = b.measured.ci[0]
      else if (rest[0] === 'hi') v = b.measured.ci[1]
      else if (rest[0] === 'measured') v = b.measured.value
      else v = at(b, rest)
      break
    }
    case 'wiener': {
      const w = a.wiener()
      if (rest[0] === 'sweep') v = at(w.sweep[Number(rest[1])], rest.slice(2))
      else v = at(w, rest)
      break
    }
    case 'kalman':
      v = at(a.kalman(), rest)
      break
    case 'closed':
      v = at(a.closed, rest)
      break
    default:
      throw new Error(`resolve: no section named "${head}" in path "${path}"`)
  }
  if (v === undefined || (typeof v === 'number' && !Number.isFinite(v))) {
    throw new Error(`resolve: "${path}" did not resolve to a finite number`)
  }
  return v
}
