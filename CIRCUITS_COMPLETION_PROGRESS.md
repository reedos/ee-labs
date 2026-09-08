# Circuit Elements completion

The user authorized completing the Circuits I–II course on 2026-09-07.
Use the existing Circuit Elements shell, schematic, controls, anchored analysis tabs,
worked LaTeX and scrolling behavior. Preserve public experiment identifiers.

## Implementation sequence

- [x] Native source transformations, Norton equivalents, supermesh and delta–wye lessons.
- [x] Complete switching procedure and zero-input/zero-state/complete response comparison.
- [x] Laplace definitions, initial-condition sources, inversion, repeated/complex poles and theorem conditions.
- [x] AC equivalents, power-factor correction and conjugate matching.
- [x] Transfer-function derivation, loaded filter design, Fourier reconstruction and convolution.
- [x] Mutual inductance, transformer and balanced/unbalanced three-phase foundations.
- [x] Two-port terminal tests, parameter conversions, loading and cascades.
- [x] Circuits I and II capstones with independently entered answers and explanatory feedback.
- [x] Coverage/prerequisite audit, Chromium walkthrough and numerical checks.
- [ ] Publish the expansion and verify the live release.

Counts and passing numerical tests alone do not establish a completed course.
Each new method needs definitions, symbolic laws, live numerical substitution,
an independent circuit check, an explanation of its tradeoffs and a practice case.
Existing diode lessons remain available as an electronics extension.

Work is isolated in `.claude/worktrees/circuits-ii-rollout`.
Concurrent director and main-workspace work must be preserved.

## Local acceptance, 2026-09-08

The catalog has 89 experiments, including 30 additions. The implemented sequence and
its model boundaries are recorded in [the app README](apps/circuit-elements-lab/README.md).
This is completion of the agreed repository course outcomes, not an accreditation claim
or proof that a student has mastered every institutional Circuits I–II syllabus.

| Outcome | Native lessons | Independent evidence |
| --- | --- | --- |
| Circuit methods and controlled-source resistance | D7–D10, E10 | Original/equivalent terminal solves; simultaneous excitation; active dependent-source test |
| Switching, decomposition and coupled states | F8–F9, G8 | Closed time responses, initial slopes, DC limits and native state reconstruction |
| Complete transforms and inversion | J1–J7 | Nonzero voltage/current initial conditions; real, repeated and complex roots; an invalid final-value example |
| AC network design | H9–H11 | Independent complex reductions, a local maximum-power check and reactive-power cancellation |
| Filters, Fourier and convolution | K1–K4 | Loaded gain/pole calculations, a finite-series error bound and exact piecewise time response |
| Magnetic and polyphase foundations | L1–L4 | Reciprocal winding laws, positive-energy validation, AC/time agreement and floating-neutral KCL |
| Two-port models | M1–M3 | Independent open/short terminal tests, parameter conversion and loaded cascade solve |
| Method selection and assessment | G8, N1 | State-coefficient entry and changed-condition numerical questions; invalid/incorrect/correct answer feedback and hints |

- The Elements test suite covers 670 tests. Its final remaining randomized drawing
  collision was corrected and the full geometry sweep passed on rerun.
- All 312 shared network tests passed, including the new mutual-inductance tests.
- Chromium checked all 89 experiments at 1440, 1024, 768 and 390 px. All 1,472 view
  selections preserved every analysis tab's position and size, with no page overflow.
- The completion browser walkthrough checked all 30 additions at desktop and phone
  sizes, rendered math, answer feedback/reset, calculated component application,
  the coupled state table and keyboard/focus behavior of the enlarged drawing.
- Screenshots were inspected for the dense magnetic/three-phase/cascade drawings and
  the capstone at desktop and phone sizes. They remain in the ignored app `shots/` folder.
- The production app build passed. The assembled local preview is served at
  `http://127.0.0.1:4192/circuit-elements-lab/` while the local server is running.
- Firefox could not create a Playwright page in this environment. No Firefox acceptance
  is claimed for this expansion. The scripts support a repeat with `BROWSER=firefox`.

## Publication handoff

GitHub HTTPS access failed in this session. The expansion has not been pushed or
verified live. The full repository test run is recorded separately before the handoff
is finalized. Preserve any newer director/master work when integrating this branch;
the shared network change adds signed mutual inductance without replacing other labs'
transformer or two-port implementations.

Before release, fetch the current remote, integrate this branch without force-pushing,
run the deployment checks and verify the published catalog and capstone. Update the
root README's pending-publication sentence only after the deployed version is confirmed.
