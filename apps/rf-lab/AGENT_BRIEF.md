# RF Lab: build brief

The plan is `/RF_LAB_PLAN.md`, and this brief turns it into lanes an agent can
take without colliding with another. Read the plan's §2 (engine), §4 (app) and
§5 (curriculum) for your lane before writing a line. Reed reviews everything,
and Reed alone releases the lab.

Every number in this brief was computed by `apps/rf-lab/scripts/pins.mjs`
before it was written. Run that script to re-derive any figure below.

## Boundaries: read first

- **One lane per agent, one worktree per agent.** `PROGRAM.md` §2: the branch is
  `lab/rf-lab`, the worktree gets its own `npm ci`, and nothing is pushed by an
  overseer.
- **Edit only the files your lane owns** (§1). Everything else is read-only. A
  change you need outside your lane goes into `apps/rf-lab/NEEDS.md` under your
  lane's heading. The owning lane picks it up.
- **Never edit a shared surface.** `site/`, `README.md`,
  `packages/ui/src/LabNav.jsx`, `.github/workflows/deploy.yml`, `CURRICULUM.md`,
  `packages/ui/src/progression.test.js` and `PROGRAM.md` belong to the director.
  Write what you need from them into `NEEDS.md`.
- **Stage by path.** `git add packages/rf/src/match.js`, never `git add -A` and
  never `commit -a`. Commit after every group, so a lane cut off part way leaves
  finished work behind it.
- **Preview port.** 4181, which is one past the Fields Lab's.

## The house discipline

Read `/CORE_SCOPE.md`, `/STYLE.md` and `/REVIEW_PLAYBOOK.md` first. Then the
rule every lab obeys: **every explanatory sentence is a claim about physics, and
a test must measure it.** A lesson quotes no number the engine does not produce.
A number is never typed into a test as a constant when it can be computed from
the knobs. On-screen text passes `node packages/prose/bin/lint.mjs`.

This lab carries one extra rule, because it is the lab `CORE_SCOPE.md` uses for
its own worked refusal. **Every object in `packages/rf` states its class in its
own comment before it is written.** Exact, guarded with a threshold, or declined
with a reason. `packages/rf/index.js` holds the three lists, and a lane that
adds an object adds it to the right one.

Commit messages are narrative: what changed, why, and what fell out. Read
`git log` for the register. Never put a model name in a commit or a file.

## 1. The lanes

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | The exact core | `packages/rf/src/{const,convert,sparam,cascade,smith,line}.js` and their tests, `packages/rf/src/invariants.test.js`, `packages/rf/index.js`, `packages/rf/package.json` | done | invariants 1, 2, 3, 5, 6, 7 fuzzed green before any UI exists |
| 2 | The chart canvas | `packages/ui/src/SmithCanvas.jsx` and its test, plus its line in `packages/ui/index.js` | done | the Fields Lab's and Instruments Lab's props are in from the first commit, and the test drives them |
| 3 | The app shell | everything in `apps/rf-lab/` not owned by a group lane, `RELEASE_STATUS`, `release.test.js`, `scripts/pins.mjs` | done | the shell loads at 390 px with no horizontal scroll, and the release test passes dark |
| 4 | Groups A and B | `src/groups/{a,b}.js`, `src/lessons/{a,b}.js`, `src/terms/{a,b}.js` | done | every A and B number pinned, A5's refusal on screen with its reason |
| 5 | Matching, then Groups C and D | `packages/rf/src/match.js` and test, `src/groups/{c,d}.js`, `src/lessons/{c,d}.js`, `src/terms/{c,d}.js`, `src/components/SparamPane.jsx` | done | invariant 4 green, C1's network solved to \|Γ\| under 1e-12 |
| 6 | The device, then Group E | `packages/rf/src/{stability,devices}.js` and tests, `src/groups/e.js`, `src/lessons/e.js`, `src/terms/e.js` | after the gate | invariants 8, 9, 10 green, E5's error inside its bound |
| 7 | Noise, then Group F | `packages/rf/src/{noise,budget}.js` and tests, `src/groups/f.js`, `src/lessons/f.js`, `src/terms/f.js` | after the gate | invariant 11 green, F3's three shares pinned |
| 8 | Linearity and the mixer, then Group G | `packages/rf/src/{linearity,mixer}.js` and tests, `src/groups/g.js`, `src/lessons/g.js`, `src/terms/g.js` | after lane 1 | invariant 12 green, the drive guard tested at both thresholds |
| 9 | Oscillators and power, then Group H | `packages/rf/src/{leeson,pa}.js` and tests, `src/groups/h.js`, `src/lessons/h.js`, `src/terms/h.js` | after lane 1 | H2's three offsets pinned, the model's label on screen |

**The gate.** Lanes 6 and 7 need the Electronics Lab's `smallSignal` and
`transferOf` for the two curated device sets, and its Group O for the noise
densities. Neither lane starts until that lab's engine is merged. Plan Decision 4
says the device data is generated from a small-signal netlist this suite solves,
never loaded from a vendor file, so the gate is about the netlist and not about
the data.

Lanes 5, 8 and 9 need nothing outside the suite and can run beside each other.
Every lane past 4 rebases onto lanes 1, 2 and 3 before it commits.

## 2. The app skeleton (lane 3)

The Fields Lab's shape, file for file, with what this lab does not need deleted.

```
apps/rf-lab/
  index.html  package.json  vite.config.js  RELEASE_STATUS (dark)
  AGENT_BRIEF.md  NEEDS.md  scripts/pins.mjs
  src/App.jsx  main.jsx  styles.css
  src/experiments.js      merges groups/*.js in plan order, no prose
  src/lessons.js          merges lessons/*.js, and holds readQuantity
  src/groups/{a..h}.js    one file per group, owned by that group's lane
  src/lessons/{a..h}.js   the see / try / why registers, same owner
  src/terms.js            the registry, merging terms/{a..h}.js
  src/math.js             one analysis per experiment, and nothing else calls the engine
  src/view.js             the props each view takes, computed from the analysis
  src/format.js           every number a reader sees comes through here
  src/report.js           the issue link's summary
  src/components/panes.jsx  the line, sweep and numbers panes
  src/release.test.js  experiments.test.js  prose.test.js  terms.test.js
```

`experiments.test.js` is the Fields Lab's file with this lab's quantity paths
added. Copy it, do not rewrite it.

## 3. Contracts

Every signature below is a promise between lanes. A lane may add to its return
shape, never rename or remove. Each contract names the failing test written
beside it.

### 3.1 The two-port record (lane 1, `sparam.js`)

```js
// The record every module trades in. Each entry is a complex.js [re, im] pair.
{ f, z0, s: [[S11, S12], [S21, S22]] }

/** A record, checked. `s` entries may be pairs or { mag, deg } as a datasheet quotes them. */
export function sparam({ f, z0 = 50, s })

/**
 * The S-matrix of any circuit `@ee-labs/network` solves, from two exact AC
 * solves. `ports` names the two port nodes, both referred to ground, and the
 * netlist carries no independent source of its own.
 *
 * Port 1 is driven by a one-volt source through Z0 and port 2 is terminated in
 * Z0, so a2 is zero, a1 = 1/(2 sqrt(Z0)) and the reading is
 *   S11 = 2 V1 − 1     S21 = 2 V2
 * with no current needed. Then the ports swap and it solves again.
 */
export function sFromNetlist(net, ports, f, { z0 = 50 })
export function s11FromNetlist(net, port, f, { z0 = 50 })   // a one-port, same reading

export function reflection(ZL, z0)      // (Z_L − Z0)/(Z_L + Z0); Infinity is its own case
export function loadFrom(gamma, z0)     // Z0 (1 + Γ)/(1 − Γ)
export function mismatch(ZL, z0)        // { gamma, mag, deg, vswr, returnLossDb, mismatchLossDb, powerAccepted }
export function entryOf(sp, i, j)       // { re, im, mag, db, deg }
export function largestSingular(sp)     // passivity, computed without a cancelling determinant
export function unitarityError(sp)      // the largest entry of S†S − I
export function dissipated(sp)          // 1 − |S11|² − |S21|²
```

Test (`sparam.test.js`): the pi attenuator at 1, 3, 6, 10 and 20 dB is matched
at both ports and loses the decibels it was designed for. `s11FromNetlist` of a
resistor equals `reflection` of the same resistor. An LC network has a
unitarity error under 1e-11 and a resistor added to it dissipates.

### 3.2 Conversion (lane 1, `convert.js`)

```js
export function sToZ(S, z0)     // Z0 (I + S)(I − S)^{-1}
export function zToS(Z, z0)     // (Z − Z0 I)(Z + Z0 I)^{-1}
export function sToY(S, z0)     // (1/Z0)(I − S)(I + S)^{-1}
export function yToS(Y, z0)
export function sToAbcd(S, z0)  // throws when S21 is zero: no path, no chain matrix
export function abcdToS(M, z0)
// and the two-by-two arithmetic every one of them is written in:
export { eye2, madd, mdet, mdiff, minv, mmul, mnorm, msub, mdagger }
```

`minv` throws `RfError` with `kind: 'singular'` and a message naming what has no
inverse. **The threshold is relative to the matrix's own scale, never a fixed
epsilon.** The same singular matrix written in milliohms and in kilohms is the
same object, and both are refused. The ratio the guard reads is the determinant
over the square of the largest entry, and it is held above `1e-10`. That number
is about digits. A two-by-two inverse keeps about that fraction of the sixteen
digits it starts with, so `1e-10` leaves the eight this package's round trips
are stated to.

Test (`convert.test.js`): a series impedance has the chain matrix `[[1, Z], [0,
1]]` and no Z-matrix. A shunt admittance has `[[1, 0], [Y, 1]]` and no Y-matrix.
An ideal transformer of ratio 2 has `S11 = 3/5` and no Z-matrix at all, and the
message says which description is missing.

### 3.3 Cascading (lane 1, `cascade.js`)

```js
export function cascadeS(a, b)      // the closed composition; both must share z0
export function chainViaAbcd(list)  // the same cascade by the matrix product
export function chainAbcd(list)     // the chain matrices multiplied, left to right
export function elementAbcd(kind, value, f)  // 'R','L','C' in series, 'Rp','Lp','Cp' in shunt
export function seriesAbcd(Z)       // [[1, Z], [0, 1]]
export function shuntAbcd(Y)        // [[1, 0], [Y, 1]]
export function transformerAbcd(n)  // [[n, 0], [0, 1/n]]
```

`cascadeS` throws `kind: 'resonance'` when `1 − S22 S11` between the blocks
vanishes. That is a lossless resonance between two mismatched ports, and no
finite steady state describes it.

Test (`cascade.test.js` and invariant 2): two pads cascade to the sum of their
decibels with S11 still zero. Two mirrors facing each other are declined by
name.

### 3.4 The chart (lane 1, `smith.js`)

```js
// Inherited from @ee-labs/fields rather than written twice. One set of circles
// in the suite, which is what apps/fields-lab/NEEDS.md §3.2 asks for.
export { zToGamma, gammaToZ, normalise, resistanceCircle, reactanceCircle, towardsGenerator }

export function conductanceCircle(g)   // the resistance circle turned half a turn
export function susceptanceCircle(b)
export function vswrCircle(s)          // centred at the origin, radius (S − 1)/(S + 1)
export function qArc(Q, sign)          // through ±1, centred at (0, ∓1/Q)
export function chartFamilies({ mode, r, x })   // 'impedance' | 'admittance' | 'both'
export function circlePoints(circle, n)
export function circleError(circle, point)      // relative to the radius
export function meetsUnitDisc(circle)           // the test a stability circle is read by
export function place(ZL, z0)          // { z, gamma, mag, deg, vswr, q }
export function lineLocus(gamma, { beta, alpha, length, steps })
```

Test (`smith.test.js` and invariant 5): every family is checked by mapping
points through `(z − 1)/(z + 1)`, written out again in the test. A circle that
is right by construction and wrong by arithmetic fails there.

### 3.5 The line (lane 1, `line.js`)

```js
export function uniformLine({ Z0, epsr, len, alpha })
// R/L = G/C, so gamma = alpha + j omega / v_p and Z0 = sqrt(L/C) are both exact.
// That is the distortionless line, a definition rather than an approximation.

export function lineAbcd(line, f, { atLength })   // { abcd, at, length }
export function lineSparam(line, f, { z0, atLength })
export function electricalLength(line, f)         // { lambda, degrees, wavelengths, beta, alpha, vp, Z0, length }
export function repeatFrequency(line, f)          // v_p / 2l, exactly
export function sweepLine(line, ZL, { from, to, points, z0, log })
export function quarterWaveZ0(Zin, ZL)            // sqrt(Zin Z_L), real loads only

export function refuseRational(line, f)           // throws, kind: 'not-rational'
export function rationalAvailable(line, f)        // { ok: false, says, delay }
```

Test (`line.test.js` and invariants 6 and 7): a line split into N sections
cascades back to the whole, for every N. The refusal fires on a lossless line
and on a lossy one. Its message names `e^(-gamma l)`, the absence of finite
poles and zeros, and the sweep that does exist.

### 3.6 The chart canvas (lane 2, `packages/ui/src/SmithCanvas.jsx`)

`PROGRAM.md` §4: a canvas built for one lab carries the second lab's needs in
its props from the start. The Smith chart's second and third labs are the Fields
Lab and the Instruments Lab, and both are in from the first commit.

```jsx
<SmithCanvas
  mode="impedance"        // 'impedance' | 'admittance' | 'both'
  z0={50}                 // the reference the chart is normalised to
  grid={{ r: [...], x: [...] }}      // which families to draw
  points={[{ gamma, label, kind }]}  // kind: 'load' | 'source' | 'match' | 'plain'
  paths={[{ points, label, kind, dashed }]}
  circles={[{ cx, cy, radius, label, kind, shade }]}  // shade: 'inside' | 'outside' | null
  rotate={0}              // degrees, the reference-plane offset (Instruments Lab)
  caption=""
/>
```

`rotate` is the Instruments Lab's calibration plane, applied to every point and
path and to nothing else, because moving the plane moves the measurement and not
the chart. `shade` is the Group E stability circle. `paths` is the Fields Lab's
rotation towards the generator and this lab's matching path.

```js
// The geometry, exported so a test can check it without a canvas.
export function smithGeometry(width, height)   // { cx, cy, r, k }
export function toScreen(geometry, gamma)      // [x, y] in CSS pixels
export function rotateGamma(gamma, degrees)
```

Test (`SmithCanvas.test.jsx`): the geometry is square whatever the pane's
aspect ratio. The open sits at the right edge and the short at the left.
`rotate` moves a point by the angle asked for and leaves its magnitude alone.
Every mode draws the families it names.

### 3.7 The S-parameter view (lane 5, `apps/rf-lab/src/components/SparamPane.jsx`)

The plan's §4.2 second shared canvas. It lives in the app rather than in
`packages/ui`, which is the lane table's reading of Decision 5. The Instruments
Lab's need is in its props from the first commit. A promotion is then a move
rather than a rewrite.

```jsx
<SparamPane exp={exp} x={x} p={p} plane={0} />
```

`plane` is the calibration-plane offset in degrees towards the generator. It
turns the angle of every entry and leaves every magnitude alone, by twice the
offset on a reflection and once on a transmission, because a reflected wave
crosses the moved length twice. The legend says when the plane has moved.

The props are computed in `src/view.js` beside every other view's, and the
component imports them. `src/math.js` is the only file that calls the engine.
`src/view.js` is the only one that shapes a picture from it. A props function
inside a component would break that arrangement.

```js
// In src/view.js, so a test can check the props without a canvas.
export function sparamPropsFor(exp, p, x, plane = 0)
// -> { from, to, marker, plane, keys, floor, ceiling, traces[], at[], name }
```

Test (`panes.test.jsx`): all four entries are drawn twice, once in decibels and
once as an angle, and all four are read at the marker. A plane of 30 degrees
moves no magnitude and turns S11 by 60 degrees and S21 by 30. A frequency
outside the swept window draws no marker line and is named in the legend, and
the four readings stay.

## 4. The lesson schema, and the quantity paths

The Fields Lab's three registers, unchanged. `see` (≤ 70 words), `try` (each
step ≤ 45 words, with `set` and `reads`) and `why` (≤ 160 words). An experiment
is `{ id, group, kind, name, terms, params, view, views, headline, ...the
kind's own fields }`.

`experiments.test.js` applies each step's `set` over the defaults, runs the
analysis and checks every `reads` pair. Then every number-with-unit in the
sentence has to be one of those readings or a knob value. A path that names
nothing throws, so a lesson cannot quietly read `undefined` and pass.

Quantity paths a `reads` pair may name:

```
gamma.<re|im|mag|deg>                     the reflection coefficient
vswr  returnLoss  mismatchLoss  accepted  the same number in its other costumes
zl.<re|im|mag|deg>                        the load
zin.<re|im|mag|deg>                       looking into the line
z.<re|im>  y.<re|im>                      normalised, and its reciprocal
line.<lambda|degrees|wavelengths|beta|vp|Z0|length|delay|repeat|fraction>
loss.<oneWay|roundTrip|alphaDb>           decibels, from alpha and the length
source.<mag|vswr|deg>                     the reflection seen back at the source
turn.<deg|perMetre|shrink>                what a length of line does on the chart
locus.<mag|deg>                           where the path ends
wave.<vmax|vmin|swr|dMax|dMin|quarter|firstG|lastG>   the standing wave along it
circle.<r|x|g|b|vswr>.<cx|cy|radius>      the families, by name
point.<name>.<re|im|mag|deg>              a named point on the chart
shunt.<re|im|mag|deg>  shunt.y.<re|im>    where a shunt element moved the point
onCircle.<r|x|g>                          how far a point is off the circle it should be on
sweep.<points|spacing|first|last|spread>  the exact sweep, point by point
handOver.<ok>                             whether the rational hand-over is offered
headline                                  the one number the topbar shows
p.<knob>                                  a knob value, for a `why` that names its own setting
```

That list is the one `readQuantity` has a case for.
`apps/rf-lab/src/lessons.js` carries the same list in its own comment. A path
that names nothing throws rather than reading `undefined`, so a name which
drifts out of this table fails a test rather than passing quietly.

Groups C and D added these. Each reads off the analysis by its own path, rather
than through a case in `readQuantity`.

```
design.<Q|Xs|Xp|R|RS|X|up|direct>        the synthesis, before any component
element.<series|shunt>.<value|X|kind>    the components that reactance asks for
cancel.<X|value|kind>                    what cancels a complex load's reactance
chosen.<orientation|elements.length>     which arrangement is on screen
count  oneOverQ  awayAt                  how many match, 1/Q, and where they part
away.<n>.<here|twice|ok>                 each arrangement, at f0 and at 2 f0
at.<mag|vswr|returnLossDb>               what the finished network reads
bw.<lower|upper|width|fractional|bounded>  the band, by bisection on the exact response
qw.<Z0|len|vp|RS|RL>                     the quarter-wave section
lumpedBw.<fractional>  wider             the L network it is measured against
solved  solvedMag  agree                 S11 by a solve, against the closed form
waves.<a|b>                              the incident and the returning wave
s.<11|12|21|22>.<re|im|mag|db|deg>       the four entries
conv.<count|names|missing>               which descriptions this two-port has
conv.roundTrip.<ok|error>                S to Z to ABCD to Y to S
power.<sum|dissipated|reciprocity|unitarity|largest>
built.<name|pad.series|pad.shunt>        the circuit the experiment built
```

The later groups need more (`k`, `mu`, `mag`, `nf`, `iip3`, `pn`). Each is added
by the lane that builds the group needing it.

## 5. Library fixtures, with fixed names

Values are the plan's §4.3 defaults, computed by `scripts/pins.mjs`. Names are
fixed so that `reads` paths and layouts agree across lanes.

```js
// The reference line, groups A and B. PTFE, so v_p = 2.06876e8 m/s, which is
// 69.0066 % of c. At 1.000 GHz the wavelength is 20.6876 cm.
uniformLine({ Z0: 50, epsr: 2.1, len: QUARTER, alpha: 0 })
// QUARTER = phaseVelocity(2.1) / (4 * 1e9) = 5.17191 cm, computed and not typed,
// so a quarter wave is exactly a quarter wave and Z_in is exactly 25.000 ohms.

// The reference loads. 100 ohms gives Γ = 0.33333 and VSWR 2.0000. 25 ohms gives
// the same magnitude at 180 degrees. 30 − j40 gives Γ = −j0.50000 and VSWR 3.0000.

// The pi attenuator, groups D onward. From the decibels asked for:
//   K = 10^(db/20), series = Z0 (K² − 1)/(2K), shunt = Z0 (K + 1)/(K − 1)
// At 3.000 dB in 50 ohms that is 17.6148 ohms between two of 292.402 ohms.
{ elements: [
  { type: 'R', id: 'Rsh1', nodes: ['p1', 'gnd'], value: shunt },
  { type: 'R', id: 'Rser', nodes: ['p1', 'p2'], value: series },
  { type: 'R', id: 'Rsh2', nodes: ['p2', 'gnd'], value: shunt },
] }

// The quarter-wave transformer, C4 and D4. Z0 = sqrt(50 × 100) = 70.7107 ohms,
// |S11| = 0.333333 and |S21| = 0.942809, and the two squares sum to 1.000000000000.
// Its fractional bandwidth measures 36.697 % at the knob's 1.2222 and 36.700 % at
// the exact eleven ninths the closed form uses, so the pin follows the knob.
uniformLine({ Z0: quarterWaveZ0(50, 100), epsr: 2.1, len: QUARTER })

// The two device sets, lane 6, quoted the way a datasheet quotes them. Decision 4
// generates them from the Electronics Lab's hybrid-pi and converts to S here.
sparam({ f: 2e9, z0: 50, s: [
  [{ mag: 0.894, deg: -60.6 }, { mag: 0.020, deg: 62.4 }],
  [{ mag: 3.122, deg: 123.6 }, { mag: 0.781, deg: -27.6 }] ] })   // K = 0.6071
sparam({ f: 8e9, z0: 50, s: [
  [{ mag: 0.641, deg: 171.3 }, { mag: 0.057, deg: 16.3 }],
  [{ mag: 2.058, deg: 28.5 }, { mag: 0.572, deg: -95.7 }] ] })    // K = 1.4332
```

## 6. What each lane pins

Every number in the plan's §5 for your groups becomes a `reads` pair checked in
`experiments.test.js`. Each pin is a function of the knobs, recomputed in the
test, never a constant typed in.

| Lane | Pins |
| --- | --- |
| 4, Group A | Γ = 0.33333 at 100 Ω and −0.33333 at 25 Ω. VSWR 2.0000, return loss 9.5424 dB, mismatch loss 0.51153 dB. Γ = −j0.50000 at 30 − j40 Ω, VSWR 3.0000, return loss 6.0206 dB. v_p = 2.06876e8 m/s, 69.0066 % of c, λ = 20.6876 cm, a quarter of it 5.17191 cm. Z_in 25.000 Ω at 1.000 GHz, 40.000 − j30.000 Ω at 500 MHz, 100.00 Ω at 2.000 GHz. α = 0.050000 Np/m is 0.43429 dB/m, and moves the quarter wave to 25.097 Ω. The reflection at the source falls to 0.33161. The response repeats every 2.0000 GHz |
| 4, Group B | The open at Γ = 1, the short at −1, the match at 0. r = 1 is centred at (0.50000, 0) with radius 0.50000, x = 1 at (1, 1.0000) with radius 1.0000, g = 1 at (−0.50000, 0) with radius 0.50000. The standing-wave circle's radius is 0.33333. β = 30.372 rad/m, so a quarter wave turns 180.00 degrees and a centimetre turns 34.803 degrees. With loss, \|Γ\| falls to 0.33161 over that quarter wave. y = 0.50000 for a 100 Ω load |
| 5, Groups C and D | Q = 1.0000, X_s 50.00 Ω and X_p 100.0 Ω, so 7.9577 nH and 1.5915 pF, and one over Q is 1.0000. Q = 3.0000, 2.3873 nH and 9.5493 pF, one over Q 0.33333. The measured band of the 50 Ω to 100 Ω match is 60.58 % to a ratio of 1.500 and 28.72 % to 1.2222, from 650.1 MHz to 1.256 GHz. The section is 70.711 Ω, 5.172 cm, and 36.697 % to a ratio of 1.2222. The 3 dB pad is 17.61 Ω between two of 292.4 Ω, S21 −3.0000 dB and S11 zero, and two of them give −6.0000 dB. The transformer of ratio 2 gives S11 0.60000 and S21 0.80000 with two descriptions of four. \|S11\| 0.33333 and \|S21\| 0.94281, summing to 1.000000000000. An 8 nH and 1.6 pF network dissipates 0.021792 behind 1 Ω and 0.10080 behind 5 Ω |
| 6, Group E | K = 0.6071, \|Δ\| = 0.6964, μ = 0.8628, MSG 21.934 dB, the load circle at 0.9347 + j0.9914 with radius 0.4997. K = 1.4332, μ = 1.1314, MAG 11.667 dB. U = 0.10851, bounds −0.895 dB and +0.998 dB, measured +0.834 dB |
| 7, Group F | kT₀ = −173.975 dBm/Hz, T_e = 119.64 K at 1.5 dB, NF 1.8618 dB with shares 77.07 %, 17.61 % and 5.32 %, and 4.8618 dB behind a 3.000 dB pad |
| 8, Group G | −6.0206 dB and −3.9224 dB, an IF of 400.0 MHz and an image at 1.600 GHz, 31.485 dB of rejection. IIP3 +21.249 dBm, gaps 74.535 dB and 38.098 dB, errors −0.0024 dB and −0.159 dB |
| 9, Group H | 2.5330 pF, 1256.6 Ω, 50.000 MHz. −89.59, −117.00 and −139.59 dBc/Hz, and 6.020 dB for a doubled Q_L. 50.0 %, 78.540 %, 94.038 % and 12.500 % |

One number in the plan's §5 is not in the table above. The 50 Ω to 100 Ω match
reads a standing-wave ratio of 1.1437 at 900 MHz, which is one point inside a
band C3 states by its two edges. `scripts/pins.mjs` still computes it. No lesson
quotes it, so nothing pins it, and `BACKLOG.md` records the swap.

## 7. Verify before every hand-back

```
npx vitest run apps/rf-lab packages/rf packages/ui --maxWorkers=4
node packages/prose/bin/lint.mjs <every .md you touched>
npm run build --workspace apps/rf-lab
node apps/rf-lab/scripts/pins.mjs
```

Then the harness, once lane 3 has written it. Screenshot every view at 390 px
and at 1280 × 900 and read the screenshots as a student would, per
`REVIEW_PLAYBOOK.md` §11.

## 8. The gate, and what closes it

The release gate is the plan's §9.8, and it is Reed's. Before it, each phase
exits on the list in §1 above. The lab ships dark at `/rf-lab/` until Reed
changes `RELEASE_STATUS`, and `release.test.js` holds every public surface to
saying nothing about the lab while it does.

## 9. Gotchas this suite has already paid for

- **A tolerance is relative to the data's own scale.** The suite's recurring bug
  class is an absolute epsilon on scale-free data. `minv` refuses on the
  determinant over the square of the matrix norm, and every conversion test
  carries a relative tolerance. The first version of that guard held the ratio
  against `1e-14` with a floor of one under the scale, which refused a well
  conditioned Y-matrix in siemens and let an ill conditioned S-matrix through.
- **A determinant that cancels loses eight digits.** The largest singular value
  of a lossless S-matrix came out as 1 + 5e-9 from the trace-and-determinant
  form, because the two terms are equal there. `largestSingular` uses the
  Hermitian eigenvalue form, which subtracts nothing that is nearly equal.
- **The ABCD route is conditioned by 1/\|S21\|.** A chain that passes a millionth
  of what is driven into it loses six digits through the chain matrix.
  Invariant 2 states the agreement against that number rather than a flat
  epsilon.
- **A quarter wave has to be exactly a quarter wave.** The reference line's
  length is computed from the phase velocity and the frequency, never typed as
  5.1719 cm, or Z_in reads 25.0000003 and the note that says "exactly" is wrong.
- **A grid or a phone is not the target, both are.** Nothing may scroll
  horizontally at 390 px. The Smith chart is square, so it sets the pane's
  height from its width, and `min-height: 0` belongs on every flex parent above
  it.
- **A resistance of zero is a wire, not a small resistor.** A 1e-12 ohm resistor
  standing in for a short makes the node equations singular rather than
  lossless, and `solveAC` declines the whole circuit. Leave the element out of
  the netlist instead.
- **A quantity with no unit takes no engineering prefix.** `fmt` printed a
  reflection magnitude of 0.3333 as "333.3 m", which reads as millimetres. The
  lab's `num` gives a plain figure when the unit is empty.
- **A test that fails may be the test.** Decide which, and say which in the
  commit.
