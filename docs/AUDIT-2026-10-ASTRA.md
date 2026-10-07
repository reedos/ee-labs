# Numerical and claim audit

Date: 10/07/2026. Base: `master` at `aec37e9`. Branch: `astra/ee-1`.

## Scope

The history inventory used `git log master --since=2026-08-31 --stat`.
It covers 22 apps and 16 shared packages. The audit searched numeric thresholds,
comparison rows, and claim tests across those directories. All inputs were synthetic.
No server, browser, external service, or live data was used.

The table records the existing evidence path for each lab. Passing a suite does
not establish that every sentence has an independent measurement. This review
also traced the comparison defects below back to their producers.

## Findings and repairs

| Area | Defect | Repair and regression evidence |
| --- | --- | --- |
| Systems roots | A fixed unit floor erased the imaginary part of slow complex poles. | Scale the snap threshold by pole magnitude. `scale-audit.test.js` compares pole geometry with a simulated step peak. |
| Systems state space | Small supplied complex poles became real, and unmatched pairs could be accepted. | Scale pair checks by pole magnitude. Tests retain conjugate pairs and reject mismatches across scales. |
| Systems Bode plot | A small coefficient multiplier changed the plotted phase by 360 degrees. | Only exact trailing zeros count as origin poles. The plotted phase must survive coefficient scaling. |
| Control Lab | A slow finite pole was described as an integrator with zero step error. | Count exact trailing zeros. `math.test.js` checks the claim against an integrated step in normalized time. |
| Control Lab | Slow positive poles lost the unstable-plant explanation. Slow oscillations read zero frequency. | Use pole signs and the complex roots already classified by the shared solver. Tests vary the time scale. |
| Network theorems | Small nonzero sources made a finite resistance read as an undefined ratio. | Judge cancellation against solved voltage and current scales. Seven cases compare three resistance methods, including balanced bridges and small sources. |
| Shared axes | Fixed unit floors distorted the height of tiny signals. | Use the signal's own extent. Tests compare normalized trace and curve bounds across amplitudes, including an explicit zero case. |
| Electronics Lab | A1 checked its resistor-derived gain against the same expression. | Display the gain as a value. Keep the output comparison connected to the circuit solve. |
| Energy Lab | Battery voltage checked itself. Fill factor reconstructed the power used to define it. | Display both as values. Tests cover battery entries and the array's maximum power. |
| Devices Lab | F2 reconstructed maximum power from its own fill factor. | Display maximum power as a value. Keep the empirical fill-factor comparison. |
| Grid Lab | Base impedance, base current, line-to-neutral voltage, and surge impedance repeated their producer formulas. | Display these four definitions as values. Keep independent comparisons and waveform checks. |

Each regression was run before its repair and failed on the stated defect.
Existing lesson prose was preserved. The shared comparison tolerance was not relaxed.
Existing explanatory footnotes remain on the three explicit self-comparisons in Electronics Lab.

## Lab coverage

Paths below are relative to each lab's `src/` directory.
"No additional repair" refers to this audit's search and evidence review, not a proof of completeness.

| Lab | Evidence reviewed and exercised | Audit result |
| --- | --- | --- |
| circuit-elements-lab | `experiments.test.js`, lesson measurements and headline checks | Shared network and systems repairs apply. |
| circuit-lab | `course.test.js`, `toSignalLab.test.js`, numerical normalization tests | Shared systems repairs apply. |
| comms-lab | `experiments.test.js`, live quantity paths and claim readings | No additional repair. |
| computer-lab | `experiments.test.js`, measured lesson readings | No additional repair. |
| control-lab | `math.test.js`, `verdict.test.js`, `scale-audit.test.js` | Integrator, pole-sign, and frequency repairs. |
| control-lab-ii | `experiments.test.js`, analysis-backed claims | Shared state-space repair applies. |
| devices-lab | `experiments.test.js`, `claim-audit.test.js` | Remove the circular power comparison. |
| dsp-lab | Lesson and quantity-path tests | No additional repair. |
| electronics-lab | `experiments.test.js`, `claim-audit.test.js` | Remove the circular gain comparison. |
| energy-lab | `experiments.test.js`, `guards.test.js`, `claim-audit.test.js` | Remove circular voltage and power comparisons. |
| fields-lab | `experiments.test.js`, headline and precision guards | No additional repair. |
| grid-lab | `experiments.test.js`, `claim-audit.test.js` | Display four formula definitions as values. |
| info-lab | `experiments.test.js`, measured lesson readings | No additional repair. |
| instruments-lab | `experiments.test.js`, math readings and unit conversions | Shared network repair applies. |
| logic-lab | `experiments.test.js`, measured lesson readings | No additional repair. |
| machines-lab | `experiments.test.js`, quoted-number coverage | No additional repair. |
| photonics-lab | `experiments.test.js`, assumption guards and readings | No additional repair. |
| power-lab | `pins.test.js`, math-panel checks and transient tests | Shared axis repair applies. |
| random-lab | `experiments.test.js`, `secondRoute.test.js` | No additional repair. |
| rf-lab | `experiments.test.js`, headline and pane readings | No additional repair. |
| signal-lab | `math.test.js`, `math-parts.test.js`, control and chip sweeps | Shared systems repairs apply. |
| system-lab | `experiments.test.js`, headline and lesson readings | No additional repair. |

## Gates

`npx vitest run --maxWorkers=2` passed all 10,989 tests in 366 files, exit code 0.
The run took 977.66 seconds. Two workers limited load during the sprint.
The first full run exposed four balanced-port failures, repaired before this final run.
`npm run lint:prose` passed across 81 files. `git diff --cached --check` passed.

The initial prose gate found 330 issues across nine documents in 80 scanned files.
Only failing passages were edited. Historical plans and handoff notes now use shorter
sentences and paragraphs. Displayed lesson prose and prose rules remain unchanged.

All originally passing prose units were preserved. No prose rules were changed.
The tracked-file scan found neither private identifier from the authorized local settings file.
Added lines contained no emails, detected tokens, or notification topics.
No development port was used. Browser layout and screenshot sweeps belong to EE-2.

## Needs Reed

None identified. The branch awaits review and any release action remains Reed's.
