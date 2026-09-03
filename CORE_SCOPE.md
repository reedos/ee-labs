# Core scope — read before extending the suite

This document governs `@ee-labs/systems` and every bridge between apps. It applies to
any future app and to changes in the existing three. If a task conflicts with this
document, stop and raise it rather than working around it.

## The claim

This suite is **one core for the LTI rational core of EE, with explicit refusals at the
edges.** It is not one core for all of EE. `@ee-labs/systems` trades in one currency:
rational transfer functions with finite poles and zeros, real coefficients, in s or z.
Everything the suite can state exactly, it states in that currency. Everything else it
declines, with a reason. Where the mapping stops is part of the content, not a
limitation to engineer away.

## Rule 1: admission test for `systems`

An object goes into `@ee-labs/systems` only if it is expressible **exactly** as a
rational function of s or z.

- No adapter that mostly converts an inadmissible object is acceptable.
- Padé approximation, state-space averaging and linearization do not make an object
  admissible. They create a **new** object, an approximation, which must be labelled as
  such where it is created and is governed by Rule 3. It must never be substituted for
  the thing it approximates.
- If you are unsure whether something is admissible, treat it as inadmissible until a
  test shows otherwise.

## Rule 2: a refused bridge is a finished feature

When a mapping between two views is not exact, the correct implementation declines or
warns, and gives the reason. It does not ship the nearest approximation.

- Two precedents that new work follows. The sampled-filter panel refuses a link below
  twenty samples per cycle at the corner. The plant hand-over declines outputs measured
  across R or L, because the numerator carries zeros that the second-order plant cannot
  express.
- A refusal is not a TODO. Do not leave comments suggesting the mapping be completed
  later. The refusal message is content. It states why the mapping fails, and it needs a
  test like every other claim in the suite.
- The instinct is to make the feature work. Here, making it work means making the
  boundary visible.

## Rule 3: no approximation without a guard

Every approximation the suite ships carries its own applicability check, with a concrete
threshold. Crossing the threshold changes what the UI shows.

- The guard is part of the feature. An approximation merged without its guard is
  incomplete.
- The threshold and its behaviour, warn or refuse, are stated in the panel and exercised
  by a test.

## Counter-rule: exact mappings are never hedged

Rules 1 to 3 must not be over-applied. When a mapping is exact, present it without
qualification.

- The bilinear-transformed biquad, the delay-free series RLC, and the RLC's (f₀, Q)
  handed to Signal Lab are exact within their stated meaning. They get no warning, no
  "approximately", and no hedge.
- The discipline is precision about which case you are in, not caution everywhere. A
  hedge on an exact mapping is as serious as a missing guard on an approximate one. Both
  teach the reader to discount the signal that carries information.

## Worked examples

| Object | Admissible in `systems`? | Handling |
| --- | --- | --- |
| Series RLC transfer function | Yes. Exact rational H(s) | Full membership, no hedge |
| RBJ biquad from (mode, f₀, Q) | Yes. Exact rational H(z) | Full membership, no hedge |
| Transmission-line delay e^(−jβl) | **No.** Transcendental, no finite poles or zeros | Refuse at the `systems` boundary. A Padé version is a new labelled object under Rule 3 |
| Averaged small-signal buck model | Yes, but it approximates the switched converter | Admit as a plant with an fs guard: warn or refuse as crossover approaches fs/5 |
| Linearized transistor stage | Yes, but only as a small-signal view | Admit, labelled small-signal. The label states the operating point it is valid around |
| Switched converter (time domain) | **No.** Piecewise-linear, and the topology changes per switch state | Needs its own package and interaction model. Do not force it through `systems` |

## Where this lives

- This file is the reference. Also copy the **admission test (Rule 1)** as a short
  comment block at the top of the `packages/systems` entry module, pointing here. A rule
  placed where the work happens is the one that gets followed.
- When adding a new app, restate in its README which of its objects are admissible,
  which are approximations with their guards, and which are refused. The
  "Why these boundaries" section of the root README is the model.

## Quick self-check before merging

1. Did I put anything into `systems` that is not exactly rational? (Rule 1)
2. Did I approximate where I should have refused, and is every refusal message tested?
   (Rule 2)
3. Does every approximation I shipped carry a threshold, a UI behaviour and a test?
   (Rule 3)
4. Did I hedge anything that is exact? (Counter-rule)
