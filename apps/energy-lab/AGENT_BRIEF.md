# Energy Lab: build brief

You are one of up to five agents building this lab in parallel. The plan is
`/ENERGY_LAB_PLAN.md`, and this brief turns it into lanes an agent can take
without colliding with another. Read the plan's §2 and §4 for your lane before
writing a line. Reed reviews everything.

## Boundaries: read first

- **One lane per agent.** Edit only the files your lane owns. Everything else
  is read-only. If you need a change outside your lane, write it into
  `apps/energy-lab/NEEDS.md` under your lane's heading, commit that, and carry
  on with what you can do. The owning lane picks it up.
- **This lab owns no package.** `packages/network` and `packages/switched` are
  read-only here, in every lane, without exception. The plan's whole first
  decision is that nothing in them changes. A contract you want from either
  goes into `NEEDS.md`, and your lane builds around its absence.
- **Nor does it own any other app**, `site/`, `README.md`, `LabNav.jsx` or
  `deploy.yml`. `NEEDS.md` records what those files will need at release.
- **Stage by path.** Use `git add apps/energy-lab/src/groups/a.js`, never
  `git add -A` and never `commit -a`.
- **Never push.** Reed pushes. Every push deploys.
- **Preview port.** Lane number plus 4180, so lane 3 previews on 4183. Other
  labs use 4300 to 4305 and Power Lab uses 4177.

## The house discipline

Read `/CORE_SCOPE.md`, `/STYLE.md` and `/REVIEW_PLAYBOOK.md` first. Then the
rule every lab obeys. Every explanatory sentence is a claim about physics, and
a test must measure it. A lesson quotes no number the solver does not produce.
A prediction follows every control that can change it. A claim the settings
cannot show is footnoted rather than crossed out. On-screen text and every
markdown file pass `npm run lint:prose`.

Commit messages are narrative. They say what changed, why, and what fell out.
Read `git log` for the register. Never put a model name in a commit or a file.

## 1. The lanes

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | The physics and the analysis | `src/physics.js`, `src/analysis.js`, `src/physics.test.js`, `scripts/numbers.mjs` | done, see §2 | invariants 1 to 10 green |
| 2 | The app shell | everything in `apps/energy-lab/` not owned by another lane, `RELEASE_STATUS`, `release.test.js`, `scripts/verify.mjs` | after lane 1's contracts | the shell loads a stub experiment at 390 px, the release test passes dark |
| 3 | Groups A and B | `src/groups/{a,b}.js`, `src/lessons/{a,b}.js`, `components/IVCanvas.jsx`, `components/StringCanvas.jsx` | after lane 1 | A1 to A8 and B1 to B5 pinned |
| 4 | Group C | `src/groups/c.js`, `src/lessons/c.js`, `components/TrackCanvas.jsx` | after lane 1 | C1 to C5 pinned |
| 5 | Groups D and E | `src/groups/{d,e}.js`, `src/lessons/{d,e}.js`, `components/{ScopeCanvas,DayCanvas}.jsx` | after lane 1 | D1 to D5 and E1 to E3 pinned |

**The gate.** Lane 1 is the gate, and it is already through it. `src/physics.js`
and `scripts/numbers.mjs` are committed, the plan's numbers came from them, and
§3's contracts are what they export today. No group lane starts before reading
that file. Lanes 3, 4 and 5 do not collide, because each owns its own two files
and its own canvases.

**Shared seams, landed first.** Lane 2's first commit adds `experiments.js`,
which merges `groups/*.js` in plan order, and `lessons.js`, which merges
`lessons/*.js`. Both are lane 2's for ever. A group lane adds its file and
nothing else.

## 2. What lane 1 already established

Three findings from building the physics. Every lane needs them, because each
one changes what a note may say.

1. **A string is parameterised by its current, not its voltage.** Held at a
   terminal voltage, twelve nearly-open junctions in series leave `newtonDC`
   nothing to stand on, and it refuses over about a sixth of the range. Held at
   a current, each junction's own current is fixed and the same solver
   converges everywhere. So `atI` is the primitive, and `atV` and `atR` bisect
   it. That is also the physics, and a note may say so.
2. **The shunt resistance is never infinite.** It defaults to 10 kΩ, which is
   what a real cell has and what keeps a long string conditioned. It costs
   0.325 µV of V_oc and 0.001157 % of P_mpp, both measured, and A6 quotes both.
3. **Every solve asks for a nanovolt** rather than the solver's picovolt, and
   the sweeps stop a millionth short of the short circuit. §2.1 of the plan
   gives the reason. No lane may tighten either without re-running the
   convergence fuzz.

## 3. Contracts

Every signature below is a promise between lanes. A lane may add to a return
shape, and may never rename or remove one. Everything here is exported by
`src/physics.js` today.

### 3.1 The cell, and its defaults

```js
export const CELL_DEFAULTS = {
  iph: 5,        // A at G_REF
  is: 1e-10,     // A at T_REF
  n: 1,          // ideality factor
  Rs: 0,         // Ω, series; 0 means the element is absent
  Rsh: 1e4,      // Ω, shunt; see SHUNT_DEFAULT
  G: 1000,       // W/m², irradiance
  T: 298.15,     // K, cell temperature
  Ns: 1,         // cells in series
  Np: 1,         // strings in parallel
  isBypass: 1e-6 // A, the bypass diode's saturation current
}
export const G_REF = 1000
export const T_REF = 298.15
export const CELSIUS = 273.15
export const E_G = 1.12          // eV, silicon's band gap
export const XTI = 3             // the saturation current's temperature exponent
export const BACKOFF = 1e-6      // how close a sweep comes to the short circuit
export const NEWTON = { vtol: 1e-9 }
```

### 3.2 The netlists, with fixed node names

Node names are fixed so that `reads` paths, layouts and tests agree across
lanes. `arrayElements(c, opts)` builds them, and no lane writes its own.

```
gnd                the bottom of every string
s{s}n{k}           the joint between cell k−1 and cell k of string s
t                  the array's terminal, common to every string
j{s}_{k}           cell k of string s at its junction, present only when R_s > 0
```

Element ids follow the same tags. Cell k of string s carries `Iph{s}_{k}`,
`D{s}_{k}`, `Rsh{s}_{k}` and, when present, `Rs{s}_{k}`. A bypass diode across
that cell is `Db{s}_{k}`. The terminal drive is `Vt`, `It` or `RL`, one of the
three, never more than one.

```js
export function arrayElements(c, { cells = null, bypass = null } = {})
export const arrayNetI = (c, I, opts) => ({ elements: [...] })   // terminal held at a current
export const arrayNetV = (c, V, opts) => ({ elements: [...] })   // terminal held at a voltage
export const arrayNetR = (c, R, opts) => ({ elements: [...] })   // terminal loaded by a resistor
```

`cells(k, s)` returns per-cell overrides, and shading is the only thing that
uses it. `bypass(k, s)` is true where a bypass diode belongs.

### 3.3 Reading the array

```js
atI(c, I, opts) -> { v, i, p, iters, sol, drive }   // the primitive
atV(c, V, opts) -> same shape                       // bisects atI
atR(c, R, opts) -> same shape                       // bisects atI
openCircuit(c, opts) -> volts                       // one solve, no search
shortCircuit(c, opts) -> amps                       // one solve, no search
sweepI(c, { n, opts }) -> [point]                   // n points, the last at the short circuit
maxPower(c, { scan, opts }) -> point
figures(c, opts) -> { isc, voc, vmpp, impp, pmpp, ff, rmpp }
vocFormula(c) -> volts                              // the closed form, for the comparison
decadeOfLight(c) -> volts per decade of photocurrent
isAt(is, n, T) -> amps                              // the temperature law of the plan's §2.3
iphAt(iph, G) -> amps
vtAt(T) -> volts
```

### 3.4 The tracker

```js
/**
 * One perturb-and-observe step. `state` is { v, p, dir } and `power(v)`
 * returns the power at a terminal voltage.
 */
poStep(state, power, { step, vmin, vmax }) -> { v, p, dir, gained }
poRun(power, { v0, dir, step, n, vmin, vmax }) -> [state]
settled(path, window = 12) -> { mean, vmin, vmax, swing }
firstReversal(path) -> the index of the first step that changed direction
```

`power` is the caller's. Lane 4 must memoise it by voltage, because the walk
revisits the same voltages for ever, and the tests would otherwise run for
minutes.

### 3.5 The converter

```js
buckRin(R, D) -> R / D²
buckPoint(c, { D, R, L, C, fs, opts }) -> {
  v, i, p,            // the array's operating point
  ss, m,              // the switched steady state and its measures
  rin,                // R / D²
  iinModel,           // D²·v / R
  iinSwitched,        // the steady state's own average input current
}
mpptDuty(c, R, opts) -> { D, reachable, ...figures(c) }
```

`iinModel` against `iinSwitched` is the check that closes the loop, and C5's
note leans on it.

### 3.6 The battery

```js
export const BATTERY_DEFAULTS = { Q: 7200, R0: 25e-3, R1: 15e-3, C1: 2000, R2: 10e-3, C2: 20000, z0: 0.5 }
export const OCV_FIT = { v0: 3.48, k: 0.72, band: [0.1, 0.9] }   // LABELLED DATA

ocv(z, fit) -> volts
inBand(z, fit) -> boolean          // the guard the panel prints
chargeCap(b, fit) -> Q / k         // 10.000 kF at the defaults
rDC(b) -> R0 + R1 + R2
batteryNet(b, drive, fit)          // terminal at node `t`; state order is Cq, C2, C1
restingState(b, z, fit) -> [k·z, 0, 0]
socOf(vq, fit) -> z
pulse(b, { i, tEnd, z0, x0, points, fit }) -> a transient
roundTrip(b, { i, t, z0, points, fit }) -> { out, back, eOut, eIn, heatOut, heatIn, eta, zStart, zLow, zEnd }
cccv(b, { icc, vlim, tEnd, z0, points, fit }) -> { cc, cv, tSwitch, xSwitch }
heat(tr) -> joules
terminalEnergy(tr, i) -> joules
```

Node names are `gnd`, `a`, `b`, `c`, `d`, `t`. Element ids are `V0`, `Cq`,
`R2`, `C2`, `R1`, `C1`, `R0`, plus the drive's own `Iload` or `Vt`.

### 3.7 The day

```js
export const DAY = { hours, irradiance, cellT, load }   // LABELLED DATA, 24 each
export const BUS_DEFAULTS = { modules, cellsPerModule, bankSeries, bankParallel, z0, zMin, zMax }
day(c, b, over) -> { rows, eIn, eLoad, curtailed, unserved, lost, stored, zEnd, bankV, bankQ, bankE, bankR, residual }
```

Each row is `{ h, G, T, pv, load, net, toBank, z, i, loss }`. `residual` is the
ledger's own closure and is zero to floating point. Lane 5 asserts it.

## 4. The lesson schema, and the quantity paths

Copy Circuit Elements Lab's `lessons.js` header comment and its three
registers. They are `see` at 70 words or fewer, `try` with each step at 45
words or fewer, and `why` at 160 words or fewer. An experiment entry is
Elements' shape: `id`, `group`, `name`, `terms`, `params`, `net`, `layout`,
`show`, `view`, `views` and `claim`. Two fields are new. `cell` is the cell
parameters the experiment opens with, and `opts` is its shading and bypass
description.

Quantity paths a `reads` pair may name:

```
pv.<v|i|p|iters>                       the array's operating point
pv.<isc|voc|vmpp|impp|pmpp|ff|rmpp>    its figures
pv.voc_formula                         the closed form, for the comparison
cell.<k>.<v|i|p>                       cell k's own junction, from the solved circuit
bypass.<k>.<v|i>                       that cell's bypass diode
mppt.<step|reversal|settled|swing|share>   the tracker's trajectory
buck.<D|rin|vout|pout|iinModel|iinSwitched>  the converter at its operating point
batt.<v|i|z|ocv>                       the battery at the cursor
batt.<heat|out|eta>                    its ledger over the run
batt.<tSwitch|zSwitch>                 the CC/CV changeover
day.<eIn|eLoad|curtailed|unserved|lost|stored|zEnd|residual>
day.<h>.<pv|load|z|toBank>             one hour of it
```

`experiments.test.js` resolves every path against the analysis, and fails on a
path it cannot resolve, as Elements' does.

## 5. Library configurations

Values are the plan's §3.3 defaults. Each is what an experiment passes to
`physics.js`, and no lane writes a netlist by hand.

```js
// Group A: one cell. The toggles are the only structural change in the group.
{ cell: { ...CELL_DEFAULTS }, opts: {} }
// A5 toggles Rs between 0 and 5e-3. A6 toggles Rsh between 1e4 and 5.
// A7 sweeps G over 100 to 1000. A8 sweeps T over 273.15 to 348.15.

// Group B: the twelve-cell string. B2 sets Np to 3.
{ cell: { ...CELL_DEFAULTS, Ns: 12 }, opts: {} }
// B3, B4 and B5 shade cell 0 and turn the shunt down, for the plan's §2.4 reason.
{ cell: { ...CELL_DEFAULTS, Ns: 12, Rsh: 5 },
  opts: { cells: (k) => (k === 0 ? { G: 300 } : {}) } }
// B5 adds the bypass diode.
{ opts: { cells: (k) => (k === 0 ? { G: 300 } : {}), bypass: (k) => k === 0 } }

// Group C: the same twelve-cell string, into a load or into the buck.
{ cell: { ...CELL_DEFAULTS, Ns: 12 }, buck: { R: 0.5, L: 100e-6, C: 100e-6, fs: 100e3 } }

// Group D: the battery at its defaults, from z = 0.5 or z = 0.2.
{ battery: { ...BATTERY_DEFAULTS }, z0: 0.5 }

// Group E: the bus at its defaults, with the bank size as the knob.
{ bus: { ...BUS_DEFAULTS } }
```

## 6. What each lane pins

Every number in the plan's §4 for your groups becomes a `reads` pair or a
`claim` checked in `experiments.test.js`. The pins are functions of the knobs,
computed in the test from the parameters, and never constants typed in.

| Lane | Pins |
| --- | --- |
| 3, Group A | 5.0000 A, 0.632944 V and the closed form's 0.325 µV gap. 0.552926 V, 4.77793 A, 2.64184 W, 0.83478. The R_s numbers 0.531234 V, 2.5281 W, 0.79885 and 0.69314. The R_sh numbers 0.632286 V, 0.81635 and the −0.200000 S slope. 17.809 mV a halving and 59.159 mV a decade. 4.7231 K, −1.9087 mV/K and 0.389 % per kelvin |
| 3, Group B | 7.59533 V, 31.702 W, 0.83478 and 1.3887 Ω. The parallel ratio 3.0000 and 0.46290 Ω. Shaded: 2.8417 A, 10.306 W, 66.72 %. The hot spot: −15.885 V, 74.295 W, −9.8151 V. With the diode: 26.596 W, 158.1 %, −0.3839 V, and the two maxima at 7.2008 V and 5.7078 V |
| 4, Group C | 100 %, 56.58 % and 23.67 % for the fixed load. 24 steps, 31.5358 W and 99.476 %. The three step sizes: 13 and 5.216 %, 24 and 0.524 %, 94 and 0.041 %. The duties 0.400, 0.60004 and 0.800, with 17.512 W, 31.702 W and 19.531 W |
| 5, Group D | 3.8400 V, 3.8150 V and the 25.00 mV step. 3.80113 V at 30.00 s, 3.77370 V at 200.0 s, 50.00 mΩ. z at 0.33333. 56.335 J, 4478.45 J, 1.242 %, 60.00 J and the ratio 0.93892. 6579.71 J, 6910.67 J, 95.211 %. 1880.01 s, z 0.72222, then 1.0360 A and 70.228 mA |
| 5, Group E | 2476.7 W at hour 12, 2100 W at hour 18. 19.794 kWh, 19.120 kWh, 3.4329 kWh, 0.056002 kWh and a residual of zero. The half bank's 6.8689 kWh and 4.3129 kWh. The double bank's two zeros and z of 0.5314 |

## 7. Verify before every commit

```
npx vitest run                                   # the whole monorepo, from the root
npm run lint:prose                               # every word a reader sees
npm run build --workspace apps/energy-lab
npx vite preview --outDir apps/energy-lab/dist --port 418N --strictPort &
cd apps/energy-lab && APP_URL=http://localhost:418N node scripts/verify.mjs
```

The harness catches what unit tests cannot: a prop not passed, a pane fed stale
state, a plot that stopped redrawing. Extend it for every view you add.
Screenshot every view at 390 px and at 1280 by 900, and read the screenshots as
a student would, per `/REVIEW_PLAYBOOK.md` §11.

## 8. Gotchas this lab has already paid for

- **Cost.** Every curve point is a Newton solve. A tracker run is a bisection
  over them at every step. Memoise `power(v)` by voltage in lane 4, and keep
  test runs short and scans coarse. The plan's §10 says what a slow pane must
  do.
- **A refusal can be physics.** A string driven past its worst cell's
  photocurrent has no operating point in this model, and `newtonDC` says so.
  That is B3's lesson, not a bug to route around. Print the reason.
- **Tolerances are relative to the solution's scale**, never a fixed epsilon,
  as `solutionScale` in `pwl.js` puts it. This lab holds microamps and kilojoules
  at once.
- **Wherever two numbers are shown as equal**, ask what could make them differ
  silently, then remove the cause or print it. C5's two input currents are the
  example: the note prints both and their difference.
- **Labelled data stays labelled.** `OCV_FIT` and `DAY` are not physics. Any
  note that leans on either says so in the sentence that uses it.
- **The dark launch is enforced by a test.** While `RELEASE_STATUS` says
  `dark`, nothing outside `apps/energy-lab/` may mention the lab, and the
  release test fails when anything does.
