# Director integration

## Foundation follow-up, 2026-09-08

The rollout worktree now includes the connected analog switch-model comparison
in A3's Timing view and at A5's selected fanout. `chain.js` measures each stage's
half-supply crossing with the continuous evaluator. Tests compare the first stage
against isolated extraction, check both edges and multiple loads/lengths, and
separate model difference from event rounding. The relevant omissions in the
historical wave notes below are superseded by this implementation.

The plan now states that analog and event-chain delays can differ, corrects the
width/self-capacitance example, and includes ln(2) in the fanout coefficients.
Electronics D6's input-limit/noise-margin terminology is corrected in this worktree.
General gate extraction and Groups B–G remain pending. Release remains dark.

## Plot labels and chip context

The app imports shared `ChipContext` at the start of Foundations, before the inverter paragraphs.
Overview browser checks use `:scope > dl > dt` so the primer's material list does not enter the lesson-field count.
The inverter lesson remains visible without disclosure controls. The shared primer retains its optional fabrication details.
The curriculum places this short context after basic circuit elements and before semiconductor-device work.

Scope, Transfer, Timing and Fanout now explain all data traces, reference curves, cursor lines and dots, guides and aliases.
Transfer defines VIH and VIL before use and labels output limits, noise margins, ambiguous switch points and undefined input logic.
Legends wrap within the plot column. Direct labels have opaque backgrounds so cursors do not cross their text.
The current topbar uses output and delay words without threshold abbreviations.
Axes, playback and sticky section navigation keep their existing behavior.
The desktop plot section scrolls normally so its complete legend, canvas and controls remain reachable on short screens.

The scoped run passes 39 tests in seven files. The app build and numerical pins pass.
Input-limit definitions and long plot captions have prose-budget tests and exact browser text checks.
Chromium evidence remains under `shots/chromium`, including canvas-only screenshots and the source fingerprint in `verification.json`.
The fingerprint covers app source, tests, scripts, package manifest and Vite config. Shared dependencies remain parent-owned.
The browser gate includes 30 lesson/viewport cases plus alternate views and retains the existing interaction checks.

The combined scoped suite passes 369 tests in 34 files. All 24 apps build and are assembled in the director preview.
Final browser logs use `labels-vlsi-` prefixes in the worktree root. Physical-phone and Safari review remain open.
The full numerical suite was not rerun for this presentation update.

## Foundation update

A1 through A5 now explain purpose, input, expected output, prediction, design tradeoffs and model limits before derivation.
Inverter and CMOS definitions remain visible, with applications and the two-stage polarity rule.
Parameter roles accompany the controls. Physical edge descriptions distinguish the input transition from its opposite output transition.
Playback explanations separate viewing speed from circuit timing and distinguish static input and fanout sweeps.

The phone section buttons match Interfaces labels and preserve the URL while moving keyboard focus.
The browser harness adds 320-pixel coverage and checks section visibility below the sticky navigation.
The scoped suite contains 32 tests, including foundation prose budgets and numerical prediction checks.
The final combined suite passes 357 tests in 31 files. Both apps are rebuilt in the assembled director preview.
Browser reports remain under `shots/chromium` and `shots/firefox`, with 30 experiment/viewport cases per browser.
The director logs use the `vlsi-foundations-` prefix. Phone checks include both 320-pixel and 390-pixel widths.
These checks do not replace physical-phone or iPhone Safari review.
The A3 and A5 analog-chain requirements below remain open.

## Student review rework

The app now consumes the director's shared `usePlayback` and `PlaybackControls` exports.
It also uses `MathBody` for permanently visible calculations and keeps the existing `panel.css` import.
The sidebar inherits the shared title, font, section wells and responsive widths.
Scope axes and event windows remain held across knob changes. Fit and reset are explicit actions.
The comparison uses the selected edge with default width, load and stage count.

The director corrected shared time-label clipping and phone label collisions after screenshot review.
Labels align inward and retain an eight-pixel gap. Grid and event positions remain unchanged.
The app uses native digital rows only. Its analog plots use the full-height app canvas with shared axes.
The original A3 and A5 analog-chain omissions below remain open. This work does not close whole-group acceptance.

## Shared promotion request

Promote `src/extract.js` to `packages/events/src/extract.js` after API review.
The current contract accepts only an isolated complementary inverter under an ideal rail step.
General gate extraction requires topology analysis and separate waveform evidence.
Logic Lab is the next consumer. No shared package changed here.

## Time contract

The events engine accepts integer ticks in a rational unit of seconds.
An RC crossing contains `ln(2)` and is not generally representable exactly on that grid.
The app labels the chain as rounded to 1 fs and displays its accumulated error.
Each stage contributes at most 0.5 fs of rounding error.
A3's exact analog-chain comparison remains deferred. It also requires measuring threshold events under finite input slopes.
A5 remains partial plan fulfillment. Its isolated fanout law has waveform pins, but no measured analog-chain comparison is included.
The event quantization bound does not close that gap. No additional slope solver is part of this deliverable.

## Plan corrections

The network MOS switch regions and Electronics D4 through D7 already exist.
Electronics D5 uses a BJT switch. Its MOS remark does not make D5 a MOS transient fixture.

Noise margins are `V_IL - V_OL` and `V_OH - V_IH`, using outputs at the unity-gain inputs.
The computed margin is 0.675 V, as Group A2 states. The input limits are about 0.788 V and 1.013 V.
Electronics D6 also calls the input limits noise margins. Please reconcile that terminology separately.

Width changes alter both resistance and self-capacitance.
At width 1, the computed rise and fall delays are about 37.64 ps and 18.82 ps.
Group A4's fixed-load doubling claim would require an explicitly fixed total capacitance.
The fanout slope and intercept for 50 percent delay each contain `ln(2)`.

## UI and deployment

The app consumes the shared schematic, timing canvas, numeric fields and lesson controls.
The schematic highlights conducting devices through its existing `lit` API.
A dedicated open/closed MOS glyph overlay needs a shared schematic prop with a renderer test.
VLSI and Interfaces would consume that prop.

The director registered the workspace in the lockfile without new dependency versions.
The dark deployment copy step and assembly entry are present.
The executable inventory contains `a1` through `a5`. The wider curriculum and progression-test extension remain open.
Public navigation is unchanged. Release status remains dark.

The shared URL registry now includes `/vlsi-lab/`.
Deployed navigation and interaction checks passed in Chromium and Firefox on the director branch.
The harness accepts `APP_URL` and `BROWSER` for repeated checks against the assembled site.
The director owns full-suite evidence. The open plan requirements above prevent whole-group acceptance.
