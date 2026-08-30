# Core scope — read before extending the suite

This document governs `@ee-labs/systems` and every bridge between apps. It applies to
any future app and to changes in the existing three. If a task conflicts with this document, stop and flag it
rather than working around it.

## The claim

This suite is **one core for the LTI rational core of EE, with explicit refusals at the
edges.** Not one core for all of EE. `@ee-labs/systems` trades in exactly one currency:
rational transfer functions — finite poles and zeros, real coefficients, in s or z.
Everything the suite can say honestly, it says in that currency. Everything it cannot,
it declines with a stated reason. The boundary of the mapping is content, not a
limitation to be engineered away.

## Rule 1 — Admission test for `systems`

An object goes into `@ee-labs/systems` only if it is expressible **exactly** as a
rational function of s or z.

- No adapter that "mostly" converts an inadmissible object is acceptable.
- Padé approximation, state-space averaging, and linearization do not make an object
  admissible. They create a **new** object — an approximation — which must be labeled
  as such at the point of creation and is governed by Rule 3. It must never be
  silently substituted for the thing it approximates.
- If you are unsure whether something is admissible, it is not, until shown otherwise
  with a test.

## Rule 2 — A refused bridge is a finished feature

When a mapping between two views is not exact, the correct implementation is to
**decline, or warn, with the reason** — not to ship the nearest approximation.

- Existing precedents, which new work must follow: the sampled-filter panel refuses a
  link below twenty samples per cycle at the corner; the plant handoff declines outputs
  measured across R or L because the numerator carries zeros the second-order plant
  cannot express.
- A refusal is not a TODO. Do not leave comments suggesting the mapping be "completed
  later." The refusal message is content: it must state *why* the mapping fails, and it
  requires a test like every other claim in the suite.
- Your instinct will be to make the feature work. Here, making it work means making the
  boundary visible.

## Rule 3 — No approximation without a guard

Every approximation the suite does ship carries its own applicability check, with a
concrete threshold, and crossing the threshold changes what the UI shows.

- The guard is part of the feature, not an enhancement. An approximation merged without
  its guard is incomplete.
- The threshold and its behavior (warn vs refuse) must be stated in the panel and
  exercised by a test.

## Counter-rule — Exact mappings are never hedged

Rules 1–3 must not be over-applied. When a mapping **is** exact, present it without
qualification.

- The bilinear-transformed biquad, the delay-free series RLC, the RLC's (f₀, Q) handed
  to Signal Lab — these are exact within their stated meaning and get no warning, no
  "approximately," no hedge.
- The discipline is precision about *which case you are in*, not caution everywhere.
  A hedge on an exact mapping is a bug of the same severity as a missing guard on an
  approximate one: both teach the reader to distrust the honest signal.

## Worked examples

| Object | Admissible in `systems`? | Handling |
| --- | --- | --- |
| Series RLC transfer function | Yes — exact rational H(s) | Full membership, no hedge |
| RBJ biquad from (mode, f₀, Q) | Yes — exact rational H(z) | Full membership, no hedge |
| Transmission-line delay e^(−jβl) | **No** — transcendental, no finite poles/zeros | Refuse at the `systems` boundary; a Padé version is a new labeled object under Rule 3 |
| Averaged small-signal buck model | Yes — but it is an approximation of the switched converter | Admit as a plant, with an fs-guard: warn/refuse as crossover approaches fs/5 |
| Linearized transistor stage | Yes — but only as a small-signal view | Admit, labeled as small-signal; the label states the operating point it is valid around |
| Switched converter (time domain) | **No** — piecewise-linear, topology changes per switch state | Needs its own package and interaction model; do not force it through `systems` |

## Where this lives

- This file is the reference. Additionally, copy the **admission test (Rule 1)** as a
  short comment block at the top of `packages/systems`' entry module, pointing here —
  rules placed where the work happens get followed.
- When adding a new app, restate in its README which of its objects are admissible,
  which are approximations (and their guards), and which are refused. The
  "Why these boundaries" section of the root README is the model.

## Quick self-check before merging

1. Did I put anything into `systems` that is not exactly rational? (Rule 1)
2. Did I approximate where I should have refused? Is every refusal message tested? (Rule 2)
3. Does every approximation I shipped carry a threshold, UI behavior, and test? (Rule 3)
4. Did I hedge anything that is actually exact? (Counter-rule)
