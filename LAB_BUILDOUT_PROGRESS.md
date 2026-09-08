# Ordered lab buildout

User-approved order, 2026-09-08. Complete and review each priority before extending
the next. Work in the isolated rollout worktree; preserve concurrent director and
main-checkout changes.

| Priority | Scope | Status |
| --- | --- | --- |
| 2 | Prepare Electronics' 75 entries for release: coverage, explanations, browser review | Local preparation complete; remains dark |
| 3 | Review the first five Interfaces and five VLSI experiments, then extend their planned groups | Foundation review and fixes implemented; B–G extensions pending |
| 4 | RF E–H, Fields I–L, System B–F, Photonics B, Control II F3–F5 | Pending |
| 5 | Implement Applied Analog, Analog IC and Mixed-Signal from their plans | Pending |

## Standards carried forward from Circuit Elements

- Teach prerequisites before using them. Start each lesson with its question,
  model assumptions and what the learner should be able to do afterwards.
- Define symbols, reference directions and units before equations. Distinguish
  bias from perturbation, peak from RMS and transient from steady state.
- Work from physical laws to symbolic equations, numerical substitution and
  the answer. Compare with an independently computed quantity where possible.
- Explain which analysis route answers the question, its advantages and its
  limits. Do not imply a small-signal model predicts clipping or startup.
- Keep the established schematic, settings and analysis-pane layout. Collapse
  the catalog, provide sequential navigation and keep analysis tabs stationary.
- Keep mathematics in a usable scrolling area, tables aligned and dense drawings
  readable on phones. Preserve keyboard operation and shared lab navigation.
- Give learners a prediction or independently entered answer, explanatory
  feedback and optional hints; clear stale feedback when the problem changes.
- Review actual rendered content and interactions across every experiment and
  offered view, on desktop and phone. Check mathematics and model boundaries,
  not just catalog counts or successful builds.

## Priority 2 findings

- The catalog contains 75 entries in 14 groups. Group B's two diode topics are
  already covered by Circuit Elements I9 and I10; make that prerequisite explicit.
- The package advertises a browser verification script that is absent.
- The picker renders all 75 buttons above the lesson and settings.
- The analysis heading shares a wrapping row with the view buttons, allowing
  heading length to displace navigation.
- Worked mathematics currently sits in the narrow sidebar, separate from the
  equations view. Audit its coverage before treating all entries as release ready.

Release and completion claims require recorded checks; pending rows are not
claims that implementation or review has finished.

## Priority 2 acceptance, 2026-09-08

- Audited 75 entries in 14 groups against the plan. The two Group B topics are
  already taught in Elements I9/I10 and are now linked as preparation.
- Added compact sequential navigation, Start here, a full-width Worked math pane,
  route limits, numerical prediction feedback, and accessible enlarged drawings.
- Fixed the mobile picker placement, missing suite navigation and horizontal
  overflow. Tab weight and position stay constant across selections.
- Equations previously listed unknowns without the matrix or solution. They now
  use the shared Circuit Elements worked solve, with explicit local-model limits.
- Corrected the opening offset formula to include the applied input and added
  definitions/substitution. Removed its self-comparison gain check.
- Electronics: 279 tests passed. Shared URL, original Elements worked-solve and
  practice checks: 31 tests passed. Both affected apps built successfully.
- Chromium visited every offered view of all 75 lessons at 1440 and 390 px.
  Rendered math, worked equation steps, tab geometry, no page overflow, suite
  navigation, answer feedback and drawing-dialog keyboard behavior passed.
- Inspected the phone screenshot for navigator, picker, schematic, matrix,
  mathematical scrolling and settings. Screenshots are in the app's ignored shots.
- This is local release preparation. No Electronics public release or live
  deployment is claimed. See its app README for coverage and model boundaries.

## Priority 3 foundation work

Integrated the existing Interfaces and VLSI app sources from director commit
`cbe424a` into this isolated worktree, together with their shared playback and chip
context components. The director and main checkouts are untouched.

- Interfaces' five existing lessons passed Chromium checks at 1366, 1440, 2560,
  390 and 320 px. Removed duplicate worked math when Equations is selected and
  aligned the noise-budget value header with its numeric column.
- VLSI now compares the ideal event chain with a separately connected continuous
  switch-model chain. Each later gate sees its preceding node's analog voltage.
  Timing shows the final analog trace, per-stage crossings, and model difference
  separately from event rounding. Loads smaller than the next gate's input
  capacitance are explicitly excluded from the connected comparison.
- The new chain tests cover both edges, several lengths and fanouts, first-stage
  agreement with isolated extraction, rail bounds and sample-count independence.
  Eight further second-stage checks agree with the independent symmetric-chain
  result `t2 = tau * ln(40/9)` at fanouts 1, 2, 4 and 8, for both edges.
- The independent result follows from the preceding exponential crossing
  `3 VDD/4` at `tau ln(4/3)` and `VDD/4` at `tau ln(4)`. During that interval both
  second-stage switches conduct, giving an equilibrium of `VDD/2` and time constant
  `tau/2`. The second output reaches `4 VDD/9` when the lower switch opens; the
  remaining rise to half supply takes `tau ln(10/9)`.
- Corrected the VLSI plan's assumption of exact analog/event-chain agreement,
  its width/self-capacitance example and the missing ln(2) fanout coefficients.
- Corrected Electronics D6's input-limit/noise-margin terminology and model-only
  zero-leakage claim while reviewing the cross-lab prerequisite.
- The combined affected-lab/shared-UI run passed 601 tests in 38 files. All 21
  application builds passed. Local assembly now includes the same 21 apps as the
  deployment workflow; both new apps remain dark.
- Final VLSI Chromium checks passed all five lessons at 320, 390, 1366, 1440,
  1920 and 2560 px, including the analog comparison, playback, held axes and
  anchored view selectors. The analog curve's legend matches its purple trace;
  waveform samples are cached independently of cursor animation. The final
  Interfaces rerun also passed after removing duplicate math and aligning headers.
- Local previews are available under `http://127.0.0.1:4192/` at
  `electronics-lab/`, `interfaces-lab/` and `vlsi-lab/` while the server is running.
  These follow-up changes have not been pushed or verified live.

Remaining priority 3 work is Interfaces B–G and VLSI B–G, in the existing lesson
shells. Interfaces B begins asynchronous framing and receiver sampling; VLSI B
begins transistor gate networks. Their later groups must retain explicit model
limits and independent circuit checks. Priorities 4 and 5 have not been started.
