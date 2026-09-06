// One analysis, read by the app and by the tests.
//
// Every number a pane prints and every number `experiments.test.js` pins comes
// from this function. There is no second path, so a lesson cannot quote a
// number the app does not draw, and a test cannot pass against arithmetic the
// reader never sees.
//
// Sections are computed lazily and memoised. An experiment that shows a
// constellation never runs an OFDM symbol, and the test suite walks every
// experiment without running the whole engine each time.
//
// The house rule of this lab, from COMMUNICATIONS_LAB_PLAN.md §2.8: a closed
// form is a bare number and a count is an estimate with an interval. The
// sections below keep them apart, and `resolve` returns whichever the path
// names.

import { rng, proportion } from '@ee-labs/random'
import { spectrum, spectrumComplex } from '@ee-labs/dsp'
import {
  constellation,
  adjacency,
  naturalLabels,
  mapBits,
  randomBits,
  decide,
  demapSymbols,
  errorVectorMagnitude,
  shapeTaps,
  residualIsi,
  shapedBandwidth,
  streamPeak,
  eyeOpening,
  raisedCosine,
  noiseVariance,
  multipath,
  twoRay,
  realTaps,
  tapsReal,
  channelResponse,
  rayleighGains,
  applyFading,
  rayleighBer,
  rayleighThreshold,
  FADING_ASSUMPTIONS,
  matchedFilterSnr,
  matchedSample,
  toneCorrelation,
  outsideRegion,
  softMetric,
  berClosed,
  serClosed,
  ebN0For,
  bitsPerSymbol,
  relativeHalfWidth,
  errorsFor,
  symbolsFor,
  berCount,
  berCurve,
  HOLLOW_BELOW,
  ofdmModulate,
  ofdmRoundTrip,
  subcarrierResponse,
  papr,
  paprCcdf,
  paprLevel,
  ofdmRate,
  subcarrierCorrelation,
  loopFilter,
  costasRun,
  earlyLate,
  loopSnrDb,
  phaseErrorLossDb,
  rotationDeg,
  besselJ,
  firstZeroJ0,
  fmLines,
  carsonFraction,
  carsonBandwidth,
  amSidebandDb,
  amSidebandPower,
  meritAm,
  meritFm,
  meritDb,
  amWaveform,
  dsbWaveform,
  fmWaveform,
  envelopeDetect,
  coherentDetect,
  thd,
  linearEqualiser,
  equaliserQuality,
  lmsEqualiser,
  lmsStable,
  ktDbm,
  noiseFloorDbm,
  pathLossDb,
  friisNoiseFigure,
  linkBudget,
  implementationLoss,
  wavelength,
  HARD_DECISION_DB,
} from '@ee-labs/comms'

/**
 * The values every lane uses, from AGENT_BRIEF.md §5.
 * A knob an experiment does not name takes its value here.
 */
export const DEFAULTS = {
  sampleRate: 8000,
  symbolRate: 1000,
  sps: 8,

  // The analog group, on the real chain
  carrier: 1000,
  message: 250,
  m: 0.5,
  deviation: 500,
  detectorCutoff: 500,
  localPhaseDeg: 0,

  // The digital chain
  passbandCarrier: 2000,
  scheme: 'bpsk',
  labelling: 'gray',
  beta: 0.35,
  span: 12,
  shape: 'rrc',
  symbols: 4096,
  seed: 1,
  level: 0.95,
  ebN0Db: 10,
  timingError: 0,
  phaseOffsetDeg: 0,
  freqOffsetHz: 0,

  // The bit error rate plot
  berFrom: 0,
  berTo: 12,
  berStep: 1,
  countTo: 6,
  countSymbols: 40000,
  target: 1e-5,

  // The matched filter
  pulse: 'rect',
  pulseLength: 64,
  n0: 0.05,
  trials: 20000,

  // Synchronisation
  bnT: 0.02,
  zeta: 0.707,
  loopOrder: 2,
  gate: 0.5,

  // OFDM
  ofdmN: 64,
  ofdmCp: 16,
  ofdmUsed: 52,
  ofdmPilots: 4,
  ofdmBits: 4,
  channelTaps: 5,

  // Multipath and equalisation
  echo: 0.5,
  echoDelay: 4,
  eqTaps: 41,
  eqNoise: 0,
  mu: 0.02,
  lmsSymbols: 20000,
  kFactor: 0,

  // The link budget
  frequency: 2.4e9,
  distance: 1000,
  txDbm: 20,
  antennaDbi: 2,
  noiseFigureDb: 6,
  bandwidth: 1e6,
  bitRate: 2e6,
  tempK: 290,
  lnaGainDb: 12,
  lnaNfDb: 1.5,
  mixerGainDb: 10,
  mixerNfDb: 4,
}

/** The schemes that are a table of points. The rest are detectors. */
const TABLE_SCHEMES = new Set(['bpsk', 'qpsk', 'psk8', 'pam4', 'qam16', 'qam64'])

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

/** The bits a symbol carries under this experiment's scheme. */
const bitsOf = (p) => bitsPerSymbol(p.scheme)

/** A power-of-two frame at or above `n`, which is what the transform takes. */
const pow2 = (n) => 2 ** Math.ceil(Math.log2(Math.max(2, n)))

export function analyse(params = {}) {
  const p = { ...DEFAULTS, ...params }

  // ------------------------------------------------------- the constellation
  // The three binary schemes are not points in the plane, so an experiment that
  // names one still draws BPSK where a constellation is called for. B7 is the
  // experiment that says why.
  const table = memo(() => constellation(TABLE_SCHEMES.has(p.scheme) ? p.scheme : 'bpsk'))

  const cloud = memo(() => {
    const c = table()
    const r = rng(p.seed)
    const n = Math.min(p.symbols, 8192)
    const bits = randomBits(c.bits * n, r)
    const clean = mapBits(c.name, bits)
    const sent = decide(c.name, clean)
    const { sigma } = noiseVariance({ ebN0Db: p.ebN0Db, bitsPerSymbol: c.bits })
    let noisy = new Float64Array(clean.length)
    for (let i = 0; i < clean.length; i++) noisy[i] = clean[i] + r.normal(0, sigma)
    if (p.phaseOffsetDeg) noisy = rotationDeg(noisy, p.phaseOffsetDeg)
    const evm = errorVectorMagnitude(c.name, noisy)
    const outside = outsideRegion(c.name, noisy, sent)
    const got = demapSymbols(c.name, noisy)
    let bitErrors = 0
    for (let i = 0; i < bits.length; i++) if (got[i] !== bits[i]) bitErrors++
    return {
      bits,
      clean,
      noisy,
      sent,
      sigma,
      evm,
      outside,
      symbolErrorRate: outside.errors / n,
      // The counted rate is an estimate, so it carries the interval every
      // measured quantity in this lab carries.
      ser: proportion(outside.errors, n),
      ber: proportion(bitErrors, bits.length),
      bitErrorRate: bitErrors / bits.length,
      llr: softMetric(c.name, noisy.subarray(0, 2 * Math.min(n, 64)), sigma * sigma),
    }
  })

  const map = memo(() => {
    const c = table()
    // Every constellation's headline numbers, so an experiment can compare its
    // own against another without a second analysis.
    const distances = {}
    const paprs = {}
    for (const name of TABLE_SCHEMES) {
      const t = constellation(name)
      distances[name] = t.minDistance
      paprs[name] = t.paprDb
    }
    return {
      distances,
      paprs,
      name: c.name,
      label: c.label,
      bits: c.bits,
      size: c.size,
      points: c.points,
      labels: c.labels,
      minDistance: c.minDistance,
      meanSquare: c.meanSquare,
      papr: c.papr,
      paprDb: c.paprDb,
      grayMax: adjacency(c.name),
      naturalMax: adjacency(c.name, naturalLabels(c.name)),
      esOverEbDb: 10 * Math.log10(c.bits),
    }
  })

  // ------------------------------------------------------------- the analog
  const analogFrame = memo(() => {
    const warm = 2048
    const frame = 8192
    const n = warm + frame
    const opts = {
      n,
      sampleRate: p.sampleRate,
      carrier: p.carrier,
      message: p.message,
      m: p.m,
      deviation: p.deviation,
    }
    return { warm, frame, n, opts }
  })

  const am = memo(() => {
    const { warm, frame, opts } = analogFrame()
    const buf = amWaveform(opts)
    const s = spectrum(buf.subarray(warm, warm + frame), p.sampleRate, 'none')
    const bin = (f) => s.amps[Math.round((f * frame) / p.sampleRate)]
    const carrierLine = bin(p.carrier)
    const lower = bin(p.carrier - p.message)
    const upper = bin(p.carrier + p.message)
    const detected = envelopeDetect(buf, { sampleRate: p.sampleRate, cutoff: 800 })
    const ds = spectrum(detected.subarray(warm, warm + frame), p.sampleRate, 'hann')
    // The coherent detector on a suppressed carrier, and what a local phase
    // error costs it.
    const dsb = dsbWaveform(opts)
    const level = (deg) => {
      const out = coherentDetect(dsb, {
        sampleRate: p.sampleRate,
        carrier: p.carrier,
        cutoff: p.detectorCutoff,
        phaseDeg: deg,
      })
      const cs = spectrum(out.subarray(warm, warm + frame), p.sampleRate, 'hann')
      return cs.amps[Math.round((p.message * frame) / p.sampleRate)]
    }
    const dsbSpectrum = spectrum(dsb.subarray(warm, warm + frame), p.sampleRate, 'none')
    const dsbBin = (f) => dsbSpectrum.amps[Math.round((f * frame) / p.sampleRate)]
    // The distortion at three indices, which is A3. An envelope detector
    // follows the outline of the waveform, and above an index of 1 that outline
    // folds through zero and gains a harmonic that was never sent.
    const thdAt = (m) => {
      const w = amWaveform({ ...opts, m })
      const d = envelopeDetect(w, { sampleRate: p.sampleRate, cutoff: 800 })
      const ss = spectrum(d.subarray(warm, warm + frame), p.sampleRate, 'hann')
      return thd(ss.amps, ss.freqs, p.message, 4)
    }
    return {
      buf,
      spectrum: s,
      lowerHz: p.carrier - p.message,
      upperHz: p.carrier + p.message,
      sidebandDb: amSidebandDb(p.m),
      measuredSidebandDb: 20 * Math.log10(lower / carrierLine),
      sidebandSymmetry: upper / lower,
      sidebandPower: amSidebandPower(p.m),
      carrierDb: 20 * Math.log10(carrierLine),
      detected,
      detectedSpectrum: ds,
      thd: thd(ds.amps, ds.freqs, p.message, 4),
      thdSweep: [0.5, 1, 1.5].map(thdAt),
      dsb,
      dsbCarrierRatio: dsbBin(p.carrier) / dsbBin(p.carrier - p.message),
      coherentAt0: level(0),
      coherentLoss: level(30) / level(0),
      coherentLossDb: phaseErrorLossDb(30),
      occupiedDsb: 2 * p.message,
      occupiedSsb: p.message,
    }
  })

  const fm = memo(() => {
    const { warm, frame, opts } = analogFrame()
    const beta = p.deviation / p.message
    const buf = fmWaveform(opts)
    const s = spectrum(buf.subarray(warm, warm + frame), p.sampleRate, 'none')
    const bin = (f) => s.amps[Math.round((f * frame) / p.sampleRate)]
    const carrierLine = bin(p.carrier)
    const measured = [1, 2, 3].map((k) => bin(p.carrier + k * p.message) / carrierLine)
    return {
      buf,
      spectrum: s,
      beta,
      lines: fmLines({ beta, order: 8 }),
      measured,
      predicted: [1, 2, 3].map((k) => Math.abs(besselJ(k, beta) / besselJ(0, beta))),
      carson: carsonFraction({ beta }),
      carsonBandwidth: carsonBandwidth({ deviation: p.deviation, message: p.message }),
      nullBeta: firstZeroJ0(),
      nullDeviation: firstZeroJ0() * p.message,
      merit: meritFm(beta),
      meritDb: meritDb(meritFm(beta)),
      amMeritDb: meritDb(meritAm(p.m)),
      bandwidthRatio: carsonBandwidth({ deviation: p.deviation, message: p.message }) / (2 * p.message),
    }
  })

  // -------------------------------------------------------------- the pulse
  const taps = memo(() => shapeTaps({ kind: p.shape, beta: p.beta, span: p.span, sps: p.sps }))

  const pulse = memo(() => {
    const h = taps()
    const isi = residualIsi(h, p.sps)
    const peak = streamPeak(p.beta)
    const bw = shapedBandwidth(p.beta, p.symbolRate)
    return {
      taps: h,
      bandwidth: bw,
      passband: 2 * bw,
      efficiency: (bitsOf(p) * p.symbolRate) / (2 * bw),
      peak: peak.peak,
      peakDb: peak.db,
      isi,
      samples: [0, 1, 2, 3, 4].map((k) => raisedCosine(k, p.beta)),
      guarded: p.span < 6,
    }
  })

  const eye = memo(() => {
    const h = taps()
    const c = rng(p.seed)
    const n = 256
    const bits = randomBits(n, c)
    const sps = p.sps
    const up = new Float64Array(n * sps)
    for (let i = 0; i < n; i++) up[i * sps] = bits[i] ? 1 : -1
    const shaped = new Float64Array(up.length)
    for (let i = 0; i < up.length; i++) {
      let v = 0
      for (let k = 0; k < h.length; k++) if (i - k >= 0) v += h[k] * up[i - k]
      shaped[i] = v
    }
    const openings = [0.05, 0.1, 0.2].map((e) => eyeOpening(p.beta, e))
    return {
      traces: shaped,
      sps,
      opening: eyeOpening(p.beta, p.timingError),
      openingAt: openings,
      openingClean: eyeOpening(p.beta, 0),
      closed: eyeOpening(p.beta, p.timingError) <= 0,
      timingLossDb: -20 * Math.log10(Math.max(1e-9, eyeOpening(p.beta, 0.05))),
    }
  })

  // ------------------------------------------------------------ the channel
  const channelTaps = memo(() => twoRay(p.echo, p.echoDelay))

  const chan = memo(() => {
    const t = channelTaps()
    const r = channelResponse(t, p.sampleRate, 481)
    return {
      taps: t,
      real: tapsReal(t),
      ...r,
      occupied: 2 * shapedBandwidth(p.beta, p.symbolRate),
      selective: r.coherenceBandwidth < 2 * shapedBandwidth(p.beta, p.symbolRate),
    }
  })

  const eq = memo(() => {
    const ch = tapsReal(channelTaps())
    const zf = linearEqualiser({ channel: ch, taps: p.eqTaps, noiseVariance: 0 })
    const qz = equaliserQuality({ channel: ch, w: zf.taps, delay: zf.delay })
    const mmse = linearEqualiser({ channel: ch, taps: p.eqTaps, delay: zf.delay, noiseVariance: 0.05 })
    const qm = equaliserQuality({ channel: ch, w: mmse.taps, delay: zf.delay })
    const lms = lmsEqualiser({
      channel: ch,
      taps: p.eqTaps,
      mu: p.mu,
      symbols: p.lmsSymbols,
      delay: zf.delay,
      rng: rng(p.seed),
    })
    let worst = 0
    for (let i = 0; i < zf.taps.length; i++) worst = Math.max(worst, Math.abs(lms.taps[i] - zf.taps[i]))
    return {
      zf,
      mmse,
      lms,
      residual: qz.residual,
      mmseResidual: qm.residual,
      noiseGainDb: qz.noiseGainDb,
      mmseNoiseGainDb: qm.noiseGainDb,
      cascade: qz.cascade,
      delay: zf.delay,
      lmsGap: worst,
      lmsBound: lmsStable(p.eqTaps, 1 + p.echo * p.echo),
    }
  })

  const fade = memo(() => {
    const g = rayleighGains(Math.min(p.symbols, 20000), { seed: p.seed, kFactor: p.kFactor })
    return {
      ...g,
      closed: rayleighBer(p.ebN0Db),
      closedAt20: rayleighBer(20),
      threshold: rayleighThreshold(p.target),
      awgnThreshold: ebN0For('bpsk', p.target),
      penaltyDb: rayleighThreshold(p.target) - ebN0For('bpsk', p.target),
      assumptions: FADING_ASSUMPTIONS,
      faded: applyFading(cloud().clean.subarray(0, 2 * Math.min(p.symbols, 20000)), g.gains),
    }
  })

  // ------------------------------------------------- the matched filter
  const snr = memo(() => {
    const matched = matchedFilterSnr({
      pulse: p.pulse,
      length: p.pulseLength,
      n0: p.n0,
      trials: p.trials,
      seed: p.seed,
    })
    const mismatched = matchedFilterSnr({
      pulse: p.pulse,
      mismatch: p.pulse === 'rect' ? 'halfSine' : 'rect',
      length: p.pulseLength,
      n0: p.n0,
      trials: p.trials,
      seed: p.seed,
    })
    return {
      ...matched,
      mismatch: mismatched.measured,
      mismatchLoss: mismatched.mismatchLoss,
      mismatchLossDb: -10 * Math.log10(mismatched.mismatchLoss),
    }
  })

  // ------------------------------------------------------ the bit error rate
  const ber = memo(() => {
    const gammaB = 10 ** (p.ebN0Db / 10)
    const counted = berCount({
      scheme: p.scheme,
      ebN0Db: p.ebN0Db,
      symbols: Math.min(p.countSymbols, 200000),
      seed: p.seed,
      level: p.level,
    })
    const curve = berCurve({
      scheme: p.scheme,
      from: p.berFrom,
      to: p.berTo,
      step: p.berStep,
      countTo: p.countTo,
      symbols: Math.min(p.countSymbols, 200000),
      seed: p.seed,
    })
    const thresholds = {}
    for (const s of ['bpsk', 'qpsk', 'psk8', 'fskCoherent', 'fskNoncoherent', 'dbpsk', 'qam16', 'qam64', 'pam4']) {
      thresholds[s] = ebN0For(s, p.target)
    }
    return {
      closed: berClosed(p.scheme, gammaB),
      ser: serClosed(p.scheme, gammaB),
      serRatio: serClosed(p.scheme, gammaB) / (bitsOf(p) * berClosed(p.scheme, gammaB)),
      counted,
      curve,
      threshold: thresholds,
      halfWidth100: relativeHalfWidth(100),
      halfWidth1000: relativeHalfWidth(1000),
      errorsForTenth: errorsFor(0.1),
      symbolsFor: [0, 4, 6, 8, 10].map((d) => symbolsFor(p.scheme, d, 100)),
      hollowBelow: HOLLOW_BELOW,
      orthogonalPenaltyDb: ebN0For('fskCoherent', p.target) - ebN0For('bpsk', p.target),
      toneCorrelation: [250, 500, 1000].map((s) =>
        toneCorrelation({ spacing: s, symbolRate: p.symbolRate, carrier: p.passbandCarrier }),
      ),
    }
  })

  // ------------------------------------------------------------------ OFDM
  const ofdm = memo(() => {
    const grid = ofdmRate({
      n: p.ofdmN,
      cp: p.ofdmCp,
      used: p.ofdmUsed,
      pilots: p.ofdmPilots,
      bitsPerSymbol: p.ofdmBits,
      sampleRate: p.sampleRate,
    })
    const r = rng(p.seed)
    const syms = mapBits('qam16', randomBits(4 * p.ofdmN, r))
    const exact = {}
    for (const m of [1, 4, 5, p.ofdmCp + 1, p.ofdmCp + 2]) {
      const t = realTaps(Array.from({ length: m }, (_, i) => (i === 0 ? 1 : 0.6 / (i + 1))))
      exact[m] = ofdmRoundTrip({ syms, taps: t, n: p.ofdmN, cp: p.ofdmCp }).worst
    }
    const taps4 = realTaps(Array.from({ length: p.channelTaps }, (_, i) => (i === 0 ? 1 : 0.6 / (i + 1))))
    const run = ofdmRoundTrip({ syms, taps: taps4, n: p.ofdmN, cp: p.ofdmCp })
    const tx = ofdmModulate(syms, { n: p.ofdmN, cp: 0 })
    return {
      ...grid,
      syms,
      exact,
      run,
      tx,
      channel: subcarrierResponse(taps4, p.ofdmN),
      papr: papr(tx),
      paprCcdf: [10, 12].map((db) => paprCcdf(db, p.ofdmN)),
      paprLevel: paprLevel(1e-4, p.ofdmN),
      correlationOnGrid: subcarrierCorrelation({ spacing: grid.spacing, usefulMs: grid.usefulMs, sampleRate: p.sampleRate }),
      correlationOffGrid: subcarrierCorrelation({ spacing: grid.spacing - 5, usefulMs: grid.usefulMs, sampleRate: p.sampleRate }),
    }
  })

  // ----------------------------------------------------------------- loops
  const loop = memo(() => {
    const f = loopFilter({ bnT: p.bnT, zeta: p.zeta, symbolRate: p.symbolRate })
    const run = costasRun({
      symbols: Math.min(p.symbols, 8000),
      phaseOffsetDeg: p.phaseOffsetDeg || 40,
      freqOffsetHz: p.freqOffsetHz,
      symbolRate: p.symbolRate,
      bnT: p.bnT,
      zeta: p.zeta,
      order: p.loopOrder,
      scheme: p.scheme === 'qpsk' ? 'qpsk' : 'bpsk',
      seed: p.seed,
    })
    const firstOrder = costasRun({
      symbols: Math.min(p.symbols, 8000),
      phaseOffsetDeg: p.phaseOffsetDeg || 40,
      freqOffsetHz: p.freqOffsetHz,
      symbolRate: p.symbolRate,
      bnT: p.bnT,
      zeta: p.zeta,
      order: 1,
      seed: p.seed,
    })
    const gate = earlyLate({ h: taps(), sps: p.sps, spacing: p.gate })
    return {
      ...f,
      run,
      firstOrder,
      gate,
      slope: gate.slope,
      peakAt: gate.peakAt,
      residualDeg: run.residualDeg,
      jitterDeg: run.jitterDeg,
      firstOrderErrorDeg: firstOrder.staticErrorDeg,
      settleSymbols1pc: f.settleSymbols(0.01),
      settleMs: f.settleTo(0.01) * 1000,
      snrDb: loopSnrDb(p.bnT),
      phaseLossDb: phaseErrorLossDb(p.phaseOffsetDeg || 30),
    }
  })

  // ---------------------------------------------------------- the link budget
  const budget = memo(() => {
    const b = linkBudget({
      txDbm: p.txDbm,
      antennaDbi: p.antennaDbi,
      distance: p.distance,
      frequency: p.frequency,
      bandwidth: p.bandwidth,
      bitRate: p.bitRate,
      noiseFigureDb: p.noiseFigureDb,
      tempK: p.tempK,
      requiredEbN0Db: ebN0For('qpsk', p.target),
    })
    const forward = friisNoiseFigure([
      { gainDb: p.lnaGainDb, noiseFigureDb: p.lnaNfDb },
      { gainDb: p.mixerGainDb, noiseFigureDb: p.mixerNfDb },
    ])
    const swapped = friisNoiseFigure([
      { gainDb: p.mixerGainDb, noiseFigureDb: p.mixerNfDb },
      { gainDb: p.lnaGainDb, noiseFigureDb: p.lnaNfDb },
    ])
    const grid = ofdmRate({ n: p.ofdmN, cp: p.ofdmCp, used: p.ofdmUsed, pilots: p.ofdmPilots })
    const loss = implementationLoss({
      prefixCostDb: grid.prefixCostDb,
      pilotCostDb: grid.pilotCostDb,
      hardDecisionDb: HARD_DECISION_DB,
      timingLossDb: -20 * Math.log10(eyeOpening(p.beta, 0.05)),
    })
    return {
      ...b,
      kT: ktDbm(p.tempK),
      noiseFloor: noiseFloorDbm({ tempK: p.tempK, bandwidth: p.bandwidth, noiseFigureDb: p.noiseFigureDb }),
      lossAt: [100, 1000, 10000].map((d) => pathLossDb({ distance: d, frequency: p.frequency })),
      wavelength: wavelength(p.frequency),
      noiseFigure: forward.db,
      noiseFigureSwapped: swapped.db,
      loss,
      implementationTotal: loss.total,
    }
  })

  // ------------------------------------------------------- the shaped signal
  const wave = memo(() => {
    const h = taps()
    const c = table()
    const r = rng(p.seed)
    const n = Math.min(256, p.symbols)
    const syms = mapBits(c.name, randomBits(c.bits * n, r))
    const up = new Float64Array(2 * n * p.sps)
    for (let i = 0; i < n; i++) {
      up[2 * i * p.sps] = syms[2 * i]
      up[2 * i * p.sps + 1] = syms[2 * i + 1]
    }
    const shaped = new Float64Array(up.length)
    for (let i = 0; i < up.length / 2; i++) {
      let re = 0
      let im = 0
      for (let k = 0; k < h.length; k++) {
        if (i - k < 0) continue
        re += h[k] * up[2 * (i - k)]
        im += h[k] * up[2 * (i - k) + 1]
      }
      shaped[2 * i] = re
      shaped[2 * i + 1] = im
    }
    const frame = pow2(Math.min(4096, shaped.length / 2))
    const re = new Float64Array(frame)
    const im = new Float64Array(frame)
    for (let i = 0; i < frame; i++) {
      re[i] = shaped[2 * i]
      im[i] = shaped[2 * i + 1]
    }
    const through = p.echo > 0 ? multipath(shaped, channelTaps()) : shaped
    return {
      syms,
      shaped,
      through,
      spectrum: spectrumComplex(re, im, p.sampleRate, 'hann'),
      sampled: matchedSample(shaped, h, p.sps),
    }
  })

  return { params: p, map, cloud, am, fm, pulse, eye, chan, eq, fade, snr, ber, ofdm, loop, budget, wave, table }
}

/**
 * One quantity by its path. A path with no section behind it throws, and a path
 * whose section exists but whose field does not throws too, so a test cannot
 * pass against `undefined`.
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

  const sections = {
    map: () => at(a.map(), rest),
    cloud: () => at(a.cloud(), rest),
    am: () => at(a.am(), rest),
    fm: () => at(a.fm(), rest),
    pulse: () => at(a.pulse(), rest),
    eye: () => at(a.eye(), rest),
    chan: () => at(a.chan(), rest),
    eq: () => at(a.eq(), rest),
    fade: () => at(a.fade(), rest),
    snr: () => at(a.snr(), rest),
    ofdm: () => at(a.ofdm(), rest),
    loop: () => at(a.loop(), rest),
    budget: () => at(a.budget(), rest),
    wave: () => at(a.wave(), rest),
    ber: () => {
      const b = a.ber()
      if (rest[0] === 'at') {
        const point = b.curve.points.find((q) => Math.abs(q.ebN0Db - Number(rest[1])) < 1e-9)
        if (!point) return undefined
        const which = rest[2]
        if (which === 'closed') return point.closed
        if (which === 'counted') return point.counted ? point.counted.value : undefined
        if (which === 'lo') return point.counted ? point.counted.ci[0] : undefined
        if (which === 'hi') return point.counted ? point.counted.ci[1] : undefined
        if (which === 'errors') return point.counted ? point.counted.errors : undefined
        return undefined
      }
      return at(b, rest)
    },
  }

  if (!sections[head]) throw new Error(`resolve: no section named "${head}" in "${path}"`)
  const v = sections[head]()
  if (v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v))) {
    throw new Error(`resolve: "${path}" did not resolve to a value`)
  }
  return v
}
