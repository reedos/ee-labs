# Signal Lab

A signal, its frequency content, and what happens when you put things in the way.

Two plots share one screen — a waveform and its spectrum — and between the source and
the plots sits a chain of blocks you can add, reorder and bypass. Change anything and
both views answer at once. That pairing is the whole idea: most things that are hard to
picture in one domain are obvious in the other.

Built for someone who knows some maths but has not done much signal processing. No
install beyond `npm`, nothing to configure, and every preset is a question with a
visible answer — plus, under each one, the maths that predicts it, checked against what
the tool just measured.

## Running it

```
npm install
npm run dev        # http://localhost:1421
npm test           # 133 tests
npm run build
```

## Where to start

Click through **Try this** in the sidebar, top to bottom. Each preset loads a setup, says
what to look at, and offers a collapsible **The maths** panel. Then change it and see
what breaks.

**Signals and Fourier** — what a spectrum is
| | |
|---|---|
| Single tone | What does one frequency look like in each view? |
| Square = odd harmonics | Why does a square wave contain many frequencies? |
| Corners make harmonics | 1/k against 1/k²: why sharper corners cost more bandwidth. |
| Build a square | Adding sines up into a square, and the Gibbs overshoot that never leaves. |
| Beating | Two close tones: one waveform, two lines. Which is "true"? |

**Sampling** — what discrete time costs you
| | |
|---|---|
| Aliasing | What happens above half the sample rate. |
| Exactly at Nyquist | The same tone reads 0.000, 0.707 or 1.000 depending only on its phase. |
| Resolution needs time | Two tones that will not separate until the frame is long enough. |
| Spectral leakage | Why a clean tone smears, and what a window buys. |

**Filters** — linear, time-invariant
| | |
|---|---|
| Low-pass a square | What exactly does a filter remove? |
| Resonance is Q | Q, in a way you can see: the peak height *is* Q. |
| Phase is invisible here | A filter that changes everything and nothing. Turn on the phase curve. |
| Two filters are steeper | Cascading squares the response and doubles the dB. |
| Impulse response | h(t) and H(f) side by side — the same object from two sides. |
| Step response and ringing | What Q feels like in time: overshoot and settling. |

**Nonlinearity** — where transfer functions stop working
| | |
|---|---|
| Clipping makes harmonics | Frequencies appearing from nowhere. |
| DC breaks the symmetry | Why odd harmonics become odd *and* even. |
| Two tones, one nonlinearity | Intermodulation: products that are harmonics of neither input. |
| Ring modulator | Multiplication in time is a shift in frequency. |
| AM: the carrier returns | One DC offset separates broadcast AM from DSB-SC. |
| Comb | Delay, and evenly spaced notches. |
| 4 bits | Quantisation spurs, and what dither trades them for. |

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
- **`src/presets.js`**, **`src/maths.js`** — the lessons, and the maths behind them.

The scope's horizontal axis counts cycles of the signal rather than milliseconds, so
"show me five periods" stays five periods when you move a source from 250 Hz to 2 kHz.
Aperiodic sources fall back to a span in milliseconds.

### Phase, and what is deliberately not offered

The spectrum can overlay the **chain's** phase response on a right-hand axis. That is
what makes the all-pass legible: |H| is 1.0000 at every frequency while the phase sweeps
a full 360°, so on the magnitude plot alone the block appears to do nothing at all.

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
generators take time from the absolute sample index rather than from an offset. Getting
that subtly wrong made a filtered square measure up to 10% away from its own response
curve, and the test that should have caught it was pinning the artifact instead.

## The explanations are tested

Each preset's note makes a claim about physics, and each maths panel prints a predicted
value beside the measured one. Both are verified: `src/presets.test.js` renders every
preset and measures its claim, and `src/maths.test.js` checks that every formula
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
samples per period, centred on a bin — and when one fails the row is footnoted with the
reason instead of marked with a cross. `maths.test.js` sweeps frequency, sample rate and
FFT size across those presets and requires every row to be either correct or explicitly
unmeasurable, and separately requires that the escape hatch is not being used everywhere:
a panel that checked nothing would pass the first test and teach nothing.

This is not ceremony. Three things were wrong before those tests existed:

- **"each surviving harmonic sits on the response curve."** It does not. A square's
  harmonics already fall as 4/kπ before the filter sees them, so the peaks land 7–17 dB
  below the curve. What equals the curve is the *gap* between the pre- and post-filter
  traces.
- **"at Q = 10 the peak is literally 10×."** True of a low-pass, false of the band-pass
  the preset actually used, where |H(f₀)| is pinned at 1 however far Q is pushed. For a
  band-pass, Q sets the width instead.
- **the square generator itself**, which decided its transition samples with
  `sign(sin θ)`. Since `sin(π)` returns 1.22e-16 rather than 0, every period got 17
  samples high and 15 low — a DC offset and a full set of even harmonics at −39 dB on the
  one waveform whose entire lesson is that it has none.

A confidently wrong explanation is worse here than a missing feature: someone learns the
wrong thing and has no way to catch it. So the claims are measured rather than trusted.

## Relation to waveform-simulator

Forked from `waveform-simulator`, which grew out of this same sandbox into a PAM4 and
coherent datacenter-link simulator — TDECQ, BER, eye diagrams, jitter, bathtub curves.
That tool answers "does this 224 GBd link meet spec". This one answers "what is a
spectrum". They share ancestry and about 2,700 lines of DSP core, and little else.
