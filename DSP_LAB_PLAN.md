# DSP Lab: the plan

The second DSP course, on the chain Signal Lab already has. Signal Lab teaches one
rate, one design knob and one arithmetic. This lab teaches three more of each.
Splash glyph `⇄`, directory `apps/dsp-lab`, engine as an extension of
`packages/dsp`.

The path, in order. Changing the rate, and what decimation and interpolation do to a
spectrum. Designing a filter to a written specification instead of to a knob.
Filters that change their own coefficients. Estimating the spectrum of a signal that
is not made of sinusoids. The arithmetic a real processor uses. The transform
itself, which every other group has been calling.

This is a draft (2026-09-05) for Reed to settle. §0 lists the open decisions. §1 is
the progression map against what is built. §2 is the engine, §3 the models, §4 the
app, §5 the curriculum. Then the hand-overs, testing, the dark launch, phasing,
non-goals and risks.

Every number quoted below was computed before it was written, by
`apps/dsp-lab/scripts/numbers.mjs`, from the same functions the app runs. The two
rules that govern the other labs govern this one with no exemption. Every
explanatory sentence is a claim about physics, and a test must measure it. And
`CORE_SCOPE.md` decides what the engine may state exactly, what it may approximate
behind a guard, and what it declines with a reason.

This lab is where the third of those categories does the most work. A quantised
filter is exactly rational and is admitted with no hedge. An adaptive filter is not
rational at all, and is shown as the sequence of filters it is. A rate changer is
not even shift-invariant, so it has no transfer function to draw.

---

## 0. Open decisions

### Decision 1: the name (recommended: DSP Lab)

`EE_LABS_MAP.md` §1 already calls it that, and the course it mirrors is called DSP
II or Advanced DSP in most catalogues. LabNav short form **"DSP"**. The splash card
names the path in one line: "rate changes, filter design to a specification,
adaptive filters, spectral estimation, fixed point".

Alternatives considered. *Advanced Signal Lab* reads as a harder version of a lab
that is already released, which invites a reader to skip Signal Lab. *Filter Lab*
names one group of six. *Multirate Lab* names one group of six and the least
requested one.

### Decision 2: the default sample rate (recommended: 48 kHz)

Signal Lab defaults to 8 kHz. That suits its 250 Hz tone and its 2048-point frame.
This lab decimates by four and designs to a transition band 2 kHz wide. Both read
better at an audio rate a reader recognises. Recommended: **48 kHz with a
4096-point frame**. A bin is then 11.72 Hz, and every lesson frequency is a multiple
of 375 Hz, which is a bin centre exactly.

The consequence is that a hand-over from Signal Lab arrives at a different rate. The
link carries the rate, as it already does, and the receiving lab sets it.

### Decision 3: how a rate change appears on one time axis

A decimator produces samples at a lower rate, and the scope and the spectrum are
drawn at one rate. Three ways to reconcile that were considered.

Recommended: **the rate changer stays on the display's time axis**. A decimator
filters, keeps every Mth sample and holds it for M samples, which is a decimation
followed by the zero-order hold a converter performs. An interpolator reads the
signal on a grid L times coarser and rebuilds it. Every alias and every image is
then visible on the axis the reader already has, and the hold's own droop is a
number the lesson quotes rather than an artefact.

The alternatives. *A per-block rate* changes `createChain`'s signature, which four
labs call. *Two scopes* doubles the view and still needs the reader to align them.

### Decision 4: where the specification pane lives

`PROGRAM.md` §4 gives the specification pane to the Applied Analog Lab first and
this lab second. The director has ruled that this lab lands it, because this lab is
building now. Recommended: **built in `apps/dsp-lab/src/components/SpecPane.jsx`
with the Applied Analog Lab's props from the first commit**, and listed in
`apps/dsp-lab/NEEDS.md` as the `packages/ui` promotion candidate.
`APPLIED_ANALOG_LAB_PLAN.md` §4.3 states the contract, and §4.2 below repeats it.

### Decision 5: how many groups ship in the first release

Six groups and about forty experiments is the whole course. The phasing in §9 ships
them in three tranches, and each is a course a reader can finish. Recommended:
**Reed decides the release point at the end of phase 3**. By then the rate group and
the design group are pinned, and the specification pane has been read by someone
other than its author.

---

## 1. The progression map

`EE_LABS_MAP.md` says this lab opens after Signal Lab's sampling and FIR groups.
Both are built and released, so this lab defers nothing for a missing prerequisite.
The table lists every idea the lab leans on and where the suite teaches it.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| Sampling, Nyquist, the fold, aliasing | A1, A3 | Signal Lab, Sampling group, 7 built | built |
| The spectrum of a sampled signal, bins, leakage, windows | every group | Signal Lab, Sampling group | built |
| The FIR as a delay line and a dot product | A, B | Signal Lab, FIR group, 7 built | built |
| The windowed sinc, and the window's effect on the skirt | B2, B3 | Signal Lab, FIR group | built |
| Linear phase from a symmetric kernel, group delay | A5, B8 | Signal Lab, FIR group | built |
| The biquad, its poles and zeros, Q as pole radius | B7, E2 | Signal Lab, Filters group, 8 built | built |
| The z-plane, and a zero on the circle as a null | A7, E3 | Signal Lab, FIR group | built |
| Quantisation as a nonlinearity, and its noise floor | E1, E6 | Signal Lab, Nonlinearity group, 6 built | built |
| dB, RMS, crest factor, the spectrum readout | every group | Signal Lab, terms on contact | built |
| H(s), poles and zeros, the corner and Q | B7 | Circuit Lab, 15 built | built |
| The bilinear transform of an analog section | B7 | Circuit Lab hand-over, and `packages/dsp` | built |
| A random signal, its density and its variance | D | nowhere. Random Signals Lab is proposed | **gap, stated in D1** |
| The matched filter and the Wiener filter | C1 | nowhere. Random Signals Lab is proposed | **gap, stated in C1** |

Two rows are gaps and neither blocks a group. Group D needs one fact about random
signals, that a periodogram bin is exponentially distributed. D1 states it as a
measured property of the estimator rather than as a theorem to be taken on trust.
Group C needs the Wiener solution. C1 derives it as the solution of a linear system,
which needs no probability beyond an average.

When the Random Signals Lab is built, both rows become cross-references and the two
statements become one sentence each. `BACKLOG.md` carries the item.

The order of the groups follows the map. Nothing in a group leans on an experiment
that comes later in this lab or in a lab that is not built.

---

## 2. The engine: five modules beside the ones that exist

`packages/dsp` is owned by this lab (`PROGRAM.md` §5) and is called by Signal Lab,
Circuit Lab, Control Lab and Power Lab. So every addition is a new module with a new
export, and no existing signature moves. The suite is green at 1459 package tests
and 1805 app tests with the additions in place.

### 2.1 What exists, and what is missing

| Need | Today | This plan |
| --- | --- | --- |
| Rate changes, polyphase, the noble identities | nothing | `multirate.js` (§2.2) |
| Design from a specification, and the margin against it | `designFir` from a knob | `design.js` (§2.3) |
| Parks-McClellan | nothing | `remez` in `design.js` |
| IIR from an analog prototype | `designBiquad` from (mode, f0, Q) | `designIir` in `design.js` |
| Coefficients that change every sample | nothing | `adaptive.js` (§2.4) |
| Arithmetic with a word length | `quantize` block, output only | `fixpoint.js` (§2.5) |
| The spectrum of a random signal | `spectrum`, amplitudes of sinusoids | `estimate.js` (§2.6) |
| The transform's own cost and structure | `fft.js`, used and not explained | `fftCost`, `butterfly`, `bitReversal`, `dft` |
| A complex baseband chain | `createChain`, one real a sample | `complexChain.js` (§2.7) |

### 2.2 Changing the rate

Two operations and their consequences. `downsample(x, M)` keeps every Mth sample,
which stretches the spectrum by M and folds everything above the new Nyquist onto
what is below it. `upsample(x, L)` writes L minus one zeros after every sample,
which changes the spectrum not at all and therefore leaves L minus one images of the
band below the new Nyquist.

Neither is shift-invariant. Delay a decimator's input by one sample and its output
is not the old output delayed by anything, because a different set of samples is
kept. So a rate changer has no H(z), the block returns null from `response`, and the
spectrum overlay draws nothing for it. The filters around it are ordinary LTI
filters and are stated exactly.

`polyphase(h, M)` deals the taps out to M subfilters. `polyphaseDecimate` computes
only the samples it keeps, which is exactly M times less work and the same sum of
the same products regrouped. `expandTaps(h, M)` builds H(z^M), which is what both
noble identities are about.

### 2.3 Designing to a specification

A specification is a list of bands. Each band is a frequency range and a bound on
the magnitude inside it, in decibels relative to the passband's own peak. The shape
is deliberately not about filters, because a gain mask, a noise mask and a
supply-rejection mask are the same object with a different unit. That is what the
Applied Analog Lab needs from it.

```js
lowpassSpec({ fpass, fstop, ripplePassDb, stopDb }, sampleRate)
// -> [{ id: 'pass', label, from: 0, to: fpass, max: 0, min: -ripplePassDb },
//     { id: 'stop', label, from: fstop, to: fs/2, max: -stopDb, min: null }]

specMarginRef(bands, evaluate) // -> { bands: [{ ..., maxDb, minDb, atHz, marginDb, met }],
                               //      met, worstDb, worst }
```

Three routes reach a specification and each returns the filter beside its margin at
every band edge. `designFirSpec` is the window method, and it declines with a reason
when the window's own attenuation ceiling is below what is asked. `designRemezSpec`
is Parks-McClellan, starting from Kaiser's estimate and growing until the margin is
met. `designIirSpec` is the bilinear transform of a Butterworth or Chebyshev
prototype, with the corner placed where the prototype's passband ends.

The Remez exchange is the one piece of real numerical work. A Type I linear-phase
FIR has amplitude `A(w) = sum a_k cos(k w)`, a real function with the delay already
removed. The alternation theorem says the best Chebyshev fit is the one whose
weighted error reaches its peak, with alternating signs, at M plus two frequencies.
So the algorithm solves for the coefficients and the peak that make the error
exactly plus and minus delta at a guessed set, then moves the guesses to where the
error is actually largest. It converges in eight passes on the reference
specification, and the stopband lobes then agree to a hundredth of a decibel.

### 2.4 Filters that learn, and what may be said about them

```js
runAdaptive({ x, plant, algorithm, taps, mu, lambda, delta, noise, stride })
// -> { y, e, d, w, history, stride }
```

`history` is the contract that matters. A filter whose coefficients change every
sample is not a rational function of z. So `CORE_SCOPE.md` Rule 1 refuses it entry
to the transfer-function currency, and no H(z) is offered. What is offered is the
sequence of filters it passes through. Each row of `history` is the weight vector at
one sample, which is an ordinary FIR with a response of its own. The view draws that
sequence rather than a curve that does not exist.

Two facts about it are exact and are stated with no hedge, under the counter-rule.
`wiener(x, d, taps)` solves `R w = p`, a linear system with one answer, and that
answer is the best fixed filter of the same length. `lmsStepBound` gives
`2/(3 N Px)` for the mean square and `2/(N Px)` for the mean. Both rest on the
independence assumption, which is an approximation with a name, and the docstring
names it.

`misadjustment` is the third. It predicts the fraction by which the settled error
exceeds the Wiener minimum, and §5 group C quotes the measurement beside it.

### 2.5 Arithmetic with a word length

`quantizer({ bits, intBits, rounding, overflow })` returns a function whose every
output is an exact multiple of its step. That exactness is what keeps the quantised
filter admissible. Rounding the coefficients produces a different filter, exactly
rational, whose poles are computed rather than estimated, and `quantizeBiquad`
returns those poles beside the exact ones and the distance between them.

Two things are approximations and both carry guards. The rounding-noise model treats
each rounding as white noise of `delta^2/12`, and the guard is that the signal must
exercise many codes. `roundingNoise` computes the noise gain by running the
recursion, and a test measures the model wrong by more than an order of magnitude
when a signal moves across three codes. The dead-band count is measured by
exhaustive search rather than by a bound, because the classic bound does not apply
to a rounding placed on the whole accumulator.

`findLimitCycle` is exact rather than a threshold. The state is four values, each an
exact multiple of the step, so there are finitely many states and a zero-input run
must repeat. The search remembers every state and reports the repeat.

### 2.6 Estimating a spectrum

`spectrum()` returns the amplitude of each sinusoid in a frame, which is the right
answer for a signal made of sinusoids. A random signal has none. What it has is a
power spectral density, and a finite record gives an estimate of it.

`periodogram`, `bartlett` and `welch` return `{ freqs, psd, df, segments, n }`, with
psd in power per hertz and one-sided. The scaling is a property rather than a
convention, and a test measures it. The density times the bin spacing, summed over
the bins, equals the mean power of the windowed record to nine decimals.

`arYuleWalker` fits an all-pole model by Levinson-Durbin, so every model it returns
is stable and the prediction error falls monotonically with order. `arOrderCriteria`
returns AIC and MDL, which disagree, and the disagreement is the content of D7.

### 2.7 The complex chain, for the Communications Lab

`createComplexChain(registry)` is `createChain` again over an interleaved
Float64Array of two numbers a sample. It exists at the director's request for the
Communications Lab, whose constellation needs both parts. Nothing in `chain.js`
changed.

A registry written for the real chain runs here unaltered, because a
real-coefficient block acts on the two parts separately. The portable test pins the
result bit for bit against `createChain` for five block arrangements and three
waveforms. A block that mixes the two parts declares `makeComplex` and receives
both numbers.

### 2.8 Invariants, the fuzzer's checklist

Each is fuzzed over a range of parameters, and each has a test named beside it in
the brief.

1. **The noble identities hold exactly.** Downsampling then H(z) equals H(z^M) then
   downsampling, bit for bit, at M of 2, 3, 4, 5 and 8. Upsampling commutes the same
   way at L of 2, 3, 4 and 7.
2. **A polyphase decimator equals filter-then-downsample sample for sample.** Bit
   for bit on dyadic coefficients, where no sum can lose a bit. Within 1e-12
   relative on designed coefficients, where the same products are added in a
   different order.
3. **Downsampling after upsampling returns the original exactly**, and upsampling
   after downsampling does not, at 48 of 64 samples differing.
4. **A designed filter meets its specification at every band edge, or reports the
   miss.** Fuzzed over three stopband edges and three attenuations, for the window
   method, Parks-McClellan and both IIR prototypes.
5. **Parks-McClellan is equiripple.** Every stopband lobe within 0.05 dB of every
   other, and the lobe height equal to the solved delta over the stopband weight.
6. **Every bilinear pole is inside the unit circle**, at four orders, two prototypes
   and four corner frequencies.
7. **The bilinear response is the prewarped prototype's**, to six decimals, at five
   frequencies and five orders. This is the identity that makes the mapping exact
   rather than approximate.
8. **LMS converges to the Wiener solution within the misadjustment bound.** The
   weights reach the plant to 1e-6 at three step sizes, and the settled error stays
   below one plus 1.25 times the predicted excess.
9. **LMS diverges above the bound**, which is what makes the bound a bound.
10. **The quantised filter is exactly rational.** Every coefficient an exact
    multiple of the step, its measured response equal to `biquadResponse` of the
    quantised coefficients, and its poles printed.
11. **A limit cycle really repeats**, sample for sample over its whole period. Its
    amplitude is an exact multiple of the state's step.
12. **The adaptive filter carries no H(z).** Its block returns null from `response`,
    and `history` holds one weight vector per stride, each an ordinary FIR.
13. **The periodogram's scatter does not fall with the record length.** It stays
    between 0.85 and 1.15 at four lengths spanning a factor of 64.
14. **Averaging cuts the scatter by the root of the segment count.** Within 25 %,
    at four segment counts, for Bartlett and for Welch.
15. **The density integrates to the power**, to nine decimals, at two lengths and
    three windows.
16. **Every AR model is stable**, with every reflection coefficient inside the unit
    interval, at six orders.
17. **The transform equals the sum it replaces**, to 1e-13 relative, at three
    lengths.
18. **A real-only registry through the complex chain equals `createChain`**, bit for
    bit.

---

## 3. Models: the block library

The app binds `createChain(BLOCK_TYPES)` to its own registry, as Signal Lab does.
Signal Lab's eleven blocks are reused unchanged by import, and this lab adds seven.

| Block | Group | Params | H(f)? |
| --- | --- | --- | --- |
| Decimate and hold | Rate | M, antialias, taps, window, implementation | no, and the block says why |
| Interpolate | Rate | L, fill, taps, window, implementation | no, same reason |
| FIR to a specification | Design | fpass, fstop, ripple, stop, method, window | yes, exact |
| IIR to a specification | Design | fpass, fstop, ripple, stop, prototype | yes, exact |
| Adaptive filter | Adaptive | algorithm, taps, mu, lambda, plant, output | no, and it shows its weights |
| Fixed-point biquad | Fixed point | the section, coefficient bits, state bits, rounding, overflow | yes, of the quantised coefficients |
| Unknown plant | Adaptive | the impulse response the adaptive filter is chasing | yes, exact |

The three that return null from `response` are the three that are not LTI, and each
carries the reason as a string the card prints. `CORE_SCOPE.md` Rule 2 applied to a
block registry says a refusal with a reason is a finished feature.

The fixed-point biquad is the interesting entry. It returns a response, because the
quantised coefficients are a real filter with a real H(z). It returns that response
only while the state quantiser is off, because rounding inside the loop makes the
recursion nonlinear and the response then describes only part of what happens. With
the state quantiser on it reports the quantised coefficients' response as a dashed
curve, the way Signal Lab dashes a chain holding a nonlinear block.

---

## 4. The app

### 4.1 Layout

Signal Lab's, unchanged, because a reader who learns one lab has learned them all. A
left sidebar of lessons grouped by the six groups. A source rack and a block rack. A
time view and a frequency view side by side, each with a view selector. A math panel
under the note. Terms on contact in a folded panel.

Three additions, and no other change to the shape.

- **The specification pane**, beside the frequency view when a lesson names a
  specification. §4.2 has its contract.
- **The weight view**, a time view option. The adaptive filter's coefficients, as a
  set of traces against sample number, with the plant's taps drawn as the target.
- **The pole grid**, a frequency view option. The pole positions a quantised
  second-order section can reach, with the exact and quantised poles marked.

### 4.2 The specification pane's contract

`APPLIED_ANALOG_LAB_PLAN.md` §4.3 states it, and this lab builds it to that shape
from the first commit.

```jsx
<SpecPane
  items={[{ key, label, value, target, unit, cmp, tol, margin, pass }]}
  binding="stop.depth"                 // the item to show first
  mode="table" | "bars"                // bars for a phone
  mask={{ axis: 'f', bands: [...] }}   // drawn by the frequency view
  onEdit={(key, target) => {}}         // a design task lets the reader move the target
/>
```

`items` is the scalar form, one row per number with its target and its margin.
`mask` is the band form, a set of limits a response must stay inside with the margin
reported per band, which is what `specMarginRef` already returns. This lab uses both.
The design group states its specification as a mask and reads the margin per band.
The rate group states a scalar target, the image rejection in decibels, and reads
one margin.

`cmp` is one of `min`, `max` or `window`, so a row can say "at least", "at most" or
"within". `tol` carries the allowance for a `window` row. `pass` is computed by the
caller rather than by the pane, so one function decides it everywhere.

### 4.3 Views

| View | Shows | Groups |
| --- | --- | --- |
| Signal | the scope, as Signal Lab's | all |
| Weights | the adaptive filter's coefficients against sample number | C |
| Spectrum | the amplitude spectrum, as Signal Lab's | all |
| Density | the power spectral density, with the estimator named | D |
| Response and mask | the chain's magnitude with the specification drawn on it | A, B, E |
| z-plane | poles and zeros, exact and quantised | B, E |
| Pole grid | the positions a word length can reach | E |
| Butterfly | one stage of the transform, drawn | F |

### 4.4 Numbers

The defaults, from which every quoted number follows.

- Sample rate 48 kHz, frame 4096 points, Hann window. A bin is 11.72 Hz and every
  lesson frequency is a multiple of 375 Hz, which is a bin centre.
- Rate change by 4. The new Nyquist is 6 kHz, the coarse grid is 12 kHz.
- The anti-alias and interpolation filters are 121 taps, Blackman, cutoff at 0.8 of
  the new Nyquist, which is 4800 Hz.
- The reference specification: passband to 4 kHz within 1 dB, stopband from 6 kHz
  below 60 dB.
- The adaptive plant is eight taps, `[0.4, -0.3, 0.25, 0.1, -0.05, 0.02, 0.01, 0]`,
  driven by white noise of power 0.335 a sample.
- The echo path is twelve taps with three samples of bulk delay. The near-end
  talker is a 300 Hz tone at an amplitude of 0.1.
- The fixed-point section is a low-pass at 600 Hz with Q of 10, whose pole radius is
  0.996085.
- The transform group works at 1024 points, where the saving is 204.8 times.

---

## 5. Curriculum: 40 experiments in 6 groups

Format, as the other plans. **The claim** the note makes, what the reader turns, and
what is **measured** against what **formula**. Every quoted number becomes a pinned
test, computed in the test from the parameters rather than typed in. Each experiment
ships with `see`, `try` and `why` in the three registers, within the STYLE.md
budgets.

### Group A: Changing the rate (7)

- **A1 · Decimation, and the fold it causes.** Keep every fourth sample of a 48 kHz
  signal. The new Nyquist is 6 kHz, so a 1500 Hz tone survives and a 9 kHz tone
  arrives as 3 kHz, which is `fs/M - 9000`. Measured: the alias frequency, its
  amplitude 0.9061, and the zero-order hold droop 0.9003 that accounts for it. The
  surviving tone reads 0.9760 against a predicted droop of 0.9745.
- **A2 · The filter that has to come first.** A 121-tap Blackman low-pass at 4800 Hz
  ahead of the same decimator. It is 117.7 dB down at 9 kHz, so the alias falls from
  0.9061 to 2.043e-6. Measured: the filter's response at the interferer, the alias
  before and after, and the 112.9 dB between them.
- **A3 · Interpolation, and the images zero stuffing leaves.** A 1500 Hz tone on the
  12 kHz grid, with three zeros written after every sample. Its spectrum is
  unchanged, so images appear at 10500, 13500 and 22500 Hz, each at 0.2500, which is
  exactly one Lth of what went in. Measured: the four amplitudes and their equality.
- **A4 · The interpolation filter, and the gain of L.** The same 121-tap Blackman
  low-pass, scaled by L. The images fall by 95.1 dB and the wanted tone comes back
  at 1.0000. Without the scaling it sits at 0.2500, which is the one design step a
  reader forgets. Measured: both amplitudes, the filter's DC gain of 4.0000, and the
  image rejection.
- **A5 · The polyphase decimator.** The same output computed without the samples
  that are thrown away. 121 taps at 48 kHz is 5.808e6 multiplies a second directly
  and 1.452e6 in polyphase, a saving of exactly M. Measured: the two counts, and the
  two outputs agreeing to 6.24e-16 relative.
- **A6 · The polyphase interpolator.** Each output phase is its own short filter run
  at the low rate, so no zero is ever multiplied. Measured: the two outputs
  agreeing exactly, and the same saving of L.
- **A7 · The noble identities.** Downsampling then filtering with H(z) equals
  filtering with H(z^M) then downsampling. A 15-tap filter becomes 57 taps when
  expanded, and the two routes agree bit for bit. Measured: the tap counts, and
  exact equality on both identities.

### Group B: Designing to a specification (8)

- **B1 · The specification, as a mask.** Four numbers become two bands and a margin
  in decibels. Passband to 4 kHz within 1 dB, stopband from 6 kHz below 60 dB. A
  filter either meets it at every band edge or misses it at a named frequency.
  Measured: the margin at both bands for a filter that meets it and one that does
  not, and the frequency the miss is reported at.
- **B2 · The window's transition width.** The width is about `C fs / N`, with C from
  the window. At 81 taps and 48 kHz the four windows predict 533, 1837, 1956 and
  3259 Hz, and measure 528, 1782, 1518 and 2346 Hz. Measured: all eight numbers, and
  the width falling as one over N.
- **B3 · The stopband the window sets, which N cannot change.** Hamming at 41, 81,
  161 and 201 taps gives 48.7, 50.4, 51.4 and 51.6 dB while its transition width
  falls from 3863 Hz to 788 Hz. Adding taps buys width and not depth. Measured: the
  four depths and the four widths.
- **B4 · Choosing the window from the attenuation.** The specification asks for
  60 dB and Hamming reaches about 53 dB at any length, so the design declines with
  that reason rather than returning a filter that misses. Blackman reaches it in 133
  taps. Measured: the refusal message, and Blackman's length.
- **B5 · Parks-McClellan, and equal ripple.** The best possible fit for a given
  length has an error that reaches the same height at M plus two frequencies, with
  alternating signs. At 51 taps the exchange converges in eight passes and every
  stopband lobe sits within 0.05 dB of every other. Measured: the lobe heights, the
  alternation count of 28, and the lobe height equal to delta over the weight.
- **B6 · Kaiser's estimate, and what the search adds.** The formula predicts 51 taps
  for the reference specification. The design meets it at 53, having grown once.
  Measured: the estimate, the length that worked, and the 60.40 dB actually reached.
- **B7 · The bilinear transform, and prewarping.** An analog prototype becomes a
  digital filter by mapping frequency through a tangent. A fourth-order Butterworth
  at 5 kHz reads 3.0103 dB down at its corner and 28.3423 dB down at 10 kHz, which
  is exactly what the prototype gives at the prewarped ratio. Measured: both numbers
  against the closed form, to six decimals.
- **B8 · One specification, four filters.** The same two bands met by a Blackman
  window in 133 taps, by Parks-McClellan in 53, by an 18th-order Butterworth in 45
  coefficients and by a 9th-order Chebyshev in 25. The FIR pays 26 samples of delay
  and gives exactly linear phase in return. Measured: the four counts, the ratio of
  5.3, and the group delay.

### Group C: Filters that learn (7)

- **C1 · The best fixed filter, and the equations that find it.** For a stationary
  input the best filter of a given length solves `R w = p`, one linear system with
  one answer. With white noise into an eight-tap plant it returns the plant to
  6.30e-5 relative. Measured: the solution against the plant, and the
  autocorrelation matrix's diagonal equal to the input power.
- **C2 · LMS, the update in one line.** `w <- w + mu e x`, two multiply-accumulates
  a tap. Starting from zero it reaches the plant, and the first update moves the
  weight by exactly `mu e x`. Measured: the first step by hand, and the final weights
  to 1e-6.
- **C3 · The step size, and the bound it cannot cross.** At eight taps and an input
  power of 0.335 the mean bound is 0.7461 and the mean-square bound is 0.2487. Below
  it the filter converges, and at four times it the weights leave for infinity.
  Measured: both bounds from the knobs, convergence below, divergence above.
- **C4 · Misadjustment, the price of a fast step.** Doubling the step halves the
  time and doubles the excess error. Measured against a noise floor: 1348, 693, 313
  and 139 samples to a tenth of the plant. The settled error is 1.0064, 1.0133,
  1.0276 and 1.0726 times that floor. The bound predicts 1.0067, 1.0134, 1.0268 and
  1.0670.
- **C5 · NLMS, and the step size made dimensionless.** Dividing by the energy in the
  delay line makes the bound `0 < mu < 2` whatever the signal level is. At ten times
  the amplitude NLMS takes the same 31 samples, and plain LMS at the same step size
  diverges. Measured: both convergence counts, and the divergence.
- **C6 · RLS, and what N squared buys.** The exact least-squares answer at every
  sample, in about 2N samples rather than thousands. Measured: 5 samples for RLS, 31
  for NLMS and 319 for LMS to the same tenth, with the cost per sample beside each.
- **C7 · The echo canceller.** The unknown plant is an echo path with three samples
  of bulk delay. The canceller learns it, the echo falls from 0.1713 to 0.00731 in
  power, and what is left is the near-end talker at 0.005 plus the misadjustment.
  Measured: the echo return loss enhancement of 13.7 dB, and the residual against
  the near-end power.

### Group D: Estimating a spectrum (7)

- **D1 · The periodogram, and what it does not do.** One transform, squared, scaled
  to a density. Its bins scatter about the true density by about the density itself,
  and at 1024, 4096, 16384 and 65536 points that scatter reads 0.998, 1.015, 0.995
  and 0.999 of the mean. Measured: the four ratios, and the mean equal to the source's
  own `2 var / fs` of 1.3889e-5.
- **D2 · What a longer record buys.** Sixteen times the samples is sixteen times the
  resolution, from 11.72 Hz to 0.73 Hz, and no reduction in scatter at all. Measured:
  the two bin spacings and the two scatters.
- **D3 · Bartlett, and the root of K.** Cut the record into K pieces, average their
  periodograms, and the scatter falls as one over root K while the bin spacing rises
  by K. At K of 4, 16, 64 and 256 the scatter reads 0.514, 0.255, 0.136 and 0.068.
  Measured: the four scatters against the four predictions.
- **D4 · Welch, and why the segments overlap.** A window on each segment stops a
  strong component's skirts covering the estimate, and overlapping recovers the
  samples the taper threw away. At K of 16 the two methods reach 0.258 and 0.255
  from 65536 and 34816 samples. Measured: both scatters and both record lengths.
- **D5 · What the averaging costs.** The same 65536 samples give a 0.73 Hz bin with
  one segment and a 187.5 Hz bin with 256. Two tones 120 Hz apart are resolved by
  the first and merged by the last. Measured: the bin spacings, and the separation
  at which the two lines merge.
- **D6 · The model instead of the average.** Assume the signal came from white noise
  through an all-pole filter, fit the filter, and plot its response. An AR(2) process
  with `a1 = -1.6, a2 = 0.9` is recovered as -1.5798 and 0.8787 from 1024 samples,
  and as -1.5997 and 0.8989 from 65536. Measured: both fits, and the model's peak.
- **D7 · Choosing the order.** More poles always fit better, so the criterion has to
  charge for them. Akaike charges `2p/N` and the description length charges
  `p ln N / N`, so the second picks a lower order on the same data. Measured: the
  error against order, and both criteria's choices.

### Group E: The arithmetic a processor has (6)

- **E1 · The word length, and the grid it makes.** Twelve bits with two integer bits
  is a step of 1.95e-3 over a range of -4 to 4 minus a step. Every stored value is
  an exact multiple of that step. Measured: the step from the bits, the range, and
  every quantised value on the grid.
- **E2 · Quantised coefficients move the poles.** The reference section is a 600 Hz
  low-pass at Q of 10, pole radius 0.996085. At 20, 16, 12 and 10 bits its poles
  move by 3.04e-6, 2.41e-4, 1.82e-3 and 1.00e-2. At 8 bits they reach the unit
  circle and the filter is no longer stable. Measured: the four distances, and the
  radius at each word length.
- **E3 · The grid the poles can land on.** With a1 and a2 on a grid, the reachable
  pole positions are dense at 45 degrees and sparse against the real axis near z
  equals 1. That is exactly where a low-frequency resonator needs them. Measured:
  the count of reachable poles in two boxes of equal area.
- **E4 · Limit cycles, and the dead band.** Rounding inside the loop makes the
  recursion nonlinear, so a filter with no input can sit at a fixed level forever
  instead of decaying. For this section the dead band is 81 steps at every word
  length tried, so it is a count the coefficients set and a level the word length
  sets. Measured: the count at 10, 12, 14 and 16 bits, and the same filter in
  float64 decaying to nothing.
- **E5 · Overflow, and the two things a processor can do about it.** At eight bits
  the range is -1 to 0.9921875. A value of 1.2 saturates to 0.9921875 or wraps to
  -0.796875, and inside a recursive filter that wrap comes back round the loop.
  Measured: both results, the range from the word length, and the output of the same
  filter under each rule.
- **E6 · Rounding noise, and the guard on its model.** One rounding is an error of
  at most half a step, and the white model puts its power at `delta^2/12`. Through
  this section's `1/A(z)` the noise gain is 10433.8, so a 2.819e-4 rms rounding
  becomes 2.880e-2 at the output, an amplification of 40.2 dB. The model holds
  within a factor of two for a signal that exercises many codes and fails by more
  than ten for one that exercises three. Measured: the gain, both rms figures, and
  the model against measurement on both signals.

### Group F: The transform itself (5)

- **F1 · The sum every spectrum has been using.** The discrete Fourier transform is
  N complex multiplies for each of N outputs. At 1024 points that is 1048576, and
  the direct sum agrees with the transform to 1e-13 relative. Measured: the count,
  and the two results.
- **F2 · The butterfly.** Two complex additions and one complex multiply produce two
  outputs. At k of zero the twiddle is one, so the butterfly is a sum and a
  difference. At k of N over four it is minus j, a quarter turn. Measured: both
  cases exactly, and the twiddle's angle.
- **F3 · Bit reversal.** The decimation-in-time transform reads its input in the
  order 0, 4, 2, 6, 1, 5, 3, 7 at eight points, which is the index with its bits
  reversed. The permutation is its own inverse. Measured: the order, and that
  applying it twice returns the identity.
- **F4 · The saving, counted.** Log two of N stages of N over two butterflies is
  5120 at 1024 points, against 1048576 for the sum, which is 204.8 times. The ratio
  is `2N / log2 N`, so it grows with N: 21.3 at 64, 64.0 at 256, 682.7 at 4096.
  Measured: the four ratios from the formula.
- **F5 · Why the frame is a power of two.** A radix-2 transform needs one, and a
  frame that is not one is padded, which changes the bin spacing and therefore every
  frequency the readout prints. Measured: the bin spacing before and after padding,
  and the frequency a line reports under each.

---

## 6. Hand-overs

- **← Signal Lab.** Its Sampling group is this lab's Group A prerequisite and its
  FIR group is Group B's. A link carries sources, blocks, rate and frame, as its
  emitter already builds. Arriving here, the rate is set from the link rather than
  from this lab's default (Decision 2), and a test pins the round trip.
- **→ Signal Lab.** A designed filter of order two or less crosses as the raw
  coefficient tier, the way Circuit Lab's does. A 53-tap FIR does not, and the
  refusal names the reason, that the receiving block holds two poles and two zeros.
  Both directions are tested.
- **→ Communications Lab.** `createComplexChain` and the complex helpers, built to
  the director's contract in §2.7. The equalisation group there is this lab's Group
  C with a channel in place of the plant.
- **→ Random Signals Lab.** Group D's estimators are the ones that lab needs, with
  their variance printed. When that lab is built, D1's statement about the
  periodogram's distribution becomes a cross-reference to its experiment.
- **→ Applied Analog Lab.** The specification pane, with `mask` and `items` in its
  props from the first commit (Decision 4).
- **↔ Circuit Lab.** Group B's bilinear transform is the mapping Circuit Lab's
  hand-over already uses. The two are pinned equal for a second-order section.

---

## 7. Testing discipline

- **Unit** (`packages/dsp`): each module against hand values and closed forms. The
  noble identities against bit patterns. Remez against the alternation theorem. The
  bilinear response against the prewarped prototype. Levinson against the normal
  equations solved directly.
- **Invariants** (§2.8), fuzzed. Four hostile corners are among them. A Q of 40
  section at 8 bits. A step size at four times its bound. A window whose ceiling sits
  below the specification. An AR order of 32 fitted to 8192 samples.
- **Experiments**: every number in §5 pinned, as a function of the knobs. Among them
  0.9061, 0.9003, 112.9 dB, 0.2500, 4.0000, 5.808e6, 133, 53, 45, 25, 60.40 dB,
  28.3423 dB, 0.7461, 0.2487, 1.0276, 13.7 dB, 0.998, 0.514, 0.996085, 81, 10433.8,
  40.2 dB and 204.8.
- **The map's promises**: a test walks every experiment's `why` and every
  cross-reference in it, and requires the referenced experiment to exist in the named
  lab. The Elements lab already has this class of test, and it is copied.
- **Guards**: the rounding-noise model's code-exercise guard, the window's
  attenuation ceiling, the order refusal on the Signal Lab link, and the analytic
  source's refusal on any waveform but a sine. Each is tested at both sides of its
  threshold.
- **Cross-lab pins**: Signal Lab's `designFir` against this lab's `windowedSinc`, bit
  for bit at every length the block allows. Circuit Lab's bilinear biquad against
  `designIir` at order two.
- **Playwright harness**: the specification pane's margin follows the knobs. The
  weight view redraws as the step size moves. The response overlay goes dashed when a
  rate changer is in the chain. No horizontal scroll at 390 px.
- **REVIEW_PLAYBOOK audit** before release, all eleven classes, with a screenshot
  pass. Class 5 matters most here: a 60 dB stopband is off the bottom of Signal Lab's
  default axis, so the floor moves with the specification.

---

## 8. Integration and the dark launch

The mechanism the other labs share, unchanged.

- Deployed **dark** at `/dsp-lab/` from the first vertical slice. Unlisted, not
  secret.
- `apps/dsp-lab/RELEASE_STATUS` reads `dark`. A test asserts that while it does, the
  splash, the root README and the other labs' LabNav contain no reference to DSP Lab.
  Flip the word to `released` and the same test demands the splash card, the README
  row and the nav entries.
- `.github/workflows/deploy.yml` gains one line,
  `cp -r apps/dsp-lab/dist _site/dsp-lab`, added by the director at integration from
  `apps/dsp-lab/NEEDS.md`.
- The flip is **Reed's action**, after the release gate in §9.

---

## 9. Phasing

Each phase ships green and deployable dark. The engine comes first because every
group depends on it, and it is the one part that cannot be built group by group.

1. **The engine.** `multirate.js`, `design.js`, `adaptive.js`, `fixpoint.js`,
   `estimate.js`, `complexChain.js` and their tests. Invariants 1 to 18 fuzzed green
   before any UI exists. **Done**, at 1459 package tests.
2. **The app shell and the specification pane.** `RELEASE_STATUS`, the release test,
   the block registry, the views, and `SpecPane` with both prop forms. Exit: the
   shell loads a stub lesson at 390 px and the release test passes dark.
3. **Rate and design.** **Groups A and B** (15). The response-and-mask view, the
   specification pane in use. Exit: every A and B number pinned, invariants 1 to 7
   exercised from the app's own registry.
4. **Fixed point.** **Group E** (6). The pole grid view, the quantised biquad block.
   Exit: E numbers pinned, the dead-band count of 81 measured from the app's
   defaults.
5. **Adaptive.** **Group C** (7). The weight view, the unknown-plant block. Exit: C
   numbers pinned, and the block proved to carry no H(z).
6. **Estimation and the transform.** **Groups D and F** (12). The density view and
   the butterfly view. Exit: D and F numbers pinned.
7. **The release gate**, in order, each blocking the next. The full audit, every
   preset and every claim, both browsers. The student sittings. Reed's own pass
   against the dark deployment. Then the flip.

Phases 3 to 6 are independent of each other once phase 2 lands, so they can run in
parallel or be cut at any boundary. The plan's own rule is that fewer groups fully
pinned beats more groups half done.

---

## 10. Non-goals (v1, stated so they are decisions rather than omissions)

- **Multirate filter banks and wavelets.** Perfect reconstruction, quadrature mirror
  filters and the discrete wavelet transform are a course of their own. Group A's
  noble identities are the door, and the room behind it is not this course.
- **Arbitrary rational rate changes.** L over M by an interpolator and a decimator in
  series is stated in A6's note as the composition it is. A single-stage rational
  changer adds no experiment.
- **Kaiser and Dolph-Chebyshev windows.** Four windows show the transition and depth
  trade. A parameterised window adds a knob and no lesson that Parks-McClellan does
  not teach better.
- **Elliptic filters.** The fourth prototype needs elliptic integrals and reaches the
  same specification in one order less than a Chebyshev. B8's table names it as the
  next step and does not build it.
- **Lattice and coupled forms.** E3 shows the direct form's pole grid and states that
  other structures have different grids. Building a second structure needs a second
  set of every fixed-point experiment.
- **The affine projection algorithm, and frequency-domain adaptive filters.** Three
  algorithms span the speed and cost trade. A fourth adds a row to C6's table.
- **Multitaper and maximum-entropy estimation past AR.** Welch and the AR model are
  the two a course teaches. Thomson's multitaper is a research tool.
- **Radix-4, split-radix and Bluestein.** F4 counts radix-2 and states that the other
  radices change the constant and not the `N log N`. A non-power-of-two transform is
  F5's refusal.
- **Fixed-point simulation of the whole chain.** The quantiser applies to one block,
  which is where a lesson can attribute what it sees. A word length on every block at
  once is a system design question and not an experiment.
- **A free-form filter design tool.** Curated specifications with editable numbers,
  as every other lab in the suite.

---

## 11. Risks, named

- **Remez convergence on a hostile specification.** The exchange stalls when the
  candidate set loses an alternation. That cost one pass of debugging already, and
  the fix was to treat every band edge as a candidate. Mitigation: `converged` is in
  the return shape, and the app draws the response it actually got. A specification
  the exchange cannot meet is reported as a miss rather than as a filter.
- **The rate changer's honesty against its readability.** A decimator with no H(z)
  leaves the response overlay blank, and a reader may read a blank overlay as a bug.
  Mitigation: the block's card carries the reason as a sentence, and the overlay
  prints it rather than showing nothing.
- **Group D needs a fact about random variables that no built lab teaches.**
  Mitigation: D1 states it as a measured property of the estimator. The
  `BACKLOG.md` entry names the Random Signals Lab as what turns it into a
  cross-reference.
- **The specification pane serves two labs and is built by one.** Mitigation: the
  Applied Analog Lab's contract is in the props from the first commit, and
  `NEEDS.md` names it as the promotion candidate with that lab as the second user.
- **Forty experiments over six independent groups is a wide lab.** Mitigation: the
  phasing cuts at group boundaries, and every group is a course a reader can finish
  on its own.
- **Numbers that are right for one filter.** Every number in §5 is for the defaults
  in §4.4. Mitigation: each pin is computed in the test from the parameters and is
  re-derived rather than typed as a constant.
- **`packages/dsp` has four other consumers.** Mitigation: additions only, no
  signature moved, and the whole suite green before every commit that touches it.
