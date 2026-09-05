import { describe, it, expect } from 'vitest'
import { arOrderCriteria, arYuleWalker, bandStats, levinson, periodogram } from '@ee-labs/dsp'
import { byId } from '../experiments.js'
import { experimentState } from '../state.js'
import { arOf, linesIn, psdOf, resolvePath, runState } from '../measure.js'
import { PROCESS, RECORDS, SEGMENTS, TONE_GAP } from './d.js'

// Group D's numbers, measured on the chain the app runs.
//
// Every expectation is computed from the experiment's own parameters. The true
// density comes from the record's own power, the predicted scatter from the
// segment count, and the fitted model from the coefficients the source block
// was given.

const SR = 48000
const state = (id) => experimentState(byId(id))
const withFrame = (id, fftSize) => ({ ...state(id), fftSize })
const withEst = (id, estimator, segments) => ({ ...state(id), estimator, segments })

describe('D1: the periodogram, and what it does not do', () => {
  it('reads the density the source actually has', () => {
    const s = state('d1')
    const mean = resolvePath('psd.mean', s)
    const truth = resolvePath('psd.true', s)
    // A flat one-sided density holds the record's power over the band below
    // Nyquist, so it is twice the power over the sample rate.
    expect(truth).toBeCloseTo((2 * resolvePath('psd.power', s)) / SR, 15)
    expect(Math.abs(mean / truth - 1)).toBeLessThan(0.02)
  })

  it('integrates to the power of the record it came from', () => {
    const s = state('d1')
    const est = psdOf(s)
    let acc = 0
    for (let k = 0; k < est.psd.length; k++) acc += est.psd[k] * est.df
    // Nine decimals is what the plan asks of this identity, and it holds to
    // fifteen. The first and last bins are folded once rather than twice, so
    // the one-sided sum covers every bin of the two-sided one exactly once.
    expect(acc).toBeCloseTo(resolvePath('psd.power', s), 12)
  })

  it('scatters by about the density itself, at every record length', () => {
    for (const fftSize of RECORDS) {
      const cv = resolvePath('psd.cv', withFrame('d1', fftSize))
      expect(cv, `${fftSize} points`).toBeGreaterThan(0.85)
      expect(cv, `${fftSize} points`).toBeLessThan(1.15)
    }
  })
})

describe('D2: what a longer record buys', () => {
  it('buys resolution in proportion and no steadiness at all', () => {
    const rows = RECORDS.map((fftSize) => ({
      fftSize,
      df: resolvePath('psd.df', withFrame('d2', fftSize)),
      cv: resolvePath('psd.cv', withFrame('d2', fftSize)),
    }))
    for (const r of rows) expect(r.df, `${r.fftSize}`).toBeCloseTo(SR / r.fftSize, 12)
    // Sixteen times the record is a sixteenth of the bin, exactly.
    expect(rows[0].df / rows[2].df).toBeCloseTo(rows[2].fftSize / rows[0].fftSize, 12)
    // And the scatter does not move by more than a tenth over that span.
    expect(Math.abs(rows[0].cv - rows[2].cv)).toBeLessThan(0.1)
  })
})

describe('D3: Bartlett, and the root of K', () => {
  it('cuts the scatter by the root of the segment count', () => {
    for (const K of SEGMENTS) {
      const s = withEst('d3', 'bartlett', K)
      const cv = resolvePath('psd.cv', s)
      const predicted = resolvePath('psd.predicted', s)
      expect(predicted, `K ${K}`).toBeCloseTo(1 / Math.sqrt(K), 12)
      // Within 25 %, which is the plan's invariant 14.
      expect(Math.abs(cv / predicted - 1), `K ${K}`).toBeLessThan(0.25)
    }
  })

  it('widens the bin by the same count, which is what it costs', () => {
    for (const K of SEGMENTS) {
      const s = withEst('d3', 'bartlett', K)
      expect(resolvePath('psd.segments', s), `K ${K}`).toBe(K)
      expect(resolvePath('psd.n', s), `K ${K}`).toBe(s.fftSize / K)
      expect(resolvePath('psd.df', s), `K ${K}`).toBeCloseTo((SR * K) / s.fftSize, 12)
    }
  })
})

describe('D4: Welch, and why the segments overlap', () => {
  it('reaches the same segment count from about half the record', () => {
    const K = state('d4').segments
    const welch = withEst('d4', 'welch', K)
    const bartlett = withEst('d4', 'bartlett', K)
    expect(resolvePath('psd.segments', welch)).toBe(K)
    expect(resolvePath('psd.segments', bartlett)).toBe(K)
    expect(resolvePath('psd.n', welch)).toBe(resolvePath('psd.n', bartlett))
    const ratio = resolvePath('psd.used', bartlett) / resolvePath('psd.used', welch)
    // Half overlap, so K segments span about half as many samples. Exactly
    // 2K/(K+1), which is 1.88 at sixteen segments.
    expect(ratio).toBeCloseTo((2 * K) / (K + 1), 6)
  })

  it('falls a little short of one over the root of K, because the segments overlap', () => {
    const K = state('d4').segments
    const welch = resolvePath('psd.cv', withEst('d4', 'welch', K))
    const bartlett = resolvePath('psd.cv', withEst('d4', 'bartlett', K))
    expect(Math.abs(welch - bartlett)).toBeLessThan(0.05)
    expect(welch).toBeLessThan(1.25 / Math.sqrt(K))
  })
})

describe('D5: what the averaging costs', () => {
  it('resolves two tones while the bin is narrower than the gap between them', () => {
    const s = state('d5')
    const [lo, hi] = s.sources.map((x) => x.freq)
    expect(hi - lo).toBe(TONE_GAP)
    expect(resolvePath('psd.df', s)).toBeLessThan(TONE_GAP)
    expect(resolvePath('psd.peaks.4000.5000', s)).toBe(2)
    expect(resolvePath('psd.resolved.4000.5000', s)).toBe(true)
  })

  it('merges them once the bin is wider than the gap', () => {
    const merged = withEst('d5', 'bartlett', 64)
    expect(resolvePath('psd.df', merged)).toBeGreaterThan(TONE_GAP)
    expect(resolvePath('psd.resolved.4000.5000', merged)).toBe(false)
    // And the count is what the resolver saw, not a threshold applied after.
    expect(resolvePath('psd.peaks.4000.5000', merged)).toBe(linesIn(psdOf(merged), 4000, 5000))
  })

  it('still resolves them at a segment count whose bin is narrower', () => {
    const kept = withEst('d5', 'bartlett', 16)
    expect(resolvePath('psd.df', kept)).toBeLessThan(TONE_GAP)
    expect(resolvePath('psd.resolved.4000.5000', kept)).toBe(true)
  })
})

describe('D6: the model instead of the average', () => {
  it('recovers the two coefficients the source was given', () => {
    const s = state('d6')
    expect(s.blocks[0].params.a1).toBe(PROCESS.a1)
    expect(resolvePath('ar.a1', s)).toBeCloseTo(PROCESS.a1, 2)
    expect(resolvePath('ar.a2', s)).toBeCloseTo(PROCESS.a2, 2)
    // The fit is the engine's own, not a second implementation of it.
    const m = arYuleWalker(runState(s).buf, 2)
    expect(resolvePath('ar.a1', s)).toBeCloseTo(m.a[1], 12)
  })

  it('gets closer as the record grows', () => {
    const err = RECORDS.map((fftSize) =>
      Math.abs(resolvePath('ar.a2', withFrame('d6', fftSize)) - PROCESS.a2),
    )
    expect(err[2]).toBeLessThan(err[0])
    // Even a sixteenth of the record is within a couple of per cent.
    expect(err[0] / Math.abs(PROCESS.a2)).toBeLessThan(0.03)
  })

  it('puts the peak where the source block puts its poles', () => {
    const s = state('d6')
    const { a1, a2 } = s.blocks[0].params
    const r = Math.sqrt(a2)
    const theta = Math.acos(-a1 / (2 * r))
    const expected = (theta / (2 * Math.PI)) * SR
    // The model's peak is one bin of the 512-point response grid from where the
    // process's own poles sit.
    expect(Math.abs(resolvePath('ar.peak', s) - expected)).toBeLessThan(SR / 2 / 511)
  })

  it('returns a stable model at every order, by construction', () => {
    const buf = runState(state('d6')).buf
    for (const order of [1, 2, 4, 8, 12]) {
      const m = arYuleWalker(buf, order)
      for (const k of m.reflection) expect(Math.abs(k), `order ${order}`).toBeLessThan(1)
    }
  })
})

describe('D7: choosing the order', () => {
  it('lowers the error at every order added', () => {
    const buf = runState(state('d7')).buf
    const c = arOrderCriteria(buf, state('d7').arMaxOrder)
    for (let i = 1; i < c.rows.length; i++) {
      expect(c.rows[i].sigma2, `order ${c.rows[i].order}`).toBeLessThanOrEqual(c.rows[i - 1].sigma2)
    }
  })

  it('charges more a pole under the description length, so it picks lower', () => {
    const s = state('d7')
    const aic = resolvePath('ar.aic', s)
    const mdl = resolvePath('ar.mdl', s)
    const N = runState(s).buf.length
    // ln N is 8.3 at 4096 samples, so p ln N / N charges four times 2p / N.
    expect(Math.log(N) / 2).toBeGreaterThan(2)
    expect(mdl).toBeLessThanOrEqual(aic)
    // And it lands on the order the process actually has.
    expect(mdl).toBe(2)
  })

  it('reads the error the state asks for at its own order', () => {
    for (const order of [2, 6, 12]) {
      const s = { ...state('d7'), arOrder: order }
      expect(resolvePath('ar.sigma2', s)).toBeCloseTo(arOf(s).sigma2, 15)
    }
    const two = resolvePath('ar.sigma2', { ...state('d7'), arOrder: 2 })
    const six = resolvePath('ar.sigma2', { ...state('d7'), arOrder: 6 })
    expect(six).toBeLessThanOrEqual(two)
  })
})
