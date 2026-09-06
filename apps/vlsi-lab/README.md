# VLSI Lab

Five bounded lessons cover A1 through A5 on the existing network and events engines.
A3 includes extraction and a rounded event chain. The plan's exact chain comparison remains deferred.
A5 is partial plan fulfillment. Its isolated fanout law is measured, but it includes no measured analog-chain comparison.
The app remains dark. Later groups are outside this deliverable.

## Model boundaries

The isolated inverter's rail-step waveform is exact under its switch-resistance model.
The app measures crossings on `pwlTransient` through its continuous evaluator.
Only fixed-region linear RC segments are rational LTI objects. The switching inverter is not an LTI transfer function.
The equivalent resistance and capacitance card are stated teaching parameters, not a foundry model.

The square-law view consists of DC operating points. It carries no dynamic claim.
Its threshold boundaries can have multiple switch-model DC solutions, displayed as gaps.
The event chain rounds each delay to 1 fs and displays a bound of 0.5 fs per stage.
It does not simulate an analog transistor chain. Unsupported extraction topologies produce a stated error.
The rounding bound is not evidence of agreement with an analog chain.

## Interaction

The sidebar inherits the suite's fonts, title sizes, section wells and responsive widths.
Scope and Timing use the shared playback controls, including pause, rewind, speed and replay at the end.
The transfer view sweeps static input voltage. The fanout view sweeps a separate load probe and shows its delay.
The fanout sweep preserves the selected load. Its horizontal coordinate is load, not elapsed time.
Worked calculations remain open beside the plots on desktop and follow them on narrow screens.

Physical axes remain held while knobs change. Fit axes includes current and default traces, then holds that new range.
Reset axes restores the opening range. The comparison uses the selected edge with default width, load and stage count.
The scope evaluates the final linear segment beyond its initial sampling window when necessary.
That extension is valid for the accepted isolated rail step because no later input event or region change occurs.

## Verification

Run these commands from the worktree root.

```text
npx.cmd vitest run apps/vlsi-lab --maxWorkers=2
node packages/prose/bin/lint.mjs apps/vlsi-lab/README.md apps/vlsi-lab/AGENT_BRIEF.md apps/vlsi-lab/NEEDS.md
npm.cmd run build --workspace apps/vlsi-lab
node apps/vlsi-lab/scripts/pins.mjs
node apps/vlsi-lab/scripts/verify.mjs
```

The focused tests compare network waveforms, measured crossings, DC slopes, charge and event traces with independent predictions.
The browser harness serves the app build at `/vlsi-lab/` and writes screenshots under `shots`.
The director runs the full suite and integrates the lockfile and deployment.

The scoped run passes 25 tests in five files with two workers.
The Vite build passes with a bundle-size advisory.
Chromium and Firefox cover all five experiments at 1366, 1440, 1920, 2560 and 390 pixels wide.
Each run preserves screenshots under `shots/<browser>` and its result in `verification.json` there.
Firefox requires execution outside the Windows sandbox on this machine.

The browser checks measure rendered axis stability, curve changes, playback movement, speed ratios, pause, rewind and end replay.
They also check held fitted ranges, live readings, visible math, featured knobs, inherited styling and mobile spacing.
The unit checks compare the entire held scope window with an independent exponential, including times beyond the initial response window.
Try steps remain sequential. Existing checks still enforce unrelated knob preservation, defaults, threshold ambiguity, canvas pixels and horizontal containment.
LabNav renders at the sibling path. Setting `APP_URL` enables the additional assembled-site link checks.
The director owns site assembly, shared changes and the full-suite gate. Student acceptance remains open.

The final runs used `APP_URL=http://127.0.0.1:47630/vlsi-lab/` in Chromium 151.0.7922.34 and Firefox 153.0.
Both completed all 25 experiment-size combinations, including every alternate view and the fanout sweep.
All sibling links responded successfully. Both error lists were empty.
The final build includes the director's shared NumField focus guard.
The harness freezes its clock and waits for the paused state before checking exact cursor stability.
