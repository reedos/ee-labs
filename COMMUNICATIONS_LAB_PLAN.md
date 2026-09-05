# Communications Lab: the plan

The largest lab in `EE_LABS_MAP.md`, and the one most students ask for. It starts
where Signal Lab's Nonlinearity group stops, at the ring modulator that already
makes an AM signal, and it ends at OFDM through a multipath channel. Splash glyph
`⌁`, directory `apps/comms-lab`, engine in a new package `packages/comms` on the
`@ee-labs/dsp` chain.

The path, in order. Analog modulation, from the preset Signal Lab ships. Digital
modulation and the constellation. The pulse, Nyquist's criterion and the eye. The
AWGN channel, the matched filter, and the bit error rate with the Q function beside
the count. Carrier and symbol timing recovery as discrete loops. OFDM and the
cyclic prefix. Multipath, equalisation and fading. The link budget, four experiments
that hand the subject to the System Lab.

This is a draft (2026-09-05) for Reed to settle. Its dependency, the Random Signals
Lab, is being built in parallel on `lab/random-lab`. Three objects come from there
and are marked "being built" wherever this plan leans on them. They are the Q
function, the power spectral density, and the matched filter as the best detector.
Nothing in this plan assumes any other part of that lab.

The two rules that govern the other labs govern this one with no exemption. **Every
explanatory sentence is a claim about physics, and a test must measure it.** And
`CORE_SCOPE.md` decides what the engine may state exactly, what it may approximate
behind a guard, and what it declines with a reason. Communications is where the
third rule earns its keep. A bit error rate has a closed form and a counted
estimate, and the distance between them is the confidence interval, which is
content rather than noise.

Every number quoted below was computed by a script before it was written. The
scripts are not committed. The standard references are Proakis, Sklar and Haykin
for the link, and Cover and Thomas and Lin and Costello for the coding this lab
hands to the Information Lab.

---

## 0. Open decisions

### Decision 1: the name (recommended: Communications Lab)

`EE_LABS_MAP.md` §1 already calls it that, and the course it mirrors is called
that in most catalogues. LabNav short form **"Comms"**, which fits the fold of
`ELECTRONICS_LAB_PLAN.md` Decision 5. The splash card names the path in one line:
"AM to OFDM, the constellation, the eye, and the bit error rate against Eb/N0".

Alternatives considered. *Digital Communications* names five of the eight groups
and none of the analog ones. *Modem Lab* names the device rather than the course.
*Radio Lab* collides with the RF Lab, which is the front end this lab assumes.

### Decision 2: the boundary with the private simulator

`README.md` records a fourth tool, `waveform-simulator`, covering communications
and high-speed optical links in a private repository. That boundary needs a stated
edge, because this plan reopens part of the same subject. Recommended: **this lab
models the link at the symbol rates its own chain renders, and it declines the
high-speed serial and optical link.**

The line is drawn by what the reader can watch. Every waveform here is rendered at
8 kHz on Signal Lab's grid, every constellation is a few thousand symbols, and every
eye is a few hundred traces. Channel equalisation for a 25 Gbit/s serial link, jitter
decomposition and optical dispersion stay where the README puts them. The Photonics
Lab's row in the map says the same thing from the other side. The refusal is a
sentence in the app and a row in this plan's §10, not a gap.

### Decision 3: where the constellation and eye canvases live

`PROGRAM.md` §4 names this lab as the first user of the constellation and the eye
diagram. It names the Mixed-Signal Lab as the second. The rule there is that a
canvas built for one lab carries the second lab's needs in its props from the
start. Recommended: **both go into `packages/ui` in the commit that first draws
them**, with the Mixed-Signal props named in §4.2 and stubbed by a test.

The two props that second lab needs are a decision grid that is not a
constellation (a converter's code boundaries) and a per-trace colour key (a clock
phase). Both are cheap now and expensive to retrofit.

### Decision 4: where the engine lives

Recommended: **a new package, `packages/comms`**, rather than an extension of
`packages/dsp`. The map's §3 table already reserves it. The reason is ownership.
`packages/dsp` belongs to the DSP Lab overseer under `PROGRAM.md` §5, and a mapper
is not a filter. `comms` imports `fft`, `fir` and `createChain` from `dsp` and adds
nothing to it except the one item in Decision 5.

### Decision 5: the complex baseband chain

This is the load-bearing decision, and it needs the director. `createChain` in
`packages/dsp/src/chain.js` runs a `Float64Array` and calls `process(v, t)` with one
real number per sample. A constellation needs two. There are two ways to get them.

The first is to run everything at passband, real, with a carrier at `f_s/4`. Signal
Lab's views then work unchanged. The cost is the sample rate. A 2 kHz carrier at
8 kHz leaves 1000 symbols per second, and a BER of 10⁻⁶ needs 10⁸ symbols to count
a hundred errors.

The second is a complex chain. Recommended: **add `createComplexChain(registry)` to
`packages/dsp`**, a mirror of `createChain` over an interleaved `Float64Array` of
length `2n`. It is about eighty lines, it changes nothing that exists, and it is the
same block registry pattern. This lab writes the contract into its `NEEDS.md` and
the DSP Lab overseer owns the file, as `PROGRAM.md` §5 requires.

Group A runs on the real chain, because AM and FM are real passband signals and
Signal Lab's ring modulator already makes one. Groups B to G run complex.

### Decision 6: where the link budget belongs

The map gives the link budget to the System Lab, which is planned in parallel and
sits above the RF Lab. Recommended: **four experiments here, and the full budget
there.** Group H computes the noise floor, the free-space path loss, one margin and
one implementation-loss table. Antenna patterns, cascaded noise figure over a real
front end, and interference budgets stay in the System Lab. Group H's `why` names
the System Lab, and the progression test requires that lab's experiments to exist
before the reference ships.

---

## 1. The progression map

This section lists every idea the lab leans on, the experiment that teaches it, and
whether that experiment exists today. A row marked "being built" is on
`lab/random-lab` and is not this lab's work. A row marked "gap" names the group in
this plan that closes it.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| A source, a chain of blocks, time and spectrum together | every group | Signal Lab, all 35 | built |
| Sine, square, noise and the impulse as sources | A, C, D | Signal Lab `Signals and Fourier`, `Single tone` | built |
| The spectrum of a sampled signal, bins, the frame | A, C, F | Signal Lab `Sampling`, `Resolution needs time` | built |
| Aliasing and the fold | F2, G1 | Signal Lab `Sampling`, `Aliasing` | built |
| Windows and spectral leakage | F1, F5 | Signal Lab `Sampling`, `Spectral leakage` | built |
| A biquad and an FIR as exact rational H(z) | C, G | Signal Lab `Filters`, `FIR and the z-plane` | built |
| The moving average, the kernel, convolution watched | C6, D2, G3 | Signal Lab `FIR and the z-plane`, `Convolution, watched` | built |
| Group delay, and a symmetric kernel's flat delay | C6, E4 | Signal Lab `FIR and the z-plane`, `Everything arrives together` | built |
| Multiplying two signals gives sum and difference | A1, A3, E1 | Signal Lab `Nonlinearity`, `Ring modulator` | built |
| A DC offset before the multiplier brings the carrier back | A1, A2 | Signal Lab `Nonlinearity`, `AM: the carrier returns` | built |
| Clipping and its harmonics, two tones in one nonlinearity | F5, H4 | Signal Lab `Nonlinearity`, `Clipping makes harmonics` | built |
| Quantisation noise and `6.02N + 1.76` dB | H4 | Signal Lab `Nonlinearity`, `4 bits` | built |
| A seeded generator whose histogram converges at `1/√N` | D1 | Random Signals Lab, generators group | being built |
| The Q function as the tail of a Gaussian | D3 onward | Random Signals Lab, Gaussian group | being built |
| Autocorrelation and the power spectral density as a pair | C1, F1, G1 | Random Signals Lab, PSD group | being built |
| White noise through a filter, `\|H\|² S` | D2, G4 | Random Signals Lab, PSD group | being built |
| The matched filter as the best detector, SNR `2E/N0` | D2 | Random Signals Lab, estimation group | being built |
| An estimate with its confidence interval printed | D4 | Random Signals Lab, estimators group | being built |
| A discrete loop with a loop filter and its margins | E2, E3 | Control Lab (continuous), Control Lab II (discrete) | built, then being planned |
| The adaptive filter as a sequence of filters | G5 | DSP Lab, adaptive group | being built |
| Noise as a spectral density, `4kTR` and the noise figure | H1 | Electronics Lab Group O | planned |
| Mappers, Gray labels, and the constellation | B | nowhere | **gap, B** |
| Nyquist's criterion and the raised cosine | C | nowhere | **gap, C** |
| The eye diagram | C4 | nowhere | **gap, C4** |
| Bit error rate against `E_b/N_0` | D | nowhere | **gap, D** |
| Carrier and symbol timing recovery | E | nowhere | **gap, E** |
| OFDM and the cyclic prefix | F | nowhere | **gap, F** |
| Multipath, equalisation, fading | G | nowhere | **gap, G** |
| The link budget, `kTB`, path loss, margin | H | nowhere (System Lab planned in parallel) | **gap, H** |
| Capacity, and the Shannon limit on the BER plot | reader's next step | Information Lab, this plan's sibling | to be built after |

Two things the map shows that this plan does not fix, so that they are decisions
rather than omissions. **The RF front end** has no built home. The RF Lab's row in
the map is the mixer, the low-noise amplifier and the Smith chart, and Group H
assumes a noise figure rather than deriving one. **Coding** is the Information
Lab's subject and not this one. Group D's uncoded curve is the baseline the
Information Lab measures its coding gain against, and this plan owns the curve
while that plan owns the codes.

The order of the groups follows the map. Nothing in a group leans on an experiment
that comes later in this lab. Nothing leans on an experiment in a lab that is not
built. Where a Random Signals object is needed before that lab ships, this plan
names the interim. Phase 1 in §9 states the Q function and the seeded generator as
the two items whose absence blocks Group D and nothing else.

---

## 2. The engine: the link as a chain of exact blocks

### 2.1 What exists, and what is missing

`packages/dsp` already has four of the things a link needs. `createChain(registry)`
runs an injected block registry over a buffer and returns each stage, which is the
whole interaction model. `fft.js` gives the radix-2 transform that OFDM and every
spectrum need. `fir.js` gives a kernel, its response, its group delay and its zeros,
which is what a pulse shaper and an equaliser are. `signals.js` gives a seeded
addressable noise source, keyed to the absolute sample index, so a frame and its
pre-roll carry the same noise.

What is missing is listed here, and nothing else is built.

| Need | Today | This plan |
| --- | --- | --- |
| A chain over complex samples | real `Float64Array` only | `createComplexChain` in `dsp`, by `NEEDS.md` (Decision 5) |
| Bit and symbol mappers with Gray labels | none | `mappers.js` (§2.2) |
| Raised cosine and root raised cosine | windowed sinc only | `shape.js` on `fir.js` (§2.3) |
| A Gaussian generator with a seed | uniform `hash01` only | `@ee-labs/random`, being built (§2.4) |
| An AWGN channel with a stated `E_b/N_0` | none | `channel.js` (§2.4) |
| Multipath as an FIR, fading as a model | none | `channel.js` (§2.4) |
| The matched filter and the detector | none | `detect.js` (§2.5) |
| Carrier and timing loops as discrete loops | none | `sync.js` (§2.6) |
| OFDM modulator and demodulator | `fft` only | `ofdm.js` (§2.7) |
| A BER counter with its interval | none | `ber.js` (§2.8) |
| The BER closed forms | none | `ber.js` (§2.8) |

### 2.2 Mappers, and the Gray label

`mappers.js` turns bits into complex symbols and back. A constellation is a fixed
table of points with unit average energy, a label for each point, and the bit width.
Six are shipped: BPSK, QPSK, 8-PSK, 16-QAM, 64-QAM and M-PAM. Binary FSK is not a
point in the plane, so it lives in `detect.js` as two tones with its own detector.

The labels are Gray codes, built by `g(i) = i ^ (i >> 1)`. Square QAM applies the
code per dimension. The property the lab teaches is a counted fact rather than a
claim. Every pair of nearest neighbours in the plane differs in exactly one bit,
for 4-PAM, 8-PAM and 16-QAM alike. The fuzzer checks it by enumeration, and D8
measures the consequence. At 10 dB the 16-QAM symbol error rate is 7.004 × 10⁻³
and the bit error rate is 1.754 × 10⁻³. The symbol rate over four times the bit
rate is 0.9982.

Mapping is exact arithmetic on a fixed table, so `CORE_SCOPE` admits it in full and
it carries no hedge.

### 2.3 Pulse shapers

`shape.js` builds two kernels and hands them to `makeFir` in `packages/dsp`. A
pulse shaper is therefore an ordinary FIR block, with a response, a group delay and
a set of zeros the z-plane view already draws.

The **raised cosine** is the Nyquist pulse. Sampled at the symbol instants it is one
at zero and zero everywhere else, which the fuzzer checks to floating point at
`β = 0`, `0.35` and `1`. Its bandwidth is `(1 + β)R_s/2` at baseband. At the lab's
symbol rate of 1000 symbols per second that is 500 Hz at `β = 0`, 675 Hz at
`β = 0.35` and 1000 Hz at `β = 1`.

The **root raised cosine** splits the shaping between the two ends. The receive
filter is then the matched filter of §2.5, and the cascade of the two is the raised
cosine. The identity is exact in continuous time and truncated in the app, so it
carries a guard.

At 8 samples per symbol and `β = 0.35` the peak residual ISI is 4.76 × 10⁻² for a
span of 4 symbols. It is 6.54 × 10⁻⁴ at 6 symbols, 7.44 × 10⁻⁵ at 12 symbols and
2.83 × 10⁻⁵ at 16 symbols. The default span is 12 symbols. Below a span of 6
symbols the pane turns amber, because 4.76 × 10⁻² of ISI is visible in the eye.

### 2.4 Channels

`channel.js` holds three objects, and they have three different standings under
`CORE_SCOPE`.

**AWGN.** Two independent Gaussian samples per complex sample, from the seeded
generator in `@ee-labs/random`. The knob is `E_b/N_0` in dB, and the block computes
the noise variance from it, from the constellation's bits per symbol and from the
samples per symbol. The channel itself is exact arithmetic on a seeded sequence. It
is reproducible, so the same seed gives the same waveform in the scope buffer and in
the BER count. What is estimated is the error rate, not the channel, and §2.8 carries
that guard.

**Multipath.** A tapped delay line with real or complex taps, which is an FIR. It is
exactly rational in z, so it is admitted in full and its response, its zeros and its
group delay all come from `packages/dsp` unchanged. The two-ray default is
`h = [1, 0, 0, 0, 0.5]`. Its magnitude response peaks at 3.522 dB, notches at
−6.021 dB, and puts a notch every 2000 Hz with the first at 1000 Hz. A tap of 0.9
at the same delay deepens the notch to −20.000 dB.

**Fading.** A labelled statistical model, and the only object in this lab that is
neither exact nor guarded by a threshold. Flat Rayleigh fading multiplies the symbol
by a complex Gaussian with unit mean square. Three assumptions are printed on the
pane: many scattered paths of similar strength, no line of sight, and a coherence
time longer than one symbol. What the model predicts is checked against its own
closed form.

The average BER of BPSK under flat Rayleigh fading is `½(1 − √(γ̄/(1 + γ̄)))`. It
reads 2.3269 × 10⁻² at 10 dB and 2.4814 × 10⁻³ at 20 dB. Reaching 10⁻⁵ takes
43.98 dB against 9.588 dB in AWGN, a penalty of 34.39 dB. The Rician case adds a K
factor and the same label.

### 2.5 The matched filter and the detectors

`detect.js` correlates the received samples against the transmit pulse and samples
once per symbol. The claim it makes is the one the Random Signals Lab proves, and
this lab measures. The output signal-to-noise ratio of a filter matched to a pulse of
energy `E` in noise of density `N_0/2` is `2E/N_0`, whatever the pulse shape is. The
fuzzer checks it by simulation. For a rectangular pulse of unit energy at
`N_0 = 0.05`, the mean output is 1.000096 against an expected 1.000000, the variance
is 2.5001 × 10⁻² against `EN_0/2 = 2.5000 × 10⁻²`, and the measured ratio is 40.006
against `2E/N_0 = 40.000`.

Three detectors ship. **Minimum distance** over the constellation table, which is
the maximum-likelihood detector for equally likely symbols in AWGN, and is exact
arithmetic. **Noncoherent FSK**, two matched filters and a magnitude comparison,
whose closed form is `½e^{−γ_b/2}`. **Soft metrics**, the per-bit log-likelihood
ratio, which is what the Information Lab's decoders read. The soft metric is an
exact function of the received sample under the stated noise variance.

### 2.6 Symbol timing and carrier recovery

`sync.js` holds two discrete loops, and both are written as loops rather than as
one-shot estimators, because the loop is the lesson.

The **Costas loop** recovers the carrier phase from a suppressed-carrier signal. Its
error signal is the product of the in-phase and quadrature arms for BPSK, and the
four-quadrant version for QPSK. The loop filter is proportional plus integral, which
makes a second-order loop. The **early-late gate** recovers the symbol timing. Its
error signal is the difference of two correlations taken half a symbol either side of
the decision instant.

Both are parameterised the way a designer parameterises them, by the normalised loop
bandwidth `B_nT` and the damping ratio `ζ`. At `ζ = 0.707` the relation is
`B_n = ω_n(ζ + 1/4ζ)/2`. At `B_nT = 0.02` and a symbol rate of 1000 symbols per
second, `B_n` is 20.00 Hz, `ω_n` is 37.71 rad/s, and the loop settles to 5 % in
172.50 ms, which is 173 symbols. At `B_nT = 0.005` the settling is 690 symbols and
the loop signal-to-noise ratio is 6.02 dB better. That trade is E5.

**The hand-over to Control Lab II is by name.** Both loops are discrete second-order
loops with a zero-order hold, which is that lab's subject. This plan does not
duplicate it. E2 and E3 print the loop's `H(z)`, its poles and its margins, and the
`why` names Control Lab II's digital group as the place the design is done. When
that lab is built, the link carries the loop as a plant. Until then the numbers are
computed here and pinned here.

### 2.7 OFDM

`ofdm.js` is a modulator and a demodulator around `fft`. The modulator takes `N`
complex symbols, runs the inverse transform, and prepends the last `N_cp` samples of
the result as the cyclic prefix. The demodulator strips the prefix, runs the forward
transform, and divides each subcarrier by the channel's response at that subcarrier.

The claim, and the invariant that holds it, is exactness. A cyclic prefix turns the
channel's linear convolution into a circular one, so the transform diagonalises it,
and one complex division per subcarrier recovers the symbol. The fuzzer checks it at
`N = 16` and `N_cp = 4`. Through a one-tap channel the worst symbol error after
equalisation is 1.274 × 10⁻¹⁴, through a four-tap channel 1.406 × 10⁻¹⁴, and through
a five-tap channel 1.393 × 10⁻¹⁴. Through a six-tap channel it is 1.543 × 10⁻², which
is not floating point. The prefix covers a channel of `N_cp + 1` taps and no more.

The defaults are `N = 64` and `N_cp = 16` at 8 kHz. That gives a subcarrier spacing
of 125 Hz, a useful symbol of 8.00 ms, a prefix of 2.00 ms, a whole symbol of
10.00 ms and an OFDM symbol rate of 100 per second. With 52 used subcarriers of
which 4 are pilots, the occupied bandwidth is 6500 Hz and the uncoded 16-QAM rate is
19 200 bit/s. The prefix costs 20.00 % of the rate, which is 0.969 dB, and the
pilots cost a further 0.348 dB.

`papr` returns the peak-to-average power ratio of one OFDM symbol. Its worst case is
`N`, which is 18.062 dB at `N = 64`. Its distribution over random symbols has the
closed form `Pr(PAPR > γ) = 1 − (1 − e^{−γ})^N` on the Nyquist-rate samples, which
gives 2.9014 × 10⁻³ at 10 dB and 8.3767 × 10⁻⁶ at 12 dB for `N = 64`. The level
exceeded once in 10 000 symbols is 11.261 dB at `N = 64`, 11.690 dB at `N = 256` and
12.080 dB at `N = 1024`. The closed form is exact for the Nyquist-rate samples and is
labelled as such, because the continuous-time peak is higher and the pane says so.

### 2.8 The BER counter and its interval

`ber.js` has two halves, and keeping them apart is the point of the whole lab.

**The closed forms** are exact functions, tested against hand values. BPSK and QPSK
are `Q(√(2γ_b))`. Coherent orthogonal FSK is `Q(√γ_b)`. Noncoherent FSK is
`½e^{−γ_b/2}`, and DBPSK is `½e^{−γ_b}`. Square QAM is computed exactly rather than
by the union bound, by enumerating the per-dimension PAM decision regions and
weighting each by the Hamming distance of the two Gray labels. At 10 dB that gives
3.8721 × 10⁻⁶ for BPSK, 7.8270 × 10⁻⁴ for coherent FSK and 1.7542 × 10⁻³ for
16-QAM.

**The count** runs the chain and compares bits. It is an estimate, and it ships with
its interval as the guard `CORE_SCOPE` Rule 3 requires. The interval is the normal
approximation at 95 %, `p̂ ± 1.96√(p̂(1 − p̂)/N)`, and the pane prints the number of
errors behind the point. One hundred errors give a relative half-width of 19.6 %, and
385 errors are needed for 10 %. Below 30 errors the point is drawn hollow and the
readout gives the interval instead of the value, because at that count the interval
spans a factor of two.

The measured points sit on the closed form. At 2 000 000 trials the counted BPSK
rate is 7.8554 × 10⁻² at 0 dB, against an exact 7.8650 × 10⁻². At 4 dB it is
1.2523 × 10⁻² against 1.2501 × 10⁻², and at 8 dB 1.9650 × 10⁻⁴ against
1.9091 × 10⁻⁴. All five tested points fall inside their 95 % interval, which is
invariant 7.

The cost of the count is what sets the app's defaults. One hundred errors take 1272
symbols at 0 dB, 41 870 at 6 dB, 523 800 at 8 dB and 2.583 × 10⁷ at 10 dB. So the
plot draws the closed form at every point and the count only where a count can be
read, and the pane states which points were counted.

### 2.9 Analog modulation

Group A runs on the real chain, and four of its five blocks already exist in Signal
Lab. `comms` adds one modulator and two detectors.

**AM** is a DC offset and a multiply, which is Signal Lab's `AM: the carrier returns`
preset with a knob for the modulation index. At a carrier of 1000 Hz and a message of
250 Hz the sidebands sit at 750 and 1250 Hz. Each sideband is `m/2` of the carrier
amplitude, so −12.041 dB at `m = 0.5` and −6.021 dB at `m = 1`. The power in the
sidebands is `m²/(2 + m²)` of the total, which is 11.111 % at `m = 0.5` and 33.333 %
at `m = 1`.

**FM** is a phase integrator on the message. Its spectrum is a Bessel series, and
`comms` ships the Bessel functions as exact series with a tested precision. At
`β = 2` the coefficients are `J₀ = 0.2239`, `J₁ = 0.5767`, `J₂ = 0.3528`,
`J₃ = 0.1289` and `J₄ = 0.0340`. Carson's bandwidth is `2(Δf + f_m)`, which is
1500 Hz, and it holds 99.759 % of the power rather than all of it. The pane prints
the fraction, because Carson's rule is a rule of thumb and the lab measures it. The
carrier line vanishes at `β = 2.404826`, the first zero of `J₀`, which is a deviation
of 601.2 Hz.

**The detectors.** The envelope detector is a rectifier and a low-pass filter, both
of which Signal Lab has. The coherent detector is a multiply by a local carrier and
a low-pass filter. The figure of merit at the detector, referred to DSB-SC at one, is
0.1111 for AM at `m = 0.5`, 0.3333 for AM at `m = 1`, and `1.5β²` for FM, which is
6.0000 at `β = 2`. In decibels that is −9.542 dB, −4.771 dB and 7.782 dB, and the FM
figure is bought with three times the bandwidth.

### 2.10 Measures

Everything Signal Lab measures, plus the eleven below.

- The constellation's error vector magnitude, in per cent and in dB.
- The eye's opening at the decision instant, and its width at the zero crossings.
- The bit error rate, counted, with its interval and its error count.
- The bit error rate, closed form, at the same `E_b/N_0`.
- The symbol error rate beside it.
- `E_b/N_0`, `E_s/N_0` and the in-band signal-to-noise ratio, with the conversions
  printed.
- The occupied bandwidth at a stated shoulder, in Hz and as a multiple of the
  symbol rate.
- The peak-to-average power ratio of the frame.
- The residual carrier phase error and the residual timing error, in degrees and in
  fractions of a symbol.
- The loop bandwidth, its damping and its settling time.
- The channel's magnitude response, with its notch depth and notch spacing.
- The equaliser's taps, its residual ISI and its noise enhancement in dB.

### 2.11 Invariants, the fuzzer's checklist

Across random bit streams, seeds, constellations, roll-offs and channel taps:

1. **The mapper round-trips.** Demapping a mapped stream with no channel returns the
   original bits, for every constellation, to exact equality.
2. **Gray labels are Gray.** Every pair of nearest neighbours in the plane differs in
   exactly one bit, checked by enumeration for every shipped constellation.
3. **Unit energy.** Every constellation's mean square is 1.0 to floating point, so
   `E_s/N_0` and `E_b/N_0` differ by exactly `10 log₁₀(log₂M)`.
4. **Nyquist.** The raised cosine sampled at the symbol instants is 1 at zero and
   below 10⁻¹⁵ at every other multiple of the symbol period.
5. **The matched pair.** The root raised cosine convolved with itself equals the
   raised cosine, to the residual the span allows, and the residual the pane prints
   is the measured one.
6. **The matched filter's gain.** The output signal-to-noise ratio is `2E/N_0` to
   within the simulation's own interval, for every pulse shape and every span.
7. **The count sits on the form.** The counted BER falls inside its own 95 %
   interval around the closed form, at every tested `E_b/N_0` with at least 100
   errors, for BPSK, QPSK, 16-QAM and coherent FSK.
8. **The cyclic prefix is exact.** OFDM recovers every symbol to floating point
   through any channel whose impulse response is `N_cp + 1` taps or fewer, and fails
   measurably at `N_cp + 2`.
9. **The channel is linear.** Two inputs through the multipath block sum to the sum
   of their outputs, to floating point, and the block's `H(z)` from `firResponse`
   equals the measured transfer at all 241 sweep points.
10. **The loops settle.** A second-order Costas loop with a constant frequency offset
    inside its pull-in range settles to a phase error below 0.5 degrees, and a
    first-order loop does not.
11. **The seed reproduces.** The same seed gives bit-identical waveforms, and two
    different seeds give BER estimates whose difference is inside the sum of their
    intervals.
12. **Cross-lab.** The pulse shaper's `H(z)` sent to Signal Lab as an FIR gives the
    same response there. The loop's `H(z)` sent to Control Lab as a plant gives the
    same margins there. The uncoded BER curve read by the Information Lab is this
    lab's own closed form, to floating point.
---

## 3. Models: the block library

Signal Lab's `BLOCK_TYPES` shape is kept exactly. Each block has a label, defaults,
a `make(params, sampleRate)` returning `{ process, settle }`, and a `response` that
returns `null` when the block has no transfer function. These are added, in a
`comms` registry that the app injects into `createComplexChain`.

| Block | What it does | Scope stance |
| --- | --- | --- |
| Bit source | seeded pseudo-random bits, or a fixed pattern, with a length | exact, seeded |
| Mapper | bits to constellation points, Gray labelled, unit mean square | exact |
| Pulse shaper | raised cosine or root raised cosine, β, span, samples per symbol | exact FIR, span guarded |
| Upconverter | complex baseband to real passband at `f_c` | exact |
| AWGN | complex Gaussian at a stated `E_b/N_0`, seeded | exact channel, estimate guarded |
| Multipath | a tapped delay line, real or complex taps | exact rational H(z) |
| Fading | flat Rayleigh or Rician, one gain per symbol | labelled statistical model |
| Phase and frequency offset | a constant rotation and a ramp | exact |
| Matched filter | correlation with the transmit pulse | exact |
| Symbol sampler | one sample per symbol at a stated instant | exact |
| Costas loop | second-order carrier recovery, `B_nT` and `ζ` | exact discrete loop |
| Early-late gate | second-order timing recovery, gate spacing | exact discrete loop |
| Equaliser | zero forcing, MMSE, or LMS from the DSP Lab | exact for the first two, LMS as a sequence |
| Detector | minimum distance, or noncoherent for FSK | exact |
| OFDM modulator | N subcarriers, `N_cp` prefix, pilot pattern | exact |
| OFDM demodulator | prefix strip, transform, one-tap equalise | exact |
| BER counter | bit comparison against the source, with the interval | estimate, interval printed |
| AM modulator | index m, carrier `f_c`, on the real chain | exact |
| FM modulator | deviation Δf, carrier `f_c`, on the real chain | exact |
| Envelope detector | rectify and low-pass, both from Signal Lab | exact |

Three of these are Signal Lab's blocks used unchanged. The ring modulator is the
multiply inside the AM modulator and the coherent detector. The rectifier is the
envelope detector's first half. The biquad is its second half.

**Preset description.** As Signal Lab: each experiment is a `patch` of sources and
blocks with a `note`, a `try`, chips, a `featured` control and a `terms` list. The
schema does not change. The one addition is a `views` field naming which panes open,
because this lab has seven and Signal Lab has four.

---

## 4. The app

### 4.1 Layout

Signal Lab's shape, unchanged: a sidebar with LabNav, the report link, the
experiment groups, the block rack with NumFields and chips, and the math panel.
The main area has a topbar of meters and two panes with a pane selector each.
Phone-width first, no horizontal scroll at 390 px, harness-checked.

The topbar shows `E_b/N_0` first, then the experiment's headline numbers, then the
constellation in use and the samples per symbol. The order matters, because
`E_b/N_0` is the knob half the lab turns.

### 4.2 Views

Four are Signal Lab's, reused without a fork. Three are new.

- **Scope**, reused. The complex chain draws in-phase and quadrature as two traces,
  which is one prop on the existing canvas. The eye's decision instants are marked.
- **Spectrum**, reused. The occupied bandwidth is marked at a stated shoulder, and
  the raised cosine's roll-off is drawn against the ideal brick wall.
- **Impulse response and z-plane**, reused. A pulse shaper and an equaliser are both
  FIRs, so the kernel view and the zero plot apply unchanged.
- **Flow strip**, reused. The buffer after every block, which is where a reader sees
  the pulse shaper widen the pulse and the matched filter narrow it again.
- **Constellation**, new, in `packages/ui`. Points, decision boundaries, the ideal
  grid, and the error vector from each point to its ideal. Props for the second
  lab: `grid` takes arbitrary decision boundaries rather than a constellation, and
  `colorBy` keys each point to a phase or a code. The Mixed-Signal Lab's converter
  output is the same picture with a different grid.
- **Eye diagram**, new, in `packages/ui`. Traces of two symbol periods, overlaid,
  with the opening and the jitter marked. Props for the second lab: `traceKey` for
  the per-trace colour, and `unitLabel` so a converter's eye reads in volts.
- **BER plot**, new, in the app. Log `E_b/N_0` against log BER, the closed form as a
  line, the counted points as markers with their intervals, and a vertical line
  where the Information Lab draws the Shannon limit. This canvas takes a `limits`
  prop from the start, because that lab is its second user.
- **Trellis**, not here. The Information Lab owns it, and this plan's §6 says so.

### 4.3 Numbers

The defaults are chosen for three reasons. Every quoted number is round enough to
remember. The pictures fit a phone. And the chain sits on Signal Lab's own grid.

- **The grid.** `f_s = 8000 Hz`, symbol rate 1000 symbols per second, 8 samples per
  symbol, symbol period 1.00 ms. The analog group's carrier is 1000 Hz and its
  message 250 Hz, which is Signal Lab's `AM: the carrier returns` preset exactly.
  The passband carrier for Group B is 2000 Hz, which is `f_s/4`.
- **AM.** `m = 0.5` by default. Sidebands at 750 and 1250 Hz, each 12.041 dB below
  the carrier, carrying 11.111 % of the power. At `m = 1` they are 6.021 dB down and
  carry 33.333 %.
- **FM.** `Δf = 500 Hz`, so `β = 2`. Carson's bandwidth 1500 Hz, holding 99.759 % of
  the power. `J₀ = 0.2239`, `J₁ = 0.5767`, `J₂ = 0.3528`, `J₃ = 0.1289`. The carrier
  null is at `β = 2.404826`, a deviation of 601.2 Hz.
- **The pulse.** `β = 0.35`, span 12 symbols. Baseband bandwidth 675 Hz, passband
  1350 Hz, spectral efficiency 1.4815 bit/s/Hz for QPSK and 2.9630 for 16-QAM. At
  `β = 0` those are 500 Hz, 1000 Hz, 2.0000 and 4.0000.
- **The eye.** At `β = 0.35` a timing error of 0.05 T leaves an opening of 0.8619
  and an error of 0.10 T leaves 0.7166. At `β = 0` the same errors leave 0.5695 and
  0.1395, and 0.20 T closes the eye. At `β = 1` they leave 0.9548 and 0.8959.
- **BER at 10 dB.** BPSK reads 3.8721 × 10⁻⁶, coherent FSK 7.8270 × 10⁻⁴, 16-QAM
  1.7542 × 10⁻³ and 64-QAM 2.653 × 10⁻².
- **`E_b/N_0` for a BER of 10⁻⁵.** 9.588 dB for BPSK and QPSK, 12.598 dB for
  coherent FSK, 13.352 dB for noncoherent FSK. Then 10.342 dB for DBPSK, 13.435 dB
  for 16-QAM and 17.787 dB for 64-QAM.
- **The counted BER.** 4096 symbols a frame. One hundred errors take 1272 symbols at
  0 dB, 8000 at 4 dB, 41 870 at 6 dB and 523 800 at 8 dB. Above 8 dB the plot draws
  the closed form alone and the pane says so.
- **The loops.** `B_nT = 0.02`, `ζ = 0.707`. `B_n = 20.00 Hz`, `ω_n = 37.71 rad/s`,
  settling to 5 % in 172.50 ms, which is 173 symbols. The early-late gate spacing is
  0.5 T, which is 4 samples.
- **OFDM.** `N = 64`, `N_cp = 16`, 52 used subcarriers, 4 of them pilots.
  Subcarrier spacing 125 Hz, useful symbol 8.00 ms, prefix 2.00 ms, whole symbol
  10.00 ms, 100 OFDM symbols per second. Occupied bandwidth 6500 Hz. Uncoded 16-QAM
  rate 19 200 bit/s. Prefix cost 0.969 dB, pilot cost 0.348 dB. Worst-case PAPR
  18.062 dB, and 11.261 dB exceeded once in 10 000 symbols.
- **Multipath.** `h = [1, 0, 0, 0, 0.5]`, a 4-sample echo at half amplitude. Peak
  3.522 dB, notch −6.021 dB, notch spacing 2000 Hz, first notch at 1000 Hz. The
  coherence bandwidth is 1000 Hz, which is narrower than the 1350 Hz the signal
  occupies, so the channel is frequency selective.
- **The link budget.** 2.4 GHz, so `λ = 124.91 mm`. Free-space path loss 100.052 dB
  at 1 km. Transmit 20 dBm, two antennas at 2 dBi each, so −76.052 dBm received.
  Noise in 1 MHz at a noise figure of 6 dB is −107.975 dBm, so the signal-to-noise
  ratio is 31.923 dB. At 2 Mbit/s that is 28.913 dB of `E_b/N_0`, against the
  9.588 dB QPSK needs, a margin of 19.325 dB. `kT` at 290 K is −173.9752 dBm/Hz.

---

## 5. Curriculum: 50 experiments in 8 groups

Format, as the other plans: **the claim** the note makes, what the reader turns, and
what is **measured** against what **formula**. Every quoted number becomes a pinned
test. Each experiment ships with `see`, `try` and `why` in the three registers,
within the STYLE.md budgets. The order is the progression map's.

### Group A: Analog modulation (7)

Signal Lab's Nonlinearity group already makes an AM signal and calls its parts by
name. This group turns those presets into a course, on the real chain, with the
index and the deviation as knobs.

- **A1 · AM and its index.** A 250 Hz message on a 1000 Hz carrier, with a DC offset
  before the multiplier. The sidebands sit at 750 and 1250 Hz and each is `m/2` of
  the carrier. Measured: the sideband level at three indices, −18.062 dB at
  `m = 0.25`, −12.041 dB at `m = 0.5` and −6.021 dB at `m = 1`. Formula:
  `20 log₁₀(m/2)`.
- **A2 · Where the power goes.** The carrier carries no information and most of the
  power. Measured: the fraction in the sidebands, `m²/(2 + m²)`, which is 3.030 % at
  `m = 0.25`, 11.111 % at `m = 0.5` and 33.333 % at `m = 1`. The reader turns `m`
  and reads the carrier line falling relative to the sidebands.
- **A3 · Envelope detection, and where it fails.** A rectifier and a low-pass filter
  recover the message when `m ≤ 1`. At `m = 1.5` the envelope folds through zero and
  the recovered waveform gains a second harmonic. Measured: the total harmonic
  distortion at `m = 0.5`, `m = 1.0` and `m = 1.5`, from the lab's FFT.
- **A4 · DSB-SC and the coherent detector.** Remove the DC offset and the carrier
  line leaves, which is Signal Lab's `Ring modulator` preset. An envelope detector
  now gives the wrong answer, and a multiply by a local carrier gives the right one.
  Measured: 100 % of the power in the sidebands, and the recovered message's error
  under a 30 degree local phase error, `cos 30° = 0.8660`.
- **A5 · Single sideband, and half the bandwidth.** One sideband carries the whole
  message. Measured: the occupied bandwidth, 250 Hz against DSB-SC's 500 Hz, and the
  recovered message's amplitude. The phasing method's Hilbert transform is an FIR,
  so its own delay is on screen.
- **A6 · FM and the Bessel lines.** Deviation 500 Hz on a 250 Hz message gives
  `β = 2`. Measured: the line amplitudes against `J_n(2)`, 0.2239, 0.5767, 0.3528,
  0.1289 and 0.0340. Then the carrier null. Set `β = 2.404826` and the 1000 Hz line
  vanishes, because that is the first zero of `J₀`.
- **A7 · Carson's bandwidth, and what FM buys.** Measured: the power inside
  `2(Δf + f_m)`, which is 99.759 % at `β = 2` rather than 100 %. Then the figure of
  merit `1.5β²`, 7.782 dB at `β = 2` against −4.771 dB for AM at `m = 1`, bought
  with three times the bandwidth. Formula: the Bessel series and the FM noise
  triangle.

### Group B: Digital modulation and constellations (8)

The constellation canvas arrives here, and every experiment in the rest of the lab
uses it. The chain becomes complex at B1.

- **B1 · BPSK is one bit on one axis.** Two points at ±1. Measured: the mean square
  is 1.0, the minimum distance is 2.0, and the spectrum is the pulse's spectrum
  shifted to the carrier. The reader turns the bit rate and watches the spectrum
  widen in proportion.
- **B2 · QPSK is two BPSK signals at right angles.** Four points, two bits each.
  Measured: the same mean square, a minimum distance of `√2 = 1.4142`, and twice the
  bit rate in the same bandwidth. Formula: the in-phase and quadrature arms are
  independent, which D5 turns into a BER statement.
- **B3 · Gray mapping costs nothing and saves a bit.** Two label sets on the same
  four points, Gray and natural binary. Measured: the largest Hamming distance
  between nearest neighbours, 1 for Gray and 2 for natural binary, and the BER at
  8 dB under each.
- **B4 · 8-PSK trades distance for rate.** Eight points on the unit circle, three
  bits each. Measured: the minimum distance, `2 sin(π/8) = 0.7654`, against QPSK's
  1.4142, and the bandwidth unchanged.
- **B5 · 16-QAM puts the points on a grid.** Four bits a symbol, and the amplitude
  now carries information. Measured: the minimum distance at unit mean square,
  `√(2/5) = 0.6325`, and the peak-to-average ratio of the constellation, 2.553 dB.
- **B6 · The constellation under noise.** Add AWGN and the points become clouds.
  Measured: the error vector magnitude against `E_s/N_0`, and the fraction of points
  outside their decision region. At 10 dB of `E_b/N_0` the 16-QAM symbol error rate
  is 7.004 × 10⁻³, which is 7 points in a thousand.
- **B7 · FSK is not a point in the plane.** Two tones, orthogonal when their spacing
  is a multiple of half the symbol rate. Measured: the correlation between the two
  tones against their spacing, zero at 500 Hz and 1000 Hz for a 1000 symbol per
  second rate, and the occupied bandwidth.
- **B8 · The phase ambiguity, and differential encoding.** A carrier recovery loop
  locks 180 degrees out on BPSK and every 90 degrees on QPSK. Differential encoding
  removes the ambiguity. Measured: the BER cost, a factor of two at high
  `E_b/N_0`, so 10.342 dB against 9.588 dB for a BER of 10⁻⁵.

### Group C: The pulse and intersymbol interference (6)

- **C1 · A rectangular pulse has infinite bandwidth.** One symbol per millisecond as
  a rectangle. Measured: the sinc spectrum, its first null at 1000 Hz, and the
  −13.3 dB first sidelobe. The reader adds a channel bandwidth and watches the pulse
  spread into its neighbours.
- **C2 · Nyquist's criterion.** A pulse that is zero at every other symbol instant
  causes no interference, whatever it does between them. Measured: the raised
  cosine's samples at `k = 0, 1, 2, 3, 4`, which are 1 and then below 10⁻¹⁵.
  Formula: the folded spectrum sums to a constant.
- **C3 · The roll-off buys bandwidth with time.** Measured: the bandwidth,
  `(1 + β)R_s/2`, which is 500 Hz at `β = 0`, 625 Hz at `β = 0.25`, 675 Hz at
  `β = 0.35` and 1000 Hz at `β = 1`. Then the tail. At `β = 0` the pulse decays as
  `1/t` and the worst-case peak of a random stream summed over ±40 symbols is 3.6063,
  which is 11.141 dB. At `β = 0.35` it is 1.7270, which is 4.746 dB.
- **C4 · The eye diagram.** Overlay two symbol periods of a long stream. Measured:
  the opening at the decision instant, 1.0000 with no timing error at every β, and
  the width of the crossing region. This is the canvas the Mixed-Signal Lab reuses.
- **C5 · A timing error closes the eye.** Move the decision instant. Measured: the
  worst-case opening at 0.05 T, 0.10 T and 0.20 T. At `β = 0.35` those are 0.8619,
  0.7166 and 0.4108. At `β = 0` they are 0.5695, 0.1395 and negative, so the eye
  closes entirely. At `β = 1` they are 0.9548, 0.8959 and 0.7364.
- **C6 · The root raised cosine, split between the ends.** The transmit filter and
  the receive filter are each the square root, and the cascade is the raised cosine.
  Measured: the residual ISI against the span, 4.76 × 10⁻² at 4 symbols,
  6.54 × 10⁻⁴ at 6, 7.44 × 10⁻⁵ at 12 and 2.83 × 10⁻⁵ at 16. Formula: truncation,
  and the guard of §2.3.

### Group D: The AWGN channel and the bit error rate (8)

This group is the lab's centre, and it is the one that waits on the Random Signals
Lab. Every experiment shows the closed form and the count together.

- **D1 · The channel is a seeded Gaussian.** Add noise at a stated `E_b/N_0` and
  watch the constellation spread. Measured: the sample variance of the noise against
  `N_0/2`, and the histogram against the Gaussian density. Cross-reference: the
  Random Signals Lab's generator group by name.
- **D2 · The matched filter.** Correlate with the transmit pulse. Measured: the
  output signal-to-noise ratio, `2E/N_0`, which is 40.006 against an expected 40.000
  for a unit-energy pulse at `N_0 = 0.05`. Then the same measurement for a
  mismatched filter, which is lower. Formula: the Cauchy-Schwarz bound.
- **D3 · BPSK, the form and the count.** Measured: the counted BER at 0, 2, 4, 6 and
  8 dB against `Q(√(2γ_b))`. At 2 000 000 trials the counts read 7.8554 × 10⁻²,
  3.7592 × 10⁻², 1.2523 × 10⁻², 2.4220 × 10⁻³ and 1.9650 × 10⁻⁴. The exact values
  are 7.8650 × 10⁻², 3.7506 × 10⁻², 1.2501 × 10⁻², 2.3883 × 10⁻³ and
  1.9091 × 10⁻⁴.
- **D4 · The interval is the guard.** Reduce the frame length and the point moves.
  Measured: the 95 % half-width against the error count, 19.6 % at 100 errors and
  6.2 % at 1000. Formula: `1.96√(p(1 − p)/N)`. Then the rule. 385 errors are needed
  for a half-width of 10 %.
- **D5 · QPSK costs nothing per bit.** Measured: the QPSK BER at 10 dB,
  3.8721 × 10⁻⁶, equal to BPSK's to floating point, while the symbol error rate is
  7.7442 × 10⁻⁶, exactly twice it. Formula: two independent BPSK arms with Gray
  labels.
- **D6 · 16-QAM buys rate with 3.85 dB.** Measured: the `E_b/N_0` for a BER of
  10⁻⁵, which is 13.435 dB for 16-QAM against 9.588 dB for QPSK. Then 64-QAM at
  17.787 dB, a further 4.352 dB for a further two bits a symbol.
- **D7 · Coherent against noncoherent FSK.** Measured: the `E_b/N_0` for 10⁻⁵,
  12.598 dB coherent and 13.352 dB noncoherent, against BPSK's 9.588 dB. The 3.010 dB
  gap between coherent FSK and BPSK is the orthogonal signalling penalty, exactly
  a factor of two in the argument of Q.
- **D8 · Symbol errors and bit errors.** Measured: the ratio of the symbol error
  rate to `log₂M` times the bit error rate, which is 0.9982 for 16-QAM at 10 dB and
  1.0000 for QPSK. Formula: Gray labelling makes the likely symbol error a
  one-bit error, and B3 already showed why.
### Group E: Synchronisation (5)

Every experiment before this one assumed the receiver knew the carrier phase and the
symbol instant. This group removes both assumptions and recovers them with loops.

- **E1 · A phase error rotates the constellation.** Offset the local carrier.
  Measured: the rotation in degrees, equal to the offset, and the BER against it. A
  30 degree error scales the useful component by `cos 30° = 0.8660`, which costs
  1.249 dB. At 90 degrees the constellation is unreadable and the BER is 0.5.
- **E2 · The Costas loop finds the phase.** A suppressed-carrier signal has no
  carrier line to lock to, and the product of the two arms is an error signal.
  Measured: the residual phase error after lock, below 0.5 degrees, and the time to
  reach it, 173 symbols at `B_nT = 0.02`. The pane prints the loop's `H(z)` and
  names Control Lab II's digital group.
- **E3 · A frequency offset needs a second-order loop.** Set a 5 Hz offset on a
  1000 symbol per second link. Measured: the static phase error of a first-order
  loop, which is nonzero, and of a second-order loop, which settles to zero. Formula:
  the loop's type, and the final-value theorem Control Lab already teaches.
- **E4 · The early-late gate finds the instant.** Two correlations half a symbol
  either side of the decision instant. Measured: the S-curve, its slope at zero, and
  its sign change at ±0.25 T for a gate spacing of 0.5 T. Then the residual timing
  error, and the eye closing when the loop is opened.
- **E5 · Loop bandwidth is a trade.** Narrow the loop and the jitter falls but the
  acquisition takes longer. Measured: settling time and phase variance at four
  bandwidths. At `B_nT = 0.005` the settling is 690 symbols and the loop
  signal-to-noise ratio is 30.00 dB. At `B_nT = 0.05` they are 69 symbols and
  20.00 dB.

### Group F: OFDM (6)

- **F1 · Subcarriers overlap and stay orthogonal.** Two tones spaced at exactly
  `1/T_u` overlap in the spectrum and correlate to zero over the symbol. Measured:
  the correlation, below 10⁻¹⁵ at a spacing of 125 Hz over 8.00 ms, and nonzero at
  120 Hz. Cross-reference: Signal Lab's `Spectral leakage`, because this is the same
  fact from the other side.
- **F2 · The inverse transform is the modulator.** 64 complex symbols in, 64 samples
  out. Measured: each subcarrier's amplitude recovered by the forward transform, to
  floating point, and the time waveform's Gaussian-looking envelope.
- **F3 · The cyclic prefix makes convolution circular.** Prepend the last 16 samples.
  Measured: the worst symbol error after a one-tap equaliser, 1.406 × 10⁻¹⁴ through a
  4-tap channel and 1.393 × 10⁻¹⁴ through a 5-tap channel. Then remove one tap of
  prefix. At a 6-tap channel the error jumps to 1.543 × 10⁻², which is not floating
  point. Formula: the prefix covers `N_cp + 1` taps.
- **F4 · One divide per subcarrier.** A frequency-selective channel becomes 64 flat
  ones. Measured: the per-subcarrier channel estimate from the pilots against the
  channel's true response, and the constellation before and after the divide.
- **F5 · The peak-to-average ratio.** Measured: the worst case, `N`, which is
  18.062 dB at `N = 64`. Then the distribution, `1 − (1 − e^{−γ})^N`, which gives
  2.9014 × 10⁻³ at 10 dB and 8.3767 × 10⁻⁶ at 12 dB. The level exceeded once in
  10 000 symbols is 11.261 dB at `N = 64` and 12.080 dB at `N = 1024`. Then a clipper
  from Signal Lab's Nonlinearity group, and the spectral regrowth it causes.
- **F6 · What the prefix costs.** Measured: the rate loss, 20.00 % at `N_cp = 16`
  and `N = 64`, which is 0.969 dB, falling to 0.512 dB at `N = 128`. Then the pilot
  cost, 0.348 dB for 4 pilots in 52 subcarriers. The reader lengthens the symbol and
  watches both costs fall while the channel's coherence time becomes the new limit.

### Group G: Multipath and equalisation (6)

- **G1 · Two paths make a notch.** An echo at half amplitude, four samples late.
  Measured: the peak at 3.522 dB, the notch at −6.021 dB, notch spacing 2000 Hz and
  the first notch at 1000 Hz. Formula: `|H(f)|² = 1 + a² + 2a cos(2πfτ)`. At
  `a = 0.9` the notch is −20.000 dB.
- **G2 · The notch closes the eye.** The same channel under the same pulse. Measured:
  the eye opening before and after the channel, and the BER at a fixed `E_b/N_0`
  with and without the echo. The error floor is visible, because ISI does not fall
  when the noise falls.
- **G3 · The zero-forcing equaliser inverts the channel.** Measured: the taps, the
  residual ISI after equalisation, below 10⁻³ for a 21-tap equaliser on the two-ray
  channel, and the eye reopened. Formula: the equaliser is the channel's inverse
  truncated to a finite kernel, which is an FIR, so Signal Lab's z-plane view draws
  its zeros.
- **G4 · Inverting a notch amplifies noise.** Measured: the noise enhancement in dB
  at the notch frequency, and the BER against the zero-forcing equaliser and the
  MMSE one at the same `E_b/N_0`. The MMSE solution trades residual ISI for noise
  and wins where the notch is deep.
- **G5 · The adaptive equaliser learns the channel.** LMS on a training sequence.
  Measured: the mean square error against the iteration count, the step size at
  which it stops converging, and the final taps against G3's. Cross-reference: the
  DSP Lab's adaptive group by name, which owns the algorithm.
- **G6 · Fading is a model, and it is labelled.** Flat Rayleigh fading, one complex
  Gaussian gain a symbol. Measured: the average BER against the closed form
  `½(1 − √(γ̄/(1 + γ̄)))`, which reads 2.3269 × 10⁻² at 10 dB and 2.4814 × 10⁻³ at
  20 dB. Then the penalty. Reaching 10⁻⁵ takes 43.98 dB against 9.588 dB in AWGN,
  which is 34.39 dB. The pane states the model's three assumptions.

### Group H: The link budget (4)

Four experiments that compute a budget and hand the subject on. The System Lab is
planned in parallel and owns the rest.

- **H1 · The noise floor.** Measured: `kT` at 290 K, −173.9752 dBm/Hz, and the noise
  power in a 1 MHz band at a noise figure of 6 dB, −107.975 dBm. Then the cascade.
  A 12 dB low-noise amplifier at 1.5 dB in front of a 10 dB mixer at 4 dB gives a
  total noise figure of 1.944 dB. Swap the two and it becomes 4.166 dB. Formula:
  Friis. Cross-reference: the Electronics Lab's Group O for where `4kTR` comes from.
- **H2 · Free-space path loss.** Measured: `20 log₁₀(4πd/λ)`, which is 80.052 dB at
  100 m, 100.052 dB at 1 km and 120.052 dB at 10 km, at 2.4 GHz. The 20 dB per decade
  is the whole shape of the curve.
- **H3 · The budget to a margin.** 20 dBm transmitted, 2 dBi at each antenna,
  100.052 dB of path loss. Measured: −76.052 dBm received, a signal-to-noise ratio of
  31.923 dB in 1 MHz, an `E_b/N_0` of 28.913 dB at 2 Mbit/s, and a margin of
  19.325 dB over the 9.588 dB QPSK needs. Then the range at zero margin, 9252 m.
- **H4 · What the implementation costs.** Measured: the four losses this lab has
  already computed, added. The prefix costs 0.969 dB, the pilots 0.348 dB, a hard
  decision instead of a soft one 1.585 dB, and a 0.05 T timing error 1.291 dB, for a
  total of 4.193 dB. The reader turns each knob and watches the total move. The
  `why` names the System Lab as the place the rest of the budget lives.

---

## 6. Hand-overs

- **→ Information Lab** (D3, D6, D7). The uncoded BER curve as a function, not as a
  picture. That lab draws the Shannon limit on it and measures every coding gain
  against it. The BER canvas takes its `limits` prop from the first commit, so the
  hand-over is a prop rather than a fork. Tested both ways: the curve the Information
  Lab reads equals this lab's closed form to floating point, and the limit it draws
  falls to the left of every point.
- **→ Control Lab II** (E2, E3, E5). The Costas loop and the early-late gate as
  discrete second-order loops with their `H(z)`. The mapping is exact and is
  presented without hedge. Until that lab is built the loops are designed here, and
  the `why` names it as the next step. The progression test allows that, because the
  reference is to a lab rather than to an experiment.
- **→ System Lab** (H1 to H4). The budget's four rows, and the interfaces named. The
  System Lab owns antenna gain, interference and the full margin table. Group H's
  `why` names it, and the progression test blocks the reference until it exists.
- **→ Mixed-Signal Lab** (C4, B6). The eye and constellation canvases, with the two
  props of Decision 3 already in place. That lab draws a converter's output on the
  same two canvases.
- **← Signal Lab.** Its `Ring modulator` and `AM: the carrier returns` presets become
  A4 and A1 with an index knob. Its `Clipping makes harmonics` becomes F5's clipper.
  Its FIR group is the pulse shaper and the equaliser. Its `Convolution, watched`
  is the matched filter's picture. Its sampling group is F1's other half.
- **← Random Signals Lab.** The seeded generator, the Q function, the power spectral
  density and the matched filter's `2E/N_0`. Four objects, each named in §1 and each
  marked "being built". D1's `why` cross-references that lab's generator group and
  D2's its estimation group.
- **↔ DSP Lab.** G5's LMS equaliser is that lab's adaptive filter, used rather than
  rebuilt. The multirate blocks it adds are the resampler this lab's timing recovery
  would use in a second version.
- **↔ Electronics Lab.** H1's `4kTR` is Group O's, and the noise figure this lab
  assumes is the one that lab derives.

---

## 7. Testing discipline

- **Unit** (`packages/comms`): each mapper against a hand table. The Gray labels
  against enumeration. The raised cosine against its closed form at 40 points. The
  root raised cosine's special values at `t = 0` and `t = T/4β`. The Bessel series
  against published values of `J_n(2)`. Every BER closed form against hand values at
  0, 4, 8 and 12 dB. The QAM enumeration against the known exact form
  `¾Q(√(4γ_b/5)) + ½Q(3√(4γ_b/5)) − ¼Q(5√(4γ_b/5))` for 16-QAM. The OFDM pair
  against the transform. The loops against their `H(z)`.
- **Invariants** (§2.11), fuzzed across bit streams, seeds, constellations,
  roll-offs, spans and channel taps. The hostile corners are included: `β = 0`, a
  span of 2 symbols, a channel exactly `N_cp + 1` taps long, `E_b/N_0` at −5 dB, and
  a fading gain within 40 dB of zero.
- **Experiments**: every number in §5 pinned, the way Signal Lab pins its presets.
  Among them 9.588, 13.435, 3.010, 675, 0.8619, 18.062, 0.969, −6.021, 99.759,
  2.404826, 34.39 and 4.193.
- **The map's promises**: a test walks every experiment's `why` and every
  cross-reference in it, and requires the referenced experiment to exist in the named
  lab. This is `packages/ui/src/progression.test.js`, owned by the seams overseer,
  and this lab's ids reach it through `NEEDS.md`. A reference to the Random Signals
  Lab's generator group fails until that lab ships it, which is the design.
- **Guards**: the root raised cosine's span guard, the Monte Carlo interval, the
  fading model's label, the OFDM prefix length, and the private simulator refusal.
  Each is tested at both sides of its threshold.
- **Statistical tests are pinned by seed.** Every counted BER in a test runs from a
  fixed seed with a fixed trial count, so the number in the test is deterministic.
  The interval is then checked against the closed form, rather than the count being
  checked against a hard-coded constant.
- **Playwright harness**: the constellation rotates when the phase offset moves. The
  eye closes when the timing offset moves. The BER marker carries an error bar
  whose height matches the printed interval. No horizontal scroll at 390 px.
- **REVIEW_PLAYBOOK audit** before release, all eleven classes, a screenshot pass,
  and the sittings script with three seats. One seat sits Group D, because the BER
  plot is what a reader arrives for.

---

## 8. Integration and the dark launch

The mechanism is the one Power Lab and the Elements lab share, unchanged:

- Deployed **dark** at `/comms-lab/` from the first vertical slice. Unlisted, not
  secret.
- `apps/comms-lab/RELEASE_STATUS` reads `dark`. A test asserts that while it does,
  the splash, the root README and the other labs' LabNav contain no reference to
  the Communications Lab. Flip the word to `released` and the same test demands the
  splash card, the README row and the nav entries, with counts pinned.
- The two new canvases land in `packages/ui` with their tests and the Mixed-Signal
  props. That is a shared-surface change, and it goes through the director.
- `createComplexChain` lands in `packages/dsp` through the DSP Lab overseer, from
  this lab's `NEEDS.md`, as Decision 5 says.
- The flip is **Reed's action**, after the release gate in §9.

---

## 9. Phasing

Each phase ships green and deployable dark. Group A comes first, because it runs on
the chain that exists and needs nothing from the Random Signals Lab.

1. **Analog modulation on the real chain.** The AM and FM modulators, the two
   detectors, the Bessel series. App shell, scope and spectrum reused, dark deploy
   and the `RELEASE_STATUS` test. **Group A** (7). Exit: every A number pinned, and
   A1 reproducing Signal Lab's preset exactly.
2. **The complex chain and the constellation.** `createComplexChain` merged, the
   mappers, the constellation canvas in `packages/ui` with the Mixed-Signal props.
   **Group B** (8). Exit: invariants 1 to 3 fuzzed green, and the canvas's second-lab
   props under test.
3. **The pulse and the eye.** `shape.js`, the eye canvas, the flow strip in use.
   **Group C** (6). Exit: invariants 4 and 5 green, the span guard tested at both
   sides, and C5's eye numbers pinned.
4. **The channel and the BER plot.** `channel.js`, `detect.js`, `ber.js`, the BER
   canvas with its `limits` prop. **Group D** (8). Exit: invariants 6 and 7 green,
   every closed form pinned, and every counted point inside its interval. This phase
   waits on the Random Signals Lab's Q function and seeded generator, and §1 names
   both.
5. **The loops.** `sync.js`, the loop views. **Group E** (5). Exit: invariant 10
   green, E5's four bandwidths pinned, and the Control Lab II reference in place.
6. **OFDM.** `ofdm.js`, the subcarrier view. **Group F** (6). Exit: invariant 8
   green at `N_cp + 1` and failing at `N_cp + 2`, and F5's distribution pinned.
7. **Multipath, equalisation, the budget.** `channel.js` completed, the equalisers,
   Group H's arithmetic. **Groups G and H** (10). Exit: invariant 9 green, G6's
   label tested, and H4's total pinned.
8. **The release gate**, in order, each blocking the next. The full audit (every
   option, every preset, every claim, fuzzing, both browsers). The student sittings.
   Reed's own pass against the dark deployment. Then the flip.

Phases 1 to 3 are 21 experiments and need nothing that is not built today. Phase 4
is the one that waits. If the Random Signals Lab slips, phases 5 to 7 can be built
ahead of it, because only Group D reads the Q function.

---

## 10. Non-goals (v1, stated so they are decisions rather than omissions)

- **High-speed serial and optical links.** The private `waveform-simulator` owns
  them, by the README and by Decision 2. Equalisation for a 25 Gbit/s link, jitter
  decomposition and optical dispersion are not reopened here.
- **Anything above the physical layer.** Framing, medium access, error control
  protocols, routing and queuing are computer science, and `EE_LABS_MAP.md` §5
  declines them for the suite. This lab stops at the bit stream.
- **Coding.** Hamming, convolutional codes, LDPC and the coding gain are the
  Information Lab's, and this plan's sibling covers them. Group D supplies the
  uncoded curve and nothing else.
- **The RF front end.** Mixers, low-noise amplifiers, oscillator phase noise and the
  Smith chart are the RF Lab's. Group H assumes a noise figure rather than deriving
  one.
- **Turbo codes and iterative demapping.** They need the Information Lab's decoder
  and a joint iteration between two labs' engines. Named here so the boundary is a
  decision.
- **MIMO and spatial multiplexing.** A second dimension in the channel model, a new
  interaction model for the constellation, and no experiment that the single-antenna
  groups do not already carry.
- **Channel coding interleavers and burst channels.** They need a burst model, and
  the fading model this lab ships is flat and memoryless by its stated assumptions.
- **Timing recovery by interpolation.** The Farrow structure needs the DSP Lab's
  multirate blocks. The early-late gate on an oversampled signal carries the lesson.
- **Spread spectrum and code division access.** One more mapper and a correlator,
  and a course of its own. Named as the first candidate for a second version.
- **Real spectral masks and standards compliance.** Datasheet facts.
- **A free-form block editor.** Curated chains with editable values, as every other
  lab.

---

## 11. Risks, named

- **The complex chain is a shared-surface change.** Decision 5 asks another
  overseer's package for eighty lines, and this lab cannot start Phase 2 without it.
  Mitigation: the contract goes into `NEEDS.md` in the first commit, Phase 1 needs
  none of it, and the fallback is a `comms`-local runner with the same signature that
  moves to `dsp` later.
- **The Random Signals Lab slips.** Group D is a quarter of the lab and reads four
  objects from it. Mitigation: §1 marks all four, phases 5 to 7 do not depend on
  them, and the Q function is thirty lines that this lab can hold temporarily with
  the ownership stated in `NEEDS.md`.
- **Counted BER is slow in a browser.** 523 800 symbols at 8 dB is a real
  computation, and 10⁻⁶ is out of reach. Mitigation: the frame length is a knob, the
  count runs in slices between frames, the plot draws the closed form everywhere, and
  §2.8's rule is that a point below 30 errors is drawn hollow.
- **The interval is mistaken for an error bar on the theory.** A reader can read the
  interval as doubt about the closed form. Mitigation: the closed form is a line and
  the count is a marker, the pane names which is which, and D4 is the experiment
  that makes the difference the lesson.
- **Fifty experiments in one nav.** This is the largest sidebar in the suite, longer
  than the Electronics Lab's 77 only in its group count. Mitigation: eight groups
  that fold, the split point after Group D if the sittings ask for one, and the same
  nav fold `ELECTRONICS_LAB_PLAN.md` Decision 5 proposes.
- **The private simulator boundary reads as arbitrary.** A reader who knows the other
  tool will ask why the eye diagram is here and not there. Mitigation: Decision 2
  states the line by what the chain renders, the app says it in one sentence, and
  §10 lists what is out.
- **Numbers that are right for one grid.** Every quoted number is for the defaults of
  §4.3. Mitigation: each pin is a function of the knobs and is re-derived in the
  test, not stored as a constant.
- **Cost.** A new package, a new chain currency, two shared canvases and eight
  groups. This is the largest lab in the map. Phasing keeps every phase shippable
  dark, Phase 1 is cheap and useful on its own, and phases 1 to 4 are a complete
  first communications course.
