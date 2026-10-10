# Signal Lab

A signal, its frequency content, and what happens when you put things in the way.

Two plots share one screen, a waveform and its spectrum, and between the source and
the plots sits a chain of blocks you can add, reorder and bypass. Change anything and
both views answer at once. That pairing is the whole idea. Most things that are hard to
picture in one domain are obvious in the other.

Built for someone who knows some math but has not done much signal processing. Only `npm` is needed, with nothing to configure. Each preset asks a question with a visible answer. Its math panel compares predictions with measurements.

## Running it

```
npm install
npm run dev        # http://localhost:1421
npm test           # 200 unit tests
npm run build
npm run preview    # then, against that server:
npm run verify     # drives the real UI in a browser
```

`npm test` exercises the DSP and the math directly. `npm run verify` drives the page in a browser. It loads every preset, opens every math panel, and changes parameters. It checks that displayed numbers and canvas pixels follow those changes. This catches wiring defects that unit tests miss, such as missing props or stale panel state.

## Where to start

Click through **Try this** in the sidebar, top to bottom. Each preset loads a setup, says
what to look at, and offers a collapsible **The math** panel. Then change it and see
what breaks.

**Signals and Fourier**, what a spectrum is

| | |
|---|---|
| Single tone | What does one frequency look like in each view? |
| Square = odd harmonics | Why does a square wave contain many frequencies? |
| Corners make harmonics | 1/k against 1/k²: why sharper corners cost more bandwidth. |
| Build a square | Adding sines up into a square, and the Gibbs overshoot that never leaves. |
| Sources simply add | Two tones, two lines, each untouched by the other. Superposition, measured. |
| Sines in, sines out | LTI, made loud: a sine cannot come out as anything but itself. |
| Beating | Two close tones: one waveform, two lines. Which is "true"? |

**Sampling**, what discrete time costs you

| | |
|---|---|
| Coarse, not undersampled | 2.35 samples per cycle looks mangled, and nothing was lost. |
| Aliasing | What happens above half the sample rate. |
| Turn the rate down | Move the knob you actually have, and watch which component folds first. |
| Exactly at Nyquist | The same tone reads 0.000, 0.707 or 1.000 depending only on its phase. |
| A square that fits | The one signal here the sampling theorem can actually be satisfied for, and what it costs. |
| Resolution needs time | Two tones that will not separate until the frame is long enough. |
| Spectral leakage | Why a clean tone smears, and what a window buys. |

**Filters**, linear, time-invariant

| | |
|---|---|
| Low-pass a square | What exactly does a filter remove? |
| High-pass a square | The mirror: keep the edges, lose the plateaus. |
| Resonance is Q | Q, in a way you can see. The peak height *is* Q. |
| Phase is invisible here | A filter that changes everything and nothing. Turn on the phase curve. |
| Two filters are steeper | Cascading squares the response and doubles the dB. |
| Order is a choice | Every block here is 2nd order, but filters are not, and cascading is how you climb. |
| Impulse response | h(t) and H(f) side by side, the same object from two sides. |
| Step response and ringing | What Q feels like in time: overshoot and settling. |

**FIR and the z-plane**, filters with no feedback, and the plane they are read in

| | |
|---|---|
| A moving average is a filter | Average 8 samples: a low-pass whose nulls you can work out in your head. |
| Everything arrives together | Flat group delay, the FIR's whole reason to exist. |
| The kernel is the filter | The stems are not a picture of the filter. They are the filter. |
| Cut it off abruptly and it rings | Truncation is a window, and its ripple never shrinks: Gibbs, in the other domain. |
| Zeros on the circle | The nulls in the spectrum and the ring on the z-plane: one fact, drawn twice. |
| Comb | Delay, evenly spaced notches, and the same ring, pulled just inside the rim. |
| Convolution, watched | Flip, slide, multiply, sum, one output sample at a time. |

**Nonlinearity**, where transfer functions stop working
| | |
|---|---|
| Clipping makes harmonics | Frequencies appearing from nowhere. |
| DC breaks the symmetry | Why odd harmonics become odd *and* even. |
| Two tones, one nonlinearity | Intermodulation: products that are harmonics of neither input. |
| Ring modulator | Multiplication in time is a shift in frequency. |
| AM: the carrier returns | One DC offset separates broadcast AM from DSB-SC. |
| 4 bits | Quantization spurs, and what dither trades them for. |

## How it is put together

```
sources → sum → [ordered block chain] → scope + FFT
```

- **`src/dsp/signals.js`**, waveform generators. Deliberately *not* band-limited, so
  aliasing is visible rather than hidden. Noise is a hash of the absolute sample index
  rather than `Math.random()`, so it is identical in both views and stable across a
  redraw. `impulse` and `step` are keyed to absolute sample zero, so the filter pre-roll
  runs at negative indices and the chain is provably at rest before the event arrives.
- **`src/dsp/biquad.js`**, RBJ cookbook filters, Direct Form I, one section. Written so
  the code reads as the difference equation on the page.
- **`src/dsp/chain.js`**: `make()` returns a fresh processor on every call. Applying the chain is a pure function, and the views cannot contaminate each other. Blocks
  are handed absolute time, so a modulator's phase does not depend on how much pre-roll
  an unrelated filter happened to ask for.
- **`src/dsp/blocks.js`**, the block registry, as data. One card component renders every
  block, so adding a type touches this file only.
- **`src/presets.js`**, **`src/math.js`**, the lessons, and the math behind them.

The scope's horizontal axis counts cycles of the signal rather than milliseconds, so
"show me five periods" stays five periods when you move a source from 250 Hz to 2 kHz.
Aperiodic sources fall back to a span in milliseconds.

### Two families of filter

The **Filter** group is biquads. Second-order sections with feedback, so they have poles,
they can in principle be unstable, and their impulse response never quite ends. The
**FIR** group has no feedback at all, a moving average, and a designed windowed sinc.

The contrast is the reason both are here:

|  | Biquad (IIR) | FIR |
|---|---|---|
| Impulse response | never ends | exactly N samples |
| Stability | a question worth asking | cannot be unstable |
| Group delay | peaks at the corner | flat, exactly (N−1)/2 |
| Cost for a given skirt | 5 multiply-adds | often 60–200 |
| Cutoff convention | −3.01 dB | −6.02 dB (half amplitude) |

That last row surprises people. A windowed sinc is built by truncating an ideal
rectangle, and the truncation rounds the edge symmetrically about f_c, so the response
there is 0.5, not the 1/√2 a Butterworth section gives.

The flat group delay is the FIR's whole reason for existing. A symmetric kernel factors
into a real amplitude times a pure delay, so every frequency is held up by the same
(N−1)/2 samples and the waveform comes out late and otherwise unchanged. No amount of
feedback can do that.

### Order

Every biquad block here is a second-order section. That is what this tool
ships, not a fact about filters. Order is set by how many sections you put in series, and
each order adds roughly 6 dB per octave of rolloff, approached as an asymptote from above.

Cascading is not the whole story, though, and the block panel says so. Two identical Q = 0.707 sections form a fourth-order filter with the right far-field slope. A fourth-order **Butterworth** instead needs Q = 0.541 and 1.307. Only the second-order Butterworth uses 0.707. The giveaway is at the cutoff. Every true Butterworth passes
exactly −3.01 dB there whatever its order, while two identical sections give −6.02 dB and
sag well before the corner. The "Order is a choice" preset puts both side by side.

### Phase, group delay, and what is deliberately not offered

The spectrum can overlay the **chain's** phase or its **group delay** on a right-hand axis, one at a time. Group delay is derived from phase, and showing both dashed curves would crowd the magnitude plot.

The all-pass has |H| = 1.0000 at every frequency while its phase sweeps a full 360°. The magnitude plot alone therefore shows no change. Group delay expresses the phase behavior as time in samples. A flat group delay preserves the waveform's shape.

Group delay is **undefined across a null**, so the trace breaks there. The real amplitude changes sign at a null, causing a π phase step. That sign change is not a time shift.

At the null itself, there is no angle. The phase curve uses a neighboring value for continuity, which cannot support a measured derivative. There is also no signal at the null to delay.

The measured phase *of the signal* is not offered, and that is a decision rather than an
omission. It depends on where the frame happens to start, shift the window one sample
and every value changes, and at bins holding no signal it is uniformly random. Plotting
it fills the view with noise that means nothing.

### Warm-up is not optional

An IIR filter started on a cold buffer emits a startup transient that lands in *every*
FFT bin. So the chain renders pre-roll first, the same signal continued backwards, not a
zero pad and not a repeat of the frame, and discards it. A checkbox shows the transient
once you know it is there.

The pre-roll must contain the same signal. Generators therefore take time from the absolute sample index, not an offset. Local indexing can change the last bit. This is invisible on a sine but can move a square-wave transition across its decision threshold. The filtered and unfiltered squares would then differ at the input.

### The other views

Each pane has a switch in its own header, so the layout stays two panes.

**Kernel** replaces the scope with the chain's impulse response, drawn as stems. For an
FIR those stems are not a picture *of* the filter, they are the filter, the coefficients
the design produced. Every output sample is that kernel flipped, slid along, multiplied
by the input underneath and summed, which is convolution and is the only description of
filtering that covers FIR and IIR at once. An IIR's kernel is visibly a decaying
oscillation that never reaches zero.

**Convolution** replaces the scope with that sentence happening, one output sample at a
time:

```
y[n] = Σ h[k]·x[n−k]
```

The top strip is the input with the kernel drawn **flipped** and slid to the current
position, h[n−m] against m. That flip is the detail everyone trips on, and no amount of
prose fixes it the way watching the kernel ride backwards does. The flip follows from the arithmetic. As k increases, x[n−k] moves backward. Without the flip, the sum would weight the newest input by the oldest tap. The shaded bars are the products being summed, and the
bottom strip is the output built so far, ending on the sample those bars just made.

Convolution describes any LTI filter. Every input is a train of scaled, shifted impulses. Linearity makes their responses add. Time invariance makes a shifted impulse produce a shifted copy of the same response. The output is therefore the sum of scaled, shifted impulse responses shown above.

A clipper breaks the LTI assumption. Adding one changes the label to report disagreement between the two calculations. The scrubber computes its reading through both the stateful chain and the dot product against the measured kernel. For a linear chain, the two agree to rounding.

The first N samples ramp rather than starting at full value. This is filter warm-up. The kernel extends past the signal's left edge, so the sum includes only the overlapping samples.

Everything in this view is a **sample**: one product bar per sample, one tap per sample, and one dot per completed sum. Lines connect the dots for legibility. They do not describe the signal between samples.

The Signal view draws the same numbers as their (sin x)/x reconstruction. Reconstruction follows convolution as a separate step. Both views use the same samples from the same chain.

**z-plane** replaces the spectrum with poles and zeros. For a sampled filter, the frequency axis follows the unit circle counterclockwise from DC at z = 1 to Nyquist at z = −1.

At each frequency, the response is the product of distances to the zeros divided by the product of distances to the poles. A pole near the circle makes a peak. A zero on the circle makes an exact null. Q corresponds to how closely the poles approach the circle. Stability requires poles inside it, so the outside region is shaded.

A moving average has N−1 zeros evenly spaced on the circle. Their angles are the frequencies of its spectral nulls. Both views show the same relationship.

## The math is attached to what you built

Every preset carries a collapsible **The math** panel. Each **source** and **block** has one too, so explanations remain available when building a custom chain.

A source panel gives its waveform's series and closed forms for RMS and crest factor. It checks them against generated samples. It also shows how the current frequency aligns with the sample grid and FFT bins.

A block panel prints the transfer function **with its own coefficients substituted**, and
the difference equation the code really runs:

```
H(z) = (0.0927652 + 0.18553 z⁻¹ + 0.0927652 z⁻²) / (1 − 1.57184 z⁻¹ + 0.9429 z⁻²)
```

plus the pole radius, whether it is stable, and how long its ringing takes to die. A
biquad is four multiply-adds and five numbers. Seeing the actual numbers is what turns it
from a black box into arithmetic you could do by hand.

Its check column is measured by pushing an impulse through that difference equation and
transforming the result, deliberately *not* by evaluating the same formula twice. So it
verifies that the code implements the algebra being printed, rather than that the algebra
was retyped consistently.

## What "theory vs measured" is worth

Both numbers come from the same program, so the comparison needs independent paths. Theory uses a closed form. Measurements read the displayed FFT trace, pre-chain ghost, or response curve. The FFT does not use the Fourier series. Agreement therefore checks the implementation against the formula.

It does not prove the physics is right. It is an internal consistency check between two
of my own code paths, not a measurement against reality, and it cannot catch a mistake
that is present in both the formula and the model.

A row such as `predicted: beat, measured: beat` cannot disagree with itself. It is not an independent check. These quantities appear as derived values under "from these settings", without a verification tick.

A test enforces the distinction. It scales and tilts the spectrum, ghost, and response curve. Every comparison row must change its measured value in response. A row that stays fixed fails because it does not read those measurements.

## The explanations are tested

Each preset note makes a physics claim, and each math panel compares a prediction with a measurement. `src/presets.test.js` renders every preset and measures its claim. `src/math.test.js` checks formula rendering and agreement for every printed prediction. The test and panel use the same agreement predicate.

### When a claim stops being checkable

The panel reads live state, so one slider can invalidate a comparison that held when
the preset loaded. Raise a 250 Hz square to 1 kHz and its 5th harmonic is above Nyquist. There is no line left to measure. Move it to 400 Hz and the harmonics no longer land on
bin centres, so the window reads their peaks up to 1.4 dB low. Neither case means the
formula is wrong.

Each comparison states its preconditions, including Nyquist limits, whole samples per period, and bin alignment. When a precondition fails, a footnote explains why the row is unmeasurable.

`math.test.js` sweeps frequency, sample rate, and FFT size. Every row must be correct or explicitly unmeasurable. A separate check requires actual measurements to remain, so a panel cannot pass by footnoting everything.

Incorrect explanations can mislead someone building intuition. The tests therefore measure claims that might otherwise sound plausible.

A filtered square's surviving harmonics do not sit on the response curve. Their amplitudes already include the square's 4/kπ envelope. The gap between the input and output traces matches the response.

A Q of 10 gives a peak about ten times taller for a low-pass. In a band-pass, |H(f₀)| remains 1 and Q sets the width. The tests measure these distinctions.

## Relation to waveform-simulator

Forked from `waveform-simulator`, which grew out of this same sandbox into a PAM4 and
coherent datacenter-link simulator, TDECQ, BER, eye diagrams, jitter, bathtub curves.
That tool answers "does this 224 GBd link meet spec". This one answers "what is a
spectrum". They share ancestry and about 2,700 lines of DSP core, and little else.
