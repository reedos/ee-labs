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

The scoped run passed 20 tests in four files with two workers. App markdown lint passed for three files.
The Vite build passed with a bundle-size advisory. Chromium passed all five default views at 1440 px and 390 px.
Ten screenshots and `shots/verification.json` record that pass. Plot pixel checks were nonempty and no horizontal overflow occurred.
The harness exercised try steps, resets, view selectors, math panels, threshold ambiguity and cursor readings.
Try steps run sequentially on the current settings. Browser assertions check that unrelated knobs persist and experiment Reset restores the defaults.
The shared path registry currently hides LabNav here. Deployed navigation and the director's full-suite gate remain pending.
