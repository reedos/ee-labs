# Circuits I and II buildout

## Status and architecture

Reed approved the curriculum expansion on 2026-09-06. This document starts the coverage and dependency plan.
It does not mark new lessons as implemented or released.

Reed revised the architecture after reviewing the four-lesson rollout.
One expanded Circuit Elements app owns the Circuits I and II sections.
All new core lessons use its schematic, controls and analysis panes.
Circuit Lab remains a frequency-response tool while its teaching material is integrated
into the expanded course. Do not build another standalone Circuits II shell.
Existing experiment identifiers and public links must remain valid.

The agreed splash descriptions are Circuit Analysis Foundations for Circuit Elements Lab and Filters, Resonance & Circuit Dynamics for Circuit Lab.
Their publication is a separate shared-surface change.

## Evidence and ownership

The released foundation includes Circuit Elements' 58 experiments and Circuit Lab's 16 lessons.
The math release is `e5e9200`. The README update is `0a23790`.

The active director worktree is `.claude/worktrees/program-director`.
Its `BACKLOG.md` section 1 distinguishes implementation, verification, integration, acceptance and release.
Its current handoff requires reconciliation with the math release before another integration wave.
Dark lessons remain dependencies until their teaching scope passes acceptance and release.

This plan leaves the director's files and concurrent splash work unchanged.
Shared package contracts and curriculum integration belong to the director.
Each implementation assignment needs explicit file ownership and an isolated checkout.

## Course boundaries

Circuits I starts with algebra, simultaneous equations and the physical meaning of voltage and current.
Calculus is introduced before storage-element laws. Complex numbers are introduced before phasors.
The course ends with a first circuit-analysis capstone and an introduction to sinusoidal steady state.

Circuits II develops complete responses, transform methods, frequency response, coupled circuits, three-phase circuits and two-port networks.
Course boundaries vary between universities. Shared lessons may appear in both paths without being copied.
Second-order transients can be assigned at the end of Circuits I or the beginning of Circuits II.

Semiconductor design, control synthesis and switching-converter design remain later courses.
The required course paths must not depend on those subjects.

## Coverage matrix

| Outcome | Existing evidence | Remaining teaching work | Proposed owner |
| --- | --- | --- | --- |
| Interpret units, reference directions and power signs | Elements A and B | Independent prediction and sign checks | Circuit Elements |
| Reduce resistive networks | Elements C | General delta-wye reduction and practice beyond balanced bridges | Circuit Elements |
| Write nodal and mesh equations | Elements D1-D3 | Supermesh constraints and guided method comparison | Circuit Elements |
| Apply network theorems | Elements D4-D6, including short-circuit current in the equivalent pane | Explicit Norton construction and source transformations | Circuit Elements |
| Analyze controlled sources and ideal op-amps | Elements E | Verify coverage of source types and test-source resistance with dependent sources | Circuit Elements |
| Apply storage laws and initial conditions | Elements F and G | A complete switching procedure with pre-switch, post-switch and final circuits | Circuit Elements |
| Distinguish natural, forced, zero-input and zero-state responses | Elements G, H1 and worked state derivations | Explicit comparison on the same initial state and input | Circuit Elements |
| Solve sinusoidal networks | Elements H | Branched AC nodal/mesh problems and AC equivalents | Circuit Elements |
| Calculate AC power | Elements H5 | RMS conventions, power-factor correction and conjugate matching | Circuit Elements |
| Solve in the Laplace domain | Circuit Lab uses rational transfer functions | Transform rules, initial-condition sources, inversion and validity conditions | Circuit Elements |
| Relate time and frequency responses | Elements H7 and Circuit Lab response lessons | Parameter-preserving cross-lab practice and a complete-response comparison | Circuit Elements |
| Analyze periodic forcing with Fourier series | Signal Lab harmonics and Circuit Lab hand-over | Coefficients, per-harmonic analog response, reconstruction and truncation error | Circuit Lab and Signal Lab |
| Design elementary filters | Circuit Lab passive and active circuits | Simple response targets, loading and component-selection exercises | Circuit Elements |
| Analyze mutual inductance | Fields E includes inductance and magnetic coupling | Dot convention, signed circuit equations and coupled-winding energy | Circuit Elements with Fields reuse |
| Analyze transformers | Machines B1-B6 are implemented, dark | Prerequisite-light access and circuit-method comparisons | Machines with a foundation entry |
| Analyze three-phase circuits | Grid B1-B5 are implemented, dark | Direct unbalanced-load problems and accessible voltage/current examples | Grid with a foundation entry |
| Derive and use two-port parameters | RF D includes S/Z/Y/ABCD and cascades, dark | Terminal-test derivations, hybrid parameters, loading and elementary interconnections | Circuit Elements with RF reuse |
| Solve unfamiliar combined problems | No course-wide acceptance evidence established | Capstones with independently entered equations and answers | Both course paths |

An existing formula or solver output does not establish a taught method.
The audit must inspect the visible steps and independent practice before marking an outcome complete.

## Rollout order

Reed confirmed the sequence after reviewing this initial plan.
The order is phasor circuit analysis, time-domain and state equations, Laplace methods, then transfer functions and frequency response.
The existing frequency-response lessons remain available throughout the rollout.

The first separate phasor release is superseded by consolidation into Circuit Elements.
RC and series RLC lessons reuse the existing experiments. The new branched circuit
combines complex KCL, state equations and power in H8.
Its calculations are checked against an independent complex nodal solve.
The complete-course claim remains open. State-space, Laplace and the other coverage gaps remain implementation work.

## Circuits I implementation group

This group completes four basic analysis methods. These lessons do not depend on the new course navigation.
Final identifiers will be assigned against the current registry without renumbering existing experiments.

| Proposed lesson | Prerequisites | Interaction | Acceptance evidence |
| --- | --- | --- | --- |
| Source transformations | Elements B, C and D1 | Compare a voltage source with series resistance to a current source with parallel resistance | Terminal voltage and current agree across a swept load. Internal source powers are not claimed equivalent |
| Norton and Thevenin equivalents | Elements D4-D5 and source transformations | Construct both port models from open-circuit voltage, short-circuit current and a test source | Independent loaded-network solves agree. Dependent sources remain active during resistance measurement |
| A current source between meshes | Elements D3 | Write the supermesh KVL row and the current-source constraint | Mesh currents reconstruct the branch currents from an independent nodal solve |
| Delta-wye conversion | Elements C and D1 | Convert an unbalanced resistor triangle and compare terminal behavior | External voltages and currents agree under multiple independent excitations |

Each lesson needs a fully worked example, a parameter variation and an unanswered practice case.
The displayed derivation must use the current controls. It must define directions and units before substitution.
The example must explain the method's advantage and its applicability conditions.
These are content requirements, not a requirement to offer state equations or phasors for every problem.

## Later implementation groups

These groups follow the phasor rollout. Their release order follows the course sequence above.

1. Complete the initial-condition progression. Derive zero-input and zero-state responses separately, then compare their sum with the complete response.
2. Add Laplace methods. Include derivative transforms, s-domain element equations, partial fractions, repeated poles and complex pairs.
3. Teach initial-value and final-value theorems with their conditions. Include a case where applying the final-value theorem gives an invalid conclusion.
4. Add AC network practice, power-factor correction and conjugate matching. Compare peak and RMS conventions using one consistent physical circuit.
5. Add the Fourier-to-circuit progression. Compare a finite harmonic reconstruction with an independent time-domain response where supported.
6. Add elementary two-port lessons. Derive parameters from terminal tests before introducing conversions or RF waves.
7. Adapt magnetic-coupling, transformer and three-phase lessons. Required lessons must open without motor, power-flow or RF prerequisites.
8. Add capstones and course navigation. Check the complete prerequisite order before describing either course as covered.

The preliminary allowance is 25-35 new or substantially revised lessons, plus adaptations and assessment work.
This range is a planning estimate. The outcome audit will determine the accepted lesson list.
No schedule is assigned until the package contracts and implementation groups are reviewed.

## Boundaries with future labs

| Lab | Foundation material used here | Later material retained there |
| --- | --- | --- |
| Electronics | Ideal amplifier ports and loading can provide examples | Device bias, transistor models, amplifier stages, feedback, oscillators and noise |
| Applied Analog | Elementary filter targets prepare the reader | Specifications, op-amp selection, corners, yield and board-level design |
| Analog IC and Mixed-Signal | Circuit analysis supplies their prerequisites | Integrated device sizing, matching, switched-capacitor circuits and converters |
| Machines | Transformer ratios and equivalent circuits | Motors, generators, torque, drives and thermal behavior |
| Grid | Wye/delta, line/phase quantities and power | Per-unit networks, power flow, sequence networks, faults and protection |
| Fields | Inductance and mutual coupling | Field solutions, waves, transmission lines and antennas |
| Power | Converter examples may be optional applications | Switching states, saturation, converter control, losses and EMI |
| RF | Existing two-port algebra can be reused | Smith charts, distributed matching, S-parameter design and radio devices |
| Signal and DSP | Harmonic decomposition supports periodic circuit forcing | Sampling, digital filter design, estimation and adaptive methods |
| Control and Control II | State and transfer-function views support comparison | Controller synthesis, observers, nonlinear control and identification |
| Instruments | Optional loading and measurement exercises | Instrument models, calibration and uncertainty |

The digital, communications, energy, device and photonics tracks keep their existing program scope.
They are downstream applications or parallel courses, not requirements for this completion effort.

## Engine contracts

Rational circuit models remain in `systems`. Circuit solves remain in `network`.
Review the existing Machines transformer implementation before adding a shared transformer contract.
Review RF's parameter conversions before implementing another two-port algebra library.

Coupled-inductor support requires an explicit sign convention and an energy-domain admissibility check.
Singular parameter conversions need an explanation rather than an artificial finite result.
Nonzero initial conditions must remain separate from a zero-state transfer function.
Finite Fourier truncation must show its error or convergence evidence.

Laplace instruction does not change `CORE_SCOPE.md`.
Distributed transmission lines still lie outside the finite rational transfer-function model.
Their Fields and RF implementations keep their existing boundaries.

## Course acceptance

Every required outcome needs a derivation, a worked example, independent practice and a recorded acceptance result.
Practice should progress from predicting signs to forming equations and solving an unfamiliar circuit.
Alternative solution methods must agree when their assumptions and initial conditions match.

Numerical checks must use independent calculations, conservation laws and boundary cases.
Browser checks must exercise the actual lesson sequence at desktop and phone sizes.
Cross-lab links must preserve the relevant parameters and identify any required change of model.
No required course step may link to an unreleased lab without an approved release plan.

The app inventory alone is not evidence of course completion.
These modules teach analysis and simulated measurement. They do not certify physical bench competence.

## Documentation integration

The director should reconcile this plan with `CURRICULUM.md`, `ANALOG_ROADMAP.md` and the relevant lab plans.
The historical exclusions for Laplace instruction and elementary two-port matrices need an explicit curriculum revision.
Current build status must come from the director ledger rather than the original map's status column.
The two existing seam lessons must remain marked as implemented.

## Reference syllabus

The course outcome list includes the topics in the University of Toledo's Electric Circuits II syllabus.
Its scope includes Laplace methods, Fourier circuit analysis, magnetic coupling, three-phase circuits and two-port networks.

[University of Toledo, Electric Circuits II](https://www.utoledo.edu/engineering/electrical-engineering-computer-science/current-students/syllabi/eecs-3220-electric-circuits-ii.html)

## Consolidation acceptance

The separate four-lesson phasor page is retired. RC and series RLC instruction reuse
H2 and H3. H8 brings branched KCL and AC power into the existing Elements interface,
including its coupled state equations and instantaneous circuit equations.
This is consolidation, not completion of the Circuits II curriculum. The remaining
coverage matrix and phasors, state equations, Laplace, frequency-response ordering
still apply. Existing device, power, machines, grid and RF ownership stays intact.
