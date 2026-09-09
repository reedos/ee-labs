# Ordered lab buildout

User-approved order, 2026-09-08. Complete and review each priority before extending
the next. Work in the isolated rollout worktree; preserve concurrent director and
main-checkout changes.

| Priority | Scope | Status |
| --- | --- | --- |
| 2 | Prepare Electronics' 75 entries for release: coverage, explanations, browser review | Local preparation complete; remains dark |
| 3 | Review the first five Interfaces and five VLSI experiments, then extend their planned groups | Deployed in 067c9c7: 25 Interfaces and 25 VLSI extensions, with final model, browser and integration checks |
| 4 | RF E–H, Fields I–L, System B–F, Photonics B, Control II F3–F5 | Deployed in 067c9c7: RF 16, Fields 17, System 21, Photonics 4 and Control II 3 extensions |
| 5 | Start Applied Analog, Analog IC and Mixed-Signal from their plans | Groups A–C deployed; Applied Analog D adds references/regulators for totals 21 / 17 / 18 (publication checks below) |

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


## Follow-on release: analog Groups B — 2026-09-08

The previous checkpoint was merged through PR #3 as `067c9c7`. GitHub deployment
run 34275209946 succeeded. Live browser checks confirmed all 27 app routes and
Signal's on-screen mobile suite navigation at 390 and 320 px. The three analog
apps remain dark/unlisted.

The follow-on implements the next three groups in order: Applied Analog B1–B5,
Analog IC B1–B5 and Mixed-Signal B1–B6. Totals are **11, 11 and 12** respectively.
All use the existing Start here / Worked math / Explore / Practice workbench,
anchored tabs, defined notation, substitutions, responsive tables and drawings.

Two reusable engines support the lessons: `parameterEnsemble` in the random
package retains correlations and estimator intervals; `chargeStep` in switched
projects capacitor charge under explicit driven/floating/feedback constraints.
Neither claims a general analog synthesis system. Mixed-Signal uses the existing
native z-plane canvas and clearly names frequency scaling in Signal handovers.

The three plans' Group B sections now document validated equations and corrections:
separate crossover/bandwidth, loaded isolation margin, the bandgap's ln N slope,
resistor contributions to reference-current drift, and topology-dependent
finite-gain SC leakage. Startup enumerates DC roots and checks native MOS currents;
a transistor-level startup/shutoff transient is not claimed.

### Follow-on checks

- 23 targeted tests passed across eight files before the final diagram and z-plane
  integration. These include native AC/loop comparisons, exact state response,
  MOS current/KCL checks, charge projection versus a finite-R transient,
  parameter uncertainty, approximation guards and the actual Signal link consumer.
- Catalog/default/control-endpoint checks render all displayed LaTeX and require
  finite numeric results. Browser checks cover all 34 analog lessons and all four
  views at 1440, 390 and 320 px.
- Full repository suite: **10,403 tests passed in 397 files**, 281.82 seconds.
- All 27 production app builds passed. Final UI-only changes are rebuilt and
  browser-checked again; no model assertion was relaxed.
- Assembled integration checks passed at 1440/390/320 px: drawing label separation,
  editable switch phases, the 20-samples/cycle guard, z-plane redraw after Q changes,
  exact-coefficient Signal handover and existing rollout navigation/capstones.
- Dimensionless controls now display plain decimal numbers (0.1 rather than
  100 m), while physical quantities retain engineering units.
- Final affected tests: **1,998 passed in 29 files** after the last model/control
  updates. Strict UTF-8 decoding passed for 1,623 source/document files.
- Final shared-control regression: **145 guided lessons × four views × three widths** passed across ten apps, including return to existing foundation views.
- Final assembled site: **35.83 MiB** for 27 apps.

At the Group B checkpoint, Groups C onward were planned. The subsequent implemented sequence is Applied Analog
precision, Analog IC amplifier architectures, then Mixed-Signal static converter
errors; each needs its own model and presentation review rather than placeholder
lesson entries.


## Applied Analog precision — Group C

Five precision lessons are implemented, bringing Applied Analog to 16 lessons.
Analog IC remains at 11 and Mixed-Signal at 12 pending their Group C work.
The applications remain dark/unlisted. Native nodal and transient checks cover
resistor matching, three-amplifier instrumentation and chopped periodic state;
independent error-envelope checks cover calibration. All 10 Applied Analog tests
pass; all 16 lessons pass four-view browser checks at 1440, 390 and 320 px.
Publication verification is recorded after deployment.


## Analog IC architectures — Group C

Six architecture lessons extend Analog IC to 17 entries. All retain the existing
learning layout. Native AC and broken-loop checks verify cascodes, Miller
feedforward, overall feedback, and each auxiliary booster. Static output stages
and complementary input tails use the native square-law device law. Limits of
the folded headroom model, ideal gm steering and one-pole bandwidth comparison
are stated in the lessons. No full foundry design or stage-level stability is
inferred from a gm/C estimate. The app remains unlisted.

Architecture validation: 11 tests across three files; 17 lessons × four views ×
1440/390/320 px. Additional browser checks cover Miller drawing label separation
and complementary-pair cutoff on changing common mode.


## Mixed-Signal static converters — Group C

Six converter lessons extend Mixed-Signal to 18 entries. The current totals are
**Applied Analog 16, Analog IC 17, Mixed-Signal 18**. All three apps remain dark.
Native charge projection verifies the binary/split DAC and SAR trial sequence;
all 4097 endpoint-grid inputs verify pipeline correction at five offset settings
inside the redundancy bound. Flash code bins retain explicit encoder semantics;
Monte Carlo spread/yield and calibrated weight uncertainty remain distinct.

Final targeted checks: **50 tests in 10 files**, including all three analog apps
and the transformer invariant file. Browser checks cover all 51 analog lessons,
four views and 1440/390/320 px, with extra switch-phase, drawing-label, input-pair
cutoff, pipeline-failure and plain-number table checks. Final Miller phase uses
unwrapped phase and catches an unstable parameter combination as a negative
margin instead of wrapping it into a misleading positive value.

The repository-wide run exposed an existing unseeded transformer assertion at
near-open-circuit loading. A reproduced corner loses relative precision when
subtracting nearly equal source voltages. The exact primary-port current ratio
remains checked; the separate source-resistor KCL check now includes an explicit
floating-point subtraction bound. A fixed regression compares both currents with
the independent circuit closed form. No circuit implementation was changed.

Full-suite, production-build and live results follow after completion.

All 27 production builds and assembled integration checks passed. Final assembled
site size is 35.93 MiB. Final browser verification and deployment status below.

Applied Analog C was merged as 7b30636 and deployed successfully in Actions run
34281387686. Live checks verified the 16/11/12 catalogs, all 27 routes and Signal
mobile navigation at 390 and 320 px before the remaining Group C publication.

Repository-wide verification completed with 10,417 passing tests and only the
reproduced transformer precision assertion failing (400 files, 278.20 s). The
corrected invariant and all final analog changes then passed the 50-test targeted
run. A clean full-suite run and GitHub deployment gate verify the final commit.


## Applied Analog references and regulators — Group D

Five lessons extend Applied Analog to **21** entries. Analog IC stays at 17 and
Mixed-Signal at 18; those apps’ Group D lessons are the next separate buildout.
All three remain unlisted on the public splash page.

The reference uses the shared Analog IC temperature law. The LDO uses native
controlled-source circuit checks, explicitly derived two-state propagation and
exact return-ratio handover. Supply rejection includes pass, reference and
amplifier paths. Thermal calculations include quiescent loss and refuse to call
an infeasible dropout target a predicted operating point. The selection task
separates integrated white noise, switching ripple, ADC aliasing and assumed buck
efficiency; Power Lab receives a validated editable ideal converter setup.

Validation and publication results are recorded below after completion.

Visual review also exposed a shared numeric-entry bug: scientific notation was
multiplied by the displayed engineering prefix. Explicit scientific notation or
base-unit suffixes now keep their own scale, while bare numbers still use the
visible prefix. Regression checks cover 1e-7, 100n and bare 100 in a nanovolt field.

The ideal buck handover automatically increases inductance at light load/low
switching frequency to retain continuous conduction. Native Power Lab solutions
check the 3.3 V average and ideal efficiency across the input/load/clock corners;
the assumed 90% budget is never substituted for that ideal model result.

Release checks: all 27 production builds pass. All 21 Applied Analog lessons pass
four-view checks at 1440, 390 and 320 px. Extra browser checks cover diagram label
separation, zero ESR, dropout refusal, scientific/prefixed numeric entry, plain
number tables, both handovers and invalid incoming links. Assembled site checks
pass for all 27 routes. The first full run passed 10,427 tests in 401 files; the
final 78-test focused run includes the numeric-entry fix and native buck corners.
A second full run passed 10,428 tests in 401 files (272.33 s); the final buck
corner and lesson changes also pass the 78 focused tests. GitHub Pages runs the
full suite again before deployment.


## Analog IC fully differential amplifiers — Group D

Four lessons extend Analog IC to **21** entries, alongside Applied Analog 21 and
Mixed-Signal 18. All three remain unlisted on the public splash page. Mixed-Signal
D1–D5 is the next separate buildout.

D1 checks output-mean drift with linear nodal equations and nonlinear MOS regions.
D2 compares the full differential pair with both exact half-circuits and clearly
separates the large-tail shortcut and single-ended CMRR convention. D3 retains
four states and two controller poles, checks both physical return ratios, and
hands both loops independently to Control Lab. D4 includes real sensor loading,
follower headroom, switching charge, periodic recovery and incomplete acquisition.

The shared lesson workbench now supports multiple related handovers while
preserving existing single-link lessons. All math, definitions, plots, comparison
tables and practice remain in the existing four-view structure. Verification and
publication results are recorded below after completion.

Release checks so far: 20 Analog IC tests pass, including independent nonlinear
DC solves, full/half AC comparisons, both physical loop breaks, native transient
waveforms, charge conservation and the actual Control Lab receiver. All 21 lessons
pass all four views at 1440, 390 and 320 px. Additional browser checks cover region
transitions, sensor options, incomplete acquisition, aligned table columns,
schematic labels/dialogs and both mode links. All 27 production builds and
assembled integration checks pass; the assembled site is 36.01 MiB.

Repository-wide verification passed **10,436 tests in 402 files** (261.26 s).
The final 20-test Analog IC run includes the expanded controller-pole corners
and numerical state-matrix example. Existing Applied Analog single-link handovers
also pass browser checks after the shared multi-link workbench update.

The final boundary review also checks follower compliance at the selected output
difference: a 0.4 V difference places the lower output at 0.7 V, below the 0.75 V
limit. The lesson marks that operating point invalid and displays signed headroom,
while retaining the explicitly assumed incremental model for comparison.


## Mixed-Signal dynamic converter errors — Group D

Five lessons extend Mixed-Signal to **23** entries, alongside Applied Analog 21
and Analog IC 21. This completes the requested 14-lesson Group D sequence.
All three apps remain unlisted on the public splash page.

The existing four-view structure now covers settling budgets, continuous
slew/settling, regenerative decisions, measured converter spectra and histogram
inference. Worked equations define initial states and substitute the selected
values. Logarithmic acquisition-error plots keep half-LSB limits visible; this
backward-compatible plotting option leaves other lessons' linear axes unchanged.

The spectrum reuses the exact slew propagator and shared periodogram, retaining
explicit DC/fundamental/aliased-harmonic/noise bin accounting. The code-density
lesson reuses Group C's flash transfer and separates six-bit measured records
from higher-resolution sample-count planning. Uniform pointwise Wilson intervals
and sine-CDF simultaneous DKW bands carry distinct coverage statements.

Initial verification passes 23 Mixed-Signal tests, including independent native
RC/regeneration solves, numerical slew integration, Parseval, known spectra,
aliased harmonics, seeded reproducibility and interval coverage. Final build,
browser, repository-wide and publication evidence follows below.

All 27 production builds and assembled integration checks pass. All 23 Mixed-Signal
lessons pass four-view checks at 1440, 390 and 320 px. Extra D1–D5 browser checks
cover correct practice answers, logarithmic curve geometry, zero/falling steps,
the unresolved zero comparator state, all spectrum modes, zero-hit code intervals,
sine inference, table columns and reset. Analog IC D1–D4 also passes its existing
browser suite after the shared plot update. Assembled site size is 36.05 MiB.

Repository-wide verification passed **10,445 tests in 403 files** (263.97 s).
The final targeted run passed all 23 Mixed-Signal tests after the explanatory
clarifications; the final browser run includes those same built assets.


## Analog Group E — 15-lesson implementation

Applied Analog E1–E5, Analog IC E1–E4 and Mixed-Signal E1–E6 extend the catalogs to **26 / 25 / 29**. All three apps retain their existing four-view layout and remain unlisted on the public splash page.

The sensor lessons distinguish exact resistor-ratio leakage, shared-return lift, electrothermal RTD heating, nonlinear type K compensation and simultaneous filter requirements. Compensation uses actual nodal/state models rather than substituting approximate pole locations; nested and feedforward models expose both global closed poles and a carefully defined inner-loop diagnostic. Noise shaping separates nonlinear quantizer runs, exact additive-error identities, statistical white-error assumptions and finite-record measurements. It implements actual filtering before decimation and finite, imperfect droop correction.

Corrections to the plans include the exact 24.024 mV resistor-corner error, fifth-order anti-alias requirement with 0.1 dB passband loss, full-model Miller margins, and removal of a universal 0.7-full-scale overload threshold and perfect sinc correction claim. Later group plans remain future scope.

Focused validation passed 76 tests across the three analog apps. The new tests independently check KCL, electrothermal balance, ITS-90 reference points and inverse conversion, filter inequalities, native circuit AC/state transfer agreement, inner-loop source breaking, sample timing, Parseval, NTF integrals, stochastic model power, overload and FIR convolution/gain/delay.

All 15 new lessons passed four-view browser checks at 1440, 390 and 320 px, including practice answers, tab anchoring, table column counts, math rendering, boundary settings, circuit enlargement and reset. Final repository-wide, assembled and publication verification will be recorded with this release.

Final local verification: **10,461 tests in 406 files passed** (295.41 s). All 27 production builds passed. All **80 analog lessons** passed all four views at 1440/390/320 px. Group E boundary checks and both exact second-order Control Lab handovers passed. The assembled 27-route integration check passed; site size is **36.13 MiB**. Source/reference-only refinements retain the verified model and layout behavior.

## Group F implementation and release checks, 2026-09-08

All 15 Group F lessons are implemented, bringing Applied Analog / Analog IC / Mixed-Signal to 31 / 29 / 35 lessons. The app READMEs and plan Group F records specify corrected mathematics and model limits. Control Lab now accepts an exact third-order custom transfer for the PLL handover.

Focused acceptance: 659 tests in 47 files passed. All 27 production builds pass. Browser coverage passes for all 95 analog lessons × four views × 1440/390/320 px, plus all 15 new lessons with entered-answer checks, boundary controls, anchored tabs, aligned tables, diagram dialogs and both exact PLL handovers. The assembled site is 36.21 MiB. Full-suite and publication evidence is recorded separately after completion. Existing unrelated prose-linter and debug-log changes are excluded.

## Group G implementation and release checks, 2026-09-09

All **13 Group G lessons** are implemented: Applied Analog G1–G4, Analog IC G1–G4 and Mixed-Signal G1–G5. Catalog totals are now **35 / 33 / 40**. They retain Circuit Elements' four anchored learning views, defined symbols, worked substitutions, parameter-driven plots, aligned tables and entered-answer practice. Enlarged diagrams keep their natural proportions and provide a mobile scrolling hint and keyboard-accessible scroll area.

The model records in the three plans supersede draft promises: rail voltage is included in fault-current calculations; clamp thresholds and valid common-mode operation are distinct; driven-shield stability retains source bootstrapping; bipolar full steering is asymptotic; multiplier conversion is normalized explicitly; charge-injection jumps differ from cycle-average offset; noise folding is a stated path comparison, not a blanket product claim. Chopper and auto-zero lessons specify initial states and phase transitions. CDS includes covariance and wanted-signal attenuation.

Handovers preserve the complete third-order shield return ratio and exact one/two-sample difference filters. Third-order URL coefficients now retain full precision. The Gilbert lesson's Signal Lab link is explicitly an ideal sine-multiplier comparison, with its differences named before opening it.

Focused acceptance: **134 tests in 22 files passed**. All **27 production builds** passed. All **108 analog lessons × four views × 1440/390/320 px** passed browser checks. All 13 new lessons also passed practice-answer, boundary, table, diagram, math, tab-position and cross-lab checks. The assembled site is **36.27 MiB**. Final repository-wide and publication evidence is recorded with the release. Unrelated prose-linter and debug-log changes remain excluded.

Mixed-Signal now implements all seven planned curriculum groups; generic engine and product features elsewhere in its plan remain separate future scope. Applied Analog H–I and Analog IC H–J remain planned. The three analog apps remain directly accessible and unlisted on the public splash page.

Final repository-wide verification: **10,493 tests in 412 files passed** (245.96 s). The final focused suite and browser runs include the glossary and enlarged-diagram refinements. Publication and live-page checks follow on the release PR.

## Group H implementation and release checks, 2026-09-09

All nine Group H lessons are implemented: Applied Analog H1–H5 and Analog IC H1–H4. Catalog totals are now **40 / 37 / 40** across the three analog apps. Mixed-Signal is unchanged. The established four-view layout, anchored tabs, defined quantities, numeric LaTeX substitutions, plots/tables and entered-answer practice are retained.

Applied Analog adds exact ideal 555 threshold events, startup and nonzero initial charge, RMS-calibrated lock-in detection with finite-band noise integration, bias-temperature tracking with emitter degeneration and a local thermal-feedback criterion, and class-B average/instantaneous power checks with an achievable 20 W design task. The class-B correction is explicit: worst device heating occurs at 50% efficiency; 40.53% is its output-power fraction.

Analog IC adds native gm-C integrators/biquads, a bounded master tuning iteration with seeded process/slave mismatch ensembles, and a fourth-order LC ladder converted to normalized integrator states. Native circuit, state and transfer routes agree. Both denominator coefficients are retained when interpreting leakage-induced Q changes. Ladder/cascade sensitivity comparisons name their component models and measured quantities; no universal sensitivity ranking is claimed. Complete second- and fourth-order filter handovers retain all poles and state their 1000× time scaling and bilinear frequency mapping.

Focused acceptance: **117 tests in 23 files passed**. All **27 production builds** passed. All **77 lessons in the updated apps × four views × 1440/390/320 px** passed browser checks. All nine new lessons additionally passed entered-answer, boundary, table, math, diagram, anchored-tab and receiving-app checks. Visual review corrected crowded biquad labels. The assembled site is **36.32 MiB**. Final full-suite and publication evidence follows with the release. Unrelated prose-linter and debug-log changes remain excluded.

Final repository-wide verification: **10,503 tests in 414 files passed** (232.37 s). Final focused and browser checks include the diagram-label and reference-convention refinements. Publication evidence is recorded on the release PR after deployment.

## Group I implementation and release checks, 2026-09-09

All nine Group I lessons are implemented: Applied Analog I1–I5 and Analog IC I1–I4. Catalog totals are **45 / 41 / 40**, or 126 lessons across the three analog apps. Applied Analog and Mixed-Signal now have lessons for all planned curriculum groups; Analog IC J remains planned. Broader engine APIs, earlier design-task expansion and public-release gates remain separate work. The apps retain direct-URL/unlisted status.

Applied Analog teaches normalized sensitivities, a sixteen-vertex passive box with a proven ideal-frequency bound and a nonmonotone Q face, full finite-follower cutoff calculations, seeded Gaussian ensembles, exact-versus-linear comparison and pointwise Wilson yield intervals. A measured linearization residual above 1% of predicted sigma changes the guidance. The analytic joint-yield product is limited to the first-order independent Gaussian model. Datasheet calculations identify fields and revisions, including the current TI NE5532 5 V/µs typical slew value and the LM317 adjust-current term.

Analog IC adds device-by-device differential noise referral checked by the native solver, fixed-efficiency versus fixed-geometry current scaling, finite-band flicker integration and a noise-plus-mismatch sizing task with achievable pass/miss settings. Eightfold area lowers the declared flicker corner eightfold, not one decade. Current, noise density, RMS noise, offset sigma and area retain separate meanings and units.

All nine new lessons use the established four-view layout, at least five worked steps, defined quantities, parameter-driven plots, aligned tables and entered-answer practice. Shared results tables are keyboard-focusable and show a narrow-screen scrolling cue. Visual review corrected the first current-source arrow in the differential equivalent.

Local repository-wide verification passed **10,513 tests in 416 files** (280.33 s). A subsequent approximation-guard test and final presentation refinements passed the final focused run: **137 tests in 26 files**, covering all three analog apps and schematic rendering. All **27 production builds** passed; assembled site size is **36.37 MiB**. Final browser and publication evidence is recorded on the release PR. Unrelated prose-linter and debug-log changes remain excluded.

Final assembled browser verification passed all **126 analog lessons × four views × 1440/390/320 px**. All nine new lessons additionally passed correct-answer entry, tab anchoring, table/header alignment, accessible table regions, mobile scrolling cues, rendered mathematics, enlarged diagrams and boundary checks. The Monte Carlo approximation flag, all-pass Wilson interval and both mismatch-design outcomes were exercised through the UI. Visual inspection included the corrected differential circuit, flicker plot and mobile yield table.

## Group J implementation and release checks, 2026-09-09

Analog IC J1–J4 implements extra-element analysis, an explicitly checked input-only Miller approximation, Gaussian trim quantization and stored calibration with temperature drift. Catalog totals are **45 / 45 / 40** across Applied Analog, Analog IC and Mixed-Signal. All planned curriculum groups in these three apps now have lessons; broader engine features and public-release gates remain separate work. The apps retain direct-URL/unlisted status.

J1 connects the extra-element theorem, native nodal equations, a continuous capacitor state and sinusoidal phasors for the same circuit. Independent solver checks verify both port resistances, frequency response and startup. J2 checks the Miller pole estimate against a 10% criterion and distinguishes a pole, a right-half-plane zero and a half-power crossing that may not exist. The corrected default pole is 113.682 MHz.

J3 specifies symmetric midrise code levels and integrates Gaussian residual moments over every code cell, including clipped tails. It separates conditional in-range RMS, total population RMS, half-step bounds and range overload, with a 5% check on the uniform approximation. J4 holds one selected code fixed, includes measurement error and both temperature coefficients, and bounds the affine residual at interval endpoints. Its Mixed-Signal C6 link opens a related lesson with its own defaults, not an invented parameter mapping.

Focused acceptance passed **144 tests in 27 files**. All **27 production builds** passed. All **130 analog lessons × four views × 1440/390/320 px** passed browser checks. The four new lessons additionally passed entered-answer, approximation pass/miss, range-overload, drift, table alignment, tab anchoring, equation rendering, enlarged-diagram and receiving-lesson checks. Final presentation checks include stacked mobile equations and corrected node-label placement. The assembled site is **36.40 MiB**. Repository-wide and publication evidence follows with the release. Unrelated prose-linter and debug-log changes remain excluded.

Final repository-wide verification passed **10,521 tests in 417 files** (269.55 s). The first full run had one failure in the existing seeded-jitter SNR assertion; that unchanged test passed in isolation, the focused suite and the second full run. Its cause was not reproduced or identified, and neither its model nor assertion was changed. Publication and live-page evidence is recorded on the release PR after deployment.
