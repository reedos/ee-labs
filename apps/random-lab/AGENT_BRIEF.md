# Random Signals Lab: build brief

You are one of up to six agents building this lab in parallel. The plan is
`/RANDOM_LAB_PLAN.md`, and this brief turns it into lanes an agent can take
without colliding with another. Read the plan's §2 (engine), §3 (invariants) and
§5 (curriculum) for your lane before writing a line. Reed reviews everything.

## Boundaries: read first

- **One lane per agent.** Work in the overseer's worktree on `lab/random-lab`,
  and never in the shared checkout.
- **Edit only the files your lane owns** (§1). Everything else is read-only. If
  you need a change outside your lane, write it into
  `apps/random-lab/NEEDS.md` under your lane's heading and continue with what
  you can do. The owning lane picks it up.
- **Stage by path.** `git add packages/random/src/psd.js`, never `git add -A`
  and never `commit -a`. Workers do not commit. Hand the result to the overseer.
- **Never push.** The director merges this branch.
- **Never edit** `packages/dsp`, `packages/ui`, `site/`, `README.md`,
  `LabNav.jsx`, `deploy.yml`, or any other app. Those are shared surfaces with
  named owners in `PROGRAM.md` §5.

## The house discipline

Read `/CORE_SCOPE.md`, `/STYLE.md` and `/REVIEW_PLAYBOOK.md` first. Then the
rule every lab obeys. **Every explanatory sentence is a claim about physics, and
a test must measure it.** A lesson quotes no number the engine does not produce.
A prediction follows every control that can change it. On-screen text passes
`npm run lint:prose`.

This lab adds one rule of its own, from the plan's §2.1. **A closed form is
printed bare, and an estimate is printed with its interval.** A pane that shows
an estimate without its interval is incomplete, in the same way an approximation
without a guard is incomplete. Never round an interval away to make a readout
tidy.

Commit messages are narrative. Read `git log` for the register. Never put a
model name in a commit or a file.

## 1. The lanes

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | The engine | `packages/random/**` | done | the six invariants of plan §3 fuzzed green |
| 2 | The app shell and the ensemble view | everything in `apps/random-lab/` not owned by lanes 3 to 6, plus `RELEASE_STATUS`, `release.test.js`, `scripts/verify.mjs` | after lane 1 | a stub experiment renders at 390 px, the release test passes dark |
| 3 | Groups A to C, the probability half | `src/groups/{a,b,c}.js`, `src/lessons/{a,b,c}.js`, `components/HistogramCanvas.jsx` | after lane 2's skeleton | A1 to C3 pinned, 10 experiments |
| 4 | Groups D to F, the process half | `src/groups/{d,e,f}.js`, `src/lessons/{d,e,f}.js`, `components/{CorrelationCanvas,DensityCanvas}.jsx` | after lane 2's skeleton | D1 to F4 pinned, 12 experiments |
| 5 | Groups G to I, estimation and detection | `src/groups/{g,h,i}.js`, `src/lessons/{g,h,i}.js`, `components/{OutcomeCanvas,ErrorRateCanvas}.jsx` | after lane 2's skeleton | G1 to I2 pinned, 8 experiments |
| 6 | Terms, math panel and report | `src/terms.js`, `src/math.js`, `src/report.js` and their tests | after lane 2's skeleton | every term a lesson names is defined, every math row measured |

**The gate.** Lanes 3 to 6 need lane 2's skeleton and lane 1's contracts.
No lane past 2 starts until lane 2's first commit lands the app skeleton, the
`RELEASE_STATUS` file, the release test, and the `EnsembleCanvas` stub with the
props of §3.4. Lane 1 is complete and its contracts are frozen below. A lane may
add to a return shape and may never rename or remove.

**Shared seams, landed first.** Lane 2's first commit adds `src/experiments.js`
and `src/lessons.js` as merge points that import `groups/*.js` and `lessons/*.js`
in plan order. Each group lane then adds only its own file. Two lanes never edit
one file.

## 2. The app skeleton (lane 2)

Copy Signal Lab's shape for the chain and Circuit Elements Lab's shape for the
release and experiment tests. Delete what is not needed.

```
apps/random-lab/
  index.html  package.json  vite.config.js  RELEASE_STATUS (dark)  NEEDS.md
  scripts/verify.mjs
  src/App.jsx  main.jsx  styles.css
  src/experiments.js      merges groups/*.js in plan order, no prose
  src/lessons.js          merges lessons/*.js
  src/groups/{a..i}.js    one file per group, owned by that group's lane
  src/lessons/{a..i}.js   the see / try / why registers, same owner
  src/terms.js            definitions on contact, one registry
  src/math.js             the math-panel rows
  src/report.js           the issue link's summary
  src/release.test.js  experiments.test.js  prose.test.js  terms.test.js
  src/components/         EnsembleCanvas, HistogramCanvas, OutcomeCanvas,
                          CorrelationCanvas, DensityCanvas, ScopeCanvas,
                          ErrorRateCanvas, panes.jsx
```

`release.test.js` is Circuit Elements Lab's file with `circuit-elements-lab`
replaced by `random-lab` throughout. Copy it, do not rewrite it.

Preview port 4306. Ports 4300 to 4305 belong to the other labs.

## 3. Contracts

Every signature below is a promise between lanes. Each ships with the failing
test named beside it.

### 3.1 The generator (lane 1, frozen)

```js
/**
 * A seeded generator. The same seed gives the same stream, forever.
 * @param {number} seed  any integer. Neighbouring seeds give unrelated streams.
 */
export function rng(seed = 1)
// -> { u32(), uniform(), uniformIn(a, b), normal(mu, sigma), exponential(lambda),
//      bernoulli(p), sign(), take(n, fn), state(), spawn() }

/** The seed run k of an ensemble uses. A pure function of the pair. */
export function runSeed(seed, k)
```

Test: `prng.test.js`. Ten thousand draws identical for one seed. Seeds 1 to 5
differ from the first draw. A chi-square over 64 bins below 103.4. Kurtosis 3.

### 3.2 The ensemble (lane 1, frozen)

```js
/**
 * @param {number} o.seed, o.runs, o.length
 * @param {(r, k) => Float64Array} [o.make]   one realisation
 * @param {(x, r, k) => number} [o.stat]      one scalar outcome per run
 * @param {[number, number]} [o.spec]         a band for withinSpec
 */
export function ensemble(o)
// -> {
//   seed, runs, length, spec,
//   paths: Float64Array[],       every realisation, in run order
//   mean: Float64Array,          across runs, at each index
//   sd: Float64Array,            across runs, NaN when runs < 2
//   stats: Float64Array,         one per run
//   statEstimate,                the mean of stats, with its interval
//   band(level)        -> { lo, hi, level, z }
//   quantileBand(p)    -> { lo, hi, p }
//   withinSpec(band, { level }) -> proportion
//   timeAverage(k), ensembleAverage(i)
// }

export function ergodicity(e)
// -> { timeAverages, timeAverageMean, ensembleAverageMean, gap, spread }
```

Test: `ensemble.test.js`. Run k drawn alone equals run k of the whole. The
Gaussian and empirical bands agree on a Gaussian process and part on a two-point
one. `SAMPLE_CAP` refuses above four million stored samples, naming both numbers.

### 3.3 The estimators (lane 1, frozen)

Every estimator returns this shape. A lane may read extra keys and must never
assume their absence.

```js
{
  value,      // the estimate
  variance,   // the variance OF THE ESTIMATOR, not of the data
  se,         // sqrt(variance)
  ci: [lo, hi],
  level,      // the coverage, 0.95 unless asked
  n,          // the sample count it rests on
}

export function sampleMean(x, { level })      // + sampleVariance
export function sampleVariance(x, { level })  // + gaussianVariance, kurtosis
export function proportion(k, n, { level })   // + k, interval: 'wilson'
export function histogram(x, { bins, lo, hi, level })
// -> { edges, centres, counts, density, se, ci, width, n, outside, level, lo, hi }
export function histogramError(h, pdf)  // -> { rms, predicted, bins }
```

Test: `estimate.test.js`. The sample mean's interval covers the truth 95 % of
the time. `proportion(0, 10000)` keeps a non-zero upper bound, which is the case
the naive interval gets wrong.

### 3.4 The ensemble view (lane 2, the new canvas)

The one interaction model the suite lacks. `PROGRAM.md` §4 names the Applied
Analog Lab's Monte Carlo as its second caller, so these props are here from the
first commit and are listed in `NEEDS.md` as a promotion candidate.

```jsx
/**
 * Many realisations and their spread.
 *
 * Props marked (mc) exist for the Applied Analog Lab's Monte Carlo, which is
 * this ensemble with a part tolerance as the source and a measured
 * specification as the outcome. They are not optional extras to add later.
 * `band` and `count` are that lab's stated requirement, named by the director,
 * and `APPLIED_ANALOG_LAB_PLAN.md` section 4.3 is where they come from.
 */
<EnsembleCanvas
  ensemble={ensemble}          // the object of 3.2
  x={{ label, units, values }} // the horizontal axis. Time, or sample index
  y={{ label, units }}         // the vertical axis. Never unlabelled
  show={{ paths: 24, mean: true, spread: 'gaussian' | 'quantile' | 'both' | 'none' }}
  level={0.6827}               // the spread band's coverage, stated in the legend
  highlight={7}                // one run drawn heavy, or null
  band={{ lo, hi, label }}     // (mc) a pass/fail region, drawn BEHIND the runs
  count={{ pass, n, stderr }}  // (mc) runs inside the band, shown in the corner
  target={10}                  // (mc) the nominal, drawn as a line
  onPickRun={(k) => {}}        // (mc) clicking a run selects it
/>
```

`band` and `count` are two halves of one statement and are drawn together. The
region says where the specification is, and the corner says how many runs met it
out of how many. `count.stderr` is the standard error of `pass/n`, so the corner
reads "1917 of 2000, 95.9 % ± 0.4 %" rather than a bare percentage. A fraction
printed without it is the defect section 8 warns about, in the one view where a
reader is most likely to read a yield as an exact number.

The prop that draws the statistical spread is `show.spread`, not `show.band`.
The two were both called a band in the first draft, and one of them is a
specification the designer chose while the other is a property of the process.
Naming them apart is what keeps a pane from implying the first is the second.

Rules the renderer follows, from `REVIEW_PLAYBOOK.md`:

- `show.paths` caps how many runs are drawn, and the caption states the cap
  against the total ("24 of 200 runs drawn"). Drawing 200 faint lines is spray,
  and past about 48 the reader sees an envelope rather than runs.
- The band legend names which band is drawn and at what level. Two bands drawn
  at once are distinguished by weight, not by colour alone.
- `sd` is NaN with one run, and the band is then not drawn at all. A band at
  zero width would claim a certainty a single run does not have.
- The y-axis adapts on a change of experiment, never while a knob is turned.

Test: `EnsembleCanvas.test.js`. The caption states the drawn count and the total.
One run draws no band. A spec band renders only when `spec` is given.

### 3.5 The periodogram, which Electronics Group O calls (lane 1, frozen)

This is the shape the Electronics Lab's Group O imports. It may gain keys and
may never lose one.

```js
/**
 * @param {ArrayLike<number>} x
 * @param {number} sampleRate
 * @param {object} [opts] { segment = 256, overlap = 0, window = 'hann', level = 0.95 }
 */
export function averagedPeriodogram(x, sampleRate, opts)
// -> {
//   freqs, psd, asd,          // one-sided. psd in units^2/Hz, asd in units/sqrt(Hz)
//   ci: Array<[lo, hi]>,      // the chi-square interval, per bin
//   relativeSe,               // sqrt(2/dof)
//   segments, dof, dofExact,  // dofExact false under overlap: the guard
//   df, level, window, segment, overlap,
//   band: [0, sampleRate/2],
//   integral,                 // the variance the density accounts for
//   flatness,                 // the relative spread across the INTERIOR bins
//   interior: [1, half - 1],  // DC and Nyquist sit at half the flat level
// }

export function periodogram(x, sampleRate, opts)   // one frame
export function integratePsd({ freqs, psd }, band) // trapezoid, over a band
export function whitePsd(variance, sampleRate)     // 2 sigma^2 / fs
export function filteredPsd(freqs, psdIn, magnitude)  // |H|^2 S
```

Electronics O1 calls `averagedPeriodogram` and reads `asd`, `integral`,
`flatness` and `ci`. Electronics O2 calls `capacitorNoise`. Both cross-reference
this lab by experiment id, and neither writes a second generator.

Test: `psd.test.js` and `invariants.test.js`. A sine on a bin reads its own
power. Two windows give the same floor. The flatness matches `sqrt(2/dof)`.

### 3.6 Noise and detection (lane 1, frozen)

```js
export function capacitorNoise({ R, C, T = 300 })
// -> { rms, ktc, density, fc, enb, R, C, T, viaBandwidth }

export function whiteNoise({ n, sampleRate, density?, rms?, seed = 1 })
// -> { x, rms, density, variance, seed, sampleRate }

export function firstOrderLowpass(fc, sampleRate)
// -> { b, a, K, magnitude(f), run(x), noiseGain, enb, analogueEnb, enbRatio }

export function matchedSnr({ s, sigma2, sampleRate })
// -> { snr, snrDb, energyDiscrete, energy, n0, sigma2, sampleRate, twoEOverN0 }

export function detectionRun({ s, ebN0, symbols, seed, level })
// -> { measured, predicted, errors, symbols, snr, ebN0, ebN0Db, sigma2 }

export const PULSES = { rect, halfSine, ramp }   // each returns unit energy
```

`enbRatio` is the guard on quoting `(pi/2) f_c` for the digital filter. A lesson
that prints the analogue number must print the ratio beside it.

Test: `noise.test.js`, `detect.test.js`. `kT/C` equal across four decades of R to
18 decimals. `twoEOverN0` equals `snr` for three shapes and three lengths.

## 4. The lesson schema and the quantity paths

Copy Signal Lab's three registers. They are `see` (≤ 70 words), `try` (each step
≤ 45 words) and `why` (≤ 160 words). An experiment entry is:

```js
{
  id: 'A3',                  // the group letter and the number, as the plan has it
  group: 'A random signal, and the density that describes it',
  name: 'The histogram approaches the density',   // ≤ 10 words
  terms: ['density', 'histogram', 'estimator'],   // every term the text leans on
  params: { n: 1000, bins: 40, seed: 1, dist: 'gaussian', mu: 0, sigma: 1 },
  view: 'histogram',         // the view it opens on
  views: ['histogram', 'scope'],
  featured: { field: 'n' },  // the knob the try line names, rendered under it
  claim: { path: 'hist.rms', at: { n: 1000 }, is: 0.0246, tol: 0.05 },
}
```

Quantity paths a `claim` or a `reads` pair may name:

```
dist.<mean|variance|sd>                     the closed form, from the registry
hist.<rms|predicted|width|outside>          the histogram against the density
hist.bin.<k>.<density|se|lo|hi>             one bar and its interval
est.<value|se|lo|hi|n>                      the estimator on screen
ens.<runs|length|sdAt0|spread|gap>          the ensemble and its ergodicity
ens.yield.<value|lo|hi>                     the Monte Carlo fraction in spec
acf.<r0|tau|lagAt1e>                        the correlation view
psd.<density|integral|flatness|dof|relSe>   the averaged periodogram
psd.ci.<lo|hi>                              the interval multipliers
filt.<fc|noiseGain|enb|analogueEnb|ratio>   the filter and its bandwidths
ktc.<rms|density|fc|enb>                    the kT/C group
snr.<linear|db|twoEOverN0>                  the matched filter
ber.<predicted|measured|lo|hi|errors>       the error-rate view
wiener.<w|mmse|gainDb|taps>                 the Wiener group
kalman.<gain|prior|posterior|settledAt>     the Kalman group
```

`experiments.test.js` resolves every path against the live analysis and fails on
a path it cannot resolve, as Circuit Elements Lab's does.

## 5. Fixed defaults, so lanes agree

Every lane uses these names and these values. They are the plan's §4.4.

```js
export const DEFAULTS = {
  sampleRate: 48000,
  noiseRms: 1e-3,        // so the density is 6.4550 uV/sqrt(Hz)
  segment: 512,          // so the bin width is 93.75 Hz
  averages: 100,         // so the relative spread is 10 %
  bins: 40, lo: -4, hi: 4,   // so the bin width is 0.2
  runs: 200, length: 256,
  fc: 500,               // time constant 318.31 us, 15.3 samples
  R: 1e3, C: 1e-9, T: 300,   // so kT/C is 2.035 uV
  pulse: 'halfSine', pulseLength: 64,
  ebN0Db: 7,             // so the error rate is 7.7267e-4
  level: 0.95,
  seed: 1,
}
```

## 6. What each lane pins

Every number in the plan's §5 for your groups becomes a `claim` checked in
`experiments.test.js`. Each is computed from the parameters, never typed as a
constant.

| Lane | Pins |
| --- | --- |
| 3, A to C | 6.4550 µV/√Hz and the integral within 1 %. Histogram gaps 0.0751, 0.0246, 0.00798, 0.00250 against the binomial. The centre bin at 0.398 with a half width of 0.0265. Means and variances of five distributions. Kurtosis 1.801, 2.405, 2.714, 2.925 against 3. The mass at one, two and three sigma. z of 1.9600 and 2.5758. Q(1), Q(3), Q(7) |
| 4, D to F | The `1/e` lag at 16 against a time constant of 15.28 samples. Wiener-Khinchin to 5.8 × 10⁻¹¹. Ergodicity spreads 0.1313, 0.0310, 0.9907, 0.9907. Periodogram spreads 0.974, 0.491, 0.205, 0.105, 0.0496. Interval multipliers 0.830 and 1.229 at 200 degrees of freedom. Filter variance 0.03174 against 0.03170. Noise bandwidths 760.77 and 785.40 Hz, ratio 0.9686. kT/C at 2.035 µV across four decades of R, and 64.358 µV at 1 pF |
| 5, G to I | Standard errors 0.3162, 0.1000, 0.03162, 0.01000. Coverage 0.951 against 0.950. Yields 95.85 % and 66.9 % against 95.45 % and 68.27 %. Matched ratio 100 and 20 dB for three shapes. Mismatch at 81.07 %, 0.911 dB. Error rates 7.7267 × 10⁻⁴ and 9.006 × 10⁻⁹, and 3.0103 dB between the two signallings. Wiener 0.8, 0.2, 0 dB, and 16 taps at 73.26 % of one weight. Kalman gain 0.21533, settling at step 8, and 62.44 % of the one-shot error |
| 6, terms | Every term in `terms.js` defined in ≤ 65 words, and every term a lesson names present. The chrome terms are seed, run, ensemble, interval, level, density and bin |

Run `node packages/random/scripts/pins.mjs` to see every one of these produced
from the engine. That script is the source, and the plan quotes it.

A number a reader would look up rather than derive still gets computed. The mass
a two-sigma band holds, the chi-square multipliers and the error rate at 7 dB all
come from `src/secondRoute.js`, which reaches them from the knobs by a method the
engine does not use. Import from there rather than typing the table value. Its
own test is where the looked-up values belong, and it is the only file in this
lab that carries one.

## 7. Verify before handing back

```
npx vitest run                              # the whole monorepo, from the root
npm run lint:prose                          # every word a reader sees
npm run build --workspace apps/random-lab
npx vite preview --outDir apps/random-lab/dist --port 4306 --strictPort &
cd apps/random-lab && APP_URL=http://localhost:4306 node scripts/verify.mjs
```

The harness catches what unit tests cannot. A prop not passed, a pane fed stale
state, a plot that stopped redrawing. Extend it for every view you add.
Screenshot every view at 390 px and at 1280 × 900, and read the screenshots as a
student would, per `/REVIEW_PLAYBOOK.md` §11.

## 8. Gotchas this lab will pay for

- **An estimate drawn without its interval.** The commonest failure here, and
  the one the plan's §2.1 exists to prevent. Any readout that comes from data
  gets a `±` or a ribbon.
- **A tolerance chosen to make a test pass.** When a claim is about an estimate,
  compute the bound from the estimator's own variance. Several tests in
  `packages/random` show the pattern.
- **DC and Nyquist in a spread across bins.** They sit at half the flat level
  and doubled the measured variance before `flatness` was restricted to the
  interior. Use `interior` whenever you average across bins.
- **The analogue `(pi/2) f_c` quoted for the digital filter.** It is 11 % out at
  a twenty-fourth of the sample rate. Print `enbRatio` beside it.
- **A histogram with samples piled into its end bins.** `histogram` counts them
  in `outside` instead, and the pane states the count.
- **Redrawing an ensemble on every keystroke.** 200 runs of 256 samples is
  51200 samples. Memoise on the parameter object, as Signal Lab memoises the
  chain.
- **A seed change reading as a defect.** A2 exists to make it read as the
  content it is. Every view states the seed it drew.
