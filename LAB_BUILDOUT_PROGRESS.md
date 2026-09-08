# Ordered lab buildout

User-approved order, 2026-09-08. Complete and review each priority before extending
the next. Work in the isolated rollout worktree; preserve concurrent director and
main-checkout changes.

| Priority | Scope | Status |
| --- | --- | --- |
| 2 | Prepare Electronics' 75 entries for release: coverage, explanations, browser review | Local preparation complete; remains dark |
| 3 | Review the first five Interfaces and five VLSI experiments, then extend their planned groups | Complete locally: 25 Interfaces and 25 VLSI extensions, with final model, browser and integration checks |
| 4 | RF E–H, Fields I–L, System B–F, Photonics B, Control II F3–F5 | Complete locally: RF 16, Fields 17, System 21, Photonics 4 and Control II 3 extensions |
| 5 | Start Applied Analog, Analog IC and Mixed-Signal from their plans | Complete locally: six functional Group A lessons in each app; later groups remain planned |

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

## Earlier extension checkpoint, 2026-09-08 (historical)

The implementation now has 25 Interfaces B–G lessons, 25 VLSI B–G lessons,
16 RF E–H lessons and 17 Fields I–L lessons. Each uses a shared learning workbench
with definitions, analysis-route guidance, stepwise LaTeX, parameter-linked plots,
aligned result tables, and entered-answer practice. Original foundation screens
remain available through a common sequential catalog.

- Interfaces: native pin-voltage UART sampling, SPI phase tables, arbitration,
  acquisition and timing budgets, exact periodic PWM ripple, and event-based
  bounce/debounce. Six tests and all 25 lessons × four views at 1440/390/320 px
  passed. Remaining scope review includes the complete CAN oscillator bounds and
  the planned Signal Lab handover.
- VLSI: native RC networks, current-balanced SRAM curves, and a connected
  two-latch switch-model flip-flop with measured setup and clock-to-Q timing.
  Seven model tests passed. The latest F2/F3 timing defaults and shared plot changes are included in the final browser verification below.
- RF: native hybrid-pi two-port, stability and matching circles, noise budgets,
  coherent two-tone FFT, guarded IP3 extrapolation, and oscillator models.
  Seven active-model tests and all 16 lessons × four views at 1440/390/320 px
  passed. The transistor unity-current-gain frequency is distinguished from
  the 50 Ω S21 response.
- Fields: native distributed-line, waveguide and antenna engines; reflected
  arrival ladder, Smith chart, polar power patterns, loss/dispersion comparison,
  and guarded cavity/Friis estimates. Five new tests cover all default and knob
  endpoints, renderable math, physical identities and refusals. All 17 lessons ×
  four views at 1440/390/320 px passed again after the shared mobile scroll correction, including a new check against nested mobile page scrolling. The plan now corrects load-arrival times and array
  phase convention and removes the unsupported global wire-directivity maximum.

RF, System and Photonics foundations and their absent engine packages were
integrated selectively from director commit cbe424a. The other checkouts were
not changed. System B–F, Control II F3–F5 and the three analog app
foundations still require implementation. Shared changes, full-suite verification,
app registration in site assembly/deployment and final documentation review remain.
No push or live deployment of these extensions has occurred.

### Photonics receiver checkpoint

B1–B4 now fill the gap between photodiode foundations A and light-source group C.
The models distinguish one-sided current noise density, rectangular noise bandwidth,
RC-filtered noise, thermal-only sensitivity, shot-inclusive sensitivity, and the
Poisson photon-counting limit. Five new model/catalog tests passed, including an
independent RC noise integral and substitution into the unequal-noise OOK criterion.
All four lessons × four views passed Chromium at 1440/390/320 px. The application
build passed. The plan now states the sensitivity assumptions and the actual error
probability of the rounded 20-photon example. These changes remain local.

### Integration verification

The affected apps and shared packages passed 1,595 tests in 80 files. The complete
workspace build passed 23 apps and caught one VLSI failure: two Windows-encoded
apostrophes in the new timing lesson. Those bytes were repaired to UTF-8; the VLSI
production build then passed, completing all 24 app builds. A strict UTF-8 scan
of repository source, styles, JSON, HTML, YAML and Markdown found no remaining
encoding errors. The shared mobile layout now uses a single document scroll,
with a browser assertion against nested root scrolling. Fields and Photonics
passed all new lessons at 1440/390/320 px after that correction.

Final Interfaces (25), VLSI (25), and RF (16) browser reruns also passed every
new lesson and all four views at 1440/390/320 px. Together with Fields (17) and
Photonics (4), that is 87 added lessons checked at all three widths. This records
UI and model verification; it does not mark pending scope items or deployment
as complete.

## Final requested-scope acceptance, 2026-09-08

The requested buildout is complete locally. This supersedes the pending items in
the earlier checkpoints above. There are **129 added lessons**, plus the existing
foundations, in the ten affected apps. These apps remain dark; no merge to master,
push or live deployment of this buildout is claimed.

| App | Added scope | Added lessons | Combined catalog |
| --- | --- | ---: | ---: |
| Interfaces | B–G | 25 | 30 |
| VLSI | B–G | 25 | 30 |
| RF | E–H | 16 | 35 |
| Fields | I–L | 17 | 53 |
| System | B–F | 21 | 25 |
| Photonics | B | 4 | 25 |
| Control II | F3–F5 | 3 | 35 |
| Applied Analog | A foundations | 6 | 6 |
| Analog IC | A foundations | 6 | 6 |
| Mixed-Signal | A foundations | 6 | 6 |

### Learning and model review

- Start here defines symbols, units, reference directions, prerequisites and model
  limits. Worked math follows the governing law through substitution to a result.
  Explore and entered-answer Practice use the same current parameter values.
- Shared tabs have constant geometry across views. Tables and long equations
  scroll internally. Mobile pages have one document scroll. Native circuit drawings
  have readable labels and an enlarged dialog with keyboard close/focus behavior.
- Interfaces now includes both classical CAN oscillator constraints. Its sampling
  handover carries the folded tone into Signal Lab's accepted Nyquist-band source
  controls, states the sine/cosine phase difference, and preserves sample rate.
- System uses the native cascade engine, a separately evaluated cascaded cubic
  waveform/FFT, random-phase ensembles with uncertainty, a link-budget waterfall,
  and a capstone with editable LNA, mixer and IF specifications. A compressed
  operating point does not expose an accepted small-signal IP3 estimate.
- Control II uses a two-state covariance model, Joseph updates, converged steady
  gain and independently checked Gaussian ensembles. A deliberately wrong sensor
  variance exposes estimator overconfidence.
- Applied Analog separates illustrative class parameters from guaranteed
  manufacturer specifications. Native AC and transient models check bandwidth,
  active-filter response and slew calculations.
- Analog IC uses one consistent charge-based current/derivative law. The plan's
  mixed interpolation and pair-area arithmetic were corrected. Short-channel
  corrections are explicitly a separate comparison model.
- Mixed-Signal conserves charge across ideal events and checks the answer with a
  finite-R native transient. Clock injection, bottom-plate sign, thermal-noise
  bandwidth and seeded aperture jitter have explicit assumptions.
- The analog apps are the requested **start**: all six planned foundation topics
  per app are working. Later groups, full converter/PLL apps, general switched-cap
  synthesis, a general EKV netlist companion, and general analog yield/sensitivity
  tools remain future work. They are not claimed complete by this checkpoint.

### Recorded verification

- Full repository suite: **10,388 tests passed in 391 files**.
- After the final model/content updates: **1,244 affected tests passed in 71 files**,
  including the added RF catalog and CAN-bound coverage. The full-suite count is
  reported as actually run, rather than inferred by adding later test counts.
- All **27 app production builds** passed. The last Applied Analog drawing-only
  adjustment was rebuilt and checked again in the assembled site.
- All **129 new lessons × four views × 1440/390/320 px** passed Chromium checks:
  finite default results, rendered LaTeX, invariant tab geometry, practice feedback,
  page overflow, mobile scroll behavior and applicable drawing dialogs.
- `scripts/verify-rollout.mjs` passed at all three widths on the assembled site:
  every app route returns 200; local/deployment catalogs agree; mobile suite links,
  class selections, switch phases, editable/reset capstone values, drawing contrast
  and label separation, waterfall rendering and the Signal handover work.
- Strict UTF-8 decoding passed for 1,608 source/document files, preventing the
  earlier encoding issue from recurring. `git diff --check` passed.
- The assembled 27-app site is **35.72 MiB**. Screenshots are ignored development
  artifacts under each app's `.shots` directory, not committed site assets.

Reproduce with `npm test`, `npm run build`, `npm run site`, then
`node scripts/verify-rollout.mjs` and `node scripts/verify-extended.mjs <app>`.
The work uses the isolated `feature/circuits-ii-rollout` checkout. Concurrent
checkouts and the unrelated prose-linter/debug changes are preserved.
