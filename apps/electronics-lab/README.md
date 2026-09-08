# Electronics Lab

75 experiments in 14 groups teach the progression from practical op-amp limits
through junctions, transistors, bias, amplifiers, feedback, oscillators and noise.
The app is still dark: this review does not itself publish a new splash-page link.

## Coverage audit

| Groups | Entries | Course outcomes |
| --- | --- | --- |
| A | 6 | Offset, bias current, gain-bandwidth, slew, output limits and precision rectification |
| C | 4 | Junction potential, depletion, capacitance and temperature |
| D | 7 | BJT/MOSFET characteristics, regions, switching, CMOS and load lines |
| E | 6 | Coupling, bias networks and temperature sensitivity |
| F | 6 | Linearization, transconductance, hybrid-pi and small-signal validity |
| G | 2 | Port resistance and loading |
| H | 7 | Single-stage BJT/MOSFET amplifiers and swing |
| I | 5 | Mirrors, active loads, cascodes and loading |
| J | 5 | Differential pairs, common-mode rejection and mismatch |
| K | 6 | Device capacitances, frequency response, Miller and time constants |
| L | 6 | Return ratio, feedback gain, ports and stability |
| M | 6 | Op-amp stages, compensation, margins, slew, offset and output |
| N | 4 | Wien, amplitude limiting, relaxation and LC oscillation models |
| O | 5 | Noise density, thermal/shot noise, input referral and SNR |

The original plan counts 77 topics. Its Group B clamper and doubler are already
Circuit Elements I9 and I10, linked in Start here. They are prerequisites in the
shared course, not two unimplemented Electronics entries.

## Learning and interface review

The compact catalog preserves all public experiment IDs and gives previous/next
navigation. Every experiment opens with Start here, followed by Worked math and
its relevant analysis views. The equations view now displays the symbolic matrix,
numeric matrix and the same step-by-step elimination renderer used by Circuit Elements.
The renderer solves the displayed linear system independently and reports residuals.
For nonlinear devices this is a local operating-point calculation, not a replacement
for finding the nonlinear bias point.

Worked math has a full-width scrolling pane and an analysis-route guide. Existing
live formula/check blocks remain specific to each experiment. The opening offset
lesson now defines its symbols, collects the feedback terms and substitutes the
current values. Its resistor-ratio gain is a derived value rather than a comparison
against itself. Starting-setting prose is labeled so it is not mistaken for a live
reading after a parameter change.

Start here offers numerical prediction practice from an eligible theory/check row.
It accepts signed scientific notation, rejects invalid input, offers hints and an
optional reveal after an incorrect attempt, and resets with changed settings or
cursor. Where no eligible prediction exists it states the model limitation instead.
This is self-study feedback with a 2% numerical tolerance, not a mastery assessment.

Analysis tabs occupy a stable row with constant font weight. Long rows scroll on
phones. The enlarged schematic supports keyboard focus return and Escape. Mobile
layout gives the shared suite navigator, picker, lesson and settings explicit places
and keeps formula/table overflow inside the analysis pane.

## Verification

From the repository root:

```sh
npm test --workspace apps/electronics-lab -- --maxWorkers=2
npm run build --workspace apps/electronics-lab --workspace apps/circuit-elements-lab
node apps/electronics-lab/scripts/verify.mjs
```

The browser harness uses `APP_URL`, defaulting to a local review server at
`http://127.0.0.1:4193/electronics-lab/`. Serve at a lab path to exercise the shared
navigation. It visits every offered view of all 75 experiments at 1440 and 390 px,
checks rendered math and worked equation steps, checks tab geometry and page
overflow, and exercises answer feedback and the drawing dialog. Screenshots go
to the ignored `shots` directory.

The 2026-09-08 numerical/editorial suite passed 279 tests. The existing Circuit
Elements worked-solve tests and shared URL tests also passed after extracting the
common renderer. Browser review and publication status are tracked in
`LAB_BUILDOUT_PROGRESS.md` at the repository root. A built catalog is not evidence
that every student has mastered all institutional Electronics I–II syllabi.
