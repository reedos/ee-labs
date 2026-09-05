import { describe, it, expect } from 'vitest'
import {
  WINDOW_SPECS,
  convolveFir,
  decimate,
  designDecimationFir,
  designFir,
  designInterpolationFir,
  downsample,
  expandTaps,
  firResponse,
  interpolate,
  hash01,
  multirateCost,
  polyphaseDecimate,
  polyphaseInterpolate,
  remezOrder,
  stopbandDepth,
  upsample,
  windowTaps,
  windowTransition,
} from '@ee-labs/dsp'
import { EXPERIMENTS, GROUPS, ORPHAN_LESSONS, byId } from './experiments.js'
import { experimentState } from './state.js'
import { firDesign, iirDesign, cascadeResponse, BLOCK_TYPES } from './blocks.js'
import { holdDroop, lineAt, resolvePath, runState } from './measure.js'
import { SPEC } from './groups/b.js'

// Every number the lessons quote, measured on the chain the app runs.
//
// The rule the whole suite works on: a number is never typed in as a constant
// when it can be computed from the knobs. So each expectation below is derived
// from the experiment's own parameters, and moving a default moves the
// expectation with it rather than breaking a test that then gets edited to
// match.

const SR = 48000
const state = (id) => experimentState(byId(id))
const rendered = (id) => runState(state(id))
const db = (x) => 20 * Math.log10(x)

describe('the course, as a course', () => {
  it('is thirty-five experiments in five groups, in plan order', () => {
    expect(EXPERIMENTS).toHaveLength(35)
    expect(EXPERIMENTS.filter((e) => e.group === GROUPS[0])).toHaveLength(7)
    expect(EXPERIMENTS.filter((e) => e.group === GROUPS[1])).toHaveLength(8)
    expect(EXPERIMENTS.filter((e) => e.group === GROUPS[2])).toHaveLength(7)
    expect(EXPERIMENTS.filter((e) => e.group === GROUPS[3])).toHaveLength(7)
    expect(EXPERIMENTS.filter((e) => e.group === GROUPS[4])).toHaveLength(6)
    expect(EXPERIMENTS.map((e) => e.id)).toEqual([
      'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7',
      'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8',
      'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7',
      'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7',
      'e1', 'e2', 'e3', 'e4', 'e5', 'e6',
    ])
  })

  it('every experiment carries all three registers and its terms', () => {
    for (const e of EXPERIMENTS) {
      expect(e.see, e.id).toBeTruthy()
      expect(e.try, e.id).toBeTruthy()
      expect(e.why, e.id).toBeTruthy()
      expect(e.terms.length, e.id).toBeGreaterThan(0)
      expect(e.claims.length, e.id).toBeGreaterThan(0)
    }
    expect(ORPHAN_LESSONS).toEqual([])
  })

  it('every claim resolves against the engine', () => {
    for (const e of EXPERIMENTS) {
      const s = experimentState(e)
      const r = runState(s)
      for (const c of e.claims) {
        const v = resolvePath(c.path, s, r)
        expect(Number.isFinite(v) || typeof v === 'boolean', `${e.id} ${c.path}`).toBe(true)
      }
    }
  })

  it('every chip lands on a parameter the block actually has', () => {
    for (const e of EXPERIMENTS) {
      for (const chip of e.chips ?? []) {
        for (const [key, list] of Object.entries(chip.patch)) {
          if (key !== 'blocks') continue
          list.forEach((part, i) => {
            const block = e.patch.blocks[i]
            const def = BLOCK_TYPES[block.type]
            for (const k of Object.keys(part.params ?? {})) {
              expect(def.params.some((p) => p.key === k), `${e.id} ${chip.label} ${k}`).toBe(true)
            }
          })
        }
      }
    }
  })
})

describe('A1: decimation, and the fold it causes', () => {
  const s = state('a1')
  const M = s.blocks[0].params.M
  const tone = s.sources[0].freq

  it('the new Nyquist and the fold come from M and the rate', () => {
    expect(resolvePath('rate.nyquist', s)).toBe(SR / (2 * M))
    expect(resolvePath('rate.nyquist', s)).toBe(6000)
    expect(resolvePath('rate.alias', s)).toBe(Math.abs(SR / M - tone))
    expect(resolvePath('rate.alias', s)).toBe(3000)
  })

  it('the alias arrives at the amplitude the hold droop predicts', () => {
    const r = rendered('a1')
    const measured = lineAt(r, SR / M - tone)
    const predicted = holdDroop(SR / M - tone, M, SR)
    // Within a per cent of the sinc the hold applies, which is what accounts
    // for the reading being 0.906 rather than 1.
    expect(measured / predicted).toBeGreaterThan(0.99)
    expect(measured / predicted).toBeLessThan(1.01)
    expect(measured).toBeCloseTo(0.9061, 3)
  })

  it('a tone below the new Nyquist survives, at its own droop', () => {
    const s2 = { ...s, sources: [{ ...s.sources[0], freq: 1500 }] }
    const measured = lineAt(runState(s2), 1500)
    expect(measured / holdDroop(1500, M, SR)).toBeGreaterThan(0.99)
    expect(measured / holdDroop(1500, M, SR)).toBeLessThan(1.01)
  })
})

describe('A2: the filter that has to come first', () => {
  const s = state('a2')
  const p = s.blocks[0].params
  const tone = s.sources[0].freq

  it('the filter is placed inside the new Nyquist, with room to fall', () => {
    const h = BLOCK_TYPES.decimate.guard(p, SR)
    expect(h.length).toBe(p.taps)
    // The cutoff is 0.8 of the new Nyquist, which is where designDecimationFir
    // puts it, so the half-amplitude point is there.
    const fc = (0.8 * SR) / (2 * p.M)
    expect(fc).toBe(4800)
    expect(db(firResponse(h, fc, SR))).toBeGreaterThan(-8)
    expect(db(firResponse(h, fc, SR))).toBeLessThan(-4)
  })

  it('and it removes the interferer before the decimator can fold it', () => {
    const h = BLOCK_TYPES.decimate.guard(p, SR)
    const atTone = db(firResponse(h, tone, SR))
    expect(atTone).toBeLessThan(-100)

    const withFilter = lineAt(rendered('a2'), SR / p.M - tone)
    const without = lineAt(runState({ ...s, blocks: [{ ...s.blocks[0], params: { ...p, antialias: false } }] }), SR / p.M - tone)
    expect(db(without / withFilter)).toBeGreaterThan(100)
    // The suppression is the filter's own attenuation, to within a decibel.
    expect(db(without / withFilter)).toBeGreaterThan(-atTone - 10)
  })
})

describe('A3: interpolation, and the images it leaves', () => {
  const s = state('a3')
  const L = s.blocks[0].params.L
  const tone = s.sources[0].freq

  it('the coarse grid runs at fs over L', () => {
    expect(resolvePath('rate.grid', s)).toBe(SR / L)
    expect(resolvePath('rate.grid', s)).toBe(12000)
  })

  it('every image reads exactly one Lth of the amplitude that went in', () => {
    const r = rendered('a3')
    const amp = s.sources[0].amp
    for (const f of [tone, SR / L - tone, SR / L + tone, (2 * SR) / L - tone]) {
      expect(lineAt(r, f), `${f} Hz`).toBeCloseTo(amp / L, 3)
    }
    expect(lineAt(r, tone)).toBeCloseTo(0.25, 3)
  })
})

describe('A4: the interpolation filter, and the gain of L', () => {
  const s = state('a4')
  const p = s.blocks[0].params
  const tone = s.sources[0].freq

  it('the filter carries a passband gain of exactly L', () => {
    const h = BLOCK_TYPES.interpolate.guard(p, SR)
    expect(firResponse(h, 0, SR)).toBeCloseTo(p.L, 6)
    // Without the gain the same design has unit gain, which is the one step a
    // reader forgets.
    const plain = designFir(
      { mode: 'lowpass', taps: p.taps, window: p.window, freq: (0.8 * SR) / (2 * p.L) },
      SR,
    )
    expect(firResponse(plain, 0, SR)).toBeCloseTo(1, 6)
  })

  it('so the wanted line comes back to the amplitude that went in', () => {
    expect(lineAt(rendered('a4'), tone)).toBeCloseTo(s.sources[0].amp, 2)
  })

  it('and the images are gone', () => {
    const zeros = runState({ ...s, blocks: [{ ...s.blocks[0], params: { ...p, fill: 'zeros' } }] })
    const filtered = rendered('a4')
    const image = SR / p.L - tone
    expect(db(lineAt(zeros, image) / lineAt(filtered, image))).toBeGreaterThan(80)
  })
})

describe('A5 and A6: the polyphase forms', () => {
  it('cost exactly M times less, which is what the readout says', () => {
    const s = state('a5')
    const p = s.blocks[0].params
    const c = multirateCost({ taps: p.taps, factor: p.M, sampleRate: SR })
    expect(resolvePath('cost.direct', s)).toBe(p.taps * SR)
    expect(resolvePath('cost.polyphase', s)).toBe((p.taps * SR) / p.M)
    expect(resolvePath('cost.ratio', s)).toBe(p.M)
    expect(c.direct).toBeCloseTo(5.808e6, -2)
  })

  it('and produce the same output as the direct route', () => {
    const p = state('a5').blocks[0].params
    const h = designDecimationFir({ M: p.M, taps: p.taps, window: p.window }, SR)
    const x = Float64Array.from({ length: 4096 }, (_, i) => 2 * hash01(i, 3) - 1)
    const a = decimate(x, p.M, h)
    const b = polyphaseDecimate(x, p.M, h)
    let worst = 0
    let scale = 0
    for (let i = 0; i < a.length; i++) {
      worst = Math.max(worst, Math.abs(a[i] - b[i]))
      scale = Math.max(scale, Math.abs(a[i]))
    }
    expect(worst / scale).toBeLessThan(1e-12)
  })

  it('the interpolator likewise, at its own factor', () => {
    const p = state('a6').blocks[0].params
    const h = designInterpolationFir({ L: p.L, taps: p.taps, window: p.window }, SR)
    const x = Float64Array.from({ length: 1024 }, (_, i) => 2 * hash01(i, 5) - 1)
    const a = interpolate(x, p.L, h)
    const b = polyphaseInterpolate(x, p.L, h)
    for (let i = 0; i < b.length; i++) expect(b[i], `i=${i}`).toBeCloseTo(a[i], 12)
    expect(resolvePath('cost.ratio', state('a6'))).toBe(p.L)
  })
})

describe('A7: the noble identities, exactly', () => {
  const s = state('a7')
  const p = s.blocks[0].params

  it('downsampling commutes with the expanded filter, bit for bit', () => {
    const h = designFir({ mode: 'lowpass', taps: p.taps, window: p.window, freq: (0.8 * SR) / (2 * p.M) }, SR)
    const x = Float64Array.from({ length: 2048 }, (_, i) => 2 * hash01(i, 9) - 1)
    const a = convolveFir(downsample(x, p.M), h)
    const b = downsample(convolveFir(x, expandTaps(h, p.M)), p.M)
    for (let i = 0; i < a.length; i++) expect(a[i], `i=${i}`).toBe(b[i])
  })

  it('and upsampling does too', () => {
    const h = designFir({ mode: 'lowpass', taps: p.taps, window: p.window, freq: 4000 }, SR)
    const x = Float64Array.from({ length: 512 }, (_, i) => 2 * hash01(i, 11) - 1)
    const a = upsample(convolveFir(x, h), p.M)
    const b = convolveFir(upsample(x, p.M), expandTaps(h, p.M))
    for (let i = 0; i < a.length; i++) expect(a[i], `i=${i}`).toBe(b[i])
  })

  it('the expanded filter is the same taps with M-1 zeros between them', () => {
    const h = designFir({ mode: 'lowpass', taps: p.taps, window: p.window, freq: 4000 }, SR)
    const g = expandTaps(h, p.M)
    expect(g.length).toBe((h.length - 1) * p.M + 1)
    for (let k = 0; k < h.length; k++) expect(g[k * p.M]).toBe(h[k])
  })
})

describe('B1: the specification, as a mask', () => {
  const s = state('b1')

  it('the two bands are the four numbers the block states', () => {
    const p = s.blocks[0].params
    const bands = firDesign(p, SR).spec
    expect(bands).toHaveLength(2)
    expect(bands[0]).toMatchObject({ id: 'pass', from: 0, to: p.fpass, min: -p.ripplePassDb })
    expect(bands[1]).toMatchObject({ id: 'stop', from: p.fstop, to: SR / 2, max: -p.stopDb })
  })

  it('and both margins are positive, so the design meets it', () => {
    expect(resolvePath('spec.pass.marginDb', s)).toBeGreaterThanOrEqual(0)
    expect(resolvePath('spec.stop.marginDb', s)).toBeGreaterThanOrEqual(0)
    expect(resolvePath('design.met', s)).toBe(true)
  })

  it('a deeper specification costs taps, and the design says how many', () => {
    const p = s.blocks[0].params
    const shallow = firDesign({ ...p, stopDb: 40 }, SR)
    const deep = firDesign({ ...p, stopDb: 80 }, SR)
    expect(deep.taps).toBeGreaterThan(shallow.taps)
    expect(shallow.met && deep.met).toBe(true)
  })
})

describe('B2 and B3: what a window sets, and what it does not', () => {
  it('the four transition constants predict the four widths', () => {
    for (const w of ['none', 'hann', 'hamming', 'blackman']) {
      const est = windowTransition(w, 81, SR)
      expect(est).toBeCloseTo((WINDOW_SPECS[w].transition * SR) / 81, 6)
    }
    // The numbers the lesson quotes, from the same formula.
    expect(Math.round(windowTransition('none', 81, SR))).toBe(533)
    expect(Math.round(windowTransition('hann', 81, SR))).toBe(1837)
    expect(Math.round(windowTransition('hamming', 81, SR))).toBe(1956)
    expect(Math.round(windowTransition('blackman', 81, SR))).toBe(3259)
  })

  it('the transition falls as 1/N and the stopband depth does not follow it', () => {
    const depths = []
    const widths = []
    for (const N of [41, 81, 161, 201]) {
      const h = designFir({ mode: 'lowpass', taps: N, freq: 6000, window: 'hamming' }, SR)
      const est = windowTransition('hamming', N, SR)
      widths.push(est)
      depths.push(stopbandDepth(h, 6000 + est / 2, SR))
    }
    // Five times the taps, a fifth of the width.
    expect(widths[0] / widths[3]).toBeCloseTo(201 / 41, 6)
    // ...and under three decibels of depth for it.
    expect(depths[3] - depths[0]).toBeLessThan(3)
    expect(depths[3] - depths[0]).toBeGreaterThan(0)
    expect(depths[0]).toBeCloseTo(48.7, 0)
    expect(depths[3]).toBeCloseTo(51.6, 0)
  })

  it('B2 meets its own specification, and B3 meets its own', () => {
    for (const id of ['b2', 'b3']) {
      expect(resolvePath('design.met', state(id)), id).toBe(true)
    }
  })
})

describe('B4: a window that cannot reach the depth', () => {
  const s = state('b4')

  it('reports the miss rather than returning a filter that misses quietly', () => {
    const d = firDesign(s.blocks[0].params, SR)
    expect(d.met).toBe(false)
    expect(d.reachable).toBe(false)
    expect(d.reason).toMatch(/Hamming/)
    expect(d.reason).toMatch(new RegExp(`${s.blocks[0].params.stopDb} dB`))
    expect(resolvePath('spec.stop.marginDb', s)).toBeLessThan(0)
  })

  it('and the window with the depth to spare meets it', () => {
    const p = { ...s.blocks[0].params, window: 'blackman' }
    const d = firDesign(p, SR)
    expect(d.met).toBe(true)
    expect(d.taps).toBe(windowTaps('blackman', p.fstop - p.fpass, SR))
    expect(d.taps).toBe(133)
  })
})

describe('B5 and B6: Parks-McClellan, and the estimate it starts from', () => {
  const s = state('b5')

  it('every stopband lobe reaches the same height', () => {
    const d = firDesign(s.blocks[0].params, SR)
    expect(d.converged).toBe(true)
    const peaks = []
    let prev = 0
    let cur = 0
    for (let i = 0; i <= 4000; i++) {
      const f = SPEC.fstop + ((SR / 2 - SPEC.fstop) * i) / 4000
      const m = firResponse(d.h, f, SR)
      if (i > 1 && cur > prev && cur > m) peaks.push(cur)
      prev = cur
      cur = m
    }
    expect(peaks.length).toBeGreaterThan(8)
    // Equal to within a fifth of a decibel across every lobe. The residual is
    // the exchange's own grid, which samples each lobe at twenty points a basis
    // function rather than continuously.
    expect(db(Math.max(...peaks) / Math.min(...peaks))).toBeLessThan(0.2)
  })

  it('and reaches the specification in fewer taps than any window', () => {
    const pm = firDesign(s.blocks[0].params, SR)
    const win = firDesign({ ...s.blocks[0].params, method: 'window', window: 'blackman' }, SR)
    expect(pm.taps).toBeLessThan(win.taps)
    expect(pm.taps).toBe(53)
    expect(win.taps).toBe(133)
  })

  it('the estimate is where the search started, and the difference is printed', () => {
    const s6 = state('b6')
    const d = firDesign(s6.blocks[0].params, SR)
    expect(d.estimateTaps).toBe(remezOrder(SPEC, SR).taps)
    expect(d.taps).toBe(d.estimateTaps + 2 * d.grew)
    expect(resolvePath('design.estimate', s6)).toBe(51)
    expect(resolvePath('design.taps', s6)).toBe(53)
  })

  it('narrowing the transition is the expensive change', () => {
    const p = state('b6').blocks[0].params
    const wide = firDesign({ ...p, fstop: 9000 }, SR)
    const narrow = firDesign({ ...p, fstop: 5000 }, SR)
    // Taps go as one over the width, so halving the transition roughly doubles
    // the filter and this ratio tracks the width ratio.
    const widthRatio = (9000 - p.fpass) / (5000 - p.fpass)
    expect(narrow.taps / wide.taps).toBeGreaterThan(widthRatio * 0.7)
    expect(narrow.taps / wide.taps).toBeLessThan(widthRatio * 1.3)
  })
})

describe('B7 and B8: the bilinear transform, and the four costs', () => {
  it('the prewarped prototype gives the digital response exactly', () => {
    // The identity itself, on the design the block actually built.
    const btw = iirDesign(
      { fpass: 4000, fstop: 6000, ripplePassDb: 1, stopDb: 60, prototype: 'butterworth' },
      SR,
    )
    const at = (f) => db(cascadeResponse(btw.sections, f, SR))
    const ratio = (f) => Math.tan((Math.PI * f) / SR) / Math.tan((Math.PI * btw.fc) / SR)
    for (const f of [1000, 3000, btw.fc, 8000, 12000]) {
      const want = -10 * Math.log10(1 + Math.pow(ratio(f), 2 * btw.order))
      expect(at(f), `${f} Hz`).toBeCloseTo(want, 5)
    }
    expect(at(btw.fc)).toBeCloseTo(-3.0103, 3)
  })

  it('a Chebyshev meets the same mask at half the order', () => {
    const btw = iirDesign({ ...SPEC, prototype: 'butterworth' }, SR)
    const cby = iirDesign({ ...SPEC, prototype: 'chebyshev1' }, SR)
    expect(btw.met && cby.met).toBe(true)
    expect(cby.order).toBeLessThan(btw.order)
    expect(btw.order).toBe(18)
    expect(cby.order).toBe(9)
    expect(btw.coefficients).toBe(45)
    expect(cby.coefficients).toBe(25)
  })

  it('and the Chebyshev spends its ripple where it said it would', () => {
    const cby = iirDesign({ ...SPEC, prototype: 'chebyshev1' }, SR)
    const band = cby.margin.bands.find((b) => b.id === 'pass')
    expect(band.maxDb).toBeCloseTo(0, 3)
    expect(band.minDb).toBeCloseTo(-SPEC.ripplePassDb, 2)
  })

  it('the four routes, one mask, four counts', () => {
    const win = firDesign({ ...SPEC, method: 'window', window: 'blackman' }, SR)
    const pm = firDesign({ ...SPEC, method: 'remez' }, SR)
    const btw = iirDesign({ ...SPEC, prototype: 'butterworth' }, SR)
    const cby = iirDesign({ ...SPEC, prototype: 'chebyshev1' }, SR)
    for (const d of [win, pm, btw, cby]) expect(d.met).toBe(true)
    expect([win.taps, pm.taps, btw.coefficients, cby.coefficients]).toEqual([133, 53, 45, 25])
    // The FIR pays its delay in samples and gives exactly linear phase back.
    expect((pm.taps - 1) / 2).toBe(26)
    expect(win.taps / cby.coefficients).toBeCloseTo(5.32, 2)
  })
})

describe('the honest boundaries the lab is built on', () => {
  it('a rate changer offers no transfer function, and says why', () => {
    for (const type of ['decimate', 'interpolate']) {
      const def = BLOCK_TYPES[type]
      expect(def.response(def.defaults, 1000, SR), type).toBe(null)
      expect(def.reason, type).toMatch(/shift-invariant/)
    }
  })

  it('a design block does offer one, because it is a filter', () => {
    for (const type of ['firspec', 'iirspec']) {
      const def = BLOCK_TYPES[type]
      expect(def.response(def.defaults, 1000, SR), type).toBeGreaterThan(0)
      expect(def.reason, type).toBeUndefined()
    }
  })

  it('the chain reports a rate changer as inexact rather than drawing nothing', () => {
    const s = state('a1')
    const freqs = Float64Array.from([1000, 5000, 9000])
    const r = BLOCK_TYPES.decimate.response(s.blocks[0].params, 1000, SR)
    expect(r).toBe(null)
    expect(freqs.length).toBe(3)
  })
})
