import {
  arOrderCriteria,
  arSpectrum,
  arYuleWalker,
  bandStats,
  bartlett,
  designBiquad,
  autocorr,
  convolveFir,
  fftCost,
  firResponse,
  findLimitCycle,
  lmsStepBound,
  makeFixedBiquad,
  misadjustment,
  multirateCost,
  periodogram,
  poleGrid,
  quantizer,
  roundingNoise,
  spectrum,
  tailPower,
  weightError,
  welch,
  wiener,
} from '@ee-labs/dsp'
import { BLOCK_TYPES, firDesign, iirDesign, cascadeResponse, tapsOf } from './blocks.js'
import { chainSpec, renderChain, runChain } from './chain.js'

// The quantity paths, resolved once.
//
// An experiment's `claims` name a path and the test resolves it here, so the
// number the readout prints and the number the test pins come from the same
// line of code. A path the resolver does not know throws rather than returning
// undefined, because a claim about a quantity nobody measures is the defect this
// arrangement exists to catch.
//
// The paths are the brief's §4 list:
//
//   line.<hz>                        the amplitude of the spectral line there
//   db.<hz>                          the same in decibels
//   rate.<nyquist|grid|alias>        the new Nyquist, the coarse rate, the fold
//   cost.<direct|polyphase|ratio>    multiplies a second, and the saving
//   design.<taps|order|coefficients|estimate|grew|delta|met>
//   spec.<band>.<marginDb|maxDb|minDb|atHz|met>
//   spec.worst
//   guard.<hz>                       the anti-alias filter's response there
//   lms.<power|bound|boundMean|misadjustment|reach|converged|diverged>
//   lms.<error|settled|floor|ratio|echo|residual|erle|cost>
//   lms.<wiener|rdiag|near>
//   fix.<delta|stateDelta|radius|moved|stable|top|bottom>
//   fix.<deadband|deadbandUnits|period|noiseGain|rmsIn|rmsOut|gainDb>
//   fix.<gridTotal|gridDense|gridSparse|gridRatio|measured|modelRatio>
//   fix.<over|saturated|wrapped>
//   psd.<mean|cv|df|segments|n|used|power|true|predicted>
//   psd.peaks.<from>.<to>            lines in a band, separated by 3 dB
//   psd.resolved.<from>.<to>         whether that count is two
//   ar.<a1|a2|sigma2|peak|aic|mdl>
//   fft.<butterflies|direct|ratio|stages|n>

/** Render an experiment's state exactly as the app does. */
export function runState(state) {
  const { buf } = renderChain(state.sources, state.blocks, state.fftSize, state.sampleRate)
  return { buf, ...spectrum(buf, state.sampleRate, state.window || 'hann') }
}

/**
 * The amplitude of the line nearest `hz`, read as the app's marker reads it.
 *
 * A Hann window spreads a line over about three bins, so the peak within two
 * bins is the line's amplitude. Every lesson frequency is a multiple of 375 Hz,
 * which is a bin centre of the 4096-point frame, so the spread is symmetric and
 * the peak is the true amplitude rather than a scalloped fraction of it.
 */
export function lineAt(s, hz) {
  let bi = 0
  for (let i = 1; i < s.freqs.length; i++) {
    if (Math.abs(s.freqs[i] - hz) < Math.abs(s.freqs[bi] - hz)) bi = i
  }
  let m = 0
  for (let i = Math.max(0, bi - 2); i <= Math.min(s.amps.length - 1, bi + 2); i++) {
    m = Math.max(m, s.amps[i])
  }
  return m
}

const firstBlock = (state, pred) =>
  state.blocks.find((b) => !b.bypass && BLOCK_TYPES[b.type] && pred(b, BLOCK_TYPES[b.type]))

/** The rate-changing block in the chain, or null. */
export function rateBlock(state) {
  return firstBlock(state, (b) => b.type === 'decimate' || b.type === 'interpolate') ?? null
}

/** The design block in the chain, or null. */
export function designBlock(state) {
  return firstBlock(state, (b) => b.type === 'firspec' || b.type === 'iirspec') ?? null
}

/** The design a design block produced. */
export function designOf(state) {
  const b = designBlock(state)
  if (!b) return null
  return b.type === 'firspec' ? firDesign(b.params, state.sampleRate) : iirDesign(b.params, state.sampleRate)
}

/**
 * The zero-order hold's droop at `hz`, for a decimator holding M samples.
 *
 * A held sample is a rectangle M samples wide, whose transform is a sinc. The
 * amplitude a decimate-and-hold block returns is the alias times this factor,
 * which is why A1's measurement is 0.9061 and not 1.
 */
export function holdDroop(hz, M, sampleRate) {
  const x = (Math.PI * hz * M) / sampleRate
  return x === 0 ? 1 : Math.sin(x) / x
}


/** The adaptive block in the chain, or null. */
export function adaptiveBlock(state) {
  return firstBlock(state, (b) => b.type === 'adaptive') ?? null
}

/** The fixed-point block in the chain, or null. */
export function fixedBlock(state) {
  return firstBlock(state, (b) => b.type === 'fixedbiquad') ?? null
}

/**
 * The buffer arriving at a block, which is the stage before it.
 *
 * `runChain` keeps one stage per block plus the sum it started from, so the
 * input to `blocks[i]` is `stages[i]`. Reading it here rather than re-rendering
 * the sources means a measurement sees exactly what the block saw, including
 * anything a block ahead of it did.
 */
export function inputTo(state, id) {
  const { stages } = runChain(state.sources, state.blocks, state.fftSize, state.sampleRate)
  const i = state.blocks.findIndex((b) => b.id === id)
  return stages[Math.max(0, i)].buf
}

/** Mean square of a buffer, which is its power per sample. */
export const power = (buf) => tailPower(buf, buf.length)

/**
 * The adaptive block's whole run, at stride 1 so a convergence count is exact.
 *
 * Everything Group C reads comes from this one run: the weights it ended at,
 * the error it settled to, and the noise floor that error cannot go below. Held
 * against the last state seen, because four claims on one experiment would
 * otherwise run the same eight-tap filter over 4096 samples four times.
 */
let lastAdaptive = { key: null, value: null }
export function adaptiveOf(state) {
  const b = adaptiveBlock(state)
  if (!b) return null
  const key = JSON.stringify([b.params, state.sources, state.fftSize, state.sampleRate])
  if (lastAdaptive.key === key) return lastAdaptive.value
  const x = inputTo(state, b.id)
  const r = BLOCK_TYPES.adaptive.run(b.params, x, state.sampleRate, { stride: 1 })
  const plant = tapsOf(b.params.plant)
  const clean = convolveFir(x, plant)
  const tail = Math.max(1, Math.round(x.length / 4))
  const value = {
    block: b,
    x,
    plant,
    ...r,
    inputPower: power(x),
    // The floor is the part of what was wanted that no filter of the input can
    // produce, which is the added noise itself.
    floor: r.noise ? power(r.noise) : 0,
    clean,
    tail,
  }
  lastAdaptive = { key, value }
  return value
}

/**
 * The first sample at which the weights are within `frac` of the plant.
 *
 * The history is one row a sample here, so this is a sample count and not a
 * multiple of a stride. A run that never gets there returns the run's length,
 * which is a lower bound rather than a fiction, and `lms.converged` says which
 * of the two happened.
 */
export function reachAt(run, frac = 0.1) {
  for (let i = 0; i < run.history.length; i++) {
    if (weightError(run.history[i], run.plant) <= frac) return i
  }
  return run.history.length
}

/** Multiplies a sample, by algorithm. The cost that buys the convergence. */
export function costPerSample(algorithm, taps) {
  const N = Math.max(1, Math.round(taps))
  if (algorithm === 'rls') return N * N
  return algorithm === 'nlms' ? 3 * N : 2 * N
}

/** The fixed-point block's quantisers and the section they act on. */
export function fixedOf(state) {
  const b = fixedBlock(state)
  if (!b) return null
  const def = BLOCK_TYPES.fixedbiquad
  return {
    block: b,
    exact: designBiquad({ mode: b.params.mode, freq: b.params.freq, q: b.params.q }, state.sampleRate),
    q: def.quantised(b.params, state.sampleRate),
    qs: def.quantisers(b.params),
  }
}

/**
 * The dead band, measured rather than predicted.
 *
 * The section is started from four tenths of full scale with no input at all and
 * run until its state repeats. In float64 it would decay to nothing. With the
 * state on a grid the decay stops where a step of the recursion rounds back to
 * where it started, and what it sits on from then on is the limit cycle. Its
 * amplitude divided by the step is the count a lesson quotes, and it is the same
 * count at every word length because the coefficients set it and the word length
 * sets only the size of a step.
 *
 * The starting level is a level rather than a count of steps, so the same number
 * means the same thing at 10 bits and at 16. With no state quantiser there is no
 * dead band at all, and the resolver says so by returning zero.
 */
export const DEAD_BAND_START = 0.4

export function deadBandOf(state) {
  const f = fixedOf(state)
  if (!f || !f.qs.state) return { steps: 0, amplitude: 0, period: 0, found: false, delta: 0 }
  const step = makeFixedBiquad(f.exact, { coeffQ: f.qs.coeff, stateQ: f.qs.state })
  const d = f.qs.state.delta
  const start = f.qs.state(DEAD_BAND_START)
  const cyc = findLimitCycle(step, { start: [0, 0, start, start] })
  return { ...cyc, steps: Math.round(cyc.amplitude / d), delta: d }
}

/**
 * The largest output the section asks for, with its state in float64.
 *
 * This is the headroom the accumulator has to hold. A word length that cannot
 * hold it has to do something about it, and the two things a processor can do
 * are the whole of E5.
 */
export function headroomOf(state) {
  const f = fixedOf(state)
  if (!f) throw new Error('headroom with no fixed-point block')
  const x = inputTo(state, f.block.id)
  const exact = makeFixedBiquad(f.exact, { coeffQ: f.qs.coeff, stateQ: null })
  let peak = 0
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(exact(x[i])))
  return peak
}

/**
 * The rounding noise a run actually produced, against the model's prediction.
 *
 * The same section is run twice over the same input, once with the state on the
 * grid and once with it in float64. The difference is the rounding, measured
 * rather than modelled, and it is the only honest way to check a model whose
 * assumption is that the error looks like noise. `roundingNoise` predicts the
 * rms; this returns what came out, and the ratio between them is the guard
 * CORE_SCOPE asks an approximation to carry.
 */
export function roundingMeasured(state) {
  const f = fixedOf(state)
  if (!f || !f.qs.state) throw new Error('no state quantiser, so there is no rounding to measure')
  const x = inputTo(state, f.block.id)
  const rounded = makeFixedBiquad(f.exact, { coeffQ: f.qs.coeff, stateQ: f.qs.state })
  const exact = makeFixedBiquad(f.exact, { coeffQ: f.qs.coeff, stateQ: null })
  let acc = 0
  for (let i = 0; i < x.length; i++) {
    const d = rounded(x[i]) - exact(x[i])
    acc += d * d
  }
  return Math.sqrt(acc / Math.max(1, x.length))
}

/**
 * Two boxes of equal area on the z-plane, and the pole positions in each.
 *
 * A direct-form section's poles sit where r^2 is a1's grid and cos(theta) is
 * -a1 over 2r, so the reachable points crowd where that mapping is flat and thin
 * out where it is steep. The first box is on the diagonal at 45 degrees and the
 * second is against the real axis just inside z of 1, which is exactly where a
 * low-frequency resonator needs to be. Both are a tenth square, so the counts
 * are comparable and their ratio is the lesson.
 *
 * The grid has (2/delta)^2 candidates, so it is computed only up to the twelve
 * bits where that is under a million. Past that the resolver declines rather
 * than freezing the page for a picture nobody can read anyway.
 */
export const POLE_BOXES = {
  dense: { re: 0.65, im: 0.65 },
  sparse: { re: 0.9, im: 0 },
  side: 0.1,
}
export const POLE_GRID_MAX_BITS = 12

export function poleBoxes(state) {
  const f = fixedOf(state)
  if (!f) throw new Error('pole grid with no fixed-point block')
  const bits = f.block.params.coeffBits
  if (bits > POLE_GRID_MAX_BITS) {
    throw new Error(
      `the pole grid is drawn up to ${POLE_GRID_MAX_BITS} bits, and this section has ${bits}`,
    )
  }
  const pts = poleGrid(f.qs.coeff)
  const count = ({ re, im }) =>
    pts.filter(
      (p) =>
        p[0] >= re && p[0] < re + POLE_BOXES.side && p[1] >= im && p[1] < im + POLE_BOXES.side,
    ).length
  const dense = count(POLE_BOXES.dense)
  const sparse = count(POLE_BOXES.sparse)
  return { points: pts, total: pts.length, dense, sparse, ratio: dense / Math.max(1, sparse) }
}

/** The estimate the density view draws, from the state's own estimator. */
export function psdOf(state) {
  const { buf } = renderChain(state.sources, state.blocks, state.fftSize, state.sampleRate)
  const K = Math.max(1, Math.round(state.segments ?? 1))
  if (state.estimator === 'welch') return welch(buf, state.sampleRate, { segments: K })
  if (state.estimator === 'bartlett') return bartlett(buf, state.sampleRate, { segments: K })
  return periodogram(buf, state.sampleRate, { window: state.window ?? 'none' })
}

/**
 * The lines in a band of an estimate, counted.
 *
 * A local maximum counts as a line when the deepest valley between it and the
 * previous one is at least `DIP_DB` below the smaller of the two. Two tones a
 * bin apart make one hump and count once; two tones many bins apart make two.
 * This is what D5 measures when it says the average merged them.
 */
export const DIP_DB = 3

export function linesIn(est, from, to) {
  const idx = []
  for (let k = 0; k < est.freqs.length; k++) if (est.freqs[k] >= from && est.freqs[k] <= to) idx.push(k)
  const peaks = []
  for (let i = 1; i < idx.length - 1; i++) {
    const k = idx[i]
    if (est.psd[k] > est.psd[k - 1] && est.psd[k] >= est.psd[k + 1]) peaks.push(k)
  }
  if (peaks.length < 2) return peaks.length
  // Keep the tallest, then any other peak with a deep enough valley between it
  // and every peak already kept.
  peaks.sort((a, b) => est.psd[b] - est.psd[a])
  const kept = [peaks[0]]
  for (const k of peaks.slice(1)) {
    const ok = kept.every((j) => {
      const [lo, hi] = k < j ? [k, j] : [j, k]
      let valley = Infinity
      for (let m = lo; m <= hi; m++) valley = Math.min(valley, est.psd[m])
      const smaller = Math.min(est.psd[k], est.psd[j])
      return 10 * Math.log10(smaller / Math.max(1e-300, valley)) >= DIP_DB
    })
    if (ok) kept.push(k)
  }
  return kept.length
}

/**
 * The all-pole model the state's order asks for, fitted to the chain's output.
 *
 * `peak` is where the model's response is largest, which is the frequency a
 * reader compares against the line the average shows.
 */
export function arOf(state) {
  const { buf } = renderChain(state.sources, state.blocks, state.fftSize, state.sampleRate)
  const order = Math.max(1, Math.round(state.arOrder ?? 2))
  const m = arYuleWalker(buf, order)
  const freqs = Float64Array.from({ length: 512 }, (_, i) => (i * state.sampleRate) / 2 / 511)
  const mag = arSpectrum(m, freqs, state.sampleRate)
  let bi = 0
  for (let i = 1; i < mag.length; i++) if (mag[i] > mag[bi]) bi = i
  return { ...m, freqs, mag, peak: freqs[bi], buf, order }
}

/** Resolve one quantity path against a state and its rendered spectrum. */
export function resolvePath(path, state, rendered = null) {
  const parts = String(path).split('.')
  const s = rendered ?? runState(state)

  if (parts[0] === 'line') return lineAt(s, Number(parts[1]))
  if (parts[0] === 'db') return 20 * Math.log10(Math.max(1e-300, lineAt(s, Number(parts[1]))))

  if (parts[0] === 'rate') {
    const b = rateBlock(state)
    if (!b) throw new Error(`rate path with no rate block: ${path}`)
    const M = b.type === 'decimate' ? b.params.M : b.params.L
    if (parts[1] === 'nyquist') return state.sampleRate / (2 * M)
    if (parts[1] === 'grid') return state.sampleRate / M
    if (parts[1] === 'alias') {
      const src = state.sources.find((x) => x.enabled)
      return Math.abs(state.sampleRate / M - src.freq)
    }
    throw new Error(`unknown rate path: ${path}`)
  }

  if (parts[0] === 'cost') {
    const b = rateBlock(state)
    if (!b) throw new Error(`cost path with no rate block: ${path}`)
    const c = multirateCost({
      taps: b.params.taps,
      factor: b.type === 'decimate' ? b.params.M : b.params.L,
      sampleRate: state.sampleRate,
    })
    if (parts[1] in c) return c[parts[1]]
    throw new Error(`unknown cost path: ${path}`)
  }

  if (parts[0] === 'guard') {
    const b = rateBlock(state)
    const def = BLOCK_TYPES[b?.type]
    const h = def?.guard ? def.guard(b.params, state.sampleRate) : null
    if (!h) throw new Error(`guard path with no filter: ${path}`)
    return firResponse(h, Number(parts[1]), state.sampleRate)
  }

  if (parts[0] === 'design') {
    const d = designOf(state)
    if (!d) throw new Error(`design path with no design block: ${path}`)
    if (parts[1] === 'taps') return d.taps ?? null
    if (parts[1] === 'order') return d.order ?? null
    if (parts[1] === 'coefficients') return d.coefficients ?? d.taps
    if (parts[1] === 'estimate') return d.estimateTaps ?? d.estimateOrder
    if (parts[1] === 'grew') return d.grew
    if (parts[1] === 'delta') return d.delta
    if (parts[1] === 'met') return d.met
    if (parts[1] === 'groupDelay') return d.taps != null ? (d.taps - 1) / 2 : null
    throw new Error(`unknown design path: ${path}`)
  }

  if (parts[0] === 'spec') {
    const sp = chainSpec(state.blocks, state.sampleRate)
    if (!sp) throw new Error(`spec path with no specification: ${path}`)
    if (parts[1] === 'worst') return sp.margin.worstDb
    if (parts[1] === 'met') return sp.margin.met
    const band = sp.margin.bands.find((x) => x.id === parts[1])
    if (!band) throw new Error(`unknown band: ${path}`)
    if (parts[2] in band) return band[parts[2]]
    throw new Error(`unknown spec path: ${path}`)
  }

  if (parts[0] === 'lms') {
    const r = adaptiveOf(state)
    if (!r) throw new Error(`lms path with no adaptive block: ${path}`)
    const p = r.block.params
    if (parts[1] === 'power') return r.inputPower
    if (parts[1] === 'bound') return lmsStepBound({ taps: p.taps, inputPower: r.inputPower }).meanSquare
    if (parts[1] === 'boundMean') return lmsStepBound({ taps: p.taps, inputPower: r.inputPower }).mean
    if (parts[1] === 'misadjustment') {
      return misadjustment({ mu: p.mu, taps: p.taps, inputPower: r.inputPower })
    }
    if (parts[1] === 'reach') return reachAt(r)
    if (parts[1] === 'converged') return reachAt(r) < r.history.length
    if (parts[1] === 'diverged') return !Number.isFinite(weightError(r.w, r.plant))
    if (parts[1] === 'error') return weightError(r.w, r.plant)
    if (parts[1] === 'settled') return tailPower(r.e, r.tail)
    if (parts[1] === 'floor') return r.floor
    if (parts[1] === 'ratio') return tailPower(r.e, r.tail) / Math.max(1e-300, r.floor)
    if (parts[1] === 'echo') return tailPower(r.d, r.tail)
    if (parts[1] === 'residual') return tailPower(r.e, r.tail)
    if (parts[1] === 'erle') {
      return 10 * Math.log10(tailPower(r.d, r.tail) / Math.max(1e-300, tailPower(r.e, r.tail)))
    }
    if (parts[1] === 'cost') return costPerSample(p.algorithm, p.taps)
    if (parts[1] === 'wiener') {
      // The best fixed filter of the same length, from the same input and the
      // same wanted signal, so the adaptive run has something to be compared to.
      return weightError(wiener(r.x, r.d, p.taps).w, r.plant)
    }
    if (parts[1] === 'rdiag') return autocorr(r.x, p.taps)[0]
    if (parts[1] === 'near') {
      // The near-end talker's own power, which is the floor an echo canceller
      // leaves behind on purpose.
      const a = p.nearAmp ?? 0
      return (a * a) / 2
    }
    throw new Error(`unknown lms path: ${path}`)
  }

  if (parts[0] === 'fix') {
    const f = fixedOf(state)
    if (!f) throw new Error(`fix path with no fixed-point block: ${path}`)
    if (parts[1] === 'delta') return f.qs.coeff.delta
    if (parts[1] === 'stateDelta') return f.qs.state ? f.qs.state.delta : 0
    if (parts[1] === 'radius') return f.q.radius
    if (parts[1] === 'moved') return Math.max(...f.q.moved.filter(Number.isFinite))
    if (parts[1] === 'stable') return f.q.stable
    if (parts[1] === 'top') return (f.qs.state ?? f.qs.coeff).top
    if (parts[1] === 'bottom') return (f.qs.state ?? f.qs.coeff).bottom
    if (parts[1] === 'deadband') return deadBandOf(state).steps
    if (parts[1] === 'deadbandUnits') return deadBandOf(state).amplitude
    if (parts[1] === 'period') return deadBandOf(state).period
    if (parts[1] === 'noiseGain') {
      return roundingNoise(f.q.coeffs, f.qs.state ?? f.qs.coeff).noiseGain
    }
    if (parts[1] === 'rmsIn') return Math.sqrt((f.qs.state ?? f.qs.coeff).noisePower)
    if (parts[1] === 'rmsOut') return roundingNoise(f.q.coeffs, f.qs.state ?? f.qs.coeff).rmsOut
    if (parts[1] === 'over') return headroomOf(state)
    if (parts[1] === 'saturated' || parts[1] === 'wrapped') {
      const q = quantizer({
        bits: f.block.params.stateBits || f.block.params.coeffBits,
        intBits: f.block.params.stateBits ? f.block.params.stateInt : f.block.params.coeffInt,
        rounding: f.block.params.rounding,
        overflow: parts[1] === 'wrapped' ? 'wrap' : 'saturate',
      })
      return q(headroomOf(state))
    }
    if (parts[1] === 'measured') return roundingMeasured(state)
    if (parts[1] === 'modelRatio') {
      const model = roundingNoise(f.q.coeffs, f.qs.state ?? f.qs.coeff).rmsOut
      return roundingMeasured(state) / model
    }
    if (parts[1] === 'gridTotal') return poleBoxes(state).total
    if (parts[1] === 'gridDense') return poleBoxes(state).dense
    if (parts[1] === 'gridSparse') return poleBoxes(state).sparse
    if (parts[1] === 'gridRatio') return poleBoxes(state).ratio
    if (parts[1] === 'gainDb') {
      return 10 * Math.log10(roundingNoise(f.q.coeffs, f.qs.state ?? f.qs.coeff).noiseGain)
    }
    throw new Error(`unknown fix path: ${path}`)
  }

  if (parts[0] === 'psd') {
    const est = psdOf(state)
    if (parts[1] === 'df') return est.df
    if (parts[1] === 'segments') return est.segments
    if (parts[1] === 'n') return est.n
    if (parts[1] === 'used') {
      // How many samples of the record the estimate actually read. Abutting
      // segments read all of them; overlapping ones reach the same segment
      // count from fewer, which is the whole of why Welch overlaps.
      const step = Math.max(1, Math.round(est.n * (1 - (est.overlap ?? 0))))
      return est.n + (est.segments - 1) * step
    }
    if (parts[1] === 'peaks' || parts[1] === 'resolved') {
      const n = linesIn(est, Number(parts[2]), Number(parts[3]))
      return parts[1] === 'peaks' ? n : n >= 2
    }
    // The scatter K segments are predicted to reach, which is one over root K.
    if (parts[1] === 'predicted') return 1 / Math.sqrt(Math.max(1, est.segments))
    if (parts[1] === 'power' || parts[1] === 'true') {
      const { buf } = renderChain(state.sources, state.blocks, state.fftSize, state.sampleRate)
      const p = power(buf)
      // A one-sided density holds all the power below Nyquist, so it is twice
      // the two-sided one: 2 var / fs for a flat spectrum.
      return parts[1] === 'power' ? p : (2 * p) / state.sampleRate
    }
    // The band the scatter is read over excludes DC and the last bin, where the
    // one-sided fold is not two and a mean would mix two scalings.
    const st = bandStats(est, est.df, state.sampleRate / 2 - est.df)
    if (parts[1] === 'mean') return st.mean
    if (parts[1] === 'cv') return st.cv
    throw new Error(`unknown psd path: ${path}`)
  }

  if (parts[0] === 'ar') {
    if (parts[1] === 'aic' || parts[1] === 'mdl') {
      const { buf } = renderChain(state.sources, state.blocks, state.fftSize, state.sampleRate)
      const c = arOrderCriteria(buf, Math.max(2, Math.round(state.arMaxOrder ?? 12)))
      return parts[1] === 'aic' ? c.aicOrder : c.mdlOrder
    }
    const m = arOf(state)
    if (parts[1] === 'sigma2') return m.sigma2
    if (parts[1] === 'peak') return m.peak
    if (/^a[0-9]+$/.test(parts[1])) {
      // levinson returns a[0] = 1 and the model's own coefficients after it, so
      // `ar.a1` is a[1]. The prediction filter is 1 + a1 z^-1 + a2 z^-2.
      const k = Number(parts[1].slice(1))
      if (!(k >= 1 && k < m.a.length)) throw new Error(`no such AR coefficient: ${path}`)
      return m.a[k]
    }
    throw new Error(`unknown ar path: ${path}`)
  }

  if (parts[0] === 'fft') {
    const c = fftCost(state.fftSize)
    if (parts[1] in c) return c[parts[1]]
    throw new Error(`unknown fft path: ${path}`)
  }

  throw new Error(`unknown quantity path: ${path}`)
}

/** The rows the readout prints for an experiment, from its own claims. */
export function readoutRows(experiment, state) {
  const rendered = runState(state)
  return (experiment.claims ?? []).map((c) => ({
    path: c.path,
    label: c.label,
    unit: c.unit ?? '',
    value: resolvePath(c.path, state, rendered),
  }))
}

export { cascadeResponse }
