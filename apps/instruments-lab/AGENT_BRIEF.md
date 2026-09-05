# Instruments Lab: build brief

You are one of up to six agents building this lab in parallel. The plan is
`/INSTRUMENTS_LAB_PLAN.md`, and this brief turns it into lanes an agent can take
without colliding with another. Read the plan's §2 (engine), §3 (library) and your
group in §5 before writing a line. Reed reviews everything.

## Boundaries: read first

- **One lane per agent.** Edit only the files your lane owns (§1). Everything else is
  read-only. If you need a change outside your lane, write it into
  `apps/instruments-lab/NEEDS.md` under your lane's heading and continue with what you
  can do. The owning lane picks it up.
- **This lab owns no package.** `packages/network` has every element this lab needs
  (`R`, `C`, `L`, `V`, `I`, `SW`, `OPAMP`, `VCCS`). If you find something missing,
  write the contract into `NEEDS.md` and build what the existing engine allows. Do not
  edit `packages/*`, `site/`, `README.md`, `LabNav.jsx`, `deploy.yml`, or any other app.
- **Stage by path.** `git add apps/instruments-lab/src/groups/a.js`, never
  `git add -A` and never `commit -a`. Workers do not commit. The overseer commits.
- **Never push.** The director merges `lab/instruments-lab` and pushes.
- **Preview port.** Lane number plus 4320, so lane 3 previews on 4323.

## The house discipline

Read `/CORE_SCOPE.md`, `/STYLE.md` and `/REVIEW_PLAYBOOK.md` first. Then the rule every
lab obeys. **Every explanatory sentence is a claim about physics, and a test must
measure it.** A lesson quotes no number the solver does not produce. A claim the
settings cannot show is footnoted, never crossed out. On-screen text passes
`npm run lint:prose`.

Three rules this lab leans on harder than most.

1. **Exact mappings are never hedged.** A compensated probe is flat, not "nearly
   flat". A four-wire reading is `R_x·R_m/(R_x + R_s1 + R_m + R_s2)`, exactly. Write
   the number and its units, with no approximately.
2. **Every pin is a function of the knobs.** `R2/(R1+R2)` computed from `p`, never
   `0.1`. A constant typed into a test cannot notice a default moving under it.
3. **Tolerances are relative to the solution's scale.** This lab has 100 pA and 10 MΩ
   in one circuit. Compare against the largest quantity of its kind in that solve, the
   way `solutionScale` in `pwl.js` does. Never against a fixed epsilon.

Commit messages are narrative. Read `git log` for the register. Never put a model name
in a commit or a file.

## 1. The lanes

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | The app shell, dark | everything in `apps/instruments-lab/` not owned by a group lane: `App.jsx`, `main.jsx`, `styles.css`, `index.html`, `package.json`, `vite.config.js`, `RELEASE_STATUS`, `experiments.js`, `lessons.js`, `math.js`, `terms.js`, `course.js`, `format.js`, `report.js`, `components/`, `scripts/verify.mjs`, and every `*.test.js` | now | the shell loads the stub of §3.6 at 390 px, `release.test.js` passes dark |
| 2 | Group A, the scope input and the probe | `src/groups/a.js`, `src/lessons/a.js` | after the gate | A1 to A6 pinned, invariants 1 to 4 green |
| 3 | Group C, the multimeter | `src/groups/c.js`, `src/lessons/c.js` | after the gate | C1 to C5 pinned |
| 4 | Group D, the spectrum analyser | `src/groups/d.js`, `src/lessons/d.js` | after the gate | D1 to D4 pinned, invariants 6 and 7 green |
| 5 | Group E, the lock-in | `src/groups/e.js`, `src/lessons/e.js` | after the gate | E1 to E4 pinned, invariant 8 green |
| 6 | Group F, uncertainty, and Group B, the sampler | `src/groups/f.js`, `src/groups/b.js`, `src/lessons/f.js`, `src/lessons/b.js`, `components/ErrorBarCanvas.jsx`, `components/ContribCanvas.jsx` | Group B after lane 2, Group F after lane 3 | B1, B2, F1 to F4 pinned, invariant 5 green |

**The gate.** No group lane starts until lane 1's exit is met and its skeleton is
committed. The skeleton is what every group writes against, and a group written against
a moving shell is a group written twice.

**Shared seams, landed first.** Lane 1's first commit adds the skeleton, the stub
experiment, `RELEASE_STATUS` and `release.test.js`. Its second adds `math.js` with the
five analysis paths of §4 and the empty group files, so a group lane's first edit is
additive. Every other lane starts from those two commits.

## 2. The app skeleton (lane 1)

Copy Circuit Elements Lab's shape, file for file, and delete what this lab does not
need. Elements has nine views and this lab has seven, five of them Elements' own.

```
apps/instruments-lab/
  index.html  package.json  vite.config.js  RELEASE_STATUS (dark)
  AGENT_BRIEF.md  NEEDS.md
  scripts/verify.mjs
  src/App.jsx  main.jsx  styles.css
  src/experiments.js      merges groups/*.js in plan order, no prose
  src/lessons.js          merges lessons/*.js, and readQuantity
  src/groups/{a,b,c,d,e,f}.js    one file per group, owned by that group's lane
  src/lessons/{a,b,c,d,e,f}.js   the see / try / why registers, same owner
  src/course.js           the group intros and the builds-on thread
  src/math.js             the math-panel rows, and analyse()
  src/terms.js            definitions on contact, one registry
  src/format.js  report.js
  src/components/  ScopeCanvas, FreqCanvas, ErrorBarCanvas, ContribCanvas, panes.jsx
  src/experiments.test.js  lessons.test.js  prose.test.js  release.test.js
  src/course.test.js  glossary.test.js  terms.test.js
```

What to delete from Elements' copy: `IVCanvas`, `DampingCanvas`, `EnergyCanvas`,
`PhasorCanvas`, `SweepCanvas`, `theorems.js`, `predict.js`, `sittings.js`,
`reference.js`, and the `assumed`, `iv`, `superposition`, `thevenin`, `equivalent`,
`damping`, `energy`, `acpower` views. What to keep unchanged: `Schematic` from
`packages/ui`, `MathPanel` from `packages/explain`, `progress.js`, `glossary.js`,
`headlines.js`, `layoutCheck.js`, `marks.js`, `captions.js`, `palette.js`.

`experiments.test.js` is Elements' file with §4's paths added and the eight invariants
of the plan's §2.7 as one describe block. Copy it, do not rewrite it.

## 3. Contracts

Every signature below is a promise between lanes. A lane may add to its return shape,
never rename or remove. Each contract names the failing test beside it.

### 3.1 The experiment shape (lane 1, `experiments.js`)

Elements' shape, with two fields added and one dropped.

```js
{
  id: 'a3',                       // group letter plus index, lower case
  group: GROUPS[0],               // 'A · The oscilloscope’s input'
  instrument: 'scope',            // NEW: which instrument's chrome the topbar shows
  terms: ['inputz', 'probe'],     // ids in terms.js, introduced here
  params: [ ... ],                // NumField descriptors, Elements' helpers
  net: (p) => ({ elements: [...] }),
  layout: { w, h, items: [...] }, // Elements' 420 × 180 grid idiom
  window: (p) => seconds,         // dynamic experiments only
  cursor: 0.8,                    // fraction of the window the meters read at
  samples: (p) => ({ rate: p.fs }),  // NEW: draws sample dots on the scope view
  scope: { left: {...}, right: {...} },
  sweep: (p) => ({ from, to, of: (ac, w) => complex }),  // the Bode/impedance view
  show: 'v',                      // 'i' | 'v' | 'p'
  view: 'bode',
  views: ['reading', 'equations', 'scope', 'bode', 'impedance', 'errorbar', 'contrib'],
  claim: { flat: true },          // which math-panel block this experiment gets
}
```

Dropped from Elements: `port`, `sweepId`, `ghost`, `phasor`, `circuitLab`, `out`.

Test: `experiments.test.js` has two cases here. "Has a unique id, a group from the
list, knobs, a layout and views." And "draws every element it solves, and solves every
element it draws".

### 3.2 The library netlists (every group lane)

Node names are fixed. A `reads` path names a node, so a lane that renames one breaks
another lane's lesson. Values are the plan's §4.3.

```js
// A1, A6: the scope input alone, driven through a source resistance
[{ type: 'V', id: 'V1', nodes: ['src', 'gnd'], value: 0, wave },
 { type: 'R', id: 'Rs', nodes: ['src', 'in'], value: p.Rs },
 { type: 'R', id: 'R2', nodes: ['in', 'gnd'], value: p.R2 },
 { type: 'C', id: 'C2', nodes: ['in', 'gnd'], value: p.C2 }]
// A1 drives the input with a current source instead, to read |Z_in| directly:
// { type: 'I', id: 'I1', nodes: ['gnd', 'in'], value: 0, wave: sine(1 A) }

// A3, A4, A5: the 10× probe in front of the scope input.
// `cal` is the calibrator's own node and `Rcal` its output resistance. Without
// Rcal the two capacitors and the ideal source form a loop with no resistance
// in it, and `transient` declines the circuit with the reason (dynamics.js).
[{ type: 'V', id: 'V1', nodes: ['cal', 'gnd'], value: 0, wave },
 { type: 'R', id: 'Rcal', nodes: ['cal', 'tip'], value: p.Rcal },
 { type: 'R', id: 'R1', nodes: ['tip', 'in'], value: p.R1 },
 { type: 'C', id: 'C1', nodes: ['tip', 'in'], value: p.C1 },
 { type: 'R', id: 'R2', nodes: ['in', 'gnd'], value: p.R2 },
 { type: 'C', id: 'C2', nodes: ['in', 'gnd'], value: p.C2 }]
// A5 replaces Rcal by Rs = 100 kΩ and names its node `src` rather than `cal`.

// B1: the front end of A2, with `samples: (p) => ({ rate: p.fs })`
// B2: the bandwidth limit in front of the scope input
[{ type: 'V', id: 'V1', nodes: ['src', 'gnd'], value: 0, wave: sine(p.f) },
 { type: 'R', id: 'Rb', nodes: ['src', 'in'], value: p.Rb },
 { type: 'C', id: 'Cb', nodes: ['in', 'gnd'], value: p.Cb }]

// C1: a divider with a voltmeter across its lower leg
[{ type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
 { type: 'R', id: 'R1', nodes: ['in', 'out'], value: p.R1 },
 { type: 'R', id: 'R2', nodes: ['out', 'gnd'], value: p.R2 },
 { type: 'R', id: 'Rm', nodes: ['out', 'gnd'], value: p.Rm }]

// C2: the DMM front end. Rtop + Rbot = 10 MΩ on every range.
[{ type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
 { type: 'R', id: 'Rtop', nodes: ['in', 'tap'], value: p.Rtop },
 { type: 'R', id: 'Rbot', nodes: ['tap', 'gnd'], value: p.Rbot },
 { type: 'OPAMP', id: 'U1', nodes: ['adc'], ctrl: ['tap', 'adc'] },   // the buffer
 { type: 'R', id: 'Radc', nodes: ['adc', 'gnd'], value: p.Radc }]
// with the buffer toggled off, Radc hangs on `tap` and U1 is not in the netlist

// C3: the ammeter's shunt in the loop
[{ type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
 { type: 'R', id: 'RL', nodes: ['in', 'sh'], value: p.RL },
 { type: 'R', id: 'Rsh', nodes: ['sh', 'gnd'], value: p.Rsh }]

// C4: two-wire.  C5: four-wire. `a` and `b` are the resistor's own terminals.
[{ type: 'I', id: 'I1', nodes: ['gnd', 'f1'], value: p.Itest },
 { type: 'R', id: 'Rl1', nodes: ['f1', 'a'], value: p.Rlead },
 { type: 'R', id: 'Rx', nodes: ['a', 'b'], value: p.Rx },
 { type: 'R', id: 'Rl2', nodes: ['b', 'gnd'], value: p.Rlead },
 { type: 'R', id: 'Rm', nodes: ['f1', 'gnd'], value: p.Rm }]
[{ type: 'I', id: 'I1', nodes: ['gnd', 'f1'], value: p.Itest },
 { type: 'R', id: 'Rf1', nodes: ['f1', 'a'], value: p.Rlead },
 { type: 'R', id: 'Rx', nodes: ['a', 'b'], value: p.Rx },
 { type: 'R', id: 'Rf2', nodes: ['b', 'gnd'], value: p.Rlead },
 { type: 'R', id: 'Rs1', nodes: ['a', 's1'], value: p.Rlead },
 { type: 'R', id: 'Rs2', nodes: ['b', 's2'], value: p.Rlead },
 { type: 'R', id: 'Rm', nodes: ['s1', 's2'], value: p.Rm }]

// D1 to D4: the resolution-bandwidth filter, one tone
[{ type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: 0, wave: sine(p.A, p.f) },
 { type: 'L', id: 'L1', nodes: ['in', 'n1'], value: p.L },
 { type: 'C', id: 'C1', nodes: ['n1', 'out'], value: p.C },
 { type: 'R', id: 'R1', nodes: ['out', 'gnd'], value: p.R }]
// D3 puts a second source in series ahead of it, at node `m1`:
// { type: 'V', id: 'V1', nodes: ['in', 'm1'], wave: sine(p.A, p.fa) },
// { type: 'V', id: 'V2', nodes: ['m1', 'gnd'], wave: sine(p.A, p.fb) },

// E1 to E4: the lock-in. `prod` carries the mixer's output, `out` the reading.
// M = p.A * p.Vr / (2 * VU).  The difference term is a step when f_s = f_r.
[ fd === 0
    ? { type: 'V', id: 'Vd', nodes: ['p1', 'gnd'], value: 0,
        wave: { kind: 'step', from: 0, to: M * Math.cos(phi) } }
    : { type: 'V', id: 'Vd', nodes: ['p1', 'gnd'], value: 0,
        wave: { kind: 'sine', amp: M, freq: fd, phase: sign * phi + Math.PI / 2 } },
  { type: 'V', id: 'Vs', nodes: ['prod', 'p1'], value: 0,
    wave: { kind: 'sine', amp: M, freq: p.fs + p.fr, phase: phi + Math.PI / 2 + Math.PI } },
  { type: 'VCCS', id: 'G1', nodes: ['gnd', 'out'], ctrl: ['prod', 'gnd'], gain: p.gm },
  { type: 'R', id: 'Rf', nodes: ['out', 'gnd'], value: p.Rf },
  { type: 'C', id: 'Cf', nodes: ['out', 'gnd'], value: p.Cf }]
// `sign` is +1 when f_s ≥ f_r and −1 below, so the difference term keeps its phase.
// VCCS delivers its current at nodes[1], so v_out = +g_m · v_prod · (R_f ∥ Z_C).

// F1, F2, F4: C1's circuit again, with the meter's counts as knobs
// F3: the bare divider, no meter
[{ type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
 { type: 'R', id: 'R1', nodes: ['in', 'out'], value: p.R1 },
 { type: 'R', id: 'R2', nodes: ['out', 'gnd'], value: p.R2 }]
```

### 3.3 The analysis (lane 1, `math.js`)

```js
/**
 * Everything the panes and the lessons read, for one experiment at one setting.
 * Elements' `analyse` with four additions and the theorem machinery removed.
 *
 * @returns {{
 *   net, sol, refusal,          // as Elements: the netlist, the readout, the reason
 *   tr, tEnd, cursor, now,      // dynamic experiments: the exact transient
 *   ac, omega,                  // sine-driven: the phasor solve at the drive
 *   freq,                       // { omega[], value[] } from exp.sweep, or null
 *   samples,                    // NEW: { rate, t: Float64Array, y: Float64Array } or null
 *   detector,                   // NEW: { mean, rms } of the output over the last window
 *   meter,                      // NEW: { true, read, shown, step, spec, error } or null
 *   sens,                       // NEW: [{ key, s, tol, part }] for the contributions view
 * }}
 */
export function analyse(exp, p, cursor)
```

`samples` is computed only when `exp.samples` is given, from `tr.at(k / rate)`, so the
dots are the exact solution and never an interpolation. `detector` uses `meanRms` over
the last whole period of the slowest component in the window, and the experiment says
which by `exp.detect = (p) => seconds`. `meter` and `sens` are pure arithmetic over the
solve, defined in §3.4 and §3.5.

Test: `experiments.test.js` "every experiment has an analysis whose every check row
agrees, at the defaults and at 25 random settings".

### 3.4 The meter (lane 6, in `math.js` under lane 1's review)

```js
/**
 * What a meter of `counts` counts on a `fullScale` range shows for a true value,
 * and the accuracy its specification claims. All exact arithmetic.
 *
 * step  = fullScale / (counts + 1)
 * shown = Math.round(read / step) * step
 * spec  = pctOfReading / 100 * Math.abs(shown) + countsTerm * step
 */
export function meterOf(read, { counts, fullScale, pctOfReading, countsTerm })
//   -> { step, shown, spec, halfCount: step / 2, pct: 100 * spec / Math.abs(shown) }
```

Test: `lessons.test.js` case "a meter shows the reading rounded to its count, and
half a count is its resolution". It runs the three meters of F1 at four readings each.

### 3.5 Sensitivities (lane 6)

```js
/**
 * The logarithmic sensitivity of a readout to each knob, ∂ln y / ∂ln x, from a
 * central difference on the solver at ±h (h = 1e-6 relative), against the closed
 * form the lesson states. `tol` is the knob's stated tolerance in per cent.
 *
 * quad  = Math.hypot(...parts)         // independent, in quadrature
 * worst = parts.reduce((s, q) => s + Math.abs(q), 0)
 */
export function sensitivities(exp, p, read, knobs)
//   -> { rows: [{ key, s, tol, part }], quad, worst }
```

The linear prediction is an approximation and carries its guard, per the plan's §2.5.
The row prints the exact re-solve beside it and turns amber past 10 % on a knob.

Test: `experiments.test.js` "every sensitivity agrees with a re-solve at ±1 % to the
second order the panel prints".

### 3.6 The stub lane 2 to 6 build against

Lane 1's first commit ships one experiment so the shell has something to load. It is
A1's circuit with a placeholder lesson, id `a1`, and it is replaced by lane 2.

```js
export const STUB = {
  id: 'a1', group: 'A · The oscilloscope’s input', instrument: 'scope',
  terms: [], params: [R('R2', 'R_in', 1e6), Cap('C2', 'C_in', 15e-12), Freq('f', 'Frequency', 1000)],
  net: (p) => ({ elements: [
    { type: 'I', id: 'I1', nodes: ['gnd', 'in'], value: 0, wave: { kind: 'sine', amp: 1, freq: p.f } },
    { type: 'R', id: 'R2', nodes: ['in', 'gnd'], value: p.R2 },
    { type: 'C', id: 'C2', nodes: ['in', 'gnd'], value: p.C2 },
  ] }),
  show: 'v', view: 'reading', views: ['reading', 'equations'], claim: {},
}
```

## 4. The lesson schema, and the new quantity paths

Copy Elements' `lessons.js` header comment and its three registers. They are `see`
(≤ 70 words), `try` (each step ≤ 45 words, with `set`, `at`, `reads`) and `why`
(≤ 160 words). A step's `set` is applied over the defaults, its `at` moves the cursor,
and each `reads` pair is a quantity path with the value the sentence quotes.

Elements' paths carry over: `v.<node>`, `volt.<id>`, `i.<id>`, `p.<id>`, `vd.<a>.<b>`,
`state.tau`, `mag.<q>.<id>`, `deg.<q>.<id>`, `omega`, `period`, `H.<mag|db|deg>`,
`Z.<mag|deg>`. Nine paths are new to this lab.

```
zin.<mag|deg>                    the input impedance at the drive frequency, ohms
corner                           the −3 dB frequency of exp.sweep, hertz
ratio.<dc|hf>                    a divider's low- and high-frequency magnitude
risetime                         10 % to 90 % of the exact step, seconds
alias                            |f_sig − m·f_s| for the sample rate on the knob, hertz
detect.<mean|rms>                the detector's reading over exp.detect(p), volts
rbw  fzero  qfactor              the filter's bandwidth, centre and Q, from the sweep
meter.<true|read|shown|step|spec|pct|error>   §3.4, in the reading's own units
sens.<key>  sens.<quad|worst>    §3.5, per cent
```

`experiments.test.js` resolves every path against the analysis and fails on a path it
cannot resolve, as Elements' does.

## 5. What each lane pins

Every number in the plan's §5 for your group becomes a `reads` pair or a `claim` checked
in `experiments.test.js`. The pins are functions of the knobs, computed in the test from
the parameters, never constants typed in.

| Lane | Pins |
| --- | --- |
| 2, Group A | `τ = 15 µs` and `f₃ = 10.61 kHz`. `|Z_in|` 707 kΩ at the corner, 10.61 kΩ at 1 MHz. 0.9091 and 116.7 kHz through 100 kΩ. `C1 = 1.667 pF` flat at 0.1 to 1e-12 across nine frequencies. Edges at 6.25 % and 16.67 %, τ of 14.4 µs and 16.2 µs, overshoot 66.6 %. Probe input 10 MΩ and 1.5 pF. 0.09901 and 1.072 MHz, a bandwidth ratio of 9.18. `t_r = 2.996 µs` and `t_r·f₃ = 0.3497` |
| 3, Group C | 4.7619 V against 5 V, low 4.762 %, `R_th = 500 kΩ`, and 0.050 % on a 10 kΩ divider. Ratios 0.1, 0.01, 0.001 with 10 MΩ input on each, and 0.1820 V unbuffered, 9.008 % low. 98.04 mA and 98.04 mV, 99.80 mA and 9.98 mV, 10 mΩ and 1 W. 1.2 Ω, 20 % high. 0.99999988 Ω, 100 pA down a sense lead |
| 4, Group D | `f₀ = 10.000 kHz`, `Q = 100`, −3 dB at 9950.1 and 10050.1 Hz, width 100 Hz, `√(f₁f₂) = f₀`. −3.00 dB at 50 Hz off, −12.22 dB at 200 Hz off, and a ten times wider line at 1 kHz. 0.7280 and 0.4472 against 0.9655 and 0.9806, a 4.24 dB dip. `τ = 3.183 ms`, 90 % at 7.33 ms, 63.7 ms for a 2 kHz span |
| 5, Group E | `M = 5.000 mV`, ripple 794 µV peak to peak, product identity to 1e-15. `τ` 1 ms and 10 ms, ripple ±397 µV and ±39.8 µV, ENBW 250 Hz and 25 Hz, `ENBW/f₃ = π/2`. 5.000, 2.500, 0 and −5.000 mV at 0°, 60°, 90° and 180°. 200 Hz difference, `|H| = 0.6227`, swing ±3.113 mV, 5 ms beat, sum term 361 µV |
| 6, Groups B and F | Alias 1 kHz from 9 kHz at 10 kSa/s, two sequences to 1e-14, 4 kHz its own representative. 0.9701 and 0.2060, 40 dB at 2.000 MHz. Counts 10 mV and 1 mV, shows 4.76 V and 4.762 V, ±0.105 % and ±0.0105 %. 23.8 mV plus 20 mV is 43.8 mV, 0.920 %, and 5.43 times smaller than the loading error. Sensitivities −0.5 and +0.5, quadrature 0.707 %, worst 1.000 %, common shift 0 to 1e-12. 128.7 nV/√Hz, 16.67 kHz, 16.62 µV |

## 6. The gate, restated

Lane 1's exit is the gate for every other lane.

1. `apps/instruments-lab` builds. `npm run build --workspace apps/instruments-lab`.
2. The shell loads the stub at 390 px with no horizontal scroll.
3. `release.test.js` passes with `RELEASE_STATUS` reading `dark`.
4. `experiments.js`, `lessons.js`, `math.js` and `terms.js` export the names of §3
   and §4. The six group files exist and export an empty array.
5. `npx vitest run` is green from the repo root.

A group lane that starts before all five hold will write against a shell that moves.

## 7. Verify before handing back

```
npx vitest run                                   # the whole monorepo, from the root
npm run lint:prose                               # every word a reader sees
npm run build --workspace apps/instruments-lab
npx vite preview --outDir apps/instruments-lab/dist --port 432N --strictPort &
cd apps/instruments-lab && APP_URL=http://localhost:432N node scripts/verify.mjs
```

The harness catches what unit tests cannot: a prop not passed, a pane fed stale state,
a plot that stopped redrawing. Extend it for every view you add. Screenshot every view
at 390 px and at 1280 × 900 and read the screenshots as a student would, per
`/REVIEW_PLAYBOOK.md` §11.

## 8. Gotchas this lab has already paid for

- **Two capacitors and an ideal source in one loop have no state space.** The probe
  divider needs the calibrator's output resistance, and `transient` gives the reason
  when it is missing. The AC solve does not need it, so A3 sweeps an ideal source and
  A4 adds `Rcal` for the square wave. Keep them as two experiments.
- **`sweepAC` reads only sine sources.** A source carrying a square or a step reads as
  the phasor zero at every frequency, so a Bode view of a square-driven experiment
  draws a flat zero and no test notices. Every experiment with a `sweep` carries a sine.
- **A sine source is switched on at t = 0.** So a transient carries a natural response.
  At the analyser's Q of 100 that response lasts 3.2 ms, which is longer than most
  windows. Measure late, and say in the lesson which part of the window is being read.
- **The cursor lands where it lands.** The lock-in's output at 10 ms sits on a ripple
  trough at 4.968 mV, not on its 5.000 mV mean. Quote the detector's mean for a DC
  claim and the instantaneous value for a ripple claim, and never one for the other.
- **The engineering-notation field reads a bare number in the displayed prefix.**
  Harness code types explicit prefixes ("15p", "9M", "25.3303n").
- **Write TeX with editor tools, never through a shell heredoc.** Add the lost-backslash
  guard test Signal Lab has.
- **A test that fails may be the test.** Decide which, and say which in the commit.
- **The dark launch is enforced by a test.** While `RELEASE_STATUS` says `dark`,
  nothing outside `apps/instruments-lab/` may mention the lab.
