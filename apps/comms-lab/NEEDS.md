# Communications Lab: what it needs from elsewhere

Everything this lab needs that it does not own. `PROGRAM.md` §1 says two
overseers who need the same thing write it here, and the director resolves it
once. Nothing in this file has been changed outside this lab.

## 1. The deploy line

One `cp` line in `.github/workflows/deploy.yml`, added by the director at
integration, beside the other dark labs:

```
cp -r apps/comms-lab/dist _site/comms-lab
```

The lab reads `dark` in `apps/comms-lab/RELEASE_STATUS`, so it is built and
served at its URL and linked from nowhere. `release.test.js` enforces that
nothing a visitor sees mentions it, and it also enforces that this file carries
the line above.

## 2. The progression test

For `packages/ui/src/progression.test.js`, which the seams overseer owns.

**Counts.** The plan holds 50 experiments in 8 groups. What is built is listed
in `BACKLOG.md` under this lab's heading, and the phasing in
`COMMUNICATIONS_LAB_PLAN.md` §9 says which groups shipped.

| Group | Header | Planned | Ids |
| --- | --- | --- | --- |
| A | Analog modulation | 7 | A1 to A7 |
| B | Digital modulation and constellations | 8 | B1 to B8 |
| C | The pulse and intersymbol interference | 6 | C1 to C6 |
| D | The AWGN channel and the bit error rate | 8 | D1 to D8 |
| E | Synchronisation | 5 | E1 to E5 |
| F | OFDM | 6 | F1 to F6 |
| G | Multipath and equalisation | 6 | G1 to G6 |
| H | The link budget | 4 | H1 to H4 |

**The ids other labs will reference.**

- `D3`, `D6` and `D7`, the uncoded bit error rate curves. The Information Lab
  measures every coding gain against them.
- `C4` and `B6`, the eye and the constellation. The Mixed-Signal Lab draws a
  converter's output on the same two canvases.
- `E2`, `E3` and `E5`, the two loops as discrete second-order loops. Control
  Lab II reads them as plants.
- `H1` to `H4`, the link budget's four rows. The System Lab owns the rest.

**What this lab references outward.** The Random Signals Lab's `H1` to `H3` by
name, for the matched filter and the error rate. Signal Lab's Nonlinearity and
FIR groups by name. Control Lab II and the System Lab by lab rather than by
experiment, because neither is built and a reference to a lab is what the
progression test allows.

## 3. Promotion candidates for packages/ui

### ConstellationCanvas and EyeCanvas

`PROGRAM.md` §4 names both as new canvases whose first lab is this one and whose
second is the Mixed-Signal Lab. They live in
`apps/comms-lab/src/components/`, and they move to `packages/ui` when that lab
starts. Their props carry that lab's needs already, as §4 requires, and
`components/canvases.test.jsx` measures the geometry each one produces so the
tests move with them.

The director asked for two props by name, and
`MIXED_SIGNAL_LAB_PLAN.md` is where they come from.

- **`grid={{ x, y, label }}` on the constellation.** Arbitrary decision
  boundaries with no points behind them, which is what a converter's code edges
  are. When `grid` is given the canvas draws it instead of the constellation's
  own regions. `regionsOf` computes those regions as data, so the two paths
  produce the same shape of object.
- **`colorBy={{ values, labels, title }}` on the constellation.** A key per
  point, so a cloud can be coloured by a clock phase or by a code rather than by
  which symbol was sent.
- **`traceKey` on the eye.** A value per trace, so each trace takes its colour
  from a clock phase. A converter's eye is read that way.
- **`unitLabel` on the eye.** What the vertical axis is measured in. This lab
  leaves it empty, because a normalised symbol has no unit, and a converter's
  eye reads in volts.

### BerCanvas

Stays in the app under `PROGRAM.md` §4, because only the Information Lab claims
it and that lab is not built. It takes `limits` from its first commit, which is
where that lab draws the Shannon limit, so the hand-over is a prop rather than a
fork. `sceneOf` returns the plot's geometry as data for the same reason the
other two do.

## 4. Package needs

### createComplexChain in packages/dsp

`COMMUNICATIONS_LAB_PLAN.md` Decision 5 asks the DSP Lab overseer for this, and
it does not exist in `packages/dsp` today. `createChain` runs a `Float64Array`
and calls `process(v, t)` with one real number per sample, and a constellation
needs two.

This lab has built it in `packages/comms/src/chain.js` against the signature the
plan states, which is the fallback the plan's §11 names. Nothing in `dsp` has
been edited. The contract is:

```js
/**
 * A mirror of createChain over an interleaved Float64Array of length 2n:
 * [re0, im0, re1, im1, ...]. `make(params, sampleRate)` returns
 * `{ process, settle }`, and `process` takes and returns `[re, im]`.
 */
export function createComplexChain(BLOCK_TYPES)
// -> { applyChain, runChain, chainSettle }
```

When it lands in `dsp`, `packages/comms/src/chain.js` becomes a re-export and
nothing that imports it changes. `packages/comms/src/chain.test.js` moves with
it. The director decides whether the move happens at all, since one package
already holds a working copy and the second user has not appeared.

### Nothing else

`@ee-labs/random` supplies the generator, the Q function, the Wilson interval
and the sample estimators, and is used unchanged. `@ee-labs/dsp` supplies the
transform, the FIR machinery and the spectrum, and is used unchanged.

## 5. Deferred, and why

- **There is no Playwright harness.** The plan's §7 names one. This environment
  has no browser, and the other dark labs record the same deferral. What it
  would catch that the tests do not is the app end to end and the 390 px layout.
  `components/canvases.test.jsx` measures every canvas prop against the geometry
  it produces, which covers two of the three things the harness would find.
- **No screenshots have been read as a student would read them**
  (`REVIEW_PLAYBOOK` §11). Reopens with the harness.

## 6. Three numbers the plan quotes that the engine does not reproduce

Each is recorded rather than rounded away, and each is for the director.

- **The residual ISI figures** in the plan's §2.3 and C6 are the
  nearest-neighbour measure. `residualIsi` returns that as `near`, beside `peak`
  over every symbol lag and `sum` over all of them, and the three differ by more
  than an order of magnitude at a span of 12. The `near` figures reproduce the
  plan exactly. The plan's sentence should say which measure it quotes.
- **G3's equaliser length.** A 21-tap zero-forcing equaliser on the two-ray
  channel leaves a residual of 1.17e-2 rather than the 1e-3 the plan asks for.
  The echo is four samples, so the inverse needs a tap every four out to the
  sixth power of the echo. At 41 taps the residual is 3.66e-4. The app defaults
  to 41 taps and the lesson quotes both.
- **H1's cascaded noise figure.** For a 12 dB amplifier at 1.5 dB in front of a
  10 dB mixer at 4 dB, Friis gives 1.784 dB, and swapping them gives 4.071 dB.
  The plan quotes 1.944 dB and 4.166 dB. The engine's arithmetic is checked
  against the definition in `budget.test.js`, so the plan's two numbers look
  like a transcription rather than a different convention.
