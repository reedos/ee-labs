# Communications Lab: build brief

You are one of up to seven agents building this lab in parallel. The plan is
`/COMMUNICATIONS_LAB_PLAN.md`, and this brief turns it into lanes an agent can
take without colliding with another. Read the plan's §2 (the engine), §2.11 (the
invariants) and §5 (the curriculum) for your lane before writing a line. Reed
reviews everything.

## Boundaries: read first

- **One lane per agent.** Work in the overseer's worktree on `lab/comms-lab`,
  and never in the shared checkout.
- **Edit only the files your lane owns** (§1). Everything else is read-only. If
  you need a change outside your lane, write it into `apps/comms-lab/NEEDS.md`
  under your lane's heading and carry on with what you can do. The owning lane
  picks it up.
- **Stage by path.** Use `git add packages/comms/src/mappers.js`, never
  `git add -A` and never `commit -a`. Workers do not commit. Hand the result to
  the overseer.
- **Never push.** The director merges this branch.
- **Never edit** `packages/dsp`, `packages/random`, `packages/ui`, `site/`,
  `README.md`, `LabNav.jsx`, `deploy.yml`, or any other app. Those are shared
  surfaces with named owners in `PROGRAM.md` §5.

## The house discipline

Read `/CORE_SCOPE.md`, `/STYLE.md` and `/REVIEW_PLAYBOOK.md` first. Then the
rule every lab obeys. **Every explanatory sentence is a claim about physics, and
a test must measure it.** A lesson quotes no number the engine does not produce.
A prediction follows every control that can change it. On-screen text passes
`npm run lint:prose`.

This lab adds one rule of its own, from the plan's §2.8. **A closed form is a
line and a count is a marker.** The two are never drawn as one series and never
printed in one readout. Where a lesson compares them, it holds both, and the
distance between them is the confidence interval. That interval is the guard
`CORE_SCOPE` Rule 3 requires on the count. The closed form carries no hedge,
because it is exact.

Commit messages are narrative. Read `git log` for the register. Never put a
model name in a commit or in a file.

## 1. The lanes

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | The engine | `packages/comms/**` | first | the twelve invariants of plan §2.11 fuzzed green |
| 2 | The app shell and the two new canvases | everything in `apps/comms-lab/` not owned by lanes 3 to 7, plus `RELEASE_STATUS`, `release.test.js` | after lane 1's contracts | a stub experiment renders at 390 px, the release test passes dark |
| 3 | Groups A and B, analog modulation and the constellation | `src/groups/{a,b}.js`, `src/lessons/{a,b}.js` | after lane 2's skeleton | A1 to B8 pinned, 15 experiments |
| 4 | Group C, the pulse and the eye | `src/groups/c.js`, `src/lessons/c.js` | after lane 2's skeleton | C1 to C6 pinned, 6 experiments |
| 5 | Group D, the channel and the bit error rate | `src/groups/d.js`, `src/lessons/d.js`, `components/BerCanvas.jsx` | after lane 2's skeleton | D1 to D8 pinned, 8 experiments |
| 6 | Groups E and F, the loops and OFDM | `src/groups/{e,f}.js`, `src/lessons/{e,f}.js` | after lane 2's skeleton | E1 to F6 pinned, 11 experiments |
| 7 | Groups G and H, multipath and the budget | `src/groups/{g,h}.js`, `src/lessons/{g,h}.js` | after lane 2's skeleton | G1 to H4 pinned, 10 experiments |

**The gate.** Lanes 3 to 7 need lane 2's skeleton and lane 1's contracts. No
lane past 2 starts until lane 2's first commit lands the app skeleton, the
`RELEASE_STATUS` file, the release test, and the constellation and eye canvases
with the Mixed-Signal props of §3.10. Lane 1's contracts are frozen below. A
lane may add to a return shape and may never rename or remove a field.

**Shared seams, landed first.** Lane 2's first commit adds `src/experiments.js`
and `src/lessons.js` as merge points that import `groups/*.js` and
`lessons/*.js` in plan order. Each group lane then adds only its own file. Two
lanes never edit one file.

## 2. The app skeleton (lane 2)

Copy Random Signals Lab's shape for the analysis and the tests, and Circuit
Elements Lab's shape for the release test. Delete what is not needed.

```
apps/comms-lab/
  index.html  package.json  vite.config.js  RELEASE_STATUS (dark)
  AGENT_BRIEF.md  NEEDS.md
  src/App.jsx  main.jsx  styles.css
  src/experiments.js      merges groups/*.js in plan order, no prose
  src/lessons.js          merges lessons/*.js
  src/groups/{a..h}.js    one file per group, owned by that group's lane
  src/lessons/{a..h}.js   the see / try / why registers, same owner
  src/analysis.js         one analysis, read by the app and by the tests
  src/terms.js            definitions on contact, one registry
  src/report.js           the issue link's summary
  src/release.test.js  experiments.test.js  prose.test.js  terms.test.js
  src/components/         ConstellationCanvas, EyeCanvas, BerCanvas,
                          ScopeCanvas, SpectrumCanvas, panes.jsx, views.jsx
```

`release.test.js` is Circuit Elements Lab's file with `circuit-elements-lab`
replaced by `comms-lab` throughout. Copy it, do not rewrite it. Preview port
4307. Ports 4300 to 4306 belong to the other labs.

## 3. Contracts

Every signature below is a promise between lanes. Each ships with the failing
test named beside it.

### 3.1 The complex chain (lane 1)

Plan Decision 5 asks the DSP Lab overseer for `createComplexChain(registry)` in
`packages/dsp`. That function does not exist today, so this lab builds it in
`packages/comms/src/chain.js` and `NEEDS.md` §4 carries the contract outward.
The signature is `createChain`'s, over an interleaved buffer.

```js
/**
 * The chain over complex samples. A mirror of createChain in @ee-labs/dsp,
 * over an interleaved Float64Array of length 2n: [re0, im0, re1, im1, ...].
 * `make(params, sampleRate)` returns `{ process, settle }`, and `process`
 * takes and returns `[re, im]` rather than one number.
 */
export function createComplexChain(BLOCK_TYPES)
// -> { applyChain, runChain, chainSettle }
// applyChain(blocks, buf, sampleRate, t0) -> Float64Array of the same length
// runChain(sources, blocks, n, sampleRate, opts) -> { out, stages }
```

Test: `packages/comms/src/chain.test.js`. A chain of no blocks returns a copy
and not the input. Two blocks compose in order. A block that rotates by a phase
composes with its inverse to the identity, to floating point.

### 3.2 Mappers and the Gray label (lane 1, `mappers.js`)

```js
/** The six shipped constellations, each with unit mean square. */
export const CONSTELLATIONS = ['bpsk', 'qpsk', 'psk8', 'qam16', 'qam64', 'pam4']

/**
 * One constellation as a table.
 * @returns {{ name, bits, points: Float64Array, labels: Int32Array,
 *             minDistance: number, meanSquare: number, papr: number }}
 * `points` is interleaved [re, im] of length 2M. `labels[i]` is the Gray label
 * of point i. `meanSquare` is 1 to floating point.
 */
export function constellation(name)

/** Bits to interleaved complex symbols. `bits` is a Uint8Array of 0 and 1. */
export function mapBits(name, bits)      // -> Float64Array(2 * bits.length / k)

/** Interleaved complex symbols back to bits, by minimum distance. */
export function demapSymbols(name, syms) // -> Uint8Array

/** The natural-binary label set, for B3's comparison against Gray. */
export function naturalLabels(name)      // -> Int32Array
```

Test: `packages/comms/src/mappers.test.js`. Invariants 1 to 3 of plan §2.11.
Round trip to exact equality. Every nearest-neighbour pair one bit apart.
Mean square 1 to 1e-12.

### 3.3 Pulse shapers (lane 1, `shape.js`)

```js
/** The raised cosine at `t` symbol periods. `beta` in [0, 1]. */
export function raisedCosine(t, beta)

/** The root raised cosine at `t` symbol periods. */
export function rootRaisedCosine(t, beta)

/**
 * A shaping kernel for makeFir in @ee-labs/dsp, normalised to unit energy.
 * @param {'rc'|'rrc'|'rect'} kind
 * @param {number} beta  roll-off
 * @param {number} span  symbols, so the kernel is span * sps + 1 taps
 * @param {number} sps   samples per symbol
 */
export function shapeTaps({ kind, beta, span, sps })  // -> Float64Array

/**
 * What the truncated pair leaves behind, measured three ways.
 * `near` is the largest residual from the two nearest neighbours on each side,
 * which is the ISI a two-period eye shows. `peak` is the largest over every
 * non-zero symbol lag, including the truncation edge at half the span. `sum`
 * is the peak distortion, the total of every residual.
 */
export function residualIsi(h, sps)   // -> { near, peak, sum, taps: Float64Array }

/** Baseband bandwidth of the shaped signal, (1 + beta) * symbolRate / 2. */
export function shapedBandwidth(beta, symbolRate)
```

Test: `packages/comms/src/shape.test.js`. Invariants 4 and 5. The raised cosine
is 1 at lag 0 and below 1e-15 at every other symbol instant, at
`beta = 0, 0.35, 1`. The `near` residual reads 4.76e-2 at a span of 4 and
2.83e-5 at a span of 16.

### 3.4 Channels (lane 1, `channel.js`)

```js
/** AWGN at a stated Eb/N0, from the seeded generator in @ee-labs/random. */
export function awgn(syms, { ebN0Db, bitsPerSymbol, sps = 1, seed = 1 })
// -> { out: Float64Array, sigma: number, n0: number }

/** A tapped delay line. Real or complex taps, exactly rational in z. */
export function multipath(syms, taps)      // -> Float64Array

/** The two-ray channel of plan §4.3, as taps at one sample each. */
export function twoRay(a = 0.5, delay = 4) // -> Float64Array

/** |H(f)| of a tap set, its notch depth and the spacing between notches. */
export function channelResponse(taps, sampleRate, freqs)
// -> { mag: Float64Array, peakDb, notchDb, notchSpacing, firstNotch }

/**
 * Flat Rayleigh fading. A labelled statistical model, not an exact object.
 * `assumptions` is the three-line label the pane must print (CORE_SCOPE Rule 3).
 */
export function rayleighGains(n, { seed = 1, kFactor = 0 })
// -> { gains: Float64Array, meanSquare, assumptions: string[] }

/** The average BER of BPSK under flat Rayleigh fading, closed form. */
export function rayleighBer(ebN0Db)
```

Test: `packages/comms/src/channel.test.js`. Invariant 9. The two-ray peak is
3.5218 dB and its notch is −6.0206 dB. `rayleighBer(10)` is 2.3269e-2.

### 3.5 The matched filter and the detectors (lane 1, `detect.js`)

```js
/** Correlate against the transmit pulse and sample once per symbol. */
export function matchedSample(rx, h, sps, offset = 0)  // -> Float64Array

/** The measured output ratio of a filter matched to a pulse, against 2E/N0. */
export function matchedFilterSnr({ pulse, n0, trials, seed })
// -> { mean, variance, measured, twoEOverN0, energy }

/** Minimum distance over the constellation table. Exact arithmetic. */
export function decide(name, syms)      // -> Int32Array of point indices

/** The per-bit log-likelihood ratio the Information Lab reads. */
export function softMetric(name, syms, sigma2)   // -> Float64Array

/** Noncoherent FSK, two matched filters and a magnitude comparison. */
export function fskNoncoherent({ ebN0Db, symbols, seed, spacing, symbolRate })
```

Test: `packages/comms/src/detect.test.js`. Invariant 6. The measured ratio is
within its own interval of `2E/N0` for three pulse shapes.

### 3.6 The bit error rate (lane 1, `ber.js`)

The closed forms are bare numbers. The count is an estimate with an interval,
from `proportion` in `@ee-labs/random`, which returns the Wilson interval.

```js
/** Every closed form, as a function of Eb/N0 in linear units. */
export function berClosed(scheme, gammaB)
// scheme: 'bpsk' | 'qpsk' | 'fskCoherent' | 'fskNoncoherent' | 'dbpsk'
//       | 'qam16' | 'qam64' | 'pam4' | 'psk8'

/** The symbol error rate beside it. */
export function serClosed(scheme, gammaB)

/** The Eb/N0 in dB that reaches a given rate, by bisection on the form. */
export function ebN0For(scheme, target)   // -> dB

/**
 * The counted rate. Runs the chain from a fixed seed and compares bits.
 * Returns the estimate `@ee-labs/random` builds, plus the count behind it and
 * the normal relative half width 1.96 / sqrt(errors) that D4 quotes.
 */
export function berCount({ scheme, ebN0Db, symbols, seed, level = 0.95 })
// -> { value, ci, level, n, errors, bits, relativeHalfWidth, hollow }
// `hollow` is true below 30 errors, and the pane then prints the interval
// rather than the value (plan §2.8).
```

Test: `packages/comms/src/ber.test.js`. Invariant 7. Every closed form against
a hand value at 0, 4, 8 and 12 dB. Every counted point inside its own interval
around the closed form.

### 3.7 OFDM (lane 1, `ofdm.js`)

```js
/** N complex symbols in, N + Ncp samples out, the prefix prepended. */
export function ofdmModulate(syms, { n, cp })   // -> Float64Array

/** Strip the prefix, transform, divide by the channel at each subcarrier. */
export function ofdmDemodulate(rx, { n, cp, channel })  // -> Float64Array

/** The peak-to-average power ratio of one OFDM symbol, in dB. */
export function papr(buf)

/** Pr(PAPR > gamma) on the Nyquist-rate samples, 1 - (1 - e^-gamma)^N. */
export function paprCcdf(gammaDb, n)

/** What the prefix and the pilots cost, in dB. */
export function ofdmRate({ n, cp, used, pilots, bitsPerSymbol, sampleRate })
// -> { spacing, usefulMs, prefixMs, symbolMs, symbolRate, occupied,
//      bitRate, prefixCostDb, pilotCostDb }
```

Test: `packages/comms/src/ofdm.test.js`. Invariant 8. Exact recovery through a
channel of `cp + 1` taps, and a measurable failure at `cp + 2`.

### 3.8 The loops (lane 1, `sync.js`)

```js
/**
 * A second-order loop filter, parameterised the way a designer parameterises
 * one. Returns the two gains and the loop's own H(z), its poles and its
 * margins, so E2 can print them and Control Lab II can read them later.
 */
export function loopFilter({ bnT, zeta })
// -> { kp, ki, wn, bn, poles, settleSymbols, hz }

/** The Costas loop over a symbol stream. BPSK and QPSK error signals. */
export function costasRun({ syms, phaseOffset, freqOffset, bnT, zeta, order })
// -> { phase: Float64Array, residualDeg, settledAt }

/** The early-late gate, and the S-curve its error signal traces. */
export function earlyLate({ h, sps, spacing })
// -> { curve: Float64Array, slope, zeroAt }
```

Test: `packages/comms/src/sync.test.js`. Invariant 10. A second-order loop
settles below 0.5 degrees under a constant frequency offset. A first-order loop
leaves a static error.

### 3.9 Analog modulation and the budget (lane 1, `analog.js`, `budget.js`)

```js
/** The Bessel function of the first kind, by its series, to 1e-15. */
export function besselJ(order, x)

/** The FM spectrum as a Bessel series, and what Carson's bandwidth holds. */
export function fmLines({ beta, order })       // -> Float64Array of J_n(beta)
export function carsonFraction({ beta, order })// -> the power inside 2(df + fm)

/** AM. The sideband level and the fraction of the power they carry. */
export function amSidebandDb(m)      // 20 log10(m / 2)
export function amSidebandPower(m)   // m^2 / (2 + m^2)

/** kT, the free-space path loss, and Friis. */
export function noiseFloorDbm({ tempK, bandwidth, noiseFigureDb })
export function pathLossDb({ distance, frequency })
export function friisNoiseFigure(stages)   // [{ gainDb, noiseFigureDb }, ...]
```

Test: `packages/comms/src/analog.test.js` and `budget.test.js`. `J_n(2)` against
the published 0.22389, 0.57672, 0.35283, 0.12894 and 0.033996. The first zero of
`J0` at 2.404826.

### 3.10 The two new canvases (lane 2)

`PROGRAM.md` §4 names this lab as the first user of the constellation and the
eye, and the Mixed-Signal Lab as the second. The rule there is that a canvas
built for one lab carries the second lab's needs in its props from the start.
Both props below are in the signature from the first commit, and
`components/canvases.test.jsx` measures the geometry each produces.

```jsx
<ConstellationCanvas
  points={Float64Array}     // interleaved [re, im]
  ideal={Float64Array}      // the constellation table, drawn as crosses
  regions={'voronoi'}       // the decision boundaries this lab draws
  grid={null}               // MIXED-SIGNAL: arbitrary decision boundaries,
                            // { x: number[], y: number[], label }
  colorBy={null}            // MIXED-SIGNAL: a key per point, { values, labels }
  evm={{ percent, db }}     // the error vector magnitude, printed in the corner
/>

<EyeCanvas
  traces={Float64Array}     // one buffer, cut into two-symbol traces
  sps={8}
  traceKey={null}           // MIXED-SIGNAL: a value per trace for its colour
  unitLabel={''}            // MIXED-SIGNAL: 'V' for a converter's eye
  decisionAt={0}            // the instant, in fractions of a symbol
  opening={{ height, width }}
/>
```

The constellation's `grid` prop is a decision grid that is not a constellation.
A converter's code boundaries are vertical lines with no points behind them, so
the canvas draws `grid` when it is given and `regions` when it is not. The eye's
`traceKey` colours each trace by a clock phase. Both are listed in `NEEDS.md`
§3 as promotion candidates for `packages/ui`.

The **BER canvas** stays in the app, because only the Information Lab claims it
and that lab is not built. It takes a `limits` prop from the first commit, which
is where that lab draws the Shannon limit.

## 4. The lesson schema and the quantity paths

Copy Random Signals Lab's three registers. They are `see` (at most 70 words),
`try` (each step at most 45 words) and `why` (at most 160 words). An experiment
entry is:

```js
{
  id: 'B5',
  group: 'Digital modulation and constellations',
  name: '16-QAM puts the points on a grid',   // at most 10 words
  terms: ['constellation', 'gray', 'papr'],
  params: { scheme: 'qam16', ebN0Db: 20, symbols: 4096, seed: 1 },
  view: 'constellation',
  views: ['constellation', 'spectrum'],
  featured: { field: 'ebN0Db' },
  claims: [
    { label: 'the minimum distance at unit mean square',
      path: 'map.minDistance',
      formula: (p) => Math.sqrt(2 / 5),
      tol: 1e-12 },
  ],
}
```

A claim is one of the kinds `experiments.test.js` states. `formula(p)` is a
closed form of the experiment's own knobs and is the strongest. `against`
compares two live quantities. `againstScaled`, `atMost`, `atLeast` and
`withinOf` are the rest. Nothing is typed as a constant that can be reached from
the knobs.

Quantity paths a claim may name:

```
map.<bits|minDistance|meanSquare|papr|grayMax|naturalMax>
am.<sidebandDb|sidebandPower|thd|carrierDb>
fm.<beta|carson|carsonBandwidth|lines.N|nullBeta|meritDb>
pulse.<bandwidth|passband|efficiency|peak|peakDb>
pulse.isi.<near|peak|sum>
eye.<opening|width|openingAt.N>
chan.<peakDb|notchDb|notchSpacing|firstNotch|coherence>
snr.<measured|twoEOverN0|energy|mismatch>
ber.<closed|counted|lo|hi|errors|halfWidth|hollow>
ber.at.<N>.<closed|counted|lo|hi|errors>
ber.threshold.<scheme>
ofdm.<spacing|usefulMs|prefixMs|symbolMs|symbolRate|occupied|bitRate>
ofdm.<prefixCostDb|pilotCostDb|paprWorstDb|paprCcdf.N|paprLevel>
ofdm.exact.<taps>
loop.<bn|wn|settleSymbols|residualDeg|slope|zeroAt>
eq.<taps|residual|noiseGainDb|berZf|berMmse>
fade.<closed|penaltyDb|threshold>
budget.<pathLoss|received|noiseFloor|snr|ebN0|margin|range|kT|noiseFigure>
```

`experiments.test.js` resolves every path against the live analysis and fails on
a path it cannot resolve, as Random Signals Lab's does.

## 5. Fixed defaults, so lanes agree

Every lane uses these names and these values. They are the plan's §4.3.

```js
export const DEFAULTS = {
  sampleRate: 8000,       // Signal Lab's grid
  symbolRate: 1000,       // so sps is 8 and the symbol period is 1.00 ms
  sps: 8,
  carrier: 1000,          // the analog group, as Signal Lab's AM preset
  message: 250,
  passbandCarrier: 2000,  // fs / 4, Group B
  m: 0.5,                 // AM index, sidebands 12.041 dB down
  deviation: 500,         // so the FM index is 2
  scheme: 'bpsk',
  beta: 0.35,             // baseband bandwidth 675 Hz
  span: 12,               // near residual ISI 7.44e-5
  ebN0Db: 10,
  symbols: 4096,
  seed: 1,
  level: 0.95,
  bnT: 0.02,              // Bn 20.00 Hz at 1000 symbols a second
  zeta: 0.707,
  gate: 0.5,              // the early-late spacing, 4 samples
  ofdmN: 64,
  ofdmCp: 16,             // spacing 125 Hz, prefix cost 0.969 dB
  ofdmUsed: 52,
  ofdmPilots: 4,
  echo: 0.5,              // the two-ray channel
  echoDelay: 4,           // notch spacing 2000 Hz
  eqTaps: 21,
  frequency: 2.4e9,       // the link budget
  distance: 1000,
  txDbm: 20,
  antennaDbi: 2,
  noiseFigureDb: 6,
  bandwidth: 1e6,
  bitRate: 2e6,
}
```

## 6. What each lane pins

Every number in the plan's §5 for your groups becomes a claim checked in
`experiments.test.js`. Each is computed from the parameters, never typed as a
constant. Run `node packages/comms/scripts/pins.mjs` to see every one produced
from the engine. That script is the source, and this table quotes it.

| Lane | Pins |
| --- | --- |
| 3, A and B | Sideband levels −18.062, −12.041 and −6.021 dB. Sideband power 3.030 %, 11.111 % and 33.333 %. `J_n(2)` at 0.22389, 0.57672, 0.35283, 0.12894 and 0.033996. The `J0` null at 2.404826 and a deviation of 601.2 Hz. Carson holding 99.759 %. The merit figures −9.542, −4.771 and 7.782 dB. Minimum distances 2.0, 1.4142, 0.7654 and 0.6325. A 16-QAM constellation peak-to-average of 2.553 dB. Gray adjacency 1 against natural binary's 2 |
| 4, C | The raised cosine's samples, 1 then below 1e-15. Bandwidths 500, 625, 675 and 1000 Hz. Stream peaks 3.6063 (11.141 dB) and 1.7270 (4.746 dB). Eye openings 0.8619, 0.7166 and 0.4108 at `beta = 0.35`, 0.5695 and 0.1395 at `beta = 0`, and 0.9548, 0.8959 and 0.7364 at `beta = 1`. Residual ISI 4.76e-2, 6.54e-4, 7.44e-5 and 2.83e-5 |
| 5, D | BER at 10 dB of 3.8721e-6, 7.8270e-4, 1.7542e-3 and 2.6533e-2. Thresholds 9.588, 12.598, 13.352, 10.342, 13.435 and 17.787 dB. The 3.010 dB orthogonal penalty. Exact BPSK at 0 to 8 dB, 7.8650e-2, 3.7506e-2, 1.2501e-2, 2.3883e-3 and 1.9091e-4. Half widths 19.6 % at 100 errors and 6.2 % at 1000, and 385 errors for 10 %. The 16-QAM ratio 0.9982 |
| 6, E and F | `Bn` 20.00 Hz, `wn` 37.71 rad/s, and the settling the loop measures. Subcarrier spacing 125 Hz, useful symbol 8.00 ms, prefix 2.00 ms, 100 symbols a second, 6500 Hz occupied and 19 200 bit/s. Prefix cost 0.969 dB and 0.512 dB, pilot cost 0.348 dB. Worst PAPR 18.062 dB. CCDF 2.9014e-3 at 10 dB and 8.3767e-6 at 12 dB. Levels 11.261, 11.690 and 12.080 dB. Exact recovery to 1e-13 at `cp + 1` taps |
| 7, G and H | Channel peak 3.522 dB, notch −6.021 dB, spacing 2000 Hz, first notch 1000 Hz, and −20.000 dB at a tap of 0.9. Equaliser residual below 1e-3 at 21 taps. Rayleigh 2.3269e-2 and 2.4814e-3, a threshold of 43.98 dB and a penalty of 34.39 dB. `kT` at −173.9752 dBm/Hz, a noise floor of −107.975 dBm, path loss 80.052, 100.052 and 120.052 dB, −76.052 dBm received, 31.923 dB of ratio, 28.913 dB of `Eb/N0`, 19.325 dB of margin and 9252 m of range |

## 7. Verify before handing back

```
npx vitest run packages/comms apps/comms-lab packages/dsp apps/signal-lab
npm run lint:prose
npm run build --workspace apps/comms-lab
```

Run the scoped command above rather than the whole suite. The director runs the
whole suite at integration. There is no Playwright harness in this lab, and
`NEEDS.md` §5 records that as the deferral it is.

## 8. Gotchas this lab will pay for

- **A counted rate printed without its interval.** The commonest failure here.
  Use `Estimate` from `panes.jsx`, which cannot render without one.
- **The count drawn as a line.** The closed form is the line and the count is a
  marker. Drawing them as one series teaches the reader that a measurement and
  a formula are the same kind of thing.
- **A tolerance chosen to make a test pass.** When a claim is about a count,
  bound it by the estimator's own interval.
- **The residual ISI measured over the wrong lags.** `residualIsi` returns
  three numbers, and they differ by more than an order of magnitude at a span of
  12. The plan's figures are `near`. A pane that prints one of the three names
  which.
- **A constellation drawn without its decision regions.** B6 counts the points
  outside their region, and a reader cannot check the count without the
  boundaries on screen.
- **The eye drawn from too few traces.** Past about 200 traces the picture is a
  smear rather than an eye. `REVIEW_PLAYBOOK` §6 is the rule, and the canvas
  caps what it draws.
- **A BER point below 30 errors drawn as a solid marker.** At that count the
  interval spans a factor of two. Draw it hollow and print the interval.
- **Counting a rate the browser cannot reach.** One hundred errors take 523 800
  symbols at 8 dB. Above 8 dB the plot draws the closed form alone, and the pane
  states which points were counted.
- **A seed change reading as a defect.** Every view states the seed it drew,
  and D3 exists to make that read as content.
