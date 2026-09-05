# Information Lab: what it needs from elsewhere

What this lab cannot change itself, written here so the director resolves each
once (`PROGRAM.md` §1). Every entry names the file, the change, and who owns it.

## 1. The deploy workflow

`.github/workflows/deploy.yml`, owned by the director. One line, beside the
other dark labs:

```
          # Dark-launched: built and served at its URL, linked from nowhere until
          # apps/info-lab/RELEASE_STATUS says `released`.
          cp -r apps/info-lab/dist _site/info-lab
```

`release.test.js` in this app already requires that line, so the app's own test
fails until the director adds it. That is on purpose. The URL has to exist for
the dark review to happen.

## 2. The progression test

`packages/ui/src/progression.test.js`, owned by the seams overseer. This lab's
ids and counts:

| Field | Value |
| --- | --- |
| Lab slug | `info-lab` |
| Experiment ids built | `a1` to `a5`, `b1` to `b3`, `c1` to `c5`, `d1` to `d5`, `e1` to `e3` |
| Count built | 21 |
| Count planned | 25, in six groups (`INFORMATION_LAB_PLAN.md` §5) |
| Groups built | `A · Entropy and source coding`, `B · Capacity and the Shannon limit`, `C · Block codes`, `D · Convolutional codes and Viterbi`, `E · LDPC and belief propagation` |
| Groups planned, not built | `F · Coding gain measured` (3), and `B4` |
| Status word | building, dark |

One rule this lab asks the progression test to enforce for it.

- **No lesson may reference an experiment that is not built, here or in another
  lab.** Group F and B4 wait on the Communications Lab, so a sentence naming F1
  or naming that lab's D3 must fail the suite until both exist.
  `release.test.js` already enforces this over the ids this lab has, and the
  progression test is where the cross-lab half belongs.

## 3. The Communications Lab, and the two contracts between the labs

Owned by the Communications Lab overseer. Neither exists on the integration
branch today, and Group F and B4 are deferred until both do (`BACKLOG.md`).

**The BER canvas with its `limits` prop.** That plan's Decision 3 builds the
canvas with this lab named as its second user. What this lab passes it:

```js
<BerCanvas
  curves={[{ id: 'uncoded', points }, { id: 'coded', points }]}
  limits={[
    // A vertical line at the Shannon limit for the code's own rate, from this
    // lab's entropy.js. `label` is drawn beside the line.
    { ebN0Db: shannonLimitDb(rate), label: 'Shannon limit, rate 1/2' },
  ]}
  marks={[{ ebN0Db, ber, label: 'crossover' }]}
/>
```

The limit is a function of the code's rate, so the prop takes a value in
decibels rather than a code. That keeps the canvas free of this lab's objects.

**The uncoded curve as a function.** Group F measures a gain as the horizontal
distance between two curves, so it needs that lab's closed form rather than a
picture of it. `@ee-labs/random` already exports `errorRateAntipodal(ebN0)`,
which is `Q(√(2 E_b/N_0))`, and this lab uses that until the Communications Lab
states its own. The test both ways is one line: the two agree to floating point.

**The soft metric.** E2 and F3 read a per-bit log-likelihood ratio. This lab
computes its own in `packages/codes/src/channel.js`, and the two must agree in
both conventions rather than only in size:

```js
// Bit 0 is sent as +1, and the belief is log P(bit = 0 | y) / P(bit = 1 | y).
// On the Gaussian channel with noise variance σ² that is exactly 2y/σ².
gaussian(bits, { ebN0Db, rate, seed }) -> { y, llr, hard, sigma, es, esN0Db, flips }
```

The contract is the sign convention and the factor of two. A detector that
returns `y/σ²`, or that sends bit 0 as −1, gives a decoder here the wrong
answer with no error message. When that lab lands, one test compares the two
functions over a seeded run and this lab drops its own.

## 4. Two canvases, for promotion when a second lab claims one

`packages/ui`, owned by the director. `PROGRAM.md` §4 names the trellis walker
as this lab's own interaction model, with no second lab claiming it, so it lives
in `apps/info-lab/src/components`. It is built against the Logic Lab's state
diagram prop shape, so promotion is a move rather than a rewrite.

| Component | Second lab | The props built for it |
| --- | --- | --- |
| `TrellisCanvas` | Computer Lab, VLSI Lab | `states` and `edges` as `StateCanvas` takes them, `step` for the column a scrubber sits at, `survivors` for the branch kept into each state, `metrics` for the number beside each state, `traceback` for the path drawn backwards |
| `TannerCanvas` | none yet | `beliefs` for the edge colours, `iteration` for the scrubber, `failing` for the checks a word fails |

Each computes its whole picture as data before it draws anything, in `sceneOf`,
and the draw call reads that and nothing else. `components/canvases.test.jsx`
measures every prop through those functions, so a move into `packages/ui`
carries its own tests with it.

## 5. The Playwright harness

This lab ships with no harness. The other dark labs run `scripts/verify.mjs`
against a preview server. `INFORMATION_LAB_PLAN.md` §7 names the four checks
this lab needs from one. The syndrome cell lights when a bit is flipped. The
trellis survivor changes colour when a branch metric changes. The Tanner edge
changes colour when a belief flips sign. No pane scrolls sideways at 390 px.

The director decides whether the harness is this lab's work or the seams
overseer's. Until then the screenshot pass is the only check on those four.

## 6. One correction to the plan, for the director to settle

`INFORMATION_LAB_PLAN.md` §3 gives the twelve-bit LDPC code the rate one third.
That is the design rate its degrees promise. Every bit sits in two checks, so
every column of the matrix has even weight, its eight rows sum to zero, and its
rank is seven rather than eight. The true rate is five twelfths, and no code
with two checks per bit can have all its rows independent.

E1 measures both numbers and names the difference, which is a better lesson than
the one the plan wrote. The plan's §3 table is the director's file, so the
number is corrected here rather than there.

## 7. Nothing else

This lab needs no change to `packages/network`, `packages/dsp`,
`packages/systems`, `packages/events`, `packages/explain`, or any other app. It
adds one package, one app and the phasing edit to its own plan, and it edits
nothing it does not own. `packages/codes` depends on `@ee-labs/random` for the
seeded generator and the Q function, and on nothing else in the suite.
