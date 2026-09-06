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
| Experiment ids built | `a1` to `a5`, `b1` to `b4`, `c1` to `c5`, `d1` to `d5`, `e1` to `e3`, `f1` to `f3` |
| Count built | 25 |
| Count planned | 25, in six groups (`INFORMATION_LAB_PLAN.md` §5) |
| Groups built | `A · Entropy and source coding`, `B · Capacity and the Shannon limit`, `C · Block codes`, `D · Convolutional codes and Viterbi`, `E · LDPC and belief propagation`, `F · Coding gain measured` |
| Groups planned, not built | none |
| Status word | building, dark |

One rule this lab asks the progression test to enforce for it.

- **No lesson may reference an experiment that is not built, here or in another
  lab.** Every group of this lab is built now, so the rule is about the other
  labs. `release.test.js` enforces the half of it that is inside this lab, and
  the progression test is where the cross-lab half belongs.

## 3. The Communications Lab, and the two contracts between the labs

**Both met.** That lab merged, and Group F and B4 are built against it. This
section is now the record of what the two labs promise each other, and the tests
that hold them to it.

**The `limits` prop.** That plan's Decision 3 built the canvas with this lab
named as its second user, and the prop is there. This lab draws its own picture
rather than that one (§4), and it takes `limits` in the same shape so that the
two can become one canvas:

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
decibels rather than a code. That keeps either canvas free of this lab's objects.

**The uncoded curve as a function.** Met by `berClosed(scheme, gammaB)`. Group F
measures a gain as the horizontal distance between two curves, so it needs that
function rather than a picture of it. `packages/codes/src/gain.test.js` compares
it with this lab's own `uncodedBer` at every point of a grid from −2 to 16 dB,
and the two are equal to floating point.

**The soft metric.** Met by `softMetric(name, syms, sigma2)`. F3 reads it, and
`packages/codes/src/crosslab.test.js` holds both labs to the two conventions
that matter:

```js
// Both labs: a belief is log P(bit = 0 | y) / P(bit = 1 | y), so a positive
// number argues for a zero. That is the convention that crosses the boundary.
//
// The two labs map a zero to opposite levels. That lab sends 0 as −1 and this
// one sends it as +1, so the belief is −2y/σ² there and +2y/σ² here. A decoder
// that reads beliefs never sees the difference, and `levelsFromLlr` is the
// whole of the conversion into this lab's squared-distance metric.
levelsFromLlr(llr, sigma2) -> the received levels those beliefs stand for
```

The contract is the sign of the belief. A detector that returned the negative of
it would give a decoder here the wrong answer with no error message. The test
sends a known stream through that lab's chain. It then requires the sign of every
belief to be the bit that lab's own hard decision would give.

## 4. Three canvases, and one that two labs now draw

`packages/ui`, owned by the director. `PROGRAM.md` §4 names the trellis walker
as this lab's own interaction model, with no second lab claiming it, so it lives
in `apps/info-lab/src/components`. It is built against the Logic Lab's state
diagram prop shape, so promotion is a move rather than a rewrite.

| Component | Second lab | The props built for it |
| --- | --- | --- |
| `TrellisCanvas` | Computer Lab, VLSI Lab | `states` and `edges` as `StateCanvas` takes them, `step` for the column a scrubber sits at, `survivors` for the branch kept into each state, `metrics` for the number beside each state, `traceback` for the path drawn backwards |
| `TannerCanvas` | none yet | `beliefs` for the edge colours, `iteration` for the scrubber, `failing` for the checks a word fails |
| `GainCanvas` | the Communications Lab already draws the other half | `curve` of two closed forms, `limits` in that lab's own shape, `marks` for the crossing, `gain` for the arrow between the two curves |

**One decision for the director.** Two labs now draw an error rate against
`E_b/N_0` on a log axis. `apps/comms-lab/src/components/BerCanvas.jsx` draws one
closed form and its counted points with their intervals, and its subject is the
agreement between a count and a formula. `apps/info-lab/src/components/GainCanvas.jsx`
draws two closed forms and the horizontal distance between them, and its subject
is the gain. Neither is a fork of the other, and a cross-app import is not
something either lab may write.

The two would make one canvas in `packages/ui` with a `counts` prop and a `gain`
prop, each drawn when it is given. That is a director's move under `PROGRAM.md`
§5, and neither lab is blocked meanwhile. What is duplicated today is one
logarithmic axis and one `limits` line.

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
adds one package, one app and the edits to its own plan, and it edits nothing it
does not own.

`packages/codes` depends on `@ee-labs/random` for the seeded generator and the Q
function. It depends on `@ee-labs/comms` for the uncoded curve and the soft
metric. That second one is a development dependency of the package and a real
dependency of the app, because only Group F reads it.
