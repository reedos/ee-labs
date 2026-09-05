# Electronics Lab: build brief

You are one of up to seven agents building this lab in parallel. The plan is
`/ELECTRONICS_LAB_PLAN.md`, and this brief turns it into lanes an agent can take
without colliding with another. Read the plan's §2 (engine) and §5 (curriculum) for
your lane before writing a line. Reed reviews everything.

## Boundaries: read first

- **One lane per agent, one clone per agent.** Clone the repo into a directory named
  for your lane (`~/projects/ee-labs-lane-3`), set the remote and the author as the
  other briefs describe, and `npm ci`. Never work in the shared checkout.
- **Edit only the files your lane owns** (§1). Everything else is read-only. If you
  need a change outside your lane, write it into `apps/electronics-lab/NEEDS.md`
  under your lane's heading, commit that, and continue with what you can do. The
  owning lane picks it up.
- **Stage by path.** `git add packages/network/src/bjt.js`, never `git add -A` and
  never `commit -a`.
- Work on `master`. `git pull --rebase` before every push. Never rewrite pushed
  history. Every push deploys, and this lab deploys dark at `/electronics-lab/` from
  lane 6's first commit, so push only when the whole suite is green.
- **Preview port.** Lane number plus 4310, so lane 3 previews on 4313. Other labs use
  4300 to 4305.

## The house discipline (non-negotiable)

Read `/CORE_SCOPE.md`, `/STYLE.md` and `/REVIEW_PLAYBOOK.md` first. Then the rule
every lab obeys: **every explanatory sentence is a claim about physics, and a test
must measure it.** A lesson quotes no number the solver does not produce. A
prediction follows every control that can change it. A claim the settings cannot
show is footnoted, never crossed out. On-screen text passes `npm run lint:prose`.

Commit messages are narrative: what changed, why, and what fell out. Read `git log`
for the register. Never put a model name in a commit or a file.

## 1. The lanes

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | The transistor engine | `packages/network/src/{bjt,mosfet,companion,smallSignal,transfer,loop}.js` and their tests, plus the edits to `netlist.js`, `mna.js`, `pwl.js`, `index.js` | now | invariants 1 to 8 fuzzed green, contracts in §3 met |
| 2 | The op-amp macro, then Group A | `packages/network/src/macro.js` and test, `apps/electronics-lab/src/groups/a.js`, `lessons/a.js` | now | invariant 7 green, A1 to A6 pinned |
| 3 | The junction, then Group C | `packages/network/src/junction.js` and test, `apps/electronics-lab/src/groups/c.js`, `lessons/c.js`, `components/JunctionCanvas.jsx` | now | C1 to C4 pinned |
| 4 | Group B, as Elements I9 and I10 | `apps/circuit-elements-lab/src/experiments.js` and `lessons.js`, Group I entries only | now | I9 and I10 pinned in the Elements tests |
| 5 | The two seams | Elements H7 in the same two files, and one Circuit Lab lesson in `apps/circuit-lab/src/lessons.js` and `circuits.js` | now | both pinned in their labs' tests |
| 6 | The app shell | everything in `apps/electronics-lab/` not owned by lanes 2 and 3, `RELEASE_STATUS`, `release.test.js`, `scripts/verify.mjs`, and the DC/AC overlay in `packages/ui/src/Schematic.jsx` | now, against §3's stub | the shell loads a stub experiment at 390 px, the release test passes dark |
| 7 | The progression test | `packages/ui/src/progression.test.js` | now | every id and count in `/CURRICULUM.md` checked |

**The gate.** Groups D to O need lane 1. No agent starts a group past C until lane 1's
exit is met and its contracts are merged. After the gate, groups split two per agent
in plan order: D and E, F and G, H and I, J and K, L and M, N and O. Each of those
lanes owns `groups/<letter>.js`, `lessons/<letter>.js` and any canvas it adds.

**Shared seams, landed first.** Lane 1's first commit, before anything else, adds the
`Q` and `M` entries to `KINDS`, the per-kind node count in `normalize`, and the
`macros` hook that lane 2 fills. Lane 6's first commit adds the app skeleton and the
`RELEASE_STATUS` test. Every other lane rebases onto those two commits before it
pushes.

## 2. The app skeleton (lane 6)

Copy Circuit Elements Lab's shape, file for file, and delete what it does not need:

```
apps/electronics-lab/
  index.html  package.json  vite.config.js  RELEASE_STATUS (dark)
  scripts/verify.mjs
  src/App.jsx  main.jsx  styles.css
  src/experiments.js      merges groups/*.js in plan order, no prose
  src/lessons.js          merges lessons/*.js
  src/groups/{a..o}.js    one file per group, owned by that group's lane
  src/lessons/{a..o}.js   the see / try / why registers, same owner
  src/terms.js            definitions on contact, one registry
  src/math.js             the math-panel rows
  src/report.js           the issue link's summary
  src/release.test.js  experiments.test.js  prose.test.js  terms.test.js
  src/components/         ScopeCanvas, CurvesCanvas, TransferCanvas, BodeCanvas,
                          PZCanvas, LoopCanvas, SpectrumCanvas, NoiseCanvas,
                          JunctionCanvas, panes.jsx
```

`experiments.test.js` is Elements' file with the paths of §4 added. Copy it, do not
rewrite it. The overlay toggle (`show: 'dc' | 'ac' | 'both'`) is the one addition to
`Schematic.jsx`, and it renders the `meters` it is given. What an AC meter reads is
set in the app, not in the renderer.

## 3. Contracts

Every signature below is a promise between lanes. A lane may add to its return
shape, never rename or remove. Each contract ships with the failing test named
beside it, written before the implementation.

### 3.1 Elements (lane 1, in `netlist.js`)

```js
// KINDS gains two entries. Node order is fixed and is the datasheet's.
Q: { name: 'BJT', unknownCurrent: false, nodes: 3 },      // [collector, base, emitter]
M: { name: 'MOSFET', unknownCurrent: false, nodes: 3 },   // [drain, gate, source]

// A BJT element, defaults filled by bjtOf(e) as diodeOf does.
{ type: 'Q', id: 'Q1', nodes: ['c', 'b', 'e'],
  polarity: 'npn',          // or 'pnp'
  model: 'regions',         // 'regions' (three-region, PWL) or 'exp' (Ebers–Moll transport)
  beta: 100, br: 1,         // β_F, β_R
  is: 1e-14, n: 1, va: 100, // exponential model. va: Early voltage, Infinity allowed
  vbe: 0.7, vcesat: 0.2,    // three-region model
  cpi: 0, cmu: 0 }          // small-signal capacitances, farads, 0 = off

// A MOSFET element.
{ type: 'M', id: 'M1', nodes: ['d', 'g', 's'],
  polarity: 'n',            // or 'p'
  model: 'square',          // 'square' (three regions, Newton) or 'switch' (R_on, PWL)
  vt: 0.7, kn: 20e-3, lambda: 0.02,
  ron: 1,                   // switch model only
  cgs: 0, cgd: 0 }
```

Test: `bjt.test.js` and `mosfet.test.js` check every default, every validation
message, and each model's law at ten hand-computed points.

### 3.2 The companion interface (lane 1, `companion.js`, used by `pwl.js`)

```js
/**
 * A nonlinear element's tangent at the controlling voltages `v`.
 * `v` is keyed by the element's own names: a diode { v }, a BJT { vbe, vbc },
 * a MOSFET { vgs, vds }. Every entry stamps a linear element into the same
 * solve, and `region` is what the view prints.
 *
 * @returns {{
 *   g:  Array<[nodeA, nodeB, siemens]>,                 // conductances
 *   gm: Array<[outA, outB, ctrlA, ctrlB, siemens]>,     // transconductances (VCCS)
 *   i:  Array<[nodeA, nodeB, amps]>,                    // current sources, A into nodeA
 *   region: string,                                     // 'active', 'saturation', 'cutoff', 'triode', ...
 *   limit: (vNew, vOld) => vLimited                     // junction limiting, pnjlim for junctions
 * }}
 */
export function companion(element, v)
```

`newtonDC` becomes general. It collects every element with a companion and iterates.
Each pass reads the controlling voltages back from `sol.v`, applies `limit`, and stops
on the existing tolerance. Every iteration is kept in `iters` exactly as today. Add
`sourceStepping: true` in `opts`. It ramps every independent source from zero in ten
steps when the direct solve fails to converge, and records which steps it took. Add
`opts.regions` for the PWL BJT and the switch MOSFET, so `assumedState` and
`pwlTransient` work unchanged.

Test: `companion.test.js` compares every `g` and `gm` against a central finite
difference of the element's law at twenty random points, to 10⁻⁶ relative. The
existing diode tests must pass untouched.

### 3.3 The small-signal netlist (lane 1, `smallSignal.js`)

```js
/**
 * The linear netlist tangent to `net` at its operating point.
 * @param net   a netlist with Q, M, D and OPAMP elements
 * @param op    the result of newtonDC(net) (or solveDC for a PWL-only net)
 * @param opts  { caps: true } to include cpi, cmu, cgs, cgd
 * @returns {{
 *   elements: Array<Element>,     // R, C, VCCS, V(0) wires, I sources removed: a plain netlist
 *   point: { [id]: { ic, vce, vbe, region, gm, rpi, ro } | { id_, vds, vgs, region, gm, ro } },
 *   label: string                 // "(V_CE = 5.00 V, I_C = 1.00 mA)" for the topbar
 * }}
 */
export function smallSignal(net, op, opts = {})
```

Test: for the CE stage of §5 at the defaults, the returned elements equal a hand
hybrid-π (`r_π = 2585.2 Ω`, `g_m = 38.682 mA/V`, `r_o = 100 kΩ`). `solveAC` on it
gives −184.2 at 1 kHz.

### 3.4 Exact transfer functions (lane 1, `transfer.js`)

```js
/**
 * H(s) from `input` (a V or I source id) to `output` (a node name, or
 * { across: [a, b] }, or { through: id }) as polynomials in systems' form.
 * @returns {{ b: number[], a: number[], states: string[], check: number }}
 *   b, a highest power first, a[0] = 1. `check` is the largest relative
 *   disagreement between evalAt(jω) and solveAC over 241 points from
 *   ω = 1 to 10⁹ rad/s. Throws NetworkError('transfer-conditioning') with
 *   the reason when check > 1e-9.
 */
export function transferOf(net, { input, output })
```

Test: RC low-pass gives `{ b: [1/RC], a: [1, 1/RC] }` exactly. Series RLC across C
gives the hand polynomial. The CE stage with `C_π = 20 pF`, `C_μ = 2 pF`, `R_s =
1 kΩ` gives poles at 547.76 kHz and 336.69 MHz and a zero at 3.0782 GHz, to five
figures.

### 3.5 Loop gain (lane 1, `loop.js`)

```js
/**
 * The return ratio of one dependent source, and Blackman's decomposition.
 * @param source  the id of a VCCS or VCVS in a small-signal netlist
 * @returns {{ T: TF, Ainf: TF, d: TF, closed: TF }}   // each { b, a }, closed = Ainf·T/(1+T) + d
 */
export function returnRatio(net, source, { input, output })
export function returnRatioAt(net, source, omega)      // complex [re, im], one frequency, no polynomials
```

Test: the non-inverting op-amp with `A = 10⁵`, `β = 0.1` gives `T = 10⁴` and
`closed = 9.9990` to floating point against a direct solve. A three-pole loop gives
the same margins through `@ee-labs/systems` `margins(T)` as Control Lab computes for
the same `plant=custom` link.

### 3.6 The op-amp macro (lane 2, `macro.js`)

```js
// The existing OPAMP element gains optional fields. Any of gbw, slew, vos, ib,
// cmrr, imax present means the element expands at normalize into:
//   V(vos) in series with the + input
//   I(ib) into each input
//   VCCS(g) from (p − n) into node `${id}.int`
//   R(rint) and C(cint) from `${id}.int` to ground, rint = 1e6, cint = 1/(2π f_p rint)
//   VCVS(1) from `${id}.int` to the output, with rails and rout as today
// with A₀ = g·rint, f_p = gbw / A₀, and the VCCS current-limited at ±slew·cint.
{ type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['p', 'n'],
  gain: 1e5, vsat: 12, rout: 75,
  gbw: 1e6, slew: 0.5e6, vos: 1e-3, ib: 100e-9, cmrr: 90, imax: 25e-3 }

/** Expand every macro element in place. Called once from normalize. */
export function expandMacros(elements)
```

Test (invariant 7): with `gbw`, `slew` and the rest absent the expansion is the
identity and `solveDC` gives Elements E2's numbers to floating point. With `gbw =
1e6` the closed-loop pole at gain 11 is 90.909 kHz from `transferOf` (lane 1) or
from `solveAC` at −3 dB (before lane 1 lands). The 10 V step under `slew` is a ramp
of exactly `0.5 V/µs` from `pwlTransient`.

### 3.7 The junction (lane 3, `junction.js`)

```js
export const N_I_300 = 1.5e16          // m⁻³, silicon at 300 K
export function builtIn({ na, nd, T })            // V_0 = V_T ln(N_A N_D / n_i²)
export function depletionWidth({ na, nd, T }, v)  // metres, and the split each side
export function junctionCap({ cj0, v0, m = 0.5 }, v) // C_j0 / (1 − v/V_0)^m, refuses v ≥ V_0
export function diffusionCap({ tauF }, gm)        // τ_F g_m
export function isAt({ is, T0 = 300, eg = 1.12, xti = 3 }, T)  // SPICE's law
export function vbeSlope({ vbe, eg = 1.12 }, T)   // dV_BE/dT at fixed current, V/K
```

Test: `V_0 = 752.88 mV` at the plan's doping. `C_j` is 0.7235 pF at −5 V and 3.451 pF
at +0.5 V from 2 pF. `C_d = 19.341 pF` at 1 mA with `τ_F = 0.5 ns`. `I_S` doubles
every 4.503 K. The slope is −1.6585 mV/K at 0.7 V and −1.9919 mV/K at 0.6 V.

### 3.8 The stub lane 6 builds against

Until lane 1 lands, lane 6 imports `apps/electronics-lab/src/stub.js`. It exports
`smallSignal`, `transferOf` and `newtonDC`, each returning the CE stage's hand numbers
as constants in the shapes above. The stub is deleted in the commit that switches the
imports to `@ee-labs/network`. `experiments.test.js` fails if it is ever imported
after that.

## 4. The lesson schema, and the new quantity paths

Copy Elements' `lessons.js` header comment and its three registers. They are `see`
(≤ 70 words), `try` (each step ≤ 45 words, with `set`, `at`, `reads`) and `why`
(≤ 160 words). An experiment entry is Elements' shape: `id`, `group`, `name`,
`terms`, `params`, `net`, `layout`, `show`, `view`, `views`, `claim`. Two fields are
new. `model` is the device model the experiment opens with. `small` is the id of the
AC source the amplitude guard watches.

Quantity paths a `reads` pair may name, added to Elements' list:

```
op.<id>.<ic|ib|vce|vbe|id_|vds|vgs|region|gm|rpi|ro>   the operating point and its tangent
ss.<gain|rin|rout>                                   by test source, at the experiment's ports
H.<mag|db|deg>  pole.<k>.<hz|re|im>  zero.<k>.<hz>    from transferOf, k from 1
corner.<low|high>                                    −3 dB frequencies, hertz
T.<mag|deg>  pm  gm_db                               loop gain at the cursor frequency, margins
hd2  thd                                             percent, from the spectrum view's FFT
slope                                                V/s of the scope's ramp between two cursors
clip.<high|low>                                      the scope's flat tops, volts
vn.<density|rms>                                     V/√Hz at the cursor frequency, V over the band
junction.<v0|w|cj|cd|is|slope>                       Group C's closed forms
```

`experiments.test.js` resolves every path against the analysis and fails on a path
it cannot resolve, as Elements' does.

## 5. Library netlists

Values are the plan's §4.3 defaults. Node names are fixed so that `reads` paths and
layouts agree across lanes. Layouts follow Elements' 420 × 180 grid idiom and are the
owning lane's.

```js
// Group A: the non-inverting amplifier on the macro op-amp (A1, A2, A3, A5)
[{ type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: p.E },
 { type: 'OPAMP', id: 'U1', nodes: ['out'], ctrl: ['in', 'n'], gain: 1e5, vsat: 12, rout: 75,
   gbw: p.gbw, slew: p.slew, vos: p.vos, ib: p.ib, cmrr: p.cmrr, imax: p.imax },
 { type: 'R', id: 'Rf', nodes: ['out', 'n'], value: 10000 },
 { type: 'R', id: 'Rg', nodes: ['n', 'gnd'], value: 1000 },
 { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: p.RL }]
// A4: the same with V1 a 10 V step, and RL = 1 kΩ.
// A6: precision rectifier. D1 inside the loop, the load returns the feedback.
[{ type: 'V', id: 'V1', nodes: ['in', 'gnd'], wave: { kind: 'sine', amp: 0.01, freq: 1000 } },
 { type: 'OPAMP', id: 'U1', nodes: ['x'], ctrl: ['in', 'out'], gain: 1e5, vsat: 12 },
 { type: 'D', id: 'D1', nodes: ['x', 'out'], model: 'drop' },
 { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: 10000 }]

// Group B (Elements I9, I10)
// I9 clamper: C1 in series from the source, D1 from out to ground (anode at ground).
[{ type: 'V', id: 'V1', nodes: ['in', 'gnd'], wave: { kind: 'sine', amp: 10, freq: 60 } },
 { type: 'C', id: 'C1', nodes: ['in', 'out'], value: 10e-6 },
 { type: 'D', id: 'D1', nodes: ['gnd', 'out'], model: 'drop' },
 { type: 'R', id: 'RL', nodes: ['out', 'gnd'], value: 100000 }]
// I10 doubler: the clamper above feeding a peak rectifier D2, C2, RL.

// Group D onward: the CE stage, the lab's reference circuit (D7, E1 to E4, F, G, H1, K)
[{ type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
 { type: 'R', id: 'R1', nodes: ['vcc', 'b'], value: p.R1 },     // 55.6 kΩ and 12.2 kΩ give V_BB = 1.80 V, R_B = 10.0 kΩ
 { type: 'R', id: 'R2', nodes: ['b', 'gnd'], value: p.R2 },
 { type: 'R', id: 'RC', nodes: ['vcc', 'c'], value: 5000 },
 { type: 'R', id: 'RE', nodes: ['e', 'gnd'], value: 1000 },
 { type: 'C', id: 'CE', nodes: ['e', 'gnd'], value: 47e-6 },     // bypass, off in the DC group
 { type: 'V', id: 'Vs', nodes: ['s', 'gnd'], wave: { kind: 'sine', amp: p.amp, freq: 1000 }, small: true },
 { type: 'R', id: 'Rs', nodes: ['s', 'sin'], value: 1000 },
 { type: 'C', id: 'CC', nodes: ['sin', 'b'], value: 10e-6 },     // coupling
 { type: 'Q', id: 'Q1', nodes: ['c', 'b', 'e'], model: p.model, beta: p.beta, va: p.va, cpi: 20e-12, cmu: 2e-12 }]
// The plan's headline −184 is v_out/v_b of this stage with RE bypassed, r_o on, at
// I_C = 1 mA. From Vs through Rs the divider into r_π ∥ R_B costs a further 0.672.
// Lane 1's reference test uses the same netlist with the bias replaced by ideal
// sources: V_BE set to give I_C = 1.000 mA, V_CE = 5 V.

// D4, D5, E5, F6, H5: the common-source stage
[{ type: 'V', id: 'VDD', nodes: ['vdd', 'gnd'], value: 5 },
 { type: 'R', id: 'RD', nodes: ['vdd', 'd'], value: 10000 },
 { type: 'R', id: 'RS', nodes: ['s', 'gnd'], value: 2500 },
 { type: 'V', id: 'VG', nodes: ['g', 'gnd'], value: 1.9 },
 { type: 'M', id: 'M1', nodes: ['d', 'g', 's'], vt: p.vt, kn: 20e-3, lambda: 0.02 }]

// D6: the CMOS inverter, matched
[{ type: 'V', id: 'VDD', nodes: ['vdd', 'gnd'], value: 5 },
 { type: 'V', id: 'Vin', nodes: ['in', 'gnd'], value: p.vin },
 { type: 'M', id: 'Mp', nodes: ['out', 'in', 'vdd'], polarity: 'p', vt: 0.7, kn: 20e-3 },
 { type: 'M', id: 'Mn', nodes: ['out', 'in', 'gnd'], polarity: 'n', vt: 0.7, kn: 20e-3 }]

// G1: a port with a dependent source inside
[{ type: 'I', id: 'It', nodes: ['gnd', 'x'], value: 1e-3 },                 // the test source
 { type: 'R', id: 'R1', nodes: ['x', 'gnd'], value: 1000 },
 { type: 'VCCS', id: 'G1', nodes: ['x', 'gnd'], ctrl: ['x', 'gnd'], gain: p.g }] // 10 mA/V, sign flips

// I1: the mirror.  J1: the pair.  Values from the plan's §4.3.
[{ type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 },
 { type: 'R', id: 'Rref', nodes: ['vcc', 'ref'], value: 9300 },             // 1 mA reference
 { type: 'Q', id: 'Q1', nodes: ['ref', 'ref', 'gnd'], beta: p.beta, va: p.va },
 { type: 'Q', id: 'Q2', nodes: ['out', 'ref', 'gnd'], beta: p.beta, va: p.va },
 { type: 'V', id: 'Vout', nodes: ['out', 'gnd'], value: p.vout }]
[{ type: 'I', id: 'Itail', nodes: ['e', 'vee'], value: 1e-3 },
 { type: 'V', id: 'VCC', nodes: ['vcc', 'gnd'], value: 10 }, { type: 'V', id: 'VEE', nodes: ['vee', 'gnd'], value: -10 },
 { type: 'R', id: 'RC1', nodes: ['vcc', 'c1'], value: 5000 }, { type: 'R', id: 'RC2', nodes: ['vcc', 'c2'], value: 5000 },
 { type: 'Q', id: 'Q1', nodes: ['c1', 'b1', 'e'] }, { type: 'Q', id: 'Q2', nodes: ['c2', 'b2', 'e'] },
 { type: 'V', id: 'Vid', nodes: ['b1', 'b2'], value: p.vid }, { type: 'V', id: 'Vcm', nodes: ['b2', 'gnd'], value: 0 }]
```

Anything past Group J is specified by the plan's numbers and the owning lane writes
the netlist, following these names.

## 6. What each lane pins

Every number in the plan's §5 for your groups becomes a `reads` pair or a `claim`
checked in `experiments.test.js`. The lanes that can start now:

| Lane | Pins |
| --- | --- |
| 2, Group A | 11 mV output offset at gain 11. 10 mV from 100 nA through 100 kΩ, cancelled by `R_f ∥ R_g`. 90.909 kHz at gain 11, 9.901 kHz at gain 101. 0.5 V/µs ramp, 20 µs for 10 V. `f_M = 7.958 kHz` at 10 V. 158 µV at 90 dB and 5 V. 2.5 V clip into 100 Ω. 7 µV tracking error |
| 3, Group C | `V_0 = 752.9 mV`. 0.72 pF and 3.45 pF. 19.3 pF and 318.3 MHz. 4.5 K doubling, −1.66 mV/K and −1.99 mV/K |
| 4, Group B | lowest point at −0.7 V, mean 9.3 V, one conduction. 18.6 V, and the cycle count to 99 % |
| 5, seams | H7: the roots of `s² + (R/L)s + 1/LC` equal Circuit Lab's poles for the same values, and the Bode magnitude at three frequencies equals the product of distances to them. Circuit Lab: `h(t) = (1/τ)e^{−t/τ}` integrates to the step within RK4's error, and a square wave's response equals the sum of shifted steps |

The pins are functions of the knobs, computed in the test from the parameters,
never constants typed in.

## 7. Verify before every push

```
npx vitest run                                   # the whole monorepo, from the root
npm run lint:prose                               # every word a reader sees
npm run build                                    # every app
npx vite preview --outDir apps/electronics-lab/dist --port 431N --strictPort &
cd apps/electronics-lab && APP_URL=http://localhost:431N node scripts/verify.mjs
```

Lanes 4 and 5 run the Elements or Circuit Lab harness instead, on their own port. The
harness catches what unit tests cannot: a prop not passed, a pane fed stale state, a
plot that stopped redrawing. Extend it for every view you add. Screenshot every view
at 390 px and at 1280 × 900 and read the screenshots as a student would, per
`/REVIEW_PLAYBOOK.md` §11.

## 8. Gotchas the other labs paid for

- Engineering-notation fields read a bare number in the displayed prefix. Harness
  code types explicit prefixes ("4.7k", "100n").
- Write TeX with editor tools, never through a shell heredoc. Add the
  lost-backslash guard test Signal Lab has.
- A test that fails may be the test. Decide which, and say which in the commit.
- Tolerances are relative to the solution's scale (`solutionScale` in `pwl.js`),
  never a fixed epsilon. A circuit with millivolts and kilovolts in it has taught
  this once already.
- Wherever two numbers are shown as equal, ask what could make them differ silently.
  Then remove the cause or print it.
- The dark launch is enforced by a test. While `RELEASE_STATUS` says `dark`,
  nothing outside `apps/electronics-lab/` may mention the lab, and the release test
  fails when anything does.
