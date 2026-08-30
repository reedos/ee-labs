# Signal Lab

A signal, its frequency content, and what happens when you put things in the way.

Two plots share one screen — a waveform and its spectrum — and between the source and
the plots sits a chain of blocks you can add, reorder and bypass. Change anything and
both views answer at once. That pairing is the whole idea: most things that are hard to
picture in one domain are obvious in the other.

Built for someone who knows some maths but has not done much signal processing. No
install beyond `npm`, nothing to configure, and every preset is a question with a
visible answer.

## Running it

```
npm install
npm run dev        # http://localhost:1421
npm test           # 116 tests
npm run build
```

## Where to start

Click through **Try this** in the sidebar, top to bottom. Each preset loads a setup and
says what to look at; then change it and see what breaks. In rough order:

| Preset | The question |
|---|---|
| Single tone | What does one frequency look like in each view? |
| Square = odd harmonics | Why does a square wave contain many frequencies? |
| Build a square | Can I add sines up into a square? (Yes — 1, 1/3, 1/5.) |
| Aliasing | What happens above half the sample rate? |
| Spectral leakage | Why does a clean tone smear across the spectrum? |
| Beating | Two close tones: one waveform, two lines. Which is "true"? |
| Low-pass a square | What exactly does a filter remove? |
| Resonance is Q | What is Q, in a way you can see? |
| Phase is invisible here | A filter that changes everything and nothing. |
| Clipping makes harmonics | Frequencies appearing from nowhere. |
| DC breaks the symmetry | Why odd harmonics become odd *and* even. |
| Comb, Ring modulator, 4 bits | Delay, multiplication, and quantisation. |

## How it is put together

```
sources → sum → [ordered block chain] → scope + FFT
```

- **`src/dsp/signals.js`** — waveform generators. Deliberately *not* band-limited, so
  aliasing is visible rather than hidden. Noise is a hash of the absolute sample index
  rather than `Math.random()`, so it is identical in both views and stable across a
  redraw.
- **`src/dsp/biquad.js`** — RBJ cookbook filters, Direct Form I, one section. Written so
  the code reads as the difference equation on the page.
- **`src/dsp/chain.js`** — `make()` returns a fresh processor on every call, so applying
  the chain is a pure function and the two views can never contaminate each other. Blocks
  are handed absolute time, so a modulator's phase does not depend on how much pre-roll
  an unrelated filter happened to ask for.
- **`src/dsp/blocks.js`** — the block registry, as data. One card component renders every
  block, so adding a type touches this file only.

The scope's horizontal axis counts cycles of the signal rather than milliseconds, so
"show me five periods" stays five periods when you move a source from 250 Hz to 2 kHz.

### Warm-up is not optional

An IIR filter started on a cold buffer emits a startup transient that lands in *every*
FFT bin. So the chain renders pre-roll first — the same signal continued backwards, not a
zero pad and not a repeat of the frame — and discards it. A checkbox shows the transient
once you know it is there.

That scheme depends on the pre-roll being genuinely the same signal, which is why the
generators take time from the absolute sample index rather than from an offset. Getting
that subtly wrong made a filtered square measure up to 10% away from its own response
curve, and the test that should have caught it was pinning the artifact instead.

## The presets are tested

Each preset's note makes a claim about physics — "only odd harmonics", "the peak height
is Q", "neither input frequency survives". `src/presets.test.js` renders each setup and
measures whether the claim actually holds.

This is not ceremony. Two of the notes were wrong:

- **"each surviving harmonic sits on the response curve."** It does not. A square's
  harmonics already fall as 4/kπ before the filter sees them, so the peaks land 7–17 dB
  below the curve. What equals the curve is the *gap* between the pre- and post-filter
  traces.
- **"at Q = 10 the peak is literally 10×."** True of a low-pass, false of the band-pass
  the preset actually used, where |H(f₀)| is pinned at 1 however far Q is pushed. For a
  band-pass, Q sets the width instead.

A confidently wrong explanation is worse here than a missing feature: someone learns the
wrong thing and has no way to catch it. So the claims are measured rather than trusted.

## Relation to waveform-simulator

Forked from `waveform-simulator`, which grew out of this same sandbox into a PAM4 and
coherent datacenter-link simulator — TDECQ, BER, eye diagrams, jitter, bathtub curves.
That tool answers "does this 224 GBd link meet spec". This one answers "what is a
spectrum". They share ancestry and about 2,700 lines of DSP core, and little else.
