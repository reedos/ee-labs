# Phasor course release

## Scope

This release adds four introductory phasor lessons before the existing frequency-response course.
It does not complete the Circuits II expansion.
State equations and Laplace instruction are the next implementation groups.
The remaining outcomes are listed in `CIRCUITS_I_II_BUILDOUT.md` at the repository root.

The lessons cover complex arithmetic in an RC circuit, series RLC analysis, branched KCL and AC power.
Each lesson has live component controls, worked equations, phasor diagrams, a prediction exercise and an independent nodal comparison.
The branched example reduces to one complex node equation. Larger simultaneous node and mesh systems remain future lessons.

## Numerical convention

Phasors use peak amplitude and a sine reference, matching Circuit Elements.
Complex power uses one half of voltage times conjugate current.
The source power shown is delivered power. Passive-element powers use the passive sign convention.
The displayed waveforms describe sinusoidal steady state. They contain no startup response.

## Navigation

The default page opens the first phasor lesson.
The four lesson fragments are `#phasors=complex`, `#phasors=series`, `#phasors=nodal` and `#phasors=power`.
The existing course opens at `?course=frequency`.
Existing `#circuit=...` links take precedence and retain their component values and output selection.

The existing frequency-response browser harness explicitly opens its course entry.
The new harness is `scripts/verify-phasors.mjs`.
It accepts `APP_URL` and `BROWSER`, with Chromium and Firefox supported.

## Verification

The complete local suite initially passed 9342 tests and failed two documentation-count assertions.
The assertions were updated to check both lesson registries.
The affected documentation, progression and phasor tests then passed all 42 checks across three files.
All production app builds passed. The final Circuit Lab build also passed after the navigation fix.
Edited Markdown passed scoped prose lint.

Chromium and Firefox each passed all four lessons at desktop and phone widths.
The browser checks used the assembled production site at `/circuit-lab/`.
They exercised controls, reset, explanation toggles, course transitions, incoming circuit links and horizontal containment.
Screenshots were inspected for schematic and phasor readability.

These checks cover the new lessons and course transitions.
They do not close the director's separate, inherited Circuit Lab layout findings.
GitHub's full test and build workflow remains the deployment gate.
