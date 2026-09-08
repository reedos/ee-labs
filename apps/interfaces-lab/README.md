# Interfaces Lab

Group A contains five experiments about analog pins. They cover push-pull switching, CMOS input limits, open-drain charging, capacitive loading and noise margin.
The app remains dark. The director owns lockfile registration and deployed navigation.

## Running the app

Run these commands from the assigned worktree root. The workspace dependencies must already be installed.

```powershell
npm.cmd run dev --workspace apps/interfaces-lab
npx.cmd vitest run apps/interfaces-lab --maxWorkers=2
npm.cmd run build --workspace apps/interfaces-lab
node apps/interfaces-lab/scripts/pins.mjs
node apps/interfaces-lab/scripts/verify.mjs
```

The browser harness serves the built app at `/interfaces-lab/` on a temporary local port.
It saves screenshots and a report in the ignored `verification` directory. Deployed navigation remains pending the director's URL registry update.

## Model boundaries

Each fixed switch topology is a linear RC circuit. Its transfer function is rational and admissible to the systems core.
The complete switching stream changes topology, so it is not one LTI transfer function. This app does not export it to that core.

Network advances the capacitor state through each topology. Crossing times come from that topology's scalar state equation.
The input limits describe matched square-law CMOS devices with positive supply headroom above twice the device threshold.
An input between those limits has no guaranteed logic level. This interval is not Schmitt hysteresis.

The push-pull output has finite on resistance and no overlap between switches. The open-drain pull-up remains connected during pull-down.
The rising demonstration starts from a discharged capacitor. The falling demonstration starts from the supply voltage.

A5 uses a separate lumped current-ramp budget. Its current change per pin is the supply divided by on resistance.
Its edge duration is an explicit input. This budget does not predict package ringing, board layout effects or transistor gate dynamics.
Negative remaining margin marks a budget failure. It does not change the separate RC waveform.

Invalid component values, rail-exceeding static loads and degenerate input-limit settings produce an explicit boundary message.
Short pulses can produce no valid input crossing. Missing transitions remain absent rather than becoming invented events.

## Verification

The current foundation pass includes purpose, input/output, parameter roles, predictions and design tradeoffs for every Group A experiment.
Its numerical tests check the stated RC, threshold, pull-up and current-ramp predictions against the model.
Phone section links preserve experiment state and use one page scroll.
See `NEEDS.md` for current evidence. The wave counts below describe the earlier baseline.

Independent checks compare network waveforms with RC closed forms, current balance and power balance across deterministic parameter sweeps.
They exercise continuity, short pulses, divider lows and both sides of the time and noise budgets.
Lesson pins include Electronics D6 circuit slopes and a network inductor current-ramp check. Prose and dark-release checks are app-local.
The director runs the full suite.

This wave passed 37 scoped tests across four files, the app build and prose lint on three documents.
Chromium checked all five lessons at desktop and phone widths, including sequential Try steps, Reset and the model boundary.
Thirty screenshots cover default views, falling transitions and equations. The browser report records nonblank analog traces and layout checks.

## Teaching references

- [TI: Logic output types](https://e2e.ti.com/support/logic-group/logic/f/logic-forum/968927/faq-what-s-the-difference-between-logic-output-types-push-pull-open-drain-3-state) distinguishes actively driven levels from open-drain release.
- [TI: Choosing a pull-up resistor](https://www.ti.com/lit/an/slva485/slva485.pdf) explains the sink-current, logic-level and leakage constraints that bound practical resistor selection.
- [TI: Slow or floating CMOS inputs](https://www.ti.com/lit/an/scba004e/scba004e.pdf) covers uncertain inputs and excess current. Those effects are boundaries of this lab, not simulated outputs.
