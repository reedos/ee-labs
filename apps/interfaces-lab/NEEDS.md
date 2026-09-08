# Interfaces Lab integration needs

## Plot labels and physical context

All three plots now key each semantic curve, guide, region and probe with a visible line, area or marker sample.
The voltage plot labels VIL and VIH directly, with separate annotation space and a labeled time cursor.
Input limits are defined in full at first use, in the result labels and before the signal story.
Hiding the analog traces also removes their legend entries.

The shared wafer-to-circuit introduction precedes the circuit foundation.
Fabrication and material tradeoffs expand within the lesson, with source links and no material selector implied.
`CURRICULUM.md` places this prerequisite after basic circuit elements and before semiconductor-device modules.

The Interfaces and shared-primer tests pass 59 checks in eight files.
The app build and 25 experiment/viewport cases per browser pass in Chromium and Firefox, including 320-pixel width.
Logs use `labels-interfaces-` in the director worktree. Screenshots remain under `verification`.
Physical-phone review and student acceptance remain open.

## Student foundations

Each Group A experiment now states its purpose, signal input, expected output, prediction, tradeoffs and model limits before the derivation.
Control descriptions distinguish driver choices, external loads, device properties and requirements.
The CMOS study identifies a receiver and shows the driving source with receiver limits. It no longer presents the receiver as an output type.
Pin, CMOS input and inverter definitions are included in the term registry.

Phones use one page scroll with sticky Lesson, Settings, Circuit, Plots and Math links.
These links preserve the experiment hash. The plot remains at least 300 pixels tall.
The existing fixed-axis, reference-trace and transport checks remain in place.

The foundation pass has 54 passing tests in six files and a passing app build.
Chromium and Firefox cover all five experiments at five viewport sizes, including 390x844 and 320x740.
Phone checks require the section navigation to remain pinned after every jump, not just the destination to be visible.
Logs use the `interfaces-foundations-` prefix. Browser evidence remains under `verification`.
These are desktop browser phone-size checks, not physical-phone or iPhone Safari validation.
Student acceptance remains open.

## First review correction

Reed rejected the first review on 2026-09-06. Passing the original harness did not establish teaching quality.
The app had custom sidebar overrides, no transport, compressed analog rows and a time axis that hid capacitance changes.

The rework inherits the shared sidebar and math styles. It adds a full-height voltage plot and a default comparison.
The time axis stays fixed during parameter edits. Fit is explicit, and a clipped transition has a visible notice.
Measurements use a separate complete solve, so fitting the display does not change the reported rise time.

Interfaces and VLSI share `usePlayback` and `PlaybackControls` in `packages/ui`.
Playback follows the original labs' pause, rewind, speed and replay behavior.
The time cursor drives the schematic, voltage, capacitor current and stored energy.
Load and pin-count sweeps have separate probes. They do not claim to be physical-time simulations.

Worked analysis remains visible beside the result on desktop and below it on a phone.
It includes the governing law, substituted values, model limits and comparisons with the network solution.
Rise crossings are independently located by bisection. Noise-budget checks use loaded DC solves.

The revised harness covers all five experiments at 1366x768, 1440x1000, 2560x1440 and 390x844.
It measures plot height, shared title sizing, held axes, changed curves, playback and reset behavior.
Failed runs overwrite earlier success reports and retain a failure screenshot.
Browser reports are under `verification/chromium` and `verification/firefox`.
Director logs use the `interfaces-rework-` prefix in the worktree root.

The revised student review remains open. Group expansion and release remain separate decisions.

## Director integration

The director registered `apps/interfaces-lab` in the root lockfile.
All declared dependency versions already existed in the checkout.

The dark deployment copy and assembly entry are present. The lab stays unlisted until Reed authorizes release.

```sh
cp -r apps/interfaces-lab/dist _site/interfaces-lab
```

The executable inventory contains five experiments, `a1` through `a5`.
The wider curriculum document and progression-test extension remain director work.
Electronics prerequisites are `d5` and `d6`. Both exist in this worktree.

The shared URL registry now includes Interfaces Lab.
Deployed navigation and interaction checks passed in Chromium and Firefox on the director branch.
The harness accepts `APP_URL` and `BROWSER` for repeated checks against the assembled site.

## Engine and scope

Group A requires no shared engine changes. Fixed switch topologies use `network.transient` and `solveDC`.
The analog scope uses shared plot primitives. TimingCanvas remains available for future protocol views.
No events package changes are needed for this wave.

The independent Electronics check measures transfer slopes at both input limits at both supplies.
An extra midpoint Newton probe did not converge for some reduced-supply settings. The lessons make no midpoint operating-point claim.
Threshold checks pass. No numerical substitute was introduced.

The plan's rise factor of 2.2 is rounded. The app uses the exact factor `ln(9)`.
The open-drain crossing ratio uses an initially discharged capacitor. A physical low state has the pull-up divider voltage.
Its falling waveform uses the parallel resistance. Both initial conditions have separate boundary checks.

## Deferred work

Groups B through G are outside this assignment. Protocol implementation and events contracts remain for later waves.
The director owns full-suite evidence. Student sittings and release approval remain open.
The release status remains dark.
