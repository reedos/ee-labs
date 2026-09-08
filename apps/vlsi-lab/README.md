# VLSI Lab

Five bounded lessons cover A1 through A5 on the existing network and events engines.
A3 includes extraction, a rounded event chain and a separately connected analog switch-model chain.
A5 measures the isolated fanout law; switching to Timing compares connected stages at that load.
The app remains dark. Groups B–G are still pending.

## Model boundaries

The isolated inverter's rail-step waveform is exact under its switch-resistance model.
The app measures crossings on `pwlTransient` through its continuous evaluator.
Only fixed-region linear RC segments are rational LTI objects. The switching inverter is not an LTI transfer function.
The equivalent resistance and capacitance card are stated teaching parameters, not a foundry model.

The square-law view consists of DC operating points. It carries no dynamic claim.
Its threshold boundaries can have multiple switch-model DC solutions, displayed as gaps.
The event chain rounds each delay to 1 fs and displays a bound of 0.5 fs per stage.
That event model does not simulate analog slopes. A separate `analogChain` advances
the connected capacitor states through transistor threshold events using `pwlTransient`.
It measures half-supply crossings independently of plotted samples. Each stage has
the selected total load, which must include at least one following gate's input
capacitance. Later inputs are the preceding analog outputs. The timing row shows the
last stage beside the digital events, with both aligned to the same input-step time.
The difference between their delays is reported as a model difference, separate from
the rounding bound. This is still a switch-resistance model, not square-law transient
simulation or a foundry model. Unsupported extraction topologies produce a stated error.

## Interaction

Scope, Transfer and Fanout legends use the same data as their traces, guides, bands and brackets.
White cursor lines and operating-point dots have separate keys. Reference keys disappear with the comparison.
Transfer defines VIH as the lowest guaranteed high input voltage and VIL as the highest guaranteed low input voltage before using either limit.
It labels output limits, both noise-margin brackets, switch-model gaps and the shaded undefined-input band.
The analog output remains defined inside that band. The math explains the underscored aliases.

Timing identifies the input, each numbered stage, the default third-stage reference, logic levels and time cursor.
Fanout identifies its reference as falling delay and explains coincident curves at width two.
The topbar uses plain output and delay labels, with no unexplained input-limit abbreviations.
The desktop plot section scrolls with its column so tall legends do not clip the canvas or controls.

Foundations starts with the shared `ChipContext` from `@ee-labs/explain`.
Its brief introduction is visible. Fabrication and material details remain in its optional disclosure.
The inverter paragraphs and six lesson fields remain open. Shared context content and styling belong to the parent.

Each lesson opens its explanation with purpose, input, expected output, prediction, design tradeoffs and model limits.
Visible definitions explain CMOS and the inverter, including complementary signals and two-stage signal restoration.
Parameter roles sit beside the controls. Edge text states the opposite input and output transitions.
The energy discussion estimates `C VDD^2` per full charge-discharge cycle and states its limits.

Phones show sticky Lesson, Settings, Circuit, Plots and Math buttons.
These move focus and scroll without changing the URL. The introduction precedes the plot in the phone reading order.
Playback text distinguishes static input sweeps, load probes and time inspection from physical circuit parameters.

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

The plot-label update passes 39 focused tests in seven files, the numerical pins and the app build.
Chromium checks all five lessons at 320, 390, 1366, 1440, 1920 and 2560 pixels, including alternate plot views.
Legend checks cover reference visibility, guide meanings, aliases, margin values and text containment.
The visible input-limit definition and long plot captions have prose-budget tests and exact browser text checks.
Canvas checks measure direct-label separation. Existing playback, held-axis and sticky-navigation checks remain active.

Canvas-only screenshots supplement full-page screenshots in `shots/chromium`.
The browser report records app source hashes and checks that those sources remain unchanged during the run.
These hashes cover `src`, `scripts`, the app manifest and Vite config. Parent-owned shared files are outside that fingerprint.

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

The foundation update adds seven focused tests, bringing the scoped run to 32 tests in six files with two workers.
Every foundation field and playback explanation passes the house prose budget.
The Vite build passes with a bundle-size advisory.
The current harness covers all five experiments at 1366, 1440, 1920, 2560, 390 and 320 pixels wide.
It checks visible teaching sections, parameter roles, sticky navigation, keyboard focus and unchanged URLs.
The parent owns Firefox and combined-site verification for this foundation update.
Each run preserves screenshots under `shots/<browser>` and its result in `verification.json` there.
Firefox requires execution outside the Windows sandbox on this machine.

The browser checks measure rendered axis stability, curve changes, playback movement, speed ratios, pause, rewind and end replay.
They also check held fitted ranges, live readings, visible math, featured knobs, inherited styling and mobile spacing.
The unit checks compare the entire held scope window with an independent exponential, including times beyond the initial response window.
Try steps remain sequential. Existing checks still enforce unrelated knob preservation, defaults, threshold ambiguity, canvas pixels and horizontal containment.
LabNav renders at the sibling path. Setting `APP_URL` enables the additional assembled-site link checks.
The director owns site assembly, shared changes and the full-suite gate. Student acceptance remains open.

Before the foundation update, integration runs used `APP_URL=http://127.0.0.1:47630/vlsi-lab/` in Chromium 151.0.7922.34 and Firefox 153.0.
Both completed all 25 experiment-size combinations, including every alternate view and the fanout sweep.
All sibling links responded successfully. Both error lists were empty.
The final build includes the director's shared NumField focus guard.
The harness freezes its clock and waits for the paused state before checking exact cursor stability.
