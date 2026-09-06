# Interfaces Lab integration needs

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
