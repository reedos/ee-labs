# Director integration

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
An exact analog-chain comparison remains deferred. It also requires measuring threshold events under finite input slopes.
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

Add the app workspace to the lockfile during integration. No new dependency version is required.
Add the dark deployment copy step for `apps/vlsi-lab/dist` and the assembly entry.
Register IDs `a1` through `a5` in the progression test. Keep public navigation and release status dark.
Mirror the bounded result and deferred work in the director's ledger.

The shared URL helpers currently hide LabNav at `/vlsi-lab/`.
The director owns the path registry correction and will register this app during integration.
App screenshots do not certify deployed navigation. The director's final deployed-path review remains pending.
