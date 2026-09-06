# VLSI Group A

The assigned branch is `lab/vlsi-lab` in the `vlsi-wave-1` worktree.
Ownership covers `apps/vlsi-lab` only. The deliverable ends after A1 through A5.
The decisions in `VLSI_LAB_PLAN.md` are settled. Shared changes require director integration.

## Ownership

| Lane | Files | Contract and evidence |
| --- | --- | --- |
| Model and bridge | `src/model.js`, `src/extract.js` | `extract.test.js` checks inverter rail steps against network waveforms. |
| Lessons | `src/experiments.js`, `src/terms.js` | `experiments.test.js` independently checks every lesson claim. |
| App | `src/App.jsx`, `src/Plot.jsx`, `src/styles.css` | `scripts/verify.mjs` checks navigation, controls, canvases and screenshots. |
| Gate | `src/release.test.js`, `src/prose.test.js` | Tests enforce darkness and prose budgets. |

## Contracts

```js
inverter({ wp, vin, model, vdd, vt }) // cell inv, nodes in/out/vdd/gnd, devices Mp/Mn
extractGate(cell, load) // seconds, farads, exact isolated rail-step delays
edgeResponse(cell, load, edge) // network.pwlTransient, measured crossings, same netlist
eventChain(gate, stages, edge) // events.simulate, 1 fs grid, exact:false, error and bound
transfer() // square-law DC sweep and measured unity-gain points
```

The bridge supports one complementary inverter with one lumped output state.
Unsupported topology, finite off-resistance and intrinsic gate capacitance produce an explicit error.
The square-law view is static. It supplies no transient waveform.
The event chain represents isolated-stage transport delays rounded to a stated grid.
It does not represent a transistor chain driven by analog edges.

## Lesson schema

Each record carries `id`, `name`, `view`, `see`, `try`, `why` and `terms`.
The `see` function reads the live analysis. Each try step has `say` and `set`.
Try steps merge `set` into the current parameters. Only experiment selection and Reset restore all defaults.
Quantity paths include `gate.tpHL`, `gate.tpLH`, `response.measured`, `dc.nml` and `chain.error`.
Each lesson loads its defaults and resets the cursor. Only shipped lesson IDs enter navigation.

## Gate

Install existing dependencies offline before adding the workspace manifest.
Run app tests with `--maxWorkers=2`, app markdown lint and the Vite build.
Run the local browser harness when a browser is available. Commit only the app path after green checks.
The director owns the full suite, lockfile integration and deployment.
