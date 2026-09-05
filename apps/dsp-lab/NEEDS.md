# Needs and heads-ups for the other territories

## For the director's queue

- **Deploy line.** `.github/workflows/deploy.yml` needs one more `cp` line,
  added at integration and live when Reed flips this lab's `RELEASE_STATUS`:
  `cp -r apps/dsp-lab/dist _site/dsp-lab`.
- **Progression test.** `packages/ui/src/progression.test.js` does not exist in
  this worktree (the seams overseer owns it, on `lab/seams`). These are the ids
  and counts to add once it lands. Forty experiments in six groups, in this
  sidebar order, which is `DSP_LAB_PLAN.md` §5's order.

  | Group | Count | Ids |
  | --- | --- | --- |
  | Changing the rate | 7 | `a1` to `a7` |
  | Designing to a specification | 8 | `b1` to `b8` |
  | Filters that learn | 7 | `c1` to `c7` |
  | Estimating a spectrum | 7 | `d1` to `d7` |
  | The arithmetic a processor has | 6 | `e1` to `e6` |
  | The transform itself | 5 | `f1` to `f5` |

  The lab leans on Signal Lab's Sampling and FIR groups. It references no
  experiment outside itself, so nothing here needs an ordering constraint
  against another lab.

## `packages/ui` promotion candidates

- **`SpecPane.jsx`, with the Applied Analog Lab as its second consumer.** This
  is the one candidate with a second lab already named. `PROGRAM.md` §4 gives
  the specification pane to the Applied Analog Lab first and this lab second,
  and the director ruled that this lab lands it because this lab is building
  now (`DSP_LAB_PLAN.md` Decision 4). It is written to
  `APPLIED_ANALOG_LAB_PLAN.md` §4.3, and both prop forms ship from the first
  commit rather than one being added later.

  ```jsx
  <SpecPane
    items={[{ key, label, value, target, unit, cmp, tol, margin, pass }]}
    binding="stop.depth"
    mode="table" | "bars"
    mask={{ axis: 'f', bands: [...] }}
    onEdit={(key, target) => {}}
  />
  ```

  `items` is the scalar form, one row a number with its target and its margin.
  `cmp` is `min`, `max` or `window`, so a row can say "at least", "at most" or
  "within".

  `mask` is the band form, a set of limits a response must stay inside with a
  margin reported per band. It is exactly what `specMarginRef` in `packages/dsp`
  returns, so a caller passes that result through with no reshaping.

  This lab uses both. Group B states its specification as a mask and reads the
  margin per band, and the rate group states a scalar target. The pane computes
  neither `margin` nor `pass`, because one function has to decide them or two
  panes will disagree about the same filter. `components/SpecPane.test.jsx`
  covers both forms and moves with the file.
- **`ScopeCanvas.jsx`, `SpectrumCanvas.jsx`, `Controls.jsx`.** Copied from
  Signal Lab with the minimum change this lab's blocks needed. The response
  overlay now reads `exact: false` and draws a reason string for a block with no
  transfer function, and the frequency pane accepts the same `mask` prop
  `SpecPane` reads. A second lab that wants either canvas can promote it rather
  than copy it a third time.
- **Four canvases this lab built and no second lab has asked for yet**, so they
  stay app-local per `PROGRAM.md` §4. `WeightCanvas.jsx` draws an adaptive
  filter's coefficients against sample number, with the plant dashed behind
  them. `PoleGridCanvas.jsx` draws the pole positions a quantised second-order
  section can reach, which is a different claim from the poles it has and needs
  a different picture. `DensityCanvas.jsx` draws power per hertz with the
  estimator named and an all-pole model over it. `ButterflyCanvas.jsx` draws one
  radix-2 butterfly with its four numbers. The Mixed-Signal Lab is the likeliest
  second consumer of the first two and the Random Signals Lab of the third.

## `packages/dsp` additions this lab made, for the labs that call it

Additions only. No signature moved, and Signal, Circuit, Control and Power Lab
stay green. `packages/dsp/index.js` names all of them.

- **`createComplexChain(registry)`**, for the Communications Lab. It is
  `createChain` again over an interleaved `Float64Array` of two numbers a
  sample, with `renderComplex`, `complexBuffer`, `toComplex`, `realOf`, `imagOf`
  and `magnitudeOf` beside it. A registry written for the real chain runs here
  unaltered, because a real-coefficient block acts on the two parts separately,
  and `src/complexPortable.test.js` pins that bit for bit against `createChain`.
  A block that mixes the two parts declares `makeComplex` and receives both
  numbers. `COMMUNICATIONS_LAB_PLAN.md` Decision 5 and §2 are the consumer.
- **`multirate.js`, `design.js`, `adaptive.js`, `fixpoint.js`, `estimate.js`.**
  Rate changes and the noble identities. Design to a written specification, with
  Parks-McClellan and the bilinear transform. LMS, NLMS and RLS. Quantisers and
  limit cycles. The estimators, the all-pole model, and the transform's own
  cost. A lab that needs one of these writes the contract into its own
  `NEEDS.md` and this lab's overseer adds it.

## Open

- **`scripts/verify.mjs` is not written.** `AGENT_BRIEF.md` §7 asks lane 2 for a
  Playwright harness, and both passes of this lab have been told to exclude
  Playwright. The lab now has two time views and six frequency views, which is
  the surface the harness exists to check. It is the largest gap before the
  release gate of `DSP_LAB_PLAN.md` §9, and it is deferred rather than written
  and left unrun.
