# Interfaces Lab build brief

## Scope and ownership

This sitting implements Group A only, with five experiments. The assigned branch is `lab/interfaces-lab` in `interfaces-wave-1`.
All edits stay inside `apps/interfaces-lab`. The director owns integration, registration, the lockfile and deployment.

| Lane | Owned paths | Deliverable |
| --- | --- | --- |
| Pin | `src/pin.js`, `src/pin.test.js` | Network transient adapter and independent invariants |
| Lessons | `src/experiments.js`, `src/lessons.js`, `src/terms.js`, their tests | A1 through A5 |
| Shell | Remaining app paths | Shared controls, schematic, scope, equations and dark guard |

## Contracts

```js
// pin.test.js: closed forms, continuity, KCL, crossings and short pulses
pinDrive(pin, edges, { tEnd, initial = 0 })
// -> { wave(t), at(t), crossings, segments, samples, tr, tf, tpLH, tpHL }
// Seconds, volts, ohms and farads throughout. Edges begin at zero.
// Crossings carry { t, level, dir, edge }. Absent measurements are null.

// experiments.test.js: each lesson claim and its independent reference
analyse(params) // -> pin traces, thresholds, rise budget and loaded noise budget
```

Fixed models are `pin.pp`, `pin.od` and `pin.in`. The input model uses matched square-law CMOS threshold definitions.
The output models use finite on-resistance switches. Each fixed topology runs through `network.transient` with capacitor state preserved.
Crossing times use the resulting scalar state equation. There is no generic circuit solver in this app.

Lessons contain `see(result, params)`, `try[{say,set}]`, `why`, and term identifiers.
Readings use `rise.tr`, `rise.tpLH`, `fall.tf`, `thresholds.vil`, `thresholds.vih`, `budget.slack`, and `margins`.
Try steps merge into current settings and run sequentially. Reset is a separate action.
Absent rise crossings produce null slack and null pass status, with an explicit reason.

## Pins and gate

| Lesson | Independent reference |
| --- | --- |
| A1 | RC exponential, current balance and logarithmic rise interval |
| A2 | Matched CMOS closed forms and Electronics D6 solved slopes |
| A3 | Pull-up exponential, resistor divider and parallel fall resistance |
| A4 | Capacitance slope and both sides of the rise budget |
| A5 | Loaded driver DC voltages, inductive ramp voltage and integer pin limit |

The gate requires scoped tests with two workers, app build, prose lint and the dark release guard.
Browser verification covers desktop and phone layouts when the installed browser is available.
The director runs the full suite. No push or release change is authorized.
