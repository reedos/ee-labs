# Signal Lab

A signal, its frequency content, and what happens when you put things in the way.

Two plots share one screen — a waveform and its spectrum — and between the source and
the plots sits a chain of blocks you can add, reorder and bypass. Change anything and
both views answer at once. That pairing is the whole idea: most things that are hard to
picture in one domain are obvious in the other.

Built for someone who knows some math but has not done much signal processing. No
install beyond `npm`, nothing to configure, and every preset is a question with a
visible answer — plus, under each one, the math that predicts it, checked against what
the tool just measured.

## Running it

```
npm install
npm run dev        # http://localhost:1421
npm test           # 200 unit tests
npm run build
npm run preview    # then, against that server:
npm run verify     # drives the real UI in a browser
```

`npm test` exercises the DSP and the math directly. `npm run verify` is the one that
catches wiring: it drives the actual page in a real browser, loads every preset, opens
every math panel, changes parameters, and checks that the numbers on screen and the
pixels in the canvases both follow — the class of mistake a unit test cannot see, like a
prop that stopped being passed or a panel reading stale state.

## Where to start

Click through **Try this** in the sidebar, top to bottom. Each preset loads a setup, says
what to look at, and offers a collapsible **The math** panel. Then change it and see
what breaks.

**Signals and Fourier** — what a spectrum is
| | |
|---|---|
| Single tone | What does one frequency look like in each view? |
| Square = odd harmonics | Why does a square wave contain many frequencies? |
| Corners make harmonics | 1/k against 1/k²: why sharper corners cost more bandwidth. |
| Build a square | Adding sines up into a square, and the Gibbs overshoot that never leaves. |
| Sources simply add | Two tones, two lines, each untouched by the other. Superposition, measured. |
| Sines in, sines out | LTI, made loud: a sine cannot come out as anything but itself. |
| Beating | Two close tones: one waveform, two lines. Which is "true"? |

**Sampling** — what discrete time costs you
| | |
|---|---|
| Coarse, not undersampled | 2.35 samples per cycle looks mangled — and nothing was lost. |
| Aliasing | What happens above half the sample rate. |
| Turn the rate down | Move the knob you actually have, and watch which component folds first. |
| Exactly at Nyquist | The same tone reads 0.000, 0.707 or 1.000 depending only on its phase. |
| A square that fits | The one signal here the sampling theorem can actually be satisfied for — and what it costs. |
| Resolution needs time | Two tones that will not separate until the frame is long enough. |
| Spectral leakage | Why a clean tone smears, and what a window buys. |

**Filters** — linear, time-invariant
| | |
|---|---|
| Low-pass a square | What exactly does a filter remove? |
| High-pass a square | The mirror: keep the edges, lose the plateaus. |
| Resonance is Q | Q, in a way you can see: the peak height *is* Q. |
| Phase is invisible here | A filter that changes everything and nothing. Turn on the phase curve. |
| Two filters are steeper | Cascading squares the response and doubles the dB. |
| Order is a choice | Every block here is 2nd order — but filters are not, and cascading is how you climb. |
| Impulse response | h(t) and H(f) side by side — the same object from two sides. |
| Step response and ringing | What Q feels like in time: overshoot and settling. |

**FIR and the z-plane** — filters with no feedback, and the plane they are read in
| | |
|---|---|
| A moving average is a filter | Average 8 samples: a low-pass whose nulls you can work out in your head. |
| Everything arrives together | Flat group delay — the FIR's whole reason to exist. |
| The kernel is the filter | The stems are not a picture of the filter. They are the filter. |
| Cut it off abruptly and it rings | Truncation is a window, and its ripple never shrinks: Gibbs, in the other domain. |
| Zeros on the circle | The nulls in the spectrum and the ring on the z-plane: one fact, drawn twice. |
| Comb | Delay, evenly spaced notches — and the same ring, pulled just inside the rim. |
| Convolution, watched | Flip, slide, multiply, sum — one output sample at a time. |

**Nonlinearity** — where transfer functions stop working
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

- **`src/dsp/signals.js`** — waveform generators. Deliberately *not* band-limited, so
  aliasing is visible rather than hidden. Noise is a hash of the absolute sample index
  rather than `Math.random()`, so it is identical in both views and stable across a
  redraw. `impulse` and `step` are keyed to absolute sample zero, so the filter pre-roll
  runs at negative indices and the chain is provably at rest before the event arrives.
- **`src/dsp/biquad.js`** — RBJ cookbook filters, Direct Form I, one section. Written so
  the code reads as the difference equation on the page.
- **`src/dsp/chain.js`** — `make()` returns a fresh processor on every call, so applying
  the chain is a pure function and the two views can never contaminate each other. Blocks
  are handed absolute time, so a modulator's phase does not depend on how much pre-roll
  an unrelated filter happened to ask for.
- **`src/dsp/blocks.js`** — the block registry, as data. One card component renders every
  block, so adding a type touches this file only.
- **`src/presets.js`**, **`src/math.js`** — the lessons, and the math behind them.

The scope's horizontal axis counts cycles of the signal rather than milliseconds, so
"show me five periods" stays five periods when you move a source from 250 Hz to 2 kHz.
Aperiodic sources fall back to a span in milliseconds.

### Two families of filter

The **Filter** group is biquads: second-order sections with feedback, so they have poles,
they can in principle be unstable, and their impulse response never quite ends. The
**FIR** group has no feedback at all — a moving average, and a designed windowed sinc.

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
there is 0.5 — not the 1/√2 a Butterworth section gives.

The flat group delay is the FIR's whole reason for existing. A symmetric kernel factors
into a real amplitude times a pure delay, so every frequency is held up by the same
(N−1)/2 samples and the waveform comes out late and otherwise unchanged. No amount of
feedback can do that.

### Order

Every biquad block here is a second-order section. That is what this tool
ships, not a fact about filters. Order is set by how many sections you put in series, and
each order adds roughly 6 dB per octave of rolloff, approached as an asymptote from above.

Cascading is not the whole story, though, and the block panel says so. Two identical
Q = 0.707 sections *is* a fourth-order filter with the right far-field slope, but it is
not a fourth-order **Butterworth** — that needs Q = 0.541 and 1.307, and only the
second-order case is 0.707. The giveaway is at the cutoff: every true Butterworth passes
exactly −3.01 dB there whatever its order, while two identical sections give −6.02 dB and
sag well before the corner. The "Order is a choice" preset puts both side by side.

### Phase, group delay, and what is deliberately not offered

The spectrum can overlay the **chain's** phase or its **group delay** on a right-hand
axis — one at a time, since they are the same information differentiated and two dashed
curves over one magnitude plot is a worse view than either alone. Phase is what makes the
all-pass legible: |H| is 1.0000 at every frequency while the phase sweeps a full 360°, so
on the magnitude plot alone the block appears to do nothing at all. Group delay says the
same thing as a time, in samples, which is usually the more useful reading — a flat line
means the shape survives.

Group delay comes back **undefined across a null**, and the trace breaks rather than
joining up. Two separate things go wrong at a null, and a delay differenced through
either one is not a delay: the phase steps by π there because the real amplitude behind
it changed sign, and a sign is not a shift; and at the null itself there is no angle at
all, so the curve is filled in from a neighbour to stay continuous — differencing a
value that was copied rather than measured. There is also nothing at a null to be
delayed, so undefined is the honest answer rather than merely a convenient one.

The measured phase *of the signal* is not offered, and that is a decision rather than an
omission. It depends on where the frame happens to start — shift the window one sample
and every value changes — and at bins holding no signal it is uniformly random. Plotting
it fills the view with noise that means nothing.

### Warm-up is not optional

An IIR filter started on a cold buffer emits a startup transient that lands in *every*
FFT bin. So the chain renders pre-roll first — the same signal continued backwards, not a
zero pad and not a repeat of the frame — and discards it. A checkbox shows the transient
once you know it is there.

That scheme depends on the pre-roll being genuinely the same signal, which is why the
generators take time from the absolute sample index rather than from an offset. Compute
it from a local index instead and the two differ in the last bit — invisible on a sine,
but enough to move a square's transition samples across the decision threshold, so the
filtered square is compared against a *different* unfiltered square.

### The other views

Each pane has a switch in its own header, so the layout stays two panes.

**Kernel** replaces the scope with the chain's impulse response, drawn as stems. For an
FIR those stems are not a picture *of* the filter, they are the filter — the coefficients
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
position — h[n−m] against m — because that flip is the detail everyone trips on, and no
amount of prose fixes it the way watching the kernel ride backwards does. It is not a
convention: x[n−k] walks backwards as k walks forwards, so without the flip the sum would
weight the newest input by the oldest tap. The shaded bars are the products being summed;
the bottom strip is the output built so far, ending on the sample those bars just made.

Why this is *the* description of filtering, rather than one of several: any input is a
train of scaled, shifted impulses. If the system is linear, the responses to them add; if
it is time-invariant, a shifted impulse gives a shifted copy of the same response. Put
those two together and the output must be the sum of scaled, shifted impulse responses —
which is the sum above. LTI is the hypothesis, and the view shows what happens without
it: put a clipper in the chain and the label changes to say the two disagree, because
they genuinely do. The scrubber's readout is computed twice on purpose — once by the
chain's stateful processors, once as this dot product against the measured kernel — and
for a linear chain the two agree to rounding.

The first N samples ramp rather than starting at full value. That is not a rendering
artifact, it is filter warm-up seen for what it is: the kernel still hangs off the left
edge of the signal, so the sum runs over a partial overlap.

Everything in this view is a **sample**: one product bar per sample, one tap per sample,
one dot per completed sum. The line joining the dots is drawn to make the shape legible
and is not a claim about what happens between them — that question belongs to the Signal
view, where the same numbers are drawn as the (sin x)/x curve they describe.
Reconstruction is a separate step *after* this arithmetic, not part of it, and the two
views agree exactly where it counts: they are drawing the same samples, from the same
chain.

**z-plane** replaces the spectrum with poles and zeros. The thing to notice is that for a
sampled filter the frequency axis is not a line, it is the unit circle: DC at z = 1,
running anticlockwise to Nyquist at z = −1, and that circle is the entire spectrum. The
response at a frequency is the product of the distances from that point to the zeros over
the distances to the poles, so a pole near the rim makes a peak and a zero on the rim
makes an exact null. Q, which the spectrum shows as peak height, is here how close the
poles crowd the circle. Stability inverts from the s-plane — inside is stable — which is
why the outside is what gets shaded.

A moving average is the clearest case: its N−1 zeros sit exactly on the rim at evenly
spaced angles, and those angles are exactly the frequencies of the nulls in its spectrum.
One fact, drawn twice.

## The math is attached to what you built

Every preset carries a collapsible **The math** panel, but so does every **source** and
every **block** — because the presets go quiet the moment you build a chain of your own,
which is exactly when an explanation is most wanted.

A source panel gives its waveform's series, its RMS and crest factor as a closed form
checked against the samples the generator actually produced, and how the current
frequency lands on the sample grid and the FFT bins.

A block panel prints the transfer function **with its own coefficients substituted**, and
the difference equation the code really runs:

```
H(z) = (0.0927652 + 0.18553 z⁻¹ + 0.0927652 z⁻²) / (1 − 1.57184 z⁻¹ + 0.9429 z⁻²)
```

plus the pole radius, whether it is stable, and how long its ringing takes to die. A
biquad is four multiply-adds and five numbers; seeing the actual numbers is what turns it
from a black box into arithmetic you could do by hand.

Its check column is measured by pushing an impulse through that difference equation and
transforming the result — deliberately *not* by evaluating the same formula twice. So it
verifies that the code implements the algebra being printed, rather than that the algebra
was retyped consistently.

## What "theory vs measured" is worth

A fair question, since both numbers come out of the same program. The comparison is
only worth something when the two sides come from genuinely different places: the theory
side is a closed form, and the measured side has to be *read off something the app is
really showing you* — the FFT trace, the pre-chain ghost, the response curve. The FFT
knows nothing about Fourier series, so when they agree, the implementation matches the
formula.

It does not prove the physics is right. It is an internal consistency check between two
of my own code paths, not a measurement against reality, and it cannot catch a mistake
that is present in both the formula and the model.

A row that prints the same expression in both columns — `predicted: beat, measured: beat`
— cannot disagree, so it is not a check at all. Those are rendered as plain derived
values under "from these settings", with no tick, because marking 1 = 1 correct is worse
than saying nothing: it teaches you to trust a ✓ that means nothing.

A test enforces the distinction. It perturbs everything a panel could be measuring from
— scaling and tilting the spectrum, the ghost and the response curve — and requires every
check row's measured value to move. A row that does not move is not reading anything, and
fails.

## The explanations are tested

Each preset's note makes a claim about physics, and each math panel prints a predicted
value beside the measured one. Both are verified: `src/presets.test.js` renders every
preset and measures its claim, and `src/math.test.js` checks that every formula
typesets and that **every predicted number the panel prints agrees with the measurement**
— using the same predicate the panel itself uses to draw its tick or cross, so the test
and the page cannot disagree about what "agrees" means.

### When a claim stops being checkable

The panel reads live state, so one slider can invalidate a comparison that held when
the preset loaded. Raise a 250 Hz square to 1 kHz and its 5th harmonic is above Nyquist —
there is no line left to measure. Move it to 400 Hz and the harmonics no longer land on
bin centres, so the window reads their peaks up to 1.4 dB low. Neither case means the
formula is wrong.

So each comparison states its own preconditions — below Nyquist, a whole number of
samples per period, centered on a bin — and when one fails the row is footnoted with the
reason instead of marked with a cross. `math.test.js` sweeps frequency, sample rate and
FFT size across those presets and requires every row to be either correct or explicitly
unmeasurable, and separately requires that the escape hatch is not being used everywhere:
a panel that checked nothing would pass the first test and teach nothing.

This is not ceremony. A confidently wrong explanation is worse here than a missing
feature: someone building intuition from it has no way to catch it. The claims that are
easiest to get wrong are the ones that sound obviously right — that each surviving
harmonic of a filtered square sits *on* the response curve (it does not: the square's own
4/kπ envelope is already there, and what equals the curve is the gap between the two
traces), or that a Q of 10 always means a peak ten times taller (true of a low-pass,
false of a band-pass, where |H(f₀)| is pinned at 1 and Q sets the width instead). So the
claims are measured rather than trusted.

## Relation to waveform-simulator

Forked from `waveform-simulator`, which grew out of this same sandbox into a PAM4 and
coherent datacenter-link simulator — TDECQ, BER, eye diagrams, jitter, bathtub curves.
That tool answers "does this 224 GBd link meet spec". This one answers "what is a
spectrum". They share ancestry and about 2,700 lines of DSP core, and little else.
