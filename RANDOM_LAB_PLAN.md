# Random Signals Lab: the plan

A lab for **probability and random processes as an electrical engineer meets
them**, track B of `EE_LABS_MAP.md`. It is the probability course an EE takes,
with Signal Lab's chain as the laboratory bench. Splash glyph `∿`, directory
`apps/random-lab`, engine in the new package `packages/random`.

The path, in order. A random signal, and why a spectrum is the wrong description
of it. A random variable as a seeded source, and its histogram approaching its
density. Expectation and variance. The Gaussian, and the theorem that explains
why it keeps appearing. Autocorrelation and the power spectral density as one
object seen twice. Ergodicity, and a process that does not have it. White noise
through a filter. The `kT/C` result. Estimation, and the interval every estimate
carries. The matched filter, the Wiener filter and the Kalman filter.

Written 2026-09-05. Every number quoted below was produced by
`packages/random/scripts/pins.mjs` before it was written into this file, and the
app's `experiments.test.js` then pins the same numbers as functions of the knobs.

Two rules govern this lab as they govern every other. **Every explanatory
sentence is a claim about physics, and a test must measure it.** And
`CORE_SCOPE.md` decides what may be stated exactly, what needs a guard, and what
is declined. This lab is where the second rule takes its statistical form, and
§2.1 states that form.

---

## 0. Open decisions

### Decision 1: the name

Recommended: **Random Signals Lab**, as `EE_LABS_MAP.md` names it. The
alternatives are Probability Lab, which understates the process half, and
Stochastic Signals Lab, which is the same words in a longer register. The nav
entry is nine characters at phone width either way.

### Decision 2: whether the ensemble view goes into packages/ui now

Recommended: **build it in the app, promote it when the Applied Analog Lab
claims it.** `PROGRAM.md` §4 names the ensemble view as a new canvas whose
second lab is the Applied Analog Lab's Monte Carlo. The props that lab needs are
in the component from the first commit and are listed in
`apps/random-lab/NEEDS.md`, so the promotion is a file move and not a rewrite.
Building it in `packages/ui` now would put a canvas with one caller into a shared
package before its second caller exists to shape it.

### Decision 3: where the "density, not a spectrum" experiment lives

Recommended: **here, as A1.** `EE_LABS_MAP.md` §2 has this lab opening after
Electronics O1, which is not built and has no overseer past its own gate. The
experiment is also the right opening for this lab on its own terms, because it
poses the question the rest of the course answers. Electronics O1 then imports
`@ee-labs/random` and cross-references A1 by name rather than building a second
generator. `BACKLOG.md` records that cross-reference as pending.

### Decision 4: which generator

Recommended: **xoshiro128\*\* seeded through splitmix32**, documented in
`packages/random/src/prng.js`. A lab about randomness cannot use an unnamed
source of randomness, and `Math.random()` has no seed at all. The alternative,
mulberry32 as `@ee-labs/dsp`'s `hash01` uses it, has a 32-bit state and visible
structure in long histograms. The two generators stay separate, because Signal
Lab's noise must be addressable by sample index and this lab's must be a stream.

### Decision 5: Box-Muller rather than the ziggurat

Recommended: **Box-Muller.** It is an exact transform with no rejection step and
no table. The ziggurat is faster and rests on a generated table of 128
rectangles, and a lab that shows a reader where its numbers come from should not
hide that table. Speed is not the constraint here, because the largest ensemble
the app draws is four million samples.

---

## 1. The progression map

Every idea this lab leans on, the experiment that teaches it, and whether that
experiment is built. A "gap" row names the group in this plan that closes it.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| A signal in time, and its spectrum | A1, E, F | Signal Lab, Signals and Fourier | built |
| The FFT, the bin, the frame, the window | A1, D2, E | Signal Lab, Sampling group | built |
| dB, and a log frequency axis | E, F, H3 | Signal Lab, defined on contact | built |
| A filter, its corner, its magnitude response | F1, F2, F4, I1 | Signal Lab, Filters group | built |
| The impulse response, and convolution | F4, H1, I1 | Signal Lab, FIR group | built |
| Noise as a source in a chain | A1, E1 | Signal Lab, the `noise` waveform | built |
| A random signal has a density, not a spectrum | E, F | nowhere | **gap, A1** |
| Probability, a density, a distribution function | everything | nowhere | **gap, A** |
| Expectation, variance, the moments | B onward | nowhere | **gap, B** |
| The Gaussian, and why it appears | C, G, H | nowhere | **gap, C** |
| Autocorrelation, and Wiener-Khinchin | D, E, F, I | nowhere | **gap, D** |
| The averaged periodogram, and its interval | E, F | nowhere | **gap, E** |
| Thermal noise, `4kTR`, and `kT/C` | F3 | Electronics O2, not built | **gap, F3** |
| The transfer function as `H(s)`, poles | I2 hand-over | Circuit Lab, 15 built | built |
| State, and a plant with memory | I2 | Control Lab, 13 built | built |
| The Q function and detection | H | nowhere | **gap, H** |

Two consequences follow, and both are decisions rather than omissions.

**Electronics O2 is not built, so F3 derives `kT/C` from the density rather than
from a netlist.** The formula `sqrt(4kTR)` is stated as physics with its
constants named, and the lab does not solve a circuit to reach it. When
Electronics Group O lands, its O2 solves the netlist and cross-references F3.
The number is the same number, because both labs call `capacitorNoise` in
`@ee-labs/random`.

**Nothing in this lab leans on an experiment that does not exist.** The
progression test enforces that, and the ids and counts this lab adds are listed
in `apps/random-lab/NEEDS.md` for the seams overseer.

---

## 2. The engine: what is exact, what carries an interval

`packages/random` is a new package, listed in `EE_LABS_MAP.md` §3. It depends on
`@ee-labs/dsp` for the FFT and the windows, and on nothing else.

### 2.1 The admission test, restated for statistics

`CORE_SCOPE.md` Rule 1 asks whether an object is exactly a rational function of
s or z. That question does not apply to a probability density, so this package
states the equivalent test at its own boundary:

- A **closed form** goes in `dist.js`, `noise.js`, `detect.js`, `wiener.js` or
  `kalman.js`. It returns a bare number and is printed with no hedge. The Q
  function, `|H|² S`, `kT/C` and `2E/N0` are of this kind.
- An **estimate**, meaning anything computed from data, goes in `estimate.js`,
  `psd.js`, `corr.js` or `ensemble.js`. It returns an object carrying the
  variance of the estimator and a confidence interval.

The interval is the guard that Rule 3 requires, and a pane that prints an
estimate without it is incomplete. The two kinds never share a return value.
Where a lesson compares them, it holds both objects, and the comparison is the
content of the lesson.

### 2.2 The generator

xoshiro128\*\*, four 32-bit words of state, period 2¹²⁸ − 1, seeded by four
splitmix32 steps. Every operation is a 32-bit shift, xor, rotate or multiply, so
JavaScript runs it exactly with `Math.imul`.

The seeder is load bearing. Seeding the four words straight from a small integer
leaves the state nearly zero, and a nearly-zero xoshiro state takes thousands of
draws to mix. Seeds 1, 2 and 3 would then open with almost the same number, and
three ensembles a reader compares side by side would look correlated.
`prng.test.js` measures that neighbouring seeds differ from the first draw.

Uniforms carry 53 bits, assembled from two 32-bit draws. A single word divided by
2³² would quantise every uniform to 2.3 × 10⁻¹⁰ and put a visible staircase in
the tail of an exponential.

### 2.3 Ensembles, and why run k is addressable

`ensemble({ seed, runs, length, make, stat, spec })` draws `runs` realisations.
Run k uses `runSeed(seed, k)`, a hash of the pair. So run 7 is the same run 7
whether the app drew the whole ensemble or that run alone. Drawing from one
continuing stream would have made run 7 depend on runs 0 to 6. The label "run 7"
would then be false whenever the app rendered a subset.

The return carries several things. The mean and the standard deviation across
runs at each index. A Gaussian band and an empirical quantile band. The per-run
scalar outcome, and `withinSpec`. The last three are the Monte Carlo shape the
Applied Analog Lab needs. They are present from the first commit.

### 2.4 The periodogram, and the degrees of freedom it has

One periodogram bin of Gaussian white noise is the true density times a
chi-square with two degrees of freedom. Its standard deviation therefore equals
its own mean. Averaging M non-overlapping frames gives `chi²_2M / (2M)`. The
interval this package returns is that chi-square interval, computed from the
incomplete gamma function rather than approximated by a normal.

Overlapping frames share samples and are correlated. The effective degrees of
freedom are then fewer than `2M`, and `averagedPeriodogram` computes them from
the window's own overlap correlation and sets `dofExact` to false. That flag is
the guard. Claiming `2M` under overlap would return an interval that is too
narrow, which is exactly the defect a guard exists to prevent.

Building this turned up a fact the plan has to carry. **A one-sided density
leaves DC and Nyquist at half the flat level**, because they have no mirror
partner at a negative frequency to fold in. Counting those two bins in a spread
across 129 bins doubles the measured variance, and made the estimator look 41 %
worse than it is. `flatness` is therefore measured over the interior bins, and
the pane says so. The end bins are still plotted and still in the integral.

### 2.5 Wiener-Khinchin as an identity about arithmetic

The **biased** autocorrelation estimate, divided by N rather than by the number
of overlapping terms, has a discrete Fourier transform exactly equal to the
periodogram. The unbiased estimate does not, and its transform can go negative,
which would be a power spectral density with negative power in it. So the biased
estimate is the default, and `corr.js` and `psd.js` agree to floating point
rather than to a tolerance. The measured worst gap is 5.8 × 10⁻¹¹ relative.

### 2.6 The filter, and a noise bandwidth that is not the analogue one

The lab's filtered-noise experiments use a first-order low-pass built by the
bilinear transform with its corner prewarped. That filter has a closed form for
the noise it passes. With `K = tan(π f_c/f_s)` the impulse response sums to
`Σ h² = K/(K+1)` exactly, so its noise bandwidth is `(f_s/2) K/(K+1)`.

That number is not `(π/2) f_c`. At `f_c = f_s/24` it is 11.1 % below it, because
the digital filter has a null at Nyquist and the analogue single pole does not.
The analogue formula is exact for the analogue filter and is an approximation to
this one, so it ships with `enbRatio` as its guard. The two agree within 1 % once
the corner falls below `f_s/320`, which is 150 Hz at 48 kHz.

### 2.7 What the package declines

- **A spectrum for a non-stationary process.** `stationaryVariance` throws for
  `|a| ≥ 1` and names the reason, because a random walk has no variance to state.
  The Kalman filter still runs there, and the comparison is F4's content.
- **A confidence interval on a fitted model the lab did not fit.** The package
  has no autoregressive model estimator. Spectral estimation by an AR model
  belongs to the DSP Lab, which owns `packages/dsp`.
- **An ensemble above four million stored samples.** `SAMPLE_CAP` refuses with
  both numbers in the message rather than exhausting memory.

### 2.8 The modules

| Module | Provides | Kind |
| --- | --- | --- |
| `prng.js` | `rng`, `seedState`, `splitmix32`, `runSeed` | exact |
| `dist.js` | `erf`, `erfc`, `qFunction`, `qInv`, `chi2Inv`, the registry | exact |
| `estimate.js` | `sampleMean`, `sampleVariance`, `proportion`, `histogram` | intervals |
| `ensemble.js` | `ensemble`, `ergodicity`, `quantileOfSorted` | intervals |
| `corr.js` | `autocorrelation`, `psdFromAcf`, `acfFromPsd` | intervals |
| `psd.js` | `periodogram`, `averagedPeriodogram`, `integratePsd` | intervals |
| `noise.js` | `capacitorNoise`, `thermalDensity`, `whiteNoise`, `firstOrderLowpass` | exact |
| `detect.js` | `matchedFilter`, `matchedSnr`, `errorRateAntipodal`, `PULSES` | exact |
| `wiener.js` | `wienerScalar`, `wienerFir`, `solveToeplitz`, `levinsonDurbin` | exact |
| `kalman.js` | `kalmanSteadyState`, `kalmanRun`, `stationaryVariance` | exact |

---

## 3. Invariants, the fuzzer's checklist

Fuzzed in `packages/random/src/invariants.test.js` across the parameters named,
and green before any user interface existed. Where a claim is about an estimate,
the tolerance is the estimate's own interval and not a number chosen to pass.

1. **Seed determinism.** The same seed gives the same stream, over ten thousand
   draws of every distribution, for eight seeds. A whole ensemble drawn twice is
   bit-identical, and run k drawn alone equals run k of the whole.
2. **The sample mean's variance is `σ²/N`.** Measured by repeating the estimate
   three thousand times at four combinations of N and σ, and compared against the
   formula within four standard errors of the spread itself. The reported
   interval covers the true mean 95.1 % of the time against a claimed 95 %.
3. **The averaged periodogram flattens as `1/√M`.** The measured spread across
   the interior bins matches `sqrt(2/dof)` at three segment lengths.
   Quadrupling the averages halves the spread. The chi-square interval covers the
   true density at its stated rate over sixty independent estimates.
4. **The integral of the density returns the variance within 1 %.** At three
   sample rates and three noise levels, and for a filtered process whose density
   is not flat.
5. **`|H|² S` against a directly filtered ensemble.** Band by band at three
   corner frequencies, within five standard errors per band. And reached a second
   way with no spectrum at all, by filtering each run of a 400-run ensemble and
   comparing the variance across runs.
6. **The matched filter's output ratio is `2E/N0`.** For three pulse shapes at
   three lengths, four noise variances and three sample rates, to nine decimals.
   The two routes to the number are computed independently inside `matchedSnr`.

Two more that the six rest on. Wiener-Khinchin holds to 10⁻⁹ relative at three
record lengths. And every estimator returns `value`, `variance`, `se`, `ci`,
`level` and `n`, with the interval width equal to `2 z se`.

---

## 4. The app

### 4.1 The interaction model

Signal Lab's chain, plus an ensemble view. A source feeds a chain of blocks, and
the output reaches the views. The source here is a seeded random variable rather
than a sine, and the views are the ones a probability course needs.

The ensemble view is the new canvas. It draws many realisations at once as faint
lines, the mean across runs as a heavy line, and a band around it. One run can be
highlighted and followed. `PROGRAM.md` §4 names the Applied Analog Lab's Monte
Carlo as its second caller, so it takes the props that lab needs from the start.

### 4.2 Views

- **Ensemble.** Runs against time or against sample index, with the mean, the
  Gaussian band and the empirical quantile band. A highlighted run. The band
  legend states which band is drawn.
- **Histogram.** Counts normalised to a density, with the true density over it
  and a per-bin interval drawn as a whisker. The count outside the range is
  printed rather than piled into the end bins.
- **Outcome.** One scalar per run as a histogram, with a specification band and
  the fraction inside it. This is the Monte Carlo view.
- **Correlation.** The autocorrelation against lag, normalised, with the lag at
  which it falls to `1/e` marked.
- **Density.** The averaged periodogram against frequency, with the interval as a
  shaded ribbon, the closed form over it where one exists, and the integral in
  the corner with its band stated.
- **Scope.** One realisation in time, so a reader can see what a realisation is
  before seeing what the ensemble is.
- **Error rate.** The counted rate against `Eb/N0` with its interval, and the Q
  function drawn as the curve it should sit on.

### 4.3 The layout, and what is always on screen

Sidebar with the lesson, the try line and the featured knob, as Signal Lab has
it. Views to the right, one at a time on a phone. Every estimate on screen
carries its interval, and the top bar states the seed, the run count and the
sample count. Changing the seed redraws everything and changes nothing a lesson
claims, which is A2's experiment.

### 4.4 Numbers, as the defaults

- White noise at 1 mV rms and 48 kHz, so the density is 6.4550 µV/√Hz.
- 512-sample segments, so the bin width is 93.75 Hz.
- 100 averages, so the relative spread is 10 % and the 95 % interval runs from
  0.830 to 1.229 of the estimate.
- A 40-bin histogram from −4 to 4, so the bin width is 0.2.
- 200 runs of 256 samples in the ensemble view.
- A first-order low-pass at 500 Hz, whose time constant is 318.31 µs, which is
  15.3 samples at 48 kHz.
- `R = 1 kΩ`, `C = 1 nF`, `T = 300 K`, so `kT/C` is 2.035 µV rms.
- A 64-sample half-sine pulse of unit energy, and `Eb/N0` on a knob from 0 to
  12 dB.

---

## 5. Curriculum: 30 experiments in 9 groups

Format, as the other plans. **The claim** the note makes, what the reader turns,
and **Measured** naming what `experiments.test.js` pins.

### Group A: A random signal, and the density that describes it (4)

- **A1 · A random signal has a density, not a spectrum.** White noise at 1 mV
  rms and 48 kHz. One FFT frame is spray, and reloading it gives a different
  spray. Average 100 frames and a flat floor appears at 6.4550 µV/√Hz, whose
  integral over the band returns 0.996 mV against the 1 mV that went in. The unit
  V/√Hz is defined here and used from here on. Measured: the one-frame spread is
  0.974 against a predicted 1.000, the 100-frame spread is 0.105 against 0.100,
  and the integral is within 1 %.
- **A2 · A random variable is a seeded source.** The same seed gives the same
  numbers, and the neighbouring seed gives unrelated ones. Every number this lab
  quotes is a function of a seed. Measured: two draws from seed 12345 agree over
  ten thousand samples, and the first draws of seeds 1 to 5 differ by more than
  0.01.
- **A3 · The histogram approaches the density at one over root N.** A Gaussian
  source into a 40-bin histogram from −4 to 4. At N = 100 the root-mean-square
  gap to the true density is 0.0751. At 1000 it is 0.0246, at 10000 it is
  0.00798, and at 100000 it is 0.00250. Measured: each against the binomial
  prediction (0.0768, 0.0243, 0.00768, 0.00243), and the ratio between
  consecutive decades against `√10`.
- **A4 · Every bar has an interval.** The same histogram with the per-bin
  interval drawn. The centre bin reads 0.398 against a true 0.3970, and its 95 %
  half width is 0.0265. Raise N and the whiskers shrink while the bars stay.
  Measured: the interval brackets the estimate at every bin, the true density is
  inside at least 17 of 20 bins, and the half width falls as `1/√N`.

### Group B: Expectation and variance (3)

- **B1 · Expectation is the balance point.** Five distributions with their means
  as closed forms: uniform on (0, 1) at 0.5, Gaussian at µ, exponential at
  `1/λ`, Bernoulli at p, and Rayleigh at `σ√(π/2)`, which is 1.2533 at σ = 1.
  The sample mean of 1000 uniforms reads 0.5108 with a 95 % half width of 0.0176.
  Measured: each closed form against a Simpson integration of its own density,
  and the sample mean's interval covering 0.5.
- **B2 · Variance is a squared distance, so it adds.** The same five, with
  variances 1/12, σ², `1/λ²`, `p(1−p)` and 0.4292. Two independent sources summed
  give the sum of the variances and not the sum of the standard deviations.
  Measured: the closed forms against the integrated second moments, and the sum
  of two sources against the sum of their variances within its interval.
- **B3 · The sample variance is not the variance.** The estimator divides by
  N − 1, and it carries an interval of its own. For Gaussian data that interval
  is `2σ⁴/(N−1)`. For exponential data the kurtosis is 9 rather than 3, and the
  Gaussian formula understates the interval by a factor above 2.5. Measured: both
  formulas, the kurtosis of each source, and the ratio between them.

### Group C: The Gaussian, and why it keeps appearing (3)

- **C1 · Adding uniforms makes a Gaussian.** One uniform has kurtosis 1.801
  against the flat distribution's 1.8. Two give 2.405, four give 2.714, and
  twelve give 2.925 against a Gaussian's 3. The histogram is visibly Gaussian by
  four. Measured: all four kurtosis values, and the histogram's gap to the
  Gaussian density falling as the count rises.
- **C2 · The Gaussian's mass, in three numbers.** 68.27 % inside one standard
  deviation, 95.45 % inside two, 99.73 % inside three. The two-sided 95 %
  interval is 1.9600 standard deviations wide on each side, and the 99 % one is
  2.5758. Measured: each from `qFunction` and each from a count over 100000
  draws, with the count's own interval.
- **C3 · The Q function is the tail.** `Q(x)` is the mass beyond x. `Q(1)` is
  0.15866, `Q(3)` is 1.3499 × 10⁻³, and `Q(7)` is 1.2798 × 10⁻¹². Every detection
  result later in the lab is a Q of something. Measured: five values against
  their textbook figures, `Q(x) + Φ(x) = 1`, and the derivative against `−φ(x)`.

### Group D: Autocorrelation, the density, and ergodicity (4)

- **D1 · Correlation is a signal against a shifted copy of itself.** White noise
  correlates with itself at lag zero and with nothing else. A filtered process
  correlates over its time constant. At a 500 Hz corner and 48 kHz the time
  constant is 318.31 µs, which is 15.28 samples, and the correlation falls to
  `1/e` after 16 lags. Measured: the lag at the `1/e` crossing against the time
  constant, and white noise's lags 1 to 32 inside `5/√N`.
- **D2 · The density and the correlation are one object.** Wiener-Khinchin. The
  Fourier transform of the autocorrelation is the power spectral density, and on
  a finite record the biased estimate makes that an identity about arithmetic.
  Measured: the worst relative gap between the two routes is 5.8 × 10⁻¹¹, at three
  record lengths.
- **D3 · The zero lag is the variance.** `r(0)` is the mean square, and it is
  also the integral of the density. Two routes to one number. Measured: the two
  agree to nine decimals once the trapezoid rule's two end panels are accounted
  for, which the pane states.
- **D4 · A time average is not always an ensemble average.** Draw 800 runs of a
  stationary Gaussian process. The spread of the per-run time averages is 0.1313
  at length 64 and 0.0310 at length 1024, against `1/√length` of 0.125 and
  0.0313. Now draw a process whose value is a constant chosen once per run. The
  spread is 0.9907 at both lengths, and a longer run adds nothing. That process
  is stationary and not ergodic. Measured: all four spreads, and the second
  pair's ratio equal to 1 to nine decimals.

### Group E: The periodogram and its averages (4)

- **E1 · One frame is a chi-square with two degrees of freedom.** Each bin's
  estimate has a standard deviation equal to its own mean, so the picture is
  spray and it is not a defect of the FFT. Measured: the spread across the
  interior bins is 0.974 against a predicted 1.
- **E2 · Averaging M frames narrows it as one over root M.** At M = 4 the spread
  is 0.491, at 25 it is 0.205, at 100 it is 0.105, and at 400 it is 0.0496.
  Measured: each against `1/√M`, and the ratio between M = 25 and M = 400 against
  4.
- **E3 · The interval on a density is a chi-square interval.** At 100 averages
  there are 200 degrees of freedom, and the 95 % interval runs from 0.830 to
  1.229 of the estimate. A normal interval would be visibly wrong below about
  twenty averages. Measured: the two multipliers from `chi2Inv`, the interval
  bracketing the estimate at every bin, and the coverage over sixty estimates.
- **E4 · The integral of the density is the variance.** The area under the curve
  returns the mean square of the signal that made it. At 100 averages the
  integral returns 0.99626 mV against 1 mV. The DC and Nyquist bins sit at half
  the flat level, because a one-sided density doubles only the bins that have a
  mirror partner. Measured: the integral within 1 %, and the two end bins at
  0.5 ± the estimator's own spread.

### Group F: Noise through a filter (4)

- **F1 · The output density is the magnitude squared times the input.**
  `S_out = |H|² S_in`, exactly, for a linear filter and a stationary input. The
  claim carries no hedge. At a 500 Hz corner and 48 kHz the measured output
  variance is 0.03174 against a predicted 0.03170. Measured: band by band across
  the spectrum within five standard errors, and the integral within 1 %.
- **F2 · Noise bandwidth is wider than the corner.** A first-order analogue stage
  passes the noise a brick wall of `(π/2) f_c` would pass, which is 57.08 % wider
  than the corner. The digital filter in this app is not that filter. Its own
  noise bandwidth is `(f_s/2) K/(K+1)`, which is 760.77 Hz against the analogue
  785.40 Hz at a 500 Hz corner, and 2792.1 Hz against 3141.6 Hz at 2 kHz. The two
  agree within 1 % once the corner is below 150 Hz at 48 kHz. Measured: both
  closed forms, their ratio, and the ratio rising towards 1 as the corner falls.
- **F3 · kT/C does not depend on the resistance.** One resistor into one
  capacitor holds 2.035 µV rms at 1 nF and 300 K, for any resistance. Raising R
  from 1 kΩ to 1 MΩ raises the density from 4.0704 nV/√Hz to 128.72 nV/√Hz and
  drops the corner from 159.15 kHz to 159.15 Hz. The product is constant. At 1 pF
  the answer is 64.358 µV, which is why a sampled capacitor cannot be made
  arbitrarily small. Measured: the rms equal across four decades of R to 18
  decimals, the density rising as `√R`, the bandwidth falling as `1/R`, and the
  two routes to the rms agreeing.
- **F4 · A filter puts memory into noise that had none.** The same filter seen in
  time. White noise has a correlation of zero at every non-zero lag. After the
  filter the correlation decays over the time constant, and the ensemble's runs
  visibly wander together. Measured: the `1/e` lag against the time constant, and
  the correlation from the density through `acfFromPsd` against the correlation
  measured directly.

### Group G: Estimation, and the interval (3)

- **G1 · The sample mean's variance is sigma squared over N.** At σ = 1 the
  standard error is 0.3162 at N = 10, 0.1000 at 100, 0.03162 at 1000 and 0.01000
  at 10000. A hundredfold N narrows the interval tenfold, which is the cost of
  precision. Measured: the spread of 3000 repeated estimates against `σ²/N`, at
  four combinations of N and σ.
- **G2 · The interval covers at the rate it claims.** Repeat the whole estimate
  4000 times and count how often the interval holds the true mean. It reads
  0.951 against a claimed 0.950. The interval is itself random, and that is not a
  defect. Measured: the coverage inside three standard errors of 0.95.
- **G3 · Monte Carlo is an ensemble with a specification.** 2000 runs of a
  quantity at 10 units with a 0.5 spread. Between 9 and 11 the yield is 95.85 %
  with an interval from 94.88 % to 96.64 %, against the Gaussian's 95.45 %.
  Tighten the band to 9.5 and 10.5 and the yield falls to 66.9 % against 68.27 %.
  Measured: both yields against the Q function, and both intervals covering it.

### Group H: Detection (3)

- **H1 · The matched filter is the best linear detector.** Correlate the received
  record with the pulse. The peak lands where the pulse starts and its height is
  the pulse energy. A rectangular filter on a half-sine pulse reaches 81.07 % of
  the best ratio, which is 0.911 dB of loss. A filter proportional to the pulse
  reaches the best ratio whatever the constant. Measured: the peak position and
  height, the mismatched ratio, and 400 random filters none of which beat it.
- **H2 · The ratio is two E over N zero, and the shape does not matter.** Three
  pulse shapes of equal energy reach an output ratio of 100, which is 20 dB, at a
  noise variance of 0.01. Pulse length does not matter either. Measured: the
  ratio for three shapes at three lengths, and `2E/N0` computed by the other
  route agreeing to nine decimals.
- **H3 · The error rate is a Q, and the count agrees with it.** Antipodal
  signalling gives `Q(√(2Eb/N0))`. At 7 dB that is 7.7267 × 10⁻⁴, and 200000
  counted symbols give 7.500 × 10⁻⁴ with an interval from 6.392 × 10⁻⁴ to
  8.800 × 10⁻⁴. On-off keying is 3.0103 dB worse at every point. At 12 dB the rate
  is 9.006 × 10⁻⁹, and 1000 symbols show zero errors. The interval still reaches
  3.8 × 10⁻³. Zero errors is not a zero rate. Measured: the closed forms, the
  pooled count within four Poisson standard deviations, and the interval's
  coverage over 200 runs.

### Group I: The Wiener and Kalman filters (2)

- **I1 · The Wiener filter minimises error, not ratio.** One weight on one sample
  is `var(s)/(var(s)+var(n))`, which is 0.8 at a ratio of 4, and it leaves 0.2
  against the 0.25 of doing nothing. It cannot change the ratio of powers at all,
  identically, because a scaling scales both. Give it more taps and it can. At
  equal signal and noise power of 0.1384, one weight leaves 0.06922 and sixteen
  taps leave 0.05071, which is 73.26 % of it. Measured: the scalar closed forms,
  the gain in decibels equal to zero to nine decimals, and the filtered record's
  measured error against the formula.
- **I2 · The Kalman gain is a variance ratio, and it settles before any data.**
  With `a = 0.9`, `q = 0.1` and `r = 1` the settled gain is 0.21533 and the error
  left is 0.21533. Only the ratio `q/r` matters, so `q = 0.001` with `r = 1` and
  `q = 0.1` with `r = 100` both give 0.0051243. From a start 500 away the gain
  settles by step 8. The recursive estimate leaves 62.44 % of the one-shot
  Wiener error, and that gap is what the earlier measurements are worth. This is
  the door to Control Lab II. Measured: the closed-form gain against the
  recursion, the measured error against the steady state, and the innovation
  variance against `P⁻ + r`.

---

## 6. Hand-overs

- **← Signal Lab** (A1, E, F). The chain, the FFT and the filter vocabulary. This
  lab's notes cross-reference Signal Lab's Filters group by name, as Power Lab
  does. Nothing is imported from `apps/signal-lab`, and the shared machinery is
  `@ee-labs/dsp`.
- **→ Electronics Lab, Group O.** O1 imports `whiteNoise` and
  `averagedPeriodogram` from `@ee-labs/random` and cross-references A1 by name.
  O2 imports `capacitorNoise` and cross-references F3. The two labs then quote
  one set of numbers, because they call one function. This is recorded in
  `BACKLOG.md` as pending on Electronics Group O.
- **→ Control Lab II** (I2). The scalar Kalman filter, with the state as a
  plant's state and the gain as a design choice. `kalmanSteadyState` is the
  object that crosses.
- **→ Communications Lab** (H). The matched filter, the Q function and the error
  rate against `Eb/N0`. `EE_LABS_MAP.md` has that lab opening after this one, and
  H is the group it opens on.
- **→ Applied Analog Lab.** The ensemble view and its Monte Carlo props, listed
  in `NEEDS.md` as a promotion candidate for `packages/ui`.
- **→ DSP Lab.** Spectral estimation past the averaged periodogram, meaning the
  autoregressive model, belongs there. This lab stops at Welch's method and says
  so in E4's note.

---

## 7. Testing discipline

- **Unit** (`packages/random`): every closed form against a value a reader can
  look up, and against an identity that shares no code path. `erfc` in the tail
  is checked against the asymptotic series. The chi-square quantiles are checked
  against a table and by round trip through the distribution function. The
  densities are integrated by Simpson's rule and compared against the separately
  stated moments.
- **Invariants** (§3), fuzzed. The hostile corners are one run, zero errors, a
  correlation sequence that is not positive definite, a corner at Nyquist, and a
  random walk with no stationary variance.
- **Experiments**: every number in §5 pinned in `experiments.test.js` as a
  function of the knobs, never as a typed constant. Among them 6.4550 µV/√Hz,
  2.035 µV, 0.03170, 760.77 Hz, 0.21533, 7.7267 × 10⁻⁴, 0.0751, 1.9600 and
  0.62444.
- **Prose**: `prose.test.js` over every `see`, `try`, `why`, term and chrome
  string, and `npm run lint:prose` over the markdown.
- **Release**: `release.test.js`, adapted from Circuit Elements Lab, enforcing
  that nothing outside the app mentions it while `RELEASE_STATUS` reads `dark`.
- **Harness**: `scripts/verify.mjs`, written against Signal Lab's, extended for
  the ensemble, histogram, outcome and error-rate views. It is written in this
  program and run by whoever has a browser.

---

## 8. Integration and the dark launch

`RELEASE_STATUS` reads `dark`. The lab builds and deploys at `/random-lab/` so
that Reed can review it at a URL, and nothing a visitor sees points at it. The
deploy line the director adds at integration is in `apps/random-lab/NEEDS.md`:

```
cp -r apps/random-lab/dist _site/random-lab
```

The progression-test ids and counts are in the same file for the seams overseer.
Reed alone changes `RELEASE_STATUS`, and the release commit is the director's.

---

## 9. Phasing

1. **The engine.** `packages/random`, fuzzed green against §3 before any user
   interface exists. Exit: the six invariants pass.
2. **The shell and the ensemble view.** The app skeleton, `RELEASE_STATUS`, the
   release test, and the one new canvas with the Monte Carlo props. Exit: a stub
   experiment renders at 390 px.
3. **Groups A to C.** The probability half, which needs the histogram and the
   ensemble views only. Exit: 10 experiments pinned.
4. **Groups D to F.** The process half, which needs the correlation and density
   views. Exit: 22 experiments pinned, and `kT/C` within 0.1 %.
5. **Groups G to I.** Estimation and detection, which need the outcome and error
   rate views. Exit: 30 experiments pinned.
6. **The harness and the walk.** `scripts/verify.mjs` extended for every view,
   and a cold walk against `REVIEW_PLAYBOOK.md`.

---

## 10. Non-goals for the first version

Stated so they are decisions rather than omissions.

- **Continuous-time probability.** Every process here is sampled. The continuous
  formulas appear as the closed forms the sampled measurement approaches, and
  where the sampled object differs from the continuous one, §2.6 is the model for
  saying so.
- **Multivariate distributions.** Joint densities, covariance matrices and the
  multivariate Gaussian are out. The Kalman filter is scalar, and Control Lab II
  owns the vector form.
- **Hypothesis testing as a subject.** The lab tests one thing, whether a
  measurement is consistent with a closed form, and does it with intervals rather
  than with p-values.
- **Markov chains and queueing.** They belong to a computer engineering course
  and have no home in this map yet.
- **Spectral estimation by a model.** Named in §6 as the DSP Lab's.

---

## 11. Risks, named

- **The lab teaches the generator instead of the distribution.** Guarded by the
  chi-square uniformity test, the moment tests and the choice of xoshiro128\*\*
  over a 32-bit generator. If a histogram ever shows structure, it is the
  generator and `prng.test.js` should have caught it.
- **A reader reads an interval as an error bar on a measurement.** It is a
  statement about a procedure, and G2 is the experiment that makes the difference
  visible. The risk is that G2 arrives late. Phasing puts it in step 5.
- **The end-bin fact in §2.4 confuses more than it teaches.** It is real and it is
  visible on the plot, so hiding it would be worse. E4 states it in one sentence
  and the pane repeats it.
- **The ensemble view is slow at large run counts.** 200 runs of 256 samples is
  51200 samples and redraws in a frame. The cap at four million samples refuses
  before the browser stalls, with both numbers in the message.
- **Electronics Group O lands with a different generator.** Guarded by the
  hand-over in §6 and by the `BACKLOG.md` entry. The contract in
  `apps/random-lab/AGENT_BRIEF.md` §3 is the shape that lab calls.
