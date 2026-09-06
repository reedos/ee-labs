# Control Lab II: build brief

You are one of up to six agents building this lab in parallel. The plan is
`/CONTROL_LAB_II_PLAN.md`, and this brief turns it into lanes an agent can take
without colliding with another. Read the plan's §2 for the engine and §5 for your
lane's group before writing a line. Reed reviews everything.

## Boundaries: read first

- **One lane per agent.** Work in the overseer's worktree on `lab/control-lab-ii`.
  Do not clone a second copy of the repository, and do not work in the shared
  checkout.
- **Edit only the files your lane owns** (§1). Everything else is read-only. A change
  you need outside your lane goes into `apps/control-lab-ii/NEEDS.md` under your
  lane's heading. Then continue with what you can do. The owning lane picks it up.
- **Workers do not commit.** Hand the result to the overseer, who stages by path.
- **Stage by path**, `git add apps/control-lab-ii/src/groups/a.js`. Never
  `git add -A` and never `commit -a`.
- **Never push.** The director merges `lab/control-lab-ii` at integration.
- **Preview port.** Lane number plus 4320, so lane 3 previews on 4323. The other labs
  use 4300 to 4305 and Electronics uses 4310 to 4317.

## The house discipline

Read `/CORE_SCOPE.md`, `/STYLE.md`, `/REVIEW_PLAYBOOK.md` and `/CONTRIBUTING.md`
first. Then the rule every lab obeys. **Every explanatory sentence is a claim about
physics, and a test must measure it.** A lesson quotes no number the engine does not
produce. A prediction follows every control that can change it. A claim the settings
cannot show is footnoted, never crossed out. On-screen text passes
`npm run lint:prose`.

This lab has one extra rule, because it is the lab with the approximation in it.
**An approximation is never on screen without its guard beside it.** The describing
function's amplitude is never shown without the harmonic ratio and the exact
simulation's amplitude. A fit is never shown without its residual. If you find
yourself writing a pane that omits one, the pane is wrong.

Commit messages are narrative. Read `git log` for the register. No model name goes
into a commit or a file.

## 1. The lanes

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | The engine | `packages/systems/src/{matrix,ss,discrete,nonlinear,describing,phase,ident}.js` and their tests, plus the additions to `index.js` | done | ten invariants green, §3 contracts met |
| 2 | The app shell | everything in `apps/control-lab-ii/` not owned by lanes 3 to 6, plus `RELEASE_STATUS`, `release.test.js` and `scripts/verify.mjs` | now | the shell loads a stub experiment at 390 px, the release test passes dark |
| 3 | Groups A and B | `src/groups/{a,b}.js` and `src/components/StatePane.jsx` | after lane 2's first commit | A1 to A7 and B1 to B7 pinned |
| 4 | Groups C and D | `src/groups/{c,d}.js` and `src/components/PhaseCanvas.jsx` | after lane 2's first commit | C1 to C6 and D1 to D5 pinned, the discrepancy on screen |
| 5 | Groups E and F | `src/groups/{e,f}.js` and `src/components/FitCanvas.jsx` | after lane 2's first commit | E1 to E5 and F1 to F2 pinned |
| 6 | Terms and the math panel | `src/terms.js`, `src/math.js`, `src/report.js` and their tests | after lane 2's first commit | every referenced term defined, every definition surfaced |

**The gate.** Lanes 3 to 6 need lane 2's shell and lane 1's engine. Lane 1 is done
and merged. No lane past 2 starts until lane 2's first commit lands, which is the
skeleton, `RELEASE_STATUS` and `release.test.js`.

**Shared seams, landed first.** Lane 2's first commit adds the app skeleton, the
registry stubs in `systems.js`, and the release test. Every other lane rebases onto
it before handing back.

## 2. The app skeleton (lane 2)

Copy Control Lab's shape, file for file, and delete what this lab does not need.

```
apps/control-lab-ii/
  index.html  package.json  vite.config.js  RELEASE_STATUS (dark)
  scripts/verify.mjs
  src/App.jsx  main.jsx  styles.css
  src/systems.js          the plant, controller and nonlinearity registries
  src/analysis.js         one analyse(state), read by every view and every test
  src/experiments.js      merges groups/*.js in plan order
  src/groups/{a..f}.js    one file per group, owned by that group's lane, and
                          carrying the physics and the three registers together
                          (Control Lab's lessons.js is the precedent)
  src/terms.js  math.js  report.js  verdict.js
  src/release.test.js  experiments.test.js  prose.test.js  terms.test.js
  src/components/         StepCanvas, BodeCanvas, StatePane, PhaseCanvas,
                          FitCanvas, LoopDiagram
```

`analysis.js` is the seam that makes the discipline work. One function turns a
state into every number the app can show, so a pane and a test read the same
value from the same code. A number computed twice is a number that can disagree
with itself.

`StepCanvas`, `BodeCanvas` and `LoopDiagram` are copied from `apps/control-lab/src/
components/` with the minimum changed. Each copy is recorded in `NEEDS.md` as a
promotion candidate, because a third lab copying the same file is the signal to
promote it. `PoleZeroCanvas`, `ZPlaneCanvas` and `plot.js` are imported from
`@ee-labs/ui` and are never copied.

`release.test.js` is `apps/circuit-elements-lab/src/release.test.js` with the slug
changed to `control-lab-ii`. Copy it, do not rewrite it.

## 3. Contracts

Every signature below is a promise between lanes. A lane may add to a return shape,
never rename or remove. Each contract ships with the failing test named beside it.

### 3.1 The state space (lane 1, `@ee-labs/systems`)

```js
// The shape, matching toStateSpace in tf.js so the two are one currency.
// Single input, single output. A is rows; B and C are flat; D is a number.
{ A: number[][], B: number[], C: number[], D: number, n: number }

stateSpace({ A, B, C, D })            // validate and normalise; throws StateSpaceError
toTransferFunction(ss)                // -> { b, a }, exact, denominator monic
charPoly(A)                           // -> number[], monic, highest power first
eigenvalues(A)                        // -> [[re, im], ...]
controllability(ss, relTol = 1e-9)    // -> { matrix, rank, singularValues, tol,
                                      //      condition, controllable, n }
observability(ss, relTol = 1e-9)      // -> the same shape, with `observable`
polyFromRoots(desired)                // -> number[]; throws on an unpaired complex root
placePoles(ss, desired)               // -> { K, Acl, achieved, requested, condition }
observerGain(ss, desired)             // -> { L, Aobs, achieved, requested, condition }
lyapunov(A, Q)                        // -> P, or null when singular
lqr(ss, Q, R)                         // -> { K, P, Acl, poles, residual,
                                      //      relResidual, cost(x0) }
ssSeries(first, second)               // -> a state space
ssTrajectory(ss, u, { duration, points, x0 })   // -> { t, y, x }
similarity(ss, T)                     // -> a state space in new coordinates
```

`lqr` returns `residual` and `relResidual` on every call. There is no variant that
omits them, and a pane that prints `K` prints `relResidual` beside it.

Test: `ss.test.js`. The round trip to 1e-9 over 400 fuzzed systems. Rank matching
placement over 200. The scalar Riccati against `P = 1 + √2`. Every refusal message.

### 3.2 The sampled loop (lane 1, `@ee-labs/systems`)

```js
SAMPLES_PER_CYCLE                     // 20, the emulation guard's threshold
ZOH_TF_DECLINED                       // the refusal's exact text

zoh(ss, Ts)                           // -> { A, B, C, D, n, Ts }, exact
discretize(tf, Ts)                    // -> { b, a, Ts } in z, exact
isStableDiscrete(tfz)                 // every pole strictly inside the unit circle
simulateDiscrete(dss, u, { steps, x0 })   // -> { k, t, y, x }
stepDiscrete(dss, opts)               // the unit-step case
stepDiscreteTF(tfz, steps)            // -> { k, t, y }, by the difference equation
zohGain(Ts, omega)                    // T sinc(omega T / 2), exact
zohPhaseLag(Ts, omega)                // -omega T / 2 radians, exact
zohDelay(Ts)                          // Ts / 2 seconds
zohTransferFunction()                 // throws DiscreteError('zoh-not-rational')
substituteS(tf, num, den)             // s = num(z) / den(z), expanded
emulate(tf, Ts, method)               // -> { b, a, Ts, method, approximate: true }
emulationGuard(crossoverHz, Ts)       // -> { samplesPerCycle, threshold, holds,
                                      //      phaseLagDeg, reason }
discreteLoop(plantTf, controllerZ, Ts)// -> { plant, controller, open, closed, error }
sOfZ(z, Ts)                           // -> [re, im], the s pole a z pole came from
```

`emulate` returns `approximate: true` on every call. A pane that shows an emulated
controller shows that label and the guard's verdict.

Test: `discrete.test.js`. The first-order hold against `K(1 − α)/(z − α)` over 300
fuzzed cases. The discrete loop against a held continuous simulation over 120. The
guard at both sides of twenty samples per cycle. The refusal's text.

### 3.3 The nonlinearity, and the two refusals (lane 1)

```js
PWL_KINDS                             // ['saturation', 'deadzone']
SMOOTH_DECLINED                       // the refusal's exact text
RELAY_DECLINED                        // the other refusal's exact text

pwlValue(kind, u, delta)              // the value; throws NonlinearError otherwise
pwlRegions(kind, delta)               // -> { breakpoints, segments }
pwlRegionOf(u, delta)                 // -1, 0 or 1
```

Test: `describing.test.js` and `phase.test.js`. Both refusals by code and by text.

### 3.4 The describing function and its guard (lane 1)

```js
HARMONIC_LIMIT                        // 0.05, the filter hypothesis's threshold

saturationDescribing(delta, A)        // N(A), exact
deadzoneDescribing(delta, A)          // 1 - N(A)
saturationHarmonic(delta, A, n)       // the n-th Fourier sine coefficient, exact
saturationAmplitudeFor(delta, target) // invert N; null when target > 1
negativeRealCrossings(L, freqs)       // -> [{ f, omega, gain }]
describingLimitCycle(L, { kind, delta }, freqs)
// -> { predicted: { amplitude, omega, frequency, N } | null,
//      amplitude, omega, frequency, N, loopGain,
//      harmonicRatio, threshold, holds, reason, crossings }
predictionError(predicted, measured)  // -> { amplitude, frequency }, signed relative
```

`describingLimitCycle` returns `harmonicRatio`, `threshold` and `holds` whether the
guard holds or not. A pane shows the reason instead of the amplitude when `holds` is
false.

Test: `describing.test.js`. Harmonics against a numerical Fourier integral. The
predicted N against the loop's own gain margin. The error against the harmonic ratio
over 16 fuzzed settings, staying between 0.7 and 1.5 of it.

### 3.5 The exact trajectory and the plane (lane 1)

```js
ALGEBRAIC_LOOP_DECLINED               // a plant with feedthrough, refused

loopRegions({ ctrl, plant, kind, delta, reference })
// -> { regions: { '-1': { M, m, slope, offset }, '0': ..., '1': ... },
//      n, nc, np, uRow, uConst, yRow, uOf(z), delta, kind, reference }

pwlTrajectory(spec, { x0, duration, points, maxEvents })
// -> { t, y, u, v, x, events: [{ t, region, u }], hitBound, reason, n, nc, np }

pwlOscillationOf(t, signal, { tailFraction })
// -> { amplitude, period, frequency, omega, cycles, settled } | null

phaseField(spec, { xMin, xMax, yMin, yMax, nx, ny })
// -> { arrows: [{ x, y, dx, dy, region }], uRow, uConst, delta }
switchingLines(spec)                  // -> [{ a, b, c, level }], a x + b y = c
equilibria(spec)                      // -> [{ region, point, real, u, reason }]
lyapunovRate(spec, P, z)              // -> { V, Vdot, region }
```

`ctrl` may have `n = 0`, which is a pure gain, written `{ A: [], B: [], C: [], D: Kp }`.
`plant.D` must be zero, and a nonzero one is declined with `ALGEBRAIC_LOOP_DECLINED`.

Test: `phase.test.js`. The trajectory against the linear closed loop when the limit
is never reached. Every event on a switching line to 1e-9. Refining the grid by ten
giving the same curve to nine decimals and the same events to eight.

### 3.6 Identification (lane 1)

```js
ZETA_MAX                              // 20, the cap on the fitted damping

firstOrderStep(t, tau)                // 1 - e^(-t/tau)
secondOrderStep(t, wn, zeta)          // all three damping cases, exact
fitFirstOrder(t, y)                   // -> { tf, K, tau, poles, order, residual,
                                      //      relResidual, model, method }
fitSecondOrder(t, y)                  // -> { tf, K, wn, zeta, poles, order, ... }
fitStep(t, y)                         // -> { first, second, improvement }
```

Every fit returns `residual` and `relResidual`. There is no shape without them.

Test: `ident.test.js`. Exact recovery on clean data. The residual landing on the
noise at three noise levels. The fitted time constant unbiased over 40 seeds.

### 3.7 The phase canvas (lane 4, and the Machines Lab's needs)

```jsx
<PhaseCanvas
  trajectories={[{ x: [[x1, x2], ...], label, colour }]}
  field={{ arrows: [{ x, y, dx, dy, region }] }}
  lines={[{ a, b, c, label }]}
  equilibria={[{ point, real, label }]}
  levels={[{ P, values: [v1, v2] }]}      // Machines Lab: Lyapunov level sets
  xLabel="Integral of error" yLabel="Output" xUnit="V·s" yUnit="V"
  cursor={{ index }}                       // Machines Lab: shared with the step view
  periodic={false}                         // Machines Lab: wrap at ±π for a rotor angle
  onPick={(x, y) => {}}                    // Machines Lab: click to seed a trajectory
/>
```

The four marked props are there for the Machines Lab, per `PROGRAM.md` §4. This lab
never sets `periodic`, and a test asserts that the canvas honours it, so the second
lab does not have to reopen the file.

Test: `PhaseCanvas.test.jsx`. Every prop rendered. `periodic` wrapping the horizontal
axis. Axes carrying a quantity and a unit, per `REVIEW_PLAYBOOK.md` §4.

### 3.8 The registries (lane 2, `src/systems.js`)

```js
export const PLANTS = {
  firstOrder: { name, group, hint, params, tf, tex, ss },
  motor:      { ... },
  threePole:  { ... },
  twin:       { ... },   // two identical lags from one drive, read as a difference
  split:      { ... },   // two lags, one measured
  twoLag:     { ... },   // the identification target
}
export const CONTROLLERS = { p, pi, pid, lead, state, observer }
export const NONLINEARITIES = { none, saturation, deadzone }
export function buildLoop(plantId, plantP, ctrlId, ctrlP)   // Control Lab's shape
export function buildSampled(plantId, plantP, ctrlId, ctrlP, Ts, method)
export function buildNonlinear(plantId, plantP, ctrlId, ctrlP, nlId, delta, reference)
```

`ss` on a plant is the physical basis, so its states have names. The motor's are
position and speed, and A3 compares that basis with the canonical one.

Test: `systems.test.js`. Every plant's `ss` converts to its own `tf`. Every plant and
controller pair composes a loop that can be analysed.

## 4. The experiment schema

Copy Control Lab's `lessons.js` header and its shape. One entry per experiment,
carrying its physics and its three registers together:

```js
{
  id: 'A5',                 // group letter and number, matching the plan's §5
  group: 'The state',
  name: 'Pole placement',   // <= 10 words
  see: '...',               // <= 70 words, opens with the quantity on screen
  try: [{ say, set, at, reads }],   // each step <= 45 words, verb first
  why: '...',               // <= 160 words
  terms: ['statefeedback', 'ackermann', ...],
  patch: { plant, plantP, ctrl, ctrlP, nl, nlP, Ts, view },
  claim: (analysis) => [...],       // the rows experiments.test.js pins
}
```

Quantity paths a `reads` pair may name:

```
ss.<rank|condition|controllable|observable>       from controllability, observability
place.<k1|k2|pole.N.re|pole.N.im|overshoot|dcgain>
lqr.<k1|k2|cost|residual|pole.N.re>
obs.<l1|l2|pole.N.re|settling>
z.<alpha|b1|pole.N.mag|pole.N.arg|stable>          the sampled plant and loop
hold.<delay|lagdeg|gain>                           exact, at the cursor frequency
guard.<perCycle|threshold|holds|ratio|residual>    whichever guard the view has
nl.<amplitude|omega|N|predicted|measured|error>    the limit cycle, both numbers
phase.<wind|peak|events|equilibria>                the plane's own measures
fit.<K|tau|wn|zeta|residual|relResidual|improvement>
```

`experiments.test.js` resolves every path against the analysis and fails on one it
cannot resolve, exactly as Elements' does.

## 5. What each lane pins

Every number in the plan's §5 for your groups becomes a `reads` pair or a `claim`.
Each is computed from the knobs in the test, never a constant typed in.

| Lane | Pins |
| --- | --- |
| 3, Group A | `[8, 1.8]` from Ackermann at ωₙ = 4 and ζ = 0.7. 4.60 % overshoot. A DC gain of 0.125. `L = [20.4, 215.2]` and error poles at −11.2 ± 11.43j. 0.357 s to catch a wrong state. The LQR gain `1/√R` at five weights, a double pole at −√2 and a cost of √2 at R = 1. Rank 1 of 2 for the twin, and conditions 4002, 402 and 42.1 at three detunings |
| 3, Group B | α = 0.904837 and b₁ = 0.0951626 at Ts = 0.1 s. A 50 ms delay and 9.0 degrees at twenty samples per cycle. Kp = 20.0167 for instability, against a continuous loop stable at 10⁶. Kp = 9.50833 for deadbeat, arriving in one sample 9.516 % short. The emulation error at seven rates, 0.51 % to 49.2 %, proportional to Ts. Forward Euler unstable at and above Ts = 2τ = 20 ms |
| 4, Group C | The resting point at (0.25, 1). Switching lines at `4x₁ − 2x₂ = ±δ`. Peaks 1.079, 1.174, 1.177 and 1.05 and winds 0.340, 0.451, 0.642 and 0.848 at four limits. No real equilibrium at δ = 0.5, output at 0.5, wind 10.5 at 20 s and 20.5 at 40 s. `P = [[1.2083, −0.125], [−0.125, 0.2083]]` with eigenvalues 1.224 and 0.193 |
| 4, Group D | N at four amplitudes, 0.920, 0.609, 0.253 and 0.0636. Harmonic ratios 6.5 % to 33.2 %. ω = √14 = 3.7417 rad/s and a crossing gain of 11.25. N = 0.5625 and A = 2.1816 at Kp = 20, against a measured 2.211 at 3.712 rad/s. Discrepancies from 0.66 % to 2.27 % over five settings. A harmonic ratio of 67.6 % on the resonant loop, and the guard failing |
| 5, Group E | K = 2.5 and τ = 0.8 s recovered to eight figures. τ = 0.362 s and a 13.4 % residual for the wrong order. Residuals 1.03 %, 2.05 % and 5.13 % at three noise levels, with the improvement above 0.999. A mean τ of 0.7987 s and a spread of 0.0054 s over 40 runs at 2 % noise. Poles at −1.4286 and −7.6923 recovered exactly. 92.4 degrees predicted against 52.0 measured, and 0 % overshoot predicted against 13.4 % |
| 5, Group F | The filter gain equal to the transposed regulator's, to floating point |
| 6, terms | Every term a lesson names is defined, and every definition is surfaced by a lesson or by the picker |

## 6. Verify before handing back

```
npx vitest run                                    # the whole monorepo, from the root
npm run lint:prose                                # every word a reader sees
npm run build --workspace apps/control-lab-ii
npx vite preview --outDir apps/control-lab-ii/dist --port 432N --strictPort &
cd apps/control-lab-ii && APP_URL=http://localhost:432N node scripts/verify.mjs
```

The harness catches what unit tests cannot. A prop not passed, a pane fed stale
state, a plot that stopped redrawing. Extend it for every view you add. Screenshot
every view at 390 px and at 1280 by 900, and read the screenshots as a student would,
per `/REVIEW_PLAYBOOK.md` §11.

## 7. Gotchas the other labs paid for

- Engineering-notation fields read a bare number in the displayed prefix. Harness
  code types explicit prefixes, such as "4.7k" and "100n".
- Write TeX with editor tools, never through a shell heredoc. The lost-backslash
  guard test Signal Lab has is worth copying.
- A test that fails may be the test. Decide which, and say which in the commit.
- Tolerances are relative to the solution's own scale, never a fixed epsilon. This
  lab has plants at 1 rad/s and sample times at 1 ms in the same view.
- Wherever two numbers are shown as equal, ask what could make them differ silently.
  Then remove the cause or print it. Group D exists because of that question.
- The dark launch is enforced by a test. While `RELEASE_STATUS` says `dark`, nothing
  outside `apps/control-lab-ii/` may mention the lab.
- The phase plane's axes are two states, and both need a quantity and a unit.
  `REVIEW_PLAYBOOK.md` §4 records four axis defects that shipped without them.
