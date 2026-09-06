# Machines Lab: build brief

You are one of up to five agents building this lab in parallel. The plan is
`/MACHINES_LAB_PLAN.md`, and this brief turns it into lanes an agent can take
without colliding with another. Read the plan's §2 for the engine and §5 for
your lane's group before writing a line. Reed reviews everything.

## Boundaries: read first

- **One lane per agent, one worktree per agent.** The overseer's worktree is on
  `lab/machines-lab`. A lane works in that worktree on the files its lane owns,
  and nowhere else.
- **Edit only the files your lane owns** (§1). Everything else is read only. If
  you need a change outside your lane, write it into
  `apps/machines-lab/NEEDS.md` under your lane's heading and continue with what
  you can do. The owning lane picks it up.
- **Stage by path.** `git add apps/machines-lab/src/groups/c.js`, never
  `git add -A` and never `commit -a`. Workers do not commit. The overseer does.
- **Never push.** The director merges `lab/machines-lab` and pushes.
- **Preview port.** Lane number plus 4320, so lane 3 previews on 4323. The other
  labs use 4300 to 4319.

## The house discipline

Read `/CORE_SCOPE.md`, `/STYLE.md` and `/REVIEW_PLAYBOOK.md` first. Then the
rule every lab obeys. **Every explanatory sentence is a claim about physics, and
a test must measure it.** A lesson quotes no number the engine does not produce.
A prediction follows every control that can change it. A claim the settings
cannot show is footnoted rather than crossed out. On-screen text passes
`npm run lint:prose`.

Commit messages are narrative. Read `git log` for the register. Never put a
model name in a commit or a file.

## 1. The lanes

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | The engine | `packages/machines/**` | done | 127 tests green, the seven invariants fuzzed |
| 2 | The app shell | everything in `apps/machines-lab/` not owned by lanes 3 to 5, plus `RELEASE_STATUS`, `release.test.js`, `scripts/verify.mjs` | now | the shell loads Group A at 390 px, the release test passes dark |
| 3 | Group A and Group B | `src/groups/{a,b}.js`, `src/lessons/{a,b}.js`, `src/components/{TorqueSpeedCanvas,PhasePlaneCanvas}.jsx` | after lane 2's shell | A1 to A8 and B1 to B6 pinned |
| 4 | Group C | `src/groups/c.js`, `src/lessons/c.js`, `src/components/FieldCanvas.jsx` | after lane 3's B1 | C1 to C9 pinned |
| 5 | Group D and Group E | `src/groups/{d,e}.js`, `src/lessons/{d,e}.js`, `src/components/DQCanvas.jsx` | after lane 2's shell | D1 to D7 and E1 to E5 pinned |

**The gate.** Lane 1 is the gate and it is met. Every contract in §3 is
implemented and tested in `packages/machines`. No lane needs a stub.

Lane 4 waits on one thing only. Group C's per-phase circuit is drawn with the
ideal transformer of B1, and C4's lesson cross-references it, so B1 must exist
before C4's note can name it.

**Shared seams, landed first.** Lane 2's first commit adds the app skeleton,
`RELEASE_STATUS`, `release.test.js` and `experiments.js` with an empty group
list. Every other lane builds on that commit.

## 2. The app skeleton (lane 2)

Copy Circuit Elements Lab's shape, file for file, and delete what this lab does
not need:

```
apps/machines-lab/
  index.html  package.json  vite.config.js  RELEASE_STATUS (dark)
  AGENT_BRIEF.md  NEEDS.md
  scripts/verify.mjs  scripts/numbers.mjs
  src/App.jsx  main.jsx  styles.css
  src/experiments.js      merges groups/*.js in plan order, no prose
  src/lessons.js          merges lessons/*.js
  src/groups/{a..e}.js    one file per group, owned by that group's lane
  src/lessons/{a..e}.js   the see / try / why registers, same owner
  src/terms.js            definitions on contact, one registry
  src/analysis.js         one experiment plus its knobs to a solved analysis
  src/quantities.js       the `reads` paths of §4
  src/report.js           the issue link's summary
  src/release.test.js  experiments.test.js  prose.test.js  terms.test.js
  src/components/         TorqueSpeedCanvas, FieldCanvas, PhasePlaneCanvas,
                          DQCanvas, ScopeCanvas, PhasorCanvas, panes.jsx
```

`experiments.test.js` is Elements' file with this lab's quantity paths added.
Copy it rather than rewriting it.

## 3. Contracts

Every signature below is implemented in `packages/machines` and covered by a
test. A lane may read them and must not change them. Adding a field to a return
shape is allowed. Renaming or removing one is not.

### 3.1 The machine description schema

Every model takes one `spec` object. Every `*Of(spec)` fills in the defaults and
throws with the name of the value that is wrong.

```js
// packages/machines/src/dc.js
{ Va: 24, Ra: 1.2, La: 3e-3,     // armature: volts, ohms, henries
  k: 0.06, kt: undefined,        // V·s/rad and N·m/A. kt defaults to k
  J: 2e-4, B: 1e-5,              // kg·m², N·m·s/rad
  TL: 0, loadB: 0,               // N·m, and N·m·s/rad of speed-dependent load
  field: 1,                      // flux as a fraction of rated: scales k
  omega0: 0,                     // starting speed, rad/s. An initial condition
  rs: 1,                         // sense resistance, Ω. Cancelled, see §3.2
  drive: undefined }             // a netlist `wave`, replacing the constant Va

// packages/machines/src/transformer.js
{ Vp: 240, f: 60, n: 2,
  R1: 0.6, X1: 1.2, R2: 0.15, X2: 0.3,   // ohms, X at f
  Rc: 1800, Xm: 800,                     // ohms, primary side
  RL: 6, XL: 0,                          // the load, secondary side
  stage: 'full',                         // 'ideal' | 'leakage' | 'full'
  rs: 1 }

// packages/machines/src/induction.js
{ V: 400/Math.sqrt(3), f: 50, poles: 4,  // phase volts rms
  R1: 1.4, X1: 2.4, R2: 1.2, X2: 2.4,    // ohms per phase, rotor referred
  Xm: 65, Rc: 1200,                      // Rc may be Infinity
  J: 0.05, B: 0.002, TL: 20, loadB: 0 }

// packages/machines/src/sync.js
{ V: 400/Math.sqrt(3), f: 50, poles: 4, E: 260,
  Xs: 8, Xd: 8, Xq: 5, Ra: 0, salient: false, delta: 20*Math.PI/180,
  Xdp: 0.3, Xdpp: 0.2, X2: 0.2, X0: 0.05,   // the network model, per unit
  H: 4, Pm: 1, Sbase: 100e6, Vbase: 400 }
{ R: 0.5, Ld: 2e-3, Lq: 2e-3, lambda: 0.08, pairs: 3,   // the PMSM
  J: 5e-4, B: 1e-4, omegaE: 2*Math.PI*100,
  convention: 'amplitude-invariant' }

// packages/machines/src/losses.js
{ pOut: 3000, pCuFull: 252, pCore: 116, pFriction: 46, strayFraction: 0.005,
  Rth: 0.17, Cth: 6000, ambient: 40, classLimit: 155 }
```

### 3.2 The mechanical state API

```js
/**
 * The shaft as three elements on one node. The rotor is a capacitance in
 * farads whose voltage is the speed in rad/s, the friction is a resistor of
 * 1/B ohms, and the load torque is a current source out of the node.
 * `omega0` is an initial condition, because a frictionless unloaded shaft has
 * no DC path to ground and the solver says so.
 */
export function shaft(node, { J, B, load, loadB, omega0, id })
//   -> { elements, node, J, B, loadB, load, omega0, hasFriction }

/**
 * A branch whose current is readable as a node voltage, and which has no
 * voltage of its own. A resistor R_s and a VCVS of gain −1 across it, in
 * series, so the two drops cancel exactly. `sense` is the node pair whose
 * difference is i·R_s, and `gain(k)` is k/R_s, the VCCS gain that turns it
 * into k times the branch current.
 *
 * Pick R_s at or above the branch's own resistance. Below it the LU solve
 * loses digits, and port.test.js measures both ends of that.
 */
export function senseBranch(id, from, to, rs)
//   -> { elements, sense: [string, string], rs, gain: (k) => number }

/** The mechanical-to-electrical table, in one place. */
export const MECH
export const rpmToRad, radToRpm
```

A machine's netlist is then one call, and `dynamics(net)` reads both rows of `A`
off it without this package writing a matrix:

```js
export function dcNetlist(spec)  // -> { elements, machine, sense, shaft }
export function powerAudit(sol, spec)
//   -> { supplied, copper, friction, load, sense, coupled, dStored,
//         ia, omega, torque, gap }
```

`gap` is zero to rounding by Tellegen. `coupled` is zero when `k_e = k_t` and is
the size of the mistake when they are not. A3 uses that.

### 3.3 The dq API

```js
export const CONVENTIONS = {
  'power-invariant':     { k: √(2/3), k0: 1/√2, orthogonal: true,
                           power: 'p = v_d i_d + v_q i_q + v₀ i₀', torqueFactor: 1 },
  'amplitude-invariant': { k: 2/3, k0: 1/2, orthogonal: false,
                           power: 'p = (3/2)(v_d i_d + v_q i_q) + 3 v₀ i₀',
                           torqueFactor: 3/2 },
}

export function dqMatrix(theta, convention)      // 3 × 3
export function dq0(abc, theta, convention)      // -> [d, q, 0]
export function invDq0(dq, theta, convention)    // the exact inverse
export function clarke(abc, convention)          // dq0 at θ = 0
export function park(ab, theta), invPark(dq, theta)
export function power(vAbc, iAbc, theta, convention)
//   -> { pAbc, pDq, law, vdq, idq }             // pDq === pAbc, both conventions

export function rotatingField({ amp, omega, poles, turns })
//   -> { amplitude, omega, poles, omegaSync, rpmSync, turns, amp }
export function fieldAt(f, theta, t)             // = amplitude·cos(ωt − θ)
```

Every function takes `convention` and every result names the one it used. A
torque constant quoted in the wrong convention is wrong by `3/2`.

### 3.4 The steady-state closed forms

```js
// The DC machine
export function line(spec)
//   -> { stall, noLoad, slope, torqueAt(ω), currentAt(ω), speedAt(T) }
export function operating(spec)
//   -> { omega, ia, torque, emf, pIn, pCu, pMechGross, pFriction, pShaft, efficiency }
export function timeConstants(spec)
//   -> { tauE, tauM, separated, a1, a0, roots: [{re, im}], zeta, wn }
export function control(spec, { volts, fields })

// The transformer
export function idealTransformer(id, [p+, p−], [s+, s−], n, rs)
export function reflected(spec)     // -> { n2, reflectedZL, Req, Xeq, seriesZ }
export function openShort(spec)     // -> { Zoc, Ioc, Poc, Zsc, Zser, Req, Xeq }
export function regulation(noLoad, full)
export function transformerEfficiency({ pOut, pCu, pCore })

// The induction machine
export function perPhase(spec, s)   // a netlist for solveAC. Refuses s = 0
export function imThevenin(spec)    // -> { Vth, Zth, Rth, Xth, Vmag }
export function torqueOfSlip(spec, s)          // exactly 0 at s = 0
export function breakdown(spec)     // -> { sMax, tMax, root, speedAt }
export function torqueCurve(spec, { from, to, points })
export function slipFor(spec, T, { branch })   // throws past breakdown
export function imOperating(spec, solveAC)
export function rotorResistanceFor(spec, sWanted)
export function runUp(spec, { tEnd, steps, tol })
//   -> { t, y, omega, slip, error, relative, says, separated, guardMet }

// The synchronous machine
export function syncPhasor(spec, delta)   // -> { V, E, I, Imag, P, Q, S, pf, excitation }
export function powerAngle(spec, delta)   // -> { field, reluctance, P, torque }
export function pullOut(spec)             // -> { delta, P, torque, exact }
export function syncCurve(spec, { points })
export function reactance(spec, kind)     // 'steady'|'transient'|'subtransient'|'negative'|'zero'
export function internalEmf(spec, { V, P, Q, kind })
export function swing(spec, { Pmax, Pm, damping })
//   -> { M, H, Pm, Pmax, stable, delta0, deltaMax, K, wn, fn, period, zeta,
//         accel(δ, ω̇), plant: {b, a}, area(from, to) }

// The permanent-magnet machine
export function pmsmState(spec)     // -> { A, B, c, states, inputs }
export function pmsmTorque(spec, id, iq)   // -> { magnet, reluctance, torque, convention }
export function focPlant(spec)      // -> { kT, current: {b,a}, speed: {b,a}, tauElec, tauMech }

// Losses
export function lossSplit(spec, x), efficiencyCurve(spec, opts), bestEfficiency(spec)
export function thermal(spec, pLoss)
//   -> { rise, final, tau, headroom, limitLoss, over, riseAt(t), timeTo(T) }
export function thermalNetlist(spec, pLoss, { step })

// Saturation, and the integrator's guard
export function saturate(spec, i)   // -> { lambda, L, model, exact, saturated }
export function saturationLabel(spec)
export function integrate(f, y0, tEnd, { steps, tol })
//   -> { t, y, error, relative, steps, h, order, says }.  Throws past `tol`.
```

## 4. The lesson schema, and the quantity paths

Copy Elements' `lessons.js` header comment and its three registers. They are
`see` (at most 70 words), `try` (each step at most 45 words, with `set`, `at`
and `reads`) and `why` (at most 160 words). An experiment entry is Elements'
shape. It carries `id`, `group`, `name`, `terms`, `params`, `machine`, `net`,
`layout`, `show`, `view`, `views` and `claim`. Two fields are new. `kind` names
the model the experiment opens (`'dc'`, `'transformer'`, `'im'`, `'sync'`,
`'pmsm'`, `'losses'`, `'field'`). `mech` is true when the schematic draws a
shaft.

Quantity paths a `reads` pair may name, on top of Elements' list:

```
mech.<omega|rpm|torque|emf|ia>          the shaft and the armature, now
line.<stall|noLoad|slope>               the torque–speed line
op.<omega|rpm|ia|torque|pIn|pCu|pShaft|efficiency>   the closed-form point
tau.<e|m|separated>  root.<k>           the two time constants, the roots
xf.<vs|vp|is|ip|ratio|reg|eff>          the transformer, rms
xf.<Req|Xeq|Zoc|Zsc|Poc>                the two bench tests
im.<slip|rpm|torque|I1|I2|pf|pIn|pGap|pRotorCu|pShaft|efficiency>
im.<sMax|tMax|tStart|iStart>            breakdown and standstill
sync.<delta|P|Q|I|pf|torque|pullOut|field|reluctance>
dq.<d|q|zero|radius|pAbc|pDq>           at the cursor's angle
pmsm.<kT|tauElec|tauMech|torque>
loss.<pOut|pCu|pCore|pFriction|pStray|total|efficiency|bestX>
heat.<rise|final|tau|headroom|limitLoss>
sat.<lambda|L|saturated>
```

`experiments.test.js` resolves every path against the analysis and fails on a
path it cannot resolve, as Elements' does.

## 5. Library machines

The plan's §4.3 defaults, with fixed names so `reads` paths and layouts agree
across lanes. A group's own file may override a field per experiment. It may
not rename one.

```js
// Group A, every experiment
export const DC = { Va: 24, Ra: 1.2, La: 3e-3, k: 0.06, J: 2e-4, B: 1e-5, TL: 0.05 }
// A5 and A6 use a flywheel so the two time constants separate:
export const DC_FLYWHEEL = { ...DC, J: 4e-3, TL: 0 }

// Group B
export const XF = { Vp: 240, f: 60, n: 2, R1: 0.6, X1: 1.2, R2: 0.15, X2: 0.3,
                    Rc: 1800, Xm: 800, RL: 6, XL: 0 }
// B1 and B2 use { ...XF, stage: 'ideal' }. B3 onward use the default 'full'.

// Group C
export const IM = { V: 400/Math.sqrt(3), f: 50, poles: 4, R1: 1.4, X1: 2.4,
                    R2: 1.2, X2: 2.4, Xm: 65, Rc: 1200,
                    J: 0.05, B: 0.002, TL: 20 }

// Group D
export const SM = { V: 400/Math.sqrt(3), f: 50, poles: 4, E: 260,
                    Xs: 8, Xd: 8, Xq: 5, delta: 20*Math.PI/180 }
export const PM = { R: 0.5, Ld: 2e-3, Lq: 2e-3, lambda: 0.08, pairs: 3,
                    J: 5e-4, B: 1e-4, omegaE: 2*Math.PI*100 }

// Group E. The first four numbers are Group C's own split at its operating
// point, so E audits C's machine rather than a new one.
export const LOSS = { pOut: 3000, pCuFull: 252, pCore: 116, pFriction: 46,
                      strayFraction: 0.005, Rth: 0.17, Cth: 6000,
                      ambient: 40, classLimit: 155 }
```

## 6. What each lane pins

Every number in the plan's §5 for your group becomes a `reads` pair or a `claim`
checked in `experiments.test.js`. Each pin is a function of the knobs, computed
in the test from the parameters, never a constant typed in.

| Lane | Pins |
| --- | --- |
| 3, Group A | `A = [[−400, −20], [300, −0.05]]`. `1.076 V` and `22.92 V` out of `24 V`. `0.0538 N·m` at `0.897 A`. Stall `1.20 N·m`, no load `3819.7 rev/min`, slope `−0.003`, crossing `3648.4 rev/min`. Peak start `19.80 A` at `15.8 ms`, `22` times running. `τ_e = 2.5 ms`, `τ_m = 66.4 ms`, roots `−15.66` and `−384.4`. No-load speeds `1273`, `2546`, `3820 rev/min`. Field `0.5` gives `7639 rev/min`, `0.60 N·m`, `1.908 A` |
| 3, Group B | Both ratios exact at any load and any `n`. `24 Ω` reflected. `113.57 V` against the ideal `120 V`, `R_eq = 1.2 Ω`, `X_eq = 2.4 Ω`. `|Z_oc| = 732.4 Ω`, `31.9 W`, `|Z_sc| = 2.68 Ω`. Regulation `5.47 %`, and `8.07 %` lagging. `2149.7 W` out, `109.2 W` copper, `30.2 W` core, `93.9 %`, peak at `52.6 %` |
| 4, Group C | The travelling wave to nine decimals at 500 pairs. `1500 rev/min` on four poles, `3000` on two. Slip `2.77 %`, `1458.5 rev/min`, `1.38 Hz` in the rotor, zero torque at `s = 0`. `6.25 A` at `0.801`, rotor `4.95 A`. Air gap `3189.6 W`, split `88.3 W` and `3101.3 W`. Breakdown `76.0 N·m` at `s = 0.2443`, `1133.6 rev/min`, `3.74` times rated. Standstill `43.1 A` and `39.5 N·m`, ratios `6.89` and `1.95`. Four times `R₂` moves `s_max` to `0.9774` and leaves `T_max` alone, and `4.09` times puts it at standstill |
| 5, Group D | `11.24 A` at `0.989` leading at `δ = 20°`. Pull-out `22 517 W` at `90°`, margin `2.92`. `10.90 A` lagging at `E = 180 V`. Saliency adds `3856 W` at `20°` and `6000 W` at `45°` with no field, and moves pull-out to `67.7°`. Radii `325` and `398.0`, ratio `√(3/2)`. `A[0][1] = 628.3`, `c[1] = −25 133`. `k_T = 0.36 N·m/A`, `4 ms` and `5 s`, ratio `1250` |
| 5, Group E | `252`, `116`, `46` and `15 W` out of `3429 W`. `87.5 %`, `86.8 %`, `80.8 %`, peak at `77.9 %`. `72.9 K` rise, `17.0 min`. `676 W` at the class limit, `1.39` times full load, `29.4 min` to `100 °C`. `8 H` to `0.4 H` past the knee, `1.32 Wb` where linear said `3.60` |

`apps/machines-lab/scripts/numbers.mjs` prints every one of these from the
package. Run it before you write a lesson, and again after you change a default.

## 7. Verify before you hand back

```
npx vitest run                                   # the whole monorepo, from the root
npm run lint:prose                               # every word a reader sees
npm run build --workspace apps/machines-lab
npx vite preview --outDir apps/machines-lab/dist --port 432N --strictPort &
cd apps/machines-lab && APP_URL=http://localhost:432N node scripts/verify.mjs
```

The harness catches what unit tests cannot. A prop not passed, a pane fed stale
state, a plot that stopped redrawing. Extend it for every view you add.
Screenshot every view at 390 px and at 1280 × 900, and read the screenshots as a
student would, per `/REVIEW_PLAYBOOK.md` §11.

## 8. Gotchas this lab has already paid for

- **The sense resistance has a floor, not a ceiling.** Far below the branch's
  own resistance the LU solve loses digits, and at a millionth of it the drift
  is `1.1 × 10⁻⁷`. Above it costs nothing. `port.test.js` measures both ends.
- **The shaft needs a starting speed.** A frictionless unloaded shaft has no DC
  path to ground, and the solve before `t = 0` gives that reason. `omega0` is an
  initial condition and defaults to rest.
- **Stiffness has a limit.** A mechanical time constant a million times the
  electrical one asks the propagator to hold `e⁻¹⁰⁰⁰⁰⁰⁰` beside `e⁻¹`. Keep the
  knob ranges under a ratio of `10³`.
- **Ratios to zero say nothing.** An unloaded frictionless DC machine settles at
  exactly no current. Compare against the machine's own scale, the stall current
  or the no-load speed, rather than against the answer.
- **The energy ledger needs a grid that resolves the fastest transient.** A
  window sized by the mechanical constant with 200 points does not, and the gap
  that opens is the grid rather than the ledger.
- **Two synchronous speeds.** The mechanical one turns the shaft. The electrical
  one is what the swing equation's angle is measured in. `M = 2H/ω_elec`.
- **The dq convention travels with every number.** A torque constant is wrong by
  `3/2` in the other one. Every result names the convention it used.
- **Engineering-notation fields read a bare number in the displayed prefix.**
  Harness code types explicit prefixes, such as `4.7k` and `100n`.
- **A test that fails may be the test.** Decide which, and say which in the
  commit.
