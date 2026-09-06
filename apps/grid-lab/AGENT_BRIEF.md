# Grid Lab: build brief

You are one of up to eight agents building this lab in parallel. The plan is
`/GRID_LAB_PLAN.md`, and this brief turns it into lanes an agent can take without
colliding with another. Read the plan's §2 (engine) and §5 (curriculum) for your
lane before writing a line. Reed reviews everything.

## Boundaries: read first

- **One lane per agent, one worktree per agent.** Work in the overseer's worktree on
  `lab/grid-lab`, in a directory named for your lane. Run `npm install` there, so
  that `@ee-labs/*` resolves inside the worktree and not in the main tree.
- **Edit only the files your lane owns** (§1). Everything else is read-only. If you
  need a change outside your lane, write it into `apps/grid-lab/NEEDS.md` under your
  lane's heading and continue with what you can do. The overseer resolves it.
- **Stage by path.** `git add packages/grid/src/powerFlow.js`, never `git add -A`,
  and never `commit -a`. Workers hand their work to the overseer, who commits.
- **Nothing is pushed by this lab.** The director merges `lab/grid-lab` into the
  integration branch, runs the whole suite, and pushes.
- **Preview port.** Lane number plus 4320, so lane 3 previews on 4323.

## The house discipline

Read `/CORE_SCOPE.md`, `/STYLE.md` and `/REVIEW_PLAYBOOK.md` first. Then the rule
every lab obeys. **Every explanatory sentence is a claim about physics, and a test
must measure it.** A lesson quotes no number the engine does not produce. A
prediction follows every control that can change it. A claim the settings cannot
show is footnoted rather than crossed out. On-screen text passes
`npm run lint:prose`.

This lab has two guarded approximations and they are the plan's §2.7 and §2.8. The
DC power flow warns past 10° and declines the flow arrows past 30°. The lumped π
line model gives way to the exact hyperbolic form past 250 km. Everything else here
is exact and is written without a hedge, which is the counter-rule in
`CORE_SCOPE.md`.

Commit messages are narrative. Read `git log` for the register. No model name goes
in a commit or a file.

## 1. The lanes

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | Per unit, three phase, the line | `packages/grid/src/{perUnit,line,threePhase}.js` and their tests | now | invariants 5 and 12 green, every A, B and C number computed |
| 2 | The network and the power flow | `packages/grid/src/{cx,network,powerFlow,library}.js` and their tests | now | invariants 1, 2, 6 and 7 fuzzed green, the Jacobian inside 10⁻⁶ of a finite difference |
| 3 | The DC power flow | `packages/grid/src/dcFlow.js` and its test | after lane 2's `powerFlow` | the five-loading table pinned, invariant 11 green, the guard tested at both sides |
| 4 | Sequence networks and faults | `packages/grid/src/{sequence,faults}.js` and their tests | now | invariants 3, 4 and 8 green, four faults against their closed forms |
| 5 | Protection and dispatch | `packages/grid/src/{relay,dispatch}.js` and their tests | now | the IEC curve at five multiples, the dispatch against a hand Lagrangian |
| 6 | The machine and stability | `packages/grid/src/swing.js` and its test | after `@ee-labs/machines` lands `swing()` | invariants 9 and 10 green, the areas agreeing to 10⁻¹⁰ pu·rad |
| 7 | The app shell and the one-line canvas | everything in `apps/grid-lab/` not owned by a group lane, plus `packages/ui/src/OneLineCanvas.jsx` and its test | now, against §3.8's stub | the shell loads a stub experiment at 390 px, the release test passes dark |
| 8 | The groups | `apps/grid-lab/src/groups/<letter>.js` and `lessons/<letter>.js`, two letters per agent in plan order | after lane 7's shell and its own engine lane | every number in its groups pinned in `experiments.test.js` |

**The gate.** Groups D and E need lane 2. Groups F and G need lane 4. Group H needs
lane 5. Group I needs lane 6, which needs the Machines Lab. No group lane starts
before its engine lane's exit is met. After the gate the groups split two per agent
in plan order: A and B, C and E, D alone, F and G, H and J, I alone.

**Shared seams, landed first.** Lane 2's first commit adds `packages/grid`'s
`package.json`, `index.js` and `cx.js`, because every other engine lane imports
them. Lane 7's first commit adds the app skeleton, `RELEASE_STATUS` and
`release.test.js`. Every other lane builds on those two.

## 2. The app skeleton (lane 7)

Copy the Energy Lab's shape, file for file, and delete what this lab does not need:

```
apps/grid-lab/
  index.html  package.json  vite.config.js  RELEASE_STATUS (dark)
  src/App.jsx  main.jsx  styles.css
  src/experiments.js      merges groups/*.js in plan order, no prose
  src/lessons.js          merges lessons/*.js
  src/groups/{a..j}.js    one file per group, owned by that group's lane
  src/lessons/{a..j}.js   the see / try / why registers, same owner
  src/analysis.js         one solve per experiment, and readQuantity
  src/terms.js            definitions on contact, one registry
  src/math.js             the math-panel rows
  src/format.js  report.js
  src/components/         OneLinePane, NewtonCanvas, SequenceCanvas, PowerAngleCanvas,
                          SwingCanvas, RelayCanvas, panes.jsx
  src/experiments.test.js  prose.test.js  release.test.js
```

The one-line diagram is not in this list. It goes to `packages/ui` on its first
build, with the Energy Lab's props in its signature (§3.7), because
`PROGRAM.md` §4 names the Energy Lab as its second user.

## 3. Contracts

Every signature below is a promise between lanes. A lane may add to its return
shape, never rename or remove. Each contract ships with the failing test named
beside it, written before the implementation.

### 3.1 Per unit (lane 1, `perUnit.js`)

```js
/** The four bases that follow from a base power and a base line-to-line voltage. */
export function bases({ Sbase, Vbase })   // { Sbase, Vbase, Zbase, Ibase, Ybase, VbaseLN }
export function zoneBases(base, Vbase2)   // the other side of a transformer
export function changeBase(z, { Sold, Vold, Snew, Vnew })
export const toPu, fromPu                 // by kind: S, P, V, Vln, I, Z, Y
export function loadFromPf(P, pf, { lagging })
export function zipModels({ P, Q }, Vref) // .power(V) gives the three models
```

Test: 529 Ω, 251.022 A and 132.791 kV at 100 MVA and 230 kV. 1.9044 Ω and 4183.7 A
at 13.8 kV. 0.222222 pu and 0.0666667 pu from the two base changes. Every
conversion round-trips to floating point.

### 3.2 The network (lane 2, `network.js`)

```js
// A bus. P and Q are the NET injection, generation less load, in per unit.
{ id: 'bus1', name: 'Bus 1', type: 'slack' | 'pv' | 'pq',
  V: 1, theta: 0, P: 0, Q: 0, Qmin: -Infinity, Qmax: Infinity,
  G: 0, B: 0,             // a shunt to ground at the bus
  x: 60, y: 40 }          // its place on the one-line grid

// A branch. `b` is the total line charging, half stamped at each end.
{ id: 'br12', from: 'bus1', to: 'bus2', r: 0.01, x: 0.08, b: 0.16, tap: 1, shift: 0 }

export function networkOf(spec)      // fills defaults, checks, indexes
export function ybus(net)            // n × n of [re, im]
export function branchFlows(net, Vc) // per branch: Sf, St, loss, Iseries, angle
export function lossAudit(net, Vc)   // injections, branch losses, and the residual
```

Test (`network.test.js`): the three-bus matrix entry for entry against the plan's
§2.3, and every branch leaving a bus summing to that bus's injection to floating
point. A bus with no reactive limit keeps `Infinity`, which a JSON clone would
lose.

### 3.3 The bus companion and the polar Newton (lane 2, `powerFlow.js`)

```js
/**
 * One bus's contribution at the present guess. The shape is the Electronics
 * Lab's companion interface with a different state vector: the unknowns are
 * the real pair (θ, |V|), because a constant-power injection has no complex
 * admittance as its tangent.
 *
 * @returns {{
 *   id: string,
 *   region: 'slack' | 'pv' | 'pq' | 'pqLimited',
 *   rows: Array<'P' | 'Q'>,                    // the equations this bus contributes
 *   g: { P: { theta: number[], V: number[] }, Q: { … } },   // its Jacobian rows
 *   i: number[],                               // its mismatch, one per row
 *   limit: (next, now) => number               // the step limit on a magnitude
 * }}
 */
export function busCompanion(net, i, state)

export function powerFlow(net, opts)  // { tol, maxIter, limits, flat, stepping, start }
export function jacobianCheck(net)    // the largest relative gap to a finite difference
export function pvCurve(net, busId, opts)
export class PowerFlowError extends Error   // .kind === 'no-solution'
```

`powerFlow` returns `{ buses, byId, flows, slack, loss, Ploss, iters, iterations,
mismatches, conversions, steps, jacobian }`. `iterations` counts the Newton
updates, so the pass that read the mismatch below tolerance is not one of them.

Test (`powerFlow.test.js`): the plan's §4.3 solution to six figures, and the first
Jacobian entry for entry. Then the mismatch sequence 1.600, 6.892 × 10⁻²,
3.480 × 10⁻⁴, 8.367 × 10⁻⁹ and below 10⁻¹². Then `jacobianCheck` inside 10⁻⁶ on
four networks.

### 3.4 The DC power flow (lane 3, `dcFlow.js`)

```js
export const DC_WARN_DEG = 10, DC_REFUSE_DEG = 30, DC_RX_LIMIT = 0.25, DC_V_BAND = [0.95, 1.05]
export function dcFlow(net)                    // { theta, flows, B, slackP }
export function dcGuard(sol)                   // { warn, refuse, reasons, text, refusal }
export function dcCompare(net, { ac })         // per bus and per branch, error and scaled
export function assumptionCost(net, sol)       // what each assumption costs alone
```

`dcCompare` reports two readings of the same disagreement. `error` is per branch,
which is what E1 and E2 quote. `scaled` is against the largest flow the network
carries, which is what the guard's promise is written on. A branch carrying a
hundredth of a per unit can be wholly wrong and still be nearly right in megawatts.

Test (`dcFlow.test.js`): the five-loading table. Then the warning and the refusal,
each firing on one side of its threshold and not on the other.

### 3.5 Sequence networks and faults (lane 4)

```js
export const A_MAT, A_INV                      // with a = 1∠120°
export function toSequence(abc)                // { seq, zero, positive, negative, mag, ang }
export function toPhase(seq)
export function neutral(abc)                   // { sum, zero, threeZero, mag }
export function unbalanceFactor(abcOrSeq)      // |I₂| / |I₁|
export function sets(abc)                      // the three balanced sets, for the picture

export function sequenceImpedances({ generator, transformer, line })
export function faultStudy(spec, { kind, Zf }) // kind: '3ph' | 'slg' | 'll' | 'dlg'
export function faultTable(spec, opts)
export function crossoverRatio(spec)           // where a ground fault overtakes a three-phase one
```

Test: `A A⁻¹ = I` to floating point, and the round trip below 10⁻¹³. Then each of
the four faults against its closed form, in per unit and in amperes.

### 3.6 Protection, dispatch and stability (lanes 5 and 6)

```js
export function iecTime({ pickup, tds, curve }, I)   // t = TDS·K/(Mᵅ − 1)
export function coordinate(setting, I, downstreamTime, margin)
export function distanceZones({ Zline, zone1, zone2, t2 })
export function apparentZ({ ohmPerKm, km, tapKm, infeed })  // .infeedForReach(reach)
export function zoneOf(zones, Z)

export function dispatch(units, demand)   // { lambda, units, cost, equalCost, saving }
export function marginalCost(units, demand, step)

export function stability(machine, { pre, during, post })
// { M, delta0, deltaMax, deltaCr, areaAccel, areaDecel, areaError, tcr, cycles,
//   Kpost, fnPost, periodPost, plant, clearAt, criticalTime, closedFormTime, curves }
```

`stability` takes the machine from `@ee-labs/machines`. It reads `swing()` there
for `M`, the equilibrium angle, the synchronising coefficient and the energy
integral, and writes no second machine model.

Test: 1.35 s, 0.45 s and 0.15 s on the IEC very inverse curve. λ = 8.50 $/MWh and
a saving of $195.28. δ_cr = 70.2924° with the two areas agreeing to 10⁻¹⁰ pu·rad.

### 3.7 The one-line canvas (lane 7, `packages/ui/src/OneLineCanvas.jsx`)

This canvas is built here and used by the Energy Lab. That lab's props are in its
signature from the first commit (`PROGRAM.md` §4, plan Decision 3).

```jsx
<OneLineCanvas
  buses={[{ id, name, x, y, V, theta, kind, soc, dc }]}   // kind: 'slack'|'source'|'storage'|'load'|'bus'
  branches={[{ id, from, to, Pf, Qf, Pt, Qt, loss, limit }]}
  balance={{ in, out, stored, curtailed, unserved, unit }} // the energy-balance readout
  arrows="flow"        // 'flow' | 'none', so a guard can decline them
  refusal={null}       // the sentence printed where the arrows would be
  t={null}             // a day-long cursor, hours, for the Energy Lab
  units="pu"           // 'pu' | 'si'
  base={{ S, V }}
/>
```

Test (`OneLineCanvas.test.jsx`): a Grid Lab network draws one bar per bus and one
arrow per branch end, with the arrow reversing when the flow does. An Energy Lab
network draws a photovoltaic source, a battery with its state of charge and a load
on one DC bus, and the balance readout sums to zero. Both labs are named in the
test file.

### 3.8 The stub lane 7 builds against

Until lane 2 lands, lane 7 imports `apps/grid-lab/src/stub.js`. It exports
`powerFlow` returning the three-bus system's hand numbers in the shape of §3.3.
The stub is deleted in the commit that switches the import to `@ee-labs/grid`, and
`experiments.test.js` fails if it is imported after that.

## 4. The lesson schema, and the quantity paths

Copy the Energy Lab's `lessons.js` header comment and its three registers. They are
`see` (≤ 70 words), `try` (each step ≤ 45 words, with `set` and `reads`) and `why`
(≤ 160 words). An experiment entry is the Energy Lab's shape: `id`, `group`, `name`,
`terms`, `params`, `views`, `view`, `kind`, `claim`. One field is new. `network` is
the library network the experiment opens on, by name.

Quantity paths a `reads` pair may name:

```
base.<Zbase|Ibase|VbaseLN|Sbase|Vbase>        the four bases, in SI
bus.<id>.<V|theta|deg|P|Q|kV|kA>              a solved bus, per unit or SI
branch.<id>.<Pf|Qf|Pt|Qt|loss|angle|I|MW>     a solved branch end
flow.<loss|slackP|slackQ|iterations|mismatch> the whole solve
dc.<theta.<id>|flow.<id>|angleError|flowError|maxAngle> the linear solve and its error
seq.<zero|positive|negative>.<mag|ang>        symmetrical components
fault.<phaseA|phaseB|phaseC|ground|level>     a fault current, per unit
fault.seq.<zero|positive|negative>            its sequence currents
z.<Z1|Z2|Z0>                                  the three Thévenin impedances
relay.<time|margin|tds|Z|reach1|reach2|zone>  a relay's answer
swing.<M|delta0|deltaMax|deltaCr|tcr|cycles|areaAccel|areaDecel|peak|peakExact|fn|period>
dispatch.<lambda|cost|equalCost|saving|marginal>  and `dispatch.unit.<id>.P`
line.<Zc|sil|exact|nominal|error|charging>    the line's own closed forms
phase.<I|P|Q|pf|Vln|ripple|min|max>           the three-phase measures
```

`experiments.test.js` resolves every path against the analysis and fails on a path
it cannot resolve, as the Energy Lab's does.

## 5. Library networks

Values are the plan's §4.3 defaults, in `packages/grid/src/library.js`. Bus names
are fixed so that `reads` paths and layouts agree across lanes.

```js
// The three-bus system: groups D, E and most of the app's topbar.
threeBus({ load = 1, gen = null, Qmax = Infinity, Qmin = -Infinity, V2 = 1 })
// bus1 slack at 1.00∠0, bus2 PV at 1.00 pu with 0.60 pu, bus3 PQ with 1.60 + j0.80 pu.
// Branches of 100, 150 and 80 km of the reference line. The loading knob moves
// the generation with the load, which is how §2.7's table was measured.

twoBus({ x = 0.1, P = 0.8, Q = 0.6, tap = 1, Bsh = 0 })   // C4's drop, tap and compensation
fourBus({ load = 1 })                                     // a loop, for the fuzz
radial({ load = 1 })                                      // no loop at all

FAULT_NETWORK   // generator X1 = X2 = 0.15, X0 = 0.05, delta to grounded wye at 0.10,
                // line X1 = X2 = 0.20, X0 = 0.60. So Z1 = Z2 = j0.45 and Z0 = j0.70.
DISPATCH_UNITS  // three quadratic costs, 800 MW of demand, λ = 8.50 $/MWh
MACHINE         // H = 4.0 MJ/MVA at 60 Hz, P_m = 1.0 pu
```

The reference line is 0.05 + j0.40 Ω/km with 3.0 µS/km of charging at 60 Hz. The
library rounds that to 0.01 + j0.08 pu and 0.16 pu of charging per 100 km.

## 6. What each lane pins

Every number in the plan's §5 for your groups becomes a `reads` pair. Each one is
checked in `experiments.test.js`, computed from the knobs rather than typed in.

| Lane | Pins |
| --- | --- |
| A and B | 529 Ω, 251.022 A, 132.791 kV, 1.9044 Ω, 4183.7 A, 0.222222, 0.0666667, 37.1847 Mvar. 1187.71 A, 423.2 MW, 0.894427, −16.6507 MW to 298.784 MW, 5.95477 A, 16.927 % |
| C | 5 + j40 Ω, 0.1587 pu, 365.148 Ω, 144.873 MW, 1.02449 against 1.02459, 3.889 %, 0.931926 pu, 1.07305 |
| D | 0.961727 pu, −1.49154°, −4.75867°, 1.01817 pu, 0.407676 pu, 1.81741 MW, four iterations, the five mismatches |
| E | −1.4168°, −4.7503°, 3.675 %, the five-loading table, 10° and 30° |
| F and G | 1.98492, 7.80894, 1.32184 A, 16.927 %, j0.45 and j0.70 pu, 2.2222 pu, 557.83 A, 1.875 pu, 470.67 A, 1.9245 pu, 2.0883 pu, 1.6216 pu, 407.06 A |
| H and J | 1.35 s, 0.45 s, 0.15 s, 0.30 s, 0.16667, 32 Ω, 48 Ω, 24 Ω, 36 Ω. λ = 8.50, $6682.50, $6877.78, $195.28, $8.50189 |
| I | 0.0212207 pu·s²/rad, 30.000°, 138.190°, 70.2924°, 0.43883275 pu·rad, 0.206114 s, 12.367 cycles, 1.15523 Hz, 59.4938°, 71.5997°, 89.7763°, 122.922° |

## 7. Verify before handing work over

```
npx vitest run packages/grid apps/grid-lab packages/ui
npm run lint:prose
npm run build --workspace apps/grid-lab
node packages/grid/scripts/numbers.mjs      # every plan number, recomputed
```

Run every test in the foreground. Screenshot every view at 390 px and at
1280 × 900 and read the screenshots as a student would, per `/REVIEW_PLAYBOOK.md`
§11. The sequence pane is the widest picture in the suite, and it stacks vertically
below 500 px.

## 8. Gotchas the other labs paid for

- A test that fails may be the test. Decide which, and say which in the commit.
- Tolerances are relative to the solution's scale, never a fixed epsilon. A branch
  carrying 0.01 pu and a branch carrying 1.0 pu do not share an epsilon.
- Wherever two numbers are shown as equal, ask what could make them differ
  silently. Then remove the cause or print it.
- A JSON round trip turns `Infinity` into `null`, and a PV bus with no reactive
  limit carries `Infinity`. `networkOf` deep-copies by hand for that reason.
- `packages/network` exports its complex helpers as one namespace, so
  `import { complex } from '@ee-labs/network'` is the only way in. Deep imports of
  `src/complex.js` are blocked by the package's exports map. `packages/grid/src/cx.js`
  is the re-export every file here uses.
- The dark launch is enforced by a test. While `RELEASE_STATUS` says `dark`,
  nothing outside `apps/grid-lab/` may mention the lab.
